// The painted backgrounds, kept: the layers of a place are painted once per place and handed to whoever asks (the Phaser stage, the picture of an event card).
// No Phaser here, so a card can use it without loading the stage.
import { paintScenery, type Scenery, type ScenerySpec } from '../art/scenery';
import { SCENERY_KEEP } from './tuning';

const painted = new Map<string, Scenery>();

export const specKey = (s: ScenerySpec): string => `${s.continent}|${s.country ?? ''}|${s.setting}|${s.season ?? ''}|${s.seed ?? ''}`;

/** The layers of a place, from the cache (the oldest unused place is let go past `SCENERY_KEEP`). */
export function sceneryFor(spec: ScenerySpec): Scenery {
  const key = specKey(spec);
  const have = painted.get(key);
  if (have) {
    painted.delete(key);
    painted.set(key, have);
    return have;
  }
  const made = paintScenery(spec);
  painted.set(key, made);
  if (painted.size > SCENERY_KEEP) painted.delete(painted.keys().next().value!);
  return made;
}
