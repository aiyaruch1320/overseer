// Riders: a person (the person painter, seated) on a mount that this file draws: the war horse of the knight, the wolf of Dreenzar, the sand
// worm of the raiders. The mount is painted like any beast (materials, death warp, shading); the rider is a finished frame of the person painter
// laid over its back, with the weapon drawn over both. When the mount dies the rider falls off and lies on the ground.
import type { EnemyLook, MountKind } from '../../core/data/types-beast-looks';
import { Paint, type Frame, type Pt } from '../paint';
import { paintPerson } from '../person';
import { ik, leg, paw, spine, tube } from './dragon-parts';
import { FRAMES, Pen, applyDie, blank, dark, flash, light, mix, motion, over, type Ctx } from './kit';
import { personLookOf } from './look';

interface Out { saddle: Pt; shadow: { cx: number; cy: number; rx: number; ry: number }; ground: Pt }

/** The mount painted into `p` (units: the middle of the feet is (0,0), facing right); where the rider sits, in units. */
function paintMount(kind: MountKind, c: Ctx<EnemyLook>, s: number, tint: { main: string; second: string }): Out {
  const { mo, p } = c;
  const pen = c.pen(s).at(mo.push, mo.bob);
  const walking = mo.pose === 'walk', atk = mo.pose === 'attack', lunge = atk ? [0.1, 1, 0.4][mo.a] : 0;
  const step = (o: number, k = 1): Pt => walking ? [Math.sin(mo.ph + o) * 4.6 * k, -Math.max(0, Math.cos(mo.ph + o)) * 3.4 * k] : atk ? [(o > 3 ? -1 : 1) * lunge * 3 * k, 0] : [0, 0];
  if (kind === 'worm') return worm(c, pen, s, lunge);
  const horse = kind === 'horse';
  const body = horse ? '#6a4a34' : '#44444a', belly = horse ? '#8a6a4a' : '#7a7a82';
  const fur = p.mat(body, { deep: true }), furD = p.mat(dark(body, 0.32)), furL = p.mat(light(body, 0.2)), ol = p.mat(dark(body, 0.62), { flat: true }), bel = p.mat(belly);
  const mane = p.mat(horse ? '#1e1814' : '#2e2e34', { deep: true }), hoof = p.mat('#2a2420', { flat: true }), eye = p.mat(horse ? '#1e1814' : '#d8b030', { flat: true }), tooth = p.mat('#f0ead8', { flat: true });
  const steel = p.mat(tint.main, { deep: true }), steelL = p.mat(light(tint.main, 0.3)), cloth = p.mat(tint.second, { deep: true }), clothL = p.mat(light(tint.second, 0.3));
  // the proportions of each: [height of the back, hip x, shoulder x, leg length]
  const H = horse ? 35 : 23, hipX = horse ? -17 : -10, shX = horse ? 12 : 9, LL = horse ? 15 : 10.5;
  const by = -H;
  const lg = (x: number, o: number, far: boolean, hind: boolean): void => {
    const [dx, dy] = step(o);
    leg(pen, [x, by + 6 + (hind ? 1 : 0)], { a: LL, b: LL + (hind ? 1 : 0), foot: [x + 1 + dx, dy], hind, r: horse ? (hind ? 3.6 : 3) : (hind ? 3.1 : 2.6), k: far ? furD : fur, ol, claw: horse ? hoof : tooth, paw: horse ? 1.4 : 1.8 });
  };
  lg(hipX - 4, Math.PI, true, true); lg(shX - 4, 0.3, true, false);
  // tail
  const tw = Math.sin(mo.ph) * 1.4 + (mo.breath ? 0.8 : 0);
  if (horse) { pen.chain([[hipX - 8, by - 1], [hipX - 14, by + 8 + tw], [hipX - 13, by + 20 + tw * 1.4]], [2.4, 2.6, 1.4], ol); pen.chain([[hipX - 8, by - 1], [hipX - 14, by + 8 + tw], [hipX - 13, by + 20 + tw * 1.4]], [1.8, 2, 0.8], mane); }
  else { pen.chain([[hipX - 5, by + 1], [hipX - 13, by + 6 + tw], [hipX - 16, by + 12]], [3, 2.8, 1.4], ol); pen.chain([[hipX - 5, by + 1], [hipX - 13, by + 6 + tw], [hipX - 16, by + 12]], [2.2, 2, 0.8], furD); }
  // the body, the neck and the head all in one tube
  const neck: Pt[] = horse ? [[shX + 7 + lunge * 3, by - 5], [shX + 12 + lunge * 5, by - 14 + lunge * 2], [shX + 15 + lunge * 6, by - 21 + lunge * 3]] : [[shX + 4 + lunge * 3, by - 3], [shX + 8 + lunge * 6, by - 8 + lunge * 3]];
  const pts: Pt[] = [[hipX - 6, by + 1], [hipX + 1, by - 0.5], [(hipX + shX) / 2, by], [shX, by + 0.5], ...neck];
  const rad = horse ? [7.4, 8.8, 8.8, 8.6, 6.4, 4.8, 3.6] : [5.2, 6.6, 6.8, 6.4, 5, 4];
  tube(pen, pts, rad, fur, { ol, belly: bel, from: 1, to: 4, bellyW: 0.34, edge: furL });
  // mane and ears
  const hd = pts[pts.length - 1];
  if (horse) { for (let i = 0; i < 6; i++) { const q = pts[3 + Math.min(3, Math.floor(i / 2))]; pen.poly([[q[0] - 3.4 + i * 0.6, q[1] - rad[3 + Math.min(3, Math.floor(i / 2))] + 1], [q[0] - 5.2 + i * 1, q[1] - rad[3 + Math.min(3, Math.floor(i / 2))] - 3 - (i % 2)], [q[0] - 0.8 + i * 0.6, q[1] - rad[3 + Math.min(3, Math.floor(i / 2))] + 2]], mane); } }
  // the head
  const hx = hd[0] + (horse ? 3 : 4), hy = hd[1] - (horse ? 2 : 0), jaw = mo.open * 2.2;
  if (horse) {
    pen.chain([[hx, hy], [hx + 7 + lunge, hy + 7]], [3.8, 2.8], ol); pen.chain([[hx, hy], [hx + 7 + lunge, hy + 7]], [3, 2], fur);
    pen.poly([[hx + 1, hy + 4.4 + jaw], [hx + 8, hy + 8 + jaw], [hx + 8, hy + 10 + jaw], [hx + 2, hy + 7.4]], furD);
    // armoured face: a plate over the nose with a ridge
    pen.poly([[hx - 1, hy - 2.4], [hx + 2, hy - 3.2], [hx + 9, hy + 5.4], [hx + 6.6, hy + 6.6], [hx + 1, hy + 1.8]], steel);
    pen.line([hx + 1, hy - 1.6], [hx + 7.6, hy + 5.4], steelL, 0.8);
    pen.poly([[hx - 2.6, hy - 2.6], [hx - 3.6, hy - 7.6], [hx - 0.8, hy - 3]], fur);
    pen.dot(hx + 1.8, hy - 0.4, mo.dead ? ol : eye, 1.5); pen.dot(hx + 8.6, hy + 7, ol, 1.4);
  } else {
    pen.ell(hx, hy, 4.6, 4, ol); pen.ell(hx, hy, 3.9, 3.4, fur);
    pen.poly([[hx + 1, hy - 1.8], [hx + 8.4, hy + 0.6], [hx + 8.4, hy + 2.4], [hx + 1, hy + 3]], fur);
    pen.poly([[hx + 1.4, hy + 2.4 + jaw * 0.3], [hx + 8, hy + 2.6 + jaw], [hx + 7.6, hy + 4 + jaw], [hx + 1, hy + 3.8]], furD);
    if (mo.open > 0.4) { pen.dot(hx + 7, hy + 2.4 + jaw * 0.7, tooth, 1); pen.dot(hx + 4.6, hy + 2.4 + jaw * 0.5, tooth, 1); }
    pen.dot(hx + 8.4, hy + 0.2, ol, 1.5);
    pen.poly([[hx - 2.4, hy - 2.6], [hx - 1.6, hy - 7.4], [hx + 0.6, hy - 3]], fur); pen.poly([[hx + 1, hy - 3], [hx + 2.4, hy - 6.8], [hx + 3.4, hy - 2.4]], furD);
    pen.dot(hx + 2.8, hy - 0.8, mo.dead ? ol : eye, 1.4);
  }
  // near legs over the body
  lg(hipX, 0, false, true); lg(shX, Math.PI * 0.8, false, false);
  // the cloth of a war horse falls over its flanks, trimmed in a lighter tone (the saddle sits on it)
  if (horse) {
    const x0 = hipX - 6, x1 = shX + 4;
    pen.poly([[x0, by - 7], [x1, by - 7], [x1 + 1, by + 6], [x1 - 3, by + 11], [x1 - 7, by + 7], [x1 - 11, by + 12], [x1 - 15, by + 7], [x1 - 19, by + 12], [x0 + 2, by + 7]], ol);
    pen.poly([[x0 + 1, by - 6], [x1 - 1, by - 6], [x1, by + 5], [x1 - 3, by + 10], [x1 - 7, by + 6], [x1 - 11, by + 11], [x1 - 15, by + 6], [x1 - 19, by + 11], [x0 + 3, by + 6]], cloth);
    pen.line([x0 + 2, by - 5.4], [x1 - 1, by - 5.4], clothL, 1); pen.line([x0 + 3, by + 5], [x1 - 1, by + 4], clothL, 0.8);
    pen.poly([[x0 + 7, by - 7], [x1 - 7, by - 7], [x1 - 8, by - 9.4], [x0 + 8, by - 9.4]], p.mat('#4a3020', { deep: true }));
  } else for (let i = 0; i < 6; i++) pen.poly([[hipX - 3 + i * 3.4, by - 6.4], [hipX - 2 + i * 3.4, by - 9.4 - (i % 2)], [hipX + i * 3.4, by - 6.4]], furD);
  return { saddle: [horse ? -3 : -1, by - 8], shadow: { cx: c.cx + (mo.push + 2) * s, cy: c.foot, rx: (horse ? 30 : 22) * s, ry: Math.max(2, 2.6 * s * 0.5) }, ground: [c.cx, c.foot] };
}

/** A small sand worm lying on the dune: a segmented body that rears at the front, a round mouth ringed with teeth. */
function worm(c: Ctx<EnemyLook>, pen: Pen, s: number, lunge: number): Out {
  const { mo, p } = c;
  const sand = p.mat('#b49868', { deep: true }), band = p.mat('#8a6e48'), bandL = p.mat('#d0b684'), ol = p.mat('#4a3a24', { flat: true }), mouth = p.mat('#8a3a2a', { flat: true }), tooth = p.mat('#ece4cc', { flat: true });
  const w = mo.pose === 'walk' ? mo.ph : mo.breath * 0.9;
  const pts: Pt[] = spine(9, (u) => [-30 + u * 58 + lunge * 5 * u, -9 - 3.4 * Math.sin(u * 7 + w) * (1 - u * 0.5) - 14 * u ** 2.2 - lunge * 3 * u]);
  const rad = pts.map((_, i) => { const u = i / 9; return 2.4 + 7.4 * Math.min(1, u * 3) - 1.2 * u * u; });
  tube(pen, pts, rad, sand, { ol });
  // the rings of the body
  for (let i = 1; i < 9; i++) { const [x, y] = pts[i], r = rad[i]; pen.line([x - 0.6, y - r + 0.6], [x + 0.8, y + r - 0.4], i % 2 ? band : bandL, 0.9); }
  const hd = pts[9], r = rad[9], open = mo.open * 2;
  pen.ell(hd[0] + 2.4, hd[1], 3.8, r + 0.9, ol); pen.ell(hd[0] + 2.4, hd[1], 3.2, r, band);
  pen.ell(hd[0] + 3.4, hd[1], 2.4 + open * 0.4, r - 2, mouth);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pen.poly([[hd[0] + 3.4 + Math.cos(a) * 2.2, hd[1] + Math.sin(a) * (r - 2.4)], [hd[0] + 3.4 + Math.cos(a) * 0.6, hd[1] + Math.sin(a) * (r - 4.4)], [hd[0] + 3.4 + Math.cos(a + 0.4) * 2.2, hd[1] + Math.sin(a + 0.4) * (r - 2.4)]], tooth); }
  // the sand it throws up
  for (let i = 0; i < 5; i++) pen.dot(-26 + i * 9 + ((mo.f + i) % 2), -1.2 - (i % 2), band, 1.6);
  const sd = pts[3];
  return { saddle: [sd[0] + 1, sd[1] - rad[3] + 1], shadow: { cx: c.cx + 2 * s, cy: c.foot, rx: 32 * s, ry: Math.max(2, 2.4 * s * 0.5) }, ground: [c.cx, c.foot] };
}

const WEAPON_LEN = { horse: 20, wolf: 26, worm: 16 } as const;

/** Where a frame's seat is: the bottom middle of its opaque pixels, a little up (the seated person's hips). */
function seatOf(f: Frame): { x: number; y: number } {
  let y1 = -1, x0 = f.w, x1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 120) { if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return { x: (x0 + x1) / 2, y: y1 - 7 };
}

const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function drawLine(f: Frame, a: Pt, b: Pt, hex: string, thick = 1): void {
  const [r, g, bl] = hexRgb(hex), n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) for (let k = 0; k < thick; k++) {
    const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n), y = Math.round(a[1] + ((b[1] - a[1]) * i) / n) + k;
    if (x >= 0 && y >= 0 && x < f.w && y < f.h) { const j = (y * f.w + x) * 4; f.data[j] = r; f.data[j + 1] = g; f.data[j + 2] = bl; f.data[j + 3] = 255; }
  }
}

/** The weapon the rider holds, over the mount and the person: a lance or spear, a sword, a whip. */
function weapon(f: Frame, L: EnemyLook, hand: Pt, mo: ReturnType<typeof motion>, s: number): void {
  const tool = L.parts?.tool ?? '';
  const len = WEAPON_LEN[L.mount ?? 'horse'] * Math.max(0.8, s);
  const up = mo.pose === 'attack' ? [0.6, -0.25, 0.1][mo.a] : -0.45;
  if (tool === 'spear') { const tip: Pt = [hand[0] + len * Math.cos(up), hand[1] + len * Math.sin(up)]; drawLine(f, [hand[0] - len * 0.35, hand[1] + len * 0.12], tip, '#5a3a24'); drawLine(f, tip, [tip[0] + 3, tip[1] - 0.8 * (up < 0 ? -1 : 1)], '#d8dce4'); }
  else if (tool === 'sword' || tool === 'greatsword') { const a = mo.pose === 'attack' ? [-1.7, -0.2, 0.5][mo.a] : -1.2; const tip: Pt = [hand[0] + len * 0.55 * Math.cos(a), hand[1] + len * 0.55 * Math.sin(a)]; drawLine(f, hand, tip, '#d8dce4'); drawLine(f, [hand[0] - 1.4, hand[1] + 1], [hand[0] + 1.4, hand[1] - 1], '#c8a04a'); }
}

/** One frame of a rider on its mount. */
export function paintMounted(L: EnemyLook, pose: Parameters<typeof motion>[0], f: number, seed: string, k = 1): Frame {
  const fr = FRAMES[L.size];
  const mo = motion(pose, f, L.atkKind);
  const kind = L.mount!;
  const p = new Paint(fr.w, fr.h);
  const cx = Math.round(fr.w / 2);
  const c: Ctx<EnemyLook> = { L, p, w: fr.w, h: fr.h, foot: fr.foot, cx, mo, px: 0, mat: (h, o) => p.mat(h, o), pen: (sc) => new Pen(p, cx, fr.foot, sc) };
  const person = personLookOf(L);
  const rs = Math.max(0.6, Math.min(1.5, (L.scale ?? 1) * k * (kind === 'horse' ? 1.1 : 1)));
  const riderLook = { ...person, body: { ...person.body, scale: rs } };
  const seatH = 26 * rs; // a seated person's height in pixels, about
  const room = fr.foot - 5 - (kind === 'worm' ? seatH * 0.9 : kind === 'wolf' ? seatH * 0.8 : seatH * 0.55);
  const s = k * Math.min(room / (kind === 'horse' ? 74 : kind === 'wolf' ? 44 : 34), (fr.w * (k < 1 ? 0.78 : 0.92)) / (kind === 'horse' ? 80 : kind === 'wolf' ? 60 : 78) / k);
  const out = paintMount(kind, c, s, { main: L.main, second: L.second });
  if (mo.die) applyDie(p, 'topple', mo.die, out.ground, 40 * s, false, p.mat(L.second, { flat: true }), seed);
  const frame = p.finish(out.shadow);
  // the rider: seated on the saddle; thrown off when the mount dies
  const dead = mo.pose === 'die';
  const rider = paintPerson(riderLook, dead && f === 2 ? 'die' : 'sit', dead && f === 2 ? 2 : 0);
  const seat = seatOf(rider);
  const sx = cx + out.saddle[0] * s + (mo.push + 0) * s, sy = fr.foot + out.saddle[1] * s + mo.bob * s;
  let dx = Math.round(sx - seat.x), dy = Math.round(sy - seat.y);
  if (dead) { if (f === 1) { dx -= 5; dy += 6; } else if (f === 2) { dx = Math.round(cx - 22 * s - 28); dy = fr.foot - 52; } }
  over(frame, rider, dx, dy);
  if (!dead) weapon(frame, L, [sx + 4 * rs, sy - 8 * rs], mo, s);
  return mo.flash ? flash(frame) : frame;
}

void blank; void ik; void paw; void mix; void light;
export { paintMounted as default };
