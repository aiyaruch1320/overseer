// The registry of names the world remembers and the generator of personal names (docs/systems/llm/03-naming.md).
// The game names things itself, from word banks and the seed; no LLM names anything (decision 2026-11-01).
// The registry is `state.world.names`: key = what was named (`char:L1`, a miracle code, an event id), value = the name.
// A name is unique in the world: not in the registry, not a country, continent or roster NPC name.
import { dataOf, type Ctx, type GameData } from '../game';
import type { Rng } from '../rng';
import type { Country, NpcRow } from '../data/types-npcs';
import type { NamesData } from '../data/types-text';
import { LAND_TAIL_CHANCE, LAND_TAILS, MAX_NAME, NAME_TRIES, VOICES, VOICE_OF } from './tuning';

const reservedCache = new WeakMap<GameData, Set<string>>();

/** Names that exist in the documents and so can never be given to something new. */
function reserved(ctx: Ctx): Set<string> {
  const hit = reservedCache.get(ctx.data);
  if (hit) return hit;
  const set = new Set<string>();
  if (ctx.data.npcs) for (const n of (dataOf<{ npcs: NpcRow[] }>(ctx, 'npcs')).npcs) set.add(n.name);
  if (ctx.data.countries) for (const c of dataOf<Country[]>(ctx, 'countries')) set.add(c.name);
  reservedCache.set(ctx.data, set);
  return set;
}

export function nameTaken(ctx: Ctx, name: string): boolean {
  if (reserved(ctx).has(name)) return true;
  for (const v of Object.values(ctx.state.world.names)) if (v === name) return true;
  return false;
}

/**
 * Puts a name in the registry under `key`. If the name is taken by something else, the first free `alt()` is used;
 * after `NAME_TRIES` the name gets a number. Registering the same key again returns the name already there.
 */
export function registerName(ctx: Ctx, key: string, name: string, alt?: () => string): string {
  const names = ctx.state.world.names;
  if (names[key] !== undefined) return names[key];
  let n = name;
  for (let i = 0; nameTaken(ctx, n) && i < NAME_TRIES; i++) n = alt ? alt() : n;
  for (let k = 2; nameTaken(ctx, n); k++) n = `${name}${k}`;
  names[key] = n;
  return n;
}

export function nameOf(ctx: Ctx, key: string): string | undefined {
  return ctx.state.world.names[key];
}

// ---------- personal names ----------

export interface PersonSpec {
  /** Story prefix of the people (`hu` `el` ...). */
  people: string;
  gender: 'm' | 'f' | 'n';
  /** Continent id for the tail of the land. */
  continent?: string;
}

/** One personal name from the voice of the people: head, a middle chunk now and then, and a tail by gender or land. */
export function personName(rng: Rng, spec: PersonSpec): string {
  const voice = VOICES[VOICE_OF[spec.people] ?? 'city'];
  let out = '';
  for (let tries = 0; tries < 20; tries++) {
    const land = spec.continent ? LAND_TAILS[spec.continent] : undefined;
    const tails = spec.gender === 'f' ? voice.f : spec.gender === 'n' ? [...voice.m, ...voice.f] : voice.m;
    const tail = land && rng.chance(LAND_TAIL_CHANCE) ? rng.pick(land) : rng.pick(tails);
    out = rng.pick(voice.heads) + (rng.chance(0.55) ? rng.pick(voice.mids) : '') + tail;
    if ([...out].length <= MAX_NAME && [...out].length >= 3) return out;
  }
  return out.slice(0, MAX_NAME);
}

/** Names the main character: unique in the world, from the `names` seed stream, written to the registry as `char:<life id>`. */
export function nameCharacter(ctx: Ctx, life: { id: string; race: string; gender: 'm' | 'f' | 'n'; country: string }): string {
  const rng = ctx.rng('names');
  const people = peopleCode(ctx, life.race);
  const continent = life.country.slice(0, 2);
  const make = () => personName(rng, { people, gender: life.gender, continent });
  return registerName(ctx, `char:${life.id}`, make(), make);
}

/** Story prefix of a race id (`human` → `hu`); an id that already is a prefix stays. */
export function peopleCode(ctx: Ctx, race: string): string {
  const races = ctx.data.races ? (dataOf<{ races: { id: string; storyPrefix: string }[] }>(ctx, 'races').races) : [];
  const r = races.find((x) => x.id === race || x.storyPrefix === race);
  return r ? r.storyPrefix : race;
}

// ---------- word banks (names.json) ----------

/** The words of one bank of data/gen/names.json (`2_1.ภาพ.ไฟ.อุ่น สว่าง`, `newcity.revive`). Empty when the bank does not exist. */
export function bankWords(ctx: Ctx, bankId: string): string[] {
  if (!ctx.data.names) return [];
  return dataOf<NamesData>(ctx, 'names').banks.find((b) => b.id === bankId)?.words ?? [];
}

/** A word of a bank that is not in `avoid`, by the `names` stream ("เกมเลือกคำถัดไปตามเมล็ด" when it collides). */
export function pickWord(ctx: Ctx, bankId: string, avoid: string[] = []): string | undefined {
  const free = bankWords(ctx, bankId).filter((w) => !avoid.includes(w));
  return free.length ? ctx.rng('names').pick(free) : undefined;
}
