// English dictionary checks: structure, examples, and a scan that fails when a new Indonesian screen string is added to the code without an English text.
import { readFileSync } from 'node:fs';
import { EN } from '../src/i18n-en.js';
import { trText, t, lang } from '../src/i18n.js';

let passed = 0; let failed = 0;
const check = (name, ok) => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL: ${name}`); } };

// ---- structure
const entries = Object.entries(EN);
check('the dictionary is not empty', entries.length > 250);
check('no empty English text', entries.every(([, v]) => typeof v === 'string' && v.trim() !== ''));
check('every {} in the Indonesian key has a {} in the English text, and the other way round',
  entries.every(([k, v]) => (k.match(/\{\*?\}/g) || []).length === (v.match(/\{\}/g) || []).length));
const INDO = /\b(tidak|belum|yang|dan|atau|untuk|dengan|dari|pilih|periksa|obat|berat|hari|kali|nomor|tanggal|lahir|simpan|hasil|bacaan|tulisan|gambar|sudah|harus|isi|jenis|kosong|angka|kotak|catatan|umur|bulan|tahun|kelamin|resep|baris|dosis|pedoman|ditulis|dicatat|terbaca|dibaca|masih|bisa|ketik|centang|ulang|salah|semua|bandingkan)\b/i;
const stripBrackets = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/"[^"]*"/g, ' ');
const leaks = entries.filter(([, v]) => INDO.test(stripBrackets(v)));
check(`no Indonesian words left in an English text (outside brackets and quotes): ${leaks.map(([k]) => k).slice(0, 3).join(' / ')}`, leaks.length === 0);
check('the default language (no browser) is Indonesian and t() leaves text unchanged', lang === 'id' && t('Simpan') === 'Simpan');

// ---- examples (these are the sentences people will read)
const eq = (name, from, to) => check(`${name}: "${trText(from)}"`, trText(from) === to);
eq('plain', 'Simpan', 'Save');
eq('age, plural', '2 tahun 3 bulan', '2 years 3 months');
eq('age, singular', '1 tahun 1 bulan', '1 year 1 month');
eq('sex and age line', 'Laki-laki, 9 bulan, TGL 2026-10-04', 'Male, 9 months, visit 2026-10-04');
eq('decimal comma becomes a point', 'Berat 6,4 kg tidak sesuai untuk umur 2 tahun.', 'Weight 6.4 kg does not fit age 2 years.');
eq('two sentences in one text',
  'Berat 6,4 kg dan tinggi 85,5 cm tidak sesuai untuk umur 2 tahun. Skor BB/TB -8,38 di luar -5 sampai 5: kemungkinan salah baca atau salah ketik.',
  'Weight 6.4 kg and height 85.5 cm do not fit age 2 years. Score BB/TB -8.38 is outside -5 to 5: probably misread or mistyped.');
eq('check mark kept', '✔ Bacaan konsisten. Tetap bandingkan dengan foto.', '✔ Readings agree. Still compare with the photo.');
eq('dash kept', '– Tidak dapat diperiksa. Tidak yakin: tanyakan ke dokter.', '– Cannot be checked. Not sure: ask a doctor.');
eq('category with the Indonesian term in brackets', 'Gizi buruk', 'Severely wasted (Gizi buruk)');
eq('"Tinggi" means height in a sentence and tall as a category',
  'Tinggi 85 cm di luar rentang 30-130 cm. Periksa salah satuan atau koma.', 'Height 85 cm is outside the range 30-130 cm. Check the unit or the decimal comma.');
check('"Tinggi" alone is the category', trText('Tinggi') === 'Tall (Tinggi)');
eq('dose finding with numbers', 'DHP ditulis 2 kali per hari. Pedoman: DHP diberikan sekali sehari (dosis pada H0, H1 dan H2).',
  'DHP written 2 times per day. Guideline: DHP is given once a day (doses on D0, D1 and D2).');
eq('label inside an error', 'Tekanan darah sistolik harus berupa angka atau dikosongkan.', 'Systolic blood pressure must be a number or left empty.');
eq('a text that is not in the dictionary stays as it is', 'Kalimat yang tidak ada kamusnya sama sekali.', 'Kalimat yang tidak ada kamusnya sama sekali.');
check('typed names and numbers are never touched', trText('00123456') === '00123456' && trText('John Smith') === 'John Smith');

// ---- a new Indonesian string in the code must get an English text (simple strings only; strings with ${} are covered by the screen tests)
const FILES = ['views', 'main', 'malaria', 'recorddate', 'recordchecks', 'rxrows', 'zscore', 'clinic', 'photo'].map((f) => (f === 'zscore' ? 'src/core/zscore.js' : `src/${f}.js`));
const IND2 = /\b(tidak|belum|yang|dan|atau|untuk|dengan|dari|pilih|periksa|obat|berat|hari|kali|nomor|tanggal|lahir|simpan|hasil|bacaan|tulisan|gambar|sudah|harus|isi|jenis|kosong|angka|kotak|catatan|umur|bulan|tahun|kelamin|resep|baris|dosis|pedoman|ditulis|dicatat|terbaca|dibaca|masih|bisa|ketik|centang|ulang|salah|semua|bandingkan|gizi|tablet|primakuin|status|ditinjau)\b/i;
// strings that are internal (not shown) or intentionally not translated
const ALLOW = new Set(['tidak diberikan']);   // placeholder, replaced below if needed
const missing = [];
for (const f of FILES) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
    const lit = (m[1] ?? m[2]).replace(/\\u2013/g, '\u2013').replace(/\\u2714/g, '\u2714').replace(/\\u26a0/g, '\u26a0').replace(/\\u2026/g, '\u2026').replace(/\\u00bd/g, '\u00bd').replace(/\\"/g, '"').replace(/\\'/g, "'");
    if (/^\s|\s$/.test(lit)) continue;   // a fragment of a longer sentence: covered by the screen test
    if (lit.length < 6 || lit.includes('${') || lit.includes('<') || !IND2.test(lit) || /^(\/|\.|#|http|\[)/.test(lit) || ALLOW.has(lit)) continue;
    if (/^[a-z0-9_\-:\/. ]+$/i.test(lit) && !/\s/.test(lit)) continue;   // identifiers
    if (trText(lit) === lit) missing.push(`${f}: ${lit.slice(0, 90)}`);
  }
}
check(`every simple Indonesian string in the code has an English text (missing: ${missing.length})`, missing.length === 0);
if (missing.length) console.log(missing.map((x) => `  - ${x}`).join('\n'));


// ---- every message the checks can produce, generated from a grid of inputs (so rare messages are covered too, not only the ones a screen test happens to reach)
import { join } from 'node:path';
import { validateMalariaPack, checkRegimen } from '../src/malaria.js';
import { assess } from '../src/core/zscore.js';
import { makeDate, checkAge } from '../src/recorddate.js';
import { checkRecordValues } from '../src/recordchecks.js';
import { assembleRx, tabletsPerDay } from '../src/rxrows.js';

const pack = validateMalariaPack(JSON.parse(readFileSync(join(process.cwd(), 'public/guidelines/malaria-dose.json'), 'utf8'))).pack;
const generated = new Set();
const collect = (o, depth = 0) => {
  if (depth > 5 || o === null || o === undefined) return;
  if (typeof o === 'string') { if (/[A-Za-z]{3}/.test(o) && IND2.test(o) && !/^[a-z]+(-[a-z0-9]+)*$/.test(o)) generated.add(o); return; }
  if (Array.isArray(o)) { o.forEach((x) => collect(x, depth + 1)); return; }
  if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'quote' || k === 'cite' || k === 'section' || k === 'page') continue; collect(v, depth + 1); }
};
const species = Object.keys(pack.species);
for (const weightKg of [null, 3, 4.9, 5, 5.5, 8, 12, 17.5, 20, 25, 35, 45, 70, 90, 150]) for (const sp of ['', ...species]) for (const formulation of ['standard', 'dispersible'])
  for (const treatment of ['uncomplicated', 'severe']) for (const testResult of ['positive', 'negative', 'none']) for (const ageMonths of [3, 5, 14, 60, 200])
    for (const pregnancy of ['none', 'pregnant', 'breastfeeding']) for (const g6pd of ['unknown', 'deficient']) {
      for (const dose of [
        { dhpTablets: '', dhpDays: null, pqTablets: '', pqDays: null, artesunateMg: null },
        { dhpTablets: '1/2', dhpDays: 3, dhpTimes: 1, pqTablets: '1/4', pqDays: 1, artesunateMg: 36 },
        { dhpTablets: '4', dhpDays: 2, dhpTimes: 3, pqTablets: '2', pqDays: 14, artesunateMg: 480 },
        { dhpTablets: '1', dhpDays: 3, dhpTimes: 2, pqTablets: '0', pqDays: 7, artesunateMg: 1 },
      ]) for (const bbpbCategory of ['', 'Obesitas']) for (const weightUncertain of [false, true]) {
        const input = { weightKg, weightUncertain, ageMonths, species: sp, formulation, treatment, testResult, pregnancy, g6pd, bbpbCategory, ...dose };
        try { const r = checkRegimen(pack, input); collect(r.findings); collect(r.compared); } catch { /* an input the check refuses is not a message */ }
      }
    }
for (const sex of ['L', 'P', '']) for (const ageMonths of [0, 6, 12, 23, 24, 36, 59, 60, 80, null]) for (const weightKg of [null, 0.5, 3, 8, 15, 40, 90, 200]) for (const lengthCm of [null, 20, 45, 60, 85, 100, 125, 140, 200]) {
  try { const r = assess({ sex, ageMonths, weightKg, lengthCm }); collect(r.flags); collect(r.category); collect(r.names); } catch { /* ignore */ }
}
for (const d of [null, 0, 1, 31, 32]) for (const m of [null, 0, 2, 13]) for (const y of [null, 1800, 2026, 3000]) { try { collect(makeDate(d, m, y)); } catch { /* ignore */ } }
for (const [dob, visit] of [['2026-01-01', '2025-01-01'], ['2026-01-01', '2026-10-04'], ['2000-01-01', '2026-10-04'], ['2015-01-01', '2026-10-04'], ['2026-01-01', '2999-01-01'], ['2026-08-01', '2026-10-04'], ['', '2026-10-04']]) { try { collect(checkAge(dob, visit, '2026-10-04')); } catch { /* ignore */ } }
for (const v of [{}, { sys: 90 }, { sys: 50, dia: 90 }, { sys: 90, dia: 55, hr: 900, rr: 900, temp: 90, height: 700, weight: 900 }, { sys: 90, dia: 55, hr: 120, rr: 30, temp: 38, weight: null, height: null }, { sys: 90, dia: 55, hr: 120, rr: 30, temp: 38, weight: 8, height: null }]) { try { collect(checkRecordValues(v)); } catch { /* ignore */ } }
for (const rows of [
  [{ n: 1, drug: 'dhp', amount: '1/2', freq: 1, days: 3 }, { n: 2, drug: 'dhp', amount: '1/2', freq: 1, days: 3 }],
  [{ n: 1, drug: 'dhp', amount: '1/2', freq: null, days: 3 }],
  [{ n: 1, drug: 'pq', amount: '1/2', freq: 7, days: 3 }, { n: 2, drug: 'art', amount: '1', freq: 1, days: 1 }],
]) { try { const a = assembleRx(rows.map((r) => ({ dispersible: false, ...r }))); collect(a.notes); collect(a.conflicts); } catch { /* ignore */ } }
for (const [amt, f] of [['1/2', null], ['3', 9], ['1/4', 7], ['9', 1]]) { try { collect(tabletsPerDay(amt, f)); } catch { /* ignore */ } }
const untranslated = [...generated].filter((g) => { const o = trText(g); return o === g || INDO.test(stripBrackets(o)); });
check(`all ${generated.size} generated messages are fully translated (not: ${untranslated.length})`, untranslated.length === 0);
if (untranslated.length) console.log(untranslated.slice(0, 40).map((x) => `  - ${x.slice(0, 150)}`).join('\n'));

console.log(`English dictionary: ${passed} passed`);
if (failed) process.exit(1);
