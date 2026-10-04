// Prints every number and every quote the dose check depends on, in one CSV, so a clinician can check each line
// against the PDF in about 15 minutes. Run:  node scripts/print-malaria-verification.mjs  (writes docs/malaria-dose-verification.csv)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fmtFraction } from '../src/malaria.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(readFileSync(join(root, 'public/guidelines/malaria-dose.json'), 'utf8'));
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rows = [['group', 'item', 'weight_column', 'age_column', 'amount_in_app', 'page_in_md', 'section', 'exact_quote_or_row', 'CHECKED_AGAINST_PDF (yes/no)', 'PDF_page_if_different', 'comment']];
for (const b of pack.tables.standard.bands) {
  rows.push(['Tabel 1-3 DHP tablet', 'DHP, tablet per hari, hari 1-3', b.label, b.ageLabel, fmtFraction(b.dhp), pack.tables.standard.cites.dhp.page, 'Tabel 1/2/3', pack.tables.standard.cites.dhp.quote, '', '', '']);
  rows.push(['Tabel 1-3 primakuin', 'Primakuin, tablet per hari', b.label, b.ageLabel, b.primaquine ? fmtFraction(b.primaquine) : '- (tidak diberikan)', pack.tables.standard.cites.primaquineFalciparum.page, 'Tabel 1 (P. falciparum); Tabel 2 (vivax/ovale); Tabel 3 (campuran)', `${pack.tables.standard.cites.primaquineFalciparum.quote}  ||  ${pack.tables.standard.cites.primaquineVivax.quote}  ||  ${pack.tables.standard.cites.primaquineMixed.quote}`, '', '', 'Tabel 1, 2 dan 3 membawa jumlah yang sama per kolom berat. Cocokkan ketiganya.']);
}
for (const b of pack.tables.dispersible.bands) rows.push(['Tabel 4 DHP dispersibel', 'DHP dispersibel, tablet per hari, hari 1-3', b.label, '', fmtFraction(b.tablets), pack.tables.dispersible.cite.page, 'Tabel 4', pack.tables.dispersible.cite.quote, '', '', '']);
for (const [k, s] of Object.entries(pack.species)) rows.push(['Jenis plasmodium', `${s.label}: DHP ${s.dhpDays} hari; primakuin ${s.primaquineDays === 0 ? 'tidak diberikan' : `${s.primaquineDays} hari`}`, '', '', `DHP ${s.dhpDays} hari / primakuin ${s.primaquineDays} hari`, s.cite.page, s.cite.section, s.cite.quote, '', '', '']);
for (const [k, c] of Object.entries(pack.statements)) rows.push(['Pernyataan pedoman', k, '', '', '', c.page, c.section, c.quote, '', '', k === 'artesunateDose' ? 'Pedoman tidak menetapkan berat tepat 20 kg. Aplikasi menjawab "tidak yakin" pada 20,0 kg.' : '']);
rows.push(['Angka dari penyusun aplikasi (bukan dari pedoman)', 'Pembulatan dosis artesunat', '', '', `selisih sampai ${pack.artesunate.roundingMg} mg dianggap sama`, '', '', pack.artesunate.roundingNote, '', '', 'Tetapkan atau ubah angka ini bersama dokter.']);
rows.push(['Sumber', 'Tahun terbit', '', '', String(pack.source.year), '', '', pack.source.yearNote, '', '', 'Periksa sampul PDF dan isi tahun yang benar di scripts/build-malaria-pack.mjs']);
rows.push(['Sumber', 'Nomor halaman', '', '', '', '', '', pack.source.transcription, '', '', 'Penanda halaman di berkas .md ditafsirkan sebagai AKHIR halaman. Cek satu atau dua halaman di PDF.']);
writeFileSync(join(root, 'docs/malaria-dose-verification.csv'), '\uFEFF' + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n');
console.log(rows.length - 1, 'lines written to docs/malaria-dose-verification.csv');
