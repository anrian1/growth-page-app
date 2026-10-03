// Small, testable helpers for reading numbers out of OCR text.
// Letters that handwriting often turns into look-alikes of digits (only used inside number fields).
const LOOKALIKE = { S: '5', s: '5', O: '0', o: '0', l: '1', I: '1', '|': '1', B: '8', Z: '2', z: '2', g: '9', q: '9' };

// "8,4" "8.4" "8·4" "5S.1" -> number, or null when the text is not mostly digits.
export function toNumber(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, '').replace(',', '.').replace('\u00b7', '.');
  if (t === '') return null;
  const digits = (t.match(/\d/g) || []).length;
  if (digits < Math.ceil(t.length / 2)) return null;           // mostly not a number: leave it alone
  const fixed = [...t].map((c) => LOOKALIKE[c] ?? c).join('');
  return /^\d+(\.\d+)?$/.test(fixed) ? Number(fixed) : null;
}

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
