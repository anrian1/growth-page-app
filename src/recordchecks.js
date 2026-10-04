// Plain consistency checks on the vitals read from the medical record. No clinical thresholds live here.
export const RECORD_VITALS = ['sys', 'dia', 'hr', 'rr', 'temp', 'height', 'weight'];
const LABEL = { sys: 'Sistolik', dia: 'Diastolik', hr: 'HR', rr: 'RR', temp: 'Suhu', height: 'TB', weight: 'BB' };

/** values: { sys, dia, hr, rr, temp, height, weight } numbers or null; ranges: { key: [lo, hi] } (optional, for typed values). */
export function checkRecordValues(values, ranges = null) {
  const v = Object.fromEntries(RECORD_VITALS.map((k) => [k, Number.isFinite(values[k]) ? values[k] : null]));
  const flags = [];
  if (v.sys !== null && v.dia === null || v.sys === null && v.dia !== null) flags.push('TD belum lengkap: sistolik dan diastolik keduanya diperlukan.');
  else if (v.sys !== null && v.sys <= v.dia) flags.push('Sistolik harus lebih besar dari diastolik. Periksa kedua angka di foto.');
  if (ranges) for (const k of RECORD_VITALS) if (v[k] !== null && (v[k] < ranges[k][0] || v[k] > ranges[k][1])) flags.push(`${LABEL[k]} ${v[k]} di luar rentang yang masuk akal (${ranges[k][0]}\u2013${ranges[k][1]}). Periksa angka di foto.`);
  if (v.weight === null) flags.push('BB belum dicatat: status gizi dan dosis tidak dapat dihitung.');
  if (v.height === null) flags.push('TB belum dicatat: hanya BB/U yang dapat dihitung.');
  return { flags, values: v };
}
