// The per-kind card switches (07-attention.md §4), the card that was not called (§1 rule 5), and the commands the god buttons ask (20-god-ui.md §2).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { answered, attentionSystem, callsOf } from '../../src/core/attention';
import { allCardsOn, badSettings, canDo, cardOn, command, onAction, resetActions } from '../../src/core/command';
import { Game, makeCtx, type GameData, type System } from '../../src/core/game';
import { write } from '../../src/core/log';
import { load, save } from '../../src/core/save';
import { newGame } from '../../src/core/state';
import { describe as say, lines } from '../../src/core/text';
import type { CardKind, LifeState, LogEntry, Settings } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const blank = (): LifeState => ({
  id: 'L1', name: 'x', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 0, country: 'AL-01', home: 'AL-01',
  traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
  stats: { pow: 0, mag: 0, spd: 0, luk: 0, int: 0, vit: 0 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {},
});

/** One entry that calls for a card, written at age 8 (a quiet stretch of the made-up life). */
const RAISE: Record<CardKind, { sys: string; kind: string; id: string; data?: LogEntry['data'] }> = {
  prayer: { sys: 'god', kind: 'prayer', id: 'heal', data: { n: 1 } },
  omen: { sys: 'world', kind: 'event', id: 'DR-09', data: { mark: '●', name: 'สงครามธาตุ' } },
  battle: { sys: 'story', kind: 'battle', id: 'boss1' },
  crisis: { sys: 'bonds', kind: 'crisis', id: 'T3', data: { name: 'ไลลินา', line: 'สหาย', tie: 'T3', npc: null } },
  majorOmen: { sys: 'world', kind: 'event', id: 'WR-03', data: { mark: '⭐', name: 'สงครามอาหาร' } },
};
const ENEMIES = { enemies: { version: 't', items: { items: [{ id: 'boss1', tier: 'บอส' }] } } };

function game(kind: CardKind, cards?: Partial<Settings['cards']>): Game {
  const character: System = {
    name: 'character',
    beat(ctx) {
      const l = ctx.state.life!;
      if (l.hAge >= 20) l.dead = { year: ctx.state.clock.worldYear, hAge: l.hAge, cause: 'old' };
    },
  };
  const source: System = {
    name: 'story',
    beat(ctx) {
      const l = ctx.state.life!;
      if (l.hAge === 8 && ctx.state.clock.quarter === 0) write(ctx.state, { ...RAISE[kind], data: RAISE[kind].data ?? {}, level: 2 });
    },
  };
  const g = new Game(newGame(1), { ...ENEMIES, 'world-events': data['world-events'] }, [character, source, attentionSystem]);
  if (cards) g.state.settings.cards = { ...allCardsOn(), ...cards };
  g.state.life = blank();
  g.born();
  g.runLife();
  return g;
}

const missed = (g: Game) => g.state.log.filter((e) => e.sys === 'attention' && e.kind === 'missed');
/** Calls (a card, or a stop that folds it in) that stand for a card of this kind. */
const callsFor = (g: Game, kind: CardKind) => callsOf(g.state.log).filter((e) => e.data.why === kind || String(e.data.cards).split(',').includes(kind));

describe('attention: the switch of each kind of card', () => {
  it('all kinds are on by default, and a settings object without the switches reads as all on', () => {
    expect(newGame(1).settings.cards).toEqual({ prayer: true, omen: true, battle: true, crisis: true, majorOmen: true });
    const old = JSON.parse(save(newGame(1)));
    delete old.settings.cards;
    const s = load(JSON.stringify(old), {}).state.settings;
    for (const k of Object.keys(allCardsOn()) as CardKind[]) expect(cardOn(s, k)).toBe(true);
  });

  for (const kind of ['prayer', 'omen', 'battle', 'crisis', 'majorOmen'] as CardKind[]) {
    it(`${kind}: on, it is called; off, it is not called and the log tells it (answered, so a waiting system goes on)`, () => {
      const on = game(kind);
      expect(callsFor(on, kind).length).toBeGreaterThan(0);
      expect(missed(on).filter((e) => e.data.off)).toHaveLength(0);
      const off = game(kind, { [kind]: false });
      expect(callsFor(off, kind)).toHaveLength(0);
      const m = missed(off).filter((e) => e.data.off);
      expect(m).toHaveLength(1);
      expect(m[0].data).toMatchObject({ kind, off: true, waited: 0 });
      const raised = off.state.log.find((e) => e.sys === RAISE[kind].sys && e.kind === RAISE[kind].kind)!;
      expect(m[0].data.n).toBe(raised.n);
      expect(answered(off.state, raised.n)).toBe(true);
    });
  }

  it('a switch does not touch the other kinds', () => {
    const g = game('battle', { prayer: false, omen: false });
    expect(missed(g).filter((e) => e.data.off)).toHaveLength(0);
    expect(callsFor(g, 'battle').length).toBeGreaterThan(0);
  });
});

describe('settings: cards', () => {
  it('validates the kinds and the values, in a command and in a save', () => {
    expect(badSettings({ cards: { ...allCardsOn(), battle: false } })).toBeNull();
    expect(badSettings({ cards: { dragon: true } as never })).toMatch(/dragon/);
    expect(badSettings({ cards: { battle: 'no' } as never })).toMatch(/battle/);
    expect(badSettings({ cards: null as never })).not.toBeNull();
    const ctx = makeCtx(newGame(1), {});
    expect(command(ctx, { type: 'settings', patch: { cards: { battle: false } as never } }).ok).toBe(true);
    expect(ctx.state.settings.cards).toEqual({ ...allCardsOn(), battle: false });
    expect(command(ctx, { type: 'settings', patch: { cards: { prayer: 1 } as never } }).ok).toBe(false);
    expect(ctx.state.settings.cards.prayer).toBe(true);
    const bad = JSON.parse(save(ctx.state));
    bad.settings.cards.oops = true;
    expect(() => load(JSON.stringify(bad), {})).toThrow(/settings/);
  });
});

describe('text: the card that was not called', () => {
  const m = (kind: string, id: string | undefined, extra: LogEntry['data'] = {}): LogEntry => ({ n: 9, worldYear: 450, sys: 'attention', kind: 'missed', ...(id ? { id } : {}), data: { kind, n: 3, waited: 0, ...extra }, level: 1 });

  it('says one thing for each kind, in the tone of the document, naming the foe, the person or the prayer when the entry has one', () => {
    const t = (e: LogEntry) => say(data, e)!;
    expect(t(m('battle', undefined))).toBe('เขาออกศึกโดยไม่มีใครกระซิบ');
    expect(t(m('battle', 'MH02-1'))).toMatch(/^เขาออกศึกกับ \S+ โดยไม่มีใครกระซิบ$/);
    expect(t(m('prayer', 'heal'))).toMatch(/^คำอธิษฐานเรื่อง \S.* จางหายไปโดยไม่มีใครตอบ$/);
    expect(t(m('omen', 'DR-09'))).toMatch(/^ลางของ .* ผ่านไปโดยไม่มีใครสังเกต$/);
    expect(t(m('majorOmen', 'WR-03'))).toMatch(/^ลางใหญ่ของ .* ผ่านหน้าเขาไปโดยไม่มีใครบอก$/);
    expect(t(m('crisis', 'T3'))).toBe('คนใกล้ตัว ผ่านวิกฤตไปโดยไม่มีใครเอ่ยปากช่วย');
    expect(new Set(['battle', 'prayer', 'omen', 'majorOmen', 'crisis'].map((k) => t(m(k, undefined)))).size).toBe(5);
  });

  it('names the person of a crisis from its announcement, and tells a death before the card apart', () => {
    const crisis: LogEntry = { n: 3, worldYear: 450, sys: 'bonds', kind: 'crisis', id: 'T3', level: 2, data: { name: 'ไลลินา', line: 'สหาย', tie: 'T3', npc: null } };
    const out = lines(data, [crisis, m('crisis', 'T3')], 0).map((l) => l.text);
    expect(out.pop()).toBe('ไลลินา (สหาย) ผ่านวิกฤตไปโดยไม่มีใครเอ่ยปากช่วย');
    expect(say(data, m('battle', undefined, { death: true }))).toBe('เขาตายในศึกโดยไม่มีใครกระซิบ');
    expect(say(data, m('prayer', 'heal', { death: true }))).toMatch(/^เขาตายไปก่อนที่ใครจะตอบคำอธิษฐาน/);
  });

  it('is in the log of a life where the kind is off', () => {
    const g = game('battle', { battle: false });
    const out = lines(data, g.state.log, 1).filter((l) => l.sys === 'attention');
    expect(out.map((l) => l.text)).toContain('เขาออกศึกโดยไม่มีใครกระซิบ');
  });
});

describe('command: canDo', () => {
  beforeEach(() => resetActions());

  it('says yes, or why not: no living character, the cost, a cap, a cooldown with the time left, an action nobody registered', () => {
    const c = makeCtx(newGame(1), {});
    onAction('whisper', {
      check: (x) => (x.state.life ? (x.state.god.light < 5 ? 'แสงศรัทธาไม่พอ (ต้อง 5)' : null) : 'ไม่มีตัวละครที่มีชีวิต'),
      preview: () => ({}),
      run: () => {
        throw new Error('canDo must not run');
      },
    });
    onAction('chest.open', { check: () => 'เปิดหีบครบตามเพดานของปีนี้แล้ว', preview: () => ({}), run: () => undefined });
    onAction('miracle', { check: () => 'ฝนต้องฤดู ต้องรออีก 12 ปีโลก', preview: () => ({}), run: () => undefined });
    onAction('decree', { check: () => 'ไม่ระบุประเทศ', preview: () => ({}), run: () => undefined });
    expect(canDo(c, 'whisper')).toMatchObject({ ok: false, why: 'noLife' });
    c.state.life = blank();
    expect(canDo(c, 'whisper')).toMatchObject({ ok: false, why: 'cost', reason: 'แสงศรัทธาไม่พอ (ต้อง 5)' });
    c.state.god.light = 9;
    expect(canDo(c, 'whisper')).toEqual({ ok: true });
    expect(canDo(c, 'chest.open')).toMatchObject({ ok: false, why: 'cap' });
    expect(canDo(c, 'miracle', { id: 'MR-01' })).toEqual({ ok: false, why: 'cooldown', reason: 'ฝนต้องฤดู ต้องรออีก 12 ปีโลก', wait: 12 });
    expect(canDo(c, 'decree')).toMatchObject({ ok: false, why: 'other' });
    expect(canDo(c, 'dream.send')).toMatchObject({ ok: false, why: 'unknown' });
    expect(c.state.logN).toBe(0); // nothing written, nothing rolled
  });
});
