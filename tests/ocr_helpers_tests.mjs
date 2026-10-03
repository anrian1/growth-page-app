import { toNumber, matchTruth, parseExpected } from '../src/ocr-helpers.js';
let failures = 0; let pass = 0;
const eq = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass += 1; else { failures += 1; console.log(`FAIL  ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); } };

eq('comma', toNumber('8,4'), 8.4); eq('dot', toNumber('8.4'), 8.4); eq('raised dot', toNumber('8\u00b74'), 8.4);
eq('S read as 5', toNumber('5S.1'), 55.1); eq('O read as 0', toNumber('51.O'), 51.0); eq('l read as 1', toNumber('l2'), 12);
eq('spaces', toNumber(' 7 3 , 0 '), 73.0); eq('word is not a number', toNumber('Bulan'), null); eq('single letter', toNumber('S'), null);
eq('range text', toNumber('7,7 - 10,8'), null); eq('empty', toNumber(''), null); eq('null', toNumber(null), null);
eq('KNOWN RISK: a short token like B1 becomes 81 (the person confirms every value)', toNumber('B1'), 81);
eq('parseExpected', parseExpected('3.5 4,9; 55.1 abc'), [3.5, 4.9, 55.1]);
const tokens = [{ text: '3.5' }, { text: '4.9' }, { text: '5S.1' }, { text: 'Aktual' }, { text: '57.5' }];
eq('matchTruth', matchTruth(tokens, [3.5, 4.9, 55.1, 5.5, 57.5]), { found: [3.5, 4.9, 55.1, 57.5], missing: [5.5] });

console.log(`OCR helpers: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
