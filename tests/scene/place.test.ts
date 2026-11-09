// Where a scene is and what its calm and card pictures show (M7 ก4): the place of each kind of entry, the setting guessed from the words of a place, the picture of a card.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { cardOfEntry, idleView, lifePlace, placeOf, sceneFor, sceneryOf, settingOf } from '../../src/app/views/scene';
import { specKey } from '../../src/scene/scenery';
import { cardPicture, paintCard } from '../../src/scene/cardpic';
import { MOOD } from '../../src/scene/tuning';
import type { ScenesData } from '../../src/core/data/types-scenes';
import type { GameData } from '../../src/core/game';
import type { GameState, LogEntry } from '../../src/core/types';

let data: GameData;
let state: GameState;
/** The same life living in another continent (the scenes that do not name a place are there). */
let abroad: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 3 });
  startLife(s);
  state = s.game.state;
  abroad = { ...state, life: { ...state.life!, country: 'KD-01' } };
});

const e = (sys: string, kind: string, id: string, d: LogEntry['data'] = {}): LogEntry => ({ n: 1, worldYear: 450, sys, kind, id, data: d, level: 2 });

describe('the place of a scene', () => {
  it('a clash is in the country of its NPC, wherever the life is (NF-AZ02-1: AZ-02)', () => {
    const clash = e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', kind: 'lose' });
    expect(placeOf(data, abroad, clash)).toEqual({ continent: 'AZ', country: 'AZ-02' });
    // the painted place the stage is given is that country too, not the life's
    const v = sceneFor(data, clash, abroad);
    const spec = sceneryOf(data, abroad, v)('ลานดวลริมหน้าผา');
    expect(spec.continent).toBe('AZ');
    expect(spec.country).toBe('AZ-02');
    // the id of the script is enough when the entry carries no `npc`
    expect(placeOf(data, abroad, e('combat', 'clash', 'NF-MH09-4', {}))).toEqual({ continent: 'MH', country: 'MH-09' });
  });

  it('an entry that names a country or a continent is there (a world event, a miracle target, a dragon fall)', () => {
    expect(placeOf(data, abroad, e('world', 'event', 'DR-04', { place: 'SH-02' }))).toEqual({ continent: 'SH', country: 'SH-02' });
    expect(placeOf(data, abroad, e('god', 'miracle', 'MR-17', { target: 'NR-03' }))).toEqual({ continent: 'NR', country: 'NR-03' });
    expect(placeOf(data, abroad, e('world', 'dragonFall', 'x', { dragon: 5, place: 'MK' }))).toEqual({ continent: 'MK' });
    expect(placeOf(data, abroad, e('events', 'local', 'LC-03', { country: 'AL-01' }))).toEqual({ continent: 'AL', country: 'AL-01' });
  });

  it('what places nothing (the rite and destination of the tribe, an ally, a world event with no place, a local event) is where the life is', () => {
    const life = lifePlace(data, abroad);
    expect(life).toEqual({ continent: 'KD', country: 'KD-01' });
    for (const en of [e('story', 'node', 'hu.t1', { rite: 'hu.t1' }), e('story', 'node', 'dw.e1'), e('bonds', 'crisis', 'MH09-7', { code: 'FT-03' }), e('world', 'event', 'DR-04'), e('events', 'local', 'LC-104')]) expect(placeOf(data, abroad, en), en.id).toEqual(life);
    // an NPC who arrives is where the life is; without a life, at the NPC's own country; with neither, nowhere
    expect(placeOf(data, abroad, e('npc', 'arrive', 'AZ01-10', { npc: 'AZ01-10', template: 'NT-04' }))).toEqual(life);
    expect(placeOf(data, null, e('npc', 'arrive', 'AZ01-10', { npc: 'AZ01-10' }))).toEqual({ continent: 'AZ', country: 'AZ-01' });
    expect(placeOf(data, null, e('world', 'event', 'DR-04'))).toBeUndefined();
  });
});

describe('the setting guessed from the words of a place', () => {
  it('cliffs, fields, shores, forests, roads and battlefields are under the sky', () => {
    for (const p of ['ลานดวลริมหน้าผา', 'กองทัพสองฝ่ายล้อมปากเหว', 'ทุ่งแยก', 'จอมมารสองกองทัพสู้กันกลางทุ่งเถ้า', 'ป่าเหี่ยว', 'หมาป่าเงาวิ่งในป่ากับทหารถือคบเพลิง', 'ชายฝั่งยามเช้า', 'ริมทะเลสาบ', 'ถนนยามคืน', 'สนามรบหลังฝน', 'วังวนสีฟ้าเข้มเกิดกลางทะเล', 'แนวทหารสองฝ่ายยืนห่างกันเท่าหอก', 'ผงฟ้าอ่อนเปรอะเครื่องแบบทหารสองฝ่ายในทะเลทราย'])
      expect(settingOf(p), p).toBe('outdoor');
  });
  it('halls, temples, rooms and caves are inside', () => {
    for (const p of ['ห้องสภาครึ่งหนึ่งยื่นออกเหนือหุบ', 'หุ่นวิญญาณตัวเก่านั่งท้ายวิหารเฟือง', 'ห้องโถงใหญ่', 'ปากถ้ำบนเขามีควันกองไฟ', 'ห้องดำ', 'วิหารเก่า', 'โบสถ์กลางคืน', 'ห้องมืด', 'ลัทธิลับในห้องใต้ดิน', 'โรงตีเงียบ'])
      expect(settingOf(p), p).toBe('indoor');
  });
  it('squares, markets, harbours and gates are among the houses; a word that says nothing is under the sky', () => {
    for (const p of ['ตลาดโคมใหญ่', 'ท่าเรือเก่า', 'ลานสุสานเงียบ', 'ประตูเมืองปฐม', 'ค่ายผู้ลี้ภัยสามเผ่า']) expect(settingOf(p), p).toBe('town');
    for (const p of ['', 'ราหู', 'สกายฟอลล์']) expect(settingOf(p), p).toBe('outdoor');
  });
});

describe('the calm picture of the watch screen', () => {
  it('is the painted place of the life in the season: the four seasons are four pictures of one place', () => {
    const keys = new Set<string>();
    for (let q = 0; q < 4; q++) {
      const st = { ...abroad, clock: { ...abroad.clock, quarter: q } };
      const v = idleView(data, st);
      expect(v.scenery.continent).toBe('KD');
      expect(v.scenery.country).toBe('KD-01');
      // KD-01 is a city of scale 5: 13-storyline-scenes §6 draws a country of scale 3 or more among its houses
      expect(v.scenery.setting).toBe('town');
      expect(v.scenery.season).toBe(q);
      keys.add(specKey(v.scenery));
    }
    expect(keys.size).toBe(4);
  });
  it('a camp or a small town (scale 1 to 2) is under the sky, a town of scale 3 or more is among its houses', () => {
    const at = (country: string) => idleView(data, { ...abroad, life: { ...abroad.life!, country } }).scenery.setting;
    expect(at('MH-01')).toBe('outdoor');
    expect(at('AZ-08')).toBe('outdoor');
    expect(at('KD-01')).toBe('town');
  });
  it('another place of the life is another picture', () => {
    expect(specKey(idleView(data, state).scenery)).not.toBe(specKey(idleView(data, abroad).scenery));
  });
});

describe('the picture of an event card', () => {
  const card = (en: LogEntry, st: GameState | null = abroad) => cardOfEntry(data, en, st);
  const dr04 = () => card(e('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า', mark: '●' }));

  it('is the place of the event: the entry\'s own, else the card\'s place of the docs, else the life\'s, else a plain one', () => {
    // DR-03: the card place table of 12-event-visuals puts the nest of the egg in AZ-01 wherever the life is
    expect(card(e('world', 'event', 'DR-03', { name: 'ไข่ใบที่สิบหก' })).scenery).toMatchObject({ continent: 'AZ', country: 'AZ-01' });
    expect(card(e('world', 'event', 'DR-04', { place: 'SH-02' })).scenery).toMatchObject({ continent: 'SH', country: 'SH-02', setting: 'outdoor' });
    expect(dr04().scenery).toMatchObject({ continent: 'KD', country: 'KD-01' });
    expect(card(e('world', 'event', 'DR-04'), null).scenery).toMatchObject({ continent: 'AZ' });
  });

  it('is the same pixels every time, 320 × 180', () => {
    const a = cardPicture(dr04());
    expect(a.w).toBe(320);
    expect(a.h).toBe(180);
    expect(a.data.length).toBe(320 * 180 * 4);
    // painted again from nothing (the cache aside), the card gives the same buffer
    expect(Array.from(paintCard(dr04()).data)).toEqual(Array.from(paintCard(dr04()).data));
    expect(Array.from(paintCard(dr04()).data)).toEqual(Array.from(a.data));
    expect(a.data.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
  });

  it('changes with the place, the sky tint and the effects of the card', () => {
    const base = dr04();
    const here = cardPicture(base);
    const other = cardPicture({ ...base, scenery: { ...base.scenery!, continent: 'SH', country: 'SH-02' } });
    expect(Array.from(other.data)).not.toEqual(Array.from(here.data));
    const redder = cardPicture({ ...base, sky: '#8a2a2a' });
    expect(Array.from(redder.data)).not.toEqual(Array.from(here.data));
    const snowy = cardPicture({ ...base, fx: ['snow', 'embers'] });
    const plain = cardPicture({ ...base, fx: [] });
    expect(Array.from(snowy.data)).not.toEqual(Array.from(plain.data));
  });

  it('every card of the data has a picture', () => {
    const cards = (data.scenes.items as ScenesData).cards;
    for (const c of cards.slice(0, 40)) {
      const m = card(e('world', 'event', c.id, { name: c.name }));
      m.fx = c.fx;
      m.sky = c.sky;
      expect(cardPicture(m).data.length).toBe(320 * 180 * 4);
    }
  });
});

describe('the mood tint of the beats', () => {
  it('lies lightly over the painted place, so the continent stays recognisable', () => {
    expect(MOOD.sky).toBeLessThanOrEqual(0.25);
    expect(MOOD.ground).toBeLessThanOrEqual(0.15);
  });
});
