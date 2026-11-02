// The LLM flag of the test tools: `--llm=fake` (the offline fake provider, answers from tests/fixtures/llm/tool.json) or `--llm=anthropic` (the real API, key in
// ANTHROPIC_API_KEY, never run by the tests or the gates). Without the flag there is no LLM and the tools print what they printed before.
// `--llm-cache=<file>` keeps the machine cache between runs (default: none for fake, .data/llm-cache.json for anthropic).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx, type GameData } from '../../src/core/game';
import { FakeProvider, Llm, MemoryCache, anthropicLlm, interpretWords, makeLlm, type CacheEntry, type EndingSummary, type EndingSummaryInput, type Fixtures } from '../../src/core/llm';
import { commandMenu } from '../../src/core/llm/menu';
import { lines, raceName } from '../../src/core/text';
import type { GameState } from '../../src/core/types';
import { summaryLines } from './report';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOL_FIXTURES = path.join(root, 'tests/fixtures/llm/tool.json');

export interface ToolLlm {
  llm: Llm;
  mode: 'fake' | 'anthropic';
  /** Writes the machine cache to its file (if it has one). */
  flush(): void;
}

/** The `Llm` the flags ask for, or undefined when there is no `--llm`. Throws on a mode it does not know. */
export function llmFromArgs(args: Record<string, string>, env: Record<string, string | undefined> = process.env): ToolLlm | undefined {
  const mode = args.llm;
  if (mode === undefined) return undefined;
  if (mode !== 'fake' && mode !== 'anthropic') throw new Error(`--llm must be fake or anthropic, got "${mode}"`);
  const cacheFile = args['llm-cache'] ?? (mode === 'anthropic' ? path.join(root, '.data/llm-cache.json') : undefined);
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
  return { llm: anthropicLlm(env, cache), mode, flush };
}

const PRONOUN: Record<string, string> = { m: 'เขา', f: 'เธอ', n: 'ผู้นั้น' };

/** The input of the end summary for a dead character of a tool run: what the record holds, in order of age. The lead replaces this with `endingInput(state)` of the ending system. */
export function summaryInputOf(data: GameData, state: GameState, beats = 0): EndingSummaryInput | undefined {
  const life = state.life;
  if (!life?.dead) return undefined;
  const ctx = makeCtx(state, data);
  const ending = state.log.find((e) => e.sys === 'story' && e.kind === 'ending')?.id ?? '';
  const noted = lines(data, state.log, 2).filter((l) => l.entry.age !== undefined && l.entry.sys !== 'god');
  const step = Math.max(1, Math.ceil(noted.length / 7));
  const facts = noted.filter((_, i) => i % step === 0).slice(0, 7).map((l) => `อายุ ${l.entry.age}: ${l.text}`);
  return {
    lifeId: life.id,
    name: life.name,
    pronoun: PRONOUN[life.gender] ?? 'เขา',
    race: raceName(ctx, life.race),
    age: life.dead.hAge,
    ending,
    facts,
    template: summaryLines(data, state, beats)[0] ?? life.name,
  };
}

/** The summary of the ending for a tool run, with the source in the head line. */
export async function summaryReport(t: ToolLlm, data: GameData, state: GameState, beats = 0): Promise<string[]> {
  const input = summaryInputOf(data, state, beats);
  if (!input) return [];
  const s: EndingSummary = await t.llm.summarizeEnding(input, state);
  const out = [`-- สรุปตอนจบ (${s.source === 'llm' ? `llm ${t.mode}` : 'แม่แบบ'}) --`, s.text];
  const totals = t.llm.client.totals();
  const used = Object.entries(totals).map(([k, v]) => `${k} ${v.requests} คำขอ ${v.cached} แคช เข้า ${v.input} ออก ${v.output}`);
  if (used.length) out.push(`(โทเคน: ${used.join(' · ')})`);
  return out;
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
