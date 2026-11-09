import { defineConfig } from 'vite';

export default defineConfig({
  // one copy of Preact for the app, its hooks and the signals. Every dependency is pre-bundled once at start and none is discovered
  // later: a second optimisation in the middle of a session (Phaser behind the map's dynamic import) served the Preact chunk twice, with
  // and without its version, and the hooks broke ("reading '__H'"); a dependency added to the code must be listed here
  resolve: { dedupe: ['preact'] },
  optimizeDeps: { noDiscovery: true, include: ['preact', 'preact/hooks', 'preact/jsx-dev-runtime', 'preact/jsx-runtime', '@preact/signals', 'phaser'] },
  server: { port: 5173, open: false },
  build: { chunkSizeWarningLimit: 2500, rollupOptions: { input: { main: 'index.html', debug: 'debug.html', dev: 'dev.html', town: 'town.html' } } },
  worker: { format: 'es' },
});
