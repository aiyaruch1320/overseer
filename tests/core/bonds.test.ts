// The bond system (docs/systems/bonds/): the table of 24 moods by 9 lines, the levels of B, the caps, the invitations, the stories of the ties,
// the family, the pairs of items, the written allies and their successors, and the rules the story and the god acts call. The data is data/gen/.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, runToDeath } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, sortSystems, type Ctx, type GameData, type System } from '../../src/core/game';
import { apply, test as testCond } from '../../src/core/rules';
import { clone } from '../../src/core/save';
import { holdsKind } from '../../src/core/god/acts/prayers';
import { slotsOf } from '../../src/core/npc';
import {
  addChild,
  addTie,
  bondsIndex,
  bondsSystem,
  changeB,
  closeTies,
  endTie,
  endingKind,
  extOf,
  fitMood,
  grantPair,
  inviteChance,
  invite,
  joinParty,
  levelOf,
  loverEligible,
  moodsOf,
  partyEffects,
  showMood,
  tiesOf,
} from '../../src/core/bonds';
import { arcsYear, plain } from '../../src/core/bonds/arcs';
import { birthKin } from '../../src/core/bonds/family';
import { rosterYear } from '../../src/core/bonds/sources';
import { caps, contact, lifeYear } from '../../src/core/bonds/year';
import { bondageSystem } from '../../src/core/bondage';
import type { Tie } from '../../src/core/bonds';
import type { BondsData } from '../../src/core/data/types-bonds';
import type { AllyArc } from '../../src/core/data/types-storylines';
import type { LifeState } from '../../src/core/types';

let data: GameData;
let bd: BondsData;
beforeAll(() => {
  data = loadAll();
  bd = data.bonds.items as BondsData;
});

/** A world at year 120 with a human born in it, and the bond and bondage systems in the loop. */
function mk(seed = 1, o: { race?: string; country?: string } = {}) {
  const s = createSession(data, { seed, race: o.race ?? 'hu', country: o.country, startYear: 120 });
  const list = s.game.systems as System[];
  for (const x of [bondsSystem, bondageSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
  list.splice(0, list.length, ...sortSystems(list));
  const life = startLife(s);
  return { s, g: s.game, ctx: s.game.ctx as Ctx, life, e: extOf(life) };
}

/** Plain ties for the unit tests: a friend of the character, not light, at a level. */
function friend(ctx: Ctx, life: LifeState, line = 'สหาย', level = 3): Tie {
  const t = addTie(ctx, life, { line, level, from: 'test', quiet: true, country: life.country, gap: 0, race: 'same' });
  t.rapport = false;
  t.family = false;
  return t;
}

describe('bonds: the data the system reads', () => {
  it('holds the counts the folder says: 9 lines, 5 levels, 24 moods, 216 cells, 12 + 8 templates, 10 pairs, 55 successors and 55 written allies', () => {
    expect(bd.ties.lines).toHaveLength(9);
    expect(bd.ties.levels).toHaveLength(5);
    expect(bd.feelings.feelings).toHaveLength(24);
    expect(Object.values(bd.feelings.matrix).reduce((n, row) => n + Object.keys(row).length, 0)).toBe(216);
    expect(bd.arcs.templates).toHaveLength(12);
    expect(bd.family.templates).toHaveLength(8);
    expect(bd.paired.pairs).toHaveLength(10);
    expect(bd.paired.halves).toHaveLength(20);
    expect(bd.successors.list).toHaveLength(55);
    const arcs = (data.storylines.items as { allyArcs: AllyArc[] }).allyArcs;
    expect(arcs).toHaveLength(55);
  });

  it('every template and written story has three endings of 100 in all, and every written ally has a written successor without the lover line', () => {
    for (const t of [...bd.arcs.templates, ...bd.family.templates]) expect(t.endings.reduce((n, e) => n + e.weight, 0)).toBe(100);
    const arcs = (data.storylines.items as { allyArcs: AllyArc[] }).allyArcs;
    for (const a of arcs) {
      expect(a.endings.reduce((n, e) => n + e.weight, 0)).toBe(100);
      expect(a.steps.length).toBeGreaterThanOrEqual(4);
      expect(bd.successors.list.some((s) => s.proto === a.npc)).toBe(true);
    }
    for (const s of bd.successors.list) expect(s.lines).not.toContain('คนรัก');
    expect(bd.successors.levelDrop).toBe(1);
  });
});

describe('bonds: the table of moods (02-feelings.md §2), 24 moods by 9 lines', () => {
  it('shows a mood on a line at a level exactly as the table says, for all 216 cells and the 5 levels', () => {
    const { ctx, life, e } = mk(2);
    const ix = bondsIndex(ctx);
    let cells = 0;
    for (const mood of ix.moods) {
      for (const line of ix.lines) {
        cells++;
        const floor = bd.feelings.matrix[mood][line];
        for (let lv = 1; lv <= 5; lv++) {
          const allowed = floor !== null && lv >= floor;
          expect(moodsOf(ctx, line, lv).includes(mood), `${mood} ${line} ${lv}`).toBe(allowed);
          const t = addTie(ctx, life, { line, level: lv, from: 'test', quiet: true, light: true });
          e.moodYear = { age: -1, perLine: {} };
          const got = showMood(ctx, life, t, mood, 'test');
          if (floor === null) {
            // the line never shows it: the mood the docs name instead, or none
            expect(got === null || moodsOf(ctx, line, lv).includes(got), `${mood} ${line} ${lv} -> ${got}`).toBe(true);
            expect(got).not.toBe(mood);
          } else if (lv >= floor) expect(got, `${mood} ${line} ${lv}`).toBe(mood);
          else expect(got, `${mood} ${line} ${lv}`).toBeNull();
        }
      }
    }
    expect(cells).toBe(216);
  });

  it('keeps the bans of §3: หึง and รัก only for lovers, หวงแหน not for friends, เอ็นดู only for the younger, and gives the substitute the docs name', () => {
    const { ctx } = mk(3);
    for (const line of bondsIndex(ctx).lines) {
      expect(moodsOf(ctx, line, 5).includes('หึง')).toBe(line === 'คนรัก');
      expect(moodsOf(ctx, line, 5).includes('รัก')).toBe(line === 'คนรัก');
      expect(moodsOf(ctx, line, 5).includes('เอ็นดู')).toBe(['ศิษย์', 'ญาติรุ่นเยาว์', 'พี่น้อง'].includes(line));
    }
    expect(fitMood(ctx, 'สหาย', 'หึง')).toBe('น้อยใจ');
    expect(fitMood(ctx, 'ศิษย์', 'รัก')).toBe('ไว้ใจ');
  });

  it('allows two moods at once for one person and two a year toward one line (§4 rules 2 and 3), and a held-back mood is written at level 0', () => {
    const { ctx, life, g } = mk(4);
    const e = extOf(life);
    life.hAge = 30;
    const t = friend(ctx, life, 'สหาย', 4);
    expect(showMood(ctx, life, t, 'ห่วง', 'a')).toBe('ห่วง');
    expect(showMood(ctx, life, t, 'ไว้ใจ', 'b')).toBe('ไว้ใจ');
    expect(showMood(ctx, life, t, 'ภูมิใจ', 'c')).toBeNull();
    const held = g.state.log.filter((x) => x.sys === 'bonds' && x.kind === 'mood-held');
    expect(held.at(-1)!.level).toBe(0);
    // another person on the same line: the year already holds two moods toward the line
    const u = friend(ctx, life, 'สหาย', 4);
    expect(showMood(ctx, life, u, 'ห่วง', 'd')).toBeNull();
    life.hAge = 31;
    expect(showMood(ctx, life, u, 'ห่วง', 'e')).toBe('ห่วง');
    expect(e.counts.moods).toBe(3);
  });
});

describe('bonds: the bond B and its levels (01-ties-and-levels.md §2)', () => {
  it('cuts the five levels at 0 20 40 60 80', () => {
    const { ctx } = mk(5);
    const lv = bondsIndex(ctx).levelOf;
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(lv)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('moves B by the causes of the table, holds it between 0 and 100, keeps a bound person at level 3 and knows him one more every +10', () => {
    const { ctx, life, g } = mk(6);
    const t = friend(ctx, life, 'สหาย', 2);
    expect(t.b).toBe(20);
    changeB(ctx, t, 3, 'meet');
    expect(t.b).toBe(23);
    changeB(ctx, t, -200, 'x');
    expect(t.b).toBe(0);
    changeB(ctx, t, 200, 'x');
    expect(t.b).toBe(100);
    const u = friend(ctx, life, 'สหาย', 2);
    u.bound = 'B2';
    changeB(ctx, u, 90, 'x');
    expect(u.b).toBe(59);
    expect(levelOf(ctx, u)).toBe(3);
    const k = friend(ctx, life, 'สหาย', 1);
    changeB(ctx, k, 10, 'x');
    expect(k.known).toBe(1);
    changeB(ctx, k, 25, 'x');
    expect(k.known).toBe(3);
    // a change of level has a line that says why (04 §4 rule 2)
    const lvl = g.state.log.filter((x) => x.sys === 'bonds' && x.kind === 'level' && x.id === k.id);
    expect(lvl.length).toBeGreaterThan(0);
    expect(typeof lvl[0].data.why).toBe('string');
  });

  it('a betrayal takes 30 and makes him bitter (+2 grudge); a split leaves 0; a death keeps the name and the pair becomes a keepsake', () => {
    const { ctx, life, e } = mk(7);
    const a = friend(ctx, life, 'สหาย', 4);
    const b0 = a.b;
    endTie(ctx, a, 'betray', 'x');
    expect(a.b).toBe(b0 - 30);
    expect(a.grudge).toBe(2);
    expect(a.state).toBe('ended');
    const s = friend(ctx, life, 'สหาย', 4);
    endTie(ctx, s, 'split', 'x');
    expect(s.b).toBe(0);
    const d = friend(ctx, life, 'สหาย', 4);
    expect(grantPair(ctx, life, d, 'PR-01')).toBe(true);
    endTie(ctx, d, 'death', 'x', { cause: 'old' });
    expect(d.died!.cause).toBe('old');
    expect(e.pairs.find((p) => p.tie === d.id)!.status).toBe('memorial');
  });

  it('silence costs 1 a year after 3 years in the same country and 2 a year on another continent (the road shut by war: no news at all)', () => {
    const { ctx, life, e } = mk(8);
    life.hAge = 30;
    const far = friend(ctx, life, 'สหาย', 4);
    far.country = life.country.startsWith('AL') ? 'KD-01' : 'AL-01';
    ctx.state.world.countryFlags[far.country] = ['war'];
    far.last = 30;
    const b0 = far.b;
    for (let i = 0; i < 8; i++) {
      life.hAge++;
      contact(ctx, life, e);
    }
    // 8 years apart, the first 3 free of loss, then -2 a year for 5 years
    expect(far.b).toBe(b0 - 10);
    delete ctx.state.world.countryFlags[far.country];
  });
});

describe('bonds: the caps of close and loose lines (§2)', () => {
  it('holds at most 5 close lines and 10 loose ones; the lowest and farthest fades, the partner never does', () => {
    const { ctx, life, e } = mk(9);
    life.hAge = 30;
    const partner = friend(ctx, life, 'คนรัก', 3);
    partner.b = 40;
    for (let i = 0; i < 7; i++) {
      const t = friend(ctx, life, 'สหาย', 3);
      t.b = 41 + i;
      t.last = 30 - i;
    }
    for (let i = 0; i < 12; i++) friend(ctx, life, 'สหาย', 1);
    caps(ctx, life, e);
    expect(closeTies(ctx, e).length).toBeLessThanOrEqual(5);
    expect(partner.state).toBe('alive');
    const loose = tiesOf(e).filter((t) => t.state === 'alive' && !t.light && levelOf(ctx, t) < 3);
    expect(loose.length).toBeLessThanOrEqual(10);
    expect(tiesOf(e).filter((t) => t.state === 'faded').length).toBeGreaterThan(0);
  });
});

describe('bonds: invitations (03-formation.md §3)', () => {
  it('answers with 15 + 0.7 B + fit - burden held between 5 and 95', () => {
    const { ctx, life } = mk(10);
    const t = friend(ctx, life, 'สหาย', 3);
    t.b = 50;
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35);
    t.rapport = true;
    t.gratitude = 1;
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35 + 10 + 10);
    t.arc = { code: 'FT-03', stage: 2, next: 99 };
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35 + 10 + 10 + 15);
    t.arc = { code: 'FT-03', stage: 1, next: 99 };
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35 + 10 + 10 + 15);
    t.arc = { code: 'FT-03', stage: 2, next: 99 };
    t.family = true;
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35 + 10 + 10 + 15 - 15);
    t.arc = { code: 'FT-03', stage: 3, next: 99 };
    expect(inviteChance(ctx, life, t)).toBeCloseTo(15 + 35 + 10 + 10 - 25 - 15);
    expect(inviteChance(ctx, life, t, { feared: true })).toBeCloseTo(15 + 35 + 10 + 10 - 25 - 15 - 15);
    t.gate = true; // he asked a favour first: the invite carries no burden
    expect(inviteChance(ctx, life, t, { feared: true })).toBeCloseTo(15 + 35 + 10 + 10);
    t.b = 100;
    t.arc = { code: 'FT-03', stage: 2, next: 99 };
    expect(inviteChance(ctx, life, t)).toBe(95);
    const low = friend(ctx, life, 'สหาย', 1);
    low.b = 0;
    low.family = true;
    expect(inviteChance(ctx, life, low)).toBe(5);
  });

  it('refuses plainly 50%, with a condition 30%, and hurtfully (B -5) 20%', () => {
    const { ctx, life } = mk(11);
    life.hAge = 30;
    const t = friend(ctx, life, 'สหาย', 1);
    const n: Record<string, number> = { plain: 0, condition: 0, hurt: 0 };
    let refused = 0;
    for (let i = 0; i < 3000; i++) {
      t.line = 'สหาย';
      t.state = 'alive';
      t.b = 5;
      t.gate = false;
      t.moods = [];
      const r = invite(ctx, life, t, 'mentor');
      if (!r.ok) {
        refused++;
        n[r.refusal!]++;
        if (r.refusal === 'hurt') expect(t.b).toBe(0);
      }
    }
    expect(refused).toBeGreaterThan(2000);
    expect(n.plain / refused).toBeGreaterThan(0.45);
    expect(n.plain / refused).toBeLessThan(0.55);
    expect(n.condition / refused).toBeGreaterThan(0.25);
    expect(n.condition / refused).toBeLessThan(0.35);
    expect(n.hurt / refused).toBeGreaterThan(0.15);
    expect(n.hurt / refused).toBeLessThan(0.25);
  });

  it('a party has at most 4; the partner line gives the roll and the damage cut by level, capped at +9% and 15%', () => {
    const { ctx, life, e } = mk(12);
    const ties: Tie[] = [];
    for (let i = 0; i < 6; i++) {
      const t = friend(ctx, life, 'คู่หู', 5);
      ties.push(t);
      t.b = 90;
    }
    const joined = ties.map((t) => joinParty(ctx, life, e, t));
    expect(joined.filter(Boolean)).toHaveLength(4);
    expect(e.party).toHaveLength(4);
    const fx = partyEffects(ctx);
    expect(fx.rollPct).toBe(9);
    expect(fx.cutPct).toBe(15);
    expect(fx.legend).toBe(true);
    // one partner at level 3 gives +3% and 5% (§3)
    e.party = [ties[0].id];
    ties[0].b = 45;
    expect(partyEffects(ctx)).toMatchObject({ rollPct: 3, cutPct: 5, legend: false });
  });

  it('a lover needs both adults, a gap of 20 years at most, no kin and no other lover (§4)', () => {
    const { ctx, life, e } = mk(13);
    life.hAge = 30;
    const t = friend(ctx, life, 'สหาย', 3);
    expect(bondsIndex(ctx).data.formation.pairing.loverMaxAgeGap).toBe(20);
    t.age0 = 30;
    t.t0 = ctx.state.clock.worldYear;
    expect(loverEligible(ctx, life, e, t)).toBe(true);
    t.age0 = 60;
    expect(loverEligible(ctx, life, e, t)).toBe(false);
    t.age0 = 30;
    t.kin = 'cousin';
    expect(loverEligible(ctx, life, e, t)).toBe(false);
    t.kin = undefined;
    const lover = friend(ctx, life, 'คนรัก', 3);
    lover.age0 = 30;
    expect(loverEligible(ctx, life, e, t)).toBe(false);
    life.hAge = 14;
    lover.state = 'ended';
    expect(loverEligible(ctx, life, e, t)).toBe(false);
  });
});

describe('bonds: pairs of items (06-paired-items.md)', () => {
  it('a pair is whole at level 3 on the same continent, a half alone elsewhere or below, and a keepsake after a death', () => {
    const { ctx, life, e } = mk(14);
    const t = friend(ctx, life, 'สหาย', 3);
    expect(grantPair(ctx, life, t, 'PR-01')).toBe(true);
    expect(life.items).toContain('pr_twin_whistle_a');
    expect(e.pairs[0].status).toBe('full');
    expect(grantPair(ctx, life, t, 'PR-01')).toBe(false); // not twice
    const far = friend(ctx, life, 'คู่หู', 3);
    far.country = life.country.startsWith('KD') ? 'AL-01' : 'KD-01';
    expect(grantPair(ctx, life, far, 'PR-02')).toBe(true);
    expect(e.pairs.find((p) => p.code === 'PR-02')!.status).toBe('single');
    const low = friend(ctx, life, 'สหาย', 2);
    expect(grantPair(ctx, life, low, 'PR-04')).toBe(true);
    expect(e.pairs.find((p) => p.code === 'PR-04')!.status).toBe('single');
    endTie(ctx, t, 'death', 'x');
    expect(e.pairs.find((p) => p.code === 'PR-01')!.status).toBe('memorial');
    expect(bd.paired.full).toMatchObject({ minLevel: 3, sameContinent: true, sellPenaltyB: -15 });
  });
});

describe('bonds: the family (05-family.md)', () => {
  it('is born with two parents at level 4 (3 when far) and brothers and sisters by the table 20 35 25 15 5', () => {
    const { ctx, life } = mk(15);
    let n = 0;
    const sib = [0, 0, 0, 0, 0];
    let levels4 = 0;
    for (let seed = 100; seed < 1100; seed++) {
      const g = new Game({ ...structuredClone(ctx.state), seed: seed >>> 0, rng: {}, log: [], logN: 0 }, data, []);
      const l = { ...structuredClone(life), ext: {} } as LifeState;
      l.cls = 'c3';
      g.state.life = l;
      birthKin(g.ctx, l);
      const ties = tiesOf(extOf(l));
      const parents = ties.filter((t) => t.kin === 'father' || t.kin === 'mother');
      expect(parents).toHaveLength(2);
      for (const p of parents) {
        expect([3, 4]).toContain(levelOf(g.ctx, p));
        if (levelOf(g.ctx, p) === 4) levels4++;
        expect(p.light).toBe(true);
      }
      sib[Math.min(4, ties.filter((t) => t.line === 'พี่น้อง' && t.kin !== 'cousin').length)]++;
      n++;
    }
    expect(levels4 / (2 * n)).toBeGreaterThan(0.8);
    expect(sib[0] / n).toBeGreaterThan(0.15);
    expect(sib[0] / n).toBeLessThan(0.25);
    expect(sib[1] / n).toBeGreaterThan(0.3);
    expect(sib[1] / n).toBeLessThan(0.4);
    expect(sib[2] / n).toBeGreaterThan(0.2);
    expect(sib[2] / n).toBeLessThan(0.3);
  });

  it('a child is the line of the younger relatives at level 3; the prayers for a lover and for a child are answered here', () => {
    const { ctx, life, e } = mk(16);
    life.hAge = 30;
    // before: nobody, so the prayer for a lover is held (god/acts/prayers.ts family())
    for (const t of tiesOf(e)) if (t.line === 'คนรัก') endTie(ctx, t, 'split', 'x');
    expect(holdsKind(ctx, 'love')).toBe(true);
    expect(holdsKind(ctx, 'heir')).toBe(false);
    apply(ctx, [{ k: 'bond', line: 'lover', level: 1 }], { sys: 'god', id: 'prayer' });
    expect(e.partner).toBeTruthy();
    const lover = e.ties[e.partner!];
    expect(lover.line).toBe('คนรัก');
    expect(lover.from).toBe('prayer');
    expect(holdsKind(ctx, 'love')).toBe(false);
    expect(holdsKind(ctx, 'heir')).toBe(true);
    apply(ctx, [{ k: 'bond', line: 'child' }], { sys: 'god', id: 'prayer' });
    expect(e.children).toHaveLength(1);
    const kid = e.ties[e.children[0]];
    expect(kid.line).toBe('ญาติรุ่นเยาว์');
    expect(levelOf(ctx, kid)).toBe(3);
    expect(holdsKind(ctx, 'heir')).toBe(false);
    expect(testCond(ctx, { k: 'bond', line: 'ญาติรุ่นเยาว์', level: 1 })).toBe(true);
    expect(testCond(ctx, { k: 'bond', line: 'child', level: 3 })).toBe(true);
    expect(testCond(ctx, { k: 'bond', line: 'ศิษย์', level: 1 })).toBe(false);
    // an adopted child binds faster (+2 a year, 05 §3)
    const adopted = addChild(ctx, life, { adopted: true, age: 6 });
    expect(adopted.b).toBe(20);
    expect(adopted.kin).toBe('adopted');
  });
});

describe('bonds: the rules the story calls (mood template bond, stats B บุญคุณ พวกพ้อง)', () => {
  it('opens a tie of the line, then raises it, changes its line, and turns the stat B on the tie the effects speak of', () => {
    const { ctx, life, e } = mk(17);
    life.hAge = 25;
    const src = { sys: 'story', id: 'bn.a3' };
    apply(ctx, [{ k: 'bond', line: 'คนรัก', level: 2 }], src);
    const lover = e.ties[e.focus!];
    expect(lover.line).toBe('คนรัก');
    expect(levelOf(ctx, lover)).toBe(2);
    apply(ctx, [{ k: 'bond', line: 'คนรัก', level: 3 }], src);
    expect(tiesOf(e).filter((t) => t.line === 'คนรัก' && t.state === 'alive')).toHaveLength(1);
    expect(levelOf(ctx, lover)).toBe(3);
    apply(ctx, [{ k: 'stat', stat: 'B', delta: 8 }, { k: 'stat', stat: 'บุญคุณ', delta: 3 }], src);
    expect(lover.b).toBe(48);
    expect(lover.gratitude).toBe(3);
    expect(e.favor).toBe(3);
    // the friend becomes a partner at work (bn.t1: เปิดสายคู่หู)
    const f = friend(ctx, life, 'สหาย', 2);
    e.focus = f.id;
    apply(ctx, [{ k: 'bond', line: 'คู่หู' }], { sys: 'story', id: 'bn.t1' });
    expect(f.line).toBe('คู่หู');
    expect(f.past).toEqual(['สหาย']);
    // comrades: พวกพ้อง +2
    const before = tiesOf(e).length;
    e.focus = null;
    apply(ctx, [{ k: 'stat', stat: 'พวกพ้อง', delta: 2 }], { sys: 'story', id: 'hu.b2' });
    expect(tiesOf(e).length).toBe(before + 2);
  });

  it('takes the moods of a node for the tie it is about, and of the best tie of the line when there is no focus', () => {
    const { ctx, life, g, e } = mk(18);
    life.hAge = 30;
    const f = friend(ctx, life, 'สหาย', 3);
    e.focus = f.id;
    apply(ctx, [{ k: 'mood', line: 'สหาย', mood: 'คิดถึง', level: 2 }], { sys: 'story', id: 'bn.t1' });
    expect(f.moods.map((m) => m.mood)).toEqual(['คิดถึง']);
    // nobody on the line: held back, nothing breaks
    e.focus = null;
    const before = g.state.log.length;
    apply(ctx, [{ k: 'mood', line: 'ครู', mood: 'เคารพ', level: 1 }], { sys: 'story', id: 'bn.x' });
    expect(g.state.log.slice(before).every((x) => x.level === 0)).toBe(true);
    // the first mood of kn.b1 settles on a relative who is not a parent and the later template speaks of him
    const uncle = addTie(ctx, life, { line: 'ญาติผู้ใหญ่', level: 2, from: 'kin', kin: 'uncle', light: true, quiet: true, gap: 25 });
    apply(ctx, [{ k: 'mood', line: 'ญาติผู้ใหญ่', mood: 'เคารพ', level: 1 }, { k: 'template', kind: 'KN', code: 'KN-01' }, { k: 'template', kind: 'KN', code: 'KN-04' }, { k: 'template', kind: 'KN', code: 'KN-07' }], { sys: 'story', id: 'kn.b1' });
    expect(e.focus).toBe(uncle.id);
    expect(uncle.arc?.code).toBe('KN-01');
    expect(uncle.light).toBe(false);
  });

  it('starts a story of the template range on the tie and gives a pair of items by the line it fits', () => {
    const { ctx, life, e } = mk(19);
    life.hAge = 30;
    const f = friend(ctx, life, 'สหาย', 3);
    e.focus = f.id;
    apply(ctx, [{ k: 'template', kind: 'FT', code: 'FT-01', to: 'FT-05' }], { sys: 'story', id: 'bn.a1' });
    expect(['FT-01', 'FT-02', 'FT-03', 'FT-04', 'FT-05']).toContain(f.arc!.code);
    apply(ctx, [{ k: 'template', kind: 'PR', code: 'PR-01', chance: 1 }], { sys: 'story', id: 'bn.b1' });
    expect(life.items).toContain('pr_twin_whistle_a');
    expect(e.pairs[0].tie).toBe(f.id);
  });
});

describe('bonds: the story of a tie in five stages (04-friend-arcs.md §2)', () => {
  it('walks from meeting to an ending, one step a year; the crisis is written at level 2 or as trouble, and the ending is one of a b c', () => {
    const { ctx, life, g, e } = mk(20);
    life.hAge = 25;
    const t = friend(ctx, life, 'สหาย', 2);
    t.arc = { code: 'FT-03', stage: 1, next: 25 };
    const mark = g.state.logN;
    for (let y = 0; y < 40 && !t.arc.end; y++) {
      life.hAge++;
      if (t.state === 'alive') t.b = Math.min(100, t.b + 8);
      arcsYear(ctx, life, e);
    }
    expect(t.arc.stage).toBe(5);
    expect(['a', 'b', 'c']).toContain(t.arc.end);
    const log = g.state.log.filter((x) => x.n >= mark && x.sys === 'bonds');
    const stages = log.filter((x) => x.kind === 'arc').map((x) => x.data.stage);
    expect(stages).toEqual(expect.arrayContaining([2, 3, 4]));
    const crisis = log.filter((x) => x.kind === 'crisis' || x.kind === 'trouble');
    expect(crisis).toHaveLength(1);
    expect(crisis[0].level).toBe(crisis[0].kind === 'crisis' ? 2 : 1);
    expect(log.filter((x) => x.kind === 'ending')).toHaveLength(1);
  });

  it('a stage that opens at a level waits for the bond and the story walks on alone after a while (the news only, no crisis card)', () => {
    const { ctx, life, g, e } = mk(21);
    life.hAge = 25;
    const t = friend(ctx, life, 'สหาย', 1);
    t.b = 0;
    t.arc = { code: 'FT-03', stage: 1, next: 25 };
    const mark = g.state.logN;
    for (let y = 0; y < 80 && t.arc.stage < 5 && !t.arc.end; y++) {
      life.hAge++;
      t.b = 0;
      arcsYear(ctx, life, e);
    }
    expect(t.arc.stage).toBe(5);
    expect(e.counts.crises).toBe(0);
    expect(g.state.log.filter((x) => x.n >= mark && x.kind === 'crisis')).toHaveLength(0);
    expect(g.state.log.filter((x) => x.n >= mark && x.kind === 'news').length).toBeGreaterThan(0);
  });

  it('a person another owner holds does not reach the fourth stage before he is free', () => {
    const { ctx, life, e } = mk(22);
    life.hAge = 25;
    const t = friend(ctx, life, 'สหาย', 3);
    t.bound = 'B2';
    t.arc = { code: 'FT-01', stage: 3, next: 25 };
    for (let y = 0; y < 12; y++) {
      life.hAge++;
      t.b = 59;
      arcsYear(ctx, life, e);
    }
    expect(t.arc.stage).toBe(3);
    t.bound = undefined;
    t.b = 70;
    life.hAge++;
    arcsYear(ctx, life, e);
    expect(t.arc.stage).toBe(4);
  });

  it('reads the ways of an ending from its words and strips the markers of the documents from a written step', () => {
    expect(endingKind('เขาตายเมื่อพายุไร้ทิศ')).toBe('dies');
    expect(endingKind('ลุงตายตอนตัวละครอยู่ไกล เรื่องค้างร้าน')).toBe('dies');
    expect(endingKind('หักหลังจริง สายเปลี่ยนเป็นศัตรูได้')).toBe('betrays');
    expect(endingKind('ความลับร้ายแรงจนสายแตก')).toBe('split');
    expect(endingKind('เขาไปแล้วไม่กลับ')).toBe('leaves');
    expect(endingKind('เขาใช้คืนครบ บุญคุณ +2')).toBe('stays');
    expect(plain('ตัวละครรู้สึก `{คู่หู:ชื่นชม@1}` ที่เธอจำราคาได้ [ดูที่นี่](../x.md)')).toBe('ตัวละครรู้สึก ที่เธอจำราคาได้ ดูที่นี่');
  });
});

describe('bonds: the written allies and their successors (28, 29, 07-successors.md)', () => {
  it('meets a written ally in the country where he lives, with his own name and story; the markers of the docs stay out of the log', () => {
    const { ctx, life, g, e } = mk(23);
    life.hAge = 30;
    const arcs = bondsIndex(ctx).arcs;
    const id = 'MH09-3'; // Zena the partner of trade, a written ally of the first ten
    const slot = slotsOf(g.state)[id];
    slot.status = 'alive';
    slot.alive = true;
    slot.gen = 1;
    slot.born = ctx.state.clock.worldYear - (slot.span * 30) / 75;
    life.country = 'MH-09';
    slot.place = 'MH-09';
    slot.rel['mc.ally'] = 1;
    rosterYear(ctx, life, e);
    const t = tiesOf(e).find((x) => x.npc === id)!;
    expect(t).toBeTruthy();
    expect(t.name).toBe(slot.name);
    expect(t.arc).toMatchObject({ code: id, flag: true, stage: 1 });
    expect(arcs.get(id)!.lines).toContain(t.line);
    expect(slot.rel['mc.ally']).toBe(2);
    // his story runs by the written steps, with the moods the docs put on them
    t.b = 90;
    life.hAge = 31;
    for (let y = 0; y < 20 && !t.arc!.end; y++) {
      life.hAge++;
      t.b = 90;
      t.state = 'alive';
      arcsYear(ctx, life, e);
    }
    expect(t.arc!.end).toBeTruthy();
    const arcLog = g.state.log.filter((x) => x.sys === 'bonds' && x.kind === 'arc' && x.id === t.id && x.data.stage);
    expect(arcLog.length).toBeGreaterThanOrEqual(3);
    for (const x of g.state.log.filter((y) => y.sys === 'bonds')) {
      for (const v of Object.values(x.data)) if (typeof v === 'string') expect(v).not.toMatch(/\{[^}]*:[^}]*@\d\}/);
    }
  });

  it('the successor of a written ally starts one level lower and is never a lover (rules 4 and 5)', () => {
    const { ctx, life, g, e } = mk(24);
    life.hAge = 30;
    const id = 'MH01-3'; // Rethvi: friend or lover in the original
    const slot = slotsOf(g.state)[id];
    slot.status = 'alive';
    slot.alive = true;
    slot.gen = 2;
    slot.born = ctx.state.clock.worldYear - (slot.span * 16) / 75;
    life.country = 'MH-01';
    slot.place = 'MH-01';
    slot.rel['mc.ally'] = 1;
    rosterYear(ctx, life, e);
    const t = tiesOf(e).find((x) => x.npc === id)!;
    expect(t).toBeTruthy();
    expect(t.gen).toBe(2);
    const succ = bondsIndex(ctx).successors.get(id)!;
    expect(succ.lines).toContain(t.line);
    expect(t.line).not.toBe('คนรัก');
    expect(levelOf(ctx, t)).toBe(1);
    // the written original starts at level 2
    delete e.ties[t.id];
    slot.gen = 1;
    slot.rel['mc.ally'] = 1;
    rosterYear(ctx, life, e);
    expect(levelOf(ctx, tiesOf(e).find((x) => x.npc === id)!)).toBe(2);
  });

  it('a tie of a roster position ends with its holder: he dies, and a new holder is a new person', () => {
    const { ctx, life, g, e } = mk(25);
    life.hAge = 30;
    const id = 'MH09-3';
    const slot = slotsOf(g.state)[id];
    slot.status = 'alive';
    slot.alive = true;
    slot.gen = 1;
    life.country = 'MH-09';
    slot.place = 'MH-09';
    slot.rel['mc.ally'] = 1;
    rosterYear(ctx, life, e);
    const t = tiesOf(e).find((x) => x.npc === id)!;
    slot.gen = 2;
    life.hAge = 31;
    lifeYear(ctx, life);
    expect(t.state).toBe('dead');
  });
});

describe('bonds: whole lives', () => {
  it('replays exactly for the same seed and continues exactly from a saved state', () => {
    const run = (seed: number) => {
      const { g, life } = mk(seed);
      runToDeath(g);
      return { ext: JSON.stringify(life.ext.bonds), log: g.state.log.filter((x) => x.sys === 'bonds').length };
    };
    const a = run(31);
    const b = run(31);
    expect(a.ext).toBe(b.ext);
    expect(a.log).toBe(b.log);
    expect(run(32).ext).not.toBe(a.ext);
    // a save taken at the age of 30
    const m = mk(33);
    for (let i = 0; i < 4 * 400 && m.g.state.life && m.g.state.life.hAge < 30; i++) m.g.beat();
    const saved = clone(m.g.state);
    const rest = new Game(saved, data, m.g.systems);
    runToDeath(m.g);
    runToDeath(rest);
    expect(JSON.stringify(rest.state.life!.ext.bonds)).toBe(JSON.stringify(m.g.state.life!.ext.bonds));
  });

  it('writes the crisis of a tie as sys bonds kind crisis at level 2 (the card attention waits for), and nothing of the three kinds is left unhandled', () => {
    let crisis = 0;
    let ties = 0;
    for (let seed = 40; seed < 52; seed++) {
      const { g, life } = mk(seed);
      runToDeath(g);
      const log = g.state.log;
      for (const x of log) {
        if (x.sys === 'bonds' && x.kind === 'crisis') {
          crisis++;
          expect(x.level).toBe(2);
          expect(typeof x.data.name).toBe('string');
        }
        if (x.sys === 'bonds' && x.kind === 'tie') ties++;
        if (x.sys === 'rules' && x.kind === 'unhandled') expect(x.id).not.toMatch(/^(effect:(mood|template|bond)|cond:bond|effect:stat:(B|บุญคุณ|พวกพ้อง))$/);
      }
      const e = extOf(life);
      expect(closeTies(g.ctx, e).length).toBeLessThanOrEqual(5);
      for (const t of tiesOf(e)) {
        expect(t.b).toBeGreaterThanOrEqual(0);
        expect(t.b).toBeLessThanOrEqual(100);
        expect(t.moods.length).toBeLessThanOrEqual(2);
      }
    }
    expect(ties).toBeGreaterThan(30);
    expect(crisis).toBeGreaterThan(0);
  });

  it('a life of a long-lived people sees the short-lived grow old and die while it lives (03 §4)', () => {
    const { g, life } = mk(60, { race: 'el' });
    runToDeath(g);
    const dead = tiesOf(extOf(life)).filter((t) => t.state === 'dead' && !t.npc);
    expect(dead.length).toBeGreaterThan(0);
  });
});
