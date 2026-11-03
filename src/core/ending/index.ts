// The ending system (code-plan §7 row "ending"; docs/systems/experience/03-ending-and-collection.md, docs/systems/llm/07-ending-templates.md).
// At the death it builds the card of the life from the log, the ending the story chose and the state: the head, the title, the question, three
// moments, the epitaph and one paragraph of summary, all from the tier 0 templates, and opens the entries of the collection the life found.
// The card is plain JSON in `state.lineage.x.cards[lifeId]`. The llm layer reads `endingInput(state)` and may replace the summary and the epitaph
// with `applyEndingText`; it may not add a fact. This module imports nothing from the llm layer.
import type { System } from '../game';
import { write } from '../log';
import { lx } from '../lineage/state';
import type { GameState } from '../types';
import { buildCard } from './card';
import type { EndingCard, EndingInput, SourcedText } from './types';

export { collectionView, entryName, catalog, keep, lifeEntries, modeOf, CATEGORIES, MODES, type CollectionView, type CategoryView } from './collection';
export { lifeLog } from './facts';
export type { EndingCard, EndingInput, WishOnCard, SummaryFact, Moment, HandSummary, SourcedText, TextSource, QuestionGrade, CauseGroup, WorldMark } from './types';

/** The card of a life (the last one that ended when no id is given); undefined when the life has none. */
export function cardOf(state: GameState, lifeId?: string): EndingCard | undefined {
  const x = lx(state);
  if (lifeId) return x.cards[lifeId];
  const last = x.recs.filter((r) => x.cards[r.id]).slice(-1)[0];
  return last ? x.cards[last.id] : undefined;
}

/**
 * What the llm layer reads to write the summary and the epitaph of a life: the facts in the order the summary tells them, the death, the question,
 * the hand of the god, the family, the names it may use. A plain object (the same shape for every life); undefined when the life has no card yet.
 */
export function endingInput(state: GameState, lifeId?: string): EndingInput | undefined {
  const x = lx(state);
  const id = lifeId ?? cardOf(state)?.life;
  return id ? x.inputs[id] : undefined;
}

/**
 * Replaces the text of a card: the llm layer calls this when its answer has come (07 §1 "สวิตช์ llm_ending"). The facts, the head, the title and the
 * moments do not change. A text that is empty is ignored. `source` is kept on the text so a later reader knows which words are the template's.
 * Returns whether anything changed.
 */
export function applyEndingText(state: GameState, lifeId: string, patch: { summary?: string; epitaph?: string }, source: SourcedText['source'] = 'llm'): boolean {
  const card = lx(state).cards[lifeId];
  if (!card) return false;
  let changed = false;
  if (patch.summary?.trim()) {
    card.summary = { text: patch.summary.trim(), source };
    changed = true;
  }
  if (patch.epitaph?.trim()) {
    const old = card.epitaph.text;
    card.epitaph = { text: patch.epitaph.trim(), source };
    const at = card.lines.lastIndexOf(old);
    if (at >= 0) card.lines[at] = card.epitaph.text;
    changed = true;
  }
  return changed;
}

export const endingSystem: System = {
  name: 'ending',
  death(ctx) {
    const life = ctx.state.life;
    if (!life || !life.dead) return;
    const x = lx(ctx.state);
    if (x.cards[life.id]) return;
    const { card, input } = buildCard(ctx);
    x.cards[life.id] = card;
    x.inputs[life.id] = input;
    write(ctx.state, { sys: 'ending', kind: 'card', id: life.id, data: { title: card.ending ?? null, mark: card.mark.level, facts: card.facts.length, earned: card.earned.length, hand: card.hand.total }, level: 2 });
  },
};
