// The real provider: the Anthropic Messages API. It is never built by the tests or the gates; the tools build it only for `--llm=anthropic`.
// The key is read from the environment (ANTHROPIC_API_KEY) when the provider is made, never kept in a file or sent anywhere but the API
// (god/05-llm.md §1 rule 7: the key lives on the server side; a browser build must reach this through a server that holds it).
// `fetch` is injectable, so the shape of the request and the mapping of failures are tested without a network.
import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from './types';

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const KEY_ENV = 'ANTHROPIC_API_KEY';

export interface AnthropicOpts {
  /** The key; default: `env[ANTHROPIC_API_KEY]`. */
  apiKey?: string;
  env?: Record<string, string | undefined>;
  url?: string;
  fetch?: typeof fetch;
}

interface Block {
  type: string;
  text?: string;
  input?: unknown;
}

interface Body {
  content?: Block[];
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  model?: string;
  error?: { type?: string; message?: string };
}

const TOOL = 'answer';

/** The body of the request. System text is marked for the prefix cache; a schema is sent as a tool the model must call (strict choices from `enum`, llm/08-live-test.md §7). */
export function requestBody(req: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: req.user }],
  };
  if (req.schema) {
    body.tools = [{ name: TOOL, description: 'Give the answer in the required shape.', input_schema: req.schema }];
    body.tool_choice = { type: 'tool', name: TOOL };
  }
  return body;
}

export function anthropicProvider(opts: AnthropicOpts = {}): Provider {
  const env = opts.env ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const key = opts.apiKey ?? env[KEY_ENV];
  const url = opts.url ?? ANTHROPIC_URL;
  return {
    name: 'anthropic',
    async complete(req) {
      if (!key) throw new ProviderError('bad_request', `${KEY_ENV} is not set`);
      const doFetch = opts.fetch ?? fetch;
      let res: Response;
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
          body: JSON.stringify(requestBody(req)),
          signal: req.signal,
        });
      } catch (e) {
        const aborted = (e as { name?: string }).name === 'AbortError';
        throw new ProviderError(aborted ? 'timeout' : 'network', aborted ? 'request aborted' : String((e as Error).message ?? e));
      }
      const body = (await res.json().catch(() => ({}))) as Body;
      if (!res.ok) {
        const msg = body.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429) throw new ProviderError('rate_limit', msg, Number(res.headers.get('retry-after') ?? 0) * 1000 || undefined);
        if (res.status === 402 || /credit balance/i.test(msg)) throw new ProviderError('credit', msg);
        if (res.status >= 500 || res.status === 529) throw new ProviderError('server', msg);
        throw new ProviderError('bad_request', msg);
      }
      const blocks = body.content ?? [];
      const tool = blocks.find((b) => b.type === 'tool_use');
      const text = tool ? JSON.stringify(tool.input ?? {}) : blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const u = body.usage ?? {};
      return {
        text,
        model: body.model ?? req.model,
        usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
      } satisfies ProviderResponse;
    },
  };
}
