// Growth calculator for children 0-59 months (stage 1; 5-18 years is stage 2).
// Pure functions, no network, no AI: every result can be checked by hand.
// Indices: bbu = weight-for-age; pbu = length-for-age (PB/U, under 24 months, measured lying) or height-for-age (TB/U, from 24 months, standing);
// bbpb = weight-for-length (BB/PB, under 24 months) or weight-for-height (BB/TB, from 24 months).
import LMS from './who_lms.js';

// ---------------------------------------------------------------------------
// SETTINGS YOU MAY CHANGE ("update me" items, to be confirmed by a clinician)
// ---------------------------------------------------------------------------
export const LIMITS = {
  // A typed or read value outside these ranges is flagged for the person to check.
  weightKg: [1.0, 25],      // UPDATE ME: plausible weight range, kg
  lengthCm: [40, 100],      // UPDATE ME: plausible length range, cm
  // Scores outside these z limits are flagged as "probably a reading or typing error".
  // Placeholder values recalled from WHO's "biologically implausible" limits; verify before relying on them.
  zBbu: [-6, 5],
  zPbu: [-6, 6],
  zBbpb: [-5, 5],
};
export const MAX_AGE_MONTHS = 59;      // stage 1 covers 0-59 months (WHO 2006 standards)
export const STANDING_FROM_MONTHS = 24; // from 24 months the WHO tables are for height measured standing (about 0.7 cm less than lying length)
export const LENGTH_CONVENTION = 'nearest'; // 'nearest' = round to the nearest 0.5 cm (half up); 'interpolate' = blend the two neighbours

// ---------------------------------------------------------------------------
// Labels (Permenkes No. 2/2020, as quoted in secondary sources; verify against the regulation attachment)
// ---------------------------------------------------------------------------
export const LABELS = {
  bbu: ['Berat badan sangat kurang', 'Berat badan kurang', 'Berat badan normal', 'Risiko berat badan lebih'],
  pbu: ['Sangat pendek', 'Pendek', 'Normal', 'Tinggi'],
  bbpb: ['Gizi buruk', 'Gizi kurang', 'Gizi baik', 'Berisiko gizi lebih', 'Gizi lebih', 'Obesitas'],
};

// Boundaries: exactly -3 SD falls in the "kurang / pendek" band, exactly -2 SD is normal,
// +1 SD (bbu, bbpb) and +3 SD (pbu) are still normal; +2 and +3 SD (bbpb) stay in the lower band.
export function categoryBbu(z) {
  const L = LABELS.bbu;
  return z < -3 ? L[0] : z < -2 ? L[1] : z <= 1 ? L[2] : L[3];
}
export function categoryPbu(z) {
  const L = LABELS.pbu;
  return z < -3 ? L[0] : z < -2 ? L[1] : z <= 3 ? L[2] : L[3];
}
export function categoryBbpb(z) {
  const L = LABELS.bbpb;
  return z < -3 ? L[0] : z < -2 ? L[1] : z <= 1 ? L[2] : z <= 2 ? L[3] : z <= 3 ? L[4] : L[5];
}

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------
export function zFromLms(x, L, M, S) {
  return L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
}

export function nearestHalfCm(length) {
  return Math.floor(length * 2 + 0.5) / 2;   // 84.25 -> 84.5, 84.2 -> 84.0
}

function wflLms(sex, length, standing) {
  const table = standing ? LMS.wfh[sex] : LMS.wfl[sex];
  const key = (v) => v.toFixed(1);
  if (LENGTH_CONVENTION === 'interpolate') {
    const low = Math.floor(length * 2) / 2;
    const high = low + 0.5;
    const a = table[key(low)];
    const b = table[key(high)];
    if (!a || !b) return null;
    const t = (length - low) / 0.5;
    return [0, 1, 2].map((i) => a[i] + t * (b[i] - a[i]));
  }
  return table[key(nearestHalfCm(length))] || null;   // null = outside the table (45-110 cm lying, 65-120 cm standing)
}

// ---------------------------------------------------------------------------
// Age from date of birth (completed months)
// ---------------------------------------------------------------------------
function parseIso(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (!m) throw new Error('Date must look like 2026-03-14');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error('That date does not exist: ' + text);
  }
  return [y, mo, d];
}
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Completed months. A child born on the 31st reaches a month on the last day of a shorter month.
export function ageInMonths(dobIso, visitIso) {
  const [y1, m1, d1] = parseIso(dobIso);
  const [y2, m2, d2] = parseIso(visitIso);
  if (Date.UTC(y2, m2 - 1, d2) < Date.UTC(y1, m1 - 1, d1)) throw new Error('Date of birth is after the visit date');
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < Math.min(d1, daysInMonth(y2, m2))) months -= 1;
  return months;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

// Weight indices show "<-3" or ">+3" instead of a number beyond 3 SD
// (WHO adjusts weight-based scores out there; only the category matters).
export function displayZ(z, index) {
  if (z === null || z === undefined) return '';
  if (index !== 'pbu' && z < -3) return '<-3';
  if (index !== 'pbu' && z > 3) return '>+3';
  return (Math.round(z * 100) / 100).toFixed(2);
}

/**
 * assess({ sex: 'L' | 'P', ageMonths, weightKg, lengthCm })   (lengthCm = length lying under 24 months, height standing from 24 months)
 * action:  SCORE | PARTIAL_BBU_ONLY | FLAG_CONFIRM | OUT_OF_SCOPE | BLOCK_MISSING_SEX | BLOCK_MISSING_WEIGHT
 * The result is a screening aid. A person makes the final call. When the action is not SCORE,
 * show the flags and ask the person to check; never present a number as certain.
 */
export function assess({ sex, ageMonths, weightKg, lengthCm }) {
  const flags = [];
  const out = { action: 'SCORE', flags, z: { bbu: null, pbu: null, bbpb: null }, zRounded: {}, category: { bbu: null, pbu: null, bbpb: null }, display: {}, names: { bbu: 'BB/U', pbu: 'PB/U', bbpb: 'BB/PB' }, standing: false };

  if (sex !== 'L' && sex !== 'P') { out.action = 'BLOCK_MISSING_SEX'; flags.push('Jenis kelamin belum diisi: skor tidak dapat dihitung.'); return out; }
  if (!Number.isInteger(ageMonths) || ageMonths < 0 || ageMonths > MAX_AGE_MONTHS) {
    out.action = 'OUT_OF_SCOPE'; flags.push(`Status gizi dihitung untuk umur 0\u2013${MAX_AGE_MONTHS} bulan (tahap 1). Umur ${Number.isInteger(ageMonths) ? ageMonths + ' bulan' : 'ini'} di luar rentang.`); return out;
  }
  if (!isNum(weightKg)) { out.action = 'BLOCK_MISSING_WEIGHT'; flags.push('Berat badan belum ada.'); return out; }

  const standing = ageMonths >= STANDING_FROM_MONTHS;
  out.standing = standing;
  out.names = { bbu: 'BB/U', pbu: standing ? 'TB/U' : 'PB/U', bbpb: standing ? 'BB/TB' : 'BB/PB' };
  const lenWord = standing ? 'Tinggi' : 'Panjang';

  let needsCheck = false;
  if (weightKg < LIMITS.weightKg[0] || weightKg > LIMITS.weightKg[1]) { needsCheck = true; flags.push(`Berat ${weightKg} kg di luar rentang ${LIMITS.weightKg[0]}-${LIMITS.weightKg[1]} kg. Periksa salah satuan atau koma.`); }
  const hasLength = isNum(lengthCm);
  if (hasLength && (lengthCm < LIMITS.lengthCm[0] || lengthCm > LIMITS.lengthCm[1])) { needsCheck = true; flags.push(`${lenWord} ${lengthCm} cm di luar rentang ${LIMITS.lengthCm[0]}-${LIMITS.lengthCm[1]} cm. Periksa salah satuan atau koma.`); }

  // Scores (computed even when flagged, so the person can see why)
  const [wL, wM, wS] = LMS.wfa[sex][ageMonths];
  out.z.bbu = zFromLms(weightKg, wL, wM, wS);
  if (hasLength) {
    const [lL, lM, lS] = standing ? LMS.hfa[sex][ageMonths - STANDING_FROM_MONTHS] : LMS.lhfa[sex][ageMonths];
    out.z.pbu = zFromLms(lengthCm, lL, lM, lS);
    const w = wflLms(sex, lengthCm, standing);
    if (w) out.z.bbpb = zFromLms(weightKg, w[0], w[1], w[2]);
    else { needsCheck = true; flags.push(`${lenWord} di luar tabel (${standing ? '65-120' : '45-110'} cm): ${out.names.bbpb} tidak dapat dihitung.`); }
    if (out.z.bbpb !== null && lengthCm !== nearestHalfCm(lengthCm) && LENGTH_CONVENTION === 'nearest') {
      flags.push(`${out.names.bbpb} memakai baris tabel ${nearestHalfCm(lengthCm)} cm (${lenWord.toLowerCase()} dibulatkan ke 0,5 cm terdekat).`);
    }
  }

  // z-limit check (probably a reading or typing error)
  const zBox = [['bbu', LIMITS.zBbu], ['pbu', LIMITS.zPbu], ['bbpb', LIMITS.zBbpb]];
  for (const [k, [lo, hi]] of zBox) {
    const z = out.z[k];
    if (z !== null && (z < lo || z > hi)) { needsCheck = true; flags.push(`Skor ${out.names[k]} ${round2(z)} di luar ${lo} sampai ${hi}: kemungkinan salah baca atau salah ketik.`); }
  }

  // JUDGMENT CALL (declared): the category is chosen from the score ROUNDED TO 2 DECIMALS, the same number the screen shows.
  // Otherwise a score of -3.003 would display as "-3.00" next to "Gizi buruk" (below -3), which looks like a contradiction.
  // The reference library also rounds to 2 decimals. Only scores within 0.005 of a boundary are affected.
  if (out.z.bbu !== null) out.category.bbu = categoryBbu(round2(out.z.bbu));
  if (out.z.pbu !== null) out.category.pbu = categoryPbu(round2(out.z.pbu));
  if (out.z.bbpb !== null) out.category.bbpb = categoryBbpb(round2(out.z.bbpb));
  for (const k of ['bbu', 'pbu', 'bbpb']) {
    out.zRounded[k] = out.z[k] === null ? null : round2(out.z[k]);
    out.display[k] = displayZ(out.z[k], k);
  }

  out.action = needsCheck ? 'FLAG_CONFIRM' : hasLength ? 'SCORE' : 'PARTIAL_BBU_ONLY';
  if (!hasLength && !needsCheck) flags.push(`${lenWord} belum ada: hanya BB/U yang dihitung.`);
  return out;
}
