// Builds public/guidelines/malaria-dose.json from the markdown transcription of the Buku Saku (docs/source/Malaria_clean.md).
// Tables are parsed from the markdown tables; sentences are quoted EXACTLY as they appear in the file, and the script stops
// if a quoted sentence cannot be found, so a quote can never drift from its source.
// PAGES: the .md marks the END of each page with <!-- hlm. N -->; a line belongs to the first marker BELOW it.
// That is an inference about the .md, so every page number must be checked against the PDF by the reviewer.
// Run:  node scripts/build-malaria-pack.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'docs/source/Malaria_clean.md'), 'utf8');
const lines = md.split('\n');

function pageOfLine(i) {
  for (let j = i; j < lines.length; j += 1) { const m = /<!--\s*hlm\.\s*([^>]+?)\s*-->/.exec(lines[j]); if (m) return m[1].trim(); }
  return null;
}
function findLine(fragment) {
  const i = lines.findIndex((l) => l.includes(fragment));
  if (i < 0) throw new Error(`Quote not found in the source: "${fragment}"`);
  return i;
}
const quote = (fragment, section, note) => { const i = findLine(fragment); return { page: pageOfLine(i), section, quote: fragment, ...(note ? { note } : {}) }; };

// ---------------------------------------------------------------- fractions and bands
const GLYPH = { '¼': [1, 4], '½': [1, 2], '¾': [3, 4] };
function fraction(text) {
  const t = String(text).replace(/\b(tab|saset)\b/gi, '').trim();
  if (t === '-' || t === '') return null;
  let m = /^(\d+)\s*([¼½¾])$/.exec(t); if (m) { const [n, d] = GLYPH[m[2]]; return [Number(m[1]) * d + n, d]; }
  m = /^([¼½¾])$/.exec(t); if (m) return GLYPH[m[1]];
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)$/.exec(t); if (m) return [Number(m[1]), 1];
  throw new Error(`Cannot read the amount "${text}"`);
}
function weightRange(label) {
  const t = label.replace(/\s+/g, ' ').trim();
  let m;
  if ((m = /^≤\s*([\d.]+)\s*kg/.exec(t))) return { lo: null, loInclusive: false, hi: Number(m[1]), hiInclusive: true };
  if ((m = /^>\s*([\d.]+)\s*-\s*([\d.]+)\s*kg/.exec(t))) return { lo: Number(m[1]), loInclusive: false, hi: Number(m[2]), hiInclusive: true };
  if ((m = /^>\s*([\d.]+)\s*kg/.exec(t))) return { lo: Number(m[1]), loInclusive: false, hi: null, hiInclusive: false };
  if ((m = /^(?:BB\s*)?([\d.]+)\s*-\s*<\s*([\d.]+)\s*kg/.exec(t))) return { lo: Number(m[1]), loInclusive: true, hi: Number(m[2]), hiInclusive: false };
  throw new Error(`Cannot read the weight range "${label}"`);
}
function ageMonths(label) {
  const t = label.replace(/\s+/g, ' ').trim(); let m;
  if ((m = /^(\d+)-(\d+)\s*bln$/.exec(t))) return [Number(m[1]), Number(m[2])];
  if ((m = /^(\d+)-<(\d+)\s*bln$/.exec(t))) return [Number(m[1]), Number(m[2]) - 1];
  if ((m = /^<(\d+)\s*thn$/.exec(t))) return [0, Number(m[1]) * 12 - 1];
  if ((m = /^(\d+)-(\d+)\s*thn$/.exec(t))) return [Number(m[1]) * 12, (Number(m[2]) + 1) * 12 - 1];
  if ((m = /^≥(\d+)\s*thn$/.exec(t))) return [Number(m[1]) * 12, null];
  throw new Error(`Cannot read the age "${label}"`);
}
const cells = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
function tableAt(titleFragment) {
  const start = findLine(titleFragment);
  const rows = []; for (let i = start + 1; i < lines.length; i += 1) { if (lines[i].startsWith('|')) rows.push(lines[i]); else if (rows.length) break; }
  return { start, rows: rows.filter((r) => !/^\|\s*---/.test(r)).map(cells) };
}

// standard tablets (Tabel 1, same weight bands in Tabel 2 and 3)
function standardTable(title, dhpRowStart, pqRowStart) {
  const t = tableAt(title);
  const head = t.rows[0]; const dhp = t.rows.find((r) => r[1] === 'DHP'); const pq = t.rows.find((r) => r[1] === 'Primakuin');
  if (!dhp || !pq || dhp[0] !== dhpRowStart || pq[0] !== pqRowStart) throw new Error(`Unexpected rows in ${title}: ${JSON.stringify([dhp && dhp[0], pq && pq[0]])}`);
  const bands = head.slice(2).map((h, k) => {
    const [w, a] = h.split('<br>');
    return { label: w.trim(), ageLabel: a.trim(), weight: weightRange(w), ageMonths: ageMonths(a), dhp: fraction(dhp[k + 2]), primaquine: fraction(pq[k + 2]) };
  });
  return { bands, rowQuotes: { dhp: `| ${dhp.join(' | ')} |`, primaquine: `| ${pq.join(' | ')} |` }, line: t.start, dhpRow: dhp, pqRow: pq };
}
const t1 = standardTable('**Tabel 1. Pengobatan Malaria falsiparum', '1-3', '1');
const t2 = standardTable('**Tabel 2. Pengobatan Malaria vivaks dan ovale', '1-3', '1-14');
const t3 = standardTable('**Tabel 3. Pengobatan infeksi campur', '1-3', '1-14');
const same = (a, b) => JSON.stringify(a.bands) === JSON.stringify(b.bands);
if (!same(t1, t2) || !same(t1, t3)) throw new Error('Tabel 1, 2 and 3 do not carry the same amounts (the pack assumes they do); check the source.');

// dispersible (Tabel 4)
const t4 = tableAt('**Tabel 4. Dosis DHP dispersibel');
const d1 = t4.rows.find((r) => r[0] === 'Hari ke-1'); const d2 = t4.rows.find((r) => r[0] === 'Hari ke-2'); const d3 = t4.rows.find((r) => r[0] === 'Hari ke-3');
if (JSON.stringify(d1.slice(1)) !== JSON.stringify(d2.slice(1)) || JSON.stringify(d1.slice(1)) !== JSON.stringify(d3.slice(1))) throw new Error('Tabel 4: the three days carry different amounts (the pack assumes the same amount every day); check the source.');
const dispersible = t4.rows[0].slice(1).map((h, k) => ({ label: h.replace(/^BB\s*/, ''), weight: weightRange(h), tablets: fraction(d1[k + 1]) }));

const pageOf = (title) => pageOfLine(findLine(title));
const tableCite = (title, section, rowQuote) => ({ page: pageOf(title), section, quote: rowQuote, note: 'baris tabel, ditranskripsi dari berkas .md; cocokkan dengan PDF' });

const pack = {
  id: 'malaria-dose-kemenkes-bukusaku',
  title: 'Dosis antimalaria menurut Buku Saku Tata Laksana Kasus Malaria',
  source: {
    name: 'Buku Saku Tata Laksana Kasus Malaria (Kemenkes RI, Direktorat P2PM, bersama IDI), cetakan ke-2',
    year: 2023,
    yearNote: 'Tahun terbit tidak tertulis di berkas. 2023 hanya perkiraan dari rujukan WHO 2022-2023 di dalam teks. Periksa sampul PDF.',
    transcription: 'Teks diambil dari berkas markdown hasil konversi PDF; kesalahan konversi mungkin ada. Nomor halaman dihitung dari penanda halaman di berkas dan harus dicek pada PDF.',
  },
  reviewedBy: null,
  scope: {
    covers: ['DHP tablet biasa dan DHP dispersibel: jumlah tablet per hari menurut berat badan', 'Primakuin: jumlah tablet dan lama hari menurut jenis plasmodium', 'Dosis awal artesunat (mg/kgBB)', 'Larangan primakuin pada bayi <6 bulan, ibu hamil, ibu menyusui bayi <6 bulan dan defisiensi G6PD (hanya peringatan; dosis khusus G6PD tidak dihitung)'],
    doesNotCover: ['Artemeter-lumefantrin dan artesunat-piraonaridin (Tabel 5-7)', 'Kina dan obat lini kedua', 'Malaria vivaks relaps (primakuin 0,5 mg/kgBB, perlu G6PD)', 'Dosis primakuin khusus defisiensi G6PD (hanya dikutip, tidak dihitung)', 'Dosis obat pada ibu hamil dan ibu menyusui (hanya peringatan primakuin)', 'Diagnosis (RDT atau mikroskop) dan pemantauan', 'Gizi buruk atau penyakit penyerta (berkas ini tidak membahasnya)', 'Kekuatan miligram per tablet (tidak tertulis di berkas)'],
  },
  tables: {
    standard: {
      id: 'standard', name: 'DHP tablet + primakuin (Tabel 1, 2, 3)', bands: t1.bands,
      cites: {
        dhp: tableCite('**Tabel 1. Pengobatan Malaria falsiparum', 'Tabel 1', t1.rowQuotes.dhp),
        primaquineFalciparum: tableCite('**Tabel 1. Pengobatan Malaria falsiparum', 'Tabel 1', t1.rowQuotes.primaquine),
        primaquineVivax: tableCite('**Tabel 2. Pengobatan Malaria vivaks dan ovale', 'Tabel 2', t2.rowQuotes.primaquine),
        primaquineMixed: tableCite('**Tabel 3. Pengobatan infeksi campur', 'Tabel 3', t3.rowQuotes.primaquine),
      },
    },
    dispersible: { id: 'dispersible', name: 'DHP dispersibel (Tabel 4)', bands: dispersible, cite: tableCite('**Tabel 4. Dosis DHP dispersibel', 'Tabel 4', `| ${d1.join(' | ')} |`) },
  },
  species: {
    falciparum: { label: 'P. falciparum', dhpDays: 3, primaquineDays: 1, primaquineTable: 'primaquineFalciparum', cite: quote('Primakuin untuk malaria falsiparum hanya diberikan pada hari pertama saja dengan dosis 0,25 mg/kgBB, dan untuk malaria vivaks selama 14 hari dengan dosis 0,25 mg/kgBB.', 'IV.A.1') },
    vivax: { label: 'P. vivax', dhpDays: 3, primaquineDays: 14, primaquineTable: 'primaquineVivax', cite: quote('Primakuin untuk malaria falsiparum hanya diberikan pada hari pertama saja dengan dosis 0,25 mg/kgBB, dan untuk malaria vivaks selama 14 hari dengan dosis 0,25 mg/kgBB.', 'IV.A.1') },
    ovale: { label: 'P. ovale', dhpDays: 3, primaquineDays: 14, primaquineTable: 'primaquineVivax', cite: quote('Pengobatan malaria ovale saat ini menggunakan ACT yaitu DHP selama 3 hari ditambah dengan Primakuin selama 14 hari.', 'IV.A.3') },
    mixed: { label: 'Campuran P. falciparum + P. vivax/ovale', dhpDays: 3, primaquineDays: 14, primaquineTable: 'primaquineMixed', cite: quote('Pada penderita dengan infeksi campur diberikan DHP selama 3 hari serta primakuin dengan dosis 0,25 mg/kgBB/hari selama 14 hari.', 'IV.A.5') },
    malariae: { label: 'P. malariae', dhpDays: 3, primaquineDays: 0, primaquineTable: null, cite: quote('Pengobatan P. malariae diberikan DHP selama 3 hari, dengan dosis sama dengan pengobatan malaria lainnya dan tidak diberikan primakuin.', 'IV.A.4') },
    knowlesi: { label: 'P. knowlesi (PCR)', dhpDays: 3, primaquineDays: 0, primaquineTable: null, cite: quote('Pengobatan malaria knowlesi dengan DHP dan tidak diberikan primakuin.', 'IV.A.6') },
  },
  statements: {
    testPositive: quote('Pengobatan dengan Artemisinin based Combination Therapy (ACT) hanya diberikan kepada penderita dengan hasil pemeriksaan darah malaria positif.', 'Standar Pengobatan 2'),
    dhpDays: quote('Pengobatan DHP diberikan selama 3 hari sesuai dengan berat badan', 'Standar Pengobatan 4'),
    dhpOnceDaily: quote('Pengobatan DHP diberikan selama 3 hari sesuai dengan berat badan, yaitu H(hari) 0 (nol) pada dosis pertama, H1 pada dosis kedua dan H2 pada dosis ketiga.', 'Standar Pengobatan 4'),
    primaquineInfant: quote('Tidak diberikan Primakuin pada bayi <6 bulan, ibu hamil, ibu menyusui bayi usia <6 bulan dan penderita malaria dengan defisiensi enzim G6PD.', 'Standar Pengobatan 3'),
    weightOverAge: quote('Apabila ada ketidaksesuaian antara umur dan berat badan (pada tabel pengobatan), maka dosis yang dipakai adalah berdasarkan berat badan.', 'Catatan b'),
    obesity: quote('Untuk anak dengan obesitas gunakan dosis berdasarkan berat badan ideal', 'Catatan c'),
    dispersibleLimit: quote("Penggunaan DHP dispersible terbatas pada pengobatan malaria tanpa komplikasi untuk anak dan bayi usia 6 bulan ke atas atau bayi dengan berat badan 5 kg atau lebih.", 'IV.A.5 (DHP dispersibel)'),
    g6pdDose: quote('Dosis primakuin pada penderita malaria dengan defisiensi G6PD 0,75mg/kgBB/minggu diberikan selama 8 minggu dengan pemantauan warna urin dan kadar hemoglobin.', 'Catatan e'),
    emptyStomach: quote('Semua obat anti malaria tidak boleh diberikan dalam keadaan perut kosong karena bersifat iritasi lambung.', 'IV.D'),
    severeTreatment: quote('Penderita malaria berat atau dengan komplikasi harus diobati dengan Artesunate intravena dan bila tidak memungkinkan diberikan secara intramuscular.', 'Standar Pengobatan 5'),
    artesunateDose: quote('Dosis artesunat 3 mg/kgBB untuk anak BB <20kg. Anak dengan BB >20 kg menggunakan dosis 2,4 mg/kgBB.', 'VI.B'),
    artesunatePreReferral: quote('Diberikan suntikan artesunate iv/im dosis awal yaitu 2,4mg/kgBB (3 mg/KgBB untuk anak BB < 20 kg), satu kali pemberian dan dirujuk.', 'VI.H'),
  },
  artesunate: { mgPerKgBelow20: 3, mgPerKgAbove20: 2.4, boundaryKg: 20, boundaryUnspecified: true, roundingMg: 0.5, roundingNote: 'Pedoman tidak memberi aturan pembulatan. Selisih sampai 0,5 mg dianggap sama (UPDATE ME: ditetapkan oleh penyusun aplikasi, bukan oleh pedoman).' },
};
mkdirSync(join(root, 'public/guidelines'), { recursive: true });
writeFileSync(join(root, 'public/guidelines/malaria-dose.json'), JSON.stringify(pack, null, 1) + '\n');
console.log('standard bands:', pack.tables.standard.bands.length, '| dispersible bands:', pack.tables.dispersible.bands.length);
console.log('pages: Tabel 1 p.' + pack.tables.standard.cites.dhp.page, '| Tabel 2 p.' + pack.tables.standard.cites.primaquineVivax.page, '| Tabel 3 p.' + pack.tables.standard.cites.primaquineMixed.page, '| Tabel 4 p.' + pack.tables.dispersible.cite.page, '| artesunat p.' + pack.statements.artesunateDose.page, '| pra-rujukan p.' + pack.statements.artesunatePreReferral.page);
