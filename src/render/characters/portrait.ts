// Draws people onto ordinary canvases (cards, the gallery, the character sheet) at any resolution.
import { FW, FH, type Look } from './kit';
import { paintFrame } from './paint';

/** one frame of a person on its own canvas; `ppu` is canvas pixels per unit (a 56x84 unit frame) */
export function renderFrame(L: Look, frame: number, ppu: number, into?: HTMLCanvasElement): HTMLCanvasElement {
  const cv = into || document.createElement('canvas');
  const w = Math.ceil(FW * ppu), h = Math.ceil(FH * ppu);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } else cv.getContext('2d')!.clearRect(0, 0, w, h);
  const c = cv.getContext('2d')!;
  c.save(); c.scale(ppu, ppu); paintFrame(c, L, frame); c.restore();
  return cv;
}
