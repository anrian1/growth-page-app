// Tests the mapping on the REAL OCR output of the mock page (tests/fixtures/mock_page_tokens.json).
// The answer key below was read by eye from the photo of that page.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTokens, readRow, latestFilledMonth, cellRect, mergeReadings, COLUMNS } from '../src/mapping.js';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/mock_page_tokens.json'), 'utf8'));
const TRUTH = {
  'L-weight': [3.5, 4.9, 5.5, 6.8, 7.2, 7.9],
  'L-length': [51.0, 55.1, 57.5, 62.0, 64.7, 66.8],
  'P-weight': [2.8, 4.5, 5.0, 5.5, 6.0, 7.1, 7.8],
  'P-length': [50.0, 54.5, 56, 58.0, 60.0, 65.0, 66.8],
};
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };

const mapped = mapTokens(fixture.tokens);
check('headers and month numbers found', mapped.ok, JSON.stringify(mapped.problems));
check('four Aktual columns followed down the page', mapped.geometry && mapped.geometry.lines.length === 4);

// 1. NO INVENTED CELLS: every mapped cell must be one where something is really written
const truthKeys = new Set(); Object.entries(TRUTH).forEach(([c, list]) => list.forEach((_, m) => truthKeys.add(`${c}|${m}`)));
const phantom = Object.keys(mapped.cells).filter((k) => !truthKeys.has(k));
check('no cell mapped where nothing is written (printed Ideal numbers ignored)', phantom.length === 0, JSON.stringify(phantom));

// 2. score every handwritten value
let exact = 0; let silentWrong = []; let flagged = []; let missing = [];
for (const [column, list] of Object.entries(TRUTH)) list.forEach((truth, month) => {
  const cell = mapped.cells[`${column}|${month}`];
  const hidden = mapped.unreadable.some((u) => u.column === column && u.months.includes(month));
  if (!cell) { missing.push(`${column} ${month}${hidden ? ' (marked unreadable)' : ''}`); return; }
  if (cell.value !== null && Math.abs(cell.value - truth) < 0.001) { exact += 1; return; }
  if (cell.status === 'ok') silentWrong.push(`${column} month ${month}: read ${cell.value}, truth ${truth}`);
  else flagged.push(`${column} month ${month}: ${cell.status} (${cell.text})`);
});
const total = Object.values(TRUTH).flat().length;
console.log(`Handwritten values: ${total}`);
console.log(`  read exactly right: ${exact}`);
console.log(`  wrong but FLAGGED for a person (safe): ${flagged.length}  ${JSON.stringify(flagged)}`);
console.log(`  not found at all (a person is told): ${missing.length}  ${JSON.stringify(missing)}`);
console.log(`  wrong and NOT flagged (silent errors): ${silentWrong.length}  ${JSON.stringify(silentWrong)}`);
check('baseline: at least 18 of 26 read exactly', exact >= 18, `got ${exact}`);
check('baseline: no more than 2 silent errors', silentWrong.length <= 2, `got ${silentWrong.length}`);

// 3. the row a person actually needs: one sex block, one month
const girl0 = readRow(mapped, { month: 0, sex: 'P' });
check('girl month 0 weight 2.8', girl0.weight.value === 2.8);
check('girl month 0 length is flagged (space inside "50 .9")', girl0.length.status === 'check' && girl0.flags.some((f) => /space/.test(f)), JSON.stringify(girl0.flags));
const boy4 = readRow(mapped, { month: 4, sex: 'L' });
check('boy month 4 reads 7.2 and 64.7 cleanly', boy4.weight.value === 7.2 && boy4.length.value === 64.7 && boy4.weight.status === 'ok');
check('boy month 4: other sex block also has handwriting, so it is flagged', boy4.flags.some((f) => /other sex block/.test(f)), JSON.stringify(boy4.flags));
const boy2 = readRow(mapped, { month: 2, sex: 'L' });
check('boy month 2 weight: unreadable ink is reported, never guessed', boy2.weight.value === null && boy2.weight.status === 'unreadable', JSON.stringify(boy2.weight));
check('boy month 2 length 57.5', boy2.length.value === 57.5);
const boy6 = readRow(mapped, { month: 6, sex: 'L' });
check('boy month 6: truly empty, reported as missing', boy6.weight.status === 'missing' && boy6.length.status === 'missing');
const girl6 = readRow(mapped, { month: 6, sex: 'P' });
check('girl month 6 weight "708" is rejected, not accepted', girl6.weight.value === null && girl6.weight.status === 'unreadable', JSON.stringify(girl6.weight));
check('girl month 6 length 66.8', girl6.length.value === 66.8);
const girl3 = readRow(mapped, { month: 3, sex: 'P' });
check('girl month 3 length "58 g" (=589) is rejected', girl3.length.value === null);
const girl5 = readRow(mapped, { month: 5, sex: 'P' });
check('girl month 5 length "65=phi" is read as 65.0 but marked for checking', girl5.length.value === 65 && girl5.length.status === 'check');

// 4. helpers
check('latest filled month, girls', latestFilledMonth(mapped, 'P') === 6);
check('latest filled month, boys', latestFilledMonth(mapped, 'L') === 5);
const r = cellRect(mapped.geometry, 'L-weight', 4);
const tok = mapped.cells['L-weight|4'].token;
check('cell rectangle sits on the handwriting', tok.x + tok.w / 2 > r.x && tok.x + tok.w / 2 < r.x + r.w && tok.y + tok.h / 2 > r.y && tok.y + tok.h / 2 < r.y + r.h, JSON.stringify(r));

// 5. refuses a photo without the table
const bad = mapTokens(fixture.tokens.filter((t) => !/^Aktual$/.test(t.text)));
check('photo without headers is refused with a reason', !bad.ok && bad.problems.length > 0);
const noRows = mapTokens(fixture.tokens.filter((t) => !(t.x < 200 && /^\d+$/.test(t.text) && t.y > 240)));
check('photo without month numbers is refused with a reason', !noRows.ok && noRows.problems.length > 0, JSON.stringify(noRows.problems));

// 6. shifted/tilted photo: move everything and rotate slightly; the same cells must be found
const angle = 0.03; const shifted = fixture.tokens.map((t) => ({ ...t, x: Math.round(t.x * Math.cos(angle) - t.y * Math.sin(angle) + 40), y: Math.round(t.x * Math.sin(angle) + t.y * Math.cos(angle) + 25) }));
const tilted = mapTokens(shifted);
const sameKeys = tilted.ok && JSON.stringify(Object.keys(tilted.cells).sort()) === JSON.stringify(Object.keys(mapped.cells).sort());
check('same cells found after a 1.7 degree tilt and a shift', sameKeys, tilted.ok ? `${Object.keys(tilted.cells).length} vs ${Object.keys(mapped.cells).length}` : JSON.stringify(tilted.problems));
const sameValues = tilted.ok && Object.entries(mapped.cells).every(([k, c]) => tilted.cells[k] && tilted.cells[k].value === c.value);
check('same values after the tilt', sameValues);
for (const deg of [-5, -3, 3, 5]) {
  const a = (deg * Math.PI) / 180;
  const m2 = mapTokens(fixture.tokens.map((q) => ({ ...q, x: Math.round(q.x * Math.cos(a) - q.y * Math.sin(a) + 300), y: Math.round(q.x * Math.sin(a) + q.y * Math.cos(a) + 300) })));
  const okTilt = m2.ok && JSON.stringify(Object.keys(m2.cells).sort()) === JSON.stringify(Object.keys(mapped.cells).sort());
  check(`same cells found at ${deg} degrees`, okTilt, m2.ok ? `${Object.keys(m2.cells).length} vs ${Object.keys(mapped.cells).length}` : JSON.stringify(m2.problems));
  if (m2.ok && m2.cells['L-weight|4']) {
    const rr = cellRect(m2.geometry, 'L-weight', 4); const tk = m2.cells['L-weight|4'].token;
    check(`cell rectangle sits on the handwriting at ${deg} degrees`, tk.x + tk.w / 2 > rr.x && tk.x + tk.w / 2 < rr.x + rr.w && tk.y + tk.h / 2 > rr.y && tk.y + tk.h / 2 < rr.y + rr.h, JSON.stringify(rr));
  }
}
// keystone: a photo taken at an angle makes columns lean outwards towards the bottom (as seen on the real phone photo)
for (const k of [0.06, 0.10, -0.08]) {
  const key = mapTokens(fixture.tokens.map((q) => ({ ...q, x: Math.round(q.x + k * (q.y - 250) * ((q.x - 550) / 450)) })));
  const same = key.ok && JSON.stringify(Object.keys(key.cells).sort()) === JSON.stringify(Object.keys(mapped.cells).sort());
  check(`same cells found with keystone distortion ${k}`, same, key.ok ? `${Object.keys(key.cells).length} vs ${Object.keys(mapped.cells).length}` : JSON.stringify(key.problems));
  const sameVals = key.ok && Object.entries(mapped.cells).every(([kk, c]) => key.cells[kk] && key.cells[kk].value === c.value);
  check(`same values with keystone distortion ${k}`, sameVals);
}
const sideways = mapTokens(fixture.tokens.map((q) => ({ ...q, x: Math.round(q.x * Math.cos(0.5) - q.y * Math.sin(0.5) + 400), y: Math.round(q.x * Math.sin(0.5) + q.y * Math.cos(0.5) + 400) })));
check('a page tilted 29 degrees is refused with a reason', !sideways.ok && sideways.problems.length > 0, JSON.stringify(sideways.problems));

// 7. two readings of the same page (the PC run and the phone run) must not let a disagreement through
const phone = mapTokens(JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/mock_page_tokens_phone.json'), 'utf8')).tokens);
check('phone reading mapped', phone.ok);
const merged = mergeReadings([mapped, phone]);
const mergedCell = (k) => merged.cells[k];
check('merge: 4.9 vs 9.9 disagree -> no value, check', mergedCell('L-weight|1').value === null && mergedCell('L-weight|1').status === 'check');
check('merge: 57.5 vs 59.5 disagree -> no value, check', mergedCell('L-length|2').value === null && mergedCell('L-length|2').status === 'check');
check('merge: agreeing clean cell stays ok (boys month 4 weight 7.2)', mergedCell('L-weight|4').value === 7.2 && mergedCell('L-weight|4').status === 'ok');
let mergedSilent = []; let mergedExact = 0;
for (const [column, list] of Object.entries(TRUTH)) list.forEach((truth, month) => {
  const c = merged.cells[`${column}|${month}`];
  if (!c || c.value === null) return;
  if (Math.abs(c.value - truth) < 0.001) mergedExact += 1; else if (c.status === 'ok') mergedSilent.push(`${column} ${month}: ${c.value} vs ${truth}`);
});
console.log(`After merging the two readings: ${mergedExact} exact, silent errors: ${mergedSilent.length} ${JSON.stringify(mergedSilent)}`);
check('merge: silent errors drop to at most 1 (the 5.0 read as 5.6 twice cannot be caught by comparing)', mergedSilent.length <= 1, JSON.stringify(mergedSilent));
check('merge of one reading returns it unchanged', mergeReadings([mapped]) === mapped);

console.log(`\nMapping tests: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
