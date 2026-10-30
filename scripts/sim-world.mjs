// Docs-level world simulation: reads docs/world/world-events.md, docs/storylines/00-convergence.md and docs/races/README.md,
// runs many worlds on the world clock (ศ.ม., decade steps) and reports how events, eras and convergence points play out.
// It models structure (era gates, prerequisites, caps, dragon moods), not the prose conditions: see docs/world/world-sim.md for limits.
// Usage: node scripts/sim-world.mjs [worlds=2000] [--json]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const read = (p) => fs.readFileSync(path.join(docs, p), 'utf8');
const WORLDS = Number(process.argv[2]) || 2000;
const START = 10400;
const HORIZON = 1800; // years simulated per world

// ---------- parameters (tunable) ----------
export const P = {
  rate: { '⭐': 0.08, '●': 0.12, '○': 0.2 }, // chance per decade once an event is enabled
  stateBoost: 2, // multiplier when the event has a numeric state condition that holds
  stress: 1.0, // mood decay per decade (times each dragon's own factor)
  rec: 0.03, // mood recovery per decade toward the cap, scaled by world faith / 60
  wave: 0.35, // scale of the mourning wave on other dragons (docs: -15 to -25, closest -40)
  faithDrift: -0.5, // world faith change per decade
  hero: 0.1, // DR-13 chance per decade once a dragon has fallen (the spear wl_dragon_bane is forged from a fallen dragon's bone)
  hero0: 0.02, // before any dragon has fallen only wl_hrod can start DR-13
  capYears: { '⭐': 80, '●': 25, '○': 8 }, // docs/world/world-events.md section 0.2
  windowYears: 100, // how long a convergence point stays open after its trigger (docs/storylines/00-convergence.md)
  strictCap: false, // apply the section 0.2 cap to dragon falls too
};

// ---------- data ----------
const EVENT_PREFIX = ['DR', 'PL', 'WR', 'CT', 'DM', 'MC', 'BIO', 'GD', 'HP', 'PO', 'GI', 'FG', 'END'];
const idRe = new RegExp(`\\b(?:${EVENT_PREFIX.join('|')})-\\d{2}\\b`, 'g');
const events = [];
for (const l of read('world/world-events.md').split('\n')) {
  const m = l.match(/^\| \*\*([A-Z]{2,3}-\d{2}) ([⭐●○])? ?([^*]*)\*\*(.*?)\| (.*?) \| (.*?) \| (.*) \|$/);
  if (m) events.push({ id: m[1], mk: m[2] || '○', name: (m[3] + m[4]).trim(), cond: m[5], what: m[6], eff: m[7] });
}
const byId = new Map(events.map((e) => [e.id, e]));

function eraGate(c) {
  let m;
  if ((m = c.match(/ยุค ≥ (\d)/))) return [+m[1], 4];
  if ((m = c.match(/ยุค (\d)[–-](\d)/))) return [+m[1], +m[2]];
  if ((m = c.match(/ยุค (\d)(?!\d)/))) return [+m[1], +m[1]];
  return [1, 4];
}
// dragons: 0-5 primordial and elders, 6-14 pillars
const DRAGONS = [
  ['โอรัน-ซัล', 'DR-01', 2, 1.2], ['เพลิงนิรันดร์', 'DR-04', 2, 0.8], ['สมุทรอาลัย', 'DR-05', 2, 1.1],
  ['พายุไร้ทิศ', 'DR-06', 2, 0.9], ['ศิลาสะท้าน', 'DR-07', 3, 0.7], ['ราหู', 'DR-08', 2, 0.9],
  ['อีริดาน', 'END-01', 1, 0.8], ['ฮรอด-กาธ', 'END-02', 1, 1.0], ['คัลดรา', 'END-03', 1, 0.8],
  ['ธาลาสซา', 'END-04', 1, 0.8], ['อันดาร์', 'END-05', 1, 1.0], ['เซเรเน', 'END-06', 1, 1.8],
  ['กรอม-ธาร', 'END-07', 1, 0.8], ['ซิลเวรา', 'END-08', 1, 1.0], ['นิเวรี', 'END-09', 1, 0.9],
];
const INIT = [72, 72, 62, 72, 72, 70, 72, 70, 72, 72, 60, 50, 72, 60, 70];
const PAIRS = [[0, 7], [1, 2], [3, 6], [4, 12], [8, 9], [10, 11], [13, 14]];
const FALL_IDS = new Set(DRAGONS.map((d) => d[1]));
const PL_OF = Object.fromEntries(['PL-01', 'PL-02', 'PL-03', 'PL-04', 'PL-05', 'PL-06', 'PL-07', 'PL-08', 'PL-09'].map((id, i) => [id, 6 + i]));
const SPECIAL = new Set([...FALL_IDS, 'DR-15', 'DR-13', 'END-10', 'END-11', 'END-12', 'FG-01']);

// per-event static analysis
for (const e of events) {
  e.gate = eraGate(e.cond);
  e.prereq = [...new Set((e.cond.match(idRe) || []).filter((x) => x !== e.id))];
  e.thr = [];
  let m;
  const c = e.cond;
  if ((m = c.match(/ความหิว > (\d+)/))) e.thr.push(['H', '>', +m[1]]);
  if ((m = c.match(/สุขภาพต้นไม้ < (\d+)/))) e.thr.push(['T', '<', +m[1]]);
  if ((m = c.match(/ความหนาหมอก > (\d+)/))) e.thr.push(['D', '>', +m[1]]);
  if ((m = c.match(/(?:ศรัทธาโลก|ศรัทธา|ความเชื่อ) < (\d+)/))) e.thr.push(['F', '<', +m[1]]);
  if ((m = c.match(/ศรัทธา > (\d+)/))) e.thr.push(['F', '>', +m[1]]);
  if (PL_OF[e.id] !== undefined && (m = c.match(/อารมณ์ < (\d+)/))) e.thr.push(['M' + PL_OF[e.id], '<', +m[1]]);
}

// convergence points
export const cvs = [];
for (const l of read('storylines/00-convergence.md').split('\n')) {
  const m = l.match(/^\| (cv\.\d+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$/);
  if (!m) continue;
  const trig = [...new Set(m[3].match(idRe) || [])];
  const entry = [...new Set((m[5].match(/\b[a-z]{2}\.[btae]\d\b/g) || []))];
  cvs.push({ id: m[1], name: m[2], open: m[3], trig, entry, all: /ทุกเผ่า/.test(m[5]), elderOnly: /e2/.test(m[5]) });
}

// races
const CODES = ['hu', 'el', 'de', 'dw', 'or', 'ha', 'be', 'na', 'dk', 'va', 'fa', 'sl', 'dm', 'me', 'wi', 'gi', 'la', 'co', 'so', 'mu', 'gh'];
export const races = [];
for (const l of read('races/README.md').split('\n')) {
  const c = l.split('|').map((x) => x.trim());
  if (c.length > 10 && /^\d+$/.test(c[1]) && /–/.test(c[9])) {
    const [a, b] = c[9].replace(/,/g, '').split('–').map(Number);
    races.push({ code: CODES[+c[1] - 1], name: c[2], lo: a, hi: b });
  }
}

// ---------- rng ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 0.7071; };

// ---------- one world ----------
export function runWorld(seed, opt = {}) {
  const p = { ...P, ...opt };
  const r = rng(seed);
  const mood = INIT.map((v) => v + gauss(r) * 4);
  const alive = DRAGONS.map(() => true);
  let dfc = 0;
  const S = { H: 55, T: 70, D: 55, F: 60 };
  const fired = new Map(); // id -> [years]
  const log = [];
  const lastClass = { '⭐': -1e9, '●': -1e9, '○': -1e9 };
  const era = () => (dfc <= 2 ? 1 : dfc <= 5 ? 2 : dfc <= 9 ? 3 : 4);
  const fire = (id, year, cls) => {
    if (!fired.has(id)) fired.set(id, []);
    fired.get(id).push(year);
    log.push([year, id]);
    if (cls) lastClass[cls] = year;
  };
  const eraStart = [START, null, null, null];
  let ended = null;
  fire('FG-01', START - 12);
  const cap = (cls, year) => year - lastClass[cls] >= p.capYears[cls];

  function fall(i, year, id, viaEvent) {
    alive[i] = false;
    dfc++;
    for (let k = 0; k < era(); k++) if (!eraStart[k]) eraStart[k] = year;
    if (viaEvent) fire(DRAGONS[i][1], year, viaEvent);
    fire('DR-15', year);
    S.F += 4;
    const closest = PAIRS.find((q) => q.includes(i));
    for (let j = 0; j < 15; j++) {
      if (!alive[j]) continue;
      let d = 15 + r() * 10;
      if (closest && closest.includes(j)) d = 40;
      if (i === 5) d += 8;
      mood[j] -= d * p.wave;
    }
    fired.set('_fall_' + i, [year]);
  }

  for (let step = 0; step <= HORIZON / 10 && !ended; step++) {
    const year = START + step * 10;
    // world variables
    S.H = Math.min(100, Math.max(0, S.H + 1.2 + gauss(r) * 2));
    S.T = Math.min(100, Math.max(0, S.T - 0.8 + gauss(r) * 1.5));
    S.D = Math.min(100, Math.max(0, S.D + 0.6 + gauss(r) * 2));
    S.F = Math.min(100, Math.max(0, S.F + p.faithDrift + gauss(r) * 2.5));
    const capM = 100 - 3 * dfc;
    for (let i = 0; i < 15; i++) {
      if (!alive[i]) continue;
      const drift = p.rec * (capM - mood[i]) * (S.F / 60) - DRAGONS[i][3] * p.stress;
      mood[i] = Math.min(capM, mood[i] + drift + gauss(r) * 1.5);
    }
    // dragon falls by mood
    const order = DRAGONS.map((_, i) => i).sort((a, b) => mood[a] - mood[b]);
    for (const i of order) {
      if (!alive[i] || mood[i] >= 10) continue;
      const [, id, minEra] = DRAGONS[i];
      if (era() < minEra) continue; // the docs gate elder falls by era
      const star = id.startsWith('END') || ['DR-01', 'DR-04', 'DR-05', 'DR-07'].includes(id) ? '⭐' : '●';
      if (p.strictCap && !cap(star, year)) continue;
      if (mood[i] < 3 || r() < 0.35) fall(i, year, id, star);
    }
    // hero kills a legend dragon (DR-13), allowed in every era
    if (r() < (dfc === 0 ? p.hero0 : p.hero)) {
      const live = alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
      if (live.length > 1 && !(p.strictCap && !cap('●', year))) {
        const w = live.map((i) => 100 - mood[i] + 10);
        let x = r() * w.reduce((a, b) => a + b, 0), k = 0;
        while (x > w[k]) { x -= w[k]; k++; }
        fire('DR-13', year, '●');
        fall(live[k], year, null, DRAGONS[live[k]][1].startsWith('END') || ['DR-01', 'DR-04', 'DR-05', 'DR-07'].includes(DRAGONS[live[k]][1]) ? '⭐' : '●');
      }
    }
    // other events
    const cand = [];
    for (const e of events) {
      if (SPECIAL.has(e.id) || FALL_IDS.has(e.id)) continue;
      const done = fired.get(e.id);
      if (done && !(e.id.startsWith('WR') && year - done[done.length - 1] >= 100)) continue;
      if (done && !e.id.startsWith('WR')) continue;
      const er = era();
      if (er < e.gate[0] || er > e.gate[1]) continue;
      if (e.prereq.length && !e.prereq.some((x) => fired.has(x))) continue;
      let boost = 1;
      if (e.thr.length) {
        const ok = e.thr.every(([v, op, n]) => {
          const val = v[0] === 'M' ? mood[+v.slice(1)] : S[v];
          return op === '>' ? val > n : val < n;
        });
        if (!ok) continue;
        boost = p.stateBoost;
      }
      cand.push([e, p.rate[e.mk] * boost]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    for (const [e, pr] of cand) {
      if (r() >= pr) continue;
      if (!cap(e.mk, year)) continue;
      fire(e.id, year, e.mk);
      // a few effects that other events read
      if (e.id === 'HP-07') S.H -= 25;
      if (e.id === 'DR-11') { for (let i = 0; i < 15; i++) if (alive[i]) mood[i] = Math.min(100 - 3 * dfc, mood[i] + 40); S.F += 10; }
      if (e.id === 'FG-10') { S.D -= 40; }
      if (e.id === 'DR-09' && r() < 0.4) { const live = [0, 1, 2, 3, 4, 5].filter((i) => alive[i]); if (live.length) fall(live[Math.floor(r() * live.length)], year, null, null); }
      if (e.id === 'DR-10') { const live = alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0); if (live.length) fall(live[Math.floor(r() * live.length)], year, null, null); }
    }
    // endings
    if (dfc >= 9 && S.F > 70 && r() < 0.03) { fire('END-12', year, '⭐'); ended = ['END-12', year]; }
    else if (era() === 4 && r() < 0.01) { fire('END-11', year, '⭐'); ended = ['END-11', year]; }
    else if (dfc >= 15) { fire('END-10', year, '⭐'); ended = ['END-10', year]; }
  }
  return { fired, log, dfc, ended, eraStart, alive };
}

// ---------- convergence windows ----------
export function cvWindows(w, cv, p = P) {
  const out = [];
  const endY = w.ended ? w.ended[1] : START + HORIZON;
  if (cv.id === 'cv.16') { if (w.eraStart[3]) out.push([w.eraStart[3], endY]); return out; }
  if (cv.id === 'cv.13') { for (const [y, id] of w.log) if (id === 'DR-15') out.push([y, y + 1]); return out; }
  if (cv.id === 'cv.4') { out.push([START - 12, START + 100]); }
  for (const t of cv.trig) for (const y of w.fired.get(t) || []) out.push([y, y + p.windowYears]);
  return out;
}
const STAGE = { b: [0, 12], t: [13, 19], a: [20, 54], e: [55, 99] };
function lifeSeesCv(race, birth, L, cv, w, p = P) {
  const k = L / 75;
  const stages = cv.all ? ['b', 't', 'a', 'e'] : [...new Set(cv.entry.filter((n) => n.startsWith(race.code + '.')).map((n) => n[3]))];
  if (!stages.length) return null; // race has no entry
  const wins = cvWindows(w, cv, p);
  for (const s of cv.elderOnly ? ['e'] : stages) {
    const [a, b] = STAGE[s];
    const lo = birth + a * k, hi = Math.min(birth + b * k, birth + L);
    if (wins.some(([x, y]) => x <= hi && y >= lo)) return true;
  }
  return false;
}

// ---------- main ----------
export function study(n = WORLDS, opt = {}) {
  const res = { fresh: new Map(), dragon: DRAGONS.map(() => []), first: {}, n, ev: new Map(), arc: [], era: [[], [], []], end: {}, dfc: [], counts: { '⭐': [], '●': [], '○': [] }, cvOpen: new Map(), cvRace: new Map(), noCv: new Map(), falls: new Map(), unreached: 0 };
  for (let s = 1; s <= n; s++) {
    const w = runWorld(s * 7919, opt);
    for (const [id, ys] of w.fired) { if (!id.startsWith('_')) res.ev.set(id, (res.ev.get(id) || 0) + 1); }
    const end = w.ended ? w.ended[1] : null;
    if (end) { res.arc.push(end - START); res.end[w.ended[0]] = (res.end[w.ended[0]] || 0) + 1; } else res.unreached++;
    for (let k = 1; k < 4; k++) if (w.eraStart[k]) res.era[k - 1].push(w.eraStart[k] - START);
    res.dfc.push(w.dfc);
    DRAGONS.forEach((d, i) => { const f = w.fired.get('_fall_' + i); if (f) res.dragon[i].push(f[0] - START); });
    { let best = null; DRAGONS.forEach((d, i) => { const f = w.fired.get('_fall_' + i); if (f && (best === null || f[0] < best[1])) best = [i, f[0]]; }); if (best) res.first[DRAGONS[best[0]][0]] = (res.first[DRAGONS[best[0]][0]] || 0) + 1; }
    const c = { '⭐': 0, '●': 0, '○': 0 };
    for (const [id, ys] of w.fired) { const e = byId.get(id); if (e && !id.startsWith('_') && id !== 'DR-15') c[e.mk] += ys.length; }
    for (const k of Object.keys(c)) res.counts[k].push(c[k]);
    for (const cv of cvs) { const ws = cvWindows(w, cv, { ...P, ...opt }); if (ws.length) res.cvOpen.set(cv.id, (res.cvOpen.get(cv.id) || 0) + 1); }
    // lives
    const r = rng(s * 104729);
    for (const race of races) {
      const birth = START + r() * 1000;
      const L = race.lo + r() * (race.hi - race.lo);
      let seen = 0, possible = 0;
      for (const cv of cvs) {
        const v = lifeSeesCv(race, birth, L, cv, w, { ...P, ...opt });
        if (v === null) continue;
        possible++;
        if (v) { seen++; const key = race.code + '|' + cv.id; res.cvRace.set(key, (res.cvRace.get(key) || 0) + 1); }
      }
      const a = res.noCv.get(race.code) || { zero: 0, sum: 0, n: 0, possible };
      a.n++; a.sum += seen; if (!seen) a.zero++; a.possible = possible; res.noCv.set(race.code, a);
      // falls seen during life
      const end0 = birth + L;
      let f = 0;
      for (const [id, ys] of w.fired) if (id.startsWith('_fall_')) for (const y of ys) if (y >= birth && y <= end0) f++;
      const b = res.falls.get(race.code) || { sum: 0, n: 0, ev: 0 };
      b.sum += f; b.n++;
      for (const [y, id] of w.log) { if (y < birth || y > end0 || id === 'DR-15') continue; const e = byId.get(id); if (e) b.ev++; }
      res.falls.set(race.code, b);
      // a fresh game: born in the first 20 years of the story (docs: the story starts at ศ.ม. 10,400)
      {
        const b2 = START + r() * 20, e2 = b2 + L, k2 = L / 75;
        const ids = new Set(); let fl = 0, endHit = false;
        for (const [y, id] of w.log) { if (y < b2 || y > e2 || id === 'DR-15') continue; if (byId.get(id)) ids.add(id); }
        for (const [id, ys] of w.fired) if (id.startsWith('_fall_')) for (const y of ys) if (y >= b2 && y <= e2) fl++;
        if (w.ended && w.ended[1] >= b2 && w.ended[1] <= e2) endHit = true;
        let cvSeen = 0;
        for (const cv of cvs) { const v = lifeSeesCv(race, b2, L, cv, w, { ...P, ...opt }); if (v) cvSeen++; }
        const a = res.fresh.get(race.code) || { n: 0, fall: 0, end: 0, cv: 0, noEv: 0, sigs: new Set(), ev: 0 };
        a.n++; if (fl) a.fall++; if (endHit) a.end++; if (cvSeen) a.cv++; if (!ids.size) a.noEv++; a.ev += ids.size; a.sigs.add([...ids].sort().join(','));
        res.fresh.set(race.code, a);
      }
    }
  }
  return res;
}
const q = (a, f) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(f * s.length))]); };

if (process.argv[1] && process.argv[1].endsWith('sim-world.mjs')) {
  const strict = process.argv.includes('--strict');
  const t0 = Date.now();
  const res = study(WORLDS, strict ? { strictCap: true } : {});
  const out = { events: events.length, cvs: cvs.length, races: races.length, worlds: WORLDS, ms: Date.now() - t0 };
  console.log(JSON.stringify(out));
  console.log('arc years (end of world) p10/p50/p90:', q(res.arc, 0.1), q(res.arc, 0.5), q(res.arc, 0.9), 'unreached within horizon:', res.unreached);
  console.log('era2/3/4 start p10/p50/p90:', res.era.map((a) => [q(a, 0.1), q(a, 0.5), q(a, 0.9), a.length].join('/')).join('  '));
  console.log('endings:', res.end);
  console.log('first dragon to fall:', Object.entries(res.first).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round((100 * v) / WORLDS) + '%').join(' · '));
  console.log('dragon falls (share of worlds, median year):', DRAGONS.map((d, i) => d[0] + ' ' + Math.round((100 * res.dragon[i].length) / WORLDS) + '%/' + q(res.dragon[i], 0.5)).join(' · '));
  console.log('counts per world (median):', Object.fromEntries(Object.entries(res.counts).map(([k, a]) => [k, q(a, 0.5)])));
  const never = events.filter((e) => !(res.ev.get(e.id) > 0)).map((e) => e.id);
  const rare = events.filter((e) => res.ev.get(e.id) > 0 && res.ev.get(e.id) / WORLDS < 0.05).map((e) => e.id + ':' + Math.round((100 * res.ev.get(e.id)) / WORLDS) + '%');
  if (process.argv.includes('--md')) {
    console.log('\n<<TABLE-LIVES>>');
    console.log('| เผ่า | มังกรล้มที่เห็น | เหตุการณ์โลกที่เกิดในช่วงชีวิต | จุดบรรจบที่เจอ (จากที่เข้าได้) | ไม่เจอจุดบรรจบเลย |\n| --- | --- | --- | --- | --- |');
    for (const race of races) { const a = res.noCv.get(race.code), f = res.falls.get(race.code); console.log(`| ${race.name} | ${(f.sum / f.n).toFixed(1)} | ${(f.ev / f.n).toFixed(0)} | ${(a.sum / a.n).toFixed(2)} (${a.possible}) | ${Math.round((100 * a.zero) / a.n)}% |`); }
    console.log('<<TABLE-FRESH>>');
    console.log('| เผ่า | เห็นมังกรล้มในชีวิต | โลกจบในชีวิต | เหตุการณ์โลกต่อชีวิต | ชีวิตที่ไม่มีเหตุการณ์โลกเลย | ชุดเหตุการณ์ไม่ซ้ำกัน |\n| --- | --- | --- | --- | --- | --- |');
    for (const race of races) { const a = res.fresh.get(race.code); console.log(`| ${race.name} | ${Math.round((100 * a.fall) / a.n)}% | ${Math.round((100 * a.end) / a.n)}% | ${(a.ev / a.n).toFixed(1)} | ${Math.round((100 * a.noEv) / a.n)}% | ${Math.round((100 * a.sigs.size) / a.n)}% |`); }
    console.log('<<END>>');
  }
  const why = (e) => `${e.id}[${e.mk}] era${e.gate.join('-')} pre(${e.prereq.join(',')||'-'}) thr(${e.thr.map((t)=>t.join('')).join(',')||'-'}) fired ${Math.round(100*(res.ev.get(e.id)||0)/WORLDS)}% :: ${e.cond.slice(0,70)}`;
  if (process.argv.includes('--why')) for (const e of events.filter((x) => !(res.ev.get(x.id) > 0) || res.ev.get(x.id) / WORLDS < 0.05)) console.log(why(e));
  console.log('never fired:', never.length, never.join(' '));
  console.log('rare (<5%):', rare.length, rare.join(' '));
  if (process.argv.includes('--cv')) for (const c of cvs) console.log(c.id, c.name, '| trig', c.trig.join(','), '| entry races', [...new Set(c.entry.map((n) => n.slice(0, 2)))].join(','));
  console.log('cv open share:', cvs.map((c) => c.id + '=' + Math.round((100 * (res.cvOpen.get(c.id) || 0)) / WORLDS) + '%').join(' '));
  console.log('fresh game (born ศ.ม. 10,400–10,420) per race: [sees a dragon fall / world ends in life / meets a cv / no world event / events per life / distinct event sets per 100 lives]');
  for (const race of races) { const a = res.fresh.get(race.code); console.log('fresh', race.code, race.name, Math.round((100 * a.fall) / a.n) + '% fall', Math.round((100 * a.end) / a.n) + '% end', Math.round((100 * a.cv) / a.n) + '% cv', Math.round((100 * a.noEv) / a.n) + '% none', (a.ev / a.n).toFixed(1), 'ev', Math.round((100 * a.sigs.size) / a.n) + ' distinct/100'); }
  for (const race of races) {
    const a = res.noCv.get(race.code), f = res.falls.get(race.code);
    console.log(race.code, race.name, 'cv per life', (a.sum / a.n).toFixed(2), 'of', a.possible, 'zero-cv', Math.round((100 * a.zero) / a.n) + '%', 'falls seen', (f.sum / f.n).toFixed(1), 'world events in life', (f.ev / f.n).toFixed(0));
  }
}
