// The weakness matrix (docs/systems/combat/02-type-matrix.md): which attack tag works on which kind of enemy.
// Marks ★ +6 (and two wounds) · ▲ +4 · · 0 · ▼ −4 · ✕ the stance cannot be used. The numbers are read from combat.json (`roll`).
import type { Ctx } from '../game';
import type { Mark, MatrixCell, Reaction } from '../data/types-combat';
import { indexOf } from './data';
import { BANE_TAG } from './tuning';
import type { Foe } from './types';

export const PHYSICAL_TAGS = ['blade', 'blunt', 'pierce', 'ranged', 'poison', 'silver', 'iron'] as const;
export const ELEMENT_TAGS = ['fire', 'ice', 'lightning', 'water', 'earth', 'wind'] as const;
export const SPECIAL_TAGS = ['light', 'holy', 'dark', 'necro', 'blood', 'rune', 'charm', 'illusion', 'music'] as const;
export const ATTACK_TAGS: ReadonlySet<string> = new Set<string>([...PHYSICAL_TAGS, ...ELEMENT_TAGS, ...SPECIAL_TAGS]);
/** What the enemy table means by `physical`. */
const PHYSICAL_BLOWS = ['blade', 'blunt', 'pierce', 'ranged'];

const RANK: Record<Mark, number> = { '★': 4, '▲': 3, '·': 2, var: 2, '▼': 1, '✕': 0 };

const cell = (t: Record<string, Record<string, MatrixCell>>, kind: string, tag: string): Mark => t[kind]?.[tag]?.mark ?? '·';

/** The mark of one attack tag against a foe: its own rows first, then the table of its kinds. */
export function markOf(ctx: Ctx, foe: Foe, tag: string): Mark {
  const exact = (list: Reaction[]) => list.find((r) => r.tag === tag);
  const hit = exact(foe.resist) ?? exact(foe.weak);
  if (hit) return hit.mark;
  if (PHYSICAL_BLOWS.includes(tag)) {
    const phys = foe.resist.find((r) => r.tag === 'physical') ?? foe.weak.find((r) => r.tag === 'physical');
    if (phys) return phys.mark;
  }
  const m = indexOf(ctx).combat.matrix;
  const table = (PHYSICAL_TAGS as readonly string[]).includes(tag) ? m.physical : (ELEMENT_TAGS as readonly string[]).includes(tag) ? m.element : m.special;
  for (const k of foe.kinds) {
    const mark = cell(table, k, tag);
    if (mark !== '·' && mark !== 'var') return mark;
  }
  return '·';
}

export interface Hit {
  mark: Mark;
  bonus: number;
  /** Every tag is ✕: the stance cannot be used. */
  blocked: boolean;
  /** The tag that decided it. */
  tag?: string;
  /** Two wounds on a hit (★). */
  heavy: boolean;
}

/** The best mark among the tags of a stance (a sword with a flame is judged by the flame); none: normal. A kill tag (`#undead_bane`) is ★ on its kind. */
export function bestHit(ctx: Ctx, foe: Foe, tags: readonly string[], heroTags: ReadonlySet<string>): Hit {
  const roll = indexOf(ctx).combat.roll;
  const pts = (m: Mark) => (m === '★' ? roll.veryWeak : m === '▲' ? roll.weak : m === '▼' ? roll.resist : 0);
  for (const [bane, kind] of Object.entries(BANE_TAG)) {
    if (heroTags.has(bane) && foe.kinds.includes(kind)) return { mark: '★', bonus: roll.veryWeak, blocked: false, tag: bane, heavy: true };
  }
  const attack = tags.filter((t) => ATTACK_TAGS.has(t));
  if (!attack.length) return { mark: '·', bonus: 0, blocked: false, heavy: false };
  let best: { mark: Mark; tag: string } | undefined;
  for (const t of attack) {
    const mark = markOf(ctx, foe, t);
    if (mark === '✕') continue;
    if (!best || RANK[mark] > RANK[best.mark]) best = { mark, tag: t };
  }
  if (!best) return { mark: '✕', bonus: 0, blocked: true, tag: attack[0], heavy: false };
  return { mark: best.mark, bonus: pts(best.mark), blocked: false, tag: best.tag, heavy: best.mark === '★' };
}

/** True when a tag is one the foe is hurt by (▲ or ★) for the "element of the weapon matches the weak point" bonus. */
export const hurts = (m: Mark): boolean => m === '▲' || m === '★';
