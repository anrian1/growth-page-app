// The malaria dose check on the result screen, with the REAL pack (public/guidelines/malaria-dose.json), through manual entry.
import { describe, it, expect, beforeAll } from 'vitest';
import { assess } from '../src/core/zscore.js';
import { allRecords } from '../src/storage.js';
import { $, tick, readBlob, realPack, boot, manual } from './uihelpers.js';

const downloaded = [];
const set = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
async function runCheck(values) {
  $('ma-details').open = true;
  for (const [id, v] of Object.entries(values)) set(id, v);
  $('ma-go').click(); await tick(20);
  return $('ma-out').textContent;
}
beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded }); });

describe('malaria dose check on the result screen', () => {
  it('appears under the result, marked DRAFT, with the scope it does not cover', async () => {
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], vitals: { weight: '8,0', height: '70,0' } });   // a boy of 9 months
    await tick(40);
    expect($('ma-details')).not.toBeNull();
    expect($('ma-details').textContent).toContain('DRAF');
    expect($('ma-details').textContent).toContain('berat badan 8 kg');
    expect($('ma-details').textContent).toContain('Artemeter-lumefantrin');
    expect($('result').textContent).toContain('9 bulan');
  });

  it('prescribing what Tabel 1 says (8 kg, falciparum: 1/2 DHP x3 days, 1/4 primaquine x1 day) is reported as matching', async () => {
    const out = await runCheck({ 'ma-test': 'positive', 'ma-species': 'falciparum', 'ma-form': 'standard', 'ma-dhp-tabs': '1/2', 'ma-dhp-days': '3', 'ma-pq-tabs': '1/4', 'ma-pq-days': '1' });
    expect(out).toContain('Sesuai dengan tabel pedoman');
    expect(out).toContain('Bukan keputusan klinis');
    expect(out).toContain('Obat antimalaria tidak boleh diminum dalam keadaan perut kosong');
  });

  it('a wrong amount is flagged with the table amount, the weight column, the page and the quote', async () => {
    const out = await runCheck({ 'ma-dhp-tabs': '1' });
    expect(out).toContain('Berbeda dari tabel pedoman'); expect(out).toContain('½ tablet per hari'); expect(out).toContain('>6-10 kg'); expect(out).toContain('hal. 11'); expect(out).toContain('| 1-3 | DHP |');
  });

  it('wrong number of days and wrong primaquine duration for the species are flagged', async () => {
    const out = await runCheck({ 'ma-dhp-tabs': '1/2', 'ma-dhp-days': '5', 'ma-species': 'vivax', 'ma-pq-days': '1' });
    expect(out).toContain('Lama DHP dicatat 5 hari; pedoman 3 hari'); expect(out).toContain('pedoman untuk P. vivax: 14 hari');
  });

  it('severe malaria: the artesunate amount is compared', async () => {
    set('ma-type', 'severe');
    expect($('ma-severe').hidden).toBe(false); expect($('ma-uncomplicated').hidden).toBe(true);
    let out = await runCheck({ 'ma-art-mg': '24' });
    expect(out).toContain('Sesuai dengan tabel pedoman');
    out = await runCheck({ 'ma-art-mg': '19,2' });
    expect(out).toContain('Berbeda dari tabel pedoman'); expect(out).toContain('24 mg'); expect(out).toContain('19,2 mg');
  });

  it('the check is saved with the record and goes into the CSV with the ids of what differed and the DRAFT mark', async () => {
    set('ma-type', 'uncomplicated');
    await runCheck({ 'ma-dhp-tabs': '1', 'ma-dhp-days': '3', 'ma-species': 'falciparum', 'ma-pq-days': '1' });
    $('save').click(); await tick(80);
    const rec = (await allRecords()).find((r) => r.malaria);
    expect(rec.malaria.status).toBe('differs'); expect(rec.malaria.findings.some((f) => f.id === 'dhp-differs' && f.level === 'check')).toBe(true); expect(rec.malaria.packDraft).toBe(true);
    $('export-all').click(); await tick(100);
    const [header, line] = (await readBlob(downloaded[0])).trim().split('\r\n');
    expect(header).toContain('malaria_status,malaria_species,malaria_form,dhp_tabs_day,dhp_days,dhp_times_day,pq_tabs_day,pq_days,artesunate_mg,g6pd,pregnancy,malaria_findings,malaria_pack');
    expect(line).toContain('differs'); expect(line).toContain('dhp-differs'); expect(line).toContain('(draft)');
  });

  it('primaquine for an infant under 6 months is flagged', async () => {
    manual({ sex: 'P', dob: [1, 8, 2026], visit: [4, 10, 2026], vitals: { weight: '4,5', height: '55,0' } });   // 2 months
    await tick(40);
    const out = await runCheck({ 'ma-test': 'positive', 'ma-species': 'falciparum', 'ma-dhp-tabs': '1/3', 'ma-dhp-days': '3', 'ma-pq-tabs': '1/4', 'ma-pq-days': '1' });
    expect(out).toContain('bayi di bawah 6 bulan'); expect(out).toContain('Standar Pengobatan 3');
  });

  it('a weight the screen marks as uncertain stops the check', async () => {
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], vitals: { weight: '84', height: '70' } });     // implausible weight for 9 months
    await tick(40);
    const out = await runCheck({ 'ma-species': 'falciparum', 'ma-dhp-tabs': '1/2' });
    expect(out).toContain('Tidak dapat diperiksa'); expect(out).toContain('tidak pasti');
  });

  it('obesity on the nutrition result adds the ideal-weight note from the guideline', async () => {
    let weight = null;
    for (let w = 9; w <= 16; w += 0.1) { const r = assess({ sex: 'L', ageMonths: 9, weightKg: Math.round(w * 10) / 10, lengthCm: 70 }); if (r.category.bbpb === 'Obesitas' && r.action === 'SCORE') { weight = Math.round(w * 10) / 10; break; } }
    expect(weight).not.toBeNull();
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026], vitals: { weight: String(weight).replace('.', ','), height: '70,0' } });
    await tick(40);
    const out = await runCheck({ 'ma-test': 'positive', 'ma-species': 'falciparum', 'ma-dhp-tabs': '1', 'ma-dhp-days': '3' });
    expect(out).toContain('obesitas'); expect(out).toContain('berat badan ideal'); expect(out).toContain('Catatan c');
  });

  it('a 15-year-old girl: pregnancy and breastfeeding are asked, and primaquine while pregnant is flagged', async () => {
    manual({ sex: 'P', dob: [1, 6, 2011], visit: [4, 10, 2026], vitals: { weight: '45', height: '155', temp: '39' } });
    await tick(40);
    expect($('result').textContent).toContain('15 tahun');
    const out = await runCheck({ 'ma-test': 'positive', 'ma-species': 'falciparum', 'ma-form': 'standard', 'ma-dhp-tabs': '3', 'ma-dhp-days': '3', 'ma-pq-tabs': '1', 'ma-pq-days': '1', 'ma-preg': 'pregnant' });
    expect(out).toContain('pasien hamil'); expect(out).toContain('Standar Pengobatan 3');
    const out2 = await runCheck({ 'ma-preg': 'none', 'ma-g6pd': 'deficient' });
    expect(out2).toContain('Defisiensi G6PD'); expect(out2).toContain('0,75mg/kgBB/minggu');
  });
});
