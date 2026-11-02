// God policies for the test tools and the balance tests (06-implementation.md §4, table "นโยบาย"): a god who plays by a rule instead of a player.
// This file holds the parts that belong to the power, chest and dream files: opening chests, sending dreams, answering the burden of the heart.
// The prayer, whisper and miracle files register their own parts with `registerPolicyPart`, so one `policyStep` plays a whole year.
import type { Ctx } from '../game';
import { currentChest, checkOpen, chestsLeft, openChest, pickSlot, skipChest, slotPrice, checkPick, type ChestSlot } from './chest';
import { answerQuestion, checkDream, dreamPrice, offersNow, questionsOpen, sendDream } from './dream';
import { canPay, dreadOf, lightOf } from './power';
import { gx, inWindow, lifeOf } from './state';
import { CHEST_MIN_LIGHT, POLICY_ALIAS, RESERVE, SHAPER_AGAINST, tierIndex } from './tuning';

export type PolicyName = 'silent' | 'merciful' | 'punish' | 'shaper' | 'giver' | 'saver' | 'random';

/** A part of a policy owned by another file (prayers, whispers, miracles): called after the parts of this file, once a life year. */
export type PolicyPart = (ctx: Ctx, policy: PolicyName) => void;
const parts: PolicyPart[] = [];

export function registerPolicyPart(fn: PolicyPart): void {
  if (!parts.includes(fn)) parts.push(fn);
}
export function clearPolicyParts(): void {
  parts.length = 0;
}

/** Thai or English name of a policy (`เมตตา` `merciful`) to the one name used here; undefined for a name nobody knows. */
export function policyName(raw: string | undefined): PolicyName | undefined {
  return raw ? (POLICY_ALIAS[raw] as PolicyName | undefined) : undefined;
}

// ---------- chests ----------

const PRAISE = new Set(['bless', 'skill', 'item']);

/** The slot a policy that gives picks: the biggest change of belief it can pay for, the higher tier first. */
function bestOf(ctx: Ctx, ch: { slots: (ChestSlot | null)[] }, line: 'faith' | 'dread'): ChestSlot | undefined {
  const ok = ch.slots.filter((s): s is ChestSlot => !!s && s.pay === line && (line === 'faith' ? PRAISE.has(s.kind) || s.variant === 'holy' : s.kind === 'curse' || s.variant === 'cursed') && canPay(ctx, slotPrice(ctx, s).cost));
  return ok.sort((a, b) => Math.abs(b.belief) - Math.abs(a.belief) || tierIndex(b.tier) - tierIndex(a.tier) || a.slot - b.slot)[0];
}

/** Opens chests while the year allows and the power is there; picks the best thing of the line, or skips. Returns the chests opened. */
function chestRounds(ctx: Ctx, line: 'faith' | 'dread', enough: () => boolean, max: number): number {
  let n = 0;
  while (n < max && chestsLeft(ctx) > 0 && !checkOpen(ctx) && enough()) {
    const ch = openChest(ctx);
    n++;
    const s = bestOf(ctx, ch, line);
    if (s && !checkPick(ctx, s.slot)) pickSlot(ctx, s.slot);
    else {
      skipChest(ctx);
      break;
    }
  }
  return n;
}

// ---------- dreams ----------

function dreamRounds(ctx: Ctx, rng: ReturnType<Ctx['rng']>, against: boolean): void {
  for (let guard = 0; guard < 4; guard++) {
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

/**
 * One life year of a god who plays by a rule (call it once a life year, after the income, which `godSystem` does when
 * `state.god.ext.policy` names a policy). `policy` is the Thai name the tools pass (`เมตตา`) or the English one (`merciful`).
 */
export function policyStep(ctx: Ctx, policy: string): void {
  const name = policyName(policy);
  const life = lifeOf(ctx);
  if (!name || !life) return;
  const rng = ctx.rng('god.policy');
  switch (name) {
    case 'merciful':
    case 'shaper': {
      while (questionsOpen(ctx) > 0 && answerQuestion(ctx)) void 0;
      dreamRounds(ctx, rng, name === 'shaper');
      chestRounds(ctx, 'faith', () => lightOf(ctx) >= CHEST_MIN_LIGHT, 2);
      break;
    }
    case 'giver':
      chestRounds(ctx, 'faith', () => lightOf(ctx) >= CHEST_MIN_LIGHT, 2);
      break;
    case 'punish':
      chestRounds(ctx, 'dread', () => dreadOf(ctx) >= (inWindow(ctx) ? 0 : 20), 2);
      break;
    case 'random': {
      // a moment for every node played this year and every age stop; at half of them the god does one thing at random
      const w = gx(ctx).window;
      const moments = (w && w.age === life.hAge ? w.played : 0) + (w?.stop && w.age === life.hAge ? 1 : 0);
      for (let m = 0; m < moments && lifeOf(ctx); m++) {
        if (!rng.chance(0.5)) continue;
        const x = rng.int(0, 2);
        if (x === 0) dreamRounds(ctx, rng, false);
        else if (x === 2 && chestsLeft(ctx) > 0 && !checkOpen(ctx)) {
          const ch = openChest(ctx);
          const ok = ch.slots.filter((s): s is ChestSlot => !!s && !checkPick(ctx, s.slot));
          if (ok.length) pickSlot(ctx, ok[rng.int(0, ok.length - 1)].slot);
          else skipChest(ctx);
        }
      }
      break;
    }
    case 'silent':
    case 'saver':
      break;
  }
  if (currentChest(ctx)) skipChest(ctx);
  for (const p of parts) p(ctx, name);
}
