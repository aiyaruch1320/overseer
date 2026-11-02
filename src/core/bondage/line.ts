// The line bd follows the bondage of the life, not the table of ages (M3 review B2; lore/storylines/27-bondage.md §2 rule 2 "bd เปิดเมื่อตัวละครเป็นผู้ถูกผูกตัว").
// The story system walks the nodes of an opened line by age; this system opens the line (engine.ts `enter`) and says which node suits the state of the life now:
//   bd.b1 "เกิดในพันธะหรือถูกทิ้ง"  while bound, and only for a life that was born or left in bondage
//   bd.t1 "ถูกขายหรือย้ายมือ"      while bound, by a route that starts at it (10-bondage.md §5 "ผลต่อเส้นเรื่อง")
//   bd.a1 "รับใช้" · bd.a2 "ทางออก"   while bound
//   bd.a3 "หลังพ้นพันธะ"           after he left bondage
//   bd.e1 "ผู้เฒ่า"                  either, but the way "ยังไม่พ้นพันธะ ตายในสัญญา" only while bound and "ไถ่ผู้อื่นด้วยทรัพย์ที่เหลือ" only when free
// A node that does not suit the state is put in the story's `skipped` list (and noted in `parked`, so that it comes back if the state returns); a way that does not
// suit is weighed to nothing by a `nodeMods` entry set just before the node is decided (the `before` hook of the story). The story is not changed.
import type { Ctx } from '../game';
import type { StoryExt } from '../story';
import type { LifeState, StoryNode } from '../types';
import { BD_WAYS } from './tuning';
import { bondageIndex, extOf } from './state';

const ORDER = ['bd.b1', 'bd.t1', 'bd.a1'];
export const BD_NODES = ['bd.b1', 'bd.t1', 'bd.a1', 'bd.a2', 'bd.a3', 'bd.e1'] as const;

/** Has the life left bondage at least once, and is it free now? */
export const freedOnce = (life: LifeState): boolean => {
  const e = extOf(life);
  return e.level === 0 && e.history.some((h) => h.to === 0);
};

/** Does the node suit the state of the life now? */
export function suits(ctx: Ctx, life: LifeState, id: string): boolean {
  const e = extOf(life);
  const bound = e.level > 0;
  const freed = freedOnce(life);
  switch (id) {
    case 'bd.b1':
      return bound && !!e.born;
    case 'bd.t1': {
      // a route that starts later in the line does not play the nodes before it (a man in debt at 25 was not sold at 15)
      const first = bondageIndex(ctx).data.routes.find((r) => r.way === e.route)?.nodes[0];
      const at = first ? ORDER.indexOf(first) : -1;
      return bound && at <= ORDER.indexOf('bd.t1');
    }
    case 'bd.a1':
    case 'bd.a2':
      return bound;
    case 'bd.a3':
      return freed;
    case 'bd.e1':
      return bound || freed;
  }
  return true;
}

/**
 * Puts the nodes that do not suit the life in the story's skipped list and takes back the ones this system parked that suit it again. Called when the life
 * enters or leaves bondage and every life year.
 */
export function syncLine(ctx: Ctx, life: LifeState): void {
  const ex = life.ext.story as StoryExt | undefined;
  if (!ex || !ex.skipped) return;
  const e = extOf(life);
  if (!e.history.length && e.level === 0) return;
  for (const id of BD_NODES) {
    if (life.passed[id] !== undefined) continue;
    const ok = suits(ctx, life, id);
    const parked = e.parked.includes(id);
    if (!ok && !ex.skipped.includes(id)) {
      ex.skipped.push(id);
      if (!parked) e.parked.push(id);
    } else if (ok && parked) {
      ex.skipped = ex.skipped.filter((x) => x !== id);
      e.parked = e.parked.filter((x) => x !== id);
    }
  }
}

// ---------- the ways of a node ----------

/** The weights set by this system in `ex.nodeMods`, to be taken out again before the next node is decided. */
const ours = new WeakSet<object>();

/**
 * Before a node of the line is decided: the ways that do not suit the state of the life are weighed to nothing, the ones that suit it more are weighed up
 * (tuning BD_WAYS). Registered as the `before` hook of the story in rules.ts.
 */
export function setWays(ctx: Ctx, life: LifeState, node: StoryNode, id: string): void {
  const rows = BD_WAYS[id];
  const ex = life.ext.story as StoryExt | undefined;
  if (!rows || !ex) return;
  ex.nodeMods = ex.nodeMods.filter((m) => !ours.has(m));
  const e = extOf(life);
  const state = { bound: e.level > 0, free: e.level === 0, born: !!e.born, left: e.route === 'ถูกทิ้ง' };
  void node;
  for (const r of rows) {
    const mul = r.mul(state);
    if (mul === 1) continue;
    const m = { node: id, label: r.label, mul };
    ours.add(m);
    ex.nodeMods.push(m);
  }
  void ctx;
}
