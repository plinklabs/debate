import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from GitHub Pages as a project site: https://plinklabs.org/debate/
export default defineConfig({
  base: '/debate/',
  plugins: [react()],
});
