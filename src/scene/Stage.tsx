// Draws one `Frame` of a scene (timeline.ts). It holds no time and no state: the same frame draws the same picture, so the player, the storybook and a
// test of the frame all agree. The picture is a Phaser game of 320 × 180 art pixels (stage/controller.ts, loaded on demand: its own chunk) shown at the
// largest whole multiple that fits the box (21-pixel-art.md §4); the Thai words are DOM over it, sized by the same multiple so a line keeps its place in
// the picture. The particles and the light are pixels inside the Phaser game too (../scene/fx, drawn by the stage), not a canvas laid over it.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ScenerySpec } from '../art/scenery';
import { color, font } from '../ui/tokens';
import { allSilhouettes, type FigureOf } from './figures';
export { Silhouette } from './Silhouette';
import { cameraOf, fitScale, project } from './layout';
import { seedOf } from './particles';
import type { SceneStage } from './stage/controller';
import type { Frame } from './timeline';
import { ART, CAMERA, STAGE, TEXT } from './tuning';

/** The scenery of a stage that was told none: a plain place of the first continent. */
export const PLAIN_SCENERY: ScenerySpec = { continent: 'AZ', setting: 'outdoor' };

/** The scenery of a scene by the place the frame names (the setting of a place is guessed from its words: src/app/views/scene.ts `sceneryOf`). */
export type SceneryOf = (place: string) => ScenerySpec;

const zone = { position: 'absolute', left: 0, right: 0, padding: '0 6%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none' } as const;

export interface StageProps {
  frame: Frame;
  frameColor: string;
  seed: string;
  /** The place of the scene for the painted layers; omit for a plain place. */
  scenery?: SceneryOf;
  /** Who each actor is; omit and everyone is the dark silhouette. */
  figureOf?: FigureOf;
}

export function Stage({ frame, frameColor, seed, scenery, figureOf = allSilhouettes }: StageProps) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<SceneStage | null>(null);
  const [k, setK] = useState(3);
  const [ready, setReady] = useState(false);
  const sd = seedOf(seed);

  // the whole multiple that fits the box, kept as the box changes size
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(fitScale(el.clientWidth, el.clientHeight));
    fit();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phaser comes in its own chunk, the first time a stage is shown; until it does the box shows the colours of the frame
  const zoom = useRef(k);
  zoom.current = k;
  useEffect(() => {
    let dead = false;
    let made: SceneStage | null = null;
    import('./stage/controller').then(({ SceneStage }) => {
      if (dead || !host.current) return;
      made = new SceneStage(host.current, zoom.current);
      ctl.current = made;
      made.set(input.current);
      setReady(true);
    });
    return () => {
      dead = true;
      made?.destroy();
      ctl.current = null;
      setReady(false);
    };
  }, []);

  const input = useRef<Parameters<SceneStage['set']>[0]>(null as never);
  input.current = { frame, frameColor, scenery: (scenery ?? (() => PLAIN_SCENERY))(frame.place), figureOf, seed: sd };
  useEffect(() => {
    ctl.current?.set(input.current);
  });
  useEffect(() => {
    ctl.current?.setZoom(k);
  }, [k]);

  const cam = cameraOf(frame.camera);
  const by = (role: string) => frame.texts.filter((x) => x.role === role);
  const px = (n: number) => Math.max(TEXT.min, n * k);

  return (
    <div
      ref={box}
      data-scene-frame
      data-scale={k}
      data-stage-ready={ready ? '' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: STAGE.maxWidth,
        aspectRatio: String(STAGE.ratio),
        overflow: 'hidden',
        background: '#0c0d12',
        borderRadius: 6,
        boxSizing: 'border-box',
        fontFamily: font.body,
        color: color.text,
      }}
    >
      {/* the picture: 320 × 180 art pixels at k× (a box that is not a whole multiple keeps dark bars) */}
      <div
        data-pixel-stage
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: ART.w * k,
          height: ART.h * k,
          transform: 'translate(-50%, -50%)',
          background: `linear-gradient(to bottom, ${frame.sky} 0%, ${frame.sky} 58%, ${frame.ground} 58%, ${frame.ground} 100%)`,
        }}
      >
        <div ref={host} style={{ position: 'absolute', inset: 0, lineHeight: 0, overflow: 'hidden' }} />

        {frame.actors.map((a) => {
          const p = project(cam, a.x * ART.w, ART.groundY);
          return (
            <div key={a.id} data-slot="character" data-actor={a.id} style={{ position: 'absolute', left: p.x * k, top: (p.y + 3 * cam.zoom) * k, transform: 'translateX(-50%)', fontSize: px(TEXT.label), color: color.textDim, whiteSpace: 'nowrap', textShadow: '0 1px 3px #000', pointerEvents: 'none' }}>
              {a.label}
            </div>
          );
        })}

        <div style={{ ...zone, top: '5%', alignItems: 'flex-start' }}>
          {by('title').map((x, i) => (
            <div key={i} style={{ opacity: x.alpha, fontFamily: font.title, fontSize: px(TEXT.title), textShadow: '0 1px 6px #000' }}>{x.text}</div>
          ))}
        </div>
        <div style={{ ...zone, top: '5%', alignItems: 'flex-end' }}>
          {by('stage').map((x, i) => (
            <div key={i} style={{ opacity: x.alpha * 0.8, fontSize: px(TEXT.stage), color: color.textDim }}>{x.text}</div>
          ))}
        </div>
        <div style={{ ...zone, top: '30%' }}>
          {by('name').map((x, i) => (
            <div key={i} style={{ opacity: x.alpha, fontFamily: font.title, fontSize: px(TEXT.name), textShadow: '0 2px 10px #000', textAlign: 'center' }}>{x.text}</div>
          ))}
          {frame.strike && (
            <div style={{ textAlign: 'center', textShadow: '0 2px 10px #000' }}>
              <div style={{ fontSize: px(TEXT.strike), color: color.textDim, textDecoration: 'line-through', textDecorationColor: color.dread, textDecorationThickness: 3, opacity: 1 - frame.strike.progress * 0.5 }}>{frame.strike.from}</div>
              <div style={{ fontFamily: font.title, fontSize: px(TEXT.strikeTo), opacity: frame.strike.progress }}>{frame.strike.to}</div>
            </div>
          )}
        </div>
        <div style={{ ...zone, bottom: '5%' }}>
          {by('line').map((x, i) => (
            <div key={i} style={{ opacity: x.alpha, fontSize: px(TEXT.line), textAlign: 'center', textShadow: '0 1px 6px #000, 0 0 2px #000', background: 'rgba(0,0,0,0.38)', padding: '2px 10px', borderRadius: 4 }}>{x.text}</div>
          ))}
          {by('result').map((x, i) => (
            <div key={i} style={{ opacity: x.alpha, fontSize: px(TEXT.result), textAlign: 'center', color: color.light, textShadow: '0 1px 6px #000', background: 'rgba(0,0,0,0.44)', padding: '2px 12px', borderRadius: 4 }}>{x.text}</div>
          ))}
        </div>
        <div style={{ position: 'absolute', right: 8, bottom: 6, fontSize: px(TEXT.label), color: color.textDim, opacity: 0.5, pointerEvents: 'none' }}>{frame.place}</div>
        {frame.sounds.length > 0 && (
          <div style={{ position: 'absolute', left: 10, bottom: 6, fontSize: px(TEXT.label), color: color.textDim, opacity: 0.85 }}>♪ {frame.sounds.join(' · ')}</div>
        )}
      </div>
      {/* the rim of the frame lies over the edge of the picture, so the box is measured whole */}
      <div style={{ position: 'absolute', inset: 0, border: `3px solid ${frameColor}`, borderRadius: 6, boxSizing: 'border-box', pointerEvents: 'none' }} />
    </div>
  );
}

/** The camera frames the stage can show, for the storybook (a list, so a story draws each one). */
export const CAMERA_FRAMES = Object.keys(CAMERA) as (keyof typeof CAMERA)[];
