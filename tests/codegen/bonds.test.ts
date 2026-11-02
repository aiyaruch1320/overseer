import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BondsFile, StoryTemplate } from '../../src/core/data/types-bonds';
import type { ItemsFile } from '../../src/core/data/types-items';
import type { NpcsGen } from '../../src/core/data/types-npcs';
import type { StorylinesData } from '../../src/core/data/types-storylines';
import type { GenFile } from '../../src/core/types';
import bonds from '../../scripts/codegen/groups/bonds';
import { genDir, readDoc } from '../../scripts/codegen/lib/table';

const read = <T>(name: string) => JSON.parse(readFileSync(`data/gen/${name}.json`, 'utf8')) as T;
const file = read<BondsFile>('bonds');
const D = file.items;
const items = read<ItemsFile>('items').items;
const npcs = read<NpcsGen>('npcs').items.npcs;
const story = read<GenFile<StorylinesData>>('storylines').items;
const nodeIds = new Set(story.nodes.map((n) => n.id));
const templates: StoryTemplate[] = [...D.arcs.templates, ...D.family.templates];
const doc = (f: string) => readDoc(`docs/systems/bonds/${f}`);

describe('bonds generator: counts the docs state', () => {
  it('9 lines, 5 levels, 24 moods in a 9 x 24 table, 12 FT, 8 KN, 10 pairs of 20 halves, 55 successors', () => {
    expect(D.ties.lines).toHaveLength(9);
    expect(D.ties.levels).toHaveLength(5);
    expect(D.feelings.feelings).toHaveLength(24);
    expect(Object.keys(D.feelings.matrix)).toHaveLength(24);
    expect(D.counts.matrixCells).toBe(24 * 9);
    expect(D.arcs.templates.map((t) => t.id)).toEqual(Array.from({ length: 12 }, (_, i) => `FT-${String(i + 1).padStart(2, '0')}`));
    expect(D.family.templates.map((t) => t.id)).toEqual(Array.from({ length: 8 }, (_, i) => `KN-${String(i + 1).padStart(2, '0')}`));
    expect(D.paired.pairs.map((p) => p.id)).toEqual(Array.from({ length: 10 }, (_, i) => `PR-${String(i + 1).padStart(2, '0')}`));
    expect(D.paired.halves).toHaveLength(20);
    expect(D.successors.list).toHaveLength(55);
    expect(D.formation.candidates).toHaveLength(10);
  });
  it('agrees with the summary table of the folder README', () => {
    const n = (k: string) => D.summary.find((r) => r.key.startsWith(k))!.nums;
    expect(n('สายสัมพันธ์')[0]).toBe(D.ties.lines.length);
    expect(n('ระดับความผูกพัน')[0]).toBe(D.ties.levels.length);
    expect(n('อารมณ์ในตาราง')[0]).toBe(D.feelings.feelings.length);
    expect(n('แม่แบบเรื่องของพวกพ้อง')[0]).toBe(D.arcs.templates.length);
    expect(n('แม่แบบญาติ')[0]).toBe(D.family.templates.length);
    expect(n('ไอเทมคู่')).toEqual([10, 20]);
    expect(n('โหนดเส้นเรื่อง')[0]).toBe(D.arcs.nodes.bn.length + D.arcs.nodes.kn.length);
    expect(D.arcs.nodes.bn).toHaveLength(8);
    expect(D.arcs.nodes.kn).toHaveLength(5);
    expect(n('พวกพ้องตัวหลักที่เขียนมือ')[0]).toBe(D.successors.list.length);
  });
  it('keeps every table of the folder', () => {
    expect(D.raw.length).toBe(D.counts.tables);
    expect(D.raw.length).toBe(49);
    expect(D.raw.find((t) => t.header[0] === 'รหัสผู้สืบ')!.rows).toHaveLength(55);
  });
});

describe('bonds generator: levels, lines and the B rules', () => {
  it('levels cover B 0 to 100 without a gap', () => {
    const L = D.ties.levels;
    expect(L[0].min).toBe(0);
    expect(L[4].max).toBe(100);
    for (let i = 1; i < L.length; i++) expect(L[i].min).toBe(L[i - 1].max + 1);
    expect(L.map((l) => l.name)).toEqual(['รู้จัก', 'คุ้นเคย', 'สนิท', 'ไว้ใจ', 'ชั่วชีวิต']);
  });
  it('line names are the words the mood markers and the matrix use', () => {
    const names = D.ties.lines.map((l) => l.name);
    expect(names).toEqual(['สหาย', 'คู่หู', 'คนรัก', 'ครู', 'ศิษย์', 'ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์', 'พี่น้อง', 'คู่แข่ง']);
    for (const row of Object.values(D.feelings.matrix)) expect(Object.keys(row)).toEqual(names);
  });
  it('caps, party and axes', () => {
    expect(D.ties.caps).toMatchObject({ close: 5, loose: 10 });
    expect(D.ties.party).toMatchObject({ maxParty: 4, bonusCapPct: 9, damageCutCapPct: 15, legendMinLevel: 3, legendCount: 3 });
    expect(D.ties.npcAxes).toMatchObject({ startBPerTrust: 5, gratitudeAcceptBonus: 10, grudgeBars: 3, betrayB: -30, redeemStartB: 30 });
    expect(D.ties.bChanges.find((b) => b.id === 'silentFar')).toMatchObject({ delta: -2, perYear: true, silentYears: 3, scope: 'otherContinent' });
    expect(D.ties.heirOpenThreadCap).toBe(3);
  });
  it('effects of the lines at level 3 to 5 for friend, partner (trade, battle) and lover', () => {
    const e = (line: string, variant?: string) => D.ties.lineEffects.find((x) => x.line === line && x.variant === variant)!;
    expect([e('สหาย').lv3.pcts[0], e('สหาย').lv4.pcts[0], e('สหาย').lv5.pcts[0]]).toEqual([20, 35, 50]);
    expect([e('คู่หู', 'การค้า').lv3.pcts[0], e('คู่หู', 'การค้า').lv4.pcts[0], e('คู่หู', 'การค้า').lv5.pcts[0]]).toEqual([3, 5, 8]);
    expect(e('คู่หู', 'การศึก').lv3.pcts).toEqual([3, 5]);
    expect([e('คนรัก').lv3.pcts[0], e('คนรัก').lv4.pcts[0], e('คนรัก').lv5.pcts[0]]).toEqual([30, 40, 50]);
  });
  it('line changes: a rival can become a friend at level 3, a friend a lover at level 3, lovers soulmates at level 4', () => {
    const t = (from: string, to: string) => D.ties.transitions.find((x) => x.fromLines.includes(from) && x.toLines.includes(to))!;
    expect(t('คู่แข่ง', 'สหาย').minLevel).toBe(3);
    expect(t('สหาย', 'คนรัก').minLevel).toBe(3);
    expect(t('คนรัก', 'คนรัก').minLevel).toBe(4);
    expect(t('สหาย', 'คู่หู').togetherYears).toBe(1);
    expect(D.ties.transitions.filter((x) => x.toNemesis)).toHaveLength(1);
    expect(D.ties.endings.map((e) => e.id)).toEqual(['death', 'fade', 'split', 'betray', 'goodEnd']);
    expect(D.ties.endings[2].setB).toBe(0);
    expect(D.ties.endings[3].deltaB).toBe(-30);
  });
});

describe('bonds generator: moods', () => {
  const M = D.feelings.matrix;
  it('the bans of section 3 agree with the table of section 2', () => {
    for (const ban of D.feelings.bans) {
      for (const mood of ban.moods) {
        for (const line of ban.forbidden) expect(M[mood][line], `${mood} ${line}`).toBeNull();
        for (const line of ban.allowed) expect(M[mood][line], `${mood} ${line}`).not.toBeNull();
      }
    }
  });
  it('jealousy and love belong to lovers only, tenderness to the younger', () => {
    const only = (mood: string) => Object.entries(M[mood]).filter(([, v]) => v !== null).map(([k]) => k);
    expect(only('หึง')).toEqual(['คนรัก']);
    expect(only('รัก')).toEqual(['คนรัก']);
    expect(only('เอ็นดู')).toEqual(['ศิษย์', 'ญาติรุ่นเยาว์', 'พี่น้อง']);
    expect(M['อิจฉา']['คนรัก']).toBe(4);
  });
  it('every marker of the FT and KN templates is allowed by the table, at or above its minimum level', () => {
    for (const t of templates) {
      expect(t.moods.length, t.id).toBe(3);
      for (const m of t.moods) {
        const min = D.feelings.matrix[m.mood]?.[m.line];
        expect(min, `${t.id} {${m.line}:${m.mood}@${m.level}}`).toBeTypeOf('number');
        expect(m.level, `${t.id} {${m.line}:${m.mood}@${m.level}}`).toBeGreaterThanOrEqual(min as number);
      }
    }
  });
  it('every mood has a heart effect: +1, 0, -1 or -2', () => {
    expect(Object.keys(D.feelings.heartByMood).sort()).toEqual(D.feelings.feelings.map((f) => f.name).sort());
    expect(D.feelings.heartByMood).toMatchObject({ ยินดี: 1, ห่วง: 0, น้อยใจ: -1, โกรธ: -2, แค้น: -2 });
    expect(D.feelings.heart.find((h) => h.moods.includes('แค้น'))!.bloodFeud).toBe(true);
    expect(D.feelings.limits).toEqual({ moodsAtOnce: 2, perLinePerYear: 2 });
  });
  it('the tone examples use allowed moods', () => {
    expect(D.feelings.tone).toHaveLength(6);
    expect(D.feelings.tone.every((t) => t.allowed)).toBe(true);
  });
});

describe('bonds generator: formation', () => {
  it('the invitation formula and its refusals', () => {
    const c = D.formation.inviteChance;
    expect(c).toMatchObject({ base: 15, perB: 0.7, min: 5, max: 95 });
    expect(c.compat.map((x) => x.delta)).toEqual([15, 10, 10]);
    expect(c.burden.map((x) => x.delta)).toEqual([-25, -15, -20, -15]);
    expect(D.formation.refusals.map((r) => r.chance)).toEqual([0.5, 0.3, 0.2]);
    expect(D.formation.refusals[2].deltaB).toBe(-5);
    expect(D.formation.refusals[1].opensGate).toBe(true);
    expect(D.formation.invites.find((i) => i.id === 'travel')).toMatchObject({ minLevel: 3, partyMax: 4 });
    expect(D.formation.invites.find((i) => i.id === 'reconcile')!.minLevel).toBeNull();
  });
  it('the weights of the pair stories add up to 100, so do the weights after a death', () => {
    expect(D.formation.pairStories.map((p) => p.line)).toEqual(['สหาย', 'คู่แข่ง', 'คนรัก']);
    for (const p of D.formation.pairStories) {
      expect(p.choices.reduce((a, c) => a + c.weight, 0), p.line).toBe(100);
      expect(p.deathWeights.reduce((a, c) => a + c, 0), p.line).toBe(100);
    }
    expect(D.formation.among).toMatchObject({ minLevel: 2, chancePerYear: 0.1, maxOpenPairs: 2, storyYears: [2, 6], sidePenaltyB: -5, lineWeights: { สหาย: 50, คู่แข่ง: 25, คนรัก: 25 } });
  });
  it('the bond candidates from a ransom use the chances of the bondage file', () => {
    const redeem = D.formation.candidates.find((c) => c.id === 'redeem')!;
    const b = read<{ items: { allyChance: { redeemOrFree: number; helper: number }; roleRules: { redeemer: { allyChance: number } } } }>('bondage').items;
    expect(redeem.chances).toEqual([b.allyChance.redeemOrFree, b.allyChance.helper]);
    expect(redeem).toMatchObject({ startLevel: 2, startB: 30 });
    expect(D.formation.pairing.heldMaxLevel).toBe(3);
  });
  it('occupations lift the lines the doc names', () => {
    const adventurer = D.formation.occupations[0];
    expect(adventurer.lines).toEqual([{ line: 'คู่หู', mul: 2, note: 'ร่วมทาง' }, { line: 'สหาย', mul: 1.5 }]);
    expect(D.formation.occupations).toHaveLength(7);
  });
});

describe('bonds generator: stories of friends and kin', () => {
  it('every template has three endings that add up to 100 and three stages', () => {
    for (const t of templates) {
      expect(t.endings.map((e) => e.key), t.id).toEqual(['a', 'b', 'c']);
      expect(t.endings.reduce((a, e) => a + e.weight, 0), t.id).toBe(100);
      expect(t.endings.map((e) => e.weight), t.id).toEqual([40, 35, 25]);
      expect(t.stage3.length, t.id).toBeGreaterThan(0);
    }
  });
  it('five steps open at levels 1 to 5', () => {
    expect(D.arcs.steps.map((s) => s.openLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(D.arcs.steps[4].orEnd).toBe(true);
    expect(D.arcs.endRole).toMatchObject({ weights: [40, 35, 25], heirRollPct: 60 });
  });
  it('FT-05 against the doc: hunted, may bring c_wanted when the character hid him', () => {
    const t = D.arcs.templates.find((x) => x.id === 'FT-05')!;
    expect(t).toMatchObject({ name: 'ถูกตามล่า', lines: ['สหาย', 'คู่หู', 'ครู', 'ศิษย์'], age: [20, 55] });
    expect(JSON.stringify(t.endings[1].effects)).toContain('c_wanted');
    expect(doc('04-friend-arcs.md')).toContain('| `FT-05` | ถูกตามล่า | สหาย คู่หู ครู ศิษย์ | 20–55 |');
    expect(D.arcs.templates.find((x) => x.id === 'FT-11')!.fitCond).toEqual({ k: 'place', kinds: ['war'] });
    expect(D.arcs.templates.find((x) => x.id === 'FT-01')!.endings[0].stats).toEqual([{ stat: 'บุญคุณ', delta: 2 }]);
    expect(D.arcs.templates.find((x) => x.id === 'FT-04')!.allLines).toBe(true);
  });
  it('race forms point at races that exist', () => {
    expect(D.arcs.raceForms).toHaveLength(5);
    expect(D.arcs.raceForms[0]).toMatchObject({ template: 'FT-04', races: ['mu'] });
  });
  it('the flagship numbers of 04 section 5 match the 55 hand-written stories', () => {
    const arcs = story.allyArcs;
    expect(arcs).toHaveLength(55);
    const count = (...l: string[]) => arcs.filter((a) => a.lines.some((x) => l.includes(x))).length;
    const actual = (k: string) => D.arcs.flagship.actual.find((r) => r.criterion.startsWith(k))!.nums[0];
    expect(count('สหาย')).toBe(actual('สหาย'));
    expect(count('คู่หู')).toBe(actual('คู่หู'));
    expect(count('คนรัก')).toBe(actual('คนรัก'));
    expect(count('ครู', 'ศิษย์')).toBe(actual('ครูและศิษย์'));
    expect(count('คู่แข่ง')).toBe(actual('คู่แข่ง'));
    expect(count('ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์')).toBe(actual('ญาติ'));
  });
});

describe('bonds generator: family', () => {
  it('relatives at birth: the sibling table adds up to 100', () => {
    const sib = D.family.kin.find((k) => k.relative === 'พี่น้อง')!;
    expect(sib.count.dist!.reduce((a, d) => a + d.pct, 0)).toBe(100);
    expect(sib.count.dist!.at(-1)).toEqual({ n: 4, pct: 5, orMore: true });
    expect(D.family.kin.find((k) => k.relative === 'พ่อ แม่')).toMatchObject({ startLevel: 4, startLevelFar: 3 });
    for (const k of D.family.kin.filter((x) => x.count.dist)) expect(k.count.dist!.reduce((a, d) => a + d.pct, 0), k.relative).toBe(100);
  });
  it('races without parents have their own kin, with real storyline nodes', () => {
    expect(D.family.origins).toHaveLength(5);
    for (const o of D.family.origins) for (const n of o.nodes) expect(nodeIds.has(n), n).toBe(true);
    expect(D.family.origins[0]).toMatchObject({ nodes: ['sl.b1'], elderLevel: 2, siblingLevel: 1, siblingRange: [0, 3] });
  });
  it('close kin and children', () => {
    expect(D.family.closeKin).toMatchObject({ ageMin: 5, ageMax: 12, minClassForTwo: 3, flagChance: 0.1, flagNpcs: ['AL17-2', 'MK12-1'] });
    expect(D.family.children.startLevel).toBe(3);
    expect(D.family.children.adopted).toMatchObject({ startLevel: 2, plusPerYear: 2 });
    expect(D.family.children.stages[0].effects).toEqual([{ k: 'statPct', stat: 'รายได้', pct: -5 }]);
    for (const s of D.family.children.stages) for (const m of s.moods) expect(D.feelings.matrix[m]['ญาติรุ่นเยาว์'], `${s.ageRaw} ${m}`).not.toBeNull();
  });
});

describe('bonds generator: paired items', () => {
  const halfIds = new Set(D.paired.halves.map((h) => h.id));
  it('each pair holds two halves that are rows of the half table, and every half is in one pair', () => {
    for (const p of D.paired.pairs) {
      expect(p.halves).toHaveLength(2);
      for (const h of p.halves) expect(halfIds.has(h), h).toBe(true);
      expect(p.halves[0].replace(/_a$/, '')).toBe(p.halves[1].replace(/_b$/, ''));
    }
    expect(new Set(D.paired.pairs.flatMap((p) => p.halves)).size).toBe(20);
  });
  it('the halves exist in items.json with the same tier', () => {
    for (const h of D.paired.halves) {
      const it = items.items.find((x) => x.id === h.id);
      expect(it, h.id).toBeDefined();
      expect(it!.tier, h.id).toBe(h.tier);
    }
  });
  it('rules: full effect at level 3 in one continent, sale costs B 15', () => {
    expect(D.paired.full).toEqual({ minLevel: 3, sameContinent: true, sellPenaltyB: -15 });
    expect(D.paired.pairs[6]).toMatchObject({ id: 'PR-07', races: ['wi'], fullPcts: [50] });
    expect(D.paired.pairs[2].templates).toEqual(['FT-04', 'FT-05', 'KN-06']);
    expect(D.paired.halves.find((h) => h.id === 'pr_mirror_shards_a')).toMatchObject({ tier: 'E', stats: { int: 2 } });
  });
});

describe('bonds generator: successors', () => {
  it('55 successors, one per prototype, with the code of the prototype and S', () => {
    const L = D.successors.list;
    expect(new Set(L.map((s) => s.code)).size).toBe(55);
    for (const s of L) expect(s.code).toBe(s.proto + 'S');
    expect(D.successors.levelDrop).toBe(1);
    expect(D.successors.loverDropped).toBe(true);
    expect(D.successors.rules).toHaveLength(10);
    expect(L.every((s) => !s.lines.includes('คนรัก'))).toBe(true);
  });
  it('prototypes are NPCs of the cast and the list matches the NPC generator row by row', () => {
    const cast = new Map(npcs.map((n) => [n.id, n]));
    const fromNpcs = npcs.filter((n) => n.succession.allySuccessor).map((n) => n.succession.allySuccessor!);
    expect(fromNpcs).toHaveLength(55);
    for (const s of D.successors.list) {
      expect(cast.has(s.proto), s.proto).toBe(true);
      const o = fromNpcs.find((x) => x.id === s.code)!;
      expect(o, s.code).toBeDefined();
      expect(o).toMatchObject({ name: s.name, age: s.age, of: s.proto });
    }
  });
  it('NB13-5S against the doc', () => {
    const s = D.successors.list.find((x) => x.code === 'NB13-5S')!;
    expect(s).toMatchObject({ protoName: 'คัวรา', name: 'ซูรา', age: 50, lines: ['สหาย'] });
    expect(doc('07-successors.md')).toContain('| NB13-5S | คัวรา (NB13-5) | **ซูรา** (ดาร์กเอลฟ์ครึ่งมนุษย์ · 50) |');
  });
});

describe('bonds generator: references into other files', () => {
  it('template codes used by storylines.json exist here', () => {
    const known = new Set([...templates.map((t) => t.id), ...D.paired.pairs.map((p) => p.id)]);
    const found = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (o.k === 'template' && typeof o.code === 'string') found.add(o.code);
        Object.values(o).forEach(walk);
      }
    };
    walk(story.nodes);
    expect(found.size).toBeGreaterThan(0);
    for (const c of found) expect(known.has(c), c).toBe(true);
  });
  it('lines named by the 55 stories are the nine lines', () => {
    const names = new Set(D.ties.lines.map((l) => l.name));
    for (const a of story.allyArcs) for (const l of a.lines) expect(names.has(l), `${a.npc} ${l}`).toBe(true);
  });
  it('mood markers of the 55 stories pass the mood table', () => {
    for (const a of story.allyArcs)
      for (const s of a.steps)
        for (const m of s.moods) {
          const min = D.feelings.matrix[m.mood]?.[m.line];
          expect(min, `${a.npc} step ${s.n} {${m.line}:${m.mood}@${m.level}}`).toBeTypeOf('number');
          expect(m.level, `${a.npc} step ${s.n} {${m.line}:${m.mood}@${m.level}}`).toBeGreaterThanOrEqual(min as number);
        }
  });
});

describe('bonds generator: deterministic', () => {
  it('runs again and leaves the same bytes', () => {
    const before = readFileSync(`${genDir}/bonds.json`, 'utf8');
    const rep = bonds();
    expect(rep).toMatchObject({ group: 'bonds', files: ['bonds.json'], strict: false });
    expect(readFileSync(`${genDir}/bonds.json`, 'utf8')).toBe(before);
  });
});
