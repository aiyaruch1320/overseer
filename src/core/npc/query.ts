// Read-only views of the NPC state for other systems, the text layer and the test tools.
import type { Ctx } from '../game';
import type { GameState } from '../types';
import type { NpcRow } from '../data/types-npcs';
import { npcIndex } from './data';
import { slotsOf, type NpcSlotX } from './types';

export interface NpcView {
  id: string;
  name: string;
  gen: number;
  role: string;
  place: string;
  alive: boolean;
  status: NpcSlotX['status'];
  age: number;
  story: NpcSlotX['story']['state'];
  path?: string;
  row: NpcRow;
  slot: NpcSlotX;
}

export function viewOf(ctx: Ctx, id: string): NpcView | undefined {
  const slot = slotsOf(ctx.state)[id];
  const row = npcIndex(ctx).rows.get(id);
  if (!slot || !row) return undefined;
  return {
    id,
    name: slot.name,
    gen: slot.gen,
    role: row.role,
    place: slot.place ?? row.country,
    alive: slot.status === 'alive',
    status: slot.status,
    age: Math.floor(ctx.state.clock.worldYear - slot.born),
    story: slot.story.state,
    path: slot.path,
    row,
    slot,
  };
}

/** Living holders in a country, leaders first. */
export function npcsAt(ctx: Ctx, country: string): NpcView[] {
  const out: NpcView[] = [];
  for (const id of Object.keys(slotsOf(ctx.state))) {
    const v = viewOf(ctx, id);
    if (v && v.alive && v.place === country) out.push(v);
  }
  return out.sort((a, b) => a.row.seq - b.row.seq || a.id.localeCompare(b.id));
}

/** Names of the holders of the NPC slots, by id, for the text layer (a position keeps its id, the name changes with the holder). */
export function holderNames(state: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, s] of Object.entries(slotsOf(state))) out[id] = s.name;
  return out;
}

export interface NpcCounts {
  absent: number;
  alive: number;
  dead: number;
  gone: number;
  open: number;
  waiting: number;
  done: number;
}

export function countSlots(state: GameState): NpcCounts {
  const c: NpcCounts = { absent: 0, alive: 0, dead: 0, gone: 0, open: 0, waiting: 0, done: 0 };
  for (const s of Object.values(slotsOf(state))) {
    c[s.status]++;
    if (s.status === 'alive') {
      if (s.story.state === 'open') c.open++;
      else if (s.story.state === 'wait') c.waiting++;
      else c.done++;
    }
  }
  return c;
}
