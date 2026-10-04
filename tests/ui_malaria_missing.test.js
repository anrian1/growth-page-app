// If the malaria pack is missing, the app must say so and offer no dose check.
import { describe, it, expect, beforeAll } from 'vitest';
import { $, tick, boot, manual } from './uihelpers.js';
describe('malaria pack that is absent', () => {
  beforeAll(async () => { await boot({ fetchStub: async () => ({ ok: false }) }); });
  it('says the pack is not installed and offers no dose inputs', async () => {
    manual({ sex: 'L', dob: [1, 1, 2026], visit: [4, 10, 2026] }); await tick(40);
    expect($('result').textContent).toContain('Paket dosis malaria tidak terpasang');
    expect($('ma-go')).toBeNull();
  });
});
