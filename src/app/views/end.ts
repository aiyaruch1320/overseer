// The view models of the ending screens (docs/systems/experience/03-ending-and-collection.md, docs/systems/god/08-goals.md, docs/appearance/20-god-ui.md §10,
// docs/lore/heirs/): the death scene, the life record and the card, the heir choice, the legend page, the collection, the summary of the world.
// Pure over (data, state): every sentence comes from the card, the summary of the world or the tables of the core; the labels of the sections are the
// words of the documents (END_LABELS). The storybook feeds these a sample state, the screens read them in a render that read `store.rev.value`.
import { collectionView, entryName, CATEGORIES, cardOf, type CollectionView, type EndingCard } from '../../core/ending';
import { GOALS_CATEGORIES } from '../../core/ending/collection';
import { HAND_WORD } from '../../core/ending/tuning';
import { makeCtx, type Ctx, type GameData } from '../../core/game';
import { peekGoals } from '../../core/god/goals';
import type { ChronicleLine } from '../../core/god/goals/state';
import { candidates, lx, pickHeir, pickHeirTie, previewHeir, worldSummary, type HeirSpec, type NextResult, type WorldSummary } from '../../core/lineage';
import { labels } from '../../core/text/labels';
import { placeName } from '../../core/text/pick';
import type { GameState } from '../../core/types';
import type { GameStore } from '../store';
import { clean, playerWords } from './player-words';

// ---------- the words of the screens ----------

export const END_LABELS = {
  // 03-ending-and-collection.md §1 table (the sections of the life record)
  head: 'หัว',
  question: 'คำถามของชีวิต',
  moments: 'ช่วงเวลาที่เปลี่ยนชีวิต',
  people: 'ผู้คน',
  traces: 'ร่องรอยที่ทิ้งไว้',
  hand: 'มือของพระเจ้า',
  epitaph: 'จารึก',
  // 08-goals.md §2 and §3
  vow: 'หน้าคำปฏิญาณ',
  titles: 'ฉายาชีวิต',
  earned: 'ที่ชีวิตนี้เปิด', // 03 §5 (the collection)
  summary: 'เล่าย่อ',
  // the scenes
  death: 'ฉากความตาย',
  record: 'บันทึกชีวิต',
  /** The button of the death scene: it opens the life record, it saves nothing (M5 review round two R3: "บันทึก" read as a save). */
  readRecord: 'อ่านบันทึกชีวิตของเขา',
  missing: 'ข้อที่ขาด',
  mark: 'ผลต่อโลก', // 03 §2
  // 19-wish.md §6 (the card shows the life was "ถูกสั่ง") and §5 (the rows of the sheet)
  ordered: 'ถูกสั่ง',
  asked: 'สิ่งที่ขอ',
  sure: 'ได้แน่นอน',
  lean: 'มีแนวโน้ม',
  cannot: 'ทำไม่ได้',
  heir: 'ผู้สืบตระกูล', // 04-start-modes.md / heirs
  family: 'ตระกูล',
  modes: 'แบบเริ่มต้น', // 04-start-modes.md
  legend: 'หน้าตำนาน', // 03 §3
  collection: 'ของสะสม', // 03 §5
  world: 'หน้าสรุปโลก', // 03 §7
  // actions
  next: 'ไปต่อ',
  newcomer: 'ให้คนใหม่เกิดในโลกนี้',
  toLegend: 'ไปหน้าตำนาน',
  toCollection: 'ไปของสะสม',
  back: 'กลับ',
  open: 'เปิดบันทึกชีวิต',
  opened: 'กำลังเปิดอยู่',
  backToChronicle: 'กลับไปพงศาวดาร',
  toWorld: 'ดูหน้าสรุปโลก',
  replay: 'เปิดชีวิตซ้ำด้วยเมล็ดเดิม', // 03 §3
  seed: 'เมล็ด',
  unknown: 'ยังไม่พบ',
  shadow: 'เงา', // 03 §5 "รายการที่ยังไม่พบเห็นเป็นเงา"
  extinct: 'ตระกูลสิ้น', // heirs/01-inheritance.md §6
  noHeir: 'ไม่มีผู้สืบตระกูลเหลือ',
  ended: 'โลกจบแล้ว',
} as const;

/** The end of a question (07-ending-templates.md §5.3). */
export const GRADE_WORD: Record<EndingCard['question']['grade'], string> = { good: 'ตอบได้ดี', bad: 'ตอบแย่', open: 'ยังเปิด', early: 'ตายก่อนถึงคำตอบ', changed: 'กลายเป็นอย่างอื่น' };

/** How the heir stands to the dead (heirs/01-inheritance.md §1 and §6: the ladder). */
export const HOW_WORD: Record<HeirSpec['how'], string> = { child: 'ลูก', adopted: 'ลูกบุญธรรม', student: 'ศิษย์', partner: 'คู่ชีวิต', helped: 'ผู้ที่เขาเคยช่วย', newcomer: 'คนใหม่' };

/** The sections of the summary of the world (03 §7 table). */
export const WORLD_SECTIONS = { head: 'ฉากจบ', time: 'เวลา', dragons: 'มังกร', countries: 'ประเทศ', keys: 'กุญแจ', events: 'เหตุการณ์ใหญ่', you: 'ตัวละครของคุณ', hand: 'มือของพระเจ้า', legend: 'ตำนานของโลก' } as const;

export const MARK_LEVEL_ORDER = ['none', 'local', 'era'] as const;

// ---------- the death scene ----------

export interface DeathView {
  name: string;
  /** "คนแคระ · ดูร์ดิน · อายุ 74": the head of the card. */
  head: string;
  /** The sentence of the death the card tells (a fact of the log), and the group of the cause. */
  sentence: string;
  cause: string;
  mark: string;
}

/** The death scene of the last life that ended, or null while no card exists. */
export function deathOf(state: GameState): DeathView | null {
  const card = cardOf(state);
  return card ? deathView(card) : null;
}

export function deathView(card: EndingCard): DeathView {
  const f = card.facts.find((x) => x.kind === 'ความตาย');
  return { name: card.name, head: card.lines[0] ?? '', sentence: f?.sentence ?? '', cause: card.group, mark: card.mark.label };
}

// ---------- the life record and the card ----------

export interface CardSection {
  id: 'question' | 'moments' | 'people' | 'traces' | 'hand' | 'vow' | 'epitaph';
  title: string;
  lines: string[];
}

export interface EarnedGroup {
  category: string;
  names: string[];
  /** Entries with no name of their own to print (nodes and the like): counted, not listed. */
  more: number;
}

/** The wish of an ordered life as the card tells it: the words typed, what the birth gave (sure, then lean) and what it could not, each with the reason. */
export interface WishView {
  /** "ถูกสั่ง". */
  mark: string;
  text: string;
  sure: string[];
  lean: string[];
  refused: { text: string; reason: string }[];
}

export interface CardView {
  life: string;
  generation: number;
  head: string;
  titleLine: string;
  mark: { level: EndingCard['mark']['level']; label: string };
  ending: string | null;
  sections: CardSection[];
  summary: { text: string; source: 'template' | 'llm' };
  epitaph: { text: string; source: 'template' | 'llm' };
  vow: { name: string; kept: boolean; head: string; lines: string[]; missing: string[] } | null;
  titles: string[];
  earned: EarnedGroup[];
  heir: { name: string; how: string; age: number; line: string } | null;
  threads: string[];
  /** The life was ordered by the player; null for a life nobody ordered. */
  wish: WishView | null;
  seed: number;
}

const pairOf = (field: string, value: string): string => (field ? `${field}: ${value}` : value);

export function wishView(w: NonNullable<EndingCard['wish']>, data?: GameData): WishView {
  const say = (t: string) => (data ? playerWords(data, t) : t);
  return {
    mark: END_LABELS.ordered,
    text: w.text,
    sure: w.granted.filter((g) => g.row === 'sure').map((g) => pairOf(g.field, g.value)),
    lean: w.granted.filter((g) => g.row === 'lean').map((g) => pairOf(g.field, g.value)),
    refused: w.refused.map((r) => ({ text: pairOf(r.field, r.value), reason: say(r.reason) })),
  };
}

/** The names of the interventions of a life, as the card counts them. */
export function handLines(hand: EndingCard['hand']): string[] {
  const out: string[] = [];
  if (!hand.total) out.push('ไม่มีพระหัตถ์ในชีวิตนี้');
  else {
    out.push(`แทรกแซง ${hand.total} ครั้ง`);
    const kinds = Object.entries(hand.byKind).filter(([, n]) => n > 0);
    if (kinds.length) out.push(kinds.map(([k, n]) => `${HAND_WORD[k] ?? k} ${n}`).join(' · '));
    if (hand.top) out.push(`ครั้งที่เปลี่ยนชีวิตมากที่สุด: ${hand.top.name ?? HAND_WORD[hand.top.kind] ?? hand.top.kind}${hand.top.age !== undefined ? ` เมื่ออายุ ${hand.top.age}` : ''}`);
  }
  if (hand.conjured?.length) out.push(`ปาฏิหาริย์ที่เสก: ${hand.conjured.join(' · ')}`);
  if (hand.silent) out.push(`คำอธิษฐานที่ไม่ได้ตอบ ${hand.silent}`);
  return out;
}

const categoryName = new Map([...CATEGORIES, ...GOALS_CATEGORIES].map((c) => [c.id, c.name]));

/** What a life opened (the ids `<category>:<id>` of the card), by category with the names. */
export function earnedGroups(data: GameData, earned: string[], cap = 10): EarnedGroup[] {
  const by = new Map<string, string[]>();
  for (const e of earned) {
    const cat = e.split(':')[0];
    const list = by.get(cat) ?? [];
    list.push(e);
    by.set(cat, list);
  }
  const out: EarnedGroup[] = [];
  for (const [cat, list] of by) {
    const names = list.map((e) => clean(data, entryName(data, e) || (cat === 'title' || cat === 'vow' ? e.split(':').slice(1).join(':') : ''))).filter(Boolean);
    out.push({ category: categoryName.get(cat) ?? cat, names: names.slice(0, cap), more: list.length - Math.min(names.length, cap) });
  }
  return out.sort((a, b) => b.names.length - a.names.length);
}

export function cardView(data: GameData, state: GameState, lifeId?: string): CardView | null {
  const card = cardOf(state, lifeId);
  if (!card) return null;
  const sections: CardSection[] = [];
  const q = card.question;
  sections.push({ id: 'question', title: END_LABELS.question, lines: [q.text, q.line || GRADE_WORD[q.grade]].filter(Boolean) });
  sections.push({ id: 'moments', title: END_LABELS.moments, lines: card.moments.map((m) => m.line) });
  sections.push({ id: 'people', title: END_LABELS.people, lines: card.people });
  sections.push({ id: 'traces', title: END_LABELS.traces, lines: card.traces });
  sections.push({ id: 'hand', title: END_LABELS.hand, lines: handLines(card.hand) });
  const c = (t: string) => clean(data, t);
  const cs = (l: string[]) => l.map(c);
  return {
    life: card.life,
    generation: card.generation,
    head: c(card.lines[0] ?? ''),
    titleLine: c(card.titleLine),
    mark: card.mark,
    ending: card.ending ? c(card.ending) : null,
    sections: sections.map((x) => ({ ...x, lines: cs(x.lines) })),
    summary: { ...card.summary, text: c(card.summary.text) },
    epitaph: { ...card.epitaph, text: c(card.epitaph.text) },
    vow: card.vow ? { name: c(card.vow.name), kept: card.vow.result === 'kept', head: c(card.vow.head), lines: cs(card.vow.lines), missing: cs(card.vow.missing ?? []) } : null,
    titles: cs(card.titles),
    earned: earnedGroups(data, card.earned),
    heir: card.heir ? { ...card.heir, line: c(`${card.heir.name} · อายุ ${card.heir.age}`) } : null,
    threads: cs(card.threads),
    wish: card.wish ? wishView(card.wish, data) : null,
    seed: state.seed,
  };
}

// ---------- the heir choice ----------

export interface HeirCandidate {
  /** The tie of the bond book (the id `pickHeirTie` takes). */
  tie: string;
  name: string;
  how: string;
  age: number;
  /** The child the family takes by default (the eldest, or the one the player picked). */
  chosen: boolean;
  /** Traits and the best aptitudes it is born with (`previewHeir`), by name. */
  traits: string[];
  aptitudes: string[];
  married: string | null;
  other: string | null;
  blood: boolean;
  /** "ลูก · อายุ 52 · คู่ …" */
  line: string;
}

export interface HeirChoice {
  /** The children who could take over (rung 0); empty when the ladder goes down. */
  candidates: HeirCandidate[];
  /** The heir the ladder gives when no child is left (a student, the partner, someone helped). */
  successor: HeirCandidate | null;
  /** The family has nobody: it ends (heirs/01 §6); the player may ask for a newcomer. */
  extinct: boolean;
  /** Why the world cannot go on at all (`world-ended`), or null. */
  blocked: 'world-ended' | null;
  family: { dynasty: string; generation: number };
}

function candidateOf(data: GameData, ctx: Ctx, spec: HeirSpec, chosen: boolean): HeirCandidate {
  const lab = labels(data).kind;
  let traits: string[] = [];
  let aptitudes: string[] = [];
  try {
    const p = previewHeir(ctx, spec);
    traits = p.traits.map((t) => lab.trait.get(t) ?? t);
    aptitudes = p.aptitudes.slice(0, 2).map((a) => lab.aptitude.get(a) ?? a);
  } catch {
    // a candidate the core cannot bear in a preview is shown without traits
  }
  const how = HOW_WORD[spec.how];
  const line = `${how} · อายุ ${spec.age}${spec.married ? ` · คู่ ${spec.married}` : ''}${spec.other ? ` · อีกฝ่าย ${spec.other}` : ''}`;
  return { line, tie: spec.tie ?? '', name: spec.name, how, age: spec.age, chosen, traits, aptitudes, married: spec.married ?? null, other: spec.other ?? null, blood: spec.blood };
}

/** The heirs of the dead life, read from the bond book (the ctx of the game that ended). */
export function heirChoice(data: GameData, ctx: Ctx): HeirChoice {
  const x = lx(ctx.state);
  const heir = pickHeir(ctx);
  const kids = candidates(ctx);
  const pick = heir?.rung === 0 ? heir.tie : undefined;
  return {
    candidates: kids.map((k) => candidateOf(data, ctx, k, k.tie === pick)),
    successor: heir && heir.rung > 0 ? candidateOf(data, ctx, heir, true) : null,
    extinct: !heir,
    blocked: ctx.state.world.ended ? 'world-ended' : null,
    family: { dynasty: x.dynasty, generation: x.recs.length },
  };
}

/** The player goes on: picks the child (when one was picked), then bears the next life through the bridge. */
export function goOn(store: GameStore, opts: { tie?: string; newcomer?: boolean } = {}): NextResult | null {
  const g = store.game;
  if (!g) return null;
  if (opts.tie) pickHeirTie(g.ctx, opts.tie);
  return store.nextLife({ newcomer: !!opts.newcomer });
}

// ---------- the legend page ----------

export interface LegendLife {
  id: string;
  generation: number;
  name: string;
  raceName: string;
  born: number;
  died: number | null;
  age: number | null;
  cause: string;
  ending: string | null;
  origin: string;
  heir: string | null;
  mark: string | null;
  hand: number;
  alive: boolean;
  /** The vow of the life and what came of it ('' when none) and the titles it earned: they colour the leaf. */
  vow: string;
  vowResult: 'kept' | 'broken' | 'none';
  titles: string[];
  /** Has a card to open. */
  card: boolean;
  /** The second line of the leaf: race, how it began, the years. */
  line: string;
}

export interface LegendView {
  dynasty: string;
  generations: number;
  extinct: boolean;
  lives: LegendLife[];
  /** The ring of the chronicle: the points of the lineage and what each threshold opened (08-goals.md §4). */
  chronicle: { points: number; fruits: { at: number; opens: string; open: boolean }[]; lines: string[] };
  threads: WorldSummary['family']['threads'];
  seed: number;
  year: number;
}

const ORIGIN_WORD: Record<string, string> = { first: 'ชีวิตแรก', heir: 'ทายาท', successor: 'ผู้สืบต่อ', newcomer: 'คนใหม่' };

export function legendView(data: GameData, state: GameState): LegendView {
  const ws = worldSummary(state, data);
  const meta = peekGoals(state).meta;
  const lines = meta.lines as ChronicleLine[];
  const unlocks = (data.god?.items as { goals?: { unlocks?: { at: number; opens: string }[] } } | undefined)?.goals?.unlocks ?? [];
  const x = lx(state);
  return {
    dynasty: ws.family.dynasty,
    generations: ws.family.generations,
    extinct: ws.family.extinct,
    seed: state.seed,
    year: ws.year,
    lives: ws.lives.map((l) => {
      const line = lines.find((c) => c.life === l.id);
      return {
        id: l.id,
        generation: l.generation,
        name: l.name,
        raceName: l.raceName,
        born: l.born,
        died: l.died ?? null,
        age: l.age ?? null,
        cause: l.cause ?? '',
        ending: l.ending ?? null,
        origin: ORIGIN_WORD[l.origin] ?? l.origin,
        heir: l.heir ?? null,
        mark: l.mark ? (MARK_LEVEL_LABEL[l.mark] ?? l.mark) : null,
        hand: l.hand,
        alive: l.alive,
        vow: clean(data, line?.vow ?? ''),
        vowResult: line?.vowResult ?? 'none',
        titles: (line?.titles ?? []).map((t) => clean(data, t)),
        card: !!x.cards[l.id],
        line: `${l.raceName} · ${ORIGIN_WORD[l.origin] ?? l.origin} · ศ.ม. ${l.born}${l.died !== undefined ? ` – ${l.died}` : ''}${l.age !== undefined ? ` · อายุ ${l.age}` : ''}`,
      };
    }),
    chronicle: { points: meta.points, fruits: unlocks.map((u) => ({ at: u.at, opens: u.opens.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '').trim(), open: meta.points >= u.at })), lines: lines.map((c) => clean(data, c.text)) },
    threads: ws.family.threads,
  };
}

const MARK_LEVEL_LABEL: Record<string, string> = { none: 'ไม่ทิ้งรอย', local: 'รอยในถิ่น', era: 'รอยในยุค' };

// ---------- the collection ----------

export interface CollectionCategory {
  id: string;
  name: string;
  have: number;
  total: number;
  /** have / total, 0..1 (0 when the category has no end). */
  ratio: number;
  unlimited: boolean;
  found: { id: string; name: string }[];
  /** How many shadows to draw (the entries not found; their names are not told: 03 §5). */
  shadows: number;
}

export interface CollectionPage {
  have: number;
  total: number;
  ratio: number;
  categories: CollectionCategory[];
  modes: CollectionView['modes'];
}

/** The most shadows drawn for one category: the rest is the ratio. */
export const SHADOW_CAP = 48;

export function collectionPage(data: GameData, state: GameState): CollectionPage {
  const v = collectionView(state, data);
  return {
    have: v.have,
    total: v.total,
    ratio: v.total ? v.have / v.total : 0,
    modes: v.modes,
    categories: v.categories.map((c) => ({
      id: c.id,
      name: c.name,
      have: c.have,
      total: c.total,
      ratio: c.total ? c.have / c.total : 0,
      unlimited: !!c.unlimited,
      found: c.found.filter((f) => f.name || c.id === 'conjure').map((f) => ({ id: f.id, name: clean(data, f.name || f.id) })),
      shadows: c.unlimited ? 0 : Math.min(SHADOW_CAP, Math.max(0, c.total - c.have)),
    })),
  };
}

// ---------- the summary of the world ----------

export interface WorldSection {
  id: keyof typeof WORLD_SECTIONS;
  title: string;
  lines: string[];
}

export interface WorldPage {
  ended: boolean;
  /** The title of the page: the scene that ended the world, or the frame of a world that goes on. */
  title: string;
  sections: WorldSection[];
  legend: { text: string; source: 'template' | 'llm' };
}

/**
 * Does the page of the world's summary belong to this ending? 03-ending-and-collection.md §7: it is shown when the world falls (END-10, END-11, END-12) while the
 * character lives; the world falls in about 0-1% of lives, so the page is a rare scene and not the usual end. The legend page reaches it for the rest.
 */
export function worldEnded(data: GameData, state: GameState): boolean {
  return !!worldSummary(state, data).ended;
}

/** The page of the summary of the world, one section for each row of 03 §7. */
export function worldPage(data: GameData, state: GameState): WorldPage {
  const w = worldSummary(state, data);
  const ctx = makeCtx(state, data);
  const sec = (id: WorldSection['id'], lines: string[]): WorldSection => ({ id, title: WORLD_SECTIONS[id], lines });
  const seenWord = (ids: string[]) => (ids.length ? `เห็นโดย ${ids.length} ชีวิต` : 'ไม่มีชีวิตของตระกูลเห็น');
  const current = state.life && !state.life.dead ? state.life : null;
  const cardLine = (id: string) => lx(state).cards[id]?.lines[0];
  const you = current
    ? [`${current.name} อยู่ที่ ${placeName(ctx, current.country) ?? current.country} อายุ ${current.hAge}`]
    : [w.lives[w.lives.length - 1] ? cardLine(w.lives[w.lives.length - 1].id) ?? w.lives[w.lives.length - 1].name : ''];
  const sections: WorldSection[] = [
    sec('head', [w.ended ? `${w.ended.name} · ศ.ม. ${w.ended.year}` : `โลกยังดำเนินอยู่ · ศ.ม. ${w.year}`]),
    sec('time', [`${w.span.years} ปีโลก ตั้งแต่ ศ.ม. ${w.span.from} ถึง ศ.ม. ${w.span.to}`, `ผ่านมา ${w.era} ยุค`]),
    sec('dragons', [
      `ล้มแล้ว ${w.dragons.fallen.length} จาก ${w.dragons.total}`,
      ...w.dragons.fallen.map((d) => `${d.name} · ศ.ม. ${d.year} · ${seenWord(d.seenBy)}`),
      ...(w.dragons.standing.length ? [`ที่ยังอยู่: ${w.dragons.standing.join(' · ')}`] : []),
    ]),
    sec('countries', w.countries.ruined.length ? w.countries.ruined.map((c) => `${c.name} · ซาก ศ.ม. ${c.year}${c.healed ? ' · ฟื้นแล้ว' : ''}`) : ['ยังไม่มีประเทศใดล่ม']),
    sec('keys', [`กุญแจ ${w.keys} ชิ้น`]),
    sec('events', [`เหตุการณ์ใหญ่ ${w.events.total} เรื่อง`, ...w.events.top.map((e) => `${e.mark} ${e.name} · ศ.ม. ${e.year} · ${seenWord(e.seenBy)}`)]),
    sec('you', you.filter(Boolean)),
    sec('hand', [w.hand.total ? `แทรกแซง ${w.hand.total} ครั้ง` : 'ไม่มีพระหัตถ์ในโลกนี้เลย', ...Object.entries(w.hand.byKind).map(([k, n]) => `${HAND_WORD[k] ?? k} ${n}`)]),
  ];
  const c = (t: string) => clean(data, t);
  return { ended: !!w.ended, title: w.ended ? c(w.ended.name) : END_LABELS.world, sections: sections.map((x) => ({ ...x, lines: x.lines.map(c) })), legend: { ...w.legend, text: c(w.legend.text) } };
}
