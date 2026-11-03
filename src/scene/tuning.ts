// The numbers of the scene player that the docs do not give (code-plan §2.3 rule 3: one tuning file per system).
import type { CameraFrame, FxKind, LightMode, Pose } from '../core/data/types-scenes';

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
export const LIGHT: Record<LightMode, { color: string; alpha: number; from: 'front' | 'back' | 'all' | 'centre'; add: boolean }> = {
  'warm-front': { color: '#ffd89a', alpha: 0.24, from: 'front', add: true },
  'cold-back': { color: '#7a96d8', alpha: 0.28, from: 'back', add: true },
  diffuse: { color: '#ffffff', alpha: 0.06, from: 'all', add: true },
  glow: { color: '#fff0c0', alpha: 0.14, from: 'centre', add: true },
  dim: { color: '#000000', alpha: 0.32, from: 'all', add: false },
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
export const DEPTH = { layer: 0, mood: 40, shadow: 50, figure: 100, fx: 9000, light: 10000, wash: 10002 } as const;

/** The placeholder silhouette in art pixels: the canvas, and where the raised arm ends. */
export const SIL = { w: 24, h: 40, head: 4, cloakTop: 10 } as const;

// ---------- the pixel effects (M7 ก3; 21-pixel-art.md §5, 20-god-ui.md §1) ----------

/**
 * How one kind of particle looks and moves, in art pixels and seconds. `model` is how it lives: `drift` wraps across the picture (falls, floats), `ember` is born
 * low and rises while it cools through `colors` (hot first), `burst` is a shower from a point that falls back under gravity, `spray` a fountain that repeats the same arcs,
 * `plume` a soft blob that rises from a fixed foot and grows, `band` a wide soft strip of fog that slides along. `vy` is down-positive. `shape` is what one particle is drawn as.
 */
export interface FxLook {
  model: 'drift' | 'ember' | 'burst' | 'spray' | 'plume' | 'band';
  shape: 'dot' | 'streak' | 'tumble' | 'twinkle' | 'blob';
  /** Particles at amount 1 (bands, plumes: blobs). */
  count: number;
  colors: readonly string[];
  /** Light is added to what is behind it; smoke and dust only cover it. */
  add: boolean;
  alpha: readonly [number, number];
  vy: readonly [number, number];
  vx: readonly [number, number];
  /** Sideways wobble: how far (px) and how fast (rad/s). */
  sway: readonly [number, number];
  /** Seconds a particle lives before it is born again (ember burst plume). */
  life: readonly [number, number];
  /** Dots: the nearest tenth is this many pixels wide. Blobs: the radius at birth and at death (a band: its half width, from the thinnest to the widest). Streaks and tumblers: pixels long. */
  size: readonly [number, number];
}

export const FX_LOOK: Record<FxKind, FxLook> = {
  ash: { model: 'drift', shape: 'dot', count: 120, colors: ['#b8b4ac', '#8e8a84', '#d0ccc4'], add: false, alpha: [0.45, 0.9], vy: [8, 22], vx: [-5, 4], sway: [3, 1.2], life: [0, 0], size: [1, 2] },
  embers: { model: 'ember', shape: 'dot', count: 80, colors: ['#ffe6a0', '#ffb040', '#ff7a2a', '#e0521e', '#a02e16'], add: true, alpha: [0.85, 1], vy: [-30, -10], vx: [-4, 6], sway: [4, 2.2], life: [2.6, 4.6], size: [1, 2] },
  snow: { model: 'drift', shape: 'dot', count: 130, colors: ['#f0f4fa', '#d8e4f4'], add: false, alpha: [0.6, 1], vy: [10, 26], vx: [-4, 4], sway: [5, 1], life: [0, 0], size: [1, 2] },
  rain: { model: 'drift', shape: 'streak', count: 90, colors: ['#a8c4e8', '#7a96c0'], add: false, alpha: [0.35, 0.75], vy: [220, 300], vx: [-46, -38], sway: [0, 0], life: [0, 0], size: [3, 5] },
  leaves: { model: 'drift', shape: 'tumble', count: 40, colors: ['#6aa05a', '#8ab05a', '#b08a3a', '#a05a2a'], add: false, alpha: [0.8, 1], vy: [10, 22], vx: [-16, 14], sway: [12, 2], life: [0, 0], size: [3, 3] },
  dust: { model: 'drift', shape: 'twinkle', count: 110, colors: ['#d8c498', '#b8a47a', '#f0e0b8'], add: false, alpha: [0.5, 1], vy: [-2, 4], vx: [5, 13], sway: [4, 1], life: [0, 0], size: [1, 1] },
  fog: { model: 'band', shape: 'blob', count: 7, colors: ['#d4d6dc'], add: false, alpha: [0.1, 0.18], vy: [0, 0], vx: [3, 8], sway: [0, 0], life: [0, 0], size: [60, 100] },
  motes: { model: 'drift', shape: 'twinkle', count: 50, colors: ['#fff2c0', '#ffe6a0', '#e8c36a'], add: true, alpha: [0.5, 1], vy: [-8, -2], vx: [-3, 3], sway: [6, 0.9], life: [0, 0], size: [1, 1] },
  smoke: { model: 'plume', shape: 'blob', count: 12, colors: ['#6a6a72', '#54545c', '#84848c'], add: false, alpha: [0.35, 0.6], vy: [-18, -9], vx: [2, 6], sway: [5, 1], life: [4, 7], size: [9, 26] },
  sparks: { model: 'burst', shape: 'dot', count: 56, colors: ['#fff6d0', '#ffd070', '#ff9a3a', '#c0501e'], add: true, alpha: [0.8, 1], vy: [0, 0], vx: [0, 0], sway: [0, 0], life: [0.6, 1.2], size: [1, 1] },
  petals: { model: 'drift', shape: 'tumble', count: 44, colors: ['#f0b8c8', '#e89ab0', '#f8d0dc'], add: false, alpha: [0.85, 1], vy: [10, 20], vx: [4, 16], sway: [10, 1.6], life: [0, 0], size: [3, 3] },
  water: { model: 'spray', shape: 'dot', count: 120, colors: ['#d8f0fc', '#8fc4e8', '#6aa8d8'], add: false, alpha: [0.6, 0.95], vy: [0, 0], vx: [0, 0], sway: [0, 0], life: [0, 0], size: [1, 1] },
  feathers: { model: 'drift', shape: 'tumble', count: 30, colors: ['#f0eadc', '#d8d0c0'], add: false, alpha: [0.7, 1], vy: [6, 14], vx: [-6, 6], sway: [14, 1.3], life: [0, 0], size: [4, 4] },
};

/** The place's own `ambient` particle, when it names an effect: a few of them, faint, under the beats' own. */
export const AMBIENT = { amount: 0.3, alpha: 0.5 } as const;

/** Art pixels past the edge of the picture where a drifting particle wraps (so it is never seen to jump). */
export const FX_PAD = 12;
/** Gravity of sparks and water, px/s². */
export const FX_GRAVITY = { sparks: 140, water: 130 } as const;

/** The three colours of the god's powers (20-god-ui.md §1) and how near a `glow` colour must be (RGB distance) to be taken for one. */
export const GOD = { faith: '#e8c36a', dread: '#8a2433', fate: '#b8c0cc', near: 30 } as const;

/**
 * The effects of the god's powers (drawn when the beat's `glow` light is one of the three colours): the pillar of faith light (half width at the top and at the ground, the
 * shake of its rim, how many gold embers rise), the dread (the red then black core, the smoke on its rim), the fate (threads, stitches of the ring).
 */
export const GOD_FX = {
  centre: { x: ART.w / 2, y: 112 },
  pillar: { top: 5, ground: 15, shake: 1.6, embers: 22, alpha: 0.2, core: 0.3 },
  dread: { rx: 100, ry: 64, core: 54, smoke: 12 },
  fate: { threads: [-19, 0, 18], ringRx: 92, ringRy: 20, stitches: 56, end: 124 },
} as const;
