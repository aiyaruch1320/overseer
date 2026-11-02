// The names the readers print: id → Thai name for everything the data lists, built once per loaded data object.
// Pure: reads `GameData` only. `plain.ts` and `render.ts` use it so that no internal code reaches the player.
import type { GameData } from '../game';

type Choices = { key: string; label: string }[];

export interface RiteLite {
  id: string;
  title: string;
  form: 'outcomes' | 'variants';
  outcomes: { label: string; text: string; pass?: { text: string }; fail?: { text: string } }[];
}

export interface Labels {
  /** id → name for events, nodes, convergence points, local events, countries, continents, NPCs and the rest of the data. */
  name: Map<string, string>;
  /** node id → choice key → label (as the document writes the cell) */
  choice: Map<string, Map<string, string>>;
  /** Names by kind, for the lines that know what kind of thing an id is. */
  kind: Record<'trait' | 'aptitude' | 'blessing' | 'curse' | 'job' | 'skill' | 'enemy' | 'country' | 'sign' | 'meet' | 'race', Map<string, string>>;
  /** Enemies longest name first, to find an enemy named in a free text. */
  enemies: { id: string; name: string }[];
  /** Rite of a node id (`be.t1`). */
  rites: Map<string, RiteLite>;
  /** Tribal line (`be`) → the question of the life and the theme paragraph. */
  lines: Map<string, { name: string; question: string; theme: string }>;
  /** NPC id → name as the roster writes it (without the generation number). */
  npc: Map<string, string>;
}

const cache = new WeakMap<GameData, Labels>();

export function items<T>(data: GameData, file: string): T | undefined {
  return data[file]?.items as T | undefined;
}

type Named = { id?: unknown; name?: unknown };

function listOf(top: unknown): Named[] {
  if (Array.isArray(top)) return top as Named[];
  return [];
}

function fill(map: Map<string, string>, list: Named[] | undefined) {
  for (const x of list ?? []) if (typeof x?.id === 'string' && typeof x?.name === 'string' && !map.has(x.id)) map.set(x.id, x.name);
}

export function labels(data: GameData): Labels {
  const hit = cache.get(data);
  if (hit) return hit;
  const name = new Map<string, string>();
  const choice = new Map<string, Map<string, string>>();
  const put = (list: { id: string; name?: string; title?: string }[] | undefined) => {
    for (const x of list ?? []) name.set(x.id, x.title ?? x.name ?? x.id);
  };
  const we = items<{ events: { id: string; name: string }[]; branch: { id: string; name: string }[]; lastEra: { id: string; name: string }[] }>(data, 'world-events');
  if (we) {
    put(we.events);
    put(we.branch);
    put(we.lastEra);
  }
  const le = items<{ events: { id: string; name: string }[]; generated: { id: string; name: string }[] }>(data, 'local-events');
  if (le) {
    put(le.events);
    put(le.generated);
  }
  const sl = items<{ nodes: { id: string; title: string; choices: Choices }[]; rites?: RiteLite[]; lines?: { id: string; name: string; question?: string; theme?: string }[] }>(data, 'storylines');
  const cv = items<{ points: { id: string; title: string; choices: Choices }[]; fallback?: { id: string; title: string; choices: Choices } }>(data, 'convergence');
  for (const list of [sl?.nodes, cv?.points, cv?.fallback ? [cv.fallback] : undefined]) {
    for (const n of list ?? []) {
      name.set(n.id, n.title);
      choice.set(n.id, new Map(n.choices.map((c) => [c.key, c.label])));
    }
  }
  put(items<{ id: string; name: string }[]>(data, 'countries'));
  put(items<{ continents: { id: string; name: string }[] }>(data, 'continents')?.continents);
  const npcRows = items<{ npcs: { id: string; name: string }[] }>(data, 'npcs')?.npcs;
  put(npcRows);
  const npc = new Map<string, string>((npcRows ?? []).map((n) => [n.id, n.name]));
  // every other generated file that lists things with an id and a name (blessings, curses, jobs, skills, enemies ...): the first name wins
  for (const [file, f] of Object.entries(data)) {
    if (file.startsWith('library.') || file === 'names' || file.startsWith('templates')) continue;
    const top = f.items;
    const lists = Array.isArray(top) ? [top] : top && typeof top === 'object' ? Object.values(top as Record<string, unknown>).filter(Array.isArray) : [];
    for (const list of lists as unknown[][]) {
      for (const x of list) {
        const o = x as { id?: unknown; name?: unknown };
        if (typeof o?.id === 'string' && typeof o?.name === 'string' && !name.has(o.id)) name.set(o.id, o.name);
      }
    }
  }
  const kind: Labels['kind'] = { trait: new Map(), aptitude: new Map(), blessing: new Map(), curse: new Map(), job: new Map(), skill: new Map(), enemy: new Map(), country: new Map(), sign: new Map(), meet: new Map(), race: new Map() };
  fill(kind.trait, items<{ traits: Named[] }>(data, 'traits')?.traits);
  fill(kind.aptitude, listOf(items(data, 'aptitudes')));
  fill(kind.blessing, listOf(items(data, 'blessings')));
  fill(kind.curse, listOf(items(data, 'curses')));
  fill(kind.job, items<{ jobs: Named[] }>(data, 'jobs')?.jobs);
  fill(kind.skill, listOf(items(data, 'skills')));
  fill(kind.enemy, items<{ items: Named[] }>(data, 'enemies')?.items);
  fill(kind.country, listOf(items(data, 'countries')));
  fill(kind.race, items<{ races: Named[] }>(data, 'races')?.races);
  const origin = items<{ birthSigns?: Named[]; meetCauses?: Named[] }>(data, 'origin');
  fill(kind.sign, origin?.birthSigns);
  fill(kind.meet, origin?.meetCauses);
  const enemies = [...kind.enemy].map(([id, n]) => ({ id, name: n })).sort((a, b) => b.name.length - a.name.length);
  const rites = new Map((sl?.rites ?? []).map((r) => [r.id, r]));
  const lines = new Map((sl?.lines ?? []).filter((l) => l.question).map((l) => [l.id, { name: l.name, question: l.question ?? '', theme: l.theme ?? '' }]));
  const out: Labels = { name, choice, kind, enemies, rites, lines, npc };
  cache.set(data, out);
  return out;
}

/** Name of anything with an id the data knows; the id itself when it is unknown (use `knownName` for text the player reads). */
export function nameOfId(data: GameData, id: string | undefined): string {
  if (!id) return '';
  return labels(data).name.get(id) ?? id;
}

/** Name of an id, or undefined when the data does not know it. */
export function knownName(data: GameData, id: string | undefined): string | undefined {
  return id ? labels(data).name.get(id) : undefined;
}
