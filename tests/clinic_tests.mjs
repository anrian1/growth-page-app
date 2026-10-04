// Tests the clinic sheet aligner on REAL OCR output of 18 synthetic photos (three difficulty levels), against the true box positions.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignClinicPage, readRect, CLINIC_FIELDS } from '../src/clinic.js';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/clinic_ocr_fixtures.json'), 'utf8'));
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };

const errs = { easy: [], mid: [], hard: [] }; const anchors = []; let aligned = 0; let insideCount = 0; let insideTotal = 0;
for (const s of sheets) {
  const r = alignClinicPage(s.tokens);
  check(`${s.name}: aligned`, r.ok, JSON.stringify(r.problems));
  if (!r.ok) continue;
  aligned += 1; anchors.push(r.anchors);
  for (const key of CLINIC_FIELDS) {
    const est = r.rects[key].poly; const tru = s.fields[key].poly1600;
    const cen = (p) => [p.reduce((a, q) => a + q[0], 0) / 4, p.reduce((a, q) => a + q[1], 0) / 4];
    const [ex, ey] = cen(est); const [tx, ty] = cen(tru);
    const boxW = Math.hypot(tru[1][0] - tru[0][0], tru[1][1] - tru[0][1]);
    errs[s.info.cond].push(Math.hypot(ex - tx, ey - ty) / boxW);
    // is the middle of the true box inside the shrunk read rectangle?  (that is what the crop is cut from)
    const rr = readRect(est); insideTotal += 1;
    if (tx > rr.x && tx < rr.x + rr.w && ty > rr.y && ty < rr.y + rr.h) insideCount += 1;
  }
}
const stat = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / a.length, max: Math.max(...a) });
for (const c of ['easy', 'mid', 'hard']) { const s = stat(errs[c]); console.log(`  ${c.padEnd(4)}: centre error mean ${(s.mean * 100).toFixed(1)}% of box width, worst ${(s.max * 100).toFixed(1)}%  (${errs[c].length} boxes)`); }
console.log(`  anchors used per sheet: min ${Math.min(...anchors)}, max ${Math.max(...anchors)}`);
console.log(`  true box centre inside the read rectangle: ${insideCount} of ${insideTotal}`);
check('all 18 sheets aligned', aligned === sheets.length);
check('mean centre error under 10% of a box width on every difficulty level', ['easy', 'mid', 'hard'].every((c) => stat(errs[c]).mean < 0.10));
check('worst centre error under 30% of a box width (the crop still lands on the right box)', ['easy', 'mid', 'hard'].every((c) => stat(errs[c]).max < 0.30));
check('the true centre is inside the read rectangle for every box', insideCount === insideTotal, `${insideCount}/${insideTotal}`);

// a photo of something else, and a photo with half the page missing
const other = alignClinicPage([{ text: 'Hello world', x: 10, y: 10, w: 100, h: 20 }, { text: 'Tabel Pertumbuhan', x: 10, y: 50, w: 100, h: 20 }]);
check('a photo of another page is refused with a reason', !other.ok && other.problems.length === 1, JSON.stringify(other));
const half = alignClinicPage(sheets[0].tokens.filter((t) => t.y < 500));
check('a photo showing only the top of the page is refused or still lands correctly', !half.ok || half.anchors >= 8);
console.log(`Clinic aligner: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
