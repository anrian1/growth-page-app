// Shared helpers for the screen tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
export const $ = (id) => document.getElementById(id);
export const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
export async function waitFor(test, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await tick(20); } return false; }
export const readBlob = (blob) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsText(blob); });
export const realPack = () => JSON.parse(readFileSync(join(process.cwd(), 'public/guidelines/malaria-dose.json'), 'utf8'));
export const overlayOpen = () => !$('overlay').hidden && $('overlay').innerHTML.includes('Periksa hasil bacaan');
export async function takePhoto() {
  const input = $('photo-camera');
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'page.jpg', { type: 'image/jpeg' })], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
export const setVal = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); $(id).dispatchEvent(new Event('change', { bubbles: true })); };
/** Mounts index.html and main.js. fetchStub decides what the malaria pack request returns. */
export async function boot({ fetchStub, downloaded = [] }) {
  globalThis.fetch = fetchStub;
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.split(/<body[^>]*>/)[1].split('</body>')[0].replace(/<script[\s\S]*?<\/script>/g, '');
  Element.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  URL.createObjectURL = (blob) => { downloaded.push(blob); return 'blob:test'; }; URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = () => {};
  await import('../src/main.js');
  await tick(60);
}
export function manual({ sex = 'L', dob = [1, 1, 2026], visit = [4, 10, 2026], vitals = {} } = {}) {
  document.querySelectorAll('input[name=man-sex]').forEach((r) => { r.checked = r.value === sex; });
  ['D', 'M', 'Y'].forEach((c, i) => { $(`man-dob${c}`).value = dob[i] ?? ''; $(`man-tgl${c}`).value = visit[i] ?? ''; });
  const v = { sys: '90', dia: '55', hr: '120', rr: '30', temp: '38,5', height: '70', weight: '8', ...vitals };
  for (const [k, val] of Object.entries(v)) $(`man-${k}`).value = val;
  $('manual-go').click();
}
