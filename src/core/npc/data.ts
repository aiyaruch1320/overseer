// Lookups over data/gen/npcs.json and countries.json, built once per loaded data set.
import { dataOf, type Ctx } from '../game';
import type { Country, NpcRow, NpcsFile, PeopleLife } from '../data/types-npcs';
import { KEEPER_RE } from './tuning';

export interface NpcIndex {
  file: NpcsFile;
  rows: Map<string, NpcRow>;
  countries: Map<string, Country>;
  /** Country ids of each continent, for moves. */
  byContinent: Map<string, string[]>;
  /** Fallback life of each people code (first entry of the table with that id). */
  lifeById: Map<string, number>;
  /** Index into rules.lives for each row. */
  lifeOf: Map<string, number>;
  keepers: Set<string>;
}

const cache = new WeakMap<object, NpcIndex>();

const stripNote = (s: string) => s.replace(/ \(.*\)$/, '');

function lifeIdxOf(row: NpcRow, lives: PeopleLife[], byId: Map<string, number>): number {
  const byName = lives.findIndex((l) => row.raceText.startsWith(stripNote(l.people)));
  if (byName >= 0) return byName;
  const id = row.peopleId ?? 'hu';
  return byId.get(id) ?? byId.get('hu') ?? 0;
}

export function npcIndex(ctx: Ctx): NpcIndex {
  const file = dataOf<NpcsFile>(ctx, 'npcs');
  const hit = cache.get(file);
  if (hit) return hit;
  const lives = file.rules.lives;
  const lifeById = new Map<string, number>();
  lives.forEach((l, i) => {
    if (l.id && !lifeById.has(l.id)) lifeById.set(l.id, i);
  });
  const rows = new Map<string, NpcRow>();
  const lifeOf = new Map<string, number>();
  const keepers = new Set<string>();
  for (const r of file.npcs) {
    rows.set(r.id, r);
    lifeOf.set(r.id, lifeIdxOf(r, lives, lifeById));
    if (KEEPER_RE.test(r.role) || KEEPER_RE.test(r.unique)) keepers.add(r.id);
  }
  const countries = new Map<string, Country>();
  const byContinent = new Map<string, string[]>();
  if (ctx.data.countries) {
    for (const c of dataOf<Country[]>(ctx, 'countries')) {
      countries.set(c.id, c);
      const list = byContinent.get(c.continent) ?? [];
      list.push(c.id);
      byContinent.set(c.continent, list);
    }
  }
  const idx: NpcIndex = { file, rows, countries, byContinent, lifeById, lifeOf, keepers };
  cache.set(file, idx);
  return idx;
}

/** The people entry of a row; a half-blood row (two people) takes the mean of the two spans as sim-npc-timeline does. */
export function lifeOfRow(idx: NpcIndex, row: NpcRow): { lo: number; hi: number; adult: number; elder: number; idx: number } {
  const lives = idx.file.rules.lives;
  const i = idx.lifeOf.get(row.id) ?? 0;
  const a = lives[i];
  if (row.halfPeopleId && idx.lifeById.has(row.halfPeopleId)) {
    const b = lives[idx.lifeById.get(row.halfPeopleId)!];
    if (b !== a) return { lo: (a.lifeLo + b.lifeLo) / 2, hi: (a.lifeHi + b.lifeHi) / 2, adult: (a.adult + b.adult) / 2, elder: (a.elder + b.elder) / 2, idx: i };
  }
  return { lo: a.lifeLo, hi: a.lifeHi, adult: a.adult, elder: a.elder, idx: i };
}
