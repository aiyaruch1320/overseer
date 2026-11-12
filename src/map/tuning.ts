// Numbers and colours the map code needs that the docs do not give, in one place (code-plan §2 rule 3). What the docs do give (the five zoom levels
// and their limits, the sheet size, the UI colours of the continents) is read from data/gen at run time; the values here are only the fall-backs.

export const WU = 3.84; // world units per map unit (world-map.md)
export const SHEET = { w: 1600, h: 900 };

/** Zoom levels (world-map.md §3). `data.continents.items.world.zoomLevels` has the same limits; these are used when the data is not loaded. */
export const ZOOM_LEVELS = [
  { id: 'world', min: 0, max: 0.33 },
  { id: 'continent', min: 0.33, max: 0.75 },
  { id: 'country', min: 0.75, max: 6.25 },
  { id: 'city', min: 6.25, max: 16 },
  { id: 'inside', min: 16, max: 50 },
] as const;
export type ZoomId = (typeof ZOOM_LEVELS)[number]['id'];
/**
 * The camera never goes outside this (the last level ends at 50). The art contract (21-pixel-art.md §4): the town and in-town levels are pixel art at
 * 1× to 8× (town 24 art px per MU = 6.25 camera zoom per art zoom, so 6.25 → 1× and 50 → 8×), and the prebuilt pictures of the world, continent and
 * country levels are never shown smaller than 1× (the picture of a level is made at the density of the lowest zoom of that level).
 */
export const CAM_MIN = 0.16;
export const CAM_MAX = 50;
/** Art pixels per MU of the town ground and its sprites: one art pixel is 1/TOWN_PX MU. */
export const TOWN_PX = 24;
/**
 * The people of the town and in-town levels (21-pixel-art.md §2, review/play-1/proposal.md M1): drawn at half the size of the scene (an adult 14 art px), so a house of
 * one floor stands about twice a person and a tree over them; they walk at half the speed, keep half the room, and there are more of them per house.
 */
export const TOWN_PEOPLE = { scale: 0.5, perHouse: 1.5, space: 7 } as const;
/** Side in MU of one chunk of the ground painted at the density of the town round a town. */
export const GROUND_CHUNK = 12;
/** Camera zoom at which one town art pixel is one screen pixel (art zoom 1×). */
export const ART_ONE = (TOWN_PX / 3.84);
/** Country plans start to show on the country level from this zoom (world-map.md: "ผังเมืองเริ่มโผล่บนแผนที่ตั้งแต่ 0.9"). */
export const PLAN_FROM = 0.9;

/** Land grid cell in MU. */
export const GRID_CELL = 2;
export const LAYOUT_SEED = 1017;
/** Plan of one town in MU: 120 world units wide (world-map.md §3), the aspect of the 162 × 101 tile plan. */
export const CITY_W = 120 / WU;
export const CITY_H = (CITY_W * 101) / 162;
/** How far apart towns of a country stand, in plan sizes. */
export const TOWN_SPACING = 0.95;

/** Pixels per MU of the tile of each level (the tile is painted once at this size and cached). */
export const TILE_PX: Record<ZoomId, number> = { world: CAM_MIN * WU, continent: 0.33 * WU, country: 0.75 * WU, city: TOWN_PX, inside: TOWN_PX };
/** MU added around a continent/country box on its tile. */
export const TILE_PAD: Record<ZoomId, number> = { world: 0, continent: 14, country: 8, city: 0, inside: 0 };
/** Tiles kept at once in the scene (oldest dropped). */
export const TILE_KEEP = 14;

/** Ground colour of each continent (the land under the zone tints) and the sea round it. The UI palettes of the docs colour labels, borders and accents. */
export const GROUND: Record<string, string> = {
  AZ: '#9ac37a', MH: '#a89a68', KD: '#3c302c', NR: '#86ab68', AL: '#7ab35a', MK: '#8e918a', SH: '#d6b062', SV: '#2f6c3c', NB: '#8c938f',
};
export const SEA = { deep: '#14355a', mid: '#1f4f7c', shallow: '#3b86a8', foam: '#d8ece8' };
export const SKY = '#a8c8ea'; // the air round the floating islands

/** Zone colours (geo.ts zones). */
export const ZONE_COLOR: Record<string, string> = {
  mountain: '#8a8a86', highland: '#9a9272', forest: '#2c6a3a', dune: '#e0b868', sand: '#dcc088', glass: '#7ac0c8', lava: '#d9531f', ash: '#6a6460',
  swamp: '#5a7a4a', farm: '#b8c868', grass: '#8cc060', fog: '#aab0b4', pit: '#241616', ruin: '#85868a', oasis: '#4a9a6a', badland: '#9a6a48',
  tree: '#1e5a2e', city: '#b0a890', crater: '#4a3a36',
};

/** What a ruined country is painted (20-god-ui.md §7.4). */
export const RUIN = { fill: '#5a5650', pit: '#121014', glass: '#2a2e34', water: '#16403c', strike: '#8a2433', label: '#9a9486' };

/**
 * The eight forms of a changed continent (11-world-changes.md §2): the event that makes the form, the continent it changes, the name the map writes
 * for it, and the colours after (the same five slots as the UI colours of a continent). Proposal: generate this table from the document.
 */
export interface FateDef {
  id: FateId;
  event: string;
  continent: string; // `*` for the coasts of every continent
  name: string;
  after: string[];
  /** How far the ground colour moves toward `after[0]` (0..1). */
  tint: number;
  /** Colour of the land the ground is moved to. */
  ground: string;
}
export type FateId = 'skyfall' | 'ash' | 'flood' | 'split' | 'withered' | 'rust' | 'light' | 'fog';
export const FATES: FateDef[] = [
  { id: 'skyfall', event: 'DR-01', continent: 'AZ', name: 'สกายฟอลล์', after: ['#6a6a70', '#8a7a62', '#3a4a5a', '#c8b890', '#1a1a22'], tint: 0.8, ground: '#7c7566' },
  { id: 'ash', event: 'DR-04', continent: 'KD', name: 'ทวีปเถ้า', after: ['#8a8a86', '#4a4a4e', '#c8d0d8', '#2a2a2e', '#5a6a7a'], tint: 0.85, ground: '#8f9094' },
  { id: 'flood', event: 'DR-05', continent: '*', name: 'ทุ่งจม', after: ['#3a5a6a', '#8a9a94', '#c8c0a0', '#4a4a40', '#2a3a44'], tint: 0.7, ground: '#5f7f7a' },
  { id: 'split', event: 'DR-07', continent: 'AL', name: 'ทุ่งแยก', after: ['#7a8a6a', '#a89878', '#6a5a4a', '#d8d4c8', '#5a6a7a'], tint: 0.6, ground: '#8a8a60' },
  { id: 'withered', event: 'BIO-02', continent: 'SV', name: 'ป่าเหี่ยว', after: ['#5a5a50', '#8a8a70', '#3a3a30', '#a8a890', '#7a8a7a'], tint: 0.85, ground: '#6a6a50' },
  { id: 'rust', event: 'MC-04', continent: 'MK', name: 'ดินแดนสนิม', after: ['#6a4a2a', '#7a3a22', '#3a3030', '#8a8a70', '#4a8a6a'], tint: 0.85, ground: '#7a4a2a' },
  { id: 'light', event: 'BIO-05', continent: 'NB', name: 'ทวีปแสง', after: ['#e8e0c0', '#d8b060', '#a8c0d8', '#8a6a4a', '#4a6a4a'], tint: 0.75, ground: '#d6cba0' },
  { id: 'fog', event: 'FG-11', continent: 'NB', name: 'ดินแดนหมอกกลืน', after: ['#2a2a30', '#4a4a52', '#6a6a74', '#e8e8f0', '#1a1a22'], tint: 0.9, ground: '#3a3a44' },
];
export const FATE_BY_ID = Object.fromEntries(FATES.map((f) => [f.id, f])) as Record<FateId, FateDef>;

/** Where each of the fifteen dragons sleeps (lore/dragons/README.md, the "ที่อยู่" column): the country, and a second one when the table gives two. */
export const DRAGON_BEDS: string[][] = [
  ['AZ-01'], ['AZ-02'], ['AZ-06', 'NR-04'], ['AZ-03'], ['AZ-04'], ['AZ-05'], ['AZ-07'], ['MH-10'], ['KD-10'], ['NR-04'], ['AL-14'], ['MK-01'], ['SH-03', 'SH-17'], ['SV-01', 'SV-13'], ['NB-08'],
];
/** Scale colour of each dragon (03-dragons.md, the UI table): the glow of the eye and the shadow. */
export const DRAGON_COLOR: string[] = [
  '#d8d4cc', '#e0662a', '#7ac0d8', '#d8e8f0', '#8a8a86', '#d8b040', '#f0ece0', '#a01818', '#ff8a2a', '#7ac0d8', '#8a7a4a', '#6ad0ff', '#8a7a62', '#e0c060', '#d8dce0',
];

/** Colours of the omen circle by the line that paid (20-god-ui.md §1). */
/** How many world years the mark of a small or middle miracle stays on the map after its day (20-god-ui.md §7.3: the effect shows where it fell). */
export const EFFECT_MARK_YEARS = 1;

export const OMEN_COLOR = { faith: '#e8c36a', dread: '#8a2433', fate: '#b8c0cc' } as const;

/** Sizes of the labels in screen pixels and the zoom at which each kind appears. */
export const LABEL = { continent: 30, country: 17, city: 13, small: 11 };

/** Layers of the Phaser scene, back to front (code-plan §8.4). */
export const DEPTH = { terrain: 0, borders: 10, fate: 15, ruins: 20, town: 22, cities: 30, labels: 40, dragons: 45, omens: 50, character: 60, cursor: 70 } as const;

/** The camera moves this many screen pixels per second on the arrow keys, and zooms by this factor per wheel notch. */
export const PAN_SPEED = 700;
export const WHEEL_ZOOM = 1.12;
export const KEY_ZOOM = 1.9;

/** Size category of each dragon in MU of the shadow it casts (03-dragons.md UI table: S M L XL). */
export const DRAGON_SIZE: number[] = [16, 11, 11, 7, 7, 11, 11, 11, 16, 16, 16, 11, 16, 16, 16];
