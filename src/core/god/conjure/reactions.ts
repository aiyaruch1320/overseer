// The reactions with the state of a place (07-conjure.md §3): the game looks at this table before the table of results, and a reaction of mode `replace` gives the result in its place.
// There are ten in the document (`conjure.reactions` of the data, in this order); a test checks that each one here is the row of the data with the same index.
// A reaction is met only at the size of a place or a country (it reads the state of one country).
import type { Ctx } from '../../game';
import { hasFlag } from '../acts/geo';
import { actsOf, yearOf } from '../acts/state';
import { godData } from '../state';
import type { Mix } from './plan';
import type { Op } from './ops';
import { CHURCH_OF_LIGHT, FLOOD_MEMORY, GIANT_LANDS, SEAL_HOME, UNDEAD_RULED } from './tuning';

export interface Reaction {
  /** Index in the data, from 0, and the id the collection keeps (`R01`). */
  i: number;
  id: string;
  /** `replace`: the result is these ops in the place of the cell's · `add`: the result of the cell is done and this comes with it. */
  mode: 'replace' | 'add';
  say: string;
  ops?: Op[];
  /** The shadow is certain (07-conjure.md §3 row 2). */
  shadowSure?: boolean;
  /** The cell's own ops land on one neighbour too (row 3). */
  spread?: boolean;
  /** The mood of the dragons whose seal is in the country moves by this (row 9). */
  mood?: number;
  /** The words of the row of the data, for the preview. */
  text(ctx: Ctx): string;
  matches(ctx: Ctx, mix: Mix, country: string): boolean;
}

const row = (ctx: Ctx, i: number) => godData(ctx).conjure.reactions[i];
const textOf = (i: number) => (ctx: Ctx) => `${row(ctx, i)?.cond ?? ''} → ${(row(ctx, i)?.result ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')}`;
const is = (m: Mix, verb: string, core: string) => m.verb === verb && m.core === core;

/** The country has a religion of the id as its main one (countries.json `religions`). */
function mainFaith(ctx: Ctx, country: string, faith: string): boolean {
  const f = ctx.data.countries?.items as Record<string, { id: string; religions?: { id: string; primary?: boolean }[] }> | undefined;
  const c = f ? Object.values(f).find((x) => x.id === country) : undefined;
  return !!c?.religions?.some((r) => r.id === faith && r.primary);
}

/** A flood in the last years: DR-05, or MR-19 on this country (its modifier of W −2 still stands). */
function afterFlood(ctx: Ctx, country: string): boolean {
  const y = ctx.state.world.happened['DR-05'];
  if (y !== undefined && yearOf(ctx) - y <= FLOOD_MEMORY) return true;
  return actsOf(ctx.state).mods.some((m) => m.src === 'MR-19' && m.country === country && (m.until === undefined || m.until > yearOf(ctx)));
}

const make = (i: number, r: Omit<Reaction, 'i' | 'id' | 'text'>): Reaction => ({ i, id: `R${String(i + 1).padStart(2, '0')}`, text: textOf(i), ...r });

/** The index of the last reaction: any destroying verb on a seal pin (04-miracles.md §5.4). It is a weakening of the result, not a result of its own, and is read from the pins of the plan. */
export const SEAL_HIT = 9;

export const REACTIONS: Reaction[] = [
  make(0, {
    mode: 'replace',
    say: 'ภัยแล้งจบ และยุคทองสองปี',
    ops: [{ op: 'unflag', flag: 'famine' }, { op: 'flag', flag: 'golden', years: 2 }],
    matches: (ctx, m, c) => is(m, 'create', 'water') && hasFlag(ctx, c, 'famine'),
  }),
  make(1, {
    mode: 'add',
    say: 'น้ำมาซ้ำหลังน้ำท่วม',
    shadowSure: true,
    matches: (ctx, m, c) => is(m, 'create', 'water') && !hasFlag(ctx, c, 'famine') && afterFlood(ctx, c),
  }),
  make(2, {
    mode: 'add',
    say: 'ไฟลามประเทศข้างเคียง',
    spread: true,
    matches: (ctx, m, c) => is(m, 'destroy', 'fire') && hasFlag(ctx, c, 'forest_blight'),
  }),
  make(3, {
    mode: 'replace',
    say: 'ผีและศัตรูผีหลับ ผู้ปกครองไม่ถูกแตะ',
    ops: [{ op: 'mod', subject: 'undead-foes', mul: 0, years: 10 }],
    matches: (_ctx, m, c) => is(m, 'calm', 'death') && UNDEAD_RULED.includes(c),
  }),
  make(4, {
    mode: 'replace',
    say: 'ผู้พิทักษ์ยักษ์แรงขึ้นหนึ่งขั้น',
    ops: [{ op: 'event', ids: ['GI-02'], mul: 1.5, years: 10 }, { op: 'mod', subject: 'defense', add: 1, years: 10 }],
    matches: (_ctx, m, c) => is(m, 'wake', 'earth') && GIANT_LANDS.includes(c),
  }),
  make(5, {
    mode: 'replace',
    say: 'เผ่าลาวาที่เย็นตัวได้ไฟคืนมา',
    ops: [{ op: 'mod', subject: 'W', add: 1 }],
    matches: (ctx, m, c) => is(m, 'change', 'fire') && c.startsWith('KD') && ctx.state.world.happened['AS-03'] !== undefined,
  }),
  make(6, {
    mode: 'replace',
    say: 'เรื่องของทายาทเมืองที่หายเปิดทันที',
    ops: [{ op: 'open', id: 'RU-06' }],
    matches: (ctx, m, c) => is(m, 'reveal', 'death') && hasFlag(ctx, c, 'god_ruin'),
  }),
  make(7, {
    mode: 'replace',
    say: 'ศาสนจักรแห่งแสงแตกเป็นนิกาย',
    ops: [{ op: 'event', ids: ['GD-02'], mul: 2, years: 10 }],
    matches: (ctx, m, c) => is(m, 'destroy', 'light') && mainFaith(ctx, c, CHURCH_OF_LIGHT),
  }),
  make(8, {
    mode: 'add',
    say: 'มังกรที่ผนึกอยู่ที่นี่ใจเย็นลง',
    mood: 5,
    matches: (ctx, m, c) => is(m, 'create', 'life') && (SEAL_HOME[c] ?? []).some((i) => ctx.state.world.dragons[i]?.alive),
  }),
  make(9, {
    mode: 'add',
    say: 'ผนึกรับแรงไว้ ผลลดลงหนึ่งระดับ',
    matches: (ctx, m, c) => m.verb === 'destroy' && c in SEAL_HOME && ((SEAL_HOME[c] ?? []).length === 0 || SEAL_HOME[c].some((i) => ctx.state.world.dragons[i]?.alive)),
  }),
];
