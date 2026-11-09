// The book of the family (docs/lore/heirs/02-no-repeat.md): what the lives of the family walked, so the heir does not walk it again.
// Layers of the doc: the world does not repeat (the event flags of the world), the family does not repeat (this book), the person does (the personal
// nodes of the race line stay: every one must pass the rites of the people). The book is cut to what the story system can use without a change of its own:
//  - a node that stands for a world event, or hands the life to a convergence (the types W and C of §3), that a life of the family walked, is skipped by the heir
//    (`life.ext.story.skipped`; the convergence points are set as passed with the way `-`, and listed in `x.preset` so the collection does not count them);
//  - an ending the family earned is not chosen again while another is open (story/ending.ts reads `x.book.endings`);
//  - the personal nodes (type P) are walked again with the same weights. The doc says the way the parent took weighs ×0.5: the story system has no hook for it (doc gap, in the report).
import { storyFacts } from '../types';
import type { Ctx } from '../game';
import { indexOf } from '../story/data';
import { extOf as storyExt } from '../story/state';
import type { LifeState } from '../types';
import { lifeLog } from '../ending/facts';
import { lx } from './state';

const add = (list: string[], id: string | undefined): void => {
  if (id && !list.includes(id)) list.push(id);
};

/** Adds what the dead life walked to the book. */
export function updateBook(ctx: Ctx): void {
  const life = ctx.state.life;
  if (!life) return;
  const x = lx(ctx.state);
  const b = x.book;
  const ix = indexOf(ctx);
  const preset = new Set(x.preset);
  for (const [id, way] of Object.entries(life.passed)) {
    if (preset.has(id)) continue;
    b.nodes[id] = way;
    const n = ix.nodes.get(id);
    if (id.startsWith('cv.')) {
      add(b.converge, id);
      add(b.burnt, id);
    } else if (n && (n.titleEvents?.length || n.converge?.length)) add(b.burnt, id);
  }
  for (const e of lifeLog(ctx)) {
    if (e.sys === 'world' && e.kind === 'event' && e.id && e.worldYear >= life.birthYear) add(b.events, e.id);
    if (e.sys === 'character' && e.kind === 'job' && e.id) add(e.data.type === 'secret' ? b.secretJobs : b.jobs, e.id);
    if (e.sys === 'items' && e.kind === 'legend') add(b.weapons, e.id);
  }
  add(b.endings, storyFacts(life)?.ended);
}

/** Sets the book into the story state of the heir before its first year is played. */
export function presetStory(ctx: Ctx, heir: LifeState, newcomer = false): void {
  const x = lx(ctx.state);
  const sx = storyExt(heir);
  x.preset = [];
  // a newcomer in the old world has no book of the family to close: the line of the heirs (hr.a1 "settle as the parent began") stays shut for it (R4)
  if (newcomer) sx.open.hr = false;
  for (const id of x.book.burnt) {
    if (id.startsWith('cv.')) {
      if (heir.passed[id] === undefined) {
        heir.passed[id] = '-';
        x.preset.push(id);
      }
    } else if (!sx.skipped.includes(id)) sx.skipped.push(id);
  }
}
