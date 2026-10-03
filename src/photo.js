// Browser picture handling: open a photo, make a smaller copy for the whole-page reading,
// and cut out single cells. (Needs a real browser; the logic that decides things lives in readcell.js and session.js.)
import { stretchContrast, inkRatio } from './readcell.js';

export function load(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibuka. Coba foto lain.')); };
    image.src = url;
  });
}
export function release(img) { if (img && img.url) URL.revokeObjectURL(img.url); }

/** A copy no bigger than maxSide on its longest side (big phone photos can run out of memory otherwise). */
export function scaled(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
  canvas.getContext('2d').drawImage(img.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** One cell, cut out at a chosen height, in gray with the contrast stretched, with white margin around it. */
export function crop(img, rect, targetHeight) {
  const sx = Math.max(0, Math.round(rect.x)); const sy = Math.max(0, Math.round(rect.y));
  const sw = Math.max(8, Math.min(img.width - sx, Math.round(rect.w))); const sh = Math.max(8, Math.min(img.height - sy, Math.round(rect.h)));
  const k = targetHeight / sh; const w = Math.max(16, Math.round(sw * k)); const pad = 24;
  const canvas = document.createElement('canvas');
  canvas.width = w + 2 * pad; canvas.height = targetHeight + 2 * pad;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img.source, sx, sy, sw, sh, pad, pad, w, targetHeight);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const raw = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < data.data.length; i += 4, j += 1) raw[j] = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
  const stretched = Uint8ClampedArray.from(raw);
  stretchContrast(stretched);
  for (let i = 0, j = 0; i < data.data.length; i += 4, j += 1) { data.data[i] = stretched[j]; data.data[i + 1] = stretched[j]; data.data[i + 2] = stretched[j]; data.data[i + 3] = 255; }
  ctx.putImageData(data, 0, 0);
  canvas._raw = raw; canvas._inner = { x: pad, y: pad, w, h: targetHeight };
  return canvas;
}

/** Share of dark pixels in a cut-out cell (measured on the original gray values, before the stretch). */
export function ink(canvas) { return inkRatio(canvas._raw, canvas.width, canvas._inner); }

/** A colour picture of a cell with some context, for the person to compare with the reading. */
export function thumb(img, rect, width = 260) {
  const sx = Math.max(0, Math.round(rect.x)); const sy = Math.max(0, Math.round(rect.y));
  const sw = Math.max(8, Math.min(img.width - sx, Math.round(rect.w))); const sh = Math.max(8, Math.min(img.height - sy, Math.round(rect.h)));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = Math.max(40, Math.round(width * (sh / sw)));
  canvas.getContext('2d').drawImage(img.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}
