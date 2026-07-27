import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  assetsInclude: ['**/*.wasm', '**/*.ico'],
  optimizeDeps: {
    exclude: ['fatfs-wasm'],
  },
  build: {
    cssMinify: false,
  },
  worker: {
    format: 'es',
  },
});
