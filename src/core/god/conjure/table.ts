// The table of results (07-conjure.md §2): 6 verbs × 8 cores = 48 cells, each at the size of a country; the other sizes carry it (ops.ts `scaleOp`). Each cell is written
// here as the ops the cell's words name; `cells[].text` of data/gen/god.json holds the words themselves, and a test checks that every cell of the data has an entry here.
// A cell that says "ใช้ MR-xx" is a listed miracle: at the size of a country the game runs that miracle (its price, its caps, its result) and the conjuring does not use the quota.
// The `ops` of such a cell are what the same effect does at the other sizes (and when the miracle is not in the build yet).
import type { Ctx } from '../../game';
import { geoOf } from '../../world/place';
import { isDesert } from '../acts/geo';
import type { Op } from './ops';
import { hasFolk } from './ops';

export interface MrRoute {
  /** The listed miracle at the size of a country, by the state of the country (`MR-10` for a desert, `MR-01` for the rest). */
  country?: (ctx: Ctx, country: string) => string | null;
  /** The listed miracle at the size of a continent (`MR-20`, `MR-18`). */
  continent?: string;
  /** At the size of a person (`MR-06`). */
  person?: string;
}

export interface Cell {
  /** The result in a few words (the line of the log). */
  say: string;
  ops: Op[];
  mr?: MrRoute;
  /** What the cell needs of its target before it can be done (a precondition like the ones of the miracles); null when it can. */
  need?: (ctx: Ctx, country: string) => string | null;
  /** At the size of a person: `amulet` (a charm of the core) · `companion` (an animal comes to the character) · else the verb's own. */
  person?: 'amulet' | 'companion';
}

const Y = (n: number) => n;
const mod = (subject: string, o: { mul?: number; add?: number; years?: number }): Op => ({ op: 'mod', subject, ...o });
const ev = (ids: string[], mul: number, years = 10): Op => ({ op: 'event', ids, mul, years });
const coastal = (ctx: Ctx, c: string) => {
  const g = geoOf(ctx, c);
  return !!g && (g.coast || g.river);
};

export const CELLS: Record<string, Cell> = {
  // ---- ให้กำเนิด ----
  'create.fire': {
    say: 'เตาไฟไม่ดับ',
    ops: [{ op: 'when', test: 'cold', then: [mod('W', { add: 1, years: Y(10) })], else: [{ op: 'when', test: 'dr04', then: [mod('W', { add: 1, years: Y(10) })], else: [mod('W', { add: 0.5, years: Y(10) })] }] }],
    person: 'amulet',
  },
  'create.water': {
    say: 'ฝนและน้ำพุ',
    ops: [{ op: 'unflag', flag: 'famine' }, mod('food', { mul: 0.8, years: 2 })],
    mr: { country: (ctx, c) => (isDesert(ctx, c) ? 'MR-10' : 'MR-01') },
  },
  'create.earth': {
    say: 'กำแพงหินรอบเมือง',
    ops: [mod('defense', { add: 2, years: 50 })],
    mr: { continent: 'MR-20' },
  },
  'create.wind': { say: 'ลมส่งเรือ', ops: [mod('sea', { mul: 0.7, years: 10 })] },
  'create.life': { say: 'ชีวิตงอกงาม', ops: [{ op: 'flag', flag: 'golden', years: 5 }, mod('food', { mul: 0.8, years: 5 })], mr: { country: () => 'MR-03' }, person: 'companion' },
  'create.death': { say: 'ผีเฝ้าเมือง', ops: [mod('defense', { add: 1, years: 25 }), { op: 'faith', delta: -5 }] },
  'create.light': { say: 'ศาลแสงกลางเมือง', ops: [{ op: 'faith', delta: 10 }] },
  'create.shadow': { say: 'ทางลับใต้เมือง', ops: [mod('black-market', { mul: 1.5, years: 10 }), mod('bond-escape', { mul: 2, years: 10 })] },

  // ---- ทำลาย ----
  'destroy.fire': { say: 'ไฟผลาญ', ops: [mod('W', { add: -1, years: 5 }), mod('wood', { mul: 2, years: 5 })], mr: { country: () => 'MR-13' } },
  'destroy.water': {
    say: 'น้ำท่วมหรือภัยแล้ง',
    ops: [{ op: 'when', test: 'coastal', then: [mod('W', { add: -2, years: 5 }), mod('food', { mul: 1.3, years: 5 })], else: [{ op: 'flag', flag: 'famine', years: 3 }] }],
    mr: { country: (ctx, c) => (coastal(ctx, c) ? 'MR-19' : null) },
  },
  'destroy.earth': { say: 'แผ่นดินไหว', ops: [{ op: 'flag', flag: 'famine', years: 2 }, mod('W', { add: -1, years: 5 })], mr: { country: () => 'MR-08', continent: 'MR-18' } },
  'destroy.wind': { say: 'พายุใหญ่', ops: [mod('sea', { mul: 2, years: 5 }), mod('C', { add: -5, years: 5 })], mr: { country: () => 'MR-09' } },
  'destroy.life': { say: 'ฝูงตั๊กแตน', ops: [mod('food', { mul: 3, years: 2 }), mod('W', { add: -1, years: 2 })], mr: { country: () => 'MR-12' } },
  'destroy.death': { say: 'โรคระบาด', ops: [{ op: 'flag', flag: 'plague', years: 1 }, mod('medicine', { mul: 3, years: 2 }), mod('W', { add: -1, years: 2 })], mr: { country: () => 'MR-07', person: 'MR-06' } },
  'destroy.light': { say: 'ดับศรัทธา', ops: [{ op: 'faith', delta: -15 }, { op: 'deed', kind: 'priest-quits', id: 'priest' }] },
  'destroy.shadow': { say: 'เปิดโปงจนพัง', ops: [mod('black-market', { mul: 0, years: 10 }), { op: 'deed', kind: 'trader-caught', id: 'shadow-trader' }] },

  // ---- เปลี่ยน ----
  'change.fire': { say: 'เหล็กเป็นทอง', ops: [mod('C', { add: -10, years: 5 }), mod('price', { mul: 1.3, years: 5 })] },
  'change.water': { say: 'น้ำเค็มเป็นน้ำจืด', ops: [{ op: 'when', test: 'coastDry', then: [mod('W', { add: 1 })], else: [mod('food', { mul: 0.9, years: 5 })] }] },
  'change.earth': { say: 'ทรายเป็นดินดี', ops: [{ op: 'when', test: 'desert', then: [{ op: 'unflag', flag: 'famine' }, mod('food', { mul: 0.85 })], else: [mod('food', { mul: 0.95, years: 10 })] }] },
  'change.wind': { say: 'เปลี่ยนฤดู', ops: [{ op: 'unflag', flag: 'famine' }, ev(['CT-02', 'CT-04'], 0.2, 5)] },
  'change.life': { say: 'สัตว์ร้ายเชื่อง', ops: [mod('beast-fights', { mul: 0.3, years: 10 })] },
  'change.death': { say: 'ศพเป็นดิน', ops: [{ op: 'unflag', flag: 'undead_rising' }, { op: 'unflag', flag: 'ghoul_plague' }, mod('undead-foes', { mul: 0, years: 10 })] },
  'change.light': { say: 'ศรัทธาเปลี่ยนช่องทาง', ops: [{ op: 'faith', delta: 10 }] },
  'change.shadow': { say: 'ฝันร้ายเป็นฝันดี', ops: [{ op: 'unflag', flag: 'nightmare' }, ev(['PL-05'], 0.5, 10)] },

  // ---- ปลุก ----
  'wake.fire': { say: 'เตาหลอมตื่น', ops: [mod('forge', { add: 2, years: 10 }), mod('machines', { mul: 0.8, years: 10 })] },
  'wake.water': { say: 'สัตว์ทะเลโบราณตื่น', ops: [{ op: 'flag', flag: 'war', years: 10 }, mod('mercenary', { mul: 2, years: 10 }), { op: 'deed', kind: 'monster', id: 'sea-beast' }], mr: { country: () => 'MR-15' } },
  'wake.earth': { say: 'ยักษ์หินตื่น', ops: [mod('defense', { add: 2 }), { op: 'deed', kind: 'guardian', id: 'stone-giant' }], mr: { country: () => 'MR-14' } },
  'wake.wind': { say: 'ลมเร็ว', ops: [mod('travel-time', { mul: 0.7, years: 10 })] },
  'wake.life': { say: 'ป่าคืนชีพ', ops: [{ op: 'unflag', flag: 'forest_blight' }, mod('wood', { mul: 0.7, years: 10 })], mr: { country: () => 'MR-11' } },
  'wake.death': {
    say: 'คนตายลุก',
    ops: [{ op: 'npc', kind: 'ghost', from: 'dead' }],
    need: (ctx, c) => (hasFolk(ctx, c, 'dead') ? null : 'ไม่มีผู้ตายภายในสิบปีในประเทศนี้ให้ปลุก'),
  },
  'wake.light': { say: 'ปลุกศาสดา', ops: [{ op: 'npc', kind: 'prophet', from: 'alive' }, ev(['GD-01'], 1.5, 10)] },
  'wake.shadow': { say: 'ฝันร่วม', ops: [{ op: 'deed', kind: 'shared-dream', id: 'country' }] },

  // ---- สงบ ----
  'calm.fire': { say: 'ดับไฟ', ops: [{ op: 'unflag', flag: 'wildfire' }, mod('fire-events', { mul: 0.5, years: 10 })] },
  'calm.water': { say: 'ทะเลสงบ', ops: [mod('sea', { mul: 0.8, years: 10 }), ev(['PL-04'], 0.5, 10)] },
  'calm.earth': { say: 'แผ่นดินนิ่ง', ops: [mod('quake-events', { mul: 0.5, years: 10 }), { op: 'group', group: 'RF', mul: 0.5, years: 10 }] },
  'calm.wind': { say: 'ฟ้าสงบ', ops: [mod('storm-events', { mul: 0.5, years: 10 })] },
  'calm.life': { say: 'หยุดการเติบโต', ops: [ev(['PL-08'], 0.2, 10)] },
  'calm.death': { say: 'ผีสงบ', ops: [{ op: 'unflag', flag: 'undead_rising' }, { op: 'unflag', flag: 'ghoul_plague' }, { op: 'unflag', flag: 'demon_raid' }], mr: { country: () => 'MR-04' } },
  'calm.light': { say: 'ศาสนาสงบ', ops: [ev(['GD-02'], 0.5, 10)] },
  'calm.shadow': { say: 'สงบศึก', ops: [{ op: 'unflag', flag: 'war' }, mod('truce', { add: 1, years: 5 })], mr: { country: () => 'MR-05' }, need: (ctx, c) => ((ctx.state.world.countryFlags[c] ?? []).includes('war') ? null : 'ประเทศนั้นไม่ได้อยู่ในสงคราม') },

  // ---- เผย ----
  'reveal.fire': { say: 'เผยแร่', ops: [mod('W', { add: 1 }), mod('ore', { mul: 0.9 })] },
  'reveal.water': { say: 'เผยน้ำใต้ดิน', ops: [{ op: 'unflag', flag: 'famine' }, { op: 'deed', kind: 'well', id: 'spring' }] },
  'reveal.earth': { say: 'เผยซากโบราณ', ops: [{ op: 'hidden', tier: 'R' }] },
  'reveal.wind': { say: 'เผยเส้นทาง', ops: [mod('travel-fare', { mul: 0.8, years: 50 })] },
  'reveal.life': { say: 'เผยยา', ops: [mod('medicine', { mul: 0.7, years: 10 }), ev(['HP-06'], 1.5, 10)] },
  'reveal.death': { say: 'เผยความตายที่ซ่อน', ops: [{ op: 'npc', kind: 'secret-crime', from: 'alive' }] },
  'reveal.light': { say: 'เผยความจริง', ops: [ev(['MC-11', 'FG-14'], 2, 10)] },
  'reveal.shadow': { say: 'เผยความลับของผู้มีอำนาจ', ops: [{ op: 'deed', kind: 'leader-secret', id: 'leader' }, mod('obstruct', { mul: 2, years: 10 })] },
};
