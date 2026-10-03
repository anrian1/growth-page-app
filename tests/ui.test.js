// Screen test: runs the real index.html and src/main.js in a simulated browser, with a fake camera and a fake OCR engine
// built on the real page layout. It cannot test the real camera, the real OCR model, the service worker or iPhone behaviour.
// Those are tested by hand on the phone.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assess } from '../src/core/zscore.js';
import { allRecords } from '../src/storage.js';
import { script } from './fakes.mjs';

vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));

const $ = (id) => document.getElementById(id);
const readBlob = (blob) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsText(blob); });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function waitFor(test, ms = 3000) { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await tick(20); } return false; }
let downloaded = null;

function fillChild({ code = '', sex = 'L', dob = '2026-06-01', visit = '2026-10-03' } = {}) {
  $('code').value = code;
  document.querySelectorAll('input[name=sex]').forEach((r) => { r.checked = r.value === sex; });
  $('dob').value = dob; $('visit').value = visit;
}
async function takePhoto() {
  const input = $('photo-camera');
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'page.jpg', { type: 'image/jpeg' })], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const overlayOpen = () => !$('overlay').hidden && $('overlay').innerHTML.includes('Periksa hasil bacaan');
const say = (table) => ({ column, month, height }) => { const v = table[`${column}|${month}`]; return typeof v === 'function' ? v(height) : (v ?? null); };

beforeAll(async () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.split('<body>')[1].split('</body>')[0].replace(/<script[\s\S]*?<\/script>/g, '');
  Element.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { downloaded = blob; return 'blob:test'; });
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = () => {};
  await import('../src/main.js');
  await tick();
});

describe('photo-first screen', () => {
  it('starts empty, in development mode, with the photo buttons visible', () => {
    expect($('records-summary').textContent).toBe('Belum ada data.');
    expect($('status').className).toContain('dev');
    expect($('photo-camera')).not.toBeNull();
    expect($('overlay').hidden).toBe(true);
  });

  it('refuses a photo when the child code check digit is wrong, and reads nothing', async () => {
    fillChild({ code: '482134' });
    await takePhoto(); await tick(80);
    expect($('form-error').textContent).toContain('Kode anak');
    expect(overlayOpen()).toBe(false);
  });

  it('refuses a photo until a sex is chosen', async () => {
    fillChild({ sex: '' });
    await takePhoto(); await tick(80);
    expect($('form-error').textContent).toContain('jenis kelamin');
  });

  it('boy, month 4: photo -> popup with both values read and ok -> confirm -> z-scores -> save', async () => {
    script.say = say({ 'L-weight|4': '7.2', 'L-length|4': '64.7' });
    script.ink = (id) => (id && id.month === 4 && id.column.startsWith('L') ? 0.05 : 0.001);
    fillChild({ code: '482133', sex: 'L', dob: '2026-06-01' });
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect($('w-input').value).toBe('7,2');
    expect($('l-input').value).toBe('64,7');
    expect($('overlay').textContent).toContain('Bacaan konsisten');
    expect($('overlay').textContent).toContain('blok jenis kelamin lain');            // the mock page has girls' writing on the same row
    expect($('c-check')).toBeNull();                                                  // all ok: no extra tick needed
    $('c-ok').click(); await tick(40);
    expect($('overlay').hidden).toBe(true);
    expect($('result').hidden).toBe(false);
    const expected = assess({ sex: 'L', ageMonths: 4, weightKg: 7.2, lengthCm: 64.7 });
    expect($('result').textContent).toContain('usia 4 bulan');
    expect($('result').textContent).toContain(expected.category.bbu);
    expect($('result').textContent).toContain('bukan diagnosis');
    $('save').click(); await tick(80);
    const [record] = await allRecords();
    expect(record.weightKg).toBe(7.2); expect(record.lengthCm).toBe(64.7);
    expect(record.weightSource).toBe('photo_ok'); expect(record.lengthSource).toBe('photo_ok');
    expect(record.ocr.weight.status).toBe('ok');
    expect($('records-summary').textContent).toContain('1 data tersimpan');
  });

  it('girl, month 2: readings disagree -> no value offered, candidates shown, a person must choose and tick', async () => {
    script.say = say({ 'P-weight|2': (h) => (h === 128 ? '5.6' : '5.0'), 'P-length|2': '56' });
    script.ink = (id) => (id && id.month === 2 && id.column.startsWith('P') ? 0.05 : 0.001);
    fillChild({ sex: 'P', dob: '2026-08-01' });
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect($('w-input').value).toBe('');                                              // no guess was prefilled
    expect($('overlay').textContent).toContain('Tidak terbaca jelas');
    const chips = [...document.querySelectorAll('[data-fill="w"]')].map((b) => b.textContent);
    expect(chips.sort()).toEqual(['5,0', '5,6']);
    expect($('l-input').value).toBe('56,0');
    $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('berat badan');                  // empty weight is refused
    document.querySelector('[data-fill="w"][data-value="5"]').click();
    expect($('w-input').value).toBe('5,0');
    $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('membandingkan');                // must tick the comparison box
    $('c-check').checked = true;
    $('c-ok').click(); await tick(40);
    expect($('result').hidden).toBe(false);
    $('save').click(); await tick(80);
    const records = await allRecords();
    const girl = records.find((r) => r.sex === 'P');
    expect(girl.weightSource).toBe('photo_chosen'); expect(girl.weightKg).toBe(5);
    expect(girl.lengthSource).toBe('photo_ok');
  });

  it('a person can re-read another row when the child row is empty', async () => {
    script.say = say({ 'L-weight|5': '7.9', 'L-length|5': '66.8' });
    script.ink = (id) => (id && id.month === 5 && id.column.startsWith('L') ? 0.05 : 0.001);
    fillChild({ sex: 'L', dob: '2026-04-01' });                                      // 6 months: the boys' row 6 is empty on the mock page
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect($('overlay').textContent).toContain('kosong');
    expect($('overlay').textContent).toContain('terlihat di bulan 5');
    $('m-input').value = '5';
    $('m-reread').click();
    expect(await waitFor(() => overlayOpen() && $('w-input') && $('w-input').value === '7,9')).toBe(true);
    expect($('l-input').value).toBe('66,8');
    $('c-retake').click();
    expect($('overlay').hidden).toBe(true);
  });

  it('refuses a child older than 24 months without reading anything', async () => {
    fillChild({ dob: '2024-01-01' });
    await takePhoto(); await tick(80);
    expect($('photo-error').textContent).toContain('0\u201324 bulan');
    expect(overlayOpen()).toBe(false);
  });

  it('refuses a photo that is not the growth table, with a reason and the manual option', async () => {
    script.page = 'junk';
    fillChild({ sex: 'L', dob: '2026-06-01' });
    await takePhoto();
    expect(await waitFor(() => $('photo-error').textContent.includes('Tabel tidak terbaca'))).toBe(true);
    expect($('photo-error').textContent).toContain('isi manual');
    expect(overlayOpen()).toBe(false);
    script.page = 'table';
  });

  it('manual entry still works without a photo and is recorded as typed', async () => {
    fillChild({ sex: 'L', dob: '2025-04-01' });
    $('m-weight').value = '8,4'; $('m-length').value = '73,0';
    $('manual-go').click(); await tick(40);
    expect($('result').hidden).toBe(false);
    expect($('result').textContent).toContain('usia 18 bulan');
    $('save').click(); await tick(80);
    const records = await allRecords();
    expect(records.some((r) => r.weightSource === 'typed' && r.weightKg === 8.4)).toBe(true);
  });

  it('exports a CSV that says how each value was obtained, without the date of birth by default', async () => {
    $('export-new').click(); await tick(100);
    expect(downloaded).not.toBeNull();
    const text = await readBlob(downloaded);
    const lines = text.trim().split('\r\n');
    expect(lines[0]).toContain('weight_source,length_source');
    expect(text).toContain('photo_ok'); expect(text).toContain('photo_chosen'); expect(text).toContain('typed');
    expect(text).not.toContain('2026-06-01');
    expect($('records-summary').textContent).toContain('0 belum diekspor');
  });

  it('deletes everything on the phone after confirmation', async () => {
    $('delete-all').click(); await tick(60);
    expect(await allRecords()).toHaveLength(0);
    expect($('records-summary').textContent).toBe('Belum ada data.');
  });
});
