// A built game with its LLM endpoint: `npm run serve` (builds dist/, then serves it and /api/llm on PORT, default 8080). The key and the switches come from the
// environment or .env (server/llm-api.ts); nothing of them reaches the page. Static files only from dist/, with the paths resolved inside it.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmApi } from './llm-api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

/** .env lines KEY=value, under what the environment already holds. */
function envOf(): Record<string, string | undefined> {
  const file = path.join(root, '.env');
  const fromFile = existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((l) => /^[A-Z0-9_]+=/.test(l))
          .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
      )
    : {};
  return { ...fromFile, ...process.env };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const env = envOf();
const api = createLlmApi({ env, root });
const port = Number(env.PORT) || 8080;

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url.startsWith('/api/')) return api(req, res);
  const file = path.join(dist, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dist + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404;
    return res.end('not found');
  }
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`overseer on http://localhost:${port} · LLM ${env.OVERSEER_LLM ?? 'off'}`));
