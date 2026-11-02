// The events that follow a ruin (RU-01 to RU-08, 04-miracles.md §5.2), the settlers of a new land (MR-20) and the peace of the wrath (MR-22).
// Every event has its day, drawn when the ruin was made (ruin.ts `schedule`); this runs at every beat and every world step and lets the ones that are due
// happen, once each, in the order of their days. An event does not happen after the ruin is over (RU-07 ends it) or when it has happened already:
// that is the take rule of the branching paths (events/branches/README.md rules 1 and 4) and what the done criterion of G5 asks.
import type { Ctx } from '../../game';
import { weighEvent } from '../../world';
import { addMod, clearFlag, dropMods } from '../acts/mods';
import { say } from '../acts/record';
import { continentOf, countriesOf, countryName, godOf, hasFlag, neighboursOf } from '../acts/geo';
import { aliveNpc } from '../acts/npcs';
import { actsOf, yearOf } from '../acts/state';
import { cityName, cultName } from './names';
import { acceptors, leadersOf, march } from './people';
import { sealStep } from './seal';
import { ruinExt, type CrackRec, type RuinRec } from './state';
import { AVENGERS_GD08, CAMP, CITY_W, DIGGERS, REFUGE } from './tuning';

const rowOf = (ctx: Ctx, id: string) => godOf(ctx).miracles.ruin.events.find((e) => e.id === id)!;
const deed = (ctx: Ctx, kind: string, id: string, country: string, data?: Record<string, string | number | boolean | null>) =>
  actsOf(ctx.state).deeds.push({ kind, id, country, year: yearOf(ctx), ...(data ? { data } : {}) });

/** Writes the event down: a line the player may read. (It is not a line of the chronicle of the hand: the hand did the miracle; this is what the world did after it, kept in `god.ext.ruin`.) */
function told(ctx: Ctx, id: string, country: string, extra: Record<string, string | number | boolean | null> = {}): void {
  const row = rowOf(ctx, id);
  say(ctx, { kind: 'ruin', id, data: { name: row.name, country, what: row.what, ...extra }, level: 1 });
}

/** The refugees walk to the countries that take them, the others on the border feel it (RU-02, for a ruin and for a cracked city). */
function refugees(ctx: Ctx, country: string, fled: string[]): string[] {
  const took = acceptors(ctx, country);
  march(ctx, fled, took);
  for (const c of took) addMod(ctx, { subject: 'food', country: c, mul: REFUGE.food, years: REFUGE.foodYears, src: 'RU-02' });
  for (const c of neighboursOf(ctx, country).filter((x) => !took.includes(x))) addMod(ctx, { subject: 'war-risk', country: c, add: REFUGE.border, years: REFUGE.borderYears, src: 'RU-02' });
  return took;
}

const diggers = (ctx: Ctx, country: string): void => {
  addMod(ctx, { subject: 'mercenary', continent: continentOf(country), mul: DIGGERS.mercenary, years: DIGGERS.years, src: 'RU-03' });
};

/** Does the leader of the ruin live? (RU-05: "or the leader of the ruin lived"). */
const leaderLives = (ctx: Ctx, r: RuinRec): boolean => !!r.leader && aliveNpc(ctx, r.leader);

/** One event of a ruin, when its day has come. Returns false when it must wait (its condition does not hold yet). */
function fireRuin(ctx: Ctx, r: RuinRec, id: string): boolean {
  const row = rowOf(ctx, id);
  const c = r.country;
  const y = yearOf(ctx);
  if (row.dreadMin !== undefined && ctx.state.god.dread < row.dreadMin) return false;
  if (row.noWar && hasFlag(ctx, c, 'war')) return false;
  if (row.unlessCult && r.done['RU-04'] !== undefined && !leaderLives(ctx, r)) return false;
  switch (id) {
    case 'RU-01':
      addMod(ctx, { subject: 'food', country: c, mul: CAMP.food, years: CAMP.years, src: 'RU-01' });
      break;
    case 'RU-02':
      r.took = refugees(ctx, c, r.fled);
      break;
    case 'RU-03':
      diggers(ctx, c);
      deed(ctx, 'ore', DIGGERS.ore, c);
      break;
    case 'RU-04':
      r.cult = cultName(ctx, c, !!r.lake);
      deed(ctx, 'cult', r.cult, c);
      break;
    case 'RU-05':
      weighEvent(ctx, 'GD-08', { mul: AVENGERS_GD08 });
      ruinExt(ctx.state).base = c;
      deed(ctx, 'avengers', 'GD-08', c);
      break;
    case 'RU-06': {
      const heir = r.leader ?? leadersOf(ctx, c)[0];
      if (heir) deed(ctx, 'claim', heir, c);
      break;
    }
    case 'RU-07': {
      clearFlag(ctx, c, 'god_ruin');
      dropMods(ctx, (m) => m.src === `ruin:${c}`);
      addMod(ctx, { subject: 'W.set', country: c, add: CITY_W.rebuilt, src: `city:${c}` });
      r.city = cityName(ctx, c);
      r.ended = y;
      const entry = ctx.state.world.ruins.find((x) => x.country === c && !x.healed);
      if (entry) entry.healed = true;
      break;
    }
    case 'RU-08':
      r.lake = true;
      deed(ctx, 'sea-goods', 'S', c);
      break;
    default:
      return false;
  }
  r.done[id] = y;
  told(ctx, id, c, id === 'RU-04' ? { cult: r.cult ?? null } : id === 'RU-07' ? { city: r.city ?? null } : {});
  return true;
}

/** One event of a cracked city: RU-02 (the survivors walk) and RU-03 (with scales and bits of the seal). */
function fireCrack(ctx: Ctx, r: CrackRec, id: string): boolean {
  const c = r.country;
  if (id === 'RU-02') r.took = refugees(ctx, c, r.fled);
  else if (id === 'RU-03') {
    diggers(ctx, c);
    deed(ctx, 'shard', DIGGERS.shard, c);
  } else return false;
  r.done[id] = yearOf(ctx);
  told(ctx, id, c, { cracked: true });
  return true;
}

const byDay = (due: Record<string, number>) => Object.keys(due).sort((a, b) => due[a] - due[b] || a.localeCompare(b));

/** Lets the events that are due happen. Also the settlers, the replies of the dragons and the peace of the wrath. */
export function ruinStep(ctx: Ctx): void {
  const e = ctx.state.god.ext.ruin as ReturnType<typeof ruinExt> | undefined;
  if (!e) return;
  const y = yearOf(ctx);
  for (const r of e.ruins) {
    if (r.ended !== undefined) continue;
    for (const id of byDay(r.due)) {
      if (r.ended !== undefined) break; // the ruin ended inside this loop: nothing else of it happens
      if (r.done[id] === undefined && r.due[id] <= y) fireRuin(ctx, r, id);
    }
  }
  for (const r of e.cracks) for (const id of byDay(r.due)) if (r.done[id] === undefined && r.due[id] <= y) fireCrack(ctx, r, id);
  for (const l of e.lands) {
    if (l.founded !== undefined || l.due > y) continue;
    l.founded = y;
    addMod(ctx, { subject: 'W.set', country: l.id, add: godOf(ctx).miracles.list.find((m) => m.id === 'MR-20')?.newCountryW ?? 2, src: `land:${l.id}` });
    say(ctx, { kind: 'land', id: 'found', data: { name: l.name, beside: l.beside, country: countryName(ctx, l.beside) }, level: 1 });
  }
  sealStep(ctx);
  peace(ctx);
}

/** The war flags of the continent stay off while the peace of fear lasts (MR-22). The world puts a flag on again when a war event fires; this takes it off. */
function peace(ctx: Ctx): void {
  const e = ruinExt(ctx.state);
  const y = yearOf(ctx);
  for (const [k, until] of Object.entries(e.peace)) {
    if (until <= y) {
      delete e.peace[k];
      continue;
    }
    for (const c of countriesOf(ctx, k)) if (hasFlag(ctx, c, 'war')) clearFlag(ctx, c, 'war');
  }
}

/**
 * Makes an event of the ruin of a country due now (the conjuring of "reveal · death" opens RU-06 at once, 07-conjure.md): it happens at the next step if the
 * ruin stands and the event has not happened. Returns false when there is no such ruin or the event has happened.
 */
export function bringDue(ctx: Ctx, country: string, id: string): boolean {
  const r = ruinExt(ctx.state).ruins.find((x) => x.country === country && x.ended === undefined);
  if (!r || r.done[id] !== undefined || !godOf(ctx).miracles.ruin.events.some((e) => e.id === id)) return false;
  r.due[id] = Math.min(r.due[id] ?? Infinity, yearOf(ctx));
  return true;
}

/** The ruins that stand: the countries and their events, for the map and the tests. */
export function ruinsNow(ctx: Ctx): RuinRec[] {
  const e = ctx.state.god.ext.ruin as ReturnType<typeof ruinExt> | undefined;
  return e ? e.ruins.filter((r) => r.ended === undefined) : [];
}

/** The cults that stand now (RU-04): each adds a half to the dread of a life year. */
export function cultsNow(ctx: Ctx): number {
  return ruinsNow(ctx).filter((r) => r.cult !== undefined).length;
}

