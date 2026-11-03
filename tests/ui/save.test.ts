// Saving and loading in the browser (src/app/store.ts, src/app/save-text.ts): the save is packed (gzip + base64), an older plain save still loads,
// a full storage says so and keeps the old save, and a save made with other data files loads with the list of what moved. `localStorage` is a stand-in.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { GameStore } from '../../src/app/store';
import { PACKED, pack, unpack } from '../../src/app/save-text';
import { SAVE_WORDS } from '../../src/app/save-words';
import { SAVE_KEY } from '../../src/app/tuning';
import type { GameData } from '../../src/core/game';
import { save } from '../../src/core/save';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

class FakeStorage {
  items = new Map<string, string>();
  /** Characters the storage takes before it answers with a QuotaExceededError. */
  quota = Infinity;
  getItem = (k: string) => this.items.get(k) ?? null;
  removeItem = (k: string) => void this.items.delete(k);
  setItem = (k: string, v: string) => {
    const used = [...this.items].filter(([key]) => key !== k).reduce((n, [, x]) => n + x.length, 0);
    if (used + v.length > this.quota) throw new DOMException('full', 'QuotaExceededError');
    this.items.set(k, v);
  };
}

let ls: FakeStorage;
beforeEach(() => {
  ls = new FakeStorage();
  (globalThis as { localStorage?: unknown }).localStorage = ls;
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

/** A store with a life that has run a while (the log and the NPCs make the text big, like a real save). */
function played(seed = 7, beats = 120): GameStore {
  const s = new GameStore();
  s.setData(data);
  s.newLife({ seed });
  s.pause();
  for (let i = 0; i < beats; i++) s.step();
  return s;
}

describe('save text: packed and plain', () => {
  it('packs behind the mark and unpacks to the same text, Thai included', async () => {
    const text = JSON.stringify({ a: 'ชีวิตของเขา '.repeat(500), b: [1, 2, 3] });
    const p = await pack(text);
    expect(p.startsWith(PACKED)).toBe(true);
    expect(p.length).toBeLessThan(text.length / 5);
    expect(await unpack(p)).toBe(text);
  });

  it('a text without the mark is an older plain save and comes back as it is', async () => {
    expect(await unpack('{"schema":1}')).toBe('{"schema":1}');
  });
});

describe('store: save and load of the browser', () => {
  it('a save is much smaller packed than the plain state, and the note beside it says the age', async () => {
    const s = played();
    const r = await s.saveLocal();
    expect(r.ok).toBe(true);
    const plain = save(s.state!).length;
    const stored = ls.getItem(SAVE_KEY)!;
    expect(stored.startsWith(PACKED)).toBe(true);
    expect(stored.length).toBeLessThan(plain / 3);
    expect(s.localSave()?.age).toBe(s.state!.life!.hAge);
    if (r.ok) expect(r.text).toBe(SAVE_WORDS.saved(s.state!.life!.hAge));
  });

  it('loads what it saved: the same state, paused, no warning', async () => {
    const a = played();
    await a.saveLocal();
    const b = new GameStore();
    b.setData(data);
    const r = await b.loadLocal();
    expect(r).toEqual({ ok: true, stale: [] });
    expect(b.state!.life!.hAge).toBe(a.state!.life!.hAge);
    expect(b.state!.logN).toBe(a.state!.logN);
    expect(b.running.value).toBe(false);
    expect(b.phase.value).toBe('watch');
    expect(b.notice.value).toBeNull();
  });

  it('an older plain save still loads', async () => {
    const a = played();
    ls.setItem(SAVE_KEY, save(a.state!));
    const b = new GameStore();
    b.setData(data);
    const r = await b.loadLocal();
    expect(r.ok).toBe(true);
    expect(b.state!.logN).toBe(a.state!.logN);
  });

  it('a save made with other data files loads and the notice names the files that moved', async () => {
    const a = played();
    const st = JSON.parse(save(a.state!)) as { data: Record<string, string> };
    const file = Object.keys(st.data)[0];
    st.data[file] = 'old';
    ls.setItem(SAVE_KEY, JSON.stringify(st));
    const b = new GameStore();
    b.setData(data);
    const r = await b.loadLocal();
    expect(r).toEqual({ ok: true, stale: [file] });
    expect(b.notice.value).toBe(SAVE_WORDS.stale([file]));
  });

  it('a full storage says so and the old save stays', async () => {
    const a = played();
    expect((await a.saveLocal()).ok).toBe(true);
    const old = ls.getItem(SAVE_KEY);
    ls.quota = 10;
    const r = await a.saveLocal();
    expect(r.ok).toBe(false);
    expect(r.text).toContain(SAVE_WORDS.full);
    expect(ls.getItem(SAVE_KEY)).toBe(old);
  });

  it('no save, and a broken one, give a reason and no game', async () => {
    const b = new GameStore();
    b.setData(data);
    expect(b.localSave()).toBeNull();
    expect((await b.loadLocal()).ok).toBe(false);
    ls.setItem(SAVE_KEY, 'not json');
    const r = await b.loadLocal();
    expect(r).toEqual({ ok: false, reason: SAVE_WORDS.unreadable });
    ls.setItem(SAVE_KEY, `${PACKED}!!!`);
    expect((await b.loadLocal()).ok).toBe(false);
    expect(b.state).toBeNull();
  });
});
