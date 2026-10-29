// Poses for the vector people. A pose is not a bitmap: it is a handful of numbers (where the feet and hands go, how far the body
// bobs, leans or sits, what the face does) that the figure painter turns into limbs with two-bone IK. So every race, outfit and
// age shares the same animation and gets a correct walk, work swing or prayer for free.
//
// The walk is the classic four-key cycle (contact, down, passing, up) sampled eight times; the 3/4-front view shows it as feet that
// lift and swap, a bobbing body and arms that counter-swing.

export type V = [number, number];
export type Mouth = 'closed' | 'open' | 'smile' | 'oh' | 'sing' | 'chew';
export type Eyes = 'open' | 'closed' | 'happy' | 'wide';
export type ToolMode = 'rest' | 'raise' | 'strike' | 'hold' | 'none' | 'read' | 'cast';

export interface Pose {
  bob: number; // body height offset in units, + is down
  sway: number; // body shifted sideways
  lean: number; // shoulders ahead of the hips (stoop or lunge)
  drop: number; // hips lowered for sitting and kneeling
  legs: 'stand' | 'sit' | 'kneel';
  lf: V; rf: V; // feet, relative to standing
  lh: V; rh: V; // hands, relative to hanging
  tilt: number; nod: number; // head tilt (radians) and nod (units, + down)
  mouth: Mouth; eyes: Eyes; brow: number; // brow -1 worried .. +1 raised
  tool: ToolMode;
  bundle: boolean;
  flap: number; // wings: 0 folded .. 1 open
  amb: number; // 0..1 phase for tails, glow, embers, loose cloth
  breath: number; // chest rise
  hover: number; // lifted off the ground (fae)
}

const Z: V = [0, 0];
const base: Pose = {
  bob: 0, sway: 0, lean: 0, drop: 0, legs: 'stand', lf: Z, rf: Z, lh: Z, rh: Z, tilt: 0, nod: 0, mouth: 'closed', eyes: 'open', brow: 0,
  tool: 'rest', bundle: false, flap: 0.15, amb: 0, breath: 0, hover: 0,
};
const P = (o: Partial<Pose>): Pose => ({ ...base, ...o });

export const POSE = {
  idle: 0, breath: 1, walk0: 2, walk1: 3, walk2: 4, walk3: 5, walk4: 6, walk5: 7, walk6: 8, walk7: 9,
  work0: 10, work1: 11, work2: 12, sit: 13, sit2: 14, carry0: 15, carry1: 16, carry2: 17, cheer: 18, cheer2: 19,
  kneel: 20, kneel2: 21, wave0: 22, wave1: 23, talk0: 24, talk1: 25, read: 26, cast0: 27, cast1: 28,
  idle2: 29, idle3: 30, flutter0: 31, flutter1: 32,
} as const;
export type PoseName = keyof typeof POSE;
export const FRAMES = 33;
export const WALK = [POSE.walk0, POSE.walk1, POSE.walk2, POSE.walk3, POSE.walk4, POSE.walk5, POSE.walk6, POSE.walk7];
export const CARRY_WALK = [POSE.carry1, POSE.carry0, POSE.carry2, POSE.carry0];

// phase 0..1 through a step. Left foot is in the air in the first half, right foot in the second.
function walk(ph: number, carry = false): Pose {
  const a = ph * Math.PI * 2;
  const s = Math.sin(a), c = Math.cos(a);
  const lift = (v: number) => Math.max(0, v) * 4.6;
  const down = Math.abs(s); // 0 at contact, 1 at passing
  return P({
    bob: 1.1 - down * 1.5,
    sway: s * 0.5,
    lean: 0.5,
    lf: [-s * 0.4, -lift(s)], rf: [s * 0.4, -lift(-s)],
    lh: carry ? [0.6, -4.2] : [0.4 * c, -s * 2.2], rh: carry ? [-0.6, -4.2] : [-0.4 * c, s * 2.2],
    tilt: -s * 0.025, amb: ph, bundle: carry, tool: carry ? 'none' : 'rest',
    breath: 0, mouth: 'closed',
  });
}

export const POSES: Pose[] = [];
POSES[POSE.idle] = P({ amb: 0 });
POSES[POSE.breath] = P({ breath: 1, bob: 0.3, lh: [0, -0.3], rh: [0, -0.3], amb: 0.5 });
for (let i = 0; i < 8; i++) POSES[POSE.walk0 + i] = walk(i / 8);
POSES[POSE.work0] = P({ rh: [1.5, -13], lh: [-0.5, -1], tool: 'raise', lean: -0.6, bob: -0.4, mouth: 'closed', brow: -0.2 });
POSES[POSE.work1] = P({ rh: [5, -2], lh: [2.5, -3], tool: 'strike', lean: 2, bob: 1.1, brow: -0.5, mouth: 'open' });
POSES[POSE.work2] = P({ rh: [3.5, -5.5], lh: [2, -5], tool: 'rest', lean: 1, bob: 0.4, mouth: 'closed' });
POSES[POSE.sit] = P({ drop: 9, legs: 'sit', lh: [2, -2.5], rh: [-2, -2.5], tool: 'hold', bob: 0, lean: 0.4 });
POSES[POSE.sit2] = P({ drop: 9, legs: 'sit', lh: [2, -2.5], rh: [-2, -2.5], tool: 'hold', breath: 1, nod: 0.5, amb: 0.5 });
POSES[POSE.carry0] = P({ bundle: true, tool: 'none', lh: [0.6, -4.2], rh: [-0.6, -4.2] });
POSES[POSE.carry1] = walk(0.25, true);
POSES[POSE.carry2] = walk(0.75, true);
POSES[POSE.cheer] = P({ lh: [-2.5, -22], rh: [2.5, -22], tool: 'raise', bob: -2.4, lf: [0, -1.4], rf: [0, -1.4], mouth: 'open', eyes: 'happy', brow: 1, flap: 0.9 });
POSES[POSE.cheer2] = P({ lh: [-4.5, -16], rh: [4.5, -16], tool: 'raise', bob: 0.4, mouth: 'smile', eyes: 'happy', brow: 0.6, amb: 0.5 });
POSES[POSE.kneel] = P({ drop: 11, legs: 'kneel', lh: [3.2, -5.5], rh: [-3.2, -5.5], tool: 'none', eyes: 'closed', nod: 1.2, lean: 1.2 });
POSES[POSE.kneel2] = P({ drop: 11, legs: 'kneel', lh: [3.2, -5], rh: [-3.2, -5], tool: 'none', eyes: 'closed', nod: 1.8, lean: 1.6, breath: 1, amb: 0.5 });
POSES[POSE.wave0] = P({ rh: [3.5, -15], tool: 'none', mouth: 'smile', eyes: 'happy', tilt: 0.05 });
POSES[POSE.wave1] = P({ rh: [1.2, -15.5], tool: 'none', mouth: 'smile', eyes: 'happy', tilt: -0.05, amb: 0.5 });
POSES[POSE.talk0] = P({ rh: [3.5, -6.5], lh: [-0.5, -1], tool: 'none', mouth: 'open', brow: 0.3, tilt: 0.04 });
POSES[POSE.talk1] = P({ rh: [4.5, -4], lh: [0, -3], tool: 'none', mouth: 'closed', brow: 0.1, tilt: -0.03, amb: 0.5 });
POSES[POSE.read] = P({ lh: [3.4, -6], rh: [-3.4, -6], tool: 'read', nod: 1.4, bob: 0.2, lean: 0.8 });
POSES[POSE.cast0] = P({ lh: [-5, -9], rh: [5, -9], tool: 'cast', mouth: 'oh', brow: 0.5, bob: -0.4, flap: 0.7 });
POSES[POSE.cast1] = P({ lh: [-3.5, -20], rh: [3.5, -20], tool: 'cast', mouth: 'oh', brow: 0.9, bob: -1.2, lf: [0, -0.7], rf: [0, -0.7], flap: 1, amb: 0.5 });
POSES[POSE.idle2] = P({ amb: 0.25, bob: 0.15, tilt: 0.015 });
POSES[POSE.idle3] = P({ amb: 0.75, breath: 1, bob: 0.3, tilt: -0.015, lh: [0, -0.3], rh: [0, -0.3] });
POSES[POSE.flutter0] = P({ hover: 3, bob: -1.5, flap: 1, amb: 0.25, lf: [0.5, -1.5], rf: [-0.5, -1], lh: [-1, -2], rh: [1, -2], mouth: 'smile' });
POSES[POSE.flutter1] = P({ hover: 4, bob: -2.4, flap: 0.05, amb: 0.75, lf: [-0.5, -1], rf: [0.5, -1.5], lh: [-1.5, -2.6], rh: [1.5, -2.6], mouth: 'smile' });

export const poseOf = (frame: number): Pose => POSES[frame] || POSES[0];

/** the frames a person cycles through while standing about, their "signature" (a race adds breathing glow, tails, wings) */
export const IDLE_STANDARD = [POSE.idle, POSE.idle2, POSE.breath, POSE.idle3];
export const IDLE_FLUTTER = [POSE.flutter0, POSE.flutter1];

/** the phase (0..1) of the walk a frame shows, or null when it is not a walking frame */
export function walkPhase(frame: number): number | null {
  if (frame >= POSE.walk0 && frame <= POSE.walk7) return (frame - POSE.walk0) / 8;
  if (frame === POSE.carry1) return 0.25;
  if (frame === POSE.carry2) return 0.75;
  return null;
}
/** the poses that are drawn from behind and from the side; every other pose (work, sit, pray...) is drawn facing us */
export const DIRECTIONAL = new Set<number>([POSE.idle, POSE.breath, POSE.idle2, POSE.idle3, POSE.walk0, POSE.walk1, POSE.walk2, POSE.walk3, POSE.walk4, POSE.walk5, POSE.walk6, POSE.walk7, POSE.carry0, POSE.carry1, POSE.carry2]);
