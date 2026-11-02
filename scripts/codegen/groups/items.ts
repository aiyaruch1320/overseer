// Items generator: weapons, materials, other items, forging (code-plan §5.1, row "ไอเทม").
// Reads docs/systems/items/*, docs/appearance/05 06 07 10 (weapon UI values) and the price base table of economy/04 §7.
// Writes data/gen/weapons.json items.json materials.json forging.json.
import type { GenReport } from '../run-all';
import { finish, findTable, nums, num, parts, pct, recs, ruleRows, section, src, statsOf, tagsOf, ticks, dash, mult, rel, tables, Unparsed } from '../helpers-m0b';
import { versionOf, writeGen, listDocs, readDoc } from '../lib/table';
import type { Ability, BioMaterial, ForgingData, ForgingTrial, TrialPath, Item, ItemCat, ItemsData, Material, MaterialsData, Rarity, Weapon, WeaponGroup, WeaponJobSet, WeaponsData, WeaponUi } from '../../../src/core/data/types-items';

const D = 'docs/systems/items/';
const A = 'docs/appearance/';
const GEN = 'scripts/codegen/groups/items.ts';
const un = new Unparsed('items');
const NPC_RE = /\b([A-Z]{2}\d{2}-\d)\b/g;

// ---------- abilities (README §3) ----------
const KIND_WORDS: Record<string, string> = { ผู้ตาย: 'undead', วิญญาณ: 'spirit', สิ่งจากหมอก: 'fog', ปีศาจ: 'demon', สัตว์ป่า: 'beast', แวมไพร์: 'vampire', มังกร: 'dragon' };

function parseAbilities(cell: string, at: string): Ability[] {
  const text = dash(cell);
  if (!text) return [];
  const out: Ability[] = [];
  for (const seg of parts(text)) {
    let m: RegExpMatchArray | null;
    let a: Ability;
    if (/^ยาว/.test(seg)) a = { k: 'reach', text: seg };
    else if (/^ปัด/.test(seg)) a = { k: 'parry', text: seg };
    else if (/^(สองมือ|ใช้กับโล่ไม่ได้)/.test(seg)) a = { k: 'twohand', text: seg };
    else if (/^ซ่อน/.test(seg)) a = { k: 'conceal', text: seg };
    else if (/^ไม่ทื่อ/.test(seg)) a = { k: 'unbreakable', text: seg };
    else if (/^เครื่องมือ/.test(seg)) a = { k: 'tool', text: seg, apt: ticks(seg)[0] };
    else if (/^พิษ/.test(seg)) a = { k: 'poison', text: seg };
    else if (/^ข่ม/.test(seg)) a = { k: 'intimidate', text: seg };
    else if (/^สลักชื่อ/.test(seg)) a = { k: 'engrave', text: seg };
    else if (/^ผูกเจ้าของ/.test(seg)) a = { k: 'bound', text: seg };
    else if ((m = seg.match(/^ไล่\s*(.*)$/))) {
      const words = Object.keys(KIND_WORDS).filter((w) => m![1].startsWith(w) || m![1].includes(w + ' '));
      a = { k: 'repel', text: seg, codes: ticks(seg), words: words.map((w) => KIND_WORDS[w]) };
    } else if ((m = seg.match(/^ท่าที(\S+)\s*([+\-−]\d+)/))) a = { k: 'stance', text: seg, stance: m[1], n: Number(m[2].replace('−', '-')) };
    else if ((m = seg.match(/ทอยทื่อ(?:เหลือ)?\s*(\d+)%/))) a = { k: 'dull', text: seg, n: Number(m[1]) / 100 };
    else if ((m = seg.match(/^(.+?)\s*([+\-−]\d+(?:\.\d+)?)(%)?(?:\s*\((.*)\))?$/)) && !/ทอยทื่อ/.test(seg)) a = { k: 'bonus', text: seg, subject: m[1].trim(), n: Number(m[2].replace('−', '-')) / (m[3] ? 100 : 1), pct: !!m[3] };
    else {
      a = { k: 'text', text: seg };
      if (/\d|%/.test(seg)) un.add(at.split(':')[0], Number(at.split(':')[1]) || 0, seg, 'ability with a number');
    }
    out.push(a);
  }
  return out;
}

// ---------- weapon types → aptitude (README §2) ----------
const TYPE_APT: Record<string, string> = { ดาบ: 'sword', ขวาน: 'axe', หอก: 'spear', ธนู: 'bow', มีดสั้น: 'dagger', มวย: 'unarmed', โล่: 'shield', ค้อน: 'hammer', แส้: 'whip', หนังสติ๊ก: 'sling', ปืน: 'bow', เวท: 'magic' };

function parseUi(raw: string): WeaponUi {
  const ui: WeaponUi = { raw, colors: [] };
  for (const seg of parts(raw)) {
    let m: RegExpMatchArray | null;
    if ((m = seg.match(/^ทรง\s*(.*)/))) ui.shape = m[1];
    else if ((m = seg.match(/^ยาว\s*([\d.]+)\s*×/))) ui.len = Number(m[1]);
    else if ((m = seg.match(/^สี\s*(.*)/))) ui.colors = m[1].match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    else if ((m = seg.match(/^วัสดุหลัก\s*(.*)/))) ui.material = m[1];
    else if ((m = seg.match(/^เอฟเฟกต์\s*(.*)/))) ui.effect = m[1];
    else if ((m = seg.match(/^ท่า\s*(.*)/))) ui.pose = m[1];
    else if ((m = seg.match(/^ขนาด\s*(.*)/))) ui.size = m[1];
  }
  return ui;
}

function weaponUis(): Map<string, WeaponUi> {
  const out = new Map<string, WeaponUi>();
  for (const f of ['05-weapons-rules.md', '06-legendary-weapons.md', '07-regional-and-forge-weapons.md']) {
    for (const t of tables(A + f)) {
      if (t.header[0] !== 'ID' || t.header[3] !== 'ค่า UI') continue;
      for (const r of t.rows) if (/^w[a-z]_/.test(r.cells[0])) out.set(r.cells[0], parseUi(r.cells[3]));
    }
  }
  return out;
}

function jobSets(): WeaponJobSet[] {
  const out: WeaponJobSet[] = [];
  const f = A + '10-job-weapons.md';
  for (const t of tables(f)) {
    if (t.header[0] !== 'ชุด') continue;
    for (const r of t.rows) {
      const job = ticks(r.cells[0])[0];
      const tiers = [...r.cells[1].matchAll(/\*\*([A-Z])\*\*\s*(.+?)\s*\((.+?)\)/g)].map((m) => ({ rarity: m[1] as Rarity, name: m[2], type: m[3] }));
      const ui = r.cells[3];
      const segs = parts(ui);
      const shapes = (segs[0] ?? '').replace(/^ทรง\s*/, '').split(/\s*\/\s*/);
      const colors = ui.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
      const motif = segs.slice(2).join(' · ');
      out.push({ job, group: t.headings.slice(-1)[0], tiers, ui: { raw: ui, shapes, colors, motif }, src: src(t, r.line) });
    }
  }
  return out;
}

// ---------- weapons ----------
function readWeapons(uis: Map<string, WeaponUi>) {
  const list: Weapon[] = [];
  const add = (file: string, head: RegExp | null, first: string, group: WeaponGroup, extra: (w: Weapon, r: Record<string, string>) => void, nth = 0) => {
    const t = findTable(D + file, head, first, nth);
    for (const r of recs(t, ['id', 'name', 'rarity', 'power', 'type', 'tags', 'stats', 'ability', 'last'])) {
      if (!/^w[a-z]_/.test(r.id)) continue;
      const at = src(t, r._line);
      const w: Weapon = {
        id: r.id,
        name: r.name,
        rarity: r.rarity as Rarity,
        power: Number(r.power),
        type: r.type,
        apt: TYPE_APT[r.type] ?? '',
        tags: tagsOf(r.tags),
        stats: statsOf(r.stats),
        abilities: parseAbilities(r.ability, at),
        origin: r.last,
        group,
        npcs: [...new Set([...r.last.matchAll(NPC_RE)].map((m) => m[1]))],
        src: at,
      };
      extra(w, r);
      const ui = uis.get(w.id);
      if (ui) w.ui = ui;
      list.push(w);
    }
  };
  add('01-everyday-and-standard.md', /ของใช้ที่หยิบ/, 'ID', 'everyday', () => {});
  add('01-everyday-and-standard.md', /อาวุธมาตรฐาน/, 'ID', 'standard', (w, r) => {
    w.materialGroup = (dash(r.last) as 'โลหะ' | 'ไม้' | '') || '';
    w.origin = '';
  });
  for (const f of ['03-job-weapons-common-1.md', '04-job-weapons-common-2.md']) add(f, null, 'ID', 'job', (w) => { w.job = w.id.match(/^wj_(.+)_[cure]$/)?.[1]; });
  add('05-job-weapons-secret-special.md', /1\. อาชีพลับ/, 'ID', 'job_secret', (w) => { w.job = w.id.match(/^wj_(.+)_[cure]$/)?.[1]; });
  add('05-job-weapons-secret-special.md', /2\. อาชีพพิเศษ/, 'ID', 'job_special', (w) => { w.job = w.id.match(/^wj_(.+)_[cure]$/)?.[1]; });
  add('06-regional-weapons.md', /อาวุธประจำประเทศ/, 'ID', 'country', () => {});
  add('06-regional-weapons.md', /อาวุธประจำทวีป/, 'ID', 'continent', () => {});
  add('07-forge-weapons.md', /2\. อาวุธ/, 'ID', 'forge', (w) => { w.forge = w.id.match(/^wf_(.+)_\d+$/)?.[1]; });
  add('08-legendary.md', /ตารางรวม/, 'ID', 'legend', (w, r) => { w.returnTo = r.last; w.origin = ''; });
  // wi_ rows carry the "where found" column in `last`
  return list;
}

const POWER: Record<string, number> = { C: 1, U: 2, R: 3 };
const addStats = (a: Record<string, number>, b: Record<string, number>) => {
  const o: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v;
  for (const k of Object.keys(o)) if (o[k] === 0) delete o[k];
  return Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
};

function readMaterials(): Material[] {
  const out: Material[] = [];
  const looks = new Map<string, Material['look']>();
  const lt = findTable(A + '05-weapons-rules.md', /วัสดุ 17/, 'ID');
  for (const r of recs(lt, ['id', 'name', 'main', 'second', 'surface', 'mark'])) looks.set(r.id, { main: r.main, second: r.second, surface: r.surface, mark: r.mark });
  for (const [head, group] of [[/วัสดุโลหะ/, 'โลหะ'], [/วัสดุไม้/, 'ไม้']] as const) {
    const t = findTable(D + '02-materials.md', head, 'ID');
    for (const r of recs(t, ['id', 'name', 'rarity', 'stats', 'tags', 'ability', 'excl', 'found'])) {
      const at = src(t, r._line);
      const dup = out.find((x) => x.id === r.id);
      if (dup) {
        dup.groups.push(group);
        continue;
      }
      out.push({
        id: r.id,
        name: r.name,
        rarity: r.rarity as Rarity,
        groups: [group],
        stats: statsOf(r.stats),
        tags: tagsOf(r.tags).concat(dash(r.tags) && !ticks(r.tags).length && r.tags !== '—' ? [] : []),
        abilities: parseAbilities(r.ability, at),
        excludes: dash(r.excl) ? r.excl.split(/\s+/) : [],
        found: r.found,
        look: looks.get(r.id),
        src: at,
      });
    }
  }
  return out;
}

/** "ตะบองไม้" + "ไม้ป่าเหี่ยว" → "ตะบองไม้ป่าเหี่ยว": the word the weapon already ends with is not said twice (review L3). */
export function variantName(weapon: string, material: string): string {
  for (let k = Math.min(weapon.length, material.length); k >= 2; k--) if (weapon.endsWith(material.slice(0, k))) return weapon + material.slice(k);
  return weapon + material;
}

function variants(weapons: Weapon[], mats: Material[]): Weapon[] {
  const out: Weapon[] = [];
  for (const w of weapons.filter((x) => x.group === 'standard' && x.materialGroup)) {
    for (const m of mats) {
      if (!m.groups.includes(w.materialGroup as 'โลหะ' | 'ไม้') || m.excludes.includes(w.type)) continue;
      out.push({
        id: `${w.id}_${m.id}`,
        name: variantName(w.name, m.name),
        rarity: m.rarity,
        power: POWER[m.rarity],
        type: w.type,
        apt: w.apt,
        tags: [...w.tags, ...m.tags.filter((t) => !w.tags.includes(t))],
        stats: addStats(w.stats, m.stats),
        abilities: [...w.abilities, ...m.abilities],
        origin: '',
        group: 'material',
        from: { base: w.id, material: m.id },
        npcs: [],
        src: w.src,
      });
    }
  }
  return out;
}

function weaponsData(): { data: WeaponsData; hand: Weapon[]; vars: Weapon[]; mats: Material[] } {
  const uis = weaponUis();
  const hand = readWeapons(uis);
  const mats = readMaterials();
  const vars = variants(hand, mats);
  const all = [...hand, ...vars];
  const ids = new Set<string>();
  for (const w of all) {
    if (ids.has(w.id)) throw new Error('duplicate weapon id ' + w.id);
    ids.add(w.id);
  }
  const byRarity: Record<string, number> = {};
  for (const w of all) byRarity[w.rarity] = (byRarity[w.rarity] ?? 0) + 1;

  const rt = findTable(D + 'README.md', /ระดับความหายาก/, 'ระดับ');
  const rarity = rt.rows.map((r) => {
    const rng = (s: string): [number, number] => {
      const n = nums(s.replace(/\+/g, ''));
      return n.length >= 2 ? [n[0], n[1]] : [n[0] ?? 0, n[0] ?? 0];
    };
    return { rarity: r.cells[0] as Rarity, name: r.cells[1], weight: dash(r.cells[2]) ? num(r.cells[2]) : null, power: rng(r.cells[3]), statBudget: rng(r.cells[4].replace(/ไม่เกิน/, '0 ถึง')), src: src(rt, r.line) };
  });
  const tt = findTable(D + 'README.md', /ประเภทและความถนัด/, 'กลุ่ม');
  const types = tt.rows.map((r) => ({ type: r.cells[0], apt: ticks(r.cells[1]).join(' '), tags: ticks(r.cells[2]), src: src(tt, r.line) }));
  const st = findTable(D + '01-everyday-and-standard.md', /ประเภทเริ่มต้น/, 'ความถนัด');
  const startTypes = st.rows.map((r) => ({ apt: ticks(r.cells[0])[0] ?? r.cells[0], type: r.cells[1] }));
  const abT = findTable(D + 'README.md', /ความสามารถ/, 'คำ');
  const sT = findTable(D + 'README.md', /ทางที่ได้อาวุธ/, 'ทาง');
  const shT = findTable(A + '05-weapons-rules.md', /ทรงตามประเภท/, 'ประเภท');
  const frT = findTable(A + '05-weapons-rules.md', /การตกแต่งตามระดับ/, 'ระดับ');
  const efT = findTable(A + '05-weapons-rules.md', /เอฟเฟกต์ตามแท็ก/, 'ลำดับ');
  const wrT = findTable(A + '05-weapons-rules.md', /ร่องรอย/, 'ที่มา');
  const data: WeaponsData = {
    counts: { handWritten: hand.length, variants: vars.length, total: all.length, byRarity },
    rarity,
    types,
    startTypes,
    abilityWords: abT.rows.map((r) => ({ word: r.cells[0], text: r.cells[1] })),
    sourcesByRoute: sT.rows.map((r) => ({ route: r.cells[0], rarities: r.cells[1], note: r.cells[2] ?? '' })),
    ui: {
      shapes: shT.rows.map((r) => ({ type: r.cells[0], shape: r.cells[1], size: r.cells[2], grip: r.cells[3], focus: r.cells[4] })),
      tierFrames: frT.rows.map((r) => ({ rarity: r.cells[0], finish: r.cells[1], trim: r.cells[2], glow: r.cells[3], frame: r.cells[4] })),
      tagEffects: efT.rows.map((r) => ({ order: Number(r.cells[0]), tags: ticks(r.cells[1]), effect: r.cells[2], colors: r.cells[3].match(/#[0-9a-fA-F]{3,8}/g) ?? [] })),
      wear: wrT.rows.map((r) => ({ source: r.cells[0], trace: r.cells[1] })),
    },
    jobSets: jobSets(),
    items: all,
  };
  return { data, hand, vars, mats };
}

// ---------- materials.json ----------
function materialsData(mats: Material[]): MaterialsData {
  const mt = findTable(D + '02-materials.md', /กติกาการรวม/, 'ช่อง');
  const bio: BioMaterial[] = [];
  const t = findTable(D + '18-materials-and-keys.md', /วัสดุจากสิ่งมีชีวิต/, 'ID');
  const base = priceBase();
  for (const r of recs(t, ['id', 'name', 'tier', 'from', 'usedFor', 'found'])) {
    bio.push({ id: r.id, name: r.name, rarity: r.tier as Rarity, from: r.from, enemies: ticks(r.from), usedFor: r.usedFor, found: r.found, price: priceOf('material', r.tier as Rarity, 0, 0, base), src: src(t, r._line) });
  }
  const links = readDoc(D + '02-materials.md').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  return {
    mergeRules: mt.rows.map((r) => ({ field: r.cells[0], rule: r.cells[1] })),
    variantPower: POWER,
    materials: mats,
    bio,
    worldLinks: links,
  };
}

// ---------- prices ----------
type PriceBase = { byCat: Record<string, Record<string, number | null>>; mid: Record<string, number>; perStat: number; perTag: number; tagCap: number; clamp: [number, number]; weapon: Record<string, number | null>; labels: { cat: string; label: string; byTier: Record<string, number | null> }[] };
const TIERS = ['C', 'U', 'R', 'E', 'L'];
const CAT_LABEL: Record<string, string> = { armor: 'เกราะและโล่', accessory: 'เครื่องประดับ', folk: 'ของขลังพื้นบ้าน', talisman: 'เครื่องรางโบราณ', consumable: 'ของใช้ในศึก', tool: 'เครื่องมือชีวิต', material: 'วัสดุจากสิ่งมีชีวิต', weapon: 'อาวุธ' };

function cellPrice(s: string): number | null {
  const t = s.replace(/(\d),(\d{3})/g, '$1$2');
  if (/ไม่ขาย/.test(t) || t === '—' || !/\d/.test(t)) return null;
  const range = t.match(/(\d+)\s*ถึง\s*(\d+)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  return Number(t.match(/\d+(?:\.\d+)?/)![0]);
}

let _pb: PriceBase | null = null;
function priceBase(): PriceBase {
  if (_pb) return _pb;
  const t = findTable('docs/systems/economy/04-income-and-living.md', /ราคาของ/, 'หมวด');
  const byCat: Record<string, Record<string, number | null>> = {};
  const labels: PriceBase['labels'] = [];
  let weapon: Record<string, number | null> = {};
  for (const r of t.rows) {
    const cat = Object.entries(CAT_LABEL).find(([, l]) => r.cells[0].startsWith(l))?.[0];
    if (!cat) continue;
    const by: Record<string, number | null> = {};
    TIERS.forEach((tier, i) => (by[tier] = cellPrice(r.cells[i + 1] ?? '')));
    if (cat === 'weapon') weapon = by;
    else {
      byCat[cat] = by;
      labels.push({ cat, label: r.cells[0], byTier: by });
    }
  }
  // 19-prices.md §2 formula constants
  const f = findTable(D + '19-prices.md', /ตัวปรับของชิ้น/, 'ส่วน');
  const midCell = f.rows.find((r) => r.cells[0].startsWith('ค่ากลางของระดับ'))!.cells[1];
  const mid: Record<string, number> = {};
  for (const m of midCell.matchAll(/([CUREL])\s+([\d.]+)/g)) mid[m[1]] = Number(m[2]);
  const code = section(D + '19-prices.md', /ตัวปรับของชิ้น/).join('\n');
  const k = code.match(/1 \+ ([\d.]+) ×.*?\(1 \+ ([\d.]+) × จำนวนแท็ก\)/s);
  const clampRow = f.rows.find((r) => r.cells[0].startsWith('ช่วงของส่วนแรก'))!.cells[1];
  const cl = nums(clampRow);
  const capRow = f.rows.find((r) => r.cells[0].startsWith('จำนวนแท็ก'))!.cells[1];
  _pb = { byCat, mid, perStat: Number(k![1]), perTag: Number(k![2]), tagCap: nums(capRow).pop()!, clamp: [cl[0], cl[1]], weapon, labels };
  return _pb;
}

function priceOf(cat: string, tier: Rarity, net: number, tags: number, pb = priceBase()): number | null {
  if (cat === 'key' || cat === 'paired') return null;
  const base = pb.byCat[cat === 'ancient' ? 'talisman' : cat]?.[tier];
  if (base == null) return null;
  if (cat === 'consumable' || cat === 'material' || cat === 'tool') return Math.round(base);
  const adj = Math.min(pb.clamp[1], Math.max(pb.clamp[0], 1 + pb.perStat * (net - (pb.mid[tier] ?? 0))));
  const tg = 1 + pb.perTag * Math.min(pb.tagCap, tags);
  return Math.round(base * adj * tg);
}

// ---------- non-weapon items ----------
function readItems(): Item[] {
  const out: Item[] = [];
  const net = (stats: Record<string, number>) => Object.values(stats).reduce((a, b) => a + b, 0);
  const push = (it: Omit<Item, 'price' | 'stats' | 'tags' | 'abilities' | 'where' | 'story'> & Partial<Item>, statCell = '', tagCell = '') => {
    const stats = statsOf(statCell);
    const tags = tagsOf(tagCell);
    // the price formula counts tags starting with # (19-prices §2); the catalog script counts every `#tag` in the whole row
    const hashTags = it.tags ? it.tags.length : tags.filter((t) => t.startsWith('#')).length;
    const cat = it.cat;
    const price = priceOf(cat === 'talisman' ? 'ancient' : cat, it.tier, net(stats), cat === 'consumable' || cat === 'material' || cat === 'tool' ? 0 : hashTags);
    out.push({ stats, tags, abilities: [], where: '', story: '', ...it, price } as Item);
  };
  const run = (file: string, head: RegExp | null, first: string, keys: string[], fn: (r: Record<string, string>, at: string, t: ReturnType<typeof findTable>) => void, nth = 0) => {
    const t = findTable(D + file, head, first, nth);
    for (const r of recs(t, keys)) if (/^[a-z]{2}_/.test(r.id)) fn(r, src(t, r._line), t);
  };
  run('12-armor.md', null, 'ID', ['id', 'name', 'tier', 'def', 'kind', 'tags', 'stats', 'ab', 'where'], (r, at) =>
    push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'armor', defense: Number(r.def), kind: r.kind, abilities: parseAbilities(r.ab, at), where: r.where, src: at }, r.stats, r.tags));
  run('13-accessories.md', null, 'ID', ['id', 'name', 'tier', 'slot', 'kind', 'tags', 'stats', 'ab', 'where'], (r, at) =>
    push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'accessory', slot: r.slot, kind: r.kind, abilities: parseAbilities(r.ab, at), where: r.where, src: at }, r.stats, r.tags));
  for (const nth of [0, 1]) {
    run('14-talismans.md', null, 'ID', ['id', 'name', 'tier', 'haunt', 'kind', 'tags', 'stats', 'effect', 'where'], (r, at) => {
      const [boon, cost] = r.effect.split(/ราคา:\s*/);
      push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: nth === 0 ? 'talisman' : 'folk', haunt: dash(r.haunt), kind: r.kind, boon: boon.replace(/\s*·\s*$/, '').trim(), cost: cost?.trim(), abilities: parseAbilities(boon.replace(/\s*·\s*$/, ''), at), where: r.where, src: at }, r.stats, r.tags);
    }, nth);
  }
  run('16-consumables.md', null, 'ID', ['id', 'name', 'tier', 'kind', 'tags', 'effect', 'useWhen', 'where'], (r, at) =>
    push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'consumable', kind: r.kind, effect: r.effect, useWhen: r.useWhen, where: r.where, src: at }, '', r.tags));
  run('17-life-tools.md', null, 'ID', ['id', 'name', 'tier', 'group', 'apt', 'effect', 'where'], (r, at) =>
    push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'tool', group: r.group, apt: ticks(r.apt)[0] ?? r.apt, effect: r.effect, where: r.where, src: at }));
  run('18-materials-and-keys.md', /วัสดุจากสิ่งมีชีวิต/, 'ID', ['id', 'name', 'tier', 'from', 'usedFor', 'found'], (r, at) =>
    push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'material', dropFrom: r.from, enemies: ticks(r.from), usedFor: r.usedFor, where: r.found, src: at }));
  for (const nth of [0, 1]) {
    run('18-materials-and-keys.md', /ของสำคัญ/, 'ID', ['id', 'name', 'tier', 'flags', 'where', 'story'], (r, at) =>
      push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'key', flags: ticks(r.flags), where: r.where, story: r.story, src: at }), nth);
  }
  const pt = findTable('docs/systems/bonds/06-paired-items.md', /ซีกของไอเทมคู่/, 'ID');
  for (const r of recs(pt, ['id', 'name', 'tier', 'stats'])) push({ id: r.id, name: r.name, tier: r.tier as Rarity, cat: 'paired', src: src(pt, r._line) }, r.stats);
  const ids = new Set<string>();
  for (const it of out) {
    if (ids.has(it.id)) throw new Error('duplicate item id ' + it.id);
    ids.add(it.id);
  }
  return out;
}

// ---------- items.json ----------
function itemsData(items: Item[]): ItemsData {
  const byCat: Record<string, number> = {};
  for (const i of items) byCat[i.cat] = (byCat[i.cat] ?? 0) + 1;
  const pb = priceBase();
  const sys = D + '11-item-system.md';
  const slotT = findTable(sys, /ช่องและงบ/, 'ช่อง');
  const tierT = findTable(sys, /ช่องและงบ/, 'ระดับ');
  const rng = (s: string): [number, number] => {
    const n = nums(s.replace(/ไม่เกิน/, '0 ถึง ').replace(/\+/g, ''));
    return n.length >= 2 ? [n[0], n[1]] : [n[0] ?? 0, n[0] ?? 0];
  };
  const wear = section(sys, /การสวมอัตโนมัติ/).join('\n');
  const formula = wear.match(/```\n([\s\S]*?)\n```/)?.[1]?.replace(/^คะแนน = /, '') ?? '';
  const wearT = findTable(sys, /การสวมอัตโนมัติ/, 'ข้อ');
  const armorT = findTable(sys, /เกราะกับการต่อสู้/, 'ตัวคูณ');
  const habitT = findTable(sys, /ของใช้ในศึก/, 'นิสัย');
  const toolT = findTable(sys, /เครื่องมือชีวิตช้า/, 'ข้อ');
  const srcT = findTable(sys, /ที่มาของไอเทม/, 'ที่มา');
  const p19 = D + '19-prices.md';
  const f1 = findTable(p19, /สูตร/, 'ส่วน');
  const idxRow = f1.rows.find((r) => r.cells[0].startsWith('ดัชนีราคา'))!;
  const priceIndex = nums(idxRow.cells[1].replace(/\(.*\)/, '').replace(/[×x]/g, ''));
  const incRow = findTable('docs/systems/economy/04-income-and-living.md', /รายได้ของอาชีพ/, 'ส่วน').rows.find((r) => r.cells[0].startsWith('ดัชนีรายได้'))!;
  const incomeIndex = nums(incRow.cells[1].replace(/\(.*\)/, ''));
  const baseRow = findTable('docs/systems/economy/04-income-and-living.md', /รายได้ของอาชีพ/, 'ส่วน').rows.find((r) => r.cells[0].startsWith('ฐานของอาชีพ'))!;
  const incomeBase: Record<string, number> = {};
  for (const m of baseRow.cells[1].matchAll(/([CURE])\s+(\d+)/g)) incomeBase[m[1]] = Number(m[2]);
  const placeT = findTable(p19, /ตัวปรับที่ซื้อ/, 'ที่');
  const sellT = findTable(p19, /ขายคืน/, 'ผู้ซื้อ');
  const svcT = findTable(p19, /บริการ/, 'บริการ');
  const chkT = findTable(p19, /ตรวจราคากับรายได้/, 'ระดับ');
  const shopT = findTable('docs/systems/economy/04-income-and-living.md', /ราคาของ/, 'ขนาดเมือง');
  const toolLife: Record<string, number> = {};
  for (const r of toolT.rows) if (r.cells[0] === 'เครื่องมือชำรุด') for (const m of r.cells[1].matchAll(/([CURE])\s+(\d+)\s*ปี/g)) toolLife[m[1]] = Number(m[2]);
  const bonusCap = (toolT.rows.find((r) => r.cells[0].startsWith('โบนัสเครื่องมือรวม')) ?? { cells: ['', ''] }).cells[1];
  // life tool payback (sim-items 'tools'): income base × tool bonus, price from the doc
  const toolPayback = chkT.rows
    .filter((r) => /^[CUR]$/.test(r.cells[0]))
    .map((r) => ({ tier: r.cells[0], base: incomeBase[r.cells[0]], price: num(r.cells[1])!, bonus: (pct(r.cells[2]) ?? 0), life: toolLife[r.cells[0]] }));

  // talisman story
  const ts = D + '15-talisman-stories.md';
  const st = tables(ts);
  const tb = (head: RegExp, first: string, nth = 0) => findTable(ts, head, first, nth);
  const oddsT = tb(/โอกาสต่อปี/, 'ระดับ');
  const modT = tb(/โอกาสต่อปี/, 'ตัวคูณ');
  const spT = tb(/ผู้สถิต 8 ชนิด/, 'ชนิด');
  const posT = tb(/การสิง/, 'ข้อ');
  const exT = tb(/ทางออก/, 'ทาง');
  const exSpT = tb(/ทางออก/, 'ชนิด');
  const twoT = tb(/ถือสองชิ้น/, 'กรณี');
  const heirT = tb(/ทายาทและมรดก/, 'ข้อ');
  const findT = tb(/การพบเครื่องราง/, 'สถานที่');
  const fcT = tb(/การพบเครื่องราง/, 'ทางเลือก');
  const gwT = tb(/หน้าต่างพระเจ้า/, 'ขั้น');
  const stT = tb(/ห้าขั้น/, 'ขั้น');
  void st;
  const np = D + '20-npc-talisman.md';
  const n = (head: RegExp, first: string) => findTable(np, head, first);
  const buyT = n(/ผู้ซื้อ 6 ชนิด/, 'ชนิด');
  const exNpcT = n(/ทางออกของ NPC/, 'ทาง');
  const BUYER_IDS = ['collector', 'dealer', 'priest', 'scholar', 'noble', 'fighter'];
  const exitOrder = exNpcT.rows.map((r) => r.cells[0].replace(/\s+/g, ' '));
  const simText = section(np, /ผลทดสอบด้วยการจำลอง/).join(' ');
  const g = (re: RegExp) => {
    const m = (re.source.includes('ปรับเป็น') ? section(np, /ผลทดสอบด้วยการจำลอง/).join(' ') : simText).match(re);
    if (!m) throw new Error('20-npc-talisman §11 sim paragraph changed: ' + re);
    return Number(m[1].replace(/,/g, ''));
  };
  const tierCounts: Record<string, number> = {};
  for (const i of items) if (i.cat === 'talisman') tierCounts[i.tier] = (tierCounts[i.tier] ?? 0) + 1;
  const exitWeights: Record<string, Record<string, number>> = {};
  BUYER_IDS.forEach((id, bi) => {
    exitWeights[id] = {};
    exNpcT.rows.forEach((r) => (exitWeights[id][r.cells[0].charAt(0)] = Number(r.cells[bi + 1])));
  });
  const kindNpc = (s: string) => [...s.matchAll(/\b([A-Z]{2}\d{2}-\d)\b/g)].map((m) => m[1]);
  const stageRows = n(/ขั้นของ NPC/, 'ขั้น');

  const data: ItemsData = {
    counts: { total: items.length, byCat, priced: items.filter((i) => i.price != null).length },
    slots: slotT.rows.map((r) => ({ slot: r.cells[0], count: r.cells[1], cat: r.cells[2] })),
    tiers: tierT.rows.map((r) => ({ tier: r.cells[0], defense: rng(r.cells[1]), statBudget: rng(r.cells[2]) })),
    autoWear: { formula, rules: wearT.rows.map((r) => ({ key: r.cells[0], text: r.cells[1] })) },
    armorMultipliers: ruleRows(armorT).map(({ key, text, nums: ns }) => ({ key, text, nums: ns })),
    consumableHabits: habitT.rows.map((r) => ({ traits: ticks(r.cells[0]), rule: r.cells[1] })),
    lifeTools: { rules: ruleRows(toolT).map(({ key, text, nums: ns }) => ({ key, text, nums: ns })), lifetimeYears: toolLife, bonusCap: (num(bonusCap) ?? 50) / 100 },
    sources: srcT.rows.map((r) => ({ source: r.cells[0], tiers: r.cells[1] })),
    prices: {
      basePrice: pb.labels,
      weaponBase: pb.weapon,
      formula: { tierMid: pb.mid, perStat: pb.perStat, perTag: pb.perTag, tagCap: pb.tagCap, clamp: pb.clamp },
      priceIndexW: priceIndex,
      incomeIndexW: incomeIndex,
      placeMods: placeT.rows.map((r) => ({ where: r.cells[0], mult: r.cells[1].includes('ถึง') || r.cells[1].includes('·') ? nums(r.cells[1].replace(/[×x]/g, '')) : (mult(r.cells[1]) ?? 1), when: r.cells[2] ?? '' })),
      sellBack: sellT.rows.map((r) => ({ buyer: r.cells[0], rate: r.cells[1], note: r.cells[2] ?? '' })),
      services: svcT.rows.map((r) => ({ service: r.cells[0], price: r.cells[1], who: r.cells[2] })),
      sellRates: { shop: (pct(sellT.rows[0].cells[1]) ?? 0.4), direct: (nums(sellT.rows[1].cells[1]).reduce((a, b) => a + b, 0) / 2 / 100), blackMarket: (pct(sellT.rows[2].cells[1]) ?? 0.3) },
      shopTiers: shopT.rows.map((r) => ({ size: r.cells[0], maxTier: r.cells[1], sells: r.cells[2] })),
      incomeBase,
      toolPayback,
      toolCheck: chkT.rows.map((r) => ({ tier: r.cells[0], price: r.cells[1], bonus: r.cells[2], yearly: r.cells[3], payback: r.cells[4] })),
    },
    talisman: {
      stages: stT.rows.map((r) => ({ stage: Number(r.cells[0]), name: r.cells[1], when: r.cells[2], effect: r.cells[3] })),
      odds: oddsT.rows.map((r) => ({ tier: r.cells[0], omen: pct(r.cells[1])!, possess: pct(r.cells[2])! })),
      oddsMods: modT.rows.map((r) => ({ name: r.cells[0], mult: mult(r.cells[1])!, when: r.cells[2] })),
      spirits: spT.rows.map((r) => ({ kind: r.cells[0], during: r.cells[1], wants: r.cells[2], gives: r.cells[3], enemies: ticks(r.cells[4]), exits: r.cells[5] })),
      possession: posT.rows.map((r) => ({ key: r.cells[0], text: r.cells[1] })),
      exits: exT.rows.map((r) => ({ key: r.cells[0], letter: r.cells[0].charAt(0), weight: num(r.cells[1])!, text: r.cells[2] })),
      exitSpecial: exSpT.rows.map((r) => ({ kind: r.cells[0], text: r.cells[1] })),
      two: twoT.rows.map((r) => ({ case: r.cells[0], text: r.cells[1] })),
      heirs: heirT.rows.map((r) => ({ key: r.cells[0], text: r.cells[1] })),
      finds: findT.rows.map((r) => ({ place: r.cells[0], kind: r.cells[1], example: r.cells[2] })),
      findChoices: fcT.rows.map((r) => ({ key: r.cells[0], weight: num(r.cells[1])!, text: r.cells[2] })),
      godWindow: gwT.rows.map((r) => ({ stage: r.cells[0], act: r.cells[1], effect: r.cells[2] })),
      npc: {
        principles: ruleRows(n(/หลักการ/, 'ข้อ')).map(({ key, text }) => ({ key, text })),
        entries: n(/เข้ามือ NPC/, 'ที่มา').rows.map((r) => ({ source: r.cells[0], when: r.cells[1], note: r.cells[2] ?? '' })),
        buyers: buyT.rows.map((r, i) => ({ id: BUYER_IDS[i], kind: r.cells[0], npcs: kindNpc(r.cells[1]), tiers: r.cells[2].match(/[CURELM]/g) ?? [], mult: mult(r.cells[3])!, weight: [25, 20, 15, 15, 15, 10][i], likes: r.cells[4].split(/\s+/) })),
        exitWeights,
        exitOrder,
        effects: n(/ผลต่อตัวละครหลัก/, 'ความสัมพันธ์กับ NPC').rows.map((r) => ({ relation: r.cells[0], omen: r.cells[1], possess: r.cells[2], exit: r.cells[3] })),
        permanent: n(/ผลถาวร/, 'ผู้สถิต').rows.map((r) => ({ spirit: r.cells[0], becomes: r.cells[1], traits: ticks(r.cells[1]) })),
        cases: n(/กรณีตัวอย่าง/, 'ผู้ถือ').rows.map((r) => ({ holder: r.cells[0], talisman: ticks(r.cells[1])[0], spirit: r.cells[2], story: r.cells[3] })),
        godWindow: n(/หน้าต่างพระเจ้า/, 'ขั้น').rows.map((r) => ({ stage: r.cells[0], act: r.cells[1], effect: r.cells[2] })),
        stageRows: stageRows.rows.map((r) => ({ stage: r.cells[0], when: r.cells[1], seen: r.cells[2] })),
        sim: {
          start: g(/เริ่มที่\s*(\d+)\s*ชิ้น/),
          findPerYear: g(/พบในซาก\s*(\d+)%/) / 100,
          countries: g(/ซาก\s*(\d+)\s*ประเทศ/),
          holderDeathPerYear: 1 / g(/ผู้ถือตาย\s*1\s*ใน\s*(\d+)/),
          years: g(/([\d,]+)\s*ปี\s*\d+\s*รอบ/),
          runs: g(/ปี\s*(\d+)\s*รอบ/),
          cap: g(/ปรับเป็น\s*\*\*(\d+)\*\*/),
          tierCounts,
        },
        simResult: ruleRows(n(/ผลทดสอบด้วยการจำลอง/, 'ค่าที่วัด')).map(({ key, text }) => ({ key, text })),
      },
    },
    items,
  };
  return data;
}

// ---------- forging trial ways ----------
const sgn = (s: string) => Number(s.replace('−', '-'));

/** `45 เคาะ ทอย `pow` 13 (`smithing` +2 · `ns_anvil_voice` ผ่านเลย) · ผ่าน ไว้ใจ +2` → weight, roll, bonus, trust (10-forging.md §5). */
function trialPath(key: 'a' | 'b' | 'c', cell: string): TrialPath {
  const text = cell.trim();
  const w = text.match(/^(\d+)\s+(.*)$/s);
  const label = w ? w[2] : text;
  const out: TrialPath = { key, text, weight: w ? Number(w[1]) : null, label, skills: [], weightMods: [], traits: [], battle: [], grants: [] };
  let rest = label;
  const roll = rest.match(/ทอย\s*`([a-z]+)`\s*(\d+)(?:\s*\(([^()]*)\))?/);
  if (roll) {
    const bonus: { id: string; delta: number }[] = [];
    const autoPass: string[] = [];
    for (const part of (roll[3] ?? '').split(/\s+·\s+/).filter(Boolean)) {
      const b = part.match(/`([a-z_]+)`\s*([+\-−]\d+)/);
      const a = part.match(/^(?:`([a-z_]+)`|([฀-๿]+?))\s*ผ่านเลย/);
      if (b) bonus.push({ id: b[1], delta: sgn(b[2]) });
      else if (a) autoPass.push(a[1] ?? a[2]);
    }
    out.roll = { stat: roll[1], dc: Number(roll[2]), bonus, autoPass };
    rest = rest.replace(roll[0], ' ');
  } else {
    const named = rest.match(/ทอย([฀-๿]+)/);
    if (named) out.roll = { what: named[1], bonus: [], autoPass: [] };
  }
  for (const m of rest.matchAll(/\(([^()]*?)\s*×\s*(\d+(?:\.\d+)?)\)/g)) out.weightMods.push({ ids: ticks(m[1]), mul: Number(m[2]) });
  for (const m of rest.matchAll(/\(([^()]*)\)/g)) if (!/×/.test(m[1])) out.traits.push(...ticks(m[1]));
  rest = rest.replace(/\([^()]*\)/g, ' ');
  const trust = rest.match(/ไว้ใจ\s*\+\s*(\d+)/);
  if (trust) out.trust = Number(trust[1]);
  const req = rest.match(/ไว้ใจ([฀-๿]+)\s*≥\s*(\d+)/);
  if (req) out.trustReq = { toward: req[1], min: Number(req[2]) };
  const gold = rest.match(/ทอง\s*([+\-−]\d+)/);
  if (gold) out.gold = sgn(gold[1]);
  for (const m of rest.matchAll(/`([a-z_]+)`\s*([+\-−]\d+)/g)) out.skills.push({ id: m[1], delta: sgn(m[2]) });
  for (const m of rest.matchAll(/`((?:nb|ns|nc|c|b|u)_[a-z_]+)`(?:\s*(\d+)%|\s*(ถ้า[^·]*?))?\s*(?:·|$)/g)) {
    out.grants.push({ id: m[1], ...(m[2] ? { chance: Number(m[2]) / 100 } : {}), ...(m[3] ? { when: m[3].trim() } : {}) });
  }
  for (const m of rest.matchAll(/ศึก[^`·]*`([a-z_]+)`/g)) out.battle.push(m[1]);
  if (/ศึกตามธงโลก/.test(rest)) out.battleWorld = true;
  if (/^ถอย/.test(label)) out.retreat = true;
  return out;
}

// ---------- forging.json ----------
function forgingData(): ForgingData {
  const f = D + '10-forging.md';
  const t = (head: RegExp | null, first: string, nth = 0) => findTable(f, head, first, nth);
  const forges = findTable(D + '07-forge-weapons.md', /โรงตีทั้งเก้า/, 'โรงตี');
  const forgeKeys = ['gromholm', 'halgad', 'throdu', 'dalholm', 'ramir', 'safforge', 'nokdreen', 'rhinewald', 'sagrogar'];
  const wIds = new Set(readWeapons(new Map()).filter((w) => w.forge).map((w) => w.forge!));
  forgeKeys.forEach((k) => {
    if (!wIds.has(k)) throw new Error('forge key not in weapons: ' + k);
  });
  const forgeRules = findTable(D + '07-forge-weapons.md', null, 'เงื่อนไขทั่วไป');
  const smithT = t(null, 'NPC', 0);
  const smiths = recs(smithT, ['npc', 'place', 'makes', 'trial']).map((r) => {
    const npc = r.npc.match(/^([A-Z]{2}\d{2}-\d)\s+(.*)$/)!;
    const makes = ticks(r.makes);
    for (const m of r.makes.matchAll(/`([a-z_]+?)(\d+)`\s*ถึง\s*`\1(\d+)`/g)) for (let n = Number(m[2]) + 1; n < Number(m[3]); n++) makes.push(`${m[1]}${n}`);
    makes.sort();
    const trust = r.trial.match(/ไว้ใจ\s*(\d+)/);
    return { npc: npc[1], name: npc[2], place: r.place, makes, material: makes.find((x) => !/^w[a-z]_/.test(x)), trial: r.trial.replace(/\s*\+\s*ไว้ใจ.*/, ''), trust: trust ? Number(trust[1]) : undefined, note: r.makes, src: src(smithT, r._line) };
  });
  const trials: ForgingTrial[] = recs(t(/การทดสอบ/, 'การทดสอบ'), ['id', 'ask', 'a', 'b', 'c']).map((r) => ({ id: r.id, ask: r.ask, a: trialPath('a', r.a), b: trialPath('b', r.b), c: trialPath('c', r.c) }));
  const roll = t(/การทอย/, 'ส่วน');
  const diff = t(/การทอย/, 'ระดับ');
  const outc = t(/ผลการตี/, 'ผล');
  const odds = t(/ความน่าจะเป็น/, 'ช่าง · ระดับ');
  const mast = t(/ความสามารถของงานชิ้นเอก/, 'สุ่ม');
  const prices = t(/ราคาและเวลา/, 'ระดับ');
  const chT = t(/ทางเลือก/, 'ทาง');
  const roll1Text = readDoc(f);
  const up = roll1Text.match(/ระดับ C ถึง R มีโอกาส (\d+)% ขึ้นหนึ่งระดับ/);
  return {
    steps: recs(t(/ภาพรวม/, 'ขั้น'), ['step', 'chain', 'what']).map((r) => ({ step: r.step, chain: ticks(r.chain)[0], what: r.what })),
    need: recs(t(/ความต้องการ/, 'เหตุ'), ['cause', 'weight', 'result']).map((r) => ({ cause: r.cause, weight: Number(r.weight), result: r.result })),
    materialSources: recs(t(/วัสดุ/, 'ทางที่ได้'), ['route', 'gets']).map((r) => ({ route: r.route, gets: r.gets })),
    smithTiers: recs(t(/ระดับของช่าง/, 'ช่าง'), ['smith', 'maxTier', 'skill', 'where']).map((r) => ({ smith: r.smith, maxTier: r.maxTier, skill: num(r.skill)!, where: r.where })),
    forges: forges.rows.map((r, i) => ({ key: forgeKeys[i], name: r.cells[0], country: r.cells[1], renown: r.cells[2], afterEvent: r.cells[3], src: src(forges, r.line) })),
    forgeRules: forgeRules.rows.map((r) => ({ key: r.cells[0], text: r.cells[1] })),
    smiths,
    rumorSources: recs(t(/ข่าวของช่าง/, 'แหล่ง'), ['source', 'smiths']).map((r) => ({ source: r.source, smiths: r.smiths })),
    trials,
    order: {
      prices: recs(prices, ['tier', 'price', 'time', 'who']).map((r) => ({ tier: r.tier, price: Number(r.price), time: r.time, who: r.who })),
      choices: recs(chT, ['key', 'weight', 'text']).map((r) => ({ key: r.key, weight: num(r.weight)!, text: r.weight + ' | ' + r.text })),
    },
    wait: recs(t(/การรอ/, 'เหตุ'), ['cause', 'chance', 'result']).map((r) => ({ cause: r.cause, chance: r.chance, result: r.result })),
    roll: {
      skillBonus: ruleRows(roll).map(({ key, text, nums: ns }) => ({ key, text, nums: ns })),
      difficulty: Object.fromEntries(diff.rows.map((r) => [r.cells[0], Number(r.cells[1])])),
      outcomes: recs(outc, ['outcome', 'cond', 'gets']).map((r) => ({ outcome: r.outcome, cond: r.cond, gets: r.gets })),
      odds: odds.rows.map((r) => ({ who: r.cells[0], fail: pct(r.cells[1])!, flawed: pct(r.cells[2])!, asOrdered: pct(r.cells[3])!, masterpiece: pct(r.cells[4])! })),
      masterpiece: mast.rows.map((r) => ({ roll: Number(r.cells[0]), ability: r.cells[1] })),
      masterpieceUpgradeChance: up ? Number(up[1]) / 100 : 0.25,
    },
    godWindow: recs(t(/หน้าต่างพระเจ้า/, 'ขั้น'), ['step', 'act', 'effect']).map((r) => ({ step: r.step, act: r.act, effect: r.effect })),
  };
}

export default function run() {
  const w = weaponsData();
  const matData = materialsData(w.mats);
  const items = readItems();
  const itemData = itemsData(items);
  const forge = forgingData();
  const srcs = (dir: string[], more: string[] = []) => [...dir.flatMap((d) => listDocs(d)), ...more];
  const weaponSrc = [...listDocs('docs/systems/items').filter((f) => /\/(0[1-8])-|README/.test(f)), 'docs/appearance/05-weapons-rules.md', 'docs/appearance/06-legendary-weapons.md', 'docs/appearance/07-regional-and-forge-weapons.md', 'docs/appearance/10-job-weapons.md'];
  void srcs;
  void versionOf;
  writeGen('weapons', w.data, weaponSrc, GEN);
  writeGen('materials', matData, ['docs/systems/items/02-materials.md', 'docs/systems/items/18-materials-and-keys.md', 'docs/appearance/05-weapons-rules.md', 'docs/systems/economy/04-income-and-living.md'], GEN);
  writeGen('items', itemData, [...listDocs('docs/systems/items').filter((f) => /\/(1[1-9]|20)-/.test(f)), 'docs/systems/items/README.md', 'docs/systems/bonds/06-paired-items.md', 'docs/systems/economy/04-income-and-living.md'], GEN);
  writeGen('forging', forge, ['docs/systems/items/10-forging.md', 'docs/systems/items/07-forge-weapons.md'], GEN);
  void rel;
  return finish('items', ['weapons.json', 'items.json', 'materials.json', 'forging.json'], un);
}
export type _R = GenReport;
