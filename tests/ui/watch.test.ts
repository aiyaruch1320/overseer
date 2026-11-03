// The view models of the watch screen (src/app/views/watch.ts): what the life line, the candle, the cards, the stop and the settings say
// for a sample life. The lives are the same seeds the storybook uses; no browser is needed because the models are pure.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import type { GameData } from '../../src/core/game';
import { write } from '../../src/core/log';
import type { GameState } from '../../src/core/types';
import { candleOf, cardsPatch, entryAt, godGates, lastStop, lifeLineOf, llmPatch, markTone, optionsOf, refusedSettings, settingsView, uiOfState, watchModel } from '../../src/app/views/watch';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

/** The state of a seeded life after `beats` beats, as the storybook samples it. */
function life(seed: number, beats: number): GameState {
  const s = createSession(data, { seed });
  startLife(s);
  for (let i = 0; i < beats && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  return s.game.state;
}

describe('watch: the life line', () => {
  it('at birth: the five stones of the age stops, none passed, the cursor at the start', () => {
    const m = watchModel(data, life(1, 1), uiOfState(life(1, 1)));
    expect(m.line.pegs.map((p) => p.age)).toEqual([5, 15, 30, 50, 70]);
    expect(m.line.pegs.some((p) => p.passed)).toBe(false);
    expect(m.line.now).toBeLessThan(1);
    expect(m.line.pos).toBeLessThan(0.02);
    expect(m.line.pegs.map((p) => p.pos)).toEqual([...m.line.pegs.map((p) => p.pos)].sort((a, b) => a - b));
    expect(m.line.pegs.every((p) => p.pos > 0 && p.pos < 1)).toBe(true);
    expect(m.panel.alive).toBe(true);
    expect(m.log.length).toBeGreaterThan(0);
  });

  it('stones pass as the life goes on, and the glowing windows of the log are on the line', () => {
    const st = life(1, 80);
    const line = lifeLineOf(data, st);
    expect(line.pegs.filter((p) => p.passed).map((p) => p.age)).toEqual([5, 15]);
    expect(line.glows.length).toBeGreaterThanOrEqual(2);
    for (const g of line.glows) expect(g.pos).toBeGreaterThan(0.2);
    const open = line.glows.filter((g) => g.open);
    for (const g of open) expect(line.now - g.age).toBeLessThan(1);
    // the age stop is a stone, not a second mark; the stops of windows are marks
    expect(line.stops.every((s) => s.why !== 'age')).toBe(true);
  });

  it('the interventions done are marks: gold for making, red for breaking', () => {
    const st = life(1, 40);
    write(st, { sys: 'god', kind: 'prayer.give', id: 'love', data: { n: 1, name: 'x' }, level: 2 });
    write(st, { sys: 'god', kind: 'prayer.punish', id: 'love', data: { n: 2, name: 'x' }, level: 2 });
    write(st, { sys: 'god', kind: 'chest', id: 'pick', data: { kind: 'curse', slot: 1 }, level: 2 });
    write(st, { sys: 'god', kind: 'chest', id: 'open', data: {}, level: 1 });
    write(st, { sys: 'god', kind: 'dream', id: 'n1', data: { paid: 10, choice: 'a' }, level: 2 });
    write(st, { sys: 'god', kind: 'dream', id: 'n1', data: { outcome: 'fade' }, level: 1 });
    const tones = lifeLineOf(data, st).marks.map((m) => m.tone);
    expect(tones).toEqual(['light', 'dread', 'dread', 'light']);
  });

  it('a miracle is red when it costs only fear and silver when it bends fate', () => {
    const list = (data.god.items as { miracles: { list: { id: string; cost: { faith?: number; dread?: number }; tier: string }[] } }).miracles.list;
    const dread = list.find((m) => m.cost.dread && !m.cost.faith && m.tier !== 'ลิขิต');
    const faith = list.find((m) => m.cost.faith && !m.cost.dread && m.tier !== 'ลิขิต');
    const fate = list.find((m) => m.tier === 'ลิขิต');
    const e = (id: string) => ({ n: 1, worldYear: 0, sys: 'god', kind: 'miracle', id, data: {}, level: 1 as const });
    expect(dread && markTone(data, e(dread.id))).toBe('dread');
    expect(faith && markTone(data, e(faith.id))).toBe('light');
    expect(fate && markTone(data, e(fate.id))).toBe('fate');
  });
});

describe('watch: the candle and the purse', () => {
  it('gold when loyal, white when wavering, cold when hating; taller with more belief', () => {
    const a = candleOf(data, 80);
    const b = candleOf(data, 0);
    const c = candleOf(data, -50);
    const d = candleOf(data, -100);
    expect([a.tone, b.tone, c.tone, d.tone]).toEqual(['loyal', 'wavering', 'cold', 'cold']);
    expect(a.fill).toBeGreaterThan(b.fill);
    expect(b.fill).toBeGreaterThan(c.fill);
    expect(d.fill).toBeGreaterThan(0);
    expect([a.pct, b.pct, candleOf(data, -100).pct, candleOf(data, 100).pct]).toEqual([90, 50, 0, 100]);
    expect(candleOf(data, 300).belief).toBe(100);
  });

  it('names the band from the god data, without the note of the code tag', () => {
    expect(candleOf(data, 60).bandName).toBe('ผู้ภักดี');
    expect(candleOf(data, 25).bandName).toBe('ผู้เชื่อ');
    expect(candleOf(data, 0).bandName).toBe('ผู้ลังเล');
    expect(candleOf(data, -40).bandName).toBe('ผู้หันหลัง');
  });

  it('the vials are the light and the dread against the cap of 200', () => {
    const st = life(1, 10);
    st.god.light = 50;
    st.god.dread = 300;
    const m = watchModel(data, st, uiOfState(st));
    expect(m.panel.light.fill).toBeCloseTo(0.25);
    expect(m.panel.dread.fill).toBe(1);
    expect(m.panel.buttons).toEqual(['chest', 'dream', 'whisper', 'miracle', 'chronicle']);
  });
});

describe('watch: the cards', () => {
  it('two cards at most, the one that runs out first on top, with a ring and options', () => {
    const st = life(2, 107);
    const m = watchModel(data, st, uiOfState(st, { running: true }));
    expect(m.cards.length).toBe(2);
    expect(m.cards[0].left!).toBeLessThanOrEqual(m.cards[1].left!);
    for (const c of m.cards) {
      expect(c.frac).toBeGreaterThan(0);
      expect(c.frac).toBeLessThanOrEqual(1);
      expect(c.text).toMatch(/[฀-๿]/);
      expect(c.options.length).toBeGreaterThan(0);
    }
    expect(m.cards.map((c) => c.kind).sort()).toEqual(['omen', 'prayer']);
    expect(m.running).toBe(true);
    expect(m.stop).toBeNull();
  });

  it('what the god can do about each reason opens a god screen', () => {
    expect(optionsOf('prayer', 'love')).toEqual([{ kind: 'prayer', args: { id: 'love' } }]);
    expect(optionsOf('age').map((o) => o.kind)).toEqual(['chest', 'dream', 'whisper']);
    expect(optionsOf('majorOmen', 'FG-11').map((o) => o.kind)).toEqual(['miracle', 'decree']);
    expect(optionsOf('death')).toEqual([]);
  });
});

describe('watch: the stop', () => {
  it('an age stop names the age, tells the recap, and holds the cards that waited', () => {
    const st = life(2, 200);
    const stop = lastStop(st);
    expect(stop).not.toBeNull();
    const m = watchModel(data, st, uiOfState(st, { stop: true }));
    expect(m.stop).not.toBeNull();
    expect(m.stop!.why).toBe('age');
    expect(m.stop!.age).toBe(50);
    expect(m.stop!.reason).toContain('50');
    expect(m.stop!.cards.length).toBe(String(stop!.data.cards).split(',').length);
    expect(m.stop!.cards.map((c) => c.kind)).toEqual(String(stop!.data.cards).split(','));
    for (const c of m.stop!.cards) {
      expect(c.left).toBeNull();
      expect(c.options.length).toBeGreaterThan(0);
    }
    // a folded prayer is named (the ids of a stop are joined with commas and a battle has several: the card reads its own entry)
    expect(m.stop!.cards.find((c) => c.kind === 'prayer')!.text).toContain(':');
    expect(m.stop!.options.map((o) => o.kind)).toEqual(['chest', 'dream', 'whisper']);
    expect(m.stop!.recap.length).toBeGreaterThan(0);
    expect(m.stop!.recap.length).toBeLessThanOrEqual(6);
    expect(m.stop!.recap.every((l) => l.level >= 2 && l.entry.n < stop!.n)).toBe(true);
    expect(m.panel.windowOpen).toBe(true);
  });

  it('near death: the dream is open and the waiting prayer is a card with its own button', () => {
    const st = life(1, 296);
    const m = watchModel(data, st, uiOfState(st, { stop: true }));
    expect(m.stop!.why).toBe('nearDeath');
    expect(m.stop!.options.map((o) => o.kind)).toEqual(['dream']);
    expect(m.stop!.cards.map((c) => c.kind)).toEqual(['prayer']);
    expect(m.stop!.cards[0].options[0].kind).toBe('prayer');
    expect(m.stop!.death).toBe(false);
  });

  it('reads an entry of the log by its number', () => {
    const st = life(1, 30);
    const mid = st.log[Math.floor(st.log.length / 2)];
    expect(entryAt(st, mid.n)).toBe(mid);
    expect(entryAt(st, -5)).toBeUndefined();
  });
});

describe('watch: the settings', () => {
  it('shows the speed, the level and the switches; the normal level has no note', () => {
    const st = life(1, 5);
    const v = settingsView(data, st.settings);
    expect(v.speed).toBe(st.settings.speed);
    expect(v.attention).toBe('normal');
    expect(v.attentionNotes.low).toMatch(/[฀-๿]/);
    expect(v.attentionNotes.normal).toBe('');
    expect(v.master).toBe(true);
    expect(v.llm).toEqual({ setup: true, director: true, epitaph: true });
  });

  it('every patch the panel builds is one the core accepts', () => {
    const st = life(1, 5);
    for (const speed of ['pause', 'normal', 'fast'] as const) expect(refusedSettings({ speed })).toBeNull();
    for (const attention of ['low', 'normal', 'high'] as const) expect(refusedSettings({ attention })).toBeNull();
    for (const key of ['master', 'setup', 'director', 'epitaph'] as const) expect(refusedSettings(llmPatch(st.settings, key, false))).toBeNull();
    expect(refusedSettings({ speed: 'warp' as never })).toMatch(/ความเร็ว/);
  });

  it('a switch patch changes that switch and keeps the others', () => {
    const st = life(1, 5);
    const p = llmPatch(st.settings, 'director', false);
    expect(p.llm).toEqual({ master: true, setup: true, director: false, epitaph: true });
    st.settings.llm = { ...st.settings.llm, ...p.llm! };
    const v = settingsView(data, st.settings);
    expect(v.llm.director).toBe(false);
    expect(v.llm.setup).toBe(true);
    st.settings.llm.master = false;
    expect(settingsView(data, st.settings).master).toBe(false);
  });
});

describe('watch: the grey buttons of the god', () => {
  it('a button the core says no to is listed with the reason; the rest are not', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    for (let i = 0; i < 5; i++) s.game.beat();
    const g = s.game;
    g.state.god.light = 0;
    const gates = godGates(g.ctx);
    expect(gates.whisper).toMatchObject({ why: 'cost' });
    expect(gates.whisper?.reason).toMatch(/ไม่พอ/);
    const m = watchModel(data, g.state, { ...uiOfState(g.state), gates });
    expect(m.panel.gates.whisper).toEqual(gates.whisper);
    expect(m.panel.gates.chronicle).toBeUndefined();
    g.state.god.light = 150;
    expect(godGates(g.ctx).whisper).toBeUndefined();
  });

  it('a dead hero greys nothing more: the buttons are off for the dead and have no gate', () => {
    const st = life(1, 5);
    const gates = { chest: { reason: 'x', why: 'cap' as const } };
    st.life!.dead = { year: 0, hAge: 30, cause: 'x' };
    expect(watchModel(data, st, { ...uiOfState(st), gates }).panel.gates).toEqual({});
  });
});

describe('watch: the switches of the cards', () => {
  it('all on in a setting that has none; the patch changes one kind and keeps the others', () => {
    const st = life(1, 5);
    expect(settingsView(data, st.settings).cards).toEqual({ prayer: true, omen: true, battle: true, crisis: true, majorOmen: true });
    const p = cardsPatch(st.settings, 'battle', false);
    expect(p.cards).toEqual({ prayer: true, omen: true, battle: false, crisis: true, majorOmen: true });
    expect(refusedSettings(p)).toBeNull();
    const old = { ...st.settings, cards: undefined } as never;
    expect(settingsView(data, old).cards.prayer).toBe(true);
  });

  it('applied through the store command the switch holds and the view follows', async () => {
    const { command } = await import('../../src/core/command');
    const s = createSession(data, { seed: 1 });
    startLife(s);
    const r = command(s.game.ctx, { type: 'settings', patch: cardsPatch(s.game.state.settings, 'omen', false) });
    expect(r.ok).toBe(true);
    expect(settingsView(data, s.game.state.settings).cards.omen).toBe(false);
    expect(settingsView(data, s.game.state.settings).cards.prayer).toBe(true);
  });
});
