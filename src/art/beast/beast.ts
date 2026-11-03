// The beast painter: a Look, a pose and a frame → one frame of pixels (21-pixel-art.md §2 sizes, §3 poses). A body plan has a painter that draws
// the creature standing, with the motion of the pose; this file frames it for its size class, groups it when it comes in a swarm, makes it die
// the way the doc says (kit.applyDie) and shades it (Paint.finish).
import { FRAME, POSE_OF, type Pose } from '../anim';
import { Paint, type Frame } from '../paint';
import { paintPerson } from '../person';
import { paintColossus } from './colossus';
import { paintConstruct } from './construct';
import { paintDragon } from './dragon';
import { paintFlyer } from './flyer';
import { paintGiant } from './giant';
import { FRAMES, MAX_H, Pen, applyDie, blank, flash, motion, over, type Ctx, type Info } from './kit';
import { personLookOf, type BeastLook } from './look';
import { paintMounted } from './mount';
import { isNamed, paintNamed } from './named';
import { paintPlant } from './plant';
import { paintQuad } from './quad';
import { paintSea } from './sea';
import { paintSerpent } from './serpent';
import { paintSmall } from './small';
import { isSpecial, paintSpecial } from './special';
import { paintSpirit } from './spirit';
import { paintSwarm } from './swarm';
import { paintUndead } from './undead';

type Painter = (c: Ctx<never>) => Info;
const PLAN: Record<string, (c: Ctx<any>) => Info> = {
  quadruped: paintQuad, flyer: paintFlyer, insect: paintSmall, humanoid: paintSmall, serpent: paintSerpent, amorphous: paintSmall, skeleton: paintUndead,
  construct: paintConstruct, plant: paintPlant, elemental: paintSpirit, spirit: paintSpirit, giant: paintGiant, sea: paintSea, swarm: paintSwarm, dragon: paintDragon,
};
void (null as unknown as Painter);

/** How many bodies of a swarm one frame shows (the game lays out the rest: 04-enemies.md "ขนาด"). */
const SHOWN = { S: 3, M: 2, L: 1, XL: 1, XXL: 1 } as const;
const OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-5, -2], [5, 0]],
  3: [[-8, -5], [8, -6], [0, -1]],
};

const isPerson = (L: BeastLook): boolean => L.kind === 'enemy' && L.plan === 'humanoid' && (L.form === 'person' || L.form === 'wolfman');
const isSiren = (L: BeastLook): boolean => L.kind === 'enemy' && L.form === 'siren';
const isGhost = (L: BeastLook): boolean => L.kind === 'enemy' && L.plan === 'humanoid' && L.form === 'ghost';

/** The size a body is drawn at: its scale times a 28-pixel human, kept inside the frame. */
export function targetHeight(L: BeastLook): number {
  const cls = L.size;
  const scale = L.kind === 'enemy' ? L.scale ?? (cls === 'XXL' ? 10 : 1) : { M: 1.6, L: 3, XL: 8 }[L.size];
  return Math.min(MAX_H[cls], scale * 28);
}

function personFrame(L: BeastLook, pose: Pose, f: number): Frame {
  const fr = FRAMES[L.size];
  const out = blank(fr.w, fr.h);
  if (L.kind !== 'enemy') return out;
  over(out, paintPerson(personLookOf(L), pose, f), Math.round(fr.w / 2 - 22), fr.foot - FRAME.foot);
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}

/** A person of the person painter turned into a ghost: tinted, see-through, fading toward the feet, floating (the ghost soldiers, the shadow queen). */
function ghostFrame(L: BeastLook, pose: Pose, f: number): Frame {
  const fr = FRAMES[L.size], out = blank(fr.w, fr.h);
  if (L.kind !== 'enemy') return out;
  const dying = pose === 'die' ? [0.34, 0.67, 1][f] ?? 1 : 0;
  const body = paintPerson(personLookOf(L), pose === 'die' ? 'idle' : pose, pose === 'die' ? 0 : f);
  let y0 = body.h, y1 = -1;
  for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) if (body.data[(y * body.w + x) * 4 + 3] > 120) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const tint = [parseInt(L.main.slice(1, 3), 16), parseInt(L.main.slice(3, 5), 16), parseInt(L.main.slice(5, 7), 16)];
  const hover = pose === 'idle' ? 3 + (f % 2) : 3, h = Math.max(1, y1 - y0);
  for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) {
    const i = (y * body.w + x) * 4;
    if (body.data[i + 3] === 0) continue;
    const solid = body.data[i + 3] > 120, k = Math.max(0, Math.min(1, (y1 - y) / (h * 0.5)));
    if (!solid) { body.data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) body.data[i + c] = body.data[i + c] * 0.4 + tint[c] * 0.45 + 255 * 0.15;
    const keep = dying === 0 || (((x * 7 + y * 13) % 16) / 16) >= dying; // a dying ghost thins out in a dither
    body.data[i + 3] = keep ? Math.round(170 * (0.08 + 0.92 * k ** 0.7)) : 0;
  }
  // a faint shadow, smaller than a body's: it floats
  const cx = Math.round(fr.w / 2 - 22) + 22;
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const dx = (x + 0.5 - cx) / 8, dy = (y + 0.5 - fr.foot) / 1.6; if (dx * dx + dy * dy <= 1) { const i = (y * fr.w + x) * 4; out.data[i] = 24; out.data[i + 1] = 26; out.data[i + 2] = 44; out.data[i + 3] = 40 * (1 - dying); } }
  over(out, body, Math.round(fr.w / 2 - 22), fr.foot - FRAME.foot - hover);
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}

function nativeFrame(L: BeastLook, pose: Pose, f: number, seed: string, k = 1): Frame {
  const fr = FRAMES[L.size];
  const p = new Paint(fr.w, fr.h);
  const mo = motion(pose, f, L.kind === 'enemy' ? L.atkKind : 'lash');
  const cx = Math.round(fr.w / 2);
  const c: Ctx<BeastLook> = {
    L, p, w: fr.w, h: fr.h, foot: fr.foot, cx, mo, px: targetHeight(L) * k,
    mat: (h, o) => p.mat(h, o), pen: (s) => new Pen(p, cx, fr.foot, s),
  };
  const painter: (c: Ctx<any>) => Info = L.kind === 'dragon' ? paintDragon : L.size === 'XXL' ? paintColossus : L.kind === 'enemy' && isSpecial(L) ? paintSpecial : PLAN[L.plan];
  const info = painter(c);
  if (mo.die) {
    const kind = L.kind === 'enemy' ? L.dieKind : 'sag';
    applyDie(p, kind, mo.die, info.ground ?? [cx, fr.foot], c.px, info.tall ?? false, p.mat(L.second, { flat: true }), seed);
  }
  const frame = p.finish(info.shadow);
  if (info.fade) for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) { const i = (y * frame.w + x) * 4 + 3; if (frame.data[i] > 80) frame.data[i] *= Math.max(0, Math.min(1, info.fade(x, y))); }
  if (info.after && mo.die < 0.6) info.after(frame);
  return mo.flash ? flash(frame) : frame;
}

/** One frame of a beast: the family of one body, or the several bodies of a swarm. */
export function paintBeast(L: BeastLook, pose: Pose, f: number): Frame {
  const group = L.kind === 'enemy' && !!L.swarm && !L.cloud && L.plan !== 'swarm' ? SHOWN[L.size] : 1;
  const one = (ff: number, i: number): Frame =>
    L.kind === 'enemy' && isNamed(L) ? paintNamed(L, pose, ff) : L.kind === 'enemy' && L.mount ? paintMounted(L, pose, ff, `${L.id}${i}`, group > 1 ? 0.74 : 1) : isGhost(L) ? ghostFrame(L, pose, ff) : isPerson(L) || isSiren(L) ? personFrame(L, pose, ff) : nativeFrame(L, pose, ff, `${L.id}${i}`, group > 1 ? 0.74 : 1);
  if (group === 1) return one(f, 0);
  const fr = FRAMES[L.size], out = blank(fr.w, fr.h), offs = OFFSETS[group];
  const spec = POSE_OF[pose];
  const order = [...offs.keys()].sort((a, b) => offs[a][1] - offs[b][1]);
  for (const i of order) over(out, one(spec.loop ? (f + i) % spec.n : f, i), offs[i][0], offs[i][1]);
  return out;
}
