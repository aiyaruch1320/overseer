// The routes of 01-travel-rules.md §3.1 and §3.6: which ways join which continents, who may use them, how a world event changes them.
// Times and fares come from data/gen/travel.json (`routes`); the gateways and the conditions are the table's prose, written here once.
import type { Ctx } from '../game';
import { holds } from '../character';
import { happened, outcomeOf, since, world } from '../world/access';
import type { ContinentId, CountryId, LifeState } from '../types';
import { geo, type CountryInfo } from './data';
import { flagsOf, stanceOf } from './access';
import { extOf } from './state';
import { WIND_STILL_YEARS } from './tuning';

export type RouteId = 'land' | 'coast' | 'isthmus' | 'rail' | 'caravan' | 'sea' | 'chasm' | 'roots' | 'fog' | 'stair' | 'airship' | 'whale' | 'waterfall' | 'fly' | 'ruin';

/** One way of joining two continents. `ends` name the countries the way starts and ends in (null = any country that has the way). */
export interface Link {
  route: RouteId;
  /** Gateways in [a, b] of the edge; a null side means any country (a port needs a coast). */
  ends: [CountryId[] | null, CountryId[] | null];
}

export interface Edge {
  a: ContinentId;
  b: ContinentId;
  links: Link[];
}

const any: [null, null] = [null, null];

/** continents.md §12 and world-map.md §1 landLinks, plus the sea hub of Nerea (continents.md: Nerea rules the sea lanes). */
export const EDGES: Edge[] = [
  { a: 'AL', b: 'SV', links: [{ route: 'isthmus', ends: any }] },
  { a: 'AL', b: 'KD', links: [{ route: 'isthmus', ends: any }] },
  { a: 'AL', b: 'MK', links: [{ route: 'rail', ends: [['AL-28'], ['MK-05']] }, { route: 'isthmus', ends: any }] },
  { a: 'AL', b: 'NB', links: [{ route: 'isthmus', ends: any }] },
  { a: 'AL', b: 'SH', links: [{ route: 'caravan', ends: any }] },
  { a: 'SV', b: 'MH', links: [{ route: 'isthmus', ends: any }] },
  { a: 'MH', b: 'KD', links: [{ route: 'chasm', ends: [null, ['KD-08']] }, { route: 'isthmus', ends: any }] },
  { a: 'SV', b: 'NB', links: [{ route: 'roots', ends: any }] },
  { a: 'SH', b: 'AZ', links: [{ route: 'stair', ends: [['SH-03'], ['AZ-04']] }, { route: 'ruin', ends: any }] },
  { a: 'MK', b: 'AZ', links: [{ route: 'airship', ends: [['MK-09'], ['AZ-08', 'AZ-03', 'AZ-09']] }] },
  { a: 'NR', b: 'AZ', links: [{ route: 'whale', ends: [['NR-16'], ['AZ-06']] }, { route: 'waterfall', ends: [['NR-02'], ['AZ-06']] }] },
  // ships join the sea hub to the coasts of every continent that sails, and the two big coasts to each other
  ...(['AL', 'MH', 'SV', 'KD', 'SH', 'MK', 'NB'] as ContinentId[]).map((c): Edge => ({ a: 'NR', b: c, links: [{ route: 'sea', ends: any }] })),
  { a: 'AL', b: 'MH', links: [{ route: 'sea', ends: any }] },
];

export interface RouteState {
  open: boolean;
  /** Why it is closed (for the log). */
  why?: string;
  timeMul: number;
  fareMul: number;
  /** A closed way a smuggler can still take (§3.4): not when the cause is the place itself (a lost peak, a sealed chasm, grounded airships). */
  smuggle: boolean;
  /** The way asks a test at the border (the giant's stair). */
  test?: 'stair';
  /** The way is run by a smuggler's airship (PO-02): the trip carries a risk of arrest. */
  illegal?: boolean;
}

const ok = (): RouteState => ({ open: true, timeMul: 1, fareMul: 1, smuggle: true });
const shut = (why: string, smuggle: boolean): RouteState => ({ open: false, why, timeMul: 1, fareMul: 1, smuggle });

const warred = (ctx: Ctx, a: CountryId, b: CountryId) => flagsOf(ctx, a).includes('war') && flagsOf(ctx, b).includes('war');

/** Years since DR-06 (calm of the winds), Infinity when it has not happened. */
export const calmYears = (ctx: Ctx): number => since(ctx, 'DR-06');

const flies = (ctx: Ctx, life: LifeState): 'far' | 'near' | 'no' => {
  if (life.race === 'winged') return (life.blood ?? '').includes('ปีกสั้น') ? 'near' : 'far';
  if (holds(ctx, life, 'skill', 'pa_fly_mount', 3)) return 'far';
  return 'no';
};

/** Can a hop on `route` between these two countries be taken by this life now, and at what cost? The event rules are the "เหตุการณ์ที่เปลี่ยน" column. */
export function routeState(ctx: Ctx, life: LifeState, route: RouteId, a: CountryInfo, b: CountryInfo): RouteState {
  const w = world(ctx);
  const both = (x: CountryId) => a.id === x || b.id === x;
  const st = ok();
  switch (route) {
    case 'land':
    case 'isthmus': {
      if (warred(ctx, a.id, b.id)) return shut('war', true);
      if (route === 'isthmus' && happened(ctx, 'FG-03') && (a.continent === 'NB' || b.continent === 'NB')) return shut('FG-03', true);
      if (route === 'land' && happened(ctx, 'DR-07') && a.continent === 'AL') return { ...st, timeMul: 1.5, fareMul: 1.4 };
      // the islands of Azgar that no chain bridge reaches: a small airship or the island's cable car, three times the fare
      if (route === 'land' && a.continent === 'AZ' && a.id !== 'AZ-01' && b.id !== 'AZ-01' && flies(ctx, life) === 'no') return { ...st, fareMul: 3 };
      return st;
    }
    case 'coast': {
      if (happened(ctx, 'DR-06') && calmYears(ctx) < WIND_STILL_YEARS) return { ...st, timeMul: 1.5 };
      return st;
    }
    case 'rail':
      return st;
    case 'caravan': {
      const r = { ...st };
      if (happened(ctx, 'WR-10') && outcomeOf(ctx, 'WR-10') === 'a') r.fareMul *= 2;
      if (happened(ctx, 'GI-07')) r.timeMul = 1 + 10 / 37;
      return r;
    }
    case 'sea': {
      if (!a.coast || !b.coast) return shut('no port', false);
      // DR-05 drowned the harbour cities AL-04 and NR-09 from DW-01 until DW-04 (the sea lanes lose time meanwhile)
      const sunk = happened(ctx, 'DW-01') && !happened(ctx, 'DW-04');
      if (sunk && (both('AL-04') || both('NR-09'))) return shut('DR-05', false);
      const r = { ...st };
      if (happened(ctx, 'DR-05') && !happened(ctx, 'DW-04')) r.timeMul *= 1.2;
      if (happened(ctx, 'DW-04')) r.fareMul *= 0.7;
      if (happened(ctx, 'PO-03') && a.continent !== 'NR' && b.continent !== 'NR') r.fareMul *= 1.2;
      if (happened(ctx, 'WR-06') && (a.continent === 'AL' || b.continent === 'AL')) r.fareMul *= 2;
      if (happened(ctx, 'DR-06')) {
        const y = since(ctx, 'DR-06');
        const crew = holds(ctx, life, 'skill', 'ns_wind_read') || life.job === 'navigator';
        // the winds are gone: only oars for twenty years, then a gale that never lasts; a navigator on board knows the next wind
        if (y < WIND_STILL_YEARS) {
          r.timeMul *= 2;
          r.fareMul *= 1.3;
        } else {
          if (!crew) r.timeMul *= 1.25;
          r.fareMul *= 1.1;
        }
      }
      return r;
    }
    case 'chasm': {
      if (happened(ctx, 'WR-13') && outcomeOf(ctx, 'WR-13') === 'a') return shut('WR-13', false);
      return st;
    }
    case 'roots': {
      if (happened(ctx, 'BIO-02')) return shut('BIO-02', false);
      const guide = ['guide', 'adventurer', 'explorer'].includes(life.job ?? '') || holds(ctx, life, 'skill', 'ns_fog_guide');
      return guide ? st : shut('no guide', false);
    }
    case 'fog':
      return { ...st, timeMul: 1.5 };
    case 'stair': {
      if (happened(ctx, 'DR-01')) return shut('DR-01', false);
      if (happened(ctx, 'WR-02') && outcomeOf(ctx, 'WR-02') === 'a' && !happened(ctx, 'HP-03')) return shut('WR-02', false);
      if (stanceOf(ctx, life, geo(ctx).countries.get('SH-03')!) <= -2) return shut('giants', false);
      return { ...st, test: 'stair' };
    }
    case 'ruin': {
      if (!happened(ctx, 'DR-01')) return shut('not fallen', false);
      return st;
    }
    case 'airship': {
      const still = happened(ctx, 'DR-06') && calmYears(ctx) < WIND_STILL_YEARS;
      if (still) return shut('DR-06', false);
      if (happened(ctx, 'DR-01') && b.id !== 'AZ-09' && a.id !== 'AZ-09') return shut('DR-01', false);
      if (happened(ctx, 'PO-02')) return { ...st, fareMul: 3, illegal: true };
      return st;
    }
    case 'whale': {
      const invited = extOf(life).invited.includes('NR-16') || extOf(life).invited.includes('AZ-06') || life.job === 'diplomat';
      const commoners = happened(ctx, 'CT-10') && since(ctx, 'CT-10') < 1;
      if (happened(ctx, 'DR-01') && !commoners) return shut('DR-01', false);
      return invited || commoners ? st : shut('no invitation', false);
    }
    case 'waterfall': {
      if (happened(ctx, 'DR-01')) return shut('DR-01', false);
      const key = life.items.includes('ky_waterfall_key') || life.job === 'waterfall_keyholder';
      return key ? st : shut('no key', false);
    }
    case 'fly': {
      const f = flies(ctx, life);
      if (f === 'no') return shut('cannot fly', false);
      // the short wings carry only a short way: inside a continent, over the narrow straits
      if (f === 'near' && a.continent !== b.continent) return shut('short wings', false);
      if (b.continent === 'AZ' || a.continent === 'AZ') {
        if (w.happened['DR-01'] !== undefined && a.id !== 'AZ-09' && b.id !== 'AZ-09') return shut('DR-01', false);
      }
      return { ...st, timeMul: 0.5, fareMul: 0 };
    }
  }
  return st;
}

/** The neighbours of a continent with the edges that join them. */
export function edgesOf(c: ContinentId): { to: ContinentId; edge: Edge; flip: boolean }[] {
  const out: { to: ContinentId; edge: Edge; flip: boolean }[] = [];
  for (const e of EDGES) {
    if (e.a === c) out.push({ to: e.b, edge: e, flip: false });
    else if (e.b === c) out.push({ to: e.a, edge: e, flip: true });
  }
  return out;
}

/** Every simple path over the continents from `from` to `to` with at most `max` hops, the shortest first. */
export function continentPaths(from: ContinentId, to: ContinentId, max = 3): { c: ContinentId; edge: Edge; flip: boolean }[][] {
  const out: { c: ContinentId; edge: Edge; flip: boolean }[][] = [];
  const walk = (at: ContinentId, seen: Set<ContinentId>, path: { c: ContinentId; edge: Edge; flip: boolean }[]) => {
    if (at === to) {
      out.push(path);
      return;
    }
    if (path.length >= max) return;
    for (const n of edgesOf(at)) {
      if (seen.has(n.to)) continue;
      walk(n.to, new Set([...seen, n.to]), [...path, { c: n.to, edge: n.edge, flip: n.flip }]);
    }
  };
  if (from !== to) walk(from, new Set([from]), []);
  return out.sort((x, y) => x.length - y.length);
}
