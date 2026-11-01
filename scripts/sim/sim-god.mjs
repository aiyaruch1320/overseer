// God-system balance at doc level (docs/systems/god/06-implementation.md section 4).
// Life part: one character's life-years with the god's light (faith), dread and the character's belief, under each policy.
// World part: the same policies acting on sim-world's dragons and events through its god hook, one lineage of lives per world.
// Numbers follow docs/systems/god/01-power.md, 02-bestow.md, 03-dreams.md, 04-miracles.md; assumptions are marked "assumed".
// Usage: node scripts/sim/sim-god.mjs [lives=20000] [worlds=600] [--write]   (--write puts the tables into 06-implementation.md section 4)
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';
import { runWorld, races, drawLife, DRAGONS, PAIRS } from './sim-world.mjs';

const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const LIVES = nums[0] || 20000, WORLDS = nums[1] || 600;
const HORIZON = 1800, START = 10400;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 0.7071; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pickW = (r, w) => { let x = r() * w.reduce((a, b) => a + b, 0), k = 0; while (x > w[k]) { x -= w[k]; k++; } return k; };

// ---------- prices and rules (01-power.md sections 1 to 4, 02-bestow.md section 3, 03-dreams.md) ----------
const TIER_W = [100, 38, 11, 2.6, 0.5];
const PRICE = { bless: [10, 16, 26, 40, 60], curse: [6, 12, 20, 30, 45], skill: [10, 16, 26, 40], item: [8, 14, 24, 40], holyW: [12, 20, 34, 55], cursedW: [9, 15, 26, 42] };
const DREAM = [10, 14], WHISPER = 6.5; // 5 or 8 by hint
const START_POWER = { faith: 30, dread: 10 };
// rules this sim tuned (values as written in the docs); GOD_RULE='{"ruinCd":300}' overrides them for a trial run
// dreamStep: each dream already sent this life adds this much to the next (03-dreams.md section 3)
// anchorCd · anchorWorldCd: years between strikes on one seal anchor · on any anchor (04-miracles.md section 5.4)
// ruinLife · ruinCd: ruin-making miracles per life · years between two in one world (04-miracles.md section 2 rule 5)
// mahaF · wrathD: light that MR-21 needs · dread that MR-22 needs (04-miracles.md section 3)
// dragonCd: years before MR-23 or MR-24 can reach the same dragon again (04-miracles.md section 3)
const RULE = { dreamStep: 1, anchorCd: 100, anchorWorldCd: 25, ruinLife: 1, ruinCd: 100, dragonCd: 50, mahaF: 120, wrathD: 150, ...JSON.parse(process.env.GOD_RULE || '{}') };
// assumed: the god layer only sees these from the rest of the game
const NODES = 32; // storyline nodes per full life (sim-life.mjs, about 31 to 33 for every race)
const WINDOW_SHARE = 123 / 745; // god-window rows among storyline node rows
const AGE_STOPS = [5, 15, 30, 50, 70];
const EARLY_DEATH = 0.004; // per life-year from age 15 (war, illness, accident); natural death at life-year 75
const TROUBLE = 0.2; // share of prayer ticks with trouble nearby (prayers ×3, game.ts prayerTick)

function chest(r, g, kind, window, lifeOf) {
  // returns the options a chest shows: [cost, beliefDelta, pays, isWeapon]
  const tier = (max, boostHigh) => pickW(r, TIER_W.slice(0, max + 1).map((w, i) => (boostHigh && i >= 2 ? w * 1.3 : w)));
  const out = [];
  if (kind !== 'curse') {
    const lOk = g.belief >= 50 || window;
    for (let k = 0; k < 2; k++) { const t = tier(lOk ? 4 : 3, g.belief >= 50); out.push([PRICE.bless[t], 5 + 3 * t, 'faith', false]); }
    const ts = tier(3); out.push([PRICE.skill[ts], 5 + 3 * ts, 'faith', false]);
    if (!lifeOf.weapon) { const t = tier(3); out.push([PRICE.holyW[t], 10, 'faith', true]); }
    else if (lifeOf.items < 3) { const t = tier(3); out.push([PRICE.item[t], 5 + 3 * t, 'faith', false]); }
  }
  if (kind !== 'bless') {
    const lOk = g.belief <= -30 || window;
    for (let k = 0; k < 2; k++) { const t = tier(lOk ? 4 : 3, g.belief <= -30); out.push([PRICE.curse[t], -(4 + 3 * t), 'dread', false]); }
    if (!lifeOf.weapon && kind === 'curse') { const t = tier(3); out.push([PRICE.cursedW[t], -5, 'dread', true]); }
  }
  return out;
}

// ---------- one life ----------
// policies: silent · merciful · punish · random · grant (answers prayers only, the rest goes to the world) · smite (punishes prayers only)
function life(policy, r, carry = {}) {
  const g = { faith: carry.faith ?? START_POWER.faith, dread: carry.dread ?? START_POWER.dread, belief: carry.belief ?? 0 };
  const piety = gauss(r) * 25, B = 10 + r() * 60, intel = 10 + gauss(r) * 3, oracle = r() < 0.05;
  let death = 75;
  for (let a = 15; a < 75; a++) if (r() < EARLY_DEATH) { death = a; break; }
  const nodeAges = Array.from({ length: NODES }, () => 3 + r() * 72).filter((a) => a < death).sort((a, b) => a - b);
  const s = { full: null, fullD: null, gifts: 0, decisions: 0, inter: 0, obeyed: 0, dreams: 0, bestows: 0, fSpent: 0, dSpent: 0, minB: g.belief, maxB: g.belief, prayers: 0, burdenEv: 0, gainF: 0, gainD: 0, prayF: 0, curse: false, weapon: false, items: 0 };
  let burden = 0, quiet = 0, willFails = 0, punishedAt = -99, lastLine = null, switches = 0;
  const pending = [];
  const costF = (c, win) => c * (g.belief < -30 ? 1.5 : 1) * (win ? 0.7 : 1);
  const costD = (c, win) => c * (g.belief > 60 ? 1.2 : 1) * (win ? 0.7 : 1);
  const bel = (d) => { g.belief = clamp(g.belief + d, -100, 100); s.minB = Math.min(s.minB, g.belief); s.maxB = Math.max(s.maxB, g.belief); };
  const pay = (line, c, year) => {
    if (line === 'faith') { g.faith -= c; s.fSpent += c; } else { g.dread -= c; s.dSpent += c; }
    if (lastLine && lastLine[0] !== line && year - lastLine[1] < 1 && switches < 25) { bel(-4); switches += 4; }
    lastLine = [line, year];
  };
  const act = (prayer = false) => { s.decisions++; quiet = 0; if (!prayer) s.inter++; };

  const openChest = (year, win, kind, pickRandom) => {
    const opts = chest(r, g, kind, win, s).map(([c, d, line, w]) => [line === 'faith' ? costF(c, win) : costD(c, win), d, line, w]).filter(([c, , line]) => (line === 'faith' ? g.faith : g.dread) >= c);
    if (!opts.length) return;
    const o = pickRandom ? opts[Math.floor(r() * opts.length)] : opts.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    pay(o[2], o[0], year); bel(o[1]); s.bestows++; if (o[2] === 'faith') s.gifts++; if (o[3]) s.weapon = true; else if (o[2] === 'faith' && o[1] > 0 && s.items < 3 && r() < 0.25) s.items++;
    if (o[2] === 'dread') { s.curse = true; punishedAt = year; }
    act();
  };
  const sendDream = (year, win, pickRandom) => {
    const c = costF(DREAM[s.dreamsYear ? 1 : 0] + RULE.dreamStep * s.dreams, win);
    if (g.faith < c || s.dreamsYear >= 2) return;
    const opts = [r() < 0.5 ? 0.15 : 0.05, r() < 0.25 ? -0.3 : -0.2, 0];
    const k = pickRandom ? Math.floor(r() * 3) : 0;
    const clar = (intel - 10) * 0.02 + (oracle ? 0.1 : 0) + (year - punishedAt < 5 ? -0.1 : 0);
    let p = clamp(0.3 + g.belief / 140 + opts[k] + clar, 0.05, 0.95);
    const willing = p >= 0.7;
    if (willing && willFails >= 2) p = Math.min(0.95, p + 0.15);
    pay('faith', c, year); s.dreams++; s.dreamsYear++; act();
    if (r() < p) {
      s.obeyed++; bel(3); if (willing) willFails = 0;
      if (opts[k] < 0 && ++burden >= 3) {
        burden = 0; s.burdenEv++;
        const x = r();
        if (x < 1 / 3) { if (policy === 'merciful' && g.faith >= 15) { pay('faith', 15, year); bel(12); s.decisions++; } else bel(-8); }
      }
    } else {
      if (willing) willFails++;
      if (g.belief >= 0 && r() < 0.5) bel(1); else bel(-2);
    }
  };
  const whisper = (year, win) => {
    const c = costF(WHISPER, win);
    if (g.faith < c || s.whYear >= 3) return;
    pay('faith', c, year); s.whYear++; act();
  };

  for (let year = 0; year < death; year++) {
    s.dreamsYear = 0; s.whYear = 0; s.chestYear = 0;
    // income per life-year (01-power.md section 1)
    const inF = 1 + B / 25 + Math.max(0, g.belief) / 30, inD = 0.3 + Math.max(0, -g.belief) / 75;
    g.faith = Math.min(200, g.faith + inF); g.dread = Math.min(200, g.dread + inD); s.gainF += inF; s.gainD += inD;
    if (g.faith >= RULE.mahaF && s.full === null) s.full = year; // MR-21
    if (g.dread >= RULE.wrathD && s.fullD === null) s.fullD = year; // MR-22
    // prayers: four ticks a year, two at a time, expire after 14 ticks (game.ts prayerTick)
    for (let t = 0; t < 4; t++) {
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].exp <= year * 4 + t) { pending.splice(i, 1); bel(-2); }
      if (pending.length >= 2 || g.belief < -70) continue;
      const p = (0.035 + Math.max(0, piety) / 2500 + (oracle ? 0.02 : 0)) * (r() < TROUBLE ? 3 : 1);
      if (r() >= p) continue;
      s.prayers++;
      const cost = 8 + Math.floor(r() * 18), devout = piety > 30;
      let ans = { silent: 'none', merciful: 'grant', giver: 'grant', saver: 'grant', grant: 'grant', punish: 'punish', smite: 'punish', random: ['grant', 'deny', 'punish', 'none'][Math.floor(r() * 4)] }[policy];
      if (ans === 'grant' && g.faith < costF(cost)) ans = 'none';
      if (ans === 'none') { pending.push({ exp: year * 4 + t + 14 }); continue; }
      act(true);
      if (ans === 'grant') { const c = costF(cost); pay('faith', c, year); s.prayF += c; g.faith = Math.min(200, g.faith + 2); s.gainF += 2; bel(8 * (devout ? 1.5 : 1)); }
      else if (ans === 'deny') bel(devout ? -1 : -3);
      else { const d = 6 + Math.floor(r() * 5); g.dread = Math.min(200, g.dread + d); s.gainD += d; bel(-12); punishedAt = year; }
    }
    // moments this year: storyline nodes (some are god windows) and age stops
    const moments = nodeAges.filter((a) => a >= year && a < year + 1).map(() => r() < WINDOW_SHARE);
    if (AGE_STOPS.includes(year)) moments.push(true);
    for (const win of moments) {
      if (policy === 'merciful') {
        // spends down to a reserve of 20 kept for prayers
        if (g.faith >= 20 + DREAM[0] + RULE.dreamStep * s.dreams) sendDream(year, win, false);
        if (win && s.chestYear < 2 && g.faith >= 40) { openChest(year, win, 'bless', false); s.chestYear++; }
        if (g.faith >= 30) whisper(year, win);
      } else if (policy === 'giver') {
        if (s.chestYear < 2 && g.faith >= 40) { openChest(year, win, 'bless', false); s.chestYear++; }
      } else if (policy === 'punish') {
        if (win && s.chestYear < 2) { openChest(year, win, 'curse', false); s.chestYear++; }
      } else if (policy === 'random' && r() < 0.5) {
        const x = Math.floor(r() * 3);
        if (x === 0) sendDream(year, win, true);
        else if (x === 1) whisper(year, win);
        else if (s.chestYear < 2) { openChest(year, win, 'any', true); s.chestYear++; }
      }
    }
    // the yearly chest outside windows
    if (policy === 'merciful' && s.chestYear < 1 && g.faith >= 40) openChest(year, false, 'bless', false);
    if (policy === 'punish' && s.chestYear < 1 && g.dread >= 20) openChest(year, false, 'curse', false);
    // feelings fade after ten quiet life-years (01-power.md section 3)
    if (++quiet > 10) g.belief = g.belief > 0 ? Math.max(0, g.belief - 2) : Math.min(0, g.belief + 2);
  }
  return { ...s, death, end: { ...g }, belief: g.belief };
}

// ---------- life part ----------
const POL = { silent: 'เงียบ', merciful: 'เมตตา', giver: 'ให้ของ', saver: 'เก็บพลัง', punish: 'ลงโทษ', random: 'สุ่ม' };
const LIFE = {};
for (const pol of [...Object.keys(POL), 'grant', 'smite']) {
  const r = rng(pol.length * 7919 + 17), rows = [];
  for (let i = 0; i < LIVES; i++) rows.push(life(pol, r));
  LIFE[pol] = rows;
}
const mean = (a, f) => a.reduce((x, y) => x + f(y), 0) / a.length;
const share = (a, f) => a.filter(f).length / a.length;
const pct = (x) => (x < 0.01 && x > 0 ? (100 * x).toFixed(2) : (100 * x).toFixed(1)) + '%';
const qt = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const gv19 = (x) => x.belief <= -70 && x.death >= 55;
const title = (x) => {
  const t = [];
  if (x.fSpent >= 3 * x.dSpent && x.fSpent > 0 && x.belief >= 50) t.push('light');
  if (x.fSpent + x.dSpent < 60 && x.death >= 55) t.push('quiet');
  if (x.dSpent >= x.fSpent && x.dSpent > 0 && x.belief >= 0) t.push('judge');
  if (x.belief <= -70) t.push('hated');
  return t;
};
// income left for the world once the life part has answered prayers (per life-year)
const perYear = (rows, f) => mean(rows, f) / mean(rows, (x) => x.death);
const WORLD_INCOME = {
  faith: perYear(LIFE.grant, (x) => x.gainF - x.prayF),
  dread: perYear(LIFE.smite, (x) => x.gainD),
};

// ---------- world part ----------
const LARGE_CD = 25, MID_CD = 5;
const FALL_ID = DRAGONS.map((d) => d[1]);
const STAR = (i) => FALL_ID[i].startsWith('END') || ['DR-01', 'DR-04', 'DR-05', 'DR-07'].includes(FALL_ID[i]); // as sim-world grades the fall

function world(policy, seed) {
  const r = rng(seed ^ 0x5bd1e995);
  const race = races[Math.floor(r() * races.length)];
  let lifeEnd = START, wpl = 1, used = null;
  const g = { faith: START_POWER.faith, dread: START_POWER.dread };
  const st = { ruins: [], largeDestroy: 0, strikes: 0, taunts: 0, soothes: 0, fates: 0, maha: 0, protect: new Map(), anchorAt: new Map(), dragonAt: new Map(), lastLarge: -1e9, lastMid: -1e9, lastAnchor: -1e9, lastRuin: -1e9, fate: new Map(), lives: 0 };
  const newLife = (year) => {
    const L = drawLife(race, r);
    wpl = L.at(75) / 75; lifeEnd = year + L.at(75); st.lives++;
    used = { mid: 0, large: 0, maha: 0, ruin: 0 };
    if (st.lives > 1) { g.faith *= 0.5; g.dread *= 0.5; }
  };
  newLife(START);
  const godW = (id, year) => {
    let w = 1;
    const f = st.fate.get(id);
    if (f && year < f[1]) w *= f[0];
    if (id === 'GD-08') w *= 1.5 ** Math.max(0, st.largeDestroy - 2) * (st.maha ? 2 : 1);
    return w;
  };
  const hook = (ctx) => {
    const { year, mood, alive, capDrop, S } = ctx;
    while (year >= lifeEnd) newLife(lifeEnd);
    const ly = 10 / wpl; // life-years in this decade
    const cults = st.ruins.filter((y) => year - y >= 5 && year - y < 60).length; // RU-04 until RU-07 rebuilds the city
    g.faith = Math.min(200, g.faith + WORLD_INCOME.faith * ly);
    g.dread = Math.min(200, g.dread + (WORLD_INCOME.dread + (g.dread >= 60 ? 0.5 * cults : 0)) * ly);
    const live = alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    const free = (m, k, cd) => year - (m.get(k) ?? -1e9) >= cd;
    const strike = (i, large) => {
      const cost = large ? 55 : 35;
      if (g.dread < cost || (large ? used.large >= 2 || year - st.lastLarge < LARGE_CD : used.mid >= 4 || year - st.lastMid < MID_CD)) return false;
      if (!free(st.anchorAt, i, RULE.anchorCd) || year - st.lastAnchor < RULE.anchorWorldCd || (st.protect.get(i) ?? -1e9) > year) return false;
      g.dread -= cost; g.dread = Math.min(200, g.dread + (large ? 20 : cost / 3));
      if (large) { used.large++; st.lastLarge = year; st.largeDestroy += 2; capDrop[i] += 5; mood[i] -= 20; } else { used.mid++; st.lastMid = year; mood[i] -= 10; }
      st.anchorAt.set(i, year); st.lastAnchor = year; st.strikes++;
      if (mood[i] >= 50) st.protect.set(i, year + 50);
      else if (mood[i] >= 25) { const q = PAIRS.find((c) => c.includes(i)); const j = q && q.find((x) => x !== i); if (j !== undefined && alive[j]) mood[j] -= 5; }
      else if (i >= 6) st.fate.set('PL-0' + (i - 5), [3, year + 10]);
      return true;
    };
    const ruin = () => {
      if (g.dread < 60 || used.large >= 2 || used.ruin >= RULE.ruinLife || year - st.lastLarge < LARGE_CD || year - st.lastRuin < RULE.ruinCd) return false;
      g.dread -= 60; g.dread = Math.min(200, g.dread + 20);
      used.large++; used.ruin++; st.lastLarge = year; st.lastRuin = year; st.largeDestroy++; st.ruins.push(year);
      if (live.length) mood[live[Math.floor(r() * live.length)]] -= 2; // the dragon of that continent feels it
      return true;
    };
    const fateFall = (sign) => { // a dragon close to falling shows an omen; slow it (faith) or speed it (dread)
      const i = live.filter((k) => mood[k] < 10 && !(st.fate.get(FALL_ID[k])?.[1] > year))[0];
      if (i === undefined) return false;
      const base = STAR(i) ? 60 : 30, mult = sign < 0 ? 0.5 : 3, cost = Math.max(base / 2, Math.ceil(base * Math.abs(1 - mult)));
      const line = sign < 0 ? 'faith' : 'dread';
      if (g[line] < cost) return false;
      g[line] -= cost; st.fates++;
      st.fate.set(FALL_ID[i], [mult, year + 10]);
      return true;
    };
    if (policy === 'merciful') {
      fateFall(-1);
      const low = live.filter((i) => free(st.dragonAt, i, RULE.dragonCd)).sort((a, b) => mood[a] - mood[b])[0];
      if (low !== undefined && g.faith >= 40 && mood[low] < 60) { g.faith -= 40; mood[low] = Math.min(100 - 3 * ctx.dfc - capDrop[low], mood[low] + 10); st.dragonAt.set(low, year); st.soothes++; }
      if (!used.maha && g.faith >= RULE.mahaF) { g.faith = 0; used.maha = 1; S.F = Math.min(100, S.F + 30); } // MR-21
    } else if (policy === 'punish') {
      ruin();
    } else if (policy === 'seal') {
      const t = live.filter((i) => free(st.anchorAt, i, RULE.anchorCd)).sort(() => r() - 0.5)[0];
      if (t !== undefined && !strike(t, true)) strike(t, false);
    } else if (policy === 'hasten') {
      fateFall(1);
      const t = live.filter((i) => free(st.anchorAt, i, RULE.anchorCd)).sort((a, b) => mood[a] - mood[b])[0];
      if (t !== undefined && !strike(t, true)) strike(t, false);
      const d = live.filter((i) => free(st.dragonAt, i, RULE.dragonCd)).sort((a, b) => mood[a] - mood[b])[0];
      if (d !== undefined && g.dread >= 40) { g.dread -= 40 - 40 / 3; mood[d] -= 10; st.dragonAt.set(d, year); st.taunts++; }
      for (const id of ['WR-15', 'MC-12', 'WR-23']) if (!ctx.fired.has(id) && !st.fate.has(id) && ctx.era === 4 && g.dread >= 120) { g.dread -= 120; st.fate.set(id, [3, year + 10]); st.fates++; }
    } else if (policy === 'random' && r() < 0.3) {
      const x = Math.floor(r() * 4);
      if (x === 0) ruin(); else if (x === 1 && live.length) strike(live[Math.floor(r() * live.length)], r() < 0.5); else if (x === 2) fateFall(r() < 0.5 ? -1 : 1);
    }
  };
  const godOpen = (id) => id === 'GD-08' && st.largeDestroy >= 3; // iron rule 7: the third large destruction wakes the other gods
  const w = runWorld(seed, policy === 'silent' ? {} : { god: hook, godW, godOpen });
  return { w, st };
}

const WPOL = { silent: 'เงียบ', merciful: 'เมตตา', punish: 'ลงโทษ (ทำซาก)', seal: 'ลงโทษ (ตีหมุดผนึก)', hasten: 'เร่งจบ', random: 'สุ่ม' };
const WORLD = {};
for (const pol of Object.keys(WPOL)) {
  const rows = [];
  for (let s = 1; s <= WORLDS; s++) rows.push(world(pol, s * 7919));
  WORLD[pol] = rows;
}

// ---------- report ----------
const out = [];
out.push(`**ส่วนชีวิต** ${LIVES.toLocaleString('en-US')} ชีวิตต่อนโยบาย ชีวิตแรกของสายตระกูล (แสงศรัทธา 30 ความหวาดกลัว 10 ศรัทธาเทพ 0)`, '');
out.push('| นโยบาย | ตัดสินใจต่อชีวิต (p10 · p50 · p90) | ความฝันที่ส่ง · ทำตาม | ประทาน | คำอธิษฐาน | ศรัทธาเทพตอนตาย (p50) | ศรัทธาเทพ ≤ −70 ตอนตาย | เคยถึง ≥ 85 | ของขวัญครบ 10 · 15 (ไม่นับคำสาป) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [k, name] of Object.entries(POL)) {
  const a = LIFE[k], d = a.map((x) => x.decisions);
  out.push(`| ${name} | ${qt(d, 0.1)} · ${qt(d, 0.5)} · ${qt(d, 0.9)} | ${mean(a, (x) => x.dreams).toFixed(1)} · ${mean(a, (x) => x.obeyed).toFixed(1)} | ${mean(a, (x) => x.bestows).toFixed(1)} | ${mean(a, (x) => x.prayers).toFixed(1)} | ${qt(a.map((x) => x.belief), 0.5).toFixed(0)} | ${pct(share(a, (x) => x.belief <= -70))} | ${pct(share(a, (x) => x.maxB >= 85))} | ${pct(share(a, (x) => x.gifts >= 10))} · ${pct(share(a, (x) => x.gifts >= 15))} |`);
}
out.push('', '**ฉายาของพระเจ้าและคำปฏิญาณที่ระบบพระเจ้าวัดได้เอง** (ร้อยละของชีวิต)', '');
out.push('| นโยบาย | ผู้ให้แสง | ผู้คุ้มครองเงียบ | ผู้พิพากษา | ผู้ถูกชิงชัง | ไม่มีฉายา | GV-11 รู้จักข้า | GV-12 เป็นตัวของเขาเอง | GV-19 ชิงชังข้า |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [k, name] of Object.entries(POL)) {
  const a = LIFE[k], t = a.map(title);
  out.push(`| ${name} | ${pct(share(t, (x) => x.includes('light')))} | ${pct(share(t, (x) => x.includes('quiet')))} | ${pct(share(t, (x) => x.includes('judge')))} | ${pct(share(t, (x) => x.includes('hated')))} | ${pct(share(t, (x) => !x.length))} | ${pct(share(a, (x) => x.maxB >= 85))} | ${pct(share(a, (x) => x.inter <= 5))} | ${pct(share(a, gv19))} |`);
}
const full = (k, f = 'full') => { const a = LIFE[k].filter((x) => x[f] !== null).map((x) => x[f]); return `${pct(a.length / LIFE[k].length)}${a.length ? ` อายุ ${qt(a, 0.5)}` : ''}`; };
out.push('', `แสงศรัทธาถึง ${RULE.mahaF} (ใช้ MR-21 ได้) ร้อยละของชีวิต และอายุ p50 ที่ถึง: เก็บพลัง ${full('saver')} · เมตตา ${full('merciful')} · ให้ของ ${full('giver')} · ความหวาดกลัวถึง ${RULE.wrathD} (MR-22) ลงโทษผู้ขออย่างเดียว ${full('smite', 'fullD')} · ลงโทษ ${full('punish', 'fullD')}`);
out.push('', `รายได้ที่เหลือให้โลกต่อปีชีวิต (หลังตอบคำอธิษฐาน): แสงศรัทธา ${WORLD_INCOME.faith.toFixed(1)} · ความหวาดกลัว ${WORLD_INCOME.dread.toFixed(1)} (ลงโทษผู้ขอทุกใบ)`, '');

const base = WORLD.silent;
const ended = (rows) => share(rows, (x) => x.w.ended);
const eraMed = (rows, k) => { const a = rows.map((x) => x.w.eraStart[k]).filter(Boolean).map((y) => y - START); return a.length ? qt(a, 0.5) : null; };
const gd8 = (rows) => share(rows, (x) => x.w.fired.has('GD-08'));
const together = (ys) => Math.max(0, ...ys.map((y) => ys.filter((z) => z <= y && y - z < 60).length)); // RU-07 rebuilds 40 to 80 years after
out.push(`**ส่วนโลก** ${WORLDS} โลกต่อนโยบาย ${HORIZON} ปีโลก พระเจ้าใช้พลังที่เหลือจากชีวิตกับโลกทั้งหมด สายตระกูลเดียวต่อโลก ทายาทรับพลังครึ่งหนึ่ง`, '');
out.push('| นโยบาย | โลกจบภายใน 1,800 ปี | ฉากจบ | ยุค 2 · 3 · 4 เริ่ม (p50 ปีโลก) | มังกรล้ม (p50) | ซากต่อโลก (p50 · p90 · สูงสุด) | ซากพร้อมกัน (p90) | ตีหมุดผนึก | GD-08 เกิด |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [k, name] of Object.entries(WPOL)) {
  const a = WORLD[k], ru = a.map((x) => x.st.ruins.length);
  const ends = {}; for (const x of a) if (x.w.ended) ends[x.w.ended[0]] = (ends[x.w.ended[0]] || 0) + 1;
  out.push(`| ${name} | ${pct(ended(a))} | ${Object.entries(ends).sort().map(([e, n]) => `${e} ${n}`).join(' · ') || '-'} | ${[1, 2, 3].map((e) => eraMed(a, e) ?? '-').join(' · ')} | ${qt(a.map((x) => x.w.dfc), 0.5)} | ${qt(ru, 0.5)} · ${qt(ru, 0.9)} · ${Math.max(...ru)} | ${qt(a.map((x) => together(x.st.ruins)), 0.9)} | ${mean(a, (x) => x.st.strikes).toFixed(1)} | ${pct(gd8(a))} |`);
}

// targets (06-implementation.md section 4)
const T = [];
const ok = (b) => (b ? 'ผ่าน' : '**ไม่ผ่าน**');
const lowB = (k) => share(LIFE[k], (x) => x.belief <= -70);
T.push(['เงียบและเมตตา ศรัทธาเทพ ≤ −70', 'ไม่เกิน 0.4%', `${pct(lowB('silent'))} · ${pct(lowB('merciful'))}`, ok(lowB('silent') <= 0.004 && lowB('merciful') <= 0.004)]);
T.push(['เร่งจบ ฉากจบภายใน 1,800 ปี', `ไม่เกินสองเท่าของเงียบ (${pct(2 * ended(base))})`, pct(ended(WORLD.hasten)), ok(ended(WORLD.hasten) <= 2 * ended(base))]);
const ru90 = qt(WORLD.punish.map((x) => x.st.ruins.length), 0.9), tog90 = qt(WORLD.punish.map((x) => together(x.st.ruins)), 0.9);
T.push(['ลงโทษ ซากพระเจ้าต่อโลก (p90) · ซากพร้อมกัน (p90)', 'ไม่เกิน 18 (ศตวรรษละหนึ่ง) · ไม่เกิน 2', `${ru90} · ${tog90}`, ok(ru90 <= 18 && tog90 <= 2)]);
const ob = mean(LIFE.merciful, (x) => x.obeyed);
T.push(['เมตตา ความฝันที่ทำตามต่อชีวิต', '3 ถึง 8', ob.toFixed(1), ok(ob >= 3 && ob <= 8)]);
const shift = [1, 2, 3].map((e) => ((eraMed(base, e) ?? HORIZON) - (eraMed(WORLD.seal, e) ?? HORIZON)) / (eraMed(base, e) ?? HORIZON));
T.push(['ตีหมุดผนึก ยุค 2 · 3 · 4 เริ่มเร็วขึ้นเทียบเงียบ', 'ไม่เกิน 15% ต่อยุค', shift.map(pct).join(' · '), ok(Math.max(...shift) <= 0.15)]);
const v11 = share(LIFE.merciful, (x) => x.maxB >= 85), v19 = share(LIFE.punish, gv19), r11 = share(LIFE.random, (x) => x.maxB >= 85), r19 = share(LIFE.random, gv19);
T.push(['คำปฏิญาณ GV-11 · GV-19 เมื่อตั้งใจทำ (เมตตา · ลงโทษ)', '40% ถึง 90%', `${pct(v11)} · ${pct(v19)}`, ok([v11, v19].every((x) => x >= 0.4 && x <= 0.9))]);
T.push(['คำปฏิญาณ GV-11 · GV-19 เมื่อไม่ได้ตั้งใจ (สุ่ม)', 'ไม่เกิน 25%', `${pct(r11)} · ${pct(r19)}`, ok(r11 <= 0.25 && r19 <= 0.25)]);
const dm = qt(LIFE.merciful.map((x) => x.decisions), 0.5);
T.push(['เมตตา ตัดสินใจต่อชีวิต (p50)', '25 ถึง 40', String(dm), ok(dm >= 25 && dm <= 40)]);
out.push('', '**เป้า**', '', '| เป้า | ค่า | ผล | |', '| --- | --- | --- | --- |', ...T.map((x) => `| ${x.join(' | ')} |`));

const md = out.join('\n');
if (process.argv.includes('--write')) {
  const FILE = path.join(root, 'docs/systems/god/06-implementation.md');
  const doc = fs.readFileSync(FILE, 'utf8'), a = '<!-- god-sim:start -->', b = '<!-- god-sim:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + md + '\n' + b + doc.split(b)[1]);
  console.log(`god sim: ${T.filter((x) => x[3] === 'ผ่าน').length}/${T.length} targets pass · written to docs/systems/god/06-implementation.md`);
} else console.log(md);
