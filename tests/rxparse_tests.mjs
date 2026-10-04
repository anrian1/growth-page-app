// The prescription reader on typed text (what the OCR would hand it), including the shorthand the user listed and typical OCR damage.
import { parseRx, parseDrugText, voteRx, normalise, approxFind } from '../src/rxparse.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dhp = (t) => parseRx(`dhp ${t}`).dhp;

// ---- amounts and shorthand (tablets per day = times x amount) ----
const cases = [
  ['1x1', '1x1 selama 3 hari', '1', 3], ['1x2', '1x2 selama 3 hari', '2', 3], ['1x3 (adult DHP band)', '1x3 3 hari', '3', 3], ['1x4', '1x4 selama 3 hari', '4', 3], ['1x5', '1x5 selama 3 hari', '5', 3],
  ['1x1/2 as one amount', '1x1/2 selama 3 hari', '1/2', 3], ['1x1 1/2', '1x1 1/2 selama 3 hari', '3/2', 3], ['1x1,5 with a decimal comma', '1x1,5 selama 3 hari', '3/2', 3],
  ['half a tablet then 1x1', '\u00bd tab 1x1 selama 3 hari', '1/2', 3], ['1/2 tab 1x1', '1/2 tab 1x1 selama 3 hari', '1/2', 3], ['1/3 tab 1x1', '1/3 tab 1x1 selama 3 hari', '1/3', 3],
  ['two tablets, 1x1', '2 tab 1x1 selama 3 hari', '2', 3], ['3 tablets 1x1', '3 tab 1x1 3 hari', '3', 3],
  ['2 tablet sehari selama 3 hari', '2 tablet sehari selama 3 hari', '2', 3], ['1,5 tablet sehari', '1,5 tablet sehari selama 3 hari', '3/2', 3], ['setengah tablet sehari', 'setengah tablet sehari selama 3 hari', '1/2', 3],
  ['1 dd 1', '1 dd 1 selama 3 hari', '1', 3], ['multiplication sign', '1 \u00d7 3 selama 3 hari', '3', 3], ['glued with no spaces', '1x3selama3hari', '3', 3],
  ['"x 3 hari"', '1x2 x 3 hari', '2', 3], ['tab word with a typo', '1/2 tabl 1x1 3 hari', '1/2', 3],
];
for (const [name, text, tablets, days] of cases) { const r = dhp(text); check(`DHP ${name}`, r && r.tablets === tablets && r.days === days, `${text} -> ${JSON.stringify(r && { t: r.tablets, d: r.days, f: r.flags })}`); }
check('1x3 and 3x1 give the same tablets per day; only 3x1 raises the frequency note', dhp('1x3 3 hari').tablets === '3' && dhp('3x1 3 hari').tablets === '3' && dhp('1x3 3 hari').times === 1 && dhp('3x1 3 hari').times === 3);
check('3x sehari with no amount leaves the amount blank and says why', dhp('3x sehari selama 3 hari').tablets === null && dhp('3x sehari selama 3 hari').times === 3);
check('an amount with no frequency is NOT guessed (blank, with the reason)', dhp('1/2 tab selama 3 hari').tablets === null && dhp('1/2 tab selama 3 hari').flags.some((f) => /frekuensi/.test(f)));
check('an amount that is not on the tablet list is blank (1/2 tab x 3 = 1.5 is fine, 1x6 is not)', dhp('1x6 selama 3 hari').tablets === null && dhp('1x6 selama 3 hari').flags.some((f) => /tidak ada di daftar/.test(f)));
check('two different numbers of days: blank, flagged', dhp('1x1 selama 3 hari lalu 5 hari').days === null);
check('14 days', dhp('1x1 selama 14 hari').days === 14);
check('no days written: blank', dhp('1x1').days === null);
check('days over 30 are ignored', dhp('1x1 selama 99 hari').days === null);

// ---- malaria type: the words the user listed, plus the pocketbook spellings ----
const sp = (t) => parseRx(t).species;
for (const [t, want] of [['malaria falciparum', 'falciparum'], ['Malaria falsiparum', 'falciparum'], ['malaria tropika', 'falciparum'], ['malaria tropicana', 'falciparum'], ['P.f', 'falciparum'], ['PF (+)', 'falciparum'],
  ['malaria vivax', 'vivax'], ['malaria vivaks', 'vivax'], ['malaria tertiana', 'vivax'], ['malaria tersiana', 'vivax'], ['P.v', 'vivax'], ['malaria ovale', 'ovale'],
  ['malaria mix', 'mixed'], ['malaria campuran', 'mixed'], ['malaria falciparum + vivax', 'mixed'], ['Pf dan Pv', 'mixed'], ['malaria malariae', 'malariae'], ['malaria kuartana', 'malariae'], ['malaria knowlesi', 'knowlesi']]) check(`type: "${t}"`, sp(t) === want, `${sp(t)}`);
check('"malaria" alone is NOT read as malariae (a classic fuzzy-matching trap)', sp('malaria') === null && sp('malaria klinis') === null);
check('OCR damage: "malaria falclparum", "Falsiparun", "vlvax"', sp('malaria falclparum') === 'falciparum' && sp('Falsiparun') === 'falciparum' && sp('malaria vlvax') === 'vivax');
check('an unrelated diagnosis gives no type', sp('ISPA, demam tifoid') === null && sp('') === null);
check('falciparum + malariae in one reading is a conflict, not a guess', parseRx('malaria falciparum dan malariae').species === null && parseRx('malaria falciparum dan malariae').speciesConflict);

// ---- drugs, both names, damage, line breaks ----
let r = parseRx('Dihidroartemisinin Piperakuin 1x2 selama 3 hari, Primakuin 1/4 tab 1x1 selama 1 hari');
check('full DHP name and primaquine are both found with their own amounts', r.dhp.tablets === '2' && r.dhp.days === 3 && r.pq.tablets === '1/4' && r.pq.days === 1, JSON.stringify([r.dhp, r.pq]));
r = parseRx('DHP \u00bd tab 1x1 selama 3 hari; Primakuin \u00bc tab 1x1 selama 14 hari');
check('shorthand with fraction glyphs', r.dhp.tablets === '1/2' && r.pq.tablets === '1/4' && r.pq.days === 14);
r = parseRx('Primakuin 1x1 selama 14 hari  DHP 1x3 selama 3 hari');
check('drug order does not matter', r.pq.tablets === '1' && r.pq.days === 14 && r.dhp.tablets === '3');
r = parseRx('DHP 1/2 tab\n1x1 selama\n3 hari\nPrima kuin 1/4 tab\n1x1 selama 1\nhari');
check('lines broken in the middle of words, numbers and phrases still parse', r.dhp.tablets === '1/2' && r.dhp.days === 3 && r.pq.tablets === '1/4' && r.pq.days === 1, JSON.stringify([r.dhp, r.pq]));
r = parseRx('Primakuim 1/4 tab 1x1 1 hari DHP 1/2 tab 1x1 3 hari');
check('"Primakuim" (one wrong letter) counts as primakuin', r.pq && r.pq.tablets === '1/4');
r = parseRx('pq 1/4 tab 1x1 1 hari');
check('"pq" alone counts as primakuin', r.pq && r.pq.tablets === '1/4');
r = parseRx('Paracetamol 3x1 tab prn');
check('other drugs are ignored', r.dhp === null && r.pq === null && r.art === null);
r = parseRx('DHP 3x1 selama 3 hari');
check('DHP written three times a day: tablets per day is 3, and the frequency is kept for the warning', r.dhp.tablets === '3' && r.dhp.times === 3);
r = parseRx('DHP dispersibel 1 1/2 tab 1x1 selama 3 hari');
check('dispersible is detected', r.dispersible && r.dhp.tablets === '3/2', JSON.stringify(r.dhp));
check('without the word the form is standard', parseRx('DHP 1x1 3 hari').dispersible === false);

// ---- artesunate and severe ----
r = parseRx('Artesunat IV dosis awal 47,4 mg (berat 15,8 kg); rujuk');
check('artesunate mg is the number in front of mg, not the body weight', r.art.mg === 47.4 && r.severe, JSON.stringify(r.art));
r = parseRx('Artesunat 36 mg iv, lalu 36 mg');
check('the same mg twice is fine', r.art.mg === 36);
r = parseRx('Artesunat 36 mg lalu 24 mg');
check('two different mg: blank, flagged', r.art.mg === null && r.art.flags.length === 1);
check('"Malaria berat" is severe; "BB berat 12 kg" is a weight, not severe', parseRx('Malaria berat').severe && !parseRx('BB berat 12 kg').severe);
check('serebral or komplikasi is severe', parseRx('malaria serebral').severe && parseRx('malaria dengan komplikasi').severe);

// ---- test result ----
check('RDT negatif', parseRx('Malaria falsiparum (RDT negatif)').testResult === 'negative');
check('RDT (-) and (+)', parseRx('RDT (-)').testResult === 'negative' && parseRx('RDT (+)').testResult === 'positive');
check('positif with a wrong letter', parseRx('SD malaria positlf').testResult === 'positive');
check('both words together: blank, never guessed', parseRx('RDT positif ulang negatif').testResult === null);
check('nothing written: blank', parseRx('malaria falsiparum').testResult === null);

// ---- voting across readings ----
const plan = 'DHP 1/2 tab 1x1 selama 3 hari; Primakuin 1/4 tab 1x1 selama 1 hari';
let v = voteRx({ assess: ['Malaria falsiparum', 'Malaria falsiparum', 'Malaria falsiparum'], plan: [plan, plan, plan] });
check('three agreeing readings give "ok" for everything', v.fields.species.status === 'ok' && v.fields.dhpTablets.status === 'ok' && v.fields.pqDays.status === 'ok' && v.fields.species.value === 'falciparum' && v.fields.dhpTablets.value === '1/2');
v = voteRx({ assess: ['Malaria falsiparum', 'Malaria falclparum', 'Malaria'], plan: [plan, plan, 'DHP 1/2 tab 1x1 3 hari'] });
check('two of three agreeing is "check" and still filled', v.fields.species.status === 'check' && v.fields.species.value === 'falciparum' && v.fields.pqTablets.value === '1/4' && v.fields.pqTablets.status === 'check', JSON.stringify(v.fields.pqTablets));
v = voteRx({ assess: ['Malaria falsiparum', 'Malaria vivax', 'Malaria'], plan: [plan, 'DHP 1/2 tab 1x1 selama 3 hari', 'DHP 1 tab 1x1 selama 3 hari'] });
check('a split vote is blank ("unclear"), with both candidates listed', v.fields.species.value === null && v.fields.species.status === 'unclear' && v.fields.species.candidates.length === 2, JSON.stringify(v.fields.species));
check('one reading alone never fills a field', v.fields.dhpTablets.value === '1/2' && v.fields.dhpTablets.votes === 2);
v = voteRx({ assess: ['Malaria falsiparum', '', ''], plan: ['', '', ''] });
check('a single reading out of three is not accepted', v.fields.species.value === null && v.fields.species.status === 'unclear' && v.fields.dhpTablets.status === 'none');
v = voteRx({ assess: ['', '', ''], plan: ['', '', ''] });
check('nothing readable: every field is "none"', Object.values(v.fields).every((f) => f.value === null && f.status === 'none'));
v = voteRx({ assess: ['Malaria falsiparum', 'Malaria falsiparum', 'Malaria falsiparum'], plan: ['DHP 3x1 3 hari', 'DHP 3x1 3 hari', 'DHP 3x1 3 hari'] });
check('DHP three times a day adds the frequency note', v.notes.some((n) => /DHP ditulis 3x sehari/.test(n)));
v = voteRx({ assess: ['Malaria berat', 'Malaria berat', 'Malaria berat'], plan: ['Artesunat IV 36 mg', 'Artesunat IV 36 mg', 'Artesunat IV 36 mg'] });
check('severe malaria: treatment severe and the mg filled', v.fields.treatment.value === 'severe' && v.fields.artesunateMg.value === 36);
v = voteRx({ assess: [], plan: ['DHP 1x1 3 hari', 'DHP 1x1 3 hari', 'DHP 1x1 3 hari'] });
check('everything written in the Planning area alone still works', v.fields.dhpTablets.value === '1' && v.fields.dhpTablets.status === 'ok');
check('evidence text is kept for display', v.fields.dhpTablets.evidence.includes('DHP'));

// ---- helpers ----
check('approximate search: exact, one wrong letter, none', approxFind('xxprimakuinxx', 'primakuin', 0).dist === 0 && approxFind('xxprimakuimxx', 'primakuin', 1).dist === 1 && approxFind('xxparacetamol', 'primakuin', 2) === null);
check('normalise: glyphs, decimal comma, multiplication sign', normalise('\u00bd tab 1\u00d71, 0,5') === '1/2 tab 1x1 0.5', normalise('\u00bd tab 1\u00d71, 0,5'));
check('a comma between items is a list, not a decimal: "1x1, 3 hari" is 1 tablet for 3 days', dhp('1x1, 3 hari').tablets === '1' && dhp('1x1, 3 hari').days === 3 && dhp('1x1, 3 hari').flags.length === 0);
console.log(`Prescription reader: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
