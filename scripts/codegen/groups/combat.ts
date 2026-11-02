// Combat generator (code-plan §5.1, row "ต่อสู้"): stances, the roll, the weakness matrix, encounters, rewards, dragons,
// the 200 enemies and the 102 NPC clashes. Writes data/gen/combat.json enemies.json clashes.json.
import type { Clash, ClashOutcome, ClashesData, CombatData, Enemy, EnemiesData, Mark, MatrixCell, Reaction } from '../../../src/core/data/types-combat';
import { finish, findTable, nums, num, parts, pct, recs, src, ticks, Unparsed, mult } from '../helpers-m0b';
import { idIndex } from '../lib/ids';
import { parseCell } from '../lib/effects';
import { listDocs, readDoc, rel, writeGen } from '../lib/table';
import type { Table } from '../lib/table';

const C = 'docs/systems/combat/';
const GEN = 'scripts/codegen/groups/combat.ts';
const un = new Unparsed('combat');
const ids = idIndex();

const MARKS = '★▲·▼✕';
const markOf = (cell: string): MatrixCell => {
  const t = cell.trim();
  const first = t[0];
  if (first && MARKS.includes(first)) {
    const note = t.slice(1).trim().replace(/^\((.*)\)$/, '$1');
    return note ? { mark: first as Mark, note } : { mark: first as Mark };
  }
  return { mark: 'var', note: t };
};

const THAI_TAG: Record<string, string> = { ฟัน: 'blade', ทุบ: 'blunt', แทง: 'pierce', ยิง: 'ranged', พิษ: 'poison', เงิน: 'silver', เหล็ก: 'iron', ไฟ: 'fire', น้ำแข็ง: 'ice', สายฟ้า: 'lightning', น้ำ: 'water', ดิน: 'earth', ลม: 'wind', แสง: 'light', ศักดิ์สิทธิ์: 'holy', มืด: 'dark', เนโคร: 'necro', โลหิต: 'blood', รูน: 'rune', เสน่ห์: 'charm', มายา: 'illusion', ดนตรี: 'music', แดด: 'sun', เจรจา: 'talk' };
const KIND_THAI: Record<string, string> = { คนและเผ่าต่าง: 'humanoid', ธาตุไฟ: 'elemental_fire', ธาตุน้ำแข็ง: 'elemental_ice', ธาตุพายุ: 'elemental_storm' };
const CONT: Record<string, string> = { อัซการ์: 'AZ', มอร์เฮเวน: 'MH', 'คาซ-ดูรัม': 'KD', เนเรีย: 'NR', อัลเดรีย: 'AL', เมคาเรีย: 'MK', ซาฮารัน: 'SH', ซิลวาเนล: 'SV', เนบูเลีย: 'NB' };
const TRAIT: Record<string, string> = { ฝูง: 'swarm', บิน: 'flying', ตัวใหญ่: 'huge', ฟื้นตัว: 'regen', ซ่อนตัว: 'hidden' };
const KINDS = ['beast', 'humanoid', 'undead', 'spirit', 'demon', 'dragon', 'giant', 'construct', 'fey', 'plant', 'amorphous', 'fog', 'elemental', 'sea'];

function reactions(text: string): Reaction[] {
  const out: Reaction[] = [];
  for (const m of text.matchAll(/([฀-๿A-Za-z_`#]+)\s*([★▲▼✕])/g)) {
    const name = m[1].replace(/`/g, '');
    out.push({ tag: THAI_TAG[name] ?? name, name, mark: m[2] as Mark });
  }
  return out;
}

function kindsAndTraits(cell: string): { kinds: string[]; traits: string[] } {
  const kinds: string[] = [];
  const traits: string[] = [];
  for (const w of cell.split(/\s+/)) {
    if (!w) continue;
    if (KINDS.includes(w)) kinds.push(w);
    else if (TRAIT[w]) traits.push(TRAIT[w]);
    else if (/^[a-z_]+$/.test(w)) kinds.push(w);
    else traits.push(w);
  }
  return { kinds, traits };
}

function whereOf(text: string) {
  const continents = [...new Set(Object.entries(CONT).filter(([n]) => text.includes(n)).map(([, c]) => c))];
  const countries = [...new Set([...text.matchAll(/\b([A-Z]{2}-\d\d)\b/g)].map((m) => m[1]))].filter((c) => ids.countries.has(c));
  for (const c of countries) if (!continents.includes(c.slice(0, 2))) continents.push(c.slice(0, 2));
  return { continents: continents.sort(), countries };
}

const TIER_ID: Record<string, string> = { ลูกกระจ๊อก: 'grunt', ปกติ: 'normal', หัวหน้า: 'chief', บอส: 'boss', ตำนาน: 'legend' };

function tierOf(cell: string): { tier: string; wounds: number | null } {
  const m = cell.match(/^(\S+)\s*(\d+)?/);
  return { tier: m![1], wounds: m && m[2] ? Number(m[2]) : null };
}

// ---------- enemies ----------
function enemies(): EnemiesData {
  const f = C + '03-enemies.md';
  const out: Enemy[] = [];
  const t1 = findTable(f, /ก\. มอนสเตอร์เดิม/, 'ID');
  for (const r of recs(t1, ['id', 'name', 'kind', 'tier', 'dc', 'where', 'note'])) {
    const k = kindsAndTraits(r.kind);
    const tr = tierOf(r.tier);
    out.push({ id: r.id, name: r.name, group: 'code', ...k, ...tr, dc: Number(r.dc), where: r.where, ...whereOf(r.where), weak: reactions(r.note.replace(/ไฟ ★/, 'ไฟ ★')), resist: [], note: r.note, src: src(t1, r._line) });
  }
  const t2 = findTable(f, /ข\. มอนสเตอร์ใหม่/, 'ID');
  for (const r of recs(t2, ['id', 'name', 'kind', 'tier', 'dc', 'where', 'weak', 'resist', 'attack'])) {
    const k = kindsAndTraits(r.kind);
    out.push({ id: r.id, name: r.name, group: 'world', ...k, ...tierOf(r.tier), dc: Number(r.dc), where: r.where, ...whereOf(r.where), weak: reactions(r.weak), resist: reactions(r.resist), attack: r.attack, note: '', src: src(t2, r._line) });
  }
  const t3 = findTable(f, /ค\. NPC แบบทั่วไป/, 'ID');
  for (const r of recs(t3, ['id', 'name', 'tier', 'dc', 'stances', 'where', 'talk'])) {
    out.push({ id: r.id, name: r.name, group: 'npc_generic', kinds: ['humanoid'], traits: [], ...tierOf(r.tier), dc: Number(r.dc), where: r.where, ...whereOf(r.where), weak: [], resist: [], stances: r.stances.split(/\s+/), negotiable: r.talk, note: '', src: src(t3, r._line) });
  }
  const t4 = findTable(f, /ง\. NPC ที่มีชื่อ/, 'NPC');
  for (const r of recs(t4, ['id', 'name', 'tier', 'dc', 'weak', 'special', 'opens'])) {
    out.push({ id: r.id, name: r.name, group: 'npc_named', kinds: ['humanoid'], traits: [], ...tierOf(r.tier), dc: Number(r.dc), where: r.id.slice(0, 2) + '-' + r.id.slice(2, 4), ...whereOf(r.id.slice(0, 2) + '-' + r.id.slice(2, 4)), weak: reactions(r.weak), resist: [], note: r.special, opens: r.opens, src: src(t4, r._line) });
  }
  const t5 = findTable(f, /จ\. บอสระดับโลก/, 'ID');
  for (const r of recs(t5, ['id', 'name', 'tier', 'dc', 'event', 'weak', 'note'])) {
    out.push({ id: r.id, name: r.name, group: 'boss', kinds: [], traits: [], ...tierOf(r.tier), dc: Number(r.dc), where: r.event, continents: [], countries: [], weak: reactions(r.weak), resist: [], event: r.event, note: r.note, src: src(t5, r._line) });
  }
  const seen = new Set<string>();
  for (const e of out) {
    if (seen.has(e.id)) throw new Error('combat: duplicate enemy id ' + e.id);
    seen.add(e.id);
  }
  const n = (g: string) => out.filter((e) => e.group === g).length;
  return { counts: { total: out.length, code: n('code'), world: n('world'), npcGeneric: n('npc_generic'), npcNamed: n('npc_named'), boss: n('boss') }, items: out };
}

// ---------- clashes ----------
const KIND_OF_OUTCOME: [RegExp, string][] = [
  [/^ชนะ \(ล้ม|ชนะ \(ดวลถึงตาย|^ชนะ \(.*(ตาย|ฆ่)/, 'win_kill'],
  [/^ชนะ/, 'win_spare'],
  [/^เจรจา|^สงบ/, 'talk'],
  [/^เสมอ/, 'draw'],
  [/^แพ้/, 'lose'],
  [/^หนี/, 'flee'],
];

function clashes(): ClashesData {
  const f = C + '07-npc-clashes.md';
  const lines = readDoc(f).split('\n');
  const items: Clash[] = [];
  let continent = '';
  let cur: Clash | null = null;
  let inTable = false;
  const CODE = /\((\w\w)\)\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^### .*\(([A-Z]{2})\)\s*$/))) continent = m[1];
    else if ((m = l.match(/^#### (NF-([A-Z]{2}\d\d-\d))\s+(.*)$/))) {
      cur = { id: m[1], npc: m[2], name: m[3].trim(), continent, open: { code: '', text: '', chancePerYear: null }, place: '', style: '', trace: '', outcomes: [], src: `${rel(f)}:${i + 1}` };
      items.push(cur);
      inTable = false;
    } else if (cur && (m = l.match(/^- \*\*(เปิดเมื่อ|ที่|ลักษณะ|ร่องรอย)\*\*\s*(.*)$/))) {
      const text = m[2].trim();
      if (m[1] === 'เปิดเมื่อ') {
        const code = text.match(/^([BXSTP])\b/);
        const ch = text.match(/(\d+(?:\.\d+)?)%\s*ต่อปี/);
        cur.open = { code: code ? code[1] : '', text, chancePerYear: ch ? Number(ch[1]) / 100 : null };
      } else if (m[1] === 'ที่') cur.place = text;
      else if (m[1] === 'ลักษณะ') cur.style = text;
      else cur.trace = text;
    } else if (cur && l.startsWith('| ผล |')) inTable = true;
    else if (cur && inTable && l.startsWith('|') && !/^\|\s*-/.test(l)) {
      const c = l.split('|').slice(1, -1).map((x) => x.trim());
      const outcome = c[0].replace(/\*/g, '');
      const kind = KIND_OF_OUTCOME.find(([re]) => re.test(outcome))?.[1] ?? '';
      const p = parseCell(c[1], ids);
      for (const u of p.unparsed) un.add(f, i + 1, u, 'clash outcome');
      const effects = p.effects
        .filter((e) => e.k !== 'event' || ids.events.has(e.id))
        .map((e) => (e.k === 'stat' ? { ...e, stat: e.stat.split(/\s+/).pop()! } : e));
      cur.outcomes.push({ outcome, kind, text: c[1], effects, src: `${rel(f)}:${i + 1}` } as ClashOutcome);
    } else if (inTable && !l.startsWith('|')) inTable = false;
  }
  void CODE;
  const opener = findTable(f, /เงื่อนไขเปิดศึก/, 'รหัส');
  const std = findTable(f, /ผลมาตรฐาน/, 'ผล');
  const mem = findTable(f, /ความจำของศึก/, 'ข้อ');
  const audit = findTable(f, /ผลไล่ตรวจ/, 'ผล');
  const common = lines.slice(lines.findIndex((x) => x.startsWith('กติการ่วม')) + 1).filter((x) => x.startsWith('- ')).slice(0, 8).map((x) => x.slice(2));
  return {
    counts: { total: items.length },
    openers: opener.rows.map((r) => ({ code: r.cells[0].replace(/\*/g, ''), name: r.cells[1], when: r.cells[2], chance: r.cells[3] })),
    common,
    standard: std.rows.map((r) => ({ result: r.cells[0].replace(/\*/g, ''), npcLine: r.cells[1], axis: r.cells[2], hero: r.cells[3] })),
    memory: mem.rows.map((r) => ({ key: r.cells[0], rule: r.cells[1] })),
    audit: audit.rows.map((r) => ({ result: r.cells[0], clash: r.cells[1], why: r.cells[2] })),
    items,
  };
}

// ---------- combat.json ----------
function matrixTable(t: Table, kindCol = 0) {
  const tagsHead = t.header.slice(1).map((h) => ticks(h)[0] ?? THAI_TAG[h.replace(/\s.*$/, '')] ?? h);
  const out: Record<string, Record<string, MatrixCell>> = {};
  const kinds: { id: string; name: string }[] = [];
  for (const r of t.rows) {
    const cell = r.cells[kindCol];
    const id = ticks(cell)[0] ?? (cell.startsWith('คนและเผ่า') ? 'humanoid' : (KIND_THAI[cell.trim()] ?? cell.trim()));
    out[id] = {};
    tagsHead.forEach((tag, i) => (out[id][tag] = markOf(r.cells[i + 1] ?? '')));
    kinds.push({ id, name: cell.replace(/`[^`]+`/g, '').trim() });
  }
  return { out, kinds };
}

function combat(): CombatData {
  const core = C + '01-core.md';
  const tm = C + '02-type-matrix.md';
  const enc = C + '04-encounters.md';
  const rew = C + '05-rewards.md';
  const dr = C + '06-dragon-encounters.md';
  const stanceT = findTable(core, /ท่าทีของตัวละคร/, 'ท่าที');
  const STANCE_ID = ['melee', 'ranged', 'magic', 'guard', 'negotiate', 'calm_beast', 'evade', 'pray', 'flee'];
  const bonusT = findTable(core, /โบนัสและ DC/, 'ส่วน');
  const mulT = findTable(core, /ความเสียหายและบาดแผล/, 'ตัวคูณลดความเสียหาย');
  const woundT = findTable(core, /ความเสียหายและบาดแผล/, 'ผลทอย d100');
  const orderT = findTable(core, /ลำดับการต่อสู้/, 'ลำดับ');
  const tierT = findTable(core, /ลำดับการต่อสู้/, 'ระดับศัตรู');
  const baseT = findTable(core, /ของเดิมในโค้ด/, 'ส่วน');
  const chooseT = findTable(core, /ตัวละครเลือกท่าที/, 'เงื่อนไข');
  const resT = findTable(core, /ผลของการต่อสู้/, 'ผล');
  const godT = findTable(core, /พระเจ้าแทรกแซง/, 'ช่วง');
  const bv = (p: string) => bonusT.rows.find((r) => r.cells[0].startsWith(p))!;
  const apt = nums(bv('skill ของความถนัด').cells[1]);
  const first = nums(bv('ได้เปรียบหรือถูกซุ่ม').cells[1]);
  const lowHp = nums(bv('สภาพร่างกาย').cells[1]);
  const wk = nums(bv('แท็กที่ศัตรูแพ้').cells[1]);
  const ally = nums(bv('พวกพ้อง NPC').cells[1]);
  const baseRoll = baseT.rows.find((r) => r.cells[0] === 'ผล')!.cells[1];
  const dcDamage = Number(baseRoll.match(/DC\s*×\s*([\d.]+)/)![1]);

  const phys = matrixTable(findTable(tm, /ตารางกายภาพ/, 'ชนิดศัตรู'));
  const elem = matrixTable(findTable(tm, /ตารางธาตุ/, 'ชนิดศัตรู'));
  const spec = matrixTable(findTable(tm, /ศักดิ์สิทธิ์ ความมืด/, 'ชนิดศัตรู'));
  const allKinds = new Map<string, string>();
  for (const k of [...phys.kinds, ...elem.kinds, ...spec.kinds]) if (!allKinds.has(k.id)) allKinds.set(k.id, k.name);
  const ma = findTable(tm, null, 'สัญลักษณ์');
  const mr = findTable(tm, /แท็กการโจมตีของตัวละครมาจากไหน/, 'ที่มา');
  const traitT = findTable(tm, /ลักษณะเสริม/, 'ลักษณะ');
  const raceT = findTable(tm, /เผ่าที่เล่นได้/, 'เผ่าของศัตรู');
  const sanT = findTable(tm, /ความสมเหตุสมผล/, 'ID');
  const tagCount = new Set([...Object.values(phys.out), ...Object.values(elem.out), ...Object.values(spec.out)].flatMap((v) => Object.keys(v))).size;

  const flagT = findTable(enc, /ธงโลกเปลี่ยนศัตรู/, 'ธงหรือเหตุการณ์');
  const jobT = findTable(enc, /อาชีพเปลี่ยนการต่อสู้/, 'อาชีพ');
  const clashT = findTable(enc, /ปะทะกับ NPC/, 'เงื่อนไข');
  const encText = readDoc(enc);
  const capM = encText.match(/ไม่เกิน\s*(\d+)\s*ครั้งต่อปี\s*\(ยกเว้นทหารในสงครามและนักผจญภัย ไม่เกิน\s*(\d+)\)\s*และบอสไม่เกินปีละ\s*(\d+)/);
  if (!capM) throw new Error('combat: encounter cap sentence changed');
  const base = encText.match(/โอกาสต่อฤดู\s*=\s*([\d.]+)%.*?โชค\s*×\s*([\d.]+)%/s)!;
  const tagM = encText.match(/monster_ward หรือ smell ×([\d.]+).*?monster_lure ×([\d.]+).*?เด็ก ×([\d.]+)/s)!;
  const raidP = findTable(enc, /บุกหมู่บ้าน/, 'ช่วง');
  const raidR = findTable(enc, /บุกหมู่บ้าน/, 'ผล');
  const massT = findTable(enc, /ศึกใหญ่/, 'บทบาท');
  const typeT = findTable(enc, /แบบของเหตุการณ์ต่อสู้/, 'แบบ');

  const rewT = findTable(rew, /ตารางสุ่มรางวัลพิเศษ/, 'ระดับศัตรู');
  const matT = findTable(rew, /วัสดุ/, 'ชนิดศัตรู');
  const wepT = findTable(rew, /อาวุธที่สุ่มได้/, 'ศัตรู');
  const giftT = findTable(rew, /พรและคำสาป/, 'ชนิดศัตรู');
  const nonT = findTable(rew, /ชนะโดยไม่ฆ่า/, 'วิธี');
  const titT = findTable(rew, /ฉายาและสถิติ/, 'เงื่อนไข');
  const twoT = findTable(rew, /สองรูป/, 'รูป');

  const dgT = findTable(dr, null, 'แบบ', 0);
  const wildT = findTable(dr, /มังกรป่า/, 'ผล');
  const meetT = findTable(dr, /แบบของการพบ/, 'แบบ');
  const woundD = findTable(dr, /การต่อสู้จริง/, 'เงื่อนไขทำแผลได้');
  const resD = findTable(dr, /การต่อสู้จริง/, 'ผล');
  const testT = findTable(dr, /การทดสอบของมังกร/, 'มังกร');

  const pc = (s: string) => (pct(s) ?? 0) / 100;
  void pc;
  const p100 = (s: string) => Number(s.replace('%', '')) / 100;
  const tiers = tierT.rows.map((r) => {
    const n = nums(r.cells[1]);
    return { tier: r.cells[0], id: TIER_ID[r.cells[0]], wounds: [n[0], n[1] ?? n[0]] as [number, number], maxBeats: Number(r.cells[2]), examples: r.cells[3] };
  });
  return {
    counts: { stances: stanceT.rows.length, kinds: allKinds.size, attackTags: tagCount, sanityRules: sanT.rows.length },
    base: baseT.rows.map((r) => ({ row: r.cells[0], code: r.cells[1] })),
    order: orderT.rows.map((r) => ({ n: Number(r.cells[0]), name: r.cells[1], what: r.cells[2] })),
    tiers,
    stances: stanceT.rows.map((r, i) => ({ id: STANCE_ID[i], name: r.cells[0], stat: r.cells[1], tags: r.cells[2].split(/\s+/), needs: r.cells[3], src: src(stanceT, r.line) })),
    roll: {
      statDiv: 2,
      d20: { critSuccess: 20, critFail: 1 },
      aptBonus: { 1: apt[1], 2: apt[3], 3: apt[5] },
      weak: wk[0],
      veryWeak: wk[1],
      resist: nums(bv('แท็กที่ศัตรูทน').cells[1])[0],
      selfHandicap: nums(bv('แท็กที่ทำให้ตัวเองเสียเปรียบ').cells[1])[0],
      allyPerPerson: ally[0],
      allyCap: ally[1],
      lowHp: { below: lowHp[0] / 100, bonus: lowHp[1] },
      firstBeat: { advantage: first[0], ambush: first[1] },
      elementMatch: num(bv('ธาตุของอาวุธ').cells[1])!,
      heroLuck: nums(bv('`hero_luck`').cells[1])[0],
      dull: nums(bv('`hero_luck`').cells[1])[1],
      rows: bonusT.rows.map((r) => ({ part: r.cells[0], value: r.cells[1], note: r.cells[2] ?? '', src: src(bonusT, r.line) })),
    },
    damage: {
      multipliers: mulT.rows.map((r) => ({ what: r.cells[0], value: r.cells[1], nums: nums(r.cells[1].replace(/×/g, ' ')), src: src(mulT, r.line) })),
      wounds: woundT.rows.map((r) => ({ from: nums(r.cells[0].replace(/–/g, ' '))[0], to: nums(r.cells[0].replace(/–/g, ' '))[1], result: r.cells[1] })),
      dcDamage,
    },
    choice: chooseT.rows.map((r) => ({ cond: r.cells[0], effect: r.cells[1], src: src(chooseT, r.line) })),
    results: resT.rows.map((r) => ({ result: r.cells[0], cond: r.cells[1], effect: r.cells[2] })),
    godInterventions: godT.rows.map((r) => ({ when: r.cells[0], act: r.cells[1], effect: r.cells[2] })),
    matrix: {
      symbols: ma.rows.map((r) => ({ mark: r.cells[0], meaning: r.cells[1], bonus: r.cells[2] })),
      attackSources: mr.rows.map((r) => ({ from: r.cells[0], tags: r.cells[1] })),
      physical: phys.out,
      element: elem.out,
      special: spec.out,
      kinds: [...allKinds].map(([id, name]) => ({ id, name })),
      traits: traitT.rows.map((r) => ({ trait: r.cells[0], effect: r.cells[1] })),
      playableAsEnemy: raceT.rows.map((r) => ({ race: r.cells[0], kind: r.cells[1], weak: r.cells[2], resist: r.cells[3] })),
      sanity: sanT.rows.map((r) => ({ id: r.cells[0], cond: r.cells[1], effect: r.cells[2] })),
    },
    encounters: {
      base: Number(base[1]) / 100,
      luckFactor: Number(base[2]) / 100,
      capPerYear: Number(capM[1]),
      capPerYearSoldier: Number(capM[2]),
      bossPerYear: Number(capM[3]),
      tagMults: { monsterWard: Number(tagM[1]), monsterLure: Number(tagM[2]), child: Number(tagM[3]) },
      types: typeT.rows.map((r) => ({ type: r.cells[0].replace(/\*/g, ''), when: r.cells[1], feature: r.cells[2] })),
      worldFlags: flagT.rows.map((r) => ({ flag: r.cells[0], mult: mult(r.cells[1]) ?? 1, enemies: r.cells[2].split(/\s+/).filter((x) => /^[a-z_]+$/.test(x)), src: src(flagT, r.line) })),
      jobs: jobT.rows.map((r) => ({ jobs: r.cells[0].split(/\s+/).filter((x) => /^[a-z_]+$/.test(x)), mult: mult(r.cells[1]) ?? 1, effect: r.cells[2] })),
      raid: {
        phases: raidP.rows.map((r) => ({ phase: r.cells[0], what: r.cells[1], choices: r.cells[2] })),
        results: raidR.rows.map((r) => ({ result: r.cells[0], town: r.cells[1], npcs: r.cells[2], hero: r.cells[3] })),
      },
      npcClashChance: clashT.rows.map((r) => ({ cond: r.cells[0], event: r.cells[1], chance: r.cells[2], perYear: /ต่อปี|%/.test(r.cells[2]) && !/ทันที/.test(r.cells[2]) ? p100(r.cells[2].match(/\d+%/)?.[0] ?? '0') : null })),
      mass: massT.rows.map((r) => ({ role: r.cells[0], stat: r.cells[1], dc: Number(r.cells[2]), result: r.cells[3] })),
    },
    rewards: {
      byTier: rewT.rows.map((r) => ({ tier: r.cells[0], material: p100(r.cells[1]), weapon: p100(r.cells[2]), blessing: p100(r.cells[3]), curse: p100(r.cells[4]), skill: p100(r.cells[5]) })),
      material: matT.rows.map((r) => ({ kind: r.cells[0], materials: r.cells[1], use: r.cells[2] })),
      weapon: wepT.rows.map((r) => ({ enemy: r.cells[0], kind: r.cells[1], element: r.cells[2] })),
      gifts: giftT.rows.map((r) => ({ kind: r.cells[0], blessings: ticks(r.cells[1]), curses: ticks(r.cells[2]) })),
      nonKill: nonT.rows.map((r) => ({ how: r.cells[0], reward: r.cells[1] })),
      titles: titT.rows.map((r) => ({ cond: r.cells[0], title: r.cells[1] })),
      twoForms: twoT.rows.map((r) => ({ form: r.cells[0], win: r.cells[1], winNoKill: r.cells[2], lose: r.cells[3] ?? '' })),
    },
    dragons: {
      rows: dgT.rows.map((r) => ({ kind: r.cells[0], example: r.cells[1], killable: r.cells[2], world: r.cells[3] })),
      wild: wildT.rows.map((r) => ({ result: r.cells[0], loot: r.cells[1] })),
      meet: meetT.rows.map((r) => ({ type: r.cells[0].replace(/\*/g, ''), when: r.cells[1], feature: r.cells[2], stance: r.cells[3] })),
      wound: woundD.rows.map((r) => ({ cond: r.cells[0], from: r.cells[1] })),
      result: resD.rows.map((r) => ({ result: r.cells[0], detail: r.cells[1] })),
      tests: testT.rows.map((r) => ({ dragon: r.cells[0], place: r.cells[1], test: r.cells[2], stat: r.cells[3], badge: r.cells[4] })),
    },
  };
}

export default function run() {
  const combatData = combat();
  const enemyData = enemies();
  const clashData = clashes();
  const files = listDocs('docs/systems/combat');
  writeGen('combat', combatData, files.filter((f) => !/03-enemies|07-npc/.test(f)), GEN);
  writeGen('enemies', enemyData, [C + '03-enemies.md'], GEN);
  writeGen('clashes', clashData, [C + '07-npc-clashes.md'], GEN);
  void parts;
  return finish('combat', ['combat.json', 'enemies.json', 'clashes.json'], un);
}
