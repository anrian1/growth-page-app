// Form v4 prescription rows: each row = a free-text drug NAME and three boxes (tablets per dose, times per day, days).
// The name only SUGGESTS which drug the row is (fixed list, a letter or two wrong tolerated); a person confirms it with a dropdown.
// tablets per day = tablets per dose x times per day.  Rows for other drugs (paracetamol...) are recognised and ignored. Nothing is guessed.
import { parseRx, toTablets, normalise, approxFind } from './rxparse.js';

export const ROW_NUMBERS = [1, 2, 3, 4, 5];
const OTHER_WORDS = [['paracetamol', 2], ['parasetamol', 2], ['amoksisilin', 2], ['amoxicillin', 2], ['amoxicilin', 2], ['ibuprofen', 2], ['kotrimoksazol', 3], ['cotrimoxazole', 3], ['oralit', 1], ['zinc', 0], ['vitamin', 1], ['antasida', 2], ['cetirizin', 2], ['sirup', 1]];

/** one reading of a name box -> { drug: 'dhp' | 'pq' | 'art' | null, other: bool (a known non-antimalarial), conflict, dispersible } */
export function matchDrug(text) {
  const p = parseRx(text);
  const found = [p.dhp ? 'dhp' : null, p.pq ? 'pq' : null, p.art ? 'art' : null].filter(Boolean);
  const compact = normalise(text).replace(/[^a-z0-9]/g, '');
  const other = found.length === 0 && compact.length >= 4 && OTHER_WORDS.some(([w, k]) => approxFind(compact, w, k));
  return { drug: found.length === 1 ? found[0] : null, other, conflict: found.length > 1, dispersible: !!p.dispersible };
}

/** several readings of the same name box -> one answer. A drug needs >= 2 agreeing readings and no tie. */
export function voteDrugName(readings) {
  const texts = readings.map((t) => String(t ?? ''));
  const parsed = texts.map(matchDrug);
  const n = texts.length;
  const counts = new Map();
  for (const m of parsed) { const l = m.drug || (m.other ? 'other' : null); if (l) counts.set(l, (counts.get(l) || 0) + 1); }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const anyText = texts.some((t) => t.trim() !== '');
  const out = { drug: null, status: anyText ? 'unclear' : 'empty', votes: 0, of: n, candidates: ranked.map((r) => r[0]), dispersible: parsed.filter((m) => m.dispersible).length >= 2, text: texts.find((t) => t.trim() !== '') || '' };
  if (ranked.length && ranked[0][1] >= 2 && (!ranked[1] || ranked[0][1] > ranked[1][1])) {
    out.drug = ranked[0][0]; out.votes = ranked[0][1]; out.status = ranked[0][1] >= Math.ceil(0.75 * n) ? 'ok' : 'check';
    out.text = texts[parsed.findIndex((m) => (m.drug || (m.other ? 'other' : null)) === out.drug)] || out.text;
  }
  return out;
}

/** '1/2' (tablets per dose) x 2 (times per day) -> { value: '1', number: 1 }; a result that is not on the tablet list is null with the reason. */
export function tabletsPerDay(amount, freq) {
  const a = toTablets(String(amount ?? ''));
  if (a.number === undefined || !Number.isInteger(freq) || freq < 1) return { value: null, number: null, why: 'jumlah per dosis atau kali per hari belum terbaca' };
  const n = Math.round(a.number * freq * 1000) / 1000;
  const t = toTablets(String(n));
  return t.value ? { value: t.value, number: n, why: null } : { value: null, number: n, why: `${n} tablet per hari tidak ada di daftar` };
}

/**
 * assembleRx(rows) rows: [{ n, drug: 'dhp'|'pq'|'art'|'other'|'', amount: '1/2'|null, freq: int|null, days: int|null, dispersible }]
 * -> { dhp, pq, art, formulation, notes, conflicts }   dhp/pq: null (no such row) | { conflict: true } | { tablets, days, times, perDose, rowNumber }
 */
export function assembleRx(rows) {
  const notes = []; const conflicts = [];
  const pick = (drug, label) => {
    const list = rows.filter((r) => r.drug === drug);
    if (list.length === 0) return null;
    if (list.length > 1) { conflicts.push(label); notes.push(`${label}: ada ${list.length} baris. Pilih satu baris saja (ubah yang lain menjadi "Obat lain").`); return { conflict: true }; }
    const r = list[0];
    let tablets = null;
    if (r.amount && r.freq) { const t = tabletsPerDay(r.amount, r.freq); tablets = t.value; if (t.why) notes.push(`${label}: ${t.why}.`); }
    else if (r.amount || r.freq) notes.push(`${label}: tablet per dosis dan kali per hari keduanya dibutuhkan; jumlah per hari tidak dihitung.`);
    return { conflict: false, tablets, days: r.days ?? null, times: r.freq ?? null, perDose: r.amount ?? null, rowNumber: r.n };
  };
  const dhp = pick('dhp', 'DHP'); const pq = pick('pq', 'Primakuin');
  const art = rows.some((r) => r.drug === 'art');
  const formulation = rows.some((r) => r.drug === 'dhp' && r.dispersible) ? 'dispersible' : null;
  return { dhp, pq, art, formulation, notes, conflicts };
}
