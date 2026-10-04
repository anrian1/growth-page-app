import { makeDate, checkAge } from '../src/recorddate.js';
import { tickState, readSex, voteReadings, TICK_ON, TICK_OFF } from '../src/readcell.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };

// ---- dates ----
check('a real date', makeDate(4, 10, 2026).iso === '2026-10-04');
check('Feb 30 does not exist', !makeDate(30, 2, 2026).ok && /tidak ada di kalender/.test(makeDate(30, 2, 2026).reason));
check('31 April does not exist', !makeDate(31, 4, 2026).ok);
check('29 Feb in a leap year is fine, in a normal year is not', makeDate(29, 2, 2024).ok && !makeDate(29, 2, 2025).ok);
check('month 13 is refused', !makeDate(5, 13, 2026).ok);
check('a missing part is refused', !makeDate(5, null, 2026).ok && !makeDate(null, 5, 2026).ok);
check('a silly year is refused', !makeDate(5, 5, 2062 + 100).ok && !makeDate(5, 5, 1802).ok);

// ---- age ----
let a = checkAge('2026-08-01', '2026-10-01');
check('2 months old: nutrition scope', a.ok && a.ageMonths === 2 && a.scope === 'nutrition' && a.ageText === '2 bulan', JSON.stringify(a));
a = checkAge('2021-10-05', '2026-10-04');
check('59 months (one day before the 5th birthday): still nutrition scope', a.ageMonths === 59 && a.scope === 'nutrition', JSON.stringify(a));
a = checkAge('2021-10-04', '2026-10-04');
check('60 months (the 5th birthday): dose-only, with the stage-2 note', a.ageMonths === 60 && a.scope === 'dose-only' && a.flags.some((f) => /5\u201318 tahun/.test(f)), JSON.stringify(a));
a = checkAge('2012-03-01', '2026-10-04');
check('14 years: dose-only, age text in years and months', a.scope === 'dose-only' && a.ageText === '14 tahun 7 bulan', JSON.stringify(a));
a = checkAge('2008-10-04', '2026-10-04');
check('exactly 18 years: still in range', a.ok && a.ageYears === 18, JSON.stringify(a));
a = checkAge('2007-10-03', '2026-10-04');
check('19 years: out of range', !a.ok && a.scope === 'out' && a.flags.some((f) => /di luar rentang/.test(f)), JSON.stringify(a));
a = checkAge('2026-10-05', '2026-10-04');
check('visit before birth is refused with a reason', !a.ok && /lebih awal dari tanggal lahir/.test(a.flags[0]));
a = checkAge('2026-10-04', '2026-10-04');
check('born the same day: 0 months', a.ok && a.ageMonths === 0 && a.ageText === '0 bulan');
a = checkAge('2025-01-01', '2062-10-04', '2026-10-05');
check('a visit date in the future (a misread year) is flagged', a.flags.some((f) => /lebih akhir dari tanggal hari ini/.test(f)));
a = checkAge('2025-01-01', '2026-10-04', '2026-10-04');
check('a visit today is not flagged as future', !a.flags.some((f) => /lebih akhir/.test(f)));
check('missing dates are refused', !checkAge(null, '2026-10-04').ok && !checkAge('2025-01-01', '').ok);

// ---- tick boxes ----
check('tick states at the thresholds', tickState(TICK_ON) === 'ticked' && tickState(TICK_OFF - 0.0001) === 'blank' && tickState((TICK_ON + TICK_OFF) / 2) === 'unclear' && tickState(null) === 'unclear' && tickState(NaN) === 'unclear');
let r = readSex(0.06, 0.0);
check('LK ticked only: boy, ok', r.sex === 'L' && r.status === 'ok');
r = readSex(0.001, 0.05);
check('PR ticked only: girl, ok', r.sex === 'P' && r.status === 'ok');
r = readSex(0.05, 0.05);
check('both ticked: no guess, unreadable, with the reason', r.sex === null && r.status === 'unreadable' && /kedua kotak/.test(r.why[0]));
r = readSex(0.0, 0.0);
check('neither ticked: no guess', r.sex === null && r.status === 'unreadable' && /tidak ada kotak/.test(r.why[0]));
r = readSex(0.05, 0.012);
check('one clear tick and one unclear box: boy but "check"', r.sex === 'L' && r.status === 'check');
r = readSex(0.012, 0.012);
check('both unclear: no guess', r.sex === null && r.status === 'unreadable');

// ---- integer-only fields (dates) ----
let v = voteReadings([{ source: 'a', text: '04' }, { source: 'b', text: '04' }, { source: 'c', text: '4' }, { source: 'd', text: '04' }], { range: [1, 31], integer: true });
check('a day written as 04 / 4 agrees', v.value === 4 && v.status === 'ok', JSON.stringify(v));
v = voteReadings([{ source: 'a', text: '3.5' }, { source: 'b', text: '3.5' }, { source: 'c', text: '3.5' }], { range: [1, 31], integer: true });
check('a decimal in a date box is rejected, never rounded', v.value === null && v.why.some((w) => /not a whole number/.test(w)));
v = voteReadings([{ source: 'a', text: '45' }, { source: 'b', text: '45' }, { source: 'c', text: '45' }, { source: 'd', text: '45' }], { range: [1, 31], integer: true });
check('a day of 45 is out of range', v.value === null);
v = voteReadings([{ source: 'a', text: '2026' }, { source: 'b', text: '2026' }, { source: 'c', text: '2O26' }, { source: 'd', text: '2026' }], { range: [2000, 2100], integer: true });
check('a year with a letter O read once still gets the majority, but is only "check" through the guess', v.value === 2026, JSON.stringify(v));
console.log(`Dates, age and ticks: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
