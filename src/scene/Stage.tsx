// Draws one `Frame` of a scene (timeline.ts) with DOM, CSS and a canvas for the particles. It holds no time and no state: the same frame
// draws the same picture, so the player, the storybook and a test of the frame all agree. The art of M6 to M7 comes in at two places:
// `slot` (a character) and the background (a picture instead of the gradient), without changing the player.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { color, font } from '../ui/tokens';
import type { ActorView, Frame } from './timeline';
import { drawFx, seedOf } from './particles';
import { CAMERA, FIGURE, LIGHT, POSE, STAGE } from './tuning';

export type CharacterSlot = (a: ActorView, frameColor: string) => ComponentChildren;

const CANVAS = { w: 960, h: 540 } as const;

/** The placeholder silhouette of a character slot (art comes in M6): a head and a cloak, dark with a light rim. */
export function Silhouette({ a, frame }: { a: ActorView; frame: string }) {
  const pose = POSE[a.pose];
  const rim = a.tint ?? frame;
  const one = (k: number, n: number) => (
    <svg
      key={k}
      viewBox="0 0 60 120"
      style={{
        height: '100%',
        aspectRatio: '1 / 2',
        overflow: 'visible',
        transformOrigin: '50% 100%',
        transform: `translate(${(k - (n - 1) / 2) * 38}%, ${pose.drop * 100}%) rotate(${pose.rot}deg) scale(${pose.scale * (n > 1 ? FIGURE.crowdScale : 1)})`,
        transition: 'transform 0.4s',
      }}
    >
      <ellipse cx="30" cy="14" rx="9" ry="10" fill="#07080c" stroke={rim} stroke-opacity="0.55" stroke-width="1.2" />
      <path d="M13 114 L18 42 Q30 28 42 42 L47 114 Z" fill="#07080c" fill-opacity="0.92" stroke={rim} stroke-opacity="0.55" stroke-width="1.2" />
      {pose.arm ? <path d="M42 46 L54 14" stroke={rim} stroke-opacity="0.8" stroke-width="3" stroke-linecap="round" /> : null}
    </svg>
  );
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>{Array.from({ length: a.count }, (_, k) => one(k, a.count))}</div>;
}

const zone = { position: 'absolute', left: 0, right: 0, padding: '0 6%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none' } as const;

export function Stage({ frame, frameColor, seed, slot }: { frame: Frame; frameColor: string; seed: string; slot?: CharacterSlot }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sd = seedOf(seed);
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (c) drawFx(c, CANVAS.w, CANVAS.h, frame.fx, frame.motion, sd);
  });

  const cam = frame.camera;
  const L = LIGHT[frame.light.mode];
  const lc = frame.light.color ?? L.color;
  const lightBg =
    L.from === 'front'
      ? `linear-gradient(to top, ${lc} 0%, transparent 70%)`
      : L.from === 'back'
        ? `linear-gradient(to bottom, ${lc} 0%, transparent 65%)`
        : L.from === 'centre'
          ? `radial-gradient(ellipse at 50% 55%, ${lc} 0%, transparent 70%)`
          : lc;
  const by = (role: string) => frame.texts.filter((x) => x.role === role);

  return (
    <div
      data-scene-frame
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: STAGE.maxWidth,
        aspectRatio: String(STAGE.ratio),
        overflow: 'hidden',
        background: `linear-gradient(to bottom, ${frame.sky} 0%, ${frame.sky} 58%, ${frame.ground} 58%, ${frame.ground} 100%)`,
        border: `3px solid ${frameColor}`,
        borderRadius: 6,
        boxSizing: 'border-box',
        fontFamily: font.body,
        color: color.text,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 60%', transform: `translate(${cam.x * 10}%, ${cam.lift * 100}%) scale(${cam.zoom})` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', textAlign: 'center', fontFamily: font.title, fontSize: 'clamp(14px, 3.2vw, 30px)', color: color.text, opacity: 0.14, padding: '0 8%' }}>{frame.place}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '42%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
        {frame.actors.map((a) => (
          <div key={a.id} data-slot="character" data-actor={a.id} style={{ position: 'absolute', left: `${a.x * 100}%`, bottom: '36%', height: `${FIGURE.height * 100}%`, width: `${a.count > 1 ? FIGURE.width * 100 * 1.6 : FIGURE.width * 100 * 0.56}%`, transform: 'translateX(-50%)' }}>
            {slot ? slot(a, frameColor) : <Silhouette a={a} frame={frameColor} />}
            <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', fontSize: 11, color: color.textDim, whiteSpace: 'nowrap' }}>{a.label}</div>
          </div>
        ))}
      </div>
      <canvas ref={canvas} width={CANVAS.w} height={CANVAS.h} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: lightBg, opacity: L.alpha, pointerEvents: 'none' }} />
      {frame.wash && <div style={{ position: 'absolute', inset: 0, background: frame.wash.color, opacity: frame.wash.amount, pointerEvents: 'none' }} />}

      <div style={{ ...zone, top: '5%', alignItems: 'flex-start' }}>
        {by('title').map((x, i) => (
          <div key={i} style={{ opacity: x.alpha, fontFamily: font.title, fontSize: 'clamp(16px, 3vw, 28px)', textShadow: '0 1px 6px #000' }}>{x.text}</div>
        ))}
      </div>
      <div style={{ ...zone, top: '5%', alignItems: 'flex-end' }}>
        {by('stage').map((x, i) => (
          <div key={i} style={{ opacity: x.alpha * 0.8, fontSize: 12, color: color.textDim }}>{x.text}</div>
        ))}
      </div>
      <div style={{ ...zone, top: '38%' }}>
        {by('name').map((x, i) => (
          <div key={i} style={{ opacity: x.alpha, fontFamily: font.title, fontSize: 'clamp(20px, 4.4vw, 40px)', textShadow: '0 2px 10px #000', textAlign: 'center' }}>{x.text}</div>
        ))}
        {frame.strike && (
          <div style={{ textAlign: 'center', textShadow: '0 2px 10px #000' }}>
            <div style={{ fontSize: 'clamp(16px, 2.6vw, 26px)', color: color.textDim, textDecoration: 'line-through', textDecorationColor: color.dread, textDecorationThickness: 3, opacity: 1 - frame.strike.progress * 0.5 }}>{frame.strike.from}</div>
            <div style={{ fontFamily: font.title, fontSize: 'clamp(22px, 4.6vw, 44px)', opacity: frame.strike.progress }}>{frame.strike.to}</div>
          </div>
        )}
      </div>
      <div style={{ ...zone, bottom: '5%' }}>
        {by('line').map((x, i) => (
          <div key={i} style={{ opacity: x.alpha, fontSize: 'clamp(13px, 2vw, 20px)', textAlign: 'center', textShadow: '0 1px 6px #000, 0 0 2px #000', background: 'rgba(0,0,0,0.28)', padding: '2px 10px', borderRadius: 4 }}>{x.text}</div>
        ))}
        {by('result').map((x, i) => (
          <div key={i} style={{ opacity: x.alpha, fontSize: 'clamp(14px, 2.2vw, 22px)', textAlign: 'center', color: color.light, textShadow: '0 1px 6px #000', background: 'rgba(0,0,0,0.34)', padding: '2px 12px', borderRadius: 4 }}>{x.text}</div>
        ))}
      </div>
      {frame.sounds.length > 0 && (
        <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 11, color: color.textDim, opacity: 0.85 }}>♪ {frame.sounds.join(' · ')}</div>
      )}
    </div>
  );
}

/** The camera frames the stage can show, for the storybook (a list, so a story draws each one). */
export const CAMERA_FRAMES = Object.keys(CAMERA) as (keyof typeof CAMERA)[];
