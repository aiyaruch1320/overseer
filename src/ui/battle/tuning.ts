// Measures of the battle view that no document sets: the pace of the playback and the frame of the stage. Colours and sizes of text are tokens.ts.

/** Milliseconds a beat stays on the screen at speed 1; the meeting stays a little longer. */
export const BEAT_MS = 1600;
export const MEET_MS = 1800;
export const SPEEDS = [1, 2, 4] as const;

/** The stage: its height and where the two figures stand (share of the width). */
export const STAGE = { height: 236, heroX: 0.26, foeX: 0.74, fleeX: 0.06 } as const;
/** Figure heights as a share of the stage: an ordinary foe, a boss or a legend. */
export const FIGURE = { hero: 0.62, foe: 0.62, heavy: 0.86 } as const;
