// Planning and walking a trip: the legs from the place the character is to a destination (§3.1, §3.6), what they cost, and the d12 of the road (§4).
// `plan` reads the world and draws nothing; `go` draws days, fares and the events of the road and moves the character.
import type { Ctx } from '../game';
import { holds } from '../character';
import { write } from '../log';
import { apply, type EffectSource } from '../rules';
import { happened, world, year } from '../world/access';
import type { ContinentId, CountryId, LifeState } from '../types';
import { entryOf, flagsOf } from './access';
import { continentPaths, routeState, type Edge, type Link, type RouteId, type RouteState } from './routes';
import { geo, inRange, type CountryInfo } from './data';
import { addOnce, extOf, lifeOf } from './state';
import { DAYS_PER_QUARTER, FOG_MASK, GOODS_SHARE, MASK_PRICE, STAIR_PASS, TOLL_SHARE } from './tuning';
import { openLine } from '../story';

export interface Leg {
  route: RouteId | 'foot';
  from: CountryId;
  to: CountryId;
  /** Estimated days and fare at the middle of the range, for the choice; `go` draws the real ones. */
  days: number;
  fare: number;
  rows: [number, number];
  fares: [number, number];
  state: RouteState;
  /** Stance factor of the place entered. */
  toll: number;
  checks: number;
  /** The leg crosses a continent (two rolls of the road table). */
  cross: boolean;
  smuggle: boolean;
}

export interface Plan {
  ok: boolean;
  why?: string;
  legs: Leg[];
  days: number;
  fare: number;
  smuggle: boolean;
  mask: boolean;
  /** The character goes on foot: no fare, twice the days. */
  walk?: boolean;
}

export interface PlanOpts {
  /** The employer or the cause pays: no purse test. */
  free?: boolean;
  /** May take a closed way or a closed border by smuggling (§3.4). */
  smuggle?: boolean;
  /** A purse that cannot pay may walk the overland ways for nothing, in twice the time (§1 rule 3: "หรือทางที่ถูกกว่า"). */
  walk?: boolean;
}

const fail = (why: string): Plan => ({ ok: false, why, legs: [], days: 0, fare: 0, smuggle: false, mask: false });

const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

function routeRow(ctx: Ctx, id: RouteId) {
  return geo(ctx).travel.routes.find((r) => r.id === id);
}

const DEFAULTS: Record<string, { days: [number, number]; fare: [number, number] }> = {
  fog: { days: [10, 20], fare: [1, 3] },
  stair: { days: [10, 15], fare: [13, 13] },
  waterfall: { days: [2, 33], fare: [0, 0] },
  fly: { days: [5, 10], fare: [0, 0] },
  foot: { days: [15, 30], fare: [0, 0] },
};

function legOf(ctx: Ctx, life: LifeState, route: RouteId | 'foot', a: CountryInfo, b: CountryInfo, state: RouteState, cross: boolean, smuggle = false): Leg {
  const row = route === 'foot' ? undefined : routeRow(ctx, route);
  const d = DEFAULTS[route] ?? { days: [10, 20], fare: [1, 3] };
  const days: [number, number] = row?.days ?? d.days;
  const fares: [number, number] = row?.fare ?? d.fare;
  const entry = entryOf(ctx, life, b);
  return {
    route, from: a.id, to: b.id, rows: days, fares, state, toll: entry.tollMul, checks: entry.checks, cross, smuggle,
    days: mid(days) * state.timeMul,
    fare: smuggle ? mid(geo(ctx).travel.smuggle.cost) : mid(fares) * state.fareMul * (route === 'sea' || route === 'airship' ? 1 : entry.tollMul),
  };
}

/** The country to stop in on a continent, by the gateway list of a link (a port needs a coast). */
function gate(ctx: Ctx, list: CountryId[] | null, cont: ContinentId, want: CountryInfo | undefined, needCoast: boolean): CountryInfo | undefined {
  const g = geo(ctx);
  if (list) {
    if (want && list.includes(want.id)) return want;
    return g.countries.get(list[0]);
  }
  const all = g.byContinent.get(cont) ?? [];
  if (needCoast) {
    if (want?.coast) return want;
    return all.find((c) => c.coast && c.scale >= 3) ?? all.find((c) => c.coast);
  }
  return want ?? all[0];
}

/** Can the character smuggle (§3.4): a guide of the trade, or `stealth` level 2? */
export function canSmuggle(ctx: Ctx, life: LifeState): boolean {
  const s = geo(ctx).travel.smuggle;
  return holds(ctx, life, 'skill', s.skill.id, s.skill.level) || life.job === 'smuggler' || life.job === 'guide' || life.job === 'pirate' || life.job === 'caravan_master';
}

/** Free of the fog's poison: born in the fog (mist folk), made of metal or soul, a mask, or a guide's skill (§3.5, §3.6 row ทางหมอก). */
export function fogProof(ctx: Ctx, life: LifeState): boolean {
  const ex = extOf(life);
  return ex.born.startsWith('NB') || life.home.startsWith('NB') || life.race === 'construct' || life.race === 'soulmachine' || life.items.includes(FOG_MASK) || holds(ctx, life, 'skill', 'ns_fog_guide');
}

/** Legs inside a continent: land by default, the coast when the land is shut or both places have a port, wings when the character has them. */
function inside(ctx: Ctx, life: LifeState, a: CountryInfo, b: CountryInfo, opts: PlanOpts): Leg | undefined {
  const cands: RouteId[] = ['land'];
  if (a.coast && b.coast) cands.push('coast');
  if (holds(ctx, life, 'skill', 'pa_fly_mount', 3) || life.race === 'winged') cands.push('fly');
  let best: Leg | undefined;
  let shutBy: RouteState | undefined;
  for (const r of cands) {
    const st = routeState(ctx, life, r, a, b);
    if (!st.open) {
      shutBy ??= st;
      continue;
    }
    const leg = legOf(ctx, life, r, a, b, st, false);
    if (!best || leg.fare < best.fare) best = leg;
  }
  if (best) return best;
  if (opts.smuggle && shutBy?.smuggle) return legOf(ctx, life, 'land', a, b, shutBy, false, true);
  return undefined;
}

/** Walks one continent path: in each hop the open way with the lowest fare (the character's own wings count), with the legs to reach a gateway and to leave it. */
function planPath(ctx: Ctx, life: LifeState, a: CountryInfo, b: CountryInfo, path: { c: ContinentId; edge: Edge; flip: boolean }[], opts: PlanOpts): { legs: Leg[]; smuggle: boolean } | undefined {
  const g = geo(ctx);
  const flyer = life.race === 'winged' || holds(ctx, life, 'skill', 'pa_fly_mount', 3);
  const legs: Leg[] = [];
  let smuggle = false;
  let at: CountryInfo = a;
  for (let i = 0; i < path.length; i++) {
    const hop = path[i];
    const last = i === path.length - 1;
    const to2 = hop.c;
    let bestLeg: Leg | undefined;
    let bestPre: Leg | undefined;
    let bestPost: Leg | undefined;
    const options: (Link | { route: 'fly'; ends: [null, null] })[] = [...hop.edge.links];
    if (flyer) options.push({ route: 'fly', ends: [null, null] });
    let shutLeg: { leg: Leg; pre?: Leg; post?: Leg } | undefined;
    for (const l of options) {
      const [endA, endB] = l.ends;
      const gFrom = hop.flip ? endB : endA;
      const gTo = hop.flip ? endA : endB;
      const needCoast = l.route === 'sea';
      const s = gate(ctx, gFrom, at.continent, at, needCoast);
      const t = gate(ctx, gTo, to2, last ? b : undefined, needCoast);
      if (!s || !t) continue;
      const st = routeState(ctx, life, l.route as RouteId, s, t);
      const pre = s.id !== at.id ? inside(ctx, life, at, s, { smuggle: false }) : undefined;
      if (s.id !== at.id && !pre) continue;
      const post = last && t.id !== b.id ? inside(ctx, life, t, b, { smuggle: false }) : undefined;
      if (last && t.id !== b.id && !post) continue;
      const cost = (x: Leg | undefined) => (x ? x.fare : 0);
      if (!st.open) {
        if (opts.smuggle && st.smuggle && canSmuggle(ctx, life)) {
          const leg = legOf(ctx, life, l.route as RouteId, s, t, st, true, true);
          if (!shutLeg || leg.fare < shutLeg.leg.fare) shutLeg = { leg, pre, post };
        }
        continue;
      }
      const leg = legOf(ctx, life, l.route as RouteId, s, t, st, true);
      if (!bestLeg || leg.fare + cost(pre) + cost(post) < bestLeg.fare + cost(bestPre) + cost(bestPost)) {
        bestLeg = leg;
        bestPre = pre;
        bestPost = post;
      }
    }
    if (!bestLeg && shutLeg) {
      bestLeg = shutLeg.leg;
      bestPre = shutLeg.pre;
      bestPost = shutLeg.post;
      smuggle = true;
    }
    if (!bestLeg) return undefined;
    if (bestPre) legs.push(bestPre);
    legs.push(bestLeg);
    if (bestPost) legs.push(bestPost);
    at = g.countries.get(bestPost ? bestPost.to : bestLeg.to)!;
  }
  return { legs, smuggle };
}

/**
 * Plans the trip from `from` to `to` (country ids). Across continents it follows the continent graph (routes.ts) and takes, in each hop, the way
 * that is open and cheapest; a way with a gateway that the character is not at adds a leg to get there.
 */
export function plan(ctx: Ctx, life: LifeState, from: CountryId, to: CountryId, opts: PlanOpts = {}): Plan {
  const g = geo(ctx);
  const a = g.countries.get(from);
  const b = g.countries.get(to);
  if (!a || !b) return fail('unknown');
  if (from === to) return { ok: true, legs: [], days: 0, fare: 0, smuggle: false, mask: false };
  const entry = entryOf(ctx, life, b);
  let smuggle = false;
  if (!entry.open) {
    if (entry.never || !opts.smuggle || !canSmuggle(ctx, life)) return fail(entry.why ?? 'closed');
    smuggle = true;
  }
  const legs: Leg[] = [];
  if (a.continent === b.continent) {
    const leg = inside(ctx, life, a, b, { smuggle: opts.smuggle && canSmuggle(ctx, life) });
    if (!leg) return fail('route closed');
    legs.push(leg);
  } else {
    // every path of up to three hops over the continents (routes.ts), each walked hop by hop; the cheapest open one is taken
    let best: { legs: Leg[]; smuggle: boolean; fare: number; days: number } | undefined;
    for (const path of continentPaths(a.continent, b.continent, 3).slice(0, 8)) {
      const r = planPath(ctx, life, a, b, path, opts);
      if (!r) continue;
      const fare = r.legs.reduce((n, l) => n + l.fare, 0);
      const days = r.legs.reduce((n, l) => n + l.days, 0);
      // a way that needs no smuggling beats one that does; then the fare, then the days
      if (!best || (best.smuggle && !r.smuggle) || (best.smuggle === r.smuggle && (fare < best.fare - 1e-9 || (Math.abs(fare - best.fare) < 1e-9 && days < best.days)))) best = { ...r, fare, days };
    }
    if (!best) return fail(continentPaths(a.continent, b.continent, 3).length ? 'route closed' : 'no route');
    legs.push(...best.legs);
    if (best.smuggle) smuggle = true;
  }
  if (legs.some((l) => l.smuggle)) smuggle = true;
  // the fog asks a mask (§3.6): a leg that starts or ends in Nebulia, for a character the fog is not at home with
  let mask = false;
  if (legs.some((l) => l.from.startsWith('NB') || l.to.startsWith('NB')) && !fogProof(ctx, life)) mask = true;
  const fogMul = legs.some((l) => l.from.startsWith('NB') || l.to.startsWith('NB')) ? 1.5 : 1;
  const days = legs.reduce((n, l) => n + l.days, 0) * fogMul;
  const fare = legs.reduce((n, l) => n + l.fare, 0) + (mask ? MASK_PRICE : 0);
  if (!opts.free && fare > life.gold) {
    const overland = legs.every((l) => ['land', 'isthmus', 'coast', 'chasm', 'rail', 'caravan'].includes(l.route) && !l.smuggle);
    if (opts.walk && overland) return { ok: true, legs, days: days * 2, fare: 0, smuggle, mask: false, walk: true };
    return { ok: false, why: 'purse', legs, days, fare, smuggle, mask };
  }
  return { ok: true, legs, days, fare, smuggle, mask };
}

// ---------- walking the trip ----------

const ENCOUNTER_STREAM = 'life.travel.road';

/** Weights of the d12 (§4): fixed, changed only by the world flags of the places the leg touches. */
export function roadWeights(ctx: Ctx, leg: Pick<Leg, 'from' | 'to' | 'route'>): number[] {
  const w = Array<number>(12).fill(1);
  const flags = [...flagsOf(ctx, leg.from), ...flagsOf(ctx, leg.to)];
  for (const m of geo(ctx).travel.encounterMods) {
    let on = false;
    if (m.when === 'สงคราม') on = flags.includes('war');
    else if (m.when === 'โรคระบาด') on = flags.includes('plague');
    else if (m.when === 'ภัยอดอยาก') on = flags.includes('famine');
    else if (m.routes) on = happened(ctx, 'DR-06') && m.routes.includes(leg.route);
    if (on) for (const it of m.items) w[it.d - 1] *= it.mul;
  }
  return w;
}

const src = (id?: string): EffectSource => ({ sys: 'travel', id, stream: ENCOUNTER_STREAM });

/** One roll of the road table for a leg. Returns quarters of delay it causes. */
function road(ctx: Ctx, life: LifeState, leg: Leg, why: string): number {
  const rng = ctx.rng(ENCOUNTER_STREAM);
  const d = rng.weighted(roadWeights(ctx, leg)) + 1;
  const ex = extOf(life);
  const flags = [...flagsOf(ctx, leg.from), ...flagsOf(ctx, leg.to)];
  const row = geo(ctx).travel.encounters.find((e) => e.d === d);
  let delay = 0;
  let note = '';
  switch (d) {
    case 1: {
      // a toll or a bribe: 5 to 15 percent of the goods; a character who will not pay may be marked (c_wanted 15%)
      const proud = life.traits.some((t) => ['proud', 'reckless', 'hot', 'stubborn'].includes(t));
      if (proud && rng.chance(0.5)) {
        note = 'resist';
        if (rng.chance(0.15)) {
          apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_wanted' }], src('d1'));
          addOnce(ex.wantedIn, leg.to);
        }
      } else {
        const share = TOLL_SHARE[0] + rng.next() * (TOLL_SHARE[1] - TOLL_SHARE[0]);
        const n = Math.floor(life.gold * GOODS_SHARE * share);
        if (n > 0) apply(ctx, [{ k: 'stat', stat: 'gold', delta: -n }], src('d1'));
        note = `pay ${n}`;
      }
      break;
    }
    case 2:
      if (!['caravan_guard', 'mercenary', 'soldier', 'knight', 'bounty_hunter'].includes(life.job ?? '') || rng.chance(0.5)) apply(ctx, [{ k: 'battle', enemies: ['bandits'] }], src('d2'));
      note = 'bandits';
      break;
    case 3:
      ex.met += 1;
      note = 'fellow traveller';
      break;
    case 4:
      delay = 1;
      note = 'festival';
      break;
    case 5:
      if (flags.some((f) => ['war', 'famine', 'plague'].includes(f)) && life.traits.includes('kind')) apply(ctx, [{ k: 'stat', stat: 'axis.kind', delta: 1 }], src('d5'));
      note = 'refugees';
      break;
    case 6:
      if (rng.chance(0.5)) {
        // the draft: the soldiers use the character's cart for a season. Or the road to a hired sword: the mercenary line
        delay = 1;
        note = 'draft';
      } else {
        note = 'mercenary road';
        queueLine(ctx, 'ml', 'd6');
      }
      break;
    case 7:
      if (flags.includes('plague') && rng.chance(0.5)) {
        apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_fever', chance: 0.15 }], src('d7'));
        note = 'carried the sickness';
      } else {
        delay = 1;
        note = 'quarantine';
      }
      break;
    case 8: {
      if (rng.chance(0.5)) {
        const n = Math.min(life.gold, rng.int(2, 8));
        if (n > 0) apply(ctx, [{ k: 'stat', stat: 'gold', delta: -n }], src('d8'));
        note = `repair ${n}`;
      } else {
        delay = 1;
        note = 'delayed';
      }
      break;
    }
    case 9:
      note = 'safe inn';
      break;
    case 10: {
      // news of a big event that came to pass on another continent
      const w = world(ctx);
      const fresh = Object.entries(w.happened)
        .filter(([, y]) => year(ctx) - y <= 30)
        .map(([id]) => id)
        .sort();
      note = fresh.length ? `news ${fresh[rng.int(0, fresh.length - 1)]}` : 'news';
      break;
    }
    case 11:
      note = 'met again';
      break;
  }
  // a quiet leg (nothing, a festival, an inn, a stranger, an old friend) stays out of the log; the rest are lines of the life
  if (![3, 4, 9, 11, 12].includes(d)) write(ctx.state, { sys: 'travel', kind: 'road', id: `d${d}`, data: { from: leg.from, to: leg.to, note, name: row?.name ?? '', why }, level: d === 2 || d === 7 || d === 10 ? 1 : 0 });
  return delay;
}

/** Opens an overlay line through the story system (`openLine`) and writes the opening. */
export function queueLine(ctx: Ctx, line: string, why: string): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ex = extOf(life);
  // a line opens once; asking again would only make the story draw its decision again
  if (ex.opened.includes(line)) return;
  ex.opened.push(line);
  openLine(ctx, line);
  write(ctx.state, { sys: 'travel', kind: 'open', id: line, data: { why }, level: 1 });
}

export interface GoResult {
  ok: boolean;
  why?: string;
  legs: number;
  days: number;
  fare: number;
  delay: number;
}

const NOT_GONE: GoResult = { ok: false, legs: 0, days: 0, fare: 0, delay: 0 };

/** The character stood in this country on the way: it counts for the level and for the countries seen (a gateway is a place stood in). */
function stood(life: LifeState, ex: ReturnType<typeof extOf>, to: CountryId): void {
  if (to !== ex.born) addOnce(ex.visited, to);
  addOnce(ex.continents, to.slice(0, 2) as ContinentId);
  const lv = ex.continents.length > 1 ? 2 : ex.visited.length > 0 ? 1 : 0;
  if (lv > ex.level) ex.level = lv as 0 | 1 | 2;
  void life;
}

/** Changes `life.country`, keeps the counts of what the character has seen, and writes the move (the one place the country changes). */
export function move(ctx: Ctx, life: LifeState, to: CountryId, why: string, legs = 1): void {
  const ex = extOf(life);
  const from = life.country;
  if (from === to) return;
  life.country = to;
  const cont = to.slice(0, 2) as ContinentId;
  if (to !== ex.born) addOnce(ex.visited, to);
  addOnce(ex.continents, cont);
  const lv = ex.continents.length > 1 ? 2 : ex.visited.length > 0 ? 1 : 0;
  if (lv > ex.level) ex.level = lv as 0 | 1 | 2;
  write(ctx.state, { sys: 'travel', kind: 'move', id: to, data: { from, to, why, legs, level: ex.level }, level: 1 });
}

/**
 * Takes the character to `to` by the way `plan` found. The purse pays unless the employer does (`opts.free`); a stair test can fail on the way
 * (the character is left at the foot of the stair). Returns what was spent. The character is moved at the end of the trip.
 */
export function go(ctx: Ctx, to: CountryId, why: string, opts: PlanOpts & { stay?: boolean } = {}): GoResult {
  const life = lifeOf(ctx);
  if (!life) return NOT_GONE;
  const ex = extOf(life);
  const pl = plan(ctx, life, life.country, to, { ...opts, free: opts.free ?? false });
  if (!pl.ok) {
    write(ctx.state, { sys: 'travel', kind: 'blocked', id: to, data: { from: life.country, why: pl.why ?? '', cause: why }, level: 0 });
    return { ...NOT_GONE, why: pl.why };
  }
  const rng = ctx.rng('life.travel.plan');
  let spent = 0;
  let days = 0;
  let delay = 0;
  let stopped: CountryId | undefined;
  if (pl.mask && !pl.walk) {
    life.items.push(FOG_MASK);
    spent += MASK_PRICE;
  }
  let legs = 0;
  for (const leg of pl.legs) {
    let d = inRange(rng, leg.rows, [10, 20]) * leg.state.timeMul * (pl.walk ? 2 : 1);
    let fare = pl.walk ? 0 : leg.smuggle ? inRange(rng, geo(ctx).travel.smuggle.cost, [30, 100]) : Math.round(inRange(rng, leg.fares, [1, 3]) * leg.state.fareMul * (leg.route === 'sea' || leg.route === 'airship' ? 1 : leg.toll));
    if (leg.route === 'stair') {
      // wait for the giants' test 1 to 4 seasons, then climb; the test is passed by the stance of SH-03 (§3.6)
      d = rng.int(1, 4) * DAYS_PER_QUARTER + inRange(rng, [10, 15], [10, 15]);
      const ticket = life.items.includes('ky_stair_ticket');
      if (!ticket) fare += 3;
      const pass = rng.chance(STAIR_PASS[Math.max(-2, Math.min(1, entryStance(ctx, life)))] ?? 0.5);
      spent += fare;
      days += d;
      if (!pass) {
        write(ctx.state, { sys: 'travel', kind: 'stair', id: 'fail', data: { days: d }, level: 1 });
        stopped = leg.from;
        delay += Math.ceil(d / DAYS_PER_QUARTER);
        break;
      }
    } else {
      spent += fare;
      days += d;
    }
    legs++;
    stood(life, ex, leg.to);
    // §4: a leg rolls the road once, a leg across continents twice, and a border with a wary stance one check more
    const rolls = (leg.cross ? 2 : 1) + leg.checks;
    for (let i = 0; i < rolls; i++) delay += road(ctx, life, leg, why);
    if (leg.smuggle || leg.state.illegal) {
      if (rng.chance(geo(ctx).travel.smuggle.wantedChance)) {
        apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_wanted' }], src('smuggle'));
        addOnce(ex.wantedIn, leg.to);
      }
      ex.smuggled += 1;
    }
  }
  spent = Math.round(spent);
  if (!opts.free && spent > 0) {
    apply(ctx, [{ k: 'stat', stat: 'gold', delta: -Math.min(life.gold, spent) }], src('fare'));
    ex.spent += spent;
  }
  const arrived = stopped ?? to;
  if (legs > 0) move(ctx, life, arrived, why, legs);
  ex.trips += 1;
  ex.legs += legs;
  ex.days += Math.round(days);
  ex.yearLegs[life.hAge] = (ex.yearLegs[life.hAge] ?? 0) + legs;
  ex.yearDays[life.hAge] = (ex.yearDays[life.hAge] ?? 0) + Math.round(days);
  ex.delay += delay;
  write(ctx.state, { sys: 'travel', kind: 'trip', id: arrived, data: { from: pl.legs[0]?.from ?? life.country, to: arrived, why, legs, days: Math.round(days), fare: spent, smuggle: pl.smuggle }, level: 1 });
  return { ok: stopped === undefined, why: stopped ? 'stair' : undefined, legs, days: Math.round(days), fare: spent, delay };
}

function entryStance(ctx: Ctx, life: LifeState): number {
  const c = geo(ctx).countries.get('SH-03');
  return c ? entryOf(ctx, life, c).stance : 0;
}

/** Everything the road asks, cheaply: can the character get to `to` by a normal way now (no purse test)? */
export function reachable(ctx: Ctx, life: LifeState, to: CountryId, opts: PlanOpts = {}): boolean {
  return plan(ctx, life, life.country, to, { ...opts, free: true }).ok;
}

