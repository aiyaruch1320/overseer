// Lookups over data/gen/npcs.json and countries.json, built once per loaded data set.
import { dataOf, type Ctx } from '../game';
import type { Country, NpcPath, NpcRow, NpcsFile, NpcTemplate, PeopleLife } from '../data/types-npcs';
import type { Effect } from '../types';
import { KEEPER_RE } from './tuning';
import type { NpcSlotX } from './types';

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
  templates: Map<string, NpcTemplate>;
  /** The roster rows of each country, in id order. */
  byCountry: Map<string, NpcRow[]>;
  /** The rows that name each world event anywhere in the row. */
  byEvent: Map<string, string[]>;
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
  const byCountry = new Map<string, NpcRow[]>();
  const byEvent = new Map<string, string[]>();
  for (const r of file.npcs) {
    rows.set(r.id, r);
    lifeOf.set(r.id, lifeIdxOf(r, lives, lifeById));
    if (KEEPER_RE.test(r.role) || KEEPER_RE.test(r.unique)) keepers.add(r.id);
    const list = byCountry.get(r.country) ?? [];
    list.push(r);
    byCountry.set(r.country, list);
    for (const e of r.events) {
      const ids = byEvent.get(e) ?? [];
      ids.push(r.id);
      byEvent.set(e, ids);
    }
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
  const templates = new Map<string, NpcTemplate>(file.templates.map((t) => [t.id, t]));
  const idx: NpcIndex = { file, rows, countries, byContinent, lifeById, lifeOf, keepers, templates, byCountry, byEvent };
  cache.set(file, idx);
  return idx;
}

/** The people entry of a row; a half-blood row (two people) takes the mean of the two spans as sim-npc-timeline does. */
export function lifeOfRow(idx: NpcIndex, row: NpcRow): { lo: number; hi: number; adult: number; elder: number; rate: number; idx: number } {
  const lives = idx.file.rules.lives;
  let i = idx.lifeOf.get(row.id);
  if (i === undefined) {
    i = lifeIdxOf(row, lives, idx.lifeById);
    idx.lifeOf.set(row.id, i);
  }
  const a = lives[i];
  if (row.halfPeopleId && idx.lifeById.has(row.halfPeopleId)) {
    const b = lives[idx.lifeById.get(row.halfPeopleId)!];
    if (b !== a) return { lo: (a.lifeLo + b.lifeLo) / 2, hi: (a.lifeHi + b.lifeHi) / 2, adult: (a.adult + b.adult) / 2, elder: (a.elder + b.elder) / 2, rate: (a.rate + b.rate) / 2, idx: i };
  }
  return { lo: a.lifeLo, hi: a.lifeHi, adult: a.adult, elder: a.elder, rate: a.rate, idx: i };
}

// ---------- newcomers: a row made from the template (succession.md §5) ----------

const TAGS: [string, 'help' | 'join' | 'hinder' | 'leave'][] = [
  ['[ช่วย]', 'help'],
  ['[ร่วม]', 'join'],
  ['[ขัดขวาง]', 'hinder'],
  ['[ปล่อย]', 'leave'],
];
const EVENT_ID_RE = /\b[A-Z]{2,3}-\d{2}\b/g;

/**
 * How the story of each template ends for the holder, where the label says so (the generator reads no `death` or vanishing from these
 * labels). Read by hand from the 54 templates; `dead` ends the holder, `gone` makes him vanish. The word is the cause the log shows.
 */
export const NT_ENDS: Record<string, Partial<Record<'a' | 'b' | 'c', ['dead' | 'gone', string]>>> = {
  'NT-01': { c: ['dead', 'ไม่มีใครรู้'] },
  'NT-02': { c: ['gone', 'หายสาบสูญ'] },
  'NT-15': { b: ['dead', 'ถูกดักฆ่า'] },
  'NT-16': { b: ['dead', 'ถูกแขวนคอ'] },
  'NT-17': { c: ['dead', 'ตายพร้อมสูตร'] },
  'NT-20': { c: ['dead', 'เรือตก'] },
  'NT-21': { c: ['dead', 'ถูกยิงตก'] },
  'NT-24': { c: ['gone', 'อยู่ต่างทวีป'] },
  'NT-25': { b: ['gone', 'ออกไปรบ'] },
  'NT-27': { c: ['dead', 'ถูกฆ่ากลางพิธี'] },
  'NT-30': { c: ['dead', 'ถูกลอบฆ่า'] },
  'NT-34': { b: ['dead', 'ตายบนแท่นป้อน'] },
  'NT-37': { c: ['dead', 'ตกเหว'] },
  'NT-38': { c: ['dead', 'ถูกลอบฆ่า'] },
  'NT-41': { c: ['gone', 'เดินเข้าซาก'] },
  'NT-44': { c: ['gone', 'ไม่กลับลงมา'] },
  'NT-49': { b: ['dead', 'นั่งเฝ้าจนตาย'] },
  'NT-50': { c: ['dead', 'ตายระหว่างปลูก'] },
  'NT-51': { c: ['gone', 'เดินไปหาเสียง'] },
  'NT-52': { c: ['dead', 'ไหม้เป็นเถ้า'] },
  'NT-54': { c: ['gone', 'เดินตามเสียง'] },
};

const ntRows = new WeakMap<object, NpcRow>();

function ntPath(t: NpcTemplate, p: NpcTemplate['paths'][number]): NpcPath {
  const tags = TAGS.filter(([m]) => p.label.includes(m)).map(([, k]) => k);
  const effects: Effect[] = [...p.effects];
  const end = NT_ENDS[t.id]?.[p.key];
  if (end?.[0] === 'dead') effects.push({ k: 'death', cause: end[1] });
  return {
    key: p.key,
    pct: p.weight,
    text: p.label,
    tags,
    needsMc: tags.some((x) => x !== 'leave'),
    repays: false,
    axes: [],
    weights: [],
    cond: null,
    effects,
    events: p.label.match(EVENT_ID_RE) ?? [],
    npcs: [],
  };
}

/** The row of a newcomer slot (the template, the country and the people drawn when it came). */
function newcomerRow(ctx: Ctx, id: string, slot: NpcSlotX): NpcRow | undefined {
  const nt = slot.nt;
  if (!nt) return undefined;
  const hit = ntRows.get(nt);
  if (hit) return hit;
  const idx = npcIndex(ctx);
  const t = idx.templates.get(nt.tpl);
  const country = idx.countries.get(slot.home);
  if (!t || !country) return undefined;
  const paths = t.paths.map((p) => ntPath(t, p));
  const total = paths.reduce((a, p) => a + p.pct, 0);
  const row: NpcRow = {
    id,
    country: slot.home,
    continent: country.continent,
    seq: nt.seq,
    group: 'regular',
    name: t.name,
    raceText: '',
    peopleId: nt.people,
    halfPeopleId: null,
    ageText: '',
    age: null,
    role: t.name,
    unique: t.secret,
    appearPct: 100,
    paths,
    restPct: Math.max(0, 100 - total),
    cuts: [],
    clock: { open: 'age', events: [], window: idx.file.rules.openWindow },
    succession: { tier: 3, leader: false, inherit: idx.file.rules.inherit, refill: 0 },
    refs: [],
    links: [],
    linkEvents: t.links.filter((x) => /^[A-Z]{2,3}-\d{2}$/.test(x)),
    binds: [],
    refBy: [],
    events: [...t.links.filter((x) => /^[A-Z]{2,3}-\d{2}$/.test(x))],
    cls: 3,
    gold: 0,
    clashes: [],
    look: { raceText: '', stage: '', description: '', primary: '#888888', secondary: '#888888', items: [], itemsRaw: '', pose: '', uiRaw: '' },
    src: t.src,
  };
  ntRows.set(nt, row);
  return row;
}

/** The row of a position: a roster row, or the row of a newcomer made from its template. */
export function rowOf(ctx: Ctx, id: string): NpcRow | undefined {
  const idx = npcIndex(ctx);
  const r = idx.rows.get(id);
  if (r) return r;
  const slot = (ctx.state.npcs.slots as Record<string, NpcSlotX>)[id];
  return slot ? newcomerRow(ctx, id, slot) : undefined;
}
