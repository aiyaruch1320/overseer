// A look's sheet: every frame of every pose on one image, one row per pose (anim.ts). Painted once per look and kept; the map, the scenes,
// the battles and the cards all read the same sheet (21-pixel-art.md §4).
import { FRAME, POSES, SHEET_COLS, frameIndex, type Pose } from './anim';
import { lookKey, type PersonLook } from './look';
import type { Frame } from './paint';
import { paintPerson } from './person';

export const SHEET = { w: FRAME.w * SHEET_COLS, h: FRAME.h * POSES.length } as const;

/** The whole sheet as RGBA (no DOM: the checks run it in Node). */
export function paintSheet(L: PersonLook): Frame {
  const data = new Uint8ClampedArray(SHEET.w * SHEET.h * 4);
  POSES.forEach((p, row) => {
    for (let i = 0; i < p.n; i++) {
      const f = paintPerson(L, p.id, i);
      for (let y = 0; y < f.h; y++) data.set(f.data.subarray(y * f.w * 4, (y + 1) * f.w * 4), ((row * FRAME.h + y) * SHEET.w + i * FRAME.w) * 4);
    }
  });
  return { w: SHEET.w, h: SHEET.h, data };
}

const KEEP = 600;
const sheets = new Map<string, HTMLCanvasElement>();

/** The sheet on a canvas, painted the first time a look is asked for (the oldest are let go past KEEP). */
export function sheetCanvas(L: PersonLook): HTMLCanvasElement {
  const key = lookKey(L);
  const have = sheets.get(key);
  if (have) { sheets.delete(key); sheets.set(key, have); return have; }
  const f = paintSheet(L);
  const c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  c.getContext('2d')!.putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
  sheets.set(key, c);
  if (sheets.size > KEEP) sheets.delete(sheets.keys().next().value!);
  return c;
}

/** One frame on a small canvas of its own, `scale` times (a portrait on a card: 21-pixel-art.md §4, 3×). */
export function portrait(L: PersonLook, scale = 3, pose: Pose = 'idle', i = 0, crop = 6): HTMLCanvasElement {
  const s = sheetCanvas(L), idx = frameIndex(pose, i);
  const c = document.createElement('canvas');
  c.width = FRAME.w; c.height = FRAME.h - crop;
  const g = c.getContext('2d')!;
  g.drawImage(s, (idx % SHEET_COLS) * FRAME.w, Math.floor(idx / SHEET_COLS) * FRAME.h + crop, FRAME.w, FRAME.h - crop, 0, 0, FRAME.w, FRAME.h - crop);
  c.style.width = `${FRAME.w * scale}px`; c.style.height = `${(FRAME.h - crop) * scale}px`; c.style.imageRendering = 'pixelated';
  return c;
}
