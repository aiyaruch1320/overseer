// The late parts of the wish (19-wish.md §2): the family of the infant and the story lines, which need the births of the bonds and the story systems to have run.
// It calls the bond system, and the character system is imported by the bond system's own dependencies (a cycle at load time), so the character system does not import
// this file: src/core/systems.ts does, and this file registers itself in `lateWish`, which the first beat of the character system runs.
import type { Ctx } from '../game';
import { addTie, endTie } from '../bonds/people';
import { extOf as bondsExt, isLive, reindex, tiesOf } from '../bonds/state';
import { extOf } from './data';
import { WISH_LINES, WISH_WORDS } from './tuning';
import { lateWish } from './wish-apply';
import type { LifeState } from '../types';

/**
 * The parts of the wish that need the other systems' births: the family of the infant (bonds draws it at birth, here the wish changes it) and the story
 * lines opened from outside. Called once, at the first beat, before the other systems' beats.
 */
export function applyWishLate(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  const w = e.wish?.ask;
  if (!w || e.wishLate) return;
  e.wishLate = true;
  const rng = ctx.rng('life.wish');
  const refuse = (key: string, value: string, reason: string) => e.wish?.born?.refused.push({ key, value, reason });

  if (w.family && life.ext.bonds) {
    const b = bondsExt(life);
    const kin = (...names: string[]) => tiesOf(b).filter((t) => t.light && isLive(t) && names.includes(t.kin ?? ''));
    switch (w.family) {
      case 'orphan':
        // the peoples of the origin file have one elder 'parent' tie instead of a father and a mother
        for (const t of kin('father', 'mother', 'parent')) endTie(ctx, t, 'death', 'wish', { cause: 'orphan' });
        break;
      case 'single': {
        const parents = kin('father', 'mother', 'parent');
        if (!parents.length) refuse('family', 'พ่อหรือแม่คนเดียว', WISH_WORDS.noParents);
        else if (parents.length > 1) endTie(ctx, parents[rng.int(0, parents.length - 1)], 'death', 'wish', { cause: 'orphan' });
        break;
      }
      case 'only':
        for (const t of kin('elder_sibling', 'younger_sibling')) {
          delete b.ties[t.id];
          b.counts.ties--;
        }
        reindex(b);
        break;
      case 'many': {
        // a big house: at least four brothers and sisters, the ones born with the life stay
        const have = kin('elder_sibling', 'younger_sibling').length;
        for (let i = have; i < Math.max(4, have + 2); i++) {
          const elder = rng.chance(0.5);
          addTie(ctx, life, { line: 'พี่น้อง', level: 3, from: 'kin', kin: elder ? 'elder_sibling' : 'younger_sibling', light: true, quiet: true, gap: elder ? rng.int(1, 8) : -rng.int(1, 8), race: 'same' });
        }
        break;
      }
    }
  }

  // the story part: a line opened from outside (the story system's `external`), the ask itself stays on the sheet for the systems that read it
  const sx = life.ext.story as { external?: string[]; open?: Record<string, boolean> } | undefined;
  if (sx) {
    for (const id of w.story ?? []) {
      const line = WISH_LINES[id];
      if (!line) continue;
      (sx.external ??= []).includes(line) || sx.external.push(line);
      if (sx.open) delete sx.open[line];
    }
  } else if (w.story?.some((id) => WISH_LINES[id])) refuse('story', w.story.join(','), WISH_WORDS.placeNotFound);
}

lateWish.push(applyWishLate);
