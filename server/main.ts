// Production server: serves the built game (dist/) and the API on one port.
// Hashed assets are cached for a year (Cloudflare keeps them at the edge); index.html is never cached.
// Text files are sent brotli/gzip-compressed (compressed once, kept in memory) so the tunnel carries ~450 KB, not 2 MB.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createApi } from './api';

const PORT = Number(process.env.PORT || 8080);
const DIST = path.resolve(process.env.DIST_DIR || 'dist');
const api = createApi(process.env);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);

interface Entry { raw: Buffer; br?: Buffer; gz?: Buffer; mtime: number }
const files = new Map<string, Entry>();

async function load(file: string): Promise<Entry> {
  const st = await fs.stat(file);
  const hit = files.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit;
  const raw = await fs.readFile(file);
  const e: Entry = { raw, mtime: st.mtimeMs };
  if (COMPRESSIBLE.has(path.extname(file)) && raw.length > 1024) {
    e.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
    e.gz = zlib.gzipSync(raw, { level: 9 });
  }
  files.set(file, e);
  return e;
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
  let url: string;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.statusCode = 400; return res.end(); }
  let file = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end(); }
  try {
    const st = await fs.stat(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    // unknown hashed asset → real 404 (an HTML fallback would be cached as JS); other paths → single-page app
    if (url.startsWith('/assets/')) { res.statusCode = 404; return res.end('not found'); }
    file = path.join(DIST, 'index.html');
  }
  try {
    const e = await load(file);
    const accept = String(req.headers['accept-encoding'] || '');
    const [body, enc] = e.br && /\bbr\b/.test(accept) ? [e.br, 'br'] : e.gz && /\bgzip\b/.test(accept) ? [e.gz, 'gzip'] : [e.raw, ''];
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (e.br) res.setHeader('Vary', 'Accept-Encoding');
    if (enc) res.setHeader('Content-Encoding', enc);
    res.setHeader('Content-Length', body.length);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}

const server = http.createServer((req, res) => {
  api(req, res, () => { serveStatic(req, res); });
});
server.listen(PORT, () => console.log(`isekai server on :${PORT}`));
// k8s sends SIGTERM on rollout: stop accepting, let in-flight requests (saves) finish
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); });
