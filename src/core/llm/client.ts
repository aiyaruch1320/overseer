// The client: the one place that calls a provider. It owns what llm/02-offline.md §5 and god/05-llm.md §5 and §7 ask of a call:
// the cache first, the switches of the server, the timeout, the check of the answer with one new request when it is bad, the breaker,
// the soft budget of a life, and a ledger with the tokens of every request. It never throws: the answer is a value or `source: 'template'`
// (tier 0, which the caller already holds), so a failed or refused call looks to the game like no LLM at all.
import { hashOf } from './hash';
import type { CacheStore } from './cache';
import { MemoryCache } from './cache';
import { BREAKER, LANG, LIFE_TOKEN_BUDGET, MODEL_OF, PROMPT_VERSION, RETRIES, TIMEOUT_MS, type LlmPoint } from './tuning';
import { ProviderError, type Checked, type FailKind, type JsonSchema, type LedgerEntry, type Provider, type Source, type Usage } from './types';

export interface LlmConfig {
  /** The master switch of the server side (env): off, the layer asks nothing (llm/README.md §3 "อ่านจากสองที่"). */
  enabled: boolean;
  /** Switches of the server side per point; a point missing here is on. The player's own switches are in `Settings.llm`. */
  points?: Partial<Record<LlmPoint, boolean>>;
  models?: Partial<Record<LlmPoint, string>>;
  timeoutMs?: number;
  breaker?: { fails: number; pauseMs: number };
  retries?: number;
  lifeTokenBudget?: number;
  now?: () => number;
}

/** One question to the LLM: the key material, the prompt, and the check of the answer. */
export interface Job<T> {
  point: LlmPoint;
  /** Everything the answer depends on (plain data): its hash, with the prompt version, is the cache key. */
  input: unknown;
  system: string;
  user: string;
  schema?: JsonSchema;
  maxTokens: number;
  /** The life the spend counts against. */
  life?: string;
  /** Turns the answer text into a value, or says why not. Must not throw. */
  check(text: string): Checked<T>;
}

export type JobResult<T> = { source: Exclude<Source, 'template'>; value: T; text: string } | { source: 'template'; reason: string };

const zero: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export class LlmClient {
  readonly ledger: LedgerEntry[] = [];
  private failures = 0;
  private openUntil = 0;
  private exhausted = false;
  private readonly inflight = new Map<string, Promise<JobResult<unknown>>>();

  constructor(
    readonly config: LlmConfig,
    readonly provider: Provider,
    readonly cache: CacheStore = new MemoryCache(),
  ) {}

  private now(): number {
    return (this.config.now ?? Date.now)();
  }

  /** Is the layer willing to call for this point now (server switches, credit, breaker)? Says nothing about the player's switches. */
  available(point: LlmPoint): boolean {
    const c = this.config;
    return c.enabled && c.points?.[point] !== false && !this.exhausted && this.now() >= this.openUntil;
  }

  /** The tokens (in + out) a life has spent through calls. */
  spent(life: string): number {
    let n = 0;
    for (const e of this.ledger) if (e.life === life && e.result !== 'cache') n += e.usage.input + e.usage.output;
    return n;
  }

  /** Tokens, requests and cache hits so far, by point. */
  totals(): Record<string, { requests: number; failed: number; cached: number; input: number; output: number; cacheRead: number }> {
    const out: Record<string, { requests: number; failed: number; cached: number; input: number; output: number; cacheRead: number }> = {};
    for (const e of this.ledger) {
      const t = (out[e.point] ??= { requests: 0, failed: 0, cached: 0, input: 0, output: 0, cacheRead: 0 });
      if (e.result === 'cache') t.cached++;
      else {
        t.requests++;
        if (e.result !== 'ok') t.failed++;
      }
      t.input += e.usage.input;
      t.output += e.usage.output;
      t.cacheRead += e.usage.cacheRead;
    }
    return out;
  }

  keyOf(job: Pick<Job<unknown>, 'point' | 'input'>): string {
    return hashOf({ p: job.point, v: PROMPT_VERSION, lang: LANG, input: job.input });
  }

  run<T>(job: Job<T>): Promise<JobResult<T>> {
    const key = this.keyOf(job);
    const same = this.inflight.get(key);
    if (same) return same as Promise<JobResult<T>>;
    const p = this.go(job, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p as Promise<JobResult<unknown>>);
    return p;
  }

  private log(job: Job<unknown>, key: string, attempt: number, result: LedgerEntry['result'], usage: Usage, ms: number, model: string, reason?: string): void {
    this.ledger.push({ n: this.ledger.length, at: this.now(), point: job.point, ...(job.life ? { life: job.life } : {}), key, model, provider: this.provider.name, attempt, result, ...(reason ? { reason } : {}), usage, ms });
  }

  private async go<T>(job: Job<T>, key: string): Promise<JobResult<T>> {
    const model = this.config.models?.[job.point] ?? MODEL_OF[job.point];
    if (!this.config.enabled || this.config.points?.[job.point] === false) return { source: 'template', reason: 'off' };
    // the cache first: a hit costs nothing and needs no provider (an entry that no longer passes the check is ignored)
    const hit = this.cache.get(key);
    if (hit) {
      const c = job.check(hit.text);
      if (c.ok) {
        this.log(job, key, 0, 'cache', zero, 0, hit.model);
        return { source: 'cache', value: c.value, text: hit.text };
      }
    }
    if (this.exhausted) return { source: 'template', reason: 'credit' };
    if (this.now() < this.openUntil) return { source: 'template', reason: 'breaker' };
    if (job.life !== undefined && this.spent(job.life) >= (this.config.lifeTokenBudget ?? LIFE_TOKEN_BUDGET)) return { source: 'template', reason: 'budget' };

    let reason = 'failed';
    const attempts = 1 + (this.config.retries ?? RETRIES);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const t0 = this.now();
      const ctl = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => {
            ctl.abort();
            rej(new ProviderError('timeout', 'timeout'));
          }, this.config.timeoutMs ?? TIMEOUT_MS);
        });
        const res = await Promise.race([this.provider.complete({ point: job.point, model, system: job.system, user: job.user, schema: job.schema, maxTokens: job.maxTokens, signal: ctl.signal }), timeout]);
        const ms = this.now() - t0;
        if (!res.text.trim()) {
          this.log(job, key, attempt, 'empty', res.usage, ms, res.model, 'empty answer');
          reason = 'empty';
          continue;
        }
        const c = job.check(res.text);
        if (!c.ok) {
          this.log(job, key, attempt, 'invalid', res.usage, ms, res.model, c.reason);
          reason = `invalid: ${c.reason}`;
          continue;
        }
        this.log(job, key, attempt, 'ok', res.usage, ms, res.model);
        this.failures = 0;
        this.cache.set(key, { text: res.text, point: job.point, model: res.model });
        return { source: 'llm', value: c.value, text: res.text };
      } catch (e) {
        const kind: FailKind = e instanceof ProviderError ? e.kind : 'unknown';
        this.log(job, key, attempt, kind, zero, this.now() - t0, model, String((e as Error).message ?? e));
        this.fail(kind, e instanceof ProviderError ? e.retryAfterMs : undefined);
        return { source: 'template', reason: kind };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    // every attempt gave a bad answer: tier 0. A bad answer is a fault of the model, not of the line, so it does not count for the breaker (assumption:
    // llm/02-offline.md §5 counts "ล้มติดกัน", which is read here as failures to get an answer at all)
    return { source: 'template', reason };
  }

  private fail(kind: FailKind, retryAfterMs?: number): void {
    const b = this.config.breaker ?? BREAKER;
    if (kind === 'credit') this.exhausted = true;
    if (kind === 'rate_limit' && retryAfterMs) this.openUntil = Math.max(this.openUntil, this.now() + retryAfterMs);
    this.failures++;
    if (this.failures >= b.fails) this.openUntil = Math.max(this.openUntil, this.now() + b.pauseMs);
  }
}
