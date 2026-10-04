// GO / NO-GO evidence for reading the prescription and diagnosis, end to end, on SYNTHETIC photos (handwriting-style fonts on a tablet screen, three
// difficulty levels) read by a real OCR engine (RapidOCR in Python, not the browser model).
// The four prescription AMOUNTS come from boxes (voted, like the vitals); the malaria TYPE, the test result, "dispersibel" and the artesunate mg come from the
// free text of Asessemen and Planning (3 readings each, parsed and voted). What the app pre-fills in the dose card is compared with what was written.
// The key safety number: how often the dose check would say "matches the table" when, with the written values, it would not (false reassurance).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { voteRx } from '../src/rxparse.js';
import { validateMalariaPack, checkRegimen } from '../src/malaria.js';
import { summary } from './record_eval.mjs';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/record_ocr_fixtures.json'), 'utf8'));
const cases = Object.fromEntries(JSON.parse(readFileSync(join(process.cwd(), 'docs/case-sheet.json'), 'utf8')).cases.map((c) => [c.id, c]));
const pack = validateMalariaPack(JSON.parse(readFileSync(join(process.cwd(), 'public/guidelines/malaria-dose.json'), 'utf8'))).pack;
const KEYS = ['species', 'testResult', 'treatment', 'formulation', 'dhpTablets', 'dhpDays', 'pqTablets', 'pqDays', 'artesunateMg'];

function written(c, sheet) {                                  // what is actually written on the page (and so what a perfect reader would fill)
  const a = c.app; const sev = a.treatment === 'severe';
  return { species: sev ? null : a.species, testResult: /negatif/i.test(sheet.texts.asessmen.truth) ? 'negative' : null, treatment: sev ? 'severe' : 'uncomplicated',
    formulation: !sev && a.formulation === 'dispersible' ? 'dispersible' : null, dhpTablets: sev ? null : a.dhpTablets, dhpDays: sev ? null : a.dhpDays,
    pqTablets: sev || a.pqTablets === '0' ? null : a.pqTablets, pqDays: sev || a.pqTablets === '0' ? null : a.pqDays ?? null, artesunateMg: sev ? a.artesunateMg : null };
}
const asInput = (v, c) => ({ weightKg: c.vitals.weight, ageMonths: c.ageMonths, species: v.species ?? '', formulation: v.formulation ?? 'standard', testResult: v.testResult ?? 'none', treatment: v.treatment ?? 'uncomplicated',
  dhpTablets: v.dhpTablets ?? '', dhpDays: v.dhpDays ?? undefined, pqTablets: v.pqTablets ?? '', pqDays: v.pqDays ?? undefined, artesunateMg: v.artesunateMg ?? undefined, bbpbCategory: null, g6pd: 'unknown' });

export const result = { pages: sheets.length, fields: {}, pageExact: { easy: [0, 0], mid: [0, 0], hard: [0, 0], all: [0, 0] }, wrongFilled: [], sameResult: 0, differentButSafe: 0, falseReassurance: [], falseAlarm: 0, rows: [] };
for (const k of KEYS) result.fields[k] = { expected: 0, right: 0, blank: 0, wrong: 0 };
for (const s of sheets) {
  const c = cases[s.name]; const truth = written(c, s); const boxes = summary.boxes[s.name];
  const readings = (r) => [s.texts[r].page, ...Object.values(s.texts[r].crops)];
  const vote = voteRx({ assess: readings('asessmen'), plan: readings('planning') });
  const got = { species: vote.fields.species.value, testResult: vote.fields.testResult.value, treatment: vote.fields.treatment.value, formulation: vote.fields.formulation.value, artesunateMg: vote.fields.artesunateMg.value,
    dhpTablets: boxes.rxDhpTabs.value, dhpDays: boxes.rxDhpDays.value, pqTablets: boxes.rxPqTabs.value, pqDays: boxes.rxPqDays.value };
  // the app's fallback when the text is not understood: tablets (standard) and uncomplicated
  if (got.treatment === null) got.treatment = null;
  let exact = true;
  for (const k of KEYS) {
    const want = truth[k]; const have = got[k]; const n = (v) => (v === null || v === undefined ? null : String(v));
    if (want !== null) result.fields[k].expected += 1;
    if (n(have) === n(want)) { if (want !== null) result.fields[k].right += 1; }
    else if (have === null) { result.fields[k].blank += 1; exact = false; }
    else { result.fields[k].wrong += 1; exact = false; result.wrongFilled.push(`${s.name} ${k}: read ${have}, written ${want}`); }
  }
  for (const lvl of [s.level, 'all']) { result.pageExact[lvl][1] += 1; if (exact) result.pageExact[lvl][0] += 1; }
  const r1 = checkRegimen(pack, asInput(truth, c)); const r2 = checkRegimen(pack, asInput(got, c));
  const ids = (r) => r.findings.filter((f) => f.level === 'check').map((f) => f.id).sort().join();
  const row = { name: s.name, level: s.level, exact, truthStatus: r1.status, appStatus: r2.status, truthChecks: ids(r1), appChecks: ids(r2) };
  if (r1.status === r2.status && ids(r1) === ids(r2)) result.sameResult += 1;
  else if (r2.status === 'match' && r1.status !== 'match') result.falseReassurance.push(row);
  else if (r2.status === 'differs' && r1.status === 'match') result.falseAlarm += 1;
  else result.differentButSafe += 1;
  result.rows.push(row);
}
if (process.argv[1] && process.argv[1].endsWith('rx_eval.mjs')) {
  console.log('FIELD LEVEL (expected = the page says it): right / blank (left for a person) / WRONG and filled');
  for (const k of KEYS) { const f = result.fields[k]; console.log(`  ${k.padEnd(13)} expected ${String(f.expected).padStart(2)} | right ${String(f.right).padStart(2)} | blank ${String(f.blank).padStart(2)} | wrong ${f.wrong}`); }
  console.log('PAGE LEVEL, every field right:', Object.entries(result.pageExact).map(([l, [a, b]]) => `${l} ${a}/${b}`).join('  '));
  console.log(`DOSE CHECK on the pre-filled values vs on what was written: same result ${result.sameResult}/${result.pages} | different but not reassuring ${result.differentButSafe} | false alarm ${result.falseAlarm} | FALSE REASSURANCE ${result.falseReassurance.length}`);
  for (const r of result.falseReassurance) console.log('  FALSE REASSURANCE', JSON.stringify(r));
  console.log('wrong and filled:'); for (const x of result.wrongFilled) console.log('  ' + x);
}
