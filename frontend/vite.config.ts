import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En Docker el backend se alcanza como http://backend:3000; fuera de Docker,
// en localhost. docker-compose.yml define API_URL.
const apiUrl = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiUrl, changeOrigin: true },
    },
  },
});
