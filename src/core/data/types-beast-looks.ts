// Shapes of data/gen/beast-looks.json (M6 beasts): the Look of each of the 200 enemies (docs/appearance/04-enemies.md ค่า UI) and the 15 legendary
// dragons (docs/appearance/03-dragons.md ค่า UI), read by the painters of src/art/beast. Owned by the beast-looks generator.

/** The frame class (21-pixel-art.md §2): S 48×48 · M 64×64 · L 128×96 · XL 256×192 · XXL a 320×180 background piece. */
export type SizeClass = 'S' | 'M' | 'L' | 'XL' | 'XXL';

/** The body plan a painter draws (kinds + words of the doc). */
export type BeastPlan =
  | 'humanoid' | 'quadruped' | 'flyer' | 'insect' | 'serpent' | 'amorphous' | 'skeleton' | 'construct' | 'plant'
  | 'elemental' | 'spirit' | 'giant' | 'sea' | 'swarm' | 'dragon';

/** How the attack moves: lunge (the body flies at the target) · slam (a weapon or fist comes down) · spit (breath, a bolt, a shout) · lash (tentacle, tail, grab). */
export type AtkKind = 'lunge' | 'slam' | 'spit' | 'lash';
/** How the body goes at its death: topple (falls) · melt (gel runs flat) · crumble (a heap of bones or stones) · dissolve (smoke, ash, mist) · sink (into water or sand) · burst (embers) · sag (does not die: sinks and sleeps). */
export type DieKind = 'topple' | 'melt' | 'crumble' | 'dissolve' | 'sink' | 'burst' | 'sag';

/** The parts of a humanoid (ids of src/art/parts/ids.ts; the painter draws the ones its tables have and leaves the rest). */
export interface PersonParts {
  skin: string;
  hairColor: string;
  hair: string;
  hat: string;
  beard: string;
  outfit: string;
  tool: string;
  ears: 'round' | 'long' | 'pointed' | 'animal' | 'fin' | 'none';
  feats: string[];
}

export interface EnemyLook {
  kind: 'enemy';
  id: string;
  name: string;
  /** which table of the doc: code (ก) · world (ข) · npc (ค) · named (ง) · boss (จ) */
  group: 'code' | 'world' | 'npc' | 'named' | 'boss';
  tier: string;
  /** `ชนิด` words of the name cell (beast, undead, fey, บิน ฝูง …) */
  kinds: string[];
  size: SizeClass;
  /** height or length as a multiple of a 28-pixel human (n×); null when the doc gives none */
  scale: number | null;
  /** the doc's words in the parenthesis after the size (`ที่ไหล่`, `ยาว`, `ปีกกาง`) */
  scaleNote: string;
  /** `ฝูง a–b` (or `ชุด a–b`) as [a, b]; null for a single */
  swarm: [number, number] | null;
  /** a cloud-like crowd (`ฝูงเดียวก้อนใหญ่`, `ฝูงเมฆ`) that is one body of many */
  cloud: boolean;
  main: string;
  second: string;
  /** the eye colour (`ตา`); when the doc names another third colour instead (`แกน` `รูน` `เลนส์` …) that one */
  eye: string;
  /** the label of `eye`: `ตา` or the named colour */
  eyeLabel: string;
  /** false when the doc gives no third colour (the default dark eye was used) */
  eyeGiven: boolean;
  /** the other named colours of the row (`ธุลี` `ลิ้น` `ปากใน` …) */
  extra: { label: string; hex: string }[];
  plan: BeastPlan;
  /** the variant inside the plan (a painter form: `wolf`, `slime`, `golem` …; `person` for a humanoid) */
  form: string;
  /** how the plan was chosen: kind (from the kind word alone) · words (kind plus the words of the row) · guess (by id, nothing in the row says it) */
  planBy: 'kind' | 'words' | 'guess';
  poses: { idle: string; atk: string; die: string };
  atkKind: AtkKind;
  dieKind: DieKind;
  /** words of the row that name a feature a painter draws (club, horns, crown, flag, tusks …) */
  words: string[];
  /** only for the humanoid plan */
  parts: PersonParts | null;
}

export interface DragonLook {
  kind: 'dragon';
  id: string;
  n: number;
  name: string;
  size: Exclude<SizeClass, 'XXL' | 'S'>;
  /** `รูปทรง` as the doc writes it */
  shape: string;
  /** the painter body shape: serpent · stout · slender · turtle · round · skeletal · rock · coil · two-head */
  form: string;
  main: string;
  second: string;
  eye: string;
  /** the eye is shut (`ปิด`) */
  eyeShut: boolean;
  /** the second head (Rahu: gold / silver) */
  alt: { main: string; second: string; eye: string } | null;
  effect: string;
  ambient: string;
  /** flags the painter reads: wings · wingless · translucent · pipes · roots … */
  words: string[];
}

export type BeastLooksData = { enemies: EnemyLook[]; dragons: DragonLook[]; counts: { enemies: number; dragons: number } };
