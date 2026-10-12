import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// End-to-end tests run against the production build, served by `vite preview`
// under the same /debate/ base path as GitHub Pages. In CI the workflow has
// already built dist/, so the server only serves it. Locally it builds first, so
// the tests don't run against a stale dist/; a server already running on the
// port is reused instead.
const serve = `npx vite preview --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Relative paths resolve under the base path: page.goto('./') opens /debate/.
    baseURL: `http://localhost:${PORT}/debate/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: process.env.CI ? serve : `npx vite build && ${serve}`,
    url: `http://localhost:${PORT}/debate/`,
    reuseExistingServer: !process.env.CI,
  },
});
