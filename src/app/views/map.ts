// What the map shows of a game, as plain data (code-plan §8.1 rule 2): pure functions over (data, state), so the storybook can feed them a sample
// state. Nothing here draws. The map component reads a `MapModel`: the form of each changed continent, the countries that fell or lie in ruin, the
// fifteen dragons and where they sleep, the omens that wait for their day, and the place of the character.
import type { Country } from '../../core/data/types-npcs';
import type { GameData } from '../../core/game';
import type { Miracle } from '../../core/data/types-god';
import { viewActs } from '../../core/god/acts/state';
import { viewRuin } from '../../core/god/ruin/state';
import type { DragonDef } from '../../core/data/types-events';
import type { GameState } from '../../core/types';
import type { Looks } from '../../map/provider';
import { CONT_IDS, type ContId } from '../../map/geo';
import { DRAGON_BEDS, DRAGON_COLOR, EFFECT_MARK_YEARS, FATES, OMEN_COLOR, type FateId } from '../../map/tuning';

export interface FateMark {
  continent: ContId | '*';
  fate: FateId;
  /** The name the map writes for the changed land. */
  name: string;
  event: string;
  /** World year it happened. */
  year: number;
}

export interface RuinMark {
  country: string;
  /** The original name of the country (struck through on the map). */
  name: string;
  /** "ซากซอร์เนบ" as the ruin names itself, when it does. */
  label: string;
  kind: 'MR-17' | 'MR-18' | 'fallen';
  year: number;
  healed: boolean;
  /** The pit became a lake (RU-08). */
  lake: boolean;
  /** The new name of the city (RU-07), if the ruin was built again. */
  city?: string;
}

export interface DragonMark {
  index: number;
  name: string;
  title: string;
  alive: boolean;
  wounded: boolean;
  /** Mood 0..100. */
  mood: number;
  /** Where it sleeps (a country id; the first of the places the lore gives). */
  country: string;
  places: string[];
  color: string;
}

export interface OmenMark {
  n: number;
  /** The miracle (MR-xx). */
  id: string;
  name: string;
  country?: string;
  continent?: string;
  /** Beats until the day. */
  left: number;
  color: string;
}

/** The mark a small or middle miracle leaves on the place it fell on, for a year after its day. */
export interface EffectMark {
  /** The miracle (MR-xx). */
  id: string;
  name: string;
  country?: string;
  continent?: string;
  color: string;
  /** 1 on the day, 0 when the mark is gone. */
  fresh: number;
}

export interface CharacterMark {
  name: string;
  country: string;
  countryName: string;
  /** The capital of the country: where the mark stands. */
  city: string;
  dead: boolean;
}

export interface LandMark {
  id: string;
  name: string;
  beside: string;
  continent: string;
  founded: boolean;
}

export interface MapModel {
  looks: Looks;
  fates: FateMark[];
  /** Countries that fell (the flag `fallen`). */
  fallen: string[];
  /** War, famine, plague and golden age per country, for the small marks. */
  flags: Record<string, string[]>;
  ruins: RuinMark[];
  dragons: DragonMark[];
  omens: OmenMark[];
  /** Small and middle miracles of the last year (a ring on the place they fell on). */
  marks: EffectMark[];
  character: CharacterMark | null;
  lands: LandMark[];
}

const SHOWN_FLAGS = new Set(['war', 'famine', 'plague', 'golden']);
/** How much of its towns a fallen country or a god ruin shows broken. */
export const RUIN_SHARE = { ruin: 0.75, healed: 0.3, fallen: 0.6 };

const countriesOf = (data: GameData): Country[] => (data.countries?.items as Country[] | undefined) ?? [];

export function mapModel(data: GameData, state: GameState): MapModel {
  const countries = countriesOf(data);
  const nameOf = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
  const w = state.world;

  // the changed continents: the latest event of each continent decides its form
  const fates: FateMark[] = [];
  for (const f of FATES) {
    const year = w.happened[f.event];
    if (year !== undefined) fates.push({ continent: f.continent as ContId | '*', fate: f.id, name: f.name, event: f.event, year });
  }
  const looks: Looks = { fates: {}, flood: false, ruin: {} };
  for (const f of [...fates].sort((a, b) => a.year - b.year)) {
    if (f.continent === '*') looks.flood = true;
    else looks.fates[f.continent] = f.fate;
  }

  const fallen = Object.entries(w.countryFlags).filter(([, fl]) => fl.includes('fallen')).map(([id]) => id);
  const flags: Record<string, string[]> = {};
  for (const [id, fl] of Object.entries(w.countryFlags)) {
    const shown = fl.filter((x) => SHOWN_FLAGS.has(x));
    if (shown.length) flags[id] = shown;
  }

  const rx = viewRuin(state);
  const ruins: RuinMark[] = [];
  for (const r of rx.ruins) {
    ruins.push({ country: r.country, name: nameOf(r.country), label: r.label, kind: r.kind, year: r.year, healed: r.ended !== undefined, lake: !!r.lake, city: r.city });
  }
  // ruins the world list knows without the god's record (a save, a test state)
  for (const r of w.ruins) {
    if (ruins.some((x) => x.country === r.country)) continue;
    ruins.push({ country: r.country, name: nameOf(r.country), label: nameOf(r.country), kind: r.id === 'MR-18' ? 'MR-18' : 'MR-17', year: r.year, healed: !!r.healed, lake: false });
  }
  for (const id of fallen) if (!ruins.some((x) => x.country === id)) ruins.push({ country: id, name: nameOf(id), label: nameOf(id), kind: 'fallen', year: 0, healed: false, lake: false });
  for (const r of ruins) looks.ruin![r.country] = r.healed ? RUIN_SHARE.healed : r.kind === 'fallen' ? RUIN_SHARE.fallen : RUIN_SHARE.ruin;

  const defs = ((data['world-events']?.items as { dragons?: DragonDef[] } | undefined)?.dragons ?? []) as DragonDef[];
  const dragons: DragonMark[] = w.dragons.map((d, i) => {
    const places = DRAGON_BEDS[i] ?? [];
    return {
      index: i,
      name: defs[i]?.name ?? d.id,
      title: defs[i]?.title ?? '',
      alive: d.alive,
      wounded: !!d.wounded,
      mood: d.mood,
      country: places[0] ?? '',
      places,
      color: DRAGON_COLOR[i] ?? '#d8d4cc',
    };
  });

  const miracles = ((data.god?.items as { miracles?: { list?: Miracle[] } } | undefined)?.miracles?.list ?? []) as Miracle[];
  const omens: OmenMark[] = viewActs(state).pending.map((p) => {
    const m = miracles.find((x) => x.id === p.id);
    const line = m?.tier === 'ลิขิต' ? 'fate' : p.paid.dread > 0 && p.paid.faith === 0 ? 'dread' : 'faith';
    return {
      n: p.n,
      id: p.id,
      name: m?.name ?? p.id,
      country: p.args.country !== undefined ? String(p.args.country) : undefined,
      continent: p.args.continent !== undefined ? String(p.args.continent) : undefined,
      left: p.left,
      color: OMEN_COLOR[line],
    };
  });

  const marks: EffectMark[] = [];
  for (const c of state.god.chronicle) {
    if (c.kind !== 'miracle' || !c.target) continue;
    const age = state.clock.worldYear - c.worldYear;
    if (age < 0 || age >= EFFECT_MARK_YEARS) continue;
    const m = miracles.find((x) => x.id === c.id);
    if (!m || (m.tier !== 'เล็ก' && m.tier !== 'กลาง')) continue;
    const line = m.cost.dread && !m.cost.faith ? 'dread' : 'faith';
    const onContinent = c.target.length === 2;
    marks.push({ id: m.id, name: m.name, ...(onContinent ? { continent: c.target } : { country: c.target }), color: OMEN_COLOR[line], fresh: 1 - age / EFFECT_MARK_YEARS });
  }

  const life = state.life;
  const character: CharacterMark | null = life ? { name: life.name, country: life.country, countryName: nameOf(life.country), city: `${life.country}/0`, dead: !!life.dead } : null;

  const lands: LandMark[] = viewRuin(state).lands.map((l) => ({ id: l.id, name: l.name, beside: l.beside, continent: l.continent, founded: l.founded !== undefined }));

  return { looks, fates, fallen, flags, ruins, dragons, omens, marks, character, lands };
}

/** The ids of the continents in the order the map keeps them. */
export const continentIds = (): readonly ContId[] => CONT_IDS;

/** A sample model for the storybook: the state of a game with something done to it (a ruin, a changed continent, an omen). */
export function withSample(model: MapModel, pick: { fate?: FateId; ruin?: string; omen?: { country: string; id: string; name: string }; fallen?: string }): MapModel {
  const m: MapModel = { ...model, looks: { ...model.looks, fates: { ...model.looks.fates }, ruin: { ...(model.looks.ruin ?? {}) } }, fates: [...model.fates], ruins: [...model.ruins], omens: [...model.omens], marks: [...model.marks], fallen: [...model.fallen] };
  if (pick.fate) {
    const f = FATES.find((x) => x.id === pick.fate)!;
    if (f.continent === '*') m.looks.flood = true;
    else m.looks.fates[f.continent as ContId] = f.id;
    m.fates.push({ continent: f.continent as ContId | "*", fate: f.id, name: f.name, event: f.event, year: 0 });
  }
  if (pick.ruin) {
    m.ruins.push({ country: pick.ruin, name: pick.ruin, label: pick.ruin, kind: 'MR-17', year: 0, healed: false, lake: false });
    m.looks.ruin![pick.ruin] = RUIN_SHARE.ruin;
  }
  if (pick.fallen) {
    m.fallen.push(pick.fallen);
    m.looks.ruin![pick.fallen] = RUIN_SHARE.fallen;
  }
  if (pick.omen) m.omens.push({ n: 900, id: pick.omen.id, name: pick.omen.name, country: pick.omen.country, left: 3, color: OMEN_COLOR.dread });
  return m;
}
