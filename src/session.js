// The reading session for one photo.
//   1. readPage: read the whole page once, to find where the table is (the layout).
//   2. readRow : for one child (one sex, one month) read only the two handwriting cells, several times each.
// The browser parts (photo, engine) are passed in, so this file can be tested with fakes.
import { mapTokens, cellRect, latestFilledMonth } from './mapping.js';
import { readCell } from './readcell.js';
import { TEMPLATE } from './template.js';

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
