// The parsers for the tablets box (fractions) and the MRN box, including a "1" that looks like a slash.
import { parseTabletsBox, parseMrn } from '../src/fieldparse.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const tb = (t) => parseTabletsBox(t);
for (const t of ['1/2', '1/4', '1/3', '3/4', '1', '2', '3', '4', '5', '1 1/2', '0.5', '0,5', '0.25', '1.5', '1,5', '1 /2', '1/ 2']) check(`"${t}" is read and is not a guess`, tb(t).value !== null && tb(t).substituted === false, JSON.stringify(tb(t)));
check('1 1/2 written without the space (11/2) is read, as a guess', tb('11/2').value === '3/2' && tb('11/2').substituted === true);
check('readings', tb('1/2').value === '1/2' && tb('0.5').value === '1/2' && tb('0,25').value === '1/4' && tb('1,5').value === '3/2' && tb('1 1/2').value === '3/2');
for (const [t, want] of [['/', '1'], ['|', '1'], ['/2', '1/2'], ['//2', '1/2'], ['|/2', '1/2'], ['1//2', '1/2'], ['\\/2', '1/2'], ['/4', '1/4'], ['/3', '1/3'], ['1/z', '1/2'], ['l/2', '1/2']]) check(`slash-like "${t}" -> ${want}, flagged as a guess`, tb(t).value === want && tb(t).substituted === true, JSON.stringify(tb(t)));
for (const t of ['7/2', '/5', '/9', '12', '6', '0', '2/2/2', 'abc', '3/']) check(`"${t}" is NOT accepted (blank, a person decides)`, tb(t).value === null, JSON.stringify(tb(t)));
check('an empty box gives nothing', tb('').value === null && tb('  ').value === null && tb('').note === null);
// MRN
check('MRN: plain, grouped, spaced', parseMrn('00123456').value === '00123456' && parseMrn('00-1234-56').value === '00123456' && parseMrn('00 1234 56').value === '00123456');
check('MRN: a letter read for a digit is allowed, but only as a guess', parseMrn('O0123456').value === '00123456' && parseMrn('O0123456').substituted === true);
check('MRN: 7 or 9 digits, or other characters, give nothing', parseMrn('0012345').value === null && parseMrn('001234567').value === null && parseMrn('00X23456').value === null && parseMrn('').value === null);
console.log(`Field parsers: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
