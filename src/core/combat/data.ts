// Typed, indexed access to the generated combat data (data/gen/{combat,enemies,clashes,weapons,companions}.json).
// Indexes are built once per loaded data object. Files that a test did not load are empty, not an error, except combat.json and enemies.json.
import type { Ctx } from '../game';
import type { Clash, ClashesData, CombatData, Enemy, EnemiesData, Stance } from '../data/types-combat';
import { EXTRA_TIERS, TIER_ID } from './tuning';

export interface WeaponLite {
  id: string;
  rarity: string;
  power: number;
  apt: string;
  tags: string[];
  group: string;
}

export interface SpeciesLite {
  id: string;
  tier: string;
  abilities: { id: string; level: number }[];
}

export interface FlagRow {
  /** Country flags (`war`) and world events (`DR-01`) the row names. */
  flags: string[];
  events: string[];
  mult: number;
  enemies: string[];
}

export interface TierInfo {
  id: string;
  wounds: number;
  maxBeats: number;
  /** The row of the reward table (grunt normal chief boss legend). */
  rewardRow: string;
}

export interface Index {
  combat: CombatData;
  enemies: Map<string, Enemy>;
  list: Enemy[];
  stances: Map<string, Stance>;
  tiers: Map<string, TierInfo>;
  rewardRows: Map<string, { material: number; weapon: number; blessing: number; curse: number; skill: number }>;
  giftsByKind: Map<string, { blessings: string[]; curses: string[] }>;
  flagRows: FlagRow[];
  clashById: Map<string, Clash>;
  clashByNpc: Map<string, Clash>;
  clashes?: ClashesData;
  weapons: Map<string, WeaponLite>;
  weaponPool: WeaponLite[];
  species: Map<string, SpeciesLite>;
  /** Species ids by the enemy they could come from: `sp_<enemy>` or `sp_<enemy>_pup`. */
  speciesByEnemy: Map<string, SpeciesLite>;
  /** Jobs that frequency multipliers of 04-encounters §4 name, job id → multiplier and which enemies it favours. */
  jobMul: Map<string, number>;
  /** Names of the kinds in the weakness matrix → their rows. */
  kinds: Set<string>;
}

const cache = new WeakMap<object, Index>();

function itemsOf<T>(ctx: Ctx, name: string): T | undefined {
  return ctx.data[name]?.items as T | undefined;
}

const ticks = /`([A-Za-z_]+)`/g;
const eventIds = /\b([A-Z]{2,3}-\d{2})\b/g;

function parseFlagRow(r: CombatData['encounters']['worldFlags'][number]): FlagRow {
  const flags = [...r.flag.matchAll(ticks)].map((m) => m[1]);
  const events = [...r.flag.matchAll(eventIds)].map((m) => m[1]);
  return { flags, events, mult: r.mult, enemies: r.enemies };
}

export function indexOf(ctx: Ctx): Index {
  const probe = ctx.data.combat ?? ctx.data.enemies;
  if (!probe) throw new Error('data/gen/combat.json is not loaded');
  const hit = cache.get(ctx.data);
  if (hit) return hit;
  const combat = itemsOf<CombatData>(ctx, 'combat');
  if (!combat) throw new Error('data/gen/combat.json is not loaded');
  const enemyData = itemsOf<EnemiesData>(ctx, 'enemies');
  const list = enemyData?.items ?? [];
  const enemies = new Map(list.map((e) => [e.id, e]));
  const stances = new Map(combat.stances.map((s) => [s.id, s]));

  const tiers = new Map<string, TierInfo>();
  for (const t of combat.tiers) tiers.set(t.tier, { id: t.id, wounds: t.wounds[0], maxBeats: t.maxBeats, rewardRow: t.id });
  for (const [name, x] of Object.entries(EXTRA_TIERS)) if (!tiers.has(name)) tiers.set(name, { id: x.id, wounds: x.wounds, maxBeats: x.maxBeats, rewardRow: x.rewardRow });

  const rewardRows = new Map<string, { material: number; weapon: number; blessing: number; curse: number; skill: number }>();
  for (const r of combat.rewards.byTier) {
    const id = TIER_ID[r.tier];
    if (id) rewardRows.set(id, r);
  }

  const giftsByKind = new Map<string, { blessings: string[]; curses: string[] }>();
  const KIND_NAMES: Record<string, string[]> = {
    ผู้ตาย: ['undead'],
    วิญญาณ: ['spirit'],
    แวมไพร์: ['vampire'],
    ปีศาจ: ['demon'],
    'มังกรป่า ไวเวิร์น': ['dragon'],
    ยักษ์: ['giant'],
    สัตว์: ['beast'],
    สิ่งประดิษฐ์: ['construct'],
    ภูต: ['fey'],
    พืช: ['plant'],
    สิ่งจากรอยแยก: ['fog'],
    ธาตุ: ['elemental'],
    NPC: ['humanoid'],
  };
  for (const g of combat.rewards.gifts) for (const k of KIND_NAMES[g.kind] ?? []) giftsByKind.set(k, { blessings: g.blessings, curses: g.curses });

  const clashes = itemsOf<ClashesData>(ctx, 'clashes');
  const clashById = new Map<string, Clash>();
  const clashByNpc = new Map<string, Clash>();
  for (const c of clashes?.items ?? []) {
    clashById.set(c.id, c);
    clashByNpc.set(c.npc, c);
  }

  const weaponRows = itemsOf<{ items: WeaponLite[] }>(ctx, 'weapons')?.items ?? [];
  const weapons = new Map<string, WeaponLite>();
  for (const w of weaponRows) weapons.set(w.id, { id: w.id, rarity: w.rarity, power: w.power, apt: w.apt, tags: w.tags.map((t) => t.replace(/^#/, '')), group: w.group });
  const weaponPool = [...weapons.values()];

  const comp = itemsOf<{ species?: { id: string; tier: string; abilities: { id: string; level: number }[] }[] }>(ctx, 'companions');
  const species = new Map<string, SpeciesLite>();
  const speciesByEnemy = new Map<string, SpeciesLite>();
  for (const s of comp?.species ?? []) {
    const lite = { id: s.id, tier: s.tier, abilities: s.abilities };
    species.set(s.id, lite);
    const bare = s.id.replace(/^sp_/, '').replace(/_pup$/, '');
    speciesByEnemy.set(bare, lite);
  }

  const jobMul = new Map<string, number>();
  for (const j of combat.encounters.jobs) for (const id of j.jobs) jobMul.set(id, j.mult);

  const kinds = new Set(combat.matrix.kinds.map((k) => k.id));

  const built: Index = {
    combat,
    enemies,
    list,
    stances,
    tiers,
    rewardRows,
    giftsByKind,
    flagRows: combat.encounters.worldFlags.map(parseFlagRow),
    clashById,
    clashByNpc,
    clashes,
    weapons,
    weaponPool,
    species,
    speciesByEnemy,
    jobMul,
    kinds,
  };
  cache.set(ctx.data, built);
  return built;
}

/** An enemy by id; undefined when the id is not in enemies.json. */
export function enemyOf(ctx: Ctx, id: string): Enemy | undefined {
  return indexOf(ctx).enemies.get(id);
}
