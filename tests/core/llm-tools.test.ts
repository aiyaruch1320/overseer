// The `--llm` flag of the test tools (scripts/tools/llm.ts): no flag, no LLM; `fake` is the offline provider; `deepseek` and `anthropic` are built only on request and never call here.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runLifeReport, runLifeReportLlm } from '../../scripts/tools/life-run';
import { llmFromArgs, sayLines, summarizeDeath, summaryInputOf, summaryReport } from '../../scripts/tools/llm';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { cardOf } from '../../src/core/ending';
import type { GameData } from '../../src/core/game';
import { fakeLlm } from '../../src/core/llm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let data: GameData;
beforeAll(() => {
  data = loadAll();
});

describe('tool flag --llm', () => {
  it('has no LLM without the flag, refuses an unknown mode', () => {
    expect(llmFromArgs({})).toBeUndefined();
    expect(() => llmFromArgs({ llm: 'gpt' })).toThrow(/--llm must be/);
  });

  it('fake: a dead character gets the summary from the fixtures on its card, the text of the life is unchanged apart from the card', async () => {
    const run = runLifeReport(data, { seed: 1 });
    const again = runLifeReport(data, { seed: 1 });
    const tl = llmFromArgs({ llm: 'fake' })!;
    const input = summaryInputOf(data, run.state)!;
    expect(input.name).toBe(run.state.life!.name);
    expect(input.facts.length).toBeGreaterThan(0);
    expect(input.names).toContain(run.state.life!.name);
    expect(input.template).toBe(cardOf(run.state)!.summary.text);
    const out = await summaryReport(tl, data, run.state);
    expect(out[0]).toBe('-- สรุปตอนจบ (llm fake) --');
    expect(out[1]).toContain('บทสรุปทดสอบ');
    // the card holds it, marked as the LLM's, and the answer sits in the save and the log
    const card = cardOf(run.state)!;
    expect(card.summary).toEqual({ text: out[1], source: 'llm' });
    expect(run.state.llmAnswers[`ending:${card.life}`]).toBe(out[1]);
    expect(run.state.log.some((e) => e.sys === 'llm' && e.kind === 'ending' && e.level === 0)).toBe(true);
    // the report of the life is the same text with or without the layer
    expect(run.text.replace(/กติกาที่ยังไม่มีใครรับ[^\n]*\n/g, '')).toBe(again.text.replace(/กติกาที่ยังไม่มีใครรับ[^\n]*\n/g, ''));
    expect(tl.llm.ledger).toHaveLength(1);
    // asked again, nothing is called
    await summarizeDeath(tl, data, run.state);
    expect(tl.llm.ledger).toHaveLength(1);
  });

  it('the report with --llm=fake shows the LLM summary on the card; without the flag the card is the template', async () => {
    const tl = llmFromArgs({ llm: 'fake' })!;
    const withLlm = await runLifeReportLlm(data, { seed: 1 }, tl);
    expect(withLlm.text).toContain('บทสรุปทดสอบ');
    expect(cardOf(withLlm.state)!.summary.source).toBe('llm');
    const plain = runLifeReport(data, { seed: 1 });
    expect(plain.text).not.toContain('บทสรุปทดสอบ');
    expect(cardOf(plain.state)!.summary.source).toBe('template');
    // everything but the summary paragraph is the same
    const strip = (t: string, sum: string) => t.replace(sum, '').replace(/กติกาที่ยังไม่มีใครรับ[^\n]*\n/g, '');
    expect(strip(withLlm.text, cardOf(withLlm.state)!.summary.text)).toBe(strip(plain.text, cardOf(plain.state)!.summary.text));
  });

  it('the epitaph switch off keeps the template; no fixture or a failing provider keeps the template too', async () => {
    const off = runLifeReport(data, { seed: 1 });
    off.state.settings.llm.epitaph = false;
    const tl = llmFromArgs({ llm: 'fake' })!;
    expect((await summarizeDeath(tl, data, off.state))!.source).toBe('template');
    expect(tl.llm.ledger).toHaveLength(0);
    expect(cardOf(off.state)!.summary.source).toBe('template');
    const down = runLifeReport(data, { seed: 1 });
    const { llm } = fakeLlm({ responses: [] });
    expect((await summarizeDeath({ llm, mode: 'fake', flush() {} }, data, down.state))!.source).toBe('template');
    expect(cardOf(down.state)!.summary.source).toBe('template');
  });

  it('--llm accepts deepseek (also a bare --llm) and anthropic; the real ones are built from the environment only', () => {
    expect(llmFromArgs({ llm: 'deepseek', 'llm-cache': '/nonexistent/none.json' }, { DEEPSEEK_API_KEY: 'k' })!.llm.client.provider.name).toBe('deepseek');
    expect(llmFromArgs({ llm: 'true', 'llm-cache': '/nonexistent/none.json' }, { DEEPSEEK_API_KEY: 'k' })!.mode).toBe('deepseek');
    expect(llmFromArgs({ llm: 'anthropic', 'llm-cache': '/nonexistent/none.json' }, { ANTHROPIC_API_KEY: 'k' })!.llm.client.provider.name).toBe('anthropic');
  });

  it('play --llm=fake: the card at the death shows the LLM summary, and the saved game shows it again with no flag', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-llm-'));
    const cli = (args: string[]) => execFileSync('npx', ['tsx', 'scripts/tools/play.ts', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, OVERSEER_PLAY_DIR: dir }, timeout: 50000 });
    try {
      const first = cli(['--seed=5', '--new', '--llm=fake', '--cmd=advance 1000']);
      expect(first).toContain('-- การ์ดตอนจบ --');
      expect(first).toContain('บทสรุปทดสอบ');
      expect(first).toContain('llm fake โทเคน');
      expect(cli(['--seed=5', '--cmd=card'])).toContain('บทสรุปทดสอบ');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('say: tier 0 reads a hint without the flag; free words need the translator', async () => {
    const s = createSession(data, { seed: 2, race: 'hu', startYear: 120 });
    startLife(s);
    const ctx = s.game.ctx;
    expect((await sayLines(undefined, ctx, 'ระวังหน่อย')).cmd).toBe('whisper ระวัง');
    const none = await sayLines(undefined, ctx, 'ไปทางเหนือ');
    expect(none.cmd).toBeUndefined();
    expect(none.lines[0]).toContain('options');
    const tl = llmFromArgs({ llm: 'fake' })!;
    expect((await sayLines(tl, ctx, 'ไปทางเหนือ')).cmd).toBe('whisper ระวัง');
  });
});
