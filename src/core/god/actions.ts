// The commands of the chest and the dream (code-plan §6.4, 06-implementation.md §3): `check` says whether the god may, `preview` shows what the
// confirm screen shows (no rolls, no changes), `run` does it. The prayer, whisper, miracle and decree commands are registered by acts/.
import { hasAction, onAction } from '../command';
import type { Ctx } from '../game';
import { checkOpen, checkPick, checkReroll, chestLimit, chestsLeft, currentChest, openChest, pickSlot, rerollChest, skipChest, slotPrice } from './chest';
import { checkDream, offerCards, previewDream, sendDream } from './dream';
import { lightOf } from './power';
import { inWindow } from './state';
import { priceOf } from './power';

const slotArg = (a: Record<string, unknown>): number => Number(a.slot);
const lockArg = (a: Record<string, unknown>): number | undefined => (a.lock === undefined || a.lock === null || a.lock === 0 ? undefined : Number(a.lock));

let installed = false;

/** Registers the commands of this file with `command/`. Called when the system is imported; a test that cleared the commands can call it again with `force`. */
export function registerGodActions(force = false): void {
  if (installed && !force) return;
  installed = true;
  const add = (...args: Parameters<typeof onAction>) => {
    if (!hasAction(args[0])) onAction(...args);
  };

  add('chest.open', {
    check: (ctx) => checkOpen(ctx),
    preview: (ctx) => ({ window: inWindow(ctx), left: chestsLeft(ctx), limit: chestLimit(ctx), light: lightOf(ctx) }),
    run: (ctx) => void openChest(ctx),
  });

  add('chest.pick', {
    check: (ctx, a) => (Number.isInteger(slotArg(a)) ? checkPick(ctx, slotArg(a)) : 'ต้องระบุช่อง'),
    preview: (ctx, a) => {
      const s = currentChest(ctx)!.slots[slotArg(a) - 1]!;
      const { price } = slotPrice(ctx, s);
      return { slot: s.slot, kind: s.kind, id: s.id, name: s.name, tier: s.tier, pay: s.pay, price, belief: s.belief, why: s.why };
    },
    run: (ctx, a) => void pickSlot(ctx, slotArg(a)),
  });

  add('chest.reroll', {
    check: (ctx, a) => checkReroll(ctx, lockArg(a)),
    preview: (ctx, a) => {
      const ch = currentChest(ctx)!;
      const p = priceOf(ctx, 'reroll', { n: ch.rerolls, lock: lockArg(a) !== undefined })!;
      return { price: p.faith ?? 0, rerolls: ch.rerolls, lock: lockArg(a) ?? 0 };
    },
    run: (ctx, a) => void rerollChest(ctx, lockArg(a)),
  });

  add('chest.skip', {
    check: (ctx) => (currentChest(ctx) ? null : 'ไม่มีหีบที่เปิดอยู่'),
    preview: () => ({}),
    run: (ctx) => skipChest(ctx),
  });

  add('dream.send', {
    check: (ctx, a) => checkDream(ctx, a),
    preview: (ctx, a) => previewDream(ctx, a),
    run: (ctx, a) => void sendDream(ctx, a),
  });
}

/** The three ways the game offers for a dream now, with the level and the reasons of each (the screen's dream card). Pure. */
export function dreamOffers(ctx: Ctx) {
  return offerCards(ctx);
}
