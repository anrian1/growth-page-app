import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { assess } from './core/zscore.js';
import { isValidCode } from './core/childcode.js';
import { toCsv, toClinicCsv, toRecordCsv } from './csv.js';
import { addRecord, allRecords, clearAll, markExported } from './storage.js';
import * as photo from './photo.js';
import { readRecordPage, readRecordFields, MEDREC } from './session.js';
import { renderRecordConfirm, renderRecordResult, renderMalariaOut, esc } from './views.js';
import { loadMalariaPack, checkRegimen } from './malaria.js';
import { makeDate, checkAge } from './recorddate.js';
import { checkRecordValues } from './recordchecks.js';

const $ = (id) => document.getElementById(id);
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const VITALS = ['sys', 'dia', 'hr', 'rr', 'temp', 'height', 'weight'];
const DATE_KEYS = ['dobD', 'dobM', 'dobY', 'tglD', 'tglM', 'tglY'];

// ---------------------------------------------------------------- offline status
function setStatus(kind, text) { const el = $('status'); el.className = `banner ${kind}`; el.textContent = text; }
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true });
  // "ready" means the service worker is active, so every file (including the reading model) was saved on this phone.
  navigator.serviceWorker.ready.then(() => setStatus('ready', 'Siap offline \u2714 Aplikasi tersimpan di HP ini'));
} else {
  setStatus('dev', 'Mode pengembangan (belum offline)');
}
$('version').textContent = APP_VERSION;

// ---------------------------------------------------------------- helpers
function parseNumber(text) {
  const t = String(text ?? '').trim().replace(',', '.').replace('\u00b7', '.');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
const intOrNull = (text) => { const v = parseNumber(text); return v === null || Number.isNaN(v) || !Number.isInteger(v) ? null : v; };
function show(id, message) { const el = $(id); if (!el) return; el.textContent = message || ''; el.hidden = !message; }
const showPhotoError = (m) => show('photo-error', m);
const setProgress = (t) => show('progress', t);
const ddmmyyyy = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

// ---------------------------------------------------------------- state
let session = null;    // the photo that was read
let row = null;        // what was read from it
let current = null;    // a result waiting to be saved
let malariaInfo = { ok: false, absent: true, errors: [] };   // the malaria dose pack (public/guidelines/malaria-dose.json)
loadMalariaPack(typeof fetch === 'function' ? fetch : async () => ({ ok: false })).then((r) => { malariaInfo = r; });

// ---------------------------------------------------------------- photo -> reading -> popup
async function onPhoto(file) {
  showPhotoError(''); $('result').hidden = true; current = null;
  try {
    setProgress('Memuat mesin baca (hanya sekali)\u2026');
    const engine = await import('./ocr-engine.js');
    await engine.load();
    if (session) photo.release(session.img);
    session = await readRecordPage({ file, engine, photo, onProgress: setProgress });
    if (!session.aligned.ok) {
      setProgress('');
      showPhotoError(`Halaman tidak terbaca: ${session.aligned.problems.join(' ')} Foto ulang, atau isi manual.`);
      return;
    }
    row = await readRecordFields(session, { engine, photo, onProgress: setProgress });
    setProgress('');
    openConfirm();
  } catch (e) {
    setProgress('');
    showPhotoError(`Foto tidak bisa dibaca di HP ini (${e && e.message ? e.message : e}). Coba foto ulang, atau isi manual.`);
  }
}
for (const id of ['photo-camera', 'photo-gallery']) {
  $(id).addEventListener('change', (event) => { const file = event.target.files && event.target.files[0]; event.target.value = ''; if (file) onPhoto(file); });
}

function readDates(prefixOf) {
  const get = (k) => intOrNull($(prefixOf(k)).value);
  return { dob: makeDate(get('dobD'), get('dobM'), get('dobY')), visit: makeDate(get('tglD'), get('tglM'), get('tglY')) };
}

function updateAge(prefixOf = (k) => `f-${k}`, ageEl = 'rc-age', flagsEl = 'rc-age-flags') {
  const { dob, visit } = readDates(prefixOf);
  const target = $(ageEl); const flags = $(flagsEl);
  if (!target) return null;
  const notes = [];
  if (!dob.ok) notes.push(`Tanggal lahir: ${dob.reason}.`);
  if (!visit.ok) notes.push(`TGL kunjungan: ${visit.reason}.`);
  let age = null;
  if (dob.ok && visit.ok) { age = checkAge(dob.iso, visit.iso, todayIso()); notes.push(...age.flags); }
  target.textContent = age && age.ageMonths !== null ? `Umur dari tanggal lahir dan TGL: ${age.ageText}` : 'Umur belum bisa dihitung.';
  flags.innerHTML = notes.map((n) => `<p class="error">${esc(n)}</p>`).join('');
  return { dob, visit, age };
}

function openConfirm() {
  const overlay = $('overlay');
  overlay.innerHTML = renderRecordConfirm({ row, fields: MEDREC.fields });
  overlay.hidden = false; overlay.scrollTop = 0;
  const put = (selector, rect, width) => {
    const holder = overlay.querySelector(`[data-crop="${selector}"]`); if (!holder) return;
    try { holder.appendChild(photo.thumb(session.img, rect, width)); } catch (e) { holder.textContent = '(gambar tidak tersedia)'; }
  };
  for (const k of ['hr', 'rr', 'temp', 'height', 'weight']) put(k, row.rects[k], 220);
  for (const [k, rect] of Object.entries(row.strips)) put(`strip-${k}`, rect, 300);
  for (const [k, rect] of Object.entries(row.pictures)) put(`pic-${k}`, rect, 300);
  $('c-json').value = JSON.stringify({ sex: row.sex, ticks: row.ticks.ratios, cells: row.cells, tokens: session.tokens.length, anchors: session.aligned.anchors });
  overlay.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => { $(`f-${b.dataset.fill}`).value = b.dataset.text || b.dataset.value; updateAge(); }));
  for (const k of DATE_KEYS) $(`f-${k}`).addEventListener('input', () => updateAge());
  updateAge();
  $('c-ok').addEventListener('click', confirmValues);
  $('c-retake').addEventListener('click', closeConfirm);
}
function closeConfirm() { $('overlay').hidden = true; $('overlay').innerHTML = ''; }

function sourceOf(cell, finalValue) {
  if (finalValue === null) return null;
  if (cell.value !== null && Math.abs(cell.value - finalValue) < 0.001) return cell.status === 'ok' ? 'photo_ok' : 'photo_checked';
  if (cell.candidates.some((c) => Math.abs(c - finalValue) < 0.001)) return 'photo_chosen';
  return 'photo_edited';
}
const SOURCE_RANK = { photo_ok: 0, photo_checked: 1, photo_chosen: 2, photo_edited: 3, typed: 4 };
const leastCertain = (list) => list.filter(Boolean).reduce((w, s) => (SOURCE_RANK[s] > SOURCE_RANK[w] ? s : w), 'photo_ok');

function confirmValues() {
  const sex = (document.querySelector('input[name=rc-sex]:checked') || {}).value;
  if (!sex) { show('confirm-error', 'Pilih jenis kelamin (LK atau PR).'); return; }
  const { dob, visit, age } = updateAge();
  if (!dob.ok) { show('confirm-error', `Tanggal lahir: ${dob.reason}.`); return; }
  if (!visit.ok) { show('confirm-error', `TGL kunjungan: ${visit.reason}.`); return; }
  if (!age.ok) { show('confirm-error', age.flags[0]); return; }
  const values = {};
  for (const k of VITALS) {
    const v = parseNumber($(`f-${k}`).value);
    if (Number.isNaN(v)) { show('confirm-error', `${MEDREC.fields[k].label} harus berupa angka atau dikosongkan.`); return; }
    values[k] = v;
  }
  if (values.weight === null) { show('confirm-error', 'Isi berat badan (BB): dibutuhkan untuk status gizi dan dosis.'); return; }
  const code = $('rc-code').value.trim();
  if (code !== '' && !isValidCode(code)) { show('confirm-error', 'Kode pasien tidak cocok (angka terakhir adalah angka cek). Periksa lagi.'); return; }
  const needsCheck = Object.values(row.cells).some((x) => x.status !== 'ok') || row.sex.status !== 'ok';
  if (needsCheck && !($('c-check') && $('c-check').checked)) { show('confirm-error', 'Centang "Saya sudah membandingkan semua angka dengan tulisan di foto".'); return; }

  const sources = {};
  for (const k of VITALS) sources[k] = sourceOf(row.cells[k], values[k]);
  sources.dob = leastCertain(['dobD', 'dobM', 'dobY'].map((k) => sourceOf(row.cells[k], intOrNull($(`f-${k}`).value))));
  sources.visit = leastCertain(['tglD', 'tglM', 'tglY'].map((k) => sourceOf(row.cells[k], intOrNull($(`f-${k}`).value))));
  sources.sex = sex === row.sex.sex ? (row.sex.status === 'ok' ? 'photo_ok' : 'photo_checked') : row.sex.sex === null ? 'photo_chosen' : 'photo_edited';
  const ocr = { sexStatus: row.sex.status, cells: Object.fromEntries(Object.entries(row.cells).map(([k, c]) => [k, { status: c.status, value: c.value, candidates: c.candidates }])) };
  closeConfirm();
  showResult({ sex, dob, visit, age, values, sources, code, ocr });
}

// ---------------------------------------------------------------- manual entry (no photo)
$('manual-go').addEventListener('click', () => {
  showPhotoError(''); show('manual-error', ''); $('result').hidden = true; current = null;
  const sex = (document.querySelector('input[name=man-sex]:checked') || {}).value;
  if (!sex) { show('manual-error', 'Pilih jenis kelamin.'); return; }
  const d = readDates((k) => `man-${k}`);
  if (!d.dob.ok) { show('manual-error', `Tanggal lahir: ${d.dob.reason}.`); return; }
  if (!d.visit.ok) { show('manual-error', `TGL kunjungan: ${d.visit.reason}.`); return; }
  const a = checkAge(d.dob.iso, d.visit.iso, todayIso());
  if (!a.ok) { show('manual-error', a.flags[0]); return; }
  const values = {};
  for (const k of VITALS) {
    const v = parseNumber($(`man-${k}`).value);
    if (Number.isNaN(v)) { show('manual-error', `${MEDREC.fields[k].label} harus berupa angka atau dikosongkan.`); return; }
    values[k] = v;
  }
  if (values.weight === null) { show('manual-error', 'Isi berat badan (BB).'); return; }
  const sources = Object.fromEntries([...VITALS, 'dob', 'visit', 'sex'].map((k) => [k, k === 'sex' || k === 'dob' || k === 'visit' || values[k] !== null ? 'typed' : null]));
  showResult({ sex, dob: d.dob, visit: d.visit, age: a, values, sources, code: '', ocr: null });
});

// ---------------------------------------------------------------- result
function showResult({ sex, dob, visit, age, values, sources, code, ocr }) {
  const ranges = Object.fromEntries(VITALS.map((k) => [k, MEDREC.fields[k].range]));
  const rc = checkRecordValues(values, ranges);
  const nutrition = age.scope === 'nutrition' ? assess({ sex, ageMonths: age.ageMonths, weightKg: values.weight, lengthCm: values.height }) : null;
  const ageNotes = age.flags.filter((f) => !/belum dipasang/.test(f));        // the 5-18 years note is information, not a warning
  const flags = [...age.flags, ...rc.flags, ...(nutrition ? nutrition.flags : [])];
  const mustCheck = ageNotes.length > 0 || rc.flags.length > 0 || (nutrition && nutrition.action === 'FLAG_CONFIRM');
  current = {
    sex, ageMonths: age.ageMonths, ageYears: age.ageYears, ageText: age.ageText, scope: age.scope, visit: ddmmyyyy(visit.iso), visitIso: visit.iso, dobIso: dob.iso,
    values, weightKg: values.weight, weightUncertain: !!(nutrition && nutrition.action === 'FLAG_CONFIRM'), bbpbCategory: nutrition ? nutrition.category.bbpb : null,
    sources, code, ocr, nutrition, flags, mustCheck, malaria: null,
  };
  $('result').innerHTML = renderRecordResult(current, malariaInfo);
  $('result').hidden = false;
  $('save').addEventListener('click', saveCurrent);
  wireMalaria();
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------- malaria dose check (optional, under the result)
function wireMalaria() {
  if (!$('ma-go')) return;
  $('ma-type').addEventListener('change', () => { const severe = $('ma-type').value === 'severe'; $('ma-severe').hidden = !severe; $('ma-uncomplicated').hidden = severe; });
  $('ma-go').addEventListener('click', () => {
    const num = (id) => { const v = parseNumber($(id).value); return v === null || Number.isNaN(v) ? undefined : v; };
    const input = {
      weightKg: current.weightKg, weightUncertain: current.weightUncertain, ageMonths: current.ageMonths,
      species: $('ma-species').value, formulation: $('ma-form').value, testResult: $('ma-test').value, treatment: $('ma-type').value,
      dhpTablets: $('ma-dhp-tabs').value, dhpDays: num('ma-dhp-days'), pqTablets: $('ma-pq-tabs').value, pqDays: num('ma-pq-days'),
      artesunateMg: num('ma-art-mg'), bbpbCategory: current.bbpbCategory, pregnancy: $('ma-preg') ? $('ma-preg').value : undefined, g6pd: $('ma-g6pd').value,
    };
    const outcome = checkRegimen(malariaInfo.pack, input);
    $('ma-out').innerHTML = renderMalariaOut(outcome, malariaInfo.pack);
    current.malaria = {
      status: outcome.status, species: input.species, formulation: input.treatment === 'severe' ? 'artesunate' : input.formulation, treatment: input.treatment, testResult: input.testResult,
      dhpTablets: input.dhpTablets, dhpDays: input.dhpDays, pqTablets: input.pqTablets, pqDays: input.pqDays, artesunateMg: input.artesunateMg, g6pd: input.g6pd, pregnancy: input.pregnancy,
      findings: outcome.findings.map((f) => ({ id: f.id, level: f.level })), packId: malariaInfo.pack.id, packDraft: malariaInfo.pack.draft,
    };
  });
}

async function saveCurrent() {
  if (!current) return;
  if (current.mustCheck && !($('checked') && $('checked').checked)) { show('photo-error', 'Centang "Saya sudah memeriksa nilai ini" sebelum menyimpan.'); $('photo-step').scrollIntoView(); return; }
  const n = current.nutrition;
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await addRecord({
    id, type: 'record', patientCode: current.code || null, visitDate: current.visitIso, dob: current.dobIso, sex: current.sex, ageMonths: current.ageMonths,
    values: current.values, sources: current.sources, ocr: current.ocr,
    nutrition: n ? { status: n.action, z: n.zRounded, category: n.category } : { status: current.scope === 'dose-only' ? 'not_calculated_5_18y' : 'not_calculated' },
    flags: current.flags, malaria: current.malaria, appVersion: APP_VERSION, createdAt: new Date().toISOString(), exportedAt: null,
  });
  current = null;
  $('result').hidden = true;
  showPhotoError('');
  await refreshRecords();
}

// ---------------------------------------------------------------- records and export
async function refreshRecords() {
  const records = await allRecords();
  const fresh = records.filter((r) => !r.exportedAt).length;
  $('records-summary').textContent = records.length === 0 ? 'Belum ada data.' : `${records.length} data tersimpan, ${fresh} belum diekspor.`;
  const ageOf = (r) => (r.type === 'clinic' ? `${r.ageYears} th` : `${r.ageMonths} bln`);
  const kindOf = (r) => ({ clinic: 'klinik', growth: 'anak', record: 'rekam medis' }[r.type] || 'anak');
  $('records-list').innerHTML = records.length === 0 ? '' : `<table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Usia</th><th>Status</th></tr></thead><tbody>${
    records.slice(0, 10).map((r) => `<tr><td>${esc(r.visitDate)}</td><td>${kindOf(r)}</td><td>${esc(ageOf(r))}</td><td>${r.exportedAt ? 'sudah diekspor' : 'baru'}</td></tr>`).join('')}</tbody></table>`;
}

async function shareOrDownload(files) {
  const objects = files.map((f) => new File([f.text], f.name, { type: 'text/csv' }));
  if (navigator.canShare && navigator.canShare({ files: objects })) {
    try { await navigator.share({ files: objects, title: files.map((f) => f.name).join(', ') }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(new Blob([f.text], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return true;
}

async function exportRecords(onlyNew) {
  const records = (await allRecords()).filter((r) => !onlyNew || !r.exportedAt);
  if (records.length === 0) { $('records-summary').textContent = 'Tidak ada data untuk diekspor.'; return; }
  const when = new Date().toISOString(); const day = when.slice(0, 10);
  const oldest = (type) => records.filter((r) => (r.type || 'growth') === type).reverse();
  const files = [];
  if (oldest('record').length) files.push({ name: `rekam-medis-${day}.csv`, text: toRecordCsv(oldest('record'), { includeDob: $('include-dob').checked, exportedAt: when }) });
  if (oldest('growth').length) files.push({ name: `kia-tumbuh-${day}.csv`, text: toCsv(oldest('growth'), { includeDob: $('include-dob').checked, exportedAt: when }) });
  if (oldest('clinic').length) files.push({ name: `kunjungan-klinik-${day}.csv`, text: toClinicCsv(oldest('clinic'), { exportedAt: when }) });
  const done = await shareOrDownload(files);
  if (done) { await markExported(records.map((r) => r.id), when); await refreshRecords(); }
}
$('export-new').addEventListener('click', () => exportRecords(true));
$('export-all').addEventListener('click', () => exportRecords(false));
$('delete-all').addEventListener('click', async () => {
  if (!window.confirm('Hapus SEMUA data di HP ini? Ini tidak bisa dibatalkan. Ekspor dulu jika perlu.')) return;
  await clearAll();
  await refreshRecords();
});

refreshRecords();
