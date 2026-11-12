// The "now" box of the god panel, the vow under the name and the first-life strip (proposal review/play-1 §2.3 G1 G4 G5).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { command } from '../../src/core/command';
import type { GameData } from '../../src/core/game';
import { nowFacts, nowItems, withNow, type NowFacts } from '../../src/app/views/now';
import { uiOfState, vowView, watchModel, type CardView } from '../../src/app/views/watch';
import { WATCH_WORDS } from '../../src/app/views/watch-words';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const none: NowFacts = { prayers: [], dream: null, chest: null, calls: [], vow: null };
const card = (kind: CardView['kind'], extra: Partial<CardView> = {}): CardView => ({ n: 1, kind, id: 'x', text: 'เรื่องหนึ่ง', tone: 'fate', left: 2, frac: 1, options: [{ kind: 'decree', args: { id: 'x' } }], ...extra });

describe('now: the items', () => {
  it('nothing waiting: one item of rest, with no button and no price', () => {
    const it = nowItems(none);
    expect(it).toHaveLength(1);
    expect(it[0]).toMatchObject({ id: 'nothing', text: WATCH_WORDS.now.nothing, price: null, buttons: [] });
  });

  it('the order is prayer, dream, chest, omen, battle, vow; three at most', () => {
    const f: NowFacts = {
      prayers: [{ n: 7, name: 'ขอปัญญา', by: '', yearsLeft: 1.5, price: 'แสงศรัทธา 10' }],
      dream: { price: 'แสงศรัทธา 5' },
      chest: { price: '', window: true },
      calls: [{ card: card('omen'), price: null }],
      vow: { kind: 'text', text: 'x' },
    };
    expect(nowItems(f).map((i) => i.id)).toEqual(['prayer', 'dream', 'chest']);
    expect(nowItems({ ...f, prayers: [], dream: null, chest: null }).map((i) => i.id)).toEqual(['omen', 'vow']);
  });

  it('a prayer opens the prayer with its number and shows the price of granting it', () => {
    const [it] = nowItems({ ...none, prayers: [{ n: 7, name: 'ขอปัญญา', by: 'แม่', yearsLeft: 1.5, price: 'แสงศรัทธา 10' }] });
    expect(it.buttons[0].open).toEqual({ kind: 'prayer', args: { id: 7 } });
    expect(it.text).toContain('ขอปัญญา');
    expect(it.price).toContain('แสงศรัทธา 10');
  });

  it('a free price says it is free; no price is not said at all', () => {
    expect(nowItems({ ...none, chest: { price: '', window: false } })[0].price).toBe(WATCH_WORDS.now.free);
    expect(nowItems({ ...none, vow: { kind: 'text', text: 'ระวัง' } })[0].price).toBeNull();
  });

  it('a battle offers the two warnings of the whisper; an omen opens the first option of the card; a crisis opens its help', () => {
    const [b] = nowItems({ ...none, calls: [{ card: card('battle', { options: [] }), price: 'แสงศรัทธา 3' }] });
    expect(b.buttons.map((x) => x.open)).toEqual([
      { kind: 'whisper', args: { why: 'battle', id: 'x', hint: 'ระวัง' } },
      { kind: 'whisper', args: { why: 'battle', id: 'x', hint: 'กล้าเถิด' } },
    ]);
    const [o] = nowItems({ ...none, calls: [{ card: card('majorOmen', { options: [{ kind: 'miracle', args: { id: 'x' } }, { kind: 'decree', args: { id: 'x' } }] }), price: null }] });
    expect(o.buttons[0].open.kind).toBe('miracle');
    const help = { kind: 'whisper' as const, args: { hint: 'ช่วย', target: 'ผู้นั้น' } };
    const [c] = nowItems({ ...none, calls: [{ card: card('crisis', { options: [help] }), price: 'แสงศรัทธา 4' }] });
    expect(c.buttons[0].open).toEqual(help);
  });

  it('the vow of an heir opens the whisper that points at the heir', () => {
    const [v] = nowItems({ ...none, vow: { kind: 'heir', price: 'แสงศรัทธา 6' } });
    expect(v.buttons[0].open).toEqual({ kind: 'whisper', args: { hint: 'ชี้ทายาท' } });
  });
});

describe('now: read from a game', () => {
  it('the model carries the items of the box, each one a known kind', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    const m = withNow(watchModel(data, s.game.state, uiOfState(s.game.state)), s.game, data);
    expect(m.panel.now.length).toBeGreaterThan(0);
    for (const i of m.panel.now) expect(['prayer', 'dream', 'chest', 'omen', 'battle', 'crisis', 'vow', 'nothing']).toContain(i.id);
  });

  it('a waiting prayer becomes the first item and its button opens that prayer', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    let found = false;
    for (let i = 0; i < 200 && s.game.state.life && !s.game.state.life.dead && !found; i++) {
      s.game.beat();
      const f = nowFacts(s.game, data, []);
      if (f.prayers.length) {
        found = true;
        const items = nowItems(f);
        expect(items[0].id).toBe('prayer');
        expect(items[0].buttons[0].open).toEqual({ kind: 'prayer', args: { id: f.prayers[0].n } });
      }
    }
    expect(found).toBe(true);
  });

  it('the chest is said only while a god window is open', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    let seenOpen = false;
    let seenClosed = false;
    for (let i = 0; i < 120 && s.game.state.life && !s.game.state.life.dead; i++) {
      s.game.beat();
      const f = nowFacts(s.game, data, []);
      if (f.chest) {
        seenOpen = true;
        expect(f.chest.window).toBe(true);
      } else seenClosed = true;
    }
    expect(seenOpen).toBe(true);
    expect(seenClosed).toBe(true);
  });

  it('the vow of a life who wants few interventions is a word, without a button', () => {
    const s = createSession(data, { seed: 2 });
    startLife(s);
    s.game.state.god.vows = ['GV-12'];
    const f = nowFacts(s.game, data, []);
    expect(f.vow).toMatchObject({ kind: 'text' });
    const last = nowItems({ ...f, prayers: [], dream: null, chest: null });
    expect(last[0].id).toBe('vow');
    expect(last[0].buttons).toEqual([]);
  });
});

describe('the vow under the name', () => {
  it('names the vow and when it comes true from the god data; no vow reads as none', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    expect(vowView(data, s.game.state)).toBeNull();
    s.game.state.god.vows = ['GV-12'];
    const v = vowView(data, s.game.state);
    expect(v?.name).toContain('ตัวของเขาเอง');
    expect(v?.done).toContain('ห้าครั้ง');
    s.game.state.god.vows = ['GV-06'];
    expect(vowView(data, s.game.state)?.done).not.toContain('](');
    s.game.state.god.vows = ['GV-20'];
    expect(vowView(data, s.game.state)).toBeNull();
    expect(watchModel(data, s.game.state, uiOfState(s.game.state)).vow).toBeNull();
  });
});

describe('the strip of the first life', () => {
  it('shows in the first life of a save until it is dismissed; the dismissal is a setting the core keeps', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    expect(watchModel(data, s.game.state, uiOfState(s.game.state)).firstLife).toBe(true);
    const r = command(s.game.ctx, { type: 'settings', patch: { hintsSeen: { firstLife: true } } });
    expect(r.ok).toBe(true);
    expect(watchModel(data, s.game.state, uiOfState(s.game.state)).firstLife).toBe(false);
    expect(command(s.game.ctx, { type: 'settings', patch: { hintsSeen: { nope: true } as never } }).ok).toBe(false);
  });

  it('is not shown once the lineage has a life behind it', () => {
    const s = createSession(data, { seed: 1 });
    startLife(s);
    s.game.state.lineage.lives.push({ id: 'L1', name: 'x', race: 'human' as never, born: 1, died: 60 });
    expect(watchModel(data, s.game.state, uiOfState(s.game.state)).firstLife).toBe(false);
  });
});
