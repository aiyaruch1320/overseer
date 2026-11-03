// The day of a miracle (docs/appearance/20-god-ui.md §7.3) as a plain table: one row for each miracle the document names, the same ones the scene scripts `mr.MR-xx` are made from.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EventDayData } from '../../src/core/data/types-event-day';
import type { ScenesData } from '../../src/core/data/types-scenes';
import type { GenFile } from '../../src/core/types';

const read = <T>(f: string) => (JSON.parse(readFileSync(`data/gen/${f}.json`, 'utf8')) as GenFile<T>).items;
const D = read<EventDayData>('event-day');

describe('event-day generator', () => {
  it('reads every row of the table with its four beats and its sound', () => {
    expect(D.rows.length).toBe(17);
    expect(new Set(D.rows.map((r) => r.id)).size).toBe(D.rows.length);
    for (const r of D.rows) {
      expect(r.id).toMatch(/^MR-\d+$/);
      for (const f of [r.name, r.omen, r.happens, r.after, r.sound]) expect(f.length, r.id).toBeGreaterThan(3);
      expect(r.src).toMatch(/^docs\/appearance\/20-god-ui\.md:\d+$/);
    }
    expect(D.rows.find((r) => r.id === 'MR-01')).toMatchObject({ name: 'ฝนต้องฤดู', omen: 'เมฆเทาก่อตัวเป็นวงเหนือทุ่งแห้ง', sound: 'ฝนบนหลังคาฟาง', sceneRef: null });
    expect(D.rows.find((r) => r.id === 'MR-21')!.sceneRef).toBe('GD-04');
  });
  it('reads the seconds of a small scene and of a middle one, and the rule for a miracle that is not in the table', () => {
    expect(D.seconds).toEqual({ small: [3, 5], middle: [20, 40] });
    expect(D.fallback).toBe('same-line');
  });
  it('has a scene script for each row', () => {
    const ids = new Set(read<ScenesData>('scenes').scripts.map((s) => s.id));
    for (const r of D.rows) expect(ids.has(`mr.${r.id}`), r.id).toBe(true);
  });
});
