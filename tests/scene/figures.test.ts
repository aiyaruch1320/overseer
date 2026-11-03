// Who is on the stage and where it is (M7 ก1): the figure each actor of a scene resolves to, and the painted place of a scene.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { figuresOf, npcOfScene, placeOf, sceneFor, sceneryOf, settingOf, type SceneView } from '../../src/app/views/scene';
import { mainLookOf } from '../../src/app/views/looks';
import { DRAGONS } from '../../src/art/beast/look';
import { SETTINGS } from '../../src/art/scenery/types';
import type { ScenesData } from '../../src/core/data/types-scenes';
import type { GameData } from '../../src/core/game';
import type { GameState, LogEntry } from '../../src/core/types';

let data: GameData;
let state: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 3 });
  startLife(s);
  for (let i = 0; i < 12 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  state = s.game.state;
});

const e = (sys: string, kind: string, id: string, d: LogEntry['data'] = {}): LogEntry => ({ n: 1, worldYear: 450, sys, kind, id, data: d, level: 2 });
const view = (en: LogEntry): SceneView => sceneFor(data, en);
const clash = () => view(e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', outcome: 'แพ้', kind: 'lose' }));

describe('actor to look', () => {
  it('the main character is the figure of the life', () => {
    const v = view(e('story', 'node', 'hu.t1', { rite: 'hu.t1', variant: 'ทุ่งราบ', result: 'pass' }));
    expect(v.kind).toBe('script');
    const f = figuresOf(data, state, v)({ id: 'a', label: 'ตัวละคร', count: 1 });
    expect(f.kind).toBe('person');
    if (f.kind === 'person') expect(f.looks[0]).toEqual(mainLookOf(data, state));
  });

  it('the child of a rite is the same person, younger', () => {
    const v = view(e('story', 'node', 'hu.t1', { rite: 'hu.t1' }));
    const main = figuresOf(data, state, v)({ id: 'a', label: 'ตัวละคร', count: 1 });
    const child = figuresOf(data, state, v)({ id: 'a', label: 'เด็ก', count: 1 });
    expect(child.kind).toBe('person');
    if (child.kind === 'person' && main.kind === 'person') expect(child.looks[0].stage).toBe('child');
  });

  it('the foe of a clash is the NPC of the entry, as a person of the table', () => {
    const v = clash();
    expect(npcOfScene(v)).toBe('AZ02-1');
    const f = figuresOf(data, state, v)({ id: 'b', label: 'ซากโรวีร์', count: 1 });
    expect(f.kind).toBe('person');
    if (f.kind === 'person') expect(f.looks[0].key).toContain('AZ02-1');
  });

  it('the foe of a standard closing (labelled only "คู่ต่อสู้") is found by the NPC of the entry', () => {
    const v = view(e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', kind: 'lose' }));
    const f = figuresOf(data, state, v)({ id: 'b', label: 'คู่ต่อสู้', count: 1 });
    expect(f.kind).toBe('person');
  });

  it('a creature NPC is its beast', () => {
    const v = view(e('combat', 'clash', 'NF-AZ02-1', { npc: 'MH04-2' }));
    const f = figuresOf(data, state, v)({ id: 'b', label: 'คู่ต่อสู้', count: 1 });
    expect(f.kind).toBe('beast');
  });

  it('a crowd is as many people of the life\'s race as it counts, not all alike', () => {
    const v = view(e('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า' }));
    const f = figuresOf(data, state, v)({ id: 'crowd', label: 'ผู้คน', count: 4 });
    expect(f.kind).toBe('person');
    if (f.kind === 'person') {
      expect(f.looks).toHaveLength(4);
      expect(new Set(f.looks.map((l) => l.key)).size).toBe(4);
      expect(f.looks.every((l) => l.race === state.life!.race)).toBe(true);
    }
  });

  it('a dragon the label names is its beast; the entry may name it by number', () => {
    const v = view(e('world', 'dragonFall', 'x', { dragon: 2 }));
    const of = figuresOf(data, state, v);
    expect(of({ id: 'd', label: DRAGONS[4].name, count: 1 })).toEqual({ kind: 'beast', look: DRAGONS[4] });
    expect(of({ id: 'd', label: 'มังกร', count: 1 })).toEqual({ kind: 'beast', look: DRAGONS[2] });
  });

  it('anyone unknown is a plain person, never the silhouette (M7 K5-3); the silhouette is only for a stage with no looks at all', () => {
    const v = view(e('story', 'node', 'hu.a3', {}));
    const f = figuresOf(data, state, v)({ id: 'x', label: 'ใครสักคนที่ไม่มีในตาราง', count: 1 });
    expect(f.kind).toBe('person');
    const none = { ...data, looks: undefined } as unknown as GameData;
    expect(figuresOf(none, null, v)({ id: 'a', label: 'ตัวละคร', count: 1 })).toEqual({ kind: 'silhouette' });
  });

  it('the answer for an actor is made once', () => {
    const of = figuresOf(data, state, clash());
    const a = of({ id: 'b', label: 'ซากโรวีร์', count: 1 });
    expect(of({ id: 'b', label: 'ซากโรวีร์', count: 1 })).toBe(a);
  });

  it('every actor of every script resolves to something the stage can draw (no throw)', () => {
    const scripts = (data.scenes.items as ScenesData).scripts;
    for (const s of scripts.slice(0, 250)) {
      const v: SceneView = { kind: 'script', script: s, card: { id: s.id, title: '', body: '', frame: '', icon: '', mark: '', sound: '', picture: '', fx: [], sky: '' }, entry: e('x', 'y', s.id, {}) };
      const of = figuresOf(data, state, v);
      for (const b of s.beats) if (b.k === 'actor') expect(['person', 'beast', 'silhouette']).toContain(of({ id: b.id, label: b.label, count: b.count ?? 1 }).kind);
    }
  });
});

describe('the place of a scene', () => {
  it('the setting is guessed from the words of the place; a name that says nothing is under the sky', () => {
    expect(settingOf('ห้องสภาครึ่งหนึ่งยื่นออกเหนือหุบ')).toBe('indoor');
    expect(settingOf('ตลาดโคมใหญ่')).toBe('town');
    expect(settingOf('ท่าเรือเก่า')).toBe('town');
    expect(settingOf('ทุ่งจม')).toBe('outdoor');
    expect(settingOf('')).toBe('outdoor');
    for (const p of ['ห้องซ่อมหุ่น', 'เมืองกลางน้ำ', 'สกายฟอลล์']) expect(SETTINGS).toContain(settingOf(p));
  });

  it('the continent and country are the life\'s', () => {
    const at = placeOf(data, state, e('world', 'event', 'DR-04'));
    expect(at?.country).toBe(state.life!.country);
    expect(at?.continent).toBe(state.life!.country.split('-')[0]);
  });

  it('with no life, the country of the NPC of the entry; with neither, nothing', () => {
    expect(placeOf(data, null, e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1' }))).toEqual({ continent: 'AZ', country: 'AZ-02' });
    expect(placeOf(data, null, e('world', 'event', 'DR-04'))).toBeUndefined();
  });

  it('the spec follows the place the frame names (the setting) and keeps the rest', () => {
    const v = view(e('world', 'event', 'DR-04'));
    const of = sceneryOf(data, state, v);
    const out = of('ห้องมืด');
    const open = of('ทุ่งจม');
    expect(out.setting).toBe('indoor');
    expect(open.setting).toBe('outdoor');
    expect(out.continent).toBe(open.continent);
    expect(out.seed).toBe(open.seed);
    expect(out.country).toBe(state.life!.country);
  });

  it('with nothing known the place is a plain one of the first continent', () => {
    const of = sceneryOf(data, null, view(e('world', 'event', 'DR-04')));
    expect(of('ทุ่งจม')).toMatchObject({ continent: 'AZ', setting: 'outdoor' });
  });
});
