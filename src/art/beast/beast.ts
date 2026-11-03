// The beast painter: a Look, a pose and a frame → one frame of pixels (21-pixel-art.md §2 sizes, §3 poses). A body plan has a painter that draws
// the creature standing, with the motion of the pose; this file frames it for its size class, groups it when it comes in a swarm, makes it die
// the way the doc says (kit.applyDie) and shades it (Paint.finish).
import { FRAME, POSE_OF, type Pose } from '../anim';
import { Paint, type Frame } from '../paint';
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { paintPerson } from '../person';
import { paintColossus } from './colossus';
import { paintConstruct } from './construct';
import { paintDragon } from './dragon';
import { paintFlyer } from './flyer';
import { ghostFrame, GHOST_IDS } from './ghost';
import { paintGiant } from './giant';
import { FRAMES, MAX_H, Pen, applyDie, blank, blend, flash, mix, motion, ovEll, over, type Ctx, type Info } from './kit';
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
const isGhost = (L: BeastLook): L is EnemyLook => L.kind === 'enemy' && L.plan === 'humanoid' && (L.form === 'ghost' || GHOST_IDS.includes(L.id));

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
  if (L.id === 'gas_ghoul') gas(out, f, pose === 'die');
  if (L.id === 'mummy' && pose !== 'die') mummyMarks(out, L, pose);
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}

/** The mummy's green eye under the linen and the dull gold shield on the far arm (04-enemies.md: ตาเขียวจางเรืองใต้ผ้า · โล่ทองหมอง). */
function mummyMarks(out: Frame, L: EnemyLook, pose: Pose): void {
  let top = -1, x0 = out.w, x1 = -1, bot = -1;
  const at = (x: number, y: number): number => out.data[(y * out.w + x) * 4 + 3];
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (at(x, y) > 200) { if (top < 0) top = y; bot = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (top < 0) return;
  // the dark slit left for the eyes: the first run of near-black pixels under the top of the head
  for (let y = top; y < top + 14; y++) {
    let run = 0;
    for (let x = x0; x <= x1 + 1; x++) {
      const i = (y * out.w + x) * 4, dk = at(x, y) > 200 && out.data[i] < 48 && out.data[i + 1] < 48 && out.data[i + 2] < 48;
      run = dk ? run + 1 : 0;
      if (run === 3) {
        const eye = L.eye;
        blend(out, x - 1, y, eye, 1); blend(out, x, y, mix(eye, '#ffffff', 0.5), 1);
        ovEll(out, x - 1, y, 3, 2, eye, 0.18);
        y = top + 99; break;
      }
    }
  }
  // the shield on the far arm (the left of a figure that faces right): a round disc of dull gold with a boss
  const cy = Math.round(top + (bot - top) * 0.5), cx = x0 + 1;
  if (pose !== 'attack') { ovEll(out, cx, cy, 5, 5, '#3a2e14', 1); ovEll(out, cx, cy, 4, 4, '#a8903a', 1); ovEll(out, cx - 1, cy - 1, 1.6, 1.6, '#d8c470', 1); ovEll(out, cx + 0.5, cy + 1, 3, 2, '#7a6628', 0.6); }
}

/** Lemon-yellow gas that leaks from the mask's vents and the hem of the coat (gas_ghoul), over the figure. */
function gas(out: Frame, f: number, dying: boolean): void {
  const cx = out.w / 2 + 2, foot = out.h - 4;
  // the iron mask over the lower face: a plate with two dark eye slits and the vents the gas comes from
  let top = -1, tx = cx;
  for (let y = 0; y < out.h && top < 0; y++) { let x0 = out.w, x1 = -1; for (let x = 0; x < out.w; x++) if (out.data[(y * out.w + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } if (x1 - x0 >= 3) { top = y; tx = (x0 + x1) / 2; } }
  if (top >= 0 && !dying) {
    const mx = Math.round(tx) - 1, my = top + 3;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) blend(out, mx + i, my + j, j === 0 ? '#8a8e98' : '#5a5e68', 1);
    for (const i of [1, 4]) blend(out, mx + i, my + 1, '#d03020', 1);
    for (const i of [2, 3]) blend(out, mx + i, my + 3, '#24262c', 1);
    for (let i = -1; i < 7; i++) { blend(out, mx + i, my - 1, '#2a2c32', 1); blend(out, mx + i, my + 4, '#2a2c32', 1); }
  }
  for (let i = 0; i < 7; i++) {
    const t = (i + f * 0.5) / 7, drift = ((i * 5 + f * 3) % 11) - 5;
    const y = foot - 30 + (i % 3) * 9 - ((f + i) % 2) * 1.5, x = cx + drift + (i % 2 ? 6 : -6) * t;
    ovEll(out, x, y, 2.6 + (i % 3), 1.8 + (i % 2), '#d8d840', (dying ? 0.3 : 0.5) - t * 0.2);
  }
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
  const group = L.kind === 'enemy' && !!L.swarm && !L.mount && !L.cloud && L.plan !== 'swarm' && !(L.plan === 'flyer' && (L.form === 'harpy' || L.form === 'storm')) ? SHOWN[L.size] : 1;
  const one = (ff: number, i: number): Frame =>
    L.kind === 'enemy' && isNamed(L) ? paintNamed(L, pose, ff) : L.kind === 'enemy' && L.mount ? paintMounted(L, pose, ff, `${L.id}${i}`, group > 1 ? 0.74 : 1) : isGhost(L) ? ghostFrame(L, pose, ff) : isPerson(L) || isSiren(L) ? personFrame(L, pose, ff) : nativeFrame(L, pose, ff, `${L.id}${i}`, group > 1 ? 0.74 : 1);
  if (group === 1) return one(f, 0);
  const fr = FRAMES[L.size], out = blank(fr.w, fr.h), offs = OFFSETS[group];
  const spec = POSE_OF[pose];
  const order = [...offs.keys()].sort((a, b) => offs[a][1] - offs[b][1]);
  for (const i of order) over(out, one(spec.loop ? (f + i) % spec.n : f, i), offs[i][0], offs[i][1]);
  return out;
}
