// Evidence run: how well does "page reading + three crop readings, voted" do on synthetic photos of the clinic sheet?
// The OCR outputs in the fixture come from a real OCR engine (RapidOCR in Python) on synthetic photos with handwriting-style fonts.
// SYNTHETIC: fonts are tidier than real handwriting. The numbers below show how the logic behaves, not how real clinics will fare.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { voteReadings } from '../src/readcell.js';
import { analyseNumber } from '../src/ocr-helpers.js';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/clinic_ocr_fixtures.json'), 'utf8'));
const RANGE = { sys: [60, 260], dia: [30, 160], pulse: [30, 220], temp: [32, 43], weight: [20, 250], height: [100, 220] };
const tally = () => ({ n: 0, right_ok: 0, right_check: 0, truth_in_candidates: 0, silent_wrong: 0, no_value: 0, silent: [] });
const stats = { page_only: {}, voted: {} };
for (const mode of Object.keys(stats)) for (const c of ['easy', 'mid', 'hard', 'all']) stats[mode][c] = tally();

for (const sheet of sheets) {
  for (const [key, f] of Object.entries(sheet.fields)) {
    const truth = Number(f.truth);
    const range = RANGE[key];
    // page-only: accept the page reading when it parses and is in range (what a naive tool would do)
    const a = analyseNumber(f.page);
    const pageVal = a.value !== null && a.value >= range[0] && a.value <= range[1] ? a.value : null;
    const readings = [{ source: 'page', text: f.page }, ...Object.entries(f.crops).map(([h, t]) => ({ source: `crop${h}`, text: t }))];
    const vote = voteReadings(readings, { range, repairDecimal: key === 'temp' || key === 'weight' });
    for (const cond of [sheet.info.cond, 'all']) {
      const p = stats.page_only[cond]; p.n += 1;
      if (pageVal === null) p.no_value += 1; else if (Math.abs(pageVal - truth) < 0.001) p.right_ok += 1; else { p.silent_wrong += 1; p.silent.push(`${sheet.name} ${key}: ${pageVal} vs ${truth}`); }
      const v = stats.voted[cond]; v.n += 1;
      if (vote.value === null) { v.no_value += 1; if (vote.candidates.some((c) => Math.abs(c - truth) < 0.001)) v.truth_in_candidates += 1; }
      else if (Math.abs(vote.value - truth) < 0.001) { if (vote.status === 'ok') v.right_ok += 1; else v.right_check += 1; }
      else if (vote.status === 'ok') { v.silent_wrong += 1; v.silent.push(`${sheet.name} ${key}: ${vote.value} vs ${truth}  readings=${JSON.stringify(readings.map((r) => r.text))}`); }
      else { v.right_check += 0; v.truth_in_candidates += vote.candidates.some((c) => Math.abs(c - truth) < 0.001) ? 1 : 0; }
    }
  }
}
const show = (name, t) => `${name.padEnd(5)} n=${String(t.n).padStart(3)} | right&ok ${String(t.right_ok).padStart(3)} | right but check ${String(t.right_check).padStart(3)} | no value ${String(t.no_value).padStart(3)} | SILENT WRONG ${String(t.silent_wrong).padStart(2)}`;
console.log('PAGE READING ONLY (naive: take the page reading when it is a number in range)');
for (const c of ['easy', 'mid', 'hard', 'all']) console.log('  ' + show(c, stats.page_only[c]));
console.log('PAGE + 3 CROPS, VOTED (as the app does it)');
for (const c of ['easy', 'mid', 'hard', 'all']) console.log('  ' + show(c, stats.voted[c]));
console.log('silent wrong (voted):', JSON.stringify(stats.voted.all.silent, null, 1));
console.log('silent wrong (page only):', JSON.stringify(stats.page_only.all.silent));
