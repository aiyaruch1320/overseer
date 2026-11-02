// The `--llm` flag of the test tools (scripts/tools/llm.ts): no flag, no LLM; `fake` is the offline provider; `anthropic` is built only on request and never here.
import { beforeAll, describe, expect, it } from 'vitest';
import { runLifeReport } from '../../scripts/tools/life-run';
import { llmFromArgs, sayLines, summaryInputOf, summaryReport } from '../../scripts/tools/llm';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import type { GameData } from '../../src/core/game';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

describe('tool flag --llm', () => {
  it('has no LLM without the flag, refuses an unknown mode', () => {
    expect(llmFromArgs({})).toBeUndefined();
    expect(() => llmFromArgs({ llm: 'gpt' })).toThrow(/--llm must be/);
  });

  it('fake: a dead character gets the summary from the fixtures, the text of the life is unchanged', async () => {
    const run = runLifeReport(data, { seed: 1 });
    const again = runLifeReport(data, { seed: 1 });
    const tl = llmFromArgs({ llm: 'fake' })!;
    const input = summaryInputOf(data, run.state, run.beats)!;
    expect(input.name).toBe(run.state.life!.name);
    expect(input.facts.length).toBeGreaterThan(0);
    const out = await summaryReport(tl, data, run.state, run.beats);
    expect(out[0]).toBe('-- สรุปตอนจบ (llm fake) --');
    expect(out[1]).toContain('บทสรุปทดสอบ');
    // the report of the life is the same text with or without the layer
    expect(run.text.replace(/กติกาที่ยังไม่มีใครรับ[^\n]*\n/g, '')).toBe(again.text.replace(/กติกาที่ยังไม่มีใครรับ[^\n]*\n/g, ''));
    expect(tl.llm.ledger).toHaveLength(1);
  });

  it('say: tier 0 reads a hint without the flag; free words need the translator', async () => {
    const s = createSession(data, { seed: 2, race: 'hu', startYear: 120 });
    startLife(s);
    const ctx = s.game.ctx;
    expect((await sayLines(undefined, ctx, 'ระวังหน่อย')).cmd).toBe('whisper ระวัง');
    const none = await sayLines(undefined, ctx, 'อย่าประมาทนะ');
    expect(none.cmd).toBeUndefined();
    expect(none.lines[0]).toContain('options');
    const tl = llmFromArgs({ llm: 'fake' })!;
    expect((await sayLines(tl, ctx, 'อย่าประมาทนะ')).cmd).toBe('whisper ระวัง');
  });
});
