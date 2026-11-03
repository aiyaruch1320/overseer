// Sample lives for the stories of the character screen: a seeded life run a number of beats (four to a life year), the way the tools run one.
// Story-only. The seeds were picked by looking at what the seeded lives become (seed 12 has a blessing and a curse at birth, 38 is an orc
// soldier with a full kit, 24 is taken into bondage at twenty, 17 is a sage with the highest mind).
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { createSession, startLife } from '../../../scripts/tools/session';

const memo = new Map<string, GameState>();

export const SAMPLES = {
  newborn: { seed: 12, beats: 0 },
  warrior: { seed: 38, beats: 200 },
  bonded: { seed: 24, beats: 80 },
  elder: { seed: 17, beats: 250 },
} as const;

export type SampleKey = keyof typeof SAMPLES;

export function sampleLife(data: GameData, key: SampleKey): GameState {
  const hit = memo.get(key);
  if (hit) return hit;
  const { seed, beats } = SAMPLES[key];
  const s = createSession(data, { seed });
  startLife(s);
  for (let i = 0; i < beats && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  memo.set(key, s.game.state);
  return s.game.state;
}
