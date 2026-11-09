// The end summary of a dead life (llm/04-story.md §2), shared by the browser (src/app/llm.ts) and the tools (scripts/tools/llm.ts): the input of the llm layer
// mapped from `endingInput(state, lifeId)` of the ending system, and the call at the death that writes the answer into the card with `applyEndingText(..., 'llm')`.
// The answer also sits in `state.llmAnswers` and in the log (level 0), so a save replays it without a call. The core systems stay sync and know nothing of this.
import type { GameData } from '../game';
import { makeCtx } from '../game';
import { applyEndingText, cardOf, endingInput } from '../ending';
import { raceName } from '../text';
import type { GameState } from '../types';
import type { Llm } from './index';
import type { EndingSummary, EndingSummaryInput } from './ending';

/** One line of what the player asked of the life and what the birth gave (the LLM may say the life was asked for; it may not add anything that was not given). */
export function wishLine(w: NonNullable<ReturnType<typeof endingInput>>['wish'] & object): string {
  const given = w.granted.map((g) => g.value).join(' ');
  const cut = w.refused.map((r) => r.value).filter(Boolean).join(' ');
  return `${w.text}${given ? ` · ได้: ${given}` : ''}${cut ? ` · ไม่ได้: ${cut}` : ''}`;
}

const PRONOUN: Record<string, string> = { m: 'เขา', f: 'เธอ', n: 'ผู้นั้น' };
/** The summary tells at most this many facts (llm/04-story.md §2 "สามถึงแปดบรรทัด" of the record); the first and the last are kept. */
const MAX_FACTS = 8;

/**
 * The input of the end summary of a dead life, mapped from `endingInput(state, lifeId)` of the ending system: the person, the question, the facts in the order the card tells them
 * (the sentences the card holds, so the LLM sees what the template tier saw) and the names the text may use. Undefined when the life has no card.
 */
export function summaryInputOf(data: GameData, state: GameState, lifeId?: string): EndingSummaryInput | undefined {
  const input = endingInput(state, lifeId);
  const card = cardOf(state, input?.life.id);
  if (!input || !card) return undefined;
  const ctx = makeCtx(state, data);
  const sentences = card.facts.map((f) => f.sentence).filter(Boolean);
  const facts = sentences.length > MAX_FACTS ? [...sentences.slice(0, MAX_FACTS - 1), sentences[sentences.length - 1]] : sentences;
  if (input.question.text) facts.splice(Math.min(1, facts.length), 0, `คำถามของชีวิต: ${input.question.text}`);
  return {
    lifeId: input.life.id,
    name: input.life.name,
    pronoun: PRONOUN[input.life.gender] ?? 'เขา',
    race: input.life.raceName || raceName(ctx, input.life.race),
    age: input.life.age,
    ending: input.ending ?? '',
    facts,
    names: input.names,
    // the vow with its result and its page, the titles of the life, and the names of the others of this world that the text may not take (the check refuses them)
    ...(input.vow ? { vow: `${input.vow.result === 'kept' ? 'คำปฏิญาณที่เป็นจริง' : 'คำปฏิญาณที่ไม่เป็นจริง'} · ${input.vow.name}: ${input.vow.lines.join(' ')}` } : {}),
    ...(input.titles.length ? { titles: input.titles } : {}),
    // a life the player ordered: what was asked and given, for the tone only (the character does not know it)
    ...(input.wish ? { wish: wishLine(input.wish) } : {}),
    ...(input.others.length ? { others: input.others } : {}),
    // the template tier's summary: what the card holds if no answer comes. When the card already holds an LLM text, the template is the one it replaced and is not known here
    template: card.summary.text,
  };
}

/**
 * At the death of a life: asks for the end summary and, when the LLM answers (or the save already holds its answer), writes it into the card. Does nothing without an `Llm`, with the
 * epitaph switch off, or for a card that already holds an LLM text. The answer is kept in `state.llmAnswers` by the llm layer, so asking again after a load never calls.
 */
export async function summarizeDeath(llm: Llm | undefined, data: GameData, state: GameState, lifeId?: string): Promise<EndingSummary | undefined> {
  if (!llm) return undefined;
  const id = lifeId ?? cardOf(state)?.life;
  const card = id ? cardOf(state, id) : undefined;
  if (!id || !card) return undefined;
  if (card.summary.source === 'llm') return { text: card.summary.text, source: 'llm' };
  const input = summaryInputOf(data, state, id);
  if (!input) return undefined;
  const s = await llm.summarizeEnding(input, state);
  if (s.source === 'llm') applyEndingText(state, id, { summary: s.text }, 'llm');
  return s;
}
