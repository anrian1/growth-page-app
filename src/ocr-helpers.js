// Small, testable helpers for reading numbers out of OCR text.
// Characters that handwriting often turns into look-alikes of digits (only used inside number fields).
export const LOOKALIKE = {
  S: '5', s: '5', $: '5', O: '0', o: '0', '\u03c6': '0', '\u00d8': '0', '\u00f8': '0',
  l: '1', I: '1', '|': '1', B: '8', Z: '2', z: '2', g: '9', q: '9', Q: '0', D: '0', '=': '.', ':': '.', ';': '.', '-': '.',
};

// Describe how a piece of OCR text was turned into a number, so the screen can warn when it was a guess.
// { value, substituted, hadSpace, raw }  (value is null when the text is not mostly digits)
export function analyseNumber(text) {
  const raw = String(text ?? '');
  const hadSpace = /\S\s+\S/.test(raw.trim());
  const t = raw.trim().replace(/\s+/g, '').replace(',', '.').replace('\u00b7', '.');
  if (t === '') return { value: null, substituted: false, hadSpace: false, raw };
  const digits = (t.match(/\d/g) || []).length;
  if (digits < Math.ceil(t.length / 2)) return { value: null, substituted: false, hadSpace, raw };   // mostly not a number
  let substituted = false;
  const fixed = [...t].map((c) => { if (LOOKALIKE[c] !== undefined) { substituted = true; return LOOKALIKE[c]; } return c; }).join('');
  const value = /^\d+(\.\d+)?$/.test(fixed) ? Number(fixed) : null;
  return { value, substituted, hadSpace, raw };
}

// "8,4" "8.4" "8·4" "5S.1" -> number, or null when the text is not mostly digits.
export function toNumber(text) { return analyseNumber(text).value; }

// For each expected value, was there a token that reads as that number? (position is not checked here)
export function matchTruth(tokens, expected, tolerance = 0.001) {
  const found = []; const missing = [];
  for (const value of expected) {
    const hit = tokens.find((t) => { const n = toNumber(t.text); return n !== null && Math.abs(n - value) <= tolerance; });
    (hit ? found : missing).push(value);
  }
  return { found, missing };
}

// "3.5 4.9, 5.5" -> [3.5, 4.9, 5.5]
export function parseExpected(text) {
  return String(text ?? '').split(/[\s;]+/).map((s) => toNumber(s)).filter((n) => n !== null);
}
