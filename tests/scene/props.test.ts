// The props of a scene (M7 ข1): the words of the docs choose them, the painter draws them, the card icons are whole bitmaps.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { cardOfEntry, placeOf, sceneFor, sceneryOf } from '../../src/app/views/scene';
import { paintScenery } from '../../src/art/scenery';
import { PROP_KINDS, paintProps } from '../../src/art/scenery/props';
import { paintCard } from '../../src/scene/cardpic';
import { CORNER_ICONS, ICON_SIZE } from '../../src/scene/corner';
import { stagingOf } from '../../src/scene/props';
import { specKey } from '../../src/scene/scenery';
import type { GameData } from '../../src/core/game';
import type { LogEntry } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});
const e = (sys: string, kind: string, id: string, d: LogEntry['data'] = {}): LogEntry => ({ n: 1, worldYear: 450, sys, kind, id, data: d, level: 2 });

describe('the staging of a scene', () => {
  it('the rite of a tribe has its own prop and place (13 §2)', () => {
    const v = (id: string, place = '') => {
      const s = sceneFor(data, e('story', 'node', id, { rite: id }), null);
      if (s.kind !== 'script') throw new Error(id);
      return stagingOf(s.script, place);
    };
    expect(v('el.t1').props).toContain('roots');
    expect(v('dw.t1')).toMatchObject({ props: ['anvil'], setting: 'indoor' });
    expect(v('hu.t1', 'พิธีของถิ่น · ทุ่งราบ').props).toContain('worktable');
    expect(v('hu.t1', 'พิธีของถิ่น · หมอก').props).toEqual([]);
  });

  it('the words of a scene name its props: DR-03 the egg in the sky, NF-AZ02-1 the flame, the cliff and the watchers', () => {
    const dr = sceneFor(data, e('world', 'event', 'DR-03'), null);
    const nf = sceneFor(data, e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1' }), null);
    if (dr.kind !== 'script' || nf.kind !== 'script') throw new Error('no script');
    expect(stagingOf(dr.script)).toMatchObject({ props: ['egg'], setting: 'outdoor' });
    expect(stagingOf(nf.script).props).toEqual(expect.arrayContaining(['flame', 'cliff', 'spectators']));
  });

  it('the picture of the card of DR-03 carries the egg, and is in the country of the sky nest', () => {
    const entry = e('world', 'event', 'DR-03');
    expect(cardOfEntry(data, entry, null).scenery?.props).toContain('egg');
    expect(placeOf(data, null, entry)).toEqual({ continent: 'AZ', country: 'AZ-01' });
  });

  it('the painted place of a scene carries its props as a layer, and a place with none has no such layer', () => {
    const nf = sceneFor(data, e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1' }), null);
    const spec = sceneryOf(data, null, nf)('ลานดวลริมหน้าผา');
    expect(spec.props).toContain('flame');
    const withProps = paintScenery(spec);
    expect(withProps.layers.map((l) => l.name)).toEqual(['sky', 'far', 'mid', 'ground', 'props']);
    expect(specKey(spec)).not.toBe(specKey({ ...spec, props: [] }));
    expect(paintScenery({ ...spec, props: [] }).layers).toHaveLength(4);
  });

  it('every prop paints something, the same each time', () => {
    for (const k of PROP_KINDS) {
      const a = paintProps([k], 5)!;
      expect(a.data.some((v, i) => i % 4 === 3 && v > 0), k).toBe(true);
      expect(Buffer.compare(Buffer.from(paintProps([k], 5)!.data), Buffer.from(a.data)), k).toBe(0);
    }
    expect(paintProps([], 1)).toBeNull();
  });
});

describe('the cards', () => {
  it('a card of form M is a map layer, not the place of a scene', () => {
    const m = cardOfEntry(data, e('world', 'event', 'DR-06', { name: 'ลมหยุดหายใจ' }), null);
    expect(m.form).toBe('M');
    const a = paintCard(m);
    const b = paintCard({ ...m, form: 'L' });
    expect(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data))).not.toBe(0);
  });

  it('every corner icon of the docs is a bitmap of 11 by 11', () => {
    for (const [word, bits] of Object.entries(CORNER_ICONS)) {
      expect(bits, word).toHaveLength(ICON_SIZE);
      for (const r of bits) expect(r.length, word).toBe(ICON_SIZE);
    }
    const icons = (data.scenes?.items as { frames: { icon: string }[] }).frames.map((f) => f.icon).filter(Boolean);
    for (const w of icons) expect(CORNER_ICONS[w], w).toBeDefined();
  });
});
