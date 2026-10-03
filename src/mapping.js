// Turns OCR pieces (text + position) from a photo of the Buku KIA growth page into cells:
// which column (boys/girls, weight/length) and which month each handwritten number belongs to.
//
// The printed words "Ideal" / "Aktual" and the month numbers 0-24 are used as position markers,
// so the printed Ideal numbers are never mistaken for handwriting.
// Nothing here guesses silently: every cell says how sure it is ("ok", "check" or "unreadable").
import { analyseNumber } from './ocr-helpers.js';
import { TEMPLATE, kindOfColumn } from './template.js';

export const COLUMNS = TEMPLATE.columns;
const RANGE = { weight: TEMPLATE.kinds.weight.range, length: TEMPLATE.kinds.length.range };

const cx = (t) => t.x + t.w / 2;
const cy = (t) => t.y + t.h / 2;
const kindOf = kindOfColumn;

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const isWord = (text, word) => editDistance(text.replace(/\s+/g, '').toLowerCase(), word) <= 1;

// Least-squares polynomial fit y = c0 + c1 x + c2 x^2 (small, no libraries)
function fitPoly(points, degree) {
  const n = degree + 1;
  const A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (const [x, y] of points) for (let i = 0; i < n; i += 1) { for (let j = 0; j < n; j += 1) A[i][j] += x ** (i + j); A[i][n] += y * x ** i; }
  for (let i = 0; i < n; i += 1) {
    let p = i; for (let r = i + 1; r < n; r += 1) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = i + 1; r < n; r += 1) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c += 1) A[r][c] -= f * A[i][c]; }
  }
  const coef = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) { let s = A[i][n]; for (let j = i + 1; j < n; j += 1) s -= A[i][j] * coef[j]; coef[i] = s / A[i][i]; }
  return coef;
}
const evalPoly = (coef, x) => coef.reduce((s, c, i) => s + c * x ** i, 0);

/**
 * mapTokens(tokens) where each token is { text, x, y, w, h } (top-left corner and size, in pixels).
 * Returns { ok, problems, geometry, cells, unreadable }.
 *
 * Photos taken at an angle make the table lean: rows slope, and each column drifts sideways as you go down.
 * So the position of every column is followed row by row, using the printed Ideal numbers (there is one
 * in every row), and the handwriting column is placed the fixed distance next to it.
 */
export function mapTokens(tokens) {
  const problems = [];
  const out = { ok: false, problems, geometry: null, cells: {}, unreadable: [] };

  // 1. header words
  const akt = tokens.filter((t) => isWord(t.text, TEMPLATE.headerWords.actual)).sort((a, b) => cx(a) - cx(b));
  const ideal = tokens.filter((t) => isWord(t.text, TEMPLATE.headerWords.ideal)).sort((a, b) => cx(a) - cx(b));
  if (akt.length < 4) { problems.push(`Found ${akt.length} "Aktual" headers, need 4. Is the whole table in the photo?`); return out; }
  const aktHeaders = akt.length > 4 ? akt.sort((a, b) => a.y - b.y).slice(0, 4).sort((a, b) => cx(a) - cx(b)) : akt;
  const headerBottom = Math.max(...aktHeaders.map((t) => t.y + t.h));
  const idealHeaders = ideal.filter((t) => Math.abs(cy(t) - cy(aktHeaders[0])) < 60).slice(0, 4);
  if (idealHeaders.length < 4) { problems.push(`Found ${idealHeaders.length} "Ideal" headers, need 4. Is the whole table in the photo?`); return out; }

  // 2. page tilt from the header line (all eight header words sit on one printed line)
  const hp = [...aktHeaders, ...idealHeaders].map((t) => [cx(t), cy(t)]);
  const mx = hp.reduce((a, q) => a + q[0], 0) / hp.length; const my = hp.reduce((a, q) => a + q[1], 0) / hp.length;
  const varX = hp.reduce((a, q) => a + (q[0] - mx) ** 2, 0);
  const slope = varX > 0 ? hp.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / varX : 0;
  if (Math.abs(slope) > 0.2) { problems.push('The page looks tilted by more than 10 degrees. Retake the photo straight on.'); return out; }
  const bulan = tokens.find((t) => isWord(t.text, TEMPLATE.headerWords.month));
  const X0 = bulan ? cx(bulan) : cx(idealHeaders[0]) - 1.2 * (cx(aktHeaders[0]) - cx(idealHeaders[0]));
  const adjY = (t) => cy(t) - slope * (cx(t) - X0);                 // y with the tilt removed
  const gaps = aktHeaders.map((a, i) => cx(a) - cx(idealHeaders[i]));
  const pairGap = gaps.reduce((a, g) => a + Math.abs(g), 0) / 4;
  if (!(pairGap > 15)) { problems.push('Could not tell the Ideal and Aktual columns apart. Retake the photo.'); return out; }

  // 3. month numbers: integer text 0-24 to the left of the first Ideal column (they name their own rows)
  const labelLimit = cx(idealHeaders[0]) - 0.9 * pairGap;
  const labels = [];
  for (const t of tokens) {
    if (cy(t) <= headerBottom || cx(t) > labelLimit) continue;
    const a = analyseNumber(t.text);
    if (a.value !== null && Number.isInteger(a.value) && a.value >= 0 && a.value <= 24) labels.push({ month: a.value, y: adjY(t), token: t });
  }
  const byMonth = new Map(); labels.forEach((l) => { if (!byMonth.has(l.month)) byMonth.set(l.month, l); });
  const pts = [...byMonth.values()].map((l) => [l.month, l.y]);
  if (pts.length < 6) { problems.push(`Found only ${pts.length} month numbers on the left, need most of 0-24. Is the whole table in the photo?`); return out; }
  const rowCoef = fitPoly(pts, pts.length >= 10 ? 2 : 1);
  const rowY = (m) => evalPoly(rowCoef, m);
  const rowSpacing = (rowY(24) - rowY(0)) / 24;
  if (!(rowSpacing > 8)) { problems.push('The rows look squashed or upside down. Retake the photo straight on.'); return out; }
  const monthOfY = (y) => { let best = 0; let bd = Infinity; for (let m = -1; m <= 25; m += 1) { const d = Math.abs(rowY(m) - y); if (d < bd) { bd = d; best = m; } } return { month: best, dist: bd }; };
  const mHeader = (() => { let lo = -4; let hi = 0; for (let i = 0; i < 40; i += 1) { const mid = (lo + hi) / 2; if (rowY(mid) < adjY(aktHeaders[0])) lo = mid; else hi = mid; } return (lo + hi) / 2; })();
  const labelSet = new Set(labels.map((l) => l.token));
  const firstRow = rowY(0) - 0.6 * rowSpacing; const lastRow = rowY(24) + 0.6 * rowSpacing;

  // 4. follow each Ideal column down the page (line: x = c + b * (month - mHeader)), starting straight down
  // A tilted page makes columns lean by about -slope per pixel going down; start from that guess, then refine.
  const lines = idealHeaders.map((h) => ({ c: cx(h), b: -slope * rowSpacing }));
  const numericLike = (t) => t.text.trim() !== '' && /\d/.test(t.text);
  const candidates = tokens.filter((t) => !labelSet.has(t) && !aktHeaders.includes(t) && !ideal.includes(t) && numericLike(t) && adjY(t) >= firstRow && adjY(t) <= lastRow);
  for (let pass = 0; pass < 4; pass += 1) {
    lines.forEach((ln) => {
      const pp = [];
      for (const t of candidates) {
        const { month, dist } = monthOfY(adjY(t));
        if (dist > 0.5 * rowSpacing || month < 0 || month > 24) continue;
        if (Math.abs(cx(t) - (ln.c + ln.b * (month - mHeader))) <= 0.45 * pairGap) pp.push([month - mHeader, cx(t)]);
      }
      if (pp.length >= 6) { const f = fitPoly(pp, 1); ln.c = f[0]; ln.b = f[1]; }
    });
  }
  const aktCenter = (i, m) => lines[i].c + gaps[i] + lines[i].b * (m - mHeader);
  const idealCenter = (i, m) => lines[i].c + lines[i].b * (m - mHeader);
  const colSpacing = (aktCenter(3, 0) - aktCenter(0, 0)) / 3;
  out.geometry = { lines, gaps, mHeader, colSpacing, rowCoef, rowSpacing, pairGap, slope, X0 };

  // 5. handwriting pieces. First find which ones sit in an Aktual column (using the nearest row for now).
  const picked = [];
  for (const t of tokens) {
    if (labelSet.has(t) || aktHeaders.includes(t) || ideal.includes(t)) continue;
    const y = adjY(t); if (y < firstRow || y > lastRow) continue;
    const { month, dist } = monthOfY(y);
    if (dist > 0.6 * rowSpacing || month < 0 || month > 24) continue;
    let best = null;
    for (let i = 0; i < 4; i += 1) {
      for (const [kind, x] of [['ideal', idealCenter(i, month)], ['akt', aktCenter(i, month)]]) {
        const d = Math.abs(cx(t) - x); if (!best || d < best.d) best = { i, kind, d };
      }
    }
    if (!best || best.kind !== 'akt' || best.d > 0.7 * pairGap) continue;     // printed Ideal numbers, side banners, page number...
    picked.push({ t, y, column: COLUMNS[best.i] });
  }
  // People write a little low (or high) inside the cell. Measure that shift on all handwriting together
  // (as a circular average, so it works even when the shift is close to half a row) and remove it before choosing rows.
  const readable = picked.filter((q) => q.t.text.trim() !== '');
  let shift = 0;
  if (readable.length >= 3) {
    let sn = 0; let cs2 = 0;
    for (const q of readable) { const r = q.y - rowY(monthOfY(q.y).month); const ang = (2 * Math.PI * r) / rowSpacing; sn += Math.sin(ang); cs2 += Math.cos(ang); }
    shift = (Math.atan2(sn, cs2) / (2 * Math.PI)) * rowSpacing;
  }
  out.geometry.handwritingShift = shift;
  for (const { t, y: y0, column } of picked) {
    const y = y0 - shift;
    if (t.text.trim() === '') {                       // ink was detected but nothing could be read
      const top = y - t.h / 2; const bottom = y + t.h / 2;
      const covered = []; for (let m = 0; m <= 24; m += 1) if (rowY(m) >= top && rowY(m) <= bottom) covered.push(m);
      if (covered.length) out.unreadable.push({ column, months: covered });
      continue;
    }
    const { month, dist } = monthOfY(y);
    if (dist > 0.5 * rowSpacing || month < 0 || month > 24) continue;
    const key = `${column}|${month}`;
    const a = analyseNumber(t.text);
    const why = [];
    let value = a.value; let status = 'ok';
    if (value === null) { status = 'unreadable'; why.push(`could not read "${t.text}" as a number`); }
    else {
      const [lo, hi] = RANGE[kindOf(column)];
      if (value < lo || value > hi) { status = 'unreadable'; why.push(`"${t.text}" is outside ${lo}-${hi}: a decimal point may be missing`); value = null; }
      else {
        if (a.substituted) { status = 'check'; why.push(`letters or symbols read as digits ("${t.text}")`); }
        if (a.hadSpace) { status = 'check'; why.push(`space inside the number ("${t.text}")`); }
        if (kindOf(column) === 'weight' && !/[.,\u00b7:;=-]/.test(t.text)) { status = 'check'; why.push('weight without a decimal point'); }
      }
    }
    const cell = { column, month, text: t.text, value, status, why, token: t };
    if (out.cells[key]) { cell.status = 'check'; cell.why.push('two readings in one cell: ' + out.cells[key].text + ' and ' + t.text); if (out.cells[key].value !== null && value === null) continue; }
    out.cells[key] = cell;
  }
  out.ok = true;
  return out;
}

/** A rectangle (same pixel space as the tokens) around one cell, for cropping a picture of it. */
export function cellRect(geometry, column, month, size = { widthOfPairGap: 0.8, heightOfRowSpacing: 0.95 }) {
  const i = COLUMNS.indexOf(column);
  const { lines, gaps, mHeader, slope, X0, rowCoef } = geometry;
  const w = geometry.pairGap * size.widthOfPairGap; const h = geometry.rowSpacing * size.heightOfRowSpacing;
  const xc = lines[i].c + gaps[i] + lines[i].b * (month - mHeader);
  const yc = evalPoly(rowCoef, month) + slope * (xc - X0);
  return { x: xc - w / 2, y: yc - h / 2, w, h };
}

/**
 * readRow(mapped, { month, sex }): the weight and length handwritten on one row, for one sex block.
 * Never guesses. Anything missing, unclear or odd comes back as a flag for the person to deal with.
 */
export function readRow(mapped, { month, sex }) {
  const flags = [];
  const mine = sex === 'L' ? ['L-weight', 'L-length'] : ['P-weight', 'P-length'];
  const other = sex === 'L' ? ['P-weight', 'P-length'] : ['L-weight', 'L-length'];
  const pick = (column) => {
    const cell = mapped.cells[`${column}|${month}`];
    const label = kindOf(column) === 'weight' ? 'weight' : 'length';
    if (!cell) {
      const hidden = mapped.unreadable.find((u) => u.column === column && u.months.includes(month));
      flags.push(hidden ? `Something is written for ${label} at month ${month} but it could not be read. Please type it.` : `No handwriting found for ${label} at month ${month}.`);
      return { cell: null, value: null, status: hidden ? 'unreadable' : 'missing' };
    }
    if (cell.status !== 'ok') flags.push(`${label} at month ${month}: ${cell.why.join('; ')}.`);
    return { cell, value: cell.value, status: cell.status };
  };
  const weight = pick(mine[0]);
  const length = pick(mine[1]);
  if (other.some((c) => mapped.cells[`${c}|${month}`])) flags.push(`Handwriting was also found in the other sex block at month ${month}. Check the sex and the row.`);
  return { weight, length, flags, month, sex };
}

/** The highest month that has any handwriting in one sex block (used when no date of birth is available). */
export function latestFilledMonth(mapped, sex) {
  const cols = sex === 'L' ? ['L-weight', 'L-length'] : ['P-weight', 'P-length'];
  let latest = null;
  for (const cell of Object.values(mapped.cells)) if (cols.includes(cell.column) && (latest === null || cell.month > latest)) latest = cell.month;
  return latest;
}

const RANK = { ok: 0, check: 1, unreadable: 2 };

/**
 * mergeReadings([mapped, mapped, ...]): combine several readings of the SAME photo (for example at two sizes).
 * A cell is accepted only when every reading found it and they agree. Any difference makes it a "check" cell with
 * no value, so a wrong number cannot slip through just because one reading happened to be right.
 */
export function mergeReadings(list) {
  const passes = list.filter((m) => m && m.ok);
  if (passes.length === 0) return list[0] || { ok: false, problems: ['No reading'], cells: {}, unreadable: [] };
  if (passes.length === 1) return passes[0];
  const keys = new Set(passes.flatMap((m) => Object.keys(m.cells)));
  const cells = {};
  for (const key of keys) {
    const present = passes.map((m) => m.cells[key]).filter(Boolean);
    const values = present.map((c) => c.value).filter((v) => v !== null);
    const first = present[0];
    const agree = present.length === passes.length && values.length === passes.length && values.every((v) => Math.abs(v - values[0]) < 0.001);
    if (agree) {
      const worst = present.reduce((w, c) => (RANK[c.status] > RANK[w] ? c.status : w), 'ok');
      cells[key] = { ...first, value: values[0], status: worst, why: [...new Set(present.flatMap((c) => c.why))] };
    } else {
      const seen = present.map((c) => `"${c.text}"`).join(' / ');
      const missingIn = passes.length - present.length;
      cells[key] = {
        ...first, value: null, status: 'check', candidates: [...new Set(values)],
        why: [`the ${passes.length} readings do not agree${missingIn ? ` (found in ${present.length} of ${passes.length})` : ''}: ${seen}`],
      };
    }
  }
  const unreadable = passes.flatMap((m) => m.unreadable);
  return { ok: true, problems: [], geometry: passes[0].geometry, cells, unreadable, passes: passes.length };
}
