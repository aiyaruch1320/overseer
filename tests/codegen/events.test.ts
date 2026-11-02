// Event generator (code-plan §5.1 rows 2 and 3, §12.4 M0-b): counts, references, and the same data the doc-level sim reads.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GenFile } from '../../src/core/types';
import type { LocalEventsData, Mark, WorldEvent, WorldEventsData } from '../../src/core/data/types-events';
import run from '../../scripts/codegen/groups/events';
import { idIndex } from '../../scripts/codegen/lib/ids';
import { genDir, root } from '../../scripts/codegen/lib/table';

const read = <T>(name: string) => JSON.parse(readFileSync(path.join(genDir, `${name}.json`), 'utf8')) as GenFile<T>;
let W: WorldEventsData;
let L: LocalEventsData;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sim: any;
const ids = idIndex();

beforeAll(async () => {
  run();
  W = read<WorldEventsData>('world-events').items;
  L = read<LocalEventsData>('local-events').items;
  sim = await import(pathToFileURL(path.join(root, 'scripts/sim/sim-world.mjs')).href);
});

const set = <T>(xs: Iterable<T>) => [...new Set(xs)].sort();
const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

describe('counts (code-plan §5.1)', () => {
  it('has the 152 world events, in the groups of world-events §16', () => {
    expect(W.events).toHaveLength(152);
    expect(set(W.events.map((e) => e.id))).toHaveLength(152);
    const groups: Record<string, number> = { DR: 15, PL: 9, WR: 24, CT: 10, DM: 11, MC: 12, BIO: 10, GD: 8, HP: 8, PO: 8, GI: 10, FG: 15, END: 12 };
    for (const [g, n] of Object.entries(groups)) expect(W.events.filter((e) => e.group === g), g).toHaveLength(n);
  });
  it('counts the marks as the summary line says', () => {
    const c: Record<Mark, number> = { '⭐': 0, '●': 0, '○': 0 };
    for (const e of W.events) c[e.mark]++;
    expect(c).toEqual(W.rules.markCounts);
    expect(c).toEqual({ '⭐': 46, '●': 92, '○': 14 });
  });
  it('has the 42 branch events and the 12 last-era events', () => {
    expect(W.branch).toHaveLength(42);
    const per: Record<string, number> = { SF: 10, AS: 5, DW: 5, RF: 5, WT: 5, RL: 4, CL: 4, DV: 4 };
    for (const [g, n] of Object.entries(per)) expect(W.branch.filter((e) => e.group === g), g).toHaveLength(n);
    expect(W.lastEra.map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => `LE-${String(i + 1).padStart(2, '0')}`));
  });
  it('has 76 hand-written local events, 6 templates and the generated ones of the md', () => {
    expect(L.events.map((e) => e.id)).toEqual(Array.from({ length: 76 }, (_, i) => `LC-${String(i + 1).padStart(2, '0')}`));
    expect(L.templates.map((t) => t.id)).toEqual(['LT-1', 'LT-2', 'LT-3', 'LT-4', 'LT-5', 'LT-6']);
    const md = readFileSync(path.join(root, 'docs/_generated/local-events-by-country.md'), 'utf8');
    const said = Number(md.match(/จำนวน (\d+) รายการ/)![1]);
    const rows = md.split('\n').filter((l) => /^\| \*\*LC-\d+ /.test(l)).length;
    expect(rows).toBe(said);
    expect(L.generated).toHaveLength(said);
    expect(set(L.generated.map((e) => e.template))).toEqual(['LT-1', 'LT-2', 'LT-3', 'LT-4', 'LT-5', 'LT-6'].filter((t) => L.generated.some((e) => e.template === t)));
    expect(L.generated.every((e) => e.generated && e.chance === 0.08 && e.npcs.length >= 3)).toBe(true);
  });
  it('gives every local event 3 NPCs or more, each an NPC the docs have, and a chance', () => {
    for (const e of [...L.events, ...L.generated]) {
      expect(e.npcs.length, e.id).toBeGreaterThanOrEqual(3);
      for (const n of e.npcs) expect(ids.npcs.has(n.id), `${e.id} ${n.id}`).toBe(true);
      expect(e.chance, e.id).toBeGreaterThan(0);
      expect(e.reads.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('references exist (chain, close, successor)', () => {
  const all = () => new Set([...W.events, ...W.branch, ...W.lastEra].map((e) => e.id));
  it('every id a chain, a prerequisite or an outcome names is an event', () => {
    const known = all();
    for (const e of W.events) {
      for (const x of [...e.needs, ...e.chain, ...e.outcomes.flatMap((o) => o.chain)]) expect(known.has(x), `${e.id} -> ${x}`).toBe(true);
    }
    for (const e of W.branch) for (const x of [...e.needs, ...e.chain, ...e.replaces, ...(e.trigger ? [e.trigger] : [])]) expect(known.has(x), `${e.id} -> ${x}`).toBe(true);
    for (const e of W.lastEra) for (const x of [...e.needs, ...e.chain, ...(e.withEvent ? [e.withEvent] : [])]) expect(known.has(x), `${e.id} -> ${x}`).toBe(true);
  });
  it('closures close world events and are replaced by branch events', () => {
    const world = new Set(W.events.map((e) => e.id));
    const branch = new Set(W.branch.map((e) => e.id));
    expect(W.closures.length).toBeGreaterThan(10);
    for (const c of W.closures) {
      expect(world.has(c.trigger), c.trigger).toBe(true);
      for (const x of c.close) expect(world.has(x), `${c.trigger} closes ${x}`).toBe(true);
      for (const r of c.replace) {
        expect(world.has(r.from), `${c.trigger} replaces ${r.from}`).toBe(true);
        expect(branch.has(r.to), `${c.trigger}: ${r.from} -> ${r.to}`).toBe(true);
      }
    }
  });
  it('dragons, flags, faith waits, witness and economy rows point at events', () => {
    const known = all();
    for (const d of W.dragons) {
      expect(known.has(d.fallEvent), d.name).toBe(true);
      if (d.awakeEvent) expect(known.has(d.awakeEvent), d.name).toBe(true);
    }
    for (const f of W.flags) expect(known.has(f.trigger), f.name).toBe(true);
    for (const e of W.events) for (const w of e.faith) if (w.after) expect(known.has(w.after), `${e.id} ${w.after}`).toBe(true);
    for (const e of [...W.events, ...W.branch]) if (e.econ) expect(e.econ.c === null || Number.isFinite(e.econ.c), e.id).toBe(true);
    expect(W.events.filter((e) => e.econ).length + W.branch.filter((e) => e.econ).length).toBeGreaterThan(60);
  });
  it('local events read existing events and chain to existing local events', () => {
    const known = all();
    const lc = new Set([...L.events, ...L.generated].map((e) => e.id));
    for (const e of [...L.events, ...L.generated]) {
      for (const r of e.reads) expect(known.has(r.id), `${e.id} reads ${r.id}`).toBe(true);
      for (const t of e.touches) expect(known.has(t), `${e.id} touches ${t}`).toBe(true);
      for (const c of e.chain) expect(lc.has(c.to), `${e.id} -> ${c.to}`).toBe(true);
      for (const c of e.receives) expect(lc.has(c), `${e.id} <- ${c}`).toBe(true);
    }
  });
  it('every event of world-events.md is in the id index of the docs', () => {
    for (const e of [...W.events, ...W.branch.filter((b) => ['SF', 'AS', 'DW', 'RF', 'WT', 'RL', 'CL', 'DV'].includes(b.group))]) expect(ids.events.has(e.id), e.id).toBe(true);
  });
});

describe('same data as scripts/sim/sim-world.mjs', () => {
  const simEvents = () => sim.events as { id: string; mk: string; gate: [number, number]; prereq: string[]; thr: [string, string, number][] }[];
  it('has the same events in the same order', () => {
    expect(W.events.map((e) => e.id)).toEqual(simEvents().map((e) => e.id));
  });
  it('gives the same mark, era window, prerequisites and thresholds', () => {
    const w = byId(W.events);
    for (const s of simEvents()) {
      const e = w.get(s.id)!;
      expect(e.mark, s.id).toBe(s.mk);
      expect(e.eraSim ?? e.era, `${s.id} era`).toEqual(s.gate);
      expect(set(e.needs), `${s.id} needs`).toEqual(set(s.prereq));
      // the JSON may hold more thresholds than the sim reads (beyond-sim: F below N, pollution), never fewer
      const have = e.thr.map((t) => `${t.v}${t.op}${t.n}`);
      for (const t of s.thr) expect(have, `${s.id} thr`).toContain(`${t[0]}${t[1]}${t[2]}`);
    }
  });
  it('lists the events whose docs era differs from what the sim reads (war rows read their era column)', () => {
    const diff = W.events.filter((e) => e.eraSim).map((e) => e.id);
    expect(diff).toEqual(['WR-02', 'WR-07', 'WR-08', 'WR-12', 'WR-13', 'WR-14']);
  });
  it('lists the thresholds beyond the sim', () => {
    const w = byId(W.events);
    const extra: string[] = [];
    for (const s of simEvents()) {
      const have = new Set(s.thr.map((t) => `${t[0]}${t[1]}${t[2]}`));
      for (const t of w.get(s.id)!.thr) if (!have.has(`${t.v}${t.op}${t.n}`)) extra.push(`${s.id}:${t.v}${t.op}${t.n}`);
    }
    expect(extra).toEqual(['WR-23:F<38', 'MC-04:P>60', 'MC-08:P>40', 'BIO-01:P>50', 'BIO-07:P>40', 'END-10:F<30']);
  });
  it('gives the same rate, cap, hero chance, mourning cap, window and ending chances', () => {
    expect(W.rules.rate).toEqual({ '⭐': sim.P.rate['⭐'], '●': sim.P.rate['●'], '○': sim.P.rate['○'] });
    expect(W.rules.capYears).toEqual(sim.P.capYears);
    expect(W.rules.hero).toEqual({ before: sim.P.hero0, after: sim.P.hero });
    expect(W.rules.mourn.capLoss).toBe(sim.P.capDfc);
    expect(W.rules.windowYears).toBe(sim.P.windowYears);
    const end = Object.fromEntries(W.rules.endings.map((e) => [e.id, e.chance]));
    expect(end['END-12']).toBe(sim.P.end12);
    expect(end['END-11']).toBe(sim.P.end11);
    expect(byId(W.events).get('WR-23')!.thr).toContainEqual({ v: 'F', op: '<', n: sim.P.wr23F });
    expect(W.rules.lean.map((l) => l.chance)).toEqual([0.35, 0.3, 0.35]);
  });
  it('gives the same dragons: name, fall event, earliest era, start mood, decay and closest sibling', () => {
    expect(W.dragons).toHaveLength(15);
    const src = readFileSync(path.join(root, 'scripts/sim/sim-world.mjs'), 'utf8');
    const init = src.match(/const INIT = \[([^\]]*)\]/)![1].split(',').map(Number);
    sim.DRAGONS.forEach((d: [string, string, number, number], i: number) => {
      const j = W.dragons[i];
      expect([j.name, j.fallEvent, j.minEra, j.decay]).toEqual(d);
      expect(j.initMood, d[0]).toBe(init[i]);
    });
    const pairs = set(W.dragons.filter((d) => d.pair !== null && d.index < d.pair!).map((d) => `${d.index},${d.pair}`));
    expect(pairs).toEqual(set((sim.PAIRS as number[][]).map((p) => `${p[0]},${p[1]}`)));
    const pl = Object.fromEntries(W.dragons.filter((d) => d.awakeEvent).map((d) => [d.awakeEvent, d.index]));
    expect(pl).toEqual({ 'PL-01': 6, 'PL-02': 7, 'PL-03': 8, 'PL-04': 9, 'PL-05': 10, 'PL-06': 11, 'PL-07': 12, 'PL-08': 13, 'PL-09': 14 });
  });
  it('gives the same slow world variables and disturbance', () => {
    const v = Object.fromEntries(W.vars.map((x) => [x.code, x]));
    expect([v.H.start, v.T.start, v.D.start, v.F.start]).toEqual([55, 70, 55, 60]);
    expect([v.H.drift, v.T.drift, v.D.drift, v.F.drift]).toEqual([1.2, -0.8, 0.6, sim.P.faithDrift]);
    expect([v.H.noise, v.T.noise, v.D.noise, v.F.noise]).toEqual([2, 1.5, 2, 2.5]);
    expect(v.T.stopEvents).toContain('BIO-03');
    expect(v.D.stopEvents).toEqual(expect.arrayContaining(['FG-10', 'FG-11']));
    const ch = (code: string) => v[code].changes.map((c) => `${c.event}:${c.delta}:${c.kind}`);
    expect(ch('H')).toContain('HP-07:-40:once');
    expect(ch('D')).toContain('FG-10:-40:once');
    expect(ch('D')).toContain('FG-11:1.2:drift');
    expect(ch('F')).toContain('fall:4:once');
    expect(ch('F')).toContain('DR-11:10:once');
    const z = Object.fromEntries(W.disturb.map((d) => [d.dragon, d]));
    expect(Object.fromEntries(Object.entries(z).map(([k, d]) => [k, d.start]))).toEqual({ คัลดรา: 40, ธาลาสซา: 35, เซเรเน: 45, 'กรอม-ธาร': 40 });
    for (const d of Object.values(z)) expect([d.drift, d.noise]).toEqual([0.8, 1.5]);
    expect(set(z['คัลดรา'].stopEvents)).toEqual(['DR-04', 'PL-03']);
    expect(z['ธาลาสซา'].stopEvents).toEqual(['PL-04']);
    expect(z['เซเรเน'].stopEvents).toEqual(['PL-06']);
    expect(z['กรอม-ธาร'].stopEvents).toEqual(['PL-07']);
    expect(z['ธาลาสซา'].bumps).toEqual([{ event: 'WR-06', delta: 10 }, { event: 'WR-07', delta: 10 }, { event: 'BIO-07', delta: 10 }]);
    expect(z['เซเรเน'].bumps).toEqual([{ event: 'MC-04', delta: 20 }]);
  });
  it('applies the same effects as the sim where an event changes a world number', () => {
    const e = byId(W.events);
    const stat = (id: string, s: string) => e.get(id)!.effects.filter((x) => x.k === 'stat' && x.stat === s).map((x) => (x as { delta: number }).delta);
    expect(stat('HP-07', 'H')).toEqual([-40]);
    expect(stat('GD-04', 'F')).toEqual([30]);
    expect(stat('GD-05', 'F')).toEqual([-20]);
    expect(stat('DR-11', 'mood.all')).toEqual([40]);
    for (const id of sim.DRAGONS.map((d: string[]) => d[1])) expect(stat(id, 'DFC').length + (id.startsWith('END') || id === 'DR-06' || id === 'DR-08' ? 1 : 0), id).toBeGreaterThan(0);
    expect(e.get('DR-15')!.role).toBe('mourn');
    expect(e.get('DR-13')!.role).toBe('hero');
    expect(W.rules.mourn).toMatchObject({ moodMin: 3, moodMax: 5, moodClosest: 8, faithA: 10, faithAYears: 5 });
  });
  it('reads the gates of the war for the keys and of the three endings', () => {
    const e = byId(W.events);
    expect(e.get('WR-15')).toMatchObject({ era: [4, 4], dfc: [11, 15], keysMin: 5 });
    expect(W.rules.keyWeight).toEqual({ from: 4, per: 0.5 });
    expect(e.get('END-11')!.needsAll).toEqual(['WR-15', 'MC-12']);
    expect(e.get('END-12')!.needsAll).toEqual(['WR-15']);
    expect(e.get('END-12')).toMatchObject({ hpMin: 2, role: 'ending' });
    expect(e.get('END-12')!.thr).toContainEqual({ v: 'F', op: '>', n: 70 });
    expect(e.get('END-10')!.dfc).toEqual([14, 14]);
    expect(W.rules.warRepeatYears).toBe(100);
  });
  it('gives the same closures and successors', () => {
    const json = new Map(W.closures.map((c) => [c.trigger, c]));
    // a trigger the docs only list under 'คงอยู่' (MC-04) has no closed event: the sim has no entry, the JSON keeps the keep list
    expect(set([...json.keys()].filter((t) => !(sim.CLOSE as Map<string, unknown>).has(t)))).toEqual(['MC-04']);
    for (const t of (sim.CLOSE as Map<string, unknown>).keys()) expect(json.has(t), t).toBe(true);
    for (const [t, xs] of sim.CLOSE as Map<string, Set<string>>) expect(set(json.get(t)!.close), `close ${t}`).toEqual(set(xs));
    // the sim keeps a successor map only where the docs name one; the JSON carries exactly those pairs
    for (const [t, m] of sim.SUCC as Map<string, Map<string, string>>) {
      const pairs = set(json.get(t)!.replace.map((r) => `${r.from}>${r.to}`));
      expect(pairs, `replace ${t}`).toEqual(set([...m].map(([a, b]) => `${a}>${b}`)));
    }
    for (const c of W.closures) if (!(sim.SUCC as Map<string, unknown>).has(c.trigger)) expect(c.replace, c.trigger).toEqual([]);
    const clash = W.closures.flatMap((c) => c.keep.filter((x) => c.close.includes(x)).map((x) => `${c.trigger}:${x}`));
    expect(clash).toEqual(sim.closeClash);
  });
  it('gives the same religion weights', () => {
    const faithPct = new Map(W.faiths.map((f) => [f.no, f.pct ?? 0]));
    const simFaith = sim.FAITH as Map<string, [number, string | null, number, number][]>;
    const main = sim.MAIN as Record<string, Set<number>>;
    for (const e of W.events) {
      const ws = e.faith.filter((w) => !w.when);
      const countries = e.home.world ? null : [...e.home.countries, ...e.home.continents.flatMap((c) => Object.keys(main).filter((k) => k.startsWith(c + '-')))];
      const got: [number, string | null, number][] = [];
      for (const w of ws) {
        const share = countries ? countries.filter((c) => main[c]?.has(w.faith)).length / countries.length : (faithPct.get(w.faith) ?? 0) > 20 ? 1 : 0;
        if (!share) continue;
        got.push([1 + (w.mul - 1) * share, w.after ?? null, w.faith]);
      }
      const want = (simFaith.get(e.id) ?? []).map((x) => [x[0], x[1], x[2]]);
      expect(got.map((x) => x.map(String).join('|')).sort(), `faith ${e.id}`).toEqual(want.map((x) => x.map(String).join('|')).sort());
    }
  });
  it('gives the same last-era rules as the sim defs', () => {
    const src = readFileSync(path.join(root, 'scripts/sim/sim-world.mjs'), 'utf8');
    const defs = [...src.matchAll(/\['(LE-\d\d)', '([○●])', ([^\n]*?)\],(?: \/\/.*)?$/gm)].map((m) => ({ id: m[1], mk: m[2], expr: m[3] }));
    expect(defs).toHaveLength(9);
    const le = byId(W.lastEra);
    for (const d of defs) {
      const e = le.get(d.id)!;
      expect(e.mark, d.id).toBe(d.mk);
      const prereq = [...d.expr.matchAll(/has\('(LE-\d\d)'\)/g)].map((m) => m[1]).filter((x) => x !== d.id);
      // the sim also gates LE-08 on LE-03 and LE-05 on PO-01/HP-01 (stand-ins for keys and cv.2): a gap the docs do not state
      const standIn: Record<string, string[]> = { 'LE-08': ['LE-03'], 'LE-05': [] };
      expect(set(e.needs), d.id).toEqual(set(prereq.filter((x) => !(standIn[d.id] ?? []).includes(x))));
      const rep = /year - lastOf\('LE-\d\d'\) >= (\d+)/.exec(d.expr);
      expect(e.repeatYears, d.id).toBe(rep ? Number(rep[1]) : undefined);
    }
    expect(W.phases.map((p) => p.dfc)).toEqual([[10, 11], [12, 13], [14, 14]]);
    const fb = (id: string) => le.get(id)!.feedback;
    expect(fb('LE-01')).toMatchObject({ keys: { set: 1 }, faith: -1 });
    expect(fb('LE-02')).toMatchObject({ moodAll: -1, keys: { delta: 1, chance: 0.5 } });
    expect(fb('LE-03')).toMatchObject({ keys: { delta: 2, max: 9 }, moodAll: -1 });
    expect(fb('LE-04')).toMatchObject({ faith: -0.5 });
    expect(fb('LE-05')).toMatchObject({ faith: -2, moodAll: -2, warMul: { mul: 1.5, years: 40 }, hpBlockYears: 30 });
    expect(fb('LE-06')).toMatchObject({ faith: 2, moodAll: 2, warMul: { clear: true } });
    expect(fb('LE-07')).toMatchObject({ faith: 1 });
    expect(fb('LE-08')).toMatchObject({ keys: { delta: 1, chance: 0.6, alt: { delta: -1, chance: 0.4 } } });
    expect(le.get('LE-10')!.countdown && le.get('LE-12')!.countdown).toBe(true);
    expect(le.get('LE-11')!.withEvent).toBe('WR-15');
  });
});

describe('the generator', () => {
  it('writes the same bytes twice', () => {
    const files = ['world-events.json', 'local-events.json', '_unparsed/events.md'];
    const a = files.map((f) => readFileSync(path.join(genDir, f), 'utf8'));
    const rep = run();
    const b = files.map((f) => readFileSync(path.join(genDir, f), 'utf8'));
    expect(b).toEqual(a);
    expect(rep.group).toBe('events');
    expect(rep.files).toEqual(['world-events.json', 'local-events.json']);
    expect(rep.strict).toBe(false);
  });
  it('keeps the unparsed report equal to the count it returns', () => {
    const rep = run();
    const md = readFileSync(path.join(genDir, '_unparsed/events.md'), 'utf8');
    expect(md).toContain(`${rep.unparsed} รายการ`);
  });
  it('reads a witness grant and a war outcome', () => {
    const e = byId<WorldEvent>(W.events);
    expect(e.get('DR-01')!.witness).toContainEqual({ k: 'grant', kind: 'blessing', id: 'nb_sv_sky' });
    expect(e.get('WR-01')!.outcomes.map((o) => o.key)).toEqual(['a', 'b', 'c']);
    expect(e.get('WR-01')!.outcomes[0].chain).toContain('MC-10');
  });
});
