import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from GitHub Pages as a project site: https://plinklabs.org/debate/
export default defineConfig({
  base: '/debate/',
  plugins: [react()],
  test: {
    // Component tests live next to the code in src/; the Playwright specs in
    // e2e/ are run by `npm run e2e`, not by Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
