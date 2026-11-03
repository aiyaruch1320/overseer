// The fight itself (docs/systems/combat/01-core.md §2): perceive, then beat after beat the hero takes a stance, rolls once, and either
// wears down a wound of the foe or loses hit points, until the foe has no wounds, the hero yields, flees, talks it down, or the beats run out.
import { die } from '../character';
import { battleDone, weakStanceMul, whisperBonus } from '../god/acts';
import type { Ctx } from '../game';
import { write } from '../log';
import { extOf as storyExt, yearOf } from '../story/state';
import { CAUSE } from '../story/tuning';
import { afterBattle, damageFloor, shieldMult } from '../items';
import { buildHero, hpOf, shareOf, statOf, thickMul, type Hero } from './hero';
import { indexOf } from './data';
import { choose, options, type Option, type Scene } from './stance';
import { countWin, keysOf, lootFor, quietReward, rollWound } from './reward';
import { extOf } from './state';
import {
  AFTER_LOSS_HP, DAMAGE_MUL, DAMAGE_SCALE, DEATH_AT_ZERO_MUL, DEATH_LOW_START_MUL, DEATH_ON_LOSS, LAST_STAND, OVERTIME, EVADE, GUARD, PARRY, PERCEIVE_DC, PRAY, RESCUE, RESIST_TAG, STREAM, WEAK_TAG, YIELD_AT,
} from './tuning';
import type { FightOpts, FightResult, Foe, Outcome } from './types';

const mod = (v: number) => Math.floor((v - 10) / 2);

/** The chance the hero rolls again after a failed roll (legacy `rerollChance`: luck × 1.5%, second chance +0.2, jinx −0.1). */
export function rerollChance(hero: Hero): number {
  let r = statOf(hero, 'luk') * 0.015;
  if (hero.tags.has('second_chance')) r += 0.2;
  if (hero.tags.has('lucky')) r += 0.15;
  if (hero.tags.has('jinx')) r -= 0.1;
  return Math.max(0, Math.min(0.6, r));
}

const WORD: Record<FightResult, string> = { win: 'win', flawless: 'win', talk: 'win', tame: 'win', draw: 'draw', flee: 'flee', lose: 'lose', dead: 'dead' };

/** The damage of one lost beat (01-core.md §5): DC × 2.4 ÷ the most beats × what guards the hero. */
export function damageOf(ctx: Ctx, hero: Hero, foe: Foe, stance: string, spent: { guard: boolean; share: boolean }): number {
  const k = indexOf(ctx).combat.damage.dcDamage;
  const base = (foe.dc * k) / foe.maxBeats;
  // the factors multiply and the product is never below the floor (items 11-item-system.md §4: ×0.35); the shield replaces the guard stance's own half
  let mul = 1;
  if (stance === 'guard') mul *= hero.armor.shield ? Math.min(GUARD.damageMul, shieldMult(ctx)) : GUARD.damageMul;
  if (hero.tags.has('guard')) mul *= DAMAGE_MUL.guardTag;
  if (hero.tags.has('iron_body') || hero.tags.has('stone_blood') || hero.tags.has('stone_skin')) mul *= DAMAGE_MUL.tough;
  if (hero.companion.thick) mul *= thickMul(hero.companion);
  if (hero.weapon?.parry) mul *= PARRY;
  mul *= hero.armor.mult;
  if (hero.party.cutPct) mul *= 1 - hero.party.cutPct / 100;
  for (const a of foe.attack) {
    for (const [tag, el] of Object.entries(RESIST_TAG)) if (el === a && hero.tags.has(tag)) mul *= DAMAGE_MUL.resistTag;
    for (const [tag, el] of Object.entries(WEAK_TAG)) if (el === a && hero.tags.has(tag)) mul *= DAMAGE_MUL.weakTag;
  }
  let d = base * DAMAGE_SCALE * Math.max(damageFloor(), mul);
  if (hero.companion.guard && !spent.guard) {
    spent.guard = true;
    return 0;
  }
  if (hero.companion.lifeShare && !spent.share) {
    spent.share = true;
    d *= 1 - shareOf(hero.companion);
  }
  return Math.max(0, Math.round(d));
}

/** The hero's last chance when his hit points reach zero (01-core.md §7 "ตาย"): `b_laststand`, `rewind`, `guardian_angel`. Returns the hit points he keeps, or 0. */
export function rescueOf(ctx: Ctx, hero: Hero): number {
  const life = hero.life;
  const ext = extOf(life);
  const rng = ctx.rng(STREAM.fight);
  if (life.blessings.includes('b_laststand') || hero.tags.has('last_stand')) {
    life.blessings = life.blessings.filter((b) => b !== 'b_laststand');
    write(ctx.state, { sys: 'combat', kind: 'rescue', id: 'b_laststand', data: {}, level: 2 });
    return RESCUE.lastStand;
  }
  if (hero.tags.has('rewind') && !ext.rewound) {
    ext.rewound = true;
    write(ctx.state, { sys: 'combat', kind: 'rescue', id: 'rewind', data: {}, level: 2 });
    return Math.round(hero.maxHp * RESCUE.rewindShare);
  }
  if (hero.tags.has('guardian_angel') && rng.chance(RESCUE.angelChance)) {
    write(ctx.state, { sys: 'combat', kind: 'rescue', id: 'guardian_angel', data: {}, level: 2 });
    return RESCUE.angel;
  }
  return 0;
}

export interface Fought extends Outcome {
  /** Rolls, for the tests: one per beat. */
  rolls: { stance: string; roll: number; bonus: number; dc: number; ok: boolean; hp: number; left: number }[];
  /** Wounds of the foe left. */
  left: number;
  earned: string[];
}

/**
 * One fight of the hero against a foe. Changes the hit points, the permanent wounds, the loot and the counts; writes `combat/battle`
 * (and `combat/pray`, `combat/wound`, `combat/title`). A hero who dies is marked dead with the cause "ตายในศึก" (the death hook runs in the loop).
 */
export function resolve(ctx: Ctx, foe: Foe, opts: FightOpts = {}): Fought {
  const life = ctx.state.life;
  const empty = (): Fought => ({ result: 'draw', word: 'draw', beats: 0, hpLost: 0, hpAfter: 0, enemies: foe.ids, foe: foe.name, stances: [], wounds: [], loot: [], killed: false, skipped: true, first: 'even', rolls: [], left: foe.wounds, earned: [] });
  if (!life || life.dead) return empty();
  const ext = extOf(life);
  const rng = ctx.rng(STREAM.fight);
  const hero = buildHero(ctx, life);
  // the people of the party fight beside the hero unless the caller named who does (a raid names its own, 01-core.md §4)
  if (opts.allies === undefined && hero.party.members) opts = { ...opts, allies: hero.party.members };
  const startHp = hero.hp;
  const roll20 = indexOf(ctx).combat.roll;
  const rolls: Fought['rolls'] = [];
  const stances: string[] = [];
  const spent = { guard: false, share: false };

  // the hero knows the weak points of a foe he met, and when a hint of the god or a gift of sight tells him (01-core.md §6)
  const known = foe.ids.some((id) => ext.met.includes(id)) || hero.seer || weakStanceMul(ctx) > 1;
  let knows = known;
  // what the god's hand did to this fight, read before the fight spends it (the battle screen shows it: dream ×3, weak-point whisper)
  const dreamed = opts.dream ?? (ext.dream && ext.dream.until >= life.hAge ? ext.dream.stance : undefined);
  const whispered = weakStanceMul(ctx) > 1;

  // ---- step 0: perceive (01-core.md §2) ----
  let first = 0;
  let side: Outcome['first'] = 'even';
  if (opts.ambush === 'hero' || opts.kind === 'hunt') {
    first = roll20.firstBeat.advantage;
    side = 'hero';
  } else if (opts.ambush === 'foe') {
    first = roll20.firstBeat.ambush;
    side = 'foe';
  } else {
    const r = rng.int(1, 20);
    const b = Math.max(mod(statOf(hero, 'spd')), mod(statOf(hero, 'int'))) + whisperBonus(ctx, 'perceive') - (opts.rematch ? 1 : 0) + (opts.env?.includes('dense_fog') ? -2 : 0);
    if (r === 20 || (r !== 1 && r + b >= PERCEIVE_DC)) {
      first = roll20.firstBeat.advantage;
      side = 'hero';
    } else if (hero.companion.danger) {
      first = 0;
    } else {
      // a long weapon meets the ambush half way (items README §3 `ยาว`)
      first = hero.weapon?.reach ? Math.ceil(roll20.firstBeat.ambush / 2) : roll20.firstBeat.ambush;
      side = 'foe';
    }
  }

  let hp = startHp;
  // a last stand is a host, not one foe: more wounds to deal and more beats to deal them in (tuning LAST_STAND)
  let left = opts.lastStand ? foe.wounds * LAST_STAND.wounds : foe.wounds;
  let result: FightResult = 'draw';
  let blessed = 0;
  let dodge = 0;
  let beat = 0;
  let killedBy: 'win' | 'talk' | 'tame' | undefined;
  const lethal = opts.lethal !== false;
  const reroll = rerollChance(hero);

  let limit = opts.lastStand ? foe.maxBeats * LAST_STAND.beats : foe.maxBeats;
  let extended = false;
  for (; beat < limit; beat++) {
    hero.hp = hp;
    const scene: Scene = { ctx, hero, foe, opts, beat, first: beat === 0 ? first : 0, blessed, dodge, known: knows };
    const list: Option[] = options(scene);
    const pick = choose(scene, rng, list);
    stances.push(pick.id);
    let ok = false;
    let r = 0;
    if (pick.blocked && !knows) {
      // the blade goes through the ghost: the beat is lost and the hero knows now
      knows = true;
    } else {
      r = rng.int(1, 20);
      ok = r === 20 || (r !== 1 && r + pick.bonus >= pick.dc);
      // the party beside the hero adds its share to the roll (bonds 01 §3: +3% a partner); the chance is spread over the rolls that failed
      if (!ok && hero.party.rollPct && rng.chance(hero.party.rollPct / 100 / Math.max(0.05, Math.min(0.95, (pick.dc - pick.bonus - 1) / 20)))) {
        ok = true;
        r = Math.max(r, 2);
      }
      if (!ok && rng.chance(reroll)) {
        const r2 = rng.int(1, 20);
        if (r2 === 20 || (r2 !== 1 && r2 + pick.bonus >= pick.dc)) {
          ok = true;
          r = r2;
        }
      }
    }
    const cur = { stance: pick.id, roll: r, bonus: pick.bonus, dc: pick.dc, ok, hp, left };
    rolls.push(cur);
    // the state after the beat, recorded for the battle screen (no draws)
    const snap = () => {
      cur.hp = hp;
      cur.left = left;
    };
    dodge = 0;
    let hit = false;

    if (ok) {
      switch (pick.kind) {
        case 'wound': {
          let dealt = r === 20 || pick.hit.heavy ? 2 : 1;
          if (foe.traits.includes('swarm') && pick.id === 'melee') dealt = 1; // melee takes a swarm one wound at a time (02-type-matrix.md §5)
          if (pick.id === 'guard' && r < GUARD.woundRoll) dealt = 0; // a guard wounds only on a high roll (01-core.md §3)
          if (foe.armour && !opts.armour?.broken) dealt = 0; // the story armour of a dragon of the fifteen
          if (dealt) {
            left = Math.max(0, left - dealt);
            hit = true;
          }
          break;
        }
        case 'talk':
          killedBy = 'talk';
          break;
        case 'calm':
          killedBy = 'tame';
          break;
        case 'evade':
          dodge = Math.min(EVADE.cap, EVADE.nextBonus);
          if (r === 20 && left > 0) {
            left -= 1;
            hit = true;
          }
          break;
        case 'pray':
          blessed = PRAY.bonus;
          hp = Math.min(hero.maxHp, hp + Math.round(hero.maxHp * PRAY.heal));
          write(ctx.state, { sys: 'combat', kind: 'pray', id: foe.lead, data: { beat, faith: life.godFaith }, level: 1 });
          break;
        case 'flee':
          result = 'flee';
          break;
      }
    }

    snap();
    if (killedBy || result === 'flee') break;
    if (left <= 0) {
      result = 'win';
      break;
    }
    // the foe strikes when the hero's roll failed (01-core.md §2 step 2)
    if (!ok) {
      const dmg = damageOf(ctx, hero, foe, pick.id, spent);
      hp -= dmg;
      if (hp <= hero.maxHp * YIELD_AT) {
        // the hero is beaten; whether the blow also kills him is a roll (tuning DEATH_ON_LOSS)
        const down = hp <= 0;
        result = 'lose';
        const mortal = opts.lastStand ? 1 : (DEATH_ON_LOSS[foe.tierId] ?? 0) * (down ? DEATH_AT_ZERO_MUL : 1) * (startHp <= hero.maxHp * YIELD_AT ? DEATH_LOW_START_MUL : 1);
        if (lethal && rng.chance(mortal)) {
          const kept = rescueOf(ctx, hero);
          if (kept > 0) hp = kept;
          else {
            hp = 0;
            result = 'dead';
          }
        } else if (down) hp = Math.max(1, Math.round(hero.maxHp * YIELD_AT));
        snap();
        break;
      }
    }
    // a foe that mends: one wound back after a beat that took none, unless fire burned it (02-type-matrix.md §5)
    if (!hit && foe.traits.includes('regen') && left < foe.wounds && !pick.tags.includes('fire')) left += 1;
    snap();
    if (beat + 1 === limit && !extended && left > 0 && left <= OVERTIME.maxLeft) {
      limit += OVERTIME.beats;
      extended = true;
    }
  }
  if (killedBy) result = killedBy;
  else if (result === 'draw' && left <= 0) result = 'win';
  // a last stand does not end in a stand-off: the foe still stands when the beats run out, and the hero falls (a rescue may still hold)
  if (opts.lastStand && result === 'draw') {
    const kept = rescueOf(ctx, hero);
    if (kept > 0) {
      hp = kept;
      result = 'lose';
    } else {
      hp = 0;
      result = 'dead';
    }
  }

  // ---- after the fight ----
  const lost = Math.max(0, startHp - hp);
  const flawless = result === 'win' && lost === 0;
  if (flawless) result = 'flawless';
  let killed = result === 'win' || result === 'flawless';
  if (result === 'talk' || result === 'tame' || opts.spare) killed = false;
  const loot: string[] = [];
  const wounds: string[] = [];
  let earned: string[] = [];
  if (result === 'dead') {
    hp = 0;
  } else {
    if (result === 'lose') {
      const floor = Math.round(hero.maxHp * AFTER_LOSS_HP);
      if (hp < floor) hp = floor;
      // a duel with a yield rule leaves no permanent wound (04 §2 "ดวล", 07 §3 the rows of duels)
      if (opts.kind !== 'duel') wounds.push(...rollWound(ctx, hero, foe, opts.node, opts.kind === 'war'));
    }
    if (killed && opts.loot !== false) loot.push(...lootFor(ctx, hero, foe, flawless, opts.node));
    if (result === 'talk') loot.push(...quietReward(ctx, hero, foe, 'talk', opts.node));
    if (result === 'tame') {
      loot.push(...quietReward(ctx, hero, foe, 'tame', opts.node));
      earned = countWin(ctx, hero, foe, [...keysOf(opts), 'calm'], false, opts.node);
    }
    if (killed) earned = countWin(ctx, hero, foe, keysOf(opts), true, opts.node);
  }
  ext.hp = hp;
  for (const id of foe.ids) if (!ext.met.includes(id)) ext.met.push(id);
  ext.dream = undefined;
  battleDone(ctx);
  // the weapon in the hand wears and learns the names of the dead, the armour wears when the hero loses (items `afterBattle`)
  if (result !== 'dead') afterBattle(ctx, { won: result !== 'lose', kills: killed ? foe.ids : [] });
  if (result === 'win' || result === 'flawless') ext.fights.win++;
  if (result === 'flawless') ext.fights.flawless++;
  if (result === 'talk') ext.fights.talk++;
  if (result === 'tame') ext.fights.tame++;
  if (result === 'lose') ext.fights.lose++;
  if (result === 'flee') ext.fights.flee++;
  if (result === 'draw') ext.fights.draw++;
  // the story keeps a tally of its own (storylines/README.md §8)
  const sx = storyExt(life);
  if (['win', 'flawless', 'talk', 'tame'].includes(result)) sx.battles.win++;
  else if (result === 'lose') sx.battles.lose++;
  else if (result === 'flee' || result === 'draw') sx.battles.flee++;

  const startWounds = opts.lastStand ? foe.wounds * LAST_STAND.wounds : foe.wounds;
  const out: Fought = {
    result,
    word: WORD[result],
    beats: rolls.length,
    hpLost: lost,
    hpAfter: hp,
    enemies: foe.ids,
    foe: foe.name,
    stances,
    wounds,
    loot,
    killed,
    first: side,
    rolls,
    left,
    earned,
  };
  if (opts.log !== false) {
    write(ctx.state, {
      sys: 'combat',
      kind: 'battle',
      id: foe.ids.join(','),
      data: {
        result: out.word,
        end: result,
        enemies: foe.ids.join(','),
        foe: foe.name,
        node: opts.node ?? null,
        text: opts.text ?? null,
        kind: opts.kind ?? 'other',
        beats: out.beats,
        hpLost: lost,
        hp,
        stances: stances.join(','),
        first: side,
        wounds: wounds.join(','),
        loot: loot.join(','),
        // the fight beat by beat for the battle screen: `stance/d20/bonus/dc/ok/hpAfter/foeWoundsLeft` joined by ';'
        rolls: rolls.map((x) => `${x.stance}/${x.roll}/${x.bonus}/${x.dc}/${x.ok ? 1 : 0}/${x.hp}/${x.left}`).join(';'),
        dream: dreamed ?? null,
        whisper: whispered ? 1 : 0,
        max: hero.maxHp,
        lastStand: opts.lastStand ? 1 : 0,
        foeWounds: startWounds,
      },
      level: foe.named || opts.kind === 'story' || opts.kind === 'clash' ? 2 : 1,
    });
  }
  if (result === 'dead') die(ctx, CAUSE.battle, opts.node);
  return out;
}

/** The hero dies in battle (a war roll, a raid): the cause the story's endings read. */
export function dieInBattle(ctx: Ctx, node?: string): void {
  die(ctx, CAUSE.battle, node);
}

/** The hero's hit points as they stand, for screens and tests. */
export const hpNow = (ctx: Ctx): number | null => {
  const l = ctx.state.life;
  return l ? hpOf(ctx, l) : null;
};

/** The year's cap on fights (04-encounters.md §1) uses the story's own count so story fights and random ones share it. */
export function yearCount(ctx: Ctx): { battles: number; fought: string[] } | null {
  const l = ctx.state.life;
  if (!l || l.dead) return null;
  const y = yearOf(storyExt(l), l);
  return { battles: y.battles, fought: y.fought };
}
