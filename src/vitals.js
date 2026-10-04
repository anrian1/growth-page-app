// Plain arithmetic and plain consistency checks on the numbers read from the clinic sheet.
// Nothing here is clinical guidance: no thresholds for "high" or "low" live in this file.
// Category labels and clinical thresholds come only from a reviewed guideline pack (see guidelines.js).
export const VITAL_KEYS = ['sys', 'dia', 'pulse', 'temp', 'weight', 'height'];
const LABELS = { sys: 'Sistolik', dia: 'Diastolik', pulse: 'Nadi', temp: 'Suhu', weight: 'Berat badan', height: 'Tinggi badan' };

export function bmi(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** values: { sys, dia, pulse, temp, weight, height } with numbers or null. Returns { bmi, flags: [string], missing: [key] }. */
export function checkVitals(values, ranges = null) {
  const v = Object.fromEntries(VITAL_KEYS.map((k) => [k, Number.isFinite(values[k]) ? values[k] : null]));
  const flags = [];
  const missing = VITAL_KEYS.filter((k) => v[k] === null);
  if (v.sys === null && v.dia === null) flags.push('Tekanan darah belum dicatat.');
  else if (v.sys === null || v.dia === null) flags.push('Tekanan darah belum lengkap: sistolik dan diastolik keduanya diperlukan.');
  else if (v.sys <= v.dia) flags.push('Sistolik harus lebih besar dari diastolik. Periksa kedua angka di foto.');
  if (ranges) for (const k of VITAL_KEYS) if (v[k] !== null && (v[k] < ranges[k][0] || v[k] > ranges[k][1])) flags.push(`${LABELS[k]} ${v[k]} di luar rentang yang masuk akal (${ranges[k][0]}\u2013${ranges[k][1]}). Periksa angka di foto.`);
  if (v.weight === null) flags.push('Berat badan belum dicatat.');
  if (v.height === null) flags.push('Tinggi badan belum dicatat.');
  return { bmi: bmi(v.weight, v.height), flags, missing, values: v };
}
