// The geometry of the camera and the tiles: the zoom levels of world-map.md §3, which tiles a view needs, and how a focus is fitted.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { layoutOf, type MapLayout } from '../../src/map/layout';
import { NORMAL_LOOKS } from '../../src/map/provider';
import { cityRect, clampZoom, fitRect, focusOf, levelOf, rectFor, requestFor, tileSize, viewRect, visibleKeys } from '../../src/map/tiles';
import { CAM_MAX, CAM_MIN, CITY_W, SHEET, TILE_PX, WU, ZOOM_LEVELS } from '../../src/map/tuning';
import type { ContinentsFile } from '../../src/core/data/types-npcs';

let layout: MapLayout;
let zoomLevels: ContinentsFile['world']['zoomLevels'];
beforeAll(() => {
  const data = loadAll(['countries', 'continents']);
  layout = layoutOf(data);
  zoomLevels = (data.continents.items as ContinentsFile).world.zoomLevels;
});

describe('zoom levels', () => {
  it('agree with the docs (data/gen continents.json world.zoomLevels)', () => {
    expect(zoomLevels.map((l) => l.id)).toEqual(ZOOM_LEVELS.map((l) => l.id));
    zoomLevels.forEach((l, i) => {
      expect(l.zoomMax, l.id).toBeCloseTo(ZOOM_LEVELS[i].max, 5);
    });
  });
  it('gives the level of a camera zoom by the limits 0.33 0.75 2 7', () => {
    expect(levelOf(0.1)).toBe('world');
    expect(levelOf(0.32)).toBe('world');
    expect(levelOf(0.33)).toBe('continent');
    expect(levelOf(0.74)).toBe('continent');
    expect(levelOf(0.75)).toBe('country');
    expect(levelOf(1.99)).toBe('country');
    expect(levelOf(2)).toBe('city');
    expect(levelOf(6.9)).toBe('city');
    expect(levelOf(7)).toBe('inside');
    expect(levelOf(48)).toBe('inside');
  });
  it('keeps the camera zoom inside 0.1 to 48', () => {
    expect(clampZoom(0.001)).toBe(CAM_MIN);
    expect(clampZoom(900)).toBe(CAM_MAX);
    expect(CAM_MAX).toBe(48);
  });
});

describe('tiles', () => {
  it('covers the sheet at the world level and a padded box per continent and country', () => {
    expect(rectFor(layout, 'world', 'world')).toEqual({ x: 0, y: 0, w: SHEET.w, h: SHEET.h });
    const al = rectFor(layout, 'continent', 'AL');
    expect(al.w).toBeGreaterThan(layout.continents.AL.box.w);
    const c = layout.byId.get('AL-01')!;
    const r = rectFor(layout, 'country', 'AL-01');
    expect(r.x).toBeLessThanOrEqual(c.box.x);
    expect(r.x + r.w).toBeGreaterThanOrEqual(c.box.x + c.box.w);
  });
  it('makes a town tile of 120 world units around the town', () => {
    const t = layout.cities[0];
    const r = cityRect(t);
    expect(r.w * WU).toBeCloseTo(120, 5);
    expect(r.x + r.w / 2).toBeCloseTo(t.x, 5);
    expect(requestFor(layout, 'city', t.id, NORMAL_LOOKS, 1).continent).toBe(layout.byId.get(t.country)!.continent);
    expect(CITY_W).toBeCloseTo(31.25, 1);
  });
  it('keeps a tile canvas within 2048 px whatever the density', () => {
    for (const lv of ZOOM_LEVELS) {
      const key = lv.id === 'world' ? 'world' : lv.id === 'continent' ? 'AL' : lv.id === 'country' ? 'AL-01' : layout.cities[0].id;
      const req = requestFor(layout, lv.id, key, NORMAL_LOOKS, 1);
      const s = tileSize(req);
      expect(s.w).toBeLessThanOrEqual(2048);
      expect(s.h).toBeLessThanOrEqual(2048);
      expect(s.px).toBeLessThanOrEqual(TILE_PX[lv.id]);
    }
  });
  it('asks only for the tiles a view touches', () => {
    const al = layout.continents.AL.box;
    const view = { x: al.x + al.w / 2 - 20, y: al.y + al.h / 2 - 20, w: 40, h: 40 };
    expect(visibleKeys(layout, 'world', view)).toEqual(['world']);
    expect(visibleKeys(layout, 'continent', view)).toEqual(['AL']);
    const countries = visibleKeys(layout, 'country', view);
    expect(countries.length).toBeGreaterThan(0);
    expect(countries.length).toBeLessThan(10);
    expect(countries.every((id) => id.startsWith('AL-'))).toBe(true);
    expect(visibleKeys(layout, 'city', view).length).toBeLessThan(12);
    expect(visibleKeys(layout, 'continent', { x: -500, y: -500, w: 10, h: 10 })).toEqual([]);
  });
});

describe('camera', () => {
  it('fits a rect in a viewport and looks back at the same rect', () => {
    const r = { x: 100, y: 100, w: 400, h: 200 };
    const f = fitRect(r, 1280, 720);
    const v = viewRect(f.x, f.y, f.zoom, 1280, 720);
    expect(v.x).toBeLessThanOrEqual(r.x);
    expect(v.x + v.w).toBeGreaterThanOrEqual(r.x + r.w);
    expect(v.y + v.h).toBeGreaterThanOrEqual(r.y + r.h);
  });
  it('focuses the world, a continent, a country and a town at growing zoom', () => {
    const z = (f: Parameters<typeof focusOf>[1]) => focusOf(layout, f, 1280, 720).zoom;
    expect(z({ kind: 'world' })).toBeLessThan(z({ kind: 'continent', id: 'AL' }));
    expect(z({ kind: 'continent', id: 'AL' })).toBeLessThan(z({ kind: 'country', id: 'AL-01' }));
    expect(z({ kind: 'country', id: 'AL-01' })).toBeLessThan(z({ kind: 'city', id: 'AL-01/0' }));
    // a town named by its country goes to the capital
    expect(focusOf(layout, { kind: 'city', id: 'AL-01' }, 1280, 720).x).toBeCloseTo(layout.citiesOf('AL-01')[0].x, 3);
  });
});
