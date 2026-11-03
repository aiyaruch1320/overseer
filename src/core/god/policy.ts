// God policies for the test tools and the balance tests (06-implementation.md §4, table "นโยบาย"): a god who plays by a rule instead of a player.
// This file holds the parts that belong to the power, chest and dream files: opening chests, sending dreams, answering the burden of the heart.
// The prayer, whisper and miracle files register their own parts with `registerPolicyPart`, so one `policyStep` plays a whole year.
import type { Ctx } from '../game';
import { currentChest, checkOpen, chestsLeft, openChest, pickSlot, skipChest, slotPrice, checkPick, type ChestSlot } from './chest';
import { answerQuestion, checkDream, dreamPrice, offersNow, questionsOpen, sendDream } from './dream';
import { canPay, dreadOf, lightOf } from './power';
import { gx, inWindow, lifeOf } from './state';
import { CHEST_MIN_LIGHT, POLICY_ALIAS, RESERVE, SHAPER_AGAINST, tierIndex } from './tuning';

export type PolicyName = 'silent' | 'merciful' | 'punish' | 'shaper' | 'giver' | 'saver' | 'random' | 'hasten' | 'seal';

/**
 * A part of a policy owned by another file (prayers, whispers, miracles), played once a life year inside `policyStep`: `first` before the
 * chests and dreams of this file (the prayers come first in the sim, the light kept for them), `last` after (the default).
 */
export type PolicyPart = (ctx: Ctx, policy: PolicyName) => void;
const parts: { fn: PolicyPart; when: 'first' | 'last' }[] = [];

export function registerPolicyPart(fn: PolicyPart, when: 'first' | 'last' = 'last'): void {
  if (!parts.some((p) => p.fn === fn)) parts.push({ fn, when });
}
export function clearPolicyParts(): void {
  parts.length = 0;
  reserveFn = () => 0;
}

/**
 * Dread a policy keeps back from the chests so the deed of the world can be paid when its turn comes (a ruin costs 60, a blow on a seal 30 or 55).
 * Without it the chests of the punishing god spend every point on curses and the dread never reaches the price of a ruin (M4 review round two, R2).
 * Owned by the acts file, which knows the deeds; 0 when nothing is waiting for dread.
 */
export type DreadReserve = (ctx: Ctx, policy: PolicyName) => number;
let reserveFn: DreadReserve = () => 0;
export function registerDreadReserve(fn: DreadReserve): void {
  reserveFn = fn;
}
/** The dread a policy holds back now (0 for most). */
export const dreadReserve = (ctx: Ctx, policy: PolicyName): number => reserveFn(ctx, policy);

/** Thai or English name of a policy (`เมตตา` `merciful`) to the one name used here; undefined for a name nobody knows. */
export function policyName(raw: string | undefined): PolicyName | undefined {
  return raw ? (POLICY_ALIAS[raw] as PolicyName | undefined) : undefined;
}

// ---------- chests ----------

/** The cheapest curse in a window (6 × 0.7 rounded up): a chest is not opened for less than this above the reserve. */
const CURSE_MIN = 5;

const PRAISE = new Set(['bless', 'skill', 'item']);

/** The slot a policy that gives picks: the biggest change of belief it can pay for, the higher tier first. */
function bestOf(ctx: Ctx, ch: { slots: (ChestSlot | null)[] }, line: 'faith' | 'dread', keep = 0): ChestSlot | undefined {
  const ok = ch.slots.filter((s): s is ChestSlot => !!s && s.pay === line && (line === 'faith' ? PRAISE.has(s.kind) || s.variant === 'holy' : s.kind === 'curse' || s.variant === 'cursed') && canPay(ctx, slotPrice(ctx, s).cost) && (line === 'faith' || dreadOf(ctx) - (slotPrice(ctx, s).cost.dread ?? 0) >= keep));
  return ok.sort((a, b) => Math.abs(b.belief) - Math.abs(a.belief) || tierIndex(b.tier) - tierIndex(a.tier) || a.slot - b.slot)[0];
}

/** Opens chests while the year allows and the power is there; picks the best thing of the line, or skips. Returns the chests opened. */
function chestRounds(ctx: Ctx, line: 'faith' | 'dread', enough: () => boolean, max: number, keep = 0): number {
  let n = 0;
  while (n < max && chestsLeft(ctx) > 0 && !checkOpen(ctx) && enough()) {
    const ch = openChest(ctx);
    n++;
    const s = bestOf(ctx, ch, line, keep);
    if (s && !checkPick(ctx, s.slot)) pickSlot(ctx, s.slot);
    else {
      skipChest(ctx);
      break;
    }
  }
  return n;
}

// ---------- dreams ----------

function dreamRounds(ctx: Ctx, rng: ReturnType<Ctx['rng']>, against: boolean, max: number): void {
  for (let guard = 0; guard < max; guard++) {
    const offers = offersNow(ctx);
    if (!offers.length) return;
    // the shaper sends the way against his nature half of the time; the merciful one always the way that fits him
    const wrong = against && rng.chance(SHAPER_AGAINST) ? offers.find((o) => o.fit < 0) : undefined;
    const o = wrong ?? offers[0];
    if (checkDream(ctx, o)) return;
    const price = dreamPrice(ctx, o.window || inWindow(ctx));
    if (lightOf(ctx) < RESERVE + (price.faith ?? 0)) return;
    sendDream(ctx, o);
  }
}

// ---------- the year ----------

/** Moments of this life year the game stops for the god: each node played and each age stop. */
export function momentsOf(ctx: Ctx): number {
  const life = lifeOf(ctx);
  const w = gx(ctx).window;
  return life && w && w.age === life.hAge ? w.played + (w.stop ? 1 : 0) : 0;
}


/**
 * One life year of a god who plays by a rule. `godSystem` calls it once a life year, after the income, when `state.god.ext.policy` names a
 * policy; the test tools call it after every beat: the year is played by the first call and the others do nothing. `policy` is the Thai name the tools pass (`เมตตา`) or the English one (`merciful`).
 */
export function policyStep(ctx: Ctx, policy: string): void {
  const name = policyName(policy);
  const life = lifeOf(ctx);
  if (!name || !life) return;
  // one life year is played once, whoever asks and however often (the tools call after every beat, the system once a life year)
  const e = gx(ctx);
  if (e.policyAt === life.hAge) return;
  e.policyAt = life.hAge;
  const rng = ctx.rng('god.policy');
  for (const p of parts) if (p.when === 'first') p.fn(ctx, name);
  if (!lifeOf(ctx)) return;
  switch (name) {
    case 'merciful':
    case 'shaper': {
      while (questionsOpen(ctx) > 0 && answerQuestion(ctx)) void 0;
      // the god acts at the moments the game stops for it: a node played this year, an age stop (sim-god.mjs `moments`)
      dreamRounds(ctx, rng, name === 'shaper', momentsOf(ctx));
      chestRounds(ctx, 'faith', () => lightOf(ctx) >= CHEST_MIN_LIGHT, 2);
      break;
    }
    case 'giver':
      chestRounds(ctx, 'faith', () => lightOf(ctx) >= CHEST_MIN_LIGHT, 2);
      break;
    case 'punish':
    case 'seal': {
      // the dread of a deed in the world is kept back; a chest is opened only when a curse can be paid above it
      const keep = reserveFn(ctx, name);
      chestRounds(ctx, 'dread', () => dreadOf(ctx) - keep >= (inWindow(ctx) ? (keep ? CURSE_MIN : 0) : 20), 2, keep);
      break;
    }
    case 'random': {
      // a moment for every node played this year and every age stop; at half of them the god does one thing at random
      const moments = momentsOf(ctx);
      for (let m = 0; m < moments && lifeOf(ctx); m++) {
        if (!rng.chance(0.5)) continue;
        const x = rng.int(0, 2);
        if (x === 0) dreamRounds(ctx, rng, false, 1);
        else if (x === 2 && chestsLeft(ctx) > 0 && !checkOpen(ctx)) {
          const ch = openChest(ctx);
          const keep = reserveFn(ctx, name);
          const ok = ch.slots.filter((s): s is ChestSlot => !!s && !checkPick(ctx, s.slot) && (s.pay !== 'dread' || dreadOf(ctx) - (slotPrice(ctx, s).cost.dread ?? 0) >= keep));
          if (ok.length) pickSlot(ctx, ok[rng.int(0, ok.length - 1)].slot);
          else skipChest(ctx);
        }
      }
      break;
    }
    case 'silent':
    case 'saver':
    case 'hasten':
      break;
  }
  if (currentChest(ctx)) skipChest(ctx);
  for (const p of parts) if (p.when === 'last') p.fn(ctx, name);
}
