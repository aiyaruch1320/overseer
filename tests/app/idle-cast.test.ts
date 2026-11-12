// The people and happenings of the calm picture (review play-1 §2.1 S1-S4): the pure part of src/app/views/idle-cast.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { extOf, tiesOf } from '../../src/core/bonds';
import type { GameData } from '../../src/core/game';
import type { GameState, LogEntry } from '../../src/core/types';
import { castAt, idleCast, moves } from '../../src/app/views/idle-cast';
import { idleView } from '../../src/app/views/scene';

let data: GameData;
let st: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 3, country: 'KD-01' });
  startLife(s);
  for (let i = 0; i < 30 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  st = s.game.state;
});

/** The state in a season with the lines told since (the cache of the lines is keyed by the state object, so every call is a new object). */
function at(quarter: number, entries: Omit<LogEntry, 'n' | 'worldYear' | 'level'>[] = [], level: LogEntry['level'] = 2): GameState {
  const base = st.logN + 1000;
  const log: LogEntry[] = [...st.log, ...entries.map((e, i) => ({ ...e, n: base + i, worldYear: st.clock.worldYear, level }))];
  return { ...st, clock: { ...st.clock, quarter }, log, logN: base + entries.length + 1, life: { ...st.life!, name: 'ทดสอบ' } };
}
const cast = (s: GameState) => idleCast(data, s, idleView(data, s));
const tie = () => tiesOf(extOf(st.life!)).find((t) => t.state === 'alive')!;

describe('the people of the calm picture', () => {
  it('shows at most three people of the life beside the character, never the dead, with their names', () => {
    const s = at(1);
    const c = cast(s);
    const near = c.actors.filter((a) => a.id.startsWith('tie:'));
    expect(near.length).toBeLessThanOrEqual(3);
    const dead = new Set(tiesOf(extOf(s.life!)).filter((t) => t.state !== 'alive').map((t) => `tie:${t.id}`));
    for (const a of near) {
      expect(dead.has(a.id)).toBe(false);
      expect(c.labels.get(a.id)).toBeTruthy();
    }
    expect(c.labels.get('idle')).toBe('ทดสอบ');
  });
});

describe('the passers-by', () => {
  it('a town has two to four, in different directions, and the clock runs for them', () => {
    const c = cast(at(0));
    expect(c.scenery.setting).toBe('town');
    expect(c.walkers.length).toBeGreaterThanOrEqual(2);
    expect(c.walkers.length).toBeLessThanOrEqual(4);
    expect(new Set(c.walkers.map((w) => w.dir)).size).toBe(2);
    expect(moves(c)).toBe(true);
    const a = castAt(c, 0, false).filter((x) => x.id.startsWith('walker:'));
    const b = castAt(c, 10, false).filter((x) => x.id.startsWith('walker:'));
    expect(a.every((x, i) => x.x !== b[i].x && x.pose === 'walk')).toBe(true);
    // they wrap off the stage: the places stay in the stretch
    for (const t of [0, 5, 100, 1234.5]) for (const x of castAt(c, t, false)) expect(x.x).toBeGreaterThanOrEqual(-0.2 - 1e-9), expect(x.x).toBeLessThanOrEqual(1.2 + 1e-9);
  });
  it('are none indoors, and still when the viewer asks for stillness', () => {
    const c = cast(at(1));
    expect(c.scenery.setting).toBe('indoor');
    expect(c.walkers).toHaveLength(0);
    const t = cast(at(0));
    const still = castAt(t, 50, true).filter((x) => x.id.startsWith('walker:'));
    expect(still.every((x) => x.pose === 'stand')).toBe(true);
    expect(still.map((x) => x.x)).toEqual(castAt(t, 0, true).filter((x) => x.id.startsWith('walker:')).map((x) => x.x));
  });
  it('the open land has a lone traveller now and then, never more than one', () => {
    const counts = new Set<number>();
    for (let y = 0; y < 30; y++) {
      const s = at(0);
      const o = { ...s, clock: { ...s.clock, worldYear: s.clock.worldYear + y }, life: { ...s.life!, country: 'MH-01' } };
      const c = cast(o);
      expect(c.scenery.setting).toBe('outdoor');
      counts.add(c.walkers.length);
    }
    expect([...counts].sort()).toEqual([0, 1]);
  });
});

describe('the happenings', () => {
  it('a death of a tie: a grave and the character kneeling, in the open even in winter', () => {
    const c = cast(at(3, [{ sys: 'bonds', kind: 'news', id: tie().id, data: { kind: 'death', name: 'x' } }]));
    expect(c.vignette).toBe('grave');
    expect(c.scenery.props).toContain('grave');
    expect(c.scenery.setting).not.toBe('indoor');
    expect(c.actors[0].pose).toBe('kneel');
    expect(c.walkers).toHaveLength(0);
  });
  it('a lover: the partner beside and blossoms', () => {
    const c = cast(at(0, [{ sys: 'bonds', kind: 'line', id: tie().id, data: { to: 'คนรัก', from: 'เพื่อน' } }]));
    expect(c.vignette).toBe('wedding');
    expect(c.scenery.props).toContain('blossoms');
    expect(c.actors.some((a) => a.id === `tie:${tie().id}`)).toBe(true);
  });
  it('a child born: the infant beside', () => {
    const c = cast(at(0, [{ sys: 'bonds', kind: 'child', id: tie().id, data: {} }]));
    expect(c.vignette).toBe('newborn');
    expect(c.actors.some((a) => a.id === `tie:${tie().id}`)).toBe(true);
  });
  it('a move: the character walks to and fro on open land; a wound: lies; both stand when stillness is asked', () => {
    const r = cast(at(1, [{ sys: 'travel', kind: 'move', id: 'KD-02', data: {} }]));
    expect(r.vignette).toBe('road');
    expect(r.scenery.setting).toBe('outdoor');
    const xs = new Set([0, 3, 9, 15].map((s) => castAt(r, s, false)[0].x));
    expect(xs.size).toBeGreaterThan(2);
    expect(castAt(r, 5, true)[0].pose).toBe('stand');
    expect(cast(at(0, [{ sys: 'character', kind: 'wound', data: {} }])).actors[0].pose).toBe('lie');
  });
  it('an unscripted fight: the foe faces the character', () => {
    const c = cast(at(0, [{ sys: 'combat', kind: 'clash', id: 'zz', data: { npc: 'AZ02-1', kind: 'lose' } }]));
    expect(c.vignette).toBe('foe');
    expect(c.actors.some((a) => a.id === 'foe')).toBe(true);
  });
  it('the newest wins; a line of level 1 or an old one does not count', () => {
    const c = cast(at(0, [{ sys: 'character', kind: 'wound', data: {} }, { sys: 'travel', kind: 'move', id: 'KD-02', data: {} }]));
    expect(c.vignette).toBe('road');
    expect(cast(at(0, [{ sys: 'travel', kind: 'move', id: 'KD-02', data: {} }], 1)).vignette).toBeNull();
    const old = at(0, [{ sys: 'travel', kind: 'move', id: 'KD-02', data: {} }]);
    expect(cast({ ...old, clock: { ...old.clock, worldYear: old.clock.worldYear + 3 } }).vignette).toBeNull();
  });
});
