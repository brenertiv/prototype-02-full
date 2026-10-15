import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build run under a subpath. VITE_BUILD_COMMIT feeds the test panel
// and telemetry (test-config.md › Telemetry).
process.env.VITE_BUILD_COMMIT ??= process.env.VERCEL_GIT_COMMIT_SHA ?? '';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5176, strictPort: true },
});
