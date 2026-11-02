// The war of a soldier (docs/systems/combat/04-encounters.md §7, M3 review C2): a soldier of a country at war stands in a big battle now and then.
// The battle is one roll by his role (the doc), but it is a battle of a war: the war has a name (the WR event of the world), a foe the soldiers of that war
// meet, a rank the soldier rises through, a share of the spoils the economy pays, and a summary of the campaign every few years, so that the log tells a
// story instead of one sentence 22 times. The plain battles that were held are written at level 0 (developer); the player reads the first battle, a
// battle won outright, a rout, a promotion and the summaries.
import { dataOf, type Ctx } from '../game';
import { payShare } from '../economy';
import { write } from '../log';
import { apply } from '../rules';
import type { WorldEvent, WorldEventsData } from '../data/types-events';
import type { LifeState } from '../types';
import { TUNING as WORLD } from '../world';
import { indexOf } from './data';
import { dieInBattle, rescueOf } from './fight';
import { buildHero, hpOf, maxHpOf } from './hero';
import { admit } from './launch';
import { rollWound } from './reward';
import { foeOf } from './foe';
import { extOf, lifeOf, type WarExt } from './state';
import { warOn } from './warflag';
import {
  CAMPAIGN_YEARS, CAPTURE, FOE_DC_SHIFT, RANKS, RANK_POINTS, RANK_START, STREAM, TIER_ID, WAR_DAMAGE, WAR_DEATH, WAR_DECISIVE, WAR_FOES, WAR_FOES_BY_CONTINENT, WAR_FOE_DEFAULT,
  WAR_PAY, WAR_PAY_BEST,
} from './tuning';

export { warOn };

const mod = (v: number) => Math.floor((v - 10) / 2);

interface Role {
  job: readonly string[];
  apt?: string;
  dc: number;
  stat: 'pow' | 'spd' | 'mag' | 'int' | 'vit';
  alt?: 'vit';
  fame: number;
  name: string;
}
const ROLES: Role[] = [
  { name: 'front', job: ['soldier', 'knight', 'mercenary', 'city_guard', 'royal_guard', 'gladiator'], dc: 13, stat: 'pow', alt: 'vit', fame: 3 },
  { name: 'archer', job: [], apt: 'bow', dc: 13, stat: 'spd', fame: 2 },
  { name: 'mage', job: [], apt: 'fire', dc: 15, stat: 'mag', fame: 4 },
  { name: 'commander', job: ['general', 'commander', 'captain'], apt: 'leadership', dc: 16, stat: 'int', fame: 8 },
  { name: 'medic', job: ['medic', 'field_medic', 'physician', 'healer'], dc: 13, stat: 'int', fame: 2 },
  { name: 'spy', job: [], apt: 'stealth', dc: 15, stat: 'spd', fame: 3 },
];

/** The role a soldier plays: by his job, then by his best aptitude. */
function roleOf(life: LifeState): Role {
  const job = life.job ?? '';
  const byJob = ROLES.find((r) => r.job.includes(job));
  if (byJob && byJob.name !== 'front') return byJob;
  if ((life.aptitudes.leadership ?? 0) >= 2) return ROLES[3];
  if ((life.aptitudes.bow ?? 0) >= 1) return ROLES[1];
  if (['fire', 'lightning', 'ice', 'wind', 'earth', 'light', 'water'].some((a) => (life.aptitudes[a] ?? 0) >= 1)) return ROLES[2];
  if ((life.aptitudes.stealth ?? 0) >= 1 && !byJob) return ROLES[5];
  return byJob ?? ROLES[0];
}

// ---------- which war ----------

/**
 * The war the soldier fights in: the latest WR event that happened in the last `warFlagYears` world years and whose home holds his country
 * (the world system puts the flag of war on the same countries for the same years, world/events.ts `markWar`). '' when the flag came from elsewhere.
 */
export function warEventOf(ctx: Ctx, life: LifeState): string {
  const d = dataOf<WorldEventsData>(ctx, 'world-events');
  const now = ctx.state.clock.worldYear;
  let best = '';
  let at = -Infinity;
  for (const e of d.events as WorldEvent[]) {
    if (e.group !== 'WR') continue;
    const y = ctx.state.world.happened[e.id];
    if (y === undefined || now - y > WORLD.warFlagYears) continue;
    const home = e.home;
    const here = home.countries.includes(life.country) || (home.continents as string[]).includes(life.country.slice(0, 2));
    if (here && y > at) {
      best = e.id;
      at = y;
    }
  }
  return best;
}

/** The foes of a war for a soldier of this country (ids of enemies.json). */
export function warFoes(war: string, country: string): string[] {
  const row = WAR_FOES[war];
  const cont = country.slice(0, 2);
  return row?.[cont] ?? row?.['*'] ?? WAR_FOES_BY_CONTINENT[cont] ?? [WAR_FOE_DEFAULT];
}

function freshWar(id: string, age: number): WarExt {
  return { id, foes: [], since: age, battles: 0, held: 0, won: 0, lost: 0, pay: 0, points: 0, told: { age, battles: 0, held: 0, won: 0, lost: 0, pay: 0 } };
}

// ---------- the summary of a campaign ----------

/** Writes `combat/campaign` (level 1) for what happened since the last one; `end` when the war is over. */
function campaign(ctx: Ctx, life: LifeState, w: WarExt, end: boolean): void {
  const ext = extOf(life);
  const t = w.told;
  const battles = w.battles - t.battles;
  if (battles > 0) {
    let from = t;
    // The player reads one line a campaign: a window whose numbers are those of the last line is not a new line. In the middle of a war it is folded
    // into the next window (nothing is told, the counts stay); at the end the closing line is the whole war from the day the soldier joined.
    const same = (f: typeof t): string => JSON.stringify([w.battles - f.battles, w.held - f.held, w.won - f.won, w.lost - f.lost, w.pay - f.pay, ext.rank, w.foes.join(',')]);
    let total = false;
    if (t.sig !== undefined && same(t) === t.sig) {
      if (!end) return;
      from = { age: w.since, battles: 0, held: 0, won: 0, lost: 0, pay: 0 };
      total = true;
    }
    write(ctx.state, {
      sys: 'combat',
      kind: 'campaign',
      id: w.id || life.country,
      data: {
        war: w.id || null,
        country: life.country,
        end,
        years: life.hAge - from.age,
        since: w.since,
        battles: w.battles - from.battles,
        held: w.held - from.held,
        won: w.won - from.won,
        lost: w.lost - from.lost,
        pay: w.pay - from.pay,
        foes: w.foes.join(','),
        rank: RANKS[ext.rank] ?? RANKS[0],
        rankN: ext.rank,
        totalBattles: w.battles,
        total,
      },
      level: 1,
    });
    w.told = { age: life.hAge, battles: w.battles, held: w.held, won: w.won, lost: w.lost, pay: w.pay, sig: same(from) };
    return;
  }
  w.told = { age: life.hAge, battles: w.battles, held: w.held, won: w.won, lost: w.lost, pay: w.pay, sig: t.sig };
}

/** Called each life year by the combat system: the summary when enough years of war passed, and the closing one when the soldier's war is over. */
export function warYear(ctx: Ctx, atWar: boolean): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const ext = extOf(life);
  const w = ext.war;
  if (!w) return;
  if (!atWar) {
    campaign(ctx, life, w, true);
    ext.war = undefined;
    return;
  }
  if (life.hAge - w.told.age >= CAMPAIGN_YEARS) campaign(ctx, life, w, false);
}

/** The soldier dies or the life ends: the war is told as far as it went. */
export function warEnd(ctx: Ctx): void {
  const life = ctx.state.life;
  if (!life) return;
  const w = extOf(life).war;
  if (w) campaign(ctx, life, w, true);
}

// ---------- one battle ----------

/** The rank after a battle: points toward the next one; returns the new rank when it rose. */
function promote(ctx: Ctx, life: LifeState, w: WarExt, points: number): number | undefined {
  const ext = extOf(life);
  w.points += points;
  const need = RANK_POINTS[ext.rank];
  if (need === undefined || w.points < need) return undefined;
  w.points -= need;
  const from = ext.rank;
  ext.rank += 1;
  write(ctx.state, { sys: 'combat', kind: 'rank', id: w.id || life.country, data: { war: w.id || null, from: RANKS[from], to: RANKS[ext.rank], rankN: ext.rank, country: life.country }, level: 2 });
  return ext.rank;
}

/**
 * A soldier in a war stands in a big battle (04 §7): one roll by his role against the DC of the role and of the foe the war sends; a roll far over wins the
 * battle outright, one over holds the line, one under routs the hero's side (hit points, a wound roll at double curse chance, a chance of prison, a small
 * chance of death at low hit points). The held and the won ones pay a share through the economy and count toward the rank.
 */
export function warBattle(ctx: Ctx): 'held' | 'lost' | 'dead' | 'skip' {
  const life = lifeOf(ctx);
  if (!life) return 'skip';
  const fresh = admit(ctx, [`war.${life.hAge}`]);
  if (!fresh.length) return 'skip';
  const rng = ctx.rng(STREAM.fight);
  const ext = extOf(life);
  const ix = indexOf(ctx);

  // the war, and the foe of this battle
  const id = warEventOf(ctx, life);
  if (ext.war && ext.war.id !== id) {
    campaign(ctx, life, ext.war, true);
    ext.war = undefined;
  }
  const first = !ext.war;
  const w = (ext.war ??= freshWar(id, life.hAge));
  if (first && ext.rank < (RANK_START[life.job ?? ''] ?? 0)) ext.rank = RANK_START[life.job ?? ''];
  const foeId = rng.pick(warFoes(id, life.country));
  if (!w.foes.includes(foeId)) w.foes.push(foeId);
  const foeRow = ix.enemies.get(foeId);
  const tier = foeRow ? TIER_ID[foeRow.tier] ?? 'normal' : 'normal';

  const role = roleOf(life);
  const hero = buildHero(ctx, life);
  const s = role.alt && life.stats[role.alt] > life.stats[role.stat] ? life.stats[role.alt] : life.stats[role.stat];
  const lead = role.apt ? Math.min(3, life.aptitudes[role.apt] ?? 0) : 0;
  const b = mod(s) + lead + hero.power;
  const dc = role.dc + (FOE_DC_SHIFT[tier] ?? 0);
  const r = rng.int(1, 20);
  const margin = r + b - dc;
  const ok = r === 20 || (r !== 1 && margin >= 0);
  w.battles += 1;
  const base = { war: id || null, foe: foeId, role: role.name, rank: RANKS[ext.rank], rankN: ext.rank, n: w.battles, roll: r, country: life.country };
  const bestPay = WAR_PAY_BEST.countries.includes(life.country) ? WAR_PAY_BEST.mul : 1;

  if (ok) {
    const won = r === 20 || margin >= WAR_DECISIVE;
    const fame = Math.round(role.fame * (won ? 1.5 : 1));
    apply(ctx, [{ k: 'stat', stat: 'fame', delta: fame }], { sys: 'combat', id: 'war', stream: STREAM.loot });
    const share = Math.round((WAR_PAY.byRank[ext.rank] ?? 2) * (won ? WAR_PAY.won : 1) * bestPay);
    const paid = payShare(ctx, share, 'war', { war: id || null, foe: foeId, rank: RANKS[ext.rank] });
    w.pay += paid;
    if (won) w.won += 1;
    else w.held += 1;
    const up = promote(ctx, life, w, won ? 2 : 1);
    // the first battle of a war, and a battle won outright, are told; the plain ones that were held are for the developer's log
    write(ctx.state, {
      sys: 'combat',
      kind: 'war',
      id: life.country,
      data: { ...base, how: 'held', grade: won ? 'won' : 'steady', first, pay: paid, fame, promoted: up !== undefined },
      level: first || won ? 1 : 0,
    });
    return 'held';
  }

  w.lost += 1;
  const max = maxHpOf(ctx, life);
  let hp = hpOf(ctx, life) - Math.round(role.dc * 2.4 * WAR_DAMAGE);
  let how: 'lost' | 'dead' = 'lost';
  if (hp <= 0 || (hp <= max * WAR_DEATH.hpShare && rng.chance(WAR_DEATH.chance))) {
    const kept = rescueOf(ctx, hero);
    if (kept > 0) hp = kept;
    else {
      hp = 0;
      how = 'dead';
    }
  }
  ext.hp = hp;
  if (how === 'lost') {
    const foe = foeOf(ctx, ['npc_mercenary']);
    const wounds = foe ? rollWound(ctx, hero, foe, undefined, true) : [];
    if (rng.chance(CAPTURE.mass)) {
      if (!life.flags.includes('captured')) life.flags.push('captured');
      write(ctx.state, { sys: 'combat', kind: 'captured', id: life.country, data: { war: id || null }, level: 2 });
    }
    write(ctx.state, { sys: 'combat', kind: 'war', id: life.country, data: { ...base, how, first, wounds: wounds.join(','), max, pay: 0 }, level: 2 });
    return how;
  }
  write(ctx.state, { sys: 'combat', kind: 'war', id: life.country, data: { ...base, how, first, pay: 0 }, level: 2 });
  campaign(ctx, life, w, true);
  dieInBattle(ctx);
  return how;
}
