// The geometry of the map: the land, the countries on it, the towns of each country. Pure and deterministic.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { CONT_IDS, DEFS, sampleLand } from '../../src/map/geo';
import { buildLayout, layoutOf, type MapLayout } from '../../src/map/layout';
import { CITY_H, CITY_W } from '../../src/map/tuning';
import type { Continent, Country } from '../../src/core/data/types-npcs';

let layout: MapLayout;
let countries: Country[];
beforeAll(() => {
  const data = loadAll(['countries', 'continents']);
  countries = data.countries.items as Country[];
  layout = layoutOf(data);
});

describe('land', () => {
  it('is the same at the same point, and every continent has land', () => {
    expect(sampleLand(735, 440).v).toBe(sampleLand(735, 440).v);
    expect(sampleLand(735, 440).v).toBeGreaterThan(0); // the heart of Aldria
    expect(sampleLand(20, 20).v).toBeLessThan(0); // open sea
    for (const id of CONT_IDS) expect(layout.continents[id].box.w).toBeGreaterThan(20);
    expect(DEFS.length).toBeGreaterThan(20);
  });
  it('lays the land on the grid by the same field', () => {
    expect(layout.landV(735, 440)).toBeGreaterThan(10);
    expect(layout.landV(20, 20)).toBeLessThan(0);
  });
});

describe('countries', () => {
  it('places every country of the data, each with land, a box and a seat on its own land', () => {
    expect(layout.countries.length).toBe(countries.length);
    for (const c of layout.countries) {
      expect(c.area, c.id).toBeGreaterThan(0);
      expect(c.box.w, c.id).toBeGreaterThan(1);
      expect(layout.countryAt(c.x, c.y)?.id, `${c.id} seat`).toBe(c.id);
      expect(layout.landV(c.x, c.y), `${c.id} inland`).toBeGreaterThan(0);
    }
  });
  it('keeps each country on its own continent, and an island for a country on Azgar and Nerea', () => {
    for (const c of layout.countries) {
      const src = countries.find((x) => x.id === c.id)!;
      expect(c.continent).toBe(src.continent);
      expect(layout.continentAt(c.x, c.y)).toBe(src.continent);
    }
    expect(layout.countries.filter((c) => c.island).every((c) => c.continent === 'AZ' || c.continent === 'NR')).toBe(true);
  });
  it('puts the places the docs name where the docs say', () => {
    const near = (id: string, x: number, y: number, r: number) => {
      const c = layout.byId.get(id)!;
      expect(Math.hypot(c.x - x, c.y - y), id).toBeLessThan(r);
    };
    near('AL-01', 722, 440, 40);
    near('SV-01', 266, 312, 40);
    near('MK-04', 1112, 300, 40);
    near('NB-08', 705, 130, 40);
  });
  it('is the same on every build', () => {
    const data = loadAll(['countries', 'continents']);
    const again = buildLayout(data.countries.items as Country[], (data.continents.items as { continents: Continent[] }).continents);
    expect(Array.from(again.owner.slice(0, 5000))).toEqual(Array.from(layout.owner.slice(0, 5000)));
    expect(again.countries.map((c) => [c.id, c.x, c.y])).toEqual(layout.countries.map((c) => [c.id, c.x, c.y]));
    expect(again.cities.map((c) => [c.id, c.x, c.y])).toEqual(layout.cities.map((c) => [c.id, c.x, c.y]));
  });
  it('answers a pick at sea with nothing and a pick on land with the country', () => {
    expect(layout.countryAt(20, 20)).toBeNull();
    const c = layout.byId.get('AL-01')!;
    expect(layout.countryAt(c.x + 1, c.y)?.id).toBe('AL-01');
    expect(layout.continentAt(c.x, c.y)).toBe('AL');
  });
});

describe('towns', () => {
  it('gives every country a capital named like it, on its own land', () => {
    for (const c of layout.countries) {
      const caps = layout.citiesOf(c.id).filter((t) => t.capital);
      expect(caps.length, c.id).toBe(1);
      expect(caps[0].name).toBe(c.name);
      expect(layout.landV(caps[0].x, caps[0].y)).toBeGreaterThan(0);
    }
  });
  it('keeps the plans of the towns apart', () => {
    let overlaps = 0;
    for (let i = 0; i < layout.cities.length; i++)
      for (let j = i + 1; j < layout.cities.length; j++) {
        const a = layout.cities[i], b = layout.cities[j];
        if (Math.abs(a.x - b.x) < CITY_W * 0.5 && Math.abs(a.y - b.y) < CITY_H * 0.5) overlaps++;
      }
    expect(overlaps).toBeLessThan(layout.cities.length * 0.04);
    expect(layout.cities.length).toBeGreaterThan(countries.length * 2);
  });
  it('finds the town nearest a point', () => {
    const t = layout.cities[10];
    expect(layout.cityNear(t.x + 0.5, t.y, 3)?.id).toBe(t.id);
    expect(layout.cityNear(20, 20, 3)).toBeNull();
  });
});
