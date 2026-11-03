// The scene player (code-plan §8.3): `<ScenePlayer script onDone />` plays a script of beats on the stage. It moves a clock and asks
// `frameAt` for the picture; skip jumps to the end, speed scales the clock. The script is data (data/gen/scenes.json), never code per scene.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SceneScript } from '../core/data/types-scenes';
import { color, font, size } from '../ui/tokens';
import type { FigureOf } from './figures';
import { Stage, type SceneryOf } from './Stage';
import { frameAt, soundsBetween } from './timeline';
import { MAX_STEP, SPEEDS, STAGE, WORDS } from './tuning';

export interface ScenePlayerProps {
  script: SceneScript;
  /** Called once when the scene ends or is skipped. */
  onDone?: () => void;
  /** Starting speed (1, 2 or 4). */
  speed?: number;
  autoplay?: boolean;
  /** Start at this second (a story that shows the middle of a scene). */
  startAt?: number;
  controls?: boolean;
  /** Start again a moment after the end (the storybook shows a beat over and over). */
  loop?: boolean;
  /** Called when the clock passes a sound cue; the player has no sound of its own yet (art and sound come in M6 to M7). */
  onSound?: (cue: string) => void;
  /** Who each actor is (src/app/views/scene.ts `figuresOf`); omit and everyone is a silhouette. */
  figureOf?: FigureOf;
  /** The place of the scene for the painted layers (src/app/views/scene.ts `sceneryOf`); omit for a plain place. */
  scenery?: SceneryOf;
}

export function ScenePlayer({ script, onDone, speed: speed0 = 1, autoplay = true, startAt = 0, controls = true, loop = false, onSound, figureOf, scenery }: ScenePlayerProps) {
  const [t, setT] = useState(startAt);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(speed0);
  const clock = useRef({ t: startAt, done: false });
  const done = useRef(onDone);
  done.current = onDone;
  const sound = useRef(onSound);
  sound.current = onSound;

  // a new script starts again
  useEffect(() => {
    clock.current = { t: startAt, done: false };
    setT(startAt);
    setPlaying(autoplay);
    for (const c of soundsBetween(script, -1, startAt)) sound.current?.(c);
  }, [script]);

  const finish = () => {
    if (clock.current.done) return;
    clock.current.done = true;
    done.current?.();
  };

  useEffect(() => {
    if (!playing || clock.current.done) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(MAX_STEP, (now - last) / 1000) * speed;
      last = now;
      const prev = clock.current.t;
      const next = Math.min(script.seconds, prev + dt);
      clock.current.t = next;
      for (const c of soundsBetween(script, prev, next)) sound.current?.(c);
      setT(next);
      if (next >= script.seconds) {
        setPlaying(false);
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, script]);

  const skip = () => {
    clock.current.t = script.seconds;
    setT(script.seconds);
    setPlaying(false);
    finish();
  };
  const again = () => {
    clock.current = { t: 0, done: false };
    setT(0);
    setPlaying(true);
  };

  const frame = frameAt(script, t);
  const ended = frame.done;
  useEffect(() => {
    if (!loop || !ended) return;
    const h = setTimeout(() => {
      clock.current = { t: 0, done: false };
      setT(0);
      setPlaying(true);
    }, 1200);
    return () => clearTimeout(h);
  }, [loop, ended, script]);
  const btn = { background: 'transparent', color: color.text, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: '2px 10px', cursor: 'pointer', fontFamily: font.body, fontSize: size.small } as const;
  const atEnd = frame.done;

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          if (atEnd) again();
          else setPlaying((p) => !p);
        } else if (e.key === 'Escape' || e.key === 'Enter') skip();
        else if (e.key === '+' || e.key === '=') setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, SPEEDS.indexOf(s as 1)) + 1)]);
        else if (e.key === '-') setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s as 1) - 1)]);
      }}
      style={{ width: '100%', maxWidth: STAGE.maxWidth, outline: 'none' }}
      data-scene={script.id}
    >
      <Stage frame={frame} frameColor={script.frame} seed={script.id} figureOf={figureOf} scenery={scenery} />
      {controls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: size.gap, marginTop: 6, fontFamily: font.body, fontSize: size.small, color: color.textDim }}>
          <button style={btn} onClick={() => (atEnd ? again() : setPlaying(!playing))}>
            {atEnd ? WORDS.again : playing ? WORDS.pause : WORDS.play}
          </button>
          <div style={{ flex: 1, height: 4, background: color.line, borderRadius: 2 }}>
            <div style={{ width: `${(t / script.seconds) * 100}%`, height: '100%', background: script.frame, borderRadius: 2 }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {t.toFixed(1)} / {script.seconds.toFixed(0)}
          </span>
          {SPEEDS.map((s) => (
            <button key={s} aria-label={`${WORDS.speed} ${s}`} style={{ ...btn, ...(s === speed ? { color: color.light, borderColor: color.light } : {}) }} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
          <button style={btn} onClick={skip} disabled={atEnd}>
            {WORDS.skip}
          </button>
        </div>
      )}
    </div>
  );
}
