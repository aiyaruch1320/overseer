// Named fighters that are NPCs and not beasts (the giants, the nagas, the brass soldier, the demon general, the ogre chief): the same figure the
// map and the cards show (the NPC's own look: personLookOf), at the size of the enemy row, with the marks the enemy row adds for the fight.
// The person painter draws a figure up to 1.5× a 28-pixel human in its 56×56 frame; a bigger fighter is that figure drawn at most 1.5× and
// scaled up by a whole number (nearest neighbour, so a pixel stays a square), then the one thing the fighter is known by is laid over it.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { FRAME, type Pose } from '../anim';
import type { Frame } from '../paint';
import { paintPerson } from '../person';
import type { PersonLook } from '../look';
import { FRAMES, blank, blend, flash, mix, ovEll, over, rnd } from './kit';
import { personLookOf } from './look';

type Held = 'stone' | 'eyestone' | 'tablet' | 'necklace';
interface Marks {
  feats?: string[]; hat?: string; tool?: string; beard?: string; hair?: string; ears?: PersonLook['body']['ears']; eye?: string; accent?: string; skin?: string; outfit?: string; main?: string; second?: string;
  /** the thing in the hand (laid over the figure at the hand), or on the body */
  held?: Held;
  /** a crown of bone laid over the head, too big for it */
  boneCrown?: boolean;
  /** the bed of eggs a naga coils around */
  eggs?: boolean;
  /** white steam from the joints, a lit core in the chest */
  steam?: boolean; core?: string;
}

/** What each named fighter adds to its NPC's look (the words of 04-enemies.md for the fight; the NPC file wins where the two differ). */
const MARKS: Record<string, Marks> = {
  // the stone keepers: the council head (white beard, runes on the arms), the tester (the question stone), the eye-keeper (eyes sewn shut, the
  // glowing eye-stone), the mountain's listener (huge ears, the rhythm tablet), the great keeper (moss on his head, the necklace of ancestors)
  'SH03-1': { beard: 'long', feats: ['runes', 'stone'] },
  'SH03-2': { held: 'stone', feats: ['stone'] },
  'SH03-4': { feats: ['blind', 'stone'], held: 'eyestone' },
  'SH06-4': { feats: ['stone'], ears: 'long' },
  'SH17-1': { feats: ['moss', 'stone'], held: 'necklace' },
  'MH01-1': {},
  'MH03-1': {},
  'SH11-1': {},
  'KD08-1': {},
  'MH02-1': { tool: '', boneCrown: true },
  'MH10-3': { boneCrown: true, tool: 'sword' },
  'MK02-1': { feats: ['mecharm', 'mecheye', 'rivets', 'plates', 'core'], hat: '', tool: '', hair: 'bald', outfit: 'tunic', main: '#b8903a', second: '#6a1a1a', skin: '#b8903a', eye: '#ff4040', accent: '#ff4040', steam: true, core: '#ffe040' },
  'NR07-1': { eggs: true },
  'NR07-2': {},
};
export const isNamed = (e: EnemyLook): boolean => e.kind === 'enemy' && e.id in MARKS;

/** The NPC's look with the fight's marks. */
export function namedLook(e: EnemyLook): PersonLook {
  const base = personLookOf(e), m = MARKS[e.id] ?? {};
  return {
    ...base, ...(m.hat !== undefined ? { hat: m.hat } : {}), ...(m.tool !== undefined ? { tool: m.tool } : {}), ...(m.beard ? { beard: m.beard } : {}),
    ...(m.eye ? { eye: m.eye } : {}), ...(m.accent ? { accent: m.accent } : {}), ...(m.skin ? { skin: m.skin } : {}), ...(m.hair ? { hair: m.hair } : {}), ...(m.outfit ? { outfit: m.outfit } : {}), ...(m.main ? { main: m.main } : {}), ...(m.second ? { second: m.second } : {}),
    body: m.ears ? { ...base.body, ears: m.ears } : base.body,
    feats: [...new Set([...base.feats, ...(m.feats ?? [])])],
  };
}

/** How the figure is drawn and scaled: the whole-number factor and the scale the person painter is given (so that factor × 28 × scale is the size). */
export function figureScale(target: number): { k: number; sp: number } {
  const k = target <= 1.7 ? 1 : Math.ceil(target / 1.5);
  return { k, sp: Math.min(1.5, target / k) };
}

const cache = new Map<string, [number, number] | null>();
/** Where the near hand is in the person frame: the pixels a held mug adds to the figure (null when nothing is held, as in a fall). */
function handOf(L: PersonLook, pose: Pose, f: number): [number, number] | null {
  if (pose === 'die') return null;
  const key = `${L.key}|${L.body.scale}|${pose}|${f}`;
  if (cache.has(key)) return cache.get(key)!;
  const a = paintPerson({ ...L, tool: 'mug' }, pose, f), b = paintPerson({ ...L, tool: '' }, pose, f);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] && (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3])) { sx += (i / 4) % a.w; sy += Math.floor(i / 4 / a.w); n++; }
  }
  const out: [number, number] | null = n ? [sx / n, sy / n] : null;
  cache.set(key, out);
  return out;
}

/** The first rows of the figure: [x of the middle of the head top, y of the top, left, right] */
function headTop(fr: Frame): { x: number; y: number } | null {
  for (let y = 0; y < fr.h; y++) {
    let x0 = fr.w, x1 = -1;
    for (let x = 0; x < fr.w; x++) if (fr.data[(y * fr.w + x) * 4 + 3] > 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (x1 >= 0) {
      // the head is a rounded shape: the middle of the first rows that hold at least 5 pixels
      if (x1 - x0 >= 4) return { x: (x0 + x1) / 2, y };
    }
  }
  return null;
}

const disc = (f: Frame, cx: number, cy: number, r: number, body: string, edge: string, hi: string): void => {
  ovEll(f, cx, cy, r + 1, r + 1, edge, 1); ovEll(f, cx, cy, r, r, body, 1); ovEll(f, cx - r * 0.3, cy - r * 0.35, Math.max(0.8, r * 0.38), Math.max(0.8, r * 0.3), hi, 1);
};

/** The figure with a crown of bone: the person painter's crown (the pixels a gold crown adds) turned to bone, shade for shade. */
function boneCrowned(L: PersonLook, pose: Pose, f: number): Frame {
  const a = paintPerson({ ...L, hat: 'crown' }, pose, f), b = paintPerson({ ...L, hat: '' }, pose, f);
  const bone = [[0x5a, 0x4e, 0x3a], [0x9a, 0x8e, 0x74], [0xd8, 0xcf, 0xb0], [0xf0, 0xe8, 0xd0]];
  for (let i = 0; i < a.data.length; i += 4) {
    if (!a.data[i + 3] || (a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2])) continue;
    const lum = (a.data[i] * 0.3 + a.data[i + 1] * 0.59 + a.data[i + 2] * 0.11) / 255;
    const c = bone[lum < 0.22 ? 0 : lum < 0.5 ? 1 : lum < 0.75 ? 2 : 3];
    a.data[i] = c[0]; a.data[i + 1] = c[1]; a.data[i + 2] = c[2];
  }
  return a;
}

/** What the fighter holds or wears, laid over the scaled figure (frame pixels). */
function lay(out: Frame, L: PersonLook, m: Marks, hand: [number, number] | null, k: number, ox: number, oy: number, f: number): void {
  const hx = hand ? ox + hand[0] * k : null, hy = hand ? oy + hand[1] * k : null;
  if (m.held && hx !== null && hy !== null) {
    if (m.held === 'stone') { disc(out, hx + k, hy - k, 3 * k, '#9a9a96', '#3a3a3e', '#cfcfc8'); }
    else if (m.held === 'eyestone') {
      const g = 0.26 + 0.1 * (f % 2);
      ovEll(out, hx + k, hy - 2 * k, 6 * k, 6 * k, '#c8f0ff', g * 0.6);
      disc(out, hx + k, hy - 2 * k, 2.6 * k, '#e8f4ff', '#3a5a6a', '#ffffff');
      ovEll(out, hx + k, hy - 2 * k, 1.2 * k, 1.2 * k, '#6ac0e0', 1);
    } else if (m.held === 'tablet') { for (let i = 0; i < 4 * k; i++) for (let j = 0; j < 5 * k; j++) blend(out, hx + i, hy - 3 * k + j, '#8a8a84', 1); }
  }
  if (m.held === 'necklace') {
    // a string of dark stones across the chest, a little below the head
    const t = headTop(out);
    if (t) for (let i = -4; i <= 4; i++) { const x = t.x + i * 2.3 * k, y = t.y + 15 * k + (4 - Math.abs(i)) * -0.0 + Math.abs(i) * -0.7 * k + 4.5 * k - Math.abs(i) * 0.4 * k; disc(out, x, y, 1.1 * k, '#6a6a68', '#2a2a2e', '#a8a8a0'); }
  }
  if (m.eggs) {
    const eggs: [number, number][] = [[-20, 0], [-13, 3], [-6, 5], [6, 5], [13, 3], [20, 0]];
    eggs.forEach(([dx, dy], i) => { const cx = out.w / 2 + dx * k * 0.8, cy = ox * 0 + oy + FRAME.foot * k - 3 * k + dy * 0.6 * k - (i === 2 || i === 3 ? 0 : 0); disc(out, cx, cy, 2.4 * k + (i % 2) * 0.4 * k, '#efe6c8', '#6a5a38', '#fffbe8'); });
  }
  if (m.steam) for (let i = 0; i < 4; i++) { const t = headTop(out); if (!t) break; const c = rnd(L.key, i + f * 7); ovEll(out, t.x + (c - 0.3) * 16 * k, t.y + (10 + 14 * ((i + f) % 3)) * k - i * k, 1.8 * k, 1.4 * k, '#e8e8f0', 0.55); }
  if (m.core) { const t = headTop(out); if (t) { const cy = t.y + (oy + FRAME.foot * k - t.y) * 0.4; ovEll(out, t.x + k, cy, 3 * k, 3 * k, m.core, 0.4); ovEll(out, t.x + k, cy, 1.6 * k, 1.6 * k, mix(m.core, '#ffffff', 0.5), 0.95); } }
}

/** One frame of a named fighter in the frame of its size class. */
export function paintNamed(E: EnemyLook, pose: Pose, f: number): Frame {
  const fr = FRAMES[E.size], out = blank(fr.w, fr.h), m = MARKS[E.id] ?? {};
  const target = E.scale ?? 1, { k, sp } = figureScale(target);
  const L0 = namedLook(E);
  const L: PersonLook = { ...L0, body: { ...L0.body, scale: sp } };
  const fig = m.boneCrown ? boneCrowned(L, pose, f) : paintPerson(L, pose, f);
  const ox = Math.round(fr.w / 2 - 25 * k), oy = fr.foot - FRAME.foot * k;
  const big = blank(fig.w * k, fig.h * k);
  for (let y = 0; y < fig.h; y++) for (let x = 0; x < fig.w; x++) {
    const si = (y * fig.w + x) * 4;
    if (!fig.data[si + 3]) continue;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const di = ((y * k + j) * big.w + x * k + i) * 4; big.data[di] = fig.data[si]; big.data[di + 1] = fig.data[si + 1]; big.data[di + 2] = fig.data[si + 2]; big.data[di + 3] = fig.data[si + 3]; }
  }
  over(out, big, ox, oy);
  lay(out, L, m, handOf(L, pose, f), k, ox, oy, f);
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}
