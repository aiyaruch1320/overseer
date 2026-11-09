// The LLM director ahead of its forks (llm/04-story.md §3.4), offline: `directorAhead` on real lives, the ids it gives against the forks that were played, an answered offer at the fork, the cap,
// and a game with no LLM that stays the same. Every test runs on the fake provider (tests/fixtures/llm/tool.json).
import { beforeAll, describe, expect, it } from 'vitest';
import fixtures from '../fixtures/llm/tool.json';
import { afterBeat, createSession, startLife, stepBeat, type Session } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import { directorMul, fakeLlm, type DirectorPoint, type Fixtures } from '../../src/core/llm';
import { askAhead, askedCount, directorAhead } from '../../src/core/story';
import type { DirectorKind } from '../../src/core/llm/tuning';

const FX = fixtures as unknown as Fixtures;
let data: GameData;
beforeAll(() => {
  data = loadAll();
});

interface Played {
  s: Session;
  points: Map<string, DirectorPoint>;
  forks: Map<string, string>;
}

/** Plays a life to its death, reading `directorAhead` before each beat (and asking after it when a client is given). */
async function play(seed: number, client?: ReturnType<typeof fakeLlm>['llm']['client']): Promise<Played> {
  const s = createSession(data, { seed });
  startLife(s);
  const g = s.game;
  const points = new Map<string, DirectorPoint>();
  const forks = new Map<string, string>();
  for (let n = 0; g.state.life && !g.state.life.dead && n < 1600; n++) {
    const mark = g.state.logN;
    for (const p of directorAhead(g.ctx)) if (!points.has(p.id)) points.set(p.id, p);
    stepBeat(g);
    afterBeat(s);
    if (client) await askAhead(g.ctx, client);
    for (const e of g.state.log) if (e.n >= mark && e.sys === 'story' && e.kind === 'node') forks.set(`${e.id}:${e.worldYear}`, String(e.data.choice));
  }
  return { s, points, forks };
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('directorAhead', () => {
  it('finds quiet-time points on real lives, with the id the fork has when it is played', async () => {
    let found = 0;
    let played = 0;
    for (const seed of SEEDS) {
      const r = await play(seed);
      for (const p of r.points.values()) {
        found++;
        if (r.forks.has(p.id)) played++;
        expect(p.kind).toBe('quiet');
        expect(p.id).toMatch(/^[a-z0-9]+\.[a-z0-9]+:\d+$/);
        expect(p.ways[0].key).not.toBe(p.ways[1].key);
        expect(p.ways.every((w) => w.text.length > 0)).toBe(true);
      }
    }
    expect(found).toBeGreaterThanOrEqual(8);
    // a guess may be stale (the node waits for a free year, a queued convergence plays a beat later): most are exact
    expect(played / found).toBeGreaterThan(0.85);
  }, 120000);

  it('finds a face met the third time (seeds 23 and 27)', async () => {
    for (const seed of [23, 27]) {
      const r = await play(seed);
      const kinds: DirectorKind[] = [...r.points.values()].map((p) => p.kind);
      expect(kinds).toContain('repeat_meet');
      for (const p of r.points.values()) if (p.kind === 'repeat_meet') expect(r.forks.has(p.id)).toBe(true);
    }
  }, 120000);

  it('leaves out the kinds the core cannot tell (an NPC death, the heart) and every fork with a god window', async () => {
    const r = await play(3);
    expect([...r.points.values()].every((p) => p.kind === 'quiet' || p.kind === 'repeat_meet')).toBe(true);
    const ix = (await import('../../src/core/story/data')).indexOf(r.s.game.ctx);
    for (const p of r.points.values()) expect(ix.nodes.get(p.id.split(':')[0])?.godWindow ?? ix.cv.get(p.id.split(':')[0])?.godWindow).toBeFalsy();
  }, 60000);

  it('changes nothing: a life that is read every beat is the life that is not (no LLM, no draw)', async () => {
    const plain = createSession(data, { seed: 3 });
    startLife(plain);
    for (let n = 0; plain.game.state.life && !plain.game.state.life.dead && n < 1600; n++) {
      stepBeat(plain.game);
      afterBeat(plain);
    }
    const read = await play(3);
    expect(JSON.stringify(read.s.game.state)).toBe(JSON.stringify(plain.game.state));
  }, 60000);
});

describe('askAhead', () => {
  it('asks each point once, the answer waits as an offer and the fork reads it as ×1.5', async () => {
    const { llm, provider } = fakeLlm(FX);
    const r = await play(3, llm.client);
    expect(r.points.size).toBeGreaterThan(0);
    // one request per point (the cache may answer a repeat without the provider)
    expect(askedCount(r.s.game.ctx)).toBe(r.points.size);
    expect(provider.calls.length).toBeLessThanOrEqual(r.points.size);
    const logged = r.s.game.state.log.filter((e) => e.sys === 'llm' && e.kind === 'director');
    expect(logged.length).toBeGreaterThan(0);
    for (const e of logged) {
      const point = r.points.get(String(e.id))!;
      expect(point).toBeDefined();
      // the answer was in before the fork: it was used, not late, and the way it chose carries the factor
      expect(e.data.reason).toBe('old_face');
      expect(directorMul(r.s.game.ctx, point, String(e.data.pick))).toBe(1.5);
      // and the fork played with that weight: it is a fork the walk reached
      expect(r.forks.has(point.id)).toBe(true);
    }
    // asking again changes nothing
    const n = provider.calls.length;
    await askAhead(r.s.game.ctx, llm.client);
    expect(provider.calls.length).toBe(n);
  }, 60000);

  it('does nothing without a client, and writes no trace', async () => {
    const r = await play(3);
    const before = JSON.stringify(r.s.game.state.llmAnswers);
    expect(await askAhead(r.s.game.ctx, undefined)).toEqual([]);
    expect(JSON.stringify(r.s.game.state.llmAnswers)).toBe(before);
    expect(before).toBe('{}');
  }, 60000);

  it('keeps to ten points a life', async () => {
    const { llm, provider } = fakeLlm(FX);
    const s = createSession(data, { seed: 3 });
    startLife(s);
    const g = s.game;
    let asks = 0;
    // fill the life with nine asks made before, then let the walk find more
    const life = g.state.life!;
    for (let i = 0; i < 9; i++) g.state.llmAnswers[`director.asked:${life.id}:old${i}`] = '1';
    for (let n = 0; g.state.life && !g.state.life.dead && n < 1600; n++) {
      stepBeat(g);
      asks += (await askAhead(g.ctx, llm.client)).length;
    }
    expect(askedCount(g.ctx)).toBeLessThanOrEqual(10);
    expect(asks).toBeLessThanOrEqual(1);
    expect(provider.calls.length).toBeLessThanOrEqual(1);
  }, 60000);
});
