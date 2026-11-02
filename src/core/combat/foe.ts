// The enemy of a fight: one or more ids of enemies.json merged into one foe (01-core.md §2 "ฝูง", §4 "DC ของศัตรู").
import type { Ctx } from '../game';
import type { Enemy, Reaction } from '../data/types-combat';
import { NAMED_TIERS } from '../attention/tuning';
import { indexOf } from './data';
import { GROUP, THINKING } from './tuning';
import type { Foe } from './types';

const NPC_ID = /^[A-Z]{2}\d{2}-\d+$/;

/** An enemy that counts as named for the call before a fight (07-attention.md §2): the same rule the attention system used for the story's battles. */
export const isNamedEnemy = (e: Enemy): boolean => NAMED_TIERS.has(e.tier) || NPC_ID.test(e.id);

const sameTag = (a: Reaction, b: Reaction) => a.tag === b.tag;

/** The foe a list of enemy ids makes; undefined when none of the ids is in enemies.json. */
export function foeOf(ctx: Ctx, ids: readonly string[]): Foe | undefined {
  const ix = indexOf(ctx);
  const rows = ids.map((id) => ix.enemies.get(id)).filter((e): e is Enemy => !!e);
  if (!rows.length) return undefined;
  const lead = rows.reduce((a, b) => (b.dc > a.dc ? b : a), rows[0]);
  const info = ix.tiers.get(lead.tier) ?? ix.tiers.get('ปกติ')!;
  const woundsOf = (e: Enemy) => e.wounds ?? (ix.tiers.get(e.tier) ?? info).wounds;
  const n = rows.length;
  const wounds = Math.min(GROUP.maxWounds, rows.reduce((s, e) => s + woundsOf(e), 0));
  const kinds = new Set<string>();
  const traits = new Set<string>();
  for (const e of rows) {
    for (const k of e.kinds) (ix.kinds.has(k) ? kinds : traits).add(k);
    for (const t of e.traits) traits.add(t);
  }
  const weak: Reaction[] = [];
  for (const e of rows) for (const r of e.weak) if (!weak.some((x) => sameTag(x, r))) weak.push(r);
  // a group resists only what every one of them resists
  const resist = n === 1 ? [...lead.resist] : lead.resist.filter((r) => rows.every((e) => e.resist.some((x) => sameTag(x, r))));
  const attack = new Set<string>();
  for (const e of rows) for (const a of (e.attack ?? '').split(/\s+/)) if (a && a !== '—') attack.add(a);
  const npc = rows.find((e) => NPC_ID.test(e.id))?.id;
  const talkText = lead.negotiable ?? '';
  const thinks = [...kinds].some((k) => THINKING.includes(k));
  return {
    ids: rows.map((e) => e.id),
    name: rows.map((e) => e.name).join(' · '),
    tier: lead.tier,
    tierId: info.id,
    rewardRow: info.rewardRow,
    wounds,
    maxBeats: info.maxBeats + (n - 1),
    dc: lead.dc + Math.min(GROUP.dcCap, Math.floor((n * GROUP.dcPerTwo) / 2)),
    kinds: [...kinds],
    traits: [...traits],
    weak,
    resist,
    negotiate: lead.negotiate.map((x) => ({ mark: x.mark })),
    attack: [...attack],
    named: rows.some(isNamedEnemy),
    ...(npc ? { npc } : {}),
    lead: lead.id,
    mindless: !thinks && !lead.negotiate.length,
    hardTalk: talkText.startsWith('ยาก'),
    noTalk: talkText.startsWith('ไม่ได้') || (!thinks && !lead.negotiate.length),
  };
}

/**
 * One of the fifteen dragons (06-dragon-encounters.md §3): legend tier, 8 wounds, DC 27 to 30, and the story armour that lets a blow
 * count only when the caller says the armour is broken (`opts.armour.broken`).
 */
export function dragonFoe(ctx: Ctx, name: string, dc: number): Foe {
  const ix = indexOf(ctx);
  const info = ix.tiers.get('ตำนาน')!;
  return {
    ids: [`dragon:${name}`],
    name,
    tier: 'ตำนาน',
    tierId: info.id,
    rewardRow: info.rewardRow,
    wounds: info.wounds,
    maxBeats: info.maxBeats,
    dc,
    kinds: ['dragon'],
    traits: [],
    weak: [],
    resist: [],
    negotiate: [{ mark: '▼' }],
    attack: ['fire'],
    named: true,
    lead: `dragon:${name}`,
    mindless: false,
    hardTalk: true,
    noTalk: false,
    armour: true,
  };
}

/**
 * A battle row that names several enemies (storylines/README.md §8): two stand together ("ฝูง + คู่แข่ง"); a longer list is the enemies of the
 * places the way can lead to ("ตามสถานที่ (`rune_guardian` `mimic` `golem`)"), so one is fought: the one that belongs where the hero is, else one drawn.
 */
export function chooseEnemies(ctx: Ctx, ids: readonly string[]): string[] {
  if (ids.length <= GROUP.together) return [...ids];
  const life = ctx.state.life;
  const ix = indexOf(ctx);
  const rows = ids.map((id) => ix.enemies.get(id)).filter((e): e is Enemy => !!e);
  if (!rows.length) return [];
  const here = life ? rows.filter((e) => e.countries.includes(life.country) || e.continents.includes(life.country.slice(0, 2))) : [];
  const pool = here.length ? here : rows;
  return [ctx.rng('life.combat.pick').pick(pool).id];
}
