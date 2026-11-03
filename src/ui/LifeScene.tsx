// The scene area of the watch screen (20-god-ui.md §2 "ฉากชีวิต"): the newest entry of the log that has a scene script is played once;
// between scenes the card of a recent world event stays up, and when there is none a calm picture (never a black box). The scene mapping is
// src/app/views/scene.ts, the player src/scene.
import { useMemo, useState } from 'preact/hooks';
import { store } from '../app/store';
import { sceneFor, type SceneView } from '../app/views/scene';
import { EventCard, ScenePlayer, Silhouette, type ActorView } from '../scene';
import type { LogEntry } from '../core/types';
import { color, font, size } from './tokens';

/** How far back in the log the area looks for a scene (the newest entries only: an old scene is not played late). */
const LOOK_BACK = 40;
/** A card of a world event stays up this many world years, then the calm picture takes its place (an old event is not today's news). */
const CARD_YEARS = 6;
/** The room the watch screen keeps in the scene area (WatchView): the name and the candle at the left, the mini-map at the right, the layer bar on top. */
const GUTTER = { left: 200, right: 224 } as const;
/** The row of the scene player's controls under the stage (button 24 px and the gap). */
const CONTROLS = 38;
/** Systems whose entries may carry a scene or a card (the others are bookkeeping). */
const SCENE_SYS = new Set(['world', 'story', 'combat', 'god', 'bonds', 'npc']);

function newestScene(entries: readonly LogEntry[], data: NonNullable<typeof store.gameData>, worldYear: number): { play?: SceneView; card?: SceneView } {
  let card: SceneView | undefined;
  for (let i = entries.length - 1; i >= Math.max(0, entries.length - LOOK_BACK); i--) {
    const e = entries[i];
    if (e.level < 1 || !SCENE_SYS.has(e.sys)) continue;
    const v = sceneFor(data, e);
    if (v.kind === 'script') return { play: v, card };
    if (!card && e.sys === 'world' && e.worldYear >= worldYear - CARD_YEARS) card = v;
  }
  return { card };
}

const IDLE_ACTOR: ActorView = { id: 'idle', label: '', x: 0.5, pose: 'stand', count: 1 };

/** The calm picture between scenes: dusk over a horizon, the character standing, the light breathing. */
function Idle() {
  return (
    <div role="img" aria-label="ชีวิตดำเนินไป" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', boxSizing: 'border-box', border: `3px solid ${color.line}`, borderRadius: 6, background: 'linear-gradient(to bottom, #1b1a2a 0%, #1b1a2a 58%, #11121a 58%, #11121a 100%)' }} data-testid="idle-scene">
      <style>{'@keyframes ls-breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } } .ls-breathe { animation: ls-breathe 6s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .ls-breathe { animation: none; } }'}</style>
      <div class="ls-breathe" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 58%, #e8c36a33 0%, transparent 60%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '58%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', left: '50%', bottom: '36%', height: '40%', width: '12%', transform: 'translateX(-50%)' }}>
        <Silhouette a={IDLE_ACTOR} frame={color.textDim} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '6%', textAlign: 'center', fontFamily: font.body, fontSize: size.small, color: color.textDim }}>ชีวิตดำเนินไป</div>
    </div>
  );
}

export function LifeScene() {
  void store.rev.value;
  const st = store.state;
  const data = store.gameData;
  const [played, setPlayed] = useState(-1);
  const found = useMemo(() => (st && data ? newestScene(st.log, data, st.clock.worldYear) : {}), [st?.logN]);
  const play = found.play && found.play.entry.n > played ? found.play : undefined;
  // The stage is a 16:9 box that fits what is left of the scene area: the controls under it, the layer bar above, the name and the map at the sides.
  // A stage as wide as the area would run over the story log, and its title over the name of the character.
  const fit = `min(100cqw, calc((100cqh - ${CONTROLS}px) * 16 / 9), 960px)`;
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: `${size.bar}px ${GUTTER.right}px 0 ${GUTTER.left}px`, containerType: 'size', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }} data-testid="life-scene">
      <div style={{ width: fit, maxWidth: '100%' }}>
        {play && play.kind === 'script' ? (
          <ScenePlayer script={play.script} controls onDone={() => setPlayed(play.entry.n)} />
        ) : found.card ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', maxHeight: '100cqh', overflowY: 'auto' }}>
            <EventCard card={found.card.card} />
          </div>
        ) : (
          <Idle />
        )}
      </div>
    </div>
  );
}
