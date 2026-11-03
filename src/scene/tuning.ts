// The numbers of the scene player that the docs do not give (code-plan §2.3 rule 3: one tuning file per system).
import type { CameraFrame, LightMode, Pose } from '../core/data/types-scenes';

/** The stage is 16:9. */
export const STAGE = { ratio: 16 / 9, maxWidth: 960 } as const;

/** Speeds the player offers; 1 is real time. */
export const SPEEDS = [1, 2, 4] as const;

/** The player moves its time by the real time since the last frame, at most this long (a stopped tab does not skip a scene). */
export const MAX_STEP = 0.1;

/** Fade of a line of text in and out, seconds. */
export const TEXT_FADE = 0.3;

/** Seconds a character takes to walk from where it stood to where a later beat puts it. */
export const MOVE_TIME = 0.6;

/** Where each camera frame points: zoom, and how far the picture is lowered (a high view looks down on the world). */
export const CAMERA: Record<CameraFrame, { zoom: number; lift: number }> = {
  wide: { zoom: 1, lift: 0 },
  eye: { zoom: 1.12, lift: 0 },
  high: { zoom: 0.86, lift: 0.06 },
  close: { zoom: 1.5, lift: -0.04 },
};

/** The light of a scene (13-storyline-scenes §1 "แสง"): colour, strength, and where it comes from. */
export const LIGHT: Record<LightMode, { color: string; alpha: number; from: 'front' | 'back' | 'all' | 'centre' }> = {
  'warm-front': { color: '#ffd89a', alpha: 0.42, from: 'front' },
  'cold-back': { color: '#7a96d8', alpha: 0.4, from: 'back' },
  diffuse: { color: '#ffffff', alpha: 0.08, from: 'all' },
  glow: { color: '#fff0c0', alpha: 0.3, from: 'centre' },
  dim: { color: '#000000', alpha: 0.38, from: 'all' },
};

/** The placeholder silhouette per pose: rotation (deg), drop as a share of the figure height, scale, and whether an arm is raised. */
export const POSE: Record<Pose, { rot: number; drop: number; scale: number; arm: number }> = {
  stand: { rot: 0, drop: 0, scale: 1, arm: 0 },
  walk: { rot: 6, drop: 0, scale: 1, arm: 0 },
  kneel: { rot: 0, drop: 0.2, scale: 0.8, arm: 0 },
  lie: { rot: 88, drop: 0.28, scale: 0.9, arm: 0 },
  raise: { rot: 0, drop: 0, scale: 1, arm: 1 },
  bow: { rot: 22, drop: 0.04, scale: 1, arm: 0 },
  fall: { rot: 70, drop: 0.22, scale: 0.95, arm: 0 },
};

/** Particles per unit of `amount`, and their pace (stage heights per second). */
export const FX = { perAmount: 70, fogPerAmount: 7, pace: 0.09 } as const;

/** The slot for a character: height and width as a share of the stage height, and the scale of a figure in a crowd. */
export const FIGURE = { height: 0.5, width: 0.16, crowdScale: 0.72 } as const;

/** The words of the player's own controls (not game text). */
export const WORDS = { play: 'เล่น', pause: 'หยุด', skip: 'ข้าม', speed: 'ความเร็ว', again: 'ดูอีกครั้ง', layer: 'ชั้นแผนที่', close: 'ปิด' } as const;

// ---------- the Phaser stage (M7 ก1) ----------

/** The stage in art pixels (docs/appearance/21-pixel-art.md §4); shown at the largest whole multiple that fits its box. Same numbers as the scenery contract. */
export const ART = { w: 320, h: 180, groundY: 150 } as const;

/** The camera of the pixel stage. Zoom is kept to whole steps (a pixel stretched to 1.12 draws uneven), so a frame's eased zoom snaps: at or over `snapAt` the view is `close` times. */
export const VIEW = { snapAt: 1.3, close: 2, panPx: 48, focusY: ART.groundY - 30, slack: 4 } as const;

/** Crowd: art pixels between two figures of a crowd, and the rows a crowd is staggered over (each row one pixel row deeper). */
export const CROWD = { gap: 17, rows: 3 } as const;

/** The size of text over the stage, in screen pixels per art pixel (so a word keeps its place in the picture at any multiple) and the smallest size ever drawn. */
export const TEXT = { title: 9, name: 13, strike: 8, strikeTo: 14, line: 6.5, result: 7, stage: 4.5, label: 4, min: 11 } as const;

/** How strongly the mood colours of the beats (`bg` and `tone`) tint the painted layers: over the sky rows and over the ground rows. The beats' colours are the story's mood; the painter's are the place. */
export const MOOD = { sky: 0.4, ground: 0.4 } as const;

/** The bands of the light overlays (an even gradient would break the pixel look): how many steps from full strength to none. */
export const LIGHT_BANDS = 6;

/** How much of an actor's `tint` colour is mixed into its sprite (a cast, not a stain), and of the place's light into everyone. */
export const CAST = { tint: 0.45, place: 0.12 } as const;

/** The soft shadow under a figure: width as a share of the figure's frame width, alpha. */
export const SHADOW = { alpha: 0.32, w: 14, h: 4 } as const;

/** How many painted backgrounds the stage keeps (the layers of a place are painted once; the oldest unused goes when a ninth would come). */
export const SCENERY_KEEP = 8;

/** Depths on the stage, back to front: painted layers, mood, shadows, figures (plus the row of their feet), light and wash. */
export const DEPTH = { layer: 0, mood: 40, shadow: 50, figure: 100, light: 10000, wash: 10001 } as const;

/** The placeholder silhouette in art pixels: the canvas, and where the raised arm ends. */
export const SIL = { w: 24, h: 40, head: 4, cloakTop: 10 } as const;
