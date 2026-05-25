import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src/web', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/admin': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/csrf-token': 'http://localhost:3000',
      '/docs': 'http://localhost:3000',
      '/event': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/me': 'http://localhost:3000',
      '/proposals': 'http://localhost:3000',
      '/reviews': 'http://localhost:3000',
      '/setup/complete': 'http://localhost:3000',
      '/setup/validate-token': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
});
