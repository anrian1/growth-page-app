// A malaria pack that breaks the rules (a table without its quote) is refused, and the result says why.
import { describe, it, expect, beforeAll } from 'vitest';
import { $, tick, boot, manual, realPack } from './uihelpers.js';
describe('malaria pack that breaks the rules', () => {
  beforeAll(async () => {
    const broken = realPack(); delete broken.tables.standard.cites.dhp.quote;
    await boot({ fetchStub: async (url) => (String(url).includes('malaria-dose') ? { ok: true, json: async () => broken } : { ok: false }) });
  });
  it('is refused: no dose inputs, and the result says why', async () => {
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026] }); await tick(40);
    expect($('ma-go')).toBeNull();
    expect($('result').textContent).toContain('tidak valid dan tidak dipakai'); expect($('result').textContent).toContain('exact quote');
  });
});
