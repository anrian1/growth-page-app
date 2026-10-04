// English mode, end to end: the real index.html and src/main.js with English chosen, the scripted fake camera and engine.
// It walks the whole flow (page, popup, errors, result, dose check, warnings, export) and fails if any Indonesian is left on a screen,
// except what is meant to stay: the guideline quotes (original Indonesian text), the raw reading text, and the bracketed Indonesian category terms.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { allRecords } from '../src/storage.js';
import { LINK_COLUMNS, ANALYSIS_COLUMNS } from '../src/csv.js';
import { script, resetScript } from './fakes.mjs';
import { $, tick, waitFor, readBlob, realPack, takePhoto, boot, manual, confirmAll } from './uihelpers.js';

vi.hoisted(() => { localStorage.setItem('honai-lang', 'en'); });          // chosen before main.js starts
vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));
const downloaded = [];
const popupOpen = () => !$('overlay').hidden && !!$('overlay').querySelector('#c-ok');
const WORDS = /\b(tidak|belum|yang|dan|atau|untuk|dengan|dari|pilih|periksa|obat|berat|hari|kali|nomor|tanggal|lahir|simpan|hasil|bacaan|tulisan|gambar|sudah|harus|isi|jenis|kosong|angka|kotak|catatan|umur|bulan|tahun|kelamin|laki|perempuan|resep|baris|dosis|pedoman|ditulis|dicatat|diperiksa|terbaca|dibaca|masih|bisa|ketik|centang|ulang|salah|semua|bandingkan|ditinjau|dikenali|dihitung|tersedia)\b/gi;
/** Indonesian words still on screen, ignoring quotes (.cite), raw reading text (pre, code) and brackets (the category terms). */
function leftover(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('.cite, pre, code, script, style').forEach((n) => n.remove());
  const text = c.textContent.replace(/\([^)]*\)/g, ' ');
  return [...new Set([...text.matchAll(WORDS)].map((m) => `${m[0].toLowerCase()}: ...${text.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\s+/g, ' ')}...`))];   // the word and its surroundings
}
async function photoToPopup() { await takePhoto(); expect(await waitFor(popupOpen)).toBe(true); await tick(40); }
async function confirmToResult() { confirmAll(); $('c-ok').click(); await tick(80); }
const save = async () => { $('checked') && ($('checked').checked = true); $('save').click(); await tick(80); };

beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded }); });
beforeEach(() => { resetScript(); });

describe('English mode', () => {
  it('translates the page, the header tagline and the empty list, and the EN button is the active one', () => {
    expect(document.documentElement.lang).toBe('en');
    expect(document.querySelector('h1').textContent).toBe('HONAI');
    expect(document.querySelector('.sub').textContent).toBe('AI-based health information bridging and clinical decision support');
    expect(document.querySelector('label.photo-btn').textContent).toContain('Take a photo');
    expect($('records-summary').textContent).toBe('No data yet.');
    expect($('lang-en').getAttribute('aria-pressed')).toBe('true'); expect($('lang-id').getAttribute('aria-pressed')).toBe('false');
    expect($('man-mrn').closest('label').textContent).toContain('Medical record number (8 digits)');
    expect(leftover(document.body)).toEqual([]);
  });

  it('the popup is in English: identity, dates, vitals, prescription rows, drug names', async () => {
    await photoToPopup();
    const text = $('overlay').textContent;
    for (const s of ['Check the readings', 'Medical record number (8 digits: the linking key)', 'Sex (LK / PR boxes)', 'Prescription rows', 'Primaquine', 'Empty rows (2)', 'Tablets per dose', 'Times per day', 'Blood pressure, TD (mmHg)', 'The patient name is not read, not saved and not exported']) expect(text).toContain(s);
    expect($('rx1-perday').textContent).toContain('tablets per day (tablets per dose x times per day)');
    expect($('c-ok').textContent).toBe('Confirm');
    expect(leftover($('overlay'))).toEqual([]);
  });

  it('the confirm error is in English; the dose check says "matches"; the result is in English', async () => {
    $('c-check') && ($('c-check').checked = true);
    $('c-ok').click(); await tick(30);
    expect($('confirm-error').textContent).toContain('Tick "Matches the handwriting"');
    expect(leftover($('confirm-error'))).toEqual([]);
    await confirmToResult();
    const text = $('result').textContent;
    for (const s of ['Record no. 00-1234-56', 'Male, 9 months', 'Nutritional status (WHO 2006, 0–59 months)', 'not a diagnosis', 'Check the antimalarial dose', 'Not a clinical decision']) expect(text).toContain(s);
    expect($('ma-out').textContent).toContain('Matches the guideline table');
    expect($('ma-details').textContent).toContain('which you confirmed');
    expect(leftover($('result'))).toEqual([]);
    await save();
  });

  it('DHP twice a day: the warning is in English and the quote stays the original Indonesian, labelled as such', async () => {
    script.values = { mrn: '00123499', rx1Amt: '1/4', rx1Freq: '2' };
    await photoToPopup(); await confirmToResult();
    expect($('ma-out').textContent).toContain('Differs from the guideline table');
    expect($('ma-out').textContent).toContain('DHP written 2 times per day');
    const cites = [...document.querySelectorAll('#ma-out .cite')].map((c) => c.textContent);
    expect(cites.length).toBeGreaterThan(0);
    expect(cites.every((c) => c.includes('(original Indonesian text)') && /, p\. /.test(c))).toBe(true);
    expect(cites.some((c) => c.includes('H1 pada dosis kedua'))).toBe(true);                       // the quote itself is untouched
    expect(leftover($('result'))).toEqual([]);
    await save();
  });

  it('an impossible weight for the age: the warning, its reason and the tick box are in English', async () => {
    script.values = { mrn: '00123473', dobD: '4', dobM: '10', dobY: '2024', weight: '6.4', height: '85.5' };
    await photoToPopup();
    const w = $('rc-plausibility').textContent;
    expect(w).toContain('Check the weight and height on the paper'); expect(w).toContain('do not fit age 2 years'); expect(w).toContain('are correct (checked on the paper)');
    expect(leftover($('overlay'))).toEqual([]);
    $('c-retake').click(); await tick(20);
  });

  it('typed-in entry: the age line, the errors, the nutrition flags and the categories are in English', async () => {
    manual({ sex: 'L', dob: [30, 2, 2026], visit: [4, 10, 2026] }); await tick(40);
    expect($('manual-error').textContent).toContain('does not exist in the calendar'); expect(leftover($('manual-error'))).toEqual([]);
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], mrn: '123' }); await tick(40);
    expect($('manual-error').textContent).toContain('must be 8 digits');
    manual({ sex: 'P', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '5,4', height: '58,5' } }); await tick(60);
    expect($('result').textContent).toContain('Female, 2 months');
    expect(leftover($('result'))).toEqual([]);
    expect($('result').querySelector('table + table, h3 + table')).not.toBeNull();
    manual({ sex: 'L', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '25', height: '58,5' } }); await tick(60);
    expect(leftover($('result'))).toEqual([]);
    expect($('result').textContent).toMatch(/outside the range|Check first|Notes/);
    await save();
  });

  it('the exports are the same as in Indonesian: same columns, Indonesian category terms, no English labels in the data', async () => {
    const recs = await allRecords(); expect(recs.length).toBeGreaterThan(0);
    downloaded.length = 0; $('export-link').click(); await tick(100);
    const link = await readBlob(downloaded[0]);
    expect(link.split('\r\n')[0].split(',')).toEqual(LINK_COLUMNS);
    const withCat = recs.find((r) => r.nutrition && r.nutrition.category && r.nutrition.category.bbu);
    expect(link).toContain(withCat.nutrition.category.bbu);
    expect(link).not.toMatch(/Severely|Underweight|Normal weight|Overweight|Obese|Stunted/);
    downloaded.length = 0; $('export-analysis').click(); await tick(100);
    expect((await readBlob(downloaded[0])).split('\r\n')[0].split(',')).toEqual(ANALYSIS_COLUMNS);
  });

  it('the ID | EN buttons: switching saves the choice and reloads; with something open, a person must agree first', async () => {
    const { hooks } = await import('../src/i18n.js');
    hooks.reload = vi.fn(); window.confirm = vi.fn(() => true);
    $('lang-en').click(); expect(hooks.reload).not.toHaveBeenCalled();                              // already English
    await photoToPopup(); window.confirm = vi.fn(() => false);
    $('lang-id').click(); expect(window.confirm).toHaveBeenCalled(); expect(window.confirm.mock.calls[0][0]).toContain('Changing the language'); expect(hooks.reload).not.toHaveBeenCalled();
    $('c-retake').click(); await tick(20);
    window.confirm = vi.fn(() => true);
    $('lang-id').click(); expect(hooks.reload).toHaveBeenCalledTimes(1); expect(localStorage.getItem('honai-lang')).toBe('id');
    localStorage.setItem('honai-lang', 'en');
  });
});
