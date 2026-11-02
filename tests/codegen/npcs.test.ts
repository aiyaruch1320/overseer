import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ContinentsGen, CountriesGen, NpcRow, NpcsGen } from '../../src/core/data/types-npcs';
import run from '../../scripts/codegen/groups/npcs';
import { genDir, readDoc, root } from '../../scripts/codegen/lib/table';

const read = (name: string) => readFileSync(path.join(genDir, `${name}.json`), 'utf8');
let npcsRaw: string, countriesRaw: string, continentsRaw: string;
let npcs: NpcsGen, countries: CountriesGen, continents: ContinentsGen;

beforeAll(() => {
  const report = run();
  expect(report.group).toBe('npcs');
  expect(report.strict).toBe(false);
  npcsRaw = read('npcs');
  countriesRaw = read('countries');
  continentsRaw = read('continents');
  npcs = JSON.parse(npcsRaw);
  countries = JSON.parse(countriesRaw);
  continents = JSON.parse(continentsRaw);
});

const docLine = (file: string, startsWith: string) => {
  const l = readDoc(file).split('\n').find((x) => x.startsWith(startsWith));
  if (!l) throw new Error(`${file}: no line starting ${startsWith}`);
  return l;
};

describe('counts', () => {
  it('has 143 countries, 9 continents, 614 NPCs, 54 newcomer templates', () => {
    expect(countries.items).toHaveLength(143);
    expect(continents.items.continents).toHaveLength(9);
    expect(npcs.items.npcs).toHaveLength(614);
    expect(npcs.items.templates).toHaveLength(54);
    expect(npcs.items.npcs.filter((n) => n.succession.allySuccessor)).toHaveLength(55);
  });

  it('matches the per-continent counts of the docs', () => {
    const want: Record<string, [number, number]> = { AZ: [10, 41], MH: [12, 53], KD: [12, 53], NR: [16, 69], AL: [28, 117], MK: [16, 68], SH: [17, 75], SV: [18, 78], NB: [14, 60] };
    for (const c of continents.items.continents) {
      expect(c.countries, c.id).toHaveLength(want[c.id][0]);
      expect(c.countryCount, c.id).toBe(want[c.id][0]);
      expect(npcs.items.npcs.filter((n) => n.continent === c.id), c.id).toHaveLength(want[c.id][1]);
    }
    const groups = npcs.items.npcs.reduce<Record<string, number>>((a, n) => ((a[n.group] = (a[n.group] ?? 0) + 1), a), {});
    expect(groups).toEqual({ leader: 143, regular: 429, half: 19, minor: 17, bound: 6 });
  });

  it('keeps the W spread of docs/systems/economy/02-countries.md', () => {
    const spread = [1, 2, 3, 4, 5].map((w) => countries.items.filter((c) => c.econ.w === w).length);
    expect(spread).toEqual([9, 29, 54, 35, 16]);
  });
});

describe('references', () => {
  const ids = () => new Set(countries.items.map((c) => c.id));

  it('country relations point at real countries and never at themselves', () => {
    const real = ids();
    // only MH-10, SV-10 and SV-11 write their ties without a country code
    expect(countries.items.filter((c) => c.relations.length === 0).map((c) => c.id)).toEqual(['MH-10', 'SV-10', 'SV-11']);
    for (const c of countries.items) {
      // every country code the doc writes is kept as a relation (ranges `AZ-02 ถึง AZ-10` expanded)
      const written = new Set((c.relationsRaw.match(/\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d{2}\b/g) ?? []).filter((x) => x !== c.id));
      for (const code of written) expect(c.relations.some((r) => r.to === code), `${c.id} drops ${code}`).toBe(true);
      for (const r of c.relations) {
        expect(real.has(r.to), `${c.id} -> ${r.to}`).toBe(true);
        expect(r.to).not.toBe(c.id);
      }
    }
  });

  it('country relations agree between the two sides', () => {
    const by = new Map(countries.items.map((c) => [c.id, c]));
    const pos = new Set(['ally', 'friend']);
    const neg = new Set(['foe', 'tense']);
    const contradictions: string[] = [];
    for (const a of countries.items)
      for (const r of a.relations)
        for (const q of by.get(r.to)!.relations.filter((x) => x.to === a.id))
          if ((pos.has(r.kind) && neg.has(q.kind)) || (neg.has(r.kind) && pos.has(q.kind))) contradictions.push(`${a.id} ${r.kind} ${r.to} but ${r.to} ${q.kind} ${a.id}`);
    expect(contradictions).toEqual([]);
    // every alliance is listed by the other side too (any kind), and almost every enmity is
    const allies = countries.items.flatMap((c) => c.relations.filter((r) => r.kind === 'ally'));
    expect(allies.length).toBeGreaterThan(100);
    expect(allies.every((r) => r.reciprocated)).toBe(true);
    const foes = countries.items.flatMap((c) => c.relations.filter((r) => r.kind === 'foe'));
    expect(foes.filter((r) => r.reciprocated).length / foes.length).toBeGreaterThan(0.95);
    // the flag is what it says
    for (const a of countries.items)
      for (const r of a.relations) expect(r.reciprocated, `${a.id} ${r.to}`).toBe(by.get(r.to)!.relations.some((x) => x.to === a.id));
  });

  it('every NPC lives in a real country and the country lists it back', () => {
    const real = ids();
    const by = new Map(countries.items.map((c) => [c.id, c]));
    const seen = new Set<string>();
    for (const n of npcs.items.npcs) {
      expect(seen.has(n.id), `duplicate ${n.id}`).toBe(false);
      seen.add(n.id);
      expect(real.has(n.country), n.id).toBe(true);
      expect(n.country).toBe(n.id.replace(/^([A-Z]{2})(\d{2})-\d$/, '$1-$2'));
      expect(by.get(n.country)!.npcs).toContain(n.id);
      expect(n.continent).toBe(by.get(n.country)!.continent);
    }
    expect(countries.items.reduce((a, c) => a + c.npcs.length, 0)).toBe(614);
    for (const c of countries.items) expect(c.npcs[0], c.id).toBe(`${c.id.replace('-', '')}-1`);
  });

  it('NPC links, fights and successors point at real NPCs', () => {
    const seen = new Set(npcs.items.npcs.map((n) => n.id));
    let fights = 0;
    for (const n of npcs.items.npcs) {
      for (const r of n.refs) expect(seen.has(r.to), `${n.id} -> ${r.to}`).toBe(true);
      for (const l of n.links) expect(seen.has(l), `${n.id} link ${l}`).toBe(true);
      for (const f of n.clashes) {
        expect(f).toBe(`NF-${n.id}`);
        fights++;
      }
      if (n.succession.allySuccessor) expect(n.succession.allySuccessor.of).toBe(n.id);
      for (const b of n.refBy) expect(seen.has(b)).toBe(true);
    }
    expect(fights).toBe(102);
  });

  it('every continent bloc member is a country of that continent', () => {
    const real = ids();
    for (const c of continents.items.continents)
      for (const b of c.blocs)
        for (const m of b.members) {
          expect(real.has(m), `${c.id} ${b.name} ${m}`).toBe(true);
          expect(m.startsWith(c.id)).toBe(true);
        }
  });
});

describe('NPC rows', () => {
  it('each has three paths with chances that leave a fading remainder', () => {
    for (const n of npcs.items.npcs) {
      expect(n.paths.map((p) => p.key).join(''), n.id).toBe('abc');
      const sum = n.paths.reduce((a, p) => a + p.pct, 0);
      expect(sum, n.id).toBeLessThanOrEqual(100);
      expect(n.restPct, n.id).toBe(100 - sum);
      expect(n.appearPct).toBeGreaterThan(0);
      expect(n.cls).toBeGreaterThanOrEqual(1);
      expect(n.cls).toBeLessThanOrEqual(5);
      expect(n.look.primary).toMatch(/^#[0-9a-f]{3,8}$/);
      expect(n.look.secondary).toMatch(/^#[0-9a-f]{3,8}$/);
      expect(n.look.description.length, n.id).toBeGreaterThan(10);
    }
  });

  it('leaders (-1) are class 5 and the opening rule matches the docs', () => {
    for (const n of npcs.items.npcs.filter((x) => x.seq === 1)) {
      expect(n.cls, n.id).toBe(5);
      expect(n.appearPct, n.id).toBe(100);
    }
    // README §2.1: an event outside the arrows opens the story; tiers follow succession.md §2 (same split as sim-npc-density)
    const tiers = [1, 2, 3].map((t) => npcs.items.npcs.filter((n) => n.succession.tier === t).length);
    expect(tiers).toEqual([55, 184, 375]);
    const az = npcs.items.npcs.find((n) => n.id === 'AZ01-1')!;
    expect(az.clock).toEqual({ open: 'event', events: ['DR-01'], window: 0.2 });
    expect(az.cuts).toEqual([expect.objectContaining({ from: 'c', cut: 'a', when: { k: 'event', id: 'DR-01', happened: true } })]);
  });

  it('class and gold equal docs/_generated/npc-economy.md', () => {
    const doc = readDoc('docs/_generated/npc-economy.md');
    const rows = [...doc.matchAll(/^\| ([A-Z]{2}\d{2}-\d) \| .*? \| (\d) \| ([\d,]+) \|$/gm)];
    expect(rows).toHaveLength(614);
    const by = new Map(npcs.items.npcs.map((n) => [n.id, n]));
    for (const m of rows) {
      const n = by.get(m[1])!;
      expect([n.cls, n.gold], m[1]).toEqual([Number(m[2]), Number(m[3].replace(/,/g, ''))]);
    }
  });

  it('newcomer templates carry eras, three weighted paths and a link', () => {
    const t = npcs.items.templates;
    expect(t.map((x) => x.id)).toEqual(Array.from({ length: 54 }, (_, i) => `NT-${String(i + 1).padStart(2, '0')}`));
    for (const x of t) {
      expect(x.eras.length, x.id).toBeGreaterThan(0);
      expect(x.paths.map((p) => p.weight).reduce((a, b) => a + b, 0), x.id).toBe(100);
      expect(x.links.length, x.id).toBeGreaterThan(0);
    }
    expect(t.filter((x) => x.continentTemplate)).toHaveLength(36);
    expect(t.find((x) => x.id === 'NT-15')!.needs).toEqual(['war=peace', 'war=watch']);
    expect(t.find((x) => x.id === 'NT-30')!.eras).toEqual(['4a', '4b']);
  });
});

describe('three rows against the docs', () => {
  const find = (id: string): NpcRow => npcs.items.npcs.find((n) => n.id === id)!;

  it('AZ01-2 (a leader row in docs/lore/npcs/01-azgar.md)', () => {
    const line = docLine('docs/lore/npcs/01-azgar.md', '| AZ01-2 |');
    expect(line).toContain('ธรักซ์มาร์');
    const n = find('AZ01-2');
    expect([n.name, n.raceText, n.age, n.appearPct]).toEqual(['ธรักซ์มาร์', 'อาเวียนปีกเกล็ด', 52, 90]);
    expect(n.peopleId).toBe('wi');
    expect(n.paths.map((p) => p.pct)).toEqual([40, 30, 20]);
    expect(n.paths[0].events).toEqual(['WR-01']);
    expect(n.paths[2].tags).toEqual(['help']);
    expect(n.paths[2].repays).toBe(true);
    expect(n.look.primary).toBe('#8a2a1a');
    expect(n.look.secondary).toBe('#d8a030');
    expect(n.clashes).toEqual(['NF-AZ01-2']);
    expect(n.src).toBe('docs/lore/npcs/01-azgar.md:' + (readDoc('docs/lore/npcs/01-azgar.md').split('\n').findIndex((l) => l.startsWith('| AZ01-2 |')) + 1));
  });

  it('MH09-7 (a bound NPC with a link, a bound local event and an ally chance)', () => {
    const line = docLine('docs/lore/npcs/02-morhaven.md', '| MH09-7 |');
    expect(line).toContain('พวกพ้อง 40%');
    const n = find('MH09-7');
    expect(n.group).toBe('bound');
    expect(n.links).toEqual(['MH09-1']);
    expect(n.binds).toEqual(['LC-71']);
    expect(n.paths[2].allyChance).toBe(0.4);
    expect(n.paths[2].axes).toEqual([{ axis: 'favor', delta: 3 }]);
    expect(n.restPct).toBe(5);
    expect(n.succession.allySuccessor?.id).toBe('MH09-7S');
    expect(n.succession.allySuccessor?.name).toBe('มิลลี');
  });

  it('SH-03 (a country row with economy, bloc and city UI)', () => {
    const lore = docLine('docs/lore/countries/07-saharan.md', '#### SH-03 ');
    const econ = docLine('docs/systems/economy/02-countries.md', '| SH-03 |');
    const ui = readDoc('docs/appearance/countries/07-saharan.md').split('\n');
    const at = ui.findIndex((l) => l.startsWith('### SH-03 '));
    const uiLine = ui.slice(at).find((l) => l.startsWith('- **ค่า UI**'))!;
    const c = countries.items.find((x) => x.id === 'SH-03')!;
    expect(lore).toContain(c.name);
    const w = econ.split('|').map((x) => x.trim())[3].match(/(\d) → (\d)/)!;
    expect([c.econ.wBase, c.econ.w]).toEqual([Number(w[1]), Number(w[2])]);
    expect(c.econ.g).toBe(econ.split('|').map((x) => x.trim())[4]);
    expect(c.continent).toBe('SH');
    expect(c.bloc).toBe('ยักษ์');
    expect(c.npcs).toHaveLength(npcs.items.npcs.filter((n) => n.country === 'SH-03').length);
    const styles = uiLine.match(/styles=([^;]+);/)![1];
    expect(Object.entries(c.ui.styles).map(([k, v]) => `${k}:${v}`).join(',')).toBe(styles);
    expect(c.ui.scale).toBeGreaterThan(0);
    expect(c.ui.war).toBeTruthy();
  });
});

describe('continents', () => {
  it('reads the nine continents with UI values and map layout', () => {
    const cs = continents.items.continents;
    expect(cs.map((c) => c.id)).toEqual(['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB']);
    for (const c of cs) {
      expect(c.ui.palette, c.id).toHaveLength(5);
      expect(c.ui.forms.length, c.id).toBeGreaterThan(0);
      expect(c.look.overview.length, c.id).toBeGreaterThan(50);
      expect(c.map.position.length, c.id).toBeGreaterThan(0);
    }
    expect(cs[0].ui.palette[0]).toBe('#3d78c4');
    const w = continents.items.world;
    expect([w.width, w.height]).toEqual([1600, 900]);
    expect(w.zoomLevels.map((z) => z.id)).toEqual(['world', 'continent', 'country', 'city', 'inside']);
    expect(w.landLinks).toHaveLength(7);
  });
});

describe('determinism', () => {
  it('writes the same bytes on a second run', () => {
    const again = run();
    expect(again.files).toEqual(['npcs.json', 'countries.json', 'continents.json']);
    expect(read('npcs')).toBe(npcsRaw);
    expect(read('countries')).toBe(countriesRaw);
    expect(read('continents')).toBe(continentsRaw);
    expect(readFileSync(path.join(root, 'data/gen/_unparsed/npcs.md'), 'utf8')).toContain('ส่วนที่แปลไม่ได้: npcs');
  });
});
