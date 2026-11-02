// What the story nodes `mr.a1` to `mr.a6` ask (docs/lore/storylines/31-divine.md §2 rule 2 and §3): "the event happened" for RU-02, RU-03, RU-04, RU-05, RU-08
// and for MR-01, MR-05, MR-10, MR-11, MR-14, MR-20 — but only when it happened in the character's country or next to it. The nodes carry a plain `event`
// condition, which the world answers from `world.happened`; the world's own events are global, these are not. So this file keeps the ids of the ruins and
// of the miracles in `world.happened` for the living character only: an id is there once an occurrence was near him in his life (year of the latest), and
// goes with the life. (Proposal for the contract: a `near` field on the event condition, so the world need not be told lies; see the report.)
import type { Ctx } from '../../game';
import { addIntercept } from '../acts/miracles';
import { continentOf, neighboursOf } from '../acts/geo';
import { lifeKey, livingOf, yearOf } from '../acts/state';
import { ruinExt, type RuinExt } from './state';
import { MADE_KEEP, NEAR_IDS } from './tuning';

// every miracle that happens is kept a while, with its place
addIntercept({
  after(ctx, m, _h, args, out) {
    const e = ruinExt(ctx.state);
    const places = Array.isArray(args.countries) ? (args.countries as unknown[]).map(String) : out.country ? [out.country] : [];
    if (!places.length && !out.continent) return;
    for (const c of places.length ? places : [undefined]) e.made.push({ id: m.id, year: yearOf(ctx), ...(c ? { country: c } : {}), ...(out.continent ? { continent: out.continent } : {}) });
    if (e.made.length > MADE_KEEP) e.made.splice(0, e.made.length - MADE_KEEP);
  },
});

/** The occurrences of events and miracles that exist now: [id, year, the countries it was in, the continent it was on]. */
function occurrences(e: RuinExt): { id: string; year: number; places: string[]; continent?: string }[] {
  const out: { id: string; year: number; places: string[]; continent?: string }[] = [];
  for (const r of e.ruins) for (const [id, year] of Object.entries(r.done)) out.push({ id, year, places: id === 'RU-02' ? r.took : [r.country] });
  for (const r of e.cracks) for (const [id, year] of Object.entries(r.done)) out.push({ id, year, places: id === 'RU-02' ? r.took : [r.country] });
  for (const x of e.made) out.push({ id: x.id, year: x.year, places: x.country ? [x.country] : [], ...(x.continent ? { continent: x.continent } : {}) });
  return out;
}

/** Tells the world which of these events the character has heard of in his life. Runs at his birth and every beat. */
export function syncReach(ctx: Ctx): void {
  const e = ctx.state.god.ext.ruin as RuinExt | undefined;
  if (!e) return;
  const w = ctx.state.world;
  const life = livingOf(ctx);
  const key = life ? lifeKey(life) : e.reach.life;
  if (e.reach.life !== key) {
    for (const id of e.reach.wrote) delete w.happened[id];
    e.reach = { life: key, seen: {}, wrote: [] };
  }
  if (!life) return;
  const here = life.country;
  const near = new Set([here, ...neighboursOf(ctx, here)]);
  const k = continentOf(here);
  const seen = e.reach.seen;
  for (const o of occurrences(e)) {
    if (!NEAR_IDS.test(o.id) || o.year < life.birthYear) continue;
    if (!(o.places.some((c) => near.has(c)) || (!o.places.length && o.continent === k))) continue;
    seen[o.id] = Math.max(seen[o.id] ?? -Infinity, o.year);
  }
  for (const [id, year] of Object.entries(seen)) {
    w.happened[id] = year;
    if (!e.reach.wrote.includes(id)) e.reach.wrote.push(id);
  }
}
