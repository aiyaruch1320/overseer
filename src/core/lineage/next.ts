// The next life of the lineage (docs/systems/experience/05-world-across-lives.md §3 and §4, docs/lore/heirs/): the world goes on, the heir takes over.
// The world keeps its one clock whoever lives, so an heir who is already in the world needs no gap: the gap is what the heir already lived in the
// years of the parent (its age at the takeover is the age the bond book gives it). A newcomer (asked for by the player when the family has no heir;
// the docs say the world is left then, 05 §4: assumption for the test tools) is born after a gap of the dead character's generation.
import { birth as characterBirth } from '../character';
import type { Game } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { presetStory } from './book';
import { emitLifeChange } from './carry';
import { handOver } from './threads';
import { bearHeir, bindParent, inherit, pickHeir, type Carried } from './heir';
import { familyLives, lx, type HeirSpec, type Origin } from './state';

export interface NextOpts {
  /** The family has no heir: bear a newcomer in the same world after the gap of a generation. */
  newcomer?: boolean;
  /** For the newcomer: a race and a country, else drawn. */
  race?: string;
  country?: string;
}

export type NextResult =
  | { ok: true; life: LifeState; origin: Origin; heir: HeirSpec | null; gapYears: number; carried?: Carried }
  | { ok: false; reason: 'alive' | 'no-life' | 'extinct' | 'world-ended' };

/** World years of a generation of the race (races.generationGap); a newcomer comes after this many. */
function gapOf(game: Game, race: string): number {
  const races = (game.ctx.data.races?.items as { races: { id: string; generationGap: number | null }[] } | undefined)?.races ?? [];
  return races.find((r) => r.id === race)?.generationGap ?? 30;
}

/** Is there a next life? Reads only. */
export function canContinue(game: Game): NextResult | { ok: true } {
  const st = game.state;
  if (!st.life) return { ok: false, reason: 'no-life' };
  if (!st.life.dead) return { ok: false, reason: 'alive' };
  if (st.world.ended) return { ok: false, reason: 'world-ended' };
  return pickHeir(game.ctx) ? { ok: true } : { ok: false, reason: 'extinct' };
}

/**
 * Bears the next life after a death. The dead life is replaced; its card, record, threads and book stay in `state.lineage`.
 * Same state and the same options give the same life. The caller plays it (`game.beat()`), the way it played the first one.
 */
export function nextLife(game: Game, opts: NextOpts = {}): NextResult {
  const ctx = game.ctx;
  const st = game.state;
  const parent = st.life;
  if (!parent) return { ok: false, reason: 'no-life' };
  if (!parent.dead) return { ok: false, reason: 'alive' };
  if (st.world.ended) return { ok: false, reason: 'world-ended' };
  const x = lx(st);
  const spec = pickHeir(ctx);
  // the family ends with its last heir (05 §4): the generations of the family are the lives up to here; a newcomer is not one of them (N1 of the M4 review)
  if (!spec) x.extinct ??= { generation: familyLives(st), year: st.clock.worldYear };
  if (!spec && !opts.newcomer) return { ok: false, reason: 'extinct' };
  const origin: Origin = spec ? (spec.rung === 0 ? 'heir' : 'successor') : 'newcomer';
  const generation = st.lineage.lives.length + 1;

  // the gap: none for an heir (the world ran on while the heir grew up); a generation for a newcomer
  let gapYears = 0;
  if (!spec) {
    gapYears = gapOf(game, parent.race);
    st.life = null;
    game.worldSteps(Math.max(1, Math.round(gapYears / 10)));
    if (st.world.ended) {
      st.life = parent;
      return { ok: false, reason: 'world-ended' };
    }
  }
  x.gaps.push({ from: parent.id, to: `L${generation}`, years: gapYears });
  x.begin = { origin, parent: parent.id };

  // the heir is a person of the bond book: its race, gender, country and name stay; its age is the age the book gives it
  st.life = null;
  const life = spec ? bearHeir(ctx, spec) : characterBirth(ctx, { race: opts.race, country: opts.country });
  presetStory(ctx, life, !spec);
  // the line of the hand-over is written first, before the systems' birth hooks tell the new life (a job, a first fight, a meeting): the log must open with who takes over (T3-13).
  // What the inheritance carries is not known yet; it is put into the entry below.
  const beginEntry = write(st, {
    sys: 'lineage',
    kind: 'begin',
    id: life.id,
    data: { name: life.name, generation, origin, parent: parent.name, age: life.hAge, how: spec?.how ?? 'newcomer', gold: 0, items: 0, threads: 0, gap: gapYears },
    level: 2,
  });
  game.born();

  let carried: Carried | undefined;
  if (spec) {
    carried = inherit(ctx, parent, life, spec, generation);
    bindParent(ctx, parent, life, spec);
    carried.threads = lx(st).threads.filter((t) => t.state === 'open').length;
  }
  // a newcomer is nobody's heir: the threads the dead life left fade with the family (03 §3 "จางหาย")
  if (!spec) for (const t of x.threads) if (t.state === 'open') t.state = 'faded';
  handOver(ctx, life, life.hAge);
  const rec = x.recs.find((r) => r.id === life.id);
  if (rec && carried) rec.carried = { gold: carried.gold, items: carried.items, ...(carried.blessing ? { blessing: carried.blessing } : {}), fame: carried.fame, faith: carried.faith, threads: carried.threads };
  Object.assign(beginEntry.data, { gold: carried?.gold ?? 0, items: carried?.items ?? 0, threads: carried?.threads ?? 0 });
  emitLifeChange(ctx, { phase: 'begin', life, from: parent, origin, generation, heir: spec, ...(carried ? { carried } : {}) });
  return { ok: true, life, origin, heir: spec, gapYears, ...(carried ? { carried } : {}) };
}
