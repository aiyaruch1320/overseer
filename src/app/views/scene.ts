// Which scene a log entry shows (code-plan §8.3): a script of data/gen/scenes.json when there is one for it, else the event card. The
// entries mapped are the world events (and the last era), the nodes of the story (the rite of a tribe, its destination, the nodes of
// allies and kin and of the last era), the NPC clashes, the crises and endings of allies, the local events and the day of a miracle.
// The words of a card come from src/core/text (code-plan §8.1 rule 2); the scripts carry the words of the appearance docs.
import type { CardDef, SceneScript, ScenesData } from '../../core/data/types-scenes';
import type { GameData } from '../../core/game';
import { describe, plainName } from '../../core/text';
import { SEASONS } from '../../core/text/tuning';
import type { GameState } from '../../core/types';
import { allLines, lifeStartN } from './watch';
import { mainLook } from '../../art/main-look';
import { DRAGONS } from '../../art/beast/look';
import { npcBeast } from '../../art/npc-beasts';
import { npcLook, raceLook } from '../../art/resolve';
import type { LooksData } from '../../core/data/types-looks';
import type { Country } from '../../core/data/types-npcs';
import type { ScenerySpec, Setting } from '../../art/scenery/types';
import type { Figure, FigureOf } from '../../scene/figures';
import { seedOf } from '../../scene/particles';
import type { SceneryOf } from '../../scene/Stage';
import { mainLookOf, scarredOf, tieLooks } from './looks';
import { items } from '../../core/text/labels';
import type { LogEntry } from '../../core/types';
import { cardFrom, plainCard, type CardModel } from '../../scene/card';
import { resolveScript } from '../../scene/timeline';

/** Where to look for the script of an entry, and which variants to play after it. */
export interface SceneKeys {
  /** Script ids, best first. */
  keys: string[];
  /** Groups of variant keys; the scene plays the first key of each group that its script knows (a rite: the region, then pass or fail). */
  variants: string[][];
}

export type SceneView = { kind: 'script'; script: SceneScript; card: CardModel; entry: LogEntry } | { kind: 'card'; card: CardModel; entry: LogEntry };

/** The standard closings of a clash (15-npc-clash-scenes §2), by the kind of outcome the combat system writes. */
export const STANDARD_CLOSING: Record<string, string> = { talk: 'เจรจา', win_kill: 'ชนะ (ล้ม)', win_spare: 'ชนะ (ไว้ชีวิต)', draw: 'เสมอ', lose: 'แพ้', flee: 'หนี' };

/** What a clash ended as, when the entry does not carry the kind of the outcome row. */
function clashKind(d: LogEntry['data']): string {
  if (typeof d.kind === 'string' && d.kind in STANDARD_CLOSING) return d.kind;
  switch (d.end) {
    case 'lose':
    case 'dead':
      return 'lose';
    case 'flee':
      return 'flee';
    case 'talk':
    case 'tame':
      return 'talk';
    case 'draw':
      return 'draw';
    default:
      return d.killed ? 'win_kill' : 'win_spare';
  }
}

const ENDS_BAD = new Set(['dies', 'betrays', 'split', 'leaves']);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Pure: the ids a log entry can have a script under. `templateOf` finds the template of a generated local event (LC-1xx). */
export function sceneKeys(e: LogEntry, templateOf?: (id: string) => string | undefined): SceneKeys {
  const d = e.data;
  const id = e.id ?? '';
  const keys: string[] = [];
  const variants: string[][] = [];
  if (/^LC-\d+$/.test(id)) {
    keys.push(id);
    const t = templateOf?.(id);
    if (t) keys.push(t);
    return { keys, variants };
  }
  switch (e.sys) {
    case 'world':
      if (e.kind === 'event' || e.kind === 'ending') keys.push(id);
      // the fall of a dragon (`world/dragonFall`, data.dragon = index 0..14): the script `fall.<n>` of appearance/11-world-changes.md §3
      else if (e.kind === 'dragonFall' && typeof d.dragon === 'number') keys.push(`fall.${d.dragon + 1}`);
      break;
    case 'story':
      if (e.kind === 'node') {
        const m = id.match(/^([a-z]+)\.([a-z])(\d+)$/);
        keys.push(id);
        if (m && m[2] === 't' && m[3] === '1' && d.rite) {
          keys.push(`rite.${m[1]}`);
          variants.push([str(d.variant) ?? ''], [str(d.result) ?? '']);
        }
        if (m && m[2] === 'e') keys.push(`dest.${m[1]}`);
      }
      break;
    case 'combat':
      if (e.kind === 'clash') {
        keys.push(id);
        variants.push([str(d.outcome) ?? '', STANDARD_CLOSING[clashKind(d)]]);
      }
      break;
    case 'bonds':
      if (e.kind === 'crisis') keys.push(`ally.${id}.crisis`, ...(str(d.npc) ? [`ally.${d.npc}.crisis`] : []), str(d.code) ?? '');
      else if (e.kind === 'ending' && ENDS_BAD.has(String(d.kind))) keys.push(`ally.${id}.end`, ...(str(d.npc) ? [`ally.${d.npc}.end`] : []));
      break;
    case 'god':
      if (e.kind === 'miracle') keys.push(`mr.${id}`);
      break;
  }
  const nt = str(d.template) ?? str(d.tag);
  if (nt && /^NT-\d+$/.test(nt)) keys.push(nt);
  return { keys: keys.filter(Boolean), variants };
}

interface Index {
  scenes: ScenesData;
  script: Map<string, SceneScript>;
  card: Map<string, CardDef>;
  template: Map<string, string>;
}
const cache = new WeakMap<GameData, Index | null>();

function indexOf(data: GameData): Index | null {
  if (cache.has(data)) return cache.get(data) ?? null;
  const scenes = items<ScenesData>(data, 'scenes');
  let ix: Index | null = null;
  if (scenes) {
    const generated = items<{ generated?: { id: string; template?: string }[] }>(data, 'local-events')?.generated ?? [];
    ix = {
      scenes,
      script: new Map(scenes.scripts.map((s) => [s.id, s])),
      card: new Map(scenes.cards.map((c) => [c.id, c])),
      template: new Map(generated.filter((g) => g.template).map((g) => [g.id, g.template as string])),
    };
  }
  cache.set(data, ix);
  return ix;
}

/** The card of an entry: its card of the data when there is one, else the words and the colour of the system that wrote it. */
export function cardOfEntry(data: GameData, e: LogEntry): CardModel {
  const ix = indexOf(data);
  const body = describe(data, e) ?? '';
  const def = e.id ? ix?.card.get(e.id) : undefined;
  if (def) return cardFrom(def, body);
  const d = e.data;
  const title = str(d.name) ?? str(d.title) ?? e.id ?? e.kind;
  const group = e.id?.match(/^([A-Z]+)-/)?.[1];
  return plainCard(e.id ?? String(e.n), title, body, e.sys, str(d.mark) ?? '', ix?.scenes, group);
}

/** The scene of a log entry: its script (the rest of the scene chosen by the result in the entry) or its card. */
export function sceneFor(data: GameData, e: LogEntry): SceneView {
  const card = cardOfEntry(data, e);
  const ix = indexOf(data);
  if (!ix) return { kind: 'card', card, entry: e };
  const { keys, variants } = sceneKeys(e, (id) => ix.template.get(id));
  for (const key of keys) {
    const script = ix.script.get(key);
    if (!script) continue;
    const std = ix.script.get('std.clash');
    const picked = variants.map((group) => group.find((k) => k && (script.variants?.[k] || std?.variants?.[k])));
    return { kind: 'script', script: resolveScript(script, picked, std), card, entry: e };
  }
  return { kind: 'card', card, entry: e };
}


// ---------- the calm picture between scenes (M5 review round two R7) ----------

/** What the calm picture shows of the life now: the season (the sky), the age (the size of the figure), the place and the latest thing that happened. */
export interface IdleView {
  season: number;
  seasonName: string;
  /** The sky and the ground, by the season. */
  sky: string;
  ground: string;
  glow: string;
  /** The figure's height as a share of the stage: a child is small, a grown person full, an old one a little bowed. */
  figure: { height: number; pose: 'stand' | 'bow'; stage: 'child' | 'young' | 'adult' | 'elder' };
  place: string;
  age: number;
  /** The latest line of the life that is worth telling again, cut short; '' when there is none. */
  latest: string;
  /** The line under the picture. */
  caption: string;
}

/** Sky, ground and glow of the four seasons (the beat of a life year is one season: ฤดูหว่าน ฤดูฝน ฤดูเก็บเกี่ยว ฤดูหนาว). The docs give no colours. */
const IDLE_SKY = [
  { sky: '#1f2a2c', ground: '#142019', glow: '#9ed08a33' },
  { sky: '#1a2232', ground: '#101624', glow: '#6aa0d833' },
  { sky: '#2c2218', ground: '#1f160f', glow: '#e8a64a33' },
  { sky: '#1c2030', ground: '#12141f', glow: '#c8d4ee33' },
] as const;

/** The ages that change the figure (the docs of the character give childhood to 15 and the elder age 55 for humans; other races take the same here, it is a picture). */
const IDLE_AGES = { young: 15, adult: 30, elder: 55 } as const;
const LATEST_MAX = 70;

export function idleView(data: GameData, state: GameState): IdleView {
  const life = state.life;
  const quarter = ((state.clock.quarter % 4) + 4) % 4;
  const age = life ? Math.floor(life.hAge) : 0;
  const stage = age < IDLE_AGES.young ? 'child' : age < IDLE_AGES.adult ? 'young' : age < IDLE_AGES.elder ? 'adult' : 'elder';
  const height = { child: 0.26, young: 0.36, adult: 0.4, elder: 0.38 }[stage];
  const place = life ? plainName(data, life.country) : '';
  const from = lifeStartN(state);
  const last = [...allLines(data, state)].reverse().find((l) => l.entry.n >= from && l.level >= 2 && l.sys !== 'attention');
  const t = last ? last.text.replace(/\s+/g, ' ').trim() : '';
  const latest = [...t].length > LATEST_MAX ? `${[...t].slice(0, LATEST_MAX - 1).join('')}…` : t;
  const c = IDLE_SKY[quarter];
  const caption = `${SEASONS[quarter]} · อายุ ${age}${place ? ` · ${place}` : ''}`;
  return { season: quarter, seasonName: SEASONS[quarter], sky: c.sky, ground: c.ground, glow: c.glow, figure: { height, pose: stage === 'elder' ? 'bow' : 'stand', stage }, place, age, latest, caption };
}


// ---------- who is on the stage and where (M7 ก1) ----------

const looksOf = (data: GameData): LooksData | undefined => items<LooksData>(data, 'looks');

/** The age the child of a rite is drawn at (the script's `เด็ก`: the main character before the rite). */
const RITE_CHILD_AGE = 9;

/** Stages of the people of a crowd, in the order the figures stand (a few children and elders among the grown). */
const CROWD_STAGES = ['adult', 'adult', 'elder', 'teen', 'adult', 'child'] as const;

/** The labels of the scripts for the main character, the other person and the crowd (data/gen/scenes.json: scripts/codegen/groups/scenes.ts). */
const MAIN_LABELS = new Set(['ตัวละคร', 'เด็ก']);
const CROWD_LABELS = new Set(['ผู้คน']);
const OTHER_LABELS = new Set(['อีกคน']);
/** The label of the foe in the standard closings of a clash (`std.clash`). */
const FOE_LABEL = 'คู่ต่อสู้';

/** The people of the NPC table by the name a script gives them (`NF-AZ02-1` names its foe: เรเวน); built once per data. */
const byName = new WeakMap<LooksData, Map<string, string>>();
function npcByName(looks: LooksData, name: string): string | undefined {
  let m = byName.get(looks);
  if (!m) {
    m = new Map();
    for (const [id, row] of Object.entries(looks.npcs)) if (!m.has(row.name)) m.set(row.name, id);
    byName.set(looks, m);
  }
  return m.get(name);
}

/** The NPC a scene is about: the id the entry carries, else the id in the name of a clash script (`NF-AZ02-1`). */
export function npcOfScene(v: SceneView): string | undefined {
  const d = v.entry.data;
  if (str(d.npc)) return str(d.npc);
  if (v.kind === 'script') {
    const m = v.script.id.match(/^NF-(.+)$/);
    if (m) return m[1];
  }
  return undefined;
}

/** The look of one NPC as a figure: a creature as its beast (src/art/npc-beasts.ts), a person by the table of NPCs (a grown one), nothing when the table lacks it. */
function npcFigure(looks: LooksData, id: string): Figure | undefined {
  const beast = npcBeast(id);
  if (beast) return { kind: 'beast', look: beast };
  if (!looks.npcs[id]) return undefined;
  return { kind: 'person', looks: [npcLook(looks, id, { stage: 'adult' })] };
}

/** A dragon the script names (its label is the dragon's name) or the entry points at (`data.dragon`, 0 to 14, when the label says only `มังกร`). */
function dragonFigure(v: SceneView, label: string): Figure | undefined {
  const named = DRAGONS.find((d) => d.name === label);
  if (named) return { kind: 'beast', look: named };
  const i = v.entry.data.dragon;
  if (label === 'มังกร' && typeof i === 'number' && DRAGONS[i]) return { kind: 'beast', look: DRAGONS[i] };
  return undefined;
}

/**
 * Who each actor of a scene is, as the figure the stage draws. The main character is the figure of the life (the child of a rite at the age of nine); the
 * foe of a clash is the NPC of the entry (its beast, or the person of the table); the other person of an ally scene is the ally of the tie; a crowd is
 * people of the life's race; a dragon is its beast; anyone else, and anyone whose look the data lacks, is the silhouette.
 */
export function figuresOf(data: GameData, state: GameState | null | undefined, v: SceneView): FigureOf {
  const looks = looksOf(data);
  const life = state?.life ?? null;
  const cache = new Map<string, Figure>();
  const sil: Figure = { kind: 'silhouette' };
  const make = (id: string, label: string, count: number): Figure => {
    const dragon = dragonFigure(v, label);
    if (dragon) return dragon;
    if (id === 'a' && MAIN_LABELS.has(label) && count === 1) {
      if (!state || !life || !looks) return sil;
      const look = label === 'เด็ก' ? mainLook(life, data, { scarred: scarredOf(state), hAge: RITE_CHILD_AGE }) : mainLookOf(data, state);
      return look ? { kind: 'person', looks: [look] } : sil;
    }
    if (!looks) return sil;
    if (CROWD_LABELS.has(label) || id === 'crowd') {
      const race = life && looks.races[life.race] ? life.race : looks.races.human ? 'human' : '';
      if (!race) return sil;
      const seed = seedOf(v.kind === 'script' ? v.script.id : v.card.id);
      return { kind: 'person', looks: Array.from({ length: Math.max(1, count) }, (_, i) => raceLook(looks, race, { stage: CROWD_STAGES[i % CROWD_STAGES.length], fem: i % 2 === 1, seed: `crowd:${seed}:${i}` })) };
    }
    if (id === 'b') {
      const isClash = v.kind === 'script' && v.script.kind === 'clash';
      // the foe of a clash: the NPC of the entry (the standard closings label it only คู่ต่อสู้; a clash of its own names it)
      if (isClash) {
        const npc = npcOfScene(v) ?? (label === FOE_LABEL ? undefined : npcByName(looks, label));
        const f = npc ? npcFigure(looks, npc) : undefined;
        if (f) return f;
      }
      // the other person of an ally's scene: the person of the tie (the entry's id), else the NPC the entry names
      if (OTHER_LABELS.has(label)) {
        const tie = state && v.entry.id ? tieLooks(data, state).get(v.entry.id) : undefined;
        if (tie) return tie.kind === 'person' ? { kind: 'person', looks: [tie] } : { kind: 'beast', look: tie };
        const npc = npcOfScene(v);
        const f = npc ? npcFigure(looks, npc) : undefined;
        if (f) return f;
      }
    }
    // an actor the script names: the NPC of that name, when the table has it
    const named = npcByName(looks, label);
    return (named && npcFigure(looks, named)) || sil;
  };
  return ({ id, label, count }) => {
    const k = `${id}|${label}|${count}`;
    let f = cache.get(k);
    if (!f) cache.set(k, (f = make(id, label, count)));
    return f;
  };
}

// ---------- the place ----------

/**
 * Words of a place that put the scene inside a building, and words that put it among the houses of a town (indoor is asked first). The docs give no list:
 * these are read from the place names of the bg beats in data/gen/scenes.json.
 */
const INDOOR = ['ห้อง', 'ในอาคาร', 'ภายใน', 'โรงตี', 'โรงเรียน', 'มหาวิทยาลัย', 'หอ', 'ตึก', 'วิหาร', 'โบสถ์', 'ใต้ดิน', 'หน้าต่าง', 'เตาหลอม', 'ถ้ำ', 'รัง', 'โถง', 'อุโมงค์'];
const TOWN = ['เมือง', 'ตลาด', 'ท่าเรือ', 'ถนน', 'ลาน', 'หมู่บ้าน', 'บ้าน', 'ย่าน', 'ประตู', 'สะพาน', 'โรงงาน', 'ค่าย', 'จัตุรัส', 'ร้าน', 'ท่า', 'สถาบัน', 'วัง', 'ปราสาท', 'ป้อม', 'สภา', 'ทางเดิน', 'บันได'];

/** Where a place the script names is: under the sky, among the houses, or inside. A name that says neither is under the sky. */
export function settingOf(place: string): Setting {
  if (INDOOR.some((w) => place.includes(w))) return 'indoor';
  if (TOWN.some((w) => place.includes(w))) return 'town';
  return 'outdoor';
}

/** The continent and country a scene is in: the life's, else the country of the NPC of the entry (`AZ02-1` is the second country of AZ), else nothing. */
export function placeOf(data: GameData, state: GameState | null | undefined, e: LogEntry): { continent: string; country?: string } | undefined {
  const countries = (data.countries?.items as Country[] | undefined) ?? [];
  const life = state?.life;
  const home = life ? countries.find((c) => c.id === life.country) : undefined;
  if (home) return { continent: home.continent as string, country: home.id };
  const m = (str(e.data.npc) ?? '').match(/^([A-Z]{2})(\d{2})-/);
  if (m) return { continent: m[1], country: `${m[1]}-${m[2]}` };
  return undefined;
}

/** The painted place of a scene as a function of the place the frame names (the bg beats change it): the life's continent and country, the setting from the words, a seed from the scene. */
export function sceneryOf(data: GameData, state: GameState | null | undefined, v: SceneView): SceneryOf {
  const at = placeOf(data, state, v.entry);
  const seed = seedOf(v.kind === 'script' ? v.script.id : v.card.id);
  return (place) => {
    const spec: ScenerySpec = { continent: at?.continent ?? 'AZ', setting: settingOf(place), seed };
    if (at?.country) spec.country = at.country;
    return spec;
  };
}
