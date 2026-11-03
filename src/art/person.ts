// The person painter: a Look and a frame of a pose → one frame of pixels (docs/appearance/21-pixel-art.md). The figure is a skeleton
// measured from the race's body (02-races.md ค่า UI) and the life stage; a pose moves its joints; the parts of src/art/parts draw on it in
// the fixed order of LAYERS. Facing right; the sprite flips for left.
import { FRAME, type Pose } from './anim';
import { STAGE_SCALE, type PersonLook } from './look';
import { Paint, type Frame, type Pt } from './paint';
import { BODY_PARTS, EARS, FEATS, HAIR, HATS, LOWER, NO_TOOL, OUTFITS, TOOLS, BEARDS, part } from './parts';
import { LAYERS, type Layer, type Part, type Rig, type ToolKind } from './rig';

/** A human adult is this many art pixels tall (21-pixel-art.md §2). */
export const ADULT_H = 28;
/** The column the body stands on (room in front for what it holds). */
const CX = 21;
const DEG = Math.PI / 180;

/** One key of a pose, in pixels of a 28-pixel adult (scaled by the figure). Hands are relative to their shoulders. */
interface Key {
  b?: number; L?: number; fa?: number; ba?: number; lift?: 0 | 1 | 2;
  hand: Pt; far: Pt; ang?: number; push?: number; flap?: number;
  kneel?: boolean; sit?: boolean; fall?: boolean; nod?: number; glow?: boolean;
}

const HOLD = { thrust: -78, swing: -60, cast: -84, shoot: -70, none: -70 } as const;

function keys(pose: Pose, kind: ToolKind): Key[] {
  const up = HOLD[kind] * DEG;
  switch (pose) {
    case 'idle': return [{ hand: [3, 4], far: [-1, 5], ang: up }, { b: 1, hand: [3, 4], far: [-1, 5], ang: up, flap: 1 }];
    case 'walk': return [2, 0, -2, 0].map((fa, i) => ({ b: [0, -1, 0, -1][i], fa, ba: -fa, lift: (i === 1 ? 1 : i === 3 ? 2 : 0) as 0 | 1 | 2, hand: [3 - fa / 2, 4] as Pt, far: [-1 + fa / 2, 5] as Pt, ang: kind === 'thrust' ? -32 * DEG : up, flap: 1 + (i % 2) }));
    case 'attack':
      if (kind === 'swing') return [
        { L: -1, fa: 1, ba: -2, hand: [-1, -2], far: [-2, 4], ang: -125 * DEG },
        { b: 1, L: 2, fa: 3, ba: -2, hand: [6, 3], far: [0, 4], ang: 25 * DEG, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [4, 4], far: [-1, 5], ang: -10 * DEG, flap: 1 },
      ];
      if (kind === 'cast') return castKeys(up);
      return [
        { L: -1, fa: 1, ba: -2, hand: [0, 2], far: [-2, 4], ang: -12 * DEG, push: -3 },
        { b: 1, L: 2, fa: 3, ba: -2, hand: [7, 2], far: [1, 3], ang: -4 * DEG, push: 4, flap: 2 },
        { L: 1, fa: 2, ba: -1, hand: [5, 3], far: [0, 4], ang: -20 * DEG, push: 1, flap: 1 },
      ];
    case 'cast': return castKeys(up);
    case 'hurt': return [{ L: -1, hand: [1, 5], far: [-2, 4], ang: -60 * DEG }, { L: -2, b: 1, nod: 1, hand: [0, 5], far: [-3, 3], ang: -50 * DEG }];
    case 'die': return [
      { L: -2, b: 1, nod: 1, hand: [0, 5], far: [-3, 3], ang: -50 * DEG },
      { kneel: true, nod: 2, hand: [2, 7], far: [0, 7], ang: 10 * DEG },
      { kneel: true, fall: true, nod: 2, hand: [2, 7], far: [0, 7], ang: 10 * DEG },
    ];
    case 'work': return [
      { L: -1, hand: [-1, -2], far: [1, -1], ang: -110 * DEG },
      { b: 1, L: 1, hand: [5, 4], far: [4, 4], ang: 40 * DEG },
      { L: 1, hand: [4, 4], far: [3, 4], ang: 20 * DEG },
    ];
    case 'sit': return [{ sit: true, hand: [3, 6], far: [1, 6], ang: up }];
    case 'pray': return [{ kneel: true, hand: [3, 1], far: [4, 1] }, { kneel: true, nod: 1, hand: [3, 2], far: [4, 2] }];
    case 'cheer': return [{ b: -1, hand: [2, -7], far: [-1, -7] }, { b: -2, lift: 1, hand: [3, -8], far: [0, -8], flap: 2 }];
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

function rigOf(p: Paint, L: PersonLook, pose: Pose, f: number): { r: Rig; key: Key } {
  const tool = TOOLS[L.tool] ?? NO_TOOL;
  const all = keys(pose, tool.kind);
  const key = all[Math.min(f, all.length - 1)];
  const st = L.stage, sc = STAGE_SCALE[st];
  const H = Math.max(10, Math.round(ADULT_H * L.body.scale * sc));
  const k = H / ADULT_H;
  // the head is a larger share of a small body (a child's head is big for its size, as in life)
  const headShare = ({ infant: 0.4, child: 0.33, teen: 0.29, adult: 0.27, elder: 0.27 } as const)[st] * Math.min(1.25, Math.max(0.8, L.body.head));
  const hh = Math.max(5, Math.round(H * headShare));
  const legs = Math.max(2, Math.round((H - hh) * (st === 'infant' ? 0.35 : 0.47)));
  const sk = (v = 0) => Math.round(v * k);
  const kneelDrop = key.kneel ? Math.round(legs * 0.45) : key.sit ? Math.round(legs * 0.6) : 0;
  const foot = FRAME.foot;
  const b = sk(key.b) + kneelDrop;
  const hip = foot - legs + b;
  const torsoH = H - hh - legs;
  const sh = hip - torsoH;
  const stoop = st === 'elder' ? 1 : 0;
  const tw = Math.max(4, Math.round(8 * k * L.body.shoulders * (L.fem ? 0.9 : 1)));
  const x0 = CX - Math.floor(tw / 2) + sk(key.L);
  const hr: Pt = [Math.max(2.5, (hh / 2) * 1.02), hh / 2];
  const head: Pt = [x0 + tw / 2 + 1 + stoop, sh - hh / 2 + 1 + sk(key.nod) + stoop];
  const shoulderNear: Pt = [x0 + tw - 3 * k, sh + 1];
  const shoulderFar: Pt = [x0 + 2 * k, sh + 1];
  const hand: Pt = [shoulderNear[0] + key.hand[0] * k, shoulderNear[1] + key.hand[1] * k];
  const farHand: Pt = [shoulderFar[0] + key.far[0] * k, shoulderFar[1] + key.far[1] * k];
  const lw = k >= 0.8 ? 2 : 1;
  const near = { x: x0 + tw - lw - 1, fx: x0 + tw - lw - 1 + sk(key.fa), lift: key.lift === 2 ? 1 : 0 };
  const far = { x: x0 + 1, fx: x0 + 1 + sk(key.ba), lift: key.lift === 1 ? 1 : 0 };
  const m = {
    skin: p.mat(L.skin), hair: p.mat(L.hairColor), eye: p.mat(L.eye, { flat: true }), accent: p.mat(L.accent), glow: p.mat(L.accent, { flat: true }),
    main: p.mat(L.main), second: p.mat(L.second), leather: p.mat('#5a3a24'), metal: p.mat('#9a9ea6'), wood: p.mat('#7a5232'), bone: p.mat('#d9cfb2'), pants: p.mat(L.second),
  };
  const r: Rig = {
    p, look: L, pose, f, k, H, foot, hip, sh, x0, tw, head, hr, shoulderNear, shoulderFar, hand, farHand, near, far,
    kneel: !!key.kneel, sit: !!key.sit, ang: key.ang ?? -70 * DEG, push: sk(key.push), flap: key.flap ?? 0, glow: !!key.glow,
    holds: HOLDS[pose] && tool.kind !== 'none', m,
  };
  return { r, key };
}

/** The parts of a look, in the order they draw within a layer: body, outfit, hair, beard, hat, tool, feats. */
function partsOf(L: PersonLook): { body: Part[]; replace: Partial<Record<Layer, Part>>; add: Part[] } {
  const outfit = part(OUTFITS, L.outfit) ?? {};
  const lower = LOWER[L.body.lower] ?? LOWER.legs;
  const replace: Partial<Record<Layer, Part>> = {
    torso: outfit.torso ? outfit : BODY_PARTS.torso,
    farArm: outfit.farArm ? outfit : BODY_PARTS.arms,
    nearArm: outfit.nearArm ? outfit : BODY_PARTS.arms,
    lower: L.body.lower === 'legs' && outfit.lower ? outfit : lower,
  };
  const add = [
    BODY_PARTS.head, EARS[L.body.ears] ?? EARS.round,
    { ...outfit, torso: undefined, farArm: undefined, nearArm: undefined, lower: undefined },
    part(HAIR, L.hair), part(BEARDS, L.beard), part(HATS, L.hat), TOOLS[L.tool],
    ...L.feats.map((f) => FEATS[f]),
  ].filter((x): x is Part => !!x);
  return { body: [], replace, add };
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

export function paintPerson(L: PersonLook, pose: Pose, f: number): Frame {
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
    if (layer === 'hat' && L.hat) BODY_PARTS.head.face?.(r);
  }
  if (key.fall) p.turn(-1, [CX, FRAME.foot]);
  return p.finish({ cx: CX + 1, cy: FRAME.foot, rx: Math.max(4, 8 * r.k * Math.max(1, L.body.shoulders)), ry: Math.max(1, 2 * r.k) });
}
