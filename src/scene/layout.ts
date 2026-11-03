// Where things stand on the pixel stage, as pure functions of a `Frame` (timeline.ts): the whole-number scale of the box, the camera in art
// pixels, where a character's feet are, which way it faces, how the layers of the painted background follow the camera. No Phaser, no DOM:
// the stage (stage/controller.ts) only applies these numbers, and the tests check them in Node.
import type { ActorView, Frame } from './timeline';
import { ART, CROWD, VIEW } from './tuning';

/**
 * The largest whole number of screen pixels per art pixel that keeps the 320 × 180 picture inside a box (at least 1: a smaller box clips). A box a few pixels
 * short of a multiple (a 958 px box of 960) takes it: the rim of the frame hides what is cut.
 */
export function fitScale(boxW: number, boxH: number): number {
  return Math.max(1, Math.floor(Math.min((boxW + VIEW.slack) / ART.w, (boxH + VIEW.slack) / ART.h)));
}

/** The camera in art pixels: `zoom` is 1 or `VIEW.close`, `cx cy` the point of the world in the middle of the view, `pan` the whole-pixel shift of the world under the view. */
export interface Cam {
  zoom: number;
  cx: number;
  cy: number;
  pan: number;
}

/**
 * The camera of a frame. The timeline eases the zoom (wide 1 · eye 1.12 · close 1.5 · high 0.86); the pixel stage keeps whole steps, so the eased value snaps
 * at `VIEW.snapAt`. A close view looks at the height of a figure's chest; the lift of a high or low view moves the picture up or down; `x` pans the world.
 */
export function cameraOf(c: Frame['camera']): Cam {
  const zoom = c.zoom >= VIEW.snapAt ? VIEW.close : 1;
  const focus = ART.h / 2 + (VIEW.focusY - ART.h / 2) * (zoom - 1);
  // the view never leaves the picture: at 1× there is no room to lift it, at 2× it moves within the half that is left
  const half = ART.h / 2 / zoom;
  const cy = Math.max(half, Math.min(ART.h - half, focus - c.lift * ART.h));
  return { zoom, cx: ART.w / 2, cy: Math.round(cy), pan: Math.round(c.x * VIEW.panPx) };
}

/** Where a point of the world is on the stage's 320 × 180 picture (before the box is scaled), under camera `cam`. */
export function project(cam: Cam, x: number, y: number): { x: number; y: number } {
  return { x: Math.round((x - cam.pan - cam.cx) * cam.zoom + ART.w / 2), y: Math.round((y - cam.cy) * cam.zoom + ART.h / 2) };
}

/** How far a layer that follows the camera at `speed` may shift before its edge shows (a layer is at least as wide as the stage; the wider, the more it can move). */
export function layerReach(width: number, speed: number): number {
  return speed > 0 ? (width - ART.w) / 2 / speed : Infinity;
}

/** The left edge of a layer at pan `pan` (art pixels the world is shifted by): centred, then moved by its share of the pan, never past its own edge. */
export function layerX(width: number, speed: number, pan: number): number {
  const centre = -(width - ART.w) / 2;
  const reach = (width - ART.w) / 2;
  return Math.round(centre - Math.max(-reach, Math.min(reach, pan * speed))) + 0;
}

/** The pan the world can take with these layers (widths and speeds) without showing an edge. */
export function clampPan(pan: number, layers: readonly { w: number; speed: number }[]): number {
  let reach = Infinity;
  for (const l of layers) reach = Math.min(reach, layerReach(l.w, l.speed));
  return Math.max(-reach, Math.min(reach, pan));
}

/** One figure of an actor on the stage: its feet at (x, y) on the 320 × 180 picture, the number of it in the group, and whether the figure is drawn facing left. */
export interface Slot {
  key: string;
  i: number;
  x: number;
  y: number;
  flip: boolean;
}

/** A crowd stands in a loose band about its x, a row deeper for every other figure, so it does not read as a fence. */
export function crowdOffsets(n: number): { dx: number; dy: number }[] {
  return Array.from({ length: n }, (_, i) => ({ dx: Math.round((i - (n - 1) / 2) * CROWD.gap), dy: (i % CROWD.rows) - 1 }));
}

/**
 * Which way each actor faces. A walker faces the way it walks; one that stands faces the nearest other actor that is not a crowd (a clash faces its foe),
 * else the middle of the stage. `before` is where each actor stood the frame before (its x, 0 to 1); an unknown actor stands still.
 */
export function facing(actors: readonly ActorView[], before: ReadonlyMap<string, number> = new Map()): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const a of actors) {
    const was = before.get(a.id);
    const moved = was === undefined ? 0 : a.x - was;
    if (Math.abs(moved) > 1e-4 && a.pose === 'walk') {
      out.set(a.id, moved < 0);
      continue;
    }
    const others = actors.filter((o) => o.id !== a.id && o.count === 1);
    const near = others.sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    out.set(a.id, near ? near.x < a.x : a.x > 0.5);
  }
  return out;
}

/** The slots of every figure on a frame (a group of `count` is `count` slots). Depth is the order of feet: a figure lower on the picture is in front. */
export function slotsOf(actors: readonly ActorView[], before?: ReadonlyMap<string, number>): Slot[] {
  const face = facing(actors, before);
  const out: Slot[] = [];
  for (const a of actors) {
    const offs = a.count > 1 ? crowdOffsets(a.count) : [{ dx: 0, dy: 0 }];
    offs.forEach((o, i) => out.push({ key: `${a.id}#${i}`, i, x: Math.round(a.x * ART.w) + o.dx, y: ART.groundY + o.dy, flip: face.get(a.id) ?? false }));
  }
  return out;
}
