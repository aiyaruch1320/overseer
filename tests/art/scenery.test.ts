// M7 ก2: the painter of scene backgrounds. Every continent and setting paints the four layers at the contract sizes, the same spec gives the same pixels,
// the nine continents (and the three settings) look different from each other, a season tints, an unknown continent still paints, the country table agrees
// with the data, and a spec paints fast enough to be done when a scene opens.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../../src/art/scenery/countries';
import { paintScenery, GROUND_Y, SCENE_H, SCENE_W, SETTINGS, type LayerName, type Scenery, type ScenerySpec, type Setting } from '../../src/art/scenery';
import { BASES } from '../../src/art/scenery/profiles';

const IDS = [...BASES];
const LAYERS: LayerName[] = ['sky', 'far', 'mid', 'ground'];
const countries = JSON.parse(readFileSync('data/gen/countries.json', 'utf8')).items as { id: string; ui: { roofs: string[]; styles: Record<string, number>; ambient: string; wall: string; centre: string; raw: Record<string, string> } }[];
const continents = JSON.parse(readFileSync('data/gen/continents.json', 'utf8')).items.continents as { id: string }[];

const spec = (continent: string, setting: Setting, o: Partial<ScenerySpec> = {}): ScenerySpec => ({ continent, setting, country: setting === 'outdoor' ? undefined : `${continent}-01`, ...o });

/** A cheap hash of every pixel of every layer. */
function hash(s: Scenery): number {
  let h = 2166136261;
  for (const l of s.layers) for (let i = 0; i < l.frame.data.length; i += 7) h = Math.imul(h ^ l.frame.data[i], 16777619);
  return h >>> 0;
}
/** The first screen of the layers named, laid over each other (RGB, SCENE_W × SCENE_H). */
function look(s: Scenery, names: LayerName[]): Float32Array {
  const out = new Float32Array(SCENE_W * SCENE_H * 3);
  for (const name of names) {
    const f = s.layers.find((l) => l.name === name)!.frame;
    for (let y = 0; y < SCENE_H; y++)
      for (let x = 0; x < SCENE_W; x++) {
        const i = (y * f.w + x) * 4, a = f.data[i + 3] / 255, o = (y * SCENE_W + x) * 3;
        for (let q = 0; q < 3; q++) out[o + q] = f.data[i + q] * a + out[o + q] * (1 - a);
      }
  }
  return out;
}
const distance = (a: Float32Array, b: Float32Array): number => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };
const mean = (a: Float32Array): number => a.reduce((s, v) => s + v, 0) / a.length;

describe('M7 ก2: the layers', () => {
  it('every continent and setting paints sky, far, mid and ground at the contract sizes', () => {
    for (const id of IDS)
      for (const setting of SETTINGS) {
        const s = paintScenery(spec(id, setting));
        expect(s.layers.map((l) => l.name), `${id} ${setting}`).toEqual(LAYERS);
        for (const l of s.layers) {
          const f = l.frame;
          expect(f.h, `${id} ${setting} ${l.name} height`).toBe(SCENE_H);
          expect(f.w, `${id} ${setting} ${l.name} width`).toBeGreaterThanOrEqual(SCENE_W);
          expect(f.data.length).toBe(f.w * f.h * 4);
          expect(l.speed).toBeGreaterThanOrEqual(0);
          expect(l.speed).toBeLessThanOrEqual(1);
          // a layer that moves is wider than the screen and repeats (so a camera can wrap it): its edges meet
          if (l.name !== 'sky') expect(f.w, `${id} ${setting} ${l.name} wider`).toBeGreaterThan(SCENE_W);
        }
        const speeds = s.layers.map((l) => l.speed);
        expect(speeds[0]).toBe(0);
        expect(speeds[3]).toBe(1);
        expect(speeds[1]).toBeGreaterThan(speeds[0]);
        expect(speeds[2]).toBeGreaterThan(speeds[1]);
        expect(speeds[3]).toBeGreaterThan(speeds[2]);
      }
  });

  it('the sky is opaque and the ground is opaque from its top down; the far and mid layers have something in them', () => {
    for (const id of IDS)
      for (const setting of SETTINGS) {
        const s = paintScenery(spec(id, setting)), [sky, far, mid, ground] = s.layers.map((l) => l.frame);
        for (let i = 3; i < sky.data.length; i += 4) if (sky.data[i] !== 255) throw new Error(`${id} ${setting}: the sky has a hole at ${(i - 3) / 4}`);
        for (let y = GROUND_Y; y < SCENE_H; y++) for (let x = 0; x < ground.w; x += 3) if (ground.data[(y * ground.w + x) * 4 + 3] !== 255) throw new Error(`${id} ${setting}: the ground has a hole at ${x},${y}`);
        for (const [name, f] of [['far', far], ['mid', mid]] as const) {
          let n = 0;
          for (let i = 3; i < f.data.length; i += 4) if (f.data[i]) n++;
          expect(n, `${id} ${setting} ${name} is not empty`).toBeGreaterThan(f.w * 3);
        }
      }
  });

  it('a layer that moves repeats at its width: the last column meets the first', () => {
    for (const id of IDS) {
      const s = paintScenery(spec(id, 'outdoor'));
      for (const l of s.layers.slice(1)) {
        const f = l.frame;
        let jump = 0, rows = 0;
        for (let y = 0; y < f.h; y++) {
          const a = (y * f.w) * 4, b = (y * f.w + f.w - 1) * 4;
          if (!f.data[a + 3] && !f.data[b + 3]) continue;
          rows++;
          if (!f.data[a + 3] !== !f.data[b + 3]) jump += 60;
          else for (let q = 0; q < 3; q++) jump += Math.abs(f.data[a + q] - f.data[b + q]) / 3;
        }
        expect(jump / Math.max(1, rows), `${id} ${l.name} seam`).toBeLessThan(60);
      }
    }
  });
});

describe('M7 ก2: the same and different', () => {
  it('the same spec gives the same pixels; another seed changes the details, not the continent', () => {
    for (const setting of SETTINGS) {
      const a = paintScenery(spec('SH', setting, { seed: 4 })), b = paintScenery(spec('SH', setting, { seed: 4 })), c = paintScenery(spec('SH', setting, { seed: 5 }));
      expect(hash(a)).toBe(hash(b));
      expect(hash(c)).not.toBe(hash(a));
      expect(a.light).toBe(c.light);
    }
  });

  it('the nine continents look different: the sky and far layers of any two are far apart in every setting', () => {
    for (const setting of SETTINGS) {
      const looks = IDS.map((id) => look(paintScenery(spec(id, setting)), ['sky', 'far']));
      for (let a = 0; a < IDS.length; a++)
        for (let b = a + 1; b < IDS.length; b++)
          expect(distance(looks[a], looks[b]), `${setting}: ${IDS[a]} and ${IDS[b]}`).toBeGreaterThan(14);
    }
  });

  it('the whole picture of any two continents differs too, and the three settings of one continent differ', () => {
    const full = IDS.map((id) => look(paintScenery(spec(id, 'town')), LAYERS));
    for (let a = 0; a < IDS.length; a++) for (let b = a + 1; b < IDS.length; b++) expect(distance(full[a], full[b]), `${IDS[a]} ${IDS[b]}`).toBeGreaterThan(18);
    for (const id of IDS) {
      const [o, t, i] = SETTINGS.map((s) => look(paintScenery(spec(id, s)), LAYERS));
      expect(distance(o, t), `${id} outdoor and town`).toBeGreaterThan(5);
      expect(distance(o, i), `${id} outdoor and indoor`).toBeGreaterThan(14);
      expect(distance(t, i), `${id} town and indoor`).toBeGreaterThan(14);
    }
  });

  it('two countries of one continent are two towns (roofs and styles from their ui)', () => {
    const a = paintScenery(spec('AZ', 'town', { country: 'AZ-01' })), b = paintScenery(spec('AZ', 'town', { country: 'AZ-04' }));
    expect(distance(look(a, LAYERS), look(b, LAYERS))).toBeGreaterThan(3);
    const c = paintScenery(spec('SH', 'indoor', { country: 'SH-01' })), d = paintScenery(spec('SH', 'indoor', { country: 'SH-09' }));
    expect(hash(c)).not.toBe(hash(d));
  });

  it('a season tints the sky and the ground; all four differ from each other and from the plain place', () => {
    for (const id of ['AZ', 'AL', 'SV', 'SH']) {
      const plain = paintScenery(spec(id, 'outdoor')), seasons = [0, 1, 2, 3].map((n) => paintScenery(spec(id, 'outdoor', { season: n })));
      const hs = new Set([hash(plain), ...seasons.map(hash)]);
      expect(hs.size, id).toBe(5);
      for (const s of seasons) expect(distance(look(s, ['sky']), look(plain, ['sky'])), `${id} sky`).toBeGreaterThan(1);
    }
    // winter keeps snow where the land can: the ground of AL is lighter, in KD (lava) it is hardly changed
    const bright = (id: string, season?: number): number => mean(look(paintScenery(spec(id, 'outdoor', { season })), ['ground']));
    expect(bright('AL', 3)).toBeGreaterThan(bright('AL') + 10);
    expect(Math.abs(bright('KD', 3) - bright('KD'))).toBeLessThan(20);
    // the rains are darker than the plain sky, the harvest warmer
    const sky = (id: string, season?: number) => look(paintScenery(spec(id, 'outdoor', { season })), ['sky']);
    expect(mean(sky('AL', 1))).toBeLessThan(mean(sky('AL')));
    // a season outside 0..3 is clamped, not an error
    expect(() => paintScenery(spec('AL', 'town', { season: 9 }))).not.toThrow();
    expect(() => paintScenery(spec('AL', 'town', { season: Number.NaN }))).not.toThrow();
  });
});

/** HSV saturation of an opaque pixel of a frame at index i (value and saturation as the largest and the smallest channel say). */
const satAt = (d: Uint8ClampedArray, i: number): { s: number; v: number } => {
  const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
  return { s: mx ? (mx - mn) / mx : 0, v: mx };
};

describe('M7 K5-7: Nebulia holds every colour down (01-continents §9)', () => {
  it('no pixel of any NB layer is more saturated than the ceiling, whatever the country, the setting and the season', () => {
    const nb = countries.filter((c) => c.id.startsWith('NB')).map((c) => c.id);
    expect(nb.length).toBeGreaterThan(5);
    for (const country of nb)
      for (const setting of SETTINGS)
        for (const season of [undefined, 0, 1, 2, 3]) {
          const s = paintScenery({ continent: 'NB', country, setting, season });
          let worst = 0;
          for (const l of s.layers) for (let i = 0; i < l.frame.data.length; i += 4) if (l.frame.data[i + 3]) { const { s: sat, v } = satAt(l.frame.data, i); if (v >= 48) worst = Math.max(worst, sat); }
          expect(worst, `${country} ${setting} season ${season}`).toBeLessThanOrEqual(0.37);
        }
  }, 120000);

  it('a country that gives NB bright colours (NB-03 gold, NB-11 pastel, NB-09 wine) still paints a grey town; the others are not held down', () => {
    const meanSat = (id: string, country: string): number => {
      const s = paintScenery({ continent: id, country, setting: 'town' });
      let sum = 0, n = 0;
      for (const l of s.layers) for (let i = 0; i < l.frame.data.length; i += 16) if (l.frame.data[i + 3]) { sum += satAt(l.frame.data, i).s; n++; }
      return sum / n;
    };
    for (const c of ['NB-03', 'NB-09', 'NB-11']) expect(meanSat('NB', c), c).toBeLessThan(0.2);
    for (const id of ['AZ', 'AL', 'SH']) expect(meanSat(id, `${id}-01`), id).toBeGreaterThan(0.2);
  });
});

describe('M7 K5-10: the season reaches every continent (outdoor and town)', () => {
  const MIN = 5;
  it('the four seasons of every continent differ pairwise by a mean colour distance above the threshold', () => {
    for (const setting of ['outdoor', 'town'] as const)
      for (const id of IDS) {
        const ls = [0, 1, 2, 3].map((n) => look(paintScenery(spec(id, setting, { season: n })), LAYERS));
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(distance(ls[a], ls[b]), `${id} ${setting}: season ${a} and ${b}`).toBeGreaterThan(MIN);
      }
  }, 60000);

  it('a season moves the light of the place the stage tints the characters with, and a green forest is not green in the winter', () => {
    for (const id of IDS) expect(new Set([0, 1, 2, 3].map((n) => paintScenery(spec(id, 'outdoor', { season: n })).light)).size, id).toBe(4);
    const green = (season: number): number => {
      const s = paintScenery(spec('SV', 'outdoor', { season }));
      let g = 0, n = 0;
      for (const l of s.layers) for (let i = 0; i < l.frame.data.length; i += 16) if (l.frame.data[i + 3]) { const d = l.frame.data; g += d[i + 1] - Math.max(d[i], d[i + 2]); n++; }
      return g / n;
    };
    expect(green(3)).toBeLessThan(green(0) * 0.35);
    expect(green(3)).toBeLessThan(green(1) * 0.5);
  });

  it('snow only where the land keeps it: the deep cover of the plain, none on the lava land or the desert', () => {
    const white = (id: string): number => {
      const g = paintScenery(spec(id, 'outdoor', { season: 3 })).layers[3].frame;
      let n = 0, w = 0;
      for (let y = GROUND_Y; y < SCENE_H; y++) for (let x = 0; x < g.w; x += 2) { n++; const i = (y * g.w + x) * 4; if (Math.min(g.data[i], g.data[i + 1], g.data[i + 2]) > 200) w++; }
      return w / n;
    };
    expect(white('AL')).toBeGreaterThan(0.3);
    expect(white('KD')).toBe(0);
    expect(white('SH')).toBeLessThan(0.03); // the salt specks of the sand, not snow
  });
});

describe('M7 ก2: light, ambient and the continent ids', () => {
  it('every place has a light #rrggbb, an ambient outdoors and in town', () => {
    for (const id of IDS)
      for (const setting of SETTINGS) {
        const s = paintScenery(spec(id, setting));
        expect(s.light, `${id} ${setting}`).toMatch(/^#[0-9a-f]{6}$/i);
        if (setting !== 'indoor') expect(s.ambient, `${id} ${setting} ambient`).toBeTruthy();
      }
    // the doc's ambient of each continent (บรรยากาศ)
    const want: Record<string, string> = { AZ: 'clouds', MH: 'embers', KD: 'embers', NR: 'gulls', AL: 'leaves', MK: 'smoke', SH: 'sand', SV: 'leaves', NB: 'fog' };
    for (const id of IDS) expect(paintScenery(spec(id, 'outdoor')).ambient).toBe(want[id]);
    // a country that names its own ambient wins in town
    const fog = countries.find((c) => c.ui.ambient === 'fog' && c.id.startsWith('NR'))?.id ?? countries.find((c) => c.ui.ambient === 'fog')!.id;
    expect(paintScenery(spec(fog.slice(0, 2), 'town', { country: fog })).ambient).toBe('fog');
  });

  it('the continents of the data are the nine the painter knows', () => {
    expect(continents.map((c) => c.id).sort()).toEqual([...IDS].sort());
  });

  it('the old spellings KZ and AD paint as KD and AL', () => {
    expect(hash(paintScenery(spec('KZ', 'outdoor')))).toBe(hash(paintScenery(spec('KD', 'outdoor'))));
    expect(hash(paintScenery(spec('AD', 'town', { country: 'AL-01' })))).toBe(hash(paintScenery(spec('AL', 'town', { country: 'AL-01' }))));
  });

  it('an unknown continent paints all layers, deterministically, worn from a known look; its country names the parent', () => {
    for (const id of ['XX', 'SKYFALL', 'zz-new', '']) {
      for (const setting of SETTINGS) {
        const s = paintScenery(spec(id, setting, { country: undefined }));
        expect(s.layers.map((l) => l.name)).toEqual(LAYERS);
        expect(s.light).toMatch(/^#[0-9a-f]{6}$/i);
        expect(hash(s)).toBe(hash(paintScenery(spec(id, setting, { country: undefined }))));
      }
    }
    // a land born of the fall of AZ keeps the sky look of AZ but worn: it is near AZ and not equal to it
    const born = paintScenery({ continent: 'AZ-FALL', country: 'AZ-03', setting: 'outdoor' }), az = paintScenery({ continent: 'AZ', setting: 'outdoor' });
    const d = distance(look(born, ['sky', 'far']), look(az, ['sky', 'far']));
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(60);
    // two unknown ids (without a country) are not forced to one look
    expect(hash(paintScenery(spec('QA', 'outdoor')))).not.toBe(hash(paintScenery(spec('QB', 'outdoor'))));
  });
});

describe('M7 ก2: the country table', () => {
  it('src/art/scenery/countries.ts agrees with data/gen/countries.json (run scripts/tools/gen-scenery-countries.mjs after the data changes)', () => {
    expect(Object.keys(COUNTRIES).sort()).toEqual(countries.map((c) => c.id).sort());
    for (const c of countries) {
      const t = COUNTRIES[c.id];
      expect(t.roofs, c.id).toEqual(c.ui.roofs.map((h) => h.toLowerCase()));
      expect(t.ambient, c.id).toBe(c.ui.ambient);
      expect(t.wall, c.id).toBe(c.ui.wall);
      expect(t.centre, c.id).toBe(c.ui.centre);
      expect(t.tree, c.id).toBe(c.ui.raw.tree ?? '');
      expect(t.styles[0], c.id).toBe(Object.entries(c.ui.styles).sort((a, b) => b[1] - a[1])[0][0]);
      expect(t.lamps, c.id).toBe(c.ui.raw.lamps === 'true' ? 1 : 0);
    }
  });

  it('every country paints a town and an inside without a hole', () => {
    for (const c of countries)
      for (const setting of ['town', 'indoor'] as const) {
        const s = paintScenery({ continent: c.id.slice(0, 2), country: c.id, setting, season: 2 });
        expect(s.layers.length, c.id).toBe(4);
        expect(s.layers[3].frame.data[(GROUND_Y + 8) * s.layers[3].frame.w * 4 + 3], `${c.id} ${setting} ground`).toBe(255);
      }
  }, 120000);
});

describe('M7 ก2: speed', () => {
  it('a spec paints in about 20 ms in Node once warm (under 60 while the full run loads the CPU) (median over every continent and setting)', () => {
    for (const id of IDS) paintScenery(spec(id, 'town'));
    const times: number[] = [];
    for (const id of IDS)
      for (const setting of SETTINGS) {
        const t0 = performance.now();
        paintScenery(spec(id, setting, { season: 1 }));
        times.push(performance.now() - t0);
      }
    times.sort((a, b) => a - b);
    // 30 ms is the goal on an idle machine (about 20 alone); the full run shares the CPU with four workers of whole lives, so the gate here is
    // twice that, enough to catch a painter that became several times slower
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(60);
  });
});
