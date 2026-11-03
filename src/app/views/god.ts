// What the god's screens read (docs/appearance/20-god-ui.md §3 to §9): plain view models made from a game and its data. Pure: they ask the core
// for previews (which never roll and never change the state) and read the state; they write nothing. No game text is made here: the words are
// the core text system's (`src/core/text`) and the tools' text helpers (scripts/tools/god-commands.ts), the chrome words are `god-words.ts`.
import { command } from '../../core/command';
import { alliesOf, crisesWaiting } from '../../core/bonds';
import type { Game, GameData } from '../../core/game';
import { chestLimit, chestsLeft, currentChest, dreamsOf, inWindow, offerCards, slotBelief, switchPenalty } from '../../core/god';
import { actsOf, cardsOf, fateCost, fateTargets, hintsOf, implementedMiracles, nameOfKind, obeyChance as whisperChance, omenQuarters, strangeOptions, whisperPrice, activeWhispers, miracleOf } from '../../core/god/acts';
import { allCountries, continentOf, countriesOf, countryName, hasCountry } from '../../core/god/acts/geo';
import { targetName } from '../../core/god/acts/whisper';
import { allMixes, viewConj } from '../../core/god/conjure';
import { coreName, scaleName, verbName } from '../../core/god/conjure/plan';
import { unlocked, titlesOf } from '../../core/god/goals';
import { ruinLabel } from '../../core/god/ruin/names';
import { ruinsNow } from '../../core/god/ruin';
import { npcsAt } from '../../core/npc';
import { calendarYear, fxPhrases, lines as textLines, plainName, reasonText, scrub, sentence } from '../../core/text';
import { CHEST_KIND_TH, TIER_TH, WHY_TH } from '../../core/text/tuning';
import type { GodAction, LogEntry } from '../../core/types';
import type { CommandResult } from '../../core/types';
import { MIRACLE_TARGET, NEEDS, TITLE, cardEffect, costWords, previewLines, whisperEffect, type PreviewEnv } from '../../../scripts/tools/god-commands';
import { unlink } from '../../../scripts/tools/god-conjure';
import { CORE_COLOR, HOLD_SECONDS, W, lineOfMiracle } from './god-words';

// ---------- asking the core ----------

export type Ask = { ok: true; preview: Record<string, unknown> } | { ok: false; reason: string };

/** The preview of one action, or why the god may not (the core checks and answers; nothing is rolled, nothing changes). */
export function ask(game: Game, data: GameData, action: GodAction, args: Record<string, unknown>): Ask {
  try {
    const r = command(game.ctx, { type: 'god', action, args, confirm: false });
    return r.ok ? { ok: true, preview: r.preview ?? {} } : { ok: false, reason: words(game, data, reasonText(data, r.reason)) || W.refused };
  } catch {
    return { ok: false, reason: W.refused };
  }
}

/**
 * The ids and links the core's texts may still hold, turned into what the player reads (M1 of the M5 triage): a miracle code is the miracle's name, a
 * ruin event code the name of the event, a country code the country, a link to a document is cut to its words, an id of the data its name or nothing.
 */
export function words(game: Game, data: GameData, text: string): string {
  const ctx = game.ctx;
  const ruinNames = (ctx.data.god?.items as { miracles?: { ruin?: { events?: { id: string; name: string }[] } } } | undefined)?.miracles?.ruin?.events ?? [];
  const out = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\(\s*(?:\.\.?\/)[^)]*\.md[^)]*\)/g, ' ')
    .replace(/\bMR-\d\d\b/g, (m) => miracleOf(ctx, m)?.name ?? ' ')
    .replace(/\bRU-0\d\b/g, (m) => ruinNames.find((e) => e.id === m)?.name ?? ' ')
    .replace(/\b(?:AZ|MH|KD|NR|AL|MK|SH|SV|NB)-\d\d\b/g, (m) => (hasCountry(ctx, m) ? countryName(ctx, m) : plainName(data, m) || ' '))
    .replace(/\b[a-z]{1,3}_[a-z0-9_]+\b/g, (m) => plainName(data, m) || ' ')
    .replace(/\bdocs?\/[\w./-]*/g, ' ');
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.·])/g, '$1').trim();
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const lifeOf = (game: Game) => (game.state.life && !game.state.life.dead ? game.state.life : null);

export interface CostView {
  faith: number;
  dread: number;
}

/** The price a preview names: `cost {faith, dread}`, or `price` paid in the line `pay`, or `faith` (a dream). */
export function costOf(p: Record<string, unknown>): CostView {
  const c = rec(p.cost);
  if (p.cost && typeof p.cost === 'object') return { faith: num(c.faith), dread: num(c.dread) };
  if (typeof p.price === 'number') return p.pay === 'dread' ? { faith: 0, dread: p.price } : { faith: p.price, dread: 0 };
  return { faith: num(p.faith), dread: 0 };
}

export const costText = (c: CostView): string => costWords(c.faith || c.dread ? { ...(c.faith ? { faith: c.faith } : {}), ...(c.dread ? { dread: c.dread } : {}) } : undefined) ?? W.free;

// ---------- power (the panel of the god) ----------

export interface PowerView {
  alive: boolean;
  light: number;
  dread: number;
  belief: number | null;
  heart: number | null;
  burdenAt: number;
  window: boolean;
  caps: { chest: { left: number; limit: number }; dream: { used: number; limit: number }; whisper: { used: number; limit: number } };
}

export function powerView(game: Game): PowerView {
  const st = game.state;
  const life = lifeOf(game);
  const items = game.ctx.data.god?.items as { caps?: { dreamPerYear: number; whisperPerYear: number }; dreams?: { burden?: { at: number } } } | undefined;
  const a = actsOf(st);
  return {
    alive: !!life,
    light: Math.floor(st.god.light),
    dread: Math.floor(st.god.dread),
    belief: life ? life.godFaith : null,
    heart: life ? life.heart : null,
    burdenAt: items?.dreams?.burden?.at ?? 2,
    window: life ? inWindow(game.ctx) : false,
    caps: {
      chest: life ? { left: chestsLeft(game.ctx), limit: chestLimit(game.ctx) } : { left: 0, limit: 0 },
      dream: { used: st.god.counters['y.dream'] ?? 0, limit: items?.caps?.dreamPerYear ?? 2 },
      whisper: { used: life && a.whisper.age === life.hAge ? a.whisper.used.length : 0, limit: items?.caps?.whisperPerYear ?? 3 },
    },
  };
}

// ---------- the confirm dialog (every action: preview, then confirm) ----------

export type Tone = 'light' | 'dread' | 'fate' | 'dream';

export interface ConfirmView {
  action: GodAction;
  args: Record<string, unknown>;
  title: string;
  ok: boolean;
  /** Why the god may not (when `ok` is false). */
  reason?: string;
  /** The preview as the player reads it. */
  lines: string[];
  cost: CostView;
  light: number;
  dread: number;
  /** The power left after paying. */
  afterLight: number;
  afterDread: number;
  /** The caps that bear on this action, as lines. */
  caps: string[];
  tone: Tone;
  /** Seconds of holding that confirm it; 0 = a click (a miracle is held, 20-god-ui.md §7.1). */
  hold: number;
}

/** What the preview needs of the game besides itself (the same as the tools': the curses, the burden, the hazards of the target). */
function envOf(game: Game, data: GameData, args: Record<string, unknown>): PreviewEnv {
  const st = game.state;
  const life = lifeOf(game);
  const burden = (game.ctx.data.god?.items as { dreams?: { burden?: { at: number } } } | undefined)?.dreams?.burden;
  const named = [args.country, ...(Array.isArray(args.countries) ? args.countries : [])].filter((x): x is string => typeof x === 'string');
  const ids = named.length ? named : typeof args.continent === 'string' ? countriesOf(game.ctx, args.continent) : life && args.id ? [life.country] : [];
  return {
    curses: life ? life.curses.map((c) => plainName(data, c)).filter(Boolean) : [],
    heart: life?.heart,
    burdenAt: burden?.at,
    ...(ids.length ? { flags: Object.fromEntries(ids.map((c) => [c, st.world.countryFlags[c] ?? []])) } : {}),
  };
}

/** The title of an action as the confirm dialog heads it. */
export function titleOf(action: GodAction, args: Record<string, unknown>, preview?: Record<string, unknown>): string {
  const name = preview ? str(preview.name) : '';
  if (action === 'miracle' && args.cancel !== undefined) return `${W.miracle.cancelOmen} ${str(args.cancel)}`;
  if (action === 'conjure' && args.cancel !== undefined) return `${W.miracle.cancelOmen} ${str(args.cancel)}`;
  return name && (action === 'miracle' || action === 'conjure' || action === 'decree') ? `${TITLE[action]}: ${name}` : TITLE[action];
}

function capsLines(game: Game, action: GodAction, preview: Record<string, unknown>): string[] {
  const p = powerView(game);
  switch (action) {
    case 'chest.open':
      return [`${W.chest.left}: ${p.caps.chest.left}/${p.caps.chest.limit}`];
    case 'dream.send':
      return [`${W.dream.left} ${Math.max(0, p.caps.dream.limit - p.caps.dream.used)} ${W.dream.times}`];
    case 'whisper':
      return [`${W.whisper.left} ${Math.max(0, num(preview.left) + 1)} ${W.whisper.times}`];
    case 'miracle': {
      const l = rec(preview.left);
      return l.mid !== undefined ? [`${W.miracle.left}: กลาง ${num(l.mid)} · ใหญ่ ${num(l.big)} · มหา ${num(l.grand)}`] : [];
    }
    case 'conjure': {
      const q = rec(preview.quota);
      return q.limit !== undefined ? [`${W.conjure.quota}: ${num(q.used)}/${num(q.limit)}`] : [];
    }
    default:
      return [];
  }
}

export function confirmView(game: Game, data: GameData, action: GodAction, args: Record<string, unknown>): ConfirmView {
  const st = game.state;
  const light = Math.floor(st.god.light);
  const dread = Math.floor(st.god.dread);
  const base = { action, args, light, dread, cost: { faith: 0, dread: 0 }, afterLight: light, afterDread: dread, caps: [] as string[], tone: 'light' as Tone, hold: 0 };
  const r = ask(game, data, action, args);
  if (!r.ok) return { ...base, title: titleOf(action, args), ok: false, reason: r.reason, lines: [] };
  const p = r.preview;
  const cost = costOf(p);
  const tier = str(p.tier);
  const isMiracle = action === 'miracle' || action === 'decree' || action === 'conjure';
  const cancelling = p.cancel !== undefined;
  const lines = previewLines(data, p, false, action, envOf(game, data, args)).map((l) => words(game, data, l)).filter(Boolean);
  // paying in the other line within the same year of his life costs the character belief (01-power.md §2): said before, not found in the log after
  const sw = cancelling ? 0 : switchPenalty(game.ctx, cost);
  if (sw > 0) lines.push(`${W.belief}ของเขา −${sw}: ${W.switchLine}`);
  if (action === 'whisper' && typeof args.target === 'string') {
    // a hint that points names who it points at, and says when that ally is in a crisis now (his answer is what the hint leans on)
    const ally = alliesOf(game.ctx).find((t) => t.id === args.target || t.npc === args.target || t.name === args.target);
    const hot = !!ally && crisesWaiting(game.ctx).some((w) => w.tie.id === ally.id);
    const who = ally?.name ?? whisperTargets(game, data, 'npc').concat(whisperTargets(game, data, 'place')).find((t) => t.id === args.target)?.name;
    if (who) lines.splice(1, 0, `${W.whisper.to}: ${who}${hot ? ` (${W.whisper.inCrisis})` : ''}`);
  }
  return {
    ...base,
    title: titleOf(action, args, p),
    ok: true,
    lines: lines.length ? lines : [W.nothingToShow],
    cost,
    afterLight: Math.round((light - cost.faith) * 10) / 10,
    afterDread: Math.round((dread - cost.dread) * 10) / 10,
    caps: capsLines(game, action, p),
    tone: action === 'decree' ? 'fate' : action === 'dream.send' ? 'dream' : cost.dread > 0 && !cost.faith ? 'dread' : 'light',
    hold: isMiracle && !cancelling ? (tier === 'มหา' ? HOLD_SECONDS.grand : HOLD_SECONDS.normal) : 0,
  };
}

/** What a result brought, for the panel after the action: the log lines it wrote (level 1 and up) and the move of the power. */
export function resultView(game: Game, data: GameData, r: CommandResult, before?: { light: number; dread: number }): { lines: string[]; moved: string[] } {
  if (!r.ok) return { lines: [r.reason], moved: [] };
  const ls = textLines(data, r.log, 1).map((l) => l.text);
  const st = game.state;
  const moved: string[] = [];
  const round = (n: number) => Math.round(n * 10) / 10;
  if (before && st.god.light !== before.light) moved.push(`${W.light} ${round(before.light)} → ${round(st.god.light)}`);
  if (before && st.god.dread !== before.dread) moved.push(`${W.dread} ${round(before.dread)} → ${round(st.god.dread)}`);
  return { lines: ls.length ? ls : [W.noNewLines], moved };
}

// ---------- the chest (§3) ----------

export interface ChestCard {
  slot: number;
  kind: string;
  kindWord: string;
  glyph: string;
  name: string;
  tier: string;
  tierWord: string;
  effect: string;
  pay: 'faith' | 'dread';
  price: number;
  afford: boolean;
  belief: number;
  why: string[];
  locked: boolean;
}

export interface ChestView {
  alive: boolean;
  window: boolean;
  left: number;
  limit: number;
  /** May the god open a chest now (and why not). */
  canOpen: { ok: boolean; reason?: string };
  isOpen: boolean;
  rerolls: number;
  rerollMax: number;
  /** The cards in their three columns: blessings, curses, skills and things (two rows each); null is an empty place on the cloth. */
  columns: (ChestCard | null)[][];
  cards: (ChestCard | null)[];
  lockedSlot: number | null;
}


export function chestView(game: Game, data: GameData): ChestView {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const st = game.state;
  const ch = life ? currentChest(ctx) : null;
  const open = life ? ask(game, data, 'chest.open', {}) : ({ ok: false, reason: W.noLife } as Ask);
  const items = ctx.data.god?.items as { prices?: { reroll?: unknown[] } } | undefined;
  const rerollMax = Array.isArray(items?.prices?.reroll) ? items!.prices!.reroll!.length : 3;
  const cards = (ch?.slots ?? []).map((s): ChestCard | null =>
    s
      ? {
          slot: s.slot,
          kind: s.kind,
          kindWord: CHEST_KIND_TH[s.kind] ?? 'ของ',
          glyph: W.icons.kind[s.kind] ?? '◈',
          name: s.name,
          tier: s.tier,
          tierWord: TIER_TH[s.tier] ?? s.tier,
          effect: cardEffect(data, s),
          pay: s.pay,
          price: s.price,
          afford: (s.pay === 'dread' ? st.god.dread : st.god.light) >= s.price,
          belief: Math.round(slotBelief(ctx, s) * 10) / 10,
          why: s.why.map((w) => WHY_TH[w]).filter(Boolean),
          locked: ch?.locked === s.slot,
        }
      : null,
  );
  return {
    alive: !!life,
    window: life ? inWindow(ctx) : false,
    left: life ? chestsLeft(ctx) : 0,
    limit: life ? chestLimit(ctx) : 0,
    canOpen: open.ok ? { ok: true } : { ok: false, reason: open.reason },
    isOpen: !!ch,
    rerolls: ch?.rerolls ?? 0,
    rerollMax,
    // pairs by kind: slots 1 and 2 are blessings, 3 and 4 curses, 5 a skill and 6 a thing
    columns: [cards.slice(0, 2), cards.slice(2, 4), cards.slice(4, 6)].map((c) => [c[0] ?? null, c[1] ?? null]),
    cards,
    lockedSlot: ch?.locked ?? null,
  };
}

/** The reroll now: the price (with a card kept or not) and why not. */
export function rerollInfo(game: Game, data: GameData, lock?: number): { ok: boolean; reason?: string; price: number } {
  const r = ask(game, data, 'chest.reroll', lock ? { lock } : {});
  return r.ok ? { ok: true, price: num(r.preview.price) } : { ok: false, reason: r.reason, price: 0 };
}

// ---------- the dream (§4) ----------

export interface DreamDoor {
  /** The number the command takes (1 to 3). */
  path: number;
  label: string;
  symbol: string;
  level: string;
  flame: string;
  reasons: string[];
  price: number;
  free: boolean;
  band: string;
  against: boolean;
  ok: boolean;
  reason?: string;
}

export interface DreamView {
  alive: boolean;
  doors: DreamDoor[];
  allies: { id: string; name: string; line: string; text: string; ok: boolean; reason?: string; price: number }[];
  /** Dreams sent and waiting for the crossroads. */
  waiting: { symbol: string; level: string; flame: string }[];
  /** The results of dreams at the crossroads (the lines the story wrote), the newest last. */
  results: { outcome: string; word: string; text: string; symbol: string }[];
  heart: number;
  burdenAt: number;
  left: number;
}

export function dreamView(game: Game, data: GameData): DreamView {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const pv = powerView(game);
  const bands = ((ctx.data.god?.items as { dreams?: { levels?: { name: string; min: number; max: number }[] } } | undefined)?.dreams?.levels ?? []);
  const doors = life
    ? offerCards(ctx).map((o, i): DreamDoor => {
        const a = ask(game, data, 'dream.send', { path: i + 1 });
        const band = bands.find((b) => b.name === o.level);
        return {
          path: i + 1,
          label: sentence(data, o.label) || o.label,
          symbol: o.symbol,
          level: o.level,
          flame: W.dream.flames[o.level] ?? '',
          reasons: o.reasons,
          price: o.price,
          free: o.free,
          band: band ? `${Math.round(band.min * 100)}–${Math.round(band.max * 100)}%` : '',
          against: o.reasons.some((r) => r.includes('ขัดกับนิสัย')),
          ok: a.ok,
          ...(a.ok ? {} : { reason: a.reason }),
        };
      })
    : [];
  const allies = life
    ? crisesWaiting(ctx).map(({ tie }) => {
        const a = ask(game, data, 'dream.send', { ally: tie.id });
        return { id: tie.id, name: tie.name, line: tie.line, text: a.ok ? str(a.preview.text) : '', ok: a.ok, ...(a.ok ? {} : { reason: a.reason }), price: a.ok ? num(a.preview.faith) : 0 };
      })
    : [];
  const entries = game.state.log.filter((e) => e.sys === 'god' && e.kind === 'dream' && e.data.outcome !== undefined).slice(-6);
  const said = new Map(textLines(data, entries, 0).map((l) => [l.n, l.text]));
  return {
    alive: !!life,
    doors,
    allies,
    waiting: life ? dreamsOf(ctx).map((d) => ({ symbol: d.symbol, level: d.level, flame: W.dream.flames[d.level] ?? '' })) : [],
    results: entries.map((e) => ({ outcome: str(e.data.outcome), word: W.dream.outcomes[str(e.data.outcome)] ?? str(e.data.outcome), text: said.get(e.n) ?? '', symbol: str(e.data.symbol) })),
    heart: life?.heart ?? 0,
    burdenAt: pv.burdenAt,
    left: Math.max(0, pv.caps.dream.limit - pv.caps.dream.used),
  };
}

// ---------- the whisper (§5) ----------

export interface WhisperTarget {
  id: string;
  name: string;
  group: string;
  /** The ally is in a crisis now (the character has not answered it yet). */
  crisis?: boolean;
  /** The name without the mark of a crisis. */
  plain?: string;
}

export interface WhisperHint {
  hint: string;
  glyph: string;
  effect: string;
  price: number;
  needs: 'place' | 'npc' | null;
  level: string;
  ok: boolean;
  reason?: string;
  targets: WhisperTarget[];
}

export interface WhisperView {
  alive: boolean;
  /** The allies in a crisis now (the whisper of help is for them). */
  crises: { id: string; name: string; line: string; text: string }[];
  hints: WhisperHint[];
  active: { hint: string; target: string }[];
  left: number;
}

export function whisperTargets(game: Game, data: GameData, needs: 'place' | 'npc'): WhisperTarget[] {
  const ctx = game.ctx;
  const life = lifeOf(game);
  if (!life) return [];
  if (needs === 'npc') {
    const people = npcsAt(ctx, life.country).map((v) => ({ id: v.id, name: v.name, group: W.whisper.people }));
    const hot = new Set(crisesWaiting(ctx).map((w) => w.tie.id));
    const allies = alliesOf(ctx)
      .map((t): WhisperTarget => ({ id: t.id, name: hot.has(t.id) ? `${W.whisper.crisisMark} ${t.name} · ${W.whisper.inCrisis}` : t.name, group: W.whisper.allies, plain: t.name, ...(hot.has(t.id) ? { crisis: true } : {}) }))
      .sort((a, b) => Number(!!b.crisis) - Number(!!a.crisis));
    return [...allies, ...people];
  }
  const cont = (data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? [];
  const home = continentOf(life.country);
  return [
    { id: life.country, name: countryName(ctx, life.country), group: W.whisper.countries },
    ...countriesOf(ctx, home).filter((c) => c !== life.country).map((c) => ({ id: c, name: countryName(ctx, c), group: W.whisper.countries })),
    ...cont.map((c) => ({ id: c.id, name: c.name, group: W.whisper.continents })),
  ];
}

export function whisperView(game: Game, data: GameData): WhisperView {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const pv = powerView(game);
  const rows = (ctx.data.god?.items as { dreams?: { whispers?: { hint: string; effect: string }[] } } | undefined)?.dreams?.whispers ?? [];
  const hints: WhisperHint[] = life
    ? rows.map((w) => {
        const needs = NEEDS[w.hint] ?? null;
        const targets = needs ? whisperTargets(game, data, needs) : [];
        const probe = needs ? (targets[0] ? { hint: w.hint, target: targets[0].id } : null) : { hint: w.hint };
        const a = probe ? ask(game, data, 'whisper', probe) : null;
        return {
          hint: w.hint,
          glyph: W.icons.hint[w.hint] ?? '·',
          effect: whisperEffect(data, w.effect),
          price: whisperPrice(ctx, w.hint),
          needs,
          level: whisperChance(ctx, w.hint).level,
          ok: !!a?.ok,
          ...(a && !a.ok ? { reason: a.reason } : !a ? { reason: W.whisper.pickTarget } : {}),
          targets,
        };
      })
    : hintsOf(ctx).map((h) => ({ hint: h, glyph: W.icons.hint[h] ?? '·', effect: '', price: 0, needs: NEEDS[h] ?? null, level: '', ok: false, reason: W.noLife, targets: [] }));
  return {
    alive: !!life,
    crises: life ? crisesWaiting(ctx).map(({ tie, crisis }) => ({ id: tie.id, name: tie.name, line: tie.line, text: crisis.text })) : [],
    hints,
    active: life ? activeWhispers(ctx).map((w) => ({ hint: w.hint, target: w.target ? plainName(data, w.target) || w.target : '' })) : [],
    left: Math.max(0, pv.caps.whisper.limit - pv.caps.whisper.used),
  };
}

// ---------- the prayers (§6) ----------

export interface PrayerAnswer {
  key: 'give' | 'strange' | 'deny' | 'punish' | 'silent';
  word: string;
  glyph: string;
  ok: boolean;
  reason?: string;
  cost: string;
  /** The preview below its title line. */
  effect: string[];
  /** The command's word for this answer. */
  arg: string;
}

export interface PrayerCardView {
  n: number;
  name: string;
  by: string;
  yearsLeft: number;
  /** Fraction of the time left (the burning edge of the card). */
  fraction: number;
  silent: boolean;
  options: { index: number; id: string; name: string; tierWord: string }[];
  answers: PrayerAnswer[];
}

export function prayerView(game: Game, data: GameData): { alive: boolean; cards: PrayerCardView[] } {
  const ctx = game.ctx;
  const life = lifeOf(game);
  if (!life) return { alive: false, cards: [] };
  const now = life.hAge * 4 + game.state.clock.quarter;
  const total = num((ctx.data.god?.items as { caps?: { prayerExpiryTicks?: number } } | undefined)?.caps?.prayerExpiryTicks) || 14;
  const cards = cardsOf(ctx).map((c): PrayerCardView => {
    const kind = c.kind;
    const left = Math.max(0, c.exp - now);
    const options = strangeOptions(ctx, c).map((o, i) => ({ index: i, id: o.id, name: o.name, tierWord: TIER_TH[o.tier] ?? o.tier }));
    const answers: PrayerAnswer[] = (['give', 'strange', 'deny', 'punish', 'silent'] as const).map((key) => {
      const arg = { give: 'ให้', strange: 'แปลก', deny: 'ปฏิเสธ', punish: 'ลงโทษ', silent: 'นิ่ง' }[key];
      const args = key === 'strange' ? { id: c.n, answer: arg, option: 0 } : { id: c.n, answer: arg };
      const a = ask(game, data, 'prayer.answer', args);
      const lines = a.ok ? previewLines(data, a.preview, false, 'prayer.answer', envOf(game, data, args)).slice(1) : [];
      return {
        key,
        word: W.prayer.answers[key],
        glyph: W.icons.answer[key],
        ok: a.ok,
        ...(a.ok ? {} : { reason: a.reason }),
        cost: a.ok ? costText(costOf(a.preview)) : '',
        effect: lines,
        arg,
      };
    });
    return {
      n: c.n,
      name: nameOfKind(ctx, kind),
      by: c.npc ? plainName(data, c.npc) || c.npc : '',
      yearsLeft: Math.round((left / 4) * 10) / 10,
      fraction: Math.max(0, Math.min(1, left / total)),
      silent: !!c.silent,
      options,
      answers,
    };
  });
  return { alive: true, cards };
}

// ---------- the miracles (§7) ----------

export type TargetKind = 'country' | 'countries' | 'continent' | 'npc' | 'dragon' | 'none';

export interface MiracleRow {
  id: string;
  name: string;
  tier: string;
  /** 0 create, 1 destroy, 2 dragon, 3 fate (the four groups of the bar). */
  line: 0 | 1 | 2 | 3;
  cost: CostView;
  costWord: string;
  target: TargetKind;
  /** Years the miracle still waits (0 = ready). */
  waitYears: number;
  open: boolean;
  afford: boolean;
  effect: string;
}

export interface TargetOption {
  id: string;
  name: string;
  group: string;
  /** The character stands here. */
  here?: boolean;
  /** A dragon's index (the command takes the number). */
  index?: number;
  note?: string;
}

export interface OmenView {
  n: number;
  id: string;
  name: string;
  where: string;
  left: number;
  total: number;
  fraction: number;
  /** `miracle` or `conjure`: which command takes the cancel. */
  of: 'miracle' | 'conjure';
}

export interface RuinView {
  country: string;
  name: string;
  kind: string;
  year: number;
  popPct: number;
  events: { id: string; name: string; done: boolean; year: number }[];
  cult: string;
  city: string;
  lake: boolean;
  took: string[];
  ended: boolean;
}

export interface FateRow {
  id: string;
  name: string;
  mark: string;
  /** One line of what the event is (the data's own words, scrubbed). */
  about: string;
  /** The multiplier range the event can take (a fall of a dragon is narrower). */
  range: [number, number];
  slow: CostView;
  fast: CostView;
}

/** The multipliers the fate screen offers as steps (the data allows ×0.2 to ×0.9 to slow and ×1.1 to ×3 to speed). */
export const FATE_STEPS = [0.2, 0.5, 0.8, 1.5, 2, 3] as const;

/** The price of bending an event by `mul`, in the line that pays. */
export function fateCostOf(game: Game, mark: string, mul: number): CostView {
  const c = fateCost(game.ctx, mark as never, mul);
  return { faith: num(c.faith), dread: num(c.dread) };
}

export interface MiracleView {
  alive: boolean;
  rows: MiracleRow[];
  omens: OmenView[];
  ruins: RuinView[];
  fate: FateRow[];
  /** The miracle that happened last (its log lines), the content of the event day. */
  day: { name: string; lines: string[] } | null;
}

export function miracleTargets(game: Game, data: GameData, kind: TargetKind): TargetOption[] {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const cont = (data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? [];
  switch (kind) {
    case 'country':
    case 'countries': {
      const home = life?.country;
      return allCountries(ctx).map((c) => ({ id: c, name: countryName(ctx, c), group: cont.find((x) => x.id === continentOf(c))?.name ?? continentOf(c), ...(c === home ? { here: true } : {}) }));
    }
    case 'continent': {
      const home = life ? continentOf(life.country) : '';
      return cont.map((c) => ({ id: c.id, name: c.name, group: W.miracle.continents, ...(c.id === home ? { here: true } : {}) }));
    }
    case 'npc':
      return life ? npcsAt(ctx, life.country).map((v) => ({ id: v.id, name: v.name, group: W.miracle.people })) : [];
    case 'dragon':
      return game.state.world.dragons.map((d, i) => ({ id: String(i), index: i, name: d.id, group: W.miracle.dragons, note: d.alive ? `${Math.round(d.mood)}` : '', ...(d.alive ? {} : { here: false }) })).filter((d, i) => game.state.world.dragons[i].alive);
    default:
      return [];
  }
}

/** The arguments a miracle command takes for the target(s) the player picked (`countries` takes several). */
export function miracleArgs(id: string, kind: TargetKind, target?: TargetOption | TargetOption[]): Record<string, unknown> {
  const list = target === undefined ? [] : Array.isArray(target) ? target : [target];
  const first = list[0];
  if (!first || kind === 'none') return { id };
  switch (kind) {
    case 'country':
      return { id, country: first.id };
    case 'countries':
      return { id, countries: list.map((t) => t.id) };
    case 'continent':
      return { id, continent: first.id };
    case 'npc':
      return { id, npc: first.id };
    case 'dragon':
      return { id, dragon: first.index ?? Number(first.id) };
  }
}

export function ruinViews(game: Game, data: GameData): RuinView[] {
  const ctx = game.ctx;
  return ruinsNow(ctx).map((r) => {
    const ids = Object.keys(r.due);
    return {
      country: r.country,
      name: ruinLabel(ctx, r.country),
      kind: miracleOf(ctx, r.kind)?.name ?? r.kind,
      year: r.year,
      popPct: Math.round(r.pop * 100),
      events: ids.map((id) => ({ id, name: words(game, data, id) || plainName(data, id) || W.miracle.ruinEvent, done: r.done[id] !== undefined, year: r.done[id] ?? r.due[id] })).sort((a, b) => a.year - b.year),
      cult: r.cult ?? '',
      city: r.city ?? '',
      lake: !!r.lake,
      took: r.took.map((c) => countryName(ctx, c)),
      ended: r.ended !== undefined,
    };
  });
}

export function miracleView(game: Game, data: GameData): MiracleView {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const st = game.state;
  const items = ctx.data.god?.items as { miracles?: { list: { id: string; name: string; tier: string; cost: { faith?: number; dread?: number; faithAll?: boolean; faithMin?: number }; wait?: number; immediate?: string }[] } } | undefined;
  const impl = new Set(implementedMiracles());
  const rows: MiracleRow[] = (items?.miracles?.list ?? [])
    .filter((m) => m.id !== 'MR-25')
    .map((m) => {
      const cost: CostView = { faith: m.cost.faithAll ? m.cost.faithMin ?? 0 : m.cost.faith ?? 0, dread: m.cost.dread ?? 0 };
      const wk = st.god.cooldowns[m.id];
      return {
        id: m.id,
        name: m.name,
        tier: m.tier,
        line: lineOfMiracle(m),
        cost,
        costWord: m.cost.faithAll ? `${W.light} ≥ ${m.cost.faithMin ?? 0}` : costText(cost),
        target: MIRACLE_TARGET[m.id] ?? 'none',
        waitYears: wk !== undefined && wk > st.clock.worldYear ? Math.ceil(wk - st.clock.worldYear) : 0,
        open: impl.has(m.id),
        afford: st.god.light >= cost.faith && st.god.dread >= cost.dread,
        effect: m.immediate ? scrub(data, unlink(m.immediate), { keepNumbers: true }) : '',
      };
    });
  const omens: OmenView[] = life
    ? [
        ...actsOf(st).pending.map((p): OmenView => {
          const m = miracleOf(ctx, p.id);
          const total = m ? omenQuarters(m) : p.left;
          const where = str(p.args.country ?? p.args.continent ?? p.args.npc ?? '');
          return { n: p.n, id: p.id, name: m?.name ?? p.id, where: where ? countryOrContinentName(game, data, where) : '', left: p.left, total, fraction: total ? p.left / total : 0, of: 'miracle' };
        }),
        ...viewConj(st).pending.map((p): OmenView => ({ n: p.n, id: p.mix, name: p.name, where: '', left: p.left, total: p.quarters, fraction: p.quarters ? p.left / p.quarters : 0, of: 'conjure' })),
      ]
    : [];
  const fateCfg = (ctx.data.god?.items as { miracles?: { fate?: { dragonFloor: number; dragonCap: number } } } | undefined)?.miracles?.fate;
  const events = (data['world-events']?.items as { events?: { id: string; whatText?: string }[] } | undefined)?.events ?? [];
  const fate: FateRow[] = life
    ? fateTargets(ctx).map((t) => {
        const about = scrub(data, events.find((e) => e.id === t.id)?.whatText ?? '');
        return {
          id: t.id,
          name: t.name,
          mark: t.mark,
          about: about.length > 120 ? `${about.slice(0, 118).trim()}…` : about,
          range: t.dragon !== undefined && fateCfg ? [fateCfg.dragonFloor, fateCfg.dragonCap] : [0.2, 3],
          slow: { faith: num(fateCost(ctx, t.mark, 0.5).faith), dread: 0 },
          fast: { faith: 0, dread: num(fateCost(ctx, t.mark, 2).dread) },
        };
      })
    : [];
  const last = [...st.log].reverse().find((e) => e.sys === 'god' && e.kind === 'miracle');
  return {
    alive: !!life,
    rows,
    omens,
    ruins: ruinViews(game, data),
    fate,
    day: last ? { name: miracleOf(ctx, str(last.id))?.name ?? '', lines: textLines(data, [last], 0).map((l) => l.text) } : null,
  };
}

function countryOrContinentName(game: Game, data: GameData, id: string): string {
  if (id.length === 2) return ((data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? []).find((c) => c.id === id)?.name ?? id;
  return countryName(game.ctx, id);
}

// ---------- the conjuring (§9) ----------

export interface CircleCell {
  id: string;
  name: string;
  open: boolean;
  glyph: string;
  color?: string;
}

export interface ConjureView {
  alive: boolean;
  verbs: CircleCell[];
  cores: CircleCell[];
  scales: (CircleCell & { base: number; target: 'npc' | 'country' | 'continent' })[];
  quota: { used: number; limit: number };
  points: number;
  omens: OmenView[];
}

export function conjureView(game: Game): ConjureView {
  const ctx = game.ctx;
  const life = lifeOf(game);
  const rows = ctx.data.god?.items as { conjure?: { verbs: { id: string; name: string }[]; cores: { id: string; name: string }[]; scales: { id: string; name: string; base: number }[]; caps: { perLife: number } } } | undefined;
  const c = rows?.conjure;
  const open = unlocked(ctx);
  const mine = viewConj(game.state);
  const used = life && mine.life.key === `${life.id}/${life.birthYear}` ? mine.life.used : 0;
  return {
    alive: !!life,
    verbs: (c?.verbs ?? []).map((v) => ({ id: v.id, name: v.name, open: open.verbs.has(v.id), glyph: W.icons.verb[v.id] ?? '·' })),
    cores: (c?.cores ?? []).map((v) => ({ id: v.id, name: v.name, open: open.cores.has(v.id), glyph: W.icons.core[v.id] ?? '·', color: CORE_COLOR[v.id] })),
    scales: (c?.scales ?? []).map((v) => ({ id: v.id, name: v.name, open: true, glyph: '○', base: v.base, target: W.conjure.scaleTarget[v.id] ?? 'country' })),
    quota: { used, limit: c?.caps.perLife ?? 3 },
    points: open.points,
    omens: life ? viewConj(game.state).pending.map((p) => ({ n: p.n, id: p.mix, name: p.name, where: '', left: p.left, total: p.quarters, fraction: p.quarters ? p.left / p.quarters : 0, of: 'conjure' as const })) : [],
  };
}

/** The structured preview of a conjuring (the circle's side panel); undefined fields are left out. */
export interface ConjurePreview {
  ok: boolean;
  reason?: string;
  name: string;
  result: string;
  expected: string;
  effects: string[];
  reaction: { say: string; text: string } | null;
  cost: CostView;
  priceNote: string;
  shadow: string;
  omen: string;
  quota: { used: number; limit: number } | null;
  seal: string;
  listed: string;
  /** All the lines, as the tools say them. */
  lines: string[];
}

export function conjurePreview(game: Game, data: GameData, args: Record<string, unknown>): ConjurePreview {
  const empty: ConjurePreview = { ok: false, name: '', result: '', expected: '', effects: [], reaction: null, cost: { faith: 0, dread: 0 }, priceNote: '', shadow: '', omen: '', quota: null, seal: '', listed: '', lines: [] };
  const r = ask(game, data, 'conjure', args);
  if (!r.ok) return { ...empty, reason: r.reason };
  const p = r.preview;
  const w = (t: string): string => words(game, data, t);
  const lines = previewLines(data, p, false, 'conjure', envOf(game, data, args)).map(w).filter(Boolean);
  const q = rec(p.quota);
  const sh = num(rec(p.chance).shadow);
  const seal = rec(p.seal);
  const reaction = rec(p.reaction);
  return {
    ok: true,
    name: w(str(p.name)),
    result: w(str(p.result)),
    expected: p.expected ? w(scrub(data, str(p.expected), { keepNumbers: true })) : '',
    effects: (Array.isArray(p.effects) ? p.effects : []).map((e) => w(scrub(data, str(e), { keepNumbers: true }))),
    reaction: p.reaction ? { say: w(str(reaction.say)), text: w(scrub(data, str(reaction.text), { keepNumbers: true })) } : null,
    cost: costOf(p),
    priceNote: num(p.priceMul) > 1 ? `${W.conjure.base} ${num(p.priceBase)} ×${num(p.priceMul)} — ${W.conjure.priceUp[str(p.priceWhy)] ?? ''}` : '',
    shadow: sh >= 1 ? W.conjure.shadowSure : sh > 0 ? `${W.conjure.shadow} ${Math.round(sh * 100)}%` : W.conjure.noShadow,
    omen: num(p.omen) ? `${w(str(p.omenLine))} — ${W.miracle.omenLeft} ${num(p.omen)} ${W.seasons}` : '',
    quota: q.limit !== undefined ? { used: num(q.used), limit: num(q.limit) } : null,
    seal: seal.note ? w(str(seal.note)) : '',
    listed: p.listed ? w(str(p.listed)) : '',
    lines,
  };
}

/** The arguments of a conjuring for the picks of the circle (ids), with the target in the key the scale reads. */
export function conjureArgs(verb: string, core: string, scale: string, target?: string): Record<string, unknown> {
  const kind = W.conjure.scaleTarget[scale] ?? 'country';
  return { verb, core, scale, ...(target ? { [kind]: target } : {}) };
}

/** The targets of a conjuring by size (the same lists as the whisper and the miracle). */
export function conjureTargets(game: Game, data: GameData, scale: string): TargetOption[] {
  const kind = W.conjure.scaleTarget[scale] ?? 'country';
  return miracleTargets(game, data, kind === 'npc' ? 'npc' : kind === 'continent' ? 'continent' : 'country');
}

/** How many mixes the circle holds (a number for the screen to say). */
export const mixCount = (game: Game): number => allMixes(game.ctx).length;

// ---------- the chronicle of the hand (§8) ----------

export interface ChronicleRow {
  year: number;
  /** The year as the world writes it (ศ.ม. 10,428). */
  yearWord: string;
  /** The age of the character then (when there was one). */
  age: number | null;
  kind: string;
  kindWord: string;
  /** The line the row is drawn in: `faith` (gold), `dread` (blood) or `fate` (silver). */
  line: 'faith' | 'dread' | 'fate';
  text: string;
  /** Rows of what followed (the events of a ruin). */
  after: { text: string; done: boolean }[];
}

export interface ChronicleView {
  epithets: string[];
  rows: ChronicleRow[];
}

const DREAD_KINDS = new Set(['prayer.punish']);

/** A string that is a code of the data (an id, a `kind:value`, an effect word like `hp+10`), not a word a player reads. */
const looksLikeCode = (t: string): boolean => /^[A-Za-z]{1,6}[:_-]?[\w-]*\d|^[a-z_]+$|^[a-z]+[:+-]/i.test(t.trim()) && !/[ก-๙]/.test(t);

/** The name of a person, an ally, a place or a continent the chronicle points at; empty when the data has no name for it. */
function whereName(game: Game, data: GameData, ref: string): string {
  const id = ref.replace(/^npc:/, '');
  if (!id) return '';
  if (id.length === 2) return countryOrContinentName(game, data, id);
  const ally = alliesOf(game.ctx).find((t) => t.id === id || t.npc === id);
  const t = ally?.name ?? plainName(data, id) ?? '';
  if (t && !looksLikeCode(t)) return t;
  const slot = targetName(game.ctx, id);
  if (slot && !looksLikeCode(slot)) return slot;
  const place = countryName(game.ctx, id);
  return place && !looksLikeCode(place) ? place : '';
}

/** What a row of the chronicle is about, in words: a miracle by its name, a conjuring by its three parts, a prayer by its kind, a chest card by its name. */
function chronicleName(game: Game, data: GameData, kind: string, id: string): string {
  const ctx = game.ctx;
  if (kind.startsWith('miracle')) return miracleOf(ctx, id)?.name ?? '';
  if (kind.startsWith('conjure')) {
    const [v, c, sc] = id.split('.');
    return v && c && sc ? `${verbName(ctx, v)} ${coreName(ctx, c)} ${scaleName(ctx, sc)}` : '';
  }
  if (kind.startsWith('prayer')) return nameOfKind(ctx, id);
  if (kind === 'whisper') return id;
  if (kind === 'dream') {
    if (id.startsWith('ally:')) {
      const ally = alliesOf(ctx).find((t) => t.id === id.slice(5));
      return ally ? `${W.chronicle.dreamTo} ${ally.name}` : W.chronicle.dreamAlly;
    }
    const n = plainName(data, id);
    return n && !looksLikeCode(n) ? n : '';
  }
  if (kind === 'chest.pick') return plainName(data, id);
  return '';
}

/** The result field of a row in words (the core writes ids, levels and effect words there for the tools). */
function chronicleResult(game: Game, data: GameData, kind: string, result: string | undefined): string {
  if (!result) return '';
  if (W.chronicle.results[result]) return W.chronicle.results[result];
  if (kind === 'dream') {
    // `sent:<heart>` (sent, waits for the crossroads) · `<heart>:<outcome>` (the outcome at the crossroads) · `faded`
    const [a, b] = result.split(':');
    if (a === 'sent') return `${W.chronicle.sent} (${W.dream.heart} ${b})`;
    const word = W.dream.outcomes[b] ?? W.chronicle.results[b] ?? '';
    return word ? `${word} (${W.dream.heart} ${a})` : '';
  }
  if (kind === 'prayer.give' || kind === 'prayer.strange' || kind === 'prayer.punish') {
    const gift = plainName(data, result);
    if (gift && !looksLikeCode(gift)) return gift;
    return fxPhrases(data, result).join(' · ');
  }
  if (kind === 'chest.pick' || kind === 'chest.skip') return '';
  return looksLikeCode(result) ? '' : result;
}

export function chronicleView(game: Game, data: GameData): ChronicleView {
  const ctx = game.ctx;
  const st = game.state;
  const ruins = ruinViews(game, data);
  const rows = st.god.chronicle.map((c): ChronicleRow => {
    const kindWord = W.chronicle.kinds[c.kind] ?? c.kind;
    const row = ((ctx.data.god?.items as { miracles?: { list: { id: string; cost: { dread?: number; faith?: number } }[] } } | undefined)?.miracles?.list ?? []).find((m) => m.id === c.id);
    const line: ChronicleRow['line'] = c.id === 'MR-25' ? 'fate' : DREAD_KINDS.has(c.kind) ? 'dread' : row && row.cost.dread && !row.cost.faith ? 'dread' : 'faith';
    const name = chronicleName(game, data, c.kind, c.id);
    // only the acts that aim at something name a target (the chest and the dream write the id of the life there)
    const aims = /^(miracle|conjure|whisper|prayer)/.test(c.kind);
    const where = aims && c.target ? whereName(game, data, c.target) : '';
    const result = chronicleResult(game, data, c.kind, c.result);
    const ruin = c.kind === 'miracle' && c.target ? ruins.find((r) => r.country === c.target) : undefined;
    return {
      year: c.worldYear,
      yearWord: `${W.chronicle.era} ${calendarYear(c.worldYear).toLocaleString('en-US')}`,
      age: c.hAge ?? null,
      kind: c.kind,
      kindWord,
      line,
      text: [name && name !== '-' ? name : '', where, result].filter(Boolean).join(' · ') || kindWord,
      after: ruin ? ruin.events.filter((e) => e.done).map((e) => ({ text: e.name, done: true })) : [],
    };
  });
  const life = lifeOf(game);
  let epithets: string[] = [];
  if (life) {
    try {
      epithets = titlesOf(ctx, life);
    } catch {
      epithets = [];
    }
  }
  return { epithets, rows };
}

// ---------- what a small or middle miracle did, for the scene area (20-god-ui.md §7.3) ----------

/** How long after its day (world years) the line of a small or middle miracle stays on the scene area: about a season. */
export const EFFECT_LINE_YEARS = 0.3;

export interface EffectLine {
  name: string;
  where: string;
  /** What fell, in the words of the data. */
  text: string;
  line: 'faith' | 'dread';
  /** 1 on the day, 0 when the line is gone. */
  fresh: number;
}

/**
 * The line the scene area shows when a small or middle miracle fell and no scene (script) is playing for it: the miracle, where, and what it did.
 * Null when there is none lately. The watch screen decides when "no script" is true and mounts `<GodEffectLine />`.
 */
export function effectLine(game: Game, data: GameData): EffectLine | null {
  const st = game.state;
  const list = (game.ctx.data.god?.items as { miracles?: { list: { id: string; name: string; tier: string; immediate?: string; cost: { faith?: number; dread?: number } }[] } } | undefined)?.miracles?.list ?? [];
  for (let i = st.god.chronicle.length - 1; i >= 0; i--) {
    const c = st.god.chronicle[i];
    if (c.kind !== 'miracle') continue;
    const age = st.clock.worldYear - c.worldYear;
    if (age >= EFFECT_LINE_YEARS) return null;
    const m = list.find((x) => x.id === c.id);
    if (!m || (m.tier !== 'เล็ก' && m.tier !== 'กลาง')) continue;
    const text = c.result && !looksLikeCode(c.result) ? words(game, data, c.result) : m.immediate ? scrub(data, unlink(m.immediate), { keepNumbers: true }) : '';
    return { name: m.name, where: c.target ? whereName(game, data, c.target) : '', text, line: m.cost.dread && !m.cost.faith ? 'dread' : 'faith', fresh: Math.max(0, 1 - age / EFFECT_LINE_YEARS) };
  }
  return null;
}

// ---------- which god panel kinds exist ----------

export const GOD_KINDS = ['chest', 'dream', 'whisper', 'prayer', 'miracle', 'conjure', 'chronicle'] as const;
export type GodKind = (typeof GOD_KINDS)[number];

/** The title of each panel. */
export const godKindTitle = (k: GodKind): string => (k === 'prayer' ? W.prayer.title : k === 'chest' ? W.chest.title : W.panel[k]);

/** The log entries a result wrote that the player should read (level 1 and up). */
export const logLines = (data: GameData, log: LogEntry[]): string[] => textLines(data, log, 1).map((l) => l.text);
