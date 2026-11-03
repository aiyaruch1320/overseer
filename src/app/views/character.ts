// View models of the character screen (code-plan §8.2 row "ตัวละคร", docs/systems/character/README.md): pure functions over (data, state).
// Nothing here changes the state. Every name and sentence comes from the data (blessings, curses, traits, aptitudes, skills, items, jobs, companions,
// bondage, economy, countries) or from src/core/text (the question of the life, the names of places, races and classes); the labels of the
// sections and the names of the six stats and eight axes are in character-words.ts.
import { extOf as bondageExt } from '../../core/bondage/state';
import type { BondageExt } from '../../core/bondage/state';
import { emptyExt as emptyCharExt, type CharacterExt } from '../../core/character/data';
import { maxHpOf } from '../../core/combat/hero';
import type { Item, Weapon } from '../../core/data/types-items';
import { emptyExt as emptyEconomy, type EconomyExt } from '../../core/economy/state';
import { makeCtx, type Ctx, type GameData } from '../../core/game';
import { armorOf, catalog, describe as describeWeapon, gearStats, worn, type Wielded } from '../../core/items';
import { fresh as freshItems, type ItemsExt } from '../../core/items/state';
import { classLabel, peopleCode, placeName, questionOf, raceName, calendarYear, scrub } from '../../core/text';
import { labels, items as dataItems } from '../../core/text/labels';
import type { GameState, LifeState } from '../../core/types';
import { AXIS_NAMES, AXIS_ORDER, CHAR_WORDS as W, GENDER_WORDS, OTHER_NAMES, STAT_NAMES, STAT_ORDER } from './character-words';
import { candleOf, type CandleView } from './watch';
import { STAT_BAR_MAX } from './character-tuning';

// ---------- shapes ----------

export type Tier = 'C' | 'U' | 'R' | 'E' | 'L';

export interface IdentityView {
  name: string;
  race: string;
  /** The second race of a half-blood. */
  second: string;
  gender: string;
  age: number;
  /** The calendar year (ศ.ม.). */
  year: number;
  where: string;
  /** Where the character was born, when it is not where they live. */
  born: string;
  cls: string;
  job: string;
  jobYears: number | null;
  secretJob: string;
  faith: string;
}

export interface HpView {
  now: number;
  max: number;
  pct: number;
  wounds: number;
}

export interface StatBar {
  key: string;
  label: string;
  base: number;
  /** What the gear worn adds (can be negative). */
  gear: number;
  total: number;
  /** 0 to 100 of the bar. */
  pct: number;
  gearPct: number;
}

export interface AxisBar {
  key: string;
  label: string;
  /** −100 to 100. */
  value: number;
  /** The bar grows from the middle: 0 to 50 on the side of the sign. */
  pct: number;
}

export interface TraitView {
  id: string;
  name: string;
  desc: string;
}

export interface AptLevelView {
  level: number;
  name: string;
  effect: string;
  reached: boolean;
}

export interface AptView {
  id: string;
  name: string;
  /** Level 1 to 3. */
  level: number;
  stat: string;
  levels: AptLevelView[];
}

export interface SkillView {
  id: string;
  name: string;
  level: number;
  effect: string;
}

export interface GiftView {
  id: string;
  name: string;
  tier: Tier;
  /** The sentence of the data about it. */
  effect: string;
  /** What it moves, in words: `กำลัง +1`. */
  deltas: string[];
  /** The meaning of the tags it gives, where the data says them. */
  tags: string[];
  /** Curses: the way out. */
  cure: string;
}

export interface ItemView {
  id: string;
  name: string;
  tier: Tier;
  /** The rarity in words as the items data names it (`ธรรมดา`), or `ของใช้`. */
  tierName: string;
  lines: string[];
}

export interface SlotView {
  key: 'weapon' | 'armor' | 'acc1' | 'acc2' | 'charm';
  label: string;
  item: ItemView | null;
}

export interface CarriedView {
  label: string;
  items: { id: string; name: string; tier: Tier; count: number }[];
}

export interface GearView {
  slots: SlotView[];
  carried: CarriedView[];
}

export interface CompanionView {
  id: string;
  name: string;
  tier: Tier;
  category: string;
  abilities: { name: string; text: string }[];
  note: string;
}

export interface BondageView {
  level: number;
  /** `อิสระ` for none. */
  name: string;
  /** Rows of words for the levels above 0: [label, value]. */
  rows: [string, string][];
  held: { name: string; level: string }[];
}

export interface StandingView {
  gold: number;
  debt: number;
  fame: number;
  cls: string;
  /** The last economy year (income, tax, living) when there is one. */
  lastYear: { income: number; tax: number; living: number } | null;
  bondage: BondageView;
}

export interface CharacterModel {
  dead: { age: number } | null;
  identity: IdentityView;
  question: string;
  hp: HpView;
  stats: StatBar[];
  axes: AxisBar[];
  traits: TraitView[];
  aptitudes: AptView[];
  skills: SkillView[];
  blessings: GiftView[];
  curses: GiftView[];
  gear: GearView;
  companions: CompanionView[];
  standing: StandingView;
  god: CandleView;
}

export interface CardModel {
  name: string;
  line: string;
  cls: string;
  job: string;
  hp: HpView;
  /** The three highest stats. */
  top: { label: string; total: number }[];
  gold: number;
  /** The level of bondage in words, empty when free. */
  bound: string;
  blessings: number;
  curses: number;
  hand: { name: string; tier: Tier } | null;
  companion: string;
  god: CandleView;
  dead: boolean;
}

// ---------- reading the state without changing it ----------

function peek<T>(life: LifeState, key: string, make: () => T): T {
  const e = life.ext[key] as T | undefined;
  return e && typeof e === 'object' ? e : make();
}

const charOf = (life: LifeState): CharacterExt => peek(life, 'character', emptyCharExt);
const itemsOf = (life: LifeState): ItemsExt => peek(life, 'items', freshItems);
const economyOf = (life: LifeState): EconomyExt => peek(life, 'economy', emptyEconomy);
const bondageOf = (life: LifeState): BondageExt => (life.ext.bondage ? bondageExt(life) : bondageExt({ ext: {} } as unknown as LifeState));
const combatHp = (life: LifeState): number | null => ((life.ext.combat as { hp?: number | null } | undefined)?.hp ?? null);

const MINUS = '−';
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0');
const round = (n: number): number => Math.round(n);

// ---------- indexes of the data, built once per loaded data object ----------

interface GiftRow {
  id: string;
  name: string;
  tier: Tier;
  desc?: string;
  text?: string;
  world?: string;
  cure?: string;
  fx?: { k: string; stat?: string; delta?: number; kind?: string; id?: string }[];
}
interface AptRow {
  id: string;
  name: string;
  stat: string;
  levels: { level: number; skill: string; name: string; effect: string }[];
}
interface SkillRow {
  id: string;
  name: string;
  kind: string;
  levels?: string[];
  effect?: string;
  desc?: string;
  text?: string;
}
interface SpeciesRow {
  id: string;
  name: string;
  tier: Tier;
  category: string;
  note: string;
  abilities: { id: string; level: number }[];
}

interface Index {
  gifts: Map<string, GiftRow>;
  traits: Map<string, { id: string; name: string; desc: string }>;
  apts: Map<string, AptRow>;
  skills: Map<string, SkillRow>;
  tagText: Map<string, string>;
  faith: Map<string, string>;
  species: Map<string, SpeciesRow>;
  abilities: Map<string, { name: string; levels: string[] }>;
  rarity: Map<string, string>;
  slots: string[];
  bondage: string[];
  /** A sentence of the data as the player reads it: ids become names, codes and numbers of effects are cut. */
  say: (text: string) => string;
}

const cache = new WeakMap<GameData, Index>();

function indexOf(data: GameData): Index {
  const hit = cache.get(data);
  if (hit) return hit;
  const gifts = new Map<string, GiftRow>();
  for (const f of ['blessings', 'curses']) for (const g of dataItems<GiftRow[]>(data, f) ?? []) gifts.set(g.id, g);
  const races = dataItems<{ races: { blessings?: GiftRow[]; curses?: GiftRow[]; skills?: { id: string; name: string; text: string }[] }[] }>(data, 'races')?.races ?? [];
  const skills = new Map<string, SkillRow>();
  for (const s of dataItems<SkillRow[]>(data, 'skills') ?? []) skills.set(s.id, s);
  for (const r of races) {
    for (const g of [...(r.blessings ?? []), ...(r.curses ?? [])]) if (!gifts.has(g.id)) gifts.set(g.id, g);
    for (const s of r.skills ?? []) if (!skills.has(s.id)) skills.set(s.id, { id: s.id, name: s.name, kind: 'race', text: s.text });
  }
  const traitFile = dataItems<{ traits: { id: string; name: string; desc: string }[]; tags: { tag: string; text: string }[] }>(data, 'traits');
  const traits = new Map((traitFile?.traits ?? []).map((t) => [t.id, t]));
  const tagText = new Map((traitFile?.tags ?? []).filter((t) => t.text).map((t) => [t.tag, t.text]));
  const apts = new Map((dataItems<AptRow[]>(data, 'aptitudes') ?? []).map((a) => [a.id, a]));
  const faith = new Map<string, string>();
  for (const c of dataItems<{ religions?: { id: string; name: string }[] }[]>(data, 'countries') ?? []) for (const r of c.religions ?? []) faith.set(r.id, r.name);
  const comp = dataItems<{ species: SpeciesRow[]; abilities: { id: string; name: string; levels: string[] }[] }>(data, 'companions');
  const species = new Map((comp?.species ?? []).map((s) => [s.id, s]));
  const abilities = new Map((comp?.abilities ?? []).map((a) => [a.id, a]));
  const rarity = new Map((dataItems<{ rarity: { rarity: string; name: string }[] }>(data, 'weapons')?.rarity ?? []).map((r) => [r.rarity, r.name]));
  const slots = (dataItems<{ slots: { slot: string }[] }>(data, 'items')?.slots ?? []).map((s) => s.slot);
  const bondage = (dataItems<{ levels: { name: string }[] }>(data, 'bondage')?.levels ?? []).map((l) => l.name);
  const out: Index = { gifts, traits, apts, skills, tagText, faith, species, abilities, rarity, slots, bondage, say: (t) => (t ? scrub(data, t, { keepNumbers: true }) : '') };
  cache.set(data, out);
  return out;
}

// ---------- pieces ----------

const tierOf = (t: string | undefined): Tier => (t === 'U' || t === 'R' || t === 'E' || t === 'L' ? t : 'C');

function statWord(key: string): string {
  return STAT_NAMES[key] ?? AXIS_NAMES[key] ?? OTHER_NAMES[key] ?? (/[ก-๙]/.test(key) ? key : '');
}

function deltas(g: GiftRow): string[] {
  const out: string[] = [];
  for (const e of g.fx ?? []) {
    if (e.k !== 'stat' || e.delta === undefined) continue;
    const w = statWord(e.stat ?? '');
    if (w) out.push(`${w} ${signed(e.delta)}`);
  }
  return out;
}

function giftView(ix: Index, id: string): GiftView | null {
  const g = ix.gifts.get(id);
  if (!g) return null;
  const tags = (g.fx ?? []).filter((e) => e.k === 'grant' && e.kind === 'tag' && e.id && ix.tagText.has(e.id)).map((e) => ix.say(ix.tagText.get(e.id as string) as string));
  return { id, name: g.name, tier: tierOf(g.tier), effect: ix.say(g.desc || g.text || g.world || ''), deltas: deltas(g), tags, cure: ix.say(g.cure ?? '') };
}

function identityOf(ctx: Ctx, life: LifeState, ix: Index): IdentityView {
  const L = labels(ctx.data);
  const e = charOf(life);
  const where = placeName(ctx, life.country) ?? '';
  const born = placeName(ctx, life.home) ?? '';
  const job = life.job ? L.kind.job.get(life.job) ?? '' : '';
  return {
    name: life.name,
    race: raceName(ctx, life.race),
    second: e.second ? raceName(ctx, e.second) : '',
    gender: GENDER_WORDS[life.gender],
    age: life.hAge,
    year: calendarYear(ctx.state.clock.worldYear),
    where,
    born: born && born !== where ? born : '',
    cls: classLabel(ctx, life.cls),
    job,
    jobYears: job && e.jobSince !== undefined ? Math.max(0, life.hAge - e.jobSince) : null,
    secretJob: life.secretJob ? L.kind.job.get(life.secretJob) ?? '' : '',
    faith: e.faith ? ix.faith.get(e.faith) ?? '' : '',
  };
}

function hpOf(ctx: Ctx, life: LifeState): HpView {
  const max = maxHpOf(ctx, life);
  const now = Math.max(0, Math.min(max, combatHp(life) ?? max));
  return { now: round(now), max: round(max), pct: max > 0 ? Math.round((now / max) * 100) : 0, wounds: charOf(life).wounds };
}

function statBars(ctx: Ctx, life: LifeState): StatBar[] {
  const gear = life.ext.items ? gearStats(ctx) : {};
  return STAT_ORDER.map((key) => {
    const base = life.stats[key];
    const g = (gear as Record<string, number | undefined>)[key] ?? 0;
    const total = base + g;
    const pct = (n: number) => Math.max(0, Math.min(100, Math.round((n / STAT_BAR_MAX) * 100)));
    return { key, label: STAT_NAMES[key], base, gear: g, total, pct: pct(Math.min(base, total)), gearPct: Math.abs(pct(total) - pct(Math.min(base, total))) };
  });
}

function axisBars(life: LifeState): AxisBar[] {
  const e = charOf(life);
  return AXIS_ORDER.map((key) => {
    const value = Math.round(e.axes[key] ?? 0);
    return { key, label: AXIS_NAMES[key], value, pct: Math.min(50, Math.abs(value) / 2) };
  });
}

function aptViews(ix: Index, life: LifeState): AptView[] {
  const out: AptView[] = [];
  for (const [id, level] of Object.entries(life.aptitudes)) {
    const a = ix.apts.get(id);
    if (!a || level <= 0) continue;
    out.push({ id, name: a.name, level, stat: STAT_NAMES[a.stat] ?? '', levels: a.levels.map((l) => ({ level: l.level, name: l.name, effect: ix.say(l.effect), reached: l.level <= level })) });
  }
  return out.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'th'));
}

/** `sword_2` and the like are the levels of an aptitude (shown with it), not skills of their own. */
const isAptSkill = (ix: Index, id: string): boolean => ix.skills.get(id)?.kind === 'apt' || /_[1-3]$/.test(id) && ix.apts.has(id.replace(/_[1-3]$/, ''));

function skillViews(ix: Index, life: LifeState): SkillView[] {
  const e = charOf(life);
  const out: SkillView[] = [];
  for (const id of life.skills) {
    const s = ix.skills.get(id);
    if (!s || isAptSkill(ix, id)) continue;
    const level = e.skillLevels[id] ?? 1;
    const effect = s.levels ? s.levels[Math.min(level, s.levels.length) - 1] ?? '' : s.effect || s.desc || s.text || '';
    out.push({ id, name: s.name, level: s.levels ? level : 0, effect: ix.say(effect) });
  }
  return out;
}

// ---------- gear ----------

function statLine(stats: Record<string, number>): string {
  return Object.entries(stats)
    .filter(([, n]) => n)
    .map(([k, n]) => `${statWord(k)} ${signed(n)}`.trim())
    .filter((x) => !x.startsWith(' '))
    .join(' · ');
}

const unique = (l: string[]): string[] => [...new Set(l.filter(Boolean))];
const texts = (abilities: { text: string }[], n = 3): string[] => abilities.map((a) => a.text).filter(Boolean).slice(0, n);

function weaponItem(ix: Index, w: Wielded): ItemView {
  const lines = unique([`${W.power} ${w.power}${w.type ? ` · ${w.type}` : ''}`, statLine(w.stats), ...w.text.slice(0, 3).map(ix.say)]);
  return { id: w.id, name: w.name, tier: tierOf(w.rarity), tierName: ix.rarity.get(w.rarity) ?? w.rarity, lines };
}

function pieceItem(ix: Index, i: Item, defense?: number): ItemView {
  const lines = unique([defense !== undefined ? `${W.defense} ${defense}${i.kind ? ` · ${i.kind}` : ''}` : i.kind ?? '', statLine(i.stats), ...texts(i.abilities).map(ix.say), ix.say(i.boon ?? ''), ix.say(i.effect ?? '')]);
  return { id: i.id, name: i.name, tier: tierOf(i.tier), tierName: ix.rarity.get(i.tier) ?? i.tier, lines };
}

function gearView(ctx: Ctx, ix: Index, life: LifeState): GearView {
  const c = catalog(ctx);
  const ex = itemsOf(life);
  const has = (id: string | undefined): id is string => !!id && life.items.includes(id);
  const slotLabel = (n: number): string => ix.slots[n] ?? '';
  const pick = (id: string | undefined): Item | undefined => (has(id) ? c.items.get(id) : undefined);
  const w: Weapon | undefined = has(ex.wield) ? c.weapons.get(ex.wield) : undefined;
  const armor = pick(ex.armor);
  const armorDef = armor ? armorOf(ctx).defense : undefined;
  const slots: SlotView[] = [
    { key: 'weapon', label: slotLabel(0), item: w ? weaponItem(ix, describeWeapon(ctx, life, w, ex)) : null },
    { key: 'armor', label: slotLabel(1), item: armor ? pieceItem(ix, armor, armorDef ?? armor.defense ?? 0) : null },
    ...[0, 1].map((n): SlotView => ({ key: n === 0 ? 'acc1' : 'acc2', label: slotLabel(2), item: pick(ex.acc[n]) ? pieceItem(ix, pick(ex.acc[n]) as Item) : null })),
    { key: 'charm', label: slotLabel(3), item: pick(ex.charm) ? pieceItem(ix, pick(ex.charm) as Item) : null },
  ];

  const onBody = new Set(worn(ctx));
  const groups: Record<string, CarriedView> = {};
  const count = new Map<string, number>();
  for (const id of life.items) count.set(id, (count.get(id) ?? 0) + 1);
  const put = (label: string, id: string, name: string, tier: string, n: number) => {
    (groups[label] ??= { label, items: [] }).items.push({ id, name, tier: tierOf(tier), count: n });
  };
  for (const [id, n] of count) {
    const wp = c.weapons.get(id);
    const it = c.items.get(id);
    const m = c.materials.get(id);
    const rest = onBody.has(id) ? n - 1 : n;
    if (rest <= 0) continue;
    if (wp) put(W.spare, id, wp.name, wp.rarity, rest);
    else if (it) {
      const label = it.cat === 'consumable' ? slotLabel(4) : it.cat === 'tool' ? slotLabel(7) : it.cat === 'key' || it.cat === 'paired' ? slotLabel(6) : it.cat === 'material' ? slotLabel(5) : W.spare;
      put(label || W.other, id, it.name, it.tier, rest);
    } else if (m) put(slotLabel(5) || W.other, id, m.name, m.rarity, rest);
  }
  return { slots, carried: Object.values(groups) };
}

// ---------- companion, money, bondage ----------

function companionViews(ix: Index, life: LifeState): CompanionView[] {
  const out: CompanionView[] = [];
  for (const id of charOf(life).companions) {
    const s = ix.species.get(id);
    if (!s) continue;
    out.push({
      id,
      name: s.name,
      tier: tierOf(s.tier),
      category: s.category,
      note: ix.say(s.note),
      abilities: s.abilities.map((a) => ix.abilities.get(a.id)).map((a, i) => (a ? { name: a.name, text: ix.say(a.levels[Math.min(s.abilities[i].level, a.levels.length) - 1] ?? '') } : null)).filter((x): x is { name: string; text: string } => !!x),
    });
  }
  return out;
}

function bondageView(ctx: Ctx, ix: Index, life: LifeState): BondageView {
  const b = bondageOf(life);
  const name = ix.bondage[b.level] ?? '';
  const rows: [string, string][] = [];
  if (b.level > 0) {
    if (b.owner) rows.push([W.owner, b.owner]);
    if (b.country) rows.push([W.where, placeName(ctx, b.country) ?? '']);
    if (b.since !== undefined) rows.push([W.since, String(b.since)]);
    if (b.route) rows.push([W.route, b.route]);
    if (b.debt) rows.push([W.debt, String(round(b.debt))]);
    if (b.years) rows.push([W.contract, `${b.years} ${W.years}`]);
    if (b.price) rows.push([W.ransom, `${round(b.price)} ${W.gold}`]);
  }
  return { level: b.level, name: b.level > 0 ? name : W.free, rows, held: b.held.filter((h) => !h.gone).map((h) => ({ name: h.name, level: ix.bondage[Number(h.level.slice(1))] ?? h.level })) };
}

function standingView(ctx: Ctx, ix: Index, life: LifeState): StandingView {
  const eco = economyOf(life);
  const last = eco.flows.years > 0 ? eco.last : null;
  return {
    gold: round(life.gold),
    debt: round(eco.debt),
    fame: round(charOf(life).fame),
    cls: classLabel(ctx, life.cls),
    lastYear: last ? { income: round(last.income), tax: round(last.tax), living: round(last.living) } : null,
    bondage: bondageView(ctx, ix, life),
  };
}

// ---------- the views ----------

/** The whole sheet of the character on the stage, or null between lives. */
export function characterView(data: GameData, state: GameState): CharacterModel | null {
  const life = state.life;
  if (!life) return null;
  const ctx = makeCtx(state, data);
  const ix = indexOf(data);
  const gifts = (ids: string[]) => ids.map((id) => giftView(ix, id)).filter((g): g is GiftView => !!g);
  return {
    dead: life.dead ? { age: life.dead.hAge } : null,
    identity: identityOf(ctx, life, ix),
    question: questionOf(data, peopleCode(ctx, life.race)),
    hp: hpOf(ctx, life),
    stats: statBars(ctx, life),
    axes: axisBars(life),
    traits: life.traits.map((id) => ix.traits.get(id)).filter((t): t is NonNullable<typeof t> => !!t).map((t) => ({ id: t.id, name: t.name, desc: ix.say(t.desc) })),
    aptitudes: aptViews(ix, life),
    skills: skillViews(ix, life),
    blessings: gifts(life.blessings),
    curses: gifts(life.curses),
    gear: gearView(ctx, ix, life),
    companions: companionViews(ix, life),
    standing: standingView(ctx, ix, life),
    god: candleOf(data, life.godFaith),
  };
}

/** The small card beside the watch screen (a few lines of the sheet). */
export function characterCardView(data: GameData, state: GameState): CardModel | null {
  const life = state.life;
  if (!life) return null;
  const ctx = makeCtx(state, data);
  const ix = indexOf(data);
  const id = identityOf(ctx, life, ix);
  const stats = statBars(ctx, life);
  const gear = gearView(ctx, ix, life);
  const hand = gear.slots[0].item;
  const bond = bondageView(ctx, ix, life);
  return {
    name: id.name,
    line: [id.race, id.gender, `${W.age} ${id.age}`].filter(Boolean).join(' · '),
    cls: id.cls,
    job: id.job,
    hp: hpOf(ctx, life),
    top: [...stats].sort((a, b) => b.total - a.total).slice(0, 3).map((s) => ({ label: s.label, total: s.total })),
    gold: round(life.gold),
    bound: bond.level > 0 ? bond.name : '',
    blessings: life.blessings.filter((b) => ix.gifts.has(b)).length,
    curses: life.curses.filter((c) => ix.gifts.has(c)).length,
    hand: hand ? { name: hand.name, tier: hand.tier } : null,
    companion: companionViews(ix, life)[0]?.name ?? '',
    god: candleOf(data, life.godFaith),
    dead: !!life.dead,
  };
}
