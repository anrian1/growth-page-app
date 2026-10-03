// HTML pieces for the confirmation popup and the result card. Text from photos is always escaped.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 5 -> "5,0" (Indonesian decimal comma)
export const fmtNum = (v) => (v === null || v === undefined ? '' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));

const STATUS = {
  ok: { icon: '\u2714', cls: 'st-ok', text: 'Bacaan konsisten. Tetap bandingkan dengan foto.' },
  check: { icon: '\u26a0', cls: 'st-check', text: 'Periksa: bacaan kurang yakin.' },
  unreadable: { icon: '\u2716', cls: 'st-bad', text: 'Tidak terbaca jelas. Pilih atau ketik nilainya.' },
  empty: { icon: '\u2013', cls: 'st-empty', text: 'Kolom tampak kosong. Isi jika ada tulisan.' },
};

function measure(kind, label, unit, cell) {
  const st = STATUS[cell.status] || STATUS.unreadable;
  const id = kind === 'weight' ? 'w' : 'l';
  const chips = cell.candidates.length
    ? `<div class="cands">Pilihan bacaan: ${cell.candidates.map((v) => `<button type="button" class="chip-btn" data-fill="${id}" data-value="${esc(v)}">${esc(fmtNum(v))}</button>`).join(' ')}</div>`
    : '';
  return `<div class="measure" data-kind="${kind}">
    <h3>${label} (${unit})</h3>
    <div class="crop" data-crop="${kind}"></div>
    <p class="chip ${st.cls}">${st.icon} ${st.text}</p>
    <label>Nilai (${unit})<input id="${id}-input" inputmode="decimal" autocomplete="off" value="${esc(fmtNum(cell.value))}" /></label>
    ${chips}
  </div>`;
}

export function renderDebug(row) {
  const lines = ['weight', 'length'].map((k) => {
    const c = row.cells[k];
    return `${k}: status=${c.status} value=${c.value} ink=${c.ink === null ? '?' : c.ink.toFixed(3)}\n  ${c.readings.map((r) => `${r.source}="${r.text}"`).join('  ')}\n  ${c.why.join('; ')}`;
  });
  return lines.join('\n');
}

/** The popup: pictures go into the .crop placeholders afterwards (they are canvases). */
export function renderConfirm({ child, row }) {
  const sexText = child.sex === 'L' ? 'Laki-laki' : 'Perempuan';
  const flags = row.flags.length ? `<div class="flags"><ul>${row.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : '';
  const hint = row.hint ? `<div class="flags">Baris bulan ${row.month} kosong. Tulisan terakhir terlihat di bulan ${row.hint.latestMonth}. Ganti nomor baris di atas bila itu yang dimaksud.</div>` : '';
  const needsCheck = ['weight', 'length'].some((k) => row.cells[k].status !== 'ok');
  return `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title">Periksa hasil bacaan</h2>
    <p class="muted">${sexText}, usia ${child.ageMonths} bulan. Baris bulan
      <input id="m-input" type="number" min="0" max="24" value="${row.month}" style="width:4.5em" />
      <button type="button" id="m-reread" class="secondary small">Baca ulang baris</button></p>
    ${flags}${hint}
    ${measure('weight', 'Berat badan', 'kg', row.cells.weight)}
    ${measure('length', 'Panjang badan', 'cm', row.cells.length)}
    ${needsCheck ? '<label class="inline"><input id="c-check" type="checkbox" /> Saya sudah membandingkan angka dengan tulisan di foto</label>' : ''}
    <p id="confirm-error" class="error" hidden></p>
    <p class="human">Alat bantu skrining. Petugas yang memutuskan.</p>
    <div class="row"><button type="button" id="c-ok" class="primary">Konfirmasi</button><button type="button" id="c-retake" class="secondary">Foto ulang</button></div>
    <details><summary>Detail teknis</summary><pre id="c-debug">${esc(renderDebug(row))}</pre><textarea id="c-json" rows="2" readonly></textarea></details>
  </div>`;
}

export function renderResult(c) {
  const r = c.result;
  const needsCheck = r.action !== 'SCORE';
  const rows = [['Berat menurut umur (BB/U)', 'bbu'], ['Panjang menurut umur (PB/U)', 'pbu'], ['Berat menurut panjang (BB/PB)', 'bbpb']]
    .map(([name, k]) => `<tr><td>${name}</td><td>${esc(r.display[k] || '-')}</td><td>${esc(r.category[k] || '-')}</td></tr>`).join('');
  const flags = r.flags.length ? `<div class="flags"><strong>${needsCheck ? 'Tidak yakin: periksa dulu' : 'Catatan'}</strong><ul>${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : '';
  const sexText = c.sex === 'L' ? 'Laki-laki' : 'Perempuan';
  return `<h2>Hasil</h2>
    <p class="muted">${sexText}, usia ${c.ageMonths} bulan, ${esc(c.weightKg)} kg${c.lengthCm === null ? '' : `, ${esc(c.lengthCm)} cm`}</p>
    <table><thead><tr><th>Indeks</th><th>Skor (z)</th><th>Kategori</th></tr></thead><tbody>${rows}</tbody></table>
    ${flags}
    <p class="human">Ini alat bantu skrining, bukan diagnosis. Petugas yang memutuskan.</p>
    ${needsCheck ? '<label class="inline"><input id="checked" type="checkbox" /> Saya sudah memeriksa nilai ini</label>' : ''}
    <button id="save" class="primary" type="button">Simpan</button>`;
}
