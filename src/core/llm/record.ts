// What an answer leaves in the state (llm/README.md §5 rule 7, code-plan §2 rule 2): the text itself, in `state.llmAnswers`, which the save keeps, and one log
// entry of level 0 with the text, so a replay of the same save never asks again and a reader of the log sees what the LLM said.
// Nothing here runs unless an answer exists: a game without an LLM writes nothing, so its state is the state it had before this layer was added.
import { write } from '../log';
import type { GameState } from '../types';

export const answerOf = (state: GameState, key: string): string | undefined => state.llmAnswers[key];

export function keep(state: GameState, key: string, text: string): void {
  state.llmAnswers[key] = text;
}

/** One entry of the log with the text of the answer (level 0: kept for the reader of the log, not shown to the player). */
export function logAnswer(state: GameState, point: string, id: string, data: Record<string, string | number | boolean | null>): void {
  write(state, { sys: 'llm', kind: point, id, data, level: 0 });
}

/** Keys of `llmAnswers` by family. A family and the life make one key; the id of the point follows. */
export const keys = {
  command: (hash: string) => `command:${hash}`,
  asked: (life: string, point: string) => `director.asked:${life}:${point}`,
  offer: (life: string, point: string) => `director.offer:${life}:${point}`,
  decision: (life: string, point: string) => `director:${life}:${point}`,
  ending: (life: string) => `ending:${life}`,
};
