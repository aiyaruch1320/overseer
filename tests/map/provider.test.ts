// The map art providers: the code-drawn one is deterministic and covers every zoom level and look; the generated one reads the manifest and falls
// back to code tile by tile.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import type { Country } from '../../src/core/data/types-npcs';
import { planCity } from '../../src/map/city';
import { codeProvider } from '../../src/map/codeProvider';
import { imageProvider, lookIdOf, parseManifest } from '../../src/map/imageProvider';
import { layered, NORMAL_LOOKS, tileKey, type Looks, type TileImage } from '../../src/map/provider';
import { requestFor, tileSize } from '../../src/map/tiles';
import { FATES, ZOOM_LEVELS } from '../../src/map/tuning';
import { fakeCanvas, type FakeCanvas } from './fake-canvas';

let data: GameData;
beforeAll(() => {
  data = loadAll(['countries', 'continents']);
});

const hashOf = (t: unknown) => ((t as TileImage).source as unknown as FakeCanvas).hash();

describe('code-drawn provider', () => {
  it('draws the same tile twice, from two providers', () => {
    const a = codeProvider(data, { canvas: fakeCanvas });
    const b = codeProvider(data, { canvas: fakeCanvas });
    const req = requestFor(a.layout, 'continent', 'KD', NORMAL_LOOKS, 1);
    expect(hashOf(a.tile(req) as TileImage)).toBe(hashOf(b.tile(req) as TileImage));
    expect(a.painted).toBe(1);
    a.tile(req); // cached
    expect(a.painted).toBe(1);
  });

  it('answers every zoom level with a tile that covers the right part of the sheet', () => {
    const p = codeProvider(data, { canvas: fakeCanvas });
    const city = p.layout.cities[0];
    const keys: Record<string, string> = { world: 'world', continent: 'AL', country: 'AL-01', city: city.id, inside: city.id };
    expect(ZOOM_LEVELS.map((l) => l.id)).toEqual(['world', 'continent', 'country', 'city', 'inside']);
    for (const l of ZOOM_LEVELS) {
      const req = requestFor(p.layout, l.id, keys[l.id], NORMAL_LOOKS, 1);
      const t = p.tile(req) as TileImage;
      expect(t, l.id).not.toBeNull();
      expect(t.origin).toBe('code');
      expect(t.rect).toEqual(req.rect);
      expect(t.width).toBe(tileSize(req).w);
      expect(t.width).toBeLessThanOrEqual(2048);
    }
  });

  it('paints a changed continent differently from a normal one, for each of the eight forms', () => {
    const p = codeProvider(data, { canvas: fakeCanvas });
    const forms = FATES.filter((f) => f.continent !== '*');
    expect(forms.length).toBe(7); // the eighth, the flood, is not of one continent
    for (const f of FATES) {
      const looks: Looks = f.continent === '*' ? { fates: {}, flood: true } : { fates: { [f.continent]: f.id }, flood: false };
      const cont = f.continent === '*' ? 'NR' : f.continent;
      const normal = hashOf(p.tile(requestFor(p.layout, 'continent', cont, NORMAL_LOOKS, 1)));
      const changed = hashOf(p.tile(requestFor(p.layout, 'continent', cont, looks, 1)));
      expect(changed, f.id).not.toBe(normal);
    }
  });

  it('does not repaint a continent when another continent changes', () => {
    const p = codeProvider(data, { canvas: fakeCanvas });
    const a = requestFor(p.layout, 'continent', 'AL', NORMAL_LOOKS, 1);
    const b = requestFor(p.layout, 'continent', 'AL', { fates: { KD: 'ash' }, flood: false }, 1);
    expect(tileKey(a)).toBe(tileKey(b));
  });

  it('plans a town the same way twice and differently for different countries', () => {
    const countries = data.countries.items as Country[];
    const a = countries.find((c) => c.id === 'AZ-01')!, b = countries.find((c) => c.id === 'KD-01')!;
    const p1 = planCity(a, 'AZ', 'AZ-01/0', true, 1), p2 = planCity(a, 'AZ', 'AZ-01/0', true, 1), p3 = planCity(b, 'KD', 'KD-01/0', true, 1);
    expect(p1).toEqual(p2);
    expect(p1.buildings.length).toBeGreaterThan(30);
    expect(p3.buildings.length).toBeGreaterThan(25);
    expect(p1.ground).not.toBe(p3.ground);
    expect(p1.buildings.map((q) => q.style)).not.toEqual(p3.buildings.map((q) => q.style));
    // every house stands on the sheet of the town
    for (const q of p1.buildings) {
      expect(q.x).toBeGreaterThan(0);
      expect(q.x).toBeLessThan(p1.w);
      expect(q.y).toBeGreaterThan(0);
      expect(q.y).toBeLessThan(p1.h);
    }
  });

  it('shows the ruin in the town tile: a ruined country is painted another way', () => {
    const p = codeProvider(data, { canvas: fakeCanvas });
    const city = p.layout.citiesOf('AL-01')[0];
    const a = hashOf(p.tile(requestFor(p.layout, 'city', city.id, NORMAL_LOOKS, 1)));
    const b = hashOf(p.tile(requestFor(p.layout, 'city', city.id, { fates: {}, flood: false, ruin: { 'AL-01': 0.75 } }, 1)));
    expect(a).not.toBe(b);
  });

  it('paints the pixels of the sea and the land differently', () => {
    const p = codeProvider(data, { canvas: fakeCanvas });
    const t = p.tile(requestFor(p.layout, 'continent', 'AL', NORMAL_LOOKS, 1)) as TileImage;
    const px = (t.source as unknown as FakeCanvas).pixels()!;
    const at = (mx: number, my: number) => {
      const i = Math.floor((my - t.rect.y) * (t.width / t.rect.w)) * t.width + Math.floor((mx - t.rect.x) * (t.width / t.rect.w));
      return [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
    };
    const land = at(735, 440);
    const sea = at(t.rect.x + 4, t.rect.y + 4);
    expect(sea[2]).toBeGreaterThan(sea[0]); // the sea is blue
    expect(land[1]).toBeGreaterThan(land[2]); // the plain is green
  });
});

describe('generated-image provider', () => {
  const manifest = parseManifest({
    version: 1,
    tiles: [
      { level: 'continent', key: 'AL', file: 'continent/AL.png' },
      { level: 'continent', key: 'AL', look: 'split', file: 'continent/AL.split.png', rect: { x: 1, y: 2, w: 3, h: 4 } },
      { level: 'country', key: 'AL-01', file: 'country/AL-01.png' },
      { level: 'world', key: 'AL', file: 'world/AL.png' },
      { level: 'city', key: 'AL-01/0', file: 'nope.png' }, // a level the contract does not have: dropped
      { level: 'country', file: 'broken.png' }, // no key: dropped
    ],
  });
  const io = {
    url: (p: string) => (p === 'continent/AL.png' || p === 'continent/AL.split.png' || p === 'country/AL-01.png' ? `u:${p}` : null),
    load: async (u: string) => ({ source: {} as CanvasImageSource, width: u.length, height: 1 }),
  };

  it('reads the manifest and drops the rows that do not fit the contract', () => {
    expect(manifest.tiles.length).toBe(4);
    expect(parseManifest(null).tiles).toEqual([]);
  });

  it('answers the tiles the manifest lists, with its own rect or the code tile\'s', async () => {
    const code = codeProvider(data, { canvas: fakeCanvas });
    const img = imageProvider(manifest, code.layout, io);
    const normal = (await img.tile(requestFor(code.layout, 'continent', 'AL', NORMAL_LOOKS, 1))) as TileImage;
    expect(normal.origin).toBe('image');
    expect(normal.rect).toEqual(requestFor(code.layout, 'continent', 'AL', NORMAL_LOOKS, 1).rect);
    const split = (await img.tile(requestFor(code.layout, 'continent', 'AL', { fates: { AL: 'split' }, flood: false }, 1))) as TileImage;
    expect(split.rect).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('does not answer a look, a level or a tile the manifest lacks, and the layered provider then gives the code tile', async () => {
    const code = codeProvider(data, { canvas: fakeCanvas });
    const img = imageProvider(manifest, code.layout, io);
    const flooded = requestFor(code.layout, 'continent', 'AL', { fates: {}, flood: true }, 1);
    expect(lookIdOf(flooded)).toBe('flood');
    expect(await img.tile(flooded)).toBeNull(); // a picture of the dry land would be the wrong world
    expect(await img.tile(requestFor(code.layout, 'continent', 'KD', NORMAL_LOOKS, 1))).toBeNull();
    expect(await img.tile(requestFor(code.layout, 'city', 'AL-01/0', NORMAL_LOOKS, 1))).toBeNull();
    expect(await img.tile(requestFor(code.layout, 'world', 'world', NORMAL_LOOKS, 1))).toBeNull();
    const both = layered([img, code]);
    expect(((await both.tile(flooded)) as TileImage).origin).toBe('code');
    expect(((await both.tile(requestFor(code.layout, 'continent', 'AL', NORMAL_LOOKS, 1))) as TileImage).origin).toBe('image');
    expect(((await both.tile(requestFor(code.layout, 'country', 'AL-02', NORMAL_LOOKS, 1))) as TileImage).origin).toBe('code');
  });

  it('treats a picture that fails to load as a missing one', async () => {
    const code = codeProvider(data, { canvas: fakeCanvas });
    const img = imageProvider(manifest, code.layout, { url: io.url, load: async () => { throw new Error('x'); } });
    expect(await img.tile(requestFor(code.layout, 'continent', 'AL', NORMAL_LOOKS, 1))).toBeNull();
  });
});
