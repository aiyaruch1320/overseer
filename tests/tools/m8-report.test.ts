// The M8 analysis (scripts/tools/m8-report.ts): it reads the lives of a record and of a simulated run with the same code and prints the tables of the numbers.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyse, livesOf, median, readRecord, render, seedsOf, simulate, VOWS } from '../../scripts/tools/m8-report';
import { loadAll } from '../../scripts/tools/node-data';
import type { RecEvent } from '../../src/app/record-facts';
import type { GameData } from '../../src/core/game';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

describe('m8-report', () => {
  it('reads seeds and medians', () => {
    expect(seedsOf('1-3,7')).toEqual([1, 2, 3, 7]);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(VOWS).toHaveLength(20);
  });

  it('counts the arms of simulated lives and prints every table', async () => {
    const lives = [...(await simulate(data, { seed: 2, policy: 'เมตตา', arm: 'on', lives: 1 })), ...(await simulate(data, { seed: 2, policy: 'เมตตา', arm: 'off', lives: 1 }))];
    expect(lives.map((l) => l.arm)).toEqual(['on', 'off']);
    const r = analyse(lives);
    const text = render(r, 'test');
    for (const t of ['vows (all groups)', 'ally crisis', 'director callbacks per life by arm', 'stops and cards per life', 'time per life', 'interventions per life']) expect(text).toContain(t);
    const raw = r.raw.director as Record<string, { lives: number }>;
    expect(raw.on.lives).toBe(1);
    expect(raw.off.lives).toBe(1);
  }, 120000);

  it('reads an exported record: the life, the vow kept, the crisis that reached a card, the interventions', () => {
    const events: RecEvent[] = [
      { t: 0, k: 'game.new' },
      { t: 1, k: 'life.start', life: 1, arm: 'on', seed: 4, llmServer: true },
      { t: 2, k: 'vow.offer', life: 1, ids: ['GV-01', 'GV-06', 'GV-12'] },
      { t: 3, k: 'vow.take', life: 1, vow: 'GV-06' },
      { t: 4, k: 'crisis', life: 1, card: true, tie: 'T1' },
      { t: 4, k: 'call', life: 1, call: 'card', why: 'crisis', cards: 'crisis' },
      { t: 5, k: 'crisis.answer', life: 1, tie: 'T1', answer: 'full', by: 'whisper' },
      { t: 6, k: 'act', life: 1, action: 'whisper', ok: true },
      { t: 7, k: 'act', life: 1, action: 'whisper', ok: false },
      { t: 8, k: 'llm.director', life: 1, pick: 'a', reason: 'old_face' },
      { t: 9, k: 'vow.result', life: 1, vow: 'GV-06', result: 'kept' },
      { t: 130, k: 'life.end', life: 1, cause: 'old', hAge: 70, nodes: 30, chances: 3, callbacks: 2, bondEndings: 1 },
    ];
    const dir = mkdtempSync(join(tmpdir(), 'm8-'));
    const file = join(dir, 'rec.json');
    writeFileSync(file, JSON.stringify({ format: 'overseer.record', v: 1, id: 'x', startedAt: '2026-01-01T00:00:00Z', events }));
    const lives = readRecord(file);
    expect(lives).toHaveLength(1);
    const r = analyse(lives);
    const vows = r.raw.vows as Record<string, { chosen: number; kept: number }>;
    expect(vows['GV-06']).toMatchObject({ offered: 1, chosen: 1, kept: 1 });
    const crisis = r.tables.find((t) => t.title.includes('ally crisis'))!;
    expect(crisis.rows[0].slice(3, 8)).toEqual([1, 1, 1, 1, 0]);
    const act = r.tables.find((t) => t.title.includes('interventions'))!;
    expect(act.rows[0][2]).toBe('1');
    expect(livesOf(events, 'x')).toHaveLength(1);
  });

  it('refuses a file that is not a record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'm8-'));
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{"a":1}');
    expect(() => readRecord(file)).toThrow(/not a play record/);
  });
});
