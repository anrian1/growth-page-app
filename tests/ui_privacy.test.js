// PRIVACY canary: names, addresses, phone numbers and BPJS numbers planted on a page must not appear anywhere:
// not on the screen, not in the saved record, not in either export file.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { allRecords } from '../src/storage.js';
import MEDREC from '../src/templates/medical-record.js';
import { script, resetScript, piiTokens } from './fakes.mjs';
import { $, tick, waitFor, readBlob, realPack, overlayOpen, takePhoto, boot, confirmAll } from './uihelpers.js';

vi.mock('../src/photo.js', async () => ({ ...(await import('./fakes.mjs')).photo }));
vi.mock('../src/ocr-engine.js', async () => ({ ...(await import('./fakes.mjs')).engine }));
const downloaded = [];
const CANARIES = ['BUDI', 'SANTOSO', 'JL MERDEKA', '0812555', '0001234567890'];

beforeAll(async () => { await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => realPack() } : { ok: false }), downloaded }); });

describe('private text on the page never leaves the reader', () => {
  it('canary names in the name, address, phone and BPJS areas are on no screen, in no record and in no export file', async () => {
    resetScript(); script.extraTokens = piiTokens(CANARIES);
    await takePhoto();
    expect(await waitFor(overlayOpen)).toBe(true);
    const technical = $('c-json').value; const popup = $('overlay').textContent + technical;
    confirmAll(); $('c-ok').click(); await tick(60);
    const screen = $('result').textContent;
    $('save').click(); await tick(80);
    const stored = JSON.stringify(await allRecords());
    downloaded.length = 0; $('export-all').click(); await tick(120);
    const files = await Promise.all(downloaded.map(readBlob));
    expect(files).toHaveLength(2);
    for (const c of CANARIES) for (const [where, text] of [['popup', popup], ['result screen', screen], ['saved record', stored], ['link file', files[0]], ['analysis file', files[1]]]) expect(text.includes(c), `${c} found in ${where}`).toBe(false);
    expect(JSON.parse(technical).piiDropped).toBe(MEDREC.pii.length);
  });
});
