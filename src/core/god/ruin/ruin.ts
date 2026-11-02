// The ruin of the god (ซากพระเจ้า, 04-miracles.md §5): what a country becomes when MR-17 or MR-18 falls on it, using the take rules of the branching
// paths (events/branches/README.md): the country is the anchor that is gone, so every event that has it as its place is closed (a world event with a ruin
// form would use it; the table has none, so they are closed), no event of the anchor happens again, and the events that follow (RU-01 to RU-08) open
// within ten years. The numbers are read from data/gen/god.json `miracles.ruin.numbers`; every roll draws from the stream `god.ruin`.
import type { Ctx } from '../../game';
import { close } from '../../world/core';
import { tablesOf } from '../../world';
import type { LocalEventsData } from '../../data/types-events';
import { dataOf } from '../../game';
import { activeMods, addMod, setFlag } from '../acts/mods';
import { continentOf, countryName, flagsOf, godOf, neighboursOf } from '../acts/geo';
import { chronicle, say } from '../acts/record';
import { yearOf } from '../acts/state';
import { geoOf } from '../../world/place';
import { later } from '../acts/miracles';
import { ruinLabel } from './names';
import { acceptors, hauntMain, leadersOf, npcsIn, rollPeople } from './people';
import { ruinExt, ruinAt, type RuinKind, type RuinRec } from './state';
import { LAKE_SPREAD, RAINY, STREAM } from './tuning';

/** A country with much rain (RU-08 after MR-17). The docs name no field for it; the map of the country stands for it (tuning RAINY). */
export function isRainy(ctx: Ctx, country: string): boolean {
  const f = ctx.data.countries;
  const row = (f?.items as Record<string, { id: string; ui?: { ambient?: string; centre?: string } }> | undefined)?.[country];
  const ui = row?.ui;
  return !!ui && (RAINY.ambient.includes(ui.ambient ?? '') || RAINY.centre.includes(ui.centre ?? '') || !!geoOf(ctx, country)?.river);
}

/** The world events that name the country as a place where they happen (a war, a fog, a hunger): the table has no ruin form for any, so they are closed with it (§5.1 row 6). */
export function eventsOf(ctx: Ctx, country: string): string[] {
  const w = ctx.state.world;
  return tablesOf(ctx)
    .data.events.filter((e) => !e.role && !e.home.world && e.home.countries.includes(country))
    .filter((e) => w.happened[e.id] === undefined && !w.closed.includes(e.id))
    .map((e) => e.id)
    .sort();
}

/** The local events (LC) of the country, which the ruin closes (the local-event system will not open them). */
export function localEventsOf(ctx: Ctx, country: string): string[] {
  if (!ctx.data['local-events']) return [];
  return dataOf<LocalEventsData>(ctx, 'local-events')
    .events.filter((e) => e.countries.includes(country))
    .map((e) => e.id)
    .sort();
}

/** The convergence points that sit in the country (a choice is open only there) move to the nearest country of the continent (§5.1 row 7). */
export function pointsIn(ctx: Ctx, country: string): string[] {
  const pts = (ctx.data.convergence?.items as { points?: { id: string; choices: { when?: unknown }[] }[] } | undefined)?.points ?? [];
  const has = (x: unknown): boolean => {
    if (!x || typeof x !== 'object') return false;
    const o = x as Record<string, unknown>;
    if (o.k === 'country' && Array.isArray(o.ids) && (o.ids as string[]).includes(country)) return true;
    return Object.values(o).some(has);
  };
  return pts.filter((p) => p.choices.some((c) => has(c.when))).map((p) => p.id);
}

/** The day each event of the ruin is due (drawn once, when the ruin is made): the windows come from the table of §5.2. */
function schedule(ctx: Ctx, country: string, kind: RuinKind, y: number): Record<string, number> {
  const rng = ctx.rng(STREAM);
  const ev = godOf(ctx).miracles.ruin.events;
  const due: Record<string, number> = {};
  const rain = isRainy(ctx, country);
  for (const e of [...ev].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!e.after.includes(kind)) continue;
    // the lake: after MR-18 it takes the place of the diggers (RU-03) in their window; after MR-17 it comes twenty years on, where the rain is
    if (e.id === 'RU-03' && kind === 'MR-18') continue;
    if (e.id === 'RU-08') {
      if (kind === 'MR-18') {
        const t = ev.find((x) => x.id === 'RU-03')!;
        due[e.id] = y + rng.int(t.from, t.to ?? t.from);
      } else if (rain) due[e.id] = y + rng.int(20, 20 + LAKE_SPREAD);
      continue;
    }
    due[e.id] = y + rng.int(e.from, e.to ?? e.from);
  }
  return due;
}

/** What a ruin would do to the country now, counted without any roll: for the preview. */
export function ruinFacts(ctx: Ctx, country: string, kind: RuinKind): Record<string, unknown> {
  const n = godOf(ctx).miracles.ruin.numbers;
  const life = ctx.state.life;
  return {
    pop: n.pop,
    npcs: { here: npcsIn(ctx, country).length, die: n.npc.die, flee: n.npc.flee, stay: n.npc.stay, leaders: leadersOf(ctx, country).length },
    allyDie: n.allyDie,
    closes: eventsOf(ctx, country).map((id) => tablesOf(ctx).info.get(id)?.name ?? id),
    localCloses: localEventsOf(ctx, country).length,
    moves: pointsIn(ctx, country),
    neighbours: neighboursOf(ctx, country).map((c) => countryName(ctx, c)),
    neighbourFaith: n.neighbourFaith,
    lake: kind === 'MR-18' ? 'ใช่' : isRainy(ctx, country) ? 'อาจเป็นหลังยี่สิบปี' : 'ไม่',
    mainHere: !!life && !life.dead && life.country === country,
    mainCurse: n.mcCurse.chance,
    wAfter: n.w,
  };
}

/**
 * The country becomes a ruin. The people roll their dice, the city is gone from the map, the events of the anchor are closed, the events of the ruin are
 * given their days. Nothing here is the faith of the neighbours or the dread that returns: the miracle's own reaction does that.
 */
export function makeRuin(ctx: Ctx, country: string, kind: RuinKind): RuinRec {
  const g = godOf(ctx).miracles.ruin;
  const n = g.numbers;
  const e = ruinExt(ctx.state);
  const y = yearOf(ctx);
  const rng = ctx.rng(STREAM);
  const w = ctx.state.world;
  const pop = Math.round(rng.int(n.pop[0], n.pop[1])) / 100;
  setFlag(ctx, country, 'god_ruin');
  // the people: W 1 until the new city, the trade lines move away (C −5), the people are a share of what they were
  const src = `ruin:${country}`;
  addMod(ctx, { subject: 'W.set', country, add: n.w, src });
  addMod(ctx, { subject: 'C', country, add: n.trade, src });
  addMod(ctx, { subject: 'population', country, mul: pop, src });
  addMod(ctx, { subject: 'buildings', country, mul: 0.25, src }); // "อาคารพังราว 75%"
  const fates = rollPeople(ctx, country, n.npc, n.allyDie, 'ซากพระเจ้า');
  hauntMain(ctx, country, kind);
  const closed = eventsOf(ctx, country);
  for (const id of closed) close(ctx, id);
  const closedLc = localEventsOf(ctx, country);
  // the convergence points of the country go with the survivors, to the nearest country of the continent
  const near = neighboursOf(ctx, country).filter((c) => continentOf(c) === continentOf(country));
  const moved: Record<string, string> = {};
  if (near.length) for (const id of pointsIn(ctx, country)) moved[id] = near[0];
  Object.assign(e.moved, moved);
  const rec: RuinRec = {
    country,
    kind,
    year: y,
    label: ruinLabel(ctx, country),
    pop,
    ...(fates.leader ? { leader: fates.leader } : {}),
    fled: fates.fled,
    stayed: fates.stayed,
    died: fates.died,
    due: schedule(ctx, country, kind, y),
    done: {},
    took: [],
    closed,
    closedLc,
    moved,
  };
  e.ruins.push(rec);
  w.ruins.push({ id: kind, country, year: y });
  later(() => {
    chronicle(ctx, { kind: 'ruin', id: kind, target: country, result: `pop:${Math.round(pop * 100)} died:${fates.died.length} fled:${fates.fled.length} closed:${closed.length}` });
    say(ctx, {
      kind: 'ruin',
      id: 'made',
      data: { country, label: rec.label, pop: Math.round(pop * 100), died: fates.died.length, fled: fates.fled.length, stayed: fates.stayed.length, closed: closed.length, allies: fates.alliesDied.length, came: fates.alliesCame.length, kind },
      level: 1,
    });
  });
  return rec;
}

/** Is the country a ruin now? */
export const isRuin = (ctx: Ctx, country: string): boolean => !!ruinAt(ctx, country);

/** The W the ruin forces on the country (1 until the new city, then 2), or undefined for a country that is none of these. The economy asks. */
export function wOverride(ctx: Ctx, country: string): number | undefined {
  return activeMods(ctx)
    .filter((x) => x.subject === 'W.set' && x.country === country)
    .pop()?.add;
}

export const hasRuinFlag = (ctx: Ctx, country: string): boolean => flagsOf(ctx, country).includes('god_ruin');
export { acceptors };
