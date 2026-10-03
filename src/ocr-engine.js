// The OCR engine: a small open model (PaddleOCR PP-OCRv6) running inside the browser with ONNX Runtime.
// The model files and the WebAssembly files are saved on the phone by the service worker, so this works offline.
// Loaded only when the first photo is read, so the app opens fast.
import * as ort from 'onnxruntime-web';
import { PaddleOcrService } from 'ppu-paddle-ocr/web';

const MODELS = {
  tiny: { detection: '/models/PP-OCRv6_tiny_det.ort', recognition: '/models/PP-OCRv6_tiny_rec.ort', charactersDictionary: '/models/ppocrv6_tiny_dict.txt' },
  small: { detection: '/models/PP-OCRv6_small_det.ort', recognition: '/models/PP-OCRv6_small_rec.ort', charactersDictionary: '/models/ppocrv6_dict.txt' },
};
export const DEFAULT_TIER = 'small';          // UPDATE ME: choose after comparing tiny and small on a real phone
let service = null; let loadedTier = null;

export function currentTier() {
  try { const t = localStorage.getItem('kia-ocr-tier'); if (t && MODELS[t]) return t; } catch (e) { /* storage can be blocked */ }
  return DEFAULT_TIER;
}
export function setTier(tier) { try { localStorage.setItem('kia-ocr-tier', tier); } catch (e) { /* ignore */ } }

export async function load(tier = currentTier()) {
  if (service && loadedTier === tier) return service;
  ort.env.wasm.wasmPaths = '/ort/';           // our own copy, so nothing is fetched from the internet
  ort.env.wasm.numThreads = self.crossOriginIsolated === true ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  service = new PaddleOcrService({ model: { ...MODELS[tier] }, session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all' } });
  await service.initialize();
  loadedTier = tier;
  return service;
}

export async function recognize(canvas, options) {
  if (!service) await load();
  return service.recognize(canvas, options);
}
