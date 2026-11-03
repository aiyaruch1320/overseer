// The choice of a scene for a log entry: a script when there is one, else the event card.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { cardOfEntry, sceneFor, sceneKeys, STANDARD_CLOSING } from '../../src/app/views/scene';
import type { ScenesData } from '../../src/core/data/types-scenes';
import type { GameData } from '../../src/core/game';
import type { LogEntry } from '../../src/core/types';
import { frameAt } from '../../src/scene/timeline';

let data: GameData;
beforeAll(() => {
  data = loadAll(['scenes', 'local-events', 'storylines', 'world-events', 'npcs', 'countries', 'continents', 'races', 'names']);
});
const scenes = () => data.scenes.items as ScenesData;

const e = (sys: string, kind: string, id: string, d: LogEntry['data'] = {}): LogEntry => ({ n: 1, worldYear: 450, sys, kind, id, data: d, level: 2 });

describe('which script an entry looks for', () => {
  it('a world event under its id, an ending too', () => {
    expect(sceneKeys(e('world', 'event', 'DR-04')).keys).toEqual(['DR-04']);
    expect(sceneKeys(e('world', 'ending', 'END-10')).keys).toEqual(['END-10']);
    expect(sceneKeys(e('world', 'era', 'era.2')).keys).toEqual([]);
  });
  it('the rite of a tribe by its line, with the home (human) and the result; its destination by the line', () => {
    const k = sceneKeys(e('story', 'node', 'hu.t1', { rite: 'hu.t1', variant: 'หมอก', result: 'fail' }));
    expect(k.keys).toEqual(['hu.t1', 'rite.hu']);
    expect(k.variants).toEqual([['หมอก'], ['fail']]);
    expect(sceneKeys(e('story', 'node', 'dw.e2')).keys).toEqual(['dw.e2', 'dest.dw']);
    expect(sceneKeys(e('story', 'node', 'bn.e1')).keys).toEqual(['bn.e1', 'dest.bn']);
    expect(sceneKeys(e('story', 'node', 'hu.a3')).keys).toEqual(['hu.a3']);
  });
  it('a clash by its id; the result by the row, else by the standard closing of the kind', () => {
    expect(sceneKeys(e('combat', 'clash', 'NF-AZ02-1', { outcome: 'แพ้', kind: 'lose' })).variants).toEqual([['แพ้', 'แพ้']]);
    expect(sceneKeys(e('combat', 'clash', 'NF-AZ02-1', { outcome: null, kind: null, end: 'flee' })).variants).toEqual([['', STANDARD_CLOSING.flee]]);
    expect(sceneKeys(e('combat', 'clash', 'NF-AZ02-1', { outcome: null, kind: null, end: 'win', killed: true })).variants[0][1]).toBe('ชนะ (ล้ม)');
  });
  it('ally crises by the person or the template, bad endings by the person, miracles by id, local events and their templates', () => {
    expect(sceneKeys(e('bonds', 'crisis', 'MH09-7', { code: 'FT-03' })).keys).toEqual(['ally.MH09-7.crisis', 'FT-03']);
    expect(sceneKeys(e('bonds', 'ending', 'MH09-7', { kind: 'stays' })).keys).toEqual([]);
    expect(sceneKeys(e('bonds', 'ending', 'MH09-7', { kind: 'dies' })).keys).toEqual(['ally.MH09-7.end']);
    // the roster NPC of the tie (the entry's `npc`) finds the script `ally.<NPC>.*` when the tie id is not the NPC id
    expect(sceneKeys(e('bonds', 'crisis', 'T3', { code: 'FT-03', npc: 'MH09-7' })).keys).toEqual(['ally.T3.crisis', 'ally.MH09-7.crisis', 'FT-03']);
    expect(sceneKeys(e('bonds', 'ending', 'T3', { kind: 'dies', npc: 'MH09-7' })).keys).toEqual(['ally.T3.end', 'ally.MH09-7.end']);
    // the fall of a dragon (`world/dragonFall`, dragon index 0..14) plays fall.<n>; a newcomer (`npc/arrive`) its NT template
    expect(sceneKeys(e('world', 'dragonFall', 'โอรัน-ซัล', { dragon: 0, place: '' })).keys).toEqual(['fall.1']);
    expect(sceneKeys(e('world', 'dragonFall', 'นิเวรี', { dragon: 14 })).keys).toEqual(['fall.15']);
    expect(sceneFor(data, e('world', 'dragonFall', 'ราหู', { dragon: 5, place: 'AZ-05' })).kind).toBe('script');
    expect(sceneKeys(e('npc', 'arrive', 'AZ01-10', { template: 'NT-04', near: true })).keys).toEqual(['NT-04']);
    expect(sceneFor(data, e('npc', 'arrive', 'AZ01-10', { template: 'NT-04', near: true })).kind).toBe('script');
    expect(sceneKeys(e('god', 'miracle', 'MR-17')).keys).toEqual(['mr.MR-17']);
    expect(sceneKeys(e('god', 'miracle.omen', 'MR-17')).keys).toEqual([]);
    expect(sceneKeys(e('events', 'local', 'LC-104'), () => 'LT-6').keys).toEqual(['LC-104', 'LT-6']);
  });
});

describe('the scene of an entry', () => {
  it('a world event of form X or L plays its script; M and C show the card', () => {
    const x = sceneFor(data, e('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า', mark: '⭐' }));
    expect(x.kind).toBe('script');
    if (x.kind === 'script') expect(x.script.seconds).toBe(40);
    expect(sceneFor(data, e('world', 'event', 'DR-03', { name: 'ไข่ใบที่สิบหก', mark: '●' })).kind).toBe('script');
    const m = sceneFor(data, e('world', 'event', 'DR-06', { name: 'ลมหยุดหายใจ', mark: '●' }));
    expect(m.kind).toBe('card');
    expect(m.card).toMatchObject({ form: 'M', frame: '#d8d4cc' });
    const c = sceneFor(data, e('world', 'event', 'CT-10', { name: 'ฝูงวาฬฟ้าอพยพ', mark: '○' }));
    expect(c.kind).toBe('card');
    expect(c.card).toMatchObject({ form: 'C', mark: '○', frame: '#a89860' });
  });
  it('an entry with no script uses the card, in the colour of the system that wrote it', () => {
    const w = sceneFor(data, e('world', 'event', 'XX-99', { name: 'ไม่มีในตาราง', mark: '○' }));
    expect(w.kind).toBe('card');
    expect(w.card.title).toBe('ไม่มีในตาราง');
    expect(w.card.mark).toBe('○');
    expect(sceneFor(data, e('god', 'chest', 'x', {})).card.frame).toBe('#e8c36a');
    expect(sceneFor(data, e('story', 'node', 'hu.a3', { title: 'งานแรก' })).kind).toBe('card');
    expect(sceneFor(data, e('travel', 'move', 'q')).card.frame).toBe('#4a7a8a');
  });
  it('the events after a transformation use the colours of the new continent, not the colour of a category', () => {
    const sf = cardOfEntry(data, e('world', 'event', 'SF-01'));
    expect(sf.frame).toBe(scenes().frames.find((f) => f.group === 'SF')!.color);
    expect(sf.frame).not.toBe(scenes().frames.find((f) => f.group === 'DR')!.color);
  });
  it('the human rite plays the home and then the result; the rite of an elf plays pass or fail', () => {
    const hu = sceneFor(data, e('story', 'node', 'hu.t1', { rite: 'hu.t1', variant: 'ทุ่งราบ', result: 'pass' }));
    expect(hu.kind).toBe('script');
    if (hu.kind !== 'script') return;
    const base = scenes().scripts.find((s) => s.id === 'rite.hu')!;
    expect(hu.script.seconds).toBe(base.seconds + base.variants!['ทุ่งราบ'].seconds + base.variants!.pass.seconds);
    expect(hu.script.seconds).toBeGreaterThanOrEqual(15);
    expect(hu.script.seconds).toBeLessThanOrEqual(25);
    const el = sceneFor(data, e('story', 'node', 'el.t1', { rite: 'el.t1', result: 'fail', variant: 'ไม่ผ่าน' }));
    expect(el.kind === 'script' && frameAt(el.script, el.script.seconds - 0.5).light.mode).toBe('cold-back');
  });
  it('the destination of a tribe', () => {
    const v = sceneFor(data, e('story', 'node', 'gi.e1', { title: 'ปลายทาง' }));
    expect(v.kind === 'script' && v.script.id).toBe('dest.gi');
    expect(v.kind === 'script' && v.script.seconds).toBeGreaterThanOrEqual(15);
  });
  it('a clash plays its narration and the result that the combat wrote, or the standard closing', () => {
    const own = sceneFor(data, e('combat', 'clash', 'NF-AZ02-1', { outcome: 'ชนะ (เขายอมแพ้)', kind: 'win_spare' }));
    const std = sceneFor(data, e('combat', 'clash', 'NF-AZ02-1', { outcome: 'ผลที่ไม่มีในเอกสาร', kind: 'win_kill' }));
    const base = scenes().scripts.find((s) => s.id === 'NF-AZ02-1')!;
    expect(own.kind === 'script' && own.script.seconds).toBe(base.seconds + base.variants!['ชนะ (เขายอมแพ้)'].seconds);
    expect(std.kind === 'script' && std.script.seconds).toBeGreaterThan(base.seconds);
  });
  it('a day of a miracle, a generated local event by its template, an ally crisis', () => {
    expect(sceneFor(data, e('god', 'miracle', 'MR-17', { name: 'ดาวตก' })).kind).toBe('script');
    expect(sceneFor(data, e('god', 'miracle', 'MR-02', { name: 'ไม่อยู่ในตาราง' })).kind).toBe('card');
    const gen = sceneFor(data, e('events', 'local', 'LC-104', { name: 'ข่าวร้าย' }));
    expect(gen.kind === 'script' && gen.script.id).toBe('LT-6');
    expect(sceneFor(data, e('bonds', 'crisis', 'MH09-7', { code: 'FT-03', name: 'ฟีร่า' })).kind).toBe('script');
    expect(sceneFor(data, e('bonds', 'crisis', 'ZZ99-1', { code: 'FT-03', name: 'ใคร' })).kind).toBe('script');
    expect(sceneFor(data, e('story', 'node', 'bn.b1', {})).kind).toBe('script');
    expect(sceneFor(data, e('world', 'event', 'LE-05', { name: 'สภาแตกสองฝ่าย' })).kind).toBe('script');
  });
  it('the card words come from the text system, not from the scene data', () => {
    const v = sceneFor(data, e('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า', mark: '⭐' }));
    expect(v.card.title).toBe('ฤดูหนาวเถ้า');
    expect(v.card.body).not.toContain('เถ้าสีเทาตกช้า'); // the doc's picture words are not the card's text
  });
  it('without the scene data every entry is a card', () => {
    const bare: GameData = {};
    expect(sceneFor(bare, e('world', 'event', 'DR-04', { name: 'x' })).kind).toBe('card');
  });
});

// ---- the card shows no code of the data (M5 review round two R5) ----
import { EventCard } from '../../src/scene/EventCard';
import { leaks } from '../../src/core/text/plain';

/** The text of a vnode tree (what a player would read on the card). */
function textOf(v: unknown): string {
  if (v === null || v === undefined || typeof v === 'boolean') return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(textOf).join(' ');
  const node = v as { type?: unknown; props?: { children?: unknown } };
  if (typeof node.type === 'function' && node.type.name === 'Picture') return '';
  return textOf(node.props?.children);
}

describe('the event card reads as words', () => {
  it('no id of the data (HP-02) on any card of the world events and the local events, and no icon pill made of an id', () => {
    const cards = Object.values(scenes().cards ?? {}) as { id: string; name: string; icon: string; form: string; mark: string; frame: string; sky: string; fx: string[]; sound: string; picture: string }[];
    expect(cards.length).toBeGreaterThan(50);
    for (const c of cards) {
      const text = textOf(EventCard({ card: { id: c.id, title: c.name, body: '', frame: c.frame, icon: c.icon, mark: c.mark, form: c.form as never, sound: '', picture: '', fx: [], sky: c.sky } }));
      expect(text, c.id).not.toContain(c.id);
      expect(leaks(text.replace(c.name, '').replace(/\s+/g, ' ').trim()).filter((x) => x !== 'latin word' && x !== 'double space'), c.id).toEqual([]);
      expect(text, c.id).not.toMatch(/\b[A-Z]{2,4}\b(?:-\d+)?/);
    }
  });
});
