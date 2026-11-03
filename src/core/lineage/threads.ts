// Open threads (docs/lore/heirs/03-open-threads.md): what a life leaves unfinished and the heir takes.
// At the death: the threads this life left are found from what the systems kept (the bond book, the economy, the items), joined with the ones it
// inherited and did not close, and at most three are kept, by the weights of §2. The rest fade.
// Settling: the heir meets the first thread at the age of hr.a1 and the others at the age of hr.a3 (23-heir.md): `settleYear` draws the way of the
// node (a settle 45 · a new way 30 · drop 25, the weights of the data) and the thread is closed or dropped. After two generations of dropping
// a thread becomes a legend of the family (§3).
import { extOf as bondsExt, isLive, tiesOf } from '../bonds';
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { indexOf } from '../story/data';
import { pickHeir } from './heir';
import { lx, type Thread } from './state';

/** Weights of the kinds when the threads are cut to three (03 §2 second table). */
export const KIND_WEIGHT: Record<string, number> = { ศึกสายเลือด: 5, คำมั่น: 5, สัญญา: 4, ที่มั่น: 4, ของที่ยังไม่ส่ง: 3, หนี้: 3, ความลับ: 2, ศิษย์ของผู้อื่น: 1 };
export const MAX_THREADS = 3;
/** A thread dropped by this many generations becomes a legend (03 §3: "ส่งให้รุ่นถัดไปได้ไม่เกินสองรุ่น"). */
export const DROP_LIMIT = 2;
/** The ways of hr.a1 (23-heir.md §3): settle, a new way, drop. The weights are the ones of the node. */
export const SETTLE_WEIGHTS = [45, 30, 25];
/** Ages the heir meets the threads at when the heir took over later than the node's window: the first one year after, the next ones two years apart (assumption). */
export const SETTLE_AGES = { first: [22, 32], rest: [34, 44], afterTakeover: 1, apart: 2 };
const DEBT_BIG = 200;

/**
 * What became of a thread, by the kind of the thread and the way the heir took (M4 review F2: the line of the settling says the outcome and not only the
 * method). The ways are `settle` (as the parent began it), `newway` (a way the parent never tried), `drop` (left). Words of the tool, not of the docs.
 */
export const OUTCOME: Record<string, { settle: string; newway: string; drop: string }> = {
  ศึกสายเลือด: { settle: 'ความแค้นจบลง ไม่มีใครต้องหนีหรือล้างแค้นต่อ', newway: 'ความแค้นจบด้วยการเจรจา ไม่ต้องใช้ดาบ', drop: 'ความแค้นยังค้างอยู่ รอรุ่นหลัง' },
  คำมั่น: { settle: 'คำมั่นที่ค้างไว้ได้รับการรักษา', newway: 'คำมั่นถูกเปลี่ยนเป็นข้อตกลงใหม่ที่ทั้งสองฝ่ายรับได้', drop: 'คำมั่นยังไม่ได้รับการรักษา' },
  สัญญา: { settle: 'สัญญาถูกทำให้ครบทุกข้อ', newway: 'สัญญาถูกเจรจาใหม่และยุติลง', drop: 'สัญญายังคงค้างอยู่' },
  ที่มั่น: { settle: 'ที่มั่นกลับมาอยู่ในมือตระกูล', newway: 'ที่มั่นถูกแลกกับสิ่งที่ตระกูลต้องการมากกว่า', drop: 'ที่มั่นยังตกอยู่ในมือคนอื่น' },
  ของที่ยังไม่ส่ง: { settle: 'ของถึงที่ที่มันต้องไปแล้ว', newway: 'ของถูกส่งไปอีกทางและถึงมือคนที่ควรได้', drop: 'ของยังไม่ได้ส่ง' },
  หนี้: { settle: 'หนี้ถูกชำระจนหมด', newway: 'หนี้ถูกยกให้หรือแลกด้วยงานแทนทอง', drop: 'หนี้ยังติดอยู่' },
  ความลับ: { settle: 'ความลับถูกเปิดและตระกูลรับผลของมัน', newway: 'ความลับถูกฝังไว้ตลอดไป', drop: 'ความลับยังไม่มีใครแตะ' },
  ศิษย์ของผู้อื่น: { settle: 'ศิษย์เรียนจนจบ', newway: 'ศิษย์ไปต่อบนทางของตัวเอง', drop: 'ศิษย์ถูกทิ้งไว้กลางทาง' },
};
const FALLBACK_OUTCOME = { settle: 'เรื่องจบลงตามที่ผู้ปกครองหวัง', newway: 'เรื่องจบลงในทางที่ผู้ปกครองไม่เคยคิด', drop: 'เรื่องยังค้างอยู่' };

const feud = (life: LifeState): string[] => [...life.curses.filter((c) => c === 'c_feud' || c === 'c_wanted'), ...life.skills.filter((s) => s === 'nc_blood_feud')];

/**
 * The words of a blood feud the book names nobody for (M4 review R7: one title for every feud told the heir nothing). The person the character holds the most against, else the
 * node or convergence the curse came from; the generic words are the last resort.
 */
function feudText(ctx: Ctx, life: LifeState): string {
  const b = life.ext.bonds ? bondsExt(life) : undefined;
  const foes = b ? tiesOf(b).filter((t) => !t.light && (/ศัตรู|แค้น/.test(t.line) || t.grudge >= 2)).sort((a, c) => c.grudge - a.grudge || c.peak - a.peak) : [];
  if (foes.length) return `แค้นกับ ${foes[0].name}`;
  const ids = new Set(feud(life));
  let birthN = 0;
  for (const e of ctx.state.log) if (e.sys === 'character' && e.kind === 'birth') birthN = e.n;
  const from = ctx.state.log.find((e) => e.n >= birthN && e.sys === 'character' && e.kind === 'grant' && e.data.kind === 'curse' && ids.has(String(e.id)))?.data.from;
  const where = typeof from === 'string' ? (indexOf(ctx).nodes.get(from)?.title ?? convergenceTitle(ctx, from)) : undefined;
  return where ? `แค้นที่ยังไม่จบและค่าหัวที่ตามมาจาก${where}` : 'แค้นที่ยังไม่จบและค่าหัวที่ยังตามอยู่';
}

const convergenceTitle = (ctx: Ctx, id: string): string | undefined => {
  const points = (ctx.data.convergence?.items as { points?: { id: string; title?: string; name?: string }[] } | undefined)?.points;
  const p = points?.find((q) => q.id === id);
  return p?.title ?? p?.name;
};

/** The threads the dead life leaves by itself (no inherited ones). Reads only. */
export function detect(ctx: Ctx): Thread[] {
  const life = ctx.state.life;
  if (!life) return [];
  const gen = ctx.state.lineage.lives.length + 1;
  const out: Thread[] = [];
  const add = (kind: string, text: string, ref: string, weight = KIND_WEIGHT[kind]) => out.push({ id: `${life.id}.${out.length + 1}`, kind, text, from: life.id, gen, weight, state: 'open', dropped: 0, ref });

  // the stories of the bond book that were still going (the bond system picked three at the death)
  const b = life.ext.bonds ? bondsExt(life) : undefined;
  for (const id of b?.threads ?? []) {
    const t = b!.ties[id];
    if (!t) continue;
    const title = [...ctx.state.log].reverse().find((e) => e.sys === 'bonds' && e.kind === 'arc' && e.id === id)?.data.title;
    const kind = t.line === 'ศิษย์' ? 'ศิษย์ของผู้อื่น' : /ศัตรู|แค้น/.test(t.line) ? 'ศึกสายเลือด' : 'คำมั่น';
    add(kind, `${t.name} (${t.line})${title ? `: ${String(title)}` : ''}`, id);
  }
  // blood feuds the character carried
  for (const name of b?.feuds ?? []) add('ศึกสายเลือด', `แค้นกับ ${name}`, `feud:${name}`, 7);
  if (!out.some((t) => t.kind === 'ศึกสายเลือด') && feud(life).length) add('ศึกสายเลือด', feudText(ctx, life), `curse:${feud(life)[0]}`);
  // a debt in gold
  const debt = Number((life.ext.economy as { debt?: number } | undefined)?.debt ?? 0);
  if (debt > 0) add('หนี้', `หนี้ทอง ${Math.round(debt)}`, 'debt', debt > DEBT_BIG ? 5 : 3);
  // a legendary weapon that has to be returned (items/return notes are written at the death by the items system)
  let birthN = 0;
  for (const e of ctx.state.log) if (e.sys === 'character' && e.kind === 'birth') birthN = e.n;
  for (const e of ctx.state.log) {
    if (e.sys !== 'items' || e.kind !== 'return' || e.n < birthN) continue;
    const to = String(e.data.to ?? '');
    if (to && to !== 'broken') add('ของที่ยังไม่ส่ง', `${String(e.data.name ?? '')} ต้องกลับไปที่เดิม`, `item:${String(e.id)}`);
  }
  return out;
}

interface Plan {
  kept: Thread[];
  closed: Thread[];
  legend: Thread[];
  faded: Thread[];
}

/** What becomes of the inherited threads and the new ones at the death: reads only. */
function plan(ctx: Ctx): Plan {
  const x = lx(ctx.state);
  const life = ctx.state.life;
  const mine = x.threads.filter((t) => t.state === 'open' && life && t.holder === life.id);
  const closed = mine.filter((t) => t.tried === 'closed');
  // a thread that was not closed has been carried one more generation
  const rest = mine.filter((t) => t.tried !== 'closed').map((t) => ({ ...t, dropped: t.dropped + 1 }));
  const legend = rest.filter((t) => t.dropped >= DROP_LIMIT);
  const pool = [...rest.filter((t) => t.dropped < DROP_LIMIT), ...detect(ctx)].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  return { kept: pool.slice(0, MAX_THREADS), closed, legend, faded: pool.slice(MAX_THREADS) };
}

/** The threads that go to the heir. Reads only. */
export function currentThreads(ctx: Ctx): Thread[] {
  return plan(ctx).kept;
}

/** Writes the plan to the lineage: the kept ones stay open (without a holder until the heir is born), the closed ones close, the aged ones become legends. */
export function keepThreads(ctx: Ctx): Thread[] {
  const x = lx(ctx.state);
  const p = plan(ctx);
  const set = (t: Thread, state: Thread['state']) => {
    const at = x.threads.findIndex((q) => q.id === t.id);
    const next: Thread = { ...t, state };
    delete next.holder;
    delete next.tried;
    delete next.due;
    if (at >= 0) x.threads[at] = next;
    else x.threads.push(next);
  };
  for (const t of p.closed) set(t, 'closed');
  for (const t of p.legend) set(t, 'legend');
  for (const t of p.faded) set(t, 'faded');
  // a family with no one to take over leaves the threads to fade at once (heirs/03 §3): the summary of the world does not count them open (R4)
  const heir = pickHeir(ctx);
  for (const t of p.kept) set(t, heir ? 'open' : 'faded');
  return p.kept;
}

/** Gives the open threads to the heir (called when the next life begins): each gets the age the heir meets it at. */
export function handOver(ctx: Ctx, life: LifeState, startAge: number): void {
  const x = lx(ctx.state);
  const open = x.threads.filter((t) => t.state === 'open' && t.holder === undefined).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const rng = ctx.rng('lineage.threads');
  open.forEach((t, i) => {
    const [lo, hi] = i === 0 ? SETTLE_AGES.first : SETTLE_AGES.rest;
    const window = rng.int(lo, hi);
    t.holder = life.id;
    t.due = Math.max(window, startAge + SETTLE_AGES.afterTakeover + i * SETTLE_AGES.apart);
    delete t.tried;
  });
}

/** Once a life year: the heir meets the threads that are due and settles, tries another way, or drops them. */
export function settleYear(ctx: Ctx): void {
  const life = ctx.state.life;
  if (!life || life.dead) return;
  const x = lx(ctx.state);
  for (const t of x.threads) {
    if (t.holder !== life.id || t.state !== 'open' || t.tried || t.due === undefined || life.hAge < t.due) continue;
    const way = ctx.rng('lineage.threads').weighted(SETTLE_WEIGHTS);
    t.tried = way === 2 ? 'dropped' : 'closed';
    write(ctx.state, { sys: 'lineage', kind: 'thread', id: t.id, data: { kind: t.kind, text: t.text, way: ['settle', 'newway', 'drop'][Math.max(0, way)], outcome: (OUTCOME[t.kind] ?? FALLBACK_OUTCOME)[['settle', 'newway', 'drop'][Math.max(0, way)] as 'settle'], from: t.from }, level: 2 });
  }
}

/** The ties of the bond book that could take a thread (for the tests and the summary). */
export const liveTies = (life: LifeState) => (life.ext.bonds ? tiesOf(bondsExt(life)).filter(isLive) : []);
