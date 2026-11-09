// The game's LLM endpoint: the one place that holds the provider key (god/05-llm.md §1 rule 7). Mounted by vite.config.ts in `npm run dev` and `vite preview`, and by
// server/main.ts for a built game. The browser sends a point and its data (src/core/llm/http.ts); this side adds what it keeps itself:
//   - the system text, the model, the temperature and the output ceiling of the point (src/core/llm/prompts.ts and tuning.ts), so the key answers only the game's three tasks;
//   - the server switches from the environment (llm/README.md §3 "อ่านจากสองที่"): OVERSEER_LLM = off | fake | deepseek, OVERSEER_LLM_POINTS_OFF = a comma list;
//   - the limits of llm/01-cost.md §8: requests per address per ten minutes (60) and per day for the whole server (OVERSEER_LLM_DAILY, default 20,000), the size of the data;
//   - one line of usage per request in .data/llm-server.jsonl (tokens and cache hits, 01-cost.md §8 "บันทึก"), never the data or the answer.
//   GET  /api/llm/status   → { enabled, points, provider }
//   POST /api/llm/complete { point, user, schema? } → { text, usage, model } | { error: { kind, message } }
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { configFromEnv, deepseekProvider, FakeProvider, MAX_TOKENS, MODEL_OF, POINTS, ProviderError, TEMPERATURE, type Fixtures, type LlmPoint, type Provider } from '../src/core/llm';
import { COMMAND_SYSTEM, DIRECTOR_SYSTEM, ENDING_SYSTEM } from '../src/core/llm/prompts';

const SYSTEM: Record<LlmPoint, string> = { command: COMMAND_SYSTEM, director: DIRECTOR_SYSTEM, ending: ENDING_SYSTEM };

/** Limits (llm/01-cost.md §8): 60 requests per address per ten minutes, 20,000 a day for the server; the data of one request at most 12,000 characters (the end summary sends about 2,000). */
export const LIMITS = { perAddress: 60, windowMs: 10 * 60_000, daily: 20_000, userChars: 12_000, bodyBytes: 64_000 };

export interface LlmApiOpts {
  env: Record<string, string | undefined>;
  /** Overrides the provider the environment picks (tests). */
  provider?: Provider;
  /** Where the usage lines go; default .data/llm-server.jsonl under `root`, none when `false`. */
  ledger?: string | false;
  root?: string;
  now?: () => number;
}

type Handler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const fail = (res: ServerResponse, status: number, kind: string, message: string, retryAfterMs?: number) => send(res, status, { error: { kind, message, ...(retryAfterMs ? { retryAfterMs } : {}) } });

function readBody(req: IncomingMessage, max: number): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        resolve(null);
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/** The provider the environment asks for, or none when the layer is off or the key is missing. `fake` answers from the fixtures of the tools (tests/fixtures/llm/tool.json). */
export function providerFromEnv(env: Record<string, string | undefined>, root = process.cwd()): Provider | undefined {
  const mode = (env.OVERSEER_LLM ?? 'off').toLowerCase();
  if (mode === 'fake') {
    const file = path.join(root, 'tests/fixtures/llm/tool.json');
    return new FakeProvider(existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Fixtures) : { responses: [] });
  }
  if (mode === 'deepseek' && env.DEEPSEEK_API_KEY) return deepseekProvider({ env });
  return undefined;
}

export function createLlmApi(o: LlmApiOpts): Handler {
  const config = configFromEnv(o.env);
  const provider = o.provider ?? (config.enabled ? providerFromEnv(o.env, o.root) : undefined);
  const enabled = config.enabled && !!provider;
  const points = Object.fromEntries(POINTS.map((p) => [p, enabled && config.points?.[p] !== false])) as Record<LlmPoint, boolean>;
  const daily = Number(o.env.OVERSEER_LLM_DAILY) > 0 ? Number(o.env.OVERSEER_LLM_DAILY) : LIMITS.daily;
  const now = o.now ?? Date.now;
  const ledger = o.ledger === false ? undefined : (o.ledger ?? path.join(o.root ?? process.cwd(), '.data/llm-server.jsonl'));
  const seen = new Map<string, number[]>();
  let day = '';
  let today = 0;

  const log = (line: Record<string, unknown>) => {
    if (!ledger) return;
    try {
      mkdirSync(path.dirname(ledger), { recursive: true });
      appendFileSync(ledger, `${JSON.stringify(line)}\n`);
    } catch {
      // the log is for the owner; a full disk must not stop the game
    }
  };

  return async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/api/llm')) return next ? next() : fail(res, 404, 'bad_request', 'not found');
    if (url === '/api/llm/status' && req.method === 'GET') return send(res, 200, { enabled, points, provider: enabled ? provider!.name : 'none' });
    if (url !== '/api/llm/complete' || req.method !== 'POST') return fail(res, 404, 'bad_request', 'not found');
    if (!enabled) return fail(res, 503, 'server', 'the LLM is off on this server');

    // limits: per address in a sliding window, per day for the whole server
    const t = now();
    const address = req.socket.remoteAddress ?? '?';
    const recent = (seen.get(address) ?? []).filter((x) => t - x < LIMITS.windowMs);
    if (recent.length >= LIMITS.perAddress) return fail(res, 429, 'rate_limit', 'too many requests', LIMITS.windowMs - (t - recent[0]));
    const d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) {
      day = d;
      today = 0;
    }
    if (today >= daily) return fail(res, 429, 'credit', 'the daily budget of the server is spent');

    const raw = await readBody(req, LIMITS.bodyBytes);
    if (raw === null) return fail(res, 413, 'bad_request', 'request too large');
    let body: { point?: unknown; user?: unknown; schema?: unknown };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return fail(res, 400, 'bad_request', 'not JSON');
    }
    const point = body.point as LlmPoint;
    if (!POINTS.includes(point)) return fail(res, 400, 'bad_request', 'unknown point');
    if (!points[point]) return fail(res, 503, 'server', `the point ${point} is off on this server`);
    if (typeof body.user !== 'string' || !body.user.trim() || body.user.length > LIMITS.userChars) return fail(res, 400, 'bad_request', 'bad data');
    if (body.schema !== undefined && (typeof body.schema !== 'object' || body.schema === null || Array.isArray(body.schema))) return fail(res, 400, 'bad_request', 'bad schema');

    recent.push(t);
    seen.set(address, recent);
    today++;
    const started = now();
    try {
      const out = await provider!.complete({
        point,
        model: config.models?.[point] ?? MODEL_OF[point],
        system: SYSTEM[point],
        user: body.user,
        ...(body.schema ? { schema: body.schema as Record<string, unknown> } : {}),
        maxTokens: MAX_TOKENS[point],
        temperature: TEMPERATURE[point],
      });
      log({ at: new Date(started).toISOString(), point, ok: true, ms: now() - started, model: out.model, ...out.usage });
      return send(res, 200, out);
    } catch (e) {
      const kind = e instanceof ProviderError ? e.kind : 'unknown';
      log({ at: new Date(started).toISOString(), point, ok: false, ms: now() - started, kind });
      const status = kind === 'rate_limit' ? 429 : kind === 'bad_request' ? 400 : 502;
      return fail(res, status, kind, e instanceof Error ? e.message.slice(0, 200) : 'failed', e instanceof ProviderError ? e.retryAfterMs : undefined);
    }
  };
}
