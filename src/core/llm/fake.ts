// The offline fake provider (code-plan §11 M4): answers from a fixtures file, deterministic, no network. Every test and the `--llm=fake` tool flag use it.
//
// Fixtures: { "responses": [ { "point": "ending", "match": "ทอร์เวน", "answers": ["bad text", "good text"], "mode": "ok" } ] }
//  - the first response whose `point` is the request's and whose `match` (when given) is a substring of the request's user text is used;
//  - `answers` are given one per call of that response, the last repeating; `mode` is `ok` (default), `empty` (an empty text), `throw` (a network failure),
//    `slow` (answers after `delayMs`, for the timeout), `credit` or `rate_limit` (a refusal of that kind);
//  - no matching response is a network failure, which is what a missing provider looks like to the game.
import { ProviderError, type LlmPoint, type Provider, type ProviderRequest, type ProviderResponse, type Usage } from './types';

export interface FixtureResponse {
  point: LlmPoint;
  match?: string;
  answers: string[];
  mode?: 'ok' | 'empty' | 'throw' | 'slow' | 'credit' | 'rate_limit';
  delayMs?: number;
}

export interface Fixtures {
  responses: FixtureResponse[];
}

/** About 2.2 Thai characters a token (llm/01-cost.md §2); the fake counts the same way so the ledger has plausible numbers. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 2.2);

export class FakeProvider implements Provider {
  readonly name = 'fake';
  /** Every request seen, in order. */
  readonly calls: ProviderRequest[] = [];
  private readonly used = new Map<FixtureResponse, number>();
  constructor(private readonly fixtures: Fixtures) {}

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    this.calls.push(req);
    const r = this.fixtures.responses.find((x) => x.point === req.point && (x.match === undefined || req.user.includes(x.match)));
    if (!r) throw new ProviderError('network', `no fixture for ${req.point}`);
    const n = this.used.get(r) ?? 0;
    this.used.set(r, n + 1);
    const mode = r.mode ?? 'ok';
    if (mode === 'throw') throw new ProviderError('network', 'fake network failure');
    if (mode === 'credit') throw new ProviderError('credit', 'fake: credit balance too low');
    if (mode === 'rate_limit') throw new ProviderError('rate_limit', 'fake: 429', 1000);
    if (mode === 'slow') await new Promise((res) => setTimeout(res, r.delayMs ?? 50));
    const text = mode === 'empty' ? '' : (r.answers[Math.min(n, r.answers.length - 1)] ?? '');
    const usage: Usage = { input: estimateTokens(req.system + req.user), output: estimateTokens(text), cacheRead: n > 0 ? estimateTokens(req.system) : 0, cacheWrite: 0 };
    return { text, usage, model: req.model };
  }
}
