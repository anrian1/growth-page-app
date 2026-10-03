// Tests the session logic on the REAL page layout (the PC fixture) with a fake camera and a fake OCR engine.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPage, readRow } from '../src/session.js';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/mock_page_tokens.json'), 'utf8'));
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };

// Fake OCR: the first call (whole page) returns the real fixture; cell crops return what a test script says.
function makeEngine(cropScript) {
  const calls = [];
  return {
    calls,
    async recognize(picture) {
      calls.push(picture);
      if (picture.kind === 'page') return { lines: [fixture.tokens.map((t) => ({ text: t.text, confidence: t.conf, box: { x: t.x, y: t.y, width: t.w, height: t.h } }))] };
      const said = cropScript(picture.rect, picture.height);
      return { lines: said === null ? [] : [[{ text: said, box: { x: 0, y: 0, width: 10, height: 10 } }]] };
    },
  };
}
const photo = {
  async load() { return { width: 960, height: 1280 }; },        // the real mock-page photo size
  scaled(img) { return { kind: 'page', width: img.width, height: img.height }; },
  crop(img, rect, height) { return { kind: 'crop', rect, height }; },
  ink(picture) { return picture.inkHint ?? 0.05; },
};
// which cell is a rectangle on? (the real fixture geometry tells us)
const session0 = await readPage({ file: {}, engine: makeEngine(() => null), photo });
check('whole page mapped', session0.mapped.ok, JSON.stringify(session0.mapped.problems));
check('page factor is 1 when the picture is not shrunk', session0.factor === 1);

const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const near = (rect, cell) => { const c = centreOf(rect); const t = cell.token; return Math.abs(c.x - (t.x + t.w / 2)) < 45 && Math.abs(c.y - (t.y + t.h / 2)) < 20; };
const cellsAt = (month) => Object.values(session0.mapped.cells).filter((c) => c.month === month);

// Boy, month 4: weight 7.2, length 64.7 written on the page. Crops agree.
let engine = makeEngine((rect) => (cellsAt(4).find((c) => c.column === 'L-weight' && near(rect, c)) ? '7.2' : cellsAt(4).find((c) => c.column === 'L-length' && near(rect, c)) ? '64.7' : null));
let session = await readPage({ file: {}, engine, photo });
let row = await readRow(session, { sex: 'L', month: 4, engine, photo });
check('boy month 4 weight is 7.2 and ok', row.cells.weight.value === 7.2 && row.cells.weight.status === 'ok', JSON.stringify(row.cells.weight));
check('boy month 4 length is 64.7 and ok', row.cells.length.value === 64.7 && row.cells.length.status === 'ok', JSON.stringify(row.cells.length));
check('only the two cells of the row were cropped (3 sizes each) plus the page', engine.calls.length === 1 + 6, String(engine.calls.length));
check('other sex block has writing at month 4, so the row is flagged', row.flags.some((f) => /blok jenis kelamin lain/.test(f)), JSON.stringify(row.flags));

// Girl, month 2: the whole-page reading said 5.6 (wrong).
// (a) the crops split 2 vs 2 with the page: no value is offered, both candidates are listed for a person to choose
engine = makeEngine((rect, h) => (cellsAt(2).find((c) => c.column === 'P-weight' && near(rect, c)) ? (h === 128 ? '5.6' : '5.0') : cellsAt(2).find((c) => c.column === 'P-length' && near(rect, c)) ? '56' : null));
session = await readPage({ file: {}, engine, photo });
row = await readRow(session, { sex: 'P', month: 2, engine, photo });
check('tie (5.6 twice, 5.0 twice): no value offered', row.cells.weight.value === null && row.cells.weight.status === 'unreadable', JSON.stringify(row.cells.weight));
check('both candidates are offered so a person can choose', row.cells.weight.candidates.includes(5) && row.cells.weight.candidates.includes(5.6));
// (b) all three crops say 5.0 against the page's 5.6: 3 of 4 agree, the page's mistake is outvoted
engine = makeEngine((rect) => (cellsAt(2).find((c) => c.column === 'P-weight' && near(rect, c)) ? '5.0' : cellsAt(2).find((c) => c.column === 'P-length' && near(rect, c)) ? '56' : null));
session = await readPage({ file: {}, engine, photo });
row = await readRow(session, { sex: 'P', month: 2, engine, photo });
check('3 crops say 5.0, the page said 5.6: 5.0 wins and is ok', row.cells.weight.value === 5.0 && row.cells.weight.status === 'ok', JSON.stringify(row.cells.weight));
// (c) the page reading says 5.6 and the crops all say 5.6 too: a mistake every pass makes cannot be caught here (documented limit)
engine = makeEngine((rect) => (cellsAt(2).find((c) => c.column === 'P-weight' && near(rect, c)) ? '5.6' : cellsAt(2).find((c) => c.column === 'P-length' && near(rect, c)) ? '56' : null));
session = await readPage({ file: {}, engine, photo });
row = await readRow(session, { sex: 'P', month: 2, engine, photo });
check('KNOWN LIMIT: a mistake that every reading makes is accepted as 5.6 (the crop picture beside it is what lets a person catch it)', row.cells.weight.value === 5.6 && row.cells.weight.status === 'ok');

// Boy, month 6: nothing is written. All crops empty, no ink.
photo.ink = () => 0.001;
engine = makeEngine(() => null);
session = await readPage({ file: {}, engine, photo });
row = await readRow(session, { sex: 'L', month: 6, engine, photo });
check('boy month 6 is empty in both cells', row.cells.weight.status === 'empty' && row.cells.length.status === 'empty');
check('a hint points to the last month that has writing (boys: 5)', row.hint && row.hint.latestMonth === 5, JSON.stringify(row.hint));

// A photo that is not the table: the engine returns unrelated text
const junk = { async recognize() { return { lines: [[{ text: 'hello', box: { x: 1, y: 1, width: 10, height: 10 } }]] }; } };
photo.ink = () => 0.05;
const bad = await readPage({ file: {}, engine: junk, photo });
check('a photo of something else is refused with a reason', !bad.mapped.ok && bad.mapped.problems.length > 0);
const refused = await readRow(bad, { sex: 'L', month: 4, engine: junk, photo });
check('reading a row of a refused page returns the reason, not a crash', refused.cells === null && refused.flags.length > 0);

console.log(`Session: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
