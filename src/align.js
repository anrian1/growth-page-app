// Works out how a photo of a printed page is placed, tilted and tipped, from printed words whose true place is known.
// A homography is the transform a camera makes of a flat page (it handles tilt, shift, size AND perspective).

function solve(A, b) {                          // Gaussian elimination with pivoting; A is n x n
  const n = b.length; const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i += 1) {
    let p = i; for (let r = i + 1; r < n; r += 1) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r += 1) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c += 1) M[r][c] -= f * M[i][c]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) { let s = M[i][n]; for (let j = i + 1; j < n; j += 1) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

/** pairs: [{ from: [x, y], to: [u, v] }, ...] (at least 4). Returns the 3x3 matrix as 9 numbers, or null. */
export function fitHomography(pairs) {
  if (pairs.length < 4) return null;
  // normalise both sides (centre at zero, size about 1) so the maths stays well behaved
  const norm = (pts) => {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length; const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const s = Math.sqrt(2) / (pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length || 1);
    return { cx, cy, s };
  };
  const nf = norm(pairs.map((p) => p.from)); const nt = norm(pairs.map((p) => p.to));
  const AtA = Array.from({ length: 8 }, () => Array(8).fill(0)); const Atb = Array(8).fill(0);
  for (const { from, to } of pairs) {
    const x = (from[0] - nf.cx) * nf.s; const y = (from[1] - nf.cy) * nf.s; const u = (to[0] - nt.cx) * nt.s; const v = (to[1] - nt.cy) * nt.s;
    const rows = [[[x, y, 1, 0, 0, 0, -u * x, -u * y], u], [[0, 0, 0, x, y, 1, -v * x, -v * y], v]];
    for (const [r, rhs] of rows) for (let i = 0; i < 8; i += 1) { Atb[i] += r[i] * rhs; for (let j = 0; j < 8; j += 1) AtA[i][j] += r[i] * r[j]; }
  }
  const h = solve(AtA, Atb); if (!h) return null;
  const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  // undo the normalisation: H = Tt^-1 * Hn * Tf
  const Tf = [nf.s, 0, -nf.s * nf.cx, 0, nf.s, -nf.s * nf.cy, 0, 0, 1];
  const Ttinv = [1 / nt.s, 0, nt.cx, 0, 1 / nt.s, nt.cy, 0, 0, 1];
  const mul = (A, B) => { const C = Array(9).fill(0); for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) for (let k = 0; k < 3; k += 1) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; };
  const H = mul(Ttinv, mul(Hn, Tf));
  return H.map((v) => v / H[8]);
}

export function applyH(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** Fit, then repeatedly throw out the worst-fitting pair while it is clearly off. Returns { H, kept, rmse } or null. */
export function fitHomographyRobust(pairs, { maxPx = 8, minPairs = 6 } = {}) {
  let kept = pairs.slice();
  for (let guard = 0; guard < 30; guard += 1) {
    const H = fitHomography(kept); if (!H) return null;
    const res = kept.map((p) => { const q = applyH(H, p.from); return Math.hypot(q[0] - p.to[0], q[1] - p.to[1]); });
    const worst = Math.max(...res);
    const rmse = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / res.length);
    if (worst <= maxPx || kept.length <= minPairs) return { H, kept, rmse, worst };
    kept = kept.filter((_, i) => i !== res.indexOf(worst));
  }
  return null;
}
