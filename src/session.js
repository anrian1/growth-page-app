// The reading session for one photo.
//   1. readPage: read the whole page once, to find where the table is (the layout).
//   2. readRow : for one child (one sex, one month) read only the two handwriting cells, several times each.
// The browser parts (photo, engine) are passed in, so this file can be tested with fakes.
import { mapTokens, cellRect, latestFilledMonth } from './mapping.js';
import { readCell, readSex, tokensToText, INK_MIN } from './readcell.js';
import { TEMPLATE } from './template.js';
import { applyH } from './align.js';
import { alignClinicPage, alignByTemplate, placeBox, readRect, CLINIC, CLINIC_FIELDS } from './clinic.js';
import MEDREC from './templates/medical-record.js';
import { voteRx } from './rxparse.js';
import { FIELD_PARSERS } from './fieldparse.js';
import { ROW_NUMBERS, voteDrugName, assembleRx } from './rxrows.js';

export const PAGE_MAX_SIDE = 1600;     // the whole-page reading is done on a picture no bigger than this
const CELL_OCR_OPTIONS = { minimumConfidence: 0.2 };   // keep weak readings: they are only votes, and a person confirms

export async function readPage({ file, engine, photo, onProgress = () => {} }) {
  onProgress('Membuka foto…');
  const img = await photo.load(file);
  const pageCanvas = photo.scaled(img, PAGE_MAX_SIDE);
  onProgress('Membaca halaman…');
  const result = await engine.recognize(pageCanvas);
  const tokens = (result.lines || []).flat().map((t) => ({ text: t.text, x: t.box.x, y: t.box.y, w: t.box.width, h: t.box.height }));
  const mapped = mapTokens(tokens);
  return { img, pageCanvas, tokens, mapped, factor: img.width / pageCanvas.width };
}

/**
 * readRow(session, { sex, month, engine, photo }) ->
 *   { sex, month, cells: { weight, length }, flags, hint, rects }
 * Each cell is { status: ok|check|unreadable|empty, value, candidates, readings, ink, why }.
 */
export async function readRow(session, { sex, month, engine, photo, onProgress = () => {} }) {
  const { mapped } = session;
  if (!mapped.ok) return { sex, month, cells: null, flags: [...mapped.problems], hint: null, rects: null };
  const columns = TEMPLATE.sexBlocks[sex];
  const other = TEMPLATE.sexBlocks[sex === 'L' ? 'P' : 'L'];
  const cells = {}; const rects = {};
  for (const column of columns) {
    const kind = column.endsWith('weight') ? 'weight' : 'length';
    onProgress(kind === 'weight' ? 'Membaca kolom berat badan…' : 'Membaca kolom panjang badan…');
    const pageRect = cellRect(mapped.geometry, column, month, TEMPLATE.cell);
    const viewRect = cellRect(mapped.geometry, column, month);
    const toSource = (r) => ({ x: r.x * session.factor, y: r.y * session.factor, w: r.w * session.factor, h: r.h * session.factor });
    const readRect = toSource(pageRect);
    rects[kind] = toSource(viewRect);
    const pageCell = mapped.cells[`${column}|${month}`];
    cells[kind] = await readCell({
      column, month, rect: readRect,
      pageText: pageCell ? pageCell.text : null,
      makeCrop: (rect, height) => photo.crop(session.img, rect, height),
      recognize: (picture) => engine.recognize(picture, CELL_OCR_OPTIONS),
      measureInk: (picture) => photo.ink(picture),
    });
  }
  const flags = [];
  if (other.some((c) => mapped.cells[`${c}|${month}`])) flags.push(`Ada tulisan juga di blok jenis kelamin lain pada bulan ${month}. Periksa jenis kelamin dan barisnya.`);
  const latest = latestFilledMonth(mapped, sex);
  let hint = null;
  if (cells.weight.status === 'empty' && cells.length.status === 'empty' && latest !== null && latest !== month) hint = { latestMonth: latest };
  return { sex, month, cells, flags, hint, rects };
}


// ---------------------------------------------------------------- the clinic visit sheet
function inside(poly, x, y) {                       // is the point inside a four-cornered shape?
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = poly[i]; const b = poly[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cross !== 0) { if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false; }
  }
  return true;
}
const bounds = (poly) => { const xs = poly.map((q) => q[0]); const ys = poly.map((q) => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };

export async function readClinicPage({ file, engine, photo, onProgress = () => {} }) {
  onProgress('Membuka foto…');
  const img = await photo.load(file);
  const pageCanvas = photo.scaled(img, PAGE_MAX_SIDE);
  onProgress('Membaca halaman…');
  const result = await engine.recognize(pageCanvas);
  const tokens = (result.lines || []).flat().map((t) => ({ text: t.text, x: t.box.x, y: t.box.y, w: t.box.width, h: t.box.height }));
  return { img, pageCanvas, tokens, aligned: alignClinicPage(tokens), factor: img.width / pageCanvas.width };
}

/**
 * readClinicFields(session, { engine, photo }) -> { cells: { sys, dia, ... }, rects, pictures: { keluhan, diagnosis, rencana }, flags }
 * Reads only the six numeric boxes. The free-text areas are returned as picture rectangles for a person to look at.
 */
export async function readClinicFields(session, { engine, photo, onProgress = () => {} }) {
  const { aligned } = session;
  if (!aligned.ok) return { cells: null, rects: null, pictures: null, flags: [...aligned.problems] };
  const toSource = (r) => ({ x: r.x * session.factor, y: r.y * session.factor, w: r.w * session.factor, h: r.h * session.factor });
  const cells = {}; const rects = {};
  for (const key of CLINIC_FIELDS) {
    const field = CLINIC.fields[key];
    onProgress(`Membaca ${field.label.toLowerCase()}…`);
    const poly = aligned.rects[key].poly;
    const pageText = session.tokens.filter((t) => inside(poly, t.x + t.w / 2, t.y + t.h / 2)).sort((a, b) => a.x - b.x).map((t) => t.text.trim()).join(' ');
    rects[key] = toSource(bounds(poly));
    cells[key] = await readCell({
      column: key, range: field.range, repairDecimal: field.decimals === 1, month: null,
      rect: toSource(readRect(poly)),
      pageText: pageText === '' ? null : pageText,
      makeCrop: (rect, height) => photo.crop(session.img, rect, height),
      recognize: (picture) => engine.recognize(picture, CELL_OCR_OPTIONS),
      measureInk: (picture) => photo.ink(picture),
    });
  }
  const pictures = {};
  for (const [key, b] of Object.entries(CLINIC.freeText)) {
    const poly = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map((p) => applyH(aligned.H, p));
    pictures[key] = toSource(bounds(poly));
  }
  return { cells, rects, pictures, flags: [] };
}


// ---------------------------------------------------------------- the revised medical record (SOAP page)
export const RECORD_FIELDS = Object.keys(MEDREC.fields);         // sys, dia, hr, rr, temp, height, weight, dobD, dobM, dobY, tglD, tglM, tglY
export { MEDREC };

export async function readRecordPage({ file, engine, photo, onProgress = () => {} }) {
  onProgress('Membuka foto…');
  const img = await photo.load(file);
  const pageCanvas = photo.scaled(img, PAGE_MAX_SIDE);
  onProgress('Membaca halaman…');
  const result = await engine.recognize(pageCanvas);
  const tokens = (result.lines || []).flat().map((t) => ({ text: t.text, x: t.box.x, y: t.box.y, w: t.box.width, h: t.box.height }));
  const aligned = alignByTemplate(MEDREC, tokens);
  // PRIVACY: the page reader sees the whole page, including the handwritten name, address, phone and BPJS number.
  // Right after the page is aligned, every piece of text inside those areas is thrown away. Nothing later can use, show, save or export it.
  let safe = tokens; let piiDropped = 0;
  if (aligned.ok) {
    const areas = MEDREC.pii.map((r) => placeBox(aligned.H, r));
    safe = tokens.filter((t) => { const hit = areas.some((a) => inside(a, t.x + t.w / 2, t.y + t.h / 2)); if (hit) piiDropped += 1; return !hit; });
  }
  return { img, pageCanvas, tokens: safe, piiDropped, aligned, factor: img.width / pageCanvas.width };
}

const TEXT_OCR_OPTIONS = { minimumConfidence: 0.1 };
const TEXT_HEIGHTS = [480, 640];                     // the free-text areas are read at two large sizes, besides the whole-page reading
const textOf = (result) => (result.lines || []).flat().filter((t) => t && t.box).sort((a, b) => Math.round(a.box.y / 14) - Math.round(b.box.y / 14) || a.box.x - b.box.x).map((t) => String(t.text).trim()).filter(Boolean).join(' ');

/**
 * readRecordFields(session, { engine, photo }) ->
 *   { cells: { sys, dia, ... }, rects, sex: { sex, status, why }, ticks: { ratios, rects }, pictures: { keluhan, asessmen, planning }, flags }
 * The numeric boxes and the date boxes are read like the other pages (page reading + three crops, voted). The two sex boxes are ink-measured.
 * The free-text areas are returned as picture rectangles only: the AI does not read them.
 */
export async function readRecordFields(session, { engine, photo, onProgress = () => {} }) {
  const { aligned } = session;
  if (!aligned.ok) return { cells: null, rects: null, sex: null, ticks: null, pictures: null, flags: [...aligned.problems] };
  const toSource = (r) => ({ x: r.x * session.factor, y: r.y * session.factor, w: r.w * session.factor, h: r.h * session.factor });
  const cells = {}; const rects = {};
  let n = 0;
  // prescription rows (form v4): a row is EMPTY when the name box and its three number boxes show no ink. Empty rows are not read at all (saves time).
  const rowKeys = (r) => [`rx${r}Amt`, `rx${r}Freq`, `rx${r}Days`];
  // A photo of a screen has glare and moire that look like ink, so "some ink" is not enough to call a row used:
  //   no ink at all -> empty;  very strong ink -> used (even if nothing could be read: a person chooses);
  //   in between -> ONE quick read of the whole row: text found = used, nothing found = empty.
  const ROW_STRONG_INK = 0.2;
  const rowUsed = {};
  for (const r of ROW_NUMBERS) {
    const boxes = [MEDREC.names[`rx${r}Name`].box, ...rowKeys(r).map((k) => MEDREC.fields[k].box)];
    const rects4 = boxes.map((b) => toSource(readRect(placeBox(aligned.H, b))));
    let maxInk = 0;
    for (const rc of rects4) { const pic = await photo.crop(session.img, rc, 96); maxInk = Math.max(maxInk, photo.ink(pic)); }
    if (maxInk < INK_MIN) { rowUsed[r] = false; continue; }
    if (maxInk >= ROW_STRONG_INK) { rowUsed[r] = true; continue; }
    const x0 = Math.min(...rects4.map((q) => q.x)); const y0 = Math.min(...rects4.map((q) => q.y));
    const strip = { x: x0, y: y0, w: Math.max(...rects4.map((q) => q.x + q.w)) - x0, h: Math.max(...rects4.map((q) => q.y + q.h)) - y0 };
    let text = '';
    try { text = tokensToText(await engine.recognize(await photo.crop(session.img, strip, 192), CELL_OCR_OPTIONS)); } catch (e) { text = ''; }
    rowUsed[r] = /[0-9A-Za-z]/.test(text);
  }
  const rowOf = (key) => { const m = /^rx(\d)(Amt|Freq|Days)$/.exec(key); return m ? Number(m[1]) : null; };
  for (const key of RECORD_FIELDS) {
    const field = MEDREC.fields[key];
    const rr = rowOf(key);
    if (rr !== null && !rowUsed[rr]) {
      rects[key] = toSource(bounds(placeBox(aligned.H, field.box)));
      cells[key] = { column: key, status: 'empty', value: null, candidates: [], readings: [], ink: 0, hasInk: false, why: ['the row is empty'] };
      continue;
    }
    n += 1;
    onProgress(`Membaca ${field.label} (${n}/${RECORD_FIELDS.length})…`);
    const poly = placeBox(aligned.H, field.box);
    const pageText = session.tokens.filter((t) => inside(poly, t.x + t.w / 2, t.y + t.h / 2)).sort((a, b) => a.x - b.x).map((t) => t.text.trim()).join(' ');
    rects[key] = toSource(bounds(poly));
    cells[key] = await readCell({
      column: key, range: field.range, repairDecimal: field.decimals === 1, integer: field.decimals === 0, parse: field.kind ? FIELD_PARSERS[field.kind] : null, month: null,
      rect: toSource(readRect(poly)),
      pageText: pageText === '' ? null : pageText,
      makeCrop: (rect, height) => photo.crop(session.img, rect, height),
      recognize: (picture) => engine.recognize(picture, CELL_OCR_OPTIONS),
      measureInk: (picture) => photo.ink(picture),
    });
  }
  // the drug NAME of each used row: read as text (page reading + 3 crops), matched to a fixed list, voted
  const names = {};
  for (const r of ROW_NUMBERS) {
    const nb = MEDREC.names[`rx${r}Name`].box; const poly = placeBox(aligned.H, nb);
    rects[`rx${r}Name`] = toSource(bounds(poly));
    if (!rowUsed[r]) { names[r] = { drug: null, status: 'empty', votes: 0, of: 0, candidates: [], dispersible: false, text: '', readings: [] }; continue; }
    onProgress(`Membaca nama obat, baris ${r}…`);
    const pageText = session.tokens.filter((t) => inside(poly, t.x + t.w / 2, t.y + t.h / 2)).sort((a, b) => a.x - b.x).map((t) => t.text.trim()).filter(Boolean).join(' ');
    const readings = [pageText];
    for (const h of [96, 128, 160]) {
      try { readings.push(tokensToText(await engine.recognize(await photo.crop(session.img, toSource(readRect(poly)), h), CELL_OCR_OPTIONS))); } catch (e) { readings.push(''); }
    }
    names[r] = { ...voteDrugName(readings), readings };
  }
  onProgress('Membaca kotak LK/PR…');
  const ratios = {}; const tickRects = {};
  for (const key of Object.keys(MEDREC.ticks)) {
    const poly = placeBox(aligned.H, MEDREC.ticks[key].box);
    const picture = await photo.crop(session.img, toSource(readRect(poly, 0.22)), 96);
    ratios[key] = photo.ink(picture);
    tickRects[key] = toSource(bounds(poly));
  }
  const sex = readSex(ratios.sexL, ratios.sexP);
  const pictures = {};
  for (const [key, b] of Object.entries(MEDREC.freeText)) pictures[key] = toSource(bounds(placeBox(aligned.H, b)));
  // the two free-text areas that carry the diagnosis and the prescription: three readings each, parsed and voted (see rxparse.js)
  const texts = {};
  for (const name of ['asessmen', 'planning']) {
    onProgress(name === 'asessmen' ? 'Membaca diagnosis (Asessemen)…' : 'Membaca resep (Planning)…');
    const poly = placeBox(aligned.H, MEDREC.freeText[name]);
    const rect = toSource(bounds(poly));
    const pageText = session.tokens.filter((t) => inside(poly, t.x + t.w / 2, t.y + t.h / 2)).sort((a, b) => Math.round(a.y / 14) - Math.round(b.y / 14) || a.x - b.x).map((t) => t.text.trim()).filter(Boolean).join(' ');
    const readings = [pageText];
    for (const h of TEXT_HEIGHTS) {
      try { readings.push(textOf(await engine.recognize(await photo.crop(session.img, rect, h), TEXT_OCR_OPTIONS))); } catch (e) { readings.push(''); }
    }
    texts[name] = readings;
  }
  const rx = voteRx({ assess: texts.asessmen, plan: texts.planning });
  const union = (list) => { const x0 = Math.min(...list.map((r) => r.x)); const y0 = Math.min(...list.map((r) => r.y)); const x1 = Math.max(...list.map((r) => r.x + r.w)); const y1 = Math.max(...list.map((r) => r.y + r.h)); const m = 6 * session.factor; return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }; };
  const rows = ROW_NUMBERS.map((r) => ({ n: r, empty: !rowUsed[r], name: names[r], amount: cells[`rx${r}Amt`].value, freq: cells[`rx${r}Freq`].value, days: cells[`rx${r}Days`].value, drug: names[r].drug || '', dispersible: names[r].dispersible }));
  const rxAuto = assembleRx(rows);
  const rowStrips = Object.fromEntries(ROW_NUMBERS.map((r) => [`row${r}`, union([rects[`rx${r}Name`], ...rowKeys(r).map((k) => rects[k])])]));
  const strips = { ...rowStrips, dob: union([rects.dobD, rects.dobM, rects.dobY]), tgl: union([rects.tglD, rects.tglM, rects.tglY]), sex: union([tickRects.sexL, tickRects.sexP]), td: union([rects.sys, rects.dia]) };
  return { cells, rects, sex, ticks: { ratios, rects: tickRects }, pictures, strips, rx, texts, rows, rxAuto, flags: [] };
}
