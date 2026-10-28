export type StatKey = 'pow' | 'mag' | 'spd' | 'luk' | 'int' | 'vit';
export const STATS: StatKey[] = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'];
export const STAT_NAMES: Record<StatKey, string> = {
  pow: 'กายภาพ', mag: 'เวทมนตร์', spd: 'ความเร็ว', luk: 'โชค', int: 'ความฉลาด', vit: 'ความแข็งแรง',
};

// Personality axes, -100..100
export type Axis = 'brave' | 'kind' | 'ambition' | 'piety' | 'curious' | 'honest' | 'temper' | 'social';
export const AXES: Axis[] = ['brave', 'kind', 'ambition', 'piety', 'curious', 'honest', 'temper', 'social'];
export const AXIS_NAMES: Record<Axis, [string, string]> = {
  brave: ['กล้าหาญ', 'ขลาด'],
  kind: ['เมตตา', 'โหดร้าย'],
  ambition: ['ทะเยอทะยาน', 'สันโดษ'],
  piety: ['ศรัทธา', 'ไม่เชื่อ'],
  curious: ['อยากรู้', 'ระวังตัว'],
  honest: ['ซื่อตรง', 'เจ้าเล่ห์'],
  temper: ['ใจร้อน', 'ใจเย็น'],
  social: ['ชอบสังคม', 'เก็บตัว'],
};

export type ChoiceTag =
  | 'fight' | 'flee' | 'help' | 'selfish' | 'learn' | 'love' | 'travel' | 'stay'
  | 'pray' | 'defy' | 'greed' | 'trust' | 'distrust' | 'risk' | 'safe';

export type Tone = 'dark' | 'grim' | 'warm' | 'comedy';
export const TONE_ICON: Record<Tone, string> = { dark: 'tone_dark', grim: 'tone_grim', warm: 'tone_warm', comedy: 'tone_comedy' };

export type Stage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';
export const STAGE_NAMES: Record<Stage, string> = {
  infant: 'ทารก', child: 'เด็ก', teen: 'วัยรุ่น', adult: 'ผู้ใหญ่', elder: 'ชรา',
};

export interface Cond {
  age?: [number, number]; // human-equivalent age
  stage?: Stage[];
  climate?: string[];
  race?: string[];
  notRace?: string[];
  flag?: string[];
  notFlag?: string[];
  job?: string[];
  notJob?: string[];
  tag?: string[]; // character has any of these tags (from skills/blessings/curses/race)
  rel?: string; // has relation of type
  noRel?: string;
  countryFlag?: string; // war, plague, famine, golden
  minStat?: Partial<Record<StatKey, number>>;
  axis?: Partial<Record<Axis, number>>; // positive: >= value, negative: <= value
  gold?: number;
  married?: boolean;
  belief?: number; // >= if positive, <= if negative
  wronged?: boolean; // the player (god) has cursed, punished or terrorised this character
}

// Outcome: [narration, effects-DSL]
export type Outcome = [string, string];

export interface Choice {
  l: string;
  tags: ChoiceTag[];
  ax?: Partial<Record<Axis, number>>;
  chk?: [StatKey, number]; // stat, DC
  bonusTag?: string[]; // character tags that give +4 to the check
  malusTag?: string[]; // character tags that give -4
  god?: 'revive' | 'let_die';
  ok: Outcome;
  ng?: Outcome;
}

export interface Storylet {
  id: string;
  tone: Tone;
  w: number;
  r?: 'C' | 'U' | 'R' | 'E' | 'L'; // rarity (default C)
  aff?: Record<string, number>; // story context → weight bonus
  c?: Cond;
  t: string;
  ch?: Choice[];
  e?: string;
  once?: boolean;
  important?: boolean;
}

export interface Relation {
  id: number;
  type: 'mentor' | 'rival' | 'lover' | 'spouse' | 'nemesis' | 'friend' | 'child' | 'parent';
  name: string;
  race: string;
  alive: boolean;
  affinity: number;
  npcId?: number;
}

export interface Child {
  name: string;
  race: string;
  gender: string;
  bornAt: number; // parent's hAge at birth
  traits: string[];
  alive: boolean;
}

export interface Weapon {
  name: string;
  kind: 'holy' | 'cursed';
  rarity: 'C' | 'U' | 'R' | 'E' | 'L';
  element: string;
  power: number;
  tags: string[];
  history: string[];
  kills: number;
}

export interface FatePoint {
  fateId: string;
  hAge: number;
  omenShown: boolean;
  done: boolean;
  forced?: boolean; // changed by god
}

export interface LogEntry {
  year: number;
  age: number;
  text: string;
  tone?: Tone;
  kind: 'event' | 'god' | 'world' | 'fate' | 'omen' | 'dream' | 'llm' | 'birth' | 'death';
}

export interface Character {
  name: string;
  race: string;
  gender: string;
  countryId: number;
  townId: number;
  birthTime: string; // dawn | day | dusk | night
  birthSign: string; // none | comet | eclipse | fullmoon | storm
  birthCountryId: number;
  hAge: number; // human-equivalent age (drives pacing)
  stats: Record<StatKey, number>;
  axes: Record<Axis, number>;
  traits: string[];
  aptitudes: string[];
  skills: string[];
  blessings: string[];
  curses: string[];
  job: string | null;
  secretJob: boolean;
  hp: number;
  gold: number;
  fame: number;
  flags: string[];
  relations: Relation[];
  children: Child[];
  weapon: Weapon | null;
  fate: FatePoint[];
  belief: number; // -100..100 belief in the god (us)
  alive: boolean;
  deathCause?: string;
  revived: boolean;
  generation: number;
  dynastyName: string;
  kills: number;
}

export interface Country {
  id: number;
  code: string; // docs/countries id, e.g. SV-01
  title: string; // docs subtitle, e.g. นครลำต้น
  name: string;
  continent: number;
  climate: string;
  gov: string;
  races: { race: string; w: number }[];
  danger: number;
  cx: number;
  cy: number;
  tiles: number;
  neighbors: number[];
  flags: string[]; // war, plague, famine, golden, fallen
  warWith: number | null;
  religion: string;
  towns: number[];
  fate?: Fate; // set when a great event of the world's story (docs/world-events.md §15) has reshaped this land
  weather?: string; // this season's weather (clear, rain, storm, snow, blizzard, sandstorm, fog, heat, ashfall, cloudy)
  until: Record<string, number>; // flag -> tick when it expires
  history: string[];
}

/** how a land has been reshaped by the story: see src/sim/fate.ts */
export type Fate = 'skyfall' | 'ash' | 'flood' | 'split' | 'withered' | 'rust' | 'light' | 'fog' | 'fallen';

export interface Continent {
  id: number;
  name: string;
  desc: string;
  climates: string[];
  races: string[];
  count: number;
}

export interface DreamBias {
  tags: ChoiceTag[];
  strength: number;
  remaining: number;
  meaning: string;
}

export interface PendingEvent {
  kind: 'story' | 'death' | 'omen';
  storylet: Storylet;
  vars: Record<string, string>;
  text: string;
  fateId?: string;
  monsterId?: string;
}

export interface GameState {
  seed: string;
  rngState: number;
  year: number;
  tick: number; // seasons elapsed
  char: Character;
  faith: number;
  dread: number;
  lastPower: 'faith' | 'dread' | null;
  powerSwitches: number;
  dream: DreamBias | null;
  log: LogEntry[];
  worldNews: LogEntry[];
  countries: Country[]; // mutable world state (flags etc.)
  pending: PendingEvent | null;
  seenOnce: string[];
  ended: boolean;
  lifeStats: { blessings: number; curses: number; dreams: number; miracles: number; interventions: number };
  llmCalls: number;
  pastLives: string[];
  karmaLife: number;
  threads: Record<string, number>;
  chains: { id: string; at: number; vars: Record<string, string> }[];
  townNews: LogEntry[];
  npcs: NpcState[];
  nextNpcId: number;
  actors: Actor[];
  queue: { id: string; vars: Record<string, string> }[]; // story events waiting to be shown (from NPCs, actors, regions)
  prayers: PrayerCard[];
  prayerCd: Record<string, number>;
  quest: { id: string; done: boolean } | null;
  cine?: string[]; // festival scenes already shown this life
  lastBanner?: number;
}

// A prayer waiting for the god's answer (time keeps running)
export interface PrayerCard { uid: number; id: string; text: string; expires: number; vars: Record<string, string> }

// Other people with lives of their own: the protagonist's relations and the notables of the town they live in
export interface NpcState {
  id: number;
  name: string;
  race: string;
  role: string;
  townId: number;
  hAge: number;
  alive: boolean;
  fame: number;
  attitude: number; // -100..100 toward the protagonist
  tags: string[];
  last?: string; // latest thing that happened to them
  job?: string; // trade (data/npclife.ts NPC_JOBS)
  skill?: number; // 0..100 in that trade
  goal?: { id: string; prog: number; need: number }; // what they are working toward (NPC_GOALS)
  deeds?: string[]; // goals reached
}

// Something big happened near the protagonist: the UI stops time and plays its scene
export interface Spectacle { anim: string; title: string; text: string; countryId: number; townId?: number; tone: string; mine: boolean; pause: boolean }

// Figures who travel the world map: the hero of the age, the demon lord's host, merchant caravans
export interface Actor {
  id: string;
  kind: 'hero' | 'demonlord' | 'caravan';
  name: string;
  race: string;
  from: number; // town id
  to: number;
  prog: number; // 0..1 along from→to
  alive: boolean;
  deeds: number;
  respawnAt?: number;
}
