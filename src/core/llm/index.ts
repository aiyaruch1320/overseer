// The LLM layer (code-plan §1 row LLM, §11 M4): the one place the game may call an LLM, at three points, each behind its own switch:
//   1. command the character  `interpretWords`  → a whisper command of the game, or null (the menu)          switch `Settings.llm.setup`
//   2. the director           `requestDirector` (async, ahead) + `directorMul` (sync, at the point)           switch `Settings.llm.director`
//   3. the end summary        `summarizeEnding`  → { text, source: 'llm' | 'template' }                      switch `Settings.llm.epitaph`
// plus the master (server env `OVERSEER_LLM=off`, and `Settings.llm.master` when the lead adds it to the type).
//
// Rules this layer keeps: the core step never waits for it and never calls it; a call is async and outside the step; its answer enters the state only as text
// in `state.llmAnswers` (with a log entry of level 0), so a save replays without calling; every answer passes a check or the game uses its own text (tier 0);
// a game with no `Llm` built, or with the switches off, writes nothing and plays exactly as before.
import { anthropicProvider } from './anthropic';
import { MemoryCache, type CacheStore } from './cache';
import { LlmClient, type LlmConfig } from './client';
import { interpretWords, type CommandMenu, type CommandOutcome } from './command';
import { requestDirector, type AskResult, type DirectorPoint } from './director';
import { summarizeEnding, type EndingSummary, type EndingSummaryInput } from './ending';
import { FakeProvider, type Fixtures } from './fake';
import type { Ctx } from '../game';
import type { GameState } from '../types';
import type { Provider } from './types';

export * from './tuning';
export * from './types';
export { LlmClient, type LlmConfig, type Job, type JobResult } from './client';
export { MemoryCache, layered, type CacheStore, type CacheEntry } from './cache';
export { FakeProvider, estimateTokens, type Fixtures, type FixtureResponse } from './fake';
export { anthropicProvider, requestBody, KEY_ENV, type AnthropicOpts } from './anthropic';
export { hashOf, hashText, stable } from './hash';
export { checkThai, parseObject, BANNED, type TextRules } from './validate';
export { playerOn, pointOn } from './switches';
export { cleanWords, matchWords, checkDraft, interpretWords, type CommandMenu, type CommandOutcome, type Draft, type Needs } from './command';
export { requestDirector, directorMul, directorDecision, directorLine, directorCount, combineMul, checkPick, pointId, REASON_LINE, type DirectorPoint, type DirectorWay, type DirectorPick, type AskResult } from './director';
export { summarizeEnding, checkSummary, type EndingSummary, type EndingSummaryInput } from './ending';
export { keys as answerKeys } from './record';

/** What the environment says (server side). `OVERSEER_LLM`: `off` shuts the layer · `fake` the offline provider · `anthropic` the real one. `OVERSEER_LLM_POINTS_OFF`: comma list of points to shut. */
export function configFromEnv(env: Record<string, string | undefined>): LlmConfig {
  const mode = (env.OVERSEER_LLM ?? 'off').toLowerCase();
  const off = new Set((env.OVERSEER_LLM_POINTS_OFF ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  const model = env.OVERSEER_LLM_MODEL;
  return {
    enabled: mode !== 'off' && mode !== '0' && mode !== 'false',
    points: { command: !off.has('command'), director: !off.has('director'), ending: !off.has('ending') },
    ...(model ? { models: { command: model, director: model, ending: model } } : {}),
  };
}

/** The facade the app and the tools hold: a client and the three points as methods. */
export class Llm {
  constructor(readonly client: LlmClient) {}

  /** Point 1. The free words of the player → a whisper command to send through `command()`, or `command: null` (show the menu). `menu` is `commandMenu(ctx)` from `./menu`. */
  interpretWords(ctx: Ctx, words: string, menu: CommandMenu): Promise<CommandOutcome> {
    return interpretWords(ctx, words, menu, this.client);
  }

  /** Point 2. Ask ahead for a key point (the answer waits in the save); the story system reads it with `directorMul` when the point comes. */
  requestDirector(ctx: Ctx, point: DirectorPoint): Promise<AskResult> {
    return requestDirector(ctx, point, this.client);
  }

  /** Point 3. The summary of the ending card; `state` makes it keep and replay from the save and honour the player's switches. */
  summarizeEnding(input: EndingSummaryInput, state?: GameState): Promise<EndingSummary> {
    return summarizeEnding(input, this.client, state);
  }

  /** The ledger: the tokens of every request (god/05-llm.md §5). */
  get ledger() {
    return this.client.ledger;
  }
}

export interface MakeOpts {
  config: LlmConfig;
  provider: Provider;
  cache?: CacheStore;
}

export const makeLlm = (o: MakeOpts): Llm => new Llm(new LlmClient(o.config, o.provider, o.cache ?? new MemoryCache()));

/** An `Llm` on the offline fake provider (tests and `--llm=fake`). */
export function fakeLlm(fixtures: Fixtures, config: Partial<LlmConfig> = {}): { llm: Llm; provider: FakeProvider; cache: MemoryCache } {
  const provider = new FakeProvider(fixtures);
  const cache = new MemoryCache();
  return { llm: makeLlm({ config: { enabled: true, ...config }, provider, cache }), provider, cache };
}

/** An `Llm` on the real Anthropic API, key from `env[ANTHROPIC_API_KEY]`. Never built by the tests or the gates. */
export function anthropicLlm(env: Record<string, string | undefined>, cache?: CacheStore): Llm {
  return makeLlm({ config: { ...configFromEnv(env), enabled: true }, provider: anthropicProvider({ env }), cache });
}
