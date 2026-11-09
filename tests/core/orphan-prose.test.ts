// An orphan wish life meets no story way that speaks of a living parent (storylines/README.md §6 rule 10): the ways and the node titles whose words put
// a father, mother or parent in the scene are closed by the `parents` condition (scripts/codegen/groups/storylines.ts). Real data, real lives, 30 seeds.
import { beforeAll, describe, expect, it } from 'vitest';
import { readWish } from '../../src/core/character';
import type { GameData } from '../../src/core/game';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const LIVING_PARENT = /ช่วยแม่ปิด|ตามพ่อ(?!แม่)|พ่อไป|พ่อแม่ทั้งสอง|พ่อแม่ถูกจับ|พ่อแม่พา|^พ่อหรือแม่(?!ที่)|สงบอยู่กับพ่อแม่/;

function nodesOf(text: string, seed: number) {
  const r = readWish(data, { text, mode: null, picks: {} })!;
  const s = createSession(data, { seed, ...(r.ask.race ? { race: r.ask.race } : {}), ...(r.ask.country ? { country: r.ask.country } : {}), wish: r.sheet });
  startLife(s);
  runToDeath(s.game);
  return (s.game.state.log as { sys: string; kind: string; data: Record<string, unknown> }[]).filter((e) => e.sys === 'story' && e.kind === 'node');
}

describe('an orphan life', () => {
  it('shows no parent-living prose in 30 seeds, and the same words still show in a life with parents', () => {
    let orphanHits = 0;
    let withParents = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const n of nodesOf('อยากเป็นเด็กกำพร้า', seed)) if (LIVING_PARENT.test(String(n.data.label)) || LIVING_PARENT.test(String(n.data.title))) orphanHits++;
      if (seed <= 10) for (const n of nodesOf('อยากเป็นนักดาบ', seed)) if (LIVING_PARENT.test(String(n.data.label)) || LIVING_PARENT.test(String(n.data.title))) withParents++;
    }
    expect(orphanHits).toBe(0);
    expect(withParents).toBeGreaterThan(0);
  });
});
