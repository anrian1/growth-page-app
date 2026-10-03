// Builds the CSV that the puskesmas can open in Excel.
// Rules: comma separated, dot decimals, ISO dates (YYYY-MM-DD), UTF-8, quotes around any text with a comma or quote.
// weight_source / length_source say how each value was obtained: photo_ok, photo_checked, photo_chosen, photo_edited or typed.
// The child code always starts with a digit and is written as text; Excel may drop a leading zero when it opens the file,
// so the importing person should open it with Data > From Text/CSV and set that column to Text.
export const COLUMNS = [
  'record_id', 'child_code', 'visit_date', 'sex', 'age_months', 'weight_kg', 'length_cm',
  'z_bbu', 'z_pbu', 'z_bbpb', 'cat_bbu', 'cat_pbu', 'cat_bbpb', 'action', 'weight_source', 'length_source', 'flags', 'app_version', 'exported_at',
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
      action: r.action, weight_source: r.weightSource ?? '', length_source: r.lengthSource ?? '', flags: (r.flags || []).join(' | '), app_version: r.appVersion ?? '', exported_at: exportedAt,
    };
    lines.push(columns.map((c) => cell(row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
