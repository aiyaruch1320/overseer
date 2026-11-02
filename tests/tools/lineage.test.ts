// M4: the ending card, the collection and the lineage (docs/guide/code-plan.md §11 row M4: "สามชีวิตต่อกันในโลกเดียว").
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runLineageReport, runLineageReportLlm } from '../../scripts/tools/lineage-run';
import { llmFromArgs, summarizeDeath, type ToolLlm } from '../../scripts/tools/llm';
import { fakeLlm } from '../../src/core/llm';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, resumeSession, runToDeath, startLife, type Session } from '../../scripts/tools/session';
import { statusLines } from '../../scripts/tools/report';
import { applyEndingText, cardOf, collectionView, endingInput } from '../../src/core/ending';
import { LIMIT } from '../../src/core/ending/tuning';
import { versions, type GameData } from '../../src/core/game';
import { addTie, endTie, extOf as bondsOf, hAgeOf, invite, isLive, tiesOf } from '../../src/core/bonds';
import { candidates, familyLives, lx, nextLife, onLifeChange, pickHeir, pickHeirTie, previewHeir, worldSummary, type LifeChange } from '../../src/core/lineage';
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

/** The first seed (1 to 60) whose lineage of `n` lives has the shape a test needs: the lives of a seed move with every change of the story's draws, so a test asks for the shape, not a seed. */
const found = new Map<string, number>();
function seedWhere(key: string, n: number, ok: (s: Session) => boolean): number {
  const hit = found.get(key);
  if (hit !== undefined) return hit;
  for (let seed = 1; seed <= 60; seed++) {
    if (ok(lineage(seed, n))) {
      found.set(key, seed);
      return seed;
    }
  }
  throw new Error(`no seed in 1..60 gives ${key}`);
}
const origins = (s: Session) => lx(s.game.state).recs.map((r) => r.origin).join(',');

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
    const s = lineage(1, 3);
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
    // the categories of the goals are read from the goals' book, not from the list of entries
    const base = view.categories.filter((c) => !['vow', 'title', 'godtitle', 'miracle', 'conjure', 'reaction'].includes(c.id));
    expect(base.reduce((n, c) => n + c.have, 0)).toBe(s.game.state.lineage.collection.length);
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
    const seed = seedWhere('first,heir,newcomer', 3, (x) => origins(x) === 'first,heir,newcomer');
    const s = lineage(seed, 3, (sess) => years.push(sess.game.state.clock.worldYear));
    const st = s.game.state;
    expect(st.lineage.lives.map((l) => l.id)).toEqual(['L1', 'L2', 'L3']);
    // one clock: each life died later than the one before, and the lives overlap the way a family does
    expect(years[0]).toBeLessThan(years[1]);
    expect(years[1]).toBeLessThan(years[2]);
    const x = lx(st);
    expect(x.recs.map((r) => r.generation)).toEqual([1, 2, 3]);
    // life 2 leaves no heir (no living child, no partner), so the third life is a newcomer after a gap of a generation
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
    expect(st.lineage.chronicle.filter((l) => /^(รุ่นที่ \d+|คนใหม่ในโลกเดิม) · /.test(l)).length).toBe(3);
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
    // a seed whose three lives close a thread (the lives of a seed move with every change of the story's draws)
    const s = lineage(1, 3);
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
    // the family stays ended when a newcomer comes: the newcomer is not a generation of it (05 §4)
    expect(lx(s.game.state).extinct).toMatchObject({ generation: 1 });
    expect(familyLives(s.game.state)).toBe(1);
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
    expect(w.collection.have).toBeGreaterThanOrEqual(s.game.state.lineage.collection.length);
    expect(w.legend.source).toBe('template');
    expect(w.legend.text).not.toMatch(/[{}]|undefined|NaN/);
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it('onLifeChange tells a cross-life system about every end and beginning, and its object is saved with the game', () => {
    const seen: string[] = [];
    const off = onLifeChange((ctx, ev: LifeChange) => {
      seen.push(`${ev.phase}:${ev.life.id}:${ev.origin}`);
      const goals = (ev.carry.probe ??= { count: 0 }) as { count: number };
      goals.count++;
    });
    try {
      const s = lineage(5, 2);
      expect(seen).toEqual(['begin:L1:first', 'end:L1:first', 'begin:L2:heir', 'end:L2:heir']);
      expect((lx(s.game.state).carry.probe as { count: number }).count).toBe(4);
      expect(JSON.parse(save(s.game.state)).lineage.x.carry.probe.count).toBe(4);
    } finally {
      off();
    }
  });
});

describe('lineage: the family the heir wakes with (M4 review F1 F2 N1 M2)', () => {
  it('the heir has the dead parent as a dead tie, the other parent, the brothers and sisters and the spouse of the book of the dead life', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    runToDeath(s.game);
    const parent = s.game.state.life!;
    const pe = bondsOf(parent);
    const spec = pickHeir(s.game.ctx)!;
    const mine = pe.ties[spec.tie!];
    const others = tiesOf(pe).filter((t) => (t.kin === 'child' || t.kin === 'adopted') && t.id !== mine.id);
    expect(others.length).toBeGreaterThan(0);
    expect(nextLife(s.game).ok).toBe(true);
    const heir = s.game.state.life!;
    const e = bondsOf(heir);
    const ties = tiesOf(e);
    // the parent who died
    const dead = ties.find((t) => t.name === parent.name)!;
    expect(dead.state).toBe('dead');
    expect(['father', 'mother']).toContain(dead.kin);
    // the other parent is the one the child tie names
    expect(ties.some((t) => t.name === mine.otherName && (t.kin === 'father' || t.kin === 'mother'))).toBe(true);
    // the brothers and sisters are the other children of the dead life, with their own ages and ends
    for (const o of others) {
      const sib = ties.find((t) => t.name === o.name && (t.kin === 'elder_sibling' || t.kin === 'younger_sibling'));
      expect(sib, o.name).toBeTruthy();
      expect(sib!.state).toBe(o.state);
      expect(Math.abs(hAgeOf(s.game.ctx, sib!) - hAgeOf(s.game.ctx, o))).toBeLessThan(0.01);
    }
    // the spouse the child married before the takeover, and the children of that marriage
    if (mine.married) {
      const spouse = ties.find((t) => t.name === mine.married!.name)!;
      expect(spouse.spouse).toBe(true);
      expect(e.partner).toBe(spouse.id);
      expect(statusLines(data, s.game.state).join('\n')).toContain('คู่ชีวิต');
    }
    // no relative of the age of a newborn is left from the birth draw
    for (const t of ties) if (t.from === 'kin') expect(hAgeOf(s.game.ctx, t)).toBeGreaterThan(heir.hAge - 12);
  });

  it('a partner who lives is the heir after the children, whatever the years she has left (heirs/01 §6 rung 2)', () => {
    const seed = seedWhere('partner', 2, (x) => origins(x) === 'first,successor' && !!lx(x.game.state).recs[1]);
    const s = lineage(seed, 2);
    expect(lx(s.game.state).recs.map((r) => r.origin)).toEqual(['first', 'successor']);
  });

  it('a feud that was forgiven is not handed down; the line of a settled thread tells the outcome', () => {
    const s = createSession(data, { seed: 3 });
    startLife(s);
    for (let i = 0; i < 80; i++) s.game.beat();
    const life = s.game.state.life!;
    const e = bondsOf(life);
    const t = addTie(s.game.ctx, life, { line: 'สหาย', level: 3, from: 'test', quiet: true });
    t.peak = 40;
    e.feuds.push(t.name);
    endTie(s.game.ctx, t, 'split', 'test');
    let ok = false;
    for (let i = 0; i < 400 && !ok; i++) ok = invite(s.game.ctx, life, t, 'reconcile').ok;
    expect(ok).toBe(true);
    expect(e.feuds).not.toContain(t.name);
    const threadLines = (x: Session) => x.game.state.log.filter((l) => l.sys === 'lineage' && l.kind === 'thread');
    const g = lineage(seedWhere('thread', 3, (x) => threadLines(x).length > 0), 3);
    const lines = threadLines(g);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(String(l.data.outcome)).not.toBe('');
  });

  it('brothers and sisters are persons of their own: the traits differ, `previewHeir` says what the heir will be', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    runToDeath(s.game);
    const cand = candidates(s.game.ctx);
    expect(cand.length).toBeGreaterThan(2);
    const looks = cand.map((c) => previewHeir(s.game.ctx, c).traits.join(','));
    expect(new Set(looks).size).toBeGreaterThan(1);
    // the preview does not move the game: the same state gives the same preview again
    expect(previewHeir(s.game.ctx, cand[2]).traits.join(',')).toBe(looks[2]);
    expect(pickHeirTie(s.game.ctx, cand[2].tie)).toBe(true);
    expect(nextLife(s.game).ok).toBe(true);
    expect(s.game.state.life!.traits.join(',')).toBe(looks[2]);
  });

  it('a newcomer does not carry the last person met by the life before, and the family does not count it', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    runToDeath(s.game);
    expect(statusLines(data, s.game.state).join('\n')).toContain('พบล่าสุด');
    expect(nextLife(s.game, { newcomer: true }).ok).toBe(true);
    expect(statusLines(data, s.game.state).join('\n')).not.toContain('พบล่าสุด');
    expect(familyLives(s.game.state)).toBe(1);
    expect(worldSummary(s.game.state, data).family.extinct).toBe(true);
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

describe('lineage with the end summary of the LLM layer', () => {
  /** Three lives, the end summary asked for at every death (the tools' way: the answer enters the state, the core waits for nothing). */
  async function llmLineage(seed: number, tl: ToolLlm, stopInLife2?: number): Promise<Session> {
    const s = createSession(data, { seed });
    startLife(s);
    for (let i = 0; i < 3; i++) {
      if (i > 0) expect(nextLife(s.game, { newcomer: true }).ok).toBe(true);
      if (i === 1 && stopInLife2 !== undefined) {
        for (let b = 0; b < stopInLife2; b++) s.game.beat();
        return s;
      }
      runToDeath(s.game);
      await summarizeDeath(tl, data, s.game.state);
    }
    return s;
  }

  it('every card of the three lives holds the LLM text, kept in the save; a save replays them with a provider that has nothing to say', async () => {
    const tl = llmFromArgs({ llm: 'fake' })!;
    const s = await llmLineage(5, tl);
    const st = s.game.state;
    const cards = Object.values(lx(st).cards);
    expect(cards).toHaveLength(3);
    for (const c of cards) {
      expect(c.summary.source).toBe('llm');
      expect(c.summary.text).toContain('บทสรุปทดสอบ');
      expect(st.llmAnswers['ending:' + c.life]).toBe(c.summary.text);
      expect(c.facts[0].sentence).not.toBe('');
    }
    // one request per life, and nothing else
    expect(tl.llm.ledger.map((e) => e.point + ':' + e.result + ':' + e.life)).toEqual(['ending:ok:L1', 'ending:ok:L2', 'ending:ok:L3']);
    // the facts of a card are the template tier's, unchanged by the LLM text
    const plain = lineage(5, 3);
    const plainCards = Object.values(lx(plain.game.state).cards);
    expect(cards.map((c) => JSON.stringify(c.facts))).toEqual(plainCards.map((c) => JSON.stringify(c.facts)));
    // load the save: the answers are there; an LLM with no fixtures is asked again for each life and is never called
    const { state, stale } = load(save(st), versions(data));
    expect(stale).toEqual([]);
    expect(clone(state)).toEqual(st);
    const mute = fakeLlm({ responses: [] });
    const t2: ToolLlm = { llm: mute.llm, mode: 'fake', flush() {} };
    for (const c of cards) {
      const again = await summarizeDeath(t2, data, state, c.life);
      expect(again).toEqual({ text: c.summary.text, source: 'llm' });
    }
    expect(mute.provider.calls).toHaveLength(0);
    // and even with the card put back to the template, the kept answer is read, not asked
    const lost = clone(state);
    for (const c of Object.values(lx(lost).cards)) c.summary = { text: 'x', source: 'template' };
    for (const c of cards) await summarizeDeath(t2, data, lost, c.life);
    expect(mute.provider.calls).toHaveLength(0);
    expect(Object.values(lx(lost).cards).map((c) => c.summary.text)).toEqual(cards.map((c) => c.summary.text));
  }, 120_000);

  it('three lives replay exactly from a save made in the middle of life 2, with the LLM summary on', async () => {
    const view = (st: GameState) => ({
      lineage: st.lineage,
      life: st.life,
      clock: st.clock,
      rng: st.rng,
      llmAnswers: st.llmAnswers,
      god: st.god,
      log: st.log.filter((e) => e.sys !== 'rules').map((e) => ({ ...e, n: 0 })),
    });
    // the whole run, never stopped
    const whole = await llmLineage(5, llmFromArgs({ llm: 'fake' })!);
    // the same run saved 40 beats into life 2 (life 1 already summarised), loaded, and played on with a new LLM
    const part = await llmLineage(5, llmFromArgs({ llm: 'fake' })!, 40);
    expect(part.game.state.life!.id).toBe('L2');
    expect(part.game.state.llmAnswers['ending:L1']).toBeTruthy();
    const { state } = load(save(part.game.state), versions(data));
    const rest = resumeSession(data, state, { seed: 5 });
    const tl = llmFromArgs({ llm: 'fake' })!;
    runToDeath(rest.game);
    await summarizeDeath(tl, data, rest.game.state);
    expect(nextLife(rest.game, { newcomer: true }).ok).toBe(true);
    runToDeath(rest.game);
    await summarizeDeath(tl, data, rest.game.state);
    // life 1 was not asked again
    expect(tl.llm.ledger.map((e) => e.life)).toEqual(['L2', 'L3']);
    expect(JSON.parse(JSON.stringify(view(rest.game.state)))).toEqual(JSON.parse(JSON.stringify(view(whole.game.state))));
    expect(Object.values(lx(rest.game.state).cards).map((c) => c.summary.source)).toEqual(['llm', 'llm', 'llm']);
  }, 120_000);

  it('npm run life --lives=3 --llm=fake: the three cards show the LLM text, the same text twice', async () => {
    const a = await runLineageReportLlm(data, { seed: 5, lives: 3 }, llmFromArgs({ llm: 'fake' }));
    const b = await runLineageReportLlm(data, { seed: 5, lives: 3 }, llmFromArgs({ llm: 'fake' }));
    expect(a.text.match(/บทสรุปทดสอบ/g)?.length).toBe(3);
    const comparable = (t: string) => t.split('\n').filter((l) => !l.startsWith('กติกาที่ยังไม่มีใครรับ')).join('\n');
    expect(comparable(a.text)).toBe(comparable(b.text));
    // the same lives as the run without the layer
    const plain = runLineageReport(data, { seed: 5, lives: 3 });
    expect(a.lives).toBe(plain.lives);
    expect(a.state.lineage.lives).toEqual(plain.state.lineage.lives);
  }, 120_000);
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

  it('an heir who takes over grown is not told as a newborn: the opening lines say the taking over, a first life still says the birth', () => {
    const r = runLineageReport(data, { seed: 5, lives: 2, minLevel: 1 });
    const [first, second] = r.text.split('=== ชีวิตที่ 2 ===');
    const head = second.split('\n').slice(1, 6).join('\n');
    expect(head).toMatch(/\[รับช่วง\] \S+ รับช่วงต่อเมื่ออายุ \d+ ที่/);
    expect(head).not.toContain('[เกิด]');
    expect(head).not.toMatch(/ชีวิตของ\S+เริ่มที่/);
    expect(head).toContain('เติบโตใน');
    expect(first).toContain('[เกิด]');
    expect(first).not.toContain('[รับช่วง]');
  });

  it('by default the lineage ends when the family has no heir (05 §4: the world is left); --newcomer bears a stranger instead', () => {
    const r = runLineageReport(data, { seed: 1, lives: 3 });
    expect(r.lives).toBe(1);
    expect(r.stopped).toMatch(/สิ้นสาย/);
    expect(r.text).toContain('สายตระกูล');
    expect(r.text).toContain('สายจบและโลกเดิมถูกทิ้ง');
    const n = runLineageReport(data, { seed: 1, lives: 3, newcomer: true });
    expect(n.lives).toBeGreaterThan(1);
  });
});

describe('npm run play: the next life after the death stop', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const cli = (args: string[], dir: string) => execFileSync('npx', ['tsx', 'scripts/tools/play.ts', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, OVERSEER_PLAY_DIR: dir }, timeout: 50000 });

  it('shows the card at the death, `next` bears the heir, the state is kept for the next command, and the third life follows', () => {
    // a seed whose family has an heir after life 1 and ends after life 2 (then a newcomer is asked for)
    const seed = seedWhere('heir-then-end', 3, (x) => /^first,(heir|successor),newcomer$/.test(origins(x)));
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-lineage-'));
    try {
      const first = cli([`--seed=${seed}`, '--new', '--cmd=advance 1000'], dir);
      expect(first).toContain('-- การ์ดตอนจบ --');
      expect(first).toContain('พิมพ์ next');
      const heirs = cli([`--seed=${seed}`, '--cmd=heirs; card; summary; collection'], dir);
      expect(heirs).toContain('ผู้สืบตอนนี้:');
      expect(heirs).toContain('== สรุปโลก');
      expect(heirs).toContain('== ของสะสม');
      const second = cli([`--seed=${seed}`, '--cmd=next; advance 1000'], dir);
      expect(second).toMatch(/-- รุ่นต่อไป · (ทายาท|ผู้สืบเรื่อง) --/);
      expect(second).toContain('รับช่วงต่อจาก');
      expect(second).toContain('การ์ดตอนจบ · รุ่นที่ 2');
      // the third life: the family has no heir that can take over (see the lineage test), so a newcomer is asked for
      const refused = cli([`--seed=${seed}`, '--cmd=next'], dir);
      expect(refused).toContain('ตระกูลสิ้นสาย');
      expect(refused).toContain('== สรุปโลก');
      const third = cli([`--seed=${seed}`, '--cmd=next newcomer'], dir);
      expect(third).toContain('-- รุ่นต่อไป · คนใหม่ในโลกเดิม --');
      // a life that is still alive is not left for the next
      const alive = cli([`--seed=${seed}`, '--cmd=next'], dir);
      expect(alive).toContain('ชีวิตนี้ยังไม่จบ');
      // a newcomer is not a generation of the family (05 §4)
      const end = cli([`--seed=${seed}`, '--cmd=advance 1000'], dir);
      expect(end).toContain('การ์ดตอนจบ · คนใหม่ในโลกเดิม');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
