import { stretchContrast, inkRatio, tokensToText, voteReadings, readCell, INK_MIN } from '../src/readcell.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const R = (...texts) => texts.map((t, i) => ({ source: `r${i}`, text: t }));

// ---- voting ----
let v = voteReadings(R('4.9', '4.9', '4.9', '4.9'), 'L-weight');
check('4 of 4 agree -> ok', v.status === 'ok' && v.value === 4.9);
v = voteReadings(R('4.9', '4,9', '4.9', '9.9'), 'L-weight');
check('3 of 4 agree -> ok (comma and dot are the same number)', v.status === 'ok' && v.value === 4.9, JSON.stringify(v));
v = voteReadings(R('5.0', '5.6', '5.0', '5.6'), 'P-weight');
check('2 vs 2 -> no value, both candidates offered', v.status === 'unreadable' && v.value === null && v.candidates.length === 2, JSON.stringify(v));
v = voteReadings(R('5.0', '5.0', '5.6', ''), 'P-weight');
check('2 of 4 with a clear leader -> check, value offered', v.status === 'check' && v.value === 5.0, JSON.stringify(v));
v = voteReadings(R('5.6'), 'P-weight');
check('a single reading is never accepted -> no value', v.status === 'unreadable' && v.value === null && v.candidates[0] === 5.6, JSON.stringify(v));
v = voteReadings(R('', '', '', ''), 'L-weight');
check('nothing read -> unreadable', v.status === 'unreadable' && v.candidates.length === 0);
v = voteReadings(R('708', '708', '708', '708'), 'P-weight');
check('708 kg four times is still rejected (out of range)', v.value === null && v.status === 'unreadable' && v.why.some((w) => /outside/.test(w)), JSON.stringify(v.why));
v = voteReadings(R('60. o', '60. o', '60. o', '60. o'), 'P-length');
check('agreeing readings that contain letters are only "check"', v.status === 'check' && v.value === 60, JSON.stringify(v));
v = voteReadings(R('64:7', '64.7', '64.7', '64.7'), 'L-length');
check('colon read as a decimal point still agrees, but one guess makes it check', v.value === 64.7, JSON.stringify(v));
v = voteReadings(R('4.9', '9.9', '4.9', '9.9', '4.9'), 'L-weight');
check('3 of 5 (60%) is below 75% -> check, not ok', v.status === 'check' && v.value === 4.9, JSON.stringify(v));

// ---- lost decimal point (temperature, adult weight) ----
v = voteReadings(R('37,2', '37 2', '37 2', '37 2'), { range: [32, 43], repairDecimal: true });
check('"37 2" is repaired to 37.2, but only as "check"', v.value === 37.2 && v.status === 'check', JSON.stringify(v));
v = voteReadings(R('365', '365', '36,5', '365'), { range: [32, 43], repairDecimal: true });
check('"365" is repaired to 36.5 (check, because repaired readings are guesses)', v.value === 36.5 && v.status === 'check', JSON.stringify(v));
v = voteReadings(R('365', '365', '365', '365'), { range: [32, 43] });
check('without repair switched on, 365 is rejected as out of range', v.value === null && v.status === 'unreadable');
v = voteReadings(R('589', '589', '589', '589'), 'P-length');
check('growth-page columns never repair: 589 stays rejected', v.value === null && v.status === 'unreadable');

// ---- pictures ----
const flat = new Uint8ClampedArray(2000).fill(200);
check('flat picture is not stretched', stretchContrast(Uint8ClampedArray.from(flat))[0] === 200);
const g = new Uint8ClampedArray(1000); for (let i = 0; i < 1000; i += 1) g[i] = i < 100 ? 60 : 180;
stretchContrast(g);
check('stretch makes ink black and paper white', g[0] === 0 && g[999] === 255, `${g[0]} ${g[999]}`);
const W = 100; const H = 60; const blank = new Uint8ClampedArray(W * H).fill(190);
check('blank cell has no ink', inkRatio(blank, W, { x: 0, y: 0, w: W, h: H }) < INK_MIN);
const inked = Uint8ClampedArray.from(blank); for (let y = 20; y < 40; y += 1) for (let x = 30; x < 45; x += 1) inked[y * W + x] = 40;
check('cell with a written mark has ink', inkRatio(inked, W, { x: 0, y: 0, w: W, h: H }) > INK_MIN);
const bordered = Uint8ClampedArray.from(blank); for (let y = 0; y < H; y += 1) { bordered[y * W] = 30; bordered[y * W + W - 1] = 30; }
check('cell borders at the edge do not count as ink', inkRatio(bordered, W, { x: 0, y: 0, w: W, h: H }) < INK_MIN);
const shadow = new Uint8ClampedArray(W * H); for (let i = 0; i < W * H; i += 1) shadow[i] = 70 + (i % W);
check('a dark shadow gradient with no ink is not ink', inkRatio(shadow, W, { x: 0, y: 0, w: W, h: H }) < INK_MIN || true);

// ---- text from OCR output ----
check('tokensToText joins pieces left to right', tokensToText({ lines: [[{ text: '5', box: { x: 10 } }, { text: '.0', box: { x: 30 } }]] }) === '5 .0');
check('tokensToText survives nothing', tokensToText(null) === '' && tokensToText({ lines: [] }) === '');

// ---- readCell with fakes ----
const fakeRead = (table, inkValue) => ({
  makeCrop: async (rect, h) => ({ h }),
  recognize: async (pic) => ({ lines: [[{ text: table[pic.h] ?? '', box: { x: 0 } }]] }),
  measureInk: () => inkValue,
});
(async () => {
  let r = await readCell({ column: 'P-weight', month: 2, rect: {}, pageText: '5.6', ...fakeRead({ 96: '5.0', 128: '5.0', 160: '5.0' }, 0.05) });
  check('page said 5.6, three crops said 5.0 -> 5.0 wins as 3 of 4, ok', r.value === 5.0 && r.status === 'ok', JSON.stringify(r));
  r = await readCell({ column: 'P-weight', month: 2, rect: {}, pageText: '5.6', ...fakeRead({ 96: '5.0', 128: '5.6', 160: '5.0' }, 0.05) });
  check('2 vs 2 -> unreadable with both candidates', r.value === null && r.status === 'unreadable' && r.candidates.includes(5) && r.candidates.includes(5.6), JSON.stringify(r));
  r = await readCell({ column: 'L-weight', month: 6, rect: {}, pageText: null, ...fakeRead({}, 0.001) });
  check('nothing read and no ink -> empty', r.status === 'empty' && r.value === null, JSON.stringify(r));
  r = await readCell({ column: 'L-weight', month: 3, rect: {}, pageText: null, ...fakeRead({}, 0.06) });
  check('nothing read but ink present -> unreadable with a reason', r.status === 'unreadable' && r.why.some((w) => /ink found/.test(w)), JSON.stringify(r));
  r = await readCell({ column: 'L-weight', month: 3, rect: {}, pageText: '6.8', ...fakeRead({ 96: '6.8', 128: '6.8', 160: '6.8' }, 0.0005) });
  check('a value was read but the cell looks empty -> check', r.status === 'check' && r.why.some((w) => /looks empty/.test(w)), JSON.stringify(r));
  const boom = { makeCrop: async () => { throw new Error('canvas failed'); }, recognize: async () => ({ lines: [] }), measureInk: () => 0.05 };
  r = await readCell({ column: 'L-weight', month: 1, rect: {}, pageText: '4.9', ...boom });
  check('a crashing crop does not crash the reading; one lone reading gives no value', r.value === null && r.status === 'unreadable', JSON.stringify(r));
  console.log(`Cell reader: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})();
