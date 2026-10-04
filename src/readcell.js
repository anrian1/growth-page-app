// Reads ONE handwritten cell, several times, and decides how far to trust the result.
// Everything here is plain code (no browser needed), so it can be tested without a camera.
import { analyseNumber, slashAsOne } from './ocr-helpers.js';
import { TEMPLATE, kindOfColumn } from './template.js';

export const INK_MIN = 0.012;          // UPDATE ME after real photos: share of dark pixels that counts as "something is written"
export const CROP_HEIGHTS = [96, 128, 160];   // the cell is read at three sizes

// ---------------------------------------------------------------- picture helpers (work on plain gray arrays)
function percentile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]; }

/** Stretch the gray values so the darkest ink becomes black and the paper becomes white (in place). */
export function stretchContrast(gray) {
  if (gray.length === 0) return gray;
  const sorted = Uint8ClampedArray.from(gray).sort();
  const lo = percentile(sorted, 0.02); const hi = percentile(sorted, 0.85);
  if (hi - lo < 25) return gray;                      // flat picture (blank paper): do not amplify noise
  for (let i = 0; i < gray.length; i += 1) gray[i] = ((gray[i] - lo) * 255) / (hi - lo);
  return gray;
}

/**
 * Share of dark pixels inside `inner` ({x,y,w,h}) of a picture `stride` pixels wide, ignoring a margin
 * (cell borders and neighbouring print). "Dark" means clearly darker than the paper around it.
 */
export function inkRatio(gray, stride, inner, marginFrac = 0.1, drop = 60) {
  const mx = Math.round(inner.w * marginFrac); const my = Math.round(inner.h * marginFrac);
  const values = [];
  for (let y = inner.y + my; y < inner.y + inner.h - my; y += 1) {
    for (let x = inner.x + mx; x < inner.x + inner.w - mx; x += 1) values.push(gray[y * stride + x]);
  }
  if (values.length === 0) return 0;
  const sorted = Uint8ClampedArray.from(values).sort();
  const paper = percentile(sorted, 0.7);
  if (paper < 100) return 0;                          // very dark picture: cannot tell ink from shadow
  let dark = 0;
  for (const v of values) if (v < paper - drop) dark += 1;
  return dark / values.length;
}

// ---------------------------------------------------------------- reading text from OCR output
/** OCR result ({lines:[[{text, box}]]}) -> one text string, pieces left to right. */
export function tokensToText(result) {
  const pieces = ((result && result.lines) || []).flat().filter((t) => t && String(t.text).trim() !== '');
  pieces.sort((a, b) => ((a.box && a.box.x) || 0) - ((b.box && b.box.x) || 0));
  return pieces.map((t) => String(t.text).trim()).join(' ');
}

// ---------------------------------------------------------------- voting
/**
 * voteReadings(readings, column): readings = [{ source, text }]. Empty text means "nothing read".
 * - 'ok'         : at least 3 of 4 (75%) readings give the same value, none of them a guess
 * - 'check'      : a clear leader with at least 2 votes, or the leaders were guesses (letters, spaces)
 * - 'unreadable' : no clear leader. No value is offered; the candidates are listed for a person to choose.
 */
export function voteReadings(readings, spec) {
  // spec: a growth-page column name ('L-weight'), or { range: [lo, hi] } for any other numeric field
  const parse = typeof spec !== 'string' ? spec.parse : null;                // boxes that are not plain numbers (MRN, fractions)
  const [lo, hi] = parse ? [-Infinity, Infinity] : typeof spec === 'string' ? TEMPLATE.kinds[kindOfColumn(spec)].range : spec.range;
  const repairDecimal = typeof spec !== 'string' && spec.repairDecimal === true;
  const integerOnly = typeof spec !== 'string' && spec.integer === true;      // dates: a decimal point means a misreading
  const analysed = readings.map((r) => {
    if (parse) { const p = parse(r.text); return { ...r, value: p.value, substituted: !!p.substituted, hadSpace: false, note: p.note }; }
    const sl = slashAsOne(r.text);
    const a = analyseNumber(sl.text, { loose: true });
    let value = a.value; let note = null; let repaired = false;
    if (value !== null && integerOnly && !Number.isInteger(value)) { note = `${r.text} is not a whole number`; value = null; }
    if (value !== null && (value < lo || value > hi)) { note = `${r.text} is outside ${lo}-${hi}`; value = null; }
    // a lost decimal point is the commonest mistake on fields like temperature or adult weight ("365" or "37 2" for 36.5 / 37.2):
    // offer the repaired number, but a repaired reading can never make a cell "ok"
    if (value === null && repairDecimal && a.value !== null) {
      const digits = String(r.text).replace(/\D/g, '');
      if (digits.length >= 3) { const v = Number(digits) / 10; if (v >= lo && v <= hi) { value = v; repaired = true; note = `${r.text}: decimal point restored`; } }
    }
    return { ...r, value, substituted: a.substituted || repaired || sl.changed, hadSpace: a.hadSpace, note };
  });
  const groups = [];
  for (const a of analysed) {
    if (a.value === null) continue;
    const g = groups.find((x) => (typeof a.value === 'number' ? Math.abs(x.value - a.value) < 0.001 : x.value === a.value));
    if (g) g.members.push(a); else groups.push({ value: a.value, members: [a] });
  }
  groups.sort((x, y) => y.members.length - x.members.length);
  const candidates = groups.map((g) => g.value);
  const n = analysed.length;
  const top = groups[0];
  const why = analysed.filter((a) => a.note).map((a) => a.note);
  if (!top) return { value: null, status: 'unreadable', candidates, why: [...why, 'no reading could be turned into a number'], analysed };
  const clearLeader = groups.length === 1 || groups[1].members.length < top.members.length;
  const clean = top.members.every((m) => !m.substituted && !m.hadSpace);
  if (clearLeader && top.members.length >= Math.max(2, Math.ceil(0.75 * n))) {   // never accept a lone reading
    if (clean) return { value: top.value, status: 'ok', candidates, why, analysed };
    return { value: top.value, status: 'check', candidates, why: [...why, 'the readings agree but contain letters or spaces read as digits'], analysed };
  }
  if (clearLeader && top.members.length >= 2) {
    return { value: top.value, status: 'check', candidates, why: [...why, `only ${top.members.length} of ${n} readings agree`], analysed };
  }
  return { value: null, status: 'unreadable', candidates, why: [...why, `the ${n} readings do not agree`], analysed };
}

// ---------------------------------------------------------------- reading one cell
/**
 * readCell({ column, month, rect, makeCrop, recognize, measureInk, pageText, heights })
 *  makeCrop(rect, height) -> picture of the cell at that height   (browser code, or a fake in tests)
 *  recognize(picture)     -> OCR result                           (browser code, or a fake in tests)
 *  measureInk(picture)    -> share of dark pixels
 *  pageText               -> what the whole-page reading said for this cell (one more vote), or null
 */
export async function readCell({ column, range = null, repairDecimal = false, integer = false, parse = null, month, rect, makeCrop, recognize, measureInk, pageText = null, heights = CROP_HEIGHTS }) {
  const readings = [];
  if (pageText !== null && pageText !== undefined) readings.push({ source: 'page', text: String(pageText) });
  let ink = null;
  for (const h of heights) {
    let text = '';
    try {
      const picture = await makeCrop(rect, h);
      if (ink === null && measureInk) ink = measureInk(picture);
      text = tokensToText(await recognize(picture));
    } catch (error) { text = ''; }
    readings.push({ source: `crop${h}`, text });
  }
  const vote = voteReadings(readings, parse ? { parse } : range ? { range, repairDecimal, integer } : column);
  const hasInk = ink === null ? null : ink >= INK_MIN;
  let { status } = vote; const why = [...vote.why];
  const anyText = readings.some((r) => r.text.trim() !== '');
  if (hasInk === false && !anyText) { status = 'empty'; why.length = 0; why.push('the cell looks empty'); }
  else if (hasInk === false && vote.value !== null) { status = 'check'; why.push('the cell looks empty, but a value was read'); }
  else if (hasInk === true && status === 'unreadable' && !anyText) why.push('ink found, but nothing could be read');
  return { column, month, status, value: status === 'empty' ? null : vote.value, candidates: vote.candidates, readings: vote.analysed.map((a) => ({ source: a.source, text: a.text, value: a.value })), ink, hasInk, why };
}


// ---------------------------------------------------------------- tick boxes (sex)
export const TICK_ON = 0.02;    // UPDATE ME after real photos: share of dark pixels inside the box that counts as a tick
export const TICK_OFF = 0.008;  // below this the box is blank; between the two it is "unclear" and a person decides

/** ink ratio of a tick box -> 'ticked' | 'blank' | 'unclear' */
export function tickState(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 'unclear';
  if (ratio >= TICK_ON) return 'ticked';
  if (ratio < TICK_OFF) return 'blank';
  return 'unclear';
}

/** The two sex boxes -> { sex: 'L'|'P'|null, status: 'ok'|'check'|'unreadable', why } (never guesses when both or neither are ticked) */
export function readSex(ratioL, ratioP) {
  const l = tickState(ratioL); const p = tickState(ratioP);
  if (l === 'ticked' && p === 'blank') return { sex: 'L', status: 'ok', why: [] };
  if (p === 'ticked' && l === 'blank') return { sex: 'P', status: 'ok', why: [] };
  if (l === 'ticked' && p === 'ticked') return { sex: null, status: 'unreadable', why: ['kedua kotak LK dan PR tampak ditandai'] };
  if (l === 'blank' && p === 'blank') return { sex: null, status: 'unreadable', why: ['tidak ada kotak LK atau PR yang tampak ditandai'] };
  if (l === 'ticked') return { sex: 'L', status: 'check', why: ['kotak PR kurang jelas'] };
  if (p === 'ticked') return { sex: 'P', status: 'check', why: ['kotak LK kurang jelas'] };
  return { sex: null, status: 'unreadable', why: ['tanda di kotak LK/PR kurang jelas'] };
}
