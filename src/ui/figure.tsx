// The pixel figures in the DOM screens (code-plan §8.2, 21-pixel-art.md §4): a portrait is one frame on a small canvas, 3× (the cards, the character,
// the allies, the start and the end); a sprite is the sheet of a look played on a canvas in the pose it is asked for (the idle scene, the stage of a
// scene, the fighters of a battle). The stage of the map and the big scenes become Phaser in M7 (src/art/phaser.ts, beast/phaser.ts); these are the
// same sheets, painted once per look and kept (sheetCanvas), so the DOM and Phaser draw the same pixels.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FRAME, POSE_OF, POSES, SHEET_COLS, frameAt, type Pose } from '../art/anim';
import { BEAST_POSES, FRAMES, poseRow } from '../art/beast/kit';
import { beastKey, type BeastLook } from '../art/beast/look';
import { beastSheetCanvas } from '../art/beast/sheet';
import { lookKey, type PersonLook } from '../art/look';
import { portrait, sheetCanvas } from '../art/sheet';
import { color } from './tokens';

const still = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the portrait ----------

export interface PortraitProps {
  look: PersonLook;
  /** pixels per art pixel (21-pixel-art.md §4: 3×) */
  scale?: number;
  pose?: Pose;
  i?: number;
  /** rows cut off the top of the frame (the frame has room above a raised staff); by default more for the small stages of life (an infant is 45% of an adult) */
  crop?: number;
  label?: string;
  frame?: string;
  testid?: string;
}

/** One frame of a look on a small canvas. Draws nothing where a canvas cannot be made (a test without a DOM). */
export function Portrait({ look, scale = 3, pose = 'idle', i = 0, crop: cropIn, label, frame = color.line, testid = 'portrait' }: PortraitProps) {
  const host = useRef<HTMLSpanElement>(null);
  const crop = cropIn ?? (look.stage === 'infant' ? 26 : look.stage === 'child' ? 14 : 6);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      el.replaceChildren(portrait(look, scale, pose, i, crop));
    } catch {
      el.replaceChildren();
    }
  }, [look.key, look.stage, look.outfit, look.hat, look.tool, look.main, look.second, look.hair, look.beard, look.feats.join(), scale, pose, i, crop]);
  return (
    <span
      ref={host}
      role="img"
      aria-label={label ?? look.key}
      data-testid={testid}
      data-race={look.race}
      data-stage={look.stage}
      style={{ display: 'inline-block', lineHeight: 0, verticalAlign: 'top', boxSizing: 'border-box', border: `1px solid ${frame}`, borderRadius: 4, background: '#14151c', overflow: 'hidden' }}
    />
  );
}

/** A person or a beast (an NPC who is a creature: a slime, a ghost, the kraken: src/art/npc-beasts.ts). */
export type Figure = PersonLook | BeastLook;
export const isPerson = (f: Figure): f is PersonLook => f.kind === 'person';

/** The idle frame of a beast fitted into the box a person's portrait takes at this scale (a big beast is shown smaller, pixels kept square where it fits). */
export function BeastPortrait({ beast, scale = 3, label, frame = color.line, testid = 'portrait' }: { beast: BeastLook; scale?: number; label?: string; frame?: string; testid?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      const fr = FRAMES[beast.size], box = FRAME.w * scale;
      const k = Math.min(box / fr.w, box / fr.h);
      const c = document.createElement('canvas');
      c.width = fr.w; c.height = fr.h;
      const g = c.getContext('2d')!;
      g.drawImage(beastSheetCanvas(beast), 0, poseRow('idle') * fr.h, fr.w, fr.h, 0, 0, fr.w, fr.h);
      c.style.width = `${Math.round(fr.w * k)}px`; c.style.height = `${Math.round(fr.h * k)}px`; c.style.imageRendering = 'pixelated';
      el.replaceChildren(c);
    } catch {
      el.replaceChildren();
    }
  }, [beastKey(beast), scale]);
  return <span ref={host} role="img" aria-label={label ?? beast.id} data-testid={testid} data-beast={beast.id} style={{ display: 'inline-block', lineHeight: 0, verticalAlign: 'top', boxSizing: 'border-box', border: `1px solid ${frame}`, borderRadius: 4, background: '#14151c', overflow: 'hidden' }} />;
}

/** The portrait of a person or a beast. */
export function FigurePortrait(p: Omit<PortraitProps, 'look'> & { fig: Figure }) {
  const { fig, ...rest } = p;
  return isPerson(fig) ? <Portrait look={fig} {...rest} /> : <BeastPortrait beast={fig} scale={rest.scale} label={rest.label} frame={rest.frame} testid={rest.testid} />;
}

// ---------- the sprite ----------

/** The poses of the stage and the battle (src/scene/tuning.ts POSE) as the poses of a person's sheet. */
export const PERSON_POSE: Record<string, Pose> = { stand: 'idle', walk: 'walk', kneel: 'sit', lie: 'die', raise: 'cheer', bow: 'pray', fall: 'die', strike: 'attack', hurt: 'hurt' };
/** … and as the five poses of a beast's sheet. */
export const BEAST_POSE: Record<string, Pose> = { stand: 'idle', walk: 'walk', kneel: 'hurt', lie: 'die', raise: 'attack', bow: 'hurt', fall: 'die', strike: 'attack', hurt: 'hurt' };

interface SheetProps {
  sheet: () => HTMLCanvasElement;
  cell: { w: number; h: number; foot: number; cx: number };
  row: number;
  /** the pose played: its frames, timing and whether it loops */
  pose: Pose;
  /** whole device pixels per art pixel */
  zoom: number;
  flip?: boolean;
  label?: string;
  testid?: string;
  /** frame held instead of playing (a still picture) */
  hold?: number;
  glow?: string;
}

/** A sheet row played on a canvas, its feet at the bottom centre of the box that holds it (the box is positioned; the canvas hangs from there). */
function SheetAnim({ sheet, cell, row, pose, zoom, flip, label, testid, hold, glow }: SheetProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const spec = POSE_OF[pose];
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    let g: CanvasRenderingContext2D | null = null;
    let img: HTMLCanvasElement;
    try {
      g = c.getContext('2d');
      img = sheet();
    } catch {
      return;
    }
    if (!g) return;
    const ctx = g;
    ctx.imageSmoothingEnabled = false;
    let shown = -1;
    const draw = (f: number) => {
      if (f === shown) return;
      shown = f;
      ctx.clearRect(0, 0, cell.w, cell.h);
      ctx.drawImage(img, f * cell.w, row * cell.h, cell.w, cell.h, 0, 0, cell.w, cell.h);
    };
    if (hold !== undefined || still() || typeof requestAnimationFrame !== 'function') {
      draw(hold ?? 0);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      draw(frameAt(pose, now - t0));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheet, cell.w, cell.h, row, pose, hold, spec.n]);
  return (
    <span role="img" aria-label={label} data-testid={testid} style={{ position: 'absolute', left: '50%', bottom: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      <canvas
        ref={cv}
        width={cell.w}
        height={cell.h}
        style={{
          position: 'absolute',
          left: -cell.cx * zoom,
          bottom: -(cell.h - cell.foot) * zoom,
          width: cell.w * zoom,
          height: cell.h * zoom,
          imageRendering: 'pixelated',
          transform: flip ? 'scaleX(-1)' : undefined,
          transformOrigin: `${cell.cx * zoom}px 50%`,
          filter: glow ? `drop-shadow(0 0 6px ${glow})` : undefined,
        }}
      />
    </span>
  );
}

/** The centre of the body in a person's frame (src/art/person.ts CX): the sprite hangs from it. */
const PERSON_CX = 25;

export function PersonSprite({ look, pose = 'idle', zoom, flip, label, testid = 'sprite', hold, glow }: { look: PersonLook; pose?: Pose; zoom: number; flip?: boolean; label?: string; testid?: string; hold?: number; glow?: string }) {
  const k = lookKey(look);
  const sheet = useMemo(() => () => sheetCanvas(look), [k]);
  const row = POSES.findIndex((p) => p.id === pose);
  return <SheetAnim sheet={sheet} cell={{ w: FRAME.w, h: FRAME.h, foot: FRAME.foot, cx: PERSON_CX }} row={row} pose={pose} zoom={zoom} flip={flip} label={label} testid={testid} hold={hold} glow={glow} />;
}

export function BeastSprite({ beast, pose = 'idle', zoom, flip, label, testid = 'sprite', hold, glow }: { beast: BeastLook; pose?: Pose; zoom: number; flip?: boolean; label?: string; testid?: string; hold?: number; glow?: string }) {
  const k = beastKey(beast);
  const sheet = useMemo(() => () => beastSheetCanvas(beast), [k]);
  const fr = FRAMES[beast.size];
  const p: Pose = BEAST_POSES.includes(pose) ? pose : 'idle';
  return <SheetAnim sheet={sheet} cell={{ w: fr.w, h: fr.h, foot: fr.foot, cx: fr.w / 2 }} row={poseRow(p)} pose={p} zoom={zoom} flip={flip} label={label} testid={testid} hold={hold} glow={glow} />;
}

/**
 * Whole pixels per art pixel that make `artRows` rows as tall as the box `ref` points at, kept as the box changes size. Whole numbers keep the
 * pixels square.
 */
export function useFitZoom(ref: { current: HTMLElement | null }, artRows: number, fallback = 3, max = 8): number {
  const [zoom, setZoom] = useState(fallback);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => setZoom(Math.max(1, Math.min(max, Math.round(box.clientHeight / artRows))) || fallback);
    fit();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [artRows]);
  return zoom;
}

/** Which poses a person's sheet has (the tests and the stories list them). */
export const PERSON_POSES = POSES.map((p) => p.id);
export const SHEET_COLUMNS = SHEET_COLS;
