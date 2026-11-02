// The text system: the name registry, the choice of words and the Thai lines of the log.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { Game, makeCtx, versions, type Ctx, type GameData } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { MAX_NAME, PENDING_FX_TH, VOICES } from '../../src/core/text/tuning';
import { clashStory } from '../../src/core/text/m3';
import { chronicleText, describe as say, displayLevel, fill, fxLine, fxSplit, godTemplate, hasPendingFx, isIndirect, isPendingFx, labels, leaks, lines, nameCharacter, nameTaken, pickText, questionOf, reasonText, registerName, scrub, sentence, slotsOf, spaceDigits, textSystem, unphrased, type LibLine } from '../../src/core/text';
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
    const tie = e({ level: 1, sys: 'bonds', kind: 'not-written-yet', id: 'FT-01' });
    expect(say(data, tie)).toBeNull();
    expect(say(data, tie, { raw: true })).toContain('bonds/not-written-yet');
    expect(unphrased(data, [tie, tie, e({ n: 3, level: 0, sys: 'x', kind: 'y' })])).toEqual({ 'bonds/not-written-yet': 2 });
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

describe('text: the hand of the god and the calls of the game', () => {
  const g = (kind: string, over: Partial<LogEntry> = {}): LogEntry => e({ sys: 'god', kind, level: 2, age: 20, ...over });
  const att = (over: Partial<LogEntry['data']>, id?: string): LogEntry => e({ sys: 'attention', kind: 'call', level: 3, age: 15, ...(id ? { id } : {}), data: { call: 'stop', why: 'age', age: 15, n: '', ids: '', cards: '', until: null, sec: 0, ...over } });

  it('says every entry of the god system in Thai, with no code, and keeps the sums for the panel', () => {
    const cases: [LogEntry, RegExp][] = [
      [g('chest', { id: 'open', level: 1, data: { window: true, slots: 6, ids: '' } }), /^หีบประทานเปิดขึ้น มี 6 ใบ.*ราคาลดลง$/],
      [g('chest', { id: 'reroll', level: 1, data: { n: 2, lock: 0, ids: '' } }), /^ทอยหีบใหม่ครั้งที่ 2$/],
      [g('chest', { id: 'skip', level: 1 }), /^พับหีบเก็บ/],
      [g('chest', { id: 'pick', data: { slot: 1, thing: 'nb_craft_eye', kind: 'bless', tier: 'U', paid: 8, warded: false } }), /^ประทานพร .+ ระดับไม่ธรรมดาแก่/],
      [g('dream', { id: 'hu.a1', data: { choice: 'a', source: 'S1', symbol: 'งู', level: 'ลังเล', paid: 7 } }), /^ส่งฝันถึง.*ภาพงู ใจของเขาดูลังเล$/],
      [g('dream', { id: 'hu.a1', data: { outcome: 'obey', level: 'ลังเล', p: 0.5, source: 'S1', choice: 'a', symbol: 'งู' } }), /ทำตามความฝันของท่าน/],
      [g('dream', { id: 'hu.a1', data: { outcome: 'defy' } }), /ขัดขืนความฝัน/],
      [g('dream', { id: 'hu.a1', level: 1, data: { outcome: 'fade' } }), /เลือนหาย/],
      [g('burden', { id: 'question', data: { age: 20 } }), /ภาระใจเต็ม.*ตั้งคำถามกับพระเจ้า/],
      [g('burden', { id: 'flight', data: { age: 20 } }), /ทิ้งงานหรือบ้าน/],
      [g('prayer', { id: 'heal', data: { n: 3, kind: 'heal', name: 'ขอหายเจ็บ', cost: 6, expires: 14 } }), /^คำอธิษฐานใบที่ 3: ขอหายเจ็บ/],
      [g('prayer', { id: 'kin_sick', data: { n: 4, kind: 'kin_sick', name: 'ขอให้คนสำคัญหายป่วย', npc: 'AL01-1', npcName: 'ไอรัสวาร์' } }), /ผู้ขอคือ ไอรัสวาร์/],
      [g('prayer.give', { id: 'wealth', data: { n: 3, name: 'ขอพ้นความจน', price: 10, fx: 'gold+50' } }), /ท่านให้ตามคำอธิษฐานใบที่ 3 \(ขอพ้นความจน\)/],
      [g('prayer.deny', { id: 'wealth', level: 1, data: { n: 3, name: 'ขอพ้นความจน' } }), /^ท่านปฏิเสธคำอธิษฐานใบที่ 3/],
      [g('prayer.punish', { id: 'wealth', data: { n: 3, name: 'ขอพ้นความจน', dread: 6, fx: 'gold-10 curse:c_poverty' } }), /ท่านลงโทษผู้ขอ.*เสียทอง 10.*ติดคำสาป/],
      [g('prayer.silent', { id: 'wealth', level: 1, data: { n: 3, name: 'ขอพ้นความจน' } }), /ท่านนิ่งเฉย/],
      [g('prayer.lapse', { id: 'wealth', level: 1, data: { n: 3, kind: 'wealth', name: 'ขอพ้นความจน' } }), /หมดเวลา ไม่มีใครตอบ/],
      [g('whisper', { id: 'ระวัง', level: 1, data: { hint: 'ระวัง', price: 5, level: 'ลังเล', obeyed: true } }), /^ท่านกระซิบ “ระวัง” — เขาได้ยินและทำตาม$/],
      [g('miracle.omen', { id: 'MR-21', data: { n: 1, name: 'ปาฏิหาริย์แห่งพระเจ้า', quarters: 1 } }), /^ลางของปาฏิหาริย์แห่งพระเจ้า.*อีก 1 ฤดู/],
      [g('miracle', { id: 'MR-23', data: { name: 'ปลอบมังกร', target: 'dragon:3', result: 'อารมณ์ 40 → 50', tier: 'มังกร', where: 'ฮรอด-กาธ' } }), /^ปาฏิหาริย์ ปลอบมังกร ที่ฮรอด-กาธ: อารมณ์ 40 → 50$/],
      [g('miracle', { id: 'MR-04', level: 1, data: { name: 'แสงศักดิ์สิทธิ์', target: 'AL-01', result: 'แสงตกกลางเมือง', tier: 'เล็ก' } }), /^ปาฏิหาริย์ แสงศักดิ์สิทธิ์ ที่\S+: แสงตกกลางเมือง$/],
    ];
    for (const [entry, re] of cases) {
      const t = say(data, entry);
      expect(t, JSON.stringify(entry)).not.toBeNull();
      expect(t!, entry.kind).toMatch(re);
      expect(leaks(t!), t!).toEqual([]);
    }
    for (const kind of ['income', 'pay', 'gain', 'belief']) expect(say(data, g(kind, { level: 0, data: { faith: 1 } }), { raw: true })).toBeNull();
    // every kind above is told: none of them is left for the developer's list
    expect(unphrased(data, cases.map(([x]) => x))).toEqual({});
  });

  it('tells why the game called the player, in words', () => {
    expect(say(data, att({ why: 'age', age: 15 }))).toBe('เกมหยุดรอท่าน: ถึงจุดหยุดตามอายุ 15');
    expect(say(data, att({ why: 'prayer', call: 'card', until: 19.4 }, 'heal'))).toBe('มีคำอธิษฐานใหม่: ขอหายเจ็บ · ตอบได้จนอายุ 19');
    expect(say(data, att({ why: 'age', age: 30, cards: 'prayer,omen' }))).toBe('เกมหยุดรอท่าน: ถึงจุดหยุดตามอายุ 30 · มีเรื่องรออยู่ด้วย: คำอธิษฐาน · ลาง');
    expect(say(data, att({ why: 'window', age: null }, 'hu.b1'))).toMatch(/^เกมหยุดรอท่าน: ถึงทางแยกที่พระเจ้าแทรกได้: \S+/);
    expect(say(data, att({ why: 'nearDeath' }))).toContain('ฉากสุดท้าย');
    expect(say(data, att({ why: 'battle', call: 'card', until: 26 }))).toBe('ศึกกำลังจะมาถึง · รอท่านอยู่จนอายุ 26');
    expect(say(data, att({ why: 'crisis', call: 'card', until: 26 }))).toContain('วิกฤต');
    // a glow and a missed card are for the log, not for the player
    expect(say(data, e({ sys: 'attention', kind: 'glow', level: 1, data: { why: 'gap' } }), { raw: true })).toBeNull();
    expect(say(data, e({ sys: 'attention', kind: 'missed', level: 1, data: { kind: 'prayer' } }), { raw: true })).toBeNull();
  });
});

describe('text: a prayer for a lover or a child is told as it happened, now that the bonds keep them (M3, was review M2 G6)', () => {
  const g = (kind: string, over: Partial<LogEntry> = {}): LogEntry => e({ sys: 'god', kind, level: 2, age: 20, ...over });
  const give = (id: string, fx: string, over: Partial<LogEntry['data']> = {}) => say(data, g('prayer.give', { id, data: { n: 5, name: 'ขอพร', price: 12, fx, npcName: 'ไอรัสวาร์', ...over } }))!;

  it('says that a lover or a child came: nothing waits for a system any more', () => {
    expect(fxSplit(data, 'rel:+lover')).toEqual({ done: ['ได้พบคนรัก'], promised: [] });
    expect(fxSplit(data, 'child')).toEqual({ done: ['ได้ลูก'], promised: [] });
    expect(isPendingFx('rel:+lover')).toBe(false);
    expect(hasPendingFx('rel:+lover child')).toBe(false);
    expect(PENDING_FX_TH).toEqual({});
    expect(fxLine(data, 'hp+45 rel:+lover')).toBe('ร่างกายฟื้นขึ้น · ได้พบคนรัก');
    expect(fxLine(data, 'child')).toBe('ได้ลูก');
    expect(fxLine(data, 'gold+50')).toBe('ได้ทอง 50');
  });

  it('the line of the game and the chronicle tell the scene of the prayer that came true, whichever scene is picked', () => {
    // a variant is picked by the content of the entry: many entries, every scene of the kind comes up
    const seen = new Set<string>();
    for (let n = 1; n < 40; n++) {
      for (const [id, fx] of [['love', 'rel:+lover'], ['heir', 'child']] as const) {
        const t = give(id, fx, { n });
        seen.add(t);
        expect(t, t).not.toMatch(/คำมั่นที่ยังไม่เป็นจริง|รอโอกาส/);
        expect(t, t).not.toMatch(/(?:ไม่|ยัง)[^—]*\sแต่/);
        expect(leaks(t), t).toEqual([]);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
    const c = chronicleText(data, { kind: 'prayer.give', id: 'love', result: 'rel:+lover' });
    expect(c).toBe('ให้ตามคำอธิษฐาน: ขอพบคนที่ใช่ → ได้พบคนรัก');
  });

  it('a granted prayer is never told with the scene of "what was asked did not come, but ..."', () => {
    // every kind of prayer whose effect came true, many entries: the scene never has the frame of a refusal
    for (const [id, fx] of [['heal', 'hp+45'], ['rain', 'country:-famine gold+10'], ['peace', 'country:-war'], ['wealth', 'gold+50'], ['wisdom', 'int+1'], ['courage', 'brave+20 hp+15'], ['uncurse', 'uncurse:c_poverty'], ['kin_sick', 'npc:heal npc:att+15'], ['mother', 'vit+1 hp+10']] as const) {
      for (let n = 1; n < 25; n++) {
        const t = give(id, fx, { n });
        expect(t, `${id} ${t}`).not.toMatch(/(?:ไม่|ยัง)[^—]*\sแต่/);
      }
    }
  });

  it('a strange gift is told as something that came instead of what was asked', () => {
    let told = 0;
    for (let n = 1; n < 25; n++) {
      const t = give('wealth', '', { n, gift: 'nb_craft_eye' });
      if (/\sแต่/.test(t.split('—').slice(1).join('—'))) told++;
      expect(t, t).toMatch(/ด้วยของแปลก/);
    }
    expect(told).toBeGreaterThan(20);
  });

  it('knows the two scenes of each prayer: the one that happened and the one that came instead', () => {
    const ts = (data['templates-god'].items as TemplatesData).templates.filter((t) => t.family === 'prayer_give');
    const kinds = new Set(ts.map((t) => t.keys['ชนิด']));
    for (const k of kinds) {
      const mine = ts.filter((t) => t.keys['ชนิด'] === k);
      expect(mine.some((t) => isIndirect(t.text)), k).toBe(true);
      expect(mine.some((t) => !isIndirect(t.text)), k).toBe(true);
    }
    const hash = (t: string) => t.length;
    expect(godTemplate(data, 'prayer_give', { ชนิด: 'ขอพบรัก' }, { ชื่อตัวละคร: 'ก' }, 'x', hash, 'indirect')).toMatch(/ไม่มีคนรัก แต่/);
    expect(godTemplate(data, 'prayer_give', { ชนิด: 'ขอพบรัก' }, { ชื่อตัวละคร: 'ก' }, 'x', hash, 'direct')).not.toMatch(/ไม่มีคนรัก/);
  });
});

describe('text: the words of a reason and the space after a number', () => {
  it('keeps the numbers and what the player typed, drops the codes of parameters', () => {
    expect(reasonText(data, 'ชะลอได้ ×0.2 ถึง ×0.9')).toBe('ชะลอได้ ×0.2 ถึง ×0.9');
    expect(reasonText(data, 'เร่งได้ ×1.1 ถึง ×3')).toBe('เร่งได้ ×1.1 ถึง ×3');
    expect(reasonText(data, 'ความหวาดกลัวไม่พอ (ต้อง 20 มี 11)')).toBe('ความหวาดกลัวไม่พอ (ต้อง 20 มี 11)');
    expect(reasonText(data, 'ต้องระบุตัวคูณ (mul) ที่ไม่ใช่ 1')).toBe('ต้องระบุตัวคูณ ที่ไม่ใช่ 1');
    expect(reasonText(data, 'ไม่มีคำใบ้ "foo"')).toBe('ไม่มีคำใบ้ "foo"');
    expect(reasonText(data, 'ไม่ระบุมังกร (dragon 0 ถึง 14)')).toBe('ไม่ระบุมังกร (0 ถึง 14)');
    expect(reasonText(data, `ไม่มีคำใบ้ "${'ก'.repeat(500)}"`).length).toBeLessThan(80);
    // the table-cell scrub is for sentences of the documents: it cuts the numbers, which a reason must not
    expect(scrub(data, 'ชะลอได้ ×0.2 ถึง ×0.9')).not.toMatch(/0\.2/);
    expect(scrub(data, 'ชะลอได้ ×0.2 ถึง ×0.9', { keepNumbers: true })).toMatch(/×0\.2 ถึง ×0\.9/);
  });

  it('puts a space between a number and the Thai word after it', () => {
    expect(spaceDigits('กอร์ทาที่ 44หายใจแผ่วลง')).toBe('กอร์ทาที่ 44 หายใจแผ่วลง');
    expect(spaceDigits('เขาเลือกถึงยุคที่ 4โดยไม่ลังเล')).toBe('เขาเลือกถึงยุคที่ 4 โดยไม่ลังเล');
    expect(spaceDigits('อายุ 20 ปี ×0.5 ศ.ม. 10,420')).toBe('อายุ 20 ปี ×0.5 ศ.ม. 10,420');
    expect(say(data, e({ sys: 'npc', kind: 'npc', level: 2, id: 'AL01-1', data: { what: 'ally', holder: 'กอร์ทาที่ 44' } }))).toMatch(/กอร์ทาที่ 44 ยินดี/);
  });

  it('names the blessing of a people, so that a gift of the god does not go unnamed', () => {
    expect(labels(data).name.get('rb_orc_r')).toBe('ธงของผู้นำ');
    expect(say(data, e({ sys: 'god', kind: 'chest', id: 'pick', level: 2, data: { slot: 1, thing: 'rb_orc_r', kind: 'bless', tier: 'R', paid: 19, warded: false } }))).toMatch(/ประทานพร ธงของผู้นำ ระดับหายาก/);
  });
});

describe('text: the systems of M3 are told in Thai (bonds, bondage, travel, items, economy, npc, combat)', () => {
  const at = (n: number, over: Partial<LogEntry>): LogEntry => ({ n, worldYear: 450, sys: 'npc', kind: 'npc', data: {}, level: 1, age: 20, ...over });
  const birth = at(1, { sys: 'character', kind: 'birth', id: 'human', level: 3, age: 0, data: { race: 'human', country: 'AL-01', gender: 'f', born: 'main', cls: 'c3' } });
  const named = at(2, { sys: 'text', kind: 'named', id: 'L1', age: 0, data: { name: 'มิรา', race: 'มนุษย์', home: 'โอรันธาร์', cls: 'สามัญชน', year: '10,450', country: 'AL-01' } });
  let n = 10;
  const b = (kind: string, data: LogEntry['data'], id = 'T1', level: 0 | 1 | 2 | 3 = 1): LogEntry => at(n++, { sys: 'bonds', kind, id, data: { name: 'ไลลินา', line: 'สหาย', ...data }, level });
  const sys = (s: string, kind: string, data: LogEntry['data'], id?: string, level: 0 | 1 | 2 | 3 = 1): LogEntry => at(n++, { sys: s, kind, id, data, level });

  /** Every shape of entry the seven systems write, with the data they write (read from real lives). The kinds left to the log are told with `null`. */
  const table = (): [LogEntry, RegExp | null][] => [
    [b('tie', { from: 'school', level: 2, b: 20, race: 'human', npc: null }), /^ได้รู้จัก ไลลินา \(สหาย\) ที่โรงเรียน ระดับคุ้นเคย$/],
    [b('tie', { from: 'closeKin', level: 0, b: 0, line: 'พี่น้อง' }), /^ไลลินา เป็นพี่น้องของมิรา$/],
    [b('level', { from: 2, to: 3, why: 'story', b: 40 }), /แน่นแฟ้นขึ้นจากคุ้นเคยเป็นสนิท.*จากเรื่องที่ผ่านมาด้วยกัน/],
    [b('line', { from: 'สหาย', to: 'คนรัก', why: 'ขอเป็นคนรัก', level: 3 }), /กลายเป็นคนรักของมิรา \(ขอเป็นคนรัก\)/],
    [b('mood', { mood: 'เสียใจ', asked: 'เสียใจ', level: 4, why: 'x' }), /^มิรา เสียใจเรื่อง ไลลินา \(สหาย\)$/],
    [b('mood-held', { mood: 'ภูมิใจ', reason: 'level' }, 'T1', 0), null],
    [b('arc', { code: 'FT-12', stage: 1, title: 'ความลับที่เพื่อนเก็บ', text: '' }, 'T1', 0), /^เรื่องของ ไลลินา.*เริ่มขึ้น: ความลับที่เพื่อนเก็บ$/],
    [b('arc', { code: 'FT-12', stage: 2, title: 'ความลับที่เพื่อนเก็บ', text: 'เขาหายไปบางเวลาและไม่บอกที่', involved: true }), /ความลับที่เพื่อนเก็บ: เขาหายไปบางเวลา/],
    [b('news', { code: 'FT-12', stage: 3, text: 'ตัวละครรับ ปิดให้ หรือรังเกียจ' }, 'T1', 0), /^ข่าวถึงมิรา: เรื่องของ ไลลินา/],
    [b('news', { text: 'ไลลินา จากไป (illness)', kind: 'death' }), /^ข่าวถึงมิรา: ไลลินา \(สหาย\) จากไป \(โรคภัย\)$/],
    [b('crisis', { code: 'KN-05', level: 5, text: 'พี่กลับมาเปลี่ยนไปหรือส่งแต่เงินมา', answer: 'refuse' }, 'T1', 2), /ประสบเรื่องหนัก: พี่กลับมา.* — มิราไม่ได้ช่วยเขา$/],
    [b('trouble', { code: 'FT-01', level: 3, text: 'ผู้ให้กู้ขู่จะผูกตัวเขา (ตามท่าทีของประเทศใน)', answer: 'full' }), /ผู้ให้กู้ขู่จะผูกตัวเขา — มิราช่วยเขาเต็มกำลัง$/],
    [b('ending', { code: 'FT-12', key: 'c', text: 'ความลับร้ายแรงจนสายแตก', kind: 'split', involved: true }), /^เรื่อง “ความลับที่เพื่อนเก็บ”ของ ไลลินา \(สหาย\) จบลง: ความลับร้ายแรงจนสายแตก$/],
    [b('end', { way: 'death', why: 'ตาย', level: 5, cause: 'old' }, 'T2', 0), /จากไป \(ชราภาพ\)/],
    [b('end', { way: 'fade', why: 'ห่างจนไม่มีข่าว', level: 1 }, 'T3', 0), /จนสายจางหายไป/],
    [b('end', { way: 'split', why: 'FT-12 c', level: 4 }, 'T4'), /แตกหักและแยกทางกัน/],
    [b('end', { way: 'betray', why: 'bn.a4', level: 4 }, 'T5'), /หักหลังมิรา/],
    [b('funeral', { cause: 'old', level: 5 }, 'T6', 2), /^งานศพของ ไลลินา \(สหาย\) · ชราภาพ: มิราไปส่งเขาเป็นครั้งสุดท้าย$/],
    [b('letter', { from: 'SV-05' }), /^จดหมายจาก ไลลินา \(สหาย\) ถึงมือมิรา ส่งมาจาก\S+$/],
    [b('invite', { ask: 'travel', ok: true, chance: 70 }), /^มิราชวน ไลลินา ออกเดินทางด้วยกัน — เขาตกลง$/],
    [b('invite', { ask: 'lover', ok: false, chance: 40, refusal: 'hurt' }), /ขอให้ ไลลินา เป็นคนรัก — เขาปฏิเสธและเสียน้ำใจ$/],
    [b('child', { adopted: false, from: 'couple', b: 40 }, 'T7', 2), /^มิรามีลูกชื่อ ไลลินา$/],
    [b('child', { adopted: true, from: 'child', b: 40 }, 'T8', 2), /รับ ไลลินา เป็นลูกบุญธรรม/],
    [b('pair', { item: 'pr_ring_halves_a', other: 'pr_ring_halves_b', status: 'full' }, 'PR-05'), /มี .+ ครบทั้งคู่/],
    [b('pair', { item: 'pr_ring_halves_a', status: 'memorial', from: 'full' }, 'PR-05', 0), /กลายเป็นของระลึกถึง ไลลินา/],
    [at(n++, { sys: 'bonds', kind: 'among', id: 'T1+T2', level: 0, data: { a: 'ไลลินา', b: 'อาริน', line: 'สหาย' } }), /^ไลลินา กับ อาริน รู้จักกัน/],
    [at(n++, { sys: 'bonds', kind: 'pair-story', id: 'T1+T2', level: 0, data: { a: 'ไลลินา', b: 'อาริน', line: 'สหาย', key: 'a', text: 'ตั้งงานร่วมกัน (ร้าน ทีม ขบวน)' } }), /^ไลลินา กับ อาริน: ตั้งงานร่วมกัน/],
    [b('successor', { npc: 'SV05-5', origin: 'เรียนก้าวเงาคู่', text: 'ศิษย์ใต้จันทรา' }, 'T9'), /ผู้สืบทอดต่อจาก.*เรียนก้าวเงาคู่/],
    [b('ally', { npc: 'AL18-2', origin: 'เป็นครูพิเศษ' }, 'T9'), /ได้มาเป็นพวกพ้องของมิรา — เป็นครูพิเศษ/],
    [b('thread', { code: 'FT-07', stage: 4 }), /ยังค้างอยู่ที่ขั้นที่ 4/],
    [b('freed', { how: 'owner' }, 'T10'), /เป็นอิสระแล้ว/],

    [sys('bondage', 'enter', { route: 'ถูกขาย', level: 2, country: 'NB-13', owner: 'นอคโรลิธ', price: 101, moved: false, stance: 'H' }, 'B2', 2), /ตกอยู่ในพันธะ: ผู้รับใช้ตามสัญญา \(ถูกขาย\) ที่\S+ ภายใต้ นอคโรลิธ · ค่าไถ่ราว 101 ทอง/],
    [sys('bondage', 'exit', { way: 'ไถ่ตัวเอง', from: 2, classUp: true }, 'ransom', 2), /พ้นจากพันธะ \(ไถ่ตัวเอง\) ฐานะสูงขึ้นหนึ่งชั้น/],
    [sys('bondage', 'exit', { way: 'หนีข้ามแดน', from: 2, classUp: false }, 'fled', 2), null],
    [sys('bondage', 'escape', { ok: true, to: 'AL-01' }, 'AL-01', 2), /หนีข้ามแดนได้สำเร็จ ถึง\S+ และเป็นอิสระ/],
    [sys('bondage', 'escape', { ok: false, to: null }, '', 2), /ถูกจับกลับมา/],
    [sys('bondage', 'escape', { ok: true, name: 'ฟีทิส', who: 'held' }, 'H1', 2), /^ฟีทิส ผู้ที่มิราถือสัญญาไว้ หนีไปได้$/],
    [sys('bondage', 'buy', { name: 'ฟีทิส', level: 'B2', price: 91, country: 'AL-01', npc: null }, 'H1'), /^มิราซื้อสัญญาของ ฟีทิส \(ผู้รับใช้ตามสัญญา\) ราคา 91 ทอง ที่\S+$/],
    [sys('bondage', 'free', { name: 'ฟีทิส', how: 'ransom', price: 229 }, 'ฟีทิส'), /ฟีทิส เป็นอิสระแล้ว — มิราไถ่เขาออกมาด้วยทอง 229 ทอง/],
    [sys('bondage', 'free', { name: 'โบธัน', how: 'bribe' }, 'โบธัน'), /ติดสินบนให้ปล่อยเขา/],
    [sys('bondage', 'sell', { name: 'ฟีทิส', gain: 120 }, 'H1'), /ขายสัญญาของ ฟีทิส ต่อ ได้ 120 ทอง/],
    [sys('bondage', 'sued', { name: 'ฟีทิส' }, 'H1'), /ฟีทิส ฟ้องร้อง/],

    [sys('travel', 'cause', { chance: 0.2, age: 40 }, 'exile'), /ตัดสินใจออกเดินทาง: ถูกเนรเทศหรือหนีโทษ/],
    [sys('travel', 'open', { why: 'ml' }, 'ml'), /เรื่องของ “ทหารรับจ้างข้ามแดน” เปิดขึ้น/],
    [sys('travel', 'move', { from: 'SV-09', to: 'SV-06', why: 'sc', legs: 1, level: 1 }, 'SV-06'), null],
    [sys('travel', 'trip', { from: 'SV-09', to: 'SV-06', why: 'sc', legs: 1, days: 10, fare: 3, smuggle: false }, 'SV-06'), /^ไปเรียนต่างแดน: จาก\S+ ไป\S+ 1 ช่วงทาง ราว 10 วัน ค่าเดินทาง 3 ทอง$/],
    [sys('travel', 'trip', { from: 'SV-09', to: 'NB-04', why: 'job:merchant', legs: 2, days: 30, fare: 5, smuggle: true }, 'NB-04'), /เดินทางตามงาน.*โดยลักลอบข้ามด่าน/],
    [sys('travel', 'road', { from: 'KD-05', to: 'KD-03', note: 'bandits', name: 'x', why: 'sc' }, 'd2'), /^ระหว่างทาง: ถูกโจรหรือสัตว์ร้ายดักทาง$/],
    [sys('travel', 'road', { from: 'KD-05', to: 'KD-03', note: 'pay 21', name: 'x', why: 'sc' }, 'd1', 0), /เสียไป 21 ทอง/],
    [sys('travel', 'road', { from: 'KD-05', to: 'KD-03', note: 'news WR-06', name: 'x', why: 'sc' }, 'd10'), /ได้ข่าวเหตุการณ์โลก/],
    [sys('travel', 'settle', { why: 'peddler' }, 'KD-07'), /ตั้งหลักแหล่งใหม่ที่\S+/],
    [sys('travel', 'blocked', { from: 'KD-03', why: 'wanted', cause: 'return' }, 'KD-01', 0), /เข้า\S+ไม่ได้ เพราะที่นั่นตามจับตัวอยู่/],
    [sys('travel', 'stair', { days: 283 }, 'fail'), /ปีนบันไดหมื่นขั้นไม่ผ่านการทดสอบ.*283 วัน/],

    [sys('items', 'get', { name: 'กระดูกต้องสาป', tier: 'U', cat: 'material' }, 'mt_cursed_bone', 0), /^มิราได้ กระดูกต้องสาป \(ระดับไม่ธรรมดา\) มาไว้ติดตัว$/],
    [sys('items', 'buy', { price: 374, why: 'armor', country: 'AL-27' }, 'ar_scale_hauberk', 0), /^ซื้อ .+ ราคา 374 ทอง ที่\S+$/],
    [sys('items', 'gear', { wield: 'ws_rapier', armor: 'ar_hard_leather', charm: null, acc: 'ac_bead_string' }, undefined, 0), /^มิราจัดของติดตัวใหม่: ถือ .+ · สวม .+ · ประดับ .+$/],
    [sys('items', 'dull', { name: 'ดาบ' }, 'ws_rapier'), /ทื่อลง/],
    [sys('items', 'wear', { name: 'เสื้อเกราะ', defense: 2 }, 'ar_hard_leather'), /สึกหรอ/],
    [sys('items', 'repair', { cost: 12 }, 'ws_rapier', 0), /^ซ่อม .+ ให้ใช้ได้อีก เสีย 12 ทอง$/],
    [sys('items', 'wornout', { name: 'จอบ', tier: 'C' }, 'lt_hoe'), /^จอบ ใช้จนพังและทิ้งไป$/],
    [sys('items', 'legend', { name: 'ดาบแห่งตำนาน' }, 'ws_rapier', 2), /ได้อาวุธในตำนาน ดาบแห่งตำนาน มาครอง/],
    [sys('items', 'vanish', { name: 'ดาบแห่งตำนาน', why: 'broken' }, 'ws_rapier'), /ไม่ปรากฏต่อมิรา: แตกสลายไปแล้ว/],
    [sys('items', 'return', { name: 'ดาบแห่งตำนาน', to: 'broken' }, 'ws_rapier', 2), /แตกสลายไปตลอดกาล/],
    [sys('items', 'unknown', {}, 'zz', 0), null],
    [sys('items', 'talisman', { what: 'found', buyer: 'priest' }, 'tm_river_pebble', 0), /ถูกขุดพบจากซาก/],
    [sys('items', 'forge', { step: 'need', cause: 'แพ้ศึกเพราะอาวุธไม่ได้ผล (ศัตรูทนแท็กของอาวุธ)', tier: 'U', smith: 'ช่างหมู่บ้าน', place: 'SV-12' }, 'ws_rapier'), /ตั้งใจสั่งตีอาวุธใหม่.*เพราะแพ้ศึก.*กับ ช่างหมู่บ้าน/],
    [sys('items', 'forge', { step: 'wait', tier: 'U', price: 40, how: 'ข+', beats: 2 }, 'ws_rapier'), /สั่งตี .+ ราคา 40 ทอง \(ต่อรองจนได้ลดราคา\) รออีก 2 ฤดู/],
    [sys('items', 'forge', { step: 'save', price: 90 }, 'ws_rapier'), /เก็บเงินไว้ก่อน/],
    [sys('items', 'forge', { step: 'trial', trial: 't', way: 'a', pass: false, smith: 'นอร์ธรา' }, 'ws_rapier'), /ช่าง นอร์ธราทดสอบน้ำใจมิรา: ไม่ผ่าน/],
    [sys('items', 'forge', { step: 'abort', why: 'saved too long', smith: 'นอร์ธรา' }, 'ws_rapier'), /เลิกสั่งตี.*เก็บเงินไม่ทัน/],
    [sys('items', 'forge', { step: 'result', outcome: 'masterpiece', sum: 14, diff: 9, smith: 'ช่างเมือง', name: 'ดาบของช่างเมือง' }, 'ws_rapier', 2), /ดาบของช่างเมือง ออกมาเป็นผลงานชิ้นเอก ฝีมือ ช่างเมือง/],

    [sys('economy', 'tight', { way: 'loan', gold: 219, living: 172, tight: 4 }, 'loan'), /^ปีนี้เงินฝืดเคือง มิรากู้ยืมมาใช้จนติดหนี้$/],
    [sys('economy', 'default', { class: 'c3' }, undefined, 2), /^หนี้ท่วมเกินกว่าจะใช้ไหว.*ฐานะของมิราตกลงเหลือ\S+/],

    [sys('npc', 'npc', { what: 'sick', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', why: 'old' }, 'AL01-1'), /^ไนลา ล้มป่วย ด้วยวัย$/],
    [sys('npc', 'npc', { what: 'heal', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01' }, 'AL01-1'), /ไนลา หายป่วยเพราะได้รับการช่วยเหลือ/],
    [sys('npc', 'npc', { what: 'follow', holder: 'ไนลา', gen: 2, role: 'ช่าง', place: 'AL-01', of: 'AL01-1', kind: 'a', doer: 'mc' }, 'AL01-2', 2), /ไนลา \(ช่าง\) เก็บความแค้นที่ .+ ล้มลง และมุ่งมาหามิรา/],
    [sys('npc', 'npc', { what: 'follow', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', of: 'AL01-1', kind: 'c' }, 'AL01-2', 0), /ปล่อยวางเรื่องที่/],
    [sys('npc', 'npc', { what: 'tie', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', of: 'AL01-1', path: 'a', why: 'gone' }, 'AL01-2', 0), /เกี่ยวพันกับเรื่องของ/],
    [sys('npc', 'npc', { what: 'newcomer', holder: 'ช่างผู้ตีของจากซาก', gen: 1, role: '', place: 'AZ-01', tpl: 'NT-04', year: 1400, age: 41 }, 'AZ01-10', 0), /^ช่างผู้ตีของจากซาก มาถึง ที่\S+$/],
    [sys('npc', 'npc', { what: 'clash-open', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', clash: 'NF-AL01-1', code: 'T', why: 'year' }, 'AL01-1', 0), /กำลังจะปะทะกับมิรา/],
    [sys('npc', 'npc', { what: 'clash', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', clash: 'NF-AL01-1', outcome: 'lose', text: 'เขาโยนตัวละครลงบันไดสองร้อยขั้น เส้น ข) เดินต่อ' }, 'AL01-1', 2), /^ไนลา ปะทะกับมิรา: มิราเป็นฝ่ายแพ้ — เขาโยน มิรา ลงบันไดสองร้อยขั้น$/],

    [sys('combat', 'prelude', { enemies: 'wolf', foe: 'หมาป่าเงา', tier: 'หัวหน้า', node: 'hu.b2', kind: 'story', text: null }, 'wolf', 2), /^หมาป่าเงา \(หัวหน้า\) ขวางหน้ามิรา ใน “.+” ศึกกำลังจะเริ่ม$/],
    [sys('combat', 'raid', { how: 'saved', warned: true, result: 'win', country: 'SV-05' }, 'bandits', 2), /บุกเข้า ที่\S+ มิรารู้ตัวก่อน · ปกป้องบ้านเมืองไว้ได้/],
    [sys('combat', 'raid', { how: 'lost', warned: false, result: 'lose', country: 'SV-05' }, 'goblin', 2), /ถูกบุกโดยไม่ทันตั้งตัว · พ่ายแพ้/],
    [sys('combat', 'war', { how: 'held', role: 'front', roll: 6 }, 'MH-07', 1), /ร่วมศึกใหญ่ ที่\S+ ในฐานะแนวหน้า และยืนหยัดได้/],
    [sys('combat', 'war', { how: 'lost', wounds: 'scar', roll: 2, max: 120 }, 'MH-07', 2), /ถูกตีแตก มิราได้รับแผลเป็นถาวร/],
    [sys('combat', 'war', { how: 'dead', roll: 1 }, 'MH-07', 2), /สิ้นชีวิตในศึกใหญ่/],
    [sys('combat', 'captured', {}, 'MH-04', 2), /ถูกจับเป็นเชลย/],
    [sys('combat', 'wound', { wounds: 'scar,c_oneeye', roll: 78, node: null }, 'ghoul_horde', 2), /^มิราได้รับแผลเป็นถาวร และ.+ติดตัวจาก .+$/],
    [sys('combat', 'title', { key: 'raid', n: 3 }, 'ผู้พิทักษ์', 2), /^มิราได้รับฉายา “ผู้พิทักษ์”$/],
    [sys('combat', 'pray', { beat: 2, faith: 30 }, 'wolf', 1), /อธิษฐานกลางศึก/],
    [sys('combat', 'rescue', {}, 'guardian_angel', 2), /ผู้พิทักษ์ที่มองไม่เห็นยื่นมือช่วย/],
    [sys('combat', 'clash', { npc: 'AL01-1', result: 'win' }, 'NF-AL01-1', 2), null],
    [sys('combat', 'skip', { why: 'unknown enemy' }, 'pv.a2', 0), null],
  ];

  it('says every kind with a Thai line that holds no code, or leaves it to the log on purpose', () => {
    for (const [entry, want] of table()) {
      // the NPC of the lines is a roster position: tell the reader the character met him, and put the character's name first
      const log = [birth, named, at(5, { id: entry.id, data: { what: 'meet', holder: 'ไนลา', role: '', place: 'AL-01', age: 30 } }), entry];
      const text = lines(data, log, 0).filter((l) => l.entry === entry)[0]?.text ?? null;
      const label = `${entry.sys}/${entry.kind}${entry.data.what ? `/${String(entry.data.what)}` : ''} ${entry.data.step ?? entry.data.way ?? ''}`;
      if (want === null) {
        expect(text, label).toBeNull();
        continue;
      }
      expect(text, label).not.toBeNull();
      expect(text!, label).toMatch(want);
      expect(leaks(text!), `${label}: ${text}`).toEqual([]);
    }
  });

  it('leaves nothing without a phrasing: the developer list of unphrased kinds is empty for all of them', () => {
    const log = [birth, named, ...table().map(([x]) => x)];
    expect(unphrased(data, log)).toEqual({});
  });

  it('shows the small lines of a long life at level 0 only: a worn blade, a mended one, a trade trip, a small feeling', () => {
    const quiet = [
      sys('items', 'dull', { name: 'ดาบ' }, 'ws_rapier'),
      sys('items', 'wear', { name: 'เสื้อเกราะ', defense: 2 }, 'ar_hard_leather'),
      sys('items', 'repair', { cost: 12 }, 'ws_rapier'),
      sys('items', 'wornout', { name: 'จอบ', tier: 'C' }, 'lt_hoe'),
      sys('travel', 'trip', { from: 'SV-09', to: 'SV-06', why: 'job:merchant', legs: 1, days: 10, fare: 3, smuggle: false }, 'SV-06'),
      sys('travel', 'trip', { from: 'SV-09', to: 'SV-06', why: 'return', legs: 1, days: 10, fare: 3, smuggle: false }, 'SV-06'),
      b('mood', { mood: 'ภูมิใจ', asked: 'ภูมิใจ', level: 3, why: 'x' }),
      b('level', { from: 2, to: 3, why: 'meet', b: 40 }),
      b('tie', { from: 'journey', level: 1, b: 0 }),
      b('invite', { ask: 'travel', ok: true, chance: 70 }),
      sys('combat', 'battle', { result: 'win', end: 'win', enemies: 'wolf', foe: 'หมาป่าเงา', kind: 'travel' }, 'wolf', 1),
    ];
    for (const x of quiet) expect(displayLevel(x), `${x.sys}/${x.kind}`).toBe(0);
    // while the turns of a bond are told: a crossing of the sea, a grief, a bond that rose by a story
    for (const x of [
      sys('travel', 'trip', { from: 'SV-09', to: 'AL-06', why: 'sc', legs: 3, days: 40, fare: 9, smuggle: false }, 'AL-06'),
      b('mood', { mood: 'เสียใจ', asked: 'เสียใจ', level: 4, why: 'x' }),
      b('level', { from: 2, to: 3, why: 'story', b: 40 }),
      b('invite', { ask: 'lover', ok: false, chance: 40, refusal: 'plain' }),
    ]) expect(displayLevel(x), `${x.sys}/${x.kind}`).toBeGreaterThan(0);
  });

  it('tells the mood of a story line once the bonds hold someone on that line, and not before (T4)', () => {
    const mood = at(30, { sys: 'story', kind: 'mood', id: 'สหาย', data: { mood: 'ยินดี', level: 1, node: 'bn.b1' } });
    const bond = at(31, { sys: 'story', kind: 'bond', id: 'สหาย', data: { level: 2 } });
    const tpl = at(32, { sys: 'story', kind: 'template', id: 'PR-01', data: { type: 'PR' } });
    const tie = at(20, { sys: 'bonds', kind: 'tie', id: 'T1', level: 1, data: { name: 'ไลลินา', line: 'สหาย', from: 'bn.b1', level: 2, b: 20 } });
    const before = lines(data, [birth, named, mood, bond, tpl], 1).map((l) => l.text);
    expect(before).toHaveLength(1); // the birth line only
    const after = lines(data, [birth, named, tie, mood, bond, tpl], 1).map((l) => l.text);
    expect(after.some((t) => /ใจของมิราที่มีต่อสายสหาย: ยินดี/.test(t))).toBe(true);
    expect(after.some((t) => /สายสหายของมิราขึ้นเป็นระดับคุ้นเคย/.test(t))).toBe(true);
    for (const t of after) expect(leaks(t), t).toEqual([]);
    expect(after.some((t) => t.includes('PR'))).toBe(false);
  });

  it('tells the illness of a person the character knows, and not of every stranger in the country', () => {
    const sick = sys('npc', 'npc', { what: 'sick', holder: 'ไนลา', gen: 2, role: '', place: 'AL-01', why: 'old' }, 'AL01-1');
    const meet = at(5, { id: 'AL01-1', data: { what: 'meet', holder: 'ไนลา', role: '', place: 'AL-01', age: 30 }, level: 2 });
    expect(lines(data, [birth, named, sick], 1).some((l) => l.text.includes('ล้มป่วย'))).toBe(false);
    expect(lines(data, [birth, named, meet, sick], 1).some((l) => l.text.includes('ล้มป่วย'))).toBe(true);
    // left out on purpose: the developer's list does not ask for a phrasing of it
    expect(unphrased(data, [birth, named, sick])).toEqual({});
  });

  it('does not tell the end of a bond twice: the ending of its story is the line, the plain end after it is left out', () => {
    const ending = b('ending', { code: 'FT-12', key: 'c', text: 'ความลับร้ายแรงจนสายแตก', kind: 'split', involved: true }, 'T4');
    const end = b('end', { way: 'split', why: 'FT-12 c', level: 4 }, 'T4');
    const out = lines(data, [birth, named, ending, end], 1).filter((l) => l.sys === 'bonds');
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain('จบลง');
  });

  it('the clash of the NPC drops the sums of the document and keeps the story', () => {
    expect(clashStory(data, 'เขาถอนทัพจากเส้น ก) เส้น ค) น้ำหนัก ×2 บุญคุณ +2')).toBe('เขาถอนทัพจาก');
    expect(clashStory(data, 'ตาย เส้น ก) ถูกตัด นายเก่าของเธอแค้นตัวละคร +1')).toBe('นายเก่าของเธอ');
    expect(clashStory(data, 'เส้น ข) บังคับเกิด เขายกเลิกดวล ไว้ใจ +2')).toBe('เขายกเลิกดวล');
    expect(clashStory(data, 'เขาโยนตัวละครลงบันไดสองร้อยขั้น เส้น ข) เดินต่อ')).toBe('เขาโยนตัวละครลงบันไดสองร้อยขั้น');
    // the name of the one who lives the life stands where the document says `ตัวละคร`
    expect(clashStory(data, 'เขาโยนตัวละครลงบันไดสองร้อยขั้น เส้น ข) เดินต่อ', 'มิรา')).toBe('เขาโยน มิรา ลงบันไดสองร้อยขั้น');
  });
});
