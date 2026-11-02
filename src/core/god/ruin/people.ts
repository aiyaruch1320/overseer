// What happens to the people of a country when a large miracle falls on it (04-miracles.md §5.1 and §5.4): the NPCs, the allies of the character,
// the character himself. The dice are the document's (data/gen/god.json `miracles.ruin.numbers` for a ruin, `miracles.seal.crack` for a cracked city),
// drawn from the stream `god.ruin` in a fixed order (ids sorted), so the same seed gives the same survivors.
import type { Ctx } from '../../game';
import { apply } from '../../rules';
import { alliesOf, endTie, isChild, isPartner, type Tie } from '../../bonds';
import { npcIndex } from '../../npc/data';
import { slotsOf } from '../../npc/types';
import type { CountryId } from '../../types';
import { godOf, hasFlag, neighboursOf } from '../acts/geo';
import { killNpc } from '../acts/npcs';
import { livingOf, yearOf } from '../acts/state';
import { STREAM } from './tuning';

export interface Dice {
  die: number;
  flee: number;
  stay: number;
}

export interface Fates {
  died: string[];
  fled: string[];
  stayed: string[];
  leader?: string;
  /** Allies of the character: dead, and came to him. */
  alliesDied: string[];
  alliesCame: string[];
  /** The people of the character in the country, one by one, for the log (the dead and the ones who came; M4 review G1). */
  kin: KinFate[];
  /** The character himself stood in the country (he lives, hurt or not: iron rule 1). */
  main: boolean;
}

/** A person of the character the dice reached: how he stands to the character, and whether he died or came to him. */
export interface KinFate {
  name: string;
  rel: 'child' | 'partner' | 'ally';
  fate: 'died' | 'came';
}

/** How a tie of the character is told: his child, his partner (lover or spouse), or an ally. */
export const relOf = (t: Tie): KinFate['rel'] => (isChild(t) ? 'child' : isPartner(t) ? 'partner' : 'ally');

/** The words of the relation, as the log and the preview say it. */
export const REL_TH: Record<KinFate['rel'], string> = { child: 'ลูก', partner: 'คู่ครอง', ally: 'พวกพ้อง' };

/** The allies, partner and children of the character who stand in the country: the ones the dice of a ruin reach. */
export function peopleHere(ctx: Ctx, country: CountryId): Tie[] {
  const here = new Set(npcsIn(ctx, country));
  return alliesOf(ctx).filter((t) => t.country === country || (t.npc && here.has(t.npc)));
}

/** The living roster holders who are in this country now. */
export function npcsIn(ctx: Ctx, country: CountryId): string[] {
  const idx = npcIndex(ctx);
  const slots = slotsOf(ctx.state);
  return Object.keys(slots)
    .sort()
    .filter((id) => {
      const s = slots[id];
      return s.status === 'alive' && (s.place ?? idx.rows.get(id)?.country) === country;
    });
}

/** The leaders of the country (rows of the group `leader`): the holders whose survival makes the leader of the ruin. */
export function leadersOf(ctx: Ctx, country: CountryId): string[] {
  return (npcIndex(ctx).byCountry.get(country) ?? []).filter((r) => r.group === 'leader').map((r) => r.id).sort();
}

/** The countries next to a ruined one that take the refugees: not at war, not a foe of it. The last resort is the first neighbour, so the survivors are not left without a road. */
export function acceptors(ctx: Ctx, country: CountryId): CountryId[] {
  const near = neighboursOf(ctx, country);
  const foes = new Set(((ctx.data.countries?.items as Record<string, { id: string; relations?: { to: string; kind: string }[] }> | undefined)?.[country]?.relations ?? []).filter((r) => r.kind === 'foe').map((r) => r.to));
  const open = near.filter((c) => !hasFlag(ctx, c, 'war') && !foes.has(c) && !hasFlag(ctx, c, 'god_ruin'));
  return open.length ? open : near.slice(0, 1);
}

/**
 * Rolls the people of the country. `dice` is the NPC dice (die · flee · stay in percent), `allyDie` the percent of the character's allies who die.
 * A leader who is not killed stays (the leader of the country who lives is always the leader of the ruin). Nobody is changed here but the dead:
 * the ones who flee walk later (RU-02), the allies who live come to the character at once.
 */
export function rollPeople(ctx: Ctx, country: CountryId, dice: Dice, allyDie: number, why: string): Fates {
  const rng = ctx.rng(STREAM);
  const out: Fates = { died: [], fled: [], stayed: [], alliesDied: [], alliesCame: [], kin: [], main: !!livingOf(ctx) && livingOf(ctx)!.country === country };
  const life = livingOf(ctx);
  const leaders = new Set(leadersOf(ctx, country));
  const allies = peopleHere(ctx, country);
  const allyNpc = new Set(allies.flatMap((t) => (t.npc ? [t.npc] : [])));
  for (const id of npcsIn(ctx, country)) {
    if (allyNpc.has(id)) continue; // the allies roll their own dice below
    const x = rng.next() * 100;
    if (x < dice.die) {
      killNpc(ctx, id, why);
      out.died.push(id);
    } else if (leaders.has(id) || x >= dice.die + dice.flee) {
      out.stayed.push(id);
      if (leaders.has(id) && !out.leader) out.leader = id;
    } else out.fled.push(id);
  }
  for (const t of allies) {
    if (rng.chance(allyDie / 100)) {
      if (t.npc) killNpc(ctx, t.npc, why);
      endTie(ctx, t, 'death', why, { cause: 'god' });
      out.alliesDied.push(t.id);
      out.kin.push({ name: t.name, rel: relOf(t), fate: 'died' });
    } else if (life) {
      t.country = life.country;
      out.alliesCame.push(t.id);
      out.kin.push({ name: t.name, rel: relOf(t), fate: 'came' });
    }
  }
  return out;
}

/** The refugees who fled walk to a country that takes them (RU-02): their place changes. Returns the ones that went. */
export function march(ctx: Ctx, ids: string[], to: CountryId[]): string[] {
  if (!to.length) return [];
  const rng = ctx.rng(STREAM);
  const slots = slotsOf(ctx.state);
  const went: string[] = [];
  for (const id of ids) {
    const s = slots[id];
    if (!s || s.status !== 'alive') continue;
    s.place = to[rng.int(0, to.length - 1)];
    went.push(id);
  }
  return went;
}

/** The main character who stands in the ruined country: the curse of the homeland with its chance (the belief he loses is the general one of a deed he sees). */
export function hauntMain(ctx: Ctx, country: CountryId, id: string): string | null {
  const life = livingOf(ctx);
  if (!life || life.country !== country) return null;
  const n = godOf(ctx).miracles.ruin.numbers.mcCurse;
  if (life.curses.includes(n.id) || !ctx.rng(STREAM).chance(n.chance / 100)) return null;
  apply(ctx, [{ k: 'grant', kind: 'curse', id: n.id }], { sys: 'god', id, stream: STREAM });
  return n.id;
}

export const sinceYear = (ctx: Ctx, year: number): number => yearOf(ctx) - year;
