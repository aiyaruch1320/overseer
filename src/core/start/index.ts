// Where a life starts on the world clock (docs/lore/world/world-time.md §8.1, checked by scripts/sim/sim-start.mjs).
// 1. Walk the world of this seed once to its end, to know its timeline (the real game then replays the world from the
//    start, so the future is not bound: what happens after birth follows the world as it really runs).
// 2. 25% of lives start in the first 60 years. The rest pick a main event (⭐ ● ○, LE-01..09, LE-11) weighted alike,
//    and are born so they come of age just before it: event year − adult age − up to 30% of the adult span.
// Step 3 of the doc (weight by the share of the race's original NPCs still alive) is left at 1 until the NPC timeline
// can be read without a life; sim-start.mjs measures the rule without it as "aligned".
import { Game, type GameData, type System } from '../game';
import { stream } from '../rng';
import { newGame } from '../state';
import { WORLD_STEP } from '../clock';

export const P_EARLY = 0.25;
export const EARLY_YEARS = 60;
export const HORIZON = 1800;
const NOT_ANCHORS = new Set(['DR-15', 'END-10', 'END-11', 'END-12', 'LE-10', 'LE-12']);

export interface RaceAges {
  adultAge: number; // world years
  elderAge: number;
}

/** What a wish asks of the start point (19-wish.md §2: the early era, the fall of the dragons): the rule fixed, and the events to prefer (by id prefix) when the rule is the anchor. */
export interface StartWanted {
  rule?: 'early' | 'anchor';
  prefer?: string[];
}

export interface StartPoint {
  worldYear: number;
  rule: 'early' | 'anchor' | 'none';
  anchor?: string;
  anchorYear?: number;
}

interface EventRow {
  id: string;
  mark?: string;
}

/** Main events of the world-events data: the ones a life may be timed to meet. */
function mainEvents(data: GameData): Set<string> {
  const items = data['world-events']?.items as { events?: EventRow[]; lastEra?: { events?: EventRow[] } | EventRow[] } | undefined;
  const out = new Set<string>();
  for (const e of items?.events ?? []) if (e.mark && /[⭐●○]/.test(e.mark) && !NOT_ANCHORS.has(e.id)) out.add(e.id);
  for (let i = 1; i <= 12; i++) {
    const id = `LE-${String(i).padStart(2, '0')}`;
    if (!NOT_ANCHORS.has(id)) out.add(id);
  }
  return out;
}

/**
 * The start year for a life of this race in the world of this seed. `world` is the world system (passed in so this
 * module does not pick a system list); its walk runs on a scratch state and draws from the `world` stream only.
 */
export function chooseStart(data: GameData, seed: number, ages: RaceAges, world: System, wanted?: StartWanted): StartPoint {
  const scratch = new Game(newGame(seed), data, [world]);
  scratch.init();
  const steps = HORIZON / WORLD_STEP;
  for (let i = 0; i < steps && !scratch.state.world.ended; i++) scratch.worldSteps(1);
  const end = scratch.state.world.ended?.year ?? HORIZON;
  const happened = scratch.state.world.happened;

  // the draws of the start point have their own stream, so they never move the world or the life
  const r = stream({}, seed, 'start');
  const adult = ages.adultAge;
  const span = Math.max(1, ages.elderAge - ages.adultAge);
  const maxBirth = Math.max(0, end - adult - 5);
  // the draw is made even when the wish fixes the rule, so what follows does not move
  const rolledEarly = r.chance(P_EARLY);
  if (wanted?.rule ? wanted.rule === 'early' : rolledEarly) return { worldYear: Math.floor(r.next() * Math.min(EARLY_YEARS, maxBirth)), rule: 'early' };

  const main = mainEvents(data);
  const all = Object.entries(happened)
    .filter(([id, y]) => main.has(id) && y >= adult * 0.5 && y <= end - 0.5 * span)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const liked = wanted?.prefer?.length ? all.filter(([id]) => wanted.prefer!.some((p) => id.startsWith(p))) : [];
  const pool = liked.length ? liked : all;
  if (!pool.length) return { worldYear: Math.floor(r.next() * Math.min(EARLY_YEARS, maxBirth)), rule: 'none' };
  const [anchor, y] = pool[Math.floor(r.next() * pool.length)];
  const birth = Math.max(0, Math.round(y - adult - r.next() * 0.3 * span));
  return { worldYear: Math.min(birth, maxBirth), rule: 'anchor', anchor, anchorYear: y };
}
