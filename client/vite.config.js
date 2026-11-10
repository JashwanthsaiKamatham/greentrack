import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local development the frontend calls /api and Vite forwards it to the Express server.
// In production VITE_API_BASE_URL points at the deployed backend instead.
const proxy = { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, proxy },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true, proxy },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
