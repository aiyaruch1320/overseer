// A beast's sheet: every frame of its five poses on one image, one row per pose (BEAST_POSES), the cells the size of its class's frame.
// Painted once and kept; the battle, the cards and the page all read the same sheet (21-pixel-art.md §4).
import { SHEET_COLS } from '../anim';
import type { Frame } from '../paint';
import { paintBeast } from './beast';
import { BEAST_POSES, FRAMES, poseN } from './kit';
import { beastKey, type BeastLook } from './look';

export function sheetSize(L: BeastLook): { w: number; h: number } {
  const f = FRAMES[L.size];
  return { w: f.w * SHEET_COLS, h: f.h * BEAST_POSES.length };
}

/** The whole sheet as RGBA (no DOM: the checks run it in Node). */
export function paintBeastSheet(L: BeastLook): Frame {
  const fr = FRAMES[L.size], { w, h } = sheetSize(L);
  const data = new Uint8ClampedArray(w * h * 4);
  BEAST_POSES.forEach((pose, row) => {
    for (let i = 0; i < poseN(pose); i++) {
      const f = paintBeast(L, pose, i);
      for (let y = 0; y < f.h; y++) data.set(f.data.subarray(y * f.w * 4, (y + 1) * f.w * 4), ((row * fr.h + y) * w + i * fr.w) * 4);
    }
  });
  return { w, h, data };
}

const KEEP = 80;
const sheets = new Map<string, HTMLCanvasElement>();

/** The sheet on a canvas, painted the first time a beast is asked for (the oldest are let go past KEEP). */
export function beastSheetCanvas(L: BeastLook): HTMLCanvasElement {
  const key = beastKey(L);
  const have = sheets.get(key);
  if (have) { sheets.delete(key); sheets.set(key, have); return have; }
  const f = paintBeastSheet(L);
  const c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  c.getContext('2d')!.putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
  sheets.set(key, c);
  if (sheets.size > KEEP) sheets.delete(sheets.keys().next().value!);
  return c;
}
