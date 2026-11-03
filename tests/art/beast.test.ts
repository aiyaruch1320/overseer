// The beast painters (M6): every one of the 200 enemies and the 15 legendary dragons has a look, paints every pose, fits the frame of its size
// class, and the slimes have no eyes.
import { describe, expect, it } from 'vitest';
import { POSE_OF } from '../../src/art/anim';
import { paintBeast } from '../../src/art/beast/beast';
import { BEAST_POSES, FRAMES, poseN } from '../../src/art/beast/kit';
import { BEASTS, DRAGONS, ENEMIES, personLookOf } from '../../src/art/beast/look';
import { paintBeastSheet, sheetSize } from '../../src/art/beast/sheet';
import type { EnemyLook } from '../../src/core/data/types-beast-looks';
import { unknownParts } from '../../src/art/person';

type Box = { n: number; x0: number; y0: number; x1: number; y1: number };
/** The box of the solid pixels of a frame (the faint ground shadow is left out). */
function box(f: { w: number; h: number; data: Uint8ClampedArray }): Box {
  const b: Box = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (f.data[(y * f.w + x) * 4 + 3] > 120) { b.n++; b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); }
  return b;
}

describe('beast looks', () => {
  it('200 enemies and 15 dragons', () => {
    expect(ENEMIES.length).toBe(200);
    expect(DRAGONS.length).toBe(15);
    expect(new Set(BEASTS.map((b) => b.id)).size).toBe(215);
  });
  it('the humanoids that the person painter draws name only parts the tables have', () => {
    for (const e of ENEMIES) if (e.parts) expect(unknownParts(personLookOf(e)), e.id).toEqual([]);
  });
});

describe('beast painters', () => {
  it('every beast paints every pose with something on it', () => {
    for (const L of BEASTS) {
      const fr = FRAMES[L.size];
      for (const pose of BEAST_POSES)
        for (let i = 0; i < poseN(pose); i++) {
          const f = paintBeast(L, pose, i);
          expect([f.w, f.h], `${L.id} ${pose}${i}`).toEqual([fr.w, fr.h]);
          // the last frame of a death may be empty (spirits, smoke): the game removes the sprite
          if (!(pose === 'die' && i === poseN('die') - 1)) expect(box(f).n, `${L.id} ${pose}${i}`).toBeGreaterThan(14);
        }
    }
  });
  it('the sheet of each size class holds the five poses', () => {
    for (const id of ['goblin', 'wolf', 'troll', 'firedragon', 'kraken', 'dragon_06']) {
      const L = BEASTS.find((b) => b.id === id)!;
      const s = paintBeastSheet(L), z = sheetSize(L);
      expect([s.w, s.h]).toEqual([z.w, z.h]);
      expect(z.h).toBe(FRAMES[L.size].h * BEAST_POSES.length);
      for (const pose of BEAST_POSES) expect(poseN(pose)).toBe(POSE_OF[pose].n);
    }
  });
  it('a body stays inside the frame of its class (no cut at the sides or the top; only the spider hangs from the top)', () => {
    for (const L of BEASTS) {
      if (L.size === 'XL' || L.size === 'XXL') continue; // XL is cut at the scene edge (04-enemies.md), XXL is the scene
      const fr = FRAMES[L.size], b = box(paintBeast(L, 'idle', 0));
      expect(b.x0, `${L.id} left`).toBeGreaterThan(0);
      expect(b.x1, `${L.id} right`).toBeLessThan(fr.w - 1);
      if (L.id !== 'fog_weaver') expect(b.y0, `${L.id} top`).toBeGreaterThan(0);
    }
  });
  it('a creature of an upright plan stands on the feet row', () => {
    for (const id of ['goblin', 'skeleton', 'troll', 'golem', 'mimic', 'ent']) {
      const L = BEASTS.find((b) => b.id === id)!;
      const fr = FRAMES[L.size], b = box(paintBeast(L, 'idle', 0));
      expect(Math.abs(b.y1 - fr.foot), id).toBeLessThanOrEqual(4);
    }
  });
  it('painting is deterministic', () => {
    for (const id of ['wolf', 'krasue', 'locust_swarm', 'dragon_14']) {
      const L = BEASTS.find((b) => b.id === id)!;
      expect(Buffer.from(paintBeast(L, 'attack', 1).data).equals(Buffer.from(paintBeast(L, 'attack', 1).data)), id).toBe(true);
    }
  });
  it('a hit flashes white for one frame, and the death moves from the first frame to the last', () => {
    for (const id of ['wolf', 'golem', 'dragon_02']) {
      const L = BEASTS.find((b) => b.id === id)!;
      const sum = (f: { data: Uint8ClampedArray }) => { let s = 0; for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3] > 120) s += f.data[i] + f.data[i + 1] + f.data[i + 2]; return s / Math.max(1, box(f as never).n); };
      expect(sum(paintBeast(L, 'hurt', 0)), id).toBeGreaterThan(sum(paintBeast(L, 'hurt', 1)));
      expect(Buffer.from(paintBeast(L, 'die', 0).data).equals(Buffer.from(paintBeast(L, 'die', 2).data)), id).toBe(false);
    }
  });
  it('the slimes have no eyes: one round nucleus and nothing else of its colour', () => {
    const slimes = ENEMIES.filter((e) => e.plan === 'amorphous');
    expect(slimes.length).toBe(2);
    for (const e of slimes) {
      expect(e.eyeLabel, e.id).not.toBe('ตา');
      // paint with the nucleus colour set to magenta: its pixels must form a single blob, not a pair of dots
      const probe: EnemyLook = { ...e, eye: '#ff00ff' };
      for (const [pose, i] of [['idle', 0], ['idle', 1], ['walk', 2], ['attack', 1]] as const) {
        const f = paintBeast(probe, pose, i);
        const mag = new Set<number>();
        for (let k = 0; k < f.w * f.h; k++) if (f.data[k * 4] === 255 && f.data[k * 4 + 1] === 0 && f.data[k * 4 + 2] === 255) mag.add(k);
        expect(mag.size, `${e.id} ${pose}${i}`).toBeGreaterThanOrEqual(8);
        // connected components
        const seen = new Set<number>();
        let comps = 0;
        for (const k of mag) {
          if (seen.has(k)) continue;
          comps++;
          const st = [k];
          while (st.length) { const c = st.pop()!; if (seen.has(c) || !mag.has(c)) continue; seen.add(c); st.push(c - 1, c + 1, c - f.w, c + f.w); }
        }
        expect(comps, `${e.id} ${pose}${i}`).toBe(1);
      }
    }
  });
  it('a swarm shows several bodies in a small frame', () => {
    const gob = BEASTS.find((b) => b.id === 'goblin')!;
    const one = BEASTS.find((b) => b.id === 'npc_bandit')!;
    // the group of goblins is wider than a single person of the same size class
    expect(box(paintBeast(gob, 'idle', 0)).x1 - box(paintBeast(gob, 'idle', 0)).x0).toBeGreaterThan(box(paintBeast(one, 'idle', 0)).x1 - box(paintBeast(one, 'idle', 0)).x0 - 1);
  });
});
