import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createApi } from './server/api';

// In development the same API that runs in production (server/main.ts) is mounted inside Vite,
// so the API key stays on the server side in both cases.
function gameApi(env: Record<string, string>): Plugin {
  const handle = createApi(env);
  return {
    name: 'game-api',
    configureServer(server) { server.middlewares.use((req, res, next) => { handle(req, res, next); }); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => { handle(req, res, next); }); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [gameApi(env)],
    server: { port: 5173, open: false },
    build: { chunkSizeWarningLimit: 2500 },
    worker: { format: 'es' },
  };
});
