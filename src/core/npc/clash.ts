// The point where the story of an NPC meets the main character in a fight (docs/systems/combat/07-npc-clashes.md).
// The combat system does not live here: it registers a handler with `onClash`, the NPC system calls it when a clash opens.
// Without a handler the clash gets a default result drawn from the standard results of §3 and written back into the NPC's lines.
//   B  the character hinders a path the NPC walks · P the character trespasses — opened by the system that sees the deed: `openClash`
//   T  the NPC challenges · S the NPC is sent · X the NPC rolls a path of the row while the character is in the country — rolled here
import { apply } from '../rules';
import { write } from '../log';
import type { Ctx } from '../game';
import type { Effect } from '../types';
import type { Clash, ClashesFile } from '../data/types-combat';
import { rowOf } from './data';
import { bumpRel, note } from './engine';
import { CLASH_AGAIN_AFTER, CLASH_DEFAULT, CLASH_PER_LIFE, NEMESIS_GRUDGE } from './tuning';
import { slotsOf, type NpcSlotX, type PathKey } from './types';
import type { NpcRow } from '../data/types-npcs';
import { killNpc } from './status';

export type ClashCode = 'B' | 'X' | 'S' | 'T' | 'P';

/** One way a clash opens, read from the "เปิดเมื่อ" cell of the row (`T 6% ต่อปีเมื่อตัวละครอายุเทียบ 16 ถึง 40 อยู่ใน AZ-02 ...`). */
export interface ClashTrigger {
  code: ClashCode;
  /** Chance per life year, null when the cell gives none (B and P happen at once). */
  pct: number | null;
  /** The path the cell names (`เส้น ข)`). */
  path?: PathKey;
  zone?: string;
  /** Life age of the character, `[min, max]`. */
  age?: [number, number];
}

export type ClashWhy = 'year' | 'path' | 'mc' | 'follow';

export interface ClashReq {
  /** The row of data/gen/clashes.json (`NF-AZ02-1`). */
  clash: Clash;
  /** The position and the holder who fights. */
  npc: string;
  code: ClashCode;
  trigger: ClashTrigger;
  path?: PathKey;
  why: ClashWhy;
}

/**
 * What a handler answers. `{ outcome }`: the clash was played and ended as this standard kind (`win_kill` `win_spare` `talk` `draw` `lose` `flee`),
 * `index` picks the row's outcome when several have that kind; the NPC system then writes the result back. `'wait'`: the clash was announced and is fought some beats later (the handler then writes the result back itself through `applyClashOutcome`); nothing is written now. `'veto'`: the clash does not open (the
 * conditions the cell names beyond what the NPC system reads were not met, e.g. a skill). `undefined`: not handled, the next handler or the default decides.
 */
export type ClashDecision = { outcome: string; index?: number } | 'veto' | 'wait' | undefined | void;
export type ClashHandler = (ctx: Ctx, req: ClashReq) => ClashDecision;

const handlers: ClashHandler[] = [];

/** Registers a handler; returns the function that removes it. */
export function onClash(fn: ClashHandler): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.indexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function clearClashHandlers(): void {
  handlers.length = 0;
}

// ---------- the data ----------

const PATH_OF: Record<string, PathKey> = { ก: 'a', ข: 'b', ค: 'c' };
const CODE_RE = /(?:^|\s)([BXSTP])(?=\s)/g;
const parsed = new WeakMap<Clash, ClashTrigger[]>();

/** The triggers of a clash row, read from its "เปิดเมื่อ" text. */
export function triggersOf(c: Clash): ClashTrigger[] {
  const hit = parsed.get(c);
  if (hit) return hit;
  const text = c.open.text;
  const marks = [...text.matchAll(CODE_RE)].map((m) => ({ code: m[1] as ClashCode, at: (m.index ?? 0) + m[0].length - 1 }));
  const out: ClashTrigger[] = [];
  marks.forEach((m, i) => {
    const seg = text.slice(m.at + 1, i + 1 < marks.length ? marks[i + 1].at : text.length);
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(seg);
    const path = /เส้น\s*([กขค])\)/.exec(seg);
    const zone = /อยู่ใน\s+([A-Z]{2}-\d{2})/.exec(seg);
    const age = /อายุเทียบ\s*(\d+)\s*ถึง\s*(\d+)/.exec(seg);
    const t: ClashTrigger = { code: m.code, pct: pct && m.code !== 'B' && m.code !== 'P' ? Number(pct[1]) / 100 : null };
    if (path) t.path = PATH_OF[path[1]];
    if (zone) t.zone = zone[1];
    if (age) t.age = [Number(age[1]), Number(age[2])];
    out.push(t);
  });
  parsed.set(c, out);
  return out;
}

const byId = new WeakMap<object, Map<string, Clash>>();

function clashIndex(ctx: Ctx): Map<string, Clash> {
  const file = ctx.data.clashes as unknown as ClashesFile | undefined;
  if (!file) return new Map();
  const hit = byId.get(file);
  if (hit) return hit;
  const m = new Map<string, Clash>(file.items.items.map((c) => [c.id, c]));
  byId.set(file, m);
  return m;
}

/** The clash rows of a position (data/gen/clashes.json is optional: a world without it has none). */
export function clashesOf(ctx: Ctx, npcId: string): Clash[] {
  const row = rowOf(ctx, npcId);
  if (!row || !row.clashes.length) return [];
  const idx = clashIndex(ctx);
  return row.clashes.map((id) => idx.get(id)).filter((c): c is Clash => !!c);
}

// ---------- the rules of §2 ----------

const seasonNow = (ctx: Ctx): number => (ctx.state.life?.hAge ?? 0) * 4 + ctx.state.clock.quarter;

/** Alive, the character in the same country, not more than two in this life (the second only after a draw, a defeat or a flight), one per season. */
export function canClash(ctx: Ctx, slot: NpcSlotX): boolean {
  const life = ctx.state.life;
  if (!life || life.dead || slot.status !== 'alive' || slot.place !== life.country) return false;
  const c = slot.clash;
  if (!c) return true;
  if (c.n >= CLASH_PER_LIFE) return false;
  if (c.n >= 1 && !CLASH_AGAIN_AFTER.includes(c.last ?? '')) return false;
  return c.at !== seasonNow(ctx);
}

// ---------- playing and writing back ----------

/** The standard results of §3 on the NPC's side: relations, the nemesis, the kin of the dead. */
function standardSide(ctx: Ctx, slot: NpcSlotX, kind: string): void {
  switch (kind) {
    case 'win_kill':
      break; // the dying is done by the outcome row or `killNpc` (it also gives the kin their grudge)
    case 'win_spare':
      bumpRel(ctx, slot, 'favor', 2);
      bumpRel(ctx, slot, 'trust', 1);
      break;
    case 'talk':
      bumpRel(ctx, slot, 'trust', 2);
      bumpRel(ctx, slot, 'known', 1);
      break;
    case 'draw':
      slot.rel['mc.nemesis'] = 1;
      slot.rel['mc.grudge'] = Math.max(slot.rel['mc.grudge'] ?? 0, NEMESIS_GRUDGE);
      break;
    case 'lose':
      bumpRel(ctx, slot, 'grudge', 1);
      break;
    case 'flee':
      bumpRel(ctx, slot, 'trust', -1);
      break;
  }
}

/** The effects of an outcome row: `trust` with no object is the NPC's own trust; the rest goes to the rule layer. */
function applyEffects(ctx: Ctx, slot: NpcSlotX, clash: Clash, list: readonly Effect[]): void {
  const rest: Effect[] = [];
  for (const e of list) {
    if (e.k === 'trust' && !e.toward) bumpRel(ctx, slot, 'trust', e.delta);
    else rest.push(e);
  }
  apply(ctx, rest, { sys: 'npc', id: clash.id, stream: 'npc.clash' });
}

/**
 * Writes the result of a played clash back into the NPC's lines (combat/07 §3): the effects of the outcome row, the standard relations,
 * the memory of the NPC, the count of this life. Combat calls this itself when it plays a clash outside the handler.
 */
export function applyClashOutcome(ctx: Ctx, clashId: string, kind: string, index?: number): boolean {
  const clash = clashIndex(ctx).get(clashId);
  const slot = clash && slotsOf(ctx.state)[clash.npc];
  const row = clash && rowOf(ctx, clash.npc);
  if (!clash || !slot || !row) return false;
  const i = index ?? clash.outcomes.findIndex((o) => o.kind === kind);
  const o = clash.outcomes[i];
  if (slot.status === 'absent') return false;
  const wasAlive = slot.status === 'alive';
  const gen = slot.gen;
  if (o) applyEffects(ctx, slot, clash, o.effects);
  // the row may have ended the holder (a path with a death) and a successor taken the post: the result belongs to the holder who fought
  if (wasAlive && slot.gen === gen) {
    standardSide(ctx, slot, kind);
    if (kind === 'win_kill' && slot.status === 'alive') killNpc(ctx, clash.npc, 'ตายในศึก', 'mc');
    if (slot.status === 'alive' && kind !== 'win_kill') slot.rel['mc.memory'] = 1;
  }
  slot.clash = { n: (slot.clash?.n ?? 0) + 1, last: kind, at: seasonNow(ctx) };
  note(ctx, slot, row, 'clash', { clash: clash.id, outcome: kind, text: o?.text ?? null }, 2);
  return true;
}

/** Draws the standard kind of a clash nobody plays: the written outcomes, weighted by CLASH_DEFAULT; an outcome that needs a key (a bracket in its name) is not offered. */
function defaultKind(ctx: Ctx, clash: Clash): { kind: string; index: number } | null {
  const cand: { kind: string; index: number; w: number }[] = [];
  clash.outcomes.forEach((o, index) => {
    const w = CLASH_DEFAULT[o.kind];
    if (!w || (o.kind === 'talk' && /[(（]/.test(o.outcome))) return;
    cand.push({ kind: o.kind, index, w });
  });
  if (!cand.length) return null;
  const rng = ctx.rng('npc.clash');
  const pick = cand[rng.weighted(cand.map((c) => c.w))];
  return { kind: pick.kind, index: pick.index };
}

/** Opens one clash: the handlers play it, or the default result is drawn. Returns the kind it ended as, null when it did not open. */
function run(ctx: Ctx, slot: NpcSlotX, clash: Clash, trigger: ClashTrigger, why: ClashWhy, path?: PathKey): string | null {
  const req: ClashReq = { clash, npc: clash.npc, code: trigger.code, trigger, path: path ?? trigger.path, why };
  write(ctx.state, { sys: 'npc', kind: 'npc', id: clash.npc, level: 0, data: { what: 'clash-open', clash: clash.id, code: trigger.code, why } });
  let decision: ClashDecision;
  for (const h of [...handlers]) {
    decision = h(ctx, req);
    if (decision) break;
  }
  if (decision === 'veto' || decision === 'wait') return null;
  let kind: string;
  let index: number | undefined;
  if (decision) {
    kind = decision.outcome;
    index = decision.index;
  } else {
    const d = defaultKind(ctx, clash);
    if (!d) return null;
    kind = d.kind;
    index = d.index;
  }
  applyClashOutcome(ctx, clash.id, kind, index);
  return kind;
}

// ---------- the openings ----------

/**
 * A clash of kind B (the character hinders a path of the NPC) or P (he trespasses on what the NPC guards), opened by the system that sees the
 * deed. `path` is the path hindered. Returns the kind the clash ended as, or null when none opened (no clash row of the NPC, the NPC is not
 * alive or already fought this season, the path is already cut, a handler vetoed).
 */
export function openClash(ctx: Ctx, npcId: string, code: 'B' | 'P', opts: { path?: PathKey; clash?: string } = {}): string | null {
  const slot = slotsOf(ctx.state)[npcId];
  if (!slot || !canClash(ctx, slot)) return null;
  for (const clash of clashesOf(ctx, npcId)) {
    if (opts.clash && clash.id !== opts.clash) continue;
    for (const t of triggersOf(clash)) {
      if (t.code !== code) continue;
      if (code === 'B' && opts.path && t.path && t.path !== opts.path) continue;
      const path = opts.path ?? t.path;
      if (code === 'B' && path && slot.story.cut.includes(path)) continue;
      const kind = run(ctx, slot, clash, t, 'mc', path);
      if (kind) return kind;
    }
  }
  return null;
}

/** A clash the story of the NPC itself sends (the follow-up of rule 3, a clash of kind S): the first clash row of the NPC with that code. */
export function clashFor(ctx: Ctx, slot: NpcSlotX, row: NpcRow, code: ClashCode, why: ClashWhy): string | null {
  if (!canClash(ctx, slot)) return null;
  for (const clash of clashesOf(ctx, row.id)) {
    const t = triggersOf(clash).find((x) => x.code === code);
    if (t) {
      const kind = run(ctx, slot, clash, t, why);
      if (kind) return kind;
    }
  }
  return null;
}

/** Once per life year, for each living NPC in the country of the character: the yearly chance of the clashes of kind T and S (and X with no path). */
export function clashYear(ctx: Ctx, slot: NpcSlotX, row: NpcRow): void {
  const life = ctx.state.life;
  if (!life || !row.clashes.length || !canClash(ctx, slot)) return;
  const rng = ctx.rng('npc.clash');
  for (const clash of clashesOf(ctx, row.id)) {
    for (const t of triggersOf(clash)) {
      if (t.pct === null || (t.code === 'X' && t.path)) continue;
      if (t.zone && t.zone !== life.country) continue;
      if (t.age && (life.hAge < t.age[0] || life.hAge > t.age[1])) continue;
      if (!rng.chance(t.pct)) continue;
      if (run(ctx, slot, clash, t, 'year')) return;
    }
  }
}

/**
 * The NPC drew a path of his story and the character was in the country while it was open (a clash of kind X: "เมื่อเส้น ข) ถูกสุ่ม"):
 * rolls the yearly chance of the clash for each life year the character spent there. Returns true when a clash ran (its result may have
 * forced, cut or weighed his paths, or killed him).
 */
export function clashAtResolve(ctx: Ctx, slot: NpcSlotX, row: NpcRow, path: PathKey): boolean {
  const life = ctx.state.life;
  if (!life || life.dead || !row.clashes.length || !slot.story.mc || !canClash(ctx, slot)) return false;
  const years = Math.max(1, slot.story.mcYears ?? 0);
  const rng = ctx.rng('npc.clash');
  for (const clash of clashesOf(ctx, row.id)) {
    for (const t of triggersOf(clash)) {
      if (t.code !== 'X' || t.path !== path || t.pct === null) continue;
      if (t.zone && t.zone !== life.country) continue;
      if (!rng.chance(1 - Math.pow(1 - t.pct, years))) continue;
      if (run(ctx, slot, clash, t, 'path', path)) return true;
    }
  }
  return false;
}
