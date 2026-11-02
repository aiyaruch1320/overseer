// Fights of the named NPCs (docs/systems/combat/07-npc-clashes.md): the NPC system calls `clash` when the story of an NPC reaches the point where
// his line meets the hero's. The fight is the ordinary one against the NPC's row of enemies.json; the result picks one of the outcome rows of
// clashes.json and its effects (`npcPath` `trust` `event` ...) are applied through the rules, so the NPC system's own handlers move his lines.
import type { Ctx } from '../game';
import type { Clash, ClashOutcome } from '../data/types-combat';
import { write } from '../log';
import { apply } from '../rules';
import { indexOf } from './data';
import { resolve, type Fought } from './fight';
import { foeOf } from './foe';
import { admit } from './launch';
import { quietReward } from './reward';
import { buildHero } from './hero';
import { extOf, lifeOf } from './state';
import { CLASH_MAX_PER_LIFE, DUEL_STYLE, SPARE, STREAM, TALK_KEY_CHANCE } from './tuning';
import type { FightOpts } from './types';

/** The opening code of a clash: B ขัดขวาง · X ข้ามทาง · S ถูกส่งมา · T ท้า · P ปกป้อง (07 §2). */
export type Opener = 'B' | 'X' | 'S' | 'T' | 'P';

export interface ClashOpts extends Partial<FightOpts> {
  /** How the clash opened; the row's own code when unset. */
  opener?: Opener;
  /** The hero knew it would come (acquaintance ≥ 3 or a hint): he has the first beat; unset: he is ambushed when X or S. */
  knows?: boolean;
  /** The hero holds the key of a talk outcome that has one in brackets. Unset: drawn (TALK_KEY_CHANCE). */
  talkKey?: boolean;
  /** A duel to the death was accepted (a duel with a yield rule is otherwise not lethal for the hero). */
  toDeath?: boolean;
  /**
   * false: the effects of the outcome row are not applied here. The NPC system asks for this: it writes the result back into the lines of the NPC
   * itself (npc `applyClashOutcome`, which applies the row). Default true.
   */
  apply?: boolean;
}

export interface ClashResult {
  clash: string;
  npc: string;
  /** What happened: the end of the fight, or why none was fought. */
  result: Fought['result'] | 'deferred' | 'closed' | 'unknown';
  /** The kind of outcome row applied (`win_kill` `win_spare` `talk` `draw` `lose`), if any. */
  kind?: string;
  outcome?: ClashOutcome;
  /** The place of that outcome in the clash row (`outcomes[index]`), for a caller that writes the result back itself. */
  index?: number;
  /** The NPC was slain: the NPC system marks him dead. */
  killed: boolean;
  spared: boolean;
  fight?: Fought;
  /** How many effects of the row were applied. */
  applied: number;
}

export function clashOf(ctx: Ctx, idOrNpc: string): Clash | undefined {
  const ix = indexOf(ctx);
  return ix.clashById.get(idOrNpc) ?? ix.clashByNpc.get(idOrNpc);
}

/** The chance per year that this NPC opens a clash (the `X` `S` `T` rows; null for `B` and `P`, which open at once). */
export function openChance(c: Clash): number | null {
  return c.open.chancePerYear;
}

const outcomeOf = (c: Clash, kind: string): ClashOutcome | undefined => c.outcomes.find((o) => o.kind === kind);

/**
 * Four clashes write the killing blow as a row with no standard kind (`ล้ม (ฆ่า)`): the NPC yields as a rule and the kill is a deed the hero
 * must insist on (a duel to the death accepted), with its own effects (`c_infamous` ...). Not a row the hero lands in by winning.
 */
const killRow = (c: Clash): ClashOutcome | undefined => c.outcomes.find((o) => !o.kind && /^ล้ม/.test(o.outcome));

/** A talk outcome with a key in brackets (`เจรจา (รับปากปกป้อง)`) cannot be chosen without the key (07 §3.1). */
const needsKey = (o: ClashOutcome | undefined): boolean => !!o && /\(.+\)/.test(o.outcome);

/**
 * Fights the clash of an NPC. `deferred` when the life year is full (the caller tries again next season; B and P are not dropped, 07 §2),
 * `closed` when the NPC was met twice already or this season, or the hero is gone. The NPC must be alive and the line open: the NPC system checks.
 */
export function clash(ctx: Ctx, idOrNpc: string, o: ClashOpts = {}): ClashResult {
  const c = clashOf(ctx, idOrNpc);
  const none = (result: ClashResult['result']): ClashResult => ({ clash: c?.id ?? idOrNpc, npc: c?.npc ?? idOrNpc, result, killed: false, spared: false, applied: 0 });
  const life = lifeOf(ctx);
  if (!c || !life) return none(c ? 'closed' : 'unknown');
  const foe = foeOf(ctx, [c.npc]);
  if (!foe) return none('unknown');
  const ext = extOf(life);
  const seen = ext.clashes[c.npc];
  if (seen) {
    if (seen.n >= CLASH_MAX_PER_LIFE || seen.last === ext.tick) return none('closed');
    // the second time only after a draw, a flight or a defeat
    if (!['draw', 'lose'].includes(seen.result)) return none('closed');
  }
  if (!admit(ctx, [c.npc]).length) return none('deferred');

  const rng = ctx.rng(STREAM.clash);
  const opener: Opener = o.opener ?? (c.open.code as Opener);
  const talkOutcome = outcomeOf(c, 'talk');
  const key = o.talkKey ?? (needsKey(talkOutcome) ? rng.chance(TALK_KEY_CHANCE) : true);
  const hasKill = !!outcomeOf(c, 'win_kill');
  const hasSpare = !!outcomeOf(c, 'win_spare');
  const special = !hasKill && !!killRow(c);
  const kindAxis = (life.ext.character as { axes?: { kind?: number } } | undefined)?.axes?.kind ?? 0;
  const spareIntent = special && o.toDeath ? false : hasSpare && (!hasKill || rng.chance(Math.max(0, Math.min(1, SPARE.base + (kindAxis / 100) * SPARE.perKind))));
  const duel = DUEL_STYLE.test(c.style) && !o.toDeath;
  const ambush: FightOpts['ambush'] = o.ambush ?? (o.knows ? 'hero' : opener === 'X' || opener === 'S' ? 'foe' : undefined);
  const { opener: _opener, knows: _knows, talkKey: _key, toDeath: _death, apply: _apply, ...rest } = o;
  void [_opener, _knows, _key, _death, _apply];
  const opts: FightOpts = {
    ...rest,
    kind: duel ? 'duel' : 'clash',
    node: c.id,
    npc: c.npc,
    rematch: !!seen,
    lethal: duel ? false : o.lethal,
    talk: !!talkOutcome && key,
    spare: spareIntent,
    ambush,
  };
  // the call of a fight with a name (07-attention.md §2): a clash is announced the beat it is fought
  write(ctx.state, { sys: 'combat', kind: 'prelude', id: c.npc, data: { enemies: c.npc, foe: foe.name, tier: foe.tier, node: c.id, kind: opts.kind ?? 'clash', text: null }, level: 2 });
  const f = resolve(ctx, foe, opts);
  ext.clashes[c.npc] = { n: (seen?.n ?? 0) + 1, last: ext.tick, result: f.result === 'lose' || f.result === 'flee' ? 'lose' : f.result === 'draw' ? 'draw' : f.result };

  // the result picks a row (07 §3): a win is a kill or a sparing, a flight is a defeat without the wound roll
  let kind: string | undefined;
  switch (f.result) {
    case 'win':
    case 'flawless':
      kind = spareIntent ? 'win_spare' : hasKill || special ? 'win_kill' : 'win_spare';
      break;
    case 'talk':
    case 'tame':
      kind = 'talk';
      break;
    case 'draw':
      kind = 'draw';
      break;
    case 'lose':
    case 'flee':
      kind = 'lose';
      break;
  }
  const row = kind ? (outcomeOf(c, kind) ?? (kind === 'win_kill' ? killRow(c) : undefined)) : undefined;
  let applied = 0;
  if (row && o.apply !== false) {
    for (const e of row.effects) {
      apply(ctx, [e], { sys: 'combat', id: c.id, stream: STREAM.clash });
      applied++;
    }
  }
  const spared = kind === 'win_spare';
  if (spared) quietReward(ctx, buildHero(ctx, life), foe, 'spare', c.id);
  write(ctx.state, {
    sys: 'combat',
    kind: 'clash',
    id: c.id,
    data: { npc: c.npc, opener, result: f.word, end: f.result, outcome: row?.outcome ?? null, kind: kind ?? null, text: row?.text ?? null, killed: kind === 'win_kill', beats: f.beats },
    level: 2,
  });
  return { clash: c.id, npc: c.npc, result: f.result, kind, outcome: row, index: row ? c.outcomes.indexOf(row) : undefined, killed: kind === 'win_kill', spared, fight: f, applied };
}
