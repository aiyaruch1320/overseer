// The text system: the name registry, the choice of words and the Thai lines of the log.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, makeCtx, versions, type Ctx, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { MAX_NAME, VOICES } from '../../src/core/text/tuning';
import { describe as say, fill, lines, nameCharacter, nameTaken, pickText, registerName, slotsOf, textSystem, type LibLine } from '../../src/core/text';
import type { Country, NpcsFile } from '../../src/core/data/types-npcs';
import type { TemplatesData } from '../../src/core/data/types-text';
import type { LifeState, LogEntry } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function ctxOf(seed: number): Ctx {
  return makeCtx(newGame(seed, versions(data)), data);
}

function life(over: Partial<LifeState> = {}): LifeState {
  return {
    id: 'L1', name: '', race: 'human', gender: 'm', birthYear: 0, lifespan: 75, hAge: 20, country: 'AL-01', home: 'AL-01', traits: [], aptitudes: {}, skills: [], blessings: [], curses: [], fate: [], cls: 'c3', gold: 0,
    stats: { pow: 1, mag: 1, spd: 1, luk: 1, int: 1, vit: 1 }, items: [], flags: [], passed: {}, pending: [], memory: [], godFaith: 0, heart: 0, ext: {}, ...over,
  };
}

describe('text: the registry of names', () => {
  it('never gives one name twice in a world, never a name of the documents, never more than 24 letters', () => {
    const ctx = ctxOf(1);
    const races = (data.races.items as { races: { id: string }[] }).races.map((r) => r.id);
    const countries = (data.countries.items as Country[]).map((c) => c.id);
    const fixed = new Set([...(data.npcs.items as NpcsFile).npcs.map((n) => n.name), ...(data.countries.items as Country[]).map((c) => c.name)]);
    const names: string[] = [];
    for (let i = 0; i < 1500; i++) {
      const l = life({ id: `L${i}`, race: races[i % races.length], gender: i % 2 ? 'f' : 'm', country: countries[(i * 7) % countries.length] });
      const n = nameCharacter(ctx, l);
      expect(n.length).toBeGreaterThan(0);
      expect([...n].length).toBeLessThanOrEqual(MAX_NAME);
      expect(fixed.has(n), n).toBe(false);
      names.push(n);
    }
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(ctx.state.world.names)).toHaveLength(1500);
    // the registry knows every one of them
    for (const n of names) expect(nameTaken(ctx, n)).toBe(true);
  });

  it('is decided by the seed alone (the `names` stream), and the stream does not disturb the others', () => {
    const run = (seed: number) => {
      const ctx = ctxOf(seed);
      const out = [1, 2, 3, 4, 5].map((i) => nameCharacter(ctx, life({ id: `L${i}`, race: 'elf' })));
      return { out, streams: Object.keys(ctx.state.rng) };
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5).out).not.toEqual(run(6).out);
    expect(run(5).streams).toEqual(['names']);
  });

  it('a name already taken is replaced by the next one, the same key gets its name back', () => {
    const ctx = ctxOf(1);
    expect(registerName(ctx, 'a', 'ฟอร์เบลน')).toBe('ฟอร์เบลน');
    expect(registerName(ctx, 'b', 'ฟอร์เบลน', () => 'ฟอร์เบลนใหม่')).toBe('ฟอร์เบลนใหม่');
    expect(registerName(ctx, 'a', 'อย่างอื่น')).toBe('ฟอร์เบลน');
    expect(registerName(ctx, 'c', 'ฟอร์เบลน')).toBe('ฟอร์เบลน2'); // no alternative: a number
    // a name of the documents is taken from the start
    const npc = (data.npcs.items as NpcsFile).npcs[0].name;
    expect(registerName(ctx, 'd', npc, () => 'คนอื่น')).toBe('คนอื่น');
  });

  it('peoples sound different: each voice has its own head syllables', () => {
    const heads = Object.values(VOICES).map((v) => v.heads.join('|'));
    expect(new Set(heads).size).toBe(heads.length);
  });

  it('names the character in the birth hook and writes the registry and one log entry', () => {
    const g = new Game(newGame(3, versions(data)), data, [textSystem]);
    g.state.life = life({ race: 'dwarf', country: 'KD-02' });
    g.born();
    const l = g.state.life!;
    expect(l.name).not.toBe('');
    expect(g.state.world.names['char:L1']).toBe(l.name);
    const e = g.state.log.find((x) => x.kind === 'named')!;
    expect(e.data.name).toBe(l.name);
    expect(e.data.race).toBe('คนแคระ');
    expect(l.ext.text).toEqual({ used: [] });
  });

  it('keeps a name the player gave and still registers it', () => {
    const g = new Game(newGame(3, versions(data)), data, [textSystem]);
    g.state.life = life({ name: 'ลูน่า' });
    g.born();
    expect(g.state.life!.name).toBe('ลูน่า');
    expect(g.state.world.names['char:L1']).toBe('ลูน่า');
  });
});

describe('text: choosing words', () => {
  it('fills every slot or skips the line', () => {
    expect(fill('{ชื่อตัวละคร} ขอฝน', { ชื่อตัวละคร: 'มิรา' })).toBe('มิรา ขอฝน');
    expect(fill('{ชื่อตัวละคร} ขอฝนที่{ชื่อของที่นี่}', { ชื่อตัวละคร: 'มิรา' })).toBeNull();
    expect(fill('{a}{a}', { a: 3 })).toBe('33');
  });

  it('takes the library (tier 1) before the templates and never shows a line twice in one life', () => {
    const ctx = ctxOf(2);
    ctx.state.life = life({ name: 'มิรา' });
    const seen = new Set<string>();
    let reused = false;
    for (let i = 0; i < 30; i++) {
      const p = pickText(ctx, { lib: { set: 'prayer', keys: { kind: 'heal', voice: 'ภักดี' } } });
      expect(p).not.toBeNull();
      expect(p!.tier).toBe(1);
      expect(p!.text).not.toMatch(/[{}]/);
      expect(p!.text).toContain('มิรา');
      if (p!.reused) reused = true;
      else {
        expect(seen.has(p!.id), p!.id).toBe(false);
        seen.add(p!.id);
      }
    }
    // the set holds a handful of lines for this kind and voice: once they are used up, lines come again (flagged)
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(reused).toBe(true);
    expect((ctx.state.life.ext.text as { used: string[] }).used.length).toBe(seen.size);
  });

  it('a new life starts with nothing shown: lines used up in the last life come back', () => {
    const ctx = ctxOf(2);
    const spec = { lib: { set: 'omen', keys: { hint: 'ระวัง', scene: 'เมือง' } } };
    ctx.state.life = life({ name: 'มิรา' });
    const ids1 = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = pickText(ctx, spec)!;
      if (!p.reused) ids1.add(p.id);
    }
    expect(ids1.size).toBe(6);
    ctx.state.life = life({ id: 'L2', name: 'โนร่า' });
    const ids2 = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = pickText(ctx, spec)!;
      expect(p.reused).toBe(false);
      ids2.add(p.id);
    }
    expect([...ids2].some((id) => ids1.has(id))).toBe(true);
  });

  it('falls back to the templates (tier 0) when there is no library line, and never returns a line with a hole', () => {
    const noLib: GameData = { ...data };
    for (const k of Object.keys(noLib)) if (k.startsWith('library.')) delete noLib[k];
    const ctx = makeCtx(newGame(2, versions(noLib)), noLib);
    ctx.state.life = life({ name: 'มิรา' });
    const p = pickText(ctx, { lib: { set: 'omen', keys: { hint: 'ระวัง', scene: 'เมือง' } }, tpl: { file: 'templates-god', family: 'whisper', keys: { คำใบ้: 'ระวัง', ฉาก: 'เมือง' } } })!;
    expect(p.tier).toBe(0);
    expect(p.text).not.toMatch(/[{}]/);
    // a template that asks for a slot nobody supplied is never chosen
    const q = pickText(ctx, { tpl: { file: 'templates-god', family: 'prayer_ask', keys: {} }, slots: {} });
    if (q) expect(q.text).not.toMatch(/[{}]/);
    expect(pickText(ctx, { tpl: { file: 'templates-god', family: 'no_such_family' } })).toBeNull();
  });

  it('every slot of every template and library line is a slot the documents declare', () => {
    const declared = (file: 'templates-god' | 'templates-ending') => new Set((data[file].items as TemplatesData).slots.map((s) => s.slot));
    for (const file of ['templates-god', 'templates-ending'] as const) {
      const ok = declared(file);
      const all = (data[file].items as TemplatesData).templates;
      expect(all.length).toBeGreaterThan(400);
      for (const t of all) {
        const used = slotsOf(t.text);
        for (const s of used) expect(ok.has(s), `${t.id} uses {${s}}`).toBe(true);
        // with every declared slot supplied the line has no hole left
        const values = Object.fromEntries([...ok].map((s) => [s, 'x']));
        expect(fill(t.text, values), t.id).not.toBeNull();
        expect(fill(t.text, values)).not.toMatch(/[{}]/);
      }
    }
    const god = declared('templates-god');
    let n = 0;
    for (const k of Object.keys(data).filter((x) => x.startsWith('library.'))) {
      for (const l of data[k].items as LibLine[]) {
        n++;
        for (const s of slotsOf(l.text)) expect(god.has(s), `${k}: {${s}}`).toBe(true);
        const f = fill(l.text, Object.fromEntries([...god].map((s) => [s, 'x'])));
        expect(f).not.toBeNull();
        expect(f).not.toMatch(/[{}]/);
      }
    }
    expect(n).toBeGreaterThan(1500);
  });
});

describe('text: the log in Thai', () => {
  const e = (over: Partial<LogEntry>): LogEntry => ({ n: 1, worldYear: 450, sys: 'npc', kind: 'npc', data: {}, level: 1, ...over });

  it('says every kind of NPC entry in words', () => {
    const base = { holder: 'ไอรัสวาร์', gen: 2, role: 'ผู้นำ', place: 'AZ-01' };
    const kinds: [Record<string, string | number | boolean | null>, string][] = [
      [{ what: 'open' }, 'เรื่องของ'],
      [{ what: 'end', path: 'b', text: 'ถูกปลด' }, 'ถูกปลด'],
      [{ what: 'end', path: '-' }, 'เรื่องจางหาย'],
      [{ what: 'die', age: 70, cause: 'ชราภาพ' }, 'ตาย'],
      [{ what: 'vanish' }, 'หายสาบสูญ'],
      [{ what: 'succeed', from: 'ไอรัสวาร์ที่ 1' }, 'รับตำแหน่ง'],
      [{ what: 'move', to: 'AZ-02' }, 'ย้าย'],
      [{ what: 'meet' }, 'ได้พบ'],
      [{ what: 'ally' }, 'พวกพ้อง'],
    ];
    for (const [d, word] of kinds) {
      const t = say(data, e({ id: 'AZ01-1', data: { ...base, ...d } }));
      expect(t, JSON.stringify(d)).toContain(word);
      expect(t).not.toMatch(/undefined|\[object/);
    }
  });

  it('names events, story nodes and their choices from the data, and the birth and the death', () => {
    expect(say(data, e({ sys: 'world', kind: 'event', id: 'DR-01' }))).toContain('ฟ้าถล่ม');
    const node = say(data, e({ sys: 'story', kind: 'node', id: 'hu.b1', data: { choice: 'a' } }))!;
    expect(node).toContain('บ้านที่เกิด');
    expect(node).toContain('ครอบครัวชาวนา');
    expect(say(data, e({ sys: 'game', kind: 'death', level: 3, data: { cause: 'ชราภาพ', hAge: 70 } }))).toContain('70');
    expect(say(data, e({ sys: 'text', kind: 'named', data: { name: 'มิรา', race: 'เอลฟ์', home: 'ซิลวาเนล', cls: 'สามัญชน', year: 10450 } }))).toContain('มิรา');
  });

  it('is pure: the same entry gives the same line and nothing is written', () => {
    const ctx = ctxOf(1);
    const entry = e({ sys: 'text', kind: 'named', data: { name: 'มิรา', race: 'เอลฟ์', home: 'ซิลวาเนล', cls: 'สามัญชน', year: 10450 } });
    const before = JSON.stringify(ctx.state);
    expect(say(data, entry)).toBe(say(data, entry));
    expect(JSON.stringify(ctx.state)).toBe(before);
  });

  it('leaves out trace entries and shows an unknown system plainly', () => {
    expect(say(data, e({ level: 0, sys: 'x', kind: 'y' }))).toBeNull();
    expect(say(data, e({ level: 1, sys: 'bonds', kind: 'tie', id: 'FT-01' }))).toContain('bonds/tie');
    const ls = lines(data, [e({ n: 1, level: 0, sys: 'x', kind: 'y' }), e({ n: 2, level: 2, data: { what: 'meet', holder: 'มิรา', role: '', place: 'AZ-01' } })], 1);
    expect(ls).toHaveLength(1);
    expect(ls[0].year).toBe(10850);
  });
});
