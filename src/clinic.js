// Reads the synthetic clinic visit sheet: find the printed labels, work out how the photo is placed (homography),
// and return where each numeric box is in the photo. Only boxes are read; free-text areas are shown as pictures.
import { fitHomographyRobust, applyH } from './align.js';
import CLINIC from './templates/clinic-visit.js';

export { CLINIC };
export const CLINIC_FIELDS = Object.keys(CLINIC.fields);       // sys, dia, pulse, temp, weight, height
export const MIN_ANCHORS = 8;                                  // printed labels that must be found to trust the placement

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * alignByTemplate(template, tokens): find the template's printed labels in the OCR pieces and fit the camera transform.
 * tokens: [{ text, x, y, w, h }] from the whole-page OCR. Returns { ok, problems, H, anchors, rmse }.
 */
export function alignByTemplate(template, tokens) {
  const out = { ok: false, problems: [], H: null, anchors: 0, rmse: null };
  const pairs = []; const used = new Set();
  const cands = [];
  for (const label of template.labels) {
    const target = norm(label.text); if (target.length < 4) continue;
    const limit = Math.max(1, Math.floor(target.length * 0.2));
    tokens.forEach((t, i) => {
      const d = editDistance(target, norm(t.text));
      if (d <= limit) cands.push({ label, i, d, t });
    });
  }
  cands.sort((a, b) => a.d - b.d);
  const labelDone = new Set();
  for (const c of cands) {                                      // each label and each token is used at most once, best matches first
    if (labelDone.has(c.label) || used.has(c.i)) continue;
    labelDone.add(c.label); used.add(c.i);
    pairs.push({ from: [c.label.x + c.label.w / 2, c.label.y + c.label.h / 2], to: [c.t.x + c.t.w / 2, c.t.y + c.t.h / 2], text: c.label.text });
  }
  if (pairs.length < MIN_ANCHORS) { out.problems.push(`Hanya ${pairs.length} tulisan cetak yang dikenali (perlu ${MIN_ANCHORS}). Pastikan seluruh halaman terlihat, tegak lurus dan terang.`); return out; }
  const fit = fitHomographyRobust(pairs, { maxPx: 10, minPairs: MIN_ANCHORS });
  if (!fit) { out.problems.push('Posisi halaman tidak bisa dihitung. Foto ulang.'); return out; }
  out.H = fit.H; out.anchors = fit.kept.length; out.rmse = fit.rmse;
  if (fit.rmse > 12) { out.problems.push('Halaman tampak sangat miring atau terlipat. Foto ulang lebih lurus.'); return out; }
  out.ok = true;
  return out;
}

/** Where a template box lands in the photo: four corners. */
export function placeBox(H, b) {
  return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map((p) => applyH(H, p));
}

/** tokens -> aligned clinic sheet (kept for the clinic-sheet module and its tests) */
export function alignClinicPage(tokens) {
  const out = alignByTemplate(CLINIC, tokens);
  if (!out.ok) return { ...out, rects: null };
  const rects = {};
  for (const [key, f] of Object.entries(CLINIC.fields)) rects[key] = { poly: placeBox(out.H, f.box) };
  return { ...out, rects };
}

/** Bounding rectangle of a box in the photo, shrunk a little so the printed border is not read as a digit. */
export function readRect(poly, shrink = 0.08) {
  const xs = poly.map((p) => p[0]); const ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const mx = (x1 - x0) * shrink; const my = (y1 - y0) * shrink;
  return { x: x0 + mx, y: y0 + my, w: x1 - x0 - 2 * mx, h: y1 - y0 - 2 * my };
}
