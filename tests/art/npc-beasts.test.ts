// The NPCs that are creatures (src/art/npc-beasts.ts): each listed id resolves to a beast look of the size its description gives and paints every
// pose; the people that have no people id are left to the person painter.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paintBeast } from '../../src/art/beast/beast';
import { BEAST_POSES, FRAMES, poseN } from '../../src/art/beast/kit';
import type { EnemyLook } from '../../src/core/data/types-beast-looks';
import { NPC_BEAST_IDS, npcBeast } from '../../src/art/npc-beasts';

const npcs = (JSON.parse(readFileSync('data/gen/npcs.json', 'utf8')) as { items: { npcs: { id: string; peopleId: string | null }[] } }).items.npcs;
const solid = (f: { data: Uint8ClampedArray }) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 120) n++; return n; };

describe('NPCs that are creatures', () => {
  it('lists 23 ids, all of them NPCs of the docs', () => {
    expect(NPC_BEAST_IDS.length).toBe(23);
    const ids = new Set(npcs.map((n) => n.id));
    for (const id of NPC_BEAST_IDS) expect(ids.has(id), id).toBe(true);
  });
  it('every NPC without a people id is either a creature of the list or a person we name here', () => {
    const people = new Set(['AL19-4', 'AL20-4', 'AL26-3', 'AL28-4', 'NB09-1']);
    for (const n of npcs) if (!n.peopleId) expect(NPC_BEAST_IDS.includes(n.id) || people.has(n.id), n.id).toBe(true);
    for (const id of people) expect(npcBeast(id), id).toBeNull();
    expect(npcBeast('AZ01-1')).toBeNull();
  });
  it('is drawn at the size the description gives: a kraken is a background piece, a deep-sea beast fills XL, a slime is small', () => {
    expect(npcBeast('NR11-2')!.size).toBe('XXL');
    expect(npcBeast('NR04-3')!.size).toBe('XL');
    expect(npcBeast('SV18-1')!.size).toBe('L');
    for (const id of ['NR03-3', 'NR03-6', 'SV12-2', 'SV12-6', 'SV18-6', 'NB06-2']) expect(npcBeast(id)!.size, id).toBe('S');
    for (const id of ['MH04-2', 'SV09-3']) expect(npcBeast(id)!.size, id).toBe('M');
  });
  it('the mushroom child is a child with a cap (a person drawn by the beast painter), not the slime of SV18-6', () => {
    const child = npcBeast('SV18-4')!, bella = npcBeast('SV18-6')!;
    expect(child.kind === 'enemy' && child.plan).toBe('humanoid');
    expect(bella.kind === 'enemy' && bella.plan).toBe('amorphous');
    expect(solid(paintBeast(child, 'idle', 0))).toBeGreaterThan(40);
  });
  it('every one paints every pose in the frame of its class', () => {
    for (const id of NPC_BEAST_IDS) {
      const L = npcBeast(id)!;
      expect(L, id).toBeTruthy();
      const fr = FRAMES[L.size];
      for (const pose of BEAST_POSES)
        for (let i = 0; i < poseN(pose); i++) {
          const f = paintBeast(L, pose, i);
          expect([f.w, f.h], `${id} ${pose}${i}`).toEqual([fr.w, fr.h]);
          if (!(pose === 'die' && i === poseN('die') - 1)) expect(solid(f), `${id} ${pose}${i}`).toBeGreaterThan(14);
        }
    }
  });
  it('the slimes are slimes and the ghosts are see-through', () => {
    expect((npcBeast('NR03-3') as EnemyLook).plan).toBe('amorphous');
    const g = paintBeast(npcBeast('SH14-1')!, 'idle', 0);
    let a = 0, n = 0;
    for (let i = 3; i < g.data.length; i += 4) if (g.data[i] > 120) { a += g.data[i]; n++; }
    expect(a / n).toBeLessThan(200);
  });
});
