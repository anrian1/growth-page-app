import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./tests/stubs/pwa-register.js', import.meta.url)) } },
  // fileParallelism: false = one screen-test file at a time. Each file starts its own simulated browser (jsdom); on a computer with many
  // processor cores and little free memory, starting 7 at once ran out of memory ("JavaScript heap out of memory", exit code 134).
  test: { environment: 'jsdom', include: ['tests/ui*.test.js'], setupFiles: ['fake-indexeddb/auto'], fileParallelism: false },
});
