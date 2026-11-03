// The view models of the allies and family screens (docs/appearance/16-ally-scenes.md, 19-ally-successors.md, docs/systems/bonds/): the circle of ties grouped
// by line, each with its level, its present feeling, its age and stage, the other parent, the history of the tie and the crisis that waits; and the family
// tree across the lineage. Pure over (data, state): every sentence comes from the log reader (src/core/text) or the tables of the bonds data; the labels of the
// sections are the words of the documents (ALLIES_W). The storybook feeds these a sample state; the screens read them in a render that read `store.rev.value`.
import { adultAgeOf, alliesOf, bondsIndex, crisesWaiting, extOf, hAgeOf, isChild, isLive, isPartner, levelOf, stageOfAge, tiesOf, type Tie } from '../../core/bonds';
import { makeCtx, type Ctx, type GameData } from '../../core/game';
import { lx, pickHeir, recOf, type HeirSpec } from '../../core/lineage';
import { lineWord, lines, type Line } from '../../core/text';
import { calendarYear, raceName } from '../../core/text/pick';
import { CAUSE_TH } from '../../core/text/tuning';
import { BOND_CAUSE_TH } from '../../core/text/words';
import type { GameState } from '../../core/types';

// ---------- the words of the screens ----------

export const ALLIES_W = {
  title: 'พวกพ้องและครอบครัว',
  circle: 'วงสัมพันธ์',
  tree: 'ตระกูล',
  empty: 'ยังไม่มีใครผูกพันกับเขาเลย',
  lonely: 'เขาเดินชีวิตคนเดียว',
  noLife: 'ยังไม่มีตัวละคร',
  level: 'ระดับ',
  history: 'เรื่องระหว่างกัน',
  noHistory: 'ยังไม่มีเรื่องที่เล่าไว้',
  otherParent: 'อีกฝ่ายของลูก',
  married: 'แต่งงานกับ',
  party: 'ผู้ร่วมทาง',
  feeling: 'ตอนนี้รู้สึก',
  calm: 'ไม่มีอารมณ์เด่น',
  age: 'อายุ',
  crisis: 'วิกฤตที่รอการตัดสินใจ',
  whisper: 'กระซิบถึงเขา',
  whisperHint: 'ท่านกระซิบถึงเขาได้ก่อนที่เขาจะตัดสินใจ',
  gone: 'ผู้จากไป',
  moreHistory: 'ก่อนหน้านี้',
  // the tree
  dynasty: 'ตระกูล',
  generation: 'รุ่นที่',
  elders: 'ผู้ใหญ่ในตระกูล',
  siblings: 'พี่น้อง',
  partners: 'คู่ชีวิต',
  children: 'ลูก',
  heir: 'ผู้สืบตระกูล',
  heirNext: 'ผู้ที่จะสืบต่อ',
  dead: 'ผู้ล่วงลับ',
  extinct: 'ตระกูลสิ้น',
  noHeir: 'ยังไม่มีใครสืบต่อได้',
  noTree: 'ยังไม่มีตระกูลให้ดู',
  alive: 'ยังมีชีวิต',
  current: 'ชีวิตที่เฝ้ามอง',
} as const;

export type GroupId = 'family' | 'partner' | 'friends' | 'rivals' | 'mentors' | 'companions';

/** The groups of the circle, in the order the screen draws them (the task: family, lover or partner, friends, rivals, teacher and student, companions). */
export const GROUPS: { id: GroupId; title: string; lines: string[] }[] = [
  { id: 'family', title: 'ครอบครัว', lines: ['ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์', 'พี่น้อง'] },
  { id: 'partner', title: 'คนรัก', lines: ['คนรัก'] },
  { id: 'friends', title: 'สหายและคู่หู', lines: ['สหาย', 'คู่หู'] },
  { id: 'rivals', title: 'คู่แข่ง', lines: ['คู่แข่ง'] },
  { id: 'mentors', title: 'ครูและศิษย์', lines: ['ครู', 'ศิษย์'] },
  { id: 'companions', title: 'ผู้ร่วมทางและสัตว์ร่วมทาง', lines: [] },
];

const STAGE_WORD: Record<string, string> = { infant: 'ทารก', child: 'เด็ก', youth: 'วัยรุ่น', adult: 'โตแล้ว' };
const KIN_EXTRA: Record<string, string> = { cousin: 'ญาติพี่น้อง', spouse: 'คู่ชีวิต' };
const ORIGIN_WORD: Record<string, string> = { first: 'ชีวิตแรก', heir: 'ทายาท', successor: 'ผู้สืบต่อ', newcomer: 'คนใหม่' };
const HOW_WORD: Record<HeirSpec['how'], string> = { child: 'ลูก', adopted: 'ลูกบุญธรรม', student: 'ศิษย์', partner: 'คู่ชีวิต', helped: 'ผู้ที่เขาเคยช่วย', newcomer: 'คนใหม่' };
const LEAD_KIN = ['father', 'mother', 'parent'];
/** The lines of history a tie shows (the newest ones). */
export const HISTORY_MAX = 8;

// ---------- the circle ----------

export interface HistoryLine {
  n: number;
  age: number | null;
  text: string;
}

export interface CrisisView {
  text: string;
  /** hAge of the character when the crisis was announced. */
  since: number;
  /** The story it belongs to (`FT-03` or an NPC id). */
  code: string;
}

export interface TieView {
  id: string;
  name: string;
  /** The line as the data names it (it keys the colour and the icon). */
  line: string;
  /** What he is to the character in a word: `ลูก`, `พี่`, `คู่ชีวิต`, `สหาย` ... */
  word: string;
  group: GroupId;
  level: number;
  levelName: string;
  b: number;
  /** The strongest feeling now (one of the 24), else null; and the second one. */
  mood: string | null;
  alsoMood: string | null;
  age: number;
  /** Life stage of a child (`ทารก` `เด็ก` `วัยรุ่น` `โตแล้ว`), else null. */
  stage: string | null;
  isChild: boolean;
  isPartner: boolean;
  /** The other parent of a child, by name (a person who is one of the ties or only a name). */
  other: string | null;
  married: string | null;
  party: boolean;
  /** Family frame without a story of its own (parents, uncles, cousins). */
  light: boolean;
  alive: boolean;
  /** For a person who has gone: how and when, in words; else null. */
  goneNote: string | null;
  history: HistoryLine[];
  /** More lines of history than the ones kept. */
  historyMore: number;
  crisis: CrisisView | null;
}

export interface GroupView {
  id: GroupId;
  title: string;
  ties: TieView[];
}

export interface Circle {
  /** The groups that have someone in them, in the order of GROUPS. */
  groups: GroupView[];
  /** The people who went (death, parting, fading): the ones that mattered. */
  gone: TieView[];
  /** The crises that wait for the character, as ties. */
  waiting: TieView[];
  lonely: boolean;
  /** Name of the character and his age, or null between lives. */
  who: { name: string; age: number } | null;
  total: number;
}

const empty = (): Circle => ({ groups: [], gone: [], waiting: [], lonely: true, who: null, total: 0 });

function groupOf(t: Tie, party: string[]): GroupId {
  if (GROUPS[0].lines.includes(t.line) || isChild(t)) return 'family';
  if (isPartner(t)) return 'partner';
  if (t.line === 'ครู' || t.line === 'ศิษย์') return 'mentors';
  if (t.line === 'คู่แข่ง') return 'rivals';
  if (party.includes(t.id) || t.race === 'beast') return 'companions';
  return 'friends';
}

/** The word for a person: `ลูก` `พ่อ` `คู่ชีวิต`; the data's line name for the rest. */
function wordOf(t: Tie): string {
  if (t.spouse) return t.gender === 'f' ? 'ภรรยา' : t.gender === 'm' ? 'สามี' : 'คู่ชีวิต';
  if (t.kin && KIN_EXTRA[t.kin]) return KIN_EXTRA[t.kin];
  return lineWord(t.line, t.kin) || t.line;
}

function causeWord(cause: string): string {
  return CAUSE_TH[cause] ?? BOND_CAUSE_TH[cause] ?? cause;
}

function goneNote(t: Tie): string | null {
  if (t.state === 'alive') return null;
  const g = t.gone;
  const way = t.state === 'dead' ? 'จากไป' : t.state === 'faded' ? 'ห่างหาย' : 'แยกทาง';
  const cause = t.died?.cause ? causeWord(t.died.cause) : '';
  const age = t.died?.age ?? g?.age;
  const reason = t.state !== 'dead' && g?.reason ? g.reason : '';
  return [way + (age !== undefined ? ` เมื่ออายุ ${age}` : ''), cause, reason].filter(Boolean).join(' · ');
}

/** The feelings a tie shows now: the one that lasts longest first. */
function moodsNow(t: Tie, hAge: number): string[] {
  return t.moods.filter((m) => m.until > hAge).sort((a, b) => b.until - a.until).map((m) => m.mood);
}

function ageOf(ctx: Ctx, t: Tie): number {
  if (t.state === 'dead' && t.died) return t.died.age;
  return Math.max(0, Math.floor(hAgeOf(ctx, t)));
}

/** Lines of the log that belong to the life now, read the way the player reads them, grouped by the tie they name (by id for the bonds, by name for the rest). */
function historyOf(data: GameData, state: GameState, ties: Tie[]): { by: Map<string, Line[]>; byN: Map<number, Line> } {
  const life = state.life;
  const from = life ? recOf(state, life.id)?.startN ?? 0 : 0;
  const all = lines(data, state.log, 1).filter((l) => l.n >= from);
  const byN = new Map(all.map((l) => [l.n, l]));
  const by = new Map<string, Line[]>();
  const byId = new Map(ties.map((t) => [t.id, t]));
  for (const l of all) {
    const own = l.entry.sys === 'bonds' && l.entry.id ? byId.get(l.entry.id) : undefined;
    for (const t of ties) {
      // the names are the book's, so a line that says the name of a person is a line about him (a name of two letters could be a piece of another word: it needs three)
      if (own?.id === t.id || (t.name.length >= 3 && l.entry.sys !== 'bonds' && l.text.includes(t.name))) {
        const list = by.get(t.id) ?? [];
        list.push(l);
        by.set(t.id, list);
      }
    }
  }
  return { by, byN };
}

function tieView(ctx: Ctx, life: NonNullable<GameState['life']>, t: Tie, party: string[], hist: Line[] | undefined, crisis: CrisisView | null): TieView {
  const ix = bondsIndex(ctx);
  const level = levelOf(ctx, t);
  const age = ageOf(ctx, t);
  const moods = t.state === 'alive' ? moodsNow(t, life.hAge) : [];
  const child = isChild(t);
  const all = (hist ?? []).map((l) => ({ n: l.n, age: l.age ?? null, text: l.text }));
  return {
    id: t.id,
    name: t.name,
    line: t.line,
    word: wordOf(t),
    group: groupOf(t, party),
    level,
    levelName: ix.data.ties.levels.find((l) => l.n === level)?.name ?? '',
    b: Math.round(t.b),
    mood: moods[0] ?? null,
    alsoMood: moods[1] ?? null,
    age,
    stage: child ? STAGE_WORD[t.stage && t.state === 'alive' ? stageOfAge(age, adultAgeOf(ctx, t)) : t.stage ?? 'adult'] ?? null : null,
    isChild: child,
    isPartner: isPartner(t),
    other: child ? t.otherName ?? null : null,
    married: t.married ? t.married.name : null,
    party: party.includes(t.id),
    light: t.light && !child,
    alive: t.state === 'alive',
    goneNote: goneNote(t),
    history: all.slice(-HISTORY_MAX),
    historyMore: Math.max(0, all.length - HISTORY_MAX),
    crisis,
  };
}

/** Sort inside a group: the partner and the children (the eldest first) before the frame of the family; the closest first for the others. */
function order(g: GroupId, a: TieView, b: TieView): number {
  if (g === 'family') {
    const rank = (t: TieView) => (t.isChild ? 0 : t.light ? 2 : 1);
    return rank(a) - rank(b) || (a.isChild ? b.age - a.age : b.level - a.level) || b.b - a.b || a.name.localeCompare(b.name);
  }
  return b.level - a.level || b.b - a.b || a.name.localeCompare(b.name);
}

/** The circle of ties of the life now (a life that has died shows the book it left). */
export function circleOf(data: GameData, state: GameState): Circle {
  const life = state.life;
  if (!life || !life.ext.bonds) return empty();
  const ctx = makeCtx(state, data);
  const e = extOf(life);
  const ties = tiesOf(e);
  const { by, byN } = historyOf(data, state, ties);
  const waiting = life.dead ? [] : crisesWaiting(ctx);
  const crisisOf = (t: Tie): CrisisView | null => {
    const w = waiting.find((x) => x.tie.id === t.id);
    return w ? { text: byN.get(w.crisis.n)?.text ?? w.crisis.text, since: w.crisis.age, code: w.crisis.code } : null;
  };
  // the line that announced the crisis is told once, in the box of the crisis, not again in the story between the two (M5 review: the same text three times)
  const view = (t: Tie) => {
    const w = waiting.find((x) => x.tie.id === t.id);
    return tieView(ctx, life, t, e.party, w ? by.get(t.id)?.filter((h) => h.n !== w.crisis.n) : by.get(t.id), crisisOf(t));
  };
  // the allies are the ties the god's word can name (alive, with a story of their own or a child); the frame of the family stays in the family group
  const named = new Set(alliesOf(ctx).map((t) => t.id));
  const live = ties.filter(isLive).filter((t) => named.has(t.id) || (t.light && GROUPS[0].lines.includes(t.line)) || life.dead).map(view);
  const groups: GroupView[] = GROUPS.map((g) => ({ id: g.id, title: g.title, ties: live.filter((t) => t.group === g.id).sort((a, b) => order(g.id, a, b)) })).filter((g) => g.ties.length > 0);
  // those who went and mattered: not the grandparents who were dead before he was born
  const gone = ties.filter((t) => !isLive(t) && (!t.light || isChild(t) || (t.kin !== undefined && (LEAD_KIN.includes(t.kin) || t.kin === 'spouse')))).map(view).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  const allies = live.filter((t) => !t.light);
  return {
    groups,
    gone,
    waiting: waiting.map((w) => view(w.tie)),
    lonely: allies.length === 0,
    who: { name: life.name, age: life.dead ? life.dead.hAge : Math.floor(life.hAge) },
    total: live.length,
  };
}

// ---------- the family tree ----------

export interface KinNode {
  id: string;
  name: string;
  /** What he is to the life in the middle: `พ่อ` `ลูก` `พี่` `คู่ชีวิต` ... */
  role: string;
  age: number | null;
  alive: boolean;
  /** How he died, when he did. */
  died: string | null;
  /** The child who would take over (the eldest, or the one picked). */
  heir: boolean;
  stage: string | null;
  other: string | null;
  married: string | null;
  line: string;
}

export interface GenView {
  n: number;
  id: string;
  name: string;
  raceName: string;
  /** `ศ.ม. 1200 – 1274` */
  years: string;
  /** Years lived, or null while he lives. */
  age: number | null;
  cause: string;
  ending: string | null;
  origin: string;
  /** The name of the one who took over. */
  heir: string | null;
  alive: boolean;
  /** The life the player watches now. */
  current: boolean;
}

export interface TreeView {
  dynasty: string;
  generations: GenView[];
  /** Kin of the life now: the elders above him, his brothers and sisters, his partners (the dead and the parted too), his children. */
  elders: KinNode[];
  siblings: KinNode[];
  partners: KinNode[];
  children: KinNode[];
  /** Who would take over now (or took over), by the ladder; null when no one. */
  heir: { name: string; how: string; age: number; tie: string | null } | null;
  extinct: boolean;
  /** The dead: the lives of the lineage and the kin that died. */
  dead: { name: string; role: string; note: string }[];
}

const emptyTree = (): TreeView => ({ dynasty: '', generations: [], elders: [], siblings: [], partners: [], children: [], heir: null, extinct: false, dead: [] });

function nodeOf(ctx: Ctx, t: Tie, heir: string | null): KinNode {
  const age = ageOf(ctx, t);
  const child = isChild(t);
  return {
    id: t.id,
    name: t.name,
    role: wordOf(t),
    age,
    alive: t.state === 'alive',
    died: t.state === 'alive' ? null : goneNote(t),
    heir: heir === t.id,
    stage: child ? STAGE_WORD[stageOfAge(age, adultAgeOf(ctx, t))] ?? null : null,
    other: child ? t.otherName ?? null : null,
    married: t.married ? t.married.name : null,
    line: t.line,
  };
}

const ELDER_KIN = new Set(['father', 'mother', 'parent', 'grand', 'uncle', 'aunt']);
const SIB_KIN = new Set(['elder_sibling', 'younger_sibling', 'cousin']);

/** The family across the lineage: the lives in the order they were lived, and the household of the life now. */
export function familyTree(data: GameData, state: GameState): TreeView {
  const x = lx(state);
  const life = state.life;
  const lives = state.lineage.lives;
  if (!life && lives.length === 0) return emptyTree();
  const ctx = makeCtx(state, data);
  const gens: GenView[] = lives.map((l, i) => {
    const r = x.recs.find((q) => q.id === l.id);
    return {
      n: r?.generation ?? i + 1,
      id: l.id,
      name: l.name,
      raceName: raceName(ctx, l.race),
      years: `ศ.ม. ${calendarYear(l.born)} – ${calendarYear(l.died)}`,
      age: r ? Math.round(r.age) : null,
      cause: r?.cause ? causeWord(r.cause) : '',
      ending: l.title ?? r?.ending ?? null,
      origin: ORIGIN_WORD[r?.origin ?? 'first'] ?? '',
      heir: r?.heir ?? null,
      alive: false,
      current: false,
    };
  });
  if (life && !life.dead && !lives.some((l) => l.id === life.id)) {
    const r = recOf(state, life.id);
    gens.push({
      n: r?.generation ?? gens.length + 1,
      id: life.id,
      name: life.name,
      raceName: raceName(ctx, life.race),
      years: `ศ.ม. ${calendarYear(life.birthYear)} –`,
      age: null,
      cause: '',
      ending: null,
      origin: ORIGIN_WORD[r?.origin ?? 'first'] ?? '',
      heir: null,
      alive: true,
      current: true,
    });
  } else if (gens.length > 0 && life?.dead) gens[gens.length - 1].current = true;

  let heir: TreeView['heir'] = null;
  let elders: KinNode[] = [];
  let siblings: KinNode[] = [];
  let partners: KinNode[] = [];
  let children: KinNode[] = [];
  if (life && life.ext.bonds) {
    const spec = pickHeir(ctx);
    if (spec) heir = { name: spec.name, how: HOW_WORD[spec.how], age: spec.age, tie: spec.tie ?? null };
    const ties = tiesOf(extOf(life));
    const pick = heir?.tie ?? null;
    const node = (t: Tie) => nodeOf(ctx, t, pick);
    elders = ties.filter((t) => t.kin !== undefined && ELDER_KIN.has(t.kin) && (t.state === 'alive' || LEAD_KIN.includes(t.kin) || t.kin === 'grand')).map(node);
    siblings = ties.filter((t) => t.kin !== undefined && SIB_KIN.has(t.kin) && t.kin !== 'cousin').map(node);
    partners = ties.filter(isPartner).map(node);
    children = ties.filter(isChild).map(node).sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
  } else if (!life && state.lineage.lives.length) {
    const h = x.heir;
    if (h) heir = { name: h.name, how: HOW_WORD[h.how], age: h.age, tie: h.tie ?? null };
  }
  // an heir picked by the finished life is not read by the ladder again (the dead life keeps its book, so the ladder answers the same)
  const dead: TreeView['dead'] = [
    ...gens.filter((g) => !g.alive).map((g) => ({ name: g.name, role: `${ALLIES_W.generation} ${g.n}`, note: [g.years, g.age !== null ? `${ALLIES_W.age} ${g.age}` : '', g.cause].filter(Boolean).join(' · ') })),
    // a parent or grandparent who was a life of the lineage is on the list once, as that life
    ...[...elders, ...siblings, ...partners, ...children].filter((k) => !k.alive && !gens.some((g) => g.name === k.name)).map((k) => ({ name: k.name, role: k.role, note: k.died ?? '' })),
  ];
  return { dynasty: x.dynasty || gens[0]?.name || '', generations: gens, elders, siblings, partners, children, heir, extinct: !!x.extinct, dead };
}
