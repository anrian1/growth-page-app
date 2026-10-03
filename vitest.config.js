import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./tests/stubs/pwa-register.js', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/ui.test.js'], setupFiles: ['fake-indexeddb/auto'] },
});
