// The pixel art of the town level: the ground is deterministic and keeps its rim dithered, the people have a grid to walk on, and the sprites of
// houses, trees and centres stay inside 16 × 24 to 48 × 48 art pixels (21-pixel-art.md §2).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import { centreFrame } from '../../src/art/mapart/centre';
import { houseFrame } from '../../src/art/mapart/houses';
import { treeFrame } from '../../src/art/mapart/trees';
import { codeProvider } from '../../src/map/codeProvider';
import { NORMAL_LOOKS } from '../../src/map/provider';
import { TOWN_PX } from '../../src/map/tuning';

let data: GameData;
beforeAll(() => { data = loadAll(['countries', 'continents']); });

describe('town ground', () => {
  it('is the plan at TOWN_PX per MU, deterministic, with a dithered rim and cells to walk on', () => {
    const p = codeProvider(data);
    const id = p.layout.citiesOf('AL-01')[0].id;
    const a = p.town(id, { looks: NORMAL_LOOKS, seed: 1 })!, b = codeProvider(data).town(id, { looks: NORMAL_LOOKS, seed: 1 })!;
    expect(a.ground.w).toBe(Math.ceil(a.plan.w * TOWN_PX));
    expect(Buffer.from(a.ground.data).equals(Buffer.from(b.ground.data))).toBe(true);
    expect(a.ground.data[3]).toBe(0); // the corner is clear
    const mid = (Math.floor(a.ground.h / 2) * a.ground.w + Math.floor(a.ground.w / 2)) * 4;
    expect(a.ground.data[mid + 3]).toBe(255);
    expect(a.ground.walk.ok.some((v) => v === 1)).toBe(true);
    expect(a.ground.walk.road.some((v) => v === 1)).toBe(true);
  });
});

describe('map sprites', () => {
  it('keep to the sizes of the art contract', () => {
    for (const style of ['gable', 'dome', 'spire', 'hut', 'tent', 'burrow', 'mushroom', 'brick', 'stone', 'terrace', 'stilt', 'carved', 'keep', 'adobe', 'boomtown', 'forge', 'tree']) {
      const f = houseFrame({ style, roof: '#a8503a', wall: '#d8c8a0', w: 30, floors: 2 });
      expect(f.w, style).toBeLessThanOrEqual(52);
      expect(f.h, style).toBeLessThanOrEqual(52);
      expect(f.data.some((v, i) => i % 4 === 3 && v > 0), style).toBe(true);
    }
    for (const sp of ['palace', 'castle', 'cathedral', 'market', 'arena', 'granary']) expect(houseFrame({ style: 'gable', roof: '#888888', wall: '#cccccc', w: 60, floors: 2, special: sp }).h).toBeLessThanOrEqual(48);
    for (const kind of ['oak', 'palm', 'jungle', 'dead', 'cactus', 'pine']) expect(treeFrame({ kind, h: 30 }).h).toBeLessThanOrEqual(40);
    expect(centreFrame('fountain', 40, false)).not.toBeNull();
    expect(centreFrame('plaza', 40, false)).toBeNull();
  });
});
