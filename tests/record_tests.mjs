// The medical-record reader on REAL OCR output of 21 SYNTHETIC photos of form v3 (handwriting-style fonts on a tablet screen, three difficulty levels).
// These thresholds are regression baselines for the logic. They are not claims about real clinics.
import { summary } from './record_eval.mjs';
import { result as rx } from './rx_eval.mjs';
import { readRecordPage, readRecordFields, RECORD_FIELDS } from '../src/session.js';
import { alignByTemplate, placeBox } from '../src/clinic.js';
import MEDREC from '../src/templates/medical-record.js';
import { engine, photo, script, sheets } from './fakes.mjs';

let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const stat = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / (a.length || 1), max: Math.max(0, ...a) });
const g = summary.groups;

check('all 21 synthetic photos align to the template', summary.aligned === summary.sheets, `${summary.aligned}/${summary.sheets}`);
check('at least 25 of the 30 printed labels are used on every sheet', summary.anchorsMin >= 25, String(summary.anchorsMin));
for (const l of ['easy', 'mid', 'hard']) check(`${l}: box centres within 5% of a box width on average, 10% at worst`, stat(summary.centre[l]).mean < 0.05 && stat(summary.centre[l]).max < 0.10, JSON.stringify(stat(summary.centre[l])));
check('the true centre of every box is inside the rectangle that is cut out', summary.inside[0] === summary.inside[1], `${summary.inside}`);
check('the template has the 18 numeric boxes (7 vitals, 6 date parts, MRN, 4 prescription amounts)', RECORD_FIELDS.length === 18 && ['mrn', 'rxDhpTabs', 'rxDhpDays', 'rxPqTabs', 'rxPqDays'].every((k) => RECORD_FIELDS.includes(k)));
check('vitals: at least 90% right and shown as reliable', g.vitals.right_ok >= Math.floor(0.9 * g.vitals.n), JSON.stringify(g.vitals));
check('dates: at least 80% right and shown as reliable', g.dates.right_ok >= Math.floor(0.8 * g.dates.n), JSON.stringify(g.dates));
check('prescription amounts: at least 75% right and shown as reliable', g.rx.right_ok >= Math.floor(0.75 * g.rx.n), JSON.stringify(g.rx));
check('at most 4 wrong values that were not flagged in all 378 boxes (silent errors)', summary.voted.all.silent_wrong <= 4, JSON.stringify(summary.silent));
check('voting never makes things worse than the page reading alone', summary.voted.all.silent_wrong <= summary.page.all.silent_wrong && summary.voted.all.right_ok > summary.page.all.right_ok);
check('MRN: a wrong number is NEVER offered as reliable (it is typed by a person when not read)', g.mrn.silent_wrong === 0, JSON.stringify(g.mrn));
check('sex tick boxes: all 21 right, none silently wrong', summary.sex.right === 21 && summary.sex.wrongSilent === 0, JSON.stringify(summary.sex));
check('dose check on the pre-filled values: never says "matches" when the written values would not (false reassurance)', rx.falseReassurance.length === 0, JSON.stringify(rx.falseReassurance));
check('dose check on the pre-filled values: no false alarms', rx.falseAlarm === 0);
check('dose check gives the same result as with perfect reading on at least 55% of pages', rx.sameResult >= Math.floor(0.55 * rx.pages), `${rx.sameResult}/${rx.pages}`);
check('malaria type read from the text: never a wrong type', rx.fields.species.wrong === 0, JSON.stringify(rx.fields.species));

// ---- the session on one sheet, with the fake camera and engine ----
script.sheet = 'C03'; script.say = null; script.ink = null; script.page = 'record';
let session = await readRecordPage({ file: {}, engine, photo });
check('session: page aligned', session.aligned.ok && session.aligned.anchors >= 25, JSON.stringify(session.aligned.problems));
let row = await readRecordFields(session, { engine, photo });
check('session: all 18 boxes were read', row.cells && RECORD_FIELDS.every((k) => row.cells[k]));
const f = (k) => sheets.find((s) => s.name === 'C03').fields[k].truth;
check('session: C03 (boy, 7 months) reads weight 8.3 and height 69.5', row.cells.weight.value === Number(f('weight')) && row.cells.height.value === Number(f('height')), JSON.stringify([row.cells.weight.value, row.cells.height.value]));
check('session: sex from the tick boxes is a boy, ok', row.sex.sex === 'L' && row.sex.status === 'ok', JSON.stringify(row.sex));
check('session: the prescription block is returned (type from the text, amounts from boxes)', row.rx && row.rx.fields.species && row.rx.readings === 6 && row.cells.rxDhpTabs.status !== undefined);
check('session: three free-text pictures and three strips are returned', Object.keys(row.pictures).join() === 'keluhan,asessmen,planning' && ['dob', 'tgl', 'sex', 'td'].every((k) => row.strips[k] && row.strips[k].w > 0));
check('session: rectangles are in source pixels (the photo is 1.5x the page reading)', row.rects.weight.w > 60 && row.rects.mrn.w > 200);

script.ink = () => 0.06; row = await readRecordFields(session, { engine, photo });
check('session: both sex boxes ticked gives no sex and says why', row.sex.sex === null && row.sex.status === 'unreadable' && /kedua kotak/.test(row.sex.why[0]));
script.ink = () => 0.0; row = await readRecordFields(session, { engine, photo });
check('session: no sex box ticked gives no sex', row.sex.sex === null && /tidak ada kotak/.test(row.sex.why[0]));
script.ink = null;

// ---- PRIVACY: text the page reader finds on the name, address, phone and BPJS lines is thrown away right after alignment ----
const sheet = sheets.find((s) => s.name === 'C03'); const original = sheet.tokens;
const al = alignByTemplate(MEDREC, original);
const planted = MEDREC.pii.map((r, i) => { const poly = placeBox(al.H, r); const cx = poly.reduce((a, q) => a + q[0], 0) / 4; const cy = poly.reduce((a, q) => a + q[1], 0) / 4; return { text: `RAHASIA${i}`, x: cx - 30, y: cy - 6, w: 60, h: 12 }; });
sheet.tokens = [...original, ...planted];
session = await readRecordPage({ file: {}, engine, photo });
check('privacy: every planted name, address, phone and BPJS token is dropped', !session.tokens.some((t) => /RAHASIA/.test(t.text)) && session.piiDropped === planted.length, `${session.piiDropped} dropped of ${planted.length}`);
check('privacy: the real tokens are still there (only the private areas were removed)', session.tokens.length >= original.length - 2, `${session.tokens.length} vs ${original.length}`);
check('privacy: the template lists the private areas (name, name KK, address, phone, BPJS number)', MEDREC.pii.map((p) => p.name).join() === 'nama,nama_kk,alamat,telp,bpjs_number');
sheet.tokens = original;

script.page = 'junk';
session = await readRecordPage({ file: {}, engine, photo });
check('another page is refused with a reason', !session.aligned.ok && session.aligned.problems.length === 1);
row = await readRecordFields(session, { engine, photo });
check('reading the fields of a refused page returns the reason, not a crash', row.cells === null && row.flags.length === 1);
script.page = 'record';
sheet.tokens = original.filter((t) => t.y < 700);
session = await readRecordPage({ file: {}, engine, photo });
check('only the top of the form in the photo: refused, or still placed with enough labels', !session.aligned.ok || session.aligned.anchors >= 8);
sheet.tokens = original;
console.log(`Medical record reader: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
