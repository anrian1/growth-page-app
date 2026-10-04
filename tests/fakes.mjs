// A fake camera and a fake OCR engine for the form-v4 tests. The page reading returns the printed labels of the TEMPLATE at their template positions
// (so alignment is exact); every box returns whatever the test scripts. This tests the WIRING and the logic, not handwriting: for how well handwriting
// is read, use real pages (the older real-OCR evidence is for form v3 and is described in the README).
import { alignByTemplate, placeBox, readRect } from '../src/clinic.js';
import MEDREC from '../src/templates/medical-record.js';

export const FACTOR = 1.5;                                        // the fake photo is 1.5x the page reading
export const SCALE = 1600 / MEDREC.page.h;                        // the page reading is done on a picture whose long side is 1600 px
const PAGE_W = MEDREC.page.w * SCALE;
export const DEFAULTS = {
  mrn: '00123456', sys: '90', dia: '55', hr: '120', rr: '30', temp: '38.5', height: '70', weight: '8', dobD: '1', dobM: '1', dobY: '2026', tglD: '4', tglM: '10', tglY: '2026',
  rx1Name: 'DHP', rx1Amt: '1/2', rx1Freq: '1', rx1Days: '3', rx2Name: 'Primakuin', rx2Amt: '1/4', rx2Freq: '1', rx2Days: '1', rx3Name: 'Paracetamol', rx3Amt: '1/2', rx3Freq: '3', rx3Days: '3',
};
const EMPTY_ROWS = ['rx4Name', 'rx4Amt', 'rx4Freq', 'rx4Days', 'rx5Name', 'rx5Amt', 'rx5Freq', 'rx5Days'];
export const script = {};
export function resetScript() {
  Object.assign(script, { values: {}, blank: new Set(EMPTY_ROWS), noise: new Set(), strong: new Set(), say: null, ink: null, page: 'record', sex: 'L', extraTokens: [], calls: {}, assess: 'Malaria falsiparum', plan: '' });
}
resetScript();

const baseTokens = MEDREC.labels.map((l) => ({ text: l.text, x: l.x * SCALE, y: l.y * SCALE, w: l.w * SCALE, h: l.h * SCALE }));
const aligned = alignByTemplate(MEDREC, baseTokens);
const rectOf = (box, margin) => readRect(placeBox(aligned.H, box), margin);
const near = (a, b) => ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 0.01);
const boxes = {
  field: Object.fromEntries(Object.entries(MEDREC.fields).map(([k, f]) => [k, rectOf(f.box)])),
  name: Object.fromEntries(Object.entries(MEDREC.names).map(([k, f]) => [k, rectOf(f.box)])),
  tick: Object.fromEntries(Object.entries(MEDREC.ticks).map(([k, f]) => [k, rectOf(f.box, 0.22)])),
  text: Object.fromEntries(Object.entries(MEDREC.freeText).map(([k, b]) => { const poly = placeBox(aligned.H, b); const xs = poly.map((q) => q[0]); const ys = poly.map((q) => q[1]); return [k, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }]; })),
};
const unionRect = (list) => { const x0 = Math.min(...list.map((q) => q.x)); const y0 = Math.min(...list.map((q) => q.y)); return { x: x0, y: y0, w: Math.max(...list.map((q) => q.x + q.w)) - x0, h: Math.max(...list.map((q) => q.y + q.h)) - y0 }; };
boxes.row = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [`row${r}`, unionRect([boxes.name[`rx${r}Name`], boxes.field[`rx${r}Amt`], boxes.field[`rx${r}Freq`], boxes.field[`rx${r}Days`]])]));
const find = (group, rect) => Object.keys(boxes[group]).find((k) => near(boxes[group][k], rect));
const asLines = (text) => (text === '' || text === null || text === undefined ? { lines: [] } : { lines: [[{ text, box: { x: 0, y: 0, width: 10, height: 10 } }]] });
/** private-looking tokens placed on the name, family-head name, address, phone and BPJS-number areas of the page */
export const piiTokens = (texts) => MEDREC.pii.map((r, i) => { const poly = placeBox(aligned.H, r); const cx = poly.reduce((a, q) => a + q[0], 0) / 4; const cy = poly.reduce((a, q) => a + q[1], 0) / 4; return { text: texts[i], x: cx - 30, y: cy - 6, w: 60, h: 12 }; });

export const engine = {
  async load() {},
  async recognize(picture) {
    if (picture.kind === 'page') {
      if (script.page === 'junk') return { lines: [[{ text: 'Tabel Pertumbuhan Anak', confidence: 1, box: { x: 1, y: 1, width: 100, height: 20 } }]] };
      const all = [...baseTokens, ...script.extraTokens];
      return { lines: [all.map((t) => ({ text: t.text, confidence: 1, box: { x: t.x, y: t.y, width: t.w, height: t.h } }))] };
    }
    const rk = find('row', picture.rect);                          // one quick read of a whole prescription row (the empty-row test)
    if (rk) {
      script.calls[rk] = (script.calls[rk] || 0) + 1;
      const r = rk.slice(3); const keys = [`rx${r}Name`, `rx${r}Amt`, `rx${r}Freq`, `rx${r}Days`];
      let t = keys.every((k) => script.blank.has(k)) ? '' : keys.map((k) => script.values[k] ?? DEFAULTS[k] ?? '').join(' ');
      const said = script.say ? script.say({ key: rk, height: picture.height }) : undefined; if (said !== undefined) t = said;
      return asLines(t);
    }
    const tk = find('text', picture.rect);
    if (tk) { let t = tk === 'asessmen' ? script.assess : tk === 'planning' ? script.plan : ''; const said = script.say ? script.say({ key: tk, height: picture.height }) : undefined; if (said !== undefined) t = said; return asLines(t); }
    const key = find('field', picture.rect) || find('name', picture.rect);
    if (!key) return { lines: [] };
    script.calls[key] = (script.calls[key] || 0) + 1;
    let text = script.blank.has(key) ? '' : (script.values[key] ?? DEFAULTS[key] ?? '');
    const said = script.say ? script.say({ key, height: picture.height }) : undefined;
    if (said !== undefined) text = said;
    return asLines(text);
  },
};

export const photo = {
  async load() { return { width: PAGE_W * FACTOR, height: 1600 * FACTOR, url: null }; },
  release() {},
  scaled() { return { kind: 'page', width: PAGE_W, height: 1600 }; },
  crop(img, rect, height) { return { kind: 'crop', rect: { x: rect.x / FACTOR, y: rect.y / FACTOR, w: rect.w / FACTOR, h: rect.h / FACTOR }, height }; },
  ink(picture) {
    const tk = find('tick', picture.rect);
    if (tk) { const r = script.ink ? script.ink(tk) : undefined; return r !== undefined ? r : ((tk === 'sexL' && script.sex === 'L') || (tk === 'sexP' && script.sex === 'P') ? 0.06 : 0.0); }
    const key = find('field', picture.rect) || find('name', picture.rect);
    if (key && script.strong.has(key)) return 0.2;
    if (key && script.noise.has(key)) return 0.03;                  // glare or moire: a little "ink" where nothing is written
    return key && !script.blank.has(key) ? 0.05 : 0.0;
  },
  thumb() { return document.createElement('canvas'); },
};
