import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createLlmApi } from './server/llm-api';

// The game's LLM endpoint inside `npm run dev` and `vite preview` (server/llm-api.ts): the key in .env stays in this process, never in the bundle
// (no VITE_ prefix). OVERSEER_LLM in .env picks the provider: off (default), fake or deepseek.
function llmApi(env: Record<string, string>): Plugin {
  const handle = createLlmApi({ env, root: process.cwd() });
  return {
    name: 'overseer-llm-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => handle(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => handle(req, res, next));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [llmApi(loadEnv(mode, process.cwd(), ''))],
  // one copy of Preact for the app, its hooks and the signals. Every dependency is pre-bundled once at start and none is discovered
  // later: a second optimisation in the middle of a session (Phaser behind the map's dynamic import) served the Preact chunk twice, with
  // and without its version, and the hooks broke ("reading '__H'"); a dependency added to the code must be listed here
  resolve: { dedupe: ['preact'] },
  optimizeDeps: { noDiscovery: true, include: ['preact', 'preact/hooks', 'preact/jsx-dev-runtime', 'preact/jsx-runtime', '@preact/signals', 'phaser'] },
  server: { port: 5173, open: false },
  build: { chunkSizeWarningLimit: 2500, rollupOptions: { input: { main: 'index.html', debug: 'debug.html', dev: 'dev.html', town: 'town.html' } } },
  worker: { format: 'es' },
}));
