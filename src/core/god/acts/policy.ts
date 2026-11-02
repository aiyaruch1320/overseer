// The part the acts play in the policies of the god (god/06-implementation.md §4 table "นโยบาย"): how prayers are answered, when a
// whisper is sent, and what is done to the dragons and the events of the world. The driver (the tools, the balance tests) calls
// `actsPolicyStep(ctx, policy, 'beat')` after every beat and `actsPolicyStep(ctx, policy, 'world')` at every world step. The other acts
// (chests, dreams) belong to the policy step of the rest of the god system. Striking the seals and making ruins join in M4.
import type { Ctx } from '../../game';
import { moodOf } from '../../world';
import { checkAnswer, runAnswer, cardsOf } from './prayers';
import { checkMiracle, runMiracle } from './miracles';
import { fateTargets } from './fate';
import { checkWhisper, runWhisper } from './whisper';
import { godOf } from './geo';
import { actsOf, livingOf, ready, yearOf } from './state';
import { POLICY } from './tuning';
import './set';

export type PolicyName = 'เงียบ' | 'เมตตา' | 'ปั้นนิสัย' | 'ลงโทษ' | 'ให้ของ' | 'เก็บพลัง' | 'สุ่ม' | 'เร่งจบ';
export const POLICY_NAMES: readonly PolicyName[] = ['เงียบ', 'เมตตา', 'ปั้นนิสัย', 'ลงโทษ', 'ให้ของ', 'เก็บพลัง', 'สุ่ม', 'เร่งจบ'];

/** How each policy answers a prayer: give it when the light allows, punish the one who asked, or let a random hand choose. */
const PRAYER_WAY: Record<PolicyName, 'none' | 'give' | 'punish' | 'random'> = {
  เงียบ: 'none',
  เมตตา: 'give',
  ปั้นนิสัย: 'give',
  ลงโทษ: 'punish',
  ให้ของ: 'give',
  เก็บพลัง: 'give',
  สุ่ม: 'random',
  เร่งจบ: 'punish',
};

const try1 = (ctx: Ctx, action: 'prayer' | 'miracle' | 'whisper', args: Record<string, unknown>): boolean => {
  const why = action === 'prayer' ? checkAnswer(ctx, args) : action === 'miracle' ? checkMiracle(ctx, args) : checkWhisper(ctx, args);
  if (why) return false;
  (action === 'prayer' ? runAnswer : action === 'miracle' ? runMiracle : runWhisper)(ctx, args);
  return true;
};

function answerPrayers(ctx: Ctx, way: 'none' | 'give' | 'punish' | 'random'): void {
  if (way === 'none') return;
  const rng = ctx.rng('god.policy');
  for (const card of [...cardsOf(ctx)]) {
    if (card.silent) continue;
    if (way === 'give') try1(ctx, 'prayer', { id: card.n, answer: 'give' });
    else if (way === 'punish') try1(ctx, 'prayer', { id: card.n, answer: 'punish' });
    else {
      // sim: one of give · refuse · punish · leave it, by an equal draw; a gift the light cannot pay is left
      const pick = ['give', 'deny', 'punish', 'silent'][Math.floor(rng.next() * 4)];
      if (pick === 'give' && !try1(ctx, 'prayer', { id: card.n, answer: 'give' })) try1(ctx, 'prayer', { id: card.n, answer: 'silent' });
      else if (pick !== 'give') try1(ctx, 'prayer', { id: card.n, answer: pick });
    }
  }
}

/** Light for a whisper: the merciful keep the light above the reserve. */
function whisperMaybe(ctx: Ctx, chance: number): void {
  if (ctx.state.god.light < POLICY.whisperAt) return;
  if (!ctx.rng('god.policy').chance(chance)) return;
  for (const hint of ['ระวัง', 'กล้าเถิด', 'จงอยู่']) if (try1(ctx, 'whisper', { hint })) return;
}

/** Slow (sign −1) or speed (sign +1) the fall of the first dragon that shows an omen and carries no fate yet. */
function fateFall(ctx: Ctx, sign: -1 | 1): boolean {
  const a = actsOf(ctx.state);
  const t = fateTargets(ctx).find((x) => x.dragon !== undefined && !(a.fates[x.id] && a.fates[x.id].until > yearOf(ctx)));
  if (!t) return false;
  return try1(ctx, 'miracle', { id: 'MR-25', event: t.id, mul: sign < 0 ? POLICY.slowFall : godOf(ctx).rule.fallFate });
}

/** The living dragon of the lowest mood that no soothing or provoking has reached in the last 50 years. */
function lowestDragon(ctx: Ctx): number | undefined {
  const w = ctx.state.world;
  return w.dragons
    .map((d, i) => ({ d, i }))
    .filter((x) => x.d.alive && ready(ctx, `dragon.${x.i}`))
    .sort((p, q) => p.d.mood - q.d.mood || p.i - q.i)[0]?.i;
}

function worldStep(ctx: Ctx, policy: PolicyName): void {
  if (!livingOf(ctx)) return;
  const g = ctx.state.god;
  switch (policy) {
    case 'เมตตา':
    case 'ปั้นนิสัย': {
      fateFall(ctx, -1);
      const low = lowestDragon(ctx);
      if (low !== undefined && g.light >= POLICY.soothe.light && moodOf(ctx, low) < POLICY.soothe.below) try1(ctx, 'miracle', { id: 'MR-23', dragon: low });
      if (g.light >= godOf(ctx).rule.mahaF) try1(ctx, 'miracle', { id: 'MR-21' });
      return;
    }
    case 'เร่งจบ': {
      fateFall(ctx, 1);
      const d = lowestDragon(ctx);
      if (d !== undefined && g.dread >= POLICY.taunt) try1(ctx, 'miracle', { id: 'MR-24', dragon: d });
      if (ctx.state.world.era === 4) {
        for (const id of POLICY.endEvents) {
          const t = fateTargets(ctx).find((x) => x.id === id);
          if (t) try1(ctx, 'miracle', { id: 'MR-25', event: id, mul: godOf(ctx).rule.endFate });
        }
      }
      return;
    }
    case 'สุ่ม': {
      const r = ctx.rng('god.policy');
      if (!r.chance(POLICY.randomAct)) return;
      const x = Math.floor(r.next() * 4);
      if (x === 2) fateFall(ctx, r.chance(0.5) ? -1 : 1); // the ruin and the seal strike of the sim wait for M4
      return;
    }
    default:
  }
}

/**
 * One step of the acts under a policy. `beat`: answer the prayers that wait and, for the merciful, whisper sometimes.
 * `world`: the deeds on the dragons and the events (once per world step).
 */
export function actsPolicyStep(ctx: Ctx, policy: string, phase: 'beat' | 'world' = 'beat'): void {
  const p = policy as PolicyName;
  if (!(p in PRAYER_WAY)) return;
  if (phase === 'world') return worldStep(ctx, p);
  if (!livingOf(ctx)) return;
  answerPrayers(ctx, PRAYER_WAY[p]);
  if (p === 'เมตตา' || p === 'ปั้นนิสัย') whisperMaybe(ctx, POLICY.whisperChance);
  else if (p === 'สุ่ม') whisperMaybe(ctx, POLICY.randomWhisper);
}

