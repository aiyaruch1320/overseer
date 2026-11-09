// The collection (docs/systems/experience/03-ending-and-collection.md §5, §6): what the lives of the player have found, kept across lives and worlds.
// An entry is an id `<category>:<id>`; `state.lineage.collection` holds the ids. A view shows the ratio found/total by category; an entry not found is
// a shadow (no name, no way to earn it). Nothing here draws a random number.
import { storyFacts } from '../types';
import type { Ctx, GameData } from '../game';
import { extOf as characterExt } from '../character';
import { knownName } from '../text/labels';
import type { GameState, LifeState, LogEntry } from '../types';
import { lx } from '../lineage/state';
import { NO_VOW, lifeGoals, peekGoals } from '../god/goals';
import { lifeLog } from './facts';

export interface Category {
  id: string;
  name: string;
  /** Where the total comes from in the docs. */
  src: string;
}

export const CATEGORIES: Category[] = [
  { id: 'node', name: 'เส้นเรื่อง (โหนดที่เคยผ่าน)', src: 'lore/storylines/README.md' },
  { id: 'convergence', name: 'จุดบรรจบ', src: 'lore/storylines/00-convergence.md' },
  { id: 'job', name: 'อาชีพลับ', src: 'systems/character/10-jobs-secret.md' },
  { id: 'companion', name: 'สัตว์คู่หู', src: 'systems/character/15-companion-species.md' },
  { id: 'talisman', name: 'เครื่องรางโบราณ', src: 'systems/items/14-talismans.md' },
  { id: 'legend', name: 'อาวุธระดับตำนาน', src: 'systems/items/08-legendary.md' },
  { id: 'event', name: 'เหตุการณ์ใหญ่ที่เคยเห็น', src: 'systems/events/world-events.md' },
  { id: 'ending', name: 'ปลายทางของเส้นเรื่อง', src: 'lore/storylines/README.md' },
  { id: 'mode', name: 'แบบเริ่มต้น', src: 'systems/experience/04-start-modes.md' },
];

/**
 * The categories the goals added (god/08-goals.md §7). The goals keep what was found in `meta` of the lineage (it goes from world to world with the carry), so the entries
 * are read from there and the totals from the data of the god, not stored a second time in `lineage.collection`.
 */
export const GOALS_CATEGORIES: Category[] = [
  { id: 'vow', name: 'คำปฏิญาณที่สำเร็จ', src: 'systems/god/08-goals.md' },
  { id: 'title', name: 'ฉายาชีวิต', src: 'systems/god/08-goals.md' },
  { id: 'godtitle', name: 'ฉายาของพระเจ้า', src: 'systems/god/01-power.md' },
  { id: 'miracle', name: 'ปาฏิหาริย์ในรายการที่เคยใช้', src: 'systems/god/04-miracles.md' },
  { id: 'conjure', name: 'ปาฏิหาริย์ที่เสกตามใจ (ชื่อที่โลกจำ)', src: 'systems/god/07-conjure.md' },
  { id: 'reaction', name: 'ปฏิกิริยาของการเสกตามใจที่เคยพบ', src: 'systems/god/07-conjure.md' },
];

interface GodDataShape {
  goals?: { vows?: { id: string; name: string }[]; titles?: { title: string }[] };
  epithets?: { title: string }[];
  miracles?: { list?: { id: string; name: string }[] };
  conjure?: { reactions?: unknown[] };
}

/** The total and the names of the categories of the goals, from the data of the god. A category with no end (the names the god conjured) has total 0. */
function goalsCatalog(data: GameData): Record<string, { total: number; names: Map<string, string> }> {
  const g = data.god?.items as GodDataShape | undefined;
  const vows = (g?.goals?.vows ?? []).filter((v) => v.id !== NO_VOW);
  return {
    vow: { total: vows.length, names: new Map(vows.map((v) => [v.id, v.name])) },
    title: { total: g?.goals?.titles?.length ?? 0, names: new Map((g?.goals?.titles ?? []).map((t) => [t.title, t.title])) },
    godtitle: { total: g?.epithets?.length ?? 0, names: new Map((g?.epithets ?? []).map((t) => [t.title, t.title])) },
    miracle: { total: g?.miracles?.list?.length ?? 0, names: new Map((g?.miracles?.list ?? []).map((m) => [m.id, m.name])) },
    conjure: { total: 0, names: new Map() },
    reaction: { total: g?.conjure?.reactions?.length ?? 0, names: new Map() },
  };
}

/** The twelve start modes (04-start-modes.md) with the rule that opens them: assumption, the doc says only "บางแบบเปิดตั้งแต่ครั้งแรก บางแบบปลดล็อก". */
export const MODES: { id: string; name: string; open: 'start' | 'afterFirstLife' | 'lineage' }[] = [
  { id: 'summoned', name: 'ถูกอัญเชิญ', open: 'start' },
  { id: 'reincarnated', name: 'ผู้จำชาติก่อน', open: 'afterFirstLife' },
  { id: 'slime', name: 'เกิดเป็นสไลม์', open: 'start' },
  { id: 'soulmachine', name: 'หุ่นที่ตื่น', open: 'afterFirstLife' },
  { id: 'demonkin', name: 'จอมมารมือใหม่', open: 'start' },
  { id: 'ghoul', name: 'ผู้ถูกกักด้วยความหิว', open: 'afterFirstLife' },
  { id: 'elf', name: 'ผู้อยู่ยืนกว่าคนที่รัก', open: 'start' },
  { id: 'orc', name: 'นักสู้ที่ถูกขาย', open: 'start' },
  { id: 'dragonkin', name: 'ผู้ขี่มังกร', open: 'start' },
  { id: 'halfblood', name: 'สองฝั่งน้ำ', open: 'start' },
  { id: 'plain', name: 'ชีวิตเรียบ', open: 'start' },
  { id: 'heir', name: 'ผู้สืบตระกูล', open: 'lineage' },
];

const MODE_OF_RACE: Record<string, string> = { slime: 'slime', soulmachine: 'soulmachine', demonkin: 'demonkin', ghoul: 'ghoul', elf: 'elf', orc: 'orc', dragonkin: 'dragonkin' };

/** The start mode a life began with. `heir` is set by the lineage (the life is not a first one). */
export function modeOf(state: GameState, life: LifeState): string {
  const special = life.ext.character?.special;
  if (special === 'summoned' || special === 'reincarnated') return special;
  const rec = lx(state).recs.find((r) => r.id === life.id);
  if (rec && rec.origin !== 'first') return 'heir';
  if (life.flags.includes('half')) return 'halfblood';
  return MODE_OF_RACE[life.race] ?? 'plain';
}

interface Totals {
  [category: string]: string[];
}

const cache = new WeakMap<object, Totals>();

/** Every id of each category, from the loaded data (the total of the ratio). */
export function catalog(data: GameData): Totals {
  const hit = cache.get(data);
  if (hit) return hit;
  const t: Totals = { node: [], convergence: [], job: [], companion: [], talisman: [], legend: [], event: [], ending: [], mode: MODES.map((m) => m.id) };
  const sl = data.storylines?.items as { nodes: { id: string; kind: string; line: string }[]; endings: { title: string }[] } | undefined;
  for (const n of sl?.nodes ?? []) if (n.kind !== 'fallback' && n.line !== 'cv') t.node.push(n.id);
  // the endings of the table of each race file, and the ones a node grants itself (`ปลายทาง "…"` in a cell)
  const titles = new Set((sl?.endings ?? []).map((e) => e.title));
  const scan = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(scan);
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (r.k === 'ending' && typeof r.title === 'string') titles.add(r.title);
      for (const v of Object.values(r)) scan(v);
    }
  };
  scan((data.storylines?.items as { nodes?: unknown } | undefined)?.nodes);
  t.ending = [...titles].sort();
  const cv = data.convergence?.items as { points: { id: string }[] } | undefined;
  t.convergence = (cv?.points ?? []).map((p) => p.id);
  const jobs = data.jobs?.items as { jobs: { id: string; kind: string }[] } | undefined;
  t.job = (jobs?.jobs ?? []).filter((j) => j.kind === 'secret').map((j) => j.id);
  const comp = data.companions?.items as { species: { id: string }[] } | undefined;
  t.companion = (comp?.species ?? []).map((s) => s.id);
  const items = data.items?.items as { items: { id: string; cat: string }[] } | undefined;
  t.talisman = (items?.items ?? []).filter((i) => i.cat === 'talisman').map((i) => i.id);
  const weapons = data.weapons?.items as { items: { id: string; rarity: string }[] } | undefined;
  t.legend = (weapons?.items ?? []).filter((w) => w.rarity === 'L').map((w) => w.id);
  const we = data['world-events']?.items as { events: { id: string; mark?: string }[] } | undefined;
  t.event = (we?.events ?? []).filter((e) => e.mark).map((e) => e.id);
  cache.set(data, t);
  return t;
}

const key = (cat: string, id: string) => `${cat}:${id}`;

/** The entries a life (dead or alive) holds. The nodes the book set as passed are not the life's own. */
export function lifeEntries(ctx: Ctx, life: LifeState, log: LogEntry[] = lifeLog(ctx)): string[] {
  const cat = catalog(ctx.data);
  const out = new Set<string>();
  const preset = new Set(lx(ctx.state).preset);
  const ok = (c: string, id: string) => cat[c].length === 0 || cat[c].includes(id);
  for (const id of Object.keys(life.passed)) {
    if (preset.has(id) && life.id === ctx.state.life?.id) continue;
    if (id.startsWith('cv.')) {
      if (ok('convergence', id)) out.add(key('convergence', id));
    } else if (ok('node', id)) out.add(key('node', id));
  }
  for (const e of log) {
    if (e.sys === 'character' && e.kind === 'job' && e.data.type === 'secret' && e.id && ok('job', e.id)) out.add(key('job', e.id));
    if (e.sys === 'items' && e.kind === 'legend' && e.id && ok('legend', e.id)) out.add(key('legend', e.id));
    if (e.sys === 'world' && e.kind === 'event' && e.id && e.worldYear >= life.birthYear && ok('event', e.id)) out.add(key('event', e.id));
  }
  for (const id of life.items) if (id.startsWith('tm_') && cat.talisman.includes(id)) out.add(key('talisman', id));
  const comps = (life.ext.character ? characterExt(life) : undefined) as { companions?: string[] } | undefined;
  for (const id of comps?.companions ?? []) if (ok('companion', id)) out.add(key('companion', id));
  const ending = storyFacts(life)?.ended;
  if (ending && ok('ending', ending)) out.add(key('ending', ending));
  out.add(key('mode', modeOf(ctx.state, life)));
  // the titles of the life and the vow it kept are found in this life too (the page of the collection counts them): the card counts what the page counts (R7). They are listed
  // here so `keep` tells which are new; the page itself reads them from the goals (`GOALS_CATEGORIES`)
  const goals = lifeGoals(life).result;
  for (const t of goals?.titles ?? []) out.add(key('title', t));
  if (goals?.result === 'kept' && goals.vow && goals.vow !== NO_VOW) out.add(key('vow', goals.vow));
  return [...out].sort();
}

/** Adds entries to the collection of the save; returns the ones that were new. */
export function keep(state: GameState, entries: string[]): string[] {
  const have = new Set(state.lineage.collection);
  const fresh = entries.filter((e) => !have.has(e));
  for (const e of fresh) state.lineage.collection.push(e);
  return fresh;
}

export interface CategoryView {
  id: string;
  name: string;
  have: number;
  total: number;
  /** The entries found, with names; the ones not found are not listed (they are shadows). */
  found: { id: string; name: string }[];
  /** A category with no end: the names the god conjured (the ratio has no total). */
  unlimited?: boolean;
}

export interface CollectionView {
  categories: CategoryView[];
  have: number;
  total: number;
  modes: { id: string; name: string; open: boolean; used: boolean }[];
}

/** The name of an entry for the page of the collection. */
export function entryName(data: GameData, entry: string): string {
  const [cat, ...rest] = entry.split(':');
  const id = rest.join(':');
  if (cat === 'ending') return id;
  if (cat === 'mode') return MODES.find((m) => m.id === id)?.name ?? id;
  if (cat === 'companion') return (data.companions?.items as { species: { id: string; name: string }[] } | undefined)?.species.find((s) => s.id === id)?.name ?? '';
  if (cat === 'talisman') return (data.items?.items as { items: { id: string; name: string }[] } | undefined)?.items.find((s) => s.id === id)?.name ?? '';
  if (cat === 'legend') return (data.weapons?.items as { items: { id: string; name: string }[] } | undefined)?.items.find((s) => s.id === id)?.name ?? '';
  return knownName(data, id) ?? '';
}

/** The page of the collection as data: ratios by category, the names of what was found, the start modes and which of them are open. */
export function collectionView(state: GameState, data: GameData): CollectionView {
  const cat = catalog(data);
  const have = new Set(state.lineage.collection);
  const categories: CategoryView[] = CATEGORIES.map((c) => {
    const found = [...have].filter((e) => e.startsWith(`${c.id}:`));
    return { id: c.id, name: c.name, have: found.length, total: cat[c.id].length, found: found.map((e) => ({ id: e.slice(c.id.length + 1), name: entryName(data, e) })) };
  });
  // the categories of the goals: what the goals kept, with the totals of the data of the god
  const meta = peekGoals(state).meta;
  const gc = goalsCatalog(data);
  const foundOf: Record<string, string[]> = { vow: meta.vowsKept, title: meta.titlesSeen, godtitle: meta.godTitles, miracle: meta.miraclesUsed, conjure: meta.conjured.map((c) => c.name), reaction: meta.reactionsSeen };
  for (const c of GOALS_CATEGORIES) {
    const ids = [...new Set(foundOf[c.id])];
    categories.push({ id: c.id, name: c.name, have: ids.length, total: gc[c.id].total, found: ids.map((id) => ({ id, name: gc[c.id].names.get(id) ?? id })), ...(c.id === 'conjure' ? { unlimited: true } : {}) });
  }
  const lives = state.lineage.lives.length;
  const modes = MODES.map((m) => ({
    id: m.id,
    name: m.name,
    open: m.open === 'start' || (m.open === 'afterFirstLife' && lives > 0) || (m.open === 'lineage' && lives > 0) || have.has(key('mode', m.id)),
    used: have.has(key('mode', m.id)),
  }));
  const counted = categories.filter((c) => !c.unlimited);
  return { categories, have: counted.reduce((n, c) => n + c.have, 0), total: counted.reduce((n, c) => n + c.total, 0), modes };
}
