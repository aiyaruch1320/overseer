// The real provider the docs chose: DeepSeek V4.1 Flash, API name `deepseek-flash` (llm/README.md §1), through the OpenAI-compatible chat completions API.
// Never built by the tests or the gates on a network; the tools build it for `--llm=deepseek`. What the docs ask of a request (llm/README.md §1, 01-cost.md §3, 08-live-test.md §7):
//  - thinking mode off (`thinking: {type: "disabled"}`): thinking tokens are billed as output and the mode ignores temperature;
//  - the fixed part first (the system message, the same for every call of a point) and no `user_id`, so the automatic prefix cache is shared;
//  - a choice from a list is a strict tool call at the `/beta` endpoint (`enum` is allowed, `null` is not: the data uses `none`);
//  - a many-field answer may use `response_format: {type: "json_object"}` (`jsonMode`): the prompt must hold the word json and an example, which the caller owns;
//  - `usage.prompt_cache_hit_tokens` and `prompt_cache_miss_tokens` are read from every answer.
// The key is read from `DEEPSEEK_API_KEY` when the provider is made, never kept in a file or sent anywhere but the API (god/05-llm.md §1 rule 7). `fetch` is injectable.
import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from './types';

export const DEEPSEEK_URL = 'https://api.deepseek.com';
export const DEEPSEEK_KEY_ENV = 'DEEPSEEK_API_KEY';
export const DEEPSEEK_URL_ENV = 'DEEPSEEK_BASE_URL';

export interface DeepseekOpts {
  /** The key; default: `env[DEEPSEEK_API_KEY]`. */
  apiKey?: string;
  env?: Record<string, string | undefined>;
  /** The base URL without the path; default `env[DEEPSEEK_BASE_URL]` or https://api.deepseek.com. */
  url?: string;
  fetch?: typeof fetch;
}

interface Body {
  choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
  model?: string;
  error?: { message?: string; type?: string; code?: string | number | null };
}

const TOOL = 'answer';

/** The body of the request. The system message goes first (the prefix the cache keeps); a schema is sent as a strict tool the model must call. */
export function deepseekBody(req: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    stream: false,
    thinking: { type: 'disabled' },
  };
  if (req.schema) {
    body.tools = [{ type: 'function', function: { name: TOOL, description: 'Give the answer in the required shape.', strict: true, parameters: req.schema } }];
    body.tool_choice = { type: 'function', function: { name: TOOL } };
  } else if (req.jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  return body;
}

/** Strict tool calls live at `/beta`; everything else at the plain path. */
export const deepseekEndpoint = (base: string, req: Pick<ProviderRequest, 'schema'>): string => `${base.replace(/\/+$/, '')}${req.schema ? '/beta' : ''}/chat/completions`;

export function deepseekProvider(opts: DeepseekOpts = {}): Provider {
  const env = opts.env ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const key = opts.apiKey ?? env[DEEPSEEK_KEY_ENV];
  const base = opts.url ?? env[DEEPSEEK_URL_ENV] ?? DEEPSEEK_URL;
  return {
    name: 'deepseek',
    async complete(req) {
      if (!key) throw new ProviderError('bad_request', `${DEEPSEEK_KEY_ENV} is not set`);
      const doFetch = opts.fetch ?? fetch;
      let res: Response;
      try {
        res = await doFetch(deepseekEndpoint(base, req), {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify(deepseekBody(req)),
          signal: req.signal,
        });
      } catch (e) {
        const aborted = (e as { name?: string }).name === 'AbortError';
        throw new ProviderError(aborted ? 'timeout' : 'network', aborted ? 'request aborted' : String((e as Error).message ?? e));
      }
      const body = (await res.json().catch(() => ({}))) as Body;
      if (!res.ok) {
        const msg = body.error?.message ?? `HTTP ${res.status}`;
        // 402 is DeepSeek's "Insufficient Balance"; 429 a rate limit; 500 and 503 the server (busy or down)
        if (res.status === 429) throw new ProviderError('rate_limit', msg, Number(res.headers.get('retry-after') ?? 0) * 1000 || undefined);
        if (res.status === 402 || /insufficient balance|credit balance/i.test(msg)) throw new ProviderError('credit', msg);
        if (res.status >= 500) throw new ProviderError('server', msg);
        throw new ProviderError('bad_request', msg);
      }
      const message = body.choices?.[0]?.message;
      const call = message?.tool_calls?.find((c) => c.function?.arguments !== undefined);
      const text = call ? (call.function?.arguments ?? '') : (message?.content ?? '');
      const u = body.usage ?? {};
      const input = u.prompt_tokens ?? 0;
      const hit = u.prompt_cache_hit_tokens ?? 0;
      return {
        text,
        model: body.model ?? req.model,
        // `input` is the whole prompt (as the fake provider counts it); the cache hit is part of it, the miss is what the cache takes in for the next call
        usage: { input, output: u.completion_tokens ?? 0, cacheRead: hit, cacheWrite: u.prompt_cache_miss_tokens ?? Math.max(0, input - hit) },
      } satisfies ProviderResponse;
    },
  };
}
