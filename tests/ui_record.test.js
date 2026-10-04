// Screen test: the real index.html and src/main.js in a simulated browser, with a fake camera and a fake OCR engine built on REAL OCR output of a
// synthetic photo of the medical record (tests/fixtures/record_ocr_fixtures.json). It cannot test the real camera, the real OCR model,
// the service worker or phone behaviour. Those are tested by hand on the phone.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { assess } from '../src/core/zscore.js';
import { allRecords } from '../src/storage.js';
import { script, sheets } from './fakes.mjs';
import { $, tick, waitFor, readBlob, realPack, overlayOpen, takePhoto, setVal, boot, manual } from './uihelpers.js';

vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));
const downloaded = [];
const truthOf = (name) => Object.fromEntries(Object.entries(sheets.find((s) => s.name === name).fields).map(([k, f]) => [k, Number(f.truth)]));
const goodCrops = (name) => ({ key, truth }) => String(truth); // every crop reads the true value

beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded }); });

describe('medical record: photo -> popup -> result -> save', () => {
  it('starts empty, in development mode, with the photo buttons and the form link', () => {
    expect($('records-summary').textContent).toBe('Belum ada data.');
    expect($('status').className).toContain('dev');
    expect($('photo-camera')).not.toBeNull();
    expect(document.querySelector('a[href="/forms/rekam-medis-contoh.pdf"]')).not.toBeNull();
    expect($('overlay').hidden).toBe(true);
    expect(document.querySelector('h1').textContent).toBe('HONAI');
  });

  it('C03 (boy, 7 months): the popup shows everything read, with the age computed from the two dates', async () => {
    script.sheet = 'C03'; script.say = goodCrops('C03'); script.ink = null; script.page = 'record';
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    const t = truthOf('C03');
    expect($('f-weight').value).toBe(String(t.weight).replace('.', ',')); expect($('f-height').value).toBe(String(t.height).replace('.', ','));
    expect($('f-sys').value).toBe(String(t.sys)); expect($('f-dia').value).toBe(String(t.dia)); expect($('f-hr').value).toBe(String(t.hr));
    expect(document.querySelector('input[name=rc-sex]:checked').value).toBe('L');                    // from the tick box
    expect($('f-dobY').value).toBe(String(t.dobY)); expect($('f-tglM').value).toBe(String(t.tglM));
    expect($('rc-age').textContent).toContain('7 bulan');
    expect($('overlay').textContent).toContain('Teks bebas (hanya gambar, tidak dibaca AI)');
  });

  it('confirm -> nutrition for 0-59 months with the right index names -> save', async () => {
    if ($('c-check')) $('c-check').checked = true;
    $('c-ok').click(); await tick(40);
    expect($('overlay').hidden).toBe(true);
    expect($('result').hidden).toBe(false);
    const t = truthOf('C03');
    const expected = assess({ sex: 'L', ageMonths: 7, weightKg: t.weight, lengthCm: t.height });
    const text = $('result').textContent;
    expect(text).toContain('Laki-laki, 7 bulan'); expect(text).toContain('WHO 2006, 0\u201359 bulan'); expect(text).toContain('PB/U'); expect(text).toContain('BB/PB');
    expect(text).toContain(expected.category.bbu); expect(text).toContain('bukan diagnosis');
    if ($('checked')) $('checked').checked = true;
    $('save').click(); await tick(80);
    const [rec] = await allRecords();
    expect(rec.type).toBe('record'); expect(rec.sex).toBe('L'); expect(rec.ageMonths).toBe(7); expect(rec.values.weight).toBe(t.weight);
    expect(rec.nutrition.category.bbu).toBe(expected.category.bbu);
    expect(rec.sources.sex).toBe('photo_ok'); expect(rec.sources.weight).toMatch(/^photo_/);
    expect($('records-summary').textContent).toContain('1 data tersimpan');
  });

  it('a sex that cannot be read from the tick boxes is not guessed: both ticked, a person must choose', async () => {
    script.sheet = 'C04'; script.ink = () => 0.06;
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect(document.querySelector('input[name=rc-sex]:checked')).toBeNull();
    expect($('overlay').textContent).toContain('kedua kotak LK dan PR');
    $('c-check') && ($('c-check').checked = true);
    $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('Pilih jenis kelamin');
    document.querySelector('input[name=rc-sex][value=P]').checked = true;
    $('c-ok').click(); await tick(40);
    expect($('result').hidden).toBe(false);
    $('checked') && ($('checked').checked = true);
    $('save').click(); await tick(80);
    const girl = (await allRecords()).find((r) => r.sex === 'P');
    expect(girl.sources.sex).toBe('photo_chosen');
    script.ink = null;
  });

  it('a date that was misread so the visit comes before the birth is refused with a reason', async () => {
    script.sheet = 'C05'; script.say = ({ key, truth }) => (key === 'tglY' ? '2020' : String(truth));
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect($('rc-age-flags').textContent).toContain('lebih awal dari tanggal lahir');
    $('c-check') && ($('c-check').checked = true);
    $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('lebih awal dari tanggal lahir');
    expect($('result').hidden).toBe(true);
    setVal('f-tglY', '2026');                                                                   // the person corrects the year; the age line updates at once
    expect($('rc-age').textContent).toContain('bulan');
    script.say = goodCrops('C05');
    $('c-retake').click();
  });

  it('a candidate can be chosen with one tap, and the age line follows when a date part is changed', async () => {
    script.sheet = 'C06'; script.say = ({ key, height, truth }) => (key === 'tglD' ? (height === 96 ? '1' : height === 128 ? '7' : '4') : String(truth));   // three crops that disagree with each other and with the page reading
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    expect($('f-tglD').value).toBe('');                                                          // no majority: no prefilled guess
    const chips = [...document.querySelectorAll('[data-fill="tglD"]')].map((b) => b.textContent).sort();
    expect(chips.length).toBeGreaterThan(1);
    document.querySelector('[data-fill="tglD"]').click();
    expect($('f-tglD').value).not.toBe('');
    expect($('rc-age').textContent).toContain('Umur');
    $('c-retake').click();
    script.say = null;
  });

  it('a photo that is not the form is refused with a reason and the manual option', async () => {
    script.page = 'junk';
    await takePhoto();
    expect(await waitFor(() => $('photo-error').textContent.includes('Halaman tidak terbaca'))).toBe(true);
    expect($('photo-error').textContent).toContain('isi manual');
    expect(overlayOpen()).toBe(false);
    script.page = 'record';
  });

  it('a child of 14 years: nutrition is not calculated (stage 2), the note says so, the dose check is still offered', async () => {
    manual({ sex: 'P', dob: [1, 3, 2012], visit: [4, 10, 2026], vitals: { height: '150', weight: '38', temp: '39' } });
    await tick(40);
    expect($('result').hidden).toBe(false);
    expect($('result').textContent).toContain('14 tahun 7 bulan');
    expect($('result').textContent).toContain('tabel WHO 2007 belum dipasang');
    expect($('result').textContent).not.toContain('Skor (z)');
    expect($('ma-details')).not.toBeNull();
    expect($('ma-preg')).not.toBeNull();                                                         // a girl of 10 or more is asked about pregnancy
    expect($('checked')).toBeNull();                                                             // the stage-2 note is information, not a warning
  });

  it('a girl under 10 is not asked about pregnancy; a boy of 15 is not either', async () => {
    manual({ sex: 'P', dob: [1, 1, 2022], visit: [4, 10, 2026] }); await tick(40);
    expect($('ma-preg')).toBeNull();
    manual({ sex: 'L', dob: [1, 1, 2011], visit: [4, 10, 2026], vitals: { height: '165', weight: '52' } }); await tick(40);
    expect($('ma-preg')).toBeNull();
  });

  it('manual entry works without a photo and is recorded as typed', async () => {
    manual({ sex: 'L', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '5,4', height: '58,5' } });
    await tick(40);
    expect($('result').textContent).toContain('2 bulan');
    $('save').click(); await tick(80);
    expect((await allRecords()).some((r) => r.sources.weight === 'typed' && r.values.weight === 5.4)).toBe(true);
  });

  it('manual entry refuses an impossible date, a missing sex, and a missing weight, with reasons', async () => {
    manual({ sex: 'L', dob: [30, 2, 2026], visit: [4, 10, 2026] }); await tick(20);
    expect($('manual-error').textContent).toContain('tidak ada di kalender');
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], vitals: { weight: '' } }); await tick(20);
    expect($('manual-error').textContent).toContain('berat badan');
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2025] }); await tick(20);
    expect($('manual-error').textContent).toContain('lebih awal dari tanggal lahir');
    manual({ sex: 'L', dob: [1, 1, 2000], visit: [4, 10, 2026] }); await tick(20);
    expect($('manual-error').textContent).toContain('di luar rentang aplikasi');
  });

  it('a typed systolic below the diastolic is flagged and cannot be saved without the tick', async () => {
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], vitals: { sys: '55', dia: '90' } }); await tick(40);
    expect($('result').textContent).toContain('Sistolik harus lebih besar dari diastolik');
    $('save').click(); await tick(40);
    expect($('photo-error').textContent).toContain('sudah memeriksa');
    $('checked').checked = true; $('save').click(); await tick(80);
    expect((await allRecords()).some((r) => r.flags.some((f) => f.includes('Sistolik harus lebih besar')))).toBe(true);
  });

  it('exports a record CSV that says how each value was obtained, without the date of birth by default', async () => {
    downloaded.length = 0;
    $('export-new').click(); await tick(100);
    expect(downloaded.length).toBe(1);
    const text = await readBlob(downloaded[0]);
    const header = text.split('\r\n')[0];
    expect(header).toContain('sex_source,dob_source,visit_date_source'); expect(header).toContain('malaria_status'); expect(header).not.toContain(',dob,');
    expect(text).toContain('photo_ok'); expect(text).toContain('typed'); expect(text).toContain('photo_chosen');
    expect($('records-summary').textContent).toContain('0 belum diekspor');
  });

  it('deletes everything on the phone after confirmation', async () => {
    $('delete-all').click(); await tick(60);
    expect(await allRecords()).toHaveLength(0);
    expect($('records-summary').textContent).toBe('Belum ada data.');
  });
});
