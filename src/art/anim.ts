// The poses of a sheet and their timing (docs/appearance/21-pixel-art.md §3), and where each frame sits on the sheet.

export type Pose = 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'die' | 'work' | 'sit' | 'pray' | 'cheer';

export const POSES: readonly { id: Pose; n: number; ms: number; loop: boolean }[] = [
  { id: 'idle', n: 2, ms: 520, loop: true },
  { id: 'walk', n: 4, ms: 130, loop: true },
  { id: 'attack', n: 3, ms: 150, loop: false },
  { id: 'cast', n: 3, ms: 160, loop: false },
  { id: 'hurt', n: 2, ms: 120, loop: false },
  { id: 'die', n: 3, ms: 200, loop: false },
  { id: 'work', n: 3, ms: 220, loop: true },
  { id: 'sit', n: 1, ms: 1000, loop: true },
  { id: 'pray', n: 2, ms: 600, loop: true },
  { id: 'cheer', n: 2, ms: 260, loop: true },
];
export const POSE_OF = Object.fromEntries(POSES.map((p) => [p.id, p])) as Record<Pose, (typeof POSES)[number]>;

/** A person's frame in art pixels: 48 × 48 with the feet on row 44 (21-pixel-art.md §2). */
export const FRAME = { w: 48, h: 48, foot: 44 } as const;
/** Frames per row of a sheet (the longest pose); one row per pose in the order of POSES. */
export const SHEET_COLS = 4;

export const frameIndex = (pose: Pose, i: number): number => POSES.findIndex((p) => p.id === pose) * SHEET_COLS + i;

/** The frame of a pose `ms` after it began: a loop wraps, a one-shot holds its last frame. */
export function frameAt(pose: Pose, ms: number): number {
  const p = POSE_OF[pose], i = Math.floor(Math.max(0, ms) / p.ms);
  return p.loop ? i % p.n : Math.min(p.n - 1, i);
}
