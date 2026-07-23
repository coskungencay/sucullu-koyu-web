import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page yapı: mevcut sitenin iki rotası birebir korunur (ADR-001).
export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        'canli-kamera': resolve(import.meta.dirname, 'canli-kamera.html'),
      },
    },
  },
});
