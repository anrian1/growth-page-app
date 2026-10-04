// Coverage net for the English dictionary: run the app in INDONESIAN through the screens, collect every visible string (text and placeholders),
// and require that each one has an English text (or is a name, number or abbreviation that is the same in both languages).
// If a new screen string is added without English, this lists it.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { trText } from '../src/i18n.js';
import { script, resetScript } from './fakes.mjs';
import { $, tick, waitFor, realPack, takePhoto, boot, manual, confirmAll, setVal } from './uihelpers.js';

vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));
const seen = new Set();
const SAME = new Set(['HONAI', 'ID', 'EN', 'HR', 'RR', 'DHP', 'WHO', 'mmHg', 'OK', 'kg', 'cm', 'mg', 'Normal', 'Asessemen', 'Planning', 'TGL', 'G6PD', 'P. falciparum', 'P. vivax', 'P. ovale', 'P. malariae', 'P. knowlesi (PCR)', 'BB/U', 'PB/U', 'TB/U', 'BB/PB', 'BB/TB', 'x/menit', 'C', 'T (°C)', 'HR', 'RR', 'ACT', 'RDT', 'PCR', 'LK', 'PR', 'Normal', 'Status', 'Bahasa / Language', 'test' /* text that comes from the test harness, not the app */]);
function collect(root) {
  const walk = (n) => {
    if (n.nodeType === 3) { const p = n.parentElement; if (p && !p.closest('pre, code, textarea, script, style, .cite, [data-no-i18n]')) { const t = n.nodeValue.trim(); if (t) seen.add(t); } return; }
    if (n.nodeType !== 1) return;
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) if (n.hasAttribute(a)) seen.add(n.getAttribute(a).trim());
    n.childNodes.forEach(walk);
  };
  walk(root);
}
const snap = () => { collect(document.body); };
const popupOpen = () => !$('overlay').hidden && !!$('overlay').querySelector('#c-ok');
async function photoToPopup() { await takePhoto(); expect(await waitFor(popupOpen)).toBe(true); await tick(30); snap(); }
const choose = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
const save = async () => { $('checked') && ($('checked').checked = true); $('save').click(); await tick(60); };

beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded: [] }); snap(); });
beforeEach(() => { resetScript(); });

describe('every visible Indonesian string has an English text', () => {
  it('walks the screens and lists what has none', async () => {
    await photoToPopup(); $('c-ok').click(); await tick(30); snap();                                    // the "compare with the handwriting" error
    confirmAll(); $('c-ok').click(); await tick(80); snap();                                             // result + dose card
    for (const [id, v] of [['ma-type', 'severe'], ['ma-test', 'negative']]) choose(id, v); $('ma-go') && $('ma-go').click(); await tick(40); snap();
    choose('ma-form', 'dispersible'); choose('ma-g6pd', 'deficient'); $('ma-go').click(); await tick(40); snap();
    await save();
    script.values = { mrn: '00123499', rx1Amt: '1/4', rx1Freq: '2', rx2Name: 'Primaquine', rx3Name: 'Xyzzy' }; script.noise = new Set(['rx4Name', 'rx4Amt', 'rx5Days', 'weight', 'mrn']); script.assess = 'Malaria'; script.plan = '';
    await photoToPopup(); snap(); $('c-ok').click(); await tick(30); snap(); $('c-retake').click(); await tick(20);
    script.values = { mrn: '00123473', dobD: '4', dobM: '10', dobY: '2024', weight: '6.4', height: '85.5' }; script.noise = new Set(); script.assess = 'Malaria falsiparum';
    await photoToPopup(); confirmAll(); $('c-ok').click(); await tick(40); snap(); $('c-retake').click(); await tick(20);
    script.sex = null; script.values = { mrn: '00123555' }; await photoToPopup(); snap(); $('c-retake').click(); await tick(20);
    manual({ sex: 'L', dob: [30, 2, 2026], visit: [4, 10, 2026] }); await tick(30); snap();
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], mrn: '123' }); await tick(30); snap();
    manual({ sex: 'P', dob: [1, 3, 2012], visit: [4, 10, 2026], vitals: { height: '150', weight: '38' } }); await tick(60); snap(); await save();
    manual({ sex: 'L', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '25', height: '58,5' } }); await tick(60); snap(); await save();
    manual({ sex: 'L', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '', height: '' } }); await tick(60); snap();
    snap();
    const needs = (s) => /[A-Za-z]{3}/.test(s) && !SAME.has(s) && !/^[\d\s.,:;\/()%+\-–·x°=<>≤≥½¼¾⅓]+$/.test(s) && !/^[A-Z0-9 .\/()+%:\-–]{2,}$/.test(s) && !/^[0-9]{2}-[0-9]{4}-[0-9]{2}$/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s) && !/^[a-z0-9_-]+@/.test(s) && !/^\d+(\.\d+)?( \/ \d+)? ?(mmHg|kg|cm|C|°C|mg)$/.test(s);
    const bad = [...seen].filter((s) => needs(s) && trText(s) === s).sort();
    if (bad.length) console.log(`UNTRANSLATED (${bad.length}):\n${bad.map((b) => `  - ${b.slice(0, 160)}`).join('\n')}`);
    expect(bad).toEqual([]);
    expect(seen.size).toBeGreaterThan(150);                                                             // the walk really reached many screens
  });
});
