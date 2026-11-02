// Point 2, the director at the key points (llm/04-story.md §3). The rule-based director of the story system always works and is not here. This layer adds, at the
// few key points of the docs (a death that has consequences, a heavy heart, the first event after a big one, a face met a third time), one choice between the two
// ways the rule-based director ranks highest: the way chosen is weighed ×1.5 more, the two layers together at most ×2.5, at most ten points a life.
//
// Time: the game does not wait (§3.4). The app asks ahead (`requestDirector`, async, up to a life year before the point) and the answer waits in the save as an *offer*.
// When the point comes the story system calls `directorMul` (sync): the first call *freezes* what the point used (the offer, or nothing) in the save, so
// an answer that comes late changes nothing and a replay reads the frozen value, with the switches on or off (llm/02-offline.md §6).
import type { Ctx } from '../game';
import type { LlmClient } from './client';
import { DIRECTOR_SYSTEM } from './prompts';
import { answerOf, keep, keys, logAnswer } from './record';
import { pointOn, playerOn } from './switches';
import { DIRECTOR, DIRECTOR_KINDS, DIRECTOR_REASONS, MAX_TOKENS, type DirectorKind, type DirectorReason } from './tuning';
import type { Checked, JsonSchema } from './types';
import { parseObject } from './validate';

export interface DirectorWay {
  /** The key the story system knows the way by (`a` `b` `c` of a node, an NPC id, an event id). */
  key: string;
  /** What the way is, in the words the game shows (Thai). */
  text: string;
}

/** A key point: the two ways the rule-based director ranks highest, best first. */
export interface DirectorPoint {
  /** Unique inside a life: the same point asked and read twice must give the same id (`npc_death:T12:31`). */
  id: string;
  kind: DirectorKind;
  ways: [DirectorWay, DirectorWay];
}

export interface DirectorPick {
  pick: string;
  reason: DirectorReason;
}

/** The memory of the life, the eight lines the story system keeps (llm/04-story.md §3.1 rule 2). */
const memoryOf = (ctx: Ctx): string[] => ctx.state.life?.memory ?? [];

function schemaOf(p: DirectorPoint): JsonSchema {
  return {
    type: 'object',
    properties: { pick: { type: 'string', enum: p.ways.map((w) => w.key) }, reason: { type: 'string', enum: [...DIRECTOR_REASONS] } },
    required: ['pick', 'reason'],
    additionalProperties: false,
  };
}

export function checkPick(text: string, p: Pick<DirectorPoint, 'ways'>): Checked<DirectorPick> {
  const o = parseObject(text);
  if (!o.ok) return o;
  const { pick, reason } = o.value;
  if (typeof pick !== 'string' || !p.ways.some((w) => w.key === pick)) return { ok: false, reason: `pick "${String(pick)}" is not one of the ways` };
  if (typeof reason !== 'string' || !(DIRECTOR_REASONS as readonly string[]).includes(reason)) return { ok: false, reason: `reason "${String(reason)}" is not a code` };
  return { ok: true, value: { pick, reason: reason as DirectorReason } };
}

function validPoint(p: DirectorPoint): boolean {
  return !!p.id && DIRECTOR_KINDS.includes(p.kind) && p.ways.length === 2 && p.ways[0].key !== p.ways[1].key && p.ways.every((w) => !!w.key && !!w.text);
}

/** How many points of this life the LLM has answered (the cap is ten a life, llm/04-story.md §3.4). */
export function directorCount(ctx: Ctx): number {
  const life = ctx.state.life;
  if (!life) return 0;
  const prefix = keys.offer(life.id, '');
  return Object.keys(ctx.state.llmAnswers).filter((k) => k.startsWith(prefix)).length;
}

export type AskResult = 'asked' | 'offered' | 'decided' | 'off' | 'cap' | 'bad_point' | 'template';

/**
 * Asks ahead for one key point. Call it when the point is known to come within a life year; it returns when the answer is in (or when it is clear there is none).
 * Writes the offer into the save and nothing else; the point itself is untouched until `directorMul` reads it.
 */
export async function requestDirector(ctx: Ctx, point: DirectorPoint, client: LlmClient | null | undefined): Promise<AskResult> {
  const life = ctx.state.life;
  const ans = ctx.state.llmAnswers;
  if (!life || life.dead || !validPoint(point)) return 'bad_point';
  if (ans[keys.decision(life.id, point.id)] !== undefined) return 'decided';
  if (ans[keys.offer(life.id, point.id)] !== undefined) return 'offered';
  if (!pointOn(ctx.state, client, 'director')) return 'off';
  if (directorCount(ctx) >= DIRECTOR.perLife) return 'cap';
  const asked = keys.asked(life.id, point.id);
  if (ans[asked] !== undefined) return 'asked';
  keep(ctx.state, asked, '1');
  const memory = memoryOf(ctx);
  const r = await client!.run({
    point: 'director',
    input: { kind: point.kind, memory, ways: point.ways },
    life: life.id,
    system: DIRECTOR_SYSTEM,
    user: JSON.stringify({ kind: point.kind, memory, ways: point.ways }),
    schema: schemaOf(point),
    maxTokens: MAX_TOKENS.director,
    check: (text) => checkPick(text, point),
  });
  if (r.source === 'template') return 'template';
  // the point may have come while the answer was on its way: then it was frozen without it, and the answer is late
  if (ans[keys.decision(life.id, point.id)] !== undefined) return 'decided';
  keep(ctx.state, keys.offer(life.id, point.id), r.text);
  return 'asked';
}

/**
 * What the point used: the answer frozen at the first call. Without an offer (or with the player's switch off now) the point freezes as "none". Nothing is
 * written when the layer was never asked (no `asked` mark and no offer), so a game without an LLM leaves no trace.
 */
export function directorDecision(ctx: Ctx, point: Pick<DirectorPoint, 'id' | 'ways'>): DirectorPick | undefined {
  const life = ctx.state.life;
  if (!life) return undefined;
  const ans = ctx.state.llmAnswers;
  const dk = keys.decision(life.id, point.id);
  const had = ans[dk];
  if (had !== undefined) {
    const c = had === 'none' ? null : checkPick(had, point);
    return c && c.ok ? c.value : undefined;
  }
  const offer = ans[keys.offer(life.id, point.id)];
  if (offer === undefined && ans[keys.asked(life.id, point.id)] === undefined) return undefined;
  const use = offer !== undefined && playerOn(ctx.state, 'director') ? checkPick(offer, point) : null;
  if (use && use.ok) {
    keep(ctx.state, dk, offer!);
    logAnswer(ctx.state, 'director', point.id, { pick: use.value.pick, reason: use.value.reason, answer: offer! });
    return use.value;
  }
  keep(ctx.state, dk, 'none');
  logAnswer(ctx.state, 'director', point.id, { pick: 'none', reason: offer === undefined ? 'late' : 'off', answer: offer ?? '' });
  return undefined;
}

/** The factor of the LLM director on one way of a point: ×1.5 on the way it chose, else 1. Call it from the story system's weighing; it is sync and deterministic. */
export function directorMul(ctx: Ctx, point: Pick<DirectorPoint, 'id' | 'ways'>, wayKey: string): number {
  const d = directorDecision(ctx, point);
  return d && d.pick === wayKey ? DIRECTOR.mul : 1;
}

/** The rule-based factor and the LLM factor together, never above ×2.5 (llm/04-story.md §3.4). */
export const combineMul = (ruleMul: number, llmMul: number): number => (llmMul > 1 ? Math.min(DIRECTOR.totalCap, ruleMul * llmMul) : ruleMul);

/**
 * A short line for the player about why the point leaned that way (tier 0: a template per reason code, never text from the LLM; assumption, no document writes these).
 * Undefined when the LLM did not decide the point.
 */
export const REASON_LINE: Record<DirectorReason, string> = {
  old_face: 'คนที่เคยพบกลับมาในจังหวะที่ชีวิตนี้ยังจำได้',
  dream: 'ความฝันที่เคยส่งถึงตัวละครยังตามมาอยู่',
  life_question: 'คำถามของชีวิตนี้ยังรอคำตอบ',
  vow: 'คำปฏิญาณยังเป็นเงาของเรื่องนี้',
  rest: 'หลังเรื่องหนัก ชีวิตได้พักหายใจ',
  tension: 'ความเงียบมานานเกินไป เรื่องจึงตึงขึ้น',
};

export function directorLine(ctx: Ctx, point: Pick<DirectorPoint, 'id' | 'ways'>): string | undefined {
  const life = ctx.state.life;
  const had = life ? answerOf(ctx.state, keys.decision(life.id, point.id)) : undefined;
  if (!had || had === 'none') return undefined;
  const c = checkPick(had, point);
  return c.ok ? REASON_LINE[c.value.reason] : undefined;
}

/** A stable id for a point from its parts, for callers that have no id of their own. */
export const pointId = (kind: DirectorKind, ...parts: (string | number)[]): string => `${kind}:${parts.join(':')}`;
