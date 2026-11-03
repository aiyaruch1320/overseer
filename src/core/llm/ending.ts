// Point 3, the summary of the ending (llm/04-story.md §2, llm/README.md §2 `epitaph`): the LLM retells the life the game already recorded. The game picks every fact;
// the LLM only orders them and sets the tone. The result replaces the template summary of the ending card. This file does not import `src/core/ending`: the lead
// maps `endingInput(state)` to `EndingSummaryInput` (all plain strings) and puts `text` in the summary field of the card, where `source` is `'template' | 'llm'`.
import type { GameState } from '../types';
import type { LlmClient } from './client';
import { ENDING_SYSTEM } from './prompts';
import { answerOf, keep, keys, logAnswer } from './record';
import { pointOn } from './switches';
import { MAX_TOKENS, SUMMARY } from './tuning';
import { checkFacts, checkThai } from './validate';

/** What the summary is made from. All text is Thai, in the words the game shows. */
export interface EndingSummaryInput {
  /** The life (`L1`): keys the answer in the save and the budget. */
  lifeId: string;
  name: string;
  /** How the story refers to the character; the game knows it (llm/08-live-test.md §3 "ชื่อตัวละคร"). */
  pronoun: string;
  race: string;
  /** Age at death, life years. */
  age: number;
  /** The ending the life earned (its title). */
  ending: string;
  /** The facts of the record in order of time, three to eight lines (the card's moments, the vow and its result, the people met again). */
  facts: string[];
  /** The summary the game builds itself (tier 0): returned when the LLM is off, fails, or breaks a rule. */
  template: string;
  /** Names in the registry of the world that the text may use (god/05-llm.md §7: no other name); the live test needed them to keep the LLM from taking one for the character (08 §3). */
  names?: string[];
  /** The vow of the player and what came of it, when there is one (the character does not know it). */
  vow?: string;
  /** What the player asked of this life and what it was given (the life was "ถูกสั่ง"): the retelling may tell the life was asked for and may not add a fact from it. The character does not know it. */
  wish?: string;
  /** The titles the life earned (one to three), when it has any: the retelling may name them and may not add one. */
  titles?: string[];
  /** Names of other people of this world that the text may not use for this life (neighbours, the kin of earlier lives). A retelling that takes one is wrong. */
  others?: string[];
}

export interface EndingSummary {
  text: string;
  source: 'llm' | 'template';
}

const givenOf = (i: EndingSummaryInput): string[] => [i.name, i.race, i.ending, i.vow ?? '', i.wish ?? '', ...(i.titles ?? []), ...i.facts];
const digitsOf = (i: EndingSummaryInput): string => givenOf(i).join('').replace(/[^0-9๐-๙]/g, '') + String(i.age);

/**
 * The check of the retelling against the facts it was given: Thai, within the length, no id, no banned word, and (review M4 G5) no number the facts did not carry (a year, an
 * age or a count that is not in the facts, with digits or in Thai words), no name that is not the life's, no vow or title the game did not give.
 */
export function checkSummary(text: string, input: EndingSummaryInput) {
  const thai = checkThai(text, { min: SUMMARY.min, max: SUMMARY.max, paragraphs: SUMMARY.paragraphs, allowDigits: digitsOf(input) });
  if (!thai.ok) return thai;
  const facts = checkFacts(thai.value, {
    given: givenOf(input),
    numbers: [input.age],
    names: [input.name, ...(input.names ?? [])],
    others: input.others,
    hasVow: !!input.vow,
    hasTitle: !!input.ending || !!input.titles?.length,
  });
  return facts.ok ? thai : facts;
}

const templateOf = (i: EndingSummaryInput): EndingSummary => ({ text: i.template, source: 'template' });

/**
 * The summary of the ending. With `state` the answer is read from and kept in the save (`llmAnswers`, so a save replays the same text) and the player's switches
 * are honoured; without it only the server side switches apply. `llm` null or any failure gives the template. Never throws.
 */
export async function summarizeEnding(input: EndingSummaryInput, llm: LlmClient | null | undefined, state?: GameState): Promise<EndingSummary> {
  const key = keys.ending(input.lifeId);
  if (state) {
    const kept = answerOf(state, key);
    if (kept !== undefined) {
      const c = checkSummary(kept, input);
      if (c.ok) return { text: c.value, source: 'llm' };
    }
    if (!pointOn(state, llm, 'ending')) return templateOf(input);
  } else if (!llm || !llm.available('ending')) return templateOf(input);
  const data = { name: input.name, pronoun: input.pronoun, race: input.race, age: input.age, ending: input.ending, facts: input.facts, ...(input.names?.length ? { allowed_names: input.names } : {}), ...(input.vow ? { vow: input.vow } : {}), ...(input.wish ? { wish: input.wish } : {}), ...(input.titles?.length ? { titles: input.titles } : {}) };
  const r = await llm!.run({
    point: 'ending',
    input: data,
    life: input.lifeId,
    system: ENDING_SYSTEM,
    user: JSON.stringify(data),
    maxTokens: MAX_TOKENS.ending,
    check: (text) => checkSummary(text, input),
  });
  if (r.source === 'template') return templateOf(input);
  if (state) {
    keep(state, key, r.value);
    logAnswer(state, 'ending', input.lifeId, { text: r.value, from: r.source });
  }
  return { text: r.value, source: 'llm' };
}
