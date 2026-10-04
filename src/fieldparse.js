// Parsers for boxes that hold something other than a plain number: the 8-digit medical record number (MRN) and tablets per day (fractions).
// Each takes the OCR text of one reading and returns { value, substituted, note }: value is null when the text cannot be trusted.
import { normalise, toTablets } from './rxparse.js';

const DIGIT_LOOKALIKE = { o: '0', O: '0', Q: '0', D: '0', I: '1', l: '1', '|': '1', i: '1', Z: '2', z: '2', S: '5', s: '5', G: '6', b: '6', B: '8', g: '9', q: '9' };

/** "00-1234-56", "0O 1234 56", "00123456" -> "00123456". Exactly 8 digits or nothing. A letter read as a digit is allowed but marks the reading as a guess. */
export function parseMrn(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return { value: null, substituted: false, note: null };
  const kept = raw.replace(/[\s\-.\u00b7_]/g, '');
  let substituted = false; let out = '';
  for (const ch of kept) {
    if (/\d/.test(ch)) out += ch;
    else if (DIGIT_LOOKALIKE[ch]) { out += DIGIT_LOOKALIKE[ch]; substituted = true; }
    else return { value: null, substituted: false, note: `${raw}: contains a character that is not a digit` };
  }
  if (out.length !== 8) return { value: null, substituted: false, note: `${raw}: ${out.length} digits, 8 expected` };
  return { value: out, substituted, note: null };
}

/** "1/2", "1 1/2", "11/2", "1,5", "0,5", "1/z", "2", "\u00bd" -> "1/2" | "3/2" | ... (the tablet list of the dose card). Anything else: null. */
export function parseTabletsBox(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return { value: null, substituted: false, note: null };
  const s = normalise(raw).replace(/\s*\/\s*/g, '/').replace(/[^0-9/. ]/g, (c) => (c === 'x' || c === ' ' ? ' ' : '')).replace(/\s+/g, ' ').trim();
  const t = toTablets(s);
  if (t.value === null) return { value: null, substituted: false, note: `${raw}: not an amount on the tablet list` };
  const letters = /[a-wyzA-WYZ]/.test(raw.replace(/tab\w*/gi, ''));
  return { value: t.value, substituted: letters, note: null };
}

export const FIELD_PARSERS = { mrn: parseMrn, tablets: parseTabletsBox };
