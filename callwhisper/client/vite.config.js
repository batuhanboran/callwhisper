import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/audio-rep': { target: 'ws://192.168.1.111:3003', ws: true },
      '/audio-prospect': { target: 'ws://192.168.1.111:3003', ws: true },
      '/events': { target: 'ws://192.168.1.111:3003', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
