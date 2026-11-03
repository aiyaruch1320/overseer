// Shape of data/gen/scenes.json (code-plan §5.1 row "รูปลักษณ์", §8.3): scene scripts and event cards read from the appearance docs
// (docs/appearance/11 12 13 15 16 17 18 and docs/appearance/20-god-ui.md §7.3). Written by scripts/codegen/groups/scenes.ts and
// played by src/scene/. The scripts are data: one player draws all of them, nothing is coded per scene.
import type { GenFile } from '../types';

/**
 * The ten kinds of beat every scene is made of (the shared parts of code-plan §8.3: background, characters, camera, light, particles,
 * text, sound; and the three the docs ask for beyond those: the colour change of "ฝุ่นตก" (11-world-changes §1.2), the old name struck and
 * the new one written ("ชื่อใหม่", §1.2 beat 5) and the held last frame ("ค้างภาพสุดท้ายหนึ่งวินาที", 17-local-event-visuals §1)).
 */
export const BEAT_KINDS = ['bg', 'actor', 'camera', 'light', 'fx', 'tone', 'text', 'strike', 'sound', 'hold'] as const;
export type BeatKind = (typeof BEAT_KINDS)[number];

/** Particles the docs name: ash and snow, embers, rain, leaves, dust, fog, motes of light, smoke, sparks, petals, water, scales/feathers. */
export const FX_KINDS = ['ash', 'embers', 'snow', 'rain', 'leaves', 'dust', 'fog', 'motes', 'smoke', 'sparks', 'petals', 'water', 'feathers'] as const;
export type FxKind = (typeof FX_KINDS)[number];

export type Pose = 'stand' | 'walk' | 'kneel' | 'lie' | 'raise' | 'bow' | 'fall';
/** 13-storyline-scenes §1 "แสง": a pass is warm light from in front, a fail cold light from behind, a tie even light. */
export type LightMode = 'warm-front' | 'cold-back' | 'diffuse' | 'glow' | 'dim';
/** 13 §1 "กล้อง": eye level of one character; `high` is the map view of 11-world-changes §1.2 beat 3. */
export type CameraFrame = 'wide' | 'eye' | 'high' | 'close';
export type TextRole = 'title' | 'line' | 'result' | 'stage' | 'name';

/** Seconds from the start of the scene (or of the variant). `dur` omitted: until the end of the scene. */
interface Timed {
  at: number;
  dur?: number;
}

export type Beat = Timed &
  (
    | { k: 'bg'; place: string; sky: string; ground: string }
    | { k: 'actor'; id: string; label: string; x: number; pose: Pose; tint?: string; count?: number }
    | { k: 'camera'; frame: CameraFrame; x?: number; zoom?: number }
    | { k: 'light'; mode: LightMode; color?: string }
    | { k: 'fx'; kind: FxKind; amount: number; color?: string }
    | { k: 'tone'; sky?: string; ground?: string; wash?: string; amount?: number }
    | { k: 'text'; role: TextRole; text: string }
    | { k: 'strike'; from: string; to: string }
    | { k: 'sound'; cue: string }
    | { k: 'hold' }
  );

export type SceneKind = 'world' | 'change' | 'fall' | 'ending' | 'rite' | 'destination' | 'line' | 'node' | 'clash' | 'ally' | 'local' | 'lastEra' | 'miracle';

/** The part of a scene that depends on a result (a rite passed or failed, the way a clash ended); it plays after the common beats. */
export interface SceneVariant {
  seconds: number;
  beats: Beat[];
}

export interface SceneScript {
  /** Key the mapping looks up: an event id (`DR-01`), `rite.hu`, `dest.hu`, `NF-AZ02-1`, `bn.b1`, `mr.MR-01` ... */
  id: string;
  kind: SceneKind;
  title: string;
  /** Border colour (12-event-visuals "สีกรอบการ์ดตามหมวด"). */
  frame: string;
  seconds: number;
  beats: Beat[];
  variants?: Record<string, SceneVariant>;
  src: string;
}

/** The four forms of showing an event (12-event-visuals "รูปแบบการแสดง 4 แบบ"). */
export type EventForm = 'X' | 'M' | 'L' | 'C';

/** A category of the card border (12-event-visuals "สีกรอบการ์ดตามหมวด"). */
export interface FrameDef {
  group: string;
  name: string;
  color: string;
  icon: string;
  sound: string;
}

/** One world or local event as the card shows it: the colour, the corner marks and what the picture slot holds. */
export interface CardDef {
  id: string;
  name: string;
  /** ⭐ ● ○ or empty (the size of the effect). */
  mark: '⭐' | '●' | '○' | '';
  group: string;
  form: EventForm;
  /** Border colour: of the category, or of the new continent for the events after a transformation. */
  frame: string;
  icon: string;
  sound: string;
  /** The doc's words for the picture; the placeholder draws particles from them. */
  picture: string;
  fx: FxKind[];
  sky: string;
  /** The event has its own script in `scripts` (forms X and L). */
  script: boolean;
  src: string;
}

export interface ScenesData {
  frames: FrameDef[];
  forms: { code: EventForm; name: string; size: string; use: string }[];
  cards: CardDef[];
  scripts: SceneScript[];
  /** Inner line colour of each continent (17-local-event-visuals §2). */
  continents: { id: string; name: string; color: string }[];
  /** The five-beat grammar of the day of the event (11-world-changes §1.2) with its seconds. */
  grammar: { n: number; name: string; from: number; to: number; what: string }[];
}

export type ScenesFile = GenFile<ScenesData>;
