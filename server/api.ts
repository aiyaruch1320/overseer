// Game API, used both by the Vite dev server (as middleware) and by the production server (server/main.ts).
//   POST /api/narrate          {task, data} → {text}      (prompts built here; rate-limited; daily budget)
//   GET  /api/narrate/status                → {enabled}
//   GET  /api/save/:pid / PUT /api/save/:pid             (cloud save, one JSON per anonymous player id)
//   POST /api/telemetry        {pid, events[]}            (playtest stats, appended as JSON lines per day)
//   GET  /healthz
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildPrompt } from './prompts';

export interface ApiEnv {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
  DATA_DIR?: string;
  NARRATE_PER_IP_10MIN?: string; // requests per IP per 10 minutes
  NARRATE_DAILY_CAP?: string; // total LLM calls per day for the whole server
  SAVES_PER_IP_10MIN?: string; // cloud-save uploads + telemetry batches per IP per 10 minutes
}

type Next = () => void;

const json = (res: ServerResponse, code: number, body: unknown) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) return null;
    chunks.push(c as Buffer);
  }
  const buf = Buffer.concat(chunks);
  if (req.headers['content-encoding'] !== 'gzip') return buf.toString('utf8');
  try { return zlib.gunzipSync(buf, { maxOutputLength: limit * 4 }).toString('utf8'); } catch { return null; } // also stops gzip bombs
}

// Cloudflare puts the visitor's address in CF-Connecting-IP
const clientIp = (req: IncomingMessage) => String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
const PID = /^[a-z0-9-]{8,64}$/;

// fixed-window counter per IP (in memory: fine for one replica; see deploy/README.md for more)
function limiter(max: number, windowMs = 10 * 60_000) {
  const buckets = new Map<string, { n: number; reset: number }>();
  return (ip: string) => {
    const now = Date.now();
    const b = buckets.get(ip);
    if (!b || now > b.reset) {
      if (buckets.size > 50_000) buckets.clear();
      buckets.set(ip, { n: 1, reset: now + windowMs });
      return true;
    }
    if (b.n >= max) return false;
    b.n++;
    return true;
  };
}

export function createApi(env: ApiEnv) {
  const key = env.DEEPSEEK_API_KEY || '';
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  const base = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const dataDir = env.DATA_DIR || path.resolve('.data');
  const perIp = Number(env.NARRATE_PER_IP_10MIN || 40);
  const dailyCap = Number(env.NARRATE_DAILY_CAP || 20000);
  const narrateIp = limiter(perIp);
  const writeIp = limiter(Number(env.SAVES_PER_IP_10MIN || 60));
  let day = new Date().toISOString().slice(0, 10);
  let dayCalls = 0;

  const allow = (ip: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; dayCalls = 0; }
    if (dayCalls >= dailyCap || !narrateIp(ip)) return false;
    dayCalls++;
    return true;
  };

  async function narrate(req: IncomingMessage, res: ServerResponse) {
    if (!key) return json(res, 503, { error: 'narration disabled' });
    const body = await readBody(req, 4096);
    if (!body) return json(res, 413, { error: 'too large' });
    let task = '', data: Record<string, unknown> = {};
    try { ({ task, data } = JSON.parse(body)); } catch { return json(res, 400, { error: 'bad json' }); }
    const built = buildPrompt(String(task), data && typeof data === 'object' ? data : {});
    if (!built) return json(res, 400, { error: 'unknown task' });
    if (!allow(clientIp(req))) return json(res, 429, { error: 'slow down' });
    try {
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        // thinking is on by default for deepseek-flash; short prose doesn't need it
        body: JSON.stringify({ model, messages: built.messages, max_tokens: built.max_tokens, temperature: built.temperature, stream: false, thinking: { type: 'disabled' } }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json() as { choices?: { message?: { content?: string } }[]; usage?: unknown; error?: { message?: string } };
      if (!r.ok) return json(res, 502, { error: j?.error?.message || 'upstream error' });
      return json(res, 200, { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage ?? null });
    } catch (e) {
      return json(res, 502, { error: String(e) });
    }
  }

  async function save(req: IncomingMessage, res: ServerResponse, pid: string) {
    if (!PID.test(pid)) return json(res, 400, { error: 'bad id' });
    const file = path.join(dataDir, 'saves', `${pid}.json`);
    if (req.method === 'GET') {
      try { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(await fs.readFile(file)); }
      catch { json(res, 404, { error: 'none' }); }
      return;
    }
    if (req.method !== 'PUT') return json(res, 405, { error: 'method' });
    if (!writeIp(clientIp(req))) return json(res, 429, { error: 'slow down' });
    const body = await readBody(req, 4 * 1024 * 1024);
    if (!body) return json(res, 413, { error: 'too large' });
    try { JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(`${file}.tmp`, body);
    await fs.rename(`${file}.tmp`, file); // atomic replace
    return json(res, 200, { ok: true });
  }

  async function telemetry(req: IncomingMessage, res: ServerResponse) {
    if (!writeIp(clientIp(req))) return json(res, 429, { error: 'slow down' });
    const body = await readBody(req, 64 * 1024);
    if (!body) return json(res, 413, { error: 'too large' });
    let parsed: { pid?: string; events?: unknown[] };
    try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
    if (!PID.test(String(parsed.pid)) || !Array.isArray(parsed.events)) return json(res, 400, { error: 'bad payload' });
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(dataDir, 'telemetry');
    await fs.mkdir(dir, { recursive: true });
    const lines = parsed.events.slice(0, 200).map((e) => JSON.stringify({ at: Date.now(), pid: parsed.pid, e })).join('\n') + '\n';
    await fs.appendFile(path.join(dir, `${day}.jsonl`), lines);
    return json(res, 200, { ok: true });
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, next?: Next) {
    const url = (req.url || '').split('?')[0];
    try {
      if (url === '/healthz') return json(res, 200, { ok: true });
      if (url === '/api/narrate/status') return json(res, 200, { enabled: !!key });
      if (url === '/api/narrate' && req.method === 'POST') return await narrate(req, res);
      if (url.startsWith('/api/save/')) return await save(req, res, url.slice(10));
      if (url === '/api/telemetry' && req.method === 'POST') return await telemetry(req, res);
      if (url.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    } catch (e) {
      return json(res, 500, { error: String(e) });
    }
    if (next) next();
    else json(res, 404, { error: 'not found' });
  };
}
