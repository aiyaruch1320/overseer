// The shapes of the LLM layer. Nothing here knows a network: a `Provider` answers a request, the rest of the layer decides what to ask,
// checks the answer and falls back to tier 0 (the templates already in the game, llm/02-offline.md).
import type { LlmPoint } from './tuning';

export type { LlmPoint };

/** A JSON schema as the provider takes it (an object with `enum`s; no `null`, the docs use the value `none`, llm/08-live-test.md §3). */
export type JsonSchema = Record<string, unknown>;

export interface ProviderRequest {
  point: LlmPoint;
  model: string;
  /** The fixed part (rules, tone, answer shape): the same for every call of a point, so the provider's prefix cache can hit (llm/01-cost.md §3). */
  system: string;
  /** The data of this request: game state only, nothing of the player's but the words of `command` (llm/README.md §5 rule 3). */
  user: string;
  /** When set, the answer is one JSON object of this shape. */
  schema?: JsonSchema;
  maxTokens: number;
  /** Sampling temperature of the point: 0.3 for a choice or JSON, 1.3 to 1.5 for prose (llm/README.md §1). */
  temperature: number;
  /** An answer of many fields in JSON mode instead of a tool (the prompt then holds the word json and an example). The three points do not use it today. */
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ProviderResponse {
  text: string;
  usage: Usage;
  model: string;
}

export interface Provider {
  readonly name: string;
  complete(req: ProviderRequest): Promise<ProviderResponse>;
}

/** Why a call failed (llm/02-offline.md §5). */
export type FailKind = 'network' | 'timeout' | 'rate_limit' | 'credit' | 'server' | 'bad_request' | 'empty' | 'invalid' | 'unknown';

export class ProviderError extends Error {
  constructor(
    readonly kind: FailKind,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** One request, as logged (god/05-llm.md §5: the tokens of every request are logged; `cacheRead` shows the prefix cache). */
export interface LedgerEntry {
  /** Running number inside the client. */
  n: number;
  at: number;
  point: LlmPoint;
  /** Key of the life the spend counts against (the life id), for the soft budget. */
  life?: string;
  key: string;
  model: string;
  provider: string;
  attempt: number;
  /** `ok` an answer that passed the check · `cache` served without a call · else why it failed. */
  result: 'ok' | 'cache' | FailKind;
  reason?: string;
  usage: Usage;
  ms: number;
}

/** Where the text came from (the game shows nothing different; it is for logs and tests). */
export type Source = 'llm' | 'cache' | 'template';

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };
