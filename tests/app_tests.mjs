// Run:  node tests/app_tests.mjs
// Tests for the child code, the CSV builder and the on-phone storage (using a fake in-memory database).
import 'fake-indexeddb/auto';
import { isValidCode, checkDigit } from '../src/core/childcode.js';
import { toCsv, COLUMNS } from '../src/csv.js';
import { addRecord, allRecords, clearAll, markExported } from '../src/storage.js';

let failures = 0;
const fail = (m) => { failures += 1; console.log('FAIL  ' + m); };
const section = (name, pass, total) => console.log(`${name}: ${pass} of ${total} passed`);

// ---- child code ----
const valid = ['123455', '000018', '482133', '904177', '736504', '200683'];
const invalid = ['482933', '482313', '482134', '482135', '48213', '4821339', 'abcdef', ''];
let p = 0;
for (const c of valid) { if (isValidCode(c)) p += 1; else fail(`code ${c} should be valid`); }
for (const c of invalid) { if (!isValidCode(c)) p += 1; else fail(`code ${c} should be rejected`); }
if (checkDigit('12345') === 5) p += 1; else fail('checkDigit(12345) should be 5');
section('Child code', p, valid.length + invalid.length + 1);

// ---- CSV ----
const sample = [{
  id: 'r1', childCode: '482133', visitDate: '2026-10-03', dob: '2025-04-01', sex: 'L', ageMonths: 18, weightKg: 8.4, lengthCm: 73,
  z: { bbu: -1.2, pbu: -0.4, bbpb: null }, category: { bbu: 'Berat badan normal', pbu: 'Normal', bbpb: null },
  action: 'FLAG_CONFIRM', flags: ['Weight 84 kg, check "unit" slip', 'second flag'], appVersion: '0.1.0',
}];
const csv = toCsv(sample, { exportedAt: '2026-10-03T10:00:00.000Z' });
const lines = csv.trim().split('\r\n');
p = 0;
if (lines[0] === COLUMNS.join(',')) p += 1; else fail('CSV header differs from COLUMNS');
if (lines[1].includes('"Weight 84 kg, check ""unit"" slip | second flag"')) p += 1; else fail('CSV quoting wrong: ' + lines[1]);
if (lines[1].startsWith('r1,482133,2026-10-03,L,18,8.4,73,-1.2,-0.4,,')) p += 1; else fail('CSV row start wrong: ' + lines[1]);
if (!csv.includes('2025-04-01')) p += 1; else fail('DOB must not be in the CSV by default');
if (toCsv(sample, { includeDob: true }).split('\r\n')[0].split(',')[3] === 'dob' && toCsv(sample, { includeDob: true }).includes('2025-04-01')) p += 1; else fail('includeDob should add the dob column');
section('CSV', p, 5);

// ---- storage ----
p = 0;
await clearAll();
await addRecord({ id: 'a', visitDate: '2026-10-01', createdAt: '2026-10-01T08:00:00.000Z', exportedAt: null });
await addRecord({ id: 'b', visitDate: '2026-10-02', createdAt: '2026-10-02T08:00:00.000Z', exportedAt: null });
let all = await allRecords();
if (all.length === 2 && all[0].id === 'b') p += 1; else fail('records should be newest first: ' + JSON.stringify(all.map((r) => r.id)));
await markExported(['a'], '2026-10-03T00:00:00.000Z');
all = await allRecords();
if (all.find((r) => r.id === 'a').exportedAt && !all.find((r) => r.id === 'b').exportedAt) p += 1; else fail('markExported touched the wrong records');
await addRecord({ id: 'a', visitDate: 'changed', createdAt: '2026-10-01T08:00:00.000Z', exportedAt: null });
if ((await allRecords()).length === 2) p += 1; else fail('saving the same id twice should replace, not duplicate');
await clearAll();
if ((await allRecords()).length === 0) p += 1; else fail('clearAll should empty the database');
section('Storage', p, 4);

console.log(failures === 0 ? '\nALL APP TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
