// Tests the malaria dose check on the REAL pack built from the Buku Saku (public/guidelines/malaria-dose.json).
// The expected amounts below were typed by hand from the tables in docs/source/Malaria_clean.md (Tabel 1-4), not read back from the pack.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateMalariaPack, expectedRegimen, checkRegimen, findBand, fmtFraction, loadMalariaPack, parseTablets } from '../src/malaria.js';

const raw = JSON.parse(readFileSync(join(process.cwd(), 'public/guidelines/malaria-dose.json'), 'utf8'));
const v = validateMalariaPack(raw);
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
check('the shipped pack is valid', v.ok, JSON.stringify(v.errors));
check('the shipped pack is a DRAFT until a reviewer is named', v.pack.draft === true);
const pack = v.pack;

// ---- the tables, against hand-typed amounts (numerator/denominator) ----
const DHP = [[1, 3], [1, 2], [1, 2], [1, 1], [3, 2], [2, 1], [3, 1], [4, 1], [5, 1]];
const PQ = [null, null, [1, 4], [1, 4], [1, 2], [3, 4], [1, 1], [1, 1], [1, 1]];
const LABELS = ['≤5 kg', '>5-6 kg', '>6-10 kg', '>10-17 kg', '>17-30 kg', '>30-40 kg', '>40-60 kg', '>60-80 kg', '>80 kg'];
check('9 standard bands in the right order', pack.tables.standard.bands.map((b) => b.label).join('|') === LABELS.join('|'));
check('DHP amounts per band match Tabel 1', JSON.stringify(pack.tables.standard.bands.map((b) => b.dhp)) === JSON.stringify(DHP));
check('primaquine amounts per band match Tabel 1', JSON.stringify(pack.tables.standard.bands.map((b) => b.primaquine)) === JSON.stringify(PQ));
check('dispersible amounts match Tabel 4', JSON.stringify(pack.tables.dispersible.bands.map((b) => b.tablets)) === JSON.stringify([[1, 1], [3, 2], [2, 1], [3, 1], [4, 1]]));

// ---- band boundaries: the printed tables are "≤5", ">5-6", ">6-10" ... and "5 - <8", "8 - <11" ----
const std = (w) => { const b = findBand(pack.tables.standard.bands, w); return b && b.label; };
const disp = (w) => { const b = findBand(pack.tables.dispersible.bands, w); return b && b.label; };
check('5.0 kg is in ≤5 kg, 5.1 is in >5-6 kg', std(5.0) === '≤5 kg' && std(5.1) === '>5-6 kg');
check('6.0 kg is in >5-6 kg, 6.1 is in >6-10 kg', std(6.0) === '>5-6 kg' && std(6.1) === '>6-10 kg');
check('10.0 stays in >6-10, 10.1 moves to >10-17', std(10.0) === '>6-10 kg' && std(10.1) === '>10-17 kg');
check('17.0 stays in >10-17, 17.1 moves to >17-30', std(17.0) === '>10-17 kg' && std(17.1) === '>17-30 kg');
check('80.0 stays in >60-80, 80.1 is >80', std(80.0) === '>60-80 kg' && std(80.1) === '>80 kg');
check('very small and very large weights still land in a band', std(2.0) === '≤5 kg' && std(150) === '>80 kg');
check('dispersible: 5.0 is the first band, 4.9 is outside', disp(5.0) === '5 - <8 kg' && disp(4.9) === null);
check('dispersible: 8.0 starts the second band, 7.9 is the first', disp(8.0) === '8 - <11 kg' && disp(7.9) === '5 - <8 kg');
check('dispersible: 36.0 is outside (table ends below 36)', disp(35.9) === '25 - <36 kg' && disp(36.0) === null);

// ---- every band x every species: the guideline amounts must always be reported as a match ----
let sweepOk = true; let sweepDetail = '';
for (const weight of [4.5, 5.0, 5.5, 6.0, 8.0, 10.0, 12.0, 17.0, 20.0, 30.0, 40.0, 55.0, 70.0, 90.0]) {
  for (const species of Object.keys(pack.species)) {
    for (const formulation of ['standard', 'dispersible']) {
      const age = weight < 6 ? 3 : 30;   // an infant under 6 months for tiny weights
      const e = expectedRegimen(pack, { weightKg: weight, ageMonths: age, species, formulation });
      if (!e.ok) { if (formulation === 'dispersible' && (weight < 5 || weight >= 36)) continue; sweepOk = false; sweepDetail = `no regimen for ${weight} ${species} ${formulation}: ${e.reason}`; continue; }
      const pqTab = e.pq.applies && e.pq.tablets ? `${e.pq.tablets[0]}/${e.pq.tablets[1]}` : '0';
      const toValue = (f) => (f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);
      const input = { weightKg: weight, ageMonths: age, species, formulation, testResult: 'positive', treatment: 'uncomplicated', dhpTablets: toValue(e.dhp.tablets), dhpDays: e.dhp.days, pqTablets: pqTab, pqDays: e.pq.applies && e.pq.tablets ? e.pq.days : undefined };
      if (!parseTablets(input.dhpTablets)) { sweepOk = false; sweepDetail = `no menu value for ${input.dhpTablets}`; continue; }
      const r = checkRegimen(pack, input);
      const bad = r.findings.filter((f) => f.level === 'check');
      if (bad.length || r.status === 'differs') { sweepOk = false; sweepDetail = `${weight}kg ${species} ${formulation}: ${JSON.stringify(bad.map((b) => b.id))} status=${r.status}`; }
    }
  }
}
check('prescribing exactly what the table says is never flagged, for every weight band, species and formulation', sweepOk, sweepDetail);

// ---- wrong amounts are flagged, with the table row and a citation ----
const base = { weightKg: 8, ageMonths: 9, species: 'falciparum', formulation: 'standard', testResult: 'positive', treatment: 'uncomplicated', dhpTablets: '1/2', dhpDays: 3, pqTablets: '1/4', pqDays: 1, bbpbCategory: 'Gizi baik' };
let r = checkRegimen(pack, base);
check('a child of 8 kg given 1/2 DHP and 1/4 primaquine for 1 day (P. falciparum) matches', r.status === 'match' && !r.findings.some((f) => f.level === 'check'), JSON.stringify(r.findings.map((f) => f.id)));
r = checkRegimen(pack, { ...base, dhpTablets: '1' });
check('double DHP is flagged with the table amount, the column and the citation', r.status === 'differs' && r.findings.some((f) => f.id === 'dhp-differs' && f.text.includes('½ tablet per hari') && f.text.includes('>6-10 kg') && f.cite.page === '11' && f.cite.quote.includes('| 1-3 | DHP |')), JSON.stringify(r.findings.find((f) => f.id === 'dhp-differs')));
r = checkRegimen(pack, { ...base, dhpTablets: '1/4' });
check('half the DHP is flagged too', r.status === 'differs' && r.findings.some((f) => f.id === 'dhp-differs'));
r = checkRegimen(pack, { ...base, dhpDays: 5 });
check('DHP for 5 days is flagged', r.findings.some((f) => f.id === 'dhp-days' && f.cite.section === 'Standar Pengobatan 4'));
r = checkRegimen(pack, { ...base, pqTablets: '1/2' });
check('wrong primaquine amount is flagged against the right table', r.findings.some((f) => f.id === 'pq-differs' && f.cite.section === 'Tabel 1'));
r = checkRegimen(pack, { ...base, species: 'vivax', pqDays: 1 });
check('P. vivax with 1 day of primaquine is flagged (14 days expected) and cites Tabel 2 context', r.findings.some((f) => f.id === 'pq-days' && f.text.includes('14 hari')));
r = checkRegimen(pack, { ...base, species: 'vivax', pqDays: 14 });
check('P. vivax with 14 days matches', r.status === 'match');
r = checkRegimen(pack, { ...base, species: 'falciparum', pqDays: 14 });
check('P. falciparum with 14 days of primaquine is flagged (1 day expected)', r.findings.some((f) => f.id === 'pq-days' && f.text.includes('1 hari')));
r = checkRegimen(pack, { ...base, species: 'malariae', pqTablets: '1/4', pqDays: 1 });
check('primaquine for P. malariae is flagged', r.findings.some((f) => f.id === 'pq-species'));
r = checkRegimen(pack, { ...base, species: 'knowlesi', pqTablets: '1/4', pqDays: 1 });
check('primaquine for P. knowlesi is flagged', r.findings.some((f) => f.id === 'pq-species'));
r = checkRegimen(pack, { ...base, species: 'malariae', pqTablets: '0' });
check('P. malariae with no primaquine and the right DHP matches', r.status === 'match');

// ---- infants under 6 months ----
r = checkRegimen(pack, { ...base, weightKg: 4.5, ageMonths: 2, dhpTablets: '1/3', pqTablets: '1/4', pqDays: 1 });
check('primaquine for a 2-month-old is flagged and cites Standar Pengobatan 3', r.findings.some((f) => f.id === 'pq-infant' && f.cite.section === 'Standar Pengobatan 3'));
r = checkRegimen(pack, { ...base, weightKg: 4.5, ageMonths: 2, dhpTablets: '1/3', pqTablets: '0' });
check('a 2-month-old with the right DHP and no primaquine matches', r.status === 'match', JSON.stringify(r.findings.map((f) => f.id)));
r = checkRegimen(pack, { ...base, weightKg: 5.8, ageMonths: 7, dhpTablets: '1/2', pqTablets: '1/4', pqDays: 1 });
check('a 7-month-old of 5.8 kg: the table has no primaquine for this weight, so any primaquine is flagged', r.findings.some((f) => f.id === 'pq-no-dose'), JSON.stringify(r.findings.map((f) => f.id)));

// ---- pregnancy, breastfeeding, G6PD (asked for girls from about 10 years, and G6PD for anyone) ----
r = checkRegimen(pack, { ...base, weightKg: 45, ageMonths: 190, dhpTablets: '3', pqTablets: '1', pqDays: 1, pregnancy: 'pregnant' });
check('primaquine for a pregnant patient is flagged (Standar Pengobatan 3)', r.findings.some((f) => f.id === 'pq-pregnant' && f.cite.section === 'Standar Pengobatan 3') && r.status === 'differs', JSON.stringify(r.findings.map((f) => f.id)));
r = checkRegimen(pack, { ...base, weightKg: 45, ageMonths: 190, dhpTablets: '3', pqTablets: '1', pqDays: 1, pregnancy: 'breastfeeding' });
check('primaquine while breastfeeding an infant under 6 months is flagged', r.findings.some((f) => f.id === 'pq-breastfeeding'));
r = checkRegimen(pack, { ...base, weightKg: 45, ageMonths: 190, dhpTablets: '3', pqTablets: '0', pregnancy: 'pregnant' });
check('pregnant with DHP only and no primaquine raises no primaquine finding', !r.findings.some((f) => f.id === 'pq-pregnant'));
r = checkRegimen(pack, { ...base, weightKg: 45, ageMonths: 190, dhpTablets: '3', pqTablets: '1', pqDays: 1, pregnancy: 'none' });
check('not pregnant: no pregnancy finding', !r.findings.some((f) => f.id === 'pq-pregnant' || f.id === 'pq-breastfeeding'));
r = checkRegimen(pack, { ...base, g6pd: 'deficient' });
check('G6PD deficiency with standard primaquine is flagged, and the special dose is quoted but not calculated', r.findings.some((f) => f.id === 'pq-g6pd' && f.level === 'check') && r.findings.some((f) => f.id === 'g6pd-special-dose' && f.cite.section === 'Catatan e' && f.cite.quote.includes('0,75mg/kgBB/minggu')));
r = checkRegimen(pack, { ...base, g6pd: 'deficient', pqTablets: '0' });
check('G6PD deficiency without primaquine is not flagged as a mismatch', !r.findings.some((f) => f.id === 'pq-g6pd'));
r = checkRegimen(pack, { ...base, g6pd: 'unknown' });
check('unknown G6PD adds nothing', !r.findings.some((f) => f.id.includes('g6pd')));

// ---- DHP is once a day (form v4 has a "times per day" box) ----
r = checkRegimen(pack, { ...base, dhpTimes: 2 });
check('DHP written twice a day is flagged and cites Standar Pengobatan 4', r.findings.some((f) => f.id === 'dhp-frequency' && f.level === 'check' && f.cite.section === 'Standar Pengobatan 4' && f.cite.quote.includes('H1 pada dosis kedua')) && r.status === 'differs', JSON.stringify(r.findings.map((f) => f.id)));
r = checkRegimen(pack, { ...base, dhpTimes: 1 });
check('DHP once a day: no frequency finding', !r.findings.some((f) => f.id === 'dhp-frequency') && r.status === 'match');
r = checkRegimen(pack, { ...base });
check('times per day not given: no frequency finding', !r.findings.some((f) => f.id === 'dhp-frequency'));
check('the once-daily statement is required for a pack to load', !validateMalariaPack((() => { const x = JSON.parse(JSON.stringify(raw)); delete x.statements.dhpOnceDaily; return x; })()).ok);

// ---- dispersible ----
r = checkRegimen(pack, { ...base, weightKg: 9, ageMonths: 10, formulation: 'dispersible', dhpTablets: '3/2' });
check('dispersible at 9 kg: 1½ tablets matches Tabel 4', r.status === 'match', JSON.stringify(r.findings.filter((f) => f.level === 'check')));
r = checkRegimen(pack, { ...base, weightKg: 9, ageMonths: 10, formulation: 'dispersible', dhpTablets: '1/2' });
check('standard-tablet amount entered as dispersible is flagged with the Tabel 4 amount', r.findings.some((f) => f.id === 'dhp-differs' && f.text.includes('1½') && f.cite.section === 'Tabel 4'));
r = checkRegimen(pack, { ...base, weightKg: 4.5, ageMonths: 2, formulation: 'dispersible', dhpTablets: '1' });
check('dispersible below 5 kg cannot be looked up: "cannot check", never guessed', r.status === 'cannot_check' && r.findings.some((f) => f.id === 'cannot-look-up'), JSON.stringify(r));

// ---- severe: artesunate ----
const sev = { ...base, treatment: 'severe', weightKg: 12, ageMonths: 20 };
r = checkRegimen(pack, { ...sev, artesunateMg: 36 });
check('12 kg: 3 mg/kg = 36 mg matches', r.status === 'match' && r.expected.artesunate.mg === 36, JSON.stringify(r));
r = checkRegimen(pack, { ...sev, artesunateMg: 28.8 });
check('12 kg: 28.8 mg (the 2.4 mg/kg figure used by mistake) is flagged with both numbers', r.status === 'differs' && r.findings.some((f) => f.id === 'artesunate-differs' && f.text.includes('36') && f.text.includes('28,8')), JSON.stringify(r.findings));
r = checkRegimen(pack, { ...sev, artesunateMg: 36.4 });
check('a difference within 0.5 mg (rounding) counts as the same', r.status === 'match');
r = checkRegimen(pack, { ...sev, weightKg: 20, artesunateMg: 60 });
check('exactly 20 kg: the guideline does not say, so the tool says it is not sure', r.status === 'cannot_check' && r.findings.some((f) => f.id === 'artesunate-boundary'), JSON.stringify(r.findings));
r = checkRegimen(pack, { ...sev, weightKg: 19.9, artesunateMg: 59.7 });
check('19.9 kg uses 3 mg/kg', r.status === 'match' && r.expected.artesunate.mgPerKg === 3);
r = checkRegimen(pack, { ...sev, weightKg: 20.1, artesunateMg: 48.2 });
check('20.1 kg uses 2.4 mg/kg', r.status === 'match' && r.expected.artesunate.mgPerKg === 2.4, JSON.stringify(r));
r = checkRegimen(pack, { ...sev });
check('severe with no dose entered: shows the guideline dose, compares nothing', r.status === 'nothing_to_compare' && r.expected.artesunate.mg === 36);

// ---- test result, uncertain weight, missing inputs, notes ----
r = checkRegimen(pack, { ...base, testResult: 'negative' });
check('a negative test with an ACT recorded is flagged and cites Standar Pengobatan 2', r.findings.some((f) => f.id === 'test-negative' && f.level === 'check' && f.cite.section === 'Standar Pengobatan 2') && r.status === 'differs');
r = checkRegimen(pack, { ...base, testResult: 'none' });
check('no test result recorded is a note, not a mismatch', r.findings.some((f) => f.id === 'test-missing' && f.level === 'info') && r.status === 'match');
r = checkRegimen(pack, { ...base, weightUncertain: true });
check('an uncertain weight stops the check', r.status === 'cannot_check' && r.findings[0].id === 'weight-uncertain');
r = checkRegimen(pack, { ...base, weightKg: null });
check('no weight stops the check', r.status === 'cannot_check');
r = checkRegimen(pack, { ...base, species: '' });
check('no species stops the check with a reason', r.status === 'cannot_check' && r.findings.some((f) => /plasmodium/.test(f.text)));
r = checkRegimen(pack, { ...base, dhpTablets: '', pqTablets: '' });
check('nothing entered: shows the guideline amounts and compares nothing', r.status === 'nothing_to_compare' && r.findings.some((f) => f.id === 'dhp-missing' && f.text.includes('½')));
r = checkRegimen(pack, { ...base, dhpTablets: '', pqTablets: '', dhpDays: 3 });
check('days alone matching is not reported as a verified dose', r.status === 'nothing_to_compare');
r = checkRegimen(pack, { ...base, dhpTablets: '', pqTablets: '', dhpDays: 5 });
check('wrong days with no amounts is still flagged', r.status === 'differs' && r.findings.some((f) => f.id === 'dhp-days'));
r = checkRegimen(pack, { ...base, pqTablets: '0' });
check('primaquine left out is a note (it can be deliberate, e.g. G6PD), not a mismatch', r.findings.some((f) => f.id === 'pq-not-recorded' && f.level === 'info') && !r.findings.some((f) => f.id === 'pq-differs'));
r = checkRegimen(pack, { ...base, weightKg: 8, ageMonths: 30 });
check('age and weight that do not fit the table column give the "use weight" note', r.findings.some((f) => f.id === 'weight-over-age' && f.cite.section === 'Catatan b'));
r = checkRegimen(pack, { ...base, bbpbCategory: 'Obesitas' });
check('obesity gives the ideal-weight note and cites Catatan c', r.findings.some((f) => f.id === 'obesity' && f.cite.section === 'Catatan c'));
r = checkRegimen(pack, base);
check('the empty-stomach note is always there', r.findings.some((f) => f.id === 'empty-stomach'));
check('every finding that makes a claim carries a citation with a quote', checkRegimen(pack, { ...base, dhpTablets: '1', testResult: 'negative', pqTablets: '1/2', pqDays: 7, bbpbCategory: 'Obesitas' }).findings.filter((f) => f.level === 'check' || ['obesity', 'weight-over-age', 'empty-stomach'].includes(f.id)).every((f) => f.cite && f.cite.quote && (f.cite.page || f.cite.section)));
check('formatting of amounts', fmtFraction([1, 3]) === '⅓' && fmtFraction([3, 2]) === '1½' && fmtFraction([5, 1]) === '5' && fmtFraction([1, 2]) === '½' && fmtFraction([3, 4]) === '¾');

// ---- validation: no citation, no table ----
const clone = () => JSON.parse(JSON.stringify(raw));
let bad = clone(); delete bad.tables.standard.cites.dhp.quote;
check('a table without its quote does not load', !validateMalariaPack(bad).ok);
bad = clone(); bad.statements.obesity.page = ''; bad.statements.obesity.section = '';
check('a statement without a page or section does not load', !validateMalariaPack(bad).ok);
bad = clone(); bad.tables.standard.bands[3].weight.lo = 11;
check('a gap between weight bands is refused', validateMalariaPack(bad).errors.some((e) => e.includes('gap')), JSON.stringify(validateMalariaPack(bad).errors));
bad = clone(); bad.tables.standard.bands[2].dhp = [1, 0];
check('an impossible fraction is refused', !validateMalariaPack(bad).ok);
bad = clone(); bad.species.falciparum.cite = {};
check('a species without a citation is refused', !validateMalariaPack(bad).ok);
bad = clone(); delete bad.artesunate;
check('a pack without the artesunate figures is refused', !validateMalariaPack(bad).ok);
check('a pack that names a reviewer is not a draft', validateMalariaPack({ ...clone(), reviewedBy: 'dr. Test' }).pack.draft === false);

// ---- loading ----
(async () => {
  let l = await loadMalariaPack(async () => ({ ok: false }));
  check('no pack: reported as absent', !l.ok && l.absent);
  l = await loadMalariaPack(async () => ({ ok: true, json: async () => ({ ...clone(), species: {} }) }));
  check('an invalid pack is refused with reasons', !l.ok && !l.absent && l.errors.length > 0);
  l = await loadMalariaPack(async () => ({ ok: true, json: async () => clone() }));
  check('a valid pack loads', l.ok);
  console.log(`Malaria dose check: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})();
