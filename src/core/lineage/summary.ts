// The summary of the world as data (docs/systems/experience/03-ending-and-collection.md §7 "หน้าสรุปโลก", docs/systems/llm/07-ending-templates.md §9): what
// happened in the world over the lives of the lineage. Not a screen: plain JSON that a screen or the text of the legend reads. The doc shows the page
// when the world reaches an ending scene; the lineage shows it at any time (the same fields), with `ended` null while the world goes on.
import { makeCtx, type GameData } from '../game';
import { collectionView } from '../ending/collection';
import { familyLives, lx } from './state';
import { knownName } from '../text/labels';
import { calendarYear, placeName, raceName } from '../text/pick';
import { family } from '../ending/words';
import { HAND_WORD, LIMIT, dragonName, isHandAct } from '../ending/tuning';
import type { Template } from '../data/types-text';
import type { SlotValues } from '../text/pick';
import type { GameState } from '../types';

export interface WorldSummary {
  v: 1;
  seed: number;
  /** The world year now (the calendar the player reads). */
  year: number;
  ended: { id: string; name: string; year: number } | null;
  /** From the birth of the first life to now. */
  span: { from: number; to: number; years: number };
  era: number;
  /** One line for each life of the lineage. */
  lives: { id: string; generation: number; name: string; race: string; raceName: string; born: number; died?: number; age?: number; cause?: string; ending?: string; origin: string; heir?: string; mark?: string; hand: number; alive: boolean }[];
  dragons: { fallen: { name: string; year: number; seenBy: string[] }[]; standing: string[]; total: number };
  countries: { ruined: { id: string; name: string; year: number; healed: boolean }[] };
  keys: number;
  events: { total: number; top: { id: string; name: string; year: number; mark: string; seenBy: string[] }[] };
  hand: { total: number; byKind: Record<string, number>; byLife: Record<string, number> };
  family: { dynasty: string; generations: number; threads: { open: number; closed: number; legend: number; faded: number }; extinct: boolean; gaps: number };
  collection: { have: number; total: number };
  /** The legend of the world: a paragraph of template sentences (07 §9). The llm layer may replace it. */
  legend: { text: string; source: 'template' | 'llm' };
}

const MARK_RANK: Record<string, number> = { '⭐': 3, '●': 2, '○': 1 };

/** The summary of the world of this save, as of now. Reads only. */
export function worldSummary(state: GameState, data: GameData): WorldSummary {
  const ctx = makeCtx(state, data);
  const x = lx(state);
  const we = data['world-events']?.items as { dragons?: { name: string; title: string; fallEvent: string }[]; events?: { id: string; name: string; mark?: string }[] } | undefined;
  const lives: { id: string; name: string; race: string; from: number; to: number }[] = state.lineage.lives.map((l) => ({ id: l.id, name: l.name, race: l.race, from: l.born, to: l.died }));
  if (state.life && !state.life.dead) lives.push({ id: state.life.id, name: state.life.name, race: state.life.race, from: state.life.birthYear, to: state.clock.worldYear });
  const seen = (year: number) => lives.filter((l) => year >= l.from && year <= l.to).map((l) => l.id);

  const fallen = (we?.dragons ?? [])
    .map((d) => ({ name: dragonName(d), year: state.world.happened[d.fallEvent] }))
    .filter((d): d is { name: string; year: number } => d.year !== undefined)
    .sort((a, b) => a.year - b.year)
    .map((d) => ({ name: d.name, year: calendarYear(d.year), seenBy: seen(d.year) }));
  const standing = (we?.dragons ?? []).filter((d) => state.world.happened[d.fallEvent] === undefined).map((d) => d.name);

  const events = Object.entries(state.world.happened)
    .map(([id, year]) => ({ id, year, ev: we?.events?.find((e) => e.id === id) }))
    .filter((e) => e.ev?.mark)
    .map((e) => ({ id: e.id, name: knownName(data, e.id) ?? e.ev!.name, year: e.year, mark: e.ev!.mark!, seenBy: seen(e.year) }));
  const top = [...events]
    .sort((a, b) => (MARK_RANK[b.mark] ?? 0) - (MARK_RANK[a.mark] ?? 0) || b.seenBy.length - a.seenBy.length || a.year - b.year || a.id.localeCompare(b.id))
    .slice(0, 5)
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

  const mine = state.god.chronicle;
  // the same count as the card of a life and the block of the power used (`isHandAct`): the summary of the world is the sum of the hands of the lives
  const byKind: Record<string, number> = {};
  const byLife: Record<string, number> = {};
  for (const c of mine.filter(isHandAct)) {
    byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
    // the hand counts from the takeover of a life (an heir was in the world before the player had it)
    const owner = lives.find((l) => c.worldYear >= (x.recs.find((r) => r.id === l.id)?.startYear ?? l.from) && c.worldYear <= l.to);
    if (owner) byLife[owner.id] = (byLife[owner.id] ?? 0) + 1;
  }
  // a life that has its card keeps the count the card made at its death (the two pages of one life must agree)
  for (const l of lives) if (x.cards[l.id]) byLife[l.id] = x.cards[l.id].hand.total;
  const handTotal = Object.values(byKind).reduce((a, b) => a + b, 0);

  const ended = state.world.ended ? { id: state.world.ended.id, name: knownName(data, state.world.ended.id) ?? state.world.ended.id, year: calendarYear(state.world.ended.year) } : null;
  const first = lives[0]?.from ?? 0;
  const view = collectionView(state, data);

  const out: WorldSummary = {
    v: 1,
    seed: state.seed,
    year: calendarYear(state.clock.worldYear),
    ended,
    span: { from: calendarYear(first), to: calendarYear(state.clock.worldYear), years: Math.max(0, Math.round(state.clock.worldYear - first)) },
    era: state.world.era,
    lives: lives.map((l, i) => {
      const rec = x.recs.find((r) => r.id === l.id);
      const card = x.cards[l.id];
      const alive = !!state.life && !state.life.dead && state.life.id === l.id;
      return {
        id: l.id,
        generation: rec?.generation ?? i + 1,
        name: l.name,
        race: l.race,
        raceName: raceName(ctx, l.race),
        born: calendarYear(l.from),
        ...(alive ? {} : { died: calendarYear(l.to), age: rec?.age, cause: rec?.cause }),
        ...(rec?.ending ? { ending: rec.ending } : {}),
        origin: rec?.origin ?? 'first',
        ...(rec?.heir ? { heir: rec.heir } : {}),
        ...(card ? { mark: card.mark.level } : {}),
        hand: byLife[l.id] ?? 0,
        alive,
      };
    }),
    dragons: { fallen, standing, total: we?.dragons?.length ?? 15 },
    countries: { ruined: state.world.ruins.map((r) => ({ id: r.country, name: placeName(ctx, r.country) ?? r.country, year: calendarYear(r.year), healed: !!r.healed })) },
    keys: state.world.lastEraKeys,
    events: { total: events.length, top: top.map((e) => ({ ...e, year: calendarYear(e.year) })) },
    hand: { total: handTotal, byKind, byLife },
    family: {
      dynasty: x.dynasty,
      // the family only: a newcomer in the old world is not a generation of it (05 §4); a family that ended counts to its last
      generations: x.extinct?.generation ?? familyLives(state),
      threads: { open: x.threads.filter((t) => t.state === 'open').length, closed: x.threads.filter((t) => t.state === 'closed').length, legend: x.threads.filter((t) => t.state === 'legend').length, faded: x.threads.filter((t) => t.state === 'faded').length },
      extinct: !!x.extinct,
      gaps: x.gaps.reduce((n, g) => n + g.years, 0),
    },
    collection: { have: view.have, total: view.total },
    legend: { text: legendText(ctx, state, fallen, standing, events.length, top, byKind), source: 'template' },
  };
  return out;
}

/** The legend of the world from the sentences of 07 §9.2 and the frame of a world that has not ended. Deterministic: the choice is a hash, nothing is marked used. */
function legendText(ctx: ReturnType<typeof makeCtx>, state: GameState, fallen: { name: string; year: number }[], standing: string[], eventN: number, top: { name: string; year: number; seenBy: string[] }[], byKind: Record<string, number>): string {
  const handTotal = Object.values(byKind).reduce((a, b) => a + b, 0);
  const sentences: string[] = [];
  const yearNow = calendarYear(state.clock.worldYear);
  const put = (famName: string, keys: Record<string, string>, slots: SlotValues, key: string, ok: (t: Template) => boolean = () => true) => {
    const cands = family(ctx, famName).filter((t) => Object.entries(keys).every(([k, v]) => t.keys[k] === v) && ok(t));
    // read-only: choose by hash without writing the memory of used templates
    const filled = cands.map((t) => ({ t, text: t.text.replace(/\{([^{}]+)\}/g, (_m, k: string) => String(slots[k.trim()] ?? '\u0000')) })).filter((c) => !c.text.includes('\u0000') && [...c.text].length <= LIMIT.sentence);
    if (!filled.length) return;
    let h = 0;
    for (const ch of `${state.seed}|${key}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    sentences.push(filled[h % filled.length].text);
  };
  const ended = state.world.ended;
  const frame = ended ? undefined : 'ไม่มีฉากจบ';
  if (frame) put('ending_frame', { ฉากจบ: frame, ส่วน: 'เปิด' }, { year: yearNow, era_last: state.world.era, span_years: Math.round(state.clock.worldYear - (state.lineage.lives[0]?.born ?? 0)) }, 'open');
  if (fallen.length) put('world_fact', { ชนิด: 'มังกรที่ล้ม' }, { dragon_n: fallen.length, dragon_first: fallen[0].name, year_first: fallen[0].year, dragon_last: fallen[fallen.length - 1].name, dragon_left_list: standing.slice(0, 4).join(' ') }, 'dragons');
  const lead = top.find((e) => e.seenBy.length) ?? top[0];
  if (lead) put('world_fact', { ชนิด: 'เหตุการณ์ใหญ่' }, { event_n: eventN, events_list: top.map((e) => e.name).join(' · '), event_1: lead.name, year_1: calendarYear(lead.year), seen_1: lead.seenBy.length ? 'อยู่ในเวลานั้น' : 'ไม่ได้อยู่ในเวลานั้น', seen_n: top.filter((e) => e.seenBy.length).length }, 'events');
  if (state.world.ruins.length) put('world_fact', { ชนิด: 'ประเทศ' }, { ruin_n: state.world.ruins.length, new_n: 0, swap_n: 0, country_first: placeName(ctx, state.world.ruins[0].country) ?? '', country_last: placeName(ctx, state.world.ruins[state.world.ruins.length - 1].country) ?? '' }, 'countries');
  // the frame already tells the years that passed: the era sentence that tells them again (variant 2) is left out
  put('world_fact', { ชนิด: 'ยุค', แบบ: frame ? '1' : '2' }, { era_n: state.world.era, era_last: state.world.era, span_years: Math.round(state.clock.worldYear - (state.lineage.lives[0]?.born ?? 0)), era_years: Math.round(state.clock.worldYear) }, 'era');
  // the hand of the god: with no hand, the line that says so; else the sentences that name the most used kind (07 §9.2)
  const topKind = Object.entries(byKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (handTotal === 0) put('world_fact', { ชนิด: 'พระหัตถ์ของโลก', แบบ: '3' }, {}, 'hand');
  // a world that has a hand never says it has none (the sentence of "ศูนย์ครั้ง" asks for no act at all: review M4 G4)
  else put('world_fact', { ชนิด: 'พระหัตถ์ของโลก' }, { god_total: handTotal, god_top: HAND_WORD[topKind] ?? topKind, mr_n: (byKind.miracle ?? 0) + (byKind.conjure ?? 0), dream_n: byKind.dream ?? 0 }, 'hand', (t) => t.when !== 'ศูนย์ครั้ง');
  return sentences.slice(0, 7).join(' ');
}
