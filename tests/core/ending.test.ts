// M4 fix round: the ending card tells the life as it was (E1), picks real turning points (E2), takes an ending once per family (E3), counts the hand like the
// power block (E4), shows the vow and the titles (E5), and the collection holds the categories of the goals (M7).
import { beforeAll, describe, expect, it } from 'vitest';
import { extOf as bondsOf, isLive, tiesOf } from '../../src/core/bonds';
import { cardOf, collectionView, endingInput } from '../../src/core/ending';
import { buildCard, momentsOf, templatesFor } from '../../src/core/ending/card';
import { gatherFacts, lifeLog, type RawFact } from '../../src/core/ending/facts';
import { isHandAct, MOMENT } from '../../src/core/ending/tuning';
import { lifeGoals } from '../../src/core/god/goals';
import { makeCtx, type GameData } from '../../src/core/game';
import { lx, nextLife, worldSummary } from '../../src/core/lineage';
import { runLineageReport } from '../../scripts/tools/lineage-run';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife, type Session } from '../../scripts/tools/session';
import { clone } from '../../src/core/save';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function lineage(seed: number, n: number, onLife?: (s: Session, i: number) => void, setup?: (s: Session) => void): Session {
  const s = createSession(data, { seed });
  startLife(s);
  setup?.(s);
  for (let i = 0; i < n; i++) {
    if (i > 0) if (!nextLife(s.game, { newcomer: true }).ok) break;
    runToDeath(s.game);
    onLife?.(s, i);
  }
  return s;
}

/** A dead life that had a lover, found among a few seeds; the state is a copy that a test may change. */
function withLover(): { state: Session['game']['state'] } {
  for (const seed of [3, 5, 9, 2]) {
    let found: { state: Session['game']['state'] } | undefined;
    lineage(seed, 3, (s) => {
      const st = s.game.state;
      const b = st.life?.ext.bonds ? bondsOf(st.life) : undefined;
      if (!found && b?.partner && b.ties[b.partner]) found = { state: clone(st) };
    });
    if (found) return found;
  }
  throw new Error('no lover found');
}

describe('E1: the facts tell the relations as they were', () => {
  it('a lover who died is never "separated"; a lover who left is told with the age of leaving; one who stayed is "together"', () => {
    const g = withLover();
    const base = g.state;
    const run = (change: (t: ReturnType<typeof tiesOf>[number]) => void) => {
      const st = clone(base);
      const ctx = makeCtx(st, data);
      const b = bondsOf(st.life!);
      const t = b.ties[b.partner!];
      change(t);
      const fact = gatherFacts(ctx, null).facts.find((f) => f.kind === 'คนรัก')!;
      return { fact, t, ctx };
    };
    const dead = run((t) => {
      t.state = 'dead';
      t.gone = { age: t.opened + 9, year: 0, way: 'death', why: 'ตาย', reason: 'ตาย' };
    });
    expect(dead.fact.flags).not.toContain('apart');
    expect(dead.fact.slots.age).toBe(dead.t.opened);
    expect(dead.fact.slots.years_together).toBeLessThanOrEqual(9);
    const sentences = templatesFor(dead.ctx, dead.fact).map((x) => x.text);
    expect(sentences.length).toBeGreaterThan(0);
    expect(sentences.join('|')).not.toContain('แยกจากกัน');
    const split = run((t) => {
      t.state = 'ended';
      t.gone = { age: t.opened + 4, year: 0, way: 'split', why: 'x', reason: 'แยกทาง' };
    });
    expect(split.fact.flags).toContain('apart');
    expect(split.fact.slots.age).toBe(split.t.opened + 4);
    expect(templatesFor(split.ctx, split.fact).map((x) => x.text)).toEqual(['เขากับ{lover}แยกจากกันเมื่ออายุ {age}']);
    const stay = run((t) => {
      t.state = 'alive';
      delete t.gone;
    });
    expect(stay.fact.flags).toContain('together');
    expect(isLive(stay.t)).toBe(true);
  });

  it('"the first child was born when he was N" says the age of the birth, not the age of the death', () => {
    const g = withLover();
    const st = clone(g.state);
    const ctx = makeCtx(st, data);
    const b = bondsOf(st.life!);
    const kid = tiesOf(b)[0];
    kid.kin = 'child';
    kid.born = 22;
    const fact = gatherFacts(ctx, null).facts.find((f) => f.kind === 'ทายาท')!;
    expect(fact.slots.age).toBe(22);
    expect(fact.slots.age).not.toBe(st.life!.dead?.hAge);
    expect(gatherFacts(ctx, null).facts.some((f) => f.kind === 'ลูกเกิด' && f.age === 22 && f.moment)).toBe(true);
  });

  it('a lover who was a friend first is not "met" at the age the love began', () => {
    const g = withLover();
    const facts = gatherFacts(makeCtx(clone(g.state), data), null).facts;
    const love = facts.find((f) => f.kind === 'คนรัก');
    if (love?.flags.includes('late')) expect(facts.some((f) => f.kind === 'คนรักเริ่ม' && f.age === love.age)).toBe(true);
    expect(love).toBeTruthy();
  });
});

describe('E2: the three moments are turning points', () => {
  const ctxOf = () => makeCtx(clone(withLover().state), data);
  const f = (kind: string, age: number, slots: Record<string, string | number>, over: Partial<RawFact> = {}): RawFact => ({ kind, age, slots: { age, ...slots }, flags: [], tags: [`${kind}:${age}`], ...over });

  it('children, a lover lost, a curse, a betrayal and the hand come before the question; the question comes last', () => {
    const ctx = ctxOf();
    const facts = [
      f('คำตอบของคำถามชีวิต', 70, { question: 'ก' }, { bonus: 4 }),
      f('ลูกเกิด', 25, { child: 'ลูกหนึ่ง' }, { moment: true }),
      f('คนรักตาย', 62, { npc: 'คนรักเก่า' }, { moment: true }),
      f('คำสาป', 36, { curse: 'แผลผนึก' }, { moment: true }),
      f('หักหลัง', 46, { npc: 'ผู้ทรยศ' }, { moment: true }),
    ];
    const m = momentsOf(ctx, facts, new Set(), 'L1');
    expect(m).toHaveLength(3);
    expect(m.map((x) => x.kind)).not.toContain('คำตอบของคำถามชีวิต');
    for (const x of m) expect([...x.line].length).toBeLessThanOrEqual(36);
  });

  it('the question is a moment only when nothing better exists', () => {
    const ctx = ctxOf();
    const m = momentsOf(ctx, [f('คำตอบของคำถามชีวิต', 70, { question: 'ก' }, { bonus: 4 }), f('หักหลัง', 46, { npc: 'ผู้ทรยศ' }, { moment: true })], new Set(), 'L1');
    expect(m.map((x) => x.kind)).toEqual(['หักหลัง', 'คำตอบของคำถามชีวิต']);
    expect(MOMENT.question).toBeLessThan(0);
  });

  it('on real cards the question is rarely the third moment', () => {
    let cards = 0;
    let question = 0;
    for (const seed of [2, 3, 5, 9]) {
      const s = lineage(seed, 3);
      for (const c of Object.values(lx(s.game.state).cards)) {
        cards++;
        if (c.moments.some((x) => x.kind === 'คำตอบของคำถามชีวิต')) question++;
      }
    }
    expect(cards).toBeGreaterThanOrEqual(8);
    expect(question / cards).toBeLessThan(0.2);
  });
});

describe('E3: an ending is taken once per family', () => {
  it('no two lives of a lineage hold the same ending, and a newcomer takes none of the heirs', () => {
    for (const seed of [3, 5, 9, 11]) {
      const s = lineage(seed, 3);
      const x = lx(s.game.state);
      const ends = x.recs.map((r) => r.ending).filter(Boolean);
      expect(new Set(ends).size).toBe(ends.length);
      for (const r of x.recs) {
        if (r.ending === 'ผู้ปิดสมุดตระกูล') expect(x.threads.some((t) => t.holder === r.id && t.tried === 'closed')).toBe(true);
        if (r.origin === 'newcomer') expect(['ผู้ปิดสมุดตระกูล', 'ผู้พาตระกูลข้ามยุค', 'ผู้ถูกเทียบกับบรรพบุรุษ', 'ผู้เริ่มสายใหม่']).not.toContain(r.ending);
      }
    }
  });
});

describe('E4: the hand of the god', () => {
  it('the card counts the acts of its life as the power block does, and the summary of the world is their sum', () => {
    const s = runLineageReport(data, { seed: 13, lives: 3, minLevel: 2, policy: 'สุ่ม' });
    const st = s.state;
    const all = st.god.chronicle.filter(isHandAct);
    const cards = Object.values(lx(st).cards);
    expect(all.length).toBeGreaterThan(20);
    expect(cards.reduce((n, c) => n + c.hand.total, 0)).toBeLessThanOrEqual(all.length);
    const w = worldSummary(st, data);
    expect(w.hand.total).toBe(all.length);
    expect(w.legend.text).not.toContain('ไม่มีพระหัตถ์ในโลกนี้เลย');
    // the first life: the card is the block ("ใช้พลัง N ครั้ง") at its death
    const block = /ใช้พลัง (\d+) ครั้ง/.exec(s.text)!;
    expect(cards[0].hand.total).toBe(Number(block[1]));
  });

  it('a conjured miracle is a hand and keeps its name', () => {
    expect(isHandAct({ kind: 'conjure' })).toBe(true);
    expect(isHandAct({ kind: 'prayer.lapse' })).toBe(false);
    expect(isHandAct({ kind: 'dream', result: 'obey' })).toBe(false);
    expect(isHandAct({ kind: 'dream', result: 'sent:x' })).toBe(true);
  });
});

describe('E5: the vow and the titles are on the card', () => {
  it('a vow that was kept or broken has its line and page on the card and in the input of the llm layer', () => {
    const s = lineage(
      5,
      1,
      (sess) => {
        const st = sess.game.state;
        const card = cardOf(st)!;
        const input = endingInput(st)!;
        const g = lifeGoals(st.life!).result!;
        expect(g.vow).toBe('GV-01');
        expect(['kept', 'broken']).toContain(g.result);
        expect(card.vow?.result).toBe(g.result);
        expect(card.vow?.head).toMatch(/^คำปฏิญาณที่(เป็นจริง|ไม่เป็นจริง) · /);
        expect(card.vow?.lines.length).toBeGreaterThanOrEqual(1);
        expect(card.lines).toContain(card.vow!.line);
        expect(card.vow!.line).toMatch(/^ปฏิญาณ: .+ · (สำเร็จ|ไม่สำเร็จ)$/);
        expect([...card.vow!.line].length).toBeLessThanOrEqual(56);
        expect(input.vow?.result).toBe(card.vow?.result);
        expect(input.titles).toEqual(g.titles);
        expect(card.titles).toEqual(g.titles);
        // the title line shows the titles of the goals, not the ending of the story
        for (const t of g.titles.slice(0, 1)) expect(card.titleLine).toContain(t);
      },
      (sess) => {
        lifeGoals(sess.game.state.life!).vow = 'GV-01';
      },
    );
    expect(s).toBeTruthy();
  });

  it('a life with no vow has no vow line, and the people and traces are on every card', () => {
    const s = lineage(9, 2);
    for (const c of Object.values(lx(s.game.state).cards)) {
      expect(c.vow).toBeUndefined();
      expect(c.traces.length).toBeGreaterThan(0);
      expect(Array.isArray(c.people)).toBe(true);
    }
  });
});

describe('M5 M6: time words tell the truth; the epitaphs differ', () => {
  it('"ไม่กี่ปีให้หลัง" stands only for a gap of five years or less', () => {
    for (const seed of [2, 3, 5, 9, 11, 13]) {
      const s = lineage(seed, 3);
      for (const c of Object.values(lx(s.game.state).cards)) {
        c.facts.forEach((f, i) => {
          if (i > 0 && c.summary.text.includes(`ไม่กี่ปีให้หลัง ${f.sentence}`)) {
            expect(f.age).toBeDefined();
            expect((f.age ?? 0) - (c.facts[i - 1].age ?? 0)).toBeLessThanOrEqual(5);
          }
        });
      }
    }
  });

  it('the stones of the dead do not read alike', () => {
    const shapes = new Set<string>();
    let n = 0;
    for (const seed of [2, 3, 5, 9, 11, 13]) {
      const s = lineage(seed, 3);
      for (const c of Object.values(lx(s.game.state).cards)) {
        n++;
        shapes.add(c.epitaph.text.replace(c.name, '').replace(/\d+/g, ''));
      }
    }
    expect(shapes.size / n).toBeGreaterThan(0.7);
  });
});

describe('M7: the collection holds the categories of the goals', () => {
  it('shows vows, titles, the titles of the god, the listed miracles, the conjured names and the reactions, with totals from the data', () => {
    const s = lineage(5, 2);
    const view = collectionView(s.game.state, data);
    const by = Object.fromEntries(view.categories.map((c) => [c.id, c]));
    expect(by.vow.total).toBe(19);
    expect(by.title.total).toBe(16);
    expect(by.godtitle.total).toBe(6);
    expect(by.miracle.total).toBe(25);
    expect(by.reaction.total).toBe(10);
    expect(by.conjure.unlimited).toBe(true);
    expect(by.title.have).toBeGreaterThan(0);
    expect(by.title.found.every((f) => f.name === f.id)).toBe(true);
    expect(buildCard).toBeTruthy();
    expect(lifeLog).toBeTruthy();
  });
});
