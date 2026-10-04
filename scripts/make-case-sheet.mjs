// Makes the case sheet: 21 made-up children aged 0-59 months who have malaria, with everything to write on the form,
// and the expected app output for each (computed with the same code the app uses, so a photo of the filled form should give the same output).
// All children are INVENTED. Some prescriptions are correct and some contain a deliberate, known error.
// Run: node scripts/make-case-sheet.mjs   (writes docs/case-sheet.json and docs/case-sheet-answer-key.csv)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import LMS from '../src/core/who_lms.js';
import { assess, ageInMonths, nearestHalfCm } from '../src/core/zscore.js';
import { validateMalariaPack, expectedRegimen, checkRegimen, fmtFraction } from '../src/malaria.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pack = validateMalariaPack(JSON.parse(readFileSync(join(root, 'public/guidelines/malaria-dose.json'), 'utf8'))).pack;
const inv = (z, [L, M, S]) => (L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L));
const heightFor = (sex, age, z) => inv(z, age >= 24 ? LMS.hfa[sex][age - 24] : LMS.lhfa[sex][age]);
const weightFor = (sex, age, height, z) => inv(z, (age >= 24 ? LMS.wfh : LMS.wfl)[sex][nearestHalfCm(height).toFixed(1)]);
const pad = (n) => String(n).padStart(2, '0');
function dobFor(visit, ageMonths, extraDays) {            // a date of birth that makes the completed age exactly ageMonths on the visit date
  const [y, m, d] = visit.split('-').map(Number);
  for (let back = 0; back < 2100; back += 1) {
    const dt = new Date(Date.UTC(y, m - 1, d - back - extraDays));
    const s = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    if (ageInMonths(s, visit) === ageMonths) return s;
  }
  throw new Error('no date of birth found');
}
const TAB = { '1/4': '\u00bc', '1/3': '\u2153', '1/2': '\u00bd', '3/4': '\u00be', '1': '1', '3/2': '1\u00bd', '2': '2', '3': '3', '4': '4', '5': '5', '0': '0' };
const toValue = (f) => (f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);

// Each case: age, sex, visit date, target z for height and for weight-for-length/height (or exact weight/height), fever, species, test, formulation, and what to do with the regimen.
//   regimen: 'correct' | { dhpTablets, dhpDays, pqTablets, pqDays } overrides on top of the correct regimen
const SPEC = [
  { id: 'C01', sex: 'L', age: 2, visit: '2026-10-01', hz: 0.0, wz: -0.3, species: 'falciparum', test: 'positive', form: 'standard', note: 'Infant under 6 months, correct: DHP only, no primaquine' },
  { id: 'C02', sex: 'P', age: 3, visit: '2026-10-01', hz: -0.6, wz: -1.2, species: 'falciparum', test: 'positive', form: 'standard', over: { pqTablets: '1/4', pqDays: 1 }, note: 'ERROR: primaquine given to an infant under 6 months' },
  { id: 'C03', sex: 'L', age: 7, visit: '2026-10-02', hz: 0.2, wz: 0.0, species: 'falciparum', test: 'positive', form: 'standard', note: 'Correct: P. falciparum, DHP and primaquine 1 day' },
  { id: 'C04', sex: 'P', age: 9, visit: '2026-10-02', hz: -0.4, wz: 0.8, species: 'vivax', test: 'positive', form: 'standard', note: 'Correct: P. vivax, primaquine 14 days' },
  { id: 'C05', sex: 'L', age: 11, visit: '2026-10-02', hz: 0.0, wz: -0.5, species: 'vivax', test: 'positive', form: 'standard', over: { pqDays: 1 }, note: 'ERROR: P. vivax with primaquine for 1 day instead of 14' },
  { id: 'C06', sex: 'P', age: 14, visit: '2026-10-03', hz: 0.3, wz: -0.2, species: 'falciparum', test: 'positive', form: 'standard', over: 'dhpDouble', note: 'ERROR: DHP amount doubled' },
  { id: 'C07', sex: 'L', age: 18, visit: '2026-10-03', hz: -0.2, wz: -0.4, species: 'falciparum', test: 'positive', form: 'dispersible', note: 'Correct: dispersible DHP' },
  { id: 'C08', sex: 'P', age: 20, visit: '2026-10-03', hz: 0.5, wz: 0.3, species: 'mixed', test: 'positive', form: 'standard', note: 'Correct: mixed infection, primaquine 14 days' },
  { id: 'C09', sex: 'L', age: 24, visit: '2026-10-04', hz: -0.5, wz: -0.8, species: 'malariae', test: 'positive', form: 'standard', over: { pqTablets: '1/4', pqDays: 1 }, note: 'ERROR: primaquine for P. malariae (none expected). Age 24 months: standing tables start here' },
  { id: 'C10', sex: 'P', age: 27, visit: '2026-10-04', hz: 0.0, wz: 0.0, species: 'falciparum', test: 'negative', form: 'standard', note: 'ERROR: blood test recorded NEGATIVE but an ACT was prescribed' },
  { id: 'C11', sex: 'L', age: 30, visit: '2026-10-04', hz: -3.5, wz: -2.2, species: 'falciparum', test: 'positive', form: 'standard', over: { dhpDays: 5 }, note: 'ERROR: DHP for 5 days. Severely stunted and underweight child' },
  { id: 'C12', sex: 'P', age: 33, visit: '2026-10-05', hz: 0.4, wz: 3.5, species: 'falciparum', test: 'positive', form: 'standard', note: 'Correct dose, obese child: the app adds the ideal-weight note' },
  { id: 'C13', sex: 'L', age: 36, visit: '2026-10-05', hz: -1.2, wz: -3.4, species: 'vivax', test: 'positive', form: 'standard', note: 'Correct dose, severely wasted child (Gizi buruk)' },
  { id: 'C14', sex: 'P', age: 40, visit: '2026-10-05', hz: 0.0, wz: -0.6, species: 'falciparum', test: 'positive', form: 'dispersible', over: 'dhpPlusOne', note: 'ERROR: dispersible DHP one tablet too many' },
  { id: 'C15', sex: 'L', age: 45, visit: '2026-10-01', hz: 0.0, wz: 0.0, species: 'falciparum', test: 'positive', treatment: 'severe', note: 'Severe malaria, artesunate dose correct (3 mg/kg under 20 kg)' },
  { id: 'C16', sex: 'P', age: 50, visit: '2026-10-01', hz: 0.6, wz: 0.5, species: 'falciparum', test: 'positive', treatment: 'severe', artesunate: '2.4', note: 'ERROR: artesunate calculated at 2.4 mg/kg instead of 3 mg/kg' },
  { id: 'C17', sex: 'L', age: 56, visit: '2026-10-02', hz: 0.7, exactWeight: 20.0, species: 'falciparum', test: 'positive', treatment: 'severe', artesunate: 'exact60', note: 'EDGE: exactly 20.0 kg. The guideline does not say which rate applies: the app must answer "not sure"' },
  { id: 'C18', sex: 'P', age: 59, visit: '2026-10-02', hz: -0.3, exactWeight: 17.0, species: 'falciparum', test: 'positive', form: 'standard', note: 'EDGE: exactly 17.0 kg (top of the >10-17 kg column). Correct dose. Last month of the 0-59 range' },
  { id: 'C19', sex: 'L', age: 5, visit: '2026-10-03', hz: -0.2, exactWeight: 6.0, species: 'falciparum', test: 'positive', form: 'standard', note: 'EDGE: exactly 6.0 kg and age 5 months: no primaquine, DHP 1/2' },
  { id: 'C20', sex: 'P', age: 12, visit: '2026-10-03', hz: 0.1, wz: -0.1, species: 'falciparum', test: 'positive', form: 'standard', g6pd: 'deficient', note: 'ERROR: standard primaquine given although G6PD deficiency is recorded' },
  { id: 'C21', sex: 'L', age: 1, visit: '2026-10-04', hz: -0.2, exactWeight: 4.4, species: 'falciparum', test: 'positive', form: 'dispersible', dhpTablets: '1', note: 'EDGE: dispersible tablet below 5 kg: the table does not cover it, so the app must answer "cannot check"' },
];
const mrnFor = (i) => { let x = (i * 7919 + 104729) % 100000000; return String(x).padStart(8, '0'); };   // invented, stable, 8 digits
const COMPLAINTS = ['demam 3 hari, menggigil', 'demam tinggi, muntah', 'demam naik turun, lemas', 'demam 2 hari, tidak mau makan', 'demam, menggigil, pucat', 'demam 4 hari, berkeringat'];
const DIAG = { falciparum: 'Malaria falsiparum', vivax: 'Malaria vivaks', mixed: 'Malaria campuran (P.f + P.v)', malariae: 'Malaria malariae' };
const vitalsFor = (age, i) => {                                  // plausible resting values, with some variety
  const hr = age < 12 ? [138, 132, 144, 128][i % 4] : age < 36 ? [124, 116, 132, 120][i % 4] : [108, 100, 112, 96][i % 4];
  const rr = age < 12 ? [38, 34, 42, 36][i % 4] : age < 36 ? [30, 28, 32, 26][i % 4] : [24, 22, 26, 20][i % 4];
  const sys = age < 12 ? [84, 88, 80, 90][i % 4] : age < 36 ? [92, 90, 96, 88][i % 4] : [98, 96, 100, 94][i % 4];
  return { sys, dia: sys >= 96 ? 62 : sys >= 90 ? 58 : 54, hr, rr };
};

const cases = SPEC.map((c, i) => {
  const height = c.exactHeight ?? Math.round(heightFor(c.sex, c.age, c.hz) * 2) / 2;
  const weight = c.exactWeight ?? Math.round(weightFor(c.sex, c.age, height, c.wz) * 10) / 10;
  const temp = [38.6, 39.4, 38.2, 40.1, 38.9, 39.0, 37.8][i % 7];
  const dob = dobFor(c.visit, c.age, i % 9);
  const v = { ...vitalsFor(c.age, i), temp, height, weight };
  const nutrition = assess({ sex: c.sex, ageMonths: c.age, weightKg: weight, lengthCm: height });
  // the correct regimen from the table, then the deliberate error
  let input = { weightKg: weight, ageMonths: c.age, species: c.species, formulation: c.form || 'standard', testResult: c.test, treatment: c.treatment || 'uncomplicated', bbpbCategory: nutrition.category.bbpb, pregnancy: undefined, g6pd: c.g6pd || 'unknown' };
  let regimenText;
  if (input.treatment === 'severe') {
    const mgPerKg = weight < 20 ? 3 : 2.4;
    const mg = c.artesunate === '2.4' ? Math.round(2.4 * weight * 10) / 10 : c.artesunate === 'exact60' ? 60 : Math.round(3 * weight * 10) / 10;
    input.artesunateMg = mg;
    regimenText = `Artesunat IV dosis awal ${String(mg).replace('.', ',')} mg (berat ${String(weight).replace('.', ',')} kg); rujuk`;
  } else {
    const exp = expectedRegimen(pack, { weightKg: weight, ageMonths: c.age, species: c.species, formulation: input.formulation });
    let dhpTablets = c.dhpTablets ?? (exp.ok ? toValue(exp.dhp.tablets) : '1');
    let dhpDays = 3;
    let pqTablets = exp.ok && exp.pq.applies && exp.pq.tablets ? toValue(exp.pq.tablets) : '0';
    let pqDays = exp.ok && exp.pq.applies && exp.pq.tablets ? exp.pq.days : undefined;
    if (c.over === 'dhpDouble') { const f = exp.dhp.tablets; dhpTablets = toValue([f[0] * 2, f[1]]).replace('2/2', '1'); if (dhpTablets === '2/1') dhpTablets = '2'; }
    if (c.over === 'dhpPlusOne') { const f = exp.dhp.tablets; dhpTablets = String(Math.round(f[0] / f[1]) + 1); }
    if (c.over && typeof c.over === 'object') { if ('dhpDays' in c.over) dhpDays = c.over.dhpDays; if ('pqTablets' in c.over) pqTablets = c.over.pqTablets; if ('pqDays' in c.over) pqDays = c.over.pqDays; }
    if (c.g6pd === 'deficient' && pqTablets === '0') { pqTablets = '1/4'; pqDays = 1; }
    Object.assign(input, { dhpTablets, dhpDays, pqTablets, pqDays });
    const dhpLabel = TAB[dhpTablets] ?? dhpTablets;
    regimenText = `DHP${input.formulation === 'dispersible' ? ' dispersibel' : ''} ${dhpLabel} tab 1x1 selama ${dhpDays} hari` + (pqTablets !== '0' ? `; Primakuin ${TAB[pqTablets] ?? pqTablets} tab 1x1 selama ${pqDays} hari` : '');
  }
  const disp = (v) => (v === undefined || v === null || v === '' || v === '0' ? '' : v === '3/2' ? '1 1/2' : v);
  const rxBoxes = input.treatment === 'severe' ? { dhpTablets: '', dhpDays: '', pqTablets: '', pqDays: '' }
    : { dhpTablets: disp(input.dhpTablets), dhpDays: String(input.dhpDays ?? ''), pqTablets: disp(input.pqTablets), pqDays: input.pqDays ? String(input.pqDays) : '' };
  const NUM = { '1/4': 0.25, '1/3': 1 / 3, '1/2': 0.5, '3/4': 0.75, '1': 1, '3/2': 1.5, '2': 2, '3': 3, '4': 4, '5': 5 };
  const BACK = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 1: '1', 1.5: '1 1/2', 2: '2', 2.5: '2 1/2', 3: '3', 4: '4', 5: '5' };
  const FREQ2 = new Set(['C06', 'C14']);                 // two cases are written "twice a day": the same tablets per day, but DHP is once daily (a warning is expected in v4)
  let dhpFreq = 1; let dhpPerDose = disp(input.dhpTablets);
  if (input.treatment !== 'severe' && FREQ2.has(c.id) && NUM[input.dhpTablets] && BACK[NUM[input.dhpTablets] / 2]) { dhpFreq = 2; dhpPerDose = BACK[NUM[input.dhpTablets] / 2]; }
  const dhpName = input.formulation === 'dispersible' ? (i % 2 ? 'DHP dispersibel' : 'Dihidroartemisinin-piperakuin dispersibel') : ['DHP', 'Dihidroartemisinin-piperakuin', 'DHP'][i % 3];
  const pqName = ['Primakuin', 'Primaquine', 'PQ'][i % 3];
  let rxRows = [];
  if (input.treatment !== 'severe') {
    rxRows.push({ name: dhpName, amount: dhpPerDose, perDay: String(dhpFreq), days: String(input.dhpDays ?? '') });
    if (input.pqTablets && input.pqTablets !== '0') rxRows.push({ name: pqName, amount: disp(input.pqTablets), perDay: '1', days: String(input.pqDays ?? '') });
    if (i % 4 === 3 && rxRows.length === 2) rxRows.reverse();                                  // the order is the writer's choice
  }
  if (input.treatment !== 'severe' && temp >= 38.9) rxRows.push({ name: 'Paracetamol', amount: '1/2', perDay: '3', days: '3' });   // not an antimalarial: the app must ignore it
  if (input.treatment !== 'severe' && i % 5 === 0) rxRows.push({ name: 'Amoksisilin', amount: '1/2', perDay: '3', days: '5' });
  const planningFree = input.treatment === 'severe' ? regimenText : (input.formulation === 'dispersible' ? 'DHP dispersibel' : '');
  const dose = checkRegimen(pack, input);
  const dx = (input.treatment === 'severe' ? 'Malaria berat' : DIAG[c.species]) + (c.test === 'negative' ? ' (RDT negatif)' : '');
  return {
    id: c.id, mrn: mrnFor(i + 1), sex: c.sex, ageMonths: c.age, dob, visit: c.visit, complaint: COMPLAINTS[i % COMPLAINTS.length], vitals: v, diagnosisText: dx, planningText: planningFree, rxBoxes, rxRows, regimenText, dhpFreq, note: c.note,
    app: { species: c.species, testResult: c.test, treatment: input.treatment, formulation: input.formulation, dhpTablets: input.dhpTablets, dhpDays: input.dhpDays, pqTablets: input.pqTablets, pqDays: input.pqDays, artesunateMg: input.artesunateMg, g6pd: input.g6pd },
    expected: {
      nutritionAction: nutrition.action, bbu: nutrition.category.bbu, pbu: nutrition.category.pbu, bbpb: nutrition.category.bbpb, zBbu: nutrition.zRounded.bbu, zPbu: nutrition.zRounded.pbu, zBbpb: nutrition.zRounded.bbpb,
      doseStatus: dose.status, doseChecks: dose.findings.filter((f) => f.level === 'check' || f.id === 'artesunate-boundary' || f.id === 'cannot-look-up').map((f) => f.id), doseNotes: dose.findings.filter((f) => f.level === 'info').map((f) => f.id), v4Extra: dhpFreq > 1 ? ['dhp-frequency'] : [],
    },
  };
});

writeFileSync(join(root, 'docs/case-sheet.json'), JSON.stringify({ synthetic: true, note: 'All children are invented. Expected outputs are computed by the app code (pipeline fidelity, not clinical truth).', cases }, null, 1) + '\n');
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const head = ['case', 'mrn', 'sex', 'dob_dd', 'dob_mm', 'dob_yyyy', 'tgl_dd', 'tgl_mm', 'tgl_yyyy', 'age_months', 'td_sys', 'td_dia', 'hr', 'rr', 't', 'tb_cm', 'bb_kg', 'species', 'blood_test', 'treatment', 'formulation', 'dhp_tabs_day', 'dhp_days', 'pq_tabs_day', 'pq_days', 'artesunate_mg', 'g6pd', 'exp_bbu', 'exp_pbu_tbu', 'exp_bbpb_bbtb', 'exp_nutrition_action', 'exp_dose_status', 'exp_dose_checks', 'exp_v4_extra_checks', 'rx_rows_written', 'scenario'];
const rows = cases.map((c) => { const [dy, dm, dd] = c.dob.split('-'); const [vy, vm, vd] = c.visit.split('-'); return [c.id, `${c.mrn.slice(0, 2)}-${c.mrn.slice(2, 6)}-${c.mrn.slice(6)}`, c.sex, dd, dm, dy, vd, vm, vy, c.ageMonths, c.vitals.sys, c.vitals.dia, c.vitals.hr, c.vitals.rr, c.vitals.temp, c.vitals.height, c.vitals.weight, c.app.species, c.app.testResult, c.app.treatment, c.app.formulation, c.app.dhpTablets ?? '', c.app.dhpDays ?? '', c.app.pqTablets ?? '', c.app.pqDays ?? '', c.app.artesunateMg ?? '', c.app.g6pd, c.expected.bbu, c.expected.pbu, c.expected.bbpb, c.expected.nutritionAction, c.expected.doseStatus, c.expected.doseChecks.join(' | '), c.expected.v4Extra.join(' | '), c.rxRows.map((r, n) => `${n + 1}) ${r.name} | ${r.amount} tab x ${r.perDay}/hari x ${r.days} hari`).join(' ; '), c.note]; });
writeFileSync(join(root, 'docs/case-sheet-answer-key.csv'), '\uFEFF' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n');
const catCount = {}; for (const c of cases) for (const k of ['bbu', 'pbu', 'bbpb']) catCount[c.expected[k]] = (catCount[c.expected[k]] || 0) + 1;
console.log(cases.length, 'cases. Nutrition categories seen:', JSON.stringify(catCount));
console.log('dose statuses:', JSON.stringify(cases.reduce((a, c) => { a[c.expected.doseStatus] = (a[c.expected.doseStatus] || 0) + 1; return a; }, {})));
for (const c of cases) console.log(c.id, c.sex, `${c.ageMonths}mo`, `${c.vitals.weight}kg/${c.vitals.height}cm`, '|', c.expected.bbu, '/', c.expected.pbu, '/', c.expected.bbpb, '|', c.expected.doseStatus, c.expected.doseChecks.join(','));
