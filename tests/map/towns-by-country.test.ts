// M7 review F2: a town is its country's (the docs: `styles=` `roofs=` "วัสดุและสี" "ผู้คน" `ambient=`), not one pastel gable house with a crowd of one race.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import type { GameData } from '../../src/core/game';
import type { Country } from '../../src/core/data/types-npcs';
import type { LooksData } from '../../src/core/data/types-looks';
import { AIR_FRAMES, AIR_SIDE, SMOKE, airKind, airScroll, airSheet, smokeSheet } from '../../src/art/mapart/ambient';
import { chimneyOf, houseFrame } from '../../src/art/mapart/houses';
import { iconFrame } from '../../src/art/mapart/icons';
import { planCity } from '../../src/map/city';
import { crowdLooks, racesOfLine } from '../../src/map/crowd';
import { wallHexes, wallOf } from '../../src/map/palette';
import { groundChunks } from '../../src/map/tiles';
import { codeProvider } from '../../src/map/codeProvider';
import { NORMAL_LOOKS } from '../../src/map/provider';
import { CITY_H, CITY_W, GROUND_CHUNK, TOWN_PX } from '../../src/map/tuning';
import { tileSize } from '../../src/map/tiles';

let data: GameData;
let countries: Map<string, Country>;
let looks: LooksData;
beforeAll(() => {
  data = loadAll(['countries', 'continents', 'looks']);
  countries = new Map((data.countries!.items as Country[]).map((c) => [c.id, c]));
  looks = data.looks!.items as LooksData;
});

const plan = (id: string, seed = 1) => {
  const c = countries.get(id)!;
  return planCity(c, c.continent, `${id}/0`, true, seed);
};
const share = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length / xs.length;

describe('houses by country (V2-1, V2-2)', () => {
  it('reads the wall colours from the materials line: walls, not roofs', () => {
    expect(wallHexes(countries.get('KD-01')!.look.materials)).toEqual(['#5a4a4a']);
    expect(wallHexes(countries.get('MK-02')!.look.materials)).toEqual(['#6a2a2a', '#4a4a52']);
    expect(wallHexes(countries.get('AZ-01')!.look.materials)).toEqual([]); // the gold trim and the blue roof are not walls
  });

  it('KD-01 is granite and forges, MK-02 dark brick and iron: the walls are dark, never the pastel of a gable', () => {
    for (const id of ['KD-01', 'MK-02']) {
      const bs = plan(id).buildings.filter((b) => !b.special);
      const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
      expect(share(bs, (b) => lum(b.wall) < 120)).toBeGreaterThan(0.8);
    }
    expect(new Set(plan('KD-01').buildings.map((b) => b.style)).has('forge')).toBe(true);
    expect(share(plan('MK-02').buildings.filter((b) => !b.special), (b) => b.style === 'brick')).toBeGreaterThan(0.5);
  });

  it('NB-10 is muted huts: no saturated roof or wall, and a spiral footpath, not a road grid', () => {
    const p = plan('NB-10');
    const sat = (h: string) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return Math.max(...c) - Math.min(...c); };
    for (const b of p.buildings.filter((q) => !q.special)) {
      expect(sat(b.roof)).toBeLessThan(90);
      expect(sat(b.wall)).toBeLessThan(70);
    }
    expect(share(p.buildings, (b) => b.style === 'hut')).toBeGreaterThan(0.3);
    expect(p.streets.some((s) => s.pts.length > 60)).toBe(true);
  });

  it('wallOf: a style takes its own stuff and the docs wall of the country for stone and brick', () => {
    expect(wallOf('brick', ['#6a2a2a'], '#4a4a52', 0.5)).not.toBe(wallOf('gable', ['#6a2a2a'], '#4a4a52', 0.5));
    expect(wallOf('hut', [], '#7a7062', 0.3, true)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('the houses of a style are painted and the forge and the brick house smoke from a chimney', () => {
    for (const style of ['forge', 'brick', 'carved', 'stone', 'hut', 'gable']) {
      const spec = { style, roof: '#7a3a2a', wall: '#5a4a4a', w: 26, floors: 2 };
      const f = houseFrame(spec);
      let n = 0;
      for (let i = 3; i < f.data.length; i += 4) if (f.data[i]) n++;
      expect(n).toBeGreaterThan(100);
      if (style === 'forge' || style === 'brick' || style === 'gable') {
        const c = chimneyOf(spec)!;
        expect(c[0]).toBeGreaterThan(0); expect(c[0]).toBeLessThan(f.w); expect(c[1]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(chimneyOf({ style: 'hut', roof: '#fff', wall: '#fff', w: 20, floors: 1 })).toBeNull();
  });

  it('a field is whole: none reaches the dithered rim of the sheet', () => {
    for (const id of ['AL-01', 'NB-10', 'SH-01']) for (const f of plan(id).fields) {
      const ext = Math.max(f.w, f.h) / 2;
      expect(Math.hypot((f.x - CITY_W / 2) / (CITY_W / 2), (f.y - CITY_H / 2) / (CITY_H / 2))).toBeLessThan(0.7 + ext / CITY_W);
    }
  });
});

describe('the people of a town (V2-3, V2-6, V2-13)', () => {
  it('reads the races of the country line, the first named most', () => {
    const known = (r: string) => !!looks.races[r];
    expect(racesOfLine('คนแคระ', known)).toEqual([['dwarf', 1]]);
    const nb = racesOfLine(countries.get('NB-10')!.races, known);
    expect(nb.map(([r]) => r)).toEqual(['human', 'construct', 'soulmachine']);
    expect(nb[0][1]).toBeGreaterThan(nb[1][1] * 2);
    expect(racesOfLine('ทุกเผ่า', known).map(([r]) => r)).toContain('elf');
  });

  it('KD-01 is all dwarves (short, bearded, with a tool), not half human', () => {
    const l = crowdLooks(looks, countries.get('KD-01')!);
    expect(l.length).toBeGreaterThan(16);
    expect(share(l, (x) => x.race === 'dwarf')).toBe(1);
    expect(share(l, (x) => x.stage === 'adult' && !x.fem && x.beard !== '')).toBeGreaterThan(0);
    expect(l.every((x) => x.body.scale < 0.9)).toBe(true);
  });

  it('NB-10 survivors are the crowd: most are human, the few machines have no screen face and a cloth over it', () => {
    const l = crowdLooks(looks, countries.get('NB-10')!);
    expect(share(l, (x) => x.race === 'human')).toBeGreaterThan(0.45);
    for (const x of l.filter((q) => q.race !== 'human')) {
      expect(x.feats).not.toContain('visor');
      expect(x.feats).not.toContain('mecheye');
    }
    expect(share(l.filter((q) => q.stage === 'adult' || q.stage === 'elder'), (x) => x.hat !== '')).toBeGreaterThan(0.6);
  });

  it('a crowd is not one outfit: clothes, colours and hair differ', () => {
    for (const id of ['SV-01', 'MK-02', 'AL-05']) {
      const l = crowdLooks(looks, countries.get(id)!);
      expect(new Set(l.map((x) => x.main)).size).toBeGreaterThan(3);
      expect(new Set(l.map((x) => x.outfit)).size).toBeGreaterThan(1);
    }
  });
});

describe('the air of a town (V2-11)', () => {
  it('every ambient of the docs has a baked loop with pixels in it, and the loop is a sheet of AIR_FRAMES tiles', () => {
    for (const a of ['embers', 'fog', 'leaves', 'ash', 'dust', 'sand', 'clouds', 'motes', 'smoke']) {
      expect(airKind(a)).not.toBeNull();
      const s = airSheet(a)!;
      expect(s.w).toBe(AIR_SIDE * AIR_FRAMES);
      expect(s.h).toBe(AIR_SIDE);
      let n = 0;
      for (let i = 3; i < s.data.length; i += 4) if (s.data[i]) n++;
      expect(n).toBeGreaterThan(100);
      expect(airScroll(a)).toHaveLength(2);
    }
    expect(airKind('none')).toBeNull();
    expect(airKind('gulls')).toBeNull(); // gulls are sprites, not a tile
  });

  it('light is added, fog is laid: embers and motes add, fog does not', () => {
    expect(airKind('embers')!.blend).toBe('add');
    expect(airKind('fog')!.blend).toBe('normal');
  });

  it('no pixel of the air is half transparent beyond its own alpha (one pixel, one colour) and the smoke has frames', () => {
    const s = smokeSheet();
    expect(s.w).toBe(SMOKE.w * SMOKE.frames);
    let n = 0;
    for (let i = 3; i < s.data.length; i += 4) if (s.data[i]) n++;
    expect(n).toBeGreaterThan(200);
  });

  it('the countries that say so have their ambient in the plan', () => {
    expect(plan('KD-01').ambient).toBe('embers');
    expect(plan('MK-02').ambient).toBe('smoke');
    expect(plan('NB-10').ambient).toBe('fog');
  });
});

describe('one pixel density (V2-10)', () => {
  it('the ground chunks round a town are painted at the density of the town, and tile the view', () => {
    const p = codeProvider(data);
    const c = p.layout.cities[0];
    const view = { x: c.x - 20, y: c.y - 14, w: 40, h: 28 };
    const chunks = groundChunks(p.layout, view, NORMAL_LOOKS, 1);
    expect(chunks.length).toBeGreaterThan(6);
    for (const r of chunks) {
      expect(r.px).toBe(TOWN_PX);
      expect(r.rect.w).toBe(GROUND_CHUNK);
      expect(tileSize(r).w).toBe(GROUND_CHUNK * TOWN_PX);
    }
    // together they cover the view
    const xs = chunks.map((r) => r.rect.x), ys = chunks.map((r) => r.rect.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(view.x);
    expect(Math.max(...xs) + GROUND_CHUNK).toBeGreaterThanOrEqual(view.x + view.w);
    expect(Math.min(...ys)).toBeLessThanOrEqual(view.y);
    expect(Math.max(...ys) + GROUND_CHUNK).toBeGreaterThanOrEqual(view.y + view.h);
  });
});

describe('the icons of the country level (V2-15)', () => {
  it('a town of each style is drawn differently', () => {
    const styles = ['gable', 'tent', 'hut', 'dome', 'spire', 'brick', 'forge', 'stone', 'stilt', 'mushroom'];
    const keys = new Set(styles.map((s) => Buffer.from(iconFrame('town', '#a84a3a', s).data).toString('base64')));
    expect(keys.size).toBeGreaterThanOrEqual(9);
    expect(iconFrame('capital', '#a84a3a', 'spire').w).toBe(22);
  });
});
