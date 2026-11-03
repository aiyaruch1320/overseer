// What a part painter is given (src/art/parts): the grid, the look, the pose and the anchor points of the figure in this frame. A part
// draws in one or more layers; the person painter calls the layers in a fixed order, so parts never need to know about each other.
import type { Pose } from './anim';
import type { PersonLook } from './look';
import type { Paint, Pt } from './paint';

/** The materials every figure has (ids of the grid). Parts make more with `r.p.mat(hex)`. */
export interface Mats {
  skin: number; hair: number; eye: number; accent: number; glow: number;
  main: number; second: number; leather: number; metal: number; wood: number; bone: number; pants: number;
}

export interface Leg { /** hip x */ x: number; /** foot x */ fx: number; /** foot lifted off the ground, pixels */ lift: number }

export interface Rig {
  p: Paint;
  look: PersonLook;
  pose: Pose;
  /** frame of the pose */
  f: number;
  /** art pixels per pixel of a 28-pixel adult: 1 for an adult human, less for a child */
  k: number;
  /** the figure's height, feet to the top of the head */
  H: number;
  foot: number;
  hip: number;
  /** the row of the shoulders */
  sh: number;
  /** torso: left column and width */
  x0: number;
  tw: number;
  /** centre of the head and its radii */
  head: Pt;
  hr: Pt;
  shoulderNear: Pt;
  shoulderFar: Pt;
  hand: Pt;
  farHand: Pt;
  near: Leg;
  far: Leg;
  /** kneeling or sitting (legs fold) */
  kneel: boolean;
  sit: boolean;
  /** the held thing: its angle (radians, negative is up) and how far it is pushed along itself */
  ang: number;
  push: number;
  /** cloth that moves with the walk: 0..2 */
  flap: number;
  /** a casting glow at the hands this frame */
  glow: boolean;
  /** the tool shows in this pose */
  holds: boolean;
  m: Mats;

  /** length of a leg at rest, in pixels (the hip is this far above the ground) */
  legs: number;
  /** pixels the head and shoulders lean forward (the stoop of the old, the shuffle, the hunger) */
  lean: number;
  /** pixels the figure hovers above the ground (float gait) */
  hover: number;
  /** how long the arms are, as a multiple of normal (the orc's long arms, the ghoul's to the knee) */
  reach: number;
  /** pixels the feet stand wider apart (the heavy stance) */
  spread: number;
  /** head height in pixels */
  hh: number;
  /** a baby: carried, swaddled, holds nothing */
  infant: boolean;
  /** the whole body is gel (the slime has no clothes, no ears, no face) */
  gel: boolean;
  /** free-floating glow pixels (sparks, dust, steam, sparkle): laid on the finished frame, so they get no outline and no shading */
  fx: { x: number; y: number; hex: string; a: number }[];
}

/** The layers in the order they are painted. */
export type Layer = 'back' | 'farArm' | 'lower' | 'torso' | 'head' | 'face' | 'hair' | 'hat' | 'held' | 'nearArm' | 'front';
export const LAYERS: readonly Layer[] = ['back', 'farArm', 'lower', 'torso', 'head', 'face', 'hair', 'hat', 'held', 'nearArm', 'front'];

export type Part = Partial<Record<Layer, (r: Rig) => void>>;

/** How a tool is swung: it picks the attack and work frames. */
export type ToolKind = 'thrust' | 'swing' | 'cast' | 'shoot' | 'none';
export interface Tool extends Part { kind: ToolKind }

/** The point `t` pixels along the held thing from the hand (with the frame's push). */
export function along(r: Rig, t: number): Pt {
  return [r.hand[0] + Math.cos(r.ang) * (t + r.push), r.hand[1] + Math.sin(r.ang) * (t + r.push)];
}
/** A point moved sideways off the held thing's line (positive is to the lower side for a thing held up and forward). */
export function aside(r: Rig, pt: Pt, s: number): Pt {
  return [pt[0] - Math.sin(r.ang) * s, pt[1] + Math.cos(r.ang) * s];
}
