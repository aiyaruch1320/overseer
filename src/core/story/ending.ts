// The ending of a life (storylines/README.md §1 "ปลายทาง", the table of §6 in each race file): a life earns the endings its nodes and its
// conditions grant, none is announced while it lives, and one is chosen when the character dies. The way it died matters: an ending that
// is a death in battle needs a death in battle.
import type { Ctx } from '../game';
import { write } from '../log';
import { test } from '../rules';
import type { Condition } from '../types';
import { indexOf } from './data';
import { extOf, type StoryExt } from './state';
import { CAUSE, ENDING_GROUPS, ENDING_WEIGHT, PLAIN_ENDINGS, WAR_ENDINGS } from './tuning';

export interface Candidate {
  title: string;
  line: string;
  weight: number;
}

/** How many clauses a condition holds: an ending that asks for more is a harder one to earn. */
export function clausesOf(c: Condition | undefined): number {
  if (!c) return 0;
  switch (c.k) {
    case 'and':
    case 'or':
      return c.of.reduce((n, x) => n + clausesOf(x), 0);
    case 'not':
      return clausesOf(c.of);
    default:
      return 1;
  }
}

/** A line the life walked: its own race line, an overlay it opened, or the group an ending names (`halfblood` `heir` `economy`). */
function walked(ex: StoryExt, line: string): boolean {
  if (line === ex.line || ex.open[line]) return true;
  return (ENDING_GROUPS[line] ?? []).some((l) => ex.open[l]);
}

/** The endings the dead character may take, with the weight of each. Reads only; the choice is `chooseEnding`. */
export function candidates(ctx: Ctx): Candidate[] {
  const life = ctx.state.life;
  if (!life) return [];
  const ex = extOf(life);
  const ix = indexOf(ctx);
  const cause = life.dead?.cause ?? '';
  const out = new Map<string, Candidate>();
  const add = (title: string, line: string, clauses: number) => {
    if (WAR_ENDINGS.has(title) && cause !== CAUSE.battle) return;
    const w = ENDING_WEIGHT.base + ENDING_WEIGHT.perClause * clauses;
    const weight = line === ex.line ? w * ENDING_WEIGHT.mainLine : w;
    const had = out.get(title);
    if (!had || had.weight < weight) out.set(title, { title, line, weight });
  };
  // granted while the life went on (`ปลายทาง "…"` in a node, its condition tested when the node was played)
  for (const title of ex.endings) {
    const row = ix.endings.find((e) => e.title === title);
    add(title, ex.endingLines[title] ?? row?.line ?? ex.line, clausesOf(row?.cond));
  }
  // granted by the condition of the table, tested now
  for (const e of ix.endings) if (e.cond && walked(ex, e.line) && test(ctx, e.cond)) add(e.title, e.line, clausesOf(e.cond));
  return [...out.values()];
}

/** The plain ending of the life's race line ("คนธรรมดาที่รอด": no condition, not a single convergence, died of age). */
function plainEnding(ctx: Ctx): Candidate | undefined {
  const life = ctx.state.life;
  if (!life) return undefined;
  const ex = extOf(life);
  for (const e of indexOf(ctx).endings) {
    const plain = PLAIN_ENDINGS[e.title];
    if (e.line !== ex.line || e.cond || !plain) continue;
    if (!plain.cause.includes(life.dead?.cause ?? '')) continue;
    if (plain.noConvergence && Object.keys(life.passed).some((id) => id.startsWith('cv.'))) continue;
    return { title: e.title, line: e.line, weight: 1 };
  }
  return undefined;
}

/** Chooses the one ending of the dead character and writes the log entry `ending`. Does nothing when it has none or already has one. */
export function chooseEnding(ctx: Ctx): string | undefined {
  const life = ctx.state.life;
  if (!life || !life.dead) return undefined;
  const ex = extOf(life);
  if (ex.ended !== undefined) return ex.ended;
  const list = candidates(ctx);
  const pool = list.length ? list : [plainEnding(ctx)].filter((x): x is Candidate => !!x);
  if (!pool.length) return undefined;
  const pick = pool.length === 1 ? pool[0] : pool[Math.max(0, ctx.rng('life.story.ending').weighted(pool.map((c) => c.weight)))];
  ex.ended = pick.title;
  write(ctx.state, { sys: 'story', kind: 'ending', id: pick.title, data: { line: pick.line, cause: life.dead.cause, earned: pool.length }, level: 1 });
  return pick.title;
}
