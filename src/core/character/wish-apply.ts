// What the birth does with the parts of the wish that are not a draw of the birth itself (19-wish.md §2): the sheet is kept on the life, the first-job
// intent and the companion are checked, and the things that need the other systems' births to have run (the family of the infant, the story lines)
// are done at the first beat (`wish-system.ts`). All of it is deterministic: the draws come from the stream `life.wish`.
import type { Ctx } from '../game';
import { apply } from '../rules';
import type { LifeState } from '../types';
import { extOf, idx } from './data';
import { jobWeight } from './jobs';
import { WISH_CHILD_ANIMAL, WISH_WEIGHT, WISH_WORDS } from './tuning';
import type { WishAsk, WishSheet } from './wish';

/** The sheet item a field of the ask belongs to (the keys of `SheetItem`), to tell what was applied. */
const ASK_ITEM: Record<string, string> = {
  race: 'race', second: 'half', country: 'country', continent: 'continent', placeKind: 'placeKind', gender: 'gender', neuter: 'gender', sign: 'birthSign', time: 'birthTime',
  specialBirth: 'specialBirth', cls: 'class', family: 'family', faith: 'religion', traits: 'trait', aptitudes: 'aptitude', job: 'job', companion: 'companion',
  blessing: 'blessing', curse: 'curse', story: 'story', era: 'era',
};

interface CompanionRules {
  rules: { childEventChance: number; raceMultiplier: { races: string[]; mul: number }[] };
  species: { id: string }[];
}

/** The late parts of the wish, registered by `wish-system.ts` (see there for why the character system does not import them). */
export const lateWish: ((ctx: Ctx, life: LifeState) => void)[] = [];

/** The wish sheet of a life, as saved at birth (`life.ext.character.wish`); undefined for a life nobody ordered. */
export const wishOf = (life: LifeState): WishSheet | undefined => extOf(life).wish;

/**
 * Keeps the sheet on the life and does what is left of the wish at birth: checks that the job asked for is open to this life (a weight of 0 is told on the
 * sheet: 20-wish-synonyms.md §9), weighs the companion species asked for in the later draws, and draws the childhood meeting with it (the 2% of
 * 13-companions-overview.md ×3). `refused` holds what the birth could not keep, with the reason; it goes to the sheet.
 */
export function startWishLife(ctx: Ctx, life: LifeState, sheet: WishSheet, refused: { key: string; value: string; reason: string }[]): void {
  const e = extOf(life);
  const w: WishAsk = sheet.ask;
  const ix = idx(ctx);
  const refuse = (key: string, value: string, reason: string) => refused.push({ key, value, reason });
  if (w.job) {
    const job = ix.jobs.get(w.job);
    if (!job) refuse('job', w.job, WISH_WORDS.unknownValue);
    else if (jobWeight(ctx, job) === 0) refuse('job', job.name, WISH_WORDS.jobCannot);
  }
  if (w.companion) {
    const comp = ctx.data.companions?.items as CompanionRules | undefined;
    if (!comp?.species.some((s) => s.id === w.companion)) refuse('companion', w.companion, WISH_WORDS.unknownValue);
    else {
      e.favour[`companion:${w.companion}`] = WISH_WEIGHT;
      const mul = comp.rules.raceMultiplier.find((r) => r.races.includes(life.race))?.mul ?? 1;
      const rng = ctx.rng('life.wish');
      const hit = rng.chance(Math.min(1, comp.rules.childEventChance * WISH_CHILD_ANIMAL.mul * mul));
      const age = rng.int(WISH_CHILD_ANIMAL.fromAge, WISH_CHILD_ANIMAL.toAge);
      // a life that begins grown (the late wakers, the summoned) has no childhood left: the meeting comes in its first year
      if (hit) e.wishChild = { age: Math.max(age, life.hAge + 1), id: w.companion };
    }
  }
  const bad = new Set(refused.map((r) => r.key));
  const applied = [...new Set(Object.keys(w).filter((k) => k !== 'ban' && k !== 'special' && ASK_ITEM[k] && !bad.has(ASK_ITEM[k])).map((k) => ASK_ITEM[k]))];
  e.wish = { ...structuredClone(sheet), born: { applied, refused: [...refused] } };
}

/** The companion of the childhood arrives (a life year of the character system). */
export function wishChildYear(ctx: Ctx, life: LifeState): void {
  const c = extOf(life).wishChild;
  if (!c || c.done || life.hAge < c.age) return;
  c.done = true;
  apply(ctx, [{ k: 'grant', kind: 'companion', id: c.id }], { sys: 'character', id: 'wish.companion', stream: 'life.wish' });
}
