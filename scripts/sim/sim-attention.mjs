// How often the game calls the player during one life (docs/systems/experience/07-attention.md).
// Builds the triggers of one life on the life clock, turns them into real seconds at normal speed, then applies the call rules:
// "raw" calls on every trigger (the old rule), "budget" uses the stop gap, card gap, merging and deadlines of 07-attention.md.
// Usage: node scripts/sim/sim-attention.mjs [lives=20000] [--write]   ATTN='{"cardGap":60}' tries other values
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';

const LIVES = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 20000;
// the call rules (07-attention.md section 3), in real seconds at normal speed
const RULE = { stopGap: 180, merge: 60, cardGap: 60, stopWait: 60, ...JSON.parse(process.env.ATTN || '{}') };
const LIFE_MIN = 35; // a full life at normal speed (experience/01-one-life.md: 25 to 45 minutes)
const SEC = (LIFE_MIN * 60) / 75; // real seconds per life-year
// trigger rates (07-attention.md section 2 says where each comes from; crisis is still assumed)
const RATE = {
  window: 32 * (123 / 745), // storyline nodes per life × share of god-window rows
  prayer: 4 * (0.8 * 0.035 + 0.2 * 0.105), // per life-year: four ticks, trouble 20% of ticks (game.ts prayerTick)
  omen: 3.2, // ⭐ ● world events that touch the character's continent in a human life, birth years spread over the horizon (sim-world)
  majorOmen: 0.06, // ⭐ events whose home is the character's own continent (world-wide ones are ordinary omen cards)
  battle: 3, // battle beats in the storyline paths a life takes (sim-life samples: elf 1.2 dwarf 0.9 beastfolk 1.9 human 3.1 orc 4.6)
  crisis: 1.5, // stage-3 companion crises and bondage escapes per life (assumed: the bonds docs give no rate)
};
const DEADLINE = { prayer: 14 / 4, omen: 2, battle: 1, crisis: 1, majorOmen: 1 }; // life-years a call can wait before it is moot

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const poissonTimes = (r, n, lo, hi) => { const out = []; let k = 0; const L = Math.exp(-n); let p = 1; do { k++; p *= r(); } while (p > L); for (let i = 0; i < k - 1; i++) out.push(lo + r() * (hi - lo)); return out; };

function triggers(r) {
  let death = 75;
  for (let a = 15; a < 75; a++) if (r() < 0.004) { death = a; break; }
  const t = [];
  for (const a of [5, 15, 30, 50, 70]) if (a < death) t.push({ y: a, kind: 'age', stop: true });
  for (const y of poissonTimes(r, RATE.window, 3, 75)) t.push({ y, kind: 'window', stop: true });
  for (const y of poissonTimes(r, RATE.majorOmen, 5, 75)) t.push({ y, kind: 'majorOmen', stop: true });
  for (const y of poissonTimes(r, RATE.prayer * 75, 4, 75)) t.push({ y, kind: 'prayer' });
  for (const y of poissonTimes(r, RATE.omen, 0, 75)) t.push({ y, kind: 'omen' });
  for (const y of poissonTimes(r, RATE.battle, 15, 60)) t.push({ y, kind: 'battle' });
  for (const y of poissonTimes(r, RATE.crisis, 15, 70)) t.push({ y, kind: 'crisis' });
  const live = t.filter((x) => x.y < death);
  live.push({ y: death, kind: 'death', stop: true });
  return { death, list: live.sort((a, b) => a.y - b.y) };
}

// raw: every trigger calls at once; stops for age, window, major omen and death
function raw(tr) {
  return tr.list.map((x) => ({ s: x.y * SEC, stop: !!x.stop, kind: x.kind }));
}

// budget: 07-attention.md section 3
function budget(tr, R = RULE) {
  const calls = [];
  let lastStop = -1e9, lastCard = -1e9;
  const queue = [];
  let lost = 0, folded = 0;
  const flushInto = (s) => { folded += queue.length; queue.length = 0; return s; }; // a stop shows every waiting card on its own panel
  const events = tr.list.map((x) => ({ ...x, s: x.y * SEC }));
  // age stops and death always stop. A window or major omen up to one stop gap before an age stop pulls the age stop to it,
  // one up to `merge` after it joins it; either way the two are one stop
  const ages = events.filter((x) => x.kind === 'age');
  for (const e of events) {
    if (!e.stop || e.kind === 'age' || e.kind === 'death') continue;
    const a = ages.find((x) => !x.pulled && x.s - e.s >= 0 && x.s - e.s <= R.stopGap);
    if (a) { a.pulled = true; a.skip = true; e.asAge = a; continue; }
    if (ages.some((x) => e.s - x.s > 0 && e.s - x.s <= R.merge)) e.joined = true;
  }
  let i = 0, waiting = null;
  const death = tr.death * SEC;
  const lastCall = () => Math.max(lastStop, lastCard);
  const step = (now) => { // show waiting cards once the gap allows, the most urgent first
    queue.sort((a, b) => a.s + a.wait - (b.s + b.wait));
    if (waiting || ages.some((x) => !x.skip && x.s >= now && x.s - now < R.cardGap) || (death - now >= 0 && death - now < R.cardGap)) return; // a stop is coming: the cards wait for its panel
    while (queue.length && now - lastCall() >= R.cardGap) {
      const c = queue.shift();
      if (now - c.s > c.wait) { if (c.kind !== 'prayer') lost++; continue; } // moot: the character acted alone, the log tells it
      calls.push({ s: now, stop: false, kind: c.kind }); lastCard = now;
    }
  };
  for (let now = 0; now <= tr.death * SEC + 1; now += 1) {
    while (i < events.length && events[i].s <= now) {
      const e = events[i++];
      if (e.skip) continue; // this age stop already happened with a window
      if (e.kind === 'age' || e.kind === 'death') { calls.push({ s: now, stop: true, kind: e.kind }); lastStop = flushInto(now); continue; }
      if (e.asAge) { if (waiting) waiting.asAge && (waiting.asAge.skip = false); waiting = { ...e, until: now + R.stopWait }; continue; } // stands in for the age stop, waits like a window
      if (e.stop) {
        if (R.windows === false && e.kind === 'window') continue; // this setting never stops for a window
        if (e.joined || (death - now >= 0 && death - now < R.cardGap)) continue; // joins the age stop, or glows before the death scene
        if (ages.some((x) => !x.skip && x.s > now && x.s - now < R.stopGap)) continue; // an age stop is near: the window glows and the age stop shows it
        if (now - lastStop >= R.stopGap && !waiting) { waiting = { ...e, until: now + R.stopWait }; continue; } // the node holds until the last call is a card gap old
        if (e.kind === 'majorOmen') queue.push({ s: now, kind: e.kind, wait: DEADLINE.majorOmen * SEC });
        continue; // a window inside the gap glows on the life line; the player can still open it, the game does not stop
      }
      if (R.cards && !R.cards.includes(e.kind)) continue; // this setting leaves the kind to the log
      if (e.kind === 'prayer' && queue.filter((q) => q.kind === 'prayer').length >= 2) continue; // two prayers wait at most (game.ts)
      queue.push({ s: now, kind: e.kind, wait: DEADLINE[e.kind] * SEC });
    }
    if (waiting && now - lastCall() >= R.cardGap) { calls.push({ s: now, stop: true, kind: waiting.kind }); lastStop = flushInto(now); waiting = null; }
    else if (waiting && now > waiting.until) { if (waiting.asAge) waiting.asAge.skip = false; if (waiting.kind === 'majorOmen') queue.push({ s: now, kind: 'majorOmen', wait: DEADLINE.majorOmen * SEC }); waiting = null; } // too late: the window glows only
    step(now);
  }
  calls.lost = lost; calls.folded = folded;
  return calls;
}

const stat = (lives, f) => {
  const rows = lives.map(f);
  const mean = (g) => rows.reduce((a, x) => a + g(x), 0) / rows.length;
  const qt = (g, q) => { const a = rows.map(g).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
  return { mean, qt, rows };
};
function measure(calls, death) {
  const stops = calls.filter((c) => c.stop).map((c) => c.s), all = calls.map((c) => c.s).sort((a, b) => a - b);
  const gaps = stops.slice(1).map((s, k) => s - stops[k]);
  let burst = 0; // most calls inside any two minutes
  for (let k = 0; k < all.length; k++) { let n = 0; for (let j = k; j < all.length && all[j] - all[k] < 120; j++) n++; burst = Math.max(burst, n); }
  const edges = [0, ...all, death * SEC];
  const quiet = Math.max(...edges.slice(1).map((s, k) => s - edges[k]));
  const minutes = (death * SEC) / 60;
  return { stops: stops.length, cards: calls.length - stops.length, minGap: gaps.length ? Math.min(...gaps) : null, burst, quiet, perMin: calls.length / Math.max(1, minutes), minutes };
}

const r = rng(20261101);
const lives = Array.from({ length: LIVES }, () => triggers(r));
const out = [];
out.push(`**${LIVES.toLocaleString('en-US')} ชีวิต** ชีวิตเต็ม ${LIFE_MIN} นาทีที่ความเร็วปกติ (หนึ่งปีชีวิตราว ${SEC.toFixed(0)} วินาที) กติกา: การหยุดห่างกันอย่างน้อย ${RULE.stopGap} วินาที · หน้าต่างที่อยู่ก่อนจุดหยุดตามอายุไม่เกินช่วงนั้นดึงจุดหยุดมารวม หลังจุดหยุดไม่เกิน ${RULE.merge} วินาทีรวมเข้าไป · การ์ดและหน้าต่างห่างจากการเรียกครั้งก่อนอย่างน้อย ${RULE.cardGap} วินาที (หน้าต่างรอได้ ${RULE.stopWait} วินาที)`, '');
out.push('| กติกา | หยุดเวลา (p50 · p90) | การ์ด (p50 · p90) | เรียกต่อนาที | หยุดสองครั้งห่างกันน้อยสุด (p10 วินาที) | ชีวิตที่มีสองนาทีที่เรียกเกิน 2 ครั้ง | เงียบนานสุด (p50 · p90 นาที) | การ์ดที่ไปรวมในหน้าหยุด | การ์ดที่ไม่ทันขึ้น (ตัวละครทำเอง บันทึกเล่า) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const res = {};
// the player's setting (07-attention.md section 4)
const FEW = { ...RULE, stopGap: 300, cardGap: 120, windows: false, cards: ['prayer', 'crisis', 'majorOmen'] }, MANY = { ...RULE, stopGap: 90, cardGap: 30 };
for (const [name, fn] of [['เรียกทุกครั้ง (เดิม)', raw], ['งบการเรียก', budget], ['ตั้งค่า: น้อย', (tr) => budget(tr, FEW)], ['ตั้งค่า: มาก', (tr) => budget(tr, MANY)]]) {
  const S = stat(lives, (tr) => { const c = fn(tr); return { ...measure(c, tr.death), lost: c.lost || 0, folded: c.folded || 0 }; });
  res[name] = S;
  const p = (g, q) => S.qt(g, q);
  out.push(`| ${name} | ${p((x) => x.stops, 0.5)} · ${p((x) => x.stops, 0.9)} | ${p((x) => x.cards, 0.5)} · ${p((x) => x.cards, 0.9)} | ${S.mean((x) => x.perMin).toFixed(2)} | ${Math.round(p((x) => x.minGap ?? 9999, 0.1))} | ${(100 * S.mean((x) => (x.burst > 2 ? 1 : 0))).toFixed(0)}% | ${(p((x) => x.quiet, 0.5) / 60).toFixed(1)} · ${(p((x) => x.quiet, 0.9) / 60).toFixed(1)} | ${S.mean((x) => x.folded).toFixed(1)} | ${S.mean((x) => x.lost).toFixed(1)} |`);
}
const B = res['งบการเรียก'];
const T = [
  ['หยุดเวลาต่อชีวิตเต็ม (p50)', '6 ถึง 10', B.qt((x) => (x.minutes > 30 ? x.stops : 8), 0.5)],
  ['การ์ดต่อชีวิตเต็ม (p50)', '12 ถึง 22', B.qt((x) => (x.minutes > 30 ? x.cards : 15), 0.5)],
  ['ชีวิตที่มีสองนาทีที่เรียกเกิน 2 ครั้ง', 'ไม่เกิน 10%', B.mean((x) => (x.burst > 2 ? 1 : 0))],
  ['เงียบนานสุด (p90)', 'ไม่เกิน 6 นาที', B.qt((x) => x.quiet, 0.9) / 60],
  ['การ์ดที่ไม่ทันขึ้นต่อชีวิต (เฉลี่ย)', 'ไม่เกิน 3', B.mean((x) => x.lost)],
];
const okT = [T[0][2] >= 6 && T[0][2] <= 10, T[1][2] >= 12 && T[1][2] <= 22, T[2][2] <= 0.1, T[3][2] <= 6, T[4][2] <= 3];
out.push('', '**เป้า** (งบการเรียก)', '', '| เป้า | ค่า | ผล | |', '| --- | --- | --- | --- |');
T.forEach((t, k) => out.push(`| ${t[0]} | ${t[1]} | ${k === 2 ? (100 * t[2]).toFixed(0) + '%' : k >= 3 ? t[2].toFixed(1) : t[2]} | ${okT[k] ? 'ผ่าน' : '**ไม่ผ่าน**'} |`));

const md = out.join('\n');
if (process.argv.includes('--write')) {
  const FILE = path.join(root, 'docs/systems/experience/07-attention.md');
  const doc = fs.readFileSync(FILE, 'utf8'), a = '<!-- attention-sim:start -->', b = '<!-- attention-sim:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + md + '\n' + b + doc.split(b)[1]);
  console.log(`attention sim: ${okT.filter(Boolean).length}/${okT.length} targets pass · written to docs/systems/experience/07-attention.md`);
} else console.log(md);
