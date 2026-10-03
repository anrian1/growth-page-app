import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { assess, ageInMonths } from './core/zscore.js';
import { isValidCode } from './core/childcode.js';
import { toCsv } from './csv.js';
import { addRecord, allRecords, clearAll, markExported } from './storage.js';
import * as photo from './photo.js';
import { readPage, readRow } from './session.js';
import { renderConfirm, renderResult, esc, fmtNum } from './views.js';
import { TEMPLATE } from './template.js';

const $ = (id) => document.getElementById(id);
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

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
function show(id, message) { const el = $(id); el.textContent = message || ''; el.hidden = !message; }
const showFormError = (m) => show('form-error', m);
const showPhotoError = (m) => show('photo-error', m);
function setProgress(text) { show('progress', text); }

// ---------------------------------------------------------------- state
let child = null;      // { code, sex, dob, visit, ageMonths }
let session = null;    // the photo that was read
let row = null;        // the cells read for this child
let current = null;    // a calculation waiting to be saved

$('visit').value = todayIso();

function readChild() {
  const code = $('code').value.trim();
  if (code !== '' && !isValidCode(code)) throw new Error('Kode anak tidak cocok (angka terakhir adalah angka cek). Periksa lagi.');
  const sex = (document.querySelector('input[name=sex]:checked') || {}).value;
  if (!sex) throw new Error('Pilih jenis kelamin.');
  const dob = $('dob').value; const visit = $('visit').value;
  if (!dob || !visit) throw new Error('Isi tanggal lahir dan tanggal ukur.');
  return { code, sex, dob, visit, ageMonths: ageInMonths(dob, visit) };
}

// ---------------------------------------------------------------- photo -> reading -> popup
async function onPhoto(file) {
  showFormError(''); showPhotoError(''); $('result').hidden = true; current = null;
  try { child = readChild(); } catch (e) { showFormError(e.message); return; }
  if (child.ageMonths > TEMPLATE.months[1]) { showPhotoError(`Halaman ini hanya untuk usia 0\u201324 bulan. Anak ini ${child.ageMonths} bulan.`); return; }
  try {
    setProgress('Memuat mesin baca (hanya sekali)\u2026');
    const engine = await import('./ocr-engine.js');
    await engine.load();
    if (session) photo.release(session.img);
    session = await readPage({ file, engine, photo, onProgress: setProgress });
    if (!session.mapped.ok) {
      setProgress('');
      showPhotoError(`Tabel tidak terbaca penuh: ${session.mapped.problems.join(' ')} Foto ulang, atau isi manual.`);
      return;
    }
    row = await readRow(session, { sex: child.sex, month: child.ageMonths, engine, photo, onProgress: setProgress });
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

function openConfirm() {
  const overlay = $('overlay');
  overlay.innerHTML = renderConfirm({ child, row });
  overlay.hidden = false;
  overlay.scrollTop = 0;
  for (const kind of ['weight', 'length']) {
    const holder = overlay.querySelector(`[data-crop="${kind}"]`);
    try { holder.appendChild(photo.thumb(session.img, row.rects[kind], 260)); } catch (e) { holder.textContent = '(gambar tidak tersedia)'; }
  }
  $('c-json').value = JSON.stringify({ month: row.month, sex: row.sex, cells: row.cells, tokens: session.tokens.length });
  overlay.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => { $(`${b.dataset.fill}-input`).value = fmtNum(Number(b.dataset.value)); }));
  $('c-ok').addEventListener('click', confirmValues);
  $('c-retake').addEventListener('click', closeConfirm);
  $('m-reread').addEventListener('click', rereadRow);
}
function closeConfirm() { $('overlay').hidden = true; $('overlay').innerHTML = ''; }

async function rereadRow() {
  const month = Number($('m-input').value);
  if (!Number.isInteger(month) || month < TEMPLATE.months[0] || month > TEMPLATE.months[1]) { show('confirm-error', 'Nomor baris harus 0 sampai 24.'); return; }
  show('confirm-error', 'Membaca ulang\u2026');
  try {
    const engine = await import('./ocr-engine.js');
    row = await readRow(session, { sex: child.sex, month, engine, photo });
    openConfirm();
  } catch (e) { show('confirm-error', `Gagal membaca ulang: ${e.message}`); }
}

function sourceOf(cell, finalValue) {
  if (finalValue === null) return null;
  if (cell.value !== null && Math.abs(cell.value - finalValue) < 0.001) return cell.status === 'ok' ? 'photo_ok' : 'photo_checked';
  if (cell.candidates.some((c) => Math.abs(c - finalValue) < 0.001)) return 'photo_chosen';
  return 'photo_edited';
}

function confirmValues() {
  const weight = parseNumber($('w-input').value); const length = parseNumber($('l-input').value);
  if (weight === null || Number.isNaN(weight)) { show('confirm-error', 'Isi berat badan dengan angka, mis. 8,4.'); return; }
  if (Number.isNaN(length)) { show('confirm-error', 'Panjang badan harus berupa angka, mis. 73,0.'); return; }
  const needsCheck = ['weight', 'length'].some((k) => row.cells[k].status !== 'ok');
  if (needsCheck && !($('c-check') && $('c-check').checked)) { show('confirm-error', 'Centang "Saya sudah membandingkan angka dengan tulisan di foto".'); return; }
  const sources = { weight: sourceOf(row.cells.weight, weight), length: sourceOf(row.cells.length, length) };
  const ocr = { month: row.month, weight: { status: row.cells.weight.status, value: row.cells.weight.value, candidates: row.cells.weight.candidates }, length: { status: row.cells.length.status, value: row.cells.length.value, candidates: row.cells.length.candidates } };
  closeConfirm();
  showResult({ weightKg: weight, lengthCm: length, sources, ocr });
}

// ---------------------------------------------------------------- manual entry (no photo)
$('manual-go').addEventListener('click', () => {
  showFormError(''); showPhotoError(''); current = null; $('result').hidden = true;
  try { child = readChild(); } catch (e) { showFormError(e.message); return; }
  const weight = parseNumber($('m-weight').value); const length = parseNumber($('m-length').value);
  if (weight === null || Number.isNaN(weight) || Number.isNaN(length)) { showPhotoError('Berat dan panjang harus berupa angka, mis. 8,4.'); return; }
  showResult({ weightKg: weight, lengthCm: length, sources: { weight: 'typed', length: length === null ? null : 'typed' }, ocr: null });
});

// ---------------------------------------------------------------- result and save
function showResult({ weightKg, lengthCm, sources, ocr }) {
  const result = assess({ sex: child.sex, ageMonths: child.ageMonths, weightKg, lengthCm });
  current = { ...child, weightKg, lengthCm, result, sources, ocr };
  $('result').innerHTML = renderResult(current);
  $('result').hidden = false;
  $('save').addEventListener('click', saveCurrent);
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCurrent() {
  if (!current) return;
  if (current.result.action !== 'SCORE' && !($('checked') && $('checked').checked)) { showFormError('Centang "Saya sudah memeriksa nilai ini" sebelum menyimpan.'); $('form').scrollIntoView(); return; }
  const r = current.result;
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await addRecord({
    id, childCode: current.code || null, visitDate: current.visit, dob: current.dob, sex: current.sex, ageMonths: current.ageMonths,
    weightKg: current.weightKg, lengthCm: current.lengthCm,
    z: { bbu: r.zRounded.bbu, pbu: r.zRounded.pbu, bbpb: r.zRounded.bbpb },
    category: r.category, action: r.action, flags: r.flags,
    weightSource: current.sources.weight, lengthSource: current.sources.length, ocr: current.ocr,
    appVersion: APP_VERSION, createdAt: new Date().toISOString(), exportedAt: null,
  });
  current = null;
  $('result').hidden = true;
  $('form').reset(); $('visit').value = todayIso(); $('m-weight').value = ''; $('m-length').value = '';
  showFormError(''); showPhotoError('');
  await refreshRecords();
}

// ---------------------------------------------------------------- records and export
async function refreshRecords() {
  const records = await allRecords();
  const fresh = records.filter((r) => !r.exportedAt).length;
  $('records-summary').textContent = records.length === 0 ? 'Belum ada data.' : `${records.length} data tersimpan, ${fresh} belum diekspor.`;
  $('records-list').innerHTML = records.length === 0 ? '' : `<table><thead><tr><th>Tanggal</th><th>Kode</th><th>Usia</th><th>Status</th></tr></thead><tbody>${
    records.slice(0, 10).map((r) => `<tr><td>${esc(r.visitDate)}</td><td>${esc(r.childCode || '-')}</td><td>${esc(r.ageMonths)} bln</td><td>${r.exportedAt ? 'sudah diekspor' : 'baru'}</td></tr>`).join('')}</tbody></table>`;
}

async function shareOrDownload(filename, text) {
  const file = new File([text], filename, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

async function exportRecords(onlyNew) {
  const records = (await allRecords()).filter((r) => !onlyNew || !r.exportedAt);
  if (records.length === 0) { $('records-summary').textContent = 'Tidak ada data untuk diekspor.'; return; }
  const when = new Date().toISOString();
  const csv = toCsv(records.slice().reverse(), { includeDob: $('include-dob').checked, exportedAt: when });
  const name = `kia-tumbuh-${when.slice(0, 10)}.csv`;
  const done = await shareOrDownload(name, csv);
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
