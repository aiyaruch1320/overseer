// The LLM flag of the test tools: `--llm=fake` (the offline fake provider, answers from tests/fixtures/llm/tool.json), `--llm=deepseek` (the real default: DeepSeek V4.1 Flash, key in
// DEEPSEEK_API_KEY; a bare `--llm` means this) or `--llm=anthropic` (the alternative, key in ANTHROPIC_API_KEY). The real ones are never run by the tests or the gates.
// Without the flag there is no LLM and the tools print what they printed before.
// `--llm-cache=<file>` keeps the machine cache between runs (default: none for fake, .data/llm-cache.json for the real providers).
//
// The end summary (llm/04-story.md §2): at the death the tools call `summarizeDeath`, which maps `endingInput(state, lifeId)` to the input of the llm layer, asks, and writes the
// answer into the card with `applyEndingText(..., 'llm')`. The answer also sits in `state.llmAnswers` and in the log (level 0), so the save replays it without a call. The core
// systems stay sync and know nothing of this: the tools hold the await.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ctx, GameData } from '../../src/core/game';
import { FakeProvider, Llm, MemoryCache, anthropicLlm, interpretWords, makeLlm, realLlm, type CacheEntry, type EndingSummary, type Fixtures } from '../../src/core/llm';
import { askAhead } from '../../src/core/story';
import { commandMenu } from '../../src/core/llm/menu';
import { summarizeDeath as coreSummarizeDeath } from '../../src/core/llm/summary-input';
import type { GameState } from '../../src/core/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOL_FIXTURES = path.join(root, 'tests/fixtures/llm/tool.json');

export type LlmMode = 'fake' | 'deepseek' | 'anthropic';

export interface ToolLlm {
  llm: Llm;
  mode: LlmMode;
  /** Writes the machine cache to its file (if it has one). */
  flush(): void;
}

/** The `Llm` the flags ask for, or undefined when there is no `--llm`. Throws on a mode it does not know. */
export function llmFromArgs(args: Record<string, string>, env: Record<string, string | undefined> = process.env): ToolLlm | undefined {
  const flag = args.llm;
  if (flag === undefined) return undefined;
  const mode = flag === 'true' ? 'deepseek' : flag;
  if (mode !== 'fake' && mode !== 'deepseek' && mode !== 'anthropic') throw new Error(`--llm must be fake, deepseek or anthropic, got "${flag}"`);
  const cacheFile = args['llm-cache'] ?? (mode === 'fake' ? undefined : path.join(root, '.data/llm-cache.json'));
  const cache = new MemoryCache(cacheFile && existsSync(cacheFile) ? (JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, CacheEntry>) : undefined);
  const flush = () => {
    if (!cacheFile) return;
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(cache.toJSON()));
  };
  if (mode === 'fake') {
    const provider = new FakeProvider(JSON.parse(readFileSync(TOOL_FIXTURES, 'utf8')) as Fixtures);
    return { llm: makeLlm({ config: { enabled: true }, provider, cache }), mode, flush };
  }
  return { llm: mode === 'deepseek' ? realLlm(env, cache) : anthropicLlm(env, cache), mode, flush };
}

export { summaryInputOf, wishLine } from '../../src/core/llm/summary-input';

/**
 * At the death of a life: asks for the end summary and writes it into the card (src/core/llm/summary-input.ts). Does nothing without an LLM flag, with the epitaph switch off,
 * or for a card that already holds an LLM text.
 */
export const summarizeDeath = (t: ToolLlm | undefined, data: GameData, state: GameState, lifeId?: string): Promise<EndingSummary | undefined> => coreSummarizeDeath(t?.llm, data, state, lifeId);

/**
 * After a beat: asks the LLM director about the key points that come within a life year (src/core/story/ahead.ts) and waits for the answers, so a tool run (which has no clock to wait) uses them.
 * Does nothing without an LLM flag.
 */
export const askDirector = (t: ToolLlm | undefined, ctx: Ctx): Promise<void> => (t ? askAhead(ctx, t.llm.client).then(() => undefined) : Promise.resolve());

/** The line of the tokens spent so far (the ledger of the client), or none when no request was made. */
export function usageLines(t: ToolLlm | undefined): string[] {
  if (!t) return [];
  const totals = t.llm.client.totals();
  const used = Object.entries(totals).map(([k, v]) => `${k} ${v.requests} คำขอ ${v.cached} แคช เข้า ${v.input} ออก ${v.output} ชนแคช ${v.cacheRead}`);
  return used.length ? [`(llm ${t.mode} โทเคน: ${used.join(' · ')})`] : [];
}

/** The summary of the ending for a tool run, with the source in the head line (asks for it if the card does not hold it yet). */
export async function summaryReport(t: ToolLlm, data: GameData, state: GameState): Promise<string[]> {
  const s = await summarizeDeath(t, data, state);
  if (!s) return [];
  return [`-- สรุปตอนจบ (${s.source === 'llm' ? `llm ${t.mode}` : 'แม่แบบ'}) --`, s.text, ...usageLines(t)];
}

/** `play`: the words of the player → the command line of the whisper (or the menu's answer). */
export async function sayLines(t: ToolLlm | undefined, ctx: Parameters<typeof commandMenu>[0], words: string): Promise<{ lines: string[]; cmd?: string }> {
  const out = await interpretWords(ctx, words, commandMenu(ctx), t?.llm.client);
  const c = out.command;
  if (!c) return { lines: [`ตัวแปลไม่พบคำใบ้ที่ตรงกับ “${words}” (${out.reason ?? out.source}) — ใช้ options เพื่อดูคำใบ้ที่มี`] };
  const a = c.args as { hint: string; target?: string };
  const cmd = `whisper ${a.hint}${a.target ? ` ${a.target}` : ''}`;
  return { lines: [`ตัวแปลเข้าใจว่า “${words}” คือ ${cmd} (${out.source})`], cmd };
}
