// The small effects the cells of the conjuring are made of (07-conjure.md §2: "ผลทุกช่องใช้คันโยกที่มีอยู่แล้วของโลก ไม่สร้างกลไกใหม่"): a flag on a country, a modifier
// of a price or a count, the faith of the country, the weight of an event, a deed left in the world for the systems to find. One op lands on one country; a size
// carries the effect to the place (half) or to every country of the continent (×0.6) by scaling the numbers of the op (`scaleOp`).
// Every draw is from a stream made of the seed and the mix (`rng` of the scope), never from the shared streams: the same mix on the same target gives the same result.
import type { Ctx } from '../../game';
import type { Rng } from '../../rng';
import { holdEvent, openByGod, weightOf } from '../../world';
import { tablesOf } from '../../world';
import { geoOf } from '../../world/place';
import { clamp, continentOf, hasFlag, isDesert } from '../acts/geo';
import { addMod, clearFlag, faithAt, setFlag } from '../acts/mods';
import { actsOf, yearOf } from '../acts/state';
import { slotsOf } from '../../npc/types';
import { npcIndex } from '../../npc/data';
import { DEFAULT_YEARS, EVENT_RANGE } from './tuning';

export type Test = 'cold' | 'dr04' | 'desert' | 'coastal' | 'coastDry';

export type Op =
  | { op: 'flag'; flag: string; years?: number }
  | { op: 'unflag'; flag: string }
  | { op: 'mod'; subject: string; mul?: number; add?: number; years?: number }
  | { op: 'faith'; delta: number }
  | { op: 'event'; ids: string[]; mul: number; years?: number }
  | { op: 'group'; group: string; mul: number; years?: number }
  | { op: 'deed'; kind: string; id: string }
  /** A deed that needs a person of the country: a ghost of a dead one, a prophet, a hidden secret (`from`). */
  | { op: 'npc'; kind: string; from: 'dead' | 'alive' }
  /** A hidden thing of the tier in a place of the country (like MR-16). */
  | { op: 'hidden'; tier: 'R' | 'E' }
  | { op: 'open'; id: string }
  | { op: 'when'; test: Test; then: Op[]; else?: Op[] };

export interface Scope {
  country: string;
  /** 1 for a country, 0.5 for a place, 0.6 for each country of a continent. */
  factor: number;
  rng: Rng;
  /** The source written on the modifiers (`conjure:<verb>.<core>`). */
  src: string;
}

/** Is the country cold, a coastal land with no water, a desert ... (the tests of `when`). Pure. */
export function holds(ctx: Ctx, test: Test, country: string): boolean {
  const geo = geoOf(ctx, country);
  switch (test) {
    case 'cold':
      return continentOf(country) === 'NB';
    case 'dr04':
      return ctx.state.world.happened['DR-04'] !== undefined;
    case 'desert':
      return isDesert(ctx, country);
    case 'coastal':
      return !!geo && (geo.coast || geo.river);
    case 'coastDry':
      return !!geo && geo.coast && (isDesert(ctx, country) || hasFlag(ctx, country, 'famine', 'sandstorm'));
  }
}

/** The numbers of an op as the size carries them. */
export function scaleOp(op: Op, f: number): Op {
  if (f === 1) return op;
  switch (op.op) {
    case 'mod':
      return { ...op, ...(op.mul !== undefined ? { mul: Math.round((1 + (op.mul - 1) * f) * 1000) / 1000 } : {}), ...(op.add !== undefined ? { add: Math.round(op.add * f * 1000) / 1000 } : {}) };
    case 'faith':
      return { ...op, delta: Math.round(op.delta * f * 100) / 100 };
    case 'event':
    case 'group':
      return { ...op, mul: Math.round((1 + (op.mul - 1) * f) * 1000) / 1000 };
    case 'flag':
      return { ...op, years: Math.max(1, Math.round((op.years ?? DEFAULT_YEARS) * f)) };
    case 'when':
      return { ...op, then: op.then.map((o) => scaleOp(o, f)), ...(op.else ? { else: op.else.map((o) => scaleOp(o, f)) } : {}) };
    default:
      return op;
  }
}

/** The ops of a list that the test of a `when` lets through, flattened (for a preview: what would be done). Pure. */
export function flatten(ctx: Ctx, ops: readonly Op[], country: string): Exclude<Op, { op: 'when' }>[] {
  const out: Exclude<Op, { op: 'when' }>[] = [];
  for (const o of ops) {
    if (o.op === 'when') out.push(...flatten(ctx, holds(ctx, o.test, country) ? o.then : o.else ?? [], country));
    else out.push(o);
  }
  return out;
}

const SUBJECT_TH: Record<string, string> = {
  W: 'ความมั่งคั่งของประเทศ',
  C: 'ความเชื่อมั่นทองกลาง',
  food: 'ราคาอาหาร',
  medicine: 'ราคายา',
  wood: 'ราคาไม้',
  sea: 'ต้นทุนขนส่งทะเล',
  mercenary: 'ทหารรับจ้าง',
  defense: 'ศึกป้องกัน',
  'war-risk': 'ความเสี่ยงสงครามชายแดน',
  'black-market': 'ตลาดมืด',
  'bond-escape': 'การหนีของผู้ถูกผูกตัว',
  price: 'ราคาในประเทศ',
  forge: 'การตีอาวุธ',
  machines: 'จักรกลและอาวุธ',
  'beast-fights': 'ศึกกับสัตว์ป่า',
  'undead-foes': 'ศัตรูผี',
  'travel-time': 'เวลาเดินทางในประเทศ',
  'travel-fare': 'ค่าเดินทางเข้าออกประเทศ',
  'fire-events': 'เหตุการณ์ไฟ',
  'quake-events': 'แผ่นดินไหว',
  'storm-events': 'พายุ',
  ore: 'แร่และโลหะส่งออก',
  flood: 'น้ำท่วม',
};

/** The words for the preview of one op ("ราคาอาหาร ×0.8 สิบปี"). Pure. */
export function opText(op: Exclude<Op, { op: 'when' }>): string {
  const y = (n?: number) => (n === undefined ? ' ถาวร' : ` ${n} ปี`);
  switch (op.op) {
    case 'flag':
      return `ธง ${op.flag}${y(op.years)}`;
    case 'unflag':
      return `ธง ${op.flag} หาย`;
    case 'mod':
      return `${SUBJECT_TH[op.subject] ?? op.subject} ${op.mul !== undefined ? `×${op.mul}` : `${(op.add ?? 0) >= 0 ? '+' : '−'}${Math.abs(op.add ?? 0)}`}${y(op.years)}`;
    case 'faith':
      return `ศรัทธาตรงของประเทศ ${op.delta >= 0 ? '+' : '−'}${Math.abs(op.delta)}`;
    case 'event':
      return `น้ำหนัก ${op.ids.join(' ')} ×${op.mul}${y(op.years ?? DEFAULT_YEARS)}`;
    case 'group':
      return `น้ำหนักเหตุการณ์ ${op.group} ×${op.mul}${y(op.years ?? DEFAULT_YEARS)}`;
    case 'deed':
      return `สิ่งที่ทิ้งไว้ในโลก: ${op.kind}`;
    case 'npc':
      return `เรื่องของ NPC หนึ่งคน (${op.kind})`;
    case 'hidden':
      return `ซ่อนของระดับ ${op.tier} หนึ่งชิ้น`;
    case 'open':
      return `เปิดเหตุการณ์ ${op.id} ทันที`;
  }
}

// ---------- running ----------

export interface Done {
  /** What was done, as words (for the log). */
  notes: string[];
}

/** NPC ids of a country, sorted: the dead within ten years, or the living. */
function folk(ctx: Ctx, country: string, from: 'dead' | 'alive'): string[] {
  const slots = slotsOf(ctx.state);
  const rows = npcIndex(ctx).rows;
  const y = yearOf(ctx);
  return Object.keys(slots)
    .sort()
    .filter((id) => {
      const s = slots[id];
      const home = s.place ?? rows.get(id)?.country;
      if (home !== country) return false;
      return from === 'alive' ? s.status === 'alive' : s.status === 'dead' && s.died !== undefined && y - s.died <= 10;
    });
}

/** Is there a person for an `npc` op in this country (the check of a cell that needs one)? */
export const hasFolk = (ctx: Ctx, country: string, from: 'dead' | 'alive'): boolean => folk(ctx, country, from).length > 0;

export function runOps(ctx: Ctx, ops: readonly Op[], sc: Scope): Done {
  const done: Done = { notes: [] };
  const c = sc.country;
  const a = () => actsOf(ctx.state);
  for (const op of ops) {
    switch (op.op) {
      case 'when':
        runOps(ctx, holds(ctx, op.test, c) ? op.then : op.else ?? [], sc);
        break;
      case 'flag':
        setFlag(ctx, c, op.flag, Math.max(1, Math.round((op.years ?? DEFAULT_YEARS) * sc.factor)));
        break;
      case 'unflag':
        clearFlag(ctx, c, op.flag);
        break;
      case 'mod': {
        const o = scaleOp(op, sc.factor) as typeof op;
        addMod(ctx, { subject: o.subject, country: c, ...(o.mul !== undefined ? { mul: o.mul } : {}), ...(o.add !== undefined ? { add: o.add } : {}), ...(o.years !== undefined ? { years: o.years } : {}), src: sc.src });
        break;
      }
      case 'faith':
        faithAt(ctx, c, op.delta * sc.factor);
        break;
      case 'event': {
        const m = 1 + (op.mul - 1) * sc.factor;
        for (const id of op.ids) holdEvent(ctx, id, clamp(weightOf(ctx, id) * m, EVENT_RANGE[0], EVENT_RANGE[1]), yearOf(ctx) + (op.years ?? DEFAULT_YEARS));
        break;
      }
      case 'group': {
        const m = 1 + (op.mul - 1) * sc.factor;
        for (const ev of tablesOf(ctx).rolled) {
          if (ev.group !== op.group) continue;
          const here = ev.home.countries.includes(c) || (!ev.home.countries.length && (ev.home.world || ev.home.continents.includes(continentOf(c) as never)));
          if (here) holdEvent(ctx, ev.id, clamp(weightOf(ctx, ev.id) * m, EVENT_RANGE[0], EVENT_RANGE[1]), yearOf(ctx) + (op.years ?? DEFAULT_YEARS));
        }
        break;
      }
      case 'deed':
        a().deeds.push({ kind: op.kind, id: op.id, country: c, year: yearOf(ctx) });
        break;
      case 'npc': {
        const list = folk(ctx, c, op.from);
        if (!list.length) break;
        const id = sc.rng.pick(list);
        a().deeds.push({ kind: op.kind, id, country: c, year: yearOf(ctx) });
        done.notes.push(`${op.kind}:${id}`);
        break;
      }
      case 'hidden': {
        const items = (ctx.data.items?.items as { items?: { id: string; tier: string; cat: string }[] } | undefined)?.items ?? [];
        const pool = items.filter((i) => i.tier === op.tier && i.cat !== 'consumable').map((i) => i.id).sort();
        const item = pool.length ? sc.rng.pick(pool) : `${op.tier}-item`;
        const place = sc.rng.pick(['ซาก', 'ถ้ำ', 'ศาล']);
        a().deeds.push({ kind: 'hidden', id: item, country: c, year: yearOf(ctx), data: { tier: op.tier, place } });
        const life = ctx.state.life;
        if (life && !life.dead && !life.flags.includes('rumor_hidden')) life.flags.push('rumor_hidden');
        break;
      }
      case 'open':
        openByGod(ctx, op.id);
        break;
    }
  }
  return done;
}
