import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClashesFile, CombatFile, EnemiesFile } from '../../src/core/data/types-combat';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { readDoc } from '../../scripts/codegen/lib/table';

const load = <T>(n: string): T => JSON.parse(readFileSync(`data/gen/${n}.json`, 'utf8'));
const C = load<CombatFile>('combat').items;
const E = load<EnemiesFile>('enemies').items;
const K = load<ClashesFile>('clashes').items;
const ids = idIndex();

describe('combat generator: counts the docs state', () => {
  it('200 enemies = 32 + 40 + 20 + 102 + 6, ids unique', () => {
    expect(E.items.length).toBe(200);
    expect(E.counts).toEqual({ total: 200, code: 32, world: 40, npcGeneric: 20, npcNamed: 102, boss: 6 });
    expect(new Set(E.items.map((e) => e.id)).size).toBe(200);
  });
  it('102 NPC clashes with the five openers', () => {
    expect(K.items.length).toBe(102);
    expect(K.openers.map((o) => o.code)).toEqual(['B', 'X', 'S', 'T', 'P']);
    expect(new Set(K.items.map((c) => c.id)).size).toBe(102);
    for (const c of K.items) {
      expect(c.open.code, c.id).toMatch(/^[BXSTP]$/);
      expect(c.outcomes.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('nine stances, a 14-kind matrix, ten sanity rules, five tiers', () => {
    expect(C.stances.map((s) => s.id)).toEqual(['melee', 'ranged', 'magic', 'guard', 'negotiate', 'calm_beast', 'evade', 'pray', 'flee']);
    expect(Object.keys(C.matrix.physical).length).toBe(14);
    expect(Object.keys(C.matrix.physical.undead)).toEqual(['blade', 'blunt', 'pierce', 'ranged', 'poison', 'silver', 'iron']);
    expect(Object.keys(C.matrix.special.undead).length).toBe(9);
    expect(C.matrix.sanity.map((s) => s.id)).toEqual(Array.from({ length: 10 }, (_, i) => `CR-${String(i + 1).padStart(2, '0')}`));
    expect(C.tiers.map((t) => t.id)).toEqual(['grunt', 'normal', 'chief', 'boss', 'legend']);
    expect(C.encounters.worldFlags.length).toBe(22);
    expect(C.encounters.mass.length).toBe(6);
  });
  it('the roll numbers of 01-core §4', () => {
    expect(C.roll).toMatchObject({ weak: 4, veryWeak: 6, resist: -4, selfHandicap: -4, allyPerPerson: 2, allyCap: 4, aptBonus: { 1: 1, 2: 2, 3: 4 }, firstBeat: { advantage: 2, ambush: -2 } });
    expect(C.damage.dcDamage).toBe(2.4);
    expect(C.encounters).toMatchObject({ base: 0.012, luckFactor: 0.015, capPerYear: 4, capPerYearSoldier: 8, bossPerYear: 1 });
    expect(C.damage.wounds.map((w) => [w.from, w.to])).toEqual([[1, 60], [61, 80], [81, 90], [91, 96], [97, 100]]);
  });
  it('reward table per tier', () => {
    expect(C.rewards.byTier.find((t) => t.tier === 'บอส')).toMatchObject({ material: 1, weapon: 0.25, blessing: 0.15, curse: 0.12, skill: 0.12 });
  });
});

describe('combat generator: references across files', () => {
  it('named NPC enemies and clash NPCs exist in the NPC index', () => {
    for (const e of E.items.filter((x) => x.group === 'npc_named')) expect(ids.npcs.has(e.id), e.id).toBe(true);
    for (const c of K.items) expect(ids.npcs.has(c.npc), c.id).toBe(true);
  });
  it('every clash belongs to a named NPC with an enemy row', () => {
    const named = new Set(E.items.filter((e) => e.group === 'npc_named').map((e) => e.id));
    for (const c of K.items) expect(named.has(c.npc), c.id).toBe(true);
  });
  it('world-flag enemy lists name real enemies', () => {
    const all = new Set(E.items.map((e) => e.id));
    for (const f of C.encounters.worldFlags) for (const id of f.enemies) expect(all.has(id) || ids.kind(id) !== 'unknown', `${f.flag} ${id}`).toBe(true);
  });
  it('weak and resist hold only attack tags of the weakness matrix; sentences are weakText or negotiate (M2)', () => {
    const tags = new Set(Object.values(C.matrix.physical).concat(Object.values(C.matrix.element), Object.values(C.matrix.special)).flatMap((v) => Object.keys(v)));
    tags.add('sun');
    tags.add('physical');
    for (const e of E.items) {
      for (const r of [...e.weak, ...e.resist]) expect(tags.has(r.tag) || r.tag.startsWith('#'), `${e.id} ${r.name}`).toBe(true);
      for (const r of e.weak) expect('★▲').toContain(r.mark);
      for (const r of e.resist) expect('▼✕').toContain(r.mark);
      for (const r of [...e.weak, ...e.resist]) expect(r.tag, `${e.id} sentence in a tag`).not.toMatch(/[฀-๿]{6,}/);
    }
  });
  it('enemies in 05-rewards gift table are known kinds', () => {
    expect(C.rewards.gifts.length).toBe(13);
  });
});

describe('combat generator: two rows against the docs', () => {
  it('wolf (code monster) and MH02-1 (named NPC)', () => {
    const w = E.items.find((e) => e.id === 'wolf')!;
    expect(w).toMatchObject({ name: 'หมาป่าเงา', tier: 'ปกติ', dc: 10, group: 'code' });
    expect(readDoc('docs/systems/combat/03-enemies.md')).toContain('| wolf | หมาป่าเงา | beast ฝูง | ปกติ | 10 |');
    const m = E.items.find((e) => e.id === 'MH02-1')!;
    expect(m).toMatchObject({ name: 'ดราซาร์โมธ จอมมาร', tier: 'บอส', wounds: 5, dc: 22, group: 'npc_named' });
    expect(m.weak).toEqual([{ tag: 'holy', name: 'ศักดิ์สิทธิ์', mark: '★' }]);
    expect(readDoc('docs/systems/combat/03-enemies.md')).toContain('| MH02-1 | ดราซาร์โมธ จอมมาร | บอส 5 | 22 | ศักดิ์สิทธิ์ ★ |');
    const c = K.items.find((x) => x.id === 'NF-MH02-1')!;
    expect(c.name).toBe('ดราซาร์โมธ จอมมาร');
    expect(c.continent).toBe('MH');
  });
});

// ---------- review M0-b fixes: H5 H6 M2 ----------
type Eff = { k: string; [key: string]: unknown };
const outcome = (clash: string, start: string) => {
  const c = K.items.find((x) => x.id === clash)!;
  const o = c.outcomes.find((x) => x.outcome.startsWith(start));
  if (!o) throw new Error(`no outcome ${clash} ${start}`);
  return o;
};
const PATH_KEY: Record<string, string> = { ก: 'a', ข: 'b', ค: 'c' };
const paths = (o: { effects: unknown[] }) =>
  (o.effects as Eff[])
    .filter((e) => e.k === 'npcPath')
    .map((e) => `${e.path}:${e.op}${e.n !== undefined ? ':' + e.n : ''}${e.unit ? ':' + e.unit : ''}`);

describe('clash outcomes: denied effects (H5)', () => {
  it('"ไม่ทอยบาดแผลถาวร" and "ไม่มีบาดแผลถาวร" give no wound', () => {
    for (const id of ['NF-AZ02-1', 'NF-MH07-3', 'NF-AL18-1']) {
      const lose = K.items.find((c) => c.id === id)!.outcomes.find((o) => o.kind === 'lose')!;
      expect(lose.text, id).toMatch(/ไม่(ทอย|มี)บาดแผลถาวร/);
      expect(
        lose.effects.some((e) => e.k === 'wound'),
        id,
      ).toBe(false);
    }
  });
  it('no outcome that denies a permanent wound lists one, and no other effect word is denied in the docs', () => {
    let seen = 0;
    for (const c of K.items)
      for (const o of c.outcomes) {
        if (/ไม่(?:ทอย|มี|เสีย)?\s*บาดแผลถาวร/.test(o.text)) {
          seen++;
          expect(
            o.effects.some((e) => e.k === 'wound'),
            c.id,
          ).toBe(false);
        }
        expect(o.text, `${c.id}: a denied number`).not.toMatch(/ไม่(?:มี|ได้|เสีย|ทอย)?\s*(?:ไว้ใจ|บุญคุณ|แค้น|ความรู้จัก|ชื่อเสียง)\s*[+\-−]\d/);
      }
    expect(seen).toBe(3);
  });
});

describe('clash outcomes: results on the NPC lines are npcPath (H6)', () => {
  it('the exact cases the review named', () => {
    expect(paths(outcome('NF-AZ02-1', 'ชนะ (เขายอมแพ้)'))).toEqual(['a:force']);
    expect(paths(outcome('NF-AZ02-1', 'เจรจา'))).toEqual(['b:force']);
    expect(paths(outcome('NF-MH11-2', 'ชนะ (ไว้ชีวิต)'))).toEqual(['a:weight:10:add']);
    expect(paths(outcome('NF-AZ10-3', 'ชนะ (ล้ม)'))).toEqual(['a:cut']);
    expect(paths(outcome('NF-AZ10-3', 'ชนะ (ไว้ชีวิต)'))).toEqual(['a:weight:2:mul']);
    expect(paths(outcome('NF-MH03-1', 'ชนะ (ล้ม)'))).toEqual(['a:cut', 'b:cut']);
    expect(paths(outcome('NF-MH12-1', 'เจรจา'))).toEqual(['a:force', 'c:force']);
    expect(paths(outcome('NF-KD06-2', 'เสมอ'))).toEqual(['a:delay:0.25:year']);
    expect(paths(outcome('NF-MH03-1', 'ชนะ (ไว้ชีวิต)'))).toEqual(['a:delay:10:year']);
    expect(paths(outcome('NF-AZ01-2', 'ชนะ (ไว้ชีวิต)'))).toEqual(['c:weight:2:mul']);
    expect(paths(outcome('NF-AZ04-1', 'แพ้'))).toEqual([]);
  });
  it('the NPC of the clash owns every path result', () => {
    for (const c of K.items) for (const o of c.outcomes) for (const e of (o.effects as Eff[]).filter((x) => x.k === 'npcPath')) expect(e.npc, c.id).toBe(c.npc);
  });
  it('a weight that names a path never becomes a bare "น้ำหนัก" stat', () => {
    for (const c of K.items)
      for (const o of c.outcomes) {
        expect(
          (o.effects as Eff[]).filter((e) => (e.k === 'stat' || e.k === 'statMul') && e.stat === 'น้ำหนัก'),
          `${c.id} ${o.outcome}`,
        ).toEqual([]);
      }
  });
  it('every "เส้น X) บังคับเกิด|ถูกตัด" in the docs has its npcPath', () => {
    for (const c of K.items)
      for (const o of c.outcomes) {
        const want: string[] = [];
        const t = o.text.replace(/เส้นเปลี่ยนเป็น\s*([กขค])\)/g, (_, l: string) => {
          want.push(`${PATH_KEY[l]}:force`);
          return ' ';
        });
        for (const m of t.matchAll(/เส้น\s*((?:[กขค]\)\s*(?:และ|หรือ)?\s*)+)\s*(บังคับเกิด|ถูกตัด)/g)) {
          for (const l of m[1].matchAll(/([กขค])\)/g)) want.push(`${PATH_KEY[l[1]]}:${m[2] === 'บังคับเกิด' ? 'force' : 'cut'}`);
        }
        const got = paths(o);
        for (const w of want) expect(got, `${c.id} ${o.outcome}`).toContain(w);
      }
  });
  it('230+ path results over the 482 outcomes, all four kinds', () => {
    const all = K.items.flatMap((c) => c.outcomes.flatMap((o) => (o.effects as Eff[]).filter((e) => e.k === 'npcPath')));
    expect(all.length).toBeGreaterThanOrEqual(230);
    expect(new Set(all.map((e) => e.op))).toEqual(new Set(['force', 'cut', 'delay', 'weight']));
    expect(K.items.flatMap((c) => c.outcomes).length).toBe(482);
  });
  it('event weights keep their code: "`HP-03` น้ำหนัก +10" · "น้ำหนัก `BIO-05` เพิ่ม ×2"', () => {
    expect(outcome('NF-AZ04-1', 'เจรจา').effects).toContainEqual({ k: 'eventWeight', id: 'HP-03', delta: 10 });
    expect(outcome('NF-NB02-1', 'ชนะ (ล้ม)').effects).toContainEqual({ k: 'eventWeight', id: 'BIO-05', delta: 0, mul: 2 });
    expect(outcome('NF-MH03-1', 'เจรจา').effects).not.toContainEqual(expect.objectContaining({ k: 'eventWeight', id: 'MH-06' }));
  });
});

describe('enemies: weak tags apart from sentences (M2)', () => {
  const e = (id: string) => E.items.find((x) => x.id === id)!;
  it('a sentence with a mark is weakText, not a tag', () => {
    expect(e('NR05-2').weak).toEqual([]);
    expect(e('NR05-2').weakText).toEqual([{ text: 'ทองสาปทำให้เขาลังเล', mark: '▲' }]);
    expect(e('NR05-2').negotiate).toEqual([{ text: 'เจรจาเมื่อตัวละครทำลายทองสาป', mark: '▲' }]);
    expect(e('MH05-2').weakText[0].text).toBe('รูนที่เปิดตกลงมาเป็นของตัวเขาเอง');
  });
  it('MK09-1 keeps both of its weaknesses', () => {
    expect(e('MK09-1').weakText.map((w) => w.text)).toEqual(['ฝันของเขาคือเมืองลอยฟ้า', 'เรือเหาะธงที่ถูกตัดเสียเปรียบ']);
    expect(readDoc('docs/systems/combat/03-enemies.md')).toContain('ฝันของเขาคือเมืองลอยฟ้า ▲ · เรือเหาะธงที่ถูกตัดเสียเปรียบ');
  });
  it('tags next to sentences stay tags; ✕ and ▼ are resists even in the weak column', () => {
    expect(e('MK06-4').weak.map((r) => r.tag)).toEqual(['lightning']);
    expect(e('MK06-4').weakText.map((w) => w.text)).toEqual(['คำถามที่เขาตอบไม่ได้']);
    expect(e('KD08-1').weak.map((r) => r.tag)).toEqual(['water']);
    expect(e('KD08-1').resist.map((r) => r.tag)).toEqual(['fire']);
    expect(e('NB02-1').weak.map((r) => r.tag)).toEqual(['light', 'sun']);
  });
  it('a sentence with a space stays whole (AZ02-4) and a table tag keeps its note', () => {
    expect(e('AZ02-4').weakText[0].text).toBe('ถูกซื้อไม่ได้ จึงเสียเปรียบเมื่อถูกขอให้ลำเอียง');
    expect(e('primordial_engine').weak).toEqual([{ tag: 'rune', name: 'รูน', mark: '★', note: 'รหัสปฐม' }]);
  });
  it('values the docs state keep their tags', () => {
    expect(e('MH02-1').weak).toEqual([{ tag: 'holy', name: 'ศักดิ์สิทธิ์', mark: '★' }]);
    expect(e('lich_king').weak.map((r) => `${r.tag}${r.mark}`)).toEqual(['light★', 'holy★']);
    expect(e('ghost_legion').resist.map((r) => r.tag)).toEqual(['physical']);
    expect(E.items.filter((x) => x.group === 'npc_named').length).toBe(102);
  });
});
