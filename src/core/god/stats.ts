// What the god did in this life, as numbers the grammar can compare (`cmp`, `count`) and as flags the storylines read (docs/lore/storylines/31-divine.md §4).
// The numbers are counted from the chronicle of the god's hand (พงศาวดารพระหัตถ์) since the character was born, so they are the same lines the player reads:
//   god.dreamsObeyed   dreams that met their node and were obeyed         god.dreamsRefused   dreams refused or defied    god.dreamsMisread
//   god.prayersIgnored prayers that lapsed one after another (a streak; any answer ends it)          god.prayersAnswered   given (also the strange gift)
//   god.punished       times the god punished him (a prayer punished, a curse picked)                god.miracles          miracles done since his birth
// The grammar of the documents (docs/guide/code-plan.md §5.2) has no word for these numbers, so the storylines read flags the god keeps on the life:
//   god_dream_obeyed (the first obeyed dream) · god_dreams_3 (three) · god_prayers_ignored_3 (three ignored in a row, gone when one is answered).
import type { Ctx } from '../game';
import { onStat } from '../rules';
import { count, gx, lifeOf } from './state';

type Entry = Ctx['state']['god']['chronicle'][number];

/** The chronicle lines written since the living character was born. */
export function lifeChronicle(ctx: Ctx): Entry[] {
  const from = gx(ctx).born ?? 0;
  return ctx.state.god.chronicle.slice(from);
}

const OUTCOME = (e: Entry, word: string): boolean => e.kind === 'dream' && new RegExp(`:${word}(?::|$)`).test(e.result ?? '');

export const dreamsObeyed = (ctx: Ctx): number => lifeChronicle(ctx).filter((e) => OUTCOME(e, 'obey')).length;
export const dreamsMisread = (ctx: Ctx): number => lifeChronicle(ctx).filter((e) => OUTCOME(e, 'misread')).length;
export const dreamsRefused = (ctx: Ctx): number => lifeChronicle(ctx).filter((e) => OUTCOME(e, 'refuse') || OUTCOME(e, 'defy')).length;

/** The prayers that lapsed one after another at the end of the life so far; a prayer answered (given, refused, punished) ends the streak. */
export function prayersIgnored(ctx: Ctx): number {
  let n = 0;
  const list = lifeChronicle(ctx).filter((e) => e.kind.startsWith('prayer.'));
  for (let i = list.length - 1; i >= 0 && list[i].kind === 'prayer.lapse'; i--) n++;
  return n;
}

export const prayersAnswered = (ctx: Ctx): number => lifeChronicle(ctx).filter((e) => e.kind === 'prayer.give' || e.kind === 'prayer.strange').length;
export const punished = (ctx: Ctx): number => count(ctx, 'l.punished');
export const miraclesDone = (ctx: Ctx): number => lifeChronicle(ctx).filter((e) => e.kind === 'miracle').length;

/** Name → reader. The Thai names are the words the documents use for the same numbers. */
export const GOD_STATS: Record<string, (ctx: Ctx) => number> = {
  'god.dreamsObeyed': dreamsObeyed,
  'ฝันที่ทำตาม': dreamsObeyed,
  'god.dreamsMisread': dreamsMisread,
  'god.dreamsRefused': dreamsRefused,
  'ฝันที่ปฏิเสธ': dreamsRefused,
  'god.prayersIgnored': prayersIgnored,
  'คำอธิษฐานที่ถูกเมิน': prayersIgnored,
  'god.prayersAnswered': prayersAnswered,
  'god.punished': punished,
  'god.miracles': miraclesDone,
};

/** Registers the numbers with the rules. Called with the other god rules; `force` swallows the error of a second call (tests that reset the registry). */
export function registerGodStats(force = false): void {
  for (const [name, read] of Object.entries(GOD_STATS)) {
    try {
      onStat(name, { read });
    } catch (err) {
      if (!force) throw err;
    }
  }
}

/** The flags of `FLAGS`: given when the number holds, taken away when it stops (the streak of ignored prayers). */
const FLAGS: [string, (ctx: Ctx) => boolean][] = [
  ['god_dream_obeyed', (ctx) => dreamsObeyed(ctx) >= 1],
  ['god_dreams_3', (ctx) => dreamsObeyed(ctx) >= 3],
  ['god_prayers_ignored_3', (ctx) => prayersIgnored(ctx) >= 3],
];

/** Keeps the flags of the life in step with the numbers. Called where a number changes (a dream settled, a prayer lapsed or answered). */
export function syncFlags(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  for (const [flag, holds] of FLAGS) {
    const has = life.flags.includes(flag);
    if (holds(ctx) && !has) life.flags.push(flag);
    else if (!holds(ctx) && has) life.flags.splice(life.flags.indexOf(flag), 1);
  }
}
