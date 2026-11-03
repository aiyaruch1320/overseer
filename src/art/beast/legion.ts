// The five-flag ghost army (ghost_legion, 04-enemies.md): a ghost host in ranks, faces blurred, helmets and cloaks of mist, each rank carrying
// the banner of its own colour (grey, red, black, gold, white). Drawn as five ghost soldiers of the ghost painter, two ranks, each with a pole.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import type { Pose } from '../anim';
import type { Frame } from '../paint';
import { ghostFrame } from './ghost';
import { FRAMES, blank, blend, flash, mix, over } from './kit';

const SPEC = { skin: '#aab4b8', hairColor: '#7a8088', hair: 'short', hat: 'helmet', beard: '', outfit: 'armor', tool: 'spear', ears: 'round' as const, feats: [] as string[] };

export const isLegion = (L: EnemyLook): boolean => L.id === 'ghost_legion';

const bbox = (f: Frame): { x0: number; x1: number; y0: number; y1: number } => {
  let x0 = f.w, x1 = -1, y0 = f.h, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 120) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1 };
};

export function legionFrame(L: EnemyLook, pose: Pose, f: number): Frame {
  const fr = FRAMES[L.size], out = blank(fr.w, fr.h);
  const flags = L.extra.filter((e) => e.label === 'ธง').map((e) => e.hex);
  // [dx, dy, scale]: the back rank first, so the front rank hides its feet
  const ranks: [number, number, number][] = [[-9, -5, 0.78], [9, -5, 0.78], [-19, 0, 0.9], [0, 1, 0.95], [19, 0, 0.9]];
  for (const i of [0, 1, 2, 4, 3]) {
    const [dx, dy, sc] = ranks[i];
    const flag = flags[i] ?? '#c8c8c8';
    const one: EnemyLook = { ...L, form: 'ghost', plan: 'humanoid', scale: sc, main: mix('#8a9aa0', flag, 0.45), parts: { ...SPEC } };
    const fig = ghostFrame(one, pose, f);
    over(out, fig, dx, dy);
    // the banner: a pole by the hand and a flag of the rank's colour that sways
    const b = bbox(fig);
    if (b.x1 < 0 || pose === 'die') continue;
    const px = b.x1 + dx + 1, top = b.y0 + dy - 7 - (i % 2) * 2, wave = (f + i) % 2;
    for (let y = top; y < b.y1 + dy - 2; y++) blend(out, px, y, '#5a5a66', 0.95);
    for (let k = -1; k < 8; k++) for (let j = -1; j < 6; j++) blend(out, px + 1 + k, top + 1 + j + (k > 2 ? wave * (k - 2) * 0.4 : 0), '#2a2c3a', 0.9);
    for (let k = 0; k < 7; k++) for (let j = 0; j < 5; j++) blend(out, px + 1 + k, top + 1 + j + (k > 2 ? wave * (k - 2) * 0.4 : 0), flag, 0.92);
    for (let k = 0; k < 7; k++) blend(out, px + 1 + k, top + 1, mix(flag, '#ffffff', 0.35), 0.92);
  }
  return pose === 'hurt' && f === 0 ? flash(out) : out;
}
