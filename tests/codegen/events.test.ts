// Event generator (code-plan §5.1 rows 2 and 3, §12.4 M0-b): counts, references, and the same data the doc-level sim reads.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Condition, Effect, GenFile } from '../../src/core/types';
import type { LocalEventsData, Mark, WorldCond, WorldEvent, WorldEventsData } from '../../src/core/data/types-events';
import run from '../../scripts/codegen/groups/events';
import { STRUCTURE_WORDS, parseCond, parseWorldEffect, segmentsOf } from '../../scripts/codegen/lib/events-grammar';
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

// ---------- M0-c: choices, conditions and swaps keep their structure ----------

const effectsOf = (e: WorldEvent): Effect[] => [...e.effects, ...e.outcomes.flatMap((o) => o.effects)];
/** Every effect with the ones inside pick / if / chance branches. */
const walk = (fx: Effect[]): Effect[] =>
  fx.flatMap((x) => [x, ...(x.k === 'pick' ? walk(x.of.flatMap((o) => o.effects)) : x.k === 'if' || x.k === 'chance' ? walk(x.then) : [])]);
const condWalk = (c: WorldCond | undefined): WorldCond[] => (!c ? [] : c.k === 'and' || c.k === 'or' ? [c, ...c.of.flatMap(condWalk)] : c.k === 'not' ? [c, ...condWalk(c.of)] : [c]);
const topLevel = (fx: Effect[], k: Effect['k']) => fx.filter((x) => x.k === k);
const event = (id: string) => byId(W.events).get(id)!;
type Pick = Extract<Effect, { k: 'pick' }>;

describe('choices, conditions and swaps (data review B3 H3 H4 H9)', () => {
  it('reads "A หรือ B" and "A / B" as one pick (B3: CT-03 PL-06 DM-01 FG-14)', () => {
    // none of the choices is an effect of the whole event
    expect(event('CT-03').effects.filter((x) => x.k === 'event')).toEqual([]);
    expect(event('PL-06').effects.filter((x) => x.k === 'event')).toEqual([]);
    const pick = (id: string) => topLevel(event(id).effects, 'pick')[0] as Pick;
    expect(pick('CT-03').of.map((o) => o.effects)).toEqual([[{ k: 'event', id: 'HP-06' }], [{ k: 'event', id: 'PO-06' }]]);
    expect(pick('CT-03').of.map((o) => o.label)).toEqual(['ยารักษา', 'กักกัน']);
    // "→ WR-04 / WR-01" opens one of them
    expect(pick('PL-06').of.map((o) => o.effects)).toEqual([[{ k: 'event', id: 'WR-04', open: true }], [{ k: 'event', id: 'WR-01', open: true }]]);
    expect(pick('DM-01').of.map((o) => o.effects)).toEqual([[{ k: 'event', id: 'WR-03' }], [{ k: 'event', id: 'WR-07' }]]);
    expect(pick('FG-14').of).toHaveLength(2);
  });
  it('gives MC-12 a pick of the three endings, each with its name and opened (B3)', () => {
    const fx = event('MC-12').effects;
    expect(fx.filter((x) => x.k === 'event')).toEqual([]);
    const p = topLevel(fx, 'pick')[0] as Pick;
    expect(p.of.map((o) => o.label)).toEqual(['ร่วมมือ', 'ต่อต้าน', 'ปลอบ']);
    expect(p.of.map((o) => o.effects)).toEqual([[{ k: 'event', id: 'END-11', open: true }], [{ k: 'event', id: 'END-10', open: true }], [{ k: 'event', id: 'END-12', open: true }]]);
  });
  it('reads "ถ้า DR-01 แล้ว: …" as if (END-01 PL-01) and does not call DR-01 again', () => {
    for (const id of ['END-01', 'PL-01']) {
      const fx = event(id).effects;
      expect(fx.filter((x) => x.k === 'event'), id).toEqual([]);
      expect(fx).toContainEqual(expect.objectContaining({ k: 'if', cond: { k: 'event', id: 'DR-01', happened: true } }));
    }
    // "เมื่อถึงยุค 4" waits for the era (WR-14 ข)
    expect(event('WR-14').outcomes[1].effects).toEqual([{ k: 'if', cond: { k: 'era', min: 4 }, then: [{ k: 'event', id: 'WR-23' }] }]);
  });
  it('reads "แทน WR-01 ด้วย WR-22" as replace (DR-01)', () => {
    const fx = event('DR-01').effects;
    expect(fx).toContainEqual({ k: 'replace', from: 'WR-01', to: 'WR-22' });
    expect(fx.filter((x) => x.k === 'event' && (x.id === 'WR-01' || x.id === 'WR-22'))).toEqual([]);
    expect(event('DR-01').chain).toEqual(expect.arrayContaining(['WR-01', 'WR-22']));
  });
  it('opens an event only where the row opens it; a risk, a closeness or a refusal is a label', () => {
    for (const id of ['GI-08', 'DM-02', 'WR-23', 'FG-03', 'CT-08']) expect(walk(effectsOf(event(id))).filter((x) => x.k === 'event' && x.open), id).toEqual([]);
    expect(event('GI-08').effects).toEqual([{ k: 'label', text: 'PL-03 เสี่ยง' }]);
    expect(W.branch.find((b) => b.id === 'DW-05')!.effects).toEqual([{ k: 'label', text: 'ป้องกัน END-04' }]);
    // the three options of FG-10: only the second counts DFC and calls DR-15, and END-09 is named as not opened
    const fg10 = topLevel(event('FG-10').effects, 'pick')[0] as Pick;
    expect(fg10.of).toHaveLength(3);
    expect(fg10.of[1].effects).toEqual([{ k: 'stat', stat: 'DFC', delta: 1 }, { k: 'event', id: 'DR-15', open: true }, { k: 'label', text: 'END-09 ไม่เปิด' }]);
    expect(event('FG-10').effects.filter((x) => x.k === 'stat' || x.k === 'event')).toEqual([{ k: 'event', id: 'BIO-04' }]);
  });
  it('binds a value after ":" or "→" to its own case (H4: DR-02 DR-03)', () => {
    const p2 = topLevel(event('DR-02').effects, 'pick')[0] as Pick;
    expect(p2.of.map((o) => o.label)).toEqual(['ปลุกสำเร็จ', 'ไม่สำเร็จใน 5 ทศวรรษ']);
    expect(p2.of[0].effects).toEqual([{ k: 'stat', stat: 'F', delta: 15 }, { k: 'event', id: 'DR-14', open: true }]);
    expect(p2.of[1].effects).toEqual([{ k: 'event', id: 'DR-01', open: true }]);
    expect(topLevel(event('DR-02').effects, 'stat')).toEqual([]);
    const p3 = topLevel(event('DR-03').effects, 'pick')[0] as Pick;
    expect(p3.of.map((o) => o.label)).toEqual(['ฟักสำเร็จ', 'ไข่ถูกขโมย', 'ไข่แตกเสีย']);
    expect(p3.of[2].effects).toEqual([{ k: 'stat', stat: 'F', delta: -10 }]);
    // the DFC −1 of the egg belongs to HP-08 ("เมื่อโตเต็มวัยใน HP-08")
    expect(walk(event('DR-03').effects).filter((x) => x.k === 'stat' && x.stat === 'DFC')).toEqual([]);
    expect(topLevel(event('DR-03').effects, 'stat')).toEqual([]);
    // "ผู้แพ้มีโอกาส 40% ล้ม (DFC+1)": the chance holds the DFC
    expect(event('DR-09').effects).toEqual([{ k: 'chance', p: 0.4, text: 'ล้ม', then: [{ k: 'stat', stat: 'DFC', delta: 1 }] }]);
  });
  it('does not read a number glued to an event code as a number (H4: DM-03 → DM-08)', () => {
    expect(event('DM-03').effects).toEqual([{ k: 'event', id: 'DM-08', open: true }]);
    // the grammar itself: the number must not touch a letter
    const stats = (cell: string) => parseWorldEffect(cell, 'XX-00', ids).effects.filter((x) => x.k === 'stat');
    expect(stats('ความหิวสะสม → DM-08')).toEqual([]);
    expect(stats('ความหิว −8 → DM-08')).toEqual([{ k: 'stat', stat: 'H', delta: -8 }]);
  });
  it('never leaves an effect of a segment with หรือ / ถ้า / แทน outside pick, if, replace or chance (regression of the review)', () => {
    const cells: [string, string][] = [];
    for (const e of W.events) {
      cells.push([e.id, e.effectText]);
      for (const o of e.outcomes) cells.push([`${e.id}${o.key}`, o.text]);
    }
    for (const e of W.branch) cells.push([e.id, e.effectText]);
    for (const e of W.lastEra) cells.push([e.id, e.effectText]);
    let seen = 0;
    for (const [id, t] of cells)
      for (const seg of segmentsOf(t)) {
        if (!STRUCTURE_WORDS.test(seg)) continue;
        seen++;
        const bare = parseWorldEffect(seg, id, ids).effects.filter((x) => !['label', 'pick', 'if', 'replace', 'chance'].includes(x.k));
        expect(bare, `${id}: ${seg}`).toEqual([]);
      }
    expect(seen).toBeGreaterThan(15);
    // the stored data has no pick with fewer than two branches and no replace without both ends
    for (const e of [...W.events, ...W.branch])
      for (const x of walk(e.effects.concat('outcomes' in e ? effectsOf(e as WorldEvent) : [])))
        if (x.k === 'pick') expect(x.of.length, e.id).toBeGreaterThanOrEqual(2);
        else if (x.k === 'replace') expect(Boolean(x.from && x.to), e.id).toBe(true);
  });
  it('reads "ถ้า … → …" cases and arrows of a branch event as a pick (SF-03 SF-04 DV-04)', () => {
    const pick = (id: string) => topLevel(W.branch.find((b) => b.id === id)!.effects, 'pick')[0] as Pick;
    expect(pick('SF-03').of.map((o) => o.label)).toEqual(['ฟักสำเร็จ', 'ถูกขโมย']);
    expect(pick('SF-04').of.map((o) => o.label)).toEqual(['รับ', 'ขับไล่']);
    expect(pick('DV-04').of.map((o) => o.label)).toEqual(['สำเร็จ', 'ล้ม']);
    expect(W.branch.find((b) => b.id === 'SF-10')!.effects).toContainEqual({ k: 'if', cond: { k: 'event', id: 'SF-03', happened: true }, then: [{ k: 'event', id: 'HP-08' }] });
  });

  it('gives every event with an "A หรือ B" condition a cond tree (H3: MC-04 BIO-01 BIO-07 DM-01 DR-01)', () => {
    const v = (name: string, op: '<' | '>', n: number): WorldCond => ({ k: 'var', name, op, n });
    const ev = (id: string, outcome?: 'a' | 'b' | 'c'): WorldCond => ({ k: 'event', id, happened: true, ...(outcome ? { outcome } : {}) });
    expect(event('MC-04').cond).toEqual({ k: 'or', of: [v('P', '>', 60), ev('PL-06')] });
    expect(event('BIO-01').cond).toEqual({ k: 'or', of: [v('P', '>', 50), ev('WR-04', 'a'), ev('WR-08', 'b'), ev('WR-17', 'b')] });
    expect(event('BIO-07').cond).toEqual({ k: 'or', of: [v('P', '>', 40), ev('DR-05')] });
    expect(event('DM-01').cond).toEqual({ k: 'or', of: [{ k: 'and', of: [v('H', '>', 70), ev('WR-19', 'a')] }, ev('PL-02')] });
    // DR-01 has three ways and only one of them is the faith drop
    const dr01 = event('DR-01').cond as Extract<WorldCond, { k: 'and' }>;
    expect(dr01.of[0]).toEqual({ k: 'era', min: 2 });
    const way = dr01.of[1] as Extract<WorldCond, { k: 'or' }>;
    expect(way.k).toBe('or');
    expect(way.of).toHaveLength(3);
    expect(way.of[1]).toEqual(v('F', '<', 20));
  });
  it('keeps thr and needs as the flat view and makes cond hold every threshold and every need', () => {
    for (const e of W.events) {
      const vars = condWalk(e.cond).filter((c) => c.k === 'var') as { name: string; op: string; n: number }[];
      for (const t of e.thr) expect(vars.some((c) => c.name === t.v && c.op === t.op && c.n === t.n), `${e.id} ${t.v}${t.op}${t.n}`).toBe(true);
      const evs = condWalk(e.cond).filter((c) => c.k === 'event').map((c) => (c as { id: string }).id);
      for (const n of e.needs) expect(evs, `${e.id} needs ${n}`).toContain(n);
    }
  });
  it('is a Condition of the contract (compile-time) and every event atom names an event', () => {
    const known = new Set([...W.events, ...W.branch, ...W.lastEra].map((e) => e.id));
    for (const e of W.events) {
      const c: Condition | undefined = e.cond;
      void c;
      for (const a of condWalk(e.cond)) if (a.k === 'event') expect(known.has(a.id), `${e.id} ${a.id}`).toBe(true);
    }
    for (const e of [...L.events, ...L.generated]) {
      const c: Condition = e.depends;
      void c;
    }
  });
  it('reports every prose leaf of a condition in the unparsed list', () => {
    const md = readFileSync(path.join(genDir, '_unparsed/events.md'), 'utf8');
    const prose = (c: WorldCond | undefined) => condWalk(c).filter((x) => x.k === 'text').map((x) => (x as { text: string }).text);
    let n = 0;
    for (const e of W.events)
      for (const t of prose(e.cond)) {
        n++;
        expect(md, `${e.id}: ${t}`).toContain(t);
      }
    for (const e of [...L.events, ...L.generated])
      for (const t of prose(e.depends)) {
        n++;
        expect(md, `${e.id}: ${t}`).toContain(t);
      }
    expect(n).toBe(0); // M0-c2 rewrote every prose leaf of the event docs into codes
    // the parser itself: a phrase with no atom stays text, an or of prose stays one phrase
    expect(parseCond('พงไพรหรือหมอก').cond).toEqual({ k: 'text', text: 'พงไพรหรือหมอก' });
    expect(parseCond('มลพิษ > 60 หรือ PL-06').cond).toEqual({ k: 'or', of: [{ k: 'var', name: 'P', op: '>', n: 60 }, { k: 'event', id: 'PL-06', happened: true }] });
  });
  it('keeps the pair and the fuse of a war out of the condition and in condNote', () => {
    expect(event('WR-01').cond).toBeUndefined();
    expect(event('WR-01').condNote).toContain('จักรกล × มังกร');
    expect(event('WR-03').cond).toEqual({ k: 'var', name: 'H', op: '>', n: 80 });
    expect(event('WR-15').cond).toEqual({ k: 'and', of: [{ k: 'era', min: 4 }, { k: 'cmp', stat: 'dfc', op: '>=', value: 11 }, { k: 'cmp', stat: 'keys', op: '>=', value: 5 }] });
  });

  it('keeps every swap of the แทนที่ rows: the ones the sim holds in replace, the others in swaps (H9)', () => {
    const doc = readFileSync(path.join(root, 'docs/systems/events/branches/01-dragon-falls.md'), 'utf8').split('\n');
    const dr01 = W.closures.find((c) => c.trigger === 'DR-01')!;
    expect(dr01.swaps).toContainEqual(expect.objectContaining({ from: 'WR-01', to: 'WR-22' }));
    expect(dr01.swaps).toContainEqual(expect.objectContaining({ from: 'DR-11', to: 'พิธีไว้อาลัยมหาศักดิ์สิทธิ์' }));
    // every event id on the left of an arrow in the doc is in replace or swaps of its trigger (no first or last item lost)
    let section = '';
    let checked = 0;
    for (const l of doc) {
      const h = l.match(/^## \d+\. (\S+) → /);
      if (h) section = h[1];
      const row = l.match(/^\| \*\*แทนที่\*\* \| (.*) \|$/);
      if (!row) continue;
      const d = W.dragons.find((x) => x.name === section)!;
      const triggers = W.closures.filter((c) => c.trigger === d.fallEvent || (section === 'นิเวรี' && c.trigger === 'FG-11'));
      expect(triggers.length, section).toBeGreaterThan(0);
      for (const item of row[1].split(' · ').filter((x) => x.includes('→'))) {
        for (const from of item.split('→')[0].match(/\b[A-Z]{2,3}-\d{2}\b/g) ?? []) {
          const have = triggers.some((c) => c.replace.some((r) => r.from === from) || c.swaps.some((s) => s.from === from));
          expect(have, `${section}: ${from}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(12);
    // the sim holds exactly the branch pairs, so none of the swaps is also in replace
    for (const c of W.closures) for (const s of c.swaps) expect(c.replace.some((r) => r.from === s.from && r.to === s.to), `${c.trigger} ${s.from}`).toBe(false);
  });
});

describe('local events keep their dependency and their opened nodes (data review M6)', () => {
  const lc = (id: string) => L.events.find((e) => e.id === id)!;
  it('LC-01 depends on WR-24 about to fire (the dust running out is that event)', () => {
    expect(lc('LC-01').depends).toEqual({ k: 'event', id: 'WR-24', happened: true, phase: 'near' });
    expect(lc('LC-01').reads).toEqual([{ id: 'WR-24', phase: 'near' }]);
    expect(lc('LC-07').depends).toEqual({
      k: 'or',
      of: [{ k: 'event', id: 'WR-20', happened: true, phase: 'running' }, { k: 'event', id: 'BIO-08', happened: true, phase: 'near' }],
    });
  });
  it('does not make a risk an event (LC-21 ลงต่อ) and opens ex.a1 on หยุด', () => {
    const e = lc('LC-21');
    expect(e.paths[0].effects).toEqual([{ k: 'label', text: 'PL-03 เสี่ยง' }]);
    expect(e.paths[1].effects).toEqual([{ k: 'ref', nodes: ['ex.a1'], rel: 'เปิด' }]);
    expect(e.touches).toContain('PL-03');
    // no path turns a "เสี่ยง ID" of its text into an event effect
    for (const x of [...L.events, ...L.generated])
      for (const p of x.paths)
        for (const f of p.effects) if (f.k === 'event') expect(p.text, `${x.id} ${p.when}`).not.toMatch(new RegExp(`${f.id}\`?\\s*เสี่ยง|เสี่ยง\\s*\`?${f.id}`));
  });
});
