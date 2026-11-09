// The Looks the screens draw (code-plan §9.2): the main character from the life, the people of the circle from the roster or the race, the foe of a
// fight from the beast looks. Pure over (data, state); no DOM. The screens call these and hand the Look to the sprite (src/ui/figure.tsx); the view models
// of the screens do not hold Looks (they hold only what a player reads: the screens' tests scan every string of a model).
import { extOf as bondsExt, hAgeOf, tiesOf, type Tie } from '../../core/bonds';
import type { LooksData } from '../../core/data/types-looks';
import { makeCtx, type Ctx, type GameData } from '../../core/game';
import { items } from '../../core/text/labels';
import type { GameState, LifeState } from '../../core/types';
import { mainLook } from '../../art/main-look';
import { DRAGONS, beastOf, type BeastLook } from '../../art/beast/look';
import type { PersonLook } from '../../art/look';
import { stageOf } from '../../art/look';
import { npcBeast } from '../../art/npc-beasts';
import { npcLook, raceLook } from '../../art/resolve';
import { lifeStartN } from './watch';

const looksOf = (data: GameData): LooksData | undefined => items<LooksData>(data, 'looks');

/** The life has a scar from a fight: the wound `scar` of a lost fight is written in the log only (src/core/combat/reward.ts). */
export function scarredOf(state: GameState): boolean {
  const from = lifeStartN(state);
  return state.log.some((e) => e.n >= from && e.sys === 'combat' && e.kind === 'wound' && String(e.data.wounds ?? '').split(',').includes('scar'));
}

/** The Look of the life on the stage (a dead life is drawn at the age it died). Null while the data holds no looks or there is no life. */
export function mainLookOf(data: GameData, state: GameState, life: LifeState | null = state.life): PersonLook | null {
  if (!life || !looksOf(data)) return null;
  return mainLook(life, data, { scarred: scarredOf(state), ...(life.dead ? { hAge: life.dead.hAge } : {}) });
}

/** The Look of one person of the circle: the roster person when the tie stands for one, else a person of the race, seeded by the tie. */
export function tieLookOf(data: GameData, ctx: Ctx, t: Tie): PersonLook | null {
  const looks = looksOf(data);
  if (!looks) return null;
  const age = t.state === 'dead' && t.died ? t.died.age : Math.max(0, hAgeOf(ctx, t));
  const stage = stageOf(age);
  const fem = t.gender === 'f';
  if (t.npc && looks.npcs[t.npc]) return npcLook(looks, t.npc, { stage, fem: looks.npcs[t.npc].fem ?? fem });
  if (!looks.races[t.race]) return null;
  return raceLook(looks, t.race, { stage, fem, seed: t.id, kin: true });
}

/** The Looks of every tie of the life, by tie id; an NPC who is a creature (src/art/npc-beasts.ts) is its beast. */
export function tieLooks(data: GameData, state: GameState): Map<string, PersonLook | BeastLook> {
  const out = new Map<string, PersonLook | BeastLook>();
  const life = state.life;
  if (!life || !life.ext.bonds || !looksOf(data)) return out;
  const ctx = makeCtx(state, data);
  for (const t of tiesOf(bondsExt(life))) {
    const beast = t.npc ? npcBeast(t.npc) : null;
    if (beast) { out.set(t.id, beast); continue; }
    const L = tieLookOf(data, ctx, t);
    if (L) out.set(t.id, L);
  }
  return out;
}

/** The beast that stands for the foe of a fight: an enemy of the 200 by id, a dragon of the fifteen by `dragon:<name>`. Undefined where the docs hold no look for it. */
export function foeBeastOf(lead: string): BeastLook | undefined {
  if (lead.startsWith('dragon:')) {
    const name = lead.slice('dragon:'.length);
    return DRAGONS.find((d) => d.name === name || d.id === name);
  }
  return beastOf(lead);
}
