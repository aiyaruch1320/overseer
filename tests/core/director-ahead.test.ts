// The LLM director ahead of its forks (llm/04-story.md §3.4), offline: `directorAhead` on real lives, the ids it gives against the forks that were played, an answered offer at the fork, the cap,
// and a game with no LLM that stays the same. Every test runs on the fake provider (tests/fixtures/llm/tool.json).
import { beforeAll, describe, expect, it } from 'vitest';
import fixtures from '../fixtures/llm/tool.json';
import { dreamAgainst, forksSince, markForks } from '../../scripts/tools/ahead-forks';
import { afterBeat, createSession, startLife, stepBeat, type Session } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import { leanWeights } from '../../src/core/llm/fork';
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
async function play(seed: number, client?: ReturnType<typeof fakeLlm>['llm']['client'], dream = false): Promise<Played> {
  const s = createSession(data, { seed });
  startLife(s);
  const g = s.game;
  const points = new Map<string, DirectorPoint>();
  const forks = new Map<string, string>();
  for (let n = 0; g.state.life && !g.state.life.dead && n < 1600; n++) {
    const mark = g.state.logN;
    const before = markForks(g.ctx);
    for (const p of directorAhead(g.ctx)) if (!points.has(p.id)) points.set(p.id, p);
    if (dream) dreamAgainst(g.ctx);
    stepBeat(g);
    afterBeat(s);
    if (client) await askAhead(g.ctx, client);
    for (const e of g.state.log) if (e.n >= mark && e.sys === 'story' && e.kind === 'node') forks.set(`${e.id}:${e.worldYear}`, String(e.data.choice));
    for (const id of forksSince(g.ctx, before)) forks.set(id, '-');
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
        if (p.kind !== 'quiet') continue;
        found++;
        if (r.forks.has(p.id)) played++;
        expect(p.id).toMatch(/^[a-z0-9]+\.[a-z0-9]+:\d+$/);
        expect(p.ways[0].key).not.toBe(p.ways[1].key);
        expect(p.ways.every((w) => w.text.length > 0)).toBe(true);
      }
    }
    expect(found).toBeGreaterThanOrEqual(8);
    // a guess may be stale (the node waits for a free year, a queued convergence plays a beat later): most are exact
    expect(played / found).toBeGreaterThan(0.85);
  }, 120000);

  it('finds a face met the third time (seeds 15 and 23)', async () => {
    for (const seed of [15, 23]) {
      const r = await play(seed);
      const kinds: DirectorKind[] = [...r.points.values()].map((p) => p.kind);
      expect(kinds).toContain('repeat_meet');
      for (const p of r.points.values()) if (p.kind === 'repeat_meet') expect(r.forks.has(p.id)).toBe(true);
    }
  }, 120000);

  it('finds the follow-up of an NPC death (npc_death) with the id of the fork that is drawn', async () => {
    let found = 0;
    let played = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = await play(seed);
      for (const p of r.points.values()) {
        if (p.kind !== 'npc_death') continue;
        found++;
        if (r.forks.has(p.id)) played++;
        expect(p.id).toMatch(/^npc_death:[A-Z]{2}\d+-\d+:[A-Z]{2}\d+-\d+:\d+$/);
        expect(p.ways.map((w) => w.key).every((k) => ['a', 'b', 'c'].includes(k))).toBe(true);
      }
    }
    expect(found).toBeGreaterThanOrEqual(5);
    // a life can end before the draw: most points are exact
    expect(played / found).toBeGreaterThan(0.65);
  }, 240000);

  it('finds the burden of the heart (heart) when a dream against his nature waits, with the id of the fork that fires', async () => {
    let found = 0;
    let played = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = await play(seed, undefined, true);
      for (const p of r.points.values()) {
        if (p.kind !== 'heart') continue;
        found++;
        if (r.forks.has(p.id)) played++;
        expect(p.id).toMatch(/^heart:\d+$/);
        expect(p.ways.every((w) => ['question', 'flight', 'nature'].includes(w.key))).toBe(true);
      }
    }
    expect(found).toBeGreaterThanOrEqual(6);
    // the burden fires only when the dream is obeyed (the roll is at the fork), so a share of the points never fire
    expect(played / found).toBeGreaterThan(0.4);
  }, 240000);

  it('leaves out every fork with a god window or a dream waiting on it, and a life without a god reaches no heart point', async () => {
    const r = await play(3);
    expect([...r.points.values()].every((p) => p.kind !== 'heart')).toBe(true);
    const ix = (await import('../../src/core/story/data')).indexOf(r.s.game.ctx);
    for (const p of r.points.values()) {
      if (p.kind !== 'quiet' && p.kind !== 'repeat_meet') continue;
      expect(ix.nodes.get(p.id.split(':')[0])?.godWindow ?? ix.cv.get(p.id.split(':')[0])?.godWindow).toBeFalsy();
    }
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

describe('forks of the other kinds', () => {
  it('a life with a dreaming god is the same life whether directorAhead reads it or not, and an answered offer leans the draw', async () => {
    for (const seed of [4, 9]) {
      const plain = createSession(data, { seed });
      startLife(plain);
      for (let n = 0; plain.game.state.life && !plain.game.state.life.dead && n < 1600; n++) {
        dreamAgainst(plain.game.ctx);
        stepBeat(plain.game);
        afterBeat(plain);
      }
      const read = await play(seed, undefined, true);
      expect(JSON.stringify(read.s.game.state)).toBe(JSON.stringify(plain.game.state));
    }
  }, 120000);

  it('an offer for an NPC death or a burden multiplies the chosen way by 1.5 and leaves the other weights alone', () => {
    const s = createSession(data, { seed: 3 });
    startLife(s);
    const ctx = s.game.ctx;
    const life = ctx.state.life!;
    const ways = [
      { key: 'a', text: 'ก', weight: 40 },
      { key: 'b', text: 'ข', weight: 35 },
      { key: 'c', text: 'ค', weight: 25 },
    ];
    // no answer: the weights as written, and no trace in the save
    expect(leanWeights(ctx, 'npc_death:X-1:X-2:9', ways)).toEqual([40, 35, 25]);
    expect(ctx.state.llmAnswers).toEqual({});
    // an answer waits as an offer; the fork freezes it and logs the decision
    ctx.state.llmAnswers[`director.asked:${life.id}:npc_death:X-1:X-2:9`] = '1';
    ctx.state.llmAnswers[`director.offer:${life.id}:npc_death:X-1:X-2:9`] = '{"pick":"b","reason":"old_face"}';
    expect(leanWeights(ctx, 'npc_death:X-1:X-2:9', ways)).toEqual([40, 52.5, 25]);
    expect(ctx.state.log.some((e) => e.sys === 'llm' && e.kind === 'director' && e.id === 'npc_death:X-1:X-2:9' && e.data.pick === 'b')).toBe(true);
    // the third way is not one of the two offered: a pick of it is refused and the weights stay
    const hearts = [
      { key: 'question', text: 'ก', weight: 1 },
      { key: 'flight', text: 'ข', weight: 1 },
      { key: 'nature', text: 'ค', weight: 1 },
    ];
    ctx.state.llmAnswers[`director.asked:${life.id}:heart:1`] = '1';
    ctx.state.llmAnswers[`director.offer:${life.id}:heart:1`] = '{"pick":"nature","reason":"life_question"}';
    expect(leanWeights(ctx, 'heart:1', hearts)).toEqual([1, 1, 1]);
    ctx.state.llmAnswers[`director.asked:${life.id}:heart:2`] = '1';
    ctx.state.llmAnswers[`director.offer:${life.id}:heart:2`] = '{"pick":"flight","reason":"rest"}';
    expect(leanWeights(ctx, 'heart:2', hearts)).toEqual([1, 1.5, 1]);
  });

  it('asks the new kinds, reads the answers at the fork as ×1.5 and keeps to ten points a life', async () => {
    const { llm } = fakeLlm(FX);
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3, 5, 8, 9, 11, 12]) {
      const r = await play(seed, llm.client, true);
      expect(askedCount(r.s.game.ctx)).toBeLessThanOrEqual(10);
      for (const e of r.s.game.state.log.filter((x) => x.sys === 'llm' && x.kind === 'director')) {
        const point = r.points.get(String(e.id))!;
        expect(point).toBeDefined();
        kinds.add(point.kind);
        if (point.kind === 'npc_death' || point.kind === 'heart') {
          if (e.data.pick !== 'none') expect(directorMul(r.s.game.ctx, point, String(e.data.pick))).toBe(1.5);
          expect(r.forks.has(point.id)).toBe(true);
        }
      }
    }
    expect(kinds.has('npc_death')).toBe(true);
    expect(kinds.has('heart')).toBe(true);
  }, 240000);
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
