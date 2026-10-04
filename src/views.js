// HTML pieces for the confirmation popup and the result card (Bahasa Indonesia). Text from photos is always escaped.
import { TABLET_OPTIONS } from './malaria.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 5 -> "5,0" (Indonesian decimal comma)
export const fmtNum = (v) => (v === null || v === undefined ? '' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));
export const fmtField = (v, decimals) => (v === null || v === undefined ? '' : decimals === 0 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));

const STATUS = {
  ok: { icon: '\u2714', cls: 'st-ok', text: 'Bacaan konsisten. Tetap bandingkan dengan foto.' },
  check: { icon: '\u26a0', cls: 'st-check', text: 'Periksa: bacaan kurang yakin.' },
  unreadable: { icon: '\u2716', cls: 'st-bad', text: 'Tidak terbaca jelas. Pilih atau ketik nilainya.' },
  empty: { icon: '\u2013', cls: 'st-empty', text: 'Kotak tampak kosong. Isi jika ada tulisan.' },
};
const RANK = { ok: 0, empty: 1, check: 2, unreadable: 3 };
const worst = (list) => list.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'ok');
const chip = (status, text) => { const st = STATUS[status] || STATUS.unreadable; return `<p class="chip ${st.cls}">${st.icon} ${text || st.text}</p>`; };

const FIELD_ORDER = ['hr', 'rr', 'temp', 'height', 'weight'];
const SHORT = { dobD: 'tgl', dobM: 'bln', dobY: 'tahun', tglD: 'tgl', tglM: 'bln', tglY: 'tahun' };

function candidates(key, cell, decimals) {
  if (!cell.candidates.length) return '';
  const sh = SHORT[key] ? `${SHORT[key]}: ` : '';
  return `<div class="cands">${sh}Pilihan bacaan: ${cell.candidates.map((v) => `<button type="button" class="chip-btn" data-fill="${key}" data-value="${esc(v)}" data-text="${esc(fmtField(v, decimals))}">${esc(fmtField(v, decimals))}</button>`).join(' ')}</div>`;
}
function input(key, field, cell, extra = '') {
  return `<label>${extra}<input id="f-${key}" inputmode="decimal" autocomplete="off" value="${esc(fmtField(cell.value, field.decimals))}" /></label>`;
}
function measure(key, field, cell) {
  return `<div class="measure" data-kind="${key}"><h3>${esc(field.label)}${field.unit ? ` (${esc(field.unit)})` : ''}</h3>
    <div class="crop" data-crop="${key}"></div>${chip(cell.status)}
    ${input(key, field, cell, `Nilai${field.unit ? ` (${esc(field.unit)})` : ''}`)}${candidates(key, cell, field.decimals)}</div>`;
}

export function renderDebug(row) {
  const lines = Object.entries(row.cells).map(([k, c]) => `${k}: status=${c.status} value=${c.value} ink=${c.ink === null ? '?' : c.ink.toFixed(3)}\n  ${c.readings.map((r) => `${r.source}="${r.text}"`).join('  ')}`);
  lines.push(`sex: ${JSON.stringify(row.sex)} ratios=${JSON.stringify(row.ticks.ratios)}`);
  return lines.join('\n');
}

/** The popup. Pictures go into the .crop placeholders afterwards (they are canvases). fields: MEDREC.fields. */
export function renderRecordConfirm({ row, fields }) {
  const c = row.cells;
  const needsCheck = Object.values(c).some((x) => x.status !== 'ok') || row.sex.status !== 'ok';
  const sexBlock = `<div class="measure" data-block="sex"><h3>Jenis kelamin (kotak LK / PR)</h3>
    <div class="crop" data-crop="strip-sex"></div>
    ${chip(row.sex.status, row.sex.status === 'ok' ? `Tanda terdeteksi: ${row.sex.sex === 'L' ? 'LK' : 'PR'}` : `${row.sex.status === 'check' ? 'Periksa: ' : 'Tidak yakin: '}${esc(row.sex.why.join('; '))}. Pilih jenis kelamin.`)}
    <label class="inline"><input type="radio" name="rc-sex" value="L"${row.sex.sex === 'L' ? ' checked' : ''} /> Laki-laki (LK)</label>
    <label class="inline"><input type="radio" name="rc-sex" value="P"${row.sex.sex === 'P' ? ' checked' : ''} /> Perempuan (PR)</label></div>`;
  const dateBlock = (id, title, parts) => `<div class="measure" data-block="${id}"><h3>${title}</h3>
    <div class="crop" data-crop="strip-${id}"></div>${chip(worst(parts.map((k) => c[k].status)))}
    <div class="trio">${parts.map((k) => `<label>${SHORT[k]}<input id="f-${k}" inputmode="numeric" autocomplete="off" value="${esc(fmtField(c[k].value, 0))}" /></label>`).join('')}</div>
    ${parts.map((k) => candidates(k, c[k], 0)).join('')}</div>`;
  const td = `<div class="measure" data-block="td"><h3>Tekanan darah, TD (mmHg)</h3>
    <div class="crop" data-crop="strip-td"></div>${chip(worst([c.sys.status, c.dia.status]))}
    <div class="trio">${['sys', 'dia'].map((k) => `<label>${k === 'sys' ? 'sistolik' : 'diastolik'}<input id="f-${k}" inputmode="numeric" autocomplete="off" value="${esc(fmtField(c[k].value, 0))}" /></label>`).join('')}</div>
    ${candidates('sys', c.sys, 0)}${candidates('dia', c.dia, 0)}</div>`;
  return `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title">Periksa hasil bacaan</h2>
    <p class="muted">Bandingkan setiap angka dengan gambar tulisan di atasnya. Halaman contoh sintetis (bukan formulir resmi).</p>
    <h3 class="group">Identitas dan tanggal</h3>
    ${sexBlock}${dateBlock('dob', 'Tanggal lahir', ['dobD', 'dobM', 'dobY'])}${dateBlock('tgl', 'TGL kunjungan (kolom TGL)', ['tglD', 'tglM', 'tglY'])}
    <div class="ageline"><p id="rc-age" class="human"></p><div id="rc-age-flags"></div></div>
    <h3 class="group">Tanda vital</h3>
    ${td}${FIELD_ORDER.map((k) => measure(k, fields[k], c[k])).join('')}
    <h3 class="group">Teks bebas (hanya gambar, tidak dibaca AI)</h3>
    <div class="measure"><h3>Keluhan</h3><div class="crop" data-crop="pic-keluhan"></div></div>
    <div class="measure"><h3>Asessemen (diagnosis)</h3><div class="crop" data-crop="pic-asessmen"></div></div>
    <div class="measure"><h3>Planning</h3><div class="crop" data-crop="pic-planning"></div></div>
    <label>Kode pasien (6 angka, boleh dikosongkan)<input id="rc-code" inputmode="numeric" maxlength="6" placeholder="mis. 482133" autocomplete="off" /></label>
    ${needsCheck ? '<label class="inline"><input id="c-check" type="checkbox" /> Saya sudah membandingkan semua angka dengan tulisan di foto</label>' : ''}
    <p id="confirm-error" class="error" hidden></p>
    <p class="human">Alat bantu skrining dan dokumentasi. Petugas yang memutuskan.</p>
    <div class="row"><button type="button" id="c-ok" class="primary">Konfirmasi</button><button type="button" id="c-retake" class="secondary">Foto ulang</button></div>
    <details><summary>Detail teknis</summary><pre id="c-debug">${esc(renderDebug(row))}</pre><textarea id="c-json" rows="2" readonly></textarea></details>
  </div>`;
}

// ---------------------------------------------------------------- result
const VROWS = [['TD', (v) => (v.sys === null && v.dia === null ? '-' : `${v.sys ?? '?'} / ${v.dia ?? '?'} mmHg`)], ['HR', (v) => (v.hr === null ? '-' : `${v.hr} x/menit`)], ['RR', (v) => (v.rr === null ? '-' : `${v.rr} x/menit`)],
  ['T', (v) => (v.temp === null ? '-' : `${fmtField(v.temp, 1)} \u00b0C`)], ['TB', (v) => (v.height === null ? '-' : `${fmtField(v.height, 1)} cm`)], ['BB', (v) => (v.weight === null ? '-' : `${fmtField(v.weight, 1)} kg`)]];

export function renderRecordResult(c, malariaInfo = null) {
  const n = c.nutrition; const sexText = c.sex === 'L' ? 'Laki-laki' : 'Perempuan';
  let nutritionHtml;
  if (c.scope === 'nutrition' && n && n.action !== 'OUT_OF_SCOPE' && !String(n.action).startsWith('BLOCK')) {
    const rows = [['bbu'], ['pbu'], ['bbpb']].map(([k]) => `<tr><td>${esc(n.names[k])}</td><td>${esc(n.display[k] || '-')}</td><td>${esc(n.category[k] || '-')}</td></tr>`).join('');
    nutritionHtml = `<h3>Status gizi (WHO 2006, 0\u201359 bulan)</h3><table><thead><tr><th>Indeks</th><th>Skor (z)</th><th>Kategori</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">${n.standing ? 'Umur 24 bulan ke atas: tabel tinggi badan berdiri.' : 'Di bawah 24 bulan: tabel panjang badan berbaring.'} Kategori memakai skor 2 desimal yang tampil.</p>`;
  } else if (c.scope === 'dose-only') nutritionHtml = '<h3>Status gizi</h3><p class="muted">Untuk umur 5\u201318 tahun, tabel WHO 2007 belum dipasang (tahap berikutnya). Status gizi tidak dihitung. Pemeriksaan dosis tetap tersedia.</p>';
  else nutritionHtml = '<h3>Status gizi</h3><p class="muted">Status gizi tidak dapat dihitung dari data ini.</p>';
  const flags = c.flags.length ? `<div class="flags"><strong>${c.mustCheck ? 'Periksa dulu' : 'Catatan'}</strong><ul>${c.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : '';
  return `<h2>Hasil</h2>
    <p class="muted">${sexText}, ${esc(c.ageText)}${c.visit ? `, TGL ${esc(c.visit)}` : ''}</p>
    <table><tbody>${VROWS.map(([name, f]) => `<tr><td>${name}</td><td>${esc(f(c.values))}</td></tr>`).join('')}</tbody></table>
    ${nutritionHtml}${flags}
    <p class="human">Ini alat bantu skrining, bukan diagnosis. Petugas yang memutuskan.</p>
    ${malariaInfo ? renderMalariaCard(c, malariaInfo) : ''}
    ${c.mustCheck ? '<label class="inline"><input id="checked" type="checkbox" /> Saya sudah memeriksa nilai ini</label>' : ''}
    <button id="save" class="primary" type="button">Simpan</button>`;
}

// ---------------------------------------------------------------- malaria dose check
const tabletOptions = () => '<option value="">pilih</option>' + TABLET_OPTIONS.map((o) => `<option value="${o.value}">${esc(o.label)}</option>`).join('');

/** The optional card under the result. info: { ok, pack, absent, errors }. c needs: weightKg, ageMonths, ageYears, sex, bbpbCategory, weightUncertain. */
export function renderMalariaCard(c, info) {
  if (!info || !info.ok) {
    const why = info && info.errors && info.errors.length ? `Paket dosis malaria tidak valid dan tidak dipakai: ${esc(info.errors.join(' | '))}` : 'Paket dosis malaria tidak terpasang.';
    return `<div class="guide"><h3>Periksa dosis antimalaria</h3><p class="muted">${why}</p></div>`;
  }
  const pk = info.pack;
  const species = Object.entries(pk.species).map(([k, sp]) => `<option value="${esc(k)}">${esc(sp.label)}</option>`).join('');
  const female10 = c.sex === 'P' && c.ageYears >= 10;
  return `<details id="ma-details" class="guide"><summary><strong>Periksa dosis antimalaria</strong> (opsional)</summary>
    <p class="muted">Membandingkan dosis yang ditulis dengan tabel pedoman untuk berat badan ${esc(c.weightKg ?? '-')} kg${c.weightUncertain ? ' (berat masih ditandai tidak pasti)' : ''}. ${pk.draft ? '<strong>DRAF: tabel belum ditinjau dokter.</strong>' : `Ditinjau oleh ${esc(pk.reviewedBy)}.`}</p>
    <label>Hasil pemeriksaan darah malaria
      <select id="ma-test"><option value="none">belum ada hasil</option><option value="positive">positif</option><option value="negative">negatif</option></select></label>
    <label>Jenis pengobatan
      <select id="ma-type"><option value="uncomplicated">tanpa komplikasi (DHP + primakuin)</option><option value="severe">malaria berat (artesunat injeksi)</option></select></label>
    <label>Jenis plasmodium<select id="ma-species"><option value="">pilih</option>${species}</select></label>
    <div id="ma-uncomplicated">
      <label>Sediaan DHP<select id="ma-form"><option value="standard">tablet biasa</option><option value="dispersible">tablet dispersibel (anak)</option></select></label>
      <label>DHP, tablet per hari<select id="ma-dhp-tabs">${tabletOptions()}</select></label>
      <label>DHP, lama (hari)<input id="ma-dhp-days" inputmode="numeric" placeholder="mis. 3" /></label>
      <label>Primakuin, tablet per hari<select id="ma-pq-tabs">${tabletOptions()}</select></label>
      <label>Primakuin, lama (hari)<input id="ma-pq-days" inputmode="numeric" placeholder="mis. 1 atau 14" /></label>
    </div>
    <div id="ma-severe" hidden>
      <label>Artesunat dosis awal yang ditulis (mg)<input id="ma-art-mg" inputmode="decimal" placeholder="mis. 36" /></label>
    </div>
    ${female10 ? '<label>Kehamilan dan menyusui<select id="ma-preg"><option value="none">tidak hamil, tidak menyusui bayi &lt;6 bulan</option><option value="pregnant">hamil</option><option value="breastfeeding">menyusui bayi &lt;6 bulan</option></select></label>' : ''}
    <label>Defisiensi G6PD<select id="ma-g6pd"><option value="unknown">tidak diketahui</option><option value="deficient">defisiensi G6PD diketahui</option></select></label>
    <button id="ma-go" type="button" class="secondary">Periksa dosis</button>
    <div id="ma-out"></div>
    <details><summary>Yang tidak dicakup</summary><ul>${pk.scope.doesNotCover.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
  </details>`;
}

const MA_STATUS = {
  match: { cls: 'st-ok', text: '\u2714 Sesuai dengan tabel pedoman untuk jumlah yang dibandingkan.' },
  differs: { cls: 'st-check', text: '\u26a0 Berbeda dari tabel pedoman. Periksa temuan di bawah.' },
  cannot_check: { cls: 'st-empty', text: '\u2013 Tidak dapat diperiksa. Tidak yakin: tanyakan ke dokter.' },
  nothing_to_compare: { cls: 'st-empty', text: '\u2013 Belum ada jumlah yang ditulis untuk dibandingkan.' },
};

export function renderMalariaOut(outcome, pack) {
  const st = MA_STATUS[outcome.status];
  const rows = outcome.compared.length ? `<table><thead><tr><th>Obat</th><th>Pedoman</th><th>Ditulis</th><th></th></tr></thead><tbody>${outcome.compared.map((r) => `<tr><td>${esc(r.drug)}</td><td>${esc(r.expected)}</td><td>${esc(r.entered)}</td><td>${r.same ? '\u2714' : '\u26a0'}</td></tr>`).join('')}</tbody></table>` : '';
  const cite = (ct) => (ct ? `<p class="cite">${esc(pack.source.name)}, ${ct.page ? `hal. ${esc(ct.page)}` : ''}${ct.page && ct.section ? ', ' : ''}${ct.section ? esc(ct.section) : ''}: &ldquo;${esc(ct.quote)}&rdquo;</p>` : '');
  const list = outcome.findings.length ? `<ul class="rules">${outcome.findings.map((f) => `<li class="rule ${f.level}"><p>${esc(f.text)}</p>${cite(f.cite)}</li>`).join('')}</ul>` : '';
  return `<p class="chip ${st.cls}">${st.text}</p>${rows}${list}<p class="human">Bukan keputusan klinis. Dokter yang memutuskan.</p>`;
}
