// Drawing primitives shared by every building painter: the pen, colour maths, roof and wall textures, windows, doors.
import type { RNG } from '../sim/rng';

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const shadeC = (c: number, f: number) => ((Math.min(255, ((c >> 16) & 255) * f) << 16) | (Math.min(255, ((c >> 8) & 255) * f) << 8) | Math.min(255, (c & 255) * f)) >>> 0;
export const mixC = (a: number, b: number, t: number) => ((Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) | (Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) | Math.round((a & 255) * (1 - t) + (b & 255) * t)) >>> 0;
export type Col = number | string;

export interface Pen {
  x2: CanvasRenderingContext2D; r: RNG; doorX?: number; // where the door was drawn (the path from it is laid afterwards)
  fill(c: Col, x: number, y: number, w: number, h: number): void;
  circ(c: Col, x: number, y: number, rad: number): void;
  ell(c: Col, x: number, y: number, rx: number, ry: number): void;
  poly(c: Col, pts: number[]): void;
  line(c: Col, x0: number, y0: number, x1: number, y1: number, w?: number): void;
}
export const col = (c: Col) => (typeof c === 'number' ? hex(c) : c);
export function makePen(x2: CanvasRenderingContext2D, r: RNG): Pen {
  return {
    x2, r,
    fill: (c, x, y, w, h) => { x2.fillStyle = col(c); x2.fillRect(x, y, w, h); },
    circ: (c, x, y, rad) => { x2.fillStyle = col(c); x2.beginPath(); x2.arc(x, y, rad, 0, Math.PI * 2); x2.fill(); },
    ell: (c, x, y, rx, ry) => { x2.fillStyle = col(c); x2.beginPath(); x2.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); x2.fill(); },
    poly: (c, pts) => { x2.fillStyle = col(c); x2.beginPath(); x2.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x2.lineTo(pts[i], pts[i + 1]); x2.closePath(); x2.fill(); },
    line: (c, x0, y0, x1, y1, w = 1) => { x2.strokeStyle = col(c); x2.lineWidth = w; x2.beginPath(); x2.moveTo(x0, y0); x2.lineTo(x1, y1); x2.stroke(); },
  };
}

// ---------------------------------------------------------------- small pieces shared by many houses
export const FOUNDATION = 0x7a746a;
export function shadow(p: Pen, X: number, Y: number, W: number, H: number) { p.fill('rgba(0,0,0,0.16)', X + 6, Y + 8, W, H - 2); p.fill('rgba(0,0,0,0.2)', X + 3, Y + 5, W, H - 2); }
export function shingles(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let j = 0, row = 0; j < h; j += 4, row++) {
    p.fill(shadeC(c, 0.78), x, y + j + 3, w, 1);
    for (let i = (row % 2) * 3; i < w; i += 6) p.fill(shadeC(c, 0.88), x + i, y + j, 1, 3);
    if (row % 3 === 1) for (let i = 1 + (row % 2) * 2; i < w - 2; i += 9) p.fill(shadeC(c, 1.12), x + i, y + j + 1, 3, 1);
  }
  p.fill(shadeC(c, 1.22), x, y, w, 2);
}
export function slates(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let j = 0; j < h; j += 3) p.fill(shadeC(c, j % 6 ? 0.82 : 0.7), x, y + j + 2, w, 1);
  for (let i = 0; i < w; i += 5) for (let j = 0; j < h; j += 6) p.fill(shadeC(c, 0.9), x + i + ((j / 3) % 2) * 2, y + j, 1, 3);
  p.fill(shadeC(c, 1.25), x, y, w, 2);
}
export function thatch(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let i = 0; i < w; i += 3) p.fill(shadeC(c, i % 2 ? 0.85 : 1.1), x + i, y, 1, h);
  for (let j = 4; j < h; j += 5) p.fill(shadeC(c, 0.7), x, y + j, w, 1);
}
export function stoneWall(p: Pen, x: number, y: number, w: number, h: number, c: number, r: RNG) {
  p.fill(c, x, y, w, h);
  for (let j = 0; j < h; j += 5) {
    p.fill(shadeC(c, 0.76), x, y + j + 4, w, 1);
    for (let i = (j / 5 % 2) * 4; i < w; i += 8) p.fill(shadeC(c, 0.8), x + i, y + j, 1, 5);
  }
  for (let k = 0; k < 6; k++) p.fill(shadeC(c, r.float(0.9, 1.12)), x + r.int(0, Math.max(1, w - 4)), y + r.int(0, Math.max(1, h - 3)), 3, 2);
}
export function planks(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let i = 0; i < w; i += 4) p.fill(shadeC(c, 0.82), x + i, y, 1, h);
  p.fill(shadeC(c, 1.1), x, y, w, 1);
}
export function bricks(p: Pen, x: number, y: number, w: number, h: number, c: number) {
  p.fill(c, x, y, w, h);
  for (let j = 0; j < h; j += 4) { p.fill(shadeC(c, 0.72), x, y + j + 3, w, 1); for (let i = ((j / 4) % 2) * 4; i < w; i += 8) p.fill(shadeC(c, 0.8), x + i, y + j, 1, 3); }
}
export function windowAt(p: Pen, x: number, y: number, w: number, h: number, glass: number, frame: number, shutter?: number, flowers = false, lit = false) {
  if (shutter !== undefined) { p.fill(shutter, x - 3, y, 3, h); p.fill(shutter, x + w, y, 3, h); p.fill(shadeC(shutter, 0.7), x - 3, y, 1, h); p.fill(shadeC(shutter, 0.7), x + w + 2, y, 1, h); }
  p.fill(frame, x - 1, y - 1, w + 2, h + 2);
  p.fill(lit ? 0xffe6a0 : glass, x, y, w, h);
  p.fill('rgba(255,255,255,0.45)', x, y, 2, Math.max(2, h - 3));
  p.fill(frame, x + Math.floor(w / 2), y, 1, h);
  p.fill(frame, x, y + Math.floor(h / 2), w, 1);
  if (flowers) { p.fill(0x6a4a2a, x - 1, y + h + 1, w + 2, 2); for (let i = 0; i < w; i += 2) p.fill([0xe8607a, 0xf2c94c, 0xc07aff, 0xffffff][(i / 2) % 4], x + i, y + h, 1, 1); }
}
export function archWindow(p: Pen, x: number, y: number, w: number, h: number, glass: number, frame: number) {
  p.fill(frame, x - 1, y + 2, w + 2, h - 1); p.ell(frame, x + w / 2, y + 2, w / 2 + 1, 4); p.fill(glass, x, y + 3, w, h - 3); p.ell(glass, x + w / 2, y + 3, w / 2, 3);
  p.fill('rgba(255,255,255,0.4)', x, y + 3, 1, h - 4);
}
export function doorAt(p: Pen, x: number, y: number, w: number, h: number, c: number, arch = false, step = true) {
  p.doorX = x + w / 2;
  if (arch) { p.ell(shadeC(c, 0.6), x + w / 2, y + 2, w / 2 + 1, 4); p.fill(shadeC(c, 0.6), x - 1, y + 2, w + 2, h - 1); p.ell(c, x + w / 2, y + 2, w / 2, 3.5); }
  else p.fill(shadeC(c, 0.6), x - 1, y - 1, w + 2, h + 1);
  p.fill(c, x, y + (arch ? 2 : 0), w, h - (arch ? 2 : 0));
  p.fill(shadeC(c, 0.75), x + Math.floor(w / 2), y + 2, 1, h - 2);
  p.fill(0xf2c94c, x + w - 3, y + Math.floor(h / 2), 1, 1);
  if (step) { p.fill(0x9a948a, x - 2, y + h, w + 4, 2); p.fill(0xb8b2a6, x - 2, y + h, w + 4, 1); }
}
export function chimney(p: Pen, x: number, y: number, c: number) {
  p.fill(shadeC(c, 0.8), x + 2, y + 2, 7, 12); p.fill(c, x, y, 9, 4); p.fill(shadeC(c, 0.6), x + 1, y + 1, 7, 2);
  p.fill('rgba(60,50,45,0.35)', x + 2, y - 3, 5, 3);
}
export function eaves(p: Pen, x: number, y: number, w: number) { p.fill('rgba(0,0,0,0.28)', x, y, w, 3); }
export function flag(p: Pen, x: number, y: number, a: number, b: number) { p.fill(0x4a3a22, x, y - 12, 1, 14); p.poly(a, [x + 1, y - 12, x + 9, y - 9, x + 1, y - 6]); p.fill(b, x + 1, y - 12, 2, 6); }

