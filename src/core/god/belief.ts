// The character's belief in the god (ศรัทธาเทพ, `life.godFaith`, −100..100): how it changes, its bands, and the tags the bands give
// (01-power.md §3, data/gen/god.json `belief`). Systems that change it for the god (chest, dream, prayer, miracle) call `addBelief`.
import { giveId, takeId } from '../character';
import { write } from '../log';
import type { Ctx } from '../game';
import { godData, lifeOf } from './state';
import { KNOWS_GOD_AT } from './tuning';

export type BeliefBand = 'devoted' | 'believer' | 'wavering' | 'heretic' | 'hater';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function bandOf(belief: number): BeliefBand {
  if (belief >= 50) return 'devoted';
  if (belief >= 20) return 'believer';
  if (belief >= -29) return 'wavering';
  if (belief >= -69) return 'heretic';
  return 'hater';
}

/** Band tags the other systems read (01-power.md §3: `devoted` `heretic` `godslayer`). */
const TAGS: Record<BeliefBand, string[]> = { devoted: ['devoted'], believer: [], wavering: [], heretic: ['heretic'], hater: ['heretic', 'godslayer'] };
const ALL_TAGS = ['devoted', 'heretic', 'godslayer'];

function syncTags(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life) return;
  const want = new Set(TAGS[bandOf(life.godFaith)]);
  for (const t of ALL_TAGS) {
    if (want.has(t)) giveId(ctx, life, 'tag', t);
    else takeId(ctx, life, 'tag', t);
  }
}

export interface BeliefOpts {
  /** The change comes from a gift (chest): a character who does not know the god gave it feels half (02-bestow.md §4). */
  gift?: boolean;
}

/**
 * Changes the belief of the living character; returns the change that was made (after halving and the clamp).
 * The cause is written to the log at level 0 so a tool can show why the number moved.
 */
export function addBelief(ctx: Ctx, delta: number, why: string, opts: BeliefOpts = {}): number {
  const life = lifeOf(ctx);
  if (!life || delta === 0) return 0;
  let d = delta;
  if (opts.gift && life.godFaith < KNOWS_GOD_AT) d = delta / 2;
  const before = life.godFaith;
  life.godFaith = clamp(before + d, -100, 100);
  const made = life.godFaith - before;
  write(ctx.state, { sys: 'god', kind: 'belief', id: why, data: { delta: Math.round(made * 100) / 100, belief: Math.round(life.godFaith * 100) / 100 }, level: 0 });
  if (bandOf(before) !== bandOf(life.godFaith)) syncTags(ctx);
  return made;
}

/** Feelings fade toward 0 after the quiet years (01-power.md §3 last row). */
export function fade(ctx: Ctx): void {
  const life = lifeOf(ctx);
  if (!life || !ctx.data.god) return;
  const f = godData(ctx).belief.fade;
  if (life.godFaith > 0) addBelief(ctx, -Math.min(f.perYear, life.godFaith), 'fade');
  else if (life.godFaith < 0) addBelief(ctx, Math.min(f.perYear, -life.godFaith), 'fade');
}
