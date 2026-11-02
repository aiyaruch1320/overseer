// A way of the story that says the character dies in battle ("ตายในศึกตามที่หวัง", "ตายในศึกกับไททัน", "ตายในสนามสุดท้าย") is a last fight, not a bare death:
// the combat system registers how it is fought (`onLastStand`) and the story hands the way over to it. Without a handler (a world with no combat) the way dies at once.
import type { Ctx } from '../game';

/** Answers true when the last fight was taken (called, or put in the queue); the death is then the fight's, and the hero may live through it. */
export type LastStandHandler = (ctx: Ctx, node: string, choice: string) => boolean;

let handler: LastStandHandler | undefined;

export function onLastStand(fn: LastStandHandler | undefined): void {
  handler = fn;
}

/** The story asks for the last fight of a way that dies in battle. */
export function lastStand(ctx: Ctx, node: string, choice: string): boolean {
  return !!handler && handler(ctx, node, choice);
}
