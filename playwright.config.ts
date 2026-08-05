import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  },
  webServer: {
    // E2E'ler kamera disabled build'i kullanır (.env.test): mock modları
    // deterministik kalır ve testler gerçek gateway'in anlık durumuna
    // bağımlı olmaz. Production (live) davranışı staging smoke ile doğrulanır.
    command: 'npm run build:test && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
