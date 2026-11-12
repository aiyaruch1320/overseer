// Who stands in the calm picture of the life (review play-1 §2.1 S1-S4): the people of the life near the main character, the passers-by of a town or the lone traveller of the open
// land, and the vignette of a recent happening that has no script (a grave, a wedding, a newborn, a road, a sickbed, a foe). Pure over (data, state): `idleCast` is computed once per
// change of the log, `castAt` places the walkers for a time of the ambient clock, so the component only hands the stage the frame.
import { extOf as bondsExt, isChild, isLive, isPartner, tiesOf, type Tie } from '../../core/bonds';
import type { GameData } from '../../core/game';
import type { LooksData } from '../../core/data/types-looks';
import type { Pose } from '../../core/data/types-scenes';
import { items } from '../../core/text/labels';
import type { GameState } from '../../core/types';
import type { Stage } from '../../art/look';
import { raceLook } from '../../art/resolve';
import type { ScenerySpec, Setting } from '../../art/scenery/types';
import type { Figure } from '../../scene/figures';
import { seedOf } from '../../scene/seed';
import type { ActorView } from '../../scene/timeline';
import { mainLookOf, tieLooks } from './looks';
import { npcFigure, sceneFor, type IdleView } from './scene';
import { lifeStartN } from './watch';

/** The most people of the life that stand near the main character. */
const NEAR_MAX = 3;
/** A happening is a vignette for this many world years after the line that told it. */
const VIGNETTE_YEARS = 1;
/** The passers-by of a town: the fewest and the most; how fast they cross the stage (shares of its width per second); the stretch they walk over (off the stage on both sides). */
const WALKERS = { min: 2, max: 4, slow: 0.022, fast: 0.06, from: -0.2, to: 1.2 } as const;
/** The lone traveller of the open land crosses slowly, and is on the road in this share of the seasons. */
const TRAVELLER = { speed: 0.03, share: 50 } as const;
/** The main character on the road walks to and fro between these (shares of the stage), at this speed. */
const ROAD = { from: 0.28, to: 0.72, speed: 0.045 } as const;
/** The places beside the main character, in the order people are put there, for a stage without a prop in the middle and one with. */
const BESIDE = [0.66, 0.34, 0.8] as const;
const BESIDE_PROP = [0.64, 0.74, 0.84] as const;
const MAIN_X = 0.5;
const MAIN_X_PROP = 0.38;
/** The stages of the passers-by, in the order they are chosen (mostly grown). */
const PASSER_STAGES: Stage[] = ['adult', 'adult', 'elder', 'teen', 'adult', 'child'];
/** The label of the foe of a fight whose name the table does not give. */
const FOE_LABEL = 'คู่ต่อสู้';
const MAIN_ID = 'idle';

export type VignetteKind = 'grave' | 'wedding' | 'newborn' | 'road' | 'sick' | 'foe';

export interface Walker {
  id: string;
  /** Where along the stretch (0 to 1 of its length) it is at time 0, which way (+1 right, -1 left), and how fast (shares of the stage per second). */
  phase: number;
  dir: 1 | -1;
  speed: number;
}

export interface IdleCast {
  /** The painted place, with the props and the setting of the vignette. */
  scenery: ScenerySpec;
  /** Who stands still (the main character is the first; on the road it is placed again at every time). */
  actors: ActorView[];
  /** Who crosses the stage. */
  walkers: Walker[];
  figures: ReadonlyMap<string, Figure>;
  labels: ReadonlyMap<string, string>;
  vignette: VignetteKind | null;
  /** The main character walks to and fro (the road). */
  road: boolean;
}

const looksOf = (data: GameData): LooksData | undefined => items<LooksData>(data, 'looks');

/** The races of the people of a country: the races its row names (a name inside a longer found name is not counted: "เอลฟ์" in "ดาร์กเอลฟ์"), else the race of the life. */
function racesOfCountry(data: GameData, country: string | undefined, fallback: string): string[] {
  const row = (data.countries?.items as { id: string; races?: string }[] | undefined)?.find((c) => c.id === country);
  const races = (data.races?.items as { races?: { id: string; name: string }[] } | undefined)?.races ?? [];
  const text = row?.races ?? '';
  const found: { id: string; at: number; len: number }[] = [];
  for (const r of races) {
    const at = text.indexOf(r.name);
    if (at >= 0) found.push({ id: r.id, at, len: r.name.length });
  }
  const kept = found.filter((a) => !found.some((b) => b !== a && b.len > a.len && b.at <= a.at && b.at + b.len >= a.at + a.len));
  const ids = kept.sort((a, b) => a.at - b.at).map((f) => f.id);
  return ids.length ? ids : [fallback];
}

/** The ties that stand near the character, best first: the parents of a young one, the partner, the children, the companions, then the ones he is closest to. The dead and the gone are not there. */
function nearTies(state: GameState): Tie[] {
  const life = state.life;
  if (!life?.ext.bonds) return [];
  const live = tiesOf(bondsExt(life)).filter(isLive);
  const young = life.hAge < 15;
  const rank = (t: Tie): number => (young && (t.kin === 'father' || t.kin === 'mother') ? 0 : isPartner(t) ? 1 : isChild(t) ? 2 : t.party !== undefined ? 3 : t.light ? 5 : 4);
  return live.sort((a, b) => rank(a) - rank(b) || b.b - a.b || (a.id < b.id ? -1 : 1));
}

interface Happening {
  kind: VignetteKind;
  tie?: Tie;
  npc?: string;
}

/** The newest line of level 2 or more in the last world year that has no script and that changes the picture, by what it tells. */
function happening(data: GameData, state: GameState): Happening | null {
  const from = lifeStartN(state);
  const ties = state.life?.ext.bonds ? tiesOf(bondsExt(state.life)) : [];
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.n < from) break;
    if (state.clock.worldYear - e.worldYear > VIGNETTE_YEARS) break;
    if (e.level < 2) continue;
    const { sys, kind, id, data: d } = e;
    const tie = id ? ties.find((t) => t.id === id) : undefined;
    let h: Happening | null = null;
    if (sys === 'bonds' && (kind === 'funeral' || kind === 'grief' || (kind === 'news' && d.kind === 'death'))) h = { kind: 'grave', ...(tie ? { tie } : {}) };
    else if (sys === 'bonds' && ((kind === 'line' && d.to === 'คนรัก') || (kind === 'tie' && d.line === 'คนรัก'))) h = tie && isLive(tie) ? { kind: 'wedding', tie } : null;
    else if (sys === 'bonds' && kind === 'child') h = tie && isLive(tie) ? { kind: 'newborn', tie } : null;
    else if (sys === 'travel' && kind === 'move') h = { kind: 'road' };
    else if (sys === 'character' && kind === 'wound') h = { kind: 'sick' };
    else if (sys === 'combat' && kind === 'clash') h = typeof d.npc === 'string' ? { kind: 'foe', npc: d.npc } : null;
    if (!h) continue;
    // a line with a script of its own plays as a scene, not as this picture
    if (sceneFor(data, e, state).kind === 'script') continue;
    return h;
  }
  return null;
}

function isTownLike(data: GameData, country: string | undefined): boolean {
  const c = (data.countries?.items as { id: string; ui?: { scale?: number } }[] | undefined)?.find((x) => x.id === country);
  return (c?.ui?.scale ?? 0) >= (items<{ rules: { cityScale: number } }>(data, 'scenes')?.rules.cityScale ?? 3);
}

/** The people of a calm picture and the happening that changes it, for the state of the life now. */
export function idleCast(data: GameData, state: GameState, v: IdleView): IdleCast {
  const life = state.life;
  const looks = looksOf(data);
  const figures = new Map<string, Figure>();
  const labels = new Map<string, string>();
  const main = life ? mainLookOf(data, state) : null;
  figures.set(MAIN_ID, main ? { kind: 'person', looks: [main] } : { kind: 'silhouette' });
  if (life?.name) labels.set(MAIN_ID, life.name);
  const actors: ActorView[] = [{ id: MAIN_ID, label: '', x: MAIN_X, pose: v.figure.pose, count: 1 }];
  const mainActor = actors[0];
  let scenery: ScenerySpec = v.scenery;
  const base = v.scenery.setting;
  // a vignette under the sky: the grave and the blossoms are outside, whatever the season of the room
  const outside: Setting = base !== 'indoor' ? base : isTownLike(data, scenery.country) ? 'town' : 'outdoor';
  const h = life && !life.dead ? happening(data, state) : null;
  const picLooks = life ? tieLooks(data, state) : new Map();
  const put = (t: Tie, x: number, pose: Pose = 'stand'): void => {
    const l = picLooks.get(t.id);
    if (!l) return;
    const id = `tie:${t.id}`;
    actors.push({ id, label: '', x, pose, count: 1 });
    figures.set(id, l.kind === 'person' ? { kind: 'person', looks: [l] } : { kind: 'beast', look: l });
    labels.set(id, t.name);
  };
  const near = life ? nearTies(state) : [];
  let road = false;
  let vignette: VignetteKind | null = null;
  const withProp = (prop: string, pose: Pose, who: Tie[]): void => {
    scenery = { ...scenery, setting: outside, props: [prop] };
    mainActor.x = MAIN_X_PROP;
    mainActor.pose = pose === 'stand' ? mainActor.pose : pose;
    who.forEach((t, i) => put(t, BESIDE_PROP[i], pose));
  };
  const others = (tie: Tie | undefined): Tie[] => near.filter((t) => t.id !== tie?.id);
  switch (h?.kind) {
    case 'grave':
      vignette = 'grave';
      withProp('grave', 'kneel', others(h.tie).slice(0, 2));
      break;
    case 'wedding':
      vignette = 'wedding';
      withProp('blossoms', 'stand', [h.tie!, ...others(h.tie).slice(0, 1)]);
      break;
    case 'newborn':
      vignette = 'newborn';
      mainActor.x = 0.45;
      put(h.tie!, 0.58);
      others(h.tie).slice(0, 1).forEach((t) => put(t, 0.72));
      break;
    case 'road':
      vignette = 'road';
      road = true;
      scenery = { ...scenery, setting: 'outdoor' };
      mainActor.pose = 'walk';
      mainActor.x = ROAD.from;
      break;
    case 'sick':
      vignette = 'sick';
      mainActor.pose = 'lie';
      near.slice(0, 1).forEach((t) => put(t, BESIDE[0]));
      break;
    case 'foe': {
      const foe = looks && h.npc ? npcFigure(looks, h.npc) : undefined;
      if (foe) {
        vignette = 'foe';
        scenery = { ...scenery, setting: outside };
        mainActor.x = 0.4;
        actors.push({ id: 'foe', label: '', x: 0.68, pose: 'stand', count: 1 });
        figures.set('foe', foe);
        labels.set('foe', (h.npc && looks?.npcs[h.npc]?.name) || FOE_LABEL);
        break;
      }
      near.slice(0, NEAR_MAX).forEach((t, i) => put(t, BESIDE[i]));
      break;
    }
    default:
      // nothing to tell: the people of the life stand near the character
      near.slice(0, NEAR_MAX).forEach((t, i) => put(t, BESIDE[i]));
  }
  const walkers = looks && life ? passersBy(data, state, scenery, looks, figures, vignette) : [];
  return { scenery, actors, walkers, figures, labels, vignette, road };
}

/** The passers-by: two to four people of the country in a town, a lone traveller now and then on the open land, nobody indoors or in a vignette that holds the stage. */
function passersBy(data: GameData, state: GameState, scenery: ScenerySpec, looks: LooksData, figures: Map<string, Figure>, vignette: VignetteKind | null): Walker[] {
  if (vignette && vignette !== 'newborn') return [];
  const life = state.life!;
  const key = `${life.country}:${life.name ?? ''}:${state.clock.worldYear}:${state.clock.quarter}`;
  let count = 0;
  if (scenery.setting === 'town') count = WALKERS.min + (seedOf(`${key}:n`) % (WALKERS.max - WALKERS.min + 1));
  else if (scenery.setting === 'outdoor') count = seedOf(`${key}:t`) % 100 < TRAVELLER.share ? 1 : 0;
  if (!count) return [];
  const races = racesOfCountry(data, life.country, life.race).filter((r) => looks.races[r]);
  if (!races.length) return [];
  const out: Walker[] = [];
  for (let i = 0; i < count; i++) {
    const id = `walker:${i}`;
    const s = seedOf(`${key}:w${i}`);
    figures.set(id, { kind: 'person', looks: [raceLook(looks, races[(s >> 3) % races.length], { stage: PASSER_STAGES[(s >> 1) % PASSER_STAGES.length], fem: s % 2 === 1, seed: `walker:${key}:${i}` })] });
    // different directions and speeds: the first goes right, the next left, and so on; the speed spreads between slow and fast
    out.push({ id, phase: (s % 997) / 997, dir: i % 2 === 0 ? 1 : -1, speed: scenery.setting === 'town' ? WALKERS.slow + (((s >> 5) % 100) / 100) * (WALKERS.fast - WALKERS.slow) : TRAVELLER.speed });
  }
  return out;
}

/** The actors on the stage at a time of the ambient clock (seconds); `still` (a viewer who asked for stillness, or no clock) keeps everyone standing where they first stood. */
export function castAt(cast: IdleCast, t: number, still: boolean): ActorView[] {
  const span = WALKERS.to - WALKERS.from;
  const out = cast.actors.map((a) => ({ ...a }));
  if (cast.road) {
    if (still) out[0].pose = 'stand';
    else {
      // to and fro between the two ends: a triangle wave of the clock
      const len = ROAD.to - ROAD.from;
      const u = ((t * ROAD.speed) / len) % 2;
      out[0].x = ROAD.from + len * (u <= 1 ? u : 2 - u);
    }
  }
  for (const w of cast.walkers) {
    const run = still ? 0 : t * w.speed * w.dir;
    const p = (((w.phase * span + run) % span) + span) % span;
    out.push({ id: w.id, label: '', x: WALKERS.from + p, pose: still ? 'stand' : 'walk', count: 1 });
  }
  return out;
}

/** Whether the picture has something that moves by the clock (so the component runs one even where the place has no particles). */
export const moves = (cast: IdleCast): boolean => cast.road || cast.walkers.length > 0;
