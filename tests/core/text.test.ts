// The text system: the name registry, the choice of words and the Thai lines of the log.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, makeCtx, versions, type Ctx, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { MAX_NAME, VOICES } from '../../src/core/text/tuning';
import { describe as say, displayLevel, fill, labels, leaks, lines, nameCharacter, nameTaken, pickText, questionOf, registerName, scrub, sentence, slotsOf, textSystem, unphrased, type LibLine } from '../../src/core/text';
import type { Country, NpcsFile } from '../../src/core/data/types-npcs';
import type { TemplatesData } from '../../src/core/data/types-text';
import type { LifeState, LogEntry } from '../../src/core/types';

const e = (over: Partial<LogEntry>): LogEntry => ({ n: 1, worldYear: 450, sys: 'npc', kind: 'npc', data: {}, level: 1, ...over });

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

  it('leaves out trace entries, and an entry with no phrasing is shown plainly only to the developer', () => {
    expect(say(data, e({ level: 0, sys: 'x', kind: 'y' }))).toBeNull();
    const tie = e({ level: 1, sys: 'bonds', kind: 'tie', id: 'FT-01' });
    expect(say(data, tie)).toBeNull();
    expect(say(data, tie, { raw: true })).toContain('bonds/tie');
    expect(unphrased(data, [tie, tie, e({ n: 3, level: 0, sys: 'x', kind: 'y' })])).toEqual({ 'bonds/tie': 2 });
    const ls = lines(data, [e({ n: 1, level: 0, sys: 'x', kind: 'y' }), e({ n: 2, level: 2, data: { what: 'meet', holder: 'มิรา', role: '', place: 'AZ-01' } })], 1);
    expect(ls).toHaveLength(1);
    expect(ls[0].year).toBe(10850);
  });
});

describe('text: words only (review M1 T1 T3)', () => {
  const L = () => labels(data);

  it('cuts a table cell down to the sentence of the way', () => {
    expect(sentence(data, 'ไม่มีญาติรับ ถูกฝากที่อื่น · ตกชนชั้นหนึ่งชั้น · เปิดเส้น bd.b1 ถ้าเกิดในประเทศท่าที D L M')).toBe('ไม่มีญาติรับ ถูกฝากที่อื่น');
    expect(sentence(data, 'เพื่อนวัยเด็กเผ่าเดียวกันที่เล่นด้วยกันทุกวัน · สายสหายระดับ 2 · 30% ได้ไอเทมคู่ PR-01 PR-02 หรือ PR-03')).toBe('เพื่อนวัยเด็กเผ่าเดียวกันที่เล่นด้วยกันทุกวัน');
    expect(sentence(data, 'อยู่ที่เดิมและเพื่อนไปคนเดียว · เรื่องของเพื่อนเดินเองต่อ (แม่แบบ )')).toBe('อยู่ที่เดิมและเพื่อนไปคนเดียว');
    expect(sentence(data, 'ยุค 4 → cv.16')).toBe('ถึงยุคที่ 4');
    expect(sentence(data, '+1 · ไปค้าขาย')).toBe('ไปค้าขาย');
    expect(sentence(data, 'ก๊อบลินที่เคยได้ขนม (ha.b2 ทาง ค) ช่วยแก้เชือก · มิฉะนั้นหนี')).toBe('ก๊อบลินที่เคยได้ขนม ช่วยแก้เชือก');
  });

  it('turns ids into names and never leaves an id, a template code or a stat mark', () => {
    const mk = L().name.get('MK-16')!;
    expect(mk).toBeTruthy();
    expect(scrub(data, 'ถูกจ้างโดย MK-16')).toBe(`ถูกจ้างโดย ${mk}`);
    expect(scrub(data, 'hunter หรือ beast_hunter')).toBe('นายพราน หรือ นักล่าอสูร');
    expect(scrub(data, 'ทอง +300 · B −2 · ×3 · 30% PR-01 FT-03 KN-08 {สหาย:น้อยใจ@2}')).toBe('ทอง');
    for (const t of ['หรือ หรือ หรือ', 'ถ้าเป็น หรือ หรือ หรือ หรือ', '( ×3)', '(แม่แบบ )', 'ล่าในเขต (MH-01) ออร์คจับ ( หัวข้อ 6) bd.b1 cv.14']) expect(leaks(scrub(data, t)), t).toEqual([]);
  });

  it('keeps the name of an NPC once when the document writes the id before the name', () => {
    const row = data.npcs.items as { npcs: { id: string; name: string }[] };
    const n = row.npcs.find((x) => x.id === 'SV07-1')!;
    expect(n).toBeTruthy();
    expect(scrub(data, `หอสมุดใบไม้ (SV07-1 ${n.name})`)).toBe(`หอสมุดใบไม้ (${n.name})`);
    expect(scrub(data, 'พบ SV07-1 ที่ห้องสมุด')).toBe(`พบ ${n.name} ที่ห้องสมุด`);
  });

  it('does not say ชนชั้น twice when the class name already begins with it', () => {
    for (let n = 0; n < 12; n++) {
      const t = say(data, e({ n, worldYear: 400 + n, sys: 'text', kind: 'named', id: `L${n}`, data: { name: 'มิรา', race: 'เอลฟ์', home: 'ซิลวาเนล', cls: 'ชนชั้นล่าง', year: '10,450' } }))!;
      expect(t).not.toContain('ชนชั้นชนชั้น');
    }
  });

  it('has a detector that finds codes and badly cut sentences', () => {
    expect(leaks('ถูกจ้างโดย MK-16')).toContain('country');
    expect(leaks('งาน WR-21 เกิด')).toContain('event or template');
    expect(leaks('ไป hu.a1 เร็วขึ้น')).toContain('node');
    expect(leaks('ถ้าเป็น cv.14')).toContain('convergence');
    expect(leaks('ได้ ns_pack_lead')).toContain('snake id');
    expect(leaks('เสี่ยง หรือ หรือ ไป')).toContain('หรือ หรือ');
    expect(leaks('เรื่อง ( ) จบ')).toContain('empty brackets');
    expect(leaks('ศึก:  · ชนะ')).toContain('double space');
    expect(leaks('ศึก: ชนะ · ')).toContain('empty middle dot');
    expect(leaks('ศึกกับ NPC ที่หนึ่ง')).toEqual([]);
    expect(leaks('เจอโอเกอร์ในป่า ชนะ')).toEqual([]);
  });

  it('says the way taken at a rite and at a convergence from the data (T2)', () => {
    const node = (id: string, d: Record<string, string | number | boolean | null>) => say(data, e({ sys: 'story', kind: 'node', id, data: d }))!;
    const variants = node('be.t1', { choice: 'a', label: 'อูฐ จิ้งจกทราย: ns_beast_sign 15%', title: 'การล่าครั้งแรก' });
    expect(variants).toContain('การล่าครั้งแรก');
    expect(variants).toContain('นำคาราวานไปโอเอซิส');
    expect(variants).toContain('ผ่าน');
    expect(node('be.t1', { choice: 'b', label: 'หมาป่า: ถูกลดชั้นในฝูง', title: 'การล่าครั้งแรก' })).toContain('ไม่ผ่าน');
    expect(leaks(variants)).toEqual([]);
    expect(node('el.t1', { choice: 'a', label: 'ผูกได้', title: 'พิธีผูกราก' })).toBe('พิธีผูกราก — ผูกได้');
    const cv = L().name.get('cv.1')!;
    expect(node('hu.a4', { choice: 'a', label: 'แบ่งน้ำและสร้างค่าย', title: cv, cv: 'cv.1' })).toBe(`${cv} — แบ่งน้ำและสร้างค่าย`);
    // the label is missing from the entry: it is read from the data by node and key
    expect(node('cv.1', { choice: 'a', title: cv })).toBe(`${cv} — แบ่งน้ำและสร้างค่าย`);
  });

  it('shows no id of a node, an event, a country or a job in any line it can be asked for', () => {
    const entries: LogEntry[] = [
      e({ sys: 'character', kind: 'grant', id: 'c_bounty', data: { kind: 'curse', from: 'sl.b2' } }),
      e({ sys: 'character', kind: 'job', id: 'hunter', data: { type: 'common' } }),
      e({ sys: 'character', kind: 'job', id: 'zz_unknown', data: { type: 'common' } }),
      e({ sys: 'world', kind: 'event', id: 'WR-21', data: { name: '' } }),
      e({ sys: 'world', kind: 'event', id: 'ZZ-99', data: {} }),
      e({ sys: 'npc', kind: 'npc', id: 'AZ01-1', data: { what: 'end', holder: 'ไอรัสวาร์', role: 'ผู้นำ', place: 'MK-14', path: 'b', text: 'ถูกจ้างโดย MK-16 · ไว้ใจ +3' } }),
    ];
    for (const en of entries) {
      const t = say(data, en);
      if (t !== null) expect(leaks(t), JSON.stringify(en)).toEqual([]);
    }
    expect(say(data, entries[2])).toBeNull();
    expect(say(data, entries[4])).toBeNull();
  });
});

describe('text: what the player is told and not told', () => {
  const at = (n: number, over: Partial<LogEntry>): LogEntry => ({ n, worldYear: 450, sys: 'npc', kind: 'npc', data: {}, level: 1, age: 20, ...over });
  const birth = at(1, { sys: 'character', kind: 'birth', id: 'human', level: 3, age: 0, data: { race: 'human', country: 'AL-01', gender: 'f', born: 'main', cls: 'c3' } });
  const named = at(2, { sys: 'text', kind: 'named', id: 'L1', age: 0, data: { name: 'มิรา', race: 'มนุษย์', home: 'โอรันธาร์', cls: 'สามัญชน', year: '10,450', country: 'AL-01' } });

  it('says the cause, the place and the age of the death in one sentence (T8)', () => {
    const country = labels(data).name.get('AL-01')!;
    const death = (cause: string, hAge: number, extra: LogEntry[] = []) => lines(data, [birth, named, ...extra, at(9, { sys: 'game', kind: 'death', level: 3, age: undefined, data: { cause, hAge } })]).pop()!.text;
    const old = death('old', 75);
    expect(old).toContain('มิรา');
    expect(old).toContain('ชราภาพ');
    expect(old).toContain(country);
    expect(old).toContain('75');
    expect(death('violence', 26)).toContain('ถูกทำร้าย');
    expect(death('illness', 33)).toContain('โรคภัย');
    expect(death('accident', 40)).toContain('อุบัติเหตุ');
    // a death caused by a node names the node
    const node = at(3, { sys: 'story', kind: 'node', id: 'hu.b1', data: { choice: 'a', title: 'บ้านที่เกิด', label: 'x' } });
    expect(death('story', 20, [node])).toContain('บ้านที่เกิด');
    // without the log before it, a death still reads as a sentence with the age
    expect(say(data, at(9, { sys: 'game', kind: 'death', level: 3, data: { cause: 'old', hAge: 70 } }))).toContain('70');
  });

  it('keeps mood lines and bond templates out of the story the player reads (T4) but in the log', () => {
    const mood = at(3, { sys: 'story', kind: 'mood', id: 'สหาย', data: { mood: 'ยินดี', level: 1, node: 'bn.b1' } });
    const tpl = at(4, { sys: 'story', kind: 'template', id: 'PR-01', data: { type: 'PR' } });
    const bond = at(5, { sys: 'story', kind: 'bond', id: 'สหาย', data: { level: 2 } });
    expect(displayLevel(mood)).toBe(0);
    expect(lines(data, [birth, named, mood, tpl, bond], 1)).toHaveLength(1);
    expect(lines(data, [birth, named, mood, tpl, bond], 0)).toHaveLength(1);
    expect(mood.level).toBe(1);
  });

  it('shows the death, heir or end of a holder the character met, and meetings in the character’s country (T5, round 2)', () => {
    const npc = (n: number, id: string, place: string, what: string) => at(n, { id, data: { what, holder: 'ไอรัสวาร์', role: 'ผู้นำ', place, age: 70, cause: 'ชราภาพ', from: 'x' } });
    const npcLines = (log: LogEntry[]) => lines(data, log).filter((l) => l.sys === 'npc');
    // a stranger's death is not news, in another country or in the character's own
    expect(npcLines([birth, named, npc(3, 'MH04-1', 'MH-04', 'die')])).toHaveLength(0);
    expect(npcLines([birth, named, npc(3, 'AL01-2', 'AL-01', 'die')])).toHaveLength(0);
    // met earlier: shown wherever he is
    const met = at(4, { id: 'MH04-1', level: 2, data: { what: 'meet', holder: 'ไอรัสวาร์', role: 'ผู้นำ', place: 'MH-04' } });
    expect(npcLines([birth, named, met, npc(5, 'MH04-1', 'MH-04', 'die')])).toHaveLength(2);
    // before the life there is no country to compare with: nothing is hidden
    expect(npcLines([npc(3, 'MH04-1', 'MH-04', 'die')])).toHaveLength(1);
  });

  it('joins a holder’s death and the succession of the same year in one line', () => {
    const die = at(3, { id: 'AL01-2', data: { what: 'die', holder: 'ไอรัสวาร์ที่ 1', role: 'ผู้นำ', place: 'AL-01', age: 70, cause: 'ชราภาพ' } });
    const next = at(4, { id: 'AL01-2', data: { what: 'succeed', holder: 'ไอรัสวาร์ที่ 2', role: 'ผู้นำ', place: 'AL-01', from: 'ไอรัสวาร์ที่ 1' } });
    const met = at(2, { id: 'AL01-2', level: 2, data: { what: 'meet', holder: 'ไอรัสวาร์ที่ 1', role: 'ผู้นำ', place: 'AL-01' } });
    const ls = lines(data, [birth, named, met, die, next]).filter((l) => l.sys === 'npc' && !l.text.includes('ได้พบ'));
    expect(ls).toHaveLength(1);
    expect(ls[0].text).toContain('ไอรัสวาร์ที่ 1');
    expect(ls[0].text).toContain('ไอรัสวาร์ที่ 2');
  });

  it('names the enemy of a battle, or says only "ศึก" (T1)', () => {
    const goblin = labels(data).kind.enemy.get('goblin')!;
    const battle = (d: Record<string, string | number | boolean | null>) => say(data, at(3, { sys: 'story', kind: 'battle', level: 2, data: d }))!;
    expect(battle({ result: 'win', enemies: 'goblin', text: null })).toBe(`ศึก: ${goblin} · ชนะ`);
    expect(battle({ result: 'lose', enemies: '', text: `${goblin} ห้าตัว` })).toBe(`ศึก: ${goblin} · แพ้`);
    expect(battle({ result: 'flee', enemies: '', text: 'ค่าแรง ×1.5 สุ่มหนึ่งครั้งต่อปี' })).toBe('ศึก · หนี');
    expect(battle({ result: 'win', enemies: 'no_such_enemy', text: null })).toBe('ศึก · ชนะ');
  });

  it('puts the birth lines before what the other systems wrote in the same moment', () => {
    const meet = at(2, { id: 'AL01-2', level: 2, age: 0, data: { what: 'meet', holder: 'ไอรัสวาร์', role: 'ผู้นำ', place: 'AL-01' } });
    const node = at(3, { sys: 'story', kind: 'node', id: 'hu.b1', age: 0, data: { choice: 'a', title: 'บ้านที่เกิด', label: 'x' } });
    const inOrder = lines(data, [birth, meet, node, { ...named, n: 4 }, { ...named, n: 5, kind: 'family', data: { name: 'มิรา', gender: 'f' } }]);
    expect(inOrder.map((l) => l.sys)).toEqual(['text', 'text', 'npc', 'story']);
    // a play that reads only the new part of the log gets the same order
    expect(lines(data, [birth, meet, node, { ...named, n: 4 }], 1, 2).map((l) => l.sys)).toEqual(['text', 'npc', 'story']);
  });

  it('says a change of class (T9)', () => {
    const up = say(data, at(3, { sys: 'tools', kind: 'class', level: 2, data: { from: 'c2', to: 'c3', up: 1 } }))!;
    expect(up).toContain('สูงขึ้น');
    expect(say(data, at(3, { sys: 'tools', kind: 'class', level: 2, data: { from: 'c3', to: 'c2', up: -1 } }))).toContain('ตก');
  });

  it('writes the birth as four lines: who, family, traits, the question of the life (T6)', () => {
    const g = new Game(newGame(7, versions(data)), data, [textSystem]);
    g.state.life = life({ race: 'beast', gender: 'f', country: 'MH-04', home: 'MH-04', traits: ['reckless', 'kind'], cls: 'c2' });
    g.born();
    expect(g.state.log.filter((x) => x.sys === 'text').map((x) => x.kind)).toEqual(['named', 'family', 'traits', 'question']);
    const ls = lines(data, g.state.log).map((l) => l.text);
    expect(ls).toHaveLength(4);
    expect(ls[1]).toContain('เพศหญิง');
    expect(ls[1]).toContain('ครอบครัวเป็นชนชั้นล่าง');
    expect(ls[2]).toContain('กล้าบ้าบิ่น');
    expect(ls[3]).toBe('คำถามของชีวิต: จะล่าตามสิทธิ์เดิม หรือยอมเปลี่ยนเพื่อให้ฝูงอยู่รอด');
    expect(questionOf(data, 'beast')).toBe(questionOf(data, 'be'));
    for (const t of ls) expect(leaks(t), t).toEqual([]);
  });
});
