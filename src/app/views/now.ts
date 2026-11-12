// The "now" box of the god panel (proposal review/play-1 §2.3 G1): one to three things that fit the situation, each a sentence of why, the price and a
// button that opens the fitting power. It reads what the game already detects (waiting prayers, the god window, the calls of omens, battles and crises, the vow)
// and invents no rule of its own. Silence is an answer (08-goals.md §1): with nothing waiting it says so, and has no button.
import type { Game, GameData } from '../../core/game';
import { inWindow } from '../../core/god';
import { lifeGoals } from '../../core/god/goals';
import { interventions } from '../../core/god/goals/facts';
import { VOW_NUMBERS } from '../../core/god/goals/tuning';
import { ask, costOf, costText, dreamView, prayerView, whisperTargets } from './god';
import { NOW_MAX } from './watch-tuning';
import { WATCH_WORDS } from './watch-words';
import type { CardView, GodOpen, Tone } from './watch';

const N = WATCH_WORDS.now;

export interface NowButton {
  label: string;
  open: GodOpen;
}

export interface NowItem {
  /** Stable key: `prayer` `dream` `chest` `omen` `battle` `crisis` `vow` `nothing`. */
  id: string;
  tone: Tone;
  /** Why: one short sentence. */
  text: string;
  /** The price in words, or null when the item is only a word (a nudge of the vow). */
  price: string | null;
  /** The buttons that open the fitting power; none for "nothing waits" and for a nudge that has no power. */
  buttons: NowButton[];
}

export interface NowPrayer {
  n: number;
  name: string;
  by: string;
  yearsLeft: number;
  /** The price of granting it, in words ('' when free). */
  price: string;
}

/** What the vow adds: a power that fits it, or only a word. */
export type NowVow = { kind: 'heir'; price: string } | { kind: 'text'; text: string };

/** The facts the box is made of: read from the game by `nowFacts`, turned into items by `nowItems` (pure, tested on its own). Prices are words ('' when free). */
export interface NowFacts {
  prayers: NowPrayer[];
  /** A god window with a dream way the god can pay for; the price of the cheapest. */
  dream: { price: string } | null;
  /** The chest can open and a god window is open (outside a window the chest can almost always open, and saying so all the time would push the player). */
  chest: { price: string; window: boolean } | null;
  /** The cards that are up (omen, big omen, battle, crisis), each with the price of the whisper it offers (null: none). */
  calls: { card: CardView; price: string | null }[];
  vow: NowVow | null;
}

const priceWord = (price: string | null): string | null => (price === null ? null : price === '' ? N.free : N.price(price));

export function nowItems(f: NowFacts): NowItem[] {
  const out: NowItem[] = [];
  for (const p of f.prayers) out.push({ id: 'prayer', tone: 'light', text: N.prayer(p.name, p.by, p.yearsLeft), price: priceWord(p.price), buttons: [{ label: N.prayerBtn, open: { kind: 'prayer', args: { id: p.n } } }] });
  if (f.dream) out.push({ id: 'dream', tone: 'light', text: N.dream, price: priceWord(f.dream.price), buttons: [{ label: N.dreamBtn, open: { kind: 'dream', args: { why: 'window' } } }] });
  if (f.chest) out.push({ id: 'chest', tone: 'light', text: f.chest.window ? N.chestWindow : N.chest, price: priceWord(f.chest.price), buttons: [{ label: N.chestBtn, open: { kind: 'chest', args: {} } }] });
  for (const { card, price } of f.calls) {
    if (card.kind === 'omen' || card.kind === 'majorOmen') {
      const first = card.options[0];
      if (first) out.push({ id: 'omen', tone: card.tone, text: card.text, price: N.byChoice, buttons: [{ label: N.omenBtn, open: first }] });
    } else if (card.kind === 'battle') {
      const at = card.id ? { id: card.id } : {};
      out.push({ id: 'battle', tone: card.tone, text: card.text, price: priceWord(price), buttons: ['ระวัง', 'กล้าเถิด'].map((hint) => ({ label: hint, open: { kind: 'whisper' as const, args: { why: 'battle', ...at, hint } } })) });
    } else if (card.kind === 'crisis') {
      const help = card.options.find((o) => o.kind === 'whisper');
      if (help) out.push({ id: 'crisis', tone: card.tone, text: card.text, price: priceWord(price), buttons: [{ label: N.helpBtn, open: help }] });
    }
  }
  if (f.vow?.kind === 'heir') out.push({ id: 'vow', tone: 'light', text: N.heir, price: priceWord(f.vow.price), buttons: [{ label: N.heirBtn, open: { kind: 'whisper', args: { hint: 'ชี้ทายาท' } } }] });
  else if (f.vow) out.push({ id: 'vow', tone: 'light', text: f.vow.text, price: null, buttons: [] });
  const shown = out.slice(0, NOW_MAX);
  return shown.length ? shown : [{ id: 'nothing', tone: 'fate', text: N.nothing, price: null, buttons: [] }];
}

/** The price in words of a power the core would allow now, or null when it would not. */
function priceOf(game: Game, data: GameData, action: 'chest.open' | 'whisper', args: Record<string, unknown>): string | null {
  const a = ask(game, data, action, args);
  return a.ok ? costText(costOf(a.preview)) : null;
}

const FREE = costText({ faith: 0, dread: 0 });

/** The vow's nudge: only for the vows whose way the god can see from the state; the others say nothing. */
function vowFact(game: Game, data: GameData): NowVow | null {
  const life = game.state.life;
  const id = game.state.god.vows[0];
  if (!life || life.dead || !id) return null;
  switch (id) {
    case 'GV-05': {
      const target = whisperTargets(game, data, 'npc')[0];
      const price = target ? priceOf(game, data, 'whisper', { hint: 'ชี้ทายาท', target: target.id }) : null;
      return price === null ? null : { kind: 'heir', price: price === FREE ? '' : price };
    }
    case 'GV-11': {
      const peak = Math.max(life.godFaith, lifeGoals(life).track.peakBelief);
      return peak >= VOW_NUMBERS.belief ? null : { kind: 'text', text: N.belief(Math.round(life.godFaith), VOW_NUMBERS.belief) };
    }
    case 'GV-12': {
      const used = interventions(game.ctx);
      return used > VOW_NUMBERS.interventions ? null : { kind: 'text', text: N.own(used, VOW_NUMBERS.interventions) };
    }
    case 'GV-02':
      return { kind: 'text', text: N.calm };
    default:
      return null;
  }
}

const freeAsEmpty = (price: string | null): string | null => (price === FREE ? '' : price);

/** Reads the facts of the box from a running game and the cards that are up (the stop's folded cards when the clock is stopped). It only asks; nothing changes. */
export function nowFacts(game: Game, data: GameData, cards: CardView[]): NowFacts {
  const life = game.state.life;
  if (!life || life.dead) return { prayers: [], dream: null, chest: null, calls: [], vow: null };
  const window = inWindow(game.ctx);
  const doors = window ? dreamView(game, data).doors.filter((d) => d.ok) : [];
  const chest = ask(game, data, 'chest.open', {});
  const cheapest = doors.length ? Math.min(...doors.map((d) => d.price)) : 0;
  return {
    prayers: prayerView(game, data).cards.map((c) => ({ n: c.n, name: c.name, by: c.by, yearsLeft: c.yearsLeft, price: c.answers.find((a) => a.key === 'give')?.cost ?? '' })),
    dream: doors.length ? { price: cheapest > 0 ? costText({ faith: cheapest, dread: 0 }) : '' } : null,
    chest: chest.ok && window ? { price: freeAsEmpty(costText(costOf(chest.preview))) ?? '', window } : null,
    calls: cards
      .filter((c) => c.kind !== 'prayer')
      .map((card) => {
        const target = card.options[0]?.args.target;
        const price = card.kind === 'battle' ? priceOf(game, data, 'whisper', { hint: 'ระวัง' }) : card.kind === 'crisis' ? priceOf(game, data, 'whisper', { hint: 'ช่วย', ...(target ? { target } : {}) }) : null;
        return { card, price: freeAsEmpty(price) };
      }),
    vow: vowFact(game, data),
  };
}

/** The model of the watch screen with its "now" box filled from the game (the cards are those up, or the ones folded into the stop). */
export function withNow<M extends { stop: { cards: CardView[] } | null; cards: CardView[]; panel: { now: NowItem[] } }>(model: M, game: Game, data: GameData): M {
  const now = nowItems(nowFacts(game, data, model.stop ? model.stop.cards : model.cards));
  return { ...model, panel: { ...model.panel, now } };
}
