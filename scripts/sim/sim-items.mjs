// Doc-level checks of two item systems, with no game code:
//   tools   payback of life tools under yearly income swings (docs/systems/items/19-prices.md section 6)
//   talisman  ancient talismans in NPC hands (docs/systems/items/20-npc-talisman.md): how many are in omen or possession at once
// Run: node scripts/sim/sim-items.mjs [tools|talisman] [runs]
import { argv } from 'node:process';

const mode = argv[2] || 'all';
const RUNS = Number(argv[3] || 2000);
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

if (mode === 'all' || mode === 'tools') {
  // tier: base income (C 14 U 22 R 36), tool price, tool bonus, tool lifetime in years (docs/systems/economy/04, items/11 section 6)
  const TIERS = [['C', 14, 6, 0.05, 15], ['U', 22, 24, 0.10, 25], ['R', 36, 80, 0.20, 40]];
  const W = [['W1', 0.7, 0.5], ['W2', 0.85, 0.75], ['W3', 1.0, 1.0], ['W4', 1.2, 1.4], ['W5', 1.5, 1.9]]; // price index, income index
  console.log('life tools: years to pay back (median / p90) and gold earned over the tool lifetime per gold of price');
  console.log('tier  W   price  median  p90   lifetime-return');
  for (const [t, base, price, bonus, life] of TIERS) {
    for (const [w, pi, ii] of W) {
      const pays = []; let ret = 0;
      for (let r = 0; r < RUNS; r++) {
        let gain = 0, paid = null;
        for (let y = 1; y <= life; y++) {
          gain += base * ii * bonus * (0.7 + 0.6 * rnd());
          if (paid == null && gain >= price * pi) paid = y;
        }
        pays.push(paid ?? life + 1); ret += gain / (price * pi);
      }
      console.log(`${t}     ${w}  ${(price * pi).toFixed(1).padStart(5)}  ${String(pct(pays, 0.5)).padStart(5)}  ${String(pct(pays, 0.9)).padStart(4)}   ${(ret / RUNS).toFixed(2)}x`);
    }
  }
}

if (mode === 'all' || mode === 'talisman') {
  // 24 ancient talismans by tier (docs/systems/items/14-talismans.md): U 7, R 8, E 7, L 2
  const TIER = [...Array(7).fill('U'), ...Array(8).fill('R'), ...Array(7).fill('E'), ...Array(2).fill('L')];
  const OMEN = { U: 0.08, R: 0.12, E: 0.15, L: 0.20 }, POSS = { U: 0.10, R: 0.20, E: 0.30, L: 0.40 };
  // buyers: [weight to be the buyer, odds multiplier, exit weights ก ขับไล่, ข ปรองดอง, ค ยอมรับ, ง ขายต่อ, จ ทิ้ง]
  const BUY = [
    ['collector', 25, 0.3, [10, 25, 5, 40, 20]],
    ['dealer', 20, 0.6, [15, 20, 5, 40, 20]],
    ['priest', 15, 0.5, [50, 25, 5, 10, 10]],
    ['scholar', 15, 1.5, [20, 40, 10, 15, 15]],
    ['noble', 15, 1.0, [20, 25, 15, 20, 20]],
    ['fighter', 10, 1.3, [15, 25, 20, 10, 30]],
  ];
  const FIND = 0.01, COUNTRIES = 20; // 1% a year per country with ruins (section 2)
  const DEATH = 1 / 40; // yearly chance the holder dies
  const YEARS = 1000, CAP = 6;
  const act = [], stats = { over: 0, years: 0, max: 0, sold: 0, finds: 0, bury: 0, accepted: 0 };
  for (let r = 0; r < Math.min(RUNS, 300); r++) {
    // state: 'ruin' | {buyer, stage: 0 hold 1 omen 2 possess, quiet: true after ally/accept}
    const T = TIER.map((t, i) => ({ t, st: i < 6 ? { b: pick(BUY.map((b) => b[1])), stage: 0, quiet: false } : 'ruin' }));
    for (let y = 0; y < YEARS; y++) {
      let active = 0;
      for (const x of T) {
        if (x.st === 'ruin') {
          if (rnd() < (FIND * COUNTRIES) / T.filter((q) => q.st === 'ruin').length / 1) { x.st = { b: pick(BUY.map((b) => b[1])), stage: 0, quiet: false }; stats.finds++; }
          continue;
        }
        const h = x.st;
        if (rnd() < DEATH) { if (rnd() < 0.5) { x.st = { b: pick(BUY.map((b) => b[1])), stage: 0, quiet: false }; stats.sold++; } else { h.stage = 0; h.quiet = false; } continue; }
        if (h.quiet) continue;
        const m = BUY[h.b][2];
        if (h.stage === 0 && rnd() < OMEN[x.t] * m) h.stage = 1;
        else if (h.stage === 1 && rnd() < POSS[x.t] * m) h.stage = 2;
        else if (h.stage === 2) {
          const e = pick(BUY[h.b][3]);
          if (e === 0) { h.stage = 0; }
          else if (e === 1) { h.stage = 0; h.quiet = true; }
          else if (e === 2) { h.stage = 0; h.quiet = true; stats.accepted++; }
          else if (e === 3) { x.st = { b: pick(BUY.map((b) => b[1])), stage: 0, quiet: false }; stats.sold++; }
          else { x.st = 'ruin'; stats.bury++; }
        }
        if (typeof x.st === 'object' && x.st.stage > 0) active++;
      }
      act.push(active); stats.years++; if (active > CAP) stats.over++; stats.max = Math.max(stats.max, active);
    }
  }
  console.log('ancient talismans in NPC hands (24 total, 6 held at the start, 1000 years x runs)');
  console.log(`in omen or possession at once: mean ${(act.reduce((a, b) => a + b, 0) / act.length).toFixed(2)}  p95 ${pct(act, 0.95)}  p99 ${pct(act, 0.99)}  max ${stats.max}`);
  console.log('share of years above a cap of ' + [6, 8, 10, 12].map((c) => `${c}: ${(100 * act.filter((v) => v > c).length / act.length).toFixed(1)}%`).join(' · '));
  const n = Math.min(RUNS, 300);
  console.log(`per run per century: found ${(stats.finds / n / 10).toFixed(1)} · sold on ${(stats.sold / n / 10).toFixed(1)} · buried ${(stats.bury / n / 10).toFixed(1)} · accepted ${(stats.accepted / n / 10).toFixed(1)}`);
}
