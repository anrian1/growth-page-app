// Dates and age for the medical record: the date of birth (DOB boxes) and the visit date (TGL boxes).
// Age is the visit date minus the date of birth, in completed months, with checks that catch misreadings.
import { ageInMonths } from './core/zscore.js';

const pad = (n) => String(n).padStart(2, '0');
export const MAX_AGE_YEARS = 18;

/** day, month, year (numbers or null) -> { ok, iso, reason } */
export function makeDate(d, m, y) {
  if (![d, m, y].every((v) => Number.isInteger(v))) return { ok: false, iso: null, reason: 'tanggal belum lengkap' };
  if (y < 1900 || y > 2100) return { ok: false, iso: null, reason: `tahun ${y} tidak masuk akal` };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return { ok: false, iso: null, reason: `tanggal ${pad(d)}/${pad(m)}/${y} tidak ada di kalender` };
  return { ok: true, iso: `${y}-${pad(m)}-${pad(d)}`, reason: null };
}

/**
 * checkAge(dobIso, visitIso, todayIso)
 *  -> { ok, ageMonths, ageYears, ageText, scope: 'nutrition' | 'dose-only' | 'out', flags: [string] }
 *  scope: 'nutrition' = 0-59 months (WHO 2006 tables installed), 'dose-only' = 5-18 years (nutrition tables not installed yet), 'out' = not usable
 */
export function checkAge(dobIso, visitIso, todayIso = null) {
  const out = { ok: false, ageMonths: null, ageYears: null, ageText: '', scope: 'out', flags: [] };
  if (!dobIso || !visitIso) { out.flags.push('Tanggal lahir dan TGL kunjungan dibutuhkan untuk menghitung umur.'); return out; }
  if (visitIso < dobIso) { out.flags.push('TGL kunjungan lebih awal dari tanggal lahir. Periksa kedua tanggal di foto.'); return out; }
  const months = ageInMonths(dobIso, visitIso);
  out.ageMonths = months; out.ageYears = Math.floor(months / 12);
  const yrs = Math.floor(months / 12); const rest = months % 12;
  out.ageText = yrs === 0 ? `${months} bulan` : rest === 0 ? `${yrs} tahun` : `${yrs} tahun ${rest} bulan`;
  if (todayIso && visitIso > todayIso) out.flags.push(`TGL kunjungan (${visitIso}) lebih akhir dari tanggal hari ini di HP ini. Periksa tahun dan bulan.`);
  if (months >= (MAX_AGE_YEARS + 1) * 12) { out.flags.push(`Umur ${out.ageText}: di luar rentang aplikasi (sampai ${MAX_AGE_YEARS} tahun). Periksa tanggal lahir.`); return out; }
  out.ok = true;
  out.scope = months <= 59 ? 'nutrition' : 'dose-only';
  if (out.scope === 'dose-only') out.flags.push(`Umur ${out.ageText}: status gizi untuk 5\u201318 tahun belum dipasang (tahap berikutnya). Pemeriksaan dosis tetap tersedia.`);
  return out;
}
