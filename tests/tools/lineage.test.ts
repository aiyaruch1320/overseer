// M4: the ending card, the collection and the lineage (docs/guide/code-plan.md §11 row M4: "สามชีวิตต่อกันในโลกเดียว").
import { beforeAll, describe, expect, it } from 'vitest';
import { runLineageReport } from '../../scripts/tools/lineage-run';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, resumeSession, runToDeath, startLife, type Session } from '../../scripts/tools/session';
import { applyEndingText, cardOf, collectionView, endingInput } from '../../src/core/ending';
import { LIMIT } from '../../src/core/ending/tuning';
import { versions, type GameData } from '../../src/core/game';
import { extOf as bondsOf, isLive, tiesOf } from '../../src/core/bonds';
import { lx, nextLife, onLifeChange, pickHeir, pickHeirTie, worldSummary, type LifeChange } from '../../src/core/lineage';
import { clone, load, save } from '../../src/core/save';
import type { GameState } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

/** Plays `n` lives in a row; the family falls back to a newcomer when it has no heir (the tools do so by default). */
function lineage(seed: number, n: number, onLife?: (s: Session, i: number) => void): Session {
  const s = createSession(data, { seed });
  startLife(s);
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const r = nextLife(s.game, { newcomer: true });
      expect(r.ok).toBe(true);
    }
    runToDeath(s.game);
    onLife?.(s, i);
  }
  return s;
}

const strip = (text: string) => text.replace(/[\s​]/g, '');

describe('ending card', () => {
  it('every life ends with a card whose lines fit the limits of 07 §10.2 and hold no empty slot', () => {
    const s = lineage(5, 3, (sess) => {
      const card = cardOf(sess.game.state)!;
      expect(card).toBeTruthy();
      expect(card.v).toBe(1);
      expect(card.lines.length).toBeGreaterThanOrEqual(5);
      const [head, title, question, ...rest] = card.lines;
      expect([...head].length).toBeLessThanOrEqual(LIMIT.headLine);
      expect([...title].length).toBeLessThanOrEqual(LIMIT.titleLine);
      expect([...question].length).toBeLessThanOrEqual(LIMIT.questionLine);
      expect(card.moments.length).toBeGreaterThanOrEqual(1);
      expect(card.moments.length).toBeLessThanOrEqual(3);
      for (const m of card.moments) expect([...m.line].length).toBeLessThanOrEqual(LIMIT.momentLine);
      expect([...card.epitaph.text].length).toBeLessThanOrEqual(LIMIT.epitaph);
      expect([...card.summary.text].length).toBeLessThanOrEqual(LIMIT.summary);
      expect(rest.at(-1)).toBe(card.epitaph.text);
      for (const t of [...card.lines, card.summary.text, card.epitaph.text, ...card.facts.map((f) => f.sentence)]) expect(t).not.toMatch(/[{}]|undefined|NaN|\[object/);
      // three facts at least, the birth first and the death in the paragraph (07 §2.3)
      expect(card.facts.length).toBeGreaterThanOrEqual(3);
      expect(card.facts[0].kind).toBe('เกิด');
      expect(card.facts.some((f) => f.kind === 'ความตาย')).toBe(true);
      expect(card.summary.source).toBe('template');
    });
    expect(s.game.state.lineage.lives.length).toBe(3);
  });

  it('the card is plain JSON and the same seed gives the same words', () => {
    const a = lineage(9, 1);
    const b = lineage(9, 1);
    const ca = cardOf(a.game.state)!;
    expect(JSON.parse(JSON.stringify(ca))).toEqual(ca);
    expect(cardOf(b.game.state)).toEqual(ca);
  });

  it('endingInput gives the llm layer the facts and the names; applyEndingText replaces the words and keeps the facts', () => {
    const s = lineage(5, 1);
    const st = s.game.state;
    const input = endingInput(st)!;
    expect(input.v).toBe(1);
    expect(input.life.name).toBe(st.life!.name);
    expect(input.facts.map((f) => f.kind)).toContain('ความตาย');
    expect(input.names).toContain(st.life!.name);
    expect(input.earned.length).toBeGreaterThan(0);
    const before = cardOf(st)!;
    const factsBefore = JSON.stringify(before.facts);
    expect(applyEndingText(st, before.life, { summary: 'ข้อความใหม่', epitaph: 'จารึกใหม่' }, 'llm')).toBe(true);
    const after = cardOf(st)!;
    expect(after.summary).toEqual({ text: 'ข้อความใหม่', source: 'llm' });
    expect(after.epitaph).toEqual({ text: 'จารึกใหม่', source: 'llm' });
    expect(after.lines).toContain('จารึกใหม่');
    expect(JSON.stringify(after.facts)).toBe(factsBefore);
    expect(applyEndingText(st, 'L99', { summary: 'x' })).toBe(false);
  });

  it('a template is not used again in the save while another of its kind is open (07 §10.3)', () => {
    const s = lineage(5, 3);
    const x = lx(s.game.state);
    const cards = Object.values(x.cards);
    // the death sentence and the epitaph of three lives of one family are three different templates
    expect(new Set(cards.map((c) => c.facts.find((f) => f.kind === 'ความตาย')!.template)).size).toBe(cards.length);
    expect(new Set(cards.map((c) => c.epitaph.text)).size).toBe(cards.length);
  });
});

describe('collection', () => {
  it('keeps what the lives opened across lives, shows ratios, and unlocks the heir mode after the first life', () => {
    const s = lineage(5, 2, (sess, i) => {
      const card = cardOf(sess.game.state)!;
      // what a card says it earned is in the collection of the save
      for (const e of card.earned) expect(sess.game.state.lineage.collection).toContain(e);
      if (i === 0) expect(card.earned.length).toBeGreaterThan(10);
    });
    const view = collectionView(s.game.state, data);
    expect(view.have).toBe(s.game.state.lineage.collection.length);
    expect(view.total).toBeGreaterThan(900);
    const nodes = view.categories.find((c) => c.id === 'node')!;
    expect(nodes.have).toBeGreaterThan(20);
    expect(nodes.total).toBeGreaterThan(500);
    expect(view.modes.find((m) => m.id === 'heir')!.open).toBe(true);
    // the entries never repeat
    expect(new Set(s.game.state.lineage.collection).size).toBe(s.game.state.lineage.collection.length);
  });
});

describe('lineage: lives in one world', () => {
  it('three lives follow each other in one world: the world does not restart, the heir comes from the bond book and takes the inheritance', () => {
    const years: number[] = [];
    const s = lineage(5, 3, (sess) => years.push(sess.game.state.clock.worldYear));
    const st = s.game.state;
    expect(st.lineage.lives.map((l) => l.id)).toEqual(['L1', 'L2', 'L3']);
    // one clock: each life died later than the one before, and the lives overlap the way a family does
    expect(years[0]).toBeLessThan(years[1]);
    expect(years[1]).toBeLessThan(years[2]);
    const x = lx(st);
    expect(x.recs.map((r) => r.generation)).toEqual([1, 2, 3]);
    // the partner of life 2 has too few years left to take over (heir.ts MIN_LEFT), so the family goes on with a newcomer after a gap of a generation
    expect(x.recs.map((r) => r.origin)).toEqual(['first', 'heir', 'newcomer']);
    expect(x.gaps.map((g) => g.years)[0]).toBe(0);
    expect(x.gaps.map((g) => g.years)[1]).toBeGreaterThan(0);
    expect(x.recs[1].parent).toBe('L1');
    expect(x.recs[1].startAge).toBeGreaterThan(0);
    expect(x.recs[1].carried!.gold).toBeGreaterThan(0);
    // names: no two lives share one, and the family is named after the first
    const names = st.lineage.lives.map((l) => l.name);
    expect(new Set(names).size).toBe(3);
    expect(x.dynasty).toBe(names[0]);
    expect(st.lineage.chronicle.filter((l) => l.startsWith('รุ่นที่')).length).toBe(3);
    // the heir has the dead parent in the bond book
    expect(Object.keys(x.cards)).toEqual(['L1', 'L2', 'L3']);
  });

  it('the heir does not walk again the convergences the family walked (02-no-repeat.md)', () => {
    const cv1: string[] = [];
    const s = lineage(5, 2, (sess, i) => {
      if (i === 0) cv1.push(...Object.keys(sess.game.state.life!.passed).filter((id) => id.startsWith('cv.')));
    });
    expect(cv1.length).toBeGreaterThan(0);
    const st = s.game.state;
    const x = lx(st);
    for (const id of cv1) expect(x.book.converge).toContain(id);
    // life 2 entered no convergence point that life 1 had entered
    const second = x.recs[1];
    const entered = st.log.filter((e) => e.n >= second.startN && e.n <= second.endN && e.sys === 'story' && e.kind === 'node' && String(e.id).startsWith('cv.')).map((e) => String(e.id));
    for (const id of entered) expect(cv1).not.toContain(id);
    // and the collection does not count the points the book set (they are not life 2's own)
    expect(x.cards.L2.earned.filter((e) => cv1.map((c) => `convergence:${c}`).includes(e))).toEqual([]);
  });

  it('open threads go to the heir, at most three, and are settled, dropped or left to become a legend', () => {
    const s = lineage(5, 3);
    const x = lx(s.game.state);
    for (const r of x.recs) expect(r.threads.length).toBeLessThanOrEqual(3);
    expect(x.threads.length).toBeGreaterThan(0);
    for (const t of x.threads) expect(['open', 'closed', 'dropped', 'legend', 'faded']).toContain(t.state);
    expect(x.threads.some((t) => t.state === 'closed')).toBe(true);
    // the count of the storylines reads the same number (23-heir.md hr.a1)
    expect(s.game.state.lineage.open.length).toBe(x.threads.filter((t) => t.state === 'open').length);
  });

  it('a family with no heir stops (the docs: the world is left); a newcomer can be asked for', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    runToDeath(s.game);
    expect(pickHeir(s.game.ctx)).toBeNull();
    expect(nextLife(s.game)).toEqual({ ok: false, reason: 'extinct' });
    expect(lx(s.game.state).extinct).toBeTruthy();
    const r = nextLife(s.game, { newcomer: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.origin).toBe('newcomer');
      expect(r.gapYears).toBeGreaterThan(0);
      expect(s.game.state.life!.hAge).toBeLessThan(18);
    }
    expect(lx(s.game.state).extinct).toBeUndefined();
    expect(nextLife(s.game)).toEqual({ ok: false, reason: 'alive' });
  });

  it('the player may pick the heir among the children; else the eldest takes over', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    runToDeath(s.game);
    const eldest = pickHeir(s.game.ctx)!;
    expect(eldest.how).toBe('child');
    const kids = tiesOf(bondsOf(s.game.state.life!)).filter((t) => isLive(t) && t.kin === 'child').sort((a, b) => b.age0 - a.age0);
    expect(kids.length).toBeGreaterThan(1);
    // the id of a person who is not a child is refused; a child is taken
    expect(pickHeirTie(s.game.ctx, 'T1')).toBe(false);
    const other = kids.find((k) => k.id !== eldest.tie)!;
    expect(pickHeirTie(s.game.ctx, other.id)).toBe(true);
    const r = nextLife(s.game);
    expect(r.ok && r.heir?.name).toBe(other.name);
    expect(s.game.state.life!.name).toBe(other.name);
  });

  it('the world summary is data: lives, dragons, events, the hand of the god, the collection and a legend', () => {
    const s = lineage(5, 2);
    const w = worldSummary(s.game.state, data);
    expect(w.lives.map((l) => l.id)).toEqual(['L1', 'L2']);
    expect(w.lives.every((l) => l.alive === false && l.died! >= l.born)).toBe(true);
    expect(w.family.generations).toBe(2);
    expect(w.dragons.total).toBe(15);
    expect(w.dragons.fallen.length + w.dragons.standing.length).toBe(15);
    expect(w.events.top.length).toBeLessThanOrEqual(5);
    expect(w.collection.have).toBe(s.game.state.lineage.collection.length);
    expect(w.legend.source).toBe('template');
    expect(w.legend.text).not.toMatch(/[{}]|undefined|NaN/);
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it('onLifeChange tells a cross-life system about every end and beginning, and its object is saved with the game', () => {
    const seen: string[] = [];
    const off = onLifeChange((ctx, ev: LifeChange) => {
      seen.push(`${ev.phase}:${ev.life.id}:${ev.origin}`);
      const goals = (ev.carry.goals ??= { count: 0 }) as { count: number };
      goals.count++;
    });
    try {
      const s = lineage(5, 2);
      expect(seen).toEqual(['begin:L1:first', 'end:L1:first', 'begin:L2:heir', 'end:L2:heir']);
      expect((lx(s.game.state).carry.goals as { count: number }).count).toBe(4);
      expect(JSON.parse(save(s.game.state)).lineage.x.carry.goals.count).toBe(4);
    } finally {
      off();
    }
  });
});

describe('lineage: save and replay', () => {
  it('three lives in one world replay exactly from a save made in the middle of life 2', () => {
    const view = (st: GameState) => ({
      lineage: st.lineage,
      life: st.life,
      clock: st.clock,
      rng: st.rng,
      names: st.world.names,
      god: st.god,
      log: st.log.filter((e) => e.sys !== 'rules').map((e) => ({ ...e, n: 0 })),
    });
    const playOn = (s: Session) => {
      runToDeath(s.game);
      expect(nextLife(s.game, { newcomer: true }).ok).toBe(true);
      runToDeath(s.game);
      return s.game.state;
    };
    // the whole run, never stopped
    const whole = createSession(data, { seed: 5 });
    startLife(whole);
    runToDeath(whole.game);
    expect(nextLife(whole.game, { newcomer: true }).ok).toBe(true);
    // the same run, saved 40 beats into life 2 and loaded
    const part = createSession(data, { seed: 5 });
    startLife(part);
    runToDeath(part.game);
    expect(nextLife(part.game, { newcomer: true }).ok).toBe(true);
    for (let i = 0; i < 40; i++) part.game.beat();
    expect(part.game.state.life!.id).toBe('L2');
    expect(part.game.state.life!.dead).toBeUndefined();
    const text = save(part.game.state);
    const { state, stale } = load(text, versions(data));
    expect(stale).toEqual([]);
    expect(clone(state)).toEqual(part.game.state);
    const rest = resumeSession(data, state, { seed: 5 });
    for (let i = 0; i < 40; i++) whole.game.beat();
    const a = playOn(whole);
    const b = playOn(rest);
    expect(a.lineage.lives.length).toBe(3);
    expect(JSON.parse(JSON.stringify(view(b)))).toEqual(JSON.parse(JSON.stringify(view(a))));
  });
});

describe('npm run life --lives', () => {
  it('prints three lives with their cards, the world summary and the collection, the same text twice', () => {
    const a = runLineageReport(data, { seed: 5, lives: 3 });
    const b = runLineageReport(data, { seed: 5, lives: 3 });
    const comparable = (t: string) => t.split('\n').filter((l) => !l.startsWith('กติกาที่ยังไม่มีใครรับ')).join('\n');
    expect(comparable(a.text)).toBe(comparable(b.text));
    expect(a.lives).toBe(3);
    for (const head of ['=== ชีวิตที่ 1 ===', '=== ชีวิตที่ 2 ===', '=== ชีวิตที่ 3 ===', '== สรุปโลก', '== ของสะสม']) expect(a.text).toContain(head);
    expect(a.text.match(/การ์ดตอนจบ · รุ่นที่/g)?.length).toBe(3);
    expect(strip(a.text)).not.toMatch(/undefined|\[object|NaN|\{[a-z_]+\}/);
  });

  it('--strict stops when the family has no heir', () => {
    const r = runLineageReport(data, { seed: 1, lives: 3, strict: true });
    expect(r.lives).toBe(1);
    expect(r.stopped).toMatch(/สิ้นสาย/);
  });
});
