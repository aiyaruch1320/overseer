// The scene area of the watch screen (20-god-ui.md §2 "ฉากชีวิต"): the newest entry of the log that has a scene script is played once;
// between scenes the card of a recent world event stays up, and when there is none a calm picture (never a black box). The scene mapping is
// src/app/views/scene.ts, the player src/scene.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { store } from '../app/store';
import { castAt, idleCast, moves } from '../app/views/idle-cast';
import { lifeStartN } from '../app/views/watch';
import { figuresOf, heldScene, idleView, labelsOf, sceneFor, sceneryOf, type IdleView, type SceneView } from '../app/views/scene';
import { allSilhouettes, EventCard, Stage, ScenePlayer, type Frame, type FigureOf } from '../scene';
import { sceneryFor, specKey } from '../scene/scenery';
import { GodEffectLine } from './god';
import type { GameState, LogEntry } from '../core/types';
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

function newestScene(entries: readonly LogEntry[], data: NonNullable<typeof store.gameData>, worldYear: number, state: GameState): { play?: SceneView; card?: SceneView } {
  let card: SceneView | undefined;
  // what happened before the birth of the life on the stage is not its scene (a baby opened under the last era's "การตัดสินกุญแจ", T2-16)
  const from = lifeStartN(state);
  for (let i = entries.length - 1; i >= Math.max(0, entries.length - LOOK_BACK); i--) {
    const e = entries[i];
    if (e.n < from) break;
    if (e.level < 1 || !SCENE_SYS.has(e.sys)) continue;
    const v = sceneFor(data, e, state);
    if (v.kind === 'script') return { play: v, card };
    if (!card && e.sys === 'world' && e.worldYear >= worldYear - CARD_YEARS) card = v;
  }
  return { card };
}

/** How often the faint ambient of the place moves in the calm picture, and how fast its clock runs (the stage is only woken for this, the rest of the picture is still). */
const IDLE_TICK_MS = 140;

const REDUCED = '(prefers-reduced-motion: reduce)';
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia(REDUCED).matches;

/** The time the ambient of the place moves by: a clock that runs only while the place has an ambient, the tab is shown and the viewer has not asked for stillness. */
function useAmbientClock(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on || reduced()) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) setT((performance.now() - t0) / 1000);
    }, IDLE_TICK_MS);
    return () => clearInterval(id);
  }, [on]);
  return t;
}

/**
 * The calm picture between scenes (M7 ก4): the pixel stage with the painted place of the life (its continent and country, under the sky, in the season: four seasons are four
 * pictures), the main character standing at the age of the life, the faint particles of the place, and the line under it. The stage is mounted once; it is handed a new frame
 * only when the place, the season, the figure or the pose changes (the watch screen's clock ticks often, and a tick does not wake it).
 */
function Idle({ v, data, state }: { v: IdleView; data: NonNullable<typeof store.gameData>; state: GameState }) {
  // who is in the picture: the people of the life, the passers-by and the vignette of a recent happening (src/app/views/idle-cast.ts); found again only when the log, the season or the place changes
  const sceneKey = specKey(v.scenery);
  const cast = useMemo(() => idleCast(data, state, v), [state.logN, state.life?.hAge, state.clock.worldYear, v.season, sceneKey, data]);
  const sc = cast.scenery;
  const ambient = useMemo(() => !!sceneryFor(sc).ambient, [specKey(sc)]);
  const motion = useAmbientClock(ambient || moves(cast));
  const scenery = useMemo(() => () => sc, [specKey(sc)]);
  const figureOf = useMemo<FigureOf>(() => ({ id }) => cast.figures.get(id) ?? allSilhouettes({ id, label: '', count: 1 }), [cast]);
  const labelOf = useMemo(() => ({ id }: { id: string }) => cast.labels.get(id) ?? '', [cast]);
  const still = reduced();
  const frame = useMemo<Frame>(
    () => ({
      t: 0,
      done: false,
      place: '',
      sky: v.sky,
      ground: v.ground,
      wash: null,
      camera: { frame: 'eye', zoom: 1, lift: 0, x: 0 },
      light: { mode: 'diffuse' },
      fx: [],
      actors: castAt(cast, motion, still),
      texts: [],
      strike: null,
      sounds: [],
      motion,
    }),
    [v.sky, v.ground, cast, motion, still],
  );
  return (
    <div role="img" aria-label={`ชีวิตดำเนินไป · ${v.caption}`} style={{ position: 'relative', width: '100%' }} data-testid="idle-scene" data-season={v.season} data-stage={v.figure.stage} data-continent={sc.continent}>
      <Stage frame={frame} frameColor={color.line} seed={sceneKey} scenery={scenery} figureOf={figureOf} labelOf={labelOf} mood={false} />
      {/* the line sits in the sky: at the foot of the stage it lay over a child or a short people standing at 1× (M7 review) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '5%', textAlign: 'center', fontFamily: font.body, fontSize: size.small, color: color.text, padding: '0 8%', pointerEvents: 'none' }}>
        <div style={{ display: 'inline-block', textShadow: '0 1px 4px #000, 0 0 2px #000', background: 'rgba(0,0,0,0.42)', padding: '2px 10px', borderRadius: 4 }}>{v.caption}</div>
        {v.latest && (
          <div style={{ marginTop: 3 }}>
            <span style={{ display: 'inline-block', textShadow: '0 1px 4px #000, 0 0 2px #000', background: 'rgba(0,0,0,0.58)', padding: '2px 10px', borderRadius: 4, color: color.text, whiteSpace: 'normal', overflowWrap: 'anywhere' }} data-testid="idle-latest">
              {v.latest}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LifeScene(props: { data?: NonNullable<typeof store.gameData>; state?: NonNullable<typeof store.state> } = {}) {
  void store.rev.value;
  const st = props.state ?? store.state;
  const data = props.data ?? store.gameData;
  const [played, setPlayed] = useState(-1);
  const found = useMemo(() => (st && data ? newestScene(st.log, data, st.clock.worldYear, st) : {}), [st?.logN]);
  const held = useRef<SceneView | undefined>(undefined);
  const play = heldScene(held.current, found.play, played, st?.logN ?? 0);
  held.current = play;
  // who is on the stage and where it is: resolved once per scene (src/app/views/scene.ts)
  const staged = useMemo(() => (play && data ? { figureOf: figuresOf(data, st, play), scenery: sceneryOf(data, st, play), labelOf: labelsOf(data, st, play) } : undefined), [play?.entry.n, data]);
  // The stage is a 16:9 box that fits what is left of the scene area: the controls under it, the layer bar above, the name and the map at the sides.
  // A stage as wide as the area would run over the story log, and its title over the name of the character.
  const fit = `min(100cqw, calc((100cqh - ${CONTROLS}px) * 16 / 9), 960px)`;
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: `${size.bar}px ${GUTTER.right}px 0 ${GUTTER.left}px`, containerType: 'size', display: 'flex', justifyContent: 'center', alignItems: 'center' }} data-testid="life-scene">
      <div style={{ width: fit, maxWidth: '100%' }}>
        {play && play.kind === 'script' ? (
          <ScenePlayer script={play.script} controls figureOf={staged?.figureOf} scenery={staged?.scenery} labelOf={staged?.labelOf} caption={st && data ? idleView(data, st).caption : undefined} onDone={() => setPlayed(play.entry.n)} />
        ) : found.card ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', maxHeight: '100cqh', overflowY: 'auto' }}>
            <EventCard card={found.card.card} />
          </div>
        ) : (
          st && data ? <Idle v={idleView(data, st)} data={data} state={st} /> : null
        )}
        {/* what the god's hand did lately (a small or middle miracle has no script of its own): one line under the stage */}
        {!play && <GodEffectLine />}
      </div>
    </div>
  );
}
