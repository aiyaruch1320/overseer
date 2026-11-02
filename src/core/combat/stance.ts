// The nine stances (01-core.md §3): what each needs, what it rolls with, and how the character picks one (§6).
import { idx } from '../character';
import type { Ctx } from '../game';
import type { Rng } from '../rng';
import { weakStanceMul } from '../god/acts';
import { engravedBonus } from '../items';
import { bestHit, ELEMENT_TAGS, hurts, markOf, SPECIAL_TAGS, type Hit } from './matrix';
import { indexOf } from './data';
import { bestApt, calmable, magicApts, MELEE, RANGED, statOf, type Hero } from './hero';
import {
  AXIS_TILT, CHOICE_SLOPE, DRAGON_TONGUE, FLEE_EASE, LOW_HP, MUL, PRAY, REASON, STANCE_WEIGHT, TALK_EASE, WEAK_TAG,
} from './tuning';
import { extOf } from './state';
import type { FightOpts, Foe } from './types';

/** The words of `ไล่ X` that name a kind of foe (items README §3). */
const REPEL_WORD: Record<string, string> = { ผู้ตาย: 'undead', วิญญาณ: 'spirit', สิ่งจากหมอก: 'fog', ปีศาจ: 'demon', สัตว์ป่า: 'beast' };
/** The name of a stance in `ท่าที X +N` of a weapon (items README §3). */
const STANCE_NAME: Record<string, string> = { melee: 'ปะทะประชิด', ranged: 'ยิงระยะไกล', magic: 'เวท', guard: 'ตั้งรับ', negotiate: 'เจรจา', calm_beast: 'สงบสัตว์', evade: 'หลอกล่อ', pray: 'สวดภาวนา', flee: 'หนี' };

export const FIGHT_STANCES = ['melee', 'ranged', 'magic', 'guard'] as const;
/** Stances that wear down the foe's wounds. */
export const DAMAGING = new Set(['melee', 'ranged', 'magic', 'guard']);

const mod = (v: number) => Math.floor((v - 10) / 2);

export interface Scene {
  ctx: Ctx;
  hero: Hero;
  foe: Foe;
  opts: FightOpts;
  /** 0-based beat. */
  beat: number;
  /** +2 / −2 on the first beat only. */
  first: number;
  /** +2 while a prayer holds, and the dodge bonus. */
  blessed: number;
  dodge: number;
  /** The hero knows the foe's weak points. */
  known: boolean;
}

export interface Option {
  id: string;
  /** The hero can take this stance at all. */
  usable: boolean;
  /** Every attack tag is ✕ (a ghost and a blade): a hero who knows takes another stance; one who does not wastes the beat. */
  blocked: boolean;
  tags: string[];
  hit: Hit;
  /** The sum of the roll bonus and its parts, for the log and the tests. */
  bonus: number;
  parts: Record<string, number>;
  /** The DC this stance rolls against. */
  dc: number;
  /** What it does when the roll passes. */
  kind: 'wound' | 'talk' | 'calm' | 'evade' | 'pray' | 'flee';
}

export function dcOf(scene: Scene): number {
  const { foe, opts, ctx } = scene;
  let dc = foe.dc + (opts.dcMod ?? 0) + (opts.rematch ? 1 : 0);
  const env = opts.env ?? [];
  if (env.includes('holy_ground') && foe.kinds.some((k) => k === 'undead' || k === 'demon')) dc -= 2;
  if (env.includes('ash_winter') && foe.attack.includes('fire')) dc -= 2;
  // a weapon that drives off a kind (`ไล่ X`, items README §3): the foe is easier to come near, whatever stance the hero takes
  const rep = scene.hero.weapon?.repel;
  if (rep && (rep.codes.some((c) => foe.ids.includes(c)) || rep.words.some((w) => foe.kinds.includes(REPEL_WORD[w] ?? w)))) dc -= 2;
  void ctx;
  return Math.max(2, dc);
}

/** Tags of a stance that are not weapon shapes: the element the weapon carries. */
const ELEMENTAL = new Set<string>([...ELEMENT_TAGS, ...SPECIAL_TAGS]);

function aptStat(ctx: Ctx, id: string, fallback: 'pow' | 'spd' | 'luk' | 'vit' | 'mag' | 'int'): 'pow' | 'spd' | 'luk' | 'vit' | 'mag' | 'int' {
  return (idx(ctx).aptitudes.get(id)?.stat as 'pow') ?? fallback;
}
function aptTags(ctx: Ctx, id: string): string[] {
  return (idx(ctx).aptitudes.get(id)?.tags ?? []).map((t) => t.replace(/^#/, ''));
}
const skillBonus = (ctx: Ctx, level: number): number => (level > 0 ? indexOf(ctx).combat.roll.aptBonus[String(Math.min(3, level))] ?? 0 : 0);

interface Draft {
  id: string;
  usable: boolean;
  stat: number;
  skill: number;
  tags: string[];
  kind: Option['kind'];
  fight: boolean;
  weapon: boolean;
  dcMod: number;
  swarmArea?: boolean;
  /** The weapon in use trains an aptitude the hero does not have (−1, items README §2). */
  unskilled?: boolean;
}

function drafts(s: Scene): Draft[] {
  const { ctx, hero, foe, opts } = s;
  const life = hero.life;
  const out: Draft[] = [];
  const stats: Record<string, number> = { pow: statOf(hero, 'pow'), mag: statOf(hero, 'mag'), spd: statOf(hero, 'spd'), luk: statOf(hero, 'luk'), int: statOf(hero, 'int'), vit: statOf(hero, 'vit') };

  // ---- melee: always (a bare fist at worst) ----
  {
    const w = hero.melee;
    const apt = w && hero.apt(w.apt) > 0 ? { id: w.apt, level: hero.apt(w.apt) } : bestApt(hero, MELEE);
    const aptId = w?.apt ?? apt?.id;
    const tags = [...(w?.tags ?? []), ...(aptId ? aptTags(ctx, aptId) : []), ...hero.gift, ...hero.companion.tags];
    if (!tags.some((t) => ['blade', 'blunt', 'pierce'].includes(t))) tags.push('blunt');
    const stat = aptId ? aptStat(ctx, aptId, 'pow') : 'pow';
    out.push({ id: 'melee', usable: true, stat: mod(stats[stat === 'pow' || stat === 'spd' ? stat : 'pow']), skill: skillBonus(ctx, apt?.level ?? 0), tags, kind: 'wound', fight: true, weapon: true, dcMod: 0, unskilled: !!w?.w.unskilled });
  }
  // ---- ranged ----
  {
    const w = hero.ranged;
    const apt = w && hero.apt(w.apt) > 0 ? { id: w.apt, level: hero.apt(w.apt) } : bestApt(hero, RANGED);
    if (w || apt) {
      const aptId = w?.apt ?? apt!.id;
      const tags = [...(w?.tags ?? []), ...aptTags(ctx, aptId), 'ranged'];
      if (aptId === 'bow') tags.push('pierce');
      if (aptId === 'sling') tags.push('blunt');
      const stat = aptStat(ctx, aptId, 'spd');
      out.push({ id: 'ranged', usable: true, stat: mod(stats[stat === 'luk' ? 'luk' : 'spd']), skill: skillBonus(ctx, apt?.level ?? 0), tags, kind: 'wound', fight: true, weapon: true, dcMod: 0, unskilled: !!w?.w.unskilled });
    }
  }
  // ---- magic: the aptitude that suits the foe when the hero knows it, the strongest otherwise ----
  {
    const list = magicApts(ctx, hero);
    if (list.length) {
      let pick = list[0];
      if (s.known) {
        let best = -99;
        for (const a of list) {
          const t = [...a.tags, ...hero.gift];
          const h = bestHit(ctx, foe, t, hero.tags);
          const v = h.blocked ? -50 : h.bonus + skillBonus(ctx, a.level);
          if (v > best) {
            best = v;
            pick = a;
          }
        }
      }
      const tags = [...pick.tags, ...hero.gift];
      const st = pick.stat === 'int' ? 'int' : 'mag';
      const area = ['fire', 'wind', 'earth'].includes(pick.id) && pick.level >= 2;
      out.push({ id: 'magic', usable: true, stat: mod(stats[st]), skill: skillBonus(ctx, pick.level), tags, kind: 'wound', fight: true, weapon: true, dcMod: 0, swarmArea: area });
    }
  }
  // ---- guard: a shield, a guarding gift, or someone to protect ----
  if (hero.shield || hero.tags.has('guard') || opts.protect || (opts.allies ?? 0) > 0) {
    out.push({ id: 'guard', usable: true, stat: mod(stats.vit), skill: skillBonus(ctx, hero.apt('shield')), tags: [], kind: 'wound', fight: true, weapon: true, dcMod: 0 });
  }
  // ---- negotiate: the foe can think (or a row says it can be talked to) ----
  {
    let ok = !foe.noTalk && opts.talk !== false;
    if (ok && foe.kinds.includes('dragon') && !foe.negotiate.length && !DRAGON_TONGUE.some((t) => hero.tags.has(t))) ok = false;
    if (ok) {
      const best = ['charm', 'leadership', 'trade', 'music'].reduce((m, a) => Math.max(m, hero.apt(a)), 0);
      out.push({ id: 'negotiate', usable: true, stat: mod(Math.max(stats.luk, stats.int)), skill: skillBonus(ctx, best), tags: [], kind: 'talk', fight: false, weapon: false, dcMod: -TALK_EASE });
    }
  }
  // ---- calm a beast ----
  if (foe.kinds.some((k) => ['beast', 'sea', 'plant'].includes(k)) && calmable(hero)) {
    out.push({ id: 'calm_beast', usable: true, stat: mod(stats.luk), skill: skillBonus(ctx, hero.apt('taming')), tags: [], kind: 'calm', fight: false, weapon: false, dcMod: -TALK_EASE });
  }
  // ---- evade ----
  if (hero.apt('stealth') > 0 || hero.tags.has('stealth') || hero.companion.distract) {
    out.push({ id: 'evade', usable: true, stat: mod(stats.spd), skill: skillBonus(ctx, hero.apt('stealth')), tags: [], kind: 'evade', fight: false, weapon: false, dcMod: 0 });
  }
  // ---- pray: the belief divided by ten stands for the stat ----
  if (life.godFaith >= PRAY.minFaith) {
    out.push({ id: 'pray', usable: true, stat: Math.floor(life.godFaith / 10), skill: 0, tags: [], kind: 'pray', fight: false, weapon: false, dcMod: 0 });
  }
  // ---- flee: always ----
  out.push({ id: 'flee', usable: true, stat: mod(stats.spd), skill: 0, tags: [], kind: 'flee', fight: false, weapon: false, dcMod: -FLEE_EASE });
  return out;
}

/** Every stance with its roll bonus for this beat. */
export function options(s: Scene): Option[] {
  const { ctx, hero, foe, opts } = s;
  const roll = indexOf(ctx).combat.roll;
  const dc0 = dcOf(s);
  const env = opts.env ?? [];
  const hpShare = hero.hp / hero.maxHp;
  const list: Option[] = [];
  for (const d of drafts(s)) {
    const parts: Record<string, number> = {};
    const put = (k: string, v: number) => {
      if (v) parts[k] = (parts[k] ?? 0) + v;
    };
    put('stat', d.stat);
    put('skill', d.skill);
    let hit: Hit = { mark: '·', bonus: 0, blocked: false, heavy: false };
    if (d.kind === 'wound' && d.id !== 'guard') {
      hit = bestHit(ctx, foe, d.tags, hero.tags);
      put('weak', hit.bonus);
      // the weapon's own element on the foe's weak point
      const elemental = d.tags.filter((t) => ELEMENTAL.has(t) && hurts(markOf(ctx, foe, t)));
      if (elemental.length && d.id !== 'magic') put('element', roll.elementMatch);
      // what hurts the hero himself to hold (a fey and iron)
      for (const t of d.tags) for (const [w, tag] of Object.entries(WEAK_TAG)) if (hero.tags.has(w) && tag === t) put('self', roll.selfHandicap);
      if (foe.traits.includes('flying')) put('flying', d.id === 'melee' ? -2 : d.id === 'ranged' ? 2 : 0);
      if (foe.traits.includes('swarm') && d.swarmArea) put('swarm', 4);
      if (env.includes('ash_winter') && d.tags.includes('fire')) put('ash', 2);
    } else if (d.kind === 'talk') {
      const best = foe.negotiate.reduce((m, n) => (n.mark === '★' ? Math.max(m, roll.veryWeak) : n.mark === '▲' ? Math.max(m, roll.weak) : n.mark === '▼' ? Math.min(m, roll.resist) : m), 0);
      put('talk', best);
      if (foe.hardTalk) put('hard', -2);
      if (hero.tags.has('diplomat') || hero.tags.has('silver_tongue')) put('diplomat', 2);
    }
    if (d.fight) {
      if (d.weapon) put('weapon', d.id === 'magic' ? hero.magicPower : hero.power);
      if (d.unskilled) put('unskilled', -1);
      if (d.kind === 'wound') for (const id of foe.ids) { const n = engravedBonus(ctx, id); if (n) { put('engraved', n); break; } }
      if (hero.companion.assist) put('companion', hero.companion.assist);
      const allies = Math.min(roll.allyCap, (opts.allies ?? 0) * roll.allyPerPerson);
      put('allies', allies);
      if (hero.tags.has('dull')) put('dull', roll.dull);
      if (hpShare < roll.lowHp.below) put('hurt', hero.tags.has('berserk') ? 2 : roll.lowHp.bonus);
    }
    // the stance bonuses and the fear the weapon in the hand carries (`ท่าที X +N`, `ข่ม`)
    const named = hero.weapon?.stances[STANCE_NAME[d.id]];
    if (named) put('weapon-stance', named);
    if (d.id === 'negotiate' && hero.weapon?.intimidate && (foe.tier === 'ลูกกระจ๊อก' || foe.tier === 'ปกติ')) put('intimidate', 2);
    if (hero.tags.has('hero_luck')) put('luck', roll.heroLuck);
    put('first', s.first);
    put('blessed', s.blessed);
    if (d.id === 'evade' || d.id === 'melee') put('dodge', d.id === 'evade' ? s.dodge : 0);
    // the place (01-core.md §4 "สภาพแวดล้อม", 02-type-matrix.md CR-09)
    const seesDark = hero.tags.has('darkvision') || hero.tags.has('night_eye');
    if (env.includes('night') && !seesDark) put('night', -2);
    if (env.includes('dense_fog') && !hero.tags.has('fog_sight') && !seesDark) put('fog', -2);
    if (env.includes('fog') && hero.tags.has('fog_sight')) put('fog', 2);
    if (env.includes('water')) put('water', hero.tags.has('water_breath') ? 2 : -2);
    if (env.includes('home')) put('home', 1);
    const bonus = Object.values(parts).reduce((a, b) => a + b, 0);
    const dcAdj = dc0 + d.dcMod;
    list.push({ id: d.id, usable: d.usable, blocked: hit.blocked, tags: d.tags, hit, bonus, parts, dc: Math.max(2, dcAdj), kind: d.kind });
  }
  return list;
}

// ---------- the choice (01-core.md §6) ----------

/** The weight of each stance the hero may take now; zero for a stance that cannot be taken. */
export function weights(s: Scene, opts: Option[]): number[] {
  const { ctx, hero, foe } = s;
  const life = hero.life;
  const ext = extOf(life);
  const axes = (life.ext.character as { axes?: Record<string, number> } | undefined)?.axes ?? {};
  const brave = axes.brave ?? 0;
  const kind = axes.kind ?? 0;
  const temper = axes.temper ?? 0;
  const hpShare = hero.hp / hero.maxHp;
  const fearless = REASON.fearless.some((t) => life.traits.includes(t)) || REASON.fearlessTag.some((t) => hero.tags.has(t));
  const coward = REASON.cowardTrait.some((t) => life.traits.includes(t)) || REASON.cowardCurse.some((c) => life.curses.includes(c));
  const gentle = REASON.gentleTrait.some((t) => life.traits.includes(t)) || REASON.gentleTag.some((t) => hero.tags.has(t));
  const holy = !!life.job && REASON.holyJobs.includes(life.job);
  const tamer = !!life.job && REASON.tameJobs.includes(life.job);
  const undead = foe.kinds.some((k) => k === 'undead' || k === 'spirit');
  const weakMul = weakStanceMul(ctx);
  const dream = s.opts.dream ?? (ext.dream && ext.dream.until >= life.hAge ? ext.dream.stance : undefined);
  return opts.map((o) => {
    if (!o.usable) return 0;
    // a stance the hero knows is useless is not taken; one he does not know is tried and found out
    if (o.blocked && s.known) return 0;
    let w = STANCE_WEIGHT[o.id] ?? 1;
    const fights = o.id === 'melee' || o.id === 'ranged' || o.id === 'magic';
    if (fights) w *= 1 + (brave / 100) * AXIS_TILT.braveFight;
    if (o.id === 'melee') w *= 1 + (temper / 100) * AXIS_TILT.temperMelee;
    if (o.id === 'flee') w *= Math.max(0.2, 1 - (brave / 100) * AXIS_TILT.braveFlee);
    if (o.id === 'negotiate' || o.id === 'calm_beast') w *= Math.max(0.3, 1 + (kind / 100) * AXIS_TILT.kindTalk);
    // an effective stance is preferred (the tilt of the roll bonus), a known weak point most of all
    const bonus = s.known ? o.bonus : o.bonus - o.hit.bonus;
    w *= Math.exp(CHOICE_SLOPE * bonus);
    // 01-core.md §6
    if (o.id === 'flee' && hpShare < LOW_HP && !fearless) w *= MUL.lowHpFlee;
    if (o.id === 'flee' && coward && s.beat === 0) w *= MUL.cowardFirstFlee;
    if (o.id === 'negotiate' && gentle) w *= MUL.gentleTalk;
    if (s.known && fights && (o.hit.mark === '★' || o.hit.mark === '▲')) w *= weakMul > 1 ? weakMul : MUL.knownWeak;
    if (s.opts.protect && o.id === 'flee') w *= MUL.protectFlee;
    if (s.opts.protect && o.id === 'guard') w *= MUL.protectGuard;
    if (holy && undead && (o.id === 'pray' || o.id === 'magic')) w *= MUL.holyUndead;
    if (tamer && o.id === 'calm_beast') w *= MUL.tameBeast;
    if (dream && dream === o.id) w *= MUL.dream;
    // a stance that cannot hurt a foe it is known to resist (-4) is rarely a good idea; fighting on with no weapon at all is cowardice's cousin
    return w;
  });
}

/** Picks the stance of this beat. */
export function choose(s: Scene, rng: Rng, list: Option[]): Option {
  const w = weights(s, list);
  const i = rng.weighted(w);
  if (i >= 0) return list[i];
  // nothing can be taken (every stance blocked): run
  return list.find((o) => o.id === 'flee') ?? list[list.length - 1];
}

/** For tests and the god's card: the stances open to a hero against a foe, with the bonus each would roll. */
export function stanceBonuses(s: Scene): { id: string; bonus: number; blocked: boolean; mark: string }[] {
  return options(s).map((o) => ({ id: o.id, bonus: o.bonus, blocked: o.blocked, mark: o.hit.mark }));
}
