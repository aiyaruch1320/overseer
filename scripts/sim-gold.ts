// Measures how much gold characters hold, to price shops and commissions in the design docs.
// Run: npx tsx scripts/sim-gold.ts [lives]   (default 300)
import { Game, type Meta } from '../src/sim/game';

const N = Number(process.argv[2] || 300);
const meta: Meta = { karma: 0, codex: [], lives: [], racesPlayed: [] };
const peak: number[] = [];
const atAge: Record<number, number[]> = { 20: [], 30: [], 45: [], 60: [] };

for (let i = 0; i < N; i++) {
  const g = Game.newGame('gold-' + i, meta);
  g.autoDecide = true;
  let max = 0;
  const seen = new Set<number>();
  for (let guard = 0; guard < 6000 && !g.s.ended && g.c.alive; guard++) {
    if (g.s.pending) {
      if (g.s.pending.kind === 'death') g.decideDeath(null);
      else g.resolve();
      continue;
    }
    g.tick();
    max = Math.max(max, g.c.gold);
    for (const age of Object.keys(atAge).map(Number)) {
      if (!seen.has(age) && g.c.hAge >= age) { seen.add(age); atAge[age].push(g.c.gold); }
    }
  }
  peak.push(max);
}

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))] ?? 0; };
const row = (label: string, a: number[]) => console.log(`${label.padEnd(14)} n=${String(a.length).padEnd(4)} p25 ${q(a, 0.25)}  p50 ${q(a, 0.5)}  p75 ${q(a, 0.75)}  p90 ${q(a, 0.9)}`);
for (const age of Object.keys(atAge).map(Number)) row(`gold at ${age}`, atAge[age]);
row('peak gold', peak);
