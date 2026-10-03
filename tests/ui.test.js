// Screen test: runs the real index.html and src/main.js in a simulated browser.
// It cannot test the camera, the service worker or iPhone behaviour. Those are tested by hand on the phone.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assess, ageInMonths } from '../src/core/zscore.js';
import { allRecords } from '../src/storage.js';

const $ = (id) => document.getElementById(id);
const readBlob = (blob) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsText(blob); });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let downloaded = null;

function fill({ code = '', sex = 'L', dob = '2025-04-01', visit = '2026-10-03', weight = '8,4', length = '73,0' }) {
  $('code').value = code;
  document.querySelectorAll('input[name=sex]').forEach((r) => { r.checked = r.value === sex; });
  $('dob').value = dob; $('visit').value = visit; $('weight').value = weight; $('length').value = length;
}
const submit = async () => { $('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await tick(); };

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

describe('growth screen', () => {
  it('starts empty and in development mode', () => {
    expect($('records-summary').textContent).toBe('Belum ada data.');
    expect($('status').className).toContain('dev');
    expect($('version').textContent).toBe('test');
  });

  it('rejects a child code with a wrong check digit and shows no result', async () => {
    fill({ code: '482134' });
    await submit();
    expect($('form-error').hidden).toBe(false);
    expect($('form-error').textContent).toContain('Kode anak');
    expect($('result').hidden).toBe(true);
  });

  it('needs a sex to be chosen', async () => {
    fill({ sex: '' });
    await submit();
    expect($('form-error').textContent).toContain('jenis kelamin');
  });

  it('calculates exactly what the tested core calculates, then saves on confirm', async () => {
    fill({ code: '482133' });
    await submit();
    expect($('form-error').hidden).toBe(true);
    expect($('result').hidden).toBe(false);
    const expected = assess({ sex: 'L', ageMonths: ageInMonths('2025-04-01', '2026-10-03'), weightKg: 8.4, lengthCm: 73 });
    expect($('result').textContent).toContain('usia 18 bulan');
    expect($('result').textContent).toContain(expected.category.bbu);
    expect($('result').textContent).toContain(expected.category.pbu);
    expect($('result').textContent).toContain('bukan diagnosis');
    $('save').click(); await tick(60);
    const records = await allRecords();
    expect(records).toHaveLength(1);
    expect(records[0].childCode).toBe('482133');
    expect(records[0].ageMonths).toBe(18);
    expect(records[0].weightKg).toBe(8.4);
    expect($('records-summary').textContent).toContain('1 data tersimpan, 1 belum diekspor');
    expect($('result').hidden).toBe(true);
  });

  it('blocks saving an implausible value until the person ticks "I checked"', async () => {
    fill({ code: '', weight: '84', length: '74,0' });
    await submit();
    expect($('result').textContent).toContain('Tidak yakin');
    expect($('result').textContent).toContain('84 kg');
    $('save').click(); await tick(60);
    expect(await allRecords()).toHaveLength(1);            // nothing new was saved
    expect($('form-error').textContent).toContain('sudah memeriksa');
    $('checked').checked = true;
    $('save').click(); await tick(60);
    const records = await allRecords();
    expect(records).toHaveLength(2);
    expect(records.some((r) => r.action === 'FLAG_CONFIRM')).toBe(true);
  });

  it('accepts decimal comma, dot and raised dot', async () => {
    for (const w of ['8,4', '8.4', '8\u00b74']) {
      fill({ weight: w });
      await submit();
      expect($('form-error').hidden).toBe(true);
      expect($('result').textContent).toContain('8.4 kg');
    }
    fill({ weight: 'abc' });
    await submit();
    expect($('form-error').textContent).toContain('angka');
  });

  it('exports a CSV without the date of birth by default, then marks the records exported', async () => {
    $('export-new').click(); await tick(80);
    expect(downloaded).not.toBeNull();
    const text = await readBlob(downloaded);
    expect(text.split('\r\n')[0]).toContain('record_id,child_code,visit_date,sex');
    expect(text).toContain('482133');
    expect(text).not.toContain('2025-04-01');
    expect($('records-summary').textContent).toContain('2 data tersimpan, 0 belum diekspor');
  });

  it('deletes everything on the phone after confirmation', async () => {
    $('delete-all').click(); await tick(60);
    expect(await allRecords()).toHaveLength(0);
    expect($('records-summary').textContent).toBe('Belum ada data.');
  });
});
