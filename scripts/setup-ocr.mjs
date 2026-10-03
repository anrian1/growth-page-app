// Prepares the files the OCR needs so the app can run with no internet:
//   1) copies the ONNX Runtime WebAssembly files from node_modules to public/ort/
//   2) downloads the OCR model files to public/models/  (tiny and small tiers)
// Runs automatically before `npm run build`. Run it yourself with:  npm run setup-ocr
// Set SKIP_MODELS=1 to skip the downloads (used only for quick checks).
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ortOut = join(root, 'public', 'ort');
const modelOut = join(root, 'public', 'models');
mkdirSync(ortOut, { recursive: true });
mkdirSync(modelOut, { recursive: true });

// 1) WebAssembly files (CPU version only: about 14 MB, works on iPhone and Android)
for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  const from = join(root, 'node_modules', 'onnxruntime-web', 'dist', f);
  if (!existsSync(from)) { console.error(`MISSING ${from}. Run "npm install" first.`); process.exit(1); }
  copyFileSync(from, join(ortOut, f));
  console.log(`copied  ort/${f}  (${(statSync(from).size / 1e6).toFixed(1)} MB)`);
}

// 2) Model files (PP-OCRv6 from the ppu-paddle-ocr-models collection; Apache-2.0 PaddleOCR models)
const SOURCES = [
  'https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/main/',
  'https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/raw/main/',
];
const MODELS = [
  { name: 'PP-OCRv6_tiny_det.ort', path: 'detection/ort/PP-OCRv6_tiny_det.ort', minBytes: 100_000 },
  { name: 'PP-OCRv6_tiny_rec.ort', path: 'recognition/ort/PP-OCRv6_tiny_rec.ort', minBytes: 100_000 },
  { name: 'ppocrv6_tiny_dict.txt', path: 'recognition/ppocrv6_tiny_dict.txt', minBytes: 1_000 },
  { name: 'PP-OCRv6_small_det.ort', path: 'detection/ort/PP-OCRv6_small_det.ort', minBytes: 100_000 },
  { name: 'PP-OCRv6_small_rec.ort', path: 'recognition/ort/PP-OCRv6_small_rec.ort', minBytes: 100_000 },
  { name: 'ppocrv6_dict.txt', path: 'recognition/ppocrv6_dict.txt', minBytes: 1_000 },
];

async function download(model) {
  const target = join(modelOut, model.name);
  if (existsSync(target) && statSync(target).size >= model.minBytes) return { ok: true, note: 'already there', size: statSync(target).size };
  const errors = [];
  for (const base of SOURCES) {
    try {
      const res = await fetch(base + model.path, { redirect: 'follow' });
      if (!res.ok) { errors.push(`${base} -> HTTP ${res.status}`); continue; }
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length < model.minBytes) { errors.push(`${base} -> only ${data.length} bytes (a pointer file, not the model)`); continue; }
      writeFileSync(target, data);
      return { ok: true, note: 'downloaded', size: data.length };
    } catch (e) { errors.push(`${base} -> ${e.message}`); }
  }
  return { ok: false, note: errors.join(' | '), size: 0 };
}

if (process.env.SKIP_MODELS) {
  console.log('SKIP_MODELS is set: model downloads skipped.');
} else {
  let failed = 0;
  for (const m of MODELS) {
    const r = await download(m);
    if (r.ok) console.log(`${r.note.padEnd(13)} models/${m.name}  (${(r.size / 1e6).toFixed(1)} MB)`);
    else { failed += 1; console.error(`FAILED        models/${m.name}\n  ${r.note}`); }
  }
  if (failed) {
    console.error(`\n${failed} model file(s) could not be downloaded.\nDownload them by hand from https://huggingface.co/snowfluke/ppu-paddle-ocr-models/tree/main and put them in public/models/ with the names above.`);
    process.exit(1);
  }
  console.log('\nAll OCR files are ready.');
}
