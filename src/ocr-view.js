// Builds the small HTML pieces shown on the OCR test page (kept separate so they can be tested).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLUMN_NAMES = { 'L-weight': 'Laki-laki, berat', 'L-length': 'Laki-laki, panjang', 'P-weight': 'Perempuan, berat', 'P-length': 'Perempuan, panjang' };
const ICON = { ok: '\u2714', check: '\u26a0', unreadable: '\u2716', missing: '\u2013' };

export function renderCellsTable(mapped) {
  if (!mapped.ok) return `<p class="bad">Could not map the page: ${esc(mapped.problems.join(' '))}</p>`;
  const cells = Object.values(mapped.cells).sort((a, b) => a.month - b.month || a.column.localeCompare(b.column));
  const hidden = mapped.unreadable.map((u) => `<tr><td>${esc(COLUMN_NAMES[u.column])}</td><td>${u.months.join(', ')}</td><td colspan="2">\u2716 ink found, could not read</td></tr>`).join('');
  const rows = cells.map((c) => `<tr><td>${esc(COLUMN_NAMES[c.column])}</td><td>${c.month}</td><td>${c.value === null ? '' : esc(c.value)}</td><td>${ICON[c.status]} ${esc(c.status === 'ok' ? '' : c.why.join('; '))}</td></tr>`).join('');
  return `<table><thead><tr><th>Column</th><th>Month</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows}${hidden}</tbody></table>`;
}

export function renderRowResult(row) {
  const part = (label, p) => `<li><b>${label}:</b> ${p.value === null ? '<span class="bad">no value</span>' : `<span class="${p.status === 'ok' ? 'ok' : 'bad'}">${esc(p.value)}</span>`} <span class="muted">(${ICON[p.status]} ${esc(p.status)}${p.cell ? `, read as "${esc(p.cell.text)}"` : ''})</span></li>`;
  const flags = row.flags.length ? `<ul>${row.flags.map((f) => `<li class="bad">${esc(f)}</li>`).join('')}</ul>` : '<p class="ok">No flags.</p>';
  return `<p><b>${row.sex === 'L' ? 'Laki-laki' : 'Perempuan'}, month ${row.month}</b></p><ul>${part('Weight', row.weight)}${part('Length', row.length)}</ul>${flags}`;
}
