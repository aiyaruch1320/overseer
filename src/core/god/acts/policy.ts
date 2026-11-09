// The part the acts play in the policies of the god (god/06-implementation.md §4 table "นโยบาย"): how prayers are answered, when a
// whisper is sent, and what is done to the dragons and the events of the world. The driver (the tools, the balance tests) calls
// `actsPolicyStep(ctx, policy, 'beat')` after every beat and `actsPolicyStep(ctx, policy, 'world')` at every world step. The other acts
// (chests, dreams) belong to the policy step of the rest of the god system. Making ruins and striking the seals are in the world step (G5).
import type { Ctx } from '../../game';
import { moodOf } from '../../world';
import { crisesWaiting } from '../../bonds';
import { momentsOf, policyName, registerDreadReserve, type PolicyName } from '../policy';
import { checkAllyDream, dreamPrice, sendAllyDream } from '../dream';
import { RESERVE } from '../tuning';
import { checkAnswer, runAnswer, cardsOf } from './prayers';
import { checkMiracle, previewMiracle, runMiracle } from './miracles';
import { fateTargets } from './fate';
import { checkWhisper, runWhisper } from './whisper';
import { allCountries, godOf, hasFlag, neighboursOf } from './geo';
import { homesOf, sealAt } from '../ruin';
import { actsOf, livingOf, ready, yearOf } from './state';
import { POLICY } from './tuning';
import { NEAR_RUIN, RUIN_MIRACLE, STRIKE } from '../ruin/tuning';
import './set';

export type { PolicyName } from '../policy';
/** The policies of the document (06-implementation.md §4), as the tools name them. */
export const POLICY_NAMES: readonly string[] = ['เงียบ', 'เมตตา', 'ปั้นนิสัย', 'ลงโทษ', 'ให้ของ', 'เก็บพลัง', 'สุ่ม', 'เร่งจบ'];

/** How each policy answers a prayer: give it when the light allows, punish the one who asked, or let a random hand choose. */
const PRAYER_WAY: Record<PolicyName, 'none' | 'give' | 'punish' | 'random'> = {
  silent: 'none',
  merciful: 'give',
  shaper: 'give',
  punish: 'punish',
  seal: 'punish',
  giver: 'give',
  saver: 'give',
  random: 'random',
  hasten: 'punish',
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

/** One whisper at a moment of the year (a node played, an age stop): the merciful send one while the light is above the reserve, the random god one in six moments. */
function whisperAtMoment(ctx: Ctx, policy: PolicyName): void {
  if (policy === 'random') {
    if (!ctx.rng('god.policy').chance(POLICY.randomWhisper)) return;
  } else if (ctx.state.god.light < POLICY.whisperAt) return;
  for (const hint of ['ระวัง', 'กล้าเถิด', 'จงอยู่']) if (try1(ctx, 'whisper', { hint })) return;
}

/**
 * The merciful god helps an ally whose crisis the game has called him for (M3 review H5): a whisper `ช่วย` on him while the light is above the reserve, and when the
 * crisis still waits after it, a dream of the ally (03-dreams.md §5 "วิกฤตขั้น 3 ของพวกพ้อง"; 06-implementation.md §4: the merciful god dreams whenever the light allows) if the
 * light stays above the reserve after its price.
 */
function helpAllies(ctx: Ctx): void {
  for (const w of crisesWaiting(ctx)) {
    if (ctx.state.god.light >= POLICY.whisperAt) try1(ctx, 'whisper', { hint: 'ช่วย', target: w.tie.id });
    if (!crisesWaiting(ctx).some((x) => x.tie.id === w.tie.id)) continue;
    const args = { ally: w.tie.id };
    if (checkAllyDream(ctx, args) || ctx.state.god.light < RESERVE + (dreamPrice(ctx).faith ?? 0)) continue;
    sendAllyDream(ctx, args);
  }
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

/** The countries a god who punishes may make a ruin of: not a seal, not a ruin or a fallen country already. */
function ruinCandidates(ctx: Ctx): string[] {
  return allCountries(ctx).filter((c) => !sealAt(ctx, c) && !hasFlag(ctx, c, 'god_ruin', 'fallen'));
}

/** MR-17 on a country the rng picks, when the miracle can be used at all (caps, waits and the dread are the command layer's). */
function makeRuinOnce(ctx: Ctx): boolean {
  const list = ruinCandidates(ctx);
  if (!list.length || checkMiracle(ctx, { id: RUIN_MIRACLE, country: list[0] })) return false;
  const r = ctx.rng('god.policy');
  // one ruin in three falls next to the character (never on his own country, which the vow GV-16 guards): the god who punishes does it where it is seen, and the nodes `mr` of the story have a life to touch
  const life = livingOf(ctx);
  const near = life ? neighboursOf(ctx, life.country).filter((c) => list.includes(c)) : [];
  const pick = near.length && r.chance(NEAR_RUIN) ? near[r.int(0, near.length - 1)] : list[r.int(0, list.length - 1)];
  return try1(ctx, 'miracle', { id: RUIN_MIRACLE, country: pick });
}

/** A blow on a seal: the large miracle if it can be used, else the mid one (sim `strike(t, true) || strike(t, false)`). `pick` chooses the dragon: the lowest mood or any. */
function strikeSealOnce(ctx: Ctx, pick: 'lowest' | 'random'): boolean {
  const w = ctx.state.world;
  const y = yearOf(ctx);
  const protect = (ctx.state.god.ext.ruin as { protect?: Record<string, number> } | undefined)?.protect ?? {};
  const open = w.dragons
    .map((d, i) => ({ d, i, home: homesOf(ctx, i).find((c) => ready(ctx, 'seal.' + c) && (protect[c] ?? 0) <= y) }))
    .filter((x) => x.d.alive && x.home);
  if (!open.length) return false;
  const t = pick === 'lowest' ? [...open].sort((a, b) => a.d.mood - b.d.mood || a.i - b.i)[0] : open[ctx.rng('god.policy').int(0, open.length - 1)];
  return try1(ctx, 'miracle', { id: STRIKE.big, country: t.home }) || try1(ctx, 'miracle', { id: STRIKE.mid, country: t.home });
}

function worldStep(ctx: Ctx, policy: PolicyName): void {
  if (!livingOf(ctx)) return;
  const g = ctx.state.god;
  switch (policy) {
    case 'merciful':
    case 'shaper': {
      fateFall(ctx, -1);
      const low = lowestDragon(ctx);
      if (low !== undefined && g.light >= POLICY.soothe.light && moodOf(ctx, low) < POLICY.soothe.below) try1(ctx, 'miracle', { id: 'MR-23', dragon: low });
      if (g.light >= godOf(ctx).rule.mahaF) try1(ctx, 'miracle', { id: 'MR-21' });
      return;
    }
    case 'hasten': {
      fateFall(ctx, 1);
      strikeSealOnce(ctx, 'lowest');
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
    case 'random': {
      const r = ctx.rng('god.policy');
      if (!r.chance(POLICY.randomAct)) return;
      const x = Math.floor(r.next() * 4);
      if (x === 0) makeRuinOnce(ctx);
      else if (x === 1) strikeSealOnce(ctx, 'random');
      else if (x === 2) fateFall(ctx, r.chance(0.5) ? -1 : 1);
      return;
    }
    case 'punish':
      makeRuinOnce(ctx);
      return;
    case 'seal':
      strikeSealOnce(ctx, 'random');
      return;
    default:
  }
}

export type ActsPhase = 'prayers' | 'whispers' | 'beat' | 'world';

/**
 * One step of the acts under a policy, named in Thai (`เมตตา`) or English (`merciful`).
 * `prayers`: answer the prayers that wait. `whispers`: a whisper at each moment of the year. `beat`: both. `world`: the deeds on the dragons and the events,
 * once per world step. The life year phases are played by `policyStep` of the god system through the parts registered in index.ts, not by the tools.
 */
export function actsPolicyStep(ctx: Ctx, policy: string, phase: ActsPhase = 'beat'): void {
  const p = policyName(policy);
  if (!p) return;
  if (phase === 'world') return worldStep(ctx, p);
  if (!livingOf(ctx)) return;
  if (phase === 'prayers' || phase === 'beat') answerPrayers(ctx, PRAYER_WAY[p]);
  if (phase === 'whispers' || phase === 'beat') {
    if (p === 'merciful' || p === 'shaper') helpAllies(ctx);
    if (p === 'merciful' || p === 'shaper' || p === 'random') for (let m = momentsOf(ctx); m > 0 && livingOf(ctx); m--) whisperAtMoment(ctx, p);
  }
}

// ---------- the dread kept for the deed ----------

const DREAD_SHORT = 'ความหวาดกลัวไม่พอ';
/** The dread a miracle costs, when it can be done now or the dread is the only thing that stops it (caps, waits and the target are fine); else 0, nothing to wait for. */
function dreadHeldFor(ctx: Ctx, args: Record<string, unknown>): number {
  const why = checkMiracle(ctx, args);
  if (why && !why.startsWith(DREAD_SHORT)) return 0;
  return Number((previewMiracle(ctx, args).cost as { dread?: number }).dread ?? 0);
}

/**
 * The chests of a god who punishes spend every point of dread on curses, so the 60 of a ruin (MR-17) was never in hand (review round two R2: the real income is
 * 0.3 a year and a punished prayer 6 to 10, while the sim measured its 2.0 a year *after* the prayers with no chests). A policy that wants a deed of the world keeps its dread back
 * for it: the punishing god for the ruin, the one who strikes the seals for the blow, the random one for the ruin it may draw. Once the deed cannot be done for another reason (the cap of the life, the wait
 * of the world) nothing is held and the chests spend as before.
 */
registerDreadReserve((ctx, p) => {
  if (!livingOf(ctx)) return 0;
  if (p === 'punish' || p === 'random') {
    const c = ruinCandidates(ctx)[0];
    return c ? dreadHeldFor(ctx, { id: RUIN_MIRACLE, country: c }) : 0;
  }
  if (p === 'seal') {
    const y = yearOf(ctx);
    const protect = (ctx.state.god.ext.ruin as { protect?: Record<string, number> } | undefined)?.protect ?? {};
    const home = ctx.state.world.dragons.flatMap((d, i) => (d.alive ? homesOf(ctx, i) : [])).find((c) => ready(ctx, 'seal.' + c) && (protect[c] ?? 0) <= y);
    return home ? dreadHeldFor(ctx, { id: STRIKE.mid, country: home }) : 0;
  }
  return 0;
});
