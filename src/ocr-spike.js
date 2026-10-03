// Engine test page: loads the OCR engine in the browser, reads one photo, shows what it found.
// It does not map values to columns or months. It only answers: can this phone read the handwriting, how fast, offline?
import * as ort from 'onnxruntime-web';
import { PaddleOcrService } from 'ppu-paddle-ocr/web';
import { toNumber, matchTruth, parseExpected } from './ocr-helpers.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const log = (m) => { $('log').textContent += m + '\n'; };
const MAX_SIDE = 1600;   // big phone photos are shrunk first; iPhone Safari can run out of memory otherwise

const MODELS = {
  tiny: { detection: '/models/PP-OCRv6_tiny_det.ort', recognition: '/models/PP-OCRv6_tiny_rec.ort', charactersDictionary: '/models/ppocrv6_tiny_dict.txt' },
  small: { detection: '/models/PP-OCRv6_small_det.ort', recognition: '/models/PP-OCRv6_small_rec.ort', charactersDictionary: '/models/ppocrv6_dict.txt' },
};

ort.env.wasm.wasmPaths = '/ort/';   // our own copy, so nothing is fetched from the internet
const isolated = self.crossOriginIsolated === true;
ort.env.wasm.numThreads = isolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
$('env').innerHTML = `Online now: <b>${navigator.onLine}</b> &middot; cross-origin isolated (faster threads): <b>${isolated}</b> &middot; CPU cores: <b>${navigator.hardwareConcurrency || '?'}</b><br>${esc(navigator.userAgent)}`;

const services = {};
async function getService(tier) {
  if (services[tier]) return services[tier];
  const t0 = performance.now();
  log(`Loading the ${tier} engine...`);
  const service = new PaddleOcrService({ model: { ...MODELS[tier] }, session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all' } });
  await service.initialize();
  services[tier] = service;
  log(`Engine ready after ${((performance.now() - t0) / 1000).toFixed(1)} s (offline now? ${!navigator.onLine})`);
  return service;
}

$('load').addEventListener('click', async () => {
  try { await getService($('tier').value); } catch (e) { log('ERROR: ' + (e && e.message ? e.message : e)); }
});

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open this image'));
    img.src = URL.createObjectURL(file);
  });
}

$('file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const service = await getService($('tier').value);
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    log(`Photo ${img.width}x${img.height}, reading at ${canvas.width}x${canvas.height}...`);
    await new Promise((r) => setTimeout(r, 50));    // let the page paint before the heavy work starts
    const t0 = performance.now();
    const result = await service.recognize(canvas);
    const seconds = (performance.now() - t0) / 1000;

    const tokens = result.lines.flat();
    const expected = parseExpected($('expected').value);
    const { found, missing } = matchTruth(tokens, expected);
    $('out').hidden = false;
    $('score').innerHTML = expected.length
      ? `Expected numbers found: <span class="${missing.length ? 'bad' : 'ok'}">${found.length} of ${expected.length}</span>${missing.length ? ` &middot; not found: ${missing.join(', ')}` : ''}`
      : 'No expected numbers entered.';
    $('timing').innerHTML = `Reading time: <b>${seconds.toFixed(1)} s</b> &middot; ${tokens.length} pieces &middot; mean confidence ${result.confidence.toFixed(2)}`;
    $('lines').textContent = result.lines.map((line) => line.map((t) => t.text).join('   ')).join('\n');
    $('tokens').innerHTML = `<table><thead><tr><th>text</th><th>number?</th><th>conf</th><th>x</th><th>y</th><th>w</th><th>h</th></tr></thead><tbody>${
      tokens.map((t) => `<tr><td>${esc(t.text)}</td><td>${toNumber(t.text) ?? ''}</td><td>${t.confidence.toFixed(2)}</td><td>${Math.round(t.box.x)}</td><td>${Math.round(t.box.y)}</td><td>${Math.round(t.box.width)}</td><td>${Math.round(t.box.height)}</td></tr>`).join('')}</tbody></table>`;
    log(`Done in ${seconds.toFixed(1)} s`);
  } catch (e) {
    log('ERROR: ' + (e && e.message ? e.message : e));
  }
});
