// Malaria dose check against the Buku Saku Tata Laksana Kasus Malaria.
// The app looks up the amount the guideline table gives for the child's weight and compares it with what was written.
// It does not decide anything: a clinician reads the finding, the citation and the quote, and makes the call.
// Everything it can say comes from public/guidelines/malaria-dose.json, whose tables and quotes were taken from the source file.

// ---------------------------------------------------------------- amounts (tablets) as exact fractions
export const TABLET_OPTIONS = [
  { value: '0', label: 'tidak diberikan', frac: [0, 1] }, { value: '1/4', label: '\u00bc', frac: [1, 4] }, { value: '1/3', label: '\u2153', frac: [1, 3] },
  { value: '1/2', label: '\u00bd', frac: [1, 2] }, { value: '3/4', label: '\u00be', frac: [3, 4] }, { value: '1', label: '1', frac: [1, 1] },
  { value: '3/2', label: '1\u00bd', frac: [3, 2] }, { value: '2', label: '2', frac: [2, 1] }, { value: '3', label: '3', frac: [3, 1] },
  { value: '4', label: '4', frac: [4, 1] }, { value: '5', label: '5', frac: [5, 1] },
];
export const parseTablets = (value) => { const o = TABLET_OPTIONS.find((t) => t.value === String(value)); return o ? o.frac : null; };
const same = (a, b) => a[0] * b[1] === b[0] * a[1];
export function fmtFraction([n, d]) {
  const whole = Math.floor(n / d); const rest = [n - whole * d, d];
  const glyph = { '1/4': '\u00bc', '1/3': '\u2153', '1/2': '\u00bd', '3/4': '\u00be' }[`${rest[0]}/${rest[1]}`];
  if (rest[0] === 0) return String(whole);
  if (!glyph) return `${n}/${d}`;
  return whole === 0 ? glyph : `${whole}${glyph}`;
}

// ---------------------------------------------------------------- validation: no citation, no table
const citeOk = (c) => c && (c.page || c.section) && c.quote && String(c.quote).trim() !== '';
const fracOk = (f) => Array.isArray(f) && f.length === 2 && Number.isInteger(f[0]) && Number.isInteger(f[1]) && f[0] > 0 && f[1] > 0;

function inBand(w, weight) {
  const aboveLo = weight.lo === null || (weight.loInclusive ? w >= weight.lo : w > weight.lo);
  const belowHi = weight.hi === null || (weight.hiInclusive ? w <= weight.hi : w < weight.hi);
  return aboveLo && belowHi;
}
function contiguous(bands, label, errors) {
  const sorted = bands.slice().sort((a, b) => (a.weight.lo ?? -Infinity) - (b.weight.lo ?? -Infinity));
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i].weight; const b = sorted[i + 1].weight;
    if (a.hi === null || b.lo === null || a.hi !== b.lo || a.hiInclusive === b.loInclusive) errors.push(`${label}: bands "${sorted[i].label}" and "${sorted[i + 1].label}" overlap or leave a gap`);
  }
}

export function validateMalariaPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['The pack is not an object.'], pack: null };
  if (!pack.id || !pack.title) errors.push('pack: id and title are required');
  if (!pack.source || !pack.source.name || !pack.source.year) errors.push('pack: source.name and source.year are required');
  const std = pack.tables && pack.tables.standard; const disp = pack.tables && pack.tables.dispersible;
  if (!std || !Array.isArray(std.bands) || std.bands.length === 0) errors.push('tables.standard: bands are missing');
  else {
    std.bands.forEach((b) => {
      if (!fracOk(b.dhp)) errors.push(`standard band ${b.label}: DHP amount is not a valid fraction`);
      if (b.primaquine !== null && !fracOk(b.primaquine)) errors.push(`standard band ${b.label}: primaquine amount is not a valid fraction`);
      if (!b.weight || typeof b.weight !== 'object') errors.push(`standard band ${b.label}: weight range is missing`);
    });
    if (!errors.length) contiguous(std.bands, 'standard', errors);
    for (const key of ['dhp', 'primaquineFalciparum', 'primaquineVivax', 'primaquineMixed']) if (!citeOk(std.cites && std.cites[key])) errors.push(`tables.standard.cites.${key}: a page or section AND the exact quote are required`);
  }
  if (!disp || !Array.isArray(disp.bands) || disp.bands.length === 0) errors.push('tables.dispersible: bands are missing');
  else {
    disp.bands.forEach((b) => { if (!fracOk(b.tablets)) errors.push(`dispersible band ${b.label}: amount is not a valid fraction`); });
    if (!errors.length) contiguous(disp.bands, 'dispersible', errors);
    if (!citeOk(disp.cite)) errors.push('tables.dispersible.cite: a page or section AND the exact quote are required');
  }
  for (const [key, s] of Object.entries(pack.species || {})) {
    if (!Number.isInteger(s.dhpDays) || s.dhpDays < 1) errors.push(`species ${key}: dhpDays must be a whole number of days`);
    if (!Number.isInteger(s.primaquineDays) || s.primaquineDays < 0) errors.push(`species ${key}: primaquineDays must be a whole number of days (0 = none)`);
    if (s.primaquineDays > 0 && !(std && std.cites && std.cites[s.primaquineTable])) errors.push(`species ${key}: primaquineTable does not name a table with a citation`);
    if (!citeOk(s.cite)) errors.push(`species ${key}: citation (page or section AND exact quote) is required`);
  }
  if (!pack.species || Object.keys(pack.species).length === 0) errors.push('species: at least one plasmodium type is required');
  for (const key of ['testPositive', 'dhpDays', 'primaquineInfant', 'g6pdDose', 'weightOverAge', 'obesity', 'dispersibleLimit', 'emptyStomach', 'severeTreatment', 'artesunateDose', 'artesunatePreReferral']) {
    if (!citeOk(pack.statements && pack.statements[key])) errors.push(`statements.${key}: citation (page or section AND exact quote) is required`);
  }
  const a = pack.artesunate;
  if (!a || !(a.mgPerKgBelow20 > 0) || !(a.mgPerKgAbove20 > 0) || !(a.boundaryKg > 0)) errors.push('artesunate: mgPerKgBelow20, mgPerKgAbove20 and boundaryKg are required');
  if (errors.length) return { ok: false, errors, pack: null };
  return { ok: true, errors: [], pack: { ...pack, draft: !pack.reviewedBy } };
}

export async function loadMalariaPack(fetchFn = fetch) {
  try {
    const res = await fetchFn('/guidelines/malaria-dose.json', { cache: 'no-cache' });
    if (!res.ok) return { ok: false, absent: true, errors: [], pack: null };
    return { ...validateMalariaPack(await res.json()), absent: false };
  } catch (e) { return { ok: false, absent: true, errors: [], pack: null }; }
}

// ---------------------------------------------------------------- what the guideline gives
export const findBand = (bands, weightKg) => bands.find((b) => inBand(weightKg, b.weight)) || null;

export function expectedRegimen(pack, { weightKg, ageMonths, species, formulation }) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return { ok: false, reason: 'Berat badan belum ada.' };
  const sp = pack.species[species];
  if (!sp) return { ok: false, reason: 'Jenis plasmodium belum dipilih.' };
  const std = findBand(pack.tables.standard.bands, weightKg);
  if (!std) return { ok: false, reason: `Berat ${weightKg} kg tidak ada di tabel.` };
  let dhp;
  if (formulation === 'dispersible') {
    const band = findBand(pack.tables.dispersible.bands, weightKg);
    if (!band) return { ok: false, reason: `Tabel DHP dispersibel hanya mencakup berat 5 sampai kurang dari 36 kg. Berat ${weightKg} kg di luar tabel.` };
    dhp = { tablets: band.tablets, days: sp.dhpDays, band, cite: pack.tables.dispersible.cite, tableName: 'Tabel 4 (DHP dispersibel)' };
  } else {
    dhp = { tablets: std.dhp, days: sp.dhpDays, band: std, cite: pack.tables.standard.cites.dhp, tableName: 'Tabel 1-3 (DHP tablet)' };
  }
  const takesPq = sp.primaquineDays > 0;
  const pq = { applies: takesPq && !(ageMonths < 6), tablets: takesPq ? std.primaquine : null, days: sp.primaquineDays, band: std, cite: takesPq ? pack.tables.standard.cites[sp.primaquineTable] : sp.cite, speciesCite: sp.cite };
  return { ok: true, species: sp, standardBand: std, dhp, pq };
}

const fmtKg = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const fmtMg = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/**
 * checkRegimen(pack, input)
 *  input: { weightKg, weightUncertain, ageMonths, species, formulation: 'standard'|'dispersible',
 *           testResult: 'positive'|'negative'|'none', treatment: 'uncomplicated'|'severe',
 *           dhpTablets: '1/2'|..., dhpDays, pqTablets: '0'|'1/4'|..., pqDays, artesunateMg, bbpbCategory,
 *           pregnancy: 'none'|'pregnant'|'breastfeeding' (only asked for girls from about 10 years), g6pd: 'unknown'|'deficient' }
 *  returns { status: 'match'|'differs'|'cannot_check'|'nothing_to_compare', findings, expected, compared }
 *  A finding is { id, level: 'check'|'info', text, cite }. 'check' means "differs from the guideline or conflicts with it".
 */
export function checkRegimen(pack, input) {
  const findings = []; const compared = [];
  const add = (id, level, text, cite) => findings.push({ id, level, text, cite });
  const out = (status, extra = {}) => ({ status, findings, compared, expected: null, ...extra });
  const w = input.weightKg;
  if (!Number.isFinite(w) || w <= 0) { add('no-weight', 'info', 'Berat badan belum ada, jadi dosis tidak dapat diperiksa.', null); return out('cannot_check'); }
  if (input.weightUncertain) { add('weight-uncertain', 'info', 'Berat badan masih ditandai tidak pasti. Periksa dulu; dosis tidak dihitung dari angka yang belum pasti.', null); return out('cannot_check'); }
  const S = pack.statements;

  if (input.testResult === 'negative') add('test-negative', 'check', 'Hasil pemeriksaan darah malaria dicatat negatif. Pedoman: ACT hanya diberikan bila hasil positif.', S.testPositive);
  else if (input.testResult !== 'positive') add('test-missing', 'info', 'Hasil pemeriksaan darah malaria belum dicatat. Pedoman: ACT hanya diberikan bila hasil positif.', S.testPositive);

  // ---------------- severe malaria: artesunate dose
  if (input.treatment === 'severe') {
    const a = pack.artesunate;
    add('severe-treatment', 'info', 'Malaria berat: artesunat intravena (atau intramuskular bila tidak memungkinkan).', S.severeTreatment);
    if (w === a.boundaryKg) {
      add('artesunate-boundary', 'info', `Pedoman memberi 3 mg/kgBB untuk anak <20 kg dan 2,4 mg/kgBB untuk >20 kg, dan tidak menetapkan berat tepat 20 kg. Tidak dapat dipastikan. Tanyakan ke dokter.`, S.artesunateDose);
      return out('cannot_check', { expected: { artesunate: null } });
    }
    const perKg = w < a.boundaryKg ? a.mgPerKgBelow20 : a.mgPerKgAbove20;
    const expectedMg = Math.round(perKg * w * 10) / 10;
    const expected = { artesunate: { mgPerKg: perKg, mg: expectedMg } };
    add('artesunate-expected', 'info', `Dosis awal menurut pedoman untuk ${fmtKg(w)} kg: ${String(perKg).replace('.', ',')} mg/kgBB x ${fmtKg(w)} = ${fmtMg(expectedMg)} mg.`, w < a.boundaryKg ? S.artesunateDose : S.artesunatePreReferral);
    if (Number.isFinite(input.artesunateMg)) {
      const diff = input.artesunateMg - expectedMg;
      compared.push({ kind: 'amount', drug: 'Artesunat (mg)', expected: fmtMg(expectedMg), entered: fmtMg(input.artesunateMg), same: Math.abs(diff) <= a.roundingMg });
      if (Math.abs(diff) > a.roundingMg) add('artesunate-differs', 'check', `Dosis artesunat dicatat ${fmtMg(input.artesunateMg)} mg; pedoman ${fmtMg(expectedMg)} mg (selisih ${fmtMg(Math.abs(diff))} mg, ${Math.round(Math.abs(diff) / expectedMg * 100)}%).`, w < a.boundaryKg ? S.artesunateDose : S.artesunatePreReferral);
      return out(Math.abs(diff) > a.roundingMg ? 'differs' : 'match', { expected });
    }
    add('artesunate-missing', 'info', 'Dosis artesunat belum diisi, jadi belum ada yang dibandingkan.', null);
    return out('nothing_to_compare', { expected });
  }

  // ---------------- uncomplicated: DHP and primaquine
  const exp = expectedRegimen(pack, { weightKg: w, ageMonths: input.ageMonths, species: input.species, formulation: input.formulation });
  if (!exp.ok) { add('cannot-look-up', 'info', exp.reason, null); return out('cannot_check'); }
  const expected = { dhp: exp.dhp, pq: exp.pq, band: exp.standardBand.label };

  const dhp = parseTablets(input.dhpTablets);
  if (dhp && dhp[0] > 0) {
    const ok = same(dhp, exp.dhp.tablets);
    compared.push({ kind: 'amount', drug: 'DHP (tablet/hari)', expected: fmtFraction(exp.dhp.tablets), entered: fmtFraction(dhp), same: ok });
    if (!ok) add('dhp-differs', 'check', `DHP: tabel untuk berat ${fmtKg(w)} kg (kolom ${exp.dhp.band.label}) = ${fmtFraction(exp.dhp.tablets)} tablet per hari; dicatat ${fmtFraction(dhp)}.`, exp.dhp.cite);
  } else add('dhp-missing', 'info', `DHP belum diisi. Pedoman untuk ${fmtKg(w)} kg: ${fmtFraction(exp.dhp.tablets)} tablet per hari selama ${exp.dhp.days} hari.`, exp.dhp.cite);
  if (Number.isFinite(input.dhpDays)) {
    const ok = input.dhpDays === exp.dhp.days;
    compared.push({ kind: 'days', drug: 'DHP (hari)', expected: String(exp.dhp.days), entered: String(input.dhpDays), same: ok });
    if (!ok) add('dhp-days', 'check', `Lama DHP dicatat ${input.dhpDays} hari; pedoman ${exp.dhp.days} hari.`, S.dhpDays);
  }
  if (input.formulation === 'dispersible' && input.ageMonths < 6 && w < 5) add('dispersible-limit', 'check', 'DHP dispersibel terbatas untuk bayi usia 6 bulan ke atas atau berat 5 kg atau lebih; anak ini kurang dari keduanya.', S.dispersibleLimit);

  const pq = parseTablets(input.pqTablets); const pqGiven = pq && pq[0] > 0;
  if (input.ageMonths < 6 && pqGiven) add('pq-infant', 'check', 'Primakuin dicatat untuk bayi di bawah 6 bulan. Pedoman: primakuin tidak diberikan pada bayi <6 bulan.', S.primaquineInfant);
  else if (exp.species.primaquineDays === 0 && pqGiven) add('pq-species', 'check', `Primakuin dicatat untuk ${exp.species.label}. Pedoman: tidak diberikan primakuin untuk jenis ini.`, exp.species.cite);
  else if (exp.pq.applies) {
    if (exp.pq.tablets === null) {
      if (pqGiven) add('pq-no-dose', 'check', `Tabel tidak memberi dosis primakuin untuk berat ${fmtKg(w)} kg (kolom ${exp.standardBand.label}), tetapi dicatat ${fmtFraction(pq)} tablet.`, exp.pq.cite);
    } else if (pqGiven) {
      const ok = same(pq, exp.pq.tablets);
      compared.push({ kind: 'amount', drug: 'Primakuin (tablet/hari)', expected: fmtFraction(exp.pq.tablets), entered: fmtFraction(pq), same: ok });
      if (!ok) add('pq-differs', 'check', `Primakuin: tabel untuk berat ${fmtKg(w)} kg (kolom ${exp.standardBand.label}) = ${fmtFraction(exp.pq.tablets)} tablet per hari; dicatat ${fmtFraction(pq)}.`, exp.pq.cite);
      if (Number.isFinite(input.pqDays)) {
        const dok = input.pqDays === exp.pq.days;
        compared.push({ kind: 'days', drug: 'Primakuin (hari)', expected: String(exp.pq.days), entered: String(input.pqDays), same: dok });
        if (!dok) add('pq-days', 'check', `Lama primakuin dicatat ${input.pqDays} hari; pedoman untuk ${exp.species.label}: ${exp.pq.days} hari.`, exp.pq.speciesCite);
      }
    } else {
      add('pq-not-recorded', 'info', `Primakuin tidak dicatat. Pedoman untuk ${exp.species.label}: ${fmtFraction(exp.pq.tablets)} tablet per hari selama ${exp.pq.days} hari, kecuali ada kontraindikasi (mis. G6PD).`, exp.pq.cite);
    }
  }

  if (pqGiven && input.pregnancy === 'pregnant') add('pq-pregnant', 'check', 'Primakuin dicatat untuk pasien hamil. Pedoman: tidak diberikan primakuin pada ibu hamil.', S.primaquineInfant);
  if (pqGiven && input.pregnancy === 'breastfeeding') add('pq-breastfeeding', 'check', 'Primakuin dicatat untuk ibu yang menyusui bayi di bawah 6 bulan. Pedoman: tidak diberikan primakuin pada kelompok ini.', S.primaquineInfant);
  if (input.g6pd === 'deficient') {
    if (pqGiven) add('pq-g6pd', 'check', 'Defisiensi G6PD dicatat. Pedoman: tidak diberikan primakuin pada penderita defisiensi G6PD (dosis standar tabel tidak berlaku).', S.primaquineInfant);
    add('g6pd-special-dose', 'info', 'Untuk defisiensi G6PD pedoman menyebut dosis khusus berikut. Aplikasi ini tidak menghitungnya; tanyakan ke dokter.', S.g6pdDose);
  }

  const band = exp.standardBand;
  if (band.ageMonths && (input.ageMonths < band.ageMonths[0] || (band.ageMonths[1] !== null && input.ageMonths > band.ageMonths[1]))) {
    add('weight-over-age', 'info', `Umur ${input.ageMonths} bulan tidak sesuai kolom umur tabel (${band.ageLabel}) untuk berat ${fmtKg(w)} kg. Pedoman: dosis berdasarkan berat badan.`, S.weightOverAge);
  }
  if (input.bbpbCategory === 'Obesitas') add('obesity', 'info', 'Status gizi BB/PB: obesitas. Pedoman: untuk anak dengan obesitas gunakan dosis berdasarkan berat badan ideal. Pemeriksaan ini memakai berat badan yang tercatat.', S.obesity);
  add('empty-stomach', 'info', 'Obat antimalaria tidak boleh diminum dalam keadaan perut kosong.', S.emptyStomach);

  // "match" needs at least one AMOUNT (tablets or mg) compared; matching days alone must not look like a verified dose
  const anyCheck = findings.some((f) => f.level === 'check');
  const amountCompared = compared.some((c) => c.kind === 'amount');
  const status = anyCheck ? 'differs' : amountCompared ? 'match' : 'nothing_to_compare';
  return out(status, { expected });
}
