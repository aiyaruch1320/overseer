// The person painter: a Look and a frame of a pose → one frame of pixels (docs/appearance/21-pixel-art.md). The figure is a skeleton
// measured from the race's body (02-races.md ค่า UI) and the life stage; a pose moves its joints; the parts of src/art/parts draw on it in
// the fixed order of LAYERS. Facing right; the sprite flips for left.
import { FRAME, type Pose } from './anim';
import { STAGE_SCALE, type Gait, type PersonLook } from './look';
import { Paint, type Frame, type Pt } from './paint';
import { EARS, FEATS, HAIR, HATS, LOWER, NO_TOOL, OUTFITS, TOOLS, BEARDS, part } from './parts';
import { BODY_PARTS, GEL_BODY, coils, mixHex } from './parts/body';
import { LAYERS, type Layer, type Part, type Rig, type ToolKind } from './rig';

/** A human adult is this many art pixels tall (21-pixel-art.md §2). */
export const ADULT_H = 28;
/** The column the body stands on (room in front for what it holds). */
const CX = 24;
const DEG = Math.PI / 180;

/** One key of a pose, in pixels of a 28-pixel adult (scaled by the figure). Hands are relative to their shoulders. */
export interface Key {
  /** body drop (down is positive) */
  b?: number;
  /** the whole body shifts forward */
  L?: number;
  /** near foot and far foot forward of their hips */
  fa?: number; ba?: number;
  /** how high each foot is lifted off the ground, pixels */
  ln?: number; lf?: number;
  hand: Pt; far: Pt; ang?: number; push?: number; flap?: number;
  kneel?: boolean; sit?: boolean; fall?: boolean; nod?: number; glow?: boolean;
}

const HOLD = { thrust: -78, swing: -60, cast: -84, shoot: -70, carry: -90, none: -70 } as const;
/** An arm that hangs: the hand a torso's length below the shoulder. */
const HANG: Pt = [1, 9], HANG_FAR: Pt = [-2, 8];
/** An arm that carries: the hand at the chest, a little forward (a book, a letter or a card is held there, not at the face), the other hand beneath it. */
const CARRY: Pt = [4, 6], CARRY_FAR: Pt = [1, 7];

/** The walk of each gait (21-pixel-art.md §3: 4 frames): feet, body bob, lifts. Hop and float change more than the feet. */
interface Step { fa: number[]; ba: number[]; b: number[]; ln: number[]; lf: number[]; flap: number[]; sw: number }
const STEP: Record<Gait, Step> = {
  // contact, passing (far foot up), contact, passing (near foot up): the body rises on the passing frames
  normal: { fa: [3, 0, -3, 0], ba: [-3, 0, 3, 0], b: [0, -1, 0, -1], ln: [0, 0, 0, 2], lf: [0, 2, 0, 0], flap: [1, 2, 1, 2], sw: 1.3 },
  // wide stance, the body drops on each step, small lifts
  heavy: { fa: [3, 0, -3, 0], ba: [-3, 0, 3, 0], b: [1, 0, 1, 0], ln: [0, 0, 0, 1], lf: [0, 1, 0, 0], flap: [1, 1, 1, 1], sw: 0.9 },
  // long steps, no bob, the feet do not leave the ground
  glide: { fa: [4, 0, -4, 0], ba: [-4, 0, 4, 0], b: [0, 0, 0, 0], ln: [0, 0, 0, 0], lf: [0, 0, 0, 0], flap: [1, 2, 1, 2], sw: 0.9 },
  // both feet together: crouch, push, apex, fall
  hop: { fa: [0, 1, 1, 0], ba: [0, 1, 1, 0], b: [1, -2, -3, -1], ln: [0, 2, 3, 1], lf: [0, 2, 3, 1], flap: [0, 2, 2, 1], sw: 0.3 },
  // short steps that drag: the feet stay on the ground and the body sinks a little between them
  shuffle: { fa: [2, 0, -2, 0], ba: [-2, 0, 2, 0], b: [0, 1, 0, 1], ln: [0, 0, 0, 0], lf: [0, 0, 0, 0], flap: [1, 1, 1, 1], sw: 0.7 },
  // no feet on the ground at all: the legs hang and trail, the body rocks
  float: { fa: [2, 0, -2, 0], ba: [-2, 0, 2, 0], b: [0, -1, 0, -1], ln: [0, 0, 0, 0], lf: [0, 0, 0, 0], flap: [1, 2, 1, 2], sw: 0.7 },
};

export function keys(pose: Pose, kind: ToolKind, gait: Gait, rest?: number): Key[] {
  const up = (rest ?? HOLD[kind]) * DEG, armed = kind !== 'none', carry = kind === 'carry';
  switch (pose) {
    case 'idle': return [
      { hand: carry ? CARRY : armed ? [3, 4] : HANG, far: carry ? CARRY_FAR : armed ? [-1, 5] : HANG_FAR, ang: up, b: gait === 'hop' ? 1 : 0 },
      { b: gait === 'float' ? -1 : gait === 'hop' ? 0 : 1, hand: carry ? CARRY : armed ? [3, 4] : [1, 8], far: carry ? CARRY_FAR : armed ? [-1, 5] : [-2, 9], ang: up, flap: 1 },
    ];
    case 'walk': {
      const s = STEP[gait];
      return [0, 1, 2, 3].map((i) => {
        const sw = s.fa[i] * s.sw, high = gait === 'hop' && s.b[i] < -1;
        return {
          b: s.b[i], fa: s.fa[i], ba: s.ba[i], ln: s.ln[i], lf: s.lf[i], flap: s.flap[i],
          // a carried thing stays at the chest and rocks with the step; a weapon swings a little; an empty arm swings wide
          hand: (carry ? [CARRY[0] - sw * 0.2, CARRY[1] - (s.b[i] < 0 ? 1 : 0)] : armed ? [3 - sw * 0.75, 4] : [1 - sw * 1.1, high ? 6 : 9]) as Pt,
          far: (carry ? [CARRY_FAR[0] - sw * 0.15, CARRY_FAR[1]] : armed ? [-1 + sw * 0.75, 5] : [-2 + sw * 1.1, high ? 5 : 8]) as Pt,
          ang: kind === 'thrust' ? -32 * DEG : up,
        };
      });
    }
    case 'attack':
      if (kind === 'swing') return [
        { L: -1, fa: 1, ba: -2, hand: [-1, -2], far: [-2, 4], ang: -125 * DEG },
        { b: 1, L: 2, fa: 3, ba: -2, hand: [6, 3], far: [0, 4], ang: 25 * DEG, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [4, 4], far: [-1, 5], ang: -10 * DEG, flap: 1 },
      ];
      if (kind === 'cast') return castKeys(up);
      // the thing is drawn in to the belly, then thrust out at arm's length and a little up (shown, flung, offered), then held out a moment: not the idle
      if (kind === 'carry') return [
        { L: -2, fa: 1, ba: -2, hand: [1, 8], far: [-1, 8], ang: up },
        { b: 1, L: 2, fa: 3, ba: -2, hand: [10, 2], far: [6, 4], ang: up, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [8, 3], far: [4, 5], ang: up, flap: 1 },
      ];
      // the bow: arm out, the string drawn on frames 0 and 1, loosed on frame 2 (the far hand snaps back)
      if (kind === 'shoot') return [
        { L: -1, fa: 1, ba: -1, hand: [6, -1], far: [7, 0], ang: -4 * DEG },
        { L: -1, fa: 1, ba: -1, hand: [6, -1], far: [9.5, -0.5], ang: -4 * DEG, flap: 1 },
        { L: 0, fa: 1, ba: -1, hand: [6, -1], far: [4, 2], ang: -2 * DEG, flap: 2 },
      ];
      // empty hands: a punch. The fist is drawn back at the hip, driven out straight in front of the shoulder with the body behind it, then pulled back; the
      // other hand stays up as a guard
      if (kind === 'none') return [
        { L: -1, fa: 1, ba: -2, hand: [-2, 4], far: [3, 1], ang: up },
        { b: 1, L: 2, fa: 3, ba: -2, hand: [10, 0], far: [3, 2], ang: up, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [6, 1], far: [3, 2], ang: up, flap: 1 },
      ];
      // a thrust: drawn back with the body behind it, driven out the full length with the far hand on the shaft, pulled back
      return [
        { L: -1, fa: 1, ba: -2, hand: [-1, 3], far: [-3, 4], ang: -8 * DEG, push: -3.5 },
        { b: 1, L: 1, fa: 4, ba: -3, hand: [5, 2], far: [2, 3], ang: -3 * DEG, push: 2, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [4, 3], far: [0, 4], ang: -18 * DEG, push: -1, flap: 1 },
      ];
    case 'cast': return castKeys(up);
    case 'hurt': return [{ L: -1, hand: [1, 5], far: [-2, 4], ang: -60 * DEG }, { L: -2, b: 1, nod: 1, hand: [0, 5], far: [-3, 3], ang: -50 * DEG }];
    case 'die': return [
      { L: -2, b: 1, nod: 1, hand: [0, 5], far: [-3, 3], ang: -50 * DEG },
      { kneel: true, nod: 2, hand: [2, 7], far: [0, 7], ang: 10 * DEG },
      { kneel: true, fall: true, nod: 2, hand: [2, 7], far: [0, 7], ang: 10 * DEG },
    ];
    case 'work': if (carry) return [
      { hand: CARRY, far: CARRY_FAR, ang: up },
      { b: 1, hand: [5, 4], far: [2, 5], ang: up },
      { hand: [3, 8], far: [0, 8], ang: up },
    ];
    return [
      { L: -1, hand: [-1, -2], far: [1, -1], ang: -110 * DEG },
      { b: 1, L: 1, hand: [5, 4], far: [4, 4], ang: 40 * DEG },
      { L: 1, hand: [4, 4], far: [3, 4], ang: 20 * DEG },
    ];
    case 'sit': return [{ sit: true, hand: [3, 6], far: [1, 6], ang: up }];
    case 'pray': return [{ kneel: true, hand: [3, 1], far: [4, 1] }, { kneel: true, nod: 1, hand: [3, 2], far: [4, 2] }];
    case 'cheer': return [{ b: -1, hand: [2, -6], far: [-1, -6] }, { b: -2, ln: 1, lf: 1, hand: [3, -7], far: [0, -7], flap: 2 }];
  }
}

/** A baby is carried or sits: every pose is a sitting one, the arms up or out; it never walks and never holds a thing. */
function infantKeys(pose: Pose): Key[] {
  const sit = true;
  switch (pose) {
    case 'idle': return [{ sit, hand: [1, 3], far: [-2, 3] }, { sit, b: 1, hand: [2, -2], far: [-2, 3], flap: 1 }];
    case 'walk': return [{ sit, hand: [2, -3], far: [-2, 3] }, { sit, b: -1, hand: [1, 3], far: [-2, -3], flap: 1 }, { sit, hand: [2, -3], far: [-2, 3] }, { sit, b: -1, hand: [1, 3], far: [-2, -3], flap: 2 }];
    case 'attack': case 'cast': return [{ sit, hand: [2, -3], far: [-2, -3] }, { sit, b: -1, hand: [4, -2], far: [-3, -2], glow: pose === 'cast' }, { sit, hand: [3, 1], far: [-2, 1], glow: pose === 'cast' }];
    case 'hurt': return [{ sit, L: -1, hand: [1, -2], far: [-2, -2] }, { sit, L: -1, b: 1, nod: 1, hand: [1, -3], far: [-2, -3] }];
    case 'die': return [{ sit, nod: 1, hand: [1, 2], far: [-2, 2] }, { sit, nod: 2, hand: [1, 3], far: [-2, 3] }, { sit, fall: true, nod: 2, hand: [1, 3], far: [-2, 3] }];
    case 'cheer': return [{ sit, b: -1, hand: [2, -6], far: [-2, -6] }, { sit, b: -2, hand: [3, -7], far: [-3, -7], flap: 2 }];
    case 'pray': return [{ sit, hand: [3, 0], far: [4, 0] }, { sit, nod: 1, hand: [3, 1], far: [4, 1] }];
    default: return [{ sit, hand: [1, 3], far: [-2, 3] }];
  }
}

function castKeys(up: number): Key[] {
  return [
    { hand: [4, 0], far: [3, 1], ang: up, glow: true },
    { L: 1, hand: [5, -2], far: [4, -1], ang: up, glow: true, flap: 1 },
    { L: 1, hand: [6, -3], far: [5, -2], ang: up, glow: true, flap: 2 },
  ];
}

/** Poses where the held thing shows (a praying or cheering figure puts it away). */
const HOLDS: Record<Pose, boolean> = { idle: true, walk: true, attack: true, cast: true, hurt: true, die: false, work: true, sit: false, pray: false, cheer: false };

// Life stage: how much of the height is head and legs (a child's head is big for its size, as in life; an old person is shorter-legged).
const HEAD_SHARE = { infant: 0.42, child: 0.33, teen: 0.28, adult: 0.255, elder: 0.26 } as const;
const LEG_SHARE = { infant: 0.3, child: 0.36, teen: 0.42, adult: 0.4, elder: 0.38 } as const;

/** How long the arms are (a multiple of normal): the orc's reach and the ghoul's, to the knee, come from their marks. */
function reachOf(L: PersonLook): number {
  if (L.feats.includes('gaunt')) return 1.4;
  if (L.feats.includes('tusks') || L.feats.includes('stone')) return 1.15;
  return 1;
}

function rigOf(p: Paint, L: PersonLook, pose: Pose, f: number): { r: Rig; key: Key } {
  const tool = TOOLS[L.tool] ?? NO_TOOL;
  const st = L.stage, infant = st === 'infant', gel = L.feats.includes('gel'), gait = L.body.gait;
  const all = infant ? infantKeys(pose) : keys(pose, tool.kind, gait, tool.rest);
  const key0 = all[Math.min(f, all.length - 1)];
  // the old take short steps and do not bob
  const key: Key = st === 'elder' && pose === 'walk' ? { ...key0, fa: Math.round((key0.fa ?? 0) * 0.6), ba: Math.round((key0.ba ?? 0) * 0.6), b: 0 } : key0;
  // a big race's young are still big: a giant's child is taller than a human adult, so the stage shrinks a race that is above human size by less
  const sc = L.body.scale > 1 && st !== 'infant' ? 1 - (1 - STAGE_SCALE[st]) / (L.body.scale * L.body.scale) : STAGE_SCALE[st];
  // a giant's or an ogre's child stands clearly above a grown human (four pixels at least), and still below its own grown people
  const bigYoung = L.body.scale >= 1.25 && (st === 'child' || st === 'teen') ? ADULT_H + (st === 'child' ? 4 : 5) : 0;
  const H = Math.max(10, bigYoung, Math.round(ADULT_H * L.body.scale * sc));
  const k = H / ADULT_H;
  // a big-headed little race (the fae) keeps a head tall enough to show a face
  const hh = Math.max(L.body.head >= 1.15 && H >= 14 ? 6 : 5, Math.round(H * HEAD_SHARE[st] * Math.min(1.25, Math.max(0.8, L.body.head))));
  let legs = Math.max(2, Math.round(H * LEG_SHARE[st]));
  if (H - hh - legs < 4) legs = Math.max(2, H - hh - 4);
  const sk = (v = 0) => Math.round(v * k);
  const hover = gait === 'float' && !(pose === 'die' && f > 0) ? 2 : 0;
  const foot = FRAME.foot - hover;
  const kneelDrop = key.kneel ? Math.round(legs * 0.45) : key.sit ? Math.round(legs * 0.6) : 0;
  const b = sk(key.b) + kneelDrop;
  const hip = foot - legs + b;
  const torsoH = H - hh - legs;
  const sh = hip - torsoH;
  const lean = Math.min(3, (st === 'elder' ? 2 : 0) + (gait === 'shuffle' ? 1 : 0) + (L.feats.includes('gaunt') ? 1 : 0));
  const widthK = Math.pow(k, 0.8) * (st === 'teen' ? 0.92 : 1) * (L.feats.includes('gaunt') ? 0.82 : 1);
  const tw = Math.max(4, Math.round(9 * widthK * L.body.shoulders * (L.fem ? 0.9 : 1)));
  const aw = tw >= 11 ? 3 : tw >= 6 ? 2 : 1, ar = aw - 1 - (aw >> 1);
  const x0 = CX - Math.floor(tw / 2) + sk(key.L);
  const hr: Pt = [Math.max(2.5, (hh / 2) * 1.08), hh / 2];
  const head: Pt = [x0 + tw / 2 + 1 + lean, sh - hh / 2 + 0.5 + sk(key.nod) + (st === 'elder' ? 1 : 0)];
  const reach = reachOf(L);
  const shoulderNear: Pt = [x0 + tw - 1 - ar + lean * 0.5, sh + 1];
  const shoulderFar: Pt = [x0 + (aw >> 1) + lean * 0.5, sh + 1];
  const down = (v: number) => (v > 0 ? reach : 1); // long arms hang lower, they do not reach higher
  const hand: Pt = [shoulderNear[0] + key.hand[0] * k, shoulderNear[1] + key.hand[1] * k * down(key.hand[1])];
  const farHand: Pt = [shoulderFar[0] + key.far[0] * k, shoulderFar[1] + key.far[1] * k * down(key.far[1])];
  const lw = Math.max(1, Math.round(tw / 3.2));
  const spread = gait === 'heavy' ? 1 : 0;
  const nx = x0 + tw - lw - 1, fx = x0 + 1;
  const near = { x: nx, fx: nx + sk(key.fa) + spread, lift: key.ln ?? 0 };
  const far = { x: fx, fx: fx + sk(key.ba) - spread, lift: key.lf ?? 0 };
  const m = {
    skin: p.mat(L.skin), hair: p.mat(L.hairColor), eye: p.mat(L.eye, { flat: true }), accent: p.mat(L.accent), glow: p.mat(L.accent, { flat: true }),
    main: p.mat(L.main), second: p.mat(L.second), leather: p.mat('#5a3a24'), metal: p.mat('#9a9ea6'), wood: p.mat('#7a5232'), bone: p.mat('#d9cfb2'), pants: p.mat(L.second),
  };
  const r: Rig = {
    p, look: L, pose, f, k, H, foot, hip, sh, x0, tw, head, hr, shoulderNear, shoulderFar, hand, farHand, near, far,
    kneel: !!key.kneel, sit: !!key.sit, ang: key.ang ?? -70 * DEG, push: sk(key.push), flap: key.flap ?? 0, glow: !!key.glow,
    holds: HOLDS[pose] && tool.kind !== 'none' && !infant, m,
    legs, lean, hover, reach, spread, hh, infant, gel, fx: p.glows,
  };
  return { r, key };
}

/** The parts of a look, in the order they draw within a layer: body, outfit, hair, beard, hat, tool, feats. */
function partsOf(L: PersonLook): { replace: Partial<Record<Layer, Part>>; add: Part[] } {
  const infant = L.stage === 'infant', gel = L.feats.includes('gel');
  const bare = infant || gel;
  const outfit = bare ? {} : part(OUTFITS, L.outfit) ?? {};
  const keepBack = gel ? part(OUTFITS, L.outfit) : undefined;
  const lower = LOWER[L.body.lower] ?? LOWER.legs;
  const replace: Partial<Record<Layer, Part>> = {
    torso: gel ? GEL_BODY : outfit.torso ? outfit : BODY_PARTS.torso,
    farArm: L.feats.includes('missingarm') ? FEATS.missingarm : gel ? GEL_BODY : outfit.farArm ? outfit : BODY_PARTS.arms,
    nearArm: gel ? GEL_BODY : outfit.nearArm ? outfit : BODY_PARTS.arms,
    lower: gel ? GEL_BODY : L.body.lower === 'legs' && outfit.lower ? outfit : lower,
  };
  const hairless = L.feats.includes('hairless') || gel;
  const add = [
    gel ? { head: GEL_BODY.head } : BODY_PARTS.head, gel ? undefined : EARS[L.body.ears] ?? EARS.round,
    { ...outfit, torso: undefined, farArm: undefined, nearArm: undefined, lower: undefined },
    keepBack ? { back: keepBack.back, front: keepBack.front } : undefined,
    hairless ? undefined : part(HAIR, L.hair), hairless ? undefined : part(BEARDS, L.beard), part(HATS, L.hat), infant ? undefined : TOOLS[L.tool],
    ...L.feats.filter((f) => f !== 'missingarm').map((f) => FEATS[f]),
  ].filter((x): x is Part => !!x);
  return { replace, add };
}

/** Parts the look names that no table has (the characters page lists them; the docs or the tables need them). */
export function unknownParts(L: PersonLook): string[] {
  const miss: string[] = [];
  if (L.outfit && !OUTFITS[L.outfit]) miss.push(`outfit:${L.outfit}`);
  if (L.hair && !HAIR[L.hair]) miss.push(`hair:${L.hair}`);
  if (L.beard && !BEARDS[L.beard]) miss.push(`beard:${L.beard}`);
  if (L.hat && !HATS[L.hat]) miss.push(`hat:${L.hat}`);
  if (L.tool && !TOOLS[L.tool]) miss.push(`tool:${L.tool}`);
  for (const f of L.feats) if (!FEATS[f]) miss.push(`feat:${f}`);
  return miss;
}

/** A figure that has fallen lies on the ground line, wherever the turn put it, and inside the frame. */
function settle(p: Paint): void {
  let minX = 99, maxX = -1, maxY = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.m[y * p.w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  if (maxY < 0) return;
  const dy = FRAME.foot - 1 - maxY, dx = minX < 3 ? 3 - minX : maxX > p.w - 4 ? p.w - 4 - maxX : 0;
  if (!dy && !dx) return;
  const old = p.m.slice();
  p.m.fill(0);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const k = old[y * p.w + x]; if (k) p.px(x + dx, y + dy, k); }
}

/** The fae are dim, not sugar: their pink and their glow are muted toward a cold grey (the tone of the world, appearance/README). */
function tame(L: PersonLook): PersonLook {
  if (L.race !== 'fae') return L;
  return { ...L, skin: mixHex(L.skin, '#9c9aa4', 0.3), accent: mixHex(L.accent, '#8a8a98', 0.3) };
}

export function paintPerson(L0: PersonLook, pose: Pose, f: number): Frame {
  const L = tame(L0);
  const p = new Paint(FRAME.w, FRAME.h);
  const { r, key } = rigOf(p, L, pose, f);
  const { replace, add } = partsOf(L);
  for (const layer of LAYERS) {
    if (layer === 'held' && !r.holds) continue;
    const own = replace[layer];
    own?.[layer]?.(r);
    for (const pt of add) {
      if (layer === 'held' && pt === TOOLS[L.tool] && !r.holds) continue;
      pt[layer]?.(r);
    }
    // the face is drawn again over a hood (eye and nose stay visible)
    if (layer === 'hat' && L.hat && !r.gel) BODY_PARTS.head.face?.(r);
  }
  if (key.fall) { p.turn(-1, [CX, FRAME.foot]); settle(p); p.glows.length = 0; }
  // nothing stands below the ground line (a hem or a sleeve that hangs past it is cut there)
  for (let y = FRAME.foot; y < p.h; y++) for (let x = 0; x < p.w; x++) p.m[y * p.w + x] = 0;
  // the ground shadow: as wide as what stands on the ground (a coil, a hem, a gel), smaller under what hovers
  const wide = L.body.lower === 'serpent' ? coils(r).rx1 + 2 : L.body.lower === 'gown' ? r.tw * 0.5 + 5 : L.body.lower === 'blob' ? r.tw * 0.8 + 2 : r.tw * 0.7 + 2;
  const sh = r.hover ? 0.7 : 1;
  return p.finish({ cx: CX + 1, cy: FRAME.foot, rx: Math.max(4, wide * sh), ry: Math.max(1.2, 2 * Math.max(0.7, r.k) * sh) });
}
