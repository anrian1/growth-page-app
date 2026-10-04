// Form v4 prescription rows: drug name matching, tablets per day = tablets per dose x times per day, and assembling the prescription.
import { matchDrug, voteDrugName, tabletsPerDay, assembleRx } from '../src/rxrows.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const drug = (t) => matchDrug(t).drug;

// ---- names ----
for (const [t, want] of [['DHP', 'dhp'], ['dhp', 'dhp'], ['Dihidroartemisinin-piperakuin', 'dhp'], ['Dihidroartemisinin piperakuin', 'dhp'], ['DHP dispersibel', 'dhp'], ['Dihidroartemisinin-piperakuin dispersibel', 'dhp'],
  ['Primakuin', 'pq'], ['Primaquine', 'pq'], ['PQ', 'pq'], ['Primakuim', 'pq'], ['Prima kuin', 'pq'], ['Artesunat', 'art'], ['Artesunate IV', 'art']]) check(`name "${t}" -> ${want}`, drug(t) === want, String(drug(t)));
for (const t of ['Paracetamol', 'Parasetamol', 'Amoksisilin', 'Zinc', 'Oralit', 'Ibuprofen']) check(`"${t}" is a known other drug, not an antimalarial`, drug(t) === null && matchDrug(t).other === true);
check('unknown scribble is neither an antimalarial nor a known other drug', matchDrug('xqzv').drug === null && matchDrug('xqzv').other === false);
check('an empty name matches nothing', matchDrug('').drug === null && matchDrug('').other === false);
check('both drugs in one name box is a conflict, not a guess', matchDrug('DHP + Primakuin').drug === null && matchDrug('DHP + Primakuin').conflict === true);
check('"dispersibel" is detected from the name', matchDrug('DHP dispersibel').dispersible === true && matchDrug('DHP').dispersible === false);

// ---- voting on the name ----
let v = voteDrugName(['', 'DHP', 'DHP', 'DHP']);
check('3 of 4 readings agree: DHP, ok', v.drug === 'dhp' && v.status === 'ok' && v.votes === 3);
v = voteDrugName(['', 'DHP', 'xx', 'DHP']);
check('2 of 4 agree: DHP, but only "check"', v.drug === 'dhp' && v.status === 'check');
v = voteDrugName(['', 'DHP', 'Primakuin', '']);
check('a split vote gives no drug (the person chooses)', v.drug === null && v.status === 'unclear' && v.candidates.length === 2);
v = voteDrugName(['', '', '', '']);
check('nothing written: empty', v.drug === null && v.status === 'empty');
v = voteDrugName(['', 'Paracetamol', 'Paracetamol', 'Parasetamol']);
check('a known other drug is recognised as "other"', v.drug === 'other' && v.status === 'ok');
v = voteDrugName(['', 'xx', 'yy', 'zz']);
check('unrecognised text: no drug, "unclear" (a person must choose)', v.drug === null && v.status === 'unclear');
v = voteDrugName(['', 'DHP dispersibel', 'DHP dispersibel', 'DHP']);
check('"dispersibel" in 2 of 4 readings counts', v.dispersible === true && v.drug === 'dhp');

// ---- tablets per day = per dose x times per day ----
const tpd = (a, f) => tabletsPerDay(a, f).value;
check('1/2 x 1 = 1/2', tpd('1/2', 1) === '1/2');
check('1/4 x 2 = 1/2', tpd('1/4', 2) === '1/2');
check('1 x 3 = 3 (1x3)', tpd('1', 3) === '3');
check('3 x 1 = 3 (3x1): same tablets per day', tpd('3', 1) === '3');
check('1 x 4 = 4 and 1 x 5 = 5', tpd('1', 4) === '4' && tpd('1', 5) === '5');
check('1 1/2 x 2 = 3', tpd('3/2', 2) === '3');
check('1/2 x 3 = 1 1/2', tpd('1/2', 3) === '3/2');
check('1/3 x 3 = 1', tpd('1/3', 3) === '1');
check('1/4 x 3 = 3/4', tpd('1/4', 3) === '3/4');
check('a total that is not on the tablet list is blank, with the reason', tabletsPerDay('3', 5).value === null && /tidak ada di daftar/.test(tabletsPerDay('3', 5).why));
check('a missing frequency is blank, never assumed to be 1', tabletsPerDay('1/2', null).value === null && tabletsPerDay('1/2', 0).value === null);
check('a missing amount is blank', tabletsPerDay(null, 1).value === null);

// ---- assembling the prescription ----
const row = (n, drug, amount, freq, days, extra = {}) => ({ n, drug, amount, freq, days, dispersible: false, ...extra });
let a = assembleRx([row(1, 'dhp', '1/2', 1, 3), row(2, 'pq', '1/4', 1, 1), row(3, 'other', '1/2', 3, 3), row(4, '', null, null, null), row(5, '', null, null, null)]);
check('DHP and primaquine rows give tablets per day, days, times; the other drug is ignored', a.dhp.tablets === '1/2' && a.dhp.days === 3 && a.dhp.times === 1 && a.pq.tablets === '1/4' && a.pq.days === 1 && a.notes.length === 0 && a.conflicts.length === 0);
a = assembleRx([row(1, 'pq', '1/4', 1, 14), row(2, 'dhp', '1', 3, 3)]);
check('row order does not matter, and 1 x 3 gives 3 tablets per day with the times kept for the warning', a.dhp.tablets === '3' && a.dhp.times === 3 && a.pq.days === 14);
a = assembleRx([row(1, 'dhp', '1/2', 1, 3), row(2, 'dhp', '1/2', 1, 3)]);
check('the same drug in two rows is a conflict: nothing is filled', a.dhp.conflict === true && a.conflicts.includes('DHP') && a.notes[0].includes('2 baris'));
a = assembleRx([row(1, 'dhp', '1/2', null, 3)]);
check('amount without times per day: tablets per day blank, with a note, days still kept', a.dhp.tablets === null && a.dhp.days === 3 && a.notes.some((n) => /keduanya dibutuhkan/.test(n)));
a = assembleRx([row(1, 'dhp', '3', 5, 3)]);
check('a per-day total not on the list is blank, with a note', a.dhp.tablets === null && a.notes.some((n) => /tidak ada di daftar/.test(n)));
a = assembleRx([row(1, 'dhp', '3/2', 1, 3, { dispersible: true })]);
check('a dispersible DHP row sets the formulation', a.formulation === 'dispersible');
a = assembleRx([row(1, 'art', null, null, null)]);
check('an artesunate row only raises the severe hint; no amounts come from it', a.art === true && a.dhp === null && a.pq === null);
a = assembleRx([row(1, 'other', '1', 3, 5), row(2, '', null, null, null)]);
check('only other drugs: no antimalarial in the prescription', a.dhp === null && a.pq === null && a.formulation === null);
console.log(`Prescription rows: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
