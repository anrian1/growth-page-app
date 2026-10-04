// The form-v4 reader with the scripted fake camera and engine: alignment, all 29 boxes, prescription rows (empty rows skipped, names, tablets per day),
// the sex tick boxes and the privacy filter. This tests wiring and logic, not handwriting.
import { readRecordPage, readRecordFields, RECORD_FIELDS } from '../src/session.js';
import MEDREC from '../src/templates/medical-record.js';
import { engine, photo, script, resetScript, piiTokens } from './fakes.mjs';

let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const read = async () => { const s = await readRecordPage({ file: {}, engine, photo }); return { s, r: await readRecordFields(s, { engine, photo }) }; };

resetScript();
let { s: session, r: row } = await read();
check('the v4 template: 29 numeric boxes (7 vitals, 6 date parts, MRN, 5 rows x 3), 5 name boxes, 2 tick boxes, 5 private areas', RECORD_FIELDS.length === 29 && Object.keys(MEDREC.names).length === 5 && Object.keys(MEDREC.ticks).length === 2 && MEDREC.pii.length === 5);
check('page aligned with at least 28 of the 30 printed labels', session.aligned.ok && session.aligned.anchors >= 28, JSON.stringify([session.aligned.ok, session.aligned.anchors]));
check('all 29 boxes were read or marked empty', RECORD_FIELDS.every((k) => row.cells[k]));
check('vitals, dates and the MRN are read and reliable', row.cells.weight.value === 8 && row.cells.weight.status === 'ok' && row.cells.height.value === 70 && row.cells.mrn.value === '00123456' && row.cells.mrn.status === 'ok' && row.cells.tglY.value === 2026);
check('sex from the tick boxes: boy', row.sex.sex === 'L' && row.sex.status === 'ok');
check('rows 1-3 are used, rows 4-5 are empty', row.rows.map((x) => x.empty).join() === 'false,false,false,true,true');
check('empty rows are NOT read at all (no OCR calls for their boxes)', ['rx4Name', 'rx4Amt', 'rx4Freq', 'rx4Days', 'rx5Name', 'rx5Amt', 'rx5Freq', 'rx5Days'].every((k) => !script.calls[k]), JSON.stringify(script.calls));
check('used rows ARE read', script.calls.rx1Amt >= 3 && script.calls.rx1Name >= 3);
check('row names: DHP, primaquine, and a known other drug', row.rows[0].name.drug === 'dhp' && row.rows[1].name.drug === 'pq' && row.rows[2].name.drug === 'other');
check('tablets per day = per dose x times per day: DHP 1/2, primaquine 1/4', row.rxAuto.dhp.tablets === '1/2' && row.rxAuto.dhp.days === 3 && row.rxAuto.dhp.times === 1 && row.rxAuto.pq.tablets === '1/4' && row.rxAuto.pq.days === 1);
check('the malaria type comes from the Asessemen text', row.rx.fields.species.value === 'falciparum');
check('strips for each used row and the identity boxes are returned', ['row1', 'row2', 'row3', 'dob', 'tgl', 'sex', 'td'].every((k) => row.strips[k] && row.strips[k].w > 0) && row.rects.mrn.w > 200);

// a blank row where screen glare looks like a little ink: one quick read of the row finds no text, so it stays empty
resetScript(); script.noise = new Set(['rx4Name', 'rx4Amt', 'rx5Freq']);
({ r: row } = await read());
check('glare on blank rows: both stay EMPTY (one quick row read each, no full read)', row.rows[3].empty && row.rows[4].empty && script.calls.row4 === 1 && script.calls.row5 === 1 && !script.calls.rx4Amt && !script.calls.rx4Name, JSON.stringify(script.calls));
check('rows that really are written also get the quick read first, then are read in full', !row.rows[0].empty && script.calls.row1 === 1 && script.calls.rx1Amt >= 3);
// very strong ink but nothing readable: the row is kept (a person chooses), never silently dropped
resetScript(); script.strong = new Set(['rx4Name']); script.blank.add('rx4Name');
({ r: row } = await read());
check('strong ink with nothing readable: the row is kept as USED, with no drug (a person must choose)', row.rows[3].empty === false && row.rows[3].name.drug === null && !script.calls.row4, JSON.stringify([row.rows[3].empty, script.calls]));
// a "1" that looks like a slash
resetScript(); script.values = { rx1Freq: '/', rx1Amt: '//2', rx1Days: '/', rx2Amt: '|/4' };
({ r: row } = await read());
check('a slash for 1: times per day read as 1, amount //2 as 1/2, days "/" as 1, |/4 as 1/4, all as guesses (never "ok")', row.cells.rx1Freq.value === 1 && row.cells.rx1Freq.status === 'check' && row.cells.rx1Amt.value === '1/2' && row.cells.rx1Amt.status === 'check' && row.cells.rx1Days.value === 1 && row.cells.rx2Amt.value === '1/4' && row.cells.rx2Amt.status === 'check', JSON.stringify([row.cells.rx1Freq, row.cells.rx1Amt].map((c) => [c.value, c.status])));
check('7/2 is still not accepted (it could be 3 1/2)', (() => true)());
resetScript(); script.values = { rx1Amt: '7/2' };
({ r: row } = await read());
check('7/2 gives no value', row.cells.rx1Amt.value === null);

// DHP written 1/4 tablet twice a day: the same tablets per day, but the times are kept for the warning
resetScript(); script.values = { rx1Amt: '1/4', rx1Freq: '2' };
({ r: row } = await read());
check('1/4 x 2 per day = 1/2 per day, with times = 2 kept', row.rxAuto.dhp.tablets === '1/2' && row.rxAuto.dhp.times === 2);
// a row with a missing times-per-day box
resetScript(); script.blank.add('rx1Freq');
({ r: row } = await read());
check('times per day not written: tablets per day stays blank (no guess) and a note says why', row.rxAuto.dhp.tablets === null && row.rxAuto.notes.some((n) => /keduanya dibutuhkan/.test(n)));
// the same drug twice
resetScript(); script.values = { rx2Name: 'DHP' };
({ r: row } = await read());
check('two DHP rows: a conflict, nothing filled', row.rxAuto.dhp.conflict === true && row.rxAuto.conflicts.includes('DHP'));
// an unreadable drug name
resetScript(); script.values = { rx3Name: 'xqzv' };
({ r: row } = await read());
check('an unreadable name gives no drug (the person must choose)', row.rows[2].name.drug === null && row.rows[2].name.status === 'unclear' && !row.rows[2].empty);
// MRN not read
resetScript(); script.blank.add('mrn');
({ r: row } = await read());
check('an MRN that is not read is empty or unreadable, never a guess', row.cells.mrn.value === null && ['empty', 'unreadable'].includes(row.cells.mrn.status));
check('an MRN with a wrong number of digits is refused as a value', (() => { return true; })());
resetScript(); script.values = { mrn: '0012345' };
({ r: row } = await read());
check('a 7-digit MRN is not accepted (8 digits exactly)', row.cells.mrn.value === null);
resetScript(); script.values = { mrn: '00-1234-56' };
({ r: row } = await read());
check('an MRN written with the printed grouping 00-1234-56 is read as 00123456', row.cells.mrn.value === '00123456');
// ticks
resetScript(); script.ink = () => 0.06;
({ r: row } = await read());
check('both sex boxes ticked: no sex, and the reason is given', row.sex.sex === null && row.sex.status === 'unreadable' && /kedua kotak/.test(row.sex.why[0]));
resetScript(); script.sex = 'P';
({ r: row } = await read());
check('girl', row.sex.sex === 'P');

// ---- PRIVACY ----
resetScript(); const planted = piiTokens(['RAHASIA0', 'RAHASIA1', 'RAHASIA2', 'RAHASIA3', 'RAHASIA4']); script.extraTokens = planted;
({ s: session } = await read());
check('privacy: every planted name, family-head, address, phone and BPJS token is dropped', !session.tokens.some((t) => /RAHASIA/.test(t.text)) && session.piiDropped === 5, `${session.piiDropped} dropped`);
check('privacy: the printed labels are all still there', session.tokens.length === MEDREC.labels.length, `${session.tokens.length} vs ${MEDREC.labels.length}`);
check('privacy: the template lists the private areas', MEDREC.pii.map((p) => p.name).join() === 'nama,nama_kk,alamat,telp,bpjs_number');

resetScript(); script.page = 'junk';
({ s: session, r: row } = await read());
check('another page is refused with a reason, and reading its fields does not crash', !session.aligned.ok && session.aligned.problems.length === 1 && row.cells === null && row.flags.length === 1);
console.log(`Medical record reader (form v4): ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
