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
import type { GameData } from '../../src/core/game';
import { makeCtx } from '../../src/core/game';
import { applyEndingText, cardOf, endingInput } from '../../src/core/ending';
import { FakeProvider, Llm, MemoryCache, anthropicLlm, interpretWords, makeLlm, realLlm, type CacheEntry, type EndingSummary, type EndingSummaryInput, type Fixtures } from '../../src/core/llm';
import { commandMenu } from '../../src/core/llm/menu';
import { raceName } from '../../src/core/text';
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

/** One line of what the player asked of the life and what the birth gave (the LLM may say the life was asked for; it may not add anything that was not given). */
export function wishLine(w: NonNullable<ReturnType<typeof endingInput>>['wish'] & object): string {
  const given = w.granted.map((g) => g.value).join(' ');
  const cut = w.refused.map((r) => r.value).filter(Boolean).join(' ');
  return `${w.text}${given ? ` · ได้: ${given}` : ''}${cut ? ` · ไม่ได้: ${cut}` : ''}`;
}

const PRONOUN: Record<string, string> = { m: 'เขา', f: 'เธอ', n: 'ผู้นั้น' };
/** The summary tells at most this many facts (llm/04-story.md §2 "สามถึงแปดบรรทัด" of the record); the first and the last are kept. */
const MAX_FACTS = 8;

/**
 * The input of the end summary of a dead life, mapped from `endingInput(state, lifeId)` of the ending system: the person, the question, the facts in the order the card tells them
 * (the sentences the card holds, so the LLM sees what the template tier saw) and the names the text may use. Undefined when the life has no card.
 */
export function summaryInputOf(data: GameData, state: GameState, lifeId?: string): EndingSummaryInput | undefined {
  const input = endingInput(state, lifeId);
  const card = cardOf(state, input?.life.id);
  if (!input || !card) return undefined;
  const ctx = makeCtx(state, data);
  const sentences = card.facts.map((f) => f.sentence).filter(Boolean);
  const facts = sentences.length > MAX_FACTS ? [...sentences.slice(0, MAX_FACTS - 1), sentences[sentences.length - 1]] : sentences;
  if (input.question.text) facts.splice(Math.min(1, facts.length), 0, `คำถามของชีวิต: ${input.question.text}`);
  return {
    lifeId: input.life.id,
    name: input.life.name,
    pronoun: PRONOUN[input.life.gender] ?? 'เขา',
    race: input.life.raceName || raceName(ctx, input.life.race),
    age: input.life.age,
    ending: input.ending ?? '',
    facts,
    names: input.names,
    // the vow with its result and its page, the titles of the life, and the names of the others of this world that the text may not take (the check refuses them)
    ...(input.vow ? { vow: `${input.vow.result === 'kept' ? 'คำปฏิญาณที่เป็นจริง' : 'คำปฏิญาณที่ไม่เป็นจริง'} · ${input.vow.name}: ${input.vow.lines.join(' ')}` } : {}),
    ...(input.titles.length ? { titles: input.titles } : {}),
    // a life the player ordered: what was asked and given, for the tone only (the character does not know it)
    ...(input.wish ? { wish: wishLine(input.wish) } : {}),
    ...(input.others.length ? { others: input.others } : {}),
    // the template tier's summary: what the card holds if no answer comes. When the card already holds an LLM text, the template is the one it replaced and is not known here
    template: card.summary.text,
  };
}

/**
 * At the death of a life: asks for the end summary and, when the LLM answers (or the save already holds its answer), writes it into the card. Does nothing without an `Llm`, with the
 * epitaph switch off, or for a card that already holds an LLM text. The answer is kept in `state.llmAnswers` by the llm layer, so asking again after a load never calls.
 */
export async function summarizeDeath(t: ToolLlm | undefined, data: GameData, state: GameState, lifeId?: string): Promise<EndingSummary | undefined> {
  if (!t) return undefined;
  const id = lifeId ?? cardOf(state)?.life;
  const card = id ? cardOf(state, id) : undefined;
  if (!id || !card) return undefined;
  if (card.summary.source === 'llm') return { text: card.summary.text, source: 'llm' };
  const input = summaryInputOf(data, state, id);
  if (!input) return undefined;
  const s = await t.llm.summarizeEnding(input, state);
  if (s.source === 'llm') applyEndingText(state, id, { summary: s.text }, 'llm');
  return s;
}

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
