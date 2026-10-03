// A fake camera and a fake OCR engine for tests, built on the REAL page layout (tests/fixtures/mock_page_tokens.json).
// The whole-page reading returns the real fixture. Cell crops return whatever the test script says.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTokens, cellRect } from '../src/mapping.js';
import { TEMPLATE } from '../src/template.js';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/mock_page_tokens.json'), 'utf8'));
export const mapped = mapTokens(fixture.tokens);
export const script = { say: () => null, ink: () => 0.05, page: 'table' };   // say({column, month, height}) -> text or null

function identify(rect) {
  for (const column of TEMPLATE.columns) {
    for (let month = 0; month <= 24; month += 1) {
      const r = cellRect(mapped.geometry, column, month, TEMPLATE.cell);
      if (Math.abs(r.x - rect.x) < 1e-6 && Math.abs(r.y - rect.y) < 1e-6) return { column, month };
    }
  }
  return null;
}

export const engine = {
  async load() {},
  currentTier() { return 'small'; },
  setTier() {},
  async recognize(picture) {
    if (picture.kind === 'page') {
      if (script.page === 'junk') return { lines: [[{ text: 'hello', box: { x: 1, y: 1, width: 10, height: 10 } }]] };
      return { lines: [fixture.tokens.map((t) => ({ text: t.text, confidence: t.conf, box: { x: t.x, y: t.y, width: t.w, height: t.h } }))] };
    }
    const id = identify(picture.rect);
    const said = id ? script.say({ ...id, height: picture.height }) : null;
    return { lines: said === null || said === undefined ? [] : [[{ text: said, box: { x: 0, y: 0, width: 10, height: 10 } }]] };
  },
};

export const photo = {
  async load() { return { width: 960, height: 1280, url: null }; },
  release() {},
  scaled(img) { return { kind: 'page', width: img.width, height: img.height }; },
  crop(img, rect, height) { return { kind: 'crop', rect, height }; },
  ink(picture) { return script.ink(identify(picture.rect)); },
  thumb() { return document.createElement('canvas'); },
};
