import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${stamp} UTC)`),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',            // a new version installs quietly when the phone has internet
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'KIA Tumbuh',
        short_name: 'KIA Tumbuh',
        description: 'Halaman tumbuh kembang Buku KIA (0-24 bulan), bekerja tanpa internet.',
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
        globPatterns: ['**/*.{js,css,html,png,svg,json,txt,wasm,onnx,mjs}'],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
