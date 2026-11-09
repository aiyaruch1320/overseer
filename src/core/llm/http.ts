// The provider of the browser: the game's own server holds the key and the fixed prompts (god/05-llm.md §1 rule 7 "กุญแจ API อยู่ที่เซิร์ฟเวอร์ เบราว์เซอร์ส่งชื่องาน
// กับข้อมูลสั้นเท่านั้น"). A request carries the point, the data of the request and, for a choice, its schema; the server adds the system text, the model, the temperature
// and the output ceiling of the point itself (server/llm-api.ts), so the endpoint cannot be used as a general relay of the key. Errors come back as the kinds of
// llm/02-offline.md §5, and the client of the layer falls back to tier 0 as with any provider.
import { ProviderError, type FailKind, type JsonSchema, type Provider, type ProviderResponse } from './types';
import type { LlmPoint } from './tuning';

/** Where the game's server answers (the same origin as the page). */
export const LLM_API = '/api/llm';

/** What the browser sends: the point and the data, nothing the server can take from its own copy. */
export interface HttpRequestBody {
  point: LlmPoint;
  user: string;
  schema?: JsonSchema;
}

/** What the server says of itself (`GET /api/llm/status`): the master switch of the server side and its points (llm/README.md §3 "อ่านจากสองที่"). */
export interface LlmStatus {
  enabled: boolean;
  points: Record<LlmPoint, boolean>;
  provider: string;
}

const KINDS: readonly FailKind[] = ['network', 'timeout', 'rate_limit', 'credit', 'server', 'bad_request', 'empty', 'invalid', 'unknown'];

export interface HttpOpts {
  /** Base path of the API; default `/api/llm`. */
  base?: string;
  fetch?: typeof fetch;
}

export function httpProvider(opts: HttpOpts = {}): Provider {
  const base = opts.base ?? LLM_API;
  return {
    name: 'http',
    async complete(req) {
      const doFetch = opts.fetch ?? fetch;
      const body: HttpRequestBody = { point: req.point, user: req.user, ...(req.schema ? { schema: req.schema } : {}) };
      let res: Response;
      try {
        res = await doFetch(`${base}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: req.signal });
      } catch (e) {
        const aborted = (e as { name?: string }).name === 'AbortError';
        throw new ProviderError(aborted ? 'timeout' : 'network', aborted ? 'request aborted' : String((e as Error).message ?? e));
      }
      const out = (await res.json().catch(() => ({}))) as Partial<ProviderResponse> & { error?: { kind?: string; message?: string; retryAfterMs?: number } };
      if (!res.ok || out.error) {
        const kind = (KINDS as readonly string[]).includes(out.error?.kind ?? '') ? (out.error!.kind as FailKind) : res.status === 429 ? 'rate_limit' : res.status >= 500 ? 'server' : 'bad_request';
        throw new ProviderError(kind, out.error?.message ?? `HTTP ${res.status}`, out.error?.retryAfterMs);
      }
      if (typeof out.text !== 'string' || !out.usage) throw new ProviderError('invalid', 'the server answered without text');
      return { text: out.text, usage: out.usage, model: out.model ?? req.model };
    },
  };
}

/** Asks the server whether the layer may run; a server that does not answer (a static host, no `/api`) is a server with the layer off. */
export async function llmStatus(opts: HttpOpts = {}): Promise<LlmStatus> {
  const off: LlmStatus = { enabled: false, points: { command: false, director: false, ending: false }, provider: 'none' };
  try {
    const res = await (opts.fetch ?? fetch)(`${opts.base ?? LLM_API}/status`);
    if (!res.ok) return off;
    const s = (await res.json()) as Partial<LlmStatus>;
    return s && typeof s.enabled === 'boolean' && s.points ? { enabled: s.enabled, points: { ...off.points, ...s.points }, provider: s.provider ?? 'unknown' } : off;
  } catch {
    return off;
  }
}
