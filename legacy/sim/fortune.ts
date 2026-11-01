// Rarity + affinity: every random draw (gifts, weapons, jobs, events, chained follow-ups) is weighted by
// base rarity × how well it fits the story so far (place, religion, birth omen, race, job, past choices, god's gifts).

export type Rarity = 'C' | 'U' | 'R' | 'E' | 'L';
export const RARITIES: Rarity[] = ['C', 'U', 'R', 'E', 'L'];
export const RARITY: Record<Rarity, { name: string; w: number; color: string; faith: number; dread: number; power: number }> = {
  C: { name: 'ธรรมดา', w: 100, color: '#bdb8aa', faith: 10, dread: 6, power: 1 },
  U: { name: 'ไม่ธรรมดา', w: 38, color: '#7fd08a', faith: 16, dread: 12, power: 2 },
  R: { name: 'หายาก', w: 11, color: '#6ab0f4', faith: 26, dread: 20, power: 3 },
  E: { name: 'มหากาพย์', w: 2.6, color: '#c08cf0', faith: 40, dread: 30, power: 4 },
  L: { name: 'ตำนาน', w: 0.5, color: '#f6c24a', faith: 60, dread: 45, power: 6 },
};

// Story momentum ("threads"): grows with the character's choices and the god's gifts, decays slowly.
export const THREAD_NAMES: Record<string, string> = {
  hero: 'วีรชน', warrior: 'นักรบ', arcane: 'ผู้ใฝ่รู้มนตรา', greed: 'ความโลภ', dark: 'ความมืด', faithful: 'ศรัทธา',
  romance: 'ความรัก', wanderer: 'ผู้พเนจร', rebel: 'ผู้ต่อต้าน', holy: 'แสงศักดิ์สิทธิ์', outlaw: 'นอกกฎหมาย', wild: 'พงไพร',
};
export const CHOICE_THREADS: Record<string, string> = {
  help: 'hero', fight: 'warrior', learn: 'arcane', greed: 'greed', selfish: 'dark', pray: 'faithful',
  love: 'romance', travel: 'wanderer', defy: 'rebel',
};
// item tag → thread it feeds when the god grants it
export const TAG_THREAD: Record<string, string> = {
  light: 'holy', holy: 'holy', undead_bane: 'holy', demon_bane: 'holy', dark: 'dark', necro: 'dark', infernal: 'dark', blood: 'dark',
  blade: 'warrior', combat: 'warrior', berserk: 'warrior', guard: 'warrior', magic: 'arcane', seer: 'arcane', sage: 'arcane',
  charm: 'romance', true_love: 'romance', trade: 'greed', gold_luck: 'greed', treasure: 'greed', beast: 'wild', beast_friend: 'wild',
  nature: 'wild', stealth: 'outlaw', hero_luck: 'hero', leader: 'hero', oracle: 'faithful',
};

// Which story context makes an item with this tag more likely to appear.
const HOLY = ['religion:light', 'birth:day', 'birthsign:comet', 'thread:holy', 'job:priest', 'job:knight', 'belief:devoted'];
const DARK = ['religion:demon', 'birth:night', 'birthsign:eclipse', 'thread:dark', 'race:demonkin', 'race:vampire', 'race:darkelf', 'belief:heretic'];
const WAR = ['job:soldier', 'job:knight', 'thread:warrior', 'religion:war', 'countryflag:war'];
const SEA = ['climate:islands', 'religion:sea', 'religion:naga', 'race:merfolk', 'race:naga', 'job:fisher', 'job:pirate'];
const WILD = ['religion:nature', 'climate:tropical', 'race:elf', 'race:fae', 'race:beast', 'job:druid', 'job:tamer', 'job:hunter', 'thread:wild', 'flag:pet'];
const LOVE = ['birthsign:fullmoon', 'race:merfolk', 'race:vampire', 'thread:romance', 'trait:flirt'];
const GREED = ['job:merchant', 'thread:greed', 'climate:desert', 'trait:greedy'];
const SEER = ['religion:moon', 'thread:faithful', 'thread:arcane', 'birthsign:comet', 'trait:dreamer'];
export const TAG_AFF: Record<string, string[]> = {
  light: HOLY, holy: HOLY, undead_bane: HOLY, demon_bane: [...HOLY, 'thread:hero', 'flag:chosen'], guardian_angel: HOLY, curse_ward: HOLY,
  dark: DARK, necro: [...DARK, 'religion:ancestor'], infernal: DARK, blood: [...DARK, 'birthsign:fullmoon'], hex: DARK, demon_mark: DARK,
  fire: ['climate:volcanic', 'religion:dragon', 'race:dragonkin', 'thread:warrior'], fire_res: ['climate:volcanic', 'climate:desert', 'race:dwarf'],
  ice: ['climate:frozen', 'birth:night'], cold_res: ['climate:frozen'], heat_res: ['climate:desert'],
  water: SEA, water_breath: SEA, sea: SEA, nature: WILD, beast_friend: WILD, beast: WILD, regen: ['race:slime', 'religion:nature'],
  lightning: ['religion:war', 'birthsign:storm'], wind: ['birthsign:storm', 'race:fae'], earth: ['race:dwarf', 'religion:ancestor'],
  blade: WAR, combat: WAR, guard: WAR, berserk: [...WAR, 'race:orc'], ranged: ['job:hunter', 'race:elf'],
  dragon_bane: ['religion:dragon', 'thread:hero', 'flag:dragonslayer'], dragon_blood: ['race:dragonkin', 'religion:dragon'],
  seer: SEER, oracle: [...SEER, 'belief:devoted'], lucid: SEER, sage: SEER,
  charm: LOVE, beauty: LOVE, true_love: LOVE, fertile: ['thread:romance', 'trait:family'], family_bond: ['trait:family'],
  trade: GREED, gold_luck: GREED, treasure: [...GREED, 'thread:wanderer'], coin: GREED,
  hero_luck: ['thread:hero', 'flag:chosen', 'birthsign:comet'], last_stand: ['thread:hero', 'thread:warrior'], leader: ['flag:noble', 'thread:hero', 'job:knight'],
  stealth: ['job:thief', 'job:assassin', 'race:darkelf', 'thread:outlaw'], monster_ward: ['thread:wanderer'], longevity: ['race:elf', 'religion:nature'],
  mind_ward: ['thread:faithful', 'trait:stubborn'], polyglot: ['thread:wanderer'],
  jinx: [...DARK, 'birthsign:eclipse'], doom: DARK, haunted: ['religion:ancestor', 'birth:night', 'thread:dark'], weak_sun: ['race:vampire', 'birth:night'],
  lycan: ['birthsign:fullmoon', 'race:beast'], outcast: ['minority'], wanted: ['thread:outlaw'], greedy: ['thread:greed'], madness: ['thread:dark', 'birthsign:eclipse'],
  plague_carrier: ['countryflag:plague'], sickly: ['countryflag:plague', 'countryflag:famine'], cursed_blood: DARK, lich_seed: DARK,
};

export interface Ctx { tags: Set<string>; threads: Record<string, number> }

// How strongly the current context matches one context key (0..1)
export function ctxMatch(key: string, ctx: Ctx): number {
  if (key.startsWith('thread:')) return Math.min(1, (ctx.threads[key.slice(7)] || 0) / 5);
  return ctx.tags.has(key) ? 1 : 0;
}

// Multiplier for an item whose story tags are `tags`. Returns >= 1.
export function tagAffinity(tags: string[], ctx: Ctx): number {
  let units = 0;
  for (const t of tags) for (const k of TAG_AFF[t] || []) units += ctxMatch(k, ctx);
  return Math.min(9, 1 + 0.7 * units);
}

// Multiplier for explicit affinity maps (storylets, chains, jobs): {contextKey: strength}
export function mapAffinity(aff: Record<string, number> | undefined, ctx: Ctx): number {
  if (!aff) return 1;
  let m = 1;
  for (const [k, v] of Object.entries(aff)) m += v * ctxMatch(k, ctx);
  return Math.max(0.05, Math.min(12, m));
}

// The context keys that are currently boosting an item — used for the god's hints
export function boosters(tags: string[] | undefined, aff: Record<string, number> | undefined, ctx: Ctx): string[] {
  const out = new Set<string>();
  for (const t of tags || []) for (const k of TAG_AFF[t] || []) if (ctxMatch(k, ctx) > 0.2) out.add(k);
  for (const [k, v] of Object.entries(aff || {})) if (v > 0 && ctxMatch(k, ctx) > 0.2) out.add(k);
  return [...out];
}

const CTX_LABEL_PREFIX: Record<string, string> = {
  religion: 'ศาสนา', birth: 'เกิดยาม', birthsign: 'เกิดใต้', thread: 'เส้นทาง', job: 'อาชีพ', race: 'เผ่า', climate: 'ภูมิอากาศ',
  flag: '', trait: 'นิสัย', countryflag: 'บ้านเมือง', belief: '',
};
export const CTX_VALUE_LABEL: Record<string, string> = {
  'birth:day': 'เกิดยามกลางวัน', 'birth:night': 'เกิดยามค่ำคืน', 'birth:dawn': 'เกิดยามรุ่งอรุณ', 'birth:dusk': 'เกิดยามสนธยา',
  'birthsign:comet': 'เกิดใต้ดาวหาง', 'birthsign:eclipse': 'เกิดใต้สุริยคราส', 'birthsign:fullmoon': 'เกิดใต้จันทร์เต็มดวง', 'birthsign:storm': 'เกิดกลางพายุ',
  'belief:devoted': 'ศรัทธาในเทพสูง', 'belief:heretic': 'ไม่เชื่อในเทพ', minority: 'เป็นคนส่วนน้อยในประเทศ', human_land: 'อยู่ในดินแดนของมนุษย์',
  'countryflag:war': 'บ้านเมืองมีสงคราม', 'countryflag:plague': 'บ้านเมืองมีโรคระบาด', 'countryflag:famine': 'บ้านเมืองอดอยาก', 'countryflag:golden': 'บ้านเมืองรุ่งเรือง',
  'flag:noble': 'สายเลือดขุนนาง', 'flag:chosen': 'ผู้ถูกเลือก', 'flag:pet': 'มีสัตว์คู่ใจ', 'flag:dragonslayer': 'ผู้ฆ่ามังกร',
};

export function ctxLabel(key: string, names: { religion: Record<string, string>; race: (id: string) => string; climate: (id: string) => string; job: (id: string) => string; trait: (id: string) => string }): string {
  if (CTX_VALUE_LABEL[key]) return CTX_VALUE_LABEL[key];
  const [p, v] = key.split(':');
  if (p === 'thread') return `เส้นทาง${THREAD_NAMES[v] || v}`;
  if (p === 'religion') return `ดินแดน${names.religion[v] || v}`;
  if (p === 'race') return `เผ่า${names.race(v)}`;
  if (p === 'climate') return names.climate(v);
  if (p === 'job') return `เป็น${names.job(v)}`;
  if (p === 'trait') return `นิสัย${names.trait(v)}`;
  return (CTX_LABEL_PREFIX[p] ?? '') + (v ?? key);
}

// Roll a rarity tier, shifted upward by an affinity multiplier (and an optional floor)
export function rollRarity(r: () => number, mult = 1, floor: Rarity = 'C'): Rarity {
  const tiers = RARITIES.slice(RARITIES.indexOf(floor));
  const w = tiers.map((t, i) => RARITY[t].w * Math.pow(mult, i * 0.6));
  const sum = w.reduce((a, b) => a + b, 0);
  let x = r() * sum;
  for (let i = 0; i < tiers.length; i++) { x -= w[i]; if (x <= 0) return tiers[i]; }
  return tiers[tiers.length - 1];
}
