// Evidence run on SYNTHETIC photos of a tablet screen showing handwriting-style fonts on form v3 (21 sheets, 3 difficulty levels, 3 simulated writers).
// The OCR outputs in the fixture come from a real OCR engine (RapidOCR in Python), not the browser model.
// Prints: alignment accuracy, reading accuracy per group of boxes (page-only vs voted), sex ticks, and every wrong value that was NOT flagged.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignByTemplate, placeBox, readRect } from '../src/clinic.js';
import { voteReadings, readSex } from '../src/readcell.js';
import { analyseNumber } from '../src/ocr-helpers.js';
import { FIELD_PARSERS, parseTabletsBox } from '../src/fieldparse.js';
import MEDREC from '../src/templates/medical-record.js';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/record_ocr_fixtures.json'), 'utf8'));
const GROUP = (k) => (k === 'mrn' ? 'mrn' : k.startsWith('rx') ? 'rx' : /^(dob|tgl)/.test(k) ? 'dates' : 'vitals');
const tally = () => ({ n: 0, right_ok: 0, right_check: 0, no_value: 0, silent_wrong: 0 });
export const summary = { sheets: sheets.length, aligned: 0, anchorsMin: 99, centre: { easy: [], mid: [], hard: [] }, inside: [0, 0], page: {}, voted: {}, groups: {}, sex: { right: 0, wrongSilent: 0, none: 0, check: 0 }, silent: [], byField: {}, boxes: {}, mrnPagesRight: 0 };
for (const m of ['page', 'voted']) for (const l of ['easy', 'mid', 'hard', 'all']) summary[m][l] = tally();
for (const g of ['vitals', 'dates', 'mrn', 'rx']) summary.groups[g] = tally();

const canonical = (kind, v) => (kind === 'tablets' ? parseTabletsBox(String(v)).value : kind === 'mrn' ? String(v) : Number(v));
const same = (a, b) => (typeof a === 'number' ? Math.abs(a - b) < 1e-9 : a === b);

for (const sheet of sheets) {
  const al = alignByTemplate(MEDREC, sheet.tokens);
  if (al.ok) { summary.aligned += 1; summary.anchorsMin = Math.min(summary.anchorsMin, al.anchors); }
  summary.boxes[sheet.name] = {};
  if (al.ok) for (const [key, f] of Object.entries(sheet.fields)) {
    const est = placeBox(al.H, MEDREC.fields[key].box); const tru = f.poly1600;
    const cen = (p) => [p.reduce((a, q) => a + q[0], 0) / 4, p.reduce((a, q) => a + q[1], 0) / 4];
    const [ex, ey] = cen(est); const [tx, ty] = cen(tru);
    summary.centre[sheet.level].push(Math.hypot(ex - tx, ey - ty) / Math.hypot(tru[1][0] - tru[0][0], tru[1][1] - tru[0][1]));
    const rr = readRect(est); summary.inside[1] += 1; if (tx > rr.x && tx < rr.x + rr.w && ty > rr.y && ty < rr.y + rr.h) summary.inside[0] += 1;
  }
  let mrnOk = false;
  for (const [key, f] of Object.entries(sheet.fields)) {
    const spec = MEDREC.fields[key]; const kind = spec.kind; const parse = kind ? FIELD_PARSERS[kind] : null;
    const blank = f.truth === '';
    const truth = blank ? null : canonical(kind, f.truth);
    const readings = [{ source: 'page', text: f.page }, ...Object.entries(f.crops).map(([h, t]) => ({ source: `crop${h}`, text: t }))];
    const opts = parse ? { parse } : { range: spec.range, repairDecimal: spec.decimals === 1, integer: spec.decimals === 0 };
    let pv = null;
    if (parse) pv = parse(f.page).value; else { const a = analyseNumber(f.page); pv = a.value !== null && a.value >= spec.range[0] && a.value <= spec.range[1] && (!opts.integer || Number.isInteger(a.value)) ? a.value : null; }
    const vote = voteReadings(readings, opts);
    summary.boxes[sheet.name][key] = { value: vote.value, status: vote.status, truth, blank };
    const g = GROUP(key);
    for (const [bucket, label] of [[summary.page, 'page'], [summary.voted, 'voted']]) {
      const v = label === 'page' ? { value: pv, status: pv === null ? 'unreadable' : 'ok' } : vote;
      for (const lvl of [sheet.level, 'all']) {
        const t = bucket[lvl]; t.n += 1;
        if (blank) { if (v.value === null) t.right_ok += 1; else if (v.status === 'ok') { t.silent_wrong += 1; if (lvl === 'all' && label === 'voted') summary.silent.push(`${sheet.name} ${key}: ${v.value} on a blank box`); } else t.right_check += 0; continue; }
        if (v.value === null) t.no_value += 1;
        else if (same(v.value, truth)) { if (v.status === 'ok') t.right_ok += 1; else t.right_check += 1; }
        else if (v.status === 'ok') { t.silent_wrong += 1; if (lvl === 'all' && label === 'voted') summary.silent.push(`${sheet.name} ${key}: ${v.value} vs ${truth}  ${JSON.stringify(readings.map((r) => r.text))}`); }
      }
      if (label === 'voted') {
        const t = summary.groups[g]; t.n += 1;
        if (blank) { if (v.value === null) t.right_ok += 1; else if (v.status === 'ok') t.silent_wrong += 1; }
        else if (v.value === null) t.no_value += 1;
        else if (same(v.value, truth)) { if (v.status === 'ok') t.right_ok += 1; else t.right_check += 1; }
        else if (v.status === 'ok') t.silent_wrong += 1;
      }
    }
    const good = blank ? vote.value === null : vote.value !== null && same(vote.value, truth) && vote.status === 'ok';
    summary.byField[key] = summary.byField[key] || { n: 0, ok: 0 }; summary.byField[key].n += 1; if (good) summary.byField[key].ok += 1;
    if (key === 'mrn') mrnOk = good;
  }
  if (mrnOk) summary.mrnPagesRight += 1;
  const sx = readSex(sheet.ticks.sexL.ratio, sheet.ticks.sexP.ratio);
  if (sx.sex === sheet.sex && sx.status === 'ok') summary.sex.right += 1; else if (sx.sex === null) summary.sex.none += 1; else if (sx.sex !== sheet.sex) summary.sex.wrongSilent += 1; else summary.sex.check += 1;
}
const stat = (a) => ({ mean: a.reduce((x, y) => x + y, 0) / (a.length || 1), max: Math.max(0, ...a) });
if (process.argv[1] && process.argv[1].endsWith('record_eval.mjs')) {
  console.log(`Alignment: ${summary.aligned}/${summary.sheets} sheets aligned, fewest anchors used ${summary.anchorsMin}`);
  for (const l of ['easy', 'mid', 'hard']) { const s = stat(summary.centre[l]); console.log(`  ${l.padEnd(4)}: box centre error mean ${(s.mean * 100).toFixed(1)}% of box width, worst ${(s.max * 100).toFixed(1)}%`); }
  console.log(`  true box centre inside the read rectangle: ${summary.inside[0]} of ${summary.inside[1]}`);
  const row = (n, t) => `${n.padEnd(7)} n=${String(t.n).padStart(3)} | right&ok ${String(t.right_ok).padStart(3)} | right but check ${String(t.right_check).padStart(3)} | no value ${String(t.no_value).padStart(3)} | SILENT WRONG ${String(t.silent_wrong).padStart(2)}`;
  console.log('PAGE READING ONLY'); for (const l of ['easy', 'mid', 'hard', 'all']) console.log('  ' + row(l, summary.page[l]));
  console.log('PAGE + 3 CROPS, VOTED (as the app does it)'); for (const l of ['easy', 'mid', 'hard', 'all']) console.log('  ' + row(l, summary.voted[l]));
  console.log('BY GROUP (voted)'); for (const g of ['vitals', 'dates', 'mrn', 'rx']) console.log('  ' + row(g, summary.groups[g]));
  console.log(`MRN: all 8 digits right and shown as reliable on ${summary.mrnPagesRight} of ${summary.sheets} pages`);
  console.log('silent wrong (voted):', JSON.stringify(summary.silent, null, 1));
  console.log('right and ok, by field:', Object.entries(summary.byField).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join('  '));
  console.log('sex ticks:', JSON.stringify(summary.sex));
}
