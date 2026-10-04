// The clinic page session with a fake camera and a fake OCR engine, on the REAL OCR output of a synthetic photo.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readClinicPage, readClinicFields } from '../src/session.js';
import { alignClinicPage, readRect, CLINIC_FIELDS } from '../src/clinic.js';

const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/clinic_ocr_fixtures.json'), 'utf8'));
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };

function makeWorld(sheet, say) {
  const aligned = alignClinicPage(sheet.tokens);
  const rects = Object.fromEntries(CLINIC_FIELDS.map((k) => [k, readRect(aligned.rects[k].poly)]));
  const which = (r) => CLINIC_FIELDS.find((k) => Math.abs(rects[k].x - r.x) < 1e-6 && Math.abs(rects[k].y - r.y) < 1e-6);
  const engine = { async recognize(pic) {
    if (pic.kind === 'page') return { lines: [sheet.tokens.map((t) => ({ text: t.text, box: { x: t.x, y: t.y, width: t.w, height: t.h } }))] };
    const text = say(which(pic.rect), pic.height); return { lines: text == null ? [] : [[{ text, box: { x: 0 } }]] };
  } };
  const photo = { async load() { return { width: 2400, height: 1800 }; }, scaled() { return { kind: 'page', width: 1600, height: 1200 }; }, crop(img, rect, height) { return { kind: 'crop', rect: { x: rect.x / 1.5, y: rect.y / 1.5, w: rect.w / 1.5, h: rect.h / 1.5 }, height }; }, ink: () => 0.05 };
  return { engine, photo };
}

// a clean sheet: crops read the true values
const sheet = sheets.find((s) => s.name === 'A3_hard');
const truth = Object.fromEntries(CLINIC_FIELDS.map((k) => [k, sheet.fields[k].truth]));
let { engine, photo } = makeWorld(sheet, (key) => truth[key]);
let session = await readClinicPage({ file: {}, engine, photo });
check('page aligned', session.aligned.ok && session.aligned.anchors >= 8, JSON.stringify(session.aligned.problems));
check('page factor is the shrink from 2400 to 1600', Math.abs(session.factor - 1.5) < 1e-9);
let out = await readClinicFields(session, { engine, photo });
check('all six boxes were read', out.cells && CLINIC_FIELDS.every((k) => out.cells[k]));
check('every crop vote returned the true value for A3_hard', CLINIC_FIELDS.every((k) => out.cells[k].value === Number(truth[k])), JSON.stringify(CLINIC_FIELDS.map((k) => [k, out.cells[k].value, out.cells[k].status])));
check('three free-text pictures are returned (not read)', Object.keys(out.pictures).join() === 'keluhan,diagnosis,rencana');
check('picture rectangles are in source pixels (larger than the page-space ones)', out.rects.sys.w > 100);

// one box unreadable, one box empty
({ engine, photo } = makeWorld(sheet, (key) => (key === 'pulse' ? null : truth[key])));
session = await readClinicPage({ file: {}, engine, photo });
out = await readClinicFields(session, { engine, photo });
check('a box the crops cannot read falls back to the page reading as a lone vote: no value is offered', out.cells.pulse.value === null || out.cells.pulse.status !== 'ok', JSON.stringify(out.cells.pulse));
check('the other boxes are unaffected', out.cells.sys.value === Number(truth.sys));

// a photo that is not the clinic sheet
const junk = { async recognize() { return { lines: [[{ text: 'Tabel Pertumbuhan Anak', box: { x: 1, y: 1, width: 100, height: 20 } }]] }; } };
session = await readClinicPage({ file: {}, engine: junk, photo });
check('another page is refused with a reason', !session.aligned.ok);
out = await readClinicFields(session, { engine: junk, photo });
check('reading fields of a refused page returns the reason, not a crash', out.cells === null && out.flags.length === 1);
console.log(`Clinic session: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
