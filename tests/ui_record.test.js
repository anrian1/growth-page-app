// Screen test for form v4: the real index.html and src/main.js in a simulated browser with the scripted fake camera and engine.
// It tests the wiring (popup, confirmation, automatic dose check, save, export). It cannot test the real camera, the real OCR model or phones.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { allRecords } from '../src/storage.js';
import { script, resetScript } from './fakes.mjs';
import { $, tick, waitFor, readBlob, realPack, overlayOpen, takePhoto, setVal, boot, manual, confirmAll } from './uihelpers.js';

vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));
const downloaded = [];
const choose = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
async function photoToPopup() { await takePhoto(); expect(await waitFor(overlayOpen)).toBe(true); }
async function confirmToResult() { confirmAll(); $('c-ok').click(); await tick(50); }

beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded }); });
beforeEach(() => { resetScript(); });

describe('form v4: photo -> popup -> result -> save', () => {
  it('starts empty, with the photo buttons and the form link', () => {
    expect($('records-summary').textContent).toBe('Belum ada data.'); expect($('photo-camera')).not.toBeNull(); expect($('overlay').hidden).toBe(true);
    expect(document.querySelector('a[href="/forms/rekam-medis-contoh.pdf"]')).not.toBeNull(); expect(document.querySelector('h1').textContent).toBe('HONAI');
  });

  it('the popup shows the MRN, the sex, the dates, the used prescription rows with a drug chosen for each, and skips the empty rows', async () => {
    await photoToPopup();
    expect($('f-mrn').value).toBe('00123456');
    expect(document.querySelector('input[name=rc-sex]:checked').value).toBe('L');
    expect($('rc-age').textContent).toContain('9 bulan');
    expect($('rx1-drug').value).toBe('dhp'); expect($('rx2-drug').value).toBe('pq'); expect($('rx3-drug').value).toBe('other'); expect($('rx4-drug').value).toBe('');
    expect($('f-rx1Amt').value).toBe('1/2'); expect($('f-rx1Freq').value).toBe('1'); expect($('f-rx1Days').value).toBe('3');
    expect($('rx1-perday').textContent).toContain('\u00bd tablet per hari');
    expect($('overlay').textContent).toContain('Baris kosong (2)');
    expect(script.calls.rx4Amt).toBeUndefined();                                                  // an empty row is not read at all
    expect($('rx-species').value).toBe('falciparum');
    expect($('overlay').textContent).toContain('Nama pasien tidak dibaca');
  });

  it('the prescription must be compared with the handwriting first; then the dose check runs by itself and says "matches"; saving records how it was obtained', async () => {
    $('c-check') && ($('c-check').checked = true);
    $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('Sesuai tulisan');
    confirmAll(); $('c-ok').click(); await tick(60);
    expect($('overlay').hidden).toBe(true);
    const text = $('result').textContent;
    expect(text).toContain('No. RM 00-1234-56'); expect(text).toContain('Laki-laki, 9 bulan'); expect(text).toContain('WHO 2006'); expect(text).toContain('bukan diagnosis');
    expect($('ma-out').textContent).toContain('Sesuai dengan tabel pedoman');
    expect($('ma-details').textContent).toContain('sudah Anda konfirmasi');
    expect($('ma-dhp-times').value).toBe('1');
    if ($('checked')) $('checked').checked = true;
    $('save').click(); await tick(80);
    const [rec] = await allRecords();
    expect(rec.type).toBe('record'); expect(rec.mrn).toBe('00123456'); expect(rec.rxSource).toBe('photo_confirmed'); expect(rec.malaria.status).toBe('match'); expect(rec.malaria.dhpTimes).toBe(1);
    expect(rec.sources.mrn).toBe('photo_ok'); expect(rec.sources.sex).toBe('photo_ok');
    expect(JSON.stringify(rec)).not.toMatch(/Paracetamol/i);                                       // the handwriting text of the other drugs is not saved
  });

  it('DHP written 1/4 tablet TWICE a day: tablets per day are right but the once-daily warning fires and quotes the guideline', async () => {
    script.values = { mrn: '00123499', rx1Amt: '1/4', rx1Freq: '2' };
    await photoToPopup();
    expect($('rx1-perday').textContent).toContain('\u00bd tablet per hari');
    await confirmToResult();
    expect($('ma-out').textContent).toContain('Berbeda dari tabel pedoman'); expect($('ma-out').textContent).toContain('DHP ditulis 2 kali per hari'); expect($('ma-out').textContent).toContain('H1 pada dosis kedua');
    $('checked') && ($('checked').checked = true); $('save').click(); await tick(60);
    expect((await allRecords()).find((r) => r.mrn === '00123499').malaria.dhpTimes).toBe(2);
  });

  it('a wrong dose is flagged: DHP 1 tablet once a day for 8 kg (table: 1/2)', async () => {
    script.values = { mrn: '00123498', rx1Amt: '1' };
    await photoToPopup(); await confirmToResult();
    expect($('ma-out').textContent).toContain('Berbeda dari tabel pedoman'); expect($('ma-out').textContent).toContain('\u00bd tablet per hari'); expect($('ma-out').textContent).toContain('hal. 11');
  });

  it('the same drug in two rows is refused with a reason', async () => {
    script.values = { mrn: '00123497', rx2Name: 'DHP' };
    await photoToPopup(); confirmAll(); $('c-ok').click(); await tick(30);
    expect($('confirm-error').textContent).toContain('2 baris');
    expect($('overlay').hidden).toBe(false);
    $('c-retake').click();
  });

  it('a drug name that is not recognised must be chosen by a person, never guessed', async () => {
    script.values = { mrn: '00123496', rx3Name: 'xqzv' };
    await photoToPopup();
    expect($('rx3-drug').value).toBe('?');
    confirmAll(); $('c-ok').click(); await tick(30);
    expect($('confirm-error').textContent).toContain('Baris 3: pilih obatnya');
    choose('rx3-drug', 'other');
    $('c-ok').click(); await tick(50);
    expect($('result').hidden).toBe(false);
    $('checked') && ($('checked').checked = true); $('save').click(); await tick(60);
  });

  it('a dispersible DHP name sets the tablet type, and the dispersible table is used (8 kg: 1 1/2)', async () => {
    script.values = { mrn: '00123495', rx1Name: 'DHP dispersibel', rx1Amt: '3/2' };
    await photoToPopup();
    expect($('rx-form').value).toBe('dispersible');
    await confirmToResult();
    expect($('ma-out').textContent).toContain('Sesuai dengan tabel pedoman');
    $('checked') && ($('checked').checked = true); $('save').click(); await tick(60);
  });

  it('an MRN that is not read is typed by a person; the printed grouping is accepted', async () => {
    script.blank.add('mrn');
    await photoToPopup();
    expect($('f-mrn').value).toBe('');
    expect($('overlay').textContent).toContain('ketik 8 angka dari gambar');
    confirmAll(); $('c-ok').click(); await tick(30);
    expect($('confirm-error').textContent).toContain('Nomor rekam medis harus 8 angka');
    setVal('f-mrn', '00-1760-00');
    $('c-ok').click(); await tick(50);
    expect($('result').textContent).toContain('No. RM 00-1760-00');
    $('checked') && ($('checked').checked = true); $('save').click(); await tick(60);
    expect((await allRecords()).find((r) => r.mrn === '00176000').sources.mrn).toBe('photo_edited');
  });

  it('both sex boxes ticked: no sex is guessed and a person chooses', async () => {
    script.values = { mrn: '00123494' }; script.ink = () => 0.06;
    await photoToPopup();
    expect(document.querySelector('input[name=rc-sex]:checked')).toBeNull();
    expect($('overlay').textContent).toContain('kedua kotak LK dan PR');
    confirmAll(); $('c-ok').click(); await tick(20);
    expect($('confirm-error').textContent).toContain('Pilih jenis kelamin');
    document.querySelector('input[name=rc-sex][value=P]').checked = true; $('c-ok').click(); await tick(50);
    expect($('result').hidden).toBe(false);
    $('checked') && ($('checked').checked = true); $('save').click(); await tick(60);
    expect((await allRecords()).find((r) => r.mrn === '00123494').sources.sex).toBe('photo_chosen');
  });

  it('the same MRN and visit date again is flagged as a possible duplicate and needs a tick', async () => {
    script.values = { mrn: '00123456' };
    await photoToPopup(); await confirmToResult();
    expect($('result').textContent).toContain('data ganda'); expect($('checked')).not.toBeNull();
    $('save').click(); await tick(30);
    expect($('photo-error').textContent).toContain('sudah memeriksa');
  });

  it('the same MRN with a DIFFERENT date of birth is flagged', async () => {
    manual({ mrn: '00123456', dob: [9, 1, 2026], visit: [5, 10, 2026] }); await tick(60);
    expect($('result').textContent).toContain('tanggal lahir yang berbeda'); expect($('checked')).not.toBeNull();
  });

  it('a photo that is not the form is refused with a reason and the manual option', async () => {
    script.page = 'junk'; await takePhoto();
    expect(await waitFor(() => $('photo-error').textContent.includes('Halaman tidak terbaca'))).toBe(true);
    expect($('photo-error').textContent).toContain('isi manual'); expect(overlayOpen()).toBe(false);
  });

  it('a child of 14 years: nutrition is not calculated, the note says so, the dose check is still offered', async () => {
    manual({ sex: 'P', dob: [1, 3, 2012], visit: [4, 10, 2026], vitals: { height: '150', weight: '38', temp: '39' } }); await tick(40);
    expect($('result').textContent).toContain('14 tahun 7 bulan'); expect($('result').textContent).toContain('tabel WHO 2007 belum dipasang'); expect($('ma-details')).not.toBeNull(); expect($('ma-preg')).not.toBeNull();
  });

  it('manual entry works without a photo and is recorded as typed; impossible dates and a missing MRN are refused', async () => {
    manual({ sex: 'L', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '5,4', height: '58,5' } }); await tick(40);
    expect($('result').textContent).toContain('2 bulan');
    $('save').click(); await tick(60);
    expect((await allRecords()).some((r) => r.sources.weight === 'typed' && r.values.weight === 5.4)).toBe(true);
    manual({ sex: 'L', dob: [30, 2, 2026], visit: [4, 10, 2026] }); await tick(20);
    expect($('manual-error').textContent).toContain('tidak ada di kalender');
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], mrn: '123' }); await tick(20);
    expect($('manual-error').textContent).toContain('8 angka');
  });

  it('exports the link file (MRN + date of birth) and the analysis file (neither), each with how every value was obtained and the times per day', async () => {
    downloaded.length = 0;
    $('export-link').click(); await tick(100);
    const link = await readBlob(downloaded[0]);
    const header = link.split('\r\n')[0];
    expect(header).toContain('mrn,dob,visit_date'); expect(header).toContain('dhp_days,dhp_times_day'); expect(header).toContain('rx_source');
    expect(link).toContain('00-1234-56'); expect(link).toContain('photo_confirmed'); expect(link).toContain('photo_edited'); expect(link).toContain('typed');
    downloaded.length = 0;
    $('export-analysis').click(); await tick(100);
    const ana = await readBlob(downloaded[0]);
    expect(ana.split('\r\n')[0]).toContain('visit_month'); expect(ana).not.toContain('00-1234-56'); expect(ana).not.toContain('00123456'); expect(ana).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it('deletes everything on the phone after confirmation', async () => {
    $('delete-all').click(); await tick(60);
    expect(await allRecords()).toHaveLength(0); expect($('records-summary').textContent).toBe('Belum ada data.');
  });
});
