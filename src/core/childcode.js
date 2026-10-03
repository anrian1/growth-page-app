// Child code: 5 digits plus 1 check digit (Luhn, the scheme used on bank cards).
// It catches every single-digit slip and nearly every swap of neighbours (not 09 <-> 90).
// A random 6-digit string still passes about 1 time in 10, so the person still confirms the code.
export function checkDigit(payload) {
  let total = 0;
  [...payload].reverse().forEach((ch, i) => {
    let d = Number(ch);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    total += d;
  });
  return (10 - (total % 10)) % 10;
}
export function isValidCode(code) {
  return /^\d{6}$/.test(code) && Number(code[5]) === checkDigit(code.slice(0, 5));
}
