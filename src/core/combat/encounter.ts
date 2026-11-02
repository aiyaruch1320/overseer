// Fights that come on their own (docs/systems/combat/04-encounters.md): the chance each season, which enemy, a raid on the village,
// the mass battle of a war. The fights of the story rows and of the NPCs do not come from here.
import { idx } from '../character';
import type { Ctx } from '../game';
import { write } from '../log';
import { apply } from '../rules';
import type { LifeState } from '../types';
import { indexOf } from './data';
import { resolve } from './fight';
import { admit, capOf, launch } from './launch';
import { buildHero, maxHpOf } from './hero';
import { foeOf } from './foe';
import { extOf, lifeOf } from './state';
import { warOn } from './warflag';
import {
  ADULT_FIGHT_AGE, CHILD_MAX_DC, DANGER_BY_CONTINENT, EVENT_ACTIVE_YEARS, FIGHT_AGE, HUNTER_JOBS, NIGHT_SHARE, PICK, RAID, RAID_SHARE, RAIDERS,
  SLOW_MUL, SOLDIER_JOBS, STREAM, URBAN_JOBS, URBAN_MUL, WANTED, WEALTH_SAFE, WORLD_MUL_CAP,
} from './tuning';
import type { FightOpts } from './types';
import type { Enemy } from '../data/types-combat';

const mod = (v: number) => Math.floor((v - 10) / 2);

/** The danger of a country, 1 to 5 (assumption: countries.json has none, see tuning DANGER_BY_CONTINENT). */
export function dangerOf(ctx: Ctx, country: string): number {
  const base = DANGER_BY_CONTINENT[country.slice(0, 2)] ?? 3;
  const w = idx(ctx).countries.get(country)?.w ?? 3;
  return Math.max(1, Math.min(5, base + (w >= WEALTH_SAFE ? -1 : w <= 1 ? 1 : 0)));
}

const recent = (ctx: Ctx, event: string): boolean => {
  const y = ctx.state.world.happened[event];
  return y !== undefined && ctx.state.clock.worldYear - y <= EVENT_ACTIVE_YEARS;
};

/** Which rows of the world table (04 §3) are in force where the hero lives. */
function activeRows(ctx: Ctx, life: LifeState) {
  const flags = ctx.state.world.countryFlags[life.country] ?? [];
  const here = (e: Enemy) => (e.countries.length ? e.countries.includes(life.country) : e.continents.length ? e.continents.includes(life.country.slice(0, 2)) : true);
  const ix = indexOf(ctx);
  return ix.flagRows.filter((r) => {
    const on = r.flags.some((f) => flags.includes(f)) || r.events.some((ev) => recent(ctx, ev));
    if (!on) return false;
    // an event row binds only where the enemies it brings can be (the fog of FG-01 only in Nebulia)
    if (!r.flags.some((f) => flags.includes(f)) && r.enemies.length) return r.enemies.some((id) => ix.enemies.get(id) && here(ix.enemies.get(id)!));
    return true;
  });
}

/** The chance of a fight this season (04 §1). */
export function chanceOf(ctx: Ctx, life: LifeState): number {
  const ix = indexOf(ctx);
  const enc = ix.combat.encounters;
  if (life.hAge < FIGHT_AGE) return 0;
  let p = enc.base * dangerOf(ctx, life.country) * (1 - life.stats.luk * enc.luckFactor);
  const hero = buildHero(ctx, life);
  if (hero.tags.has('monster_ward') || hero.tags.has('smell')) p *= enc.tagMults.monsterWard;
  if (hero.tags.has('monster_lure')) p *= enc.tagMults.monsterLure;
  if (life.hAge < ADULT_FIGHT_AGE) p *= enc.tagMults.child;
  const job = life.job;
  if (job) {
    const m = ix.jobMul.get(job);
    if (m) p *= m;
    if (idx(ctx).jobs.get(job)?.slow) p *= SLOW_MUL;
    if (URBAN_JOBS.has(job)) p *= URBAN_MUL;
  }
  let world = 1;
  for (const r of activeRows(ctx, life)) world *= r.mult;
  // the golden age and the festival (×0.6) are rows of the same table (04 §3)
  return Math.max(0, p * Math.min(WORLD_MUL_CAP, world));
}

const WHERE_AFTER = /หลัง\s+([A-Z]{2,3}-\d{2})/;
const WHERE_EVENT = /\(([A-Z]{2,3}-\d{2})\)/g;

/** Enemies of the random draw at this place, with their weights. */
export function poolAt(ctx: Ctx, life: LifeState): { enemy: Enemy; w: number }[] {
  const ix = indexOf(ctx);
  const hero = buildHero(ctx, life);
  const rows = activeRows(ctx, life);
  const flagged = new Set(rows.flatMap((r) => r.enemies));
  const slow = !!life.job && !!idx(ctx).jobs.get(life.job)?.slow;
  const soldier = !!life.job && ix.jobMul.get(life.job) === 1.6;
  const adventurer = !!life.job && ix.jobMul.get(life.job) === 1.8;
  const trader = !!life.job && ix.jobMul.get(life.job) === 1.3;
  const priest = !!life.job && ix.jobMul.get(life.job) === 1.2;
  const out: { enemy: Enemy; w: number }[] = [];
  for (const e of ix.list) {
    if (e.group === 'npc_named' || e.group === 'boss') continue;
    if (life.hAge < ADULT_FIGHT_AGE && e.dc > CHILD_MAX_DC) continue;
    if ((e.tier === 'บอส' || e.tier === 'ตำนาน') && life.hAge < 18) continue;
    const at = e.countries.length ? e.countries.includes(life.country) : e.continents.length ? e.continents.includes(life.country.slice(0, 2)) : true;
    if (!at) continue;
    const after = WHERE_AFTER.exec(e.where);
    if (after && !recent(ctx, after[1])) continue;
    if (slow && !RAIDERS.has(e.id)) continue;
    let w = e.dc > PICK.highDc ? PICK.highMul : e.dc <= PICK.lowDc ? PICK.lowMul : 1;
    if (e.tier === 'บอส' || e.tier === 'ตำนาน') w *= PICK.boss;
    if (flagged.has(e.id)) w *= PICK.flagMul;
    const linked = [...e.where.matchAll(WHERE_EVENT)].map((m) => m[1]);
    if (linked.length) w *= linked.some((ev) => recent(ctx, ev)) ? PICK.eventLinked : 0.5;
    if (soldier && e.group === 'npc_generic') w *= PICK.jobMul;
    if (adventurer && e.group !== 'npc_generic') w *= PICK.jobMul;
    if (trader && (e.id === 'npc_bandit' || e.id === 'bandits' || e.id === 'npc_smuggler')) w *= PICK.flagMul;
    if (priest && e.kinds.some((k) => k === 'undead' || k === 'spirit')) w *= PICK.jobMul;
    if (hero.tags.has('beast_friend') && e.kinds.includes('beast')) w *= 0.7;
    out.push({ enemy: e, w });
  }
  return out;
}

/** The draw: an enemy for this hero at this place and time, or undefined when none fits. */
export function pickEnemy(ctx: Ctx, life: LifeState): Enemy | undefined {
  const pool = poolAt(ctx, life);
  const rng = ctx.rng(STREAM.encounter);
  const i = rng.weighted(pool.map((p) => p.w));
  return i < 0 ? undefined : pool[i].enemy;
}

/** What the place does to the fight (01-core.md §4, 02-type-matrix.md §7). */
function envOf(ctx: Ctx, life: LifeState, road: boolean): string[] {
  const env: string[] = [];
  if (road && ctx.rng(STREAM.encounter).chance(NIGHT_SHARE)) env.push('night');
  if (life.country.startsWith('NB') && recent(ctx, 'FG-01')) env.push('dense_fog');
  if (recent(ctx, 'DR-04')) env.push('ash_winter');
  return env;
}

/** One season of the random draw. Returns true when a fight came. */
export function rollEncounter(ctx: Ctx): boolean {
  const life = lifeOf(ctx);
  if (!life) return false;
  const rng = ctx.rng(STREAM.encounter);
  // a price on the head brings a hunter (04 §6): 20% a year, a season is a quarter of it
  if (life.curses.includes(WANTED.curse) && life.hAge >= FIGHT_AGE && rng.chance(1 - Math.pow(1 - WANTED.perYear, 1 / 4))) {
    const fresh = admit(ctx, [WANTED.enemy]);
    if (fresh.length) {
      launch(ctx, fresh, { kind: 'travel', ambush: 'foe', env: envOf(ctx, life, true) }, false);
      return true;
    }
  }
  const p = chanceOf(ctx, life);
  if (!p || !rng.chance(p)) return false;
  const enemy = pickEnemy(ctx, life);
  if (!enemy) return false;
  const ext = extOf(life);
  const boss = enemy.tier === 'บอส' || enemy.tier === 'ตำนาน';
  if (boss) {
    if (ext.bossYear.age !== life.hAge) ext.bossYear = { age: life.hAge, n: 0 };
    if (ext.bossYear.n >= indexOf(ctx).combat.encounters.bossPerYear) return false;
  }
  const fresh = admit(ctx, [enemy.id]);
  if (!fresh.length) return false;
  if (boss) ext.bossYear.n++;
  const slow = !!life.job && !!idx(ctx).jobs.get(life.job)?.slow;
  const raid = RAIDERS.has(enemy.id) && (slow || rng.chance(RAID_SHARE));
  if (raid) {
    raidAt(ctx, enemy.id);
    return true;
  }
  const hunt = !!life.job && HUNTER_JOBS.has(life.job) && enemy.group !== 'npc_generic';
  const opts: FightOpts = { kind: hunt ? 'hunt' : 'travel', env: envOf(ctx, life, true) };
  // a fight on the road is a general fight: it is written in the log and calls no one (07-attention.md §2 "ศึกทั่วไปลงบันทึกอย่างเดียว"), a boss of the road included
  launch(ctx, fresh, opts, false);
  return true;
}

// ---------- the raid on the village (04 §5) ----------

/** The three phases: warning, defence, aftermath. The town's people fight beside the hero; a warning that passes lowers the foe's DC. */
export function raidAt(ctx: Ctx, enemyId: string): 'saved' | 'cost' | 'lost' | 'fled' | 'dead' | 'skip' {
  const life = lifeOf(ctx);
  const foe = foeOf(ctx, [enemyId]);
  if (!life || !foe) return 'skip';
  const hero = buildHero(ctx, life);
  const rng = ctx.rng(STREAM.fight);
  const warned = rng.int(1, 20) + Math.max(mod(life.stats.int), mod(life.stats.spd)) + (hero.companion.danger ? 2 : 0) >= 12;
  const lead = hero.apt('leadership') > 0;
  const opts: FightOpts = { kind: 'raid', protect: true, allies: RAID.allies + (lead ? 1 : 0), dcMod: warned ? RAID.warned : 0, env: envOf(ctx, life, false) };
  const r = resolve(ctx, foe, opts);
  const max = maxHpOf(ctx, life);
  let how: 'saved' | 'cost' | 'lost' | 'fled' | 'dead' | 'skip';
  if (r.result === 'dead') how = 'dead';
  else if (r.result === 'flawless' || (r.killed && r.hpLost < max * 0.25)) how = 'saved';
  else if (r.killed || r.result === 'talk' || r.result === 'tame') how = 'cost';
  else if (r.result === 'flee') how = 'fled';
  else how = 'lost';
  if (how === 'saved') apply(ctx, [{ k: 'stat', stat: 'fame', delta: RAID.fameAll }], { sys: 'combat', id: enemyId, stream: STREAM.loot });
  if (how === 'cost') apply(ctx, [{ k: 'stat', stat: 'fame', delta: RAID.fameLoss }], { sys: 'combat', id: enemyId, stream: STREAM.loot });
  if ((how === 'lost') && life.hAge < RAID.orphanAge) apply(ctx, [{ k: 'grant', kind: 'curse', id: 'nc_war_orphan' }], { sys: 'combat', id: enemyId, stream: STREAM.loot });
  if (how === 'fled' && ctx.rng(STREAM.loot).chance(RAID.infamy)) apply(ctx, [{ k: 'grant', kind: 'curse', id: 'c_infamous' }], { sys: 'combat', id: enemyId, stream: STREAM.loot });
  write(ctx.state, { sys: 'combat', kind: 'raid', id: enemyId, data: { how, warned, result: r.word, country: life.country }, level: 2 });
  return how;
}

// ---------- the mass battle of a war (04 §7) ----------
// The battle itself is in war.ts (the war, its foes, the rank and the pay); this file keeps the test of who is a soldier at war.
export { warBattle } from './war';

/** True when the hero is a soldier of a country at war. */
export function atWar(ctx: Ctx, life: LifeState): boolean {
  return !!life.job && SOLDIER_JOBS.has(life.job) && warOn(ctx, life.country) && life.job !== 'adventurer';
}

export { capOf };
