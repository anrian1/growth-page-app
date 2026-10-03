import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { assess, ageInMonths } from './core/zscore.js';
import { isValidCode } from './core/childcode.js';
import { toCsv } from './csv.js';
import { addRecord, allRecords, clearAll, markExported } from './storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------------------------------------------------------------- offline status
function setStatus(kind, text) { const el = $('status'); el.className = `banner ${kind}`; el.textContent = text; }
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true });
  // "ready" means the service worker is active, so every file was saved on this phone.
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
function showError(msg) { const el = $('form-error'); el.textContent = msg || ''; el.hidden = !msg; }

// ---------------------------------------------------------------- calculate
let current = null;   // the last calculation, waiting for a person to confirm

$('visit').value = todayIso();
$('form').addEventListener('submit', (event) => {
  event.preventDefault();
  showError('');
  $('result').hidden = true;
  current = null;

  const code = $('code').value.trim();
  if (code !== '' && !isValidCode(code)) { showError('Kode anak tidak cocok (angka terakhir adalah angka cek). Periksa lagi.'); return; }
  const sex = (document.querySelector('input[name=sex]:checked') || {}).value;
  if (!sex) { showError('Pilih jenis kelamin.'); return; }
  const dob = $('dob').value; const visit = $('visit').value;
  if (!dob || !visit) { showError('Isi tanggal lahir dan tanggal ukur.'); return; }
  let ageMonths;
  try { ageMonths = ageInMonths(dob, visit); } catch (e) { showError(e.message); return; }
  const weightKg = parseNumber($('weight').value);
  const lengthCm = parseNumber($('length').value);
  if (Number.isNaN(weightKg) || Number.isNaN(lengthCm)) { showError('Berat dan panjang harus berupa angka, mis. 8,4.'); return; }

  const result = assess({ sex, ageMonths, weightKg, lengthCm });
  current = { code, sex, dob, visit, ageMonths, weightKg, lengthCm, result };
  renderResult(current);
});

function renderResult(c) {
  const r = c.result;
  const needsCheck = r.action !== 'SCORE';
  const rows = [['Berat menurut umur (BB/U)', 'bbu'], ['Panjang menurut umur (PB/U)', 'pbu'], ['Berat menurut panjang (BB/PB)', 'bbpb']]
    .map(([name, k]) => `<tr><td>${name}</td><td>${esc(r.display[k] || '-')}</td><td>${esc(r.category[k] || '-')}</td></tr>`).join('');
  const flags = r.flags.length ? `<div class="flags"><strong>${needsCheck ? 'Tidak yakin: periksa dulu' : 'Catatan'}</strong><ul>${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : '';
  const sexText = c.sex === 'L' ? 'Laki-laki' : 'Perempuan';
  $('result').innerHTML = `
    <h2>Hasil</h2>
    <p class="muted">${sexText}, usia ${c.ageMonths} bulan, ${esc(c.weightKg)} kg${c.lengthCm === null ? '' : `, ${esc(c.lengthCm)} cm`}</p>
    <table><thead><tr><th>Indeks</th><th>Skor (z)</th><th>Kategori</th></tr></thead><tbody>${rows}</tbody></table>
    ${flags}
    <p class="human">Ini alat bantu skrining, bukan diagnosis. Petugas yang memutuskan.</p>
    ${needsCheck ? '<label class="inline"><input id="checked" type="checkbox" /> Saya sudah memeriksa nilai ini</label>' : ''}
    <button id="save" class="primary" type="button">Konfirmasi dan simpan</button>`;
  $('result').hidden = false;
  $('save').addEventListener('click', saveCurrent);
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCurrent() {
  if (!current) return;
  if (current.result.action !== 'SCORE' && !($('checked') && $('checked').checked)) { showError('Centang "Saya sudah memeriksa nilai ini" sebelum menyimpan.'); $('form').scrollIntoView(); return; }
  const r = current.result;
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await addRecord({
    id, childCode: current.code || null, visitDate: current.visit, dob: current.dob, sex: current.sex, ageMonths: current.ageMonths,
    weightKg: current.weightKg, lengthCm: current.lengthCm,
    z: { bbu: r.zRounded.bbu, pbu: r.zRounded.pbu, bbpb: r.zRounded.bbpb },
    category: r.category, action: r.action, flags: r.flags, appVersion: APP_VERSION,
    createdAt: new Date().toISOString(), exportedAt: null,
  });
  current = null;
  $('result').hidden = true;
  $('form').reset();
  $('visit').value = todayIso();
  showError('');
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
