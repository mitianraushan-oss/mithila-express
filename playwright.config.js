import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] },
  },
  webServer: {
    command: 'node tools/serve.mjs 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
