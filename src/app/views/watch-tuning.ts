// Numbers of the watch screen that the docs do not set (code-plan §2 rule 3).

/** How long a glowing window counts as open on the life line, in life years (20-god-ui.md §2 "จนหน้าต่างผ่านไป": the docs give no length). */
export const GLOW_OPEN_YEARS = 1;

/** Lines of the recap on a stop panel (07-attention.md §2: "สรุปช่วงที่ผ่านมา"; the docs give no length). */
export const RECAP_MAX = 6;

/** The candle never shrinks below this share of its height, so a hated god still sees a flame (20-god-ui.md §2). */
export const CANDLE_MIN_FILL = 0.06;

/** Key of the player's own display choices (not part of the save of the game). */
export const PREFS_KEY = 'overseer.prefs.1';

/** At most this many items in the "now" box (proposal G1: one to three). */
export const NOW_MAX = 3;
