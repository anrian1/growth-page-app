// Builds the CSV that the puskesmas can open in Excel.
// Rules: comma separated, dot decimals, ISO dates (YYYY-MM-DD), UTF-8, quotes around any text with a comma or quote.
// weight_source / length_source say how each value was obtained: photo_ok, photo_checked, photo_chosen, photo_edited or typed.
// malaria_* columns record the optional malaria dose check: what was entered, the status against the guideline table, and the ids of the findings that differed.
// The child code always starts with a digit and is written as text; Excel may drop a leading zero when it opens the file,
// so the importing person should open it with Data > From Text/CSV and set that column to Text.
export const COLUMNS = [
  'record_id', 'child_code', 'visit_date', 'sex', 'age_months', 'weight_kg', 'length_cm',
  'z_bbu', 'z_pbu', 'z_bbpb', 'cat_bbu', 'cat_pbu', 'cat_bbpb', 'action', 'weight_source', 'length_source',
  'malaria_status', 'malaria_species', 'malaria_form', 'dhp_tabs_day', 'dhp_days', 'pq_tabs_day', 'pq_days', 'malaria_findings', 'malaria_pack',
  'flags', 'app_version', 'exported_at',
];

function cell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(records, { includeDob = false, exportedAt = new Date().toISOString() } = {}) {
  const columns = includeDob ? [...COLUMNS.slice(0, 3), 'dob', ...COLUMNS.slice(3)] : COLUMNS;
  const lines = [columns.join(',')];
  for (const r of records) {
    const row = {
      record_id: r.id, child_code: r.childCode ?? '', visit_date: r.visitDate, dob: r.dob ?? '', sex: r.sex,
      age_months: r.ageMonths, weight_kg: r.weightKg, length_cm: r.lengthCm ?? '',
      z_bbu: r.z?.bbu ?? '', z_pbu: r.z?.pbu ?? '', z_bbpb: r.z?.bbpb ?? '',
      cat_bbu: r.category?.bbu ?? '', cat_pbu: r.category?.pbu ?? '', cat_bbpb: r.category?.bbpb ?? '',
      action: r.action, weight_source: r.weightSource ?? '', length_source: r.lengthSource ?? '',
      malaria_status: r.malaria ? r.malaria.status : 'not_checked', malaria_species: r.malaria ? r.malaria.species ?? '' : '', malaria_form: r.malaria ? r.malaria.formulation ?? '' : '',
      dhp_tabs_day: r.malaria ? r.malaria.dhpTablets ?? '' : '', dhp_days: r.malaria ? r.malaria.dhpDays ?? '' : '', pq_tabs_day: r.malaria ? r.malaria.pqTablets ?? '' : '', pq_days: r.malaria ? r.malaria.pqDays ?? '' : '',
      malaria_findings: r.malaria ? (r.malaria.findings || []).filter((f) => f.level === 'check').map((f) => f.id).join(' | ') : '',
      malaria_pack: r.malaria ? `${r.malaria.packId}${r.malaria.packDraft ? ' (draft)' : ' (reviewed)'}` : '',
      flags: (r.flags || []).join(' | '), app_version: r.appVersion ?? '', exported_at: exportedAt,
    };
    lines.push(columns.map((c) => cell(row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}


export const CLINIC_COLUMNS = [
  'record_id', 'patient_code', 'visit_date', 'sex', 'age_years', 'sys', 'dia', 'pulse', 'temp_c', 'weight_kg', 'height_cm', 'bmi',
  'sys_source', 'dia_source', 'pulse_source', 'temp_source', 'weight_source', 'height_source',
  'diagnosis', 'check_flags', 'rules_fired', 'rules_skipped', 'guideline_pack', 'pack_reviewed', 'app_version', 'exported_at',
];

export function toClinicCsv(records, { exportedAt = new Date().toISOString() } = {}) {
  const lines = [CLINIC_COLUMNS.join(',')];
  for (const r of records) {
    const v = r.values || {}; const s = r.sources || {};
    const row = {
      record_id: r.id, patient_code: r.patientCode ?? '', visit_date: r.visitDate, sex: r.sex, age_years: r.ageYears,
      sys: v.sys ?? '', dia: v.dia ?? '', pulse: v.pulse ?? '', temp_c: v.temp ?? '', weight_kg: v.weight ?? '', height_cm: v.height ?? '', bmi: r.bmi ?? '',
      sys_source: s.sys ?? '', dia_source: s.dia ?? '', pulse_source: s.pulse ?? '', temp_source: s.temp ?? '', weight_source: s.weight ?? '', height_source: s.height ?? '',
      diagnosis: r.diagnosisText ?? '', check_flags: (r.flags || []).join(' | '), rules_fired: (r.rulesFired || []).join(' | '), rules_skipped: (r.rulesSkipped || []).join(' | '),
      guideline_pack: r.packId ?? '', pack_reviewed: r.packId ? (r.packDraft ? 'draft' : 'reviewed') : '', app_version: r.appVersion ?? '', exported_at: exportedAt,
    };
    lines.push(CLINIC_COLUMNS.map((c2) => cell(row[c2])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}


// ---------------------------------------------------------------- the medical-record exports (two files, fixed allow-lists)
// PRIVACY: a column that is not in one of these lists cannot be exported. The patient's NAME, family-head name, ADDRESS, PHONE and BPJS NUMBER are never read
// into a record, so they cannot appear in either file. A test fails if a column is added without changing the expected list.
//   LINK file     = for the clinic's own system: medical record number (MRN) + date of birth + exact visit date. Personal health data: keep it inside the clinic.
//   ANALYSIS file = for evaluators and researchers: no MRN, no date of birth, visit MONTH instead of the exact date, age in months.
const SHARED_COLUMNS = [
  'record_id', 'sex', 'age_months', 'sys', 'dia', 'hr', 'rr', 'temp_c', 'height_cm', 'weight_kg',
  'sex_source', 'dob_source', 'visit_date_source', 'mrn_source', 'sys_source', 'dia_source', 'hr_source', 'rr_source', 'temp_source', 'height_source', 'weight_source',
  'z_bbu', 'z_pbu', 'z_bbpb', 'cat_bbu', 'cat_pbu', 'cat_bbpb', 'nutrition_status',
  'malaria_status', 'malaria_species', 'malaria_form', 'dhp_tabs_day', 'dhp_days', 'dhp_times_day', 'pq_tabs_day', 'pq_days', 'artesunate_mg', 'g6pd', 'pregnancy', 'malaria_findings', 'malaria_pack', 'rx_source',
  'flags', 'app_version', 'exported_at',
];
export const LINK_COLUMNS = ['mrn', 'dob', 'visit_date', ...SHARED_COLUMNS];
export const ANALYSIS_COLUMNS = ['visit_month', ...SHARED_COLUMNS];

/** 8 digits -> "00-1234-56" (the grouping printed on the form). The hyphens stop a spreadsheet from dropping the leading zeros. */
export const formatMrn = (digits) => { const d = String(digits ?? ''); return /^\d{8}$/.test(d) ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : d; };

function recordRow(r, exportedAt) {
  const v = r.values || {}; const s = r.sources || {}; const n = r.nutrition || {}; const m = r.malaria;
  return {
    record_id: r.id, sex: r.sex, age_months: r.ageMonths, sys: v.sys ?? '', dia: v.dia ?? '', hr: v.hr ?? '', rr: v.rr ?? '', temp_c: v.temp ?? '', height_cm: v.height ?? '', weight_kg: v.weight ?? '',
    sex_source: s.sex ?? '', dob_source: s.dob ?? '', visit_date_source: s.visit ?? '', mrn_source: s.mrn ?? '', sys_source: s.sys ?? '', dia_source: s.dia ?? '', hr_source: s.hr ?? '', rr_source: s.rr ?? '', temp_source: s.temp ?? '', height_source: s.height ?? '', weight_source: s.weight ?? '',
    z_bbu: n.z?.bbu ?? '', z_pbu: n.z?.pbu ?? '', z_bbpb: n.z?.bbpb ?? '', cat_bbu: n.category?.bbu ?? '', cat_pbu: n.category?.pbu ?? '', cat_bbpb: n.category?.bbpb ?? '', nutrition_status: n.status ?? '',
    malaria_status: m ? m.status : 'not_checked', malaria_species: m ? m.species ?? '' : '', malaria_form: m ? m.formulation ?? '' : '', dhp_tabs_day: m ? m.dhpTablets ?? '' : '', dhp_days: m ? m.dhpDays ?? '' : '', dhp_times_day: m ? m.dhpTimes ?? '' : '',
    pq_tabs_day: m ? m.pqTablets ?? '' : '', pq_days: m ? m.pqDays ?? '' : '', artesunate_mg: m ? m.artesunateMg ?? '' : '', g6pd: m ? m.g6pd ?? '' : '', pregnancy: m ? m.pregnancy ?? '' : '',
    malaria_findings: m ? (m.findings || []).filter((f) => f.level === 'check').map((f) => f.id).join(' | ') : '', malaria_pack: m ? `${m.packId}${m.packDraft ? ' (draft)' : ' (reviewed)'}` : '', rx_source: r.rxSource ?? '',
    flags: (r.flags || []).join(' | '), app_version: r.appVersion ?? '', exported_at: exportedAt,
  };
}
const build = (columns, extra, records, exportedAt) => [columns.join(','), ...records.map((r) => { const row = { ...recordRow(r, exportedAt), ...extra(r) }; return columns.map((c2) => cell(row[c2])).join(','); })].join('\r\n') + '\r\n';

export const toLinkCsv = (records, { exportedAt = new Date().toISOString() } = {}) => build(LINK_COLUMNS, (r) => ({ mrn: formatMrn(r.mrn), dob: r.dob ?? '', visit_date: r.visitDate }), records, exportedAt);
export const toAnalysisCsv = (records, { exportedAt = new Date().toISOString() } = {}) => build(ANALYSIS_COLUMNS, (r) => ({ visit_month: String(r.visitDate || '').slice(0, 7) }), records, exportedAt);
