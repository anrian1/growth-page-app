// The medical-record reader on REAL OCR output of 21 SYNTHETIC photos (handwriting-style fonts on a tablet screen, three difficulty levels).
// These thresholds are regression baselines for the logic. They are not claims about real clinics.
import { summary } from './record_eval.mjs';
import { readRecordPage, readRecordFields, RECORD_FIELDS } from '../src/session.js';
import { engine, photo, script, sheets } from './fakes.mjs';

let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const stat = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / (a.length || 1), max: Math.max(0, ...a) });

check('all 21 synthetic photos align to the template', summary.aligned === summary.sheets, `${summary.aligned}/${summary.sheets}`);
check('at least 25 of the 30 printed labels are used on every sheet', summary.anchorsMin >= 25, String(summary.anchorsMin));
for (const l of ['easy', 'mid', 'hard']) check(`${l}: box centres within 5% of a box width on average, 10% at worst`, stat(summary.centre[l]).mean < 0.05 && stat(summary.centre[l]).max < 0.10, JSON.stringify(stat(summary.centre[l])));
check('the true centre of every box is inside the rectangle that is cut out', summary.inside[0] === summary.inside[1], `${summary.inside}`);
const v = summary.voted.all;
check('voted: at least 95% of boxes give the right value (ok or flagged "check")', v.right_ok + v.right_check >= Math.floor(0.95 * v.n), `${v.right_ok + v.right_check}/${v.n}`);
check('voted: at most 1 wrong value that was not flagged (silent error)', v.silent_wrong <= 1, JSON.stringify(summary.silent));
check('voting never has more silent errors than naive page reading plus one', v.silent_wrong <= summary.page.all.silent_wrong + 1);
check('voted: the right value is offered more often than with the page reading alone', v.right_ok + v.right_check > summary.page.all.right_ok);
check('sex tick boxes: all 21 right, none silently wrong', summary.sex.right === 21 && summary.sex.wrongSilent === 0, JSON.stringify(summary.sex));

// ---- the session on one sheet, with the fake camera and engine ----
script.sheet = 'C03'; script.say = null; script.ink = null; script.page = 'record';
let session = await readRecordPage({ file: {}, engine, photo });
check('session: page aligned', session.aligned.ok && session.aligned.anchors >= 25, JSON.stringify(session.aligned.problems));
let row = await readRecordFields(session, { engine, photo });
check('session: all 13 boxes were read', row.cells && RECORD_FIELDS.every((k) => row.cells[k]));
const truth = Object.fromEntries(sheets.find((s) => s.name === 'C03') && Object.entries(sheets.find((s) => s.name === 'C03').fields).map(([k, f]) => [k, Number(f.truth)]));
check('session: C03 (boy, 7 months) reads weight 8.3 and height 69.5', row.cells.weight.value === truth.weight && row.cells.height.value === truth.height, JSON.stringify([row.cells.weight.value, row.cells.height.value]));
check('session: sex from the tick boxes is a boy, ok', row.sex.sex === 'L' && row.sex.status === 'ok', JSON.stringify(row.sex));
check('session: three free-text pictures and four strips are returned', Object.keys(row.pictures).join() === 'keluhan,asessmen,planning' && ['dob', 'tgl', 'sex', 'td'].every((k) => row.strips[k] && row.strips[k].w > 0));
check('session: rectangles are in source pixels (the photo is 1.5x the page reading)', row.rects.weight.w > 60);

// a hand that ticks both boxes, and one that ticks neither
script.ink = () => 0.06; row = await readRecordFields(session, { engine, photo });
check('session: both sex boxes ticked gives no sex and says why', row.sex.sex === null && row.sex.status === 'unreadable' && /kedua kotak/.test(row.sex.why[0]));
script.ink = () => 0.0; row = await readRecordFields(session, { engine, photo });
check('session: no sex box ticked gives no sex', row.sex.sex === null && /tidak ada kotak/.test(row.sex.why[0]));
script.ink = null;

// a photo that is not the form
script.page = 'junk';
session = await readRecordPage({ file: {}, engine, photo });
check('another page is refused with a reason', !session.aligned.ok && session.aligned.problems.length === 1);
row = await readRecordFields(session, { engine, photo });
check('reading the fields of a refused page returns the reason, not a crash', row.cells === null && row.flags.length === 1);
script.page = 'record';

// half the page
const half = sheets.find((s) => s.name === 'C03');
const originalTokens = half.tokens; half.tokens = originalTokens.filter((t) => t.y < 700);
session = await readRecordPage({ file: {}, engine, photo });
check('only the top of the form in the photo: refused, or still placed with enough labels', !session.aligned.ok || session.aligned.anchors >= 8);
half.tokens = originalTokens;
console.log(`Medical record reader: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
