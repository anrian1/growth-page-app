// Interface language: Indonesian (default, for clinic staff) or English (for judges, reviewers and other countries).
// HOW IT WORKS: every screen string in the code is written in Indonesian. In English mode, each piece of text is looked up in the dictionary
// (src/i18n-en.js) when it is put on the screen. A piece that is not in the dictionary stays Indonesian, which is harmless.
// WHAT IT NEVER TOUCHES: saved data, the CSV exports, the guideline quotes (shown as the original Indonesian text), raw reading text, and anything a person typed.
import { EN } from './i18n-en.js';

export const LANG_KEY = 'honai-lang';
export const hooks = { reload: () => globalThis.location.reload() };

/** ?lang=en or ?lang=id wins (and is remembered); otherwise the remembered choice; otherwise Indonesian. */
export function currentLang(win = globalThis) {
  try {
    const q = new URLSearchParams(win.location.search).get('lang');
    if (q === 'en' || q === 'id') { try { win.localStorage.setItem(LANG_KEY, q); } catch { /* storage blocked: the choice is not remembered */ } return q; }
    const s = win.localStorage.getItem(LANG_KEY);
    if (s === 'en' || s === 'id') return s;
  } catch { /* no window (tests): default */ }
  return 'id';
}
export const lang = currentLang();

// ---------------------------------------------------------------- dictionary lookup
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = new Map();
const patterns = [];
// In a key, {} is a value that stays inside one sentence (so a pattern never swallows the next sentence); {*} may span several sentences.
const ARG = '((?:(?![.!?]\\s+[A-Z\\u201c"]).)+?)';
const ANY = '([\\s\\S]+?)';
const compile = (key) => new RegExp(`^${key.split(/(\{\*\}|\{\})/).map((p) => (p === '{}' ? ARG : p === '{*}' ? ANY : escapeRe(p))).join('')}$`, 's');
for (const [id, en] of Object.entries(EN)) {
  if (/\{\*?\}/.test(id)) patterns.push({ re: compile(id), en, len: id.length });
  else exact.set(id, en);
}
patterns.sort((a, b) => b.len - a.len);
// Phrase fallback: inside a longer text, only long or multi-word keys are replaced (short single words are matched whole only).
const phraseKeys = [...exact.keys()].filter((k) => k.length >= 14 || k.includes(' ')).sort((a, b) => b.length - a.length);
const phraseRe = phraseKeys.length ? new RegExp(phraseKeys.map(escapeRe).join('|'), 'g') : null;

const plural = (n, w) => `${n} ${w}${Number(n) === 1 ? '' : 's'}`;
const FN = [
  [/^(\d+) tahun (\d+) bulan$/, (y, m) => `${plural(y, 'year')} ${plural(m, 'month')}`],
  [/^(\d+) tahun$/, (y) => plural(y, 'year')],
  [/^(\d+) bulan$/, (m) => plural(m, 'month')],
  [/^(\d+) hari$/, (d) => plural(d, 'day')],
  [/^(Laki-laki|Perempuan), (.+?)(?:, TGL (.+))?$/, (s, age, visit) => `${s === 'Laki-laki' ? 'Male' : 'Female'}, ${trText(age)}${visit ? `, visit ${visit}` : ''}`],
];
const num = (a) => (/^-?\d+,\d+$/.test(a) ? a.replace(',', '.') : a);
function fill(en, args) { let i = 0; return en.replace(/\{\}/g, () => num(trText(args[i++] ?? ''))); }

function whole(s) {
  if (exact.has(s)) return exact.get(s);
  for (const [re, fn] of FN) { const m = re.exec(s); if (m) return fn(...m.slice(1)); }
  for (const p of patterns) { const m = p.re.exec(s); if (m) return fill(p.en, m.slice(1)); }
  return null;
}
/** Translate one piece of text. Leading and trailing marks and spaces (check marks, dashes) are kept as they are. */
export function trText(str) {
  const text = String(str);
  const [, lead, core, trail] = /^([\s\u2714\u26a0\u2716\u2013]*)([\s\S]*?)([\s\u2714\u26a0\u2716\u2013]*)$/.exec(text);
  if (!core) return text;
  let out = whole(core);
  if (out === null) {
    const parts = core.split(/(?<=[.!?;])\s+/);
    const one = (p) => { const w = whole(p); return w !== null ? w : (phraseRe ? p.replace(phraseRe, (k) => exact.get(k)) : p); };
    out = parts.length > 1 ? parts.map(one).join(' ') : one(core);
  }
  return lead + out + trail;
}
/** For messages built in code (confirm boxes): English in English mode, unchanged otherwise. */
export const t = (s) => (lang === 'en' ? trText(s) : s);

// ---------------------------------------------------------------- the screen
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'PRE', 'CODE', 'TEXTAREA', 'NOSCRIPT']);
const done = new WeakMap();   // text node -> the English text we put there, so an update by the app is translated again but our own change is not
const citeEn = (v) => v.replace(', hal. ', ', p. ').replace(/\u201d\s*$/, '\u201d (original Indonesian text)');

function textNode(node) {
  const p = node.parentElement;
  if (!p || SKIP.has(p.tagName) || p.closest('pre, code, textarea, [data-no-i18n]')) return;
  const v = node.nodeValue;
  if (!v || !v.trim() || done.get(node) === v) return;
  const out = p.classList.contains('cite') ? citeEn(v) : trText(v);
  done.set(node, out);
  if (out !== v) node.nodeValue = out;
}
function attrs(el) {
  for (const a of ATTRS) { if (!el.hasAttribute || !el.hasAttribute(a)) continue; const v = el.getAttribute(a); const o = trText(v); if (o !== v) el.setAttribute(a, o); }
}
function walk(node) {
  if (node.nodeType === 3) { textNode(node); return; }
  if (node.nodeType !== 1 || SKIP.has(node.tagName) || node.hasAttribute('data-no-i18n')) return;
  attrs(node);
  node.childNodes.forEach(walk);
}

/** Call once at start. In English mode this translates the page now and everything the app draws later. */
export function initI18n(root = document.body) {
  document.documentElement.lang = lang;
  if (lang !== 'en') return;
  walk(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'attributes') attrs(m.target);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** The ID | EN buttons in the header. Switching reloads the page; if something is open and unsaved, a person must agree first. */
export function bindLangToggle({ needsConfirm = () => false } = {}) {
  for (const code of ['id', 'en']) {
    const el = document.getElementById(`lang-${code}`);
    if (!el) continue;
    el.setAttribute('aria-pressed', String(code === lang));
    el.classList.toggle('on', code === lang);
    el.addEventListener('click', () => {
      if (code === lang) return;
      if (needsConfirm() && !globalThis.confirm('Mengganti bahasa memuat ulang halaman dan menghapus isian yang belum disimpan. Lanjutkan?\nChanging the language reloads the page and clears anything not saved. Continue?')) return;
      try { localStorage.setItem(LANG_KEY, code); } catch { /* not remembered */ }
      try { const u = new URL(globalThis.location.href); if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); globalThis.history.replaceState(null, '', u); } } catch { /* ignore */ }
      hooks.reload();
    });
  }
}
