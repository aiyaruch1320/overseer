// The registry of the storybook (code-plan §8.1 rule 5): every screen registers one or more stories, each drawn from a sample state,
// so a screen can be checked without playing to it. `dev.html` lists them; a screen's own file calls `story()` at import time.
import type { ComponentChildren } from 'preact';
import type { Game, GameData } from '../core/game';
import type { GameState } from '../core/types';

export interface StoryCtx {
  data: GameData;
  /** A state made by `sample` (a seeded life run to some point); the story may use it or not. */
  state: GameState;
  /** The game that made the state, for a story whose view asks the core (the "now" box). */
  game?: Game;
}

export interface Story {
  /** The group in the list (the screen of 8.2), then the name of this story. */
  group: string;
  name: string;
  /** How far the sample life is run before the story is drawn: beats from birth, or `death`. */
  at?: number | 'death';
  seed?: number;
  /** The race of the sample life (a story of a race's own scene shows a life of that race in its homeland); omitted: the seed's own. */
  race?: string;
  country?: string;
  render: (ctx: StoryCtx) => ComponentChildren;
}

const stories: Story[] = [];

export function story(s: Story): void {
  stories.push(s);
}

export function allStories(): readonly Story[] {
  return stories;
}
