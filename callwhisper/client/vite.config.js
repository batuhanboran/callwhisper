import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendWs = env.VITE_BACKEND_WS || 'ws://localhost:3001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/audio-rep': { target: backendWs, ws: true },
        '/audio-prospect': { target: backendWs, ws: true },
        '/events': { target: backendWs, ws: true },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
