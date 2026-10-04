// The two export files: fixed column lists, the MRN format, and that nothing private can be in either file.
import { toLinkCsv, toAnalysisCsv, formatMrn, LINK_COLUMNS, ANALYSIS_COLUMNS } from '../src/csv.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const rec = { id: 'abc-1', mrn: '00123456', dob: '2025-03-14', visitDate: '2026-10-04', sex: 'L', ageMonths: 18, values: { sys: 90, dia: 55, hr: 120, rr: 30, temp: 38.5, height: 80, weight: 10.2 },
  sources: { sex: 'photo_ok', dob: 'photo_checked', visit: 'photo_ok', mrn: 'photo_edited', weight: 'photo_ok' }, nutrition: { status: 'SCORE', z: { bbu: -0.3, pbu: 0.1, bbpb: -0.4 }, category: { bbu: 'Berat badan normal', pbu: 'Normal', bbpb: 'Gizi baik' } },
  malaria: { status: 'differs', species: 'falciparum', formulation: 'standard', dhpTablets: '1', dhpDays: 3, pqTablets: '1/4', pqDays: 1, findings: [{ id: 'dhp-differs', level: 'check' }, { id: 'empty-stomach', level: 'info' }], packId: 'malaria-dose-kemenkes-bukusaku', packDraft: true },
  rxSource: 'photo_confirmed', rxEdited: ['species', 'row1-days'], flags: ['a flag, with a comma'], appVersion: 'x' };
const link = toLinkCsv([rec], { exportedAt: 'T' }).split('\r\n'); const ana = toAnalysisCsv([rec], { exportedAt: 'T' }).split('\r\n');
const lh = link[0].split(','); const ah = ana[0].split(',');
check('the link file has exactly the approved columns', JSON.stringify(lh) === JSON.stringify(LINK_COLUMNS) && lh.slice(0, 3).join() === 'mrn,dob,visit_date');
check('the analysis file has exactly the approved columns', JSON.stringify(ah) === JSON.stringify(ANALYSIS_COLUMNS) && ah[0] === 'visit_month');
const FORBIDDEN = /name|nama|alamat|address|phone|telp|bpjs|nik|photo_url|image|token|text/i;
check('no column anywhere is a name, address, phone, BPJS, ID-card, image or raw text column', ![...lh, ...ah].some((c) => FORBIDDEN.test(c)), [...lh, ...ah].filter((c) => FORBIDDEN.test(c)).join());
check('the analysis file has NO mrn and NO dob and no exact visit date', !ah.includes('mrn') && !ah.includes('dob') && !ah.includes('visit_date') && !ana[1].includes('2025-03-14') && !ana[1].includes('00-1234-56') && !ana[1].includes('00123456') && !ana[1].includes('2026-10-04'));
check('the analysis file keeps the visit MONTH only', ana[1].split(',')[0] === '2026-10');
check('the link file has the MRN as 00-1234-56 (leading zeros survive a spreadsheet) and the dob as text', link[1].startsWith('00-1234-56,2025-03-14,2026-10-04,'), link[1].slice(0, 40));
check('MRN formatting: 8 digits only, anything else is left as is', formatMrn('00123456') === '00-1234-56' && formatMrn('1234') === '1234' && formatMrn(null) === '');
check('both files carry which prescription fields were changed', link[1].includes('species | row1-days') && ana[1].includes('species | row1-days') && lh.includes('rx_edited_fields') && ah.includes('rx_edited_fields'));
check('both files carry how each value was obtained and the prescription source', link[1].includes('photo_edited') && link[1].includes('photo_confirmed') && ana[1].includes('photo_confirmed'));
check('a comma inside a value is quoted, rows stay aligned', link[1].includes('"a flag, with a comma"') && link[1].split(',').length > lh.length);
check('the dose findings exported are the ones that differed, with the DRAFT mark', link[1].includes('dhp-differs') && !link[1].includes('empty-stomach') && link[1].includes('(draft)'));
check('a record with a missing field still exports a full row', toLinkCsv([{ id: 'x', mrn: '00000001', visitDate: '2026-01-01', sex: 'P', ageMonths: 3 }], { exportedAt: 'T' }).split('\r\n')[1].split(',').length === lh.length);
console.log(`Exports: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
