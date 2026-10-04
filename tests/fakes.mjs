// A fake camera and a fake OCR engine for tests, built on REAL OCR output of a synthetic photo of the revised medical record
// (tests/fixtures/record_ocr_fixtures.json). The whole-page reading returns the real tokens; cell crops return the real crop readings
// unless a test overrides them with script.say(); tick boxes return the measured ink ratios.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignByTemplate, placeBox, readRect } from '../src/clinic.js';
import MEDREC from '../src/templates/medical-record.js';

export const sheets = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/record_ocr_fixtures.json'), 'utf8'));
export const FACTOR = 1.5;                                                   // the fake photo is 2400 px wide, the page reading is done at 1600 px
export const script = { sheet: 'C03', page: 'record', say: null, ink: null, delayMs: 0 };

function worldFor(name) {
  const sheet = sheets.find((s) => s.name === name);
  const al = alignByTemplate(MEDREC, sheet.tokens);
  const fieldRect = Object.fromEntries(Object.keys(MEDREC.fields).map((k) => [k, readRect(placeBox(al.H, MEDREC.fields[k].box))]));
  const tickRect = Object.fromEntries(Object.keys(MEDREC.ticks).map((k) => [k, readRect(placeBox(al.H, MEDREC.ticks[k].box), 0.22)]));
  const textRect = Object.fromEntries(['asessmen', 'planning'].map((k) => { const poly = placeBox(al.H, MEDREC.freeText[k]); const xs = poly.map((q) => q[0]); const ys = poly.map((q) => q[1]); return [k, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }]; }));
  return { sheet, fieldRect, tickRect, textRect };
}
const near = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

export const engine = {
  async load() {},
  currentTier() { return 'small'; },
  setTier() {},
  async recognize(picture) {
    if (script.delayMs) await new Promise((r) => setTimeout(r, script.delayMs));
    const w = worldFor(script.sheet);
    if (picture.kind === 'page') {
      if (script.page === 'junk') return { lines: [[{ text: 'Tabel Pertumbuhan Anak', box: { x: 1, y: 1, width: 100, height: 20 } }]] };
      return { lines: [w.sheet.tokens.map((t) => ({ text: t.text, confidence: t.conf, box: { x: t.x, y: t.y, width: t.w, height: t.h } }))] };
    }
    const textKey = Object.keys(w.textRect).find((k) => near(w.textRect[k], picture.rect));
    if (textKey) {
      const said = script.say ? script.say({ key: textKey, height: picture.height, truth: w.sheet.texts[textKey].truth }) : undefined;
      const text = said !== undefined ? said : w.sheet.texts[textKey].crops[String(picture.height)] ?? '';
      return { lines: text === null || text === '' ? [] : [[{ text, box: { x: 0, y: 0, width: 10, height: 10 } }]] };
    }
    const key = Object.keys(w.fieldRect).find((k) => near(w.fieldRect[k], picture.rect));
    if (!key) return { lines: [] };
    const said = script.say ? script.say({ key, height: picture.height, truth: w.sheet.fields[key].truth }) : undefined;
    const text = said !== undefined ? said : w.sheet.fields[key].crops[String(picture.height)] ?? '';
    return { lines: text === null || text === '' ? [] : [[{ text, box: { x: 0, y: 0, width: 10, height: 10 } }]] };
  },
};

export const photo = {
  async load() { return { width: 1600 * FACTOR, height: 2000 * FACTOR, url: null }; },
  release() {},
  scaled() { return { kind: 'page', width: 1600, height: 2000 }; },
  crop(img, rect, height) { return { kind: 'crop', rect: { x: rect.x / FACTOR, y: rect.y / FACTOR, w: rect.w / FACTOR, h: rect.h / FACTOR }, height }; },
  ink(picture) {
    const w = worldFor(script.sheet);
    const tk = Object.keys(w.tickRect).find((k) => near(w.tickRect[k], picture.rect));
    if (tk) { const r = script.ink ? script.ink(tk) : undefined; return r !== undefined ? r : w.sheet.ticks[tk].ratio; }
    const key = Object.keys(w.fieldRect).find((k) => near(w.fieldRect[k], picture.rect));
    return key ? 0.05 : 0.0;
  },
  thumb() { return document.createElement('canvas'); },
};
