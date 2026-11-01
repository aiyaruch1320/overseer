// Wish parser test: reads the synonym table of docs/systems/character/20-wish-synonyms.md (and the country names of docs/lore/countries/README.md),
// parses a built-in list of realistic Thai player requests with a longest-substring scan (Thai has no spaces, so no word splitting),
// prints which fields of the wish sheet each request was understood in, and summarises how many requests are fully understood,
// partly understood (would go to the LLM interpreter) or not understood (would open the manual picker).
// Usage: node scripts/sim/sim-wish-parse.mjs [--write] [--quiet] [--text="อยากได้แวมไพร์ขี้ขลาด"]
//   --write  puts the summary tables between <!-- wish-parse:start --> and <!-- wish-parse:end --> in section 11 of the same doc
//   --quiet  prints only the summary    --text  parses one request instead of the built-in list
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';

const FILE = path.join(root, 'docs/systems/character/20-wish-synonyms.md');
const COUNTRIES = path.join(root, 'docs/lore/countries/README.md');
const TRAITS = path.join(root, 'docs/_generated/character-catalog/traits.md');
const SUPPORT = path.join(root, 'docs/systems/character/12-job-support.md');
const doc = fs.readFileSync(FILE, 'utf8');
const args = process.argv.slice(2);
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const words = (s) => (!s || s === '—' ? [] : s.split(' · ').map((x) => x.trim()).filter(Boolean));

// ---------- normalisation (section 1, rule 2): lower case, Thai digits to Arabic, drop spaces and punctuation ----------
const DROP = /[\s\-_.,!?"'“”‘’()[\]{}:;/\\~…]/;
const THAI_DIGIT = '๐๑๒๓๔๕๖๗๘๙';
function compact(text) {
  const chars = [], wid = [];
  let w = 0, lastDrop = true;
  for (let c of Array.from(text.toLowerCase())) {
    const d = THAI_DIGIT.indexOf(c);
    if (d >= 0) c = String(d);
    if (DROP.test(c)) { if (!lastDrop) w++; lastDrop = true; continue; }
    chars.push(c); wid.push(w); lastDrop = false;
  }
  return { s: chars.join(''), chars, wid };
}
const norm = (s) => compact(s).s;
const len = (s) => Array.from(s).length;

// ---------- lexicon from the doc ----------
// kinds: value (field tables of section 2), fieldname, neg, int, rand, fill, out (not in the sheet), imp (impossible request)
const LEX = new Map();
let skipped = 0, rows = 0;
const add = (word, entry, min) => {
  const n = norm(word);
  if (len(n) < min) { skipped++; return; }
  const list = LEX.get(n) || [];
  if (!list.some((e) => e.kind === entry.kind && e.field === entry.field && e.code === entry.code)) list.push(entry);
  LEX.set(n, list);
};
const sections = doc.split(/^## /m).slice(1);
const section = (n) => sections.find((s) => s.startsWith(`${n}.`)) || '';
function tables(text, accept) {
  // yields [header first cell, cells] for rows of tables whose header's first cell is in accept
  const lines = text.split('\n'), out = [];
  let head = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('|')) { head = null; continue; }
    if (/^\|\s*-/.test(l)) continue;
    if (lines[i + 1] && /^\|\s*-/.test(lines[i + 1])) { head = cells(l)[0]; continue; }
    if (head && accept.includes(head)) out.push([head, cells(l)]);
  }
  return out;
}
{
  const s2 = section(2);
  let field = null;
  for (const l of s2.split('\n')) {
    const h = l.match(/^### 2\.\d+\S*\s+(.+)$/);
    if (h) { field = h[1].replace(/\s*\(.*$/, '').trim(); continue; }
    if (!field || !l.startsWith('|') || /^\|\s*-/.test(l)) continue;
    const c = cells(l);
    if (c[0] === 'รหัส') continue;
    const code = c[0].replace(/`/g, '');
    rows++;
    if (field === 'ชื่อช่อง') { for (const w of [c[1], ...words(c[2])]) add(w, { kind: 'fieldname', field: code, code, name: c[1] }, 2); continue; }
    const e = { kind: 'value', field, code, name: c[1] };
    for (const w of [c[1], ...words(c[2])]) add(w, e, 3);
  }
  for (const [, c] of tables(section(3), ['ชนิด'])) for (const w of words(c[1])) add(w, { kind: 'neg', field: 'ห้าม', code: c[0], name: c[0] }, 2);
  for (const [, c] of tables(section(4), ['ชนิด'])) for (const w of words(c[1])) add(w, { kind: 'int', field: 'ระดับ', code: c[0], name: c[0] }, 2);
  for (const [, c] of tables(section(5), ['ขอบเขต'])) for (const w of words(c[1])) add(w, { kind: 'rand', field: 'สุ่ม', code: c[0], name: c[0] }, 2);
  for (const [, c] of tables(section(6), ['ชนิด'])) for (const w of words(c[1])) add(w, { kind: 'fill', field: 'เติม', code: c[0], name: c[0] }, 2);
  for (const [, c] of tables(section(7), ['หัวข้อ'])) for (const w of words(c[1])) add(w, { kind: 'out', field: 'นอกใบ', code: c[0], name: c[0] }, 2);
  for (const [, c] of tables(section(8), ['คำขอ'])) for (const w of words(c[1])) add(w, { kind: 'imp', field: 'ทำไม่ได้', code: c[0], name: c[0] }, 3);
}
// countries: the index lists "AZ-01 name · AZ-02 name"
try {
  for (const l of fs.readFileSync(COUNTRIES, 'utf8').split('\n')) {
    if (!l.startsWith('**')) continue;
    for (const m of l.matchAll(/([A-Z]{2}-\d{2}) ([^·]+?)(?= · |$)/g)) add(m[2], { kind: 'value', field: 'ถิ่นเกิด', code: m[1], name: m[2].trim() }, 3);
  }
} catch { /* index missing: countries are skipped */ }
if (LEX.size < 500 || rows < 400) throw new Error(`synonym table not parsed: ${LEX.size} words, ${rows} rows`);
const MAXLEN = Math.max(...[...LEX.keys()].map(len));
const WEIGHT = { value: 3, out: 3, imp: 3, fieldname: 2, neg: 2, int: 2, rand: 2, fill: 1 };

// conflicting traits: the table "traits that cannot live together" and the "ขัดกับ" column of the new traits
const CLASH = new Set();
for (const l of fs.readFileSync(TRAITS, 'utf8').split('\n')) { const m = l.match(/^\| (\w+) \(.*?\) \| (\w+) \(/); if (m) { CLASH.add(`${m[1]}|${m[2]}`); CLASH.add(`${m[2]}|${m[1]}`); } }
for (const l of fs.readFileSync(SUPPORT, 'utf8').split('## ค.')[0].split('## ข.')[1].split('\n')) {
  const c = l.startsWith('|') ? cells(l) : [];
  if (c.length >= 5 && /^[a-z_]+$/.test(c[0])) for (const o of c[4].split(/\s+/)) if (o) { CLASH.add(`${c[0]}|${o}`); CLASH.add(`${o}|${c[0]}`); }
}
const SINGLE = new Set(['เผ่า', 'เพศ', 'ฐานะ', 'ศาสนา', 'ครอบครัว', 'พร', 'กำเนิดพิเศษ', 'ยุคที่เกิด']);
const LIMIT = { นิสัย: 3, ความถนัด: 2 };

// ---------- the parser ----------
function parse(text) {
  const { s, chars, wid } = compact(text);
  const n = chars.length;
  // best[i] = most weighted characters that can be covered from position i on; the longest match is tried first at each position
  const best = new Array(n + 1).fill(0), pick = new Array(n + 1).fill(null);
  for (let i = n - 1; i >= 0; i--) {
    best[i] = best[i + 1];
    for (let L = Math.min(MAXLEN, n - i); L >= 2; L--) {
      const ents = LEX.get(chars.slice(i, i + L).join(''));
      if (!ents) continue;
      const top = Math.max(...ents.map((e) => WEIGHT[e.kind]));
      const sc = top * L + best[i + L];
      if (pick[i] ? sc > best[i] : sc >= best[i + 1]) { best[i] = sc; pick[i] = { L, ents: ents.filter((e) => WEIGHT[e.kind] === top) }; } // on a tie with skipping the character, the match wins
    }
  }
  // walk the choices
  const toks = [], unk = [];
  let cur = '', curW = -1, matched = 0;
  const flush = () => { if (cur) unk.push(cur); cur = ''; };
  for (let i = 0; i < n;) {
    const p = pick[i];
    if (p) { flush(); toks.push({ kind: p.ents[0].kind, ents: p.ents, text: chars.slice(i, i + p.L).join(''), at: i }); matched += p.L; i += p.L; continue; }
    if (cur && wid[i] !== curW) flush();
    cur += chars[i]; curW = wid[i]; i++;
  }
  flush();
  const unknown = unk.filter((u) => len(u) >= 3);

  // bind negation, intensity and random words to their neighbours
  const isVal = (t) => t && (t.kind === 'value' || t.kind === 'imp' || t.kind === 'out');
  const randomFields = new Set();
  let globalRandom = false;
  toks.forEach((t, k) => {
    if (t.kind === 'neg') {
      let seen = 0;
      for (let j = k + 1; j < toks.length && seen < 4; j++) {
        if (toks[j].kind === 'neg') break;
        if (isVal(toks[j])) { toks[j].neg = true; break; }
        if (toks[j].kind !== 'fill') seen++;
      }
    } else if (t.kind === 'int') {
      let j = k - 1;
      while (j >= 0 && toks[j].kind === 'fill') j--;
      let tgt = j >= 0 && toks[j].kind === 'value' ? toks[j] : null;
      if (!tgt) { j = k + 1; while (j < toks.length && toks[j].kind === 'fill') j++; tgt = toks[j] && toks[j].kind === 'value' ? toks[j] : null; }
      if (tgt) tgt.int = t.ents[0].code;
    } else if (t.kind === 'rand') {
      let f = null;
      for (let d = 1; d <= 2 && !f; d++) for (const j of [k - d, k + d]) if (toks[j] && toks[j].kind === 'fieldname') { f = toks[j].ents[0].field; break; }
      if (f) randomFields.add(f);
      else if (t.ents.some((e) => e.code === 'ทั้งใบ')) globalRandom = true; // "ก็ได้" with no field only means the neighbouring value is acceptable
    }
  });
  // collect what was understood
  const got = {};
  const put = (field, label) => { const a = (got[field] = got[field] || []); if (!a.includes(label)) a.push(label); };
  const vals = [];
  for (const t of toks) {
    if (t.kind === 'value') {
      const amb = t.ents.length > 1;
      for (const e of t.ents) {
        put(e.field, `${t.neg ? '!' : ''}${e.code === e.name ? e.name : e.code}${t.int === 'แรง' ? '↑' : t.int === 'เบา' ? '↓' : ''}${amb ? '?' : ''}`);
        vals.push({ ...e, neg: !!t.neg });
      }
    } else if (t.kind === 'imp') put('ทำไม่ได้', t.ents[0].name);
    else if (t.kind === 'out') put('นอกใบ', t.ents[0].code);
  }
  for (const f of randomFields) put('สุ่ม', f);
  if (globalRandom) put('สุ่ม', 'ทั้งใบ');
  // conflicts
  const conflicts = [];
  const byField = {};
  for (const v of vals) if (!v.neg) (byField[v.field] = byField[v.field] || new Set()).add(v.code);
  for (const f of SINGLE) if (byField[f] && byField[f].size > 1) conflicts.push(f === 'เผ่า' && got['ลูกครึ่ง'] ? 'เผ่า 2 เผ่า (ลูกครึ่ง?)' : `${f} ${byField[f].size} ค่า`);
  const tr = byField['นิสัย'] ? [...byField['นิสัย']] : [];
  for (let a = 0; a < tr.length; a++) for (let b = a + 1; b < tr.length; b++) if (CLASH.has(`${tr[a]}|${tr[b]}`)) conflicts.push(`นิสัยขัดกัน ${tr[a]}/${tr[b]}`);
  for (const [f, lim] of Object.entries(LIMIT)) if (byField[f] && byField[f].size > lim) conflicts.push(`${f}เกิน ${lim}`);
  for (const v of vals) if (v.neg && byField[v.field] && byField[v.field].has(v.code)) conflicts.push(`ขอและห้าม ${v.code}`);

  const hasValue = toks.some(isVal) || globalRandom;
  const known = n ? matched / n : 0;
  let status;
  if (!hasValue) status = 'none';
  else if (!unknown.length) status = 'full';
  else status = known >= 0.7 ? 'mostly' : 'partly';
  return { text, got, conflicts, unknown, known, status, randomOnly: globalRandom && !toks.some((t) => t.kind === 'value' || t.kind === 'imp' || t.kind === 'out') };
}

// ---------- sample requests (written by the designer, realistic and uneven on purpose) ----------
const SAMPLES = [
  'อยากได้แวมไพร์ลูกเศรษฐีที่ขี้ขลาด',
  'อยากเป็นเด็กกำพร้าเผ่าสัตว์ที่โตมาในเมืองมนุษย์ แล้วอยากให้ชีวิตได้เดินทางไกล',
  'เอลฟ์สาวสวย ใจดี รักสัตว์',
  'ออร์คตัวใหญ่ๆ ชอบสู้ ใช้ขวาน',
  'อะไรก็ได้',
  'สุ่มให้หน่อย',
  'ขอเป็นเจ้าชายแห่งอัลเดรีย เก่งดาบ',
  'ไม่เอาออร์ค ไม่เอาคนจน อยากเป็นนักเวทไฟ',
  'อยากเป็นอมตะ ไม่ตายไม่แก่',
  'อยากเป็นคนที่เก่งที่สุดในโลก',
  'มังกรสาวสุดโหด',
  'ผมอยากเกิดเป็นสไลม์แล้วกลืนกินทุกอย่าง',
  'คนธรรมดา ชีวิตเรียบๆ ไม่มีอะไรมาก',
  'หนุ่มช่างตีเหล็กจากคาซ-ดูรัม คนแคระ ขี้โมโห',
  'vampire ขุนนางที่เหงา ๆ',
  'elf archer ใจเย็น',
  'อยากเป็นพ่อค้ารวยๆ เกิดบนเกาะ เนเรีย',
  'อยากล้างแค้นให้ครอบครัว เกิดมากำพร้า',
  'ขอเกิดตอนมังกรล้ม เป็นคนธรรมดา',
  'ไม่อยากให้พระเจ้ายุ่งกับชีวิต',
  'อยากเป็นจอมมาร',
  'ฮาล์ฟเอลฟ์ หูแหลม เจ้าชู้ ปากหวาน',
  'นางฟ้าตัวจิ๋ว โชคดีสุดๆ',
  'คนจน ถูกทิ้ง ไม่มีใครรัก',
  'ชื่อซาร่า ผมสีฟ้า ตาสีม่วง',
  'อยากเป็นหมอ ใจดี ช่วยคนไข้',
  'เด็กสาวเผ่าแมว ตัวเล็กๆ ขี้อาย ชอบกินขนม',
  'หุ่นยนต์ที่มีหัวใจ',
  'ซอมบี้ที่ยังมีสติ',
  'นักล่าค่าหัวที่โหดเหี้ยม ไม่ไว้ใจใคร',
  'อยากมีแฟนหล่อๆ รวยๆ',
  'เกิดในทะเลทราย พ่อแม่เป็นพ่อค้าคาราวาน',
  'อยากเป็นนักดนตรีพเนจร เดินทางทั่วโลก',
  'ขอ ดาร์กเอลฟ์ ผู้หญิง เจ้าเล่ห์ ใช้มีดสั้น',
  'เกิดเป็นกูล หิวตลอดเวลา',
  'อยากเป็นนักปราชญ์ที่รู้ทุกอย่าง',
  'ไม่ต้องรวยมาก ธรรมดาๆก็พอ',
  'ขอสุดยอดนักดาบ ฟันดาบเก่งสุดๆ แต่ขี้ขลาด',
  'ลูกครึ่งเอลฟ์กับมนุษย์ ใจดี',
  'อยากเกิดเป็นเงือกในทะเล ร้องเพลงเพราะ',
  'เล่นเป็นนักบวชศาสนจักรแสง สวดมนต์เก่ง หน้าตาดี',
  'อยากเป็นราชา ครองทั้งโลก',
  'Isekai ถูกอัญเชิญมาต่างโลก',
  'ตัวละครที่ซวยสุดๆ เกิดมาโชคร้าย มีหนี้เยอะ',
  'ช่วยทำให้ดราม่าหน่อย ชีวิตน่าสงสาร',
  'อยากเป็นแม่มดสาวสวย เลี้ยงแมวดำ',
  'ผมอยากเป็นเหมือนนารูโตะ',
  'เอาแบบสนุกๆ ฮาๆ',
  'ขอแบบไม่เหมือนใคร',
  'เกิดมาเป็นลูกคนรวย แต่พ่อแม่ตาย',
  'อยากเป็นผู้กล้าที่ปราบจอมมาร',
  'คนแคระ ชอบเหล้า ตะกละ',
  'เผ่ามังกร ขี่มังกรได้',
  'อยากเกิดที่หมอก เป็นแวมไพร์ ไม่เอาเด็กกำพร้า',
  'ผู้หญิงทหารเก่งๆ ใช้หอก',
  'ใครก็ได้ที่ไม่ใช่มนุษย์',
  'เลือกให้หน่อย ว่ามันเยอะไปหมด',
  'อยากเป็นคนเก่งๆ หล่อๆ รวยๆ',
  'หนูอยากเป็นนักผจญภัยสายฮีล เป็นนางฟ้าก็ได้',
  'สไลม์ ไม่มีเพศ ฉลาดมาก',
  'ชาวนาที่ใจดี อยู่ในหมู่บ้านเล็กๆ ไม่มีเรื่องวุ่นวาย',
  'ต้องการตัวละครที่เล่นยากๆ แบบ hard mode',
  'อยากรู้ว่าถ้าเกิดเป็นออร์คจะเป็นยังไง',
  'mermaid ใจดี รักสัตว์ทะเล',
  'อยากเป็นคนรวยที่สุดในแผ่นดิน',
  'อยากให้เป็นตัวละครที่เริ่มจากศูนย์ แล้วค่อยๆ เก่งขึ้นเรื่อยๆ จนกลายเป็นคนสำคัญของโลก',
  'ขอเป็นลูกสาวช่างตีเหล็กที่พ่อตายตอนเด็ก แล้วต้องดูแลน้องสามคน',
  'ผมชอบเรื่องเกี่ยวกับมังกรและการผจญภัยในถ้ำ',
  'ช่วยสร้างตัวละครที่น่าสนใจให้หน่อย',
  'a tall half-orc warrior',
  'ลูกชายหมอผีแห่งป่าลึก ศรัทธาวิญญาณสัตว์',
  'เป็นสัตว์เลี้ยงของจอมมาร',
  'อยากเกิดมาสบายตลอดชีวิต ไม่ต้องทำงาน',
  '5555',
];

// ---------- run ----------
const textArg = args.find((a) => a.startsWith('--text='));
const reqs = textArg ? [textArg.slice(7)] : SAMPLES;
const res = reqs.map(parse);
const TAG = { full: 'ครบ', mostly: 'ส่วนใหญ่', partly: 'บางส่วน', none: 'ไม่เข้าใจ' };
const out = [];
if (!args.includes('--quiet')) {
  res.forEach((r, i) => {
    const g = Object.entries(r.got).map(([f, v]) => `${f}=${v.join(',')}`).join(' · ') || '(ไม่มี)';
    out.push(`${String(i + 1).padStart(2)}. ${r.text}`, `    [${TAG[r.status]}] ${g}${r.conflicts.length ? ` · ขัด: ${r.conflicts.join(', ')}` : ''}${r.unknown.length ? ` · ไม่รู้จัก: ${r.unknown.map((u) => `"${u}"`).join(' ')}` : ''}`);
  });
  out.push('');
}
console.log(out.join('\n'));
if (textArg) process.exit(0);

const N = res.length;
const cnt = { full: 0, mostly: 0, partly: 0, none: 0 };
for (const r of res) cnt[r.status]++;
const pct = (x) => `${((100 * x) / N).toFixed(0)}%`;
const randomOnly = res.filter((r) => r.randomOnly).length;
const fieldCount = {};
for (const r of res) for (const f of Object.keys(r.got)) fieldCount[f] = (fieldCount[f] || 0) + 1;
const unk = {};
for (const r of res) for (const u of r.unknown) unk[u] = (unk[u] || 0) + 1;
const topUnk = Object.entries(unk).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 15);
const conflictN = res.filter((r) => r.conflicts.length).length;

const md = [];
md.push(`ตัวแปลคำพ้องอ่านตาราง ${LEX.size.toLocaleString('en-US')} คำจาก ${rows} แถว (ไม่รวมชื่อประเทศ) ข้ามคำสั้นกว่า 3 ตัวอักษร ${skipped} คำ · คำขอตัวอย่าง ${N} ข้อ`, '');
md.push('| ผล | คำขอ | สัดส่วน | ทางต่อ |', '| --- | --- | --- | --- |');
md.push(`| เข้าใจครบ | ${cnt.full} | ${pct(cnt.full)} | ไม่ถามผู้แปล (ในนี้คำสุ่มล้วน ${randomOnly} ข้อ) |`);
md.push(`| เข้าใจเป็นส่วนใหญ่ (รู้จักตั้งแต่ 70%) | ${cnt.mostly} | ${pct(cnt.mostly)} | ส่งผู้แปล แนบค่าที่เข้าใจแล้ว |`);
md.push(`| เข้าใจบางส่วน (ต่ำกว่า 70%) | ${cnt.partly} | ${pct(cnt.partly)} | ส่งผู้แปล ไม่มี LLM เปิดหน้าเลือกเอง |`);
md.push(`| ไม่เข้าใจ | ${cnt.none} | ${pct(cnt.none)} | ผู้แปล หรือหน้าเลือกเองเมื่อไม่มี LLM |`);
md.push(`| **ครบ + ส่วนใหญ่** | ${cnt.full + cnt.mostly} | ${pct(cnt.full + cnt.mostly)} | |`, '');
md.push(`คำขอที่ตัวแปลพบว่าขัดกันเอง ${conflictN} ข้อ (ขอสองเผ่า นิสัยขัดกัน ขอและห้ามค่าเดียวกัน) · เครื่องหมาย ! คือห้าม ↑ ↓ คือคำบอกระดับ ? คือกำกวมหลายช่อง`, '');
md.push('| ช่องที่เข้าใจ | คำขอที่มี |', '| --- | --- |');
for (const [f, c] of Object.entries(fieldCount).sort((a, b) => b[1] - a[1])) md.push(`| ${f} | ${c} |`);
md.push('', 'สายอักษรที่ไม่รู้จักบ่อยที่สุด (ยาว 3 ตัวอักษรขึ้นไป)', '', '| สายอักษร | ครั้ง |', '| --- | --- |');
for (const [u, c] of topUnk) md.push(`| ${u} | ${c} |`);
md.push('', 'คำขอที่ไม่เข้าใจครบ', '', '| คำขอ | ผล | สายที่ไม่รู้จัก |', '| --- | --- | --- |');
for (const r of res) if (r.status !== 'full') md.push(`| ${r.text} | ${TAG[r.status]} | ${r.unknown.join(' ') || '—'} |`);
const summary = md.join('\n');

if (args.includes('--write')) {
  const a = '<!-- wish-parse:start -->', b = '<!-- wish-parse:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + summary + '\n' + b + doc.split(b)[1]);
  console.log(`wish parse: ${N} requests · full ${cnt.full} · mostly ${cnt.mostly} · partly ${cnt.partly} · none ${cnt.none} · written to docs/systems/character/20-wish-synonyms.md`);
} else console.log(summary);
