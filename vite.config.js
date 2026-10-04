import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

// These two headers let the OCR run on several processor threads. Everything is served from our own site, so nothing breaks.
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  server: { headers: isolation },
  preview: { headers: isolation },
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), ocrSpike: resolve(import.meta.dirname, 'ocr-spike.html') } },
  },
  resolve: {
    // Use the CPU-only (WebAssembly) build of the ONNX runtime. It is smaller and works on every phone.
    alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' }],
  },
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${stamp} UTC)`),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',            // a new version installs quietly when the phone has internet
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'HONAI',
        short_name: 'HONAI',
        description: 'HONAI: rekam medis kertas menjadi data, status gizi dan pemeriksaan dosis malaria. Bekerja tanpa internet.',
        lang: 'id',
        theme_color: '#1b6b4f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs must be listed here, or it will not work offline.
        // Model files (.onnx) and WASM files are added so they are saved on the phone too.
        globPatterns: ['**/*.{js,css,html,png,svg,json,txt,wasm,onnx,ort,mjs,pdf}'],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Vite also copies the WebAssembly file into assets/. We load our own copy from /ort/, so do not save two.
        globIgnores: ['assets/ort-wasm-*.wasm'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
