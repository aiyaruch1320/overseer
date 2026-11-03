// The scene area of the watch screen (20-god-ui.md §2 "ฉากชีวิต"): the newest entry of the log that has a scene script is played once;
// between scenes the card of the newest world event stays up. The scene mapping is src/app/views/scene.ts, the player src/scene.
import { useMemo, useState } from 'preact/hooks';
import { store } from '../app/store';
import { sceneFor, type SceneView } from '../app/views/scene';
import { EventCard, ScenePlayer } from '../scene';
import type { LogEntry } from '../core/types';

/** How far back in the log the area looks for a scene (the newest entries only: an old scene is not played late). */
const LOOK_BACK = 40;
/** Systems whose entries may carry a scene or a card (the others are bookkeeping). */
const SCENE_SYS = new Set(['world', 'story', 'combat', 'god', 'bonds', 'npc']);

function newestScene(entries: readonly LogEntry[], data: NonNullable<typeof store.gameData>): { play?: SceneView; card?: SceneView } {
  let card: SceneView | undefined;
  for (let i = entries.length - 1; i >= Math.max(0, entries.length - LOOK_BACK); i--) {
    const e = entries[i];
    if (e.level < 1 || !SCENE_SYS.has(e.sys)) continue;
    const v = sceneFor(data, e);
    if (v.kind === 'script') return { play: v, card };
    if (!card && e.sys === 'world') card = v;
  }
  return { card };
}

export function LifeScene() {
  void store.rev.value;
  const st = store.state;
  const data = store.gameData;
  const [played, setPlayed] = useState(-1);
  const found = useMemo(() => (st && data ? newestScene(st.log, data) : {}), [st?.logN]);
  const play = found.play && found.play.entry.n > played ? found.play : undefined;
  if (play && play.kind === 'script') return <ScenePlayer script={play.script} controls onDone={() => setPlayed(play.entry.n)} />;
  if (found.card) return <EventCard card={found.card.card} />;
  return null;
}
