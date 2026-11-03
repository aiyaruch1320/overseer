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
