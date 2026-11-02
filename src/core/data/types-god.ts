// Shape of data/gen/god.json (code-plan §5.1). Owned by the god generator.
import type { GenFile } from '../types';

export interface RawTable {
  headings: string[];
  header: string[];
  rows: string[][];
  src: string;
}

type Tier5 = Record<'C' | 'U' | 'R' | 'E' | 'L', number | null>;
type Range = [number, number];

export interface Miracle {
  id: string; // MR-01
  name: string;
  tier: string; // เล็ก กลาง ใหญ่ มหา มังกร ลิขิต
  target: string;
  cost: { faith?: number; dread?: number; faithAll?: boolean; faithMin?: number; fate?: { star: number; major: number; minor: number } };
  /** Years of the world before the same miracle can be used again; null when once per life or not stated. */
  wait: number | null;
  oncePerLife: boolean;
  immediate: string;
  world: string;
  story: string;
  flagsSet: string[];
  flagsClear: string[];
  mults: { subject: string; mul: number; years?: number }[];
  wDeltas: { delta: number; years?: number; permanent: boolean }[];
  faithDelta: { scope: string; delta: number }[];
  moodDelta?: number;
  defenseBonus?: number;
  newCountryW?: number;
  makesRuin?: boolean;
  src: string;
}

export interface GodData {
  counts: Record<string, number>;
  vars: { name: string; key: string; min: number; max: number; owner: string }[];
  start: { faith: number; dread: number; cap: number };
  income: {
    base: { faith: number; dread: number };
    channelDiv: number;
    beliefDiv: { faith: number; dread: number };
    beliefMax: { faith: number; dread: number };
    prophet: number;
    prayerGrant: number;
    punishGain: Range;
    destroyReturnDiv: number;
    gd04: number;
    gd05: number;
    gd05Until: number;
    rows: { source: string; faith: string; dread: string; src: string }[];
  };
  prices: {
    byTier: { key: string; byTier: Partial<Tier5>; pay: 'faith' | 'dread'; src: string }[];
    reroll: number[];
    dream: { first: number; second: number; step: number };
    whisper: { cheap: number; dear: number; cheapHints: string[]; dearHints: string[] };
    prayerGrant: Range;
    revive: { faith: number; dread: number };
    fate: { good: number; bad: number; backfire: number };
    mods: {
      beliefLow: { below: number; faithMul: number };
      beliefHigh: { above: number; dreadMul: number };
      switchLine: { belief: number; cap: number };
      window: number;
      rows: { cond: string; effect: string }[];
    };
  };
  belief: {
    bestow: { base: number; perTier: number };
    curse: { base: number; perTier: number };
    holyWeapon: number;
    cursedWeapon: number;
    cursedWeaponMercy: number;
    dream: { obey: number; misread: number; refuse: number };
    prayer: { grant: number; devoutMul: number; deny: number; punish: number; ignore: number };
    miracle: { createHere: number; destroyHere: number };
    revive: { faith: number; dread: number };
    fade: { quietYears: number; perYear: number };
    rows: { cause: string; delta: string; src: string }[];
    bands: { name: string; tag?: string; min: number; max: number; effect: string }[];
  };
  caps: {
    chestPerYear: number;
    chestWindowBonus: number;
    dreamPerYear: number;
    whisperPerYear: number;
    prayersPending: number;
    prayerExpiryTicks: number;
    miraclePerLife: { mid: number; big: number; ruinOfBig: number; grand: number; conjure: number };
    giftedWeapon: number;
    giftedItems: number;
    rows: { what: string; cap: string }[];
  };
  heirs: { powerShare: number; beliefShare: number; bloodlineMul: number; bloodlineOdds: number[]; uncurseMul: number; rows: { what: string; rule: string }[] };
  epithets: { title: string; cond: string; params: Record<string, number>; src: string }[];
  chest: {
    slots: { slot: number; kind: string; pool: string; ifEmpty: string; src: string }[];
    filters: { key: string; rule: string }[];
    tierWeights: Record<'C' | 'U' | 'R' | 'E' | 'L', number>;
    multipliers: { id: string; cond: string; mult: number; src: string }[];
    lateTierFrom: number;
    compensator: { start: number; step: number; baseChance: Record<'C' | 'U' | 'R' | 'E' | 'L', number>; appliesTo: string };
    actions: { action: string; rule: string }[];
    rerollExtraLock: number;
    weapon: { key: string; value: string }[];
    weaponMult: { job: number; country: number };
    example: { slot: string; id: string; tier: string; price: string; why: string }[];
    minAgeForWeapon: number;
    levelLGate: { bless: number; curse: number };
  };
  dreams: {
    sources: { id: string; name: string; paths: string; effect: string; mult: number | null; src: string }[];
    parts: { part: string; from: string }[];
    symbols: number;
    obey: {
      base: number;
      beliefDiv: number;
      clamp: Range;
      fit: { twoTraits: number; oneTrait: number; against: number; immoral: number };
      clarity: { perInt: number; oracle: number; whisper: number; repeat: number; punished: number };
      repeatYears: number;
      punishedYears: number;
    };
    levels: { name: string; min: number; max: number; look: string }[];
    luckGuard: { fails: number; bonus: number; level: string };
    outcomes: { id: string; name: string; cond: string; result: string; pathMul: number | null; src: string }[];
    misreadShare: number;
    defyBelief: number;
    burden: { step: number; at: number; relief: number; events: { name: string; effect: string }[] };
    special: { moment: string; rule: string }[];
    whispers: { hint: string; id: string; cost: number; effect: string; from: string }[];
    whisperCostGroups: { cheap: string[]; dear: string[] };
    prayerAnswers: { answer: string; price: string; effect: string }[];
  };
  prayers: {
    source: string;
    kinds: { id: string; weight: number; icon: string; grantCost: number; grantFx: string; punishGain: number; punishFx: string; trouble: boolean }[];
    tick: { ticksPerYear: number; base: number; pietyDiv: number; oracle: number; troubleMul: number; troubleShare: number; maxPending: number; expiryTicks: number; repeatCooldownTicks: number; silentBelow: number; assumedNote: string };
  };
  miracles: {
    lines: { line: string; color: string; pay: string; examples: string }[];
    ironRules: { n: number; rule: string; why: string }[];
    limits: { ruinGapYears: number; worldBigGapYears: number; worldMidGapYears: number; gd08ThirdBigDestroy: number; gd08Mul: number };
    list: Miracle[];
    fate: {
      rows: { key: string; rule: string }[];
      slowRange: Range;
      fastRange: Range;
      dragonFloor: number;
      dragonCap: number;
      minCostShare: number;
      maxYears: number;
      lastEraForceStep: number;
      lastEraForceCap: number;
    };
    ruin: {
      immediate: { what: string; effect: string }[];
      events: { id: string; name: string; cond: string; what: string; effect: string; src: string }[];
    };
    seal: {
      hit: { falls: string; country: string; dragon: string; other: string; dragonMood: number }[];
      reply: { moodMin: number; moodMax: number; name: string; effect: string }[];
      anchorCdYears: number;
      anyAnchorCdYears: number;
      rows: string[][];
    };
    reactions: { miracle: string; country: string; neighbors: string; dread: string }[];
  };
  conjure: {
    verbs: { id: string; name: string; means: string; pay: string; payLine: string }[];
    cores: { id: string; name: string; covers: string }[];
    scales: { id: string; name: string; target: string; counts: string; base: number }[];
    cells: { verb: string; core: string; text: string; mr: string[]; pureMr?: string }[];
    reactions: { verb: string; core: string | null; cond: string; result: string }[];
    shadow: { chance: Record<string, number>; byCore: { core: string; text: string }[] };
    caps: {
      perLife: number;
      continentPerLife: number;
      sameMixPerLife: number;
      gapYears: number;
      sameCountryGapYears: number;
      firstLifeVerbs: string[];
      firstLifeCores: string[];
      rows: { key: string; rule: string }[];
    };
  };
  goals: {
    vows: { id: string; name: string; done: string; set: number; selfJudged: boolean; src: string }[];
    vowResults: { result: string; gets: string }[];
    titles: { title: string; cond: string; src: string }[];
    chronicle: { vowDone: number; vowFail: number; perTitle: number; perMilestone: number; firstLife: number };
    unlocks: { at: number; opens: string }[];
    rhythms: { name: string; effect: string }[];
    overreach: { cond: string; effect: string; count: number | null; mul: number | null }[];
    collection: { what: string; count: number | null; note: string }[];
    measure: { ids: string[]; judged: string; result: string }[];
  };
  sim: {
    assumptions: {
      nodesPerLife: number;
      windowShare: { rows: number; of: number; pct: number };
      earlyDeath: { perYear: number; fromAge: number; naturalAge: number };
      channelB: Range;
      trouble: number;
      troubleMul: number;
      ageStops: number[];
      horizon: number;
      lifeYears: number;
      prayerCostSpread: Range;
      note: string;
    };
    tuned: { what: string; before: string; measured: string; now: string; after: string }[];
    targets: { what: string; value: string }[];
    policies: { policy: string; does: string; answers: string }[];
  };
  rule: {
    dreamStep: number;
    anchorCd: number;
    anchorWorldCd: number;
    ruinLife: number;
    ruinCd: number;
    dragonCd: number;
    mahaF: number;
    wrathD: number;
    burdenRelief: number;
    burdenAt: number;
    endFate: number;
    fallFate: number;
    largeCd: number;
    midCd: number;
    note: string;
  };
  raw: RawTable[];
}

export type GodFile = GenFile<GodData>;
