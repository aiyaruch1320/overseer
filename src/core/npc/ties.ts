// What the story of one NPC does to the stories of the others (docs/lore/npcs/README.md §2.2), without the main character.
// A ends and B is tied to A when (ก) a row names the other's code, or (ข) both are open in one country and name the same world event.
//   2(ก) the path A ended with names B → the paths of B that name A get +10 (the others shrink, the total stays)
//   2(ข) A's holder dies, vanishes or moves → the paths of B that need A are cut
//   2(ค) a path of B names the world event the path of A ended with → +10
//   3    when the end of A took his holder (not old age) B gets one follow-up story: 40 revenge · 35 takes over the goal of A · 25 lets go
//   4    a follow-up makes no follow-up, and an NPC has one at a time
import { apply } from '../rules';
import type { Ctx } from '../game';
import type { Effect } from '../types';
import type { NpcPath, NpcRow } from '../data/types-npcs';
import { npcIndex, rowOf } from './data';
import { anyPathLeft, bumpRel, note, visible } from './engine';
import { clashFor } from './clash';
import { FOLLOW_WEIGHTS, NEEDS_PARTNER_RE, PARTNER_GOES_ON_RE } from './tuning';
import { slotsOf, type NpcSlotX, type PathKey, type Story } from './types';

export type DoerKind = 'mc' | 'npc' | 'event' | 'god';
export interface Doer {
  kind: DoerKind;
  id?: string;
}

/** The NPCs tied to this row by a code in either row (rule 1 ก): the ones it names, the ones that name it, the links of the row. */
export function tiedIds(ctx: Ctx, row: NpcRow): string[] {
  const slots = slotsOf(ctx.state);
  const out = new Set<string>();
  for (const r of row.refs) out.add(r.to);
  for (const id of row.refBy) out.add(id);
  for (const id of row.links) out.add(id);
  out.delete(row.id);
  return [...out].filter((id) => slots[id]).sort();
}

function boost(s: Story, key: PathKey): boolean {
  if (s.boost?.includes(key)) return false;
  (s.boost ??= []).push(key);
  return true;
}

const live = (s: NpcSlotX | undefined): s is NpcSlotX => !!s && s.status === 'alive' && s.story.state !== 'done';

/** The story of A is over with this path (rule 2 ก and ค). */
export function afterResolve(ctx: Ctx, slot: NpcSlotX, row: NpcRow, chosen: NpcPath | undefined): void {
  if (!chosen) return;
  const slots = slotsOf(ctx.state);
  const idx = npcIndex(ctx);
  // ก: the paths of B that name A
  for (const b of chosen.npcs) {
    const sb = slots[b];
    const rb = rowOf(ctx, b);
    if (!live(sb) || !rb || b === row.id) continue;
    for (const p of rb.paths) if (p.npcs.includes(row.id) && boost(sb.story, p.key)) note(ctx, sb, rb, 'tie', { of: row.id, path: p.key, why: 'named' }, 0);
  }
  // ค: the paths of B that name the world event A ended on; B is tied by a code, or open here at the same time
  if (!chosen.events.length) return;
  const seen = new Set<string>();
  const tied = new Set(tiedIds(ctx, row));
  for (const ev of chosen.events) {
    for (const id of idx.byEvent.get(ev) ?? []) {
      if (id === row.id || seen.has(id)) continue;
      const sb = slots[id];
      const rb = idx.rows.get(id);
      if (!live(sb) || !rb) continue;
      const together = sb.story.state === 'open' && sb.place === slot.place;
      if (!tied.has(id) && !together) continue;
      seen.add(id);
      for (const p of rb.paths) if (p.events.some((e) => chosen.events.includes(e)) && boost(sb.story, p.key)) note(ctx, sb, rb, 'tie', { of: row.id, path: p.key, why: 'event', event: ev }, 0);
    }
  }
}

/** Does a path of B go on without A (a successor, a post taken over)? Then A ending does not cut it. */
function needsPartner(p: NpcPath, a: string): boolean {
  return p.npcs.includes(a) && NEEDS_PARTNER_RE.test(p.text) && !PARTNER_GOES_ON_RE.test(p.text);
}

/** Rule 2(ข): the holder of A is gone or elsewhere; the paths of tied NPCs that need him are cut. `moved`: only those who are no longer in his country. */
export function cutNeeders(ctx: Ctx, slot: NpcSlotX, row: NpcRow, moved = false): void {
  const slots = slotsOf(ctx.state);
  for (const id of tiedIds(ctx, row)) {
    const sb = slots[id];
    const rb = rowOf(ctx, id);
    if (!live(sb) || !rb) continue;
    if (moved && sb.place === slot.place) continue;
    for (const p of rb.paths) {
      if (!needsPartner(p, row.id) || sb.story.cut.includes(p.key)) continue;
      sb.story.cut.push(p.key);
      note(ctx, sb, rb, 'tie', { of: row.id, path: p.key, why: moved ? 'moved' : 'gone' }, 0);
    }
  }
}

/** The holder of A died or vanished (rule 2 ข, and rule 3 when it was not old age). */
export function afterEnd(ctx: Ctx, slot: NpcSlotX, row: NpcRow, natural: boolean, by: Doer): void {
  cutNeeders(ctx, slot, row);
  if (natural) return;
  const slots = slotsOf(ctx.state);
  const now = ctx.state.clock.worldYear;
  for (const id of tiedIds(ctx, row)) {
    const sb = slots[id];
    const rb = rowOf(ctx, id);
    if (!sb || !rb || sb.status !== 'alive') continue;
    if (sb.follow && sb.follow.state !== 'done') continue;
    sb.follow = { of: row.id, doer: by.kind, doerId: by.id, state: 'wait', openAt: now, endAt: null };
    note(ctx, sb, rb, 'follow', { of: row.id, state: 'wait' }, 0);
  }
}

// ---------- the follow-up story ----------

/** Draws a, b or c when the follow-up opens: a (revenge) only when the doer is the character or a living NPC (rule 3). */
function drawKind(ctx: Ctx, slot: NpcSlotX): PathKey {
  const f = slot.follow!;
  const slots = slotsOf(ctx.state);
  const doerAlive = f.doer === 'mc' || (f.doer === 'npc' && !!f.doerId && slots[f.doerId]?.status === 'alive');
  const w: PathKey[] = ['a', 'b', 'c'];
  const rng = ctx.rng('npc.follow');
  return w[rng.weighted(w.map((k) => (k === 'a' && !doerAlive ? 0 : FOLLOW_WEIGHTS[k])))];
}

function resolveFollow(ctx: Ctx, slot: NpcSlotX, row: NpcRow): void {
  const f = slot.follow!;
  const kind = f.kind ?? 'c';
  f.state = 'done';
  const lv = visible(ctx, slot);
  if (kind === 'a') {
    if (f.doer === 'mc') {
      bumpRel(ctx, slot, 'grudge', 1);
      note(ctx, slot, row, 'follow', { of: f.of, kind: 'a', doer: 'mc' }, 2);
      clashFor(ctx, slot, row, 'S', 'follow');
    } else if (f.doerId) {
      const k = `npc.${f.doerId}.grudge`;
      slot.rel[k] = (slot.rel[k] ?? 0) + 1;
      note(ctx, slot, row, 'follow', { of: f.of, kind: 'a', doer: f.doerId }, lv);
    }
    return;
  }
  if (kind === 'b') {
    // he takes the goal of A: a path of A's row is drawn by its written share and its result in the world happens
    const ra = rowOf(ctx, f.of);
    const sa = slotsOf(ctx.state)[f.of];
    const cands = (ra?.paths ?? []).filter((p) => !sa?.story.cut.includes(p.key));
    if (ra && cands.length) {
      const rng = ctx.rng('npc.follow');
      const p = cands[rng.weighted(cands.map((c) => c.pct))];
      const world: Effect[] = p.effects.filter((e) => e.k === 'event' || e.k === 'eventWeight');
      if (world.length) apply(ctx, world, { sys: 'npc', id: row.id, stream: 'npc.follow' });
      note(ctx, slot, row, 'follow', { of: f.of, kind: 'b', path: p.key, text: p.text }, lv);
    } else note(ctx, slot, row, 'follow', { of: f.of, kind: 'c' }, lv);
    return;
  }
  note(ctx, slot, row, 'follow', { of: f.of, kind: 'c' }, lv);
}

/** Opens and closes the follow-up of a holder (called from the clock). */
export function stepFollow(ctx: Ctx, slot: NpcSlotX, row: NpcRow, now: number): void {
  const f = slot.follow;
  if (!f || f.state === 'done' || slot.status !== 'alive') return;
  if (f.state === 'wait') {
    // it opens in place of the story when every path of it is cut, otherwise after it
    const s = slot.story;
    if (s.state !== 'done' && anyPathLeft(ctx, row, slot)) return;
    f.state = 'open';
    f.openAt = now;
    f.endAt = Math.min(slot.born + slot.span, now + row.clock.window * slot.span);
    f.kind = drawKind(ctx, slot);
    note(ctx, slot, row, 'follow', { of: f.of, state: 'open' }, 0);
    return;
  }
  if ((f.endAt ?? Infinity) <= now) resolveFollow(ctx, slot, row);
}
