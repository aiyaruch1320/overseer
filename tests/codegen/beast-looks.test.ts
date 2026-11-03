import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BeastLooksData } from '../../src/core/data/types-beast-looks';
import type { EnemiesFile } from '../../src/core/data/types-combat';
import { readDoc } from '../../scripts/codegen/lib/table';

const load = <T>(n: string): T => JSON.parse(readFileSync(`data/gen/${n}.json`, 'utf8'));
const B = load<{ items: BeastLooksData }>('beast-looks').items;
const E = load<EnemiesFile>('enemies').items.items;
const HEX = /^#[0-9a-f]{6}$/;

describe('beast-looks generator: the docs state', () => {
  it('200 enemies with the ids of enemies.json, in the same groups, and 15 dragons', () => {
    expect(B.enemies.length).toBe(200);
    expect(B.dragons.length).toBe(15);
    expect(B.counts).toEqual({ enemies: 200, dragons: 15 });
    expect(new Set(B.enemies.map((e) => e.id))).toEqual(new Set(E.map((e) => e.id)));
    const g: Record<string, string> = { code: 'code', world: 'world', npc: 'npc_generic', named: 'npc_named', boss: 'boss' };
    for (const e of B.enemies) expect(g[e.group], e.id).toBe(E.find((x) => x.id === e.id)!.group);
  });
  it('every enemy has a size class, colours, three pose words and a plan the painters know', () => {
    const plans = new Set(['humanoid', 'quadruped', 'flyer', 'insect', 'serpent', 'amorphous', 'skeleton', 'construct', 'plant', 'elemental', 'spirit', 'giant', 'sea', 'swarm', 'dragon']);
    for (const e of B.enemies) {
      expect(['S', 'M', 'L', 'XL', 'XXL'], e.id).toContain(e.size);
      for (const c of [e.main, e.second, e.eye]) expect(c, e.id).toMatch(HEX);
      expect(e.poses.idle && e.poses.atk && e.poses.die, e.id).toBeTruthy();
      expect(plans.has(e.plan), e.id).toBe(true);
      expect(e.form, e.id).toBeTruthy();
      expect(e.parts !== null, e.id).toBe(e.plan === 'humanoid' && (e.form === 'person' || e.form === 'wolfman'));
    }
  });
  it('size, scale, swarm and colours are the ones of the row of 04-enemies.md', () => {
    const rows = new Map(readDoc('docs/appearance/04-enemies.md').split('\n').filter((l) => l.startsWith('| ')).map((l) => [l.split(' | ')[0].slice(2), l] as const));
    for (const e of B.enemies) {
      const row = rows.get(e.id)!;
      expect(row, e.id).toBeTruthy();
      expect(row, e.id).toContain(`ขนาด ${e.size}`);
      if (e.scale !== null) expect([...row.matchAll(/(\d+(?:\.\d+)?)×/g)].map((m) => Number(m[1])), e.id).toContain(e.scale);
      if (e.swarm) expect(row, e.id).toMatch(new RegExp(`(ฝูง|ชุด) ${e.swarm[0]}[–-]${e.swarm[1]}`));
      expect(row, e.id).toContain(`สี ${e.main} ${e.second}`);
      if (e.eyeGiven) expect(row, e.id).toContain(e.eye);
      expect(row, e.id).toContain(`idle=${e.poses.idle}`);
    }
  });
  it('the plans: the six XXL are background pieces, the swarm plans are crowds, the slimes are amorphous', () => {
    expect(B.enemies.filter((e) => e.size === 'XXL').map((e) => e.id).sort()).toEqual(['NR11-2', 'awakened_titan', 'hellgate_lord', 'kraken', 'leviathan', 'primordial_engine']);
    expect(B.enemies.filter((e) => e.plan === 'swarm').map((e) => e.id).sort()).toEqual(['fog_moth_swarm', 'locust_swarm', 'rust_swarm']);
    expect(B.enemies.filter((e) => e.plan === 'amorphous').map((e) => e.id).sort()).toEqual(['lava_slime', 'slime']);
    // a humanoid taller than a frame holds a person (1.5×) is drawn as a big body
    for (const e of B.enemies.filter((x) => x.plan === 'humanoid' && x.form === 'person')) expect(e.scale ?? 1, e.id).toBeLessThanOrEqual(1.5);
  });
  it('the plan is a guess only where nothing in the row names the body', () => {
    const guess = B.enemies.filter((e) => e.planBy === 'guess').map((e) => e.id);
    for (const id of ['NR11-2', 'NR07-1', 'KD07-1', 'awakened_titan', 'leviathan']) expect(guess, id).toContain(id);
    for (const e of B.enemies.filter((x) => x.group === 'code')) expect(e.planBy, e.id).not.toBe('guess');
  });
  it('the dragons: sizes, colours and the second head of Rahu, the shut eye of Andar', () => {
    const doc = readDoc('docs/appearance/03-dragons.md');
    const sizes = [...doc.matchAll(/^\| (\d+) \| ([^|]+) \| (M|L|XL) \| /gm)].map((m) => [Number(m[1]), m[2].trim(), m[3]] as const);
    expect(sizes.length).toBe(15);
    for (const [n, name, size] of sizes) {
      const d = B.dragons.find((x) => x.n === n)!;
      expect(d.name).toBe(name);
      expect(d.size).toBe(size);
      for (const c of [d.main, d.second, d.eye]) expect(c).toMatch(HEX);
    }
    expect(B.dragons.find((d) => d.n === 6)!.alt).toEqual({ main: '#8a8aa0', second: '#2a2a3a', eye: '#101018' });
    expect(B.dragons.filter((d) => d.eyeShut).map((d) => d.n)).toEqual([11]);
    expect(B.dragons.filter((d) => d.alt).length).toBe(1);
  });
});
