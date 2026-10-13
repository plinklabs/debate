import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { serviceWorker } from './tools/serviceWorker.ts';

// Served from GitHub Pages as a project site: https://plinklabs.org/debate/
export default defineConfig({
  base: '/debate/',
  // The service worker (sw.js) is only built, and only registered, for production.
  plugins: [react(), serviceWorker()],
  test: {
    // Component tests live next to the code in src/; the Playwright specs in
    // e2e/ are run by `npm run e2e`, not by Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // Vitest leaves CSS out by default. The report's style sheet is read as
    // text into the report file (src/report/html.ts), so tests need it.
    css: { include: [/src\/report\/document\.css/] },
  },
});
