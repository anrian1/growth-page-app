// Evidence run on SYNTHETIC photos of a tablet screen showing handwriting-style fonts on the revised medical record (21 sheets, 3 difficulty levels,
// 3 simulated writers). The OCR outputs in the fixture come from a real OCR engine (RapidOCR in Python), not the browser model.
// Prints: alignment accuracy, reading accuracy (page-only vs voted), sex tick accuracy, and every wrong reading that was NOT flagged.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignByTemplate, placeBox, readRect } from '../src/clinic.js';
import { voteReadings, readSex } from '../src/readcell.js';
import { analyseNumber } from '../src/ocr-helpers.js';
import MEDREC from '../src/templates/medical-record.js';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/record_ocr_fixtures.json'), 'utf8'));
export const summary = { sheets: sheets.length, aligned: 0, anchorsMin: 99, centre: { easy: [], mid: [], hard: [] }, inside: [0, 0], page: {}, voted: {}, sex: { right: 0, wrongSilent: 0, none: 0, check: 0 }, silent: [], byField: {} };
const tally = () => ({ n: 0, right_ok: 0, right_check: 0, no_value: 0, silent_wrong: 0 });
for (const m of ['page', 'voted']) for (const l of ['easy', 'mid', 'hard', 'all']) summary[m][l] = tally();

for (const sheet of sheets) {
  const tokens = sheet.tokens;
  const al = alignByTemplate(MEDREC, tokens);
  if (al.ok) { summary.aligned += 1; summary.anchorsMin = Math.min(summary.anchorsMin, al.anchors); }
  if (al.ok) for (const [key, f] of Object.entries(sheet.fields)) {
    const est = placeBox(al.H, MEDREC.fields[key].box); const tru = f.poly1600;
    const cen = (p) => [p.reduce((a, q) => a + q[0], 0) / 4, p.reduce((a, q) => a + q[1], 0) / 4];
    const [ex, ey] = cen(est); const [tx, ty] = cen(tru);
    const boxW = Math.hypot(tru[1][0] - tru[0][0], tru[1][1] - tru[0][1]);
    summary.centre[sheet.level].push(Math.hypot(ex - tx, ey - ty) / boxW);
    const rr = readRect(est); summary.inside[1] += 1; if (tx > rr.x && tx < rr.x + rr.w && ty > rr.y && ty < rr.y + rr.h) summary.inside[0] += 1;
  }
  for (const [key, f] of Object.entries(sheet.fields)) {
    const spec = MEDREC.fields[key]; const truth = Number(f.truth);
    const readings = [{ source: 'page', text: f.page }, ...Object.entries(f.crops).map(([h, t]) => ({ source: `crop${h}`, text: t }))];
    const opts = { range: spec.range, repairDecimal: spec.decimals === 1, integer: spec.decimals === 0 };
    const a = analyseNumber(f.page);
    const pv = a.value !== null && a.value >= spec.range[0] && a.value <= spec.range[1] && (!opts.integer || Number.isInteger(a.value)) ? a.value : null;
    const vote = voteReadings(readings, opts);
    for (const lvl of [sheet.level, 'all']) {
      const p = summary.page[lvl]; p.n += 1;
      if (pv === null) p.no_value += 1; else if (Math.abs(pv - truth) < 1e-9) p.right_ok += 1; else p.silent_wrong += 1;
      const v = summary.voted[lvl]; v.n += 1;
      if (vote.value === null) v.no_value += 1;
      else if (Math.abs(vote.value - truth) < 1e-9) { if (vote.status === 'ok') v.right_ok += 1; else v.right_check += 1; }
      else if (vote.status === 'ok') { v.silent_wrong += 1; if (lvl === 'all') summary.silent.push(`${sheet.name} ${key}: ${vote.value} vs ${truth}  ${JSON.stringify(readings.map((r) => r.text))}`); }
      else v.right_check += 0;
    }
    const good = vote.value !== null && Math.abs(vote.value - truth) < 1e-9 && vote.status === 'ok';
    summary.byField[key] = summary.byField[key] || { n: 0, ok: 0 }; summary.byField[key].n += 1; if (good) summary.byField[key].ok += 1;
  }
  const sx = readSex(sheet.ticks.sexL.ratio, sheet.ticks.sexP.ratio);
  if (sx.sex === sheet.sex && sx.status === 'ok') summary.sex.right += 1; else if (sx.sex === null) summary.sex.none += 1; else if (sx.sex !== sheet.sex) summary.sex.wrongSilent += 1; else summary.sex.check += 1;
}
const stat = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / (a.length || 1), max: Math.max(0, ...a) });
if (process.argv[1] && process.argv[1].endsWith('record_eval.mjs')) {
  console.log(`Alignment: ${summary.aligned}/${summary.sheets} sheets aligned, fewest anchors used ${summary.anchorsMin}`);
  for (const l of ['easy', 'mid', 'hard']) { const s = stat(summary.centre[l]); console.log(`  ${l.padEnd(4)}: box centre error mean ${(s.mean * 100).toFixed(1)}% of box width, worst ${(s.max * 100).toFixed(1)}%`); }
  console.log(`  true box centre inside the read rectangle: ${summary.inside[0]} of ${summary.inside[1]}`);
  const row = (n, t) => `${n.padEnd(5)} n=${String(t.n).padStart(3)} | right&ok ${String(t.right_ok).padStart(3)} | right but check ${String(t.right_check).padStart(3)} | no value ${String(t.no_value).padStart(3)} | SILENT WRONG ${String(t.silent_wrong).padStart(2)}`;
  console.log('PAGE READING ONLY (naive: take the page reading when it is a valid number)'); for (const l of ['easy', 'mid', 'hard', 'all']) console.log('  ' + row(l, summary.page[l]));
  console.log('PAGE + 3 CROPS, VOTED (as the app does it)'); for (const l of ['easy', 'mid', 'hard', 'all']) console.log('  ' + row(l, summary.voted[l]));
  console.log('silent wrong (voted):', JSON.stringify(summary.silent, null, 1));
  console.log('right and ok, by field:', Object.entries(summary.byField).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join('  '));
  console.log('sex ticks:', JSON.stringify(summary.sex));
}
