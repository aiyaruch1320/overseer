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
import type { Stage } from '../../art/look';
import { DRAGONS } from '../../art/beast/look';
import { npcBeast } from '../../art/npc-beasts';
import { npcLook, raceLook } from '../../art/resolve';
import type { LooksData } from '../../core/data/types-looks';
import type { Country } from '../../core/data/types-npcs';
import type { ScenerySpec, Setting } from '../../art/scenery/types';
import type { Figure, FigureOf } from '../../scene/figures';
import { seedOf } from '../../scene/seed';
import type { SceneryOf } from '../../scene/Stage';
import { extOf as bondsExt, tiesOf } from '../../core/bonds';
import { mainLookOf, scarredOf, tieLooks } from './looks';
import { items } from '../../core/text/labels';
import type { LogEntry } from '../../core/types';
import { cardFrom, plainCard, type CardModel } from '../../scene/card';
import { stagingOf } from '../../scene/props';
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
export function cardOfEntry(data: GameData, e: LogEntry, state?: GameState | null): CardModel {
  const card = cardBase(data, e);
  // the picture of the card is the place of the event: the country or continent the entry carries, else the life's (an event of no place shows the first continent's plain look)
  const at = placeOf(data, state, e);
  card.scenery = { continent: at?.continent ?? 'AZ', setting: 'outdoor', seed: seedOf(card.id), ...(at?.country ? { country: at.country } : {}) };
  // the things the scene of the event names (the pearl egg of DR-03) are in the picture of its card too
  const ix = indexOf(data);
  const script = ix ? sceneKeys(e, (id) => ix.template.get(id)).keys.map((k) => ix.script.get(k)).find(Boolean) : undefined;
  const staged = script ? stagingOf(script) : undefined;
  if (staged?.props.length) card.scenery.props = staged.props;
  if (staged?.setting) card.scenery.setting = staged.setting;
  if (staged?.mood) card.scenery.mood = staged.mood;
  return card;
}

function cardBase(data: GameData, e: LogEntry): CardModel {
  const ix = indexOf(data);
  const body = describe(data, e) ?? '';
  const def = e.id ? ix?.card.get(e.id) : undefined;
  if (def) return cardFrom(def, body);
  const d = e.data;
  // the name of an entry: its own, else the title of its script (a clash is `NF-AZ02-1` in the log, the card says the foe's name), never the code
  const title = str(d.name) ?? str(d.title) ?? (e.id ? ix?.script.get(e.id)?.title : undefined) ?? e.id ?? e.kind;
  const group = e.id?.match(/^([A-Z]+)-/)?.[1];
  return plainCard(e.id ?? String(e.n), title, body, e.sys, str(d.mark) ?? '', ix?.scenes, group);
}

/**
 * A miracle's day (20-god-ui §7.3: "the people see the omen") has people from the first beat: when its script brings its crowd late, a few people stand under the sky from the start,
 * so the light falls on someone (the crowd of the later beat is the same actor and walks to its place).
 */
export function withWitnesses(script: SceneScript): SceneScript {
  if (script.kind !== 'miracle') return script;
  const firstActor = script.beats.find((b) => b.k === 'actor');
  if (!firstActor || firstActor.at <= 1) return script;
  const crowd = script.beats.find((b) => b.k === 'actor' && b.id === 'crowd');
  if (!crowd) return script;
  return { ...script, beats: [{ k: 'actor', at: 0.6, id: 'crowd', label: 'ผู้คน', x: 0.26, pose: 'stand', count: 3 }, ...script.beats] };
}

/** The scene of a log entry: its script (the rest of the scene chosen by the result in the entry) or its card. */
export function sceneFor(data: GameData, e: LogEntry, state?: GameState | null): SceneView {
  const card = cardOfEntry(data, e, state);
  const ix = indexOf(data);
  if (!ix) return { kind: 'card', card, entry: e };
  const { keys, variants } = sceneKeys(e, (id) => ix.template.get(id));
  for (const key of keys) {
    const script = ix.script.get(key);
    if (!script) continue;
    const std = ix.script.get('std.clash');
    const picked = variants.map((group) => group.find((k) => k && (script.variants?.[k] || std?.variants?.[k])));
    return { kind: 'script', script: withWitnesses(resolveScript(script, picked, std)), card, entry: e };
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
  /** The painted place of the picture: the continent and country of the life, under the sky, in the season (the four seasons are four pictures). */
  scenery: ScenerySpec;
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

/**
 * The scene on the stage. The choice is made again at every new line of the log and each time gives a new script object, so the scene that is playing is held here: it stays the
 * same object until it has been played (`played`), a newer scene takes its place, or the log it came from is gone (another save). It also stays when the log has moved past the
 * lines that are looked at: a scene of 40 seconds outlives many lines.
 */
export function heldScene(held: SceneView | undefined, newest: SceneView | undefined, played: number, logN: number): SceneView | undefined {
  const cur = held && held.entry.n > played && held.entry.n < logN ? held : undefined;
  if (newest && newest.kind === 'script' && newest.entry.n > played && (!cur || newest.entry.n > cur.entry.n)) return newest;
  return cur;
}

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
  const at = lifePlace(data, state);
  const scenery: ScenerySpec = { continent: at?.continent ?? 'AZ', setting: 'outdoor', season: quarter, seed: seedOf(life?.country ?? ''), ...(at?.country ? { country: at.country } : {}) };
  return { season: quarter, seasonName: SEASONS[quarter], sky: c.sky, ground: c.ground, glow: c.glow, figure: { height, pose: stage === 'elder' ? 'bow' : 'stand', stage }, place, age, latest, caption, scenery };
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

/** The race of the tribe a rite or a destination belongs to, by the two letters of its script id (`dest.wi`, `rite.el`, `wi.e1`): the first letters of the race ids of data/gen/looks.json. */
const TRIBE_RACE: Record<string, string> = { hu: 'human', el: 'elf', de: 'darkelf', dw: 'dwarf', or: 'orc', ha: 'halfling', be: 'beast', na: 'naga', dk: 'dragonkin', va: 'vampire', fa: 'fae', sl: 'slime', dm: 'demonkin', me: 'merfolk', wi: 'winged', gi: 'giant', la: 'lavakin', co: 'construct', so: 'soulmachine', mu: 'mummy', gh: 'ghoul' };

/**
 * The main homeland of each race (docs/systems/character/01-origin.md §5, the first country of its "ถิ่นหลัก"): a life of a race is normally born there, so a specimen of a
 * tribe's rite with no life behind it is shown in this country (the storybook, the page of the twelve tribes).
 */
export const RACE_HOME: Record<string, string> = { human: 'AL-04', elf: 'SV-01', darkelf: 'KD-05', dwarf: 'KD-01', orc: 'MH-01', halfling: 'AL-16', beast: 'SV-16', naga: 'NR-07', dragonkin: 'KD-07', vampire: 'NB-02', fae: 'SV-04', slime: 'SV-12', demonkin: 'MH-02', merfolk: 'NR-06', winged: 'AZ-01', giant: 'SH-03', lavakin: 'KD-06', construct: 'MK-02', soulmachine: 'MK-03', mummy: 'SH-02', ghoul: 'MH-03' };

/** The race a scene is about: its tribe when the script is a rite or a destination of one, else nothing (the life's own race is the default). */
export function sceneRace(v: SceneView): string | undefined {
  const id = v.kind === 'script' ? v.script.id : v.entry.id ?? '';
  const m = id.match(/^(?:rite|dest)\.([a-z]{2})$/) ?? id.match(/^([a-z]{2})\.[a-z]\d+$/);
  return m ? TRIBE_RACE[m[1]] : undefined;
}

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
    // a person of a race for whoever has no look of their own: the life's race, else the tribe of the script, else the first race (never the black placeholder while the data has looks)
    const plain = (stage: Stage, fem: boolean, seed: string, prefer?: string): Figure => {
      const race = [prefer, life?.race, sceneRace(v), 'human'].find((r) => r && looks?.races[r]);
      return looks && race ? { kind: 'person', looks: [raceLook(looks, race, { stage, fem, seed })] } : sil;
    };
    const sceneSeed = seedOf(v.kind === 'script' ? v.script.id : v.card.id);
    if (id === 'a' && MAIN_LABELS.has(label) && count === 1) {
      // the main character is the life's look; a stage with no life behind it (a specimen) shows a plain person of the scene's tribe, not a silhouette
      const look = state && life && looks ? (label === 'เด็ก' ? mainLook(life, data, { scarred: scarredOf(state), hAge: RITE_CHILD_AGE }) : mainLookOf(data, state)) : null;
      return look ? { kind: 'person', looks: [look] } : plain(label === 'เด็ก' ? 'child' : 'adult', false, `main:${sceneSeed}`, sceneRace(v));
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
    // an actor the script names: the NPC of that name, when the table has it; anyone else (the other person, a name the table lacks) is a plain person, never a silhouette
    const named = npcByName(looks, label);
    return (named && npcFigure(looks, named)) || plain('adult', id === 'b' && sceneSeed % 2 === 1, `${id}:${label}:${sceneSeed}`, sceneRace(v));
  };
  return ({ id, label, count }) => {
    const k = `${id}|${label}|${count}`;
    let f = cache.get(k);
    if (!f) cache.set(k, (f = make(id, label, count)));
    return f;
  };
}

/**
 * The words under an actor: the main character is called by name (the script says `ตัวละคร` or `เด็ก`), the other person of an ally's scene by the name of the tie;
 * anyone else keeps the script's label (a foe's name, `ผู้คน`).
 */
export function labelsOf(data: GameData, state: GameState | null | undefined, v: SceneView): (a: { id: string; label: string }) => string {
  const life = state?.life;
  const tie = state && v.entry.id && state.life?.ext.bonds ? tiesOf(bondsExt(state.life)).find((t) => t.id === v.entry.id) : undefined;
  void data;
  return ({ id, label }) => {
    if (id === 'a' && MAIN_LABELS.has(label) && life?.name) return life.name;
    if (OTHER_LABELS.has(label) && tie?.name) return tie.name;
    return label;
  };
}

// ---------- the place ----------

/**
 * Words of a place that put the scene inside a building, words of open land, and words that put it among the houses of a town. The docs give no list: these are
 * read from the place names of the bg beats in data/gen/scenes.json (sentences, with the main place first: `ห้องสภาครึ่งหนึ่งยื่นออกเหนือหุบ` is a room, `ปากถ้ำบนเขา` a cave).
 * The word that comes first in the name decides; a name that says none of them is under the sky. A place `ริม` (beside) a cliff, a shore, a road or a forest is that
 * open land whatever stands there (`ลานดวลริมหน้าผา` is a duel on a cliff, not a town square), unless a room or a hall is named before it.
 */
const INDOOR = ['ห้อง', 'ในอาคาร', 'ภายใน', 'โรงตี', 'โรงเรียน', 'มหาวิทยาลัย', 'หอ(?!ก)', 'ตึก', 'วิหาร', 'โบสถ์', 'ใต้ดิน', 'หน้าต่าง', 'เตาหลอม', 'ถ้ำ', 'รัง', 'โถง', 'อุโมงค์', 'คุก', 'ในเต็นท์'];
const OPEN = ['หน้าผา', 'หุบ', 'เหว', 'ทุ่ง', 'ไร่', 'ป่า', 'ชายฝั่ง', 'ชายหาด', 'ชายทะเล', 'ฝั่ง', 'ทะเล', 'มหาสมุทร', 'แม่น้ำ', 'ลำธาร', 'หนอง', 'บึง', 'สันเขา', 'ภูเขา', 'ยอดเขา', 'เนิน', 'ที่ราบ', 'ทะเลทราย', 'สนามรบ', 'สนาม', 'ทางหลวง', 'ท้องฟ้า', 'เกาะ', 'ถนน', 'ริมน้ำ'];
const TOWN = ['เมือง', 'ตลาด', 'ท่าเรือ', 'ลาน', 'หมู่บ้าน', 'บ้าน', 'ย่าน', 'ประตู', 'สะพาน', 'โรงงาน', 'ค่าย', 'จัตุรัส', 'ร้าน', '(?<!เ)ท่า', 'สถาบัน', 'วัง(?!วน)', 'ปราสาท', 'ป้อม', 'สภา', 'ทางเดิน', 'บันได'];
const BESIDE = new RegExp(`ริม(?:${OPEN.join('|')}|น้ำ)`);
const GROUPS: [Setting, RegExp][] = [
  ['indoor', new RegExp(INDOOR.join('|'))],
  ['outdoor', new RegExp(OPEN.join('|'))],
  ['town', new RegExp(TOWN.join('|'))],
];

/** Where a place the script names is: under the sky, among the houses, or inside. */
export function settingOf(place: string): Setting {
  let best: Setting = 'outdoor';
  let at = Infinity;
  for (const [setting, re] of GROUPS) {
    const i = place.search(re);
    if (i >= 0 && i < at) [best, at] = [setting, i];
  }
  const beside = place.search(BESIDE);
  if (beside >= 0 && !(best === 'indoor' && at < beside)) return 'outdoor';
  return best;
}


export interface Place {
  continent: string;
  country?: string;
}

/** The place of a person of the NPC table (`AZ02-1` lives in `AZ-02`). */
const npcPlace = (npc: string | undefined): Place | undefined => {
  const m = (npc ?? '').match(/^([A-Z]{2})(\d{2})-/);
  return m ? { continent: m[1], country: `${m[1]}-${m[2]}` } : undefined;
};

/** The countries and continents the data knows, to tell the id of a place from any other text. */
function placeIds(data: GameData): { byId: Map<string, Place>; continents: Set<string> } {
  const countries = (data.countries?.items as Country[] | undefined) ?? [];
  return { byId: new Map(countries.map((c) => [c.id as string, { continent: c.continent as string, country: c.id as string }])), continents: new Set(countries.map((c) => c.continent as string)) };
}

/** The place an entry names itself: a country id or a continent id in the fields that a world event, a miracle's target, a fallen dragon or a local event carries. */
function namedPlace(data: GameData, d: LogEntry['data']): Place | undefined {
  const { byId, continents } = placeIds(data);
  for (const k of ['country', 'place', 'target', 'home']) {
    const v = str(d[k]);
    if (!v) continue;
    const c = byId.get(v);
    if (c) return { ...c };
    if (continents.has(v)) return { continent: v };
  }
  return undefined;
}

/** World events that happen in one named country. */
const FIXED_PLACE: Record<string, string> = { 'DR-03': 'AZ-01' };

/** The continent and country of the life now (the place of the calm picture, and of whatever an entry does not place), nothing without a life. */
export function lifePlace(data: GameData, state: GameState | null | undefined): Place | undefined {
  const home = state?.life ? placeIds(data).byId.get(state.life.country) : undefined;
  return home ? { ...home } : undefined;
}

/**
 * The continent and country a scene is in. The entry's own place first (a country or continent it names); the NPC of a clash is in the NPC's country (`NF-AZ02-1` is in
 * `AZ-02`, wherever the life is); everything else (the rites and destinations of the tribe, an ally's crisis, the nodes of the story) is where the life is; with no life, the
 * country of the NPC the entry names; with nothing, nothing.
 */
export function placeOf(data: GameData, state: GameState | null | undefined, e: LogEntry): Place | undefined {
  const named = namedPlace(data, e.data);
  if (named) return named;
  // events that happen in one place the docs name, wherever the life is (the sky nest is under Orantar, AZ-01: docs/lore/countries/01-azgar.md)
  const fixed = FIXED_PLACE[e.id ?? ''];
  if (fixed) return placeIds(data).byId.get(fixed);
  const npc = npcPlace(str(e.data.npc)) ?? (e.id?.startsWith('NF-') ? npcPlace(e.id.slice(3)) : undefined);
  if (npc && e.sys === 'combat' && e.kind === 'clash') return npc;
  return lifePlace(data, state) ?? npc;
}

/** The painted place of a scene as a function of the place the frame names (the bg beats change it): the continent and country of the scene, the setting from the words, a seed from the scene. */
export function sceneryOf(data: GameData, state: GameState | null | undefined, v: SceneView): SceneryOf {
  // with no life behind the scene (a specimen) a tribe's scene is in the tribe's homeland
  const race = sceneRace(v);
  const home = !state?.life && race ? placeIds(data).byId.get(RACE_HOME[race] ?? '') : undefined;
  const at = namedPlace(data, v.entry.data) ?? home ?? placeOf(data, state, v.entry);
  const seed = seedOf(v.kind === 'script' ? v.script.id : v.card.id);
  return (place) => {
    // the props and the kind of place the script asks for (src/scene/props.ts): the craft table, the anvil, the eternal flame ...
    const staged = v.kind === 'script' ? stagingOf(v.script, place) : undefined;
    const spec: ScenerySpec = { continent: at?.continent ?? 'AZ', setting: staged?.setting ?? settingOf(place), seed };
    if (staged?.props.length) spec.props = staged.props;
    if (staged?.mood) spec.mood = staged.mood;
    if (at?.country) spec.country = at.country;
    return spec;
  };
}
