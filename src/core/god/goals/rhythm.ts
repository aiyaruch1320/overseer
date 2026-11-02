// The rhythm of fate (08-goals.md §5) and the price of too much help (§6). Both change the weight of the personal ways of the character's story and nothing the
// world does, so the world simulation stays as it is. The story asks the god system before it decides a node (`onNode`), and the god system puts pulls on the ways.
//   rhythm   chosen at the start of the world; "ตามธรรมชาติ" is always there, the others open at 20 points of the chronicle
//   overreach  10 gifts (a blessing, a skill, an item; a curse is not one): the ways that need his own effort ×0.9 · 15 gifts: ×0.8 and the title "ผู้รอฟ้า" ·
//              ten life years with no gift after that: back to ×1
// Other readings of the rhythm (random fights, prayers, bad fates, a dream misread, a gift that comes the strange way) are numbers for the systems that own those rolls:
// `rhythmMul(ctx, kind)` answers them (tuning.ts RHYTHM_MUL lists the kinds).
import type { Ctx } from '../../game';
import type { StoryNodeX } from '../../data/types-storylines';
import { write } from '../../log';
import { extOf as storyExt } from '../../story/state';
import { godData } from '../state';
import { giftsReceived } from './facts';
import { lifeGoals, living, metaOf, peekGoals, peekLife } from './state';
import { CLOSE_WORDS, DEATH_WORDS, EFFORT_WORDS, LOSS_WORDS, NATURAL, RHYTHM_ID, RHYTHM_MUL } from './tuning';
import { unlocked } from './unlocks';

const has = (s: string, words: readonly string[]) => words.some((w) => s.includes(w));

/** The rhythm of the world now (`natural` when none was chosen). */
export const rhythmOf = (ctx: Ctx): string => peekGoals(ctx.state).meta.rhythm || NATURAL;

/** Rhythms that exist, by id, with the name the document gives. */
export function rhythms(ctx: Ctx): { id: string; name: string; effect: string; open: boolean }[] {
  const open = unlocked(ctx).rhythms;
  return godData(ctx).goals.rhythms.map((r) => {
    const id = RHYTHM_ID[r.name] ?? r.name;
    return { id, name: r.name, effect: r.effect, open: id === NATURAL || open };
  });
}

/** Why a rhythm cannot be chosen, or null. */
export function checkRhythm(ctx: Ctx, id: string): string | null {
  const r = rhythms(ctx).find((x) => x.id === id);
  if (!r) return `ไม่มีจังหวะชะตา ${id}`;
  if (!r.open) return 'จังหวะชะตานี้ยังไม่เปิด (เปิดเมื่อพงศาวดารสายตระกูลถึง 20)';
  return null;
}

/** Chooses the rhythm of the world (the player does it at the start of the world). */
export function chooseRhythm(ctx: Ctx, id: string): void {
  metaOf(ctx).rhythm = id;
  write(ctx.state, { sys: 'god', kind: 'rhythm', id, data: { name: rhythms(ctx).find((x) => x.id === id)?.name ?? id }, level: 1 });
}

/** The multiplier of one kind of roll under the rhythm of the world (1 when the rhythm does not touch it). */
export const rhythmMul = (ctx: Ctx, kind: string): number => RHYTHM_MUL[kind]?.[rhythmOf(ctx)] ?? 1;

/** Overreach: the multiplier of the ways that need his own effort now. */
export function overreachMul(ctx: Ctx): number {
  const life = ctx.state.life;
  if (!life || life.dead) return 1;
  const n = giftsReceived(ctx);
  const over = godData(ctx).goals.overreach;
  const top = over.find((o) => o.count === 15)?.mul ?? 0.8;
  const mid = over.find((o) => o.count === 10)?.mul ?? 0.9;
  const m = n >= 15 ? top : n >= 10 ? mid : 1;
  if (m === 1) return 1;
  // ten life years with no gift: the weight comes back (the last gift is the one the year-step saw last)
  const last = peekLife(life).track.lastGift;
  return last !== undefined && life.hAge - last >= 10 ? 1 : m;
}

/** The pull of the rhythm and of the overreach on one way of a node, from the words of the way. */
export function pullOn(ctx: Ctx, label: string): number {
  let m = 1;
  const rid = rhythmOf(ctx);
  if (rid !== NATURAL) {
    if (has(label, DEATH_WORDS) && has(label, CLOSE_WORDS)) m *= RHYTHM_MUL.closeDeath[rid] ?? 1;
    else if (has(label, DEATH_WORDS) || has(label, LOSS_WORDS)) m *= RHYTHM_MUL.loss[rid] ?? 1;
  }
  if (has(label, EFFORT_WORDS)) m *= overreachMul(ctx);
  return m;
}

const MINE = 'god.goals';
interface Mod {
  to: string;
  choice: 'a' | 'b' | 'c';
  mul: number;
  from?: string;
}

/** The story is about to decide a node: put the pulls on its ways (hook `before` of `onNode`). */
export function armNode(ctx: Ctx, node: StoryNodeX): void {
  const life = living(ctx);
  if (!life) return;
  if (rhythmOf(ctx) === NATURAL && overreachMul(ctx) === 1) return;
  const ex = storyExt(life);
  for (const c of node.choices) {
    const mul = pullOn(ctx, c.label);
    if (mul !== 1) (ex.entryMods as Mod[]).push({ to: node.id, choice: c.key, mul, from: MINE });
  }
}

/** The node was decided: the pulls of this system are taken out again (hook `after`). */
export function settleNode(ctx: Ctx): void {
  const life = living(ctx);
  if (!life) return;
  const ex = storyExt(life);
  if (ex.entryMods.some((m) => (m as Mod).from === MINE)) ex.entryMods = ex.entryMods.filter((m) => (m as Mod).from !== MINE);
}

/** Once a life year: remembers when the last gift came (for the ten quiet years), and tells when the people near him begin to say he waits for the sky. */
export function yearStep(ctx: Ctx): void {
  const life = living(ctx);
  if (!life) return;
  const g = lifeGoals(life);
  const n = giftsReceived(ctx);
  if (n > (g.track.gifts ?? 0)) g.track.lastGift = life.hAge;
  if ((g.track.gifts ?? 0) < 15 && n >= 15) write(ctx.state, { sys: 'god', kind: 'overreach', id: 'wait', data: { gifts: n }, level: 1 });
  g.track.gifts = n;
}
