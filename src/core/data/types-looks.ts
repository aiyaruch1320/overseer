// Shape of data/gen/looks.json (code-plan §9.2): what the painter needs to draw every race, NPC and ally successor, read from
// docs/appearance/02-races.md (ค่า UI of each race), docs/appearance/npcs/*.md and docs/appearance/19-ally-successors.md.
// Written by scripts/codegen/groups/looks.ts; src/art/resolve.ts turns it into PersonLook objects.
// Part ids are those of src/art/parts/ids.ts ('' = none).
// src/core may not import src/art, so the few shapes shared with src/art/look.ts are written here again; src/art/resolve.ts assigns
// them to the painter's types, so the compiler fails there if the two ever differ.

export type LookStage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';
export interface LookBody {
  scale: number;
  head: number;
  shoulders: number;
  ears: 'round' | 'long' | 'pointed' | 'animal' | 'fin' | 'none';
  lower: 'legs' | 'serpent' | 'gown' | 'blob';
  gait: 'normal' | 'heavy' | 'glide' | 'hop' | 'shuffle' | 'float';
}

/** What a sub-line (สายเลือดย่อย) changes over its race, from words the docs show (a skin shade, a size, a wing kind). */
export interface LineOverrides {
  skin?: string;
  hairColor?: string;
  eye?: string;
  accent?: string;
  /** replaces body.scale */
  scale?: number;
  /** replaces the race's feats */
  feats?: string[];
}

export interface RaceLine { name: string; overrides: LineOverrides }

export interface RaceLookRow {
  id: string; // human elf darkelf ... (data/gen/races.json)
  name: string;
  /** The UI line of 02-races.md: ขนาด หัว ไหล่ หู ท่อนล่าง ท่าเดิน */
  body: LookBody;
  skins: string[];
  accents: string[];
  feats: string[];
  /** the clothes the race wears when the docs give none (the เครื่องแต่ง of 02-races.md: the dwarves' apron) */
  outfit: string;
  /** the beard the men of the race wear when the docs give none ('' for races that have none) */
  beard: string;
  /** the hat, the hair of men and of women (the women's falls back to the men's), the hair colour ('' = the generic one), the clothes' two colours and a thing carried by habit, all from the same cells */
  hat: string;
  hair: string;
  hairFem: string;
  hairColor: string;
  main: string;
  second: string;
  tool: string;
  lines: RaceLine[];
  src: string;
}

/** The part of a person that both the NPCs and the successors share (all of it is complete: no field is missing). */
export interface PersonLookRow {
  name: string;
  race: string;
  line?: string;
  stage: LookStage;
  /** from the words of the description; null when it says nothing (the resolver then picks from the id) */
  fem: boolean | null;
  skin: string;
  hairColor: string;
  eye: string;
  main: string;
  second: string;
  outfit: string;
  hair: string;
  beard: string;
  hat: string;
  tool: string;
  /** personal marks only (scar, mask, halo ...); the race's feats are added by the resolver */
  feats: string[];
  wear: number;
  /** the fields the docs said nothing of and the generator filled from its defaults (outfit hair hairColor eye skin main second); check:looks counts them */
  defaults: string[];
  /** the items and the pose as the docs wrote them */
  items: string[];
  pose: string;
}

export interface NpcLookRow extends PersonLookRow {
  /** appearance file: `01-azgar` */
  file: string;
  country: string;
  continent: string;
  age: number | null;
}

export interface SuccessorLookRow extends PersonLookRow {
  /** the NPC this person succeeds (MH09-7S → MH09-7) */
  of: string;
  age: number | null;
  /** the mark of the original that shows (ภาพที่เห็น) and the oddity (ผิดปกติ) */
  seen: string;
  oddity: string;
}

export interface LooksData {
  counts: { races: number; lines: number; npcs: number; successors: number; unmatched: number };
  races: Record<string, RaceLookRow>;
  npcs: Record<string, NpcLookRow>;
  successors: Record<string, SuccessorLookRow>;
}
