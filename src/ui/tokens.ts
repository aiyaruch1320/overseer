// The one set of colours, sizes and fonts of every screen (code-plan §8.1 rule 3), from docs/appearance/20-god-ui.md §1.
// The UI values of a continent (docs/appearance/01-continents.md) come from the data at run time, not from here.

/** Colours of the god's hand and the panels (20-god-ui.md §1 table). */
export const color = {
  light: '#e8c36a', // แสงศรัทธา: power of making, blessings, holy things
  dread: '#8a2433', // ความหวาดกลัว: power of breaking, curses
  fate: '#b8c0cc', // ลิขิต: bending events
  dream: '#2e2a5a', // ฝัน
  dreamMist: '#6a5a9a',
  panel: '#0e0f14', // พื้นหลังของพระเจ้า
  text: '#e6e0d0', // ตัวอักษร
  textDim: '#9a9486',
  line: '#2a2c36',
} as const;

/** Frames of the rarity of a thing in the chest, the same as the weapons (20-god-ui.md §1, 05-weapons-rules.md). */
export const rarity = { C: '#a0a0a8', U: '#6aa05a', E: '#a05ac8', L: '#d8a030' } as const;

export const font = {
  body: '"Sarabun", "Noto Sans Thai", system-ui, sans-serif',
  title: '"Charm", "Sarabun", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

/** Sizes in px. The smallest screen is 1280 × 720 (code-plan §8.1 rule 4). */
export const size = {
  text: 15,
  small: 13,
  title: 22,
  gap: 8,
  pad: 12,
  radius: 6,
  minWidth: 1280,
  minHeight: 720,
} as const;

/** The god's effects tremble at the edge "like a flame in the wind" (20-god-ui.md §1). */
export const motion = { flicker: '2.4s', fade: '0.25s' } as const;
