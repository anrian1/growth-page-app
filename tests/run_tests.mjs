// Run:  node tests/run_tests.mjs
// Exit code 0 = everything passed. Any failure is printed with the reason.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  assess, ageInMonths, nearestHalfCm, categoryBbu, categoryPbu, categoryBbpb,
} from '../src/core/zscore.js';

const here = dirname(fileURLToPath(import.meta.url));
const Z_TOLERANCE = 0.01;      // a score passes if it is within this of the expected score
const BEYOND = 3;              // weight indices: above this |z|, only the category is compared
let failures = 0;
const fail = (msg) => { failures += 1; console.log('FAIL  ' + msg); };

// ---- tiny CSV reader (handles quotes) ----
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ''));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const num = (s) => (s === '' || s === undefined ? null : Number(s));

// ---- 1. the 52 cases ----
const cases = parseCsv(readFileSync(join(here, 'cases.csv'), 'utf8'));
let casePass = 0;
for (const c of cases) {
  const before = failures;
  const input = {
    sex: c.sex === '' ? null : c.sex,
    ageMonths: num(c.age_months),
    weightKg: num(c.weight_kg),
    lengthCm: num(c.length_cm),
  };
  const r = assess(input);
  if (r.action !== c.exp_action) fail(`${c.case_id}: action ${r.action}, expected ${c.exp_action}`);
  for (const [idx, zCol, catCol] of [['bbu', 'exp_z_bbu', 'exp_cat_bbu'], ['pbu', 'exp_z_pbu', 'exp_cat_pbu'], ['bbpb', 'exp_z_bbpb', 'exp_cat_bbpb']]) {
    const expZ = num(c[zCol]);
    const expCat = c[catCol];
    if (expZ === null && expCat === '') continue;                    // nothing expected for this index
    const gotZ = r.z[idx];
    if (gotZ === null) { fail(`${c.case_id}: ${idx} not calculated`); continue; }
    const skipZ = idx !== 'pbu' && Math.abs(expZ) > BEYOND;
    if (!skipZ && Math.abs(gotZ - expZ) > Z_TOLERANCE) fail(`${c.case_id}: ${idx} z ${gotZ.toFixed(3)}, expected ${expZ}`);
    if (r.category[idx] !== expCat) fail(`${c.case_id}: ${idx} category "${r.category[idx]}", expected "${expCat}"`);
  }
  if (failures === before) casePass += 1;
}
console.log(`Cases: ${casePass} of ${cases.length} passed`);

// ---- 2. category boundaries, using z values only (hand-written expectations) ----
const B = {
  bbu: [categoryBbu, [[-3.001, 'Berat badan sangat kurang'], [-3.0, 'Berat badan kurang'], [-2.999, 'Berat badan kurang'],
    [-2.001, 'Berat badan kurang'], [-2.0, 'Berat badan normal'], [-1.999, 'Berat badan normal'],
    [0.999, 'Berat badan normal'], [1.0, 'Berat badan normal'], [1.001, 'Risiko berat badan lebih']]],
  pbu: [categoryPbu, [[-3.001, 'Sangat pendek'], [-3.0, 'Pendek'], [-2.999, 'Pendek'], [-2.001, 'Pendek'], [-2.0, 'Normal'],
    [-1.999, 'Normal'], [2.999, 'Normal'], [3.0, 'Normal'], [3.001, 'Tinggi']]],
  bbpb: [categoryBbpb, [[-3.001, 'Gizi buruk'], [-3.0, 'Gizi kurang'], [-2.999, 'Gizi kurang'], [-2.001, 'Gizi kurang'],
    [-2.0, 'Gizi baik'], [-1.999, 'Gizi baik'], [0.999, 'Gizi baik'], [1.0, 'Gizi baik'], [1.001, 'Berisiko gizi lebih'],
    [1.999, 'Berisiko gizi lebih'], [2.0, 'Berisiko gizi lebih'], [2.001, 'Gizi lebih'], [2.999, 'Gizi lebih'],
    [3.0, 'Gizi lebih'], [3.001, 'Obesitas']]],
};
let boundaryTotal = 0; let boundaryPass = 0;
for (const [name, [fn, list]] of Object.entries(B)) {
  for (const [z, expected] of list) {
    boundaryTotal += 1;
    if (fn(z) === expected) boundaryPass += 1; else fail(`boundary ${name} z=${z}: got "${fn(z)}", expected "${expected}"`);
  }
}
console.log(`Category boundaries: ${boundaryPass} of ${boundaryTotal} passed`);

// ---- 3. age from date of birth ----
const ageVectors = [
  ['2025-03-14', '2026-09-13', 17], ['2025-03-14', '2026-09-14', 18], ['2026-01-01', '2026-01-01', 0],
  ['2024-02-29', '2025-02-28', 12], ['2024-01-31', '2024-02-29', 1], ['2024-01-31', '2024-02-28', 0],
  ['2024-12-31', '2025-01-30', 0], ['2024-12-31', '2025-01-31', 1], ['2023-10-05', '2025-10-04', 23], ['2023-10-05', '2025-10-05', 24],
];
let agePass = 0;
for (const [dob, visit, expected] of ageVectors) {
  const got = ageInMonths(dob, visit);
  if (got === expected) agePass += 1; else fail(`age ${dob} -> ${visit}: got ${got}, expected ${expected}`);
}
for (const [dob, visit] of [['2026-05-01', '2026-04-30'], ['2026-02-30', '2026-03-01'], ['14-03-2025', '2026-03-01']]) {
  try { ageInMonths(dob, visit); fail(`age ${dob} -> ${visit}: should have thrown`); } catch { agePass += 1; }
}
console.log(`Age from date of birth: ${agePass} of ${ageVectors.length + 3} passed`);

// ---- 4. length rounding to the 0.5 cm table ----
const rounding = [[84.2, 84.0], [84.25, 84.5], [84.74, 84.5], [84.75, 85.0], [45.0, 45.0], [70.0, 70.0]];
let roundPass = 0;
for (const [x, expected] of rounding) {
  if (nearestHalfCm(x) === expected) roundPass += 1; else fail(`nearestHalfCm(${x}) = ${nearestHalfCm(x)}, expected ${expected}`);
}
console.log(`Length rounding: ${roundPass} of ${rounding.length} passed`);

// ---- 5. flagged cases must say WHY (the person needs the reason, not just a warning) ----
const reasonChecks = [
  ['E01', /Weight 84 kg/], ['E02', /Length 6\.9 cm/], ['E03', /Length 830 cm/],
];
let reasonPass = 0;
for (const [id, pattern] of reasonChecks) {
  const c = cases.find((x) => x.case_id === id);
  const r = assess({ sex: c.sex || null, ageMonths: num(c.age_months), weightKg: num(c.weight_kg), lengthCm: num(c.length_cm) });
  if (r.flags.some((f) => pattern.test(f))) reasonPass += 1; else fail(`${id}: no flag matching ${pattern}; flags were: ${JSON.stringify(r.flags)}`);
}
console.log(`Flag reasons: ${reasonPass} of ${reasonChecks.length} passed`);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
