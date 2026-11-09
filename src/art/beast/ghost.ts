// Ghosts that are people: a figure of the person painter turned into a ghost (tinted, see-through, fading toward the feet, floating): the
// ghost soldiers, the shadow queen, the ghost crew, the ghost NPCs. Each ghost keeps what makes it that ghost (STYLE): the long hair that floats
// like hair under water, the glowing key held to the chest, the black smoke that trails a shadow, the cursed gold that glows in a chest.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { FRAME, type Pose } from '../anim';
import type { Frame } from '../paint';
import { paintPerson } from '../person';
import type { PersonLook } from '../look';
import { FRAMES, blank, blend, flash, mix, ovEll, over, rnd } from './kit';
import { personLookOf } from './look';

interface Style {
  /** the hair the figure gets */
  hair?: string;
  /** a light held to the chest: [colour, shape] */
  glow?: [string, 'key' | 'orb'];
  /** black smoke instead of a body: trails off the figure */
  smoke?: boolean;
  /** what tells the ghost from the other pale ones of its city (M7): the hair that streams behind with silver waves on the robe, or the rusted plates of an old armour */
  mark?: 'streaming' | 'plates';
}
const STYLE: Record<string, Style> = {
  'NB08-2': { hair: 'long', mark: 'streaming' },
  'NB08-4': { glow: ['#7ad0ff', 'key'], mark: 'plates' },
  'NB13-3': { smoke: true },
  ghost_crew: { glow: ['#ffc830', 'orb'] },
};
/** Enemies of the table that are people drawn as ghosts (the rows with form `ghost` are always ghosts). */
export const GHOST_IDS: readonly string[] = ['ghost_crew'];

export function ghostFrame(L: EnemyLook, pose: Pose, f: number): Frame {
  const fr = FRAMES[L.size], out = blank(fr.w, fr.h), st = STYLE[L.id] ?? {};
  const dying = pose === 'die' ? [0.34, 0.67, 1][f] ?? 1 : 0;
  const pl = personLookOf(L);
  const look: PersonLook = st.hair ? { ...pl, hair: st.hair } : pl;
  const body = paintPerson(look, pose === 'die' ? 'idle' : pose, pose === 'die' ? 0 : f);
  let y0 = body.h, y1 = -1, x0 = body.w, x1 = -1;
  for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) if (body.data[(y * body.w + x) * 4 + 3] > 120) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  // a pale ghost is drawn with a deeper tone (so it stays ghostly but does not vanish on a light ground)
  const tc = st.smoke ? L.main : mix(L.main, '#34486e', 0.42);
  const tint = [parseInt(tc.slice(1, 3), 16), parseInt(tc.slice(3, 5), 16), parseInt(tc.slice(5, 7), 16)];
  const hover = pose === 'idle' ? 3 + (f % 2) : 3, h = Math.max(1, y1 - y0);
  const smoke = !!st.smoke;
  for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) {
    const i = (y * body.w + x) * 4;
    if (body.data[i + 3] === 0) continue;
    const solid = body.data[i + 3] > 120, k = Math.max(0, Math.min(1, (y1 - y) / (h * 0.5)));
    if (!solid) { body.data[i + 3] = 0; continue; }
    // the luminance of the painted pixel keeps the figure's own shading
    const lum = (body.data[i] * 0.3 + body.data[i + 1] * 0.59 + body.data[i + 2] * 0.11) / 255;
    for (let c = 0; c < 3; c++) body.data[i + c] = smoke ? tint[c] * (0.5 + lum * 0.7) + 8 : body.data[i + c] * 0.3 + tint[c] * 0.64 + 255 * 0.02;
    const keep = dying === 0 || (((x * 7 + y * 13) % 16) / 16) >= dying; // a dying ghost thins out in a dither
    // solid enough to show on a light ground: the base alpha is high and fades only at the hem
    body.data[i + 3] = keep ? Math.round((smoke ? 235 : 215) * (0.42 + 0.58 * k ** 0.6)) : 0;
  }
  // the marks that make the ghosts of Nebulia (the city of the sunk) two different dead
  if (st.mark === 'streaming') {
    // the long hair floats up and back like hair under water (a pale silver, wavy by the frame) and the ceremonial robe has wave lines of faint silver
    for (let i = 0; i < 5; i++) for (let d = 0; d < Math.round(h * (0.55 + (i % 3) * 0.1)); d++) {
      const hx = x0 - 1 - i * 0.8 - Math.sin((d + f * 2 + i) * 0.7) * 1.4, hy = y0 + 3 + d * 0.9;
      blend(body, hx, hy, '#e8f0ff', 0.9 - d / (h * 1.1)); blend(body, hx + 1, hy, '#9ab0d0', 0.5);
    }
    for (const t of [0.5, 0.64, 0.78]) for (let x = x0 + 1; x < x1; x++) blend(body, x, y0 + h * t + Math.sin(x * 0.9 + f) * 0.8, '#eef6ff', 0.85);
  } else if (st.mark === 'plates') {
    // an old armour that has rotted: broad pauldrons, dark seams between the plates, a rusted rim at the neck and the helm's crest (the body is the person painter's armour)
    for (const t of [0.34, 0.5, 0.66]) for (let x = x0 + 1; x < x1; x++) blend(body, x, y0 + h * t, '#14202e', 0.7);
    for (let dy = 0; dy < 4; dy++) { blend(body, x0 - 1, y0 + h * 0.3 + dy, '#a8b8c8', 0.9); blend(body, x1 + 1, y0 + h * 0.3 + dy, '#a8b8c8', 0.9); }
    for (let x = x0 + 2; x < x1 - 1; x += 2) blend(body, x, y0 + 1, '#c8d8e8', 0.9);
    for (let i = 0; i < 6; i++) blend(body, x0 + 2 + ((i * 5) % Math.max(3, x1 - x0 - 3)), y0 + h * 0.4 + (i % 3) * 3, '#7a5a40', 0.8);
  }
  // a dark misty rim round the whole figure: it reads on a light ground and on a dark one, and is still see-through
  {
    const rim = new Uint8ClampedArray(body.data);
    const solidAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= body.w || y >= body.h ? 0 : body.data[(y * body.w + x) * 4 + 3]);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) {
      const i = (y * body.w + x) * 4;
      if (body.data[i + 3] > 40) continue;
      const a = Math.max(solidAt(x - 1, y), solidAt(x + 1, y), solidAt(x, y - 1), solidAt(x, y + 1));
      if (a > 90) { rim[i] = 28; rim[i + 1] = 40; rim[i + 2] = 70; rim[i + 3] = Math.round(a * 0.78 * (1 - dying)); }
    }
    body.data.set(rim);
  }
  // the light a ghost holds (the key, the gold): solid, with a halo, at the chest
  if (st.glow) {
    const cx = Math.round((x0 + x1) / 2) + 1, cy = Math.round(y0 + h * 0.4);
    const [col, shape] = st.glow;
    const pulse = 0.5 + 0.2 * (f % 2);
    ovEll(body, cx, cy, 5, 5, col, 0.18 * pulse); ovEll(body, cx, cy, 3.4, 3.4, col, 0.3 * pulse);
    if (shape === 'orb') { ovEll(body, cx, cy, 2.2, 2.2, col, 1); ovEll(body, cx, cy, 1.1, 1.1, '#fff4c0', 1); }
    else {
      // a key: a ring, a shaft, a tooth
      for (const [dx, dy] of [[-1, -3], [0, -3], [1, -3], [-2, -2], [2, -2], [-2, -1], [2, -1], [-1, 0], [0, 0], [1, 0]]) blend(body, cx + dx, cy + dy, col, 1);
      for (let d = 1; d <= 4; d++) blend(body, cx, cy + d, col, 1);
      blend(body, cx + 1, cy + 3, col, 1); blend(body, cx + 1, cy + 4, col, 1); blend(body, cx - 1, cy + 4, '#e8f8ff', 1);
      blend(body, cx, cy - 2, '#e8f8ff', 1);
    }
  }
  // smoke wisps trail off a shadow
  if (smoke) for (let i = 0; i < 9; i++) {
    const t = rnd(L.id, i + f * 11), wx = x0 + (x1 - x0) * rnd(L.id, i * 3 + 1), wy = y1 - (y1 - y0) * (0.1 + rnd(L.id, i * 5 + 2) * 0.9) - f * 1.2;
    ovEll(body, wx, wy, 2.4 + t * 1.8, 1.8 + t * 1.2, '#1c1c24', 0.5 * (1 - dying));
  }
  const cx = Math.round(fr.w / 2 - 22) + 22;
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const dx = (x + 0.5 - cx) / 8, dy = (y + 0.5 - fr.foot) / 1.6; if (dx * dx + dy * dy <= 1) { const i = (y * fr.w + x) * 4; out.data[i] = 24; out.data[i + 1] = 26; out.data[i + 2] = 44; out.data[i + 3] = 60 * (1 - dying); } }
  over(out, body, Math.round(fr.w / 2 - 22), fr.foot - FRAME.foot - hover);
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}
