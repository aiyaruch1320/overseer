// Checks the layer-1 library (docs/systems/llm/09-library.md): every data/library/<family>.jsonl against the family spec
// below (state keys and set list, lines per set, slots, Thai script, digits, length, duplicates, near-copies of layer 0,
// repeated openings, distinct images, filter and conditional-slot shares) and prints a summary. Families with no file yet
// are listed as missing, not as errors. The spec here must match sections 2, 5 and 6 of 09-library.md.
// Usage: node scripts/llm/check-library.mjs [data/library/prayer.jsonl ...] [--sets=prayer] [--sample=1] [--seed=1]
//   --sets=<family> lists every state set of that family with the lines it needs and has (for writers).
//   --sample=N prints N lines of every state set chosen by seed, for the user's reading (section 10 asks for --sample=1).
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../lib/paths.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const LIB = path.join(root, 'data', 'library');

// ---------- values ----------
const RACE_GROUPS = ['คนบ้านเมือง', 'ป่าและฟ้า', 'ภูผาและเตา', 'สายน้ำ', 'เงา', 'ศึกและมังกร']; // 06-god-templates.md section 2.1
const LANDS = ['อัซการ์', 'มอร์เฮเวน', 'คาซ-ดูรัม', 'เนเรีย', 'อัลเดรีย', 'เมคาเรีย', 'ซาฮารัน', 'ซิลวาเนล', 'เนบูเลีย'];
const PRAYER_KINDS = ['heal', 'rain', 'plague', 'peace', 'love', 'heir', 'wealth', 'wisdom', 'courage', 'vengeance', 'uncurse', 'fame', 'harvest', 'grandchild', 'challenge', 'kin_sick', 'mother'];
const ONE_VOICE = ['challenge', 'mother']; // the challenger is always a doubter, the mother's faith is not tracked
const VOICES = ['ภักดี', 'เชื่อ', 'ลังเล'];
const ANSWERS = ['ให้', 'ให้แบบแปลก', 'ปฏิเสธ', 'ลงโทษ', 'นิ่ง'];
const HINTS = ['ระวัง', 'กล้าเถิด', 'จงไป', 'จงอยู่', 'จุดอ่อนของศัตรู', 'คนนั้นโกหก', 'ช่วย', 'สางเรื่อง', 'ชี้ทายาท'];
const SCENES = ['เมือง', 'ป่าและทาง', 'ศึก'];
const SYMBOLS = ['งู', 'ไฟ', 'แม่น้ำ', 'ดาบ', 'ดวงตา', 'ดวงจันทร์', 'ดอกไม้', 'อีกา', 'มงกุฎ', 'ประตู', 'หัวใจ', 'ภูเขา'];
const SYMBOL_WORD = { งู: /งู/, ไฟ: /ไฟ|เปลว/, แม่น้ำ: /แม่น้ำ|สายน้ำ|ลำธาร|กระแสน้ำ/, ดาบ: /ดาบ/, ดวงตา: /ดวงตา|นัยน์ตา|ลูกตา|ลืมตา|หลับตา|สบตา|จ้องตา|แววตา|เบ้าตา|ช่องตา|ขอบตา|หางตา|หนังตา|ตาของ|ตาดวง|ตาสี|ตาข้าง|ตาเดียว|ตาทั้ง|ตาที่|ตานับ|พันตา/, ดวงจันทร์: /จันทร์/, ดอกไม้: /ดอก|กลีบ/, อีกา: /อีกา/, มงกุฎ: /มงกุฎ/, ประตู: /ประตู|บานประตู/, หัวใจ: /หัวใจ/, ภูเขา: /ภูเขา|ภูผา|ยอดเขา/ };
const TONES = ['ปลอดภัย', 'เสี่ยง', 'แหล่งหายาก'];
const SOURCES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
const TERMS = ['ตรงนิสัย', 'ขัดนิสัย', 'ขัดศีลธรรม', 'ศรัทธาเทพต่ำ', 'เพิ่งถูกลงโทษ', 'ฝันซ้ำ', 'เสียงแห่งสวรรค์', 'เสียงกระซิบจากพระเจ้า', 'ศรัทธาเทพสูง', 'ความฉลาด', 'ความฉลาดต่ำ'];
const RESULTS = ['ตื่น', 'ทำตาม', 'ตีความผิด', 'ปฏิเสธ', 'ขัดขืน'];
const TIERS = ['⭐', '●', '○'];
const WORLD_KINDS = ['มังกร', 'สงคราม', 'โรคและทุกข์ภัย', 'ศรัทธาและเทพ', 'ทะเลและฟ้า', 'แผ่นดิน'];

// ---------- slots ----------
const N = '{ชื่อตัวละคร}', HERE = '{ชื่อของที่นี่}', SEASON = '{ฤดู}', CONT = '{ทวีป}', RACE = '{เผ่า}', NPC = '{NPC}', DEST = '{จุดหมาย}', FOE = '{ศัตรู}', JOB = '{อาชีพ}', TRAIT = '{นิสัย}', SYM = '{สัญลักษณ์}', PATH = '{ชื่อทาง}', OTHER = '{ชื่อทางอื่น}';
// always: may appear in any line · required: must appear in every line · cond: may appear, at most a third of the set (the game skips the line when it has no value)
const slots = (always = [], required = [], cond = []) => ({ always: [...always, ...required], required, cond });

// ---------- families (09-library.md section 2 and 6) ----------
const cross = (a, ka, b, kb) => a.flatMap((x) => b.map((y) => ({ [ka]: x, [kb]: y })));
const FAMILIES = {
  prayer: {
    keys: ['kind', 'voice'], voice: 'scene', len: [30, 150],
    sets: () => PRAYER_KINDS.flatMap((k) => (ONE_VOICE.includes(k) ? [{ kind: k, voice: 'ทั้งหมด' }] : VOICES.map((v) => ({ kind: k, voice: v })))),
    per: (s) => (ONE_VOICE.includes(s.kind) ? 12 : 6),
    slots: (s) => slots([HERE, SEASON, ...(s.kind === 'harvest' ? [JOB] : [])], [N, ...(['vengeance', 'kin_sick'].includes(s.kind) ? [NPC] : [])]),
  },
  prayer_answer: {
    keys: ['kind', 'answer'], voice: 'scene', len: [30, 150],
    sets: () => cross(PRAYER_KINDS, 'kind', ANSWERS, 'answer'),
    per: () => 4,
    slots: (s) => slots([N, HERE, SEASON, ...(s.kind === 'harvest' ? [JOB] : [])], ['vengeance', 'kin_sick'].includes(s.kind) ? [NPC] : []),
  },
  omen: {
    keys: ['hint', 'scene'], voice: 'scene', len: [20, 110],
    sets: () => cross(HINTS, 'hint', SCENES, 'scene'),
    per: () => 10,
    slots: (s) => slots([N, HERE, SEASON, ...(s.hint === 'จงไป' ? [DEST] : []), ...(s.hint === 'ชี้ทายาท' ? [NPC] : []), ...(s.hint === 'จุดอ่อนของศัตรู' || s.scene === 'ศึก' ? [FOE] : [])], ['คนนั้นโกหก', 'ช่วย'].includes(s.hint) ? [NPC] : []),
  },
  dream_vision: {
    keys: ['symbol', 'tone'], voice: 'scene', len: [50, 160],
    sets: () => cross(SYMBOLS, 'symbol', TONES, 'tone'),
    per: () => 8,
    slots: () => slots([N, HERE, SEASON, CONT, RACE], [], [NPC, DEST]),
    must: (s) => SYMBOL_WORD[s.symbol],
  },
  dream_shadow: {
    keys: ['source'], voice: 'dream', len: [15, 70],
    sets: () => SOURCES.map((x) => ({ source: x })),
    per: () => 10,
    slots: (s) => slots([SEASON, ...(s.source === 'S3' ? [NPC] : []), ...(s.source === 'S5' ? [DEST] : [])]),
  },
  dream_reason: {
    keys: ['term'], voice: 'player', len: [10, 60],
    sets: () => TERMS.map((x) => ({ term: x })),
    per: () => 6,
    slots: (s) => slots([], [], ['ตรงนิสัย', 'ขัดนิสัย'].includes(s.term) ? [TRAIT] : []),
  },
  dream_wake: {
    keys: ['result'], voice: 'scene', len: [30, 140],
    sets: () => RESULTS.map((x) => ({ result: x })),
    per: (s) => (s.result === 'ตื่น' ? 16 : 10),
    slots: (s) => slots([N, SYM, ...(s.result === 'ตื่น' ? [] : [PATH])], s.result === 'ตีความผิด' ? [OTHER] : []), // waking must not hint at the path
  },
  world_omen: {
    keys: ['tier', 'kind'], voice: 'scene', len: [30, 140],
    sets: () => cross(TIERS, 'tier', WORLD_KINDS, 'kind'),
    per: () => 8,
    slots: () => slots([CONT, HERE, SEASON]),
  },
};
const VALUES = { kind: [...PRAYER_KINDS, ...WORLD_KINDS], voice: [...VOICES, 'ทั้งหมด'], answer: ANSWERS, hint: HINTS, scene: SCENES, symbol: SYMBOLS, tone: TONES, source: SOURCES, term: TERMS, result: RESULTS, tier: TIERS };

// ---------- text helpers ----------
const SLOT_RE = /\{[^{}]*\}/g;
const bare = (t) => t.replace(SLOT_RE, '');
const norm = (t) => bare(t).replace(/[\s"':]/g, '');
const opening = (t) => [...norm(t)].slice(0, 6).join('');
const length = (t) => [...t.replace(SLOT_RE, 'xxxxxx')].length; // a filled slot counts as six letters
const grams = (t) => { const c = [...norm(t)], g = new Set(); for (let i = 0; i + 3 <= c.length; i++) g.add(c.slice(i, i + 3).join('')); return g; };
const NEAR = 0.4; // share of letter triples two lines may have in common before one counts as a reworded copy of the other
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.max(1, a.size + b.size - n); };
const outsideQuotes = (t) => t.split('"').filter((_, i) => i % 2 === 0).join(' ');
const setKey = (F, o) => F.keys.map((k) => o[k]).join(' · ');

// layer-0 lines (06-god-templates.md): a library line must not be a near-copy of one of them
const layer0 = fs.readFileSync(path.join(root, 'docs/systems/llm/06-god-templates.md'), 'utf8').split('\n')
  .filter((l) => l.startsWith('|')).flatMap((l) => l.split('|').map((c) => c.trim())).filter((c) => (c.match(/[ก-๎]/g) || []).length >= 25).map((c) => ({ text: c, g: grams(c) }));

// ---------- check ----------
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = files.length ? files.map((f) => path.resolve(f)) : fs.existsSync(LIB) ? fs.readdirSync(LIB).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(LIB, f)) : [];
const report = [];
const errorsAll = [], warningsAll = [];
const loaded = {};

for (const file of targets) {
  const fam = path.basename(file, '.jsonl');
  const F = FAMILIES[fam];
  const rel = path.relative(root, file);
  const errors = [], warnings = [];
  const err = (n, msg) => errors.push(`${rel}:${n} ${msg}`), warn = (n, msg) => warnings.push(`${rel}:${n} ${msg}`);
  if (!F) { errorsAll.push(`${rel} unknown family (not in 09-library.md section 2)`); continue; }
  const sets = F.sets(), byKey = new Map(sets.map((s) => [setKey(F, s), { set: s, lines: [] }]));
  const seen = new Map();
  const raw = fs.readFileSync(file, 'utf8').split('\n');
  raw.forEach((line, i) => {
    const n = i + 1;
    if (!line.trim()) return;
    let o;
    try { o = JSON.parse(line); } catch { err(n, 'not JSON'); return; }
    for (const k of Object.keys(o)) if (![...F.keys, 'img', 'text', 'races', 'lands'].includes(k)) err(n, `unknown key ${k}`);
    for (const k of F.keys) if (!VALUES[k].includes(o[k])) err(n, `${k} "${o[k]}" not in the list`);
    const entry = byKey.get(setKey(F, o));
    if (!entry) { err(n, `no such set ${setKey(F, o)}`); return; }
    const t = o.text;
    if (typeof t !== 'string' || !t) { err(n, 'no text'); return; }
    if (t !== t.trim() || /\s{2}/.test(t)) err(n, 'extra spaces');
    const S = F.slots(entry.set), used = t.match(SLOT_RE) || [];
    for (const x of used) if (![...S.always, ...S.cond].includes(x)) err(n, `slot ${x} not allowed in this set`);
    for (const x of S.required) if (!used.includes(x)) err(n, `missing required slot ${x}`);
    if (/[{}]/.test(bare(t))) err(n, 'stray brace');
    const b = bare(t);
    if (/[A-Za-z]/.test(b)) err(n, 'Latin letters');
    if (/[0-9๐-๙]/.test(b)) err(n, 'digits');
    const odd = [...b].filter((c) => !/[ก-๏๚๛ "':]/.test(c) && !/[A-Za-z0-9๐-๙]/.test(c)); // Latin and digits are reported above
    if (odd.length) err(n, `characters outside Thai: ${[...new Set(odd)].join('')}`);
    if ((t.match(/"/g) || []).length % 2) err(n, 'unbalanced quotes');
    const L = length(t);
    if (L < F.len[0] || L > F.len[1]) err(n, `length ${L} outside ${F.len[0]}–${F.len[1]}`);
    if (typeof o.img !== 'string' || !o.img) err(n, 'no img');
    else if (!t.includes(o.img)) err(n, `img "${o.img}" not in text`);
    for (const [k, list] of [['races', RACE_GROUPS], ['lands', LANDS]]) if (k in o && (!Array.isArray(o[k]) || !o[k].length || o[k].some((x) => !list.includes(x)))) err(n, `${k} must be a non-empty list from 09-library.md section 4`);
    if (F.must && !F.must(entry.set).test(t)) err(n, `the symbol ${entry.set.symbol} is not in the text`);
    if (/เธอ|หล่อน/.test(outsideQuotes(t))) warn(n, 'gendered pronoun (use the name or เขา)');
    if (F.voice !== 'player' && /(?<!เ)ท่าน(?![้อ])/.test(outsideQuotes(t))) warn(n, 'ท่าน outside quotes (the narrator does not address the player here)');
    const k = norm(t);
    if (seen.has(k)) err(n, `same text as line ${seen.get(k)}`);
    seen.set(k, n);
    for (const l0 of layer0) if (jaccard(grams(t), l0.g) >= NEAR) { err(n, `near-copy of layer 0: ${l0.text.slice(0, 40)}…`); break; }
    entry.lines.push({ n, o, t, g: grams(t) });
  });

  // sets
  let total = 0, covered = 0, need = 0;
  const openFam = new Map(), imgFam = new Map();
  for (const [key, { set, lines }] of byKey) {
    const per = F.per(set);
    need += per; total += lines.length;
    if (lines.length >= per) covered++;
    if (lines.length < per) errors.push(`${rel} set ${key}: ${lines.length} of ${per} lines`);
    if (!lines.length) continue;
    if (lines.length > per * 1.5) warnings.push(`${rel} set ${key}: ${lines.length} lines, spec says ${per}`);
    const S = F.slots(set), opens = new Map(), imgs = new Map();
    let slotFirst = 0, filtered = 0, conditional = 0;
    for (const x of lines) {
      const op = opening(x.t);
      if (opens.has(op)) err(x.n, `opening "${op}" already used in this set (line ${opens.get(op)})`);
      opens.set(op, x.n);
      openFam.set(op, (openFam.get(op) || 0) + 1);
      if (x.o.img) { if (imgs.has(x.o.img)) err(x.n, `img "${x.o.img}" already used in this set (line ${imgs.get(x.o.img)})`); imgs.set(x.o.img, x.n); imgFam.set(x.o.img, (imgFam.get(x.o.img) || 0) + 1); }
      if (x.t.startsWith('{')) slotFirst++;
      if (x.o.races || x.o.lands) filtered++;
      if (S.cond.some((c) => x.t.includes(c))) conditional++;
      for (const y of lines) if (y.n < x.n && jaccard(x.g, y.g) >= NEAR) err(x.n, `near-copy of line ${y.n}`);
    }
    if (slotFirst > Math.floor(lines.length / 2)) errors.push(`${rel} set ${key}: ${slotFirst} of ${lines.length} lines start with a slot (at most half)`);
    if (filtered > Math.floor(per / 3)) errors.push(`${rel} set ${key}: ${filtered} lines carry races or lands (at most ${Math.floor(per / 3)})`);
    if (conditional > Math.floor(per / 3)) errors.push(`${rel} set ${key}: ${conditional} lines use a conditional slot (at most ${Math.floor(per / 3)})`);
  }
  const openCap = Math.max(3, Math.ceil(0.03 * total)), imgCap = Math.max(3, Math.round(0.02 * total));
  for (const [op, c] of openFam) if (c > openCap) errors.push(`${rel} opening "${op}" used ${c} times in the family (at most ${openCap})`);
  for (const [im, c] of imgFam) if (c > imgCap) errors.push(`${rel} img "${im}" used ${c} times in the family (at most ${imgCap})`);
  loaded[fam] = byKey;
  report.push({ fam, rel, sets: byKey.size, covered, total, need, errors: errors.length, warnings: warnings.length });
  errorsAll.push(...errors); warningsAll.push(...warnings);
}

// ---------- writer helpers ----------
const listFam = arg('sets', '');
if (listFam) {
  const F = FAMILIES[listFam];
  if (!F) throw new Error(`unknown family ${listFam}`);
  const have = loaded[listFam];
  for (const s of F.sets()) { const key = setKey(F, s); console.log(`${key}\t${(have?.get(key)?.lines.length) || 0}/${F.per(s)}\tslots: ${F.slots(s).always.join(' ') || '-'}${F.slots(s).required.length ? ` · required ${F.slots(s).required.join(' ')}` : ''}${F.slots(s).cond.length ? ` · conditional ${F.slots(s).cond.join(' ')}` : ''}`); }
  process.exit(0);
}
const sample = Number(arg('sample', 0));
if (sample) {
  let seed = Number(arg('seed', 1));
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const [fam, byKey] of Object.entries(loaded)) {
    const pick = [...byKey.values()].flatMap((e) => [...e.lines].sort(() => rnd() - 0.5).slice(0, sample));
    console.log(`\n${fam}`);
    for (const x of pick) console.log(`  [${setKey(FAMILIES[fam], x.o)}${x.o.races ? ` · ${x.o.races.join(' ')}` : ''}${x.o.lands ? ` · ${x.o.lands.join(' ')}` : ''}] ${x.t}`);
  }
  console.log('');
}

// ---------- summary ----------
for (const w of warningsAll) console.log('warn', w);
for (const e of errorsAll) console.log('error', e);
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('family', 15)}${pad('file', 34)}${pad('sets', 10)}${pad('lines', 12)}${pad('errors', 8)}warnings`);
let written = 0, needAll = 0;
for (const [fam, F] of Object.entries(FAMILIES)) {
  const r = report.find((x) => x.fam === fam);
  const need = F.sets().reduce((s, x) => s + F.per(x), 0);
  needAll += need; written += r ? r.total : 0;
  console.log(r ? `${pad(fam, 15)}${pad(r.rel, 34)}${pad(`${r.covered}/${r.sets}`, 10)}${pad(`${r.total}/${need}`, 12)}${pad(r.errors, 8)}${r.warnings}` : `${pad(fam, 15)}${pad('(missing)', 34)}${pad(`0/${F.sets().length}`, 10)}${pad(`0/${need}`, 12)}`);
}
console.log(`\nlibrary: ${written} of ${needAll} lines · ${errorsAll.length} errors · ${warningsAll.length} warnings`);
process.exit(errorsAll.length ? 1 : 0);
