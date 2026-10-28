// The shape of the world, authored from docs/continents.md §12 and docs/world-politics.md.
// Everything is in "map units" (MU) on a 1600 × 900 sheet; 1 MU = 3.84 world units (the sim's tile grid is 768 × 432).
// The same field function drives the sim's tile grid and the vector coastlines, so towns always sit on drawn land.
import { makeNoise } from '../sim/rng';

export const MAP_MW = 1600;
export const MAP_MH = 900;
export const MU_TO_WU = 3.84;

export type ZoneKind =
  | 'mountain' | 'highland' | 'forest' | 'dune' | 'sand' | 'glass' | 'lava' | 'ash' | 'swamp' | 'farm' | 'grass' | 'fog'
  | 'pit' | 'ruin' | 'oasis' | 'badland' | 'tree' | 'city' | 'crater';

export interface Blob { x: number; y: number; rx: number; ry: number; rot?: number }
export interface Cap { x1: number; y1: number; x2: number; y2: number; w: number }
export interface Zone extends Blob { kind: ZoneKind; s?: number }
export interface LandDef {
  key: string;
  cont: number; // continent index (docs order: 0 อัซการ์ … 8 เนบูเลีย)
  country?: number; // single-country island: country index inside its continent
  blobs: Blob[];
  caps?: Cap[]; // thick line segments (necks of land)
  cuts?: Blob[]; // water carved out of the land (lakes, bays)
  zones?: Zone[];
  bridge?: boolean; // land neck between two continents (a ground route in the docs); never carved by its neighbours
  float?: boolean; // sky island
  amp?: number; // coastline roughness multiplier
}

export const CONT = { azgar: 0, morhaven: 1, kazdurum: 2, nerea: 3, aldria: 4, mecharia: 5, saharan: 6, silvanel: 7, nebulia: 8 } as const;

const b = (x: number, y: number, rx: number, ry: number, rot = 0): Blob => ({ x, y, rx, ry, rot });
const z = (kind: ZoneKind, x: number, y: number, rx: number, ry: number, s = 1, rot = 0): Zone => ({ kind, x, y, rx, ry, rot, s });

// ---- solid continents ----
const ALDRIA: LandDef = {
  key: 'aldria', cont: CONT.aldria, amp: 1.1,
  blobs: [b(735, 440, 178, 126), b(620, 492, 105, 88, 0.3), b(838, 385, 142, 96, -0.2), b(780, 545, 155, 72), b(890, 495, 108, 86), b(568, 418, 66, 62), b(700, 330, 76, 40, 0.1), b(935, 430, 74, 54, 0.5)],
  cuts: [b(700, 425, 34, 19, 0.4), b(838, 500, 22, 12, -0.3), b(625, 500, 16, 10), b(655, 620, 40, 28, 0.2), b(540, 505, 24, 18), b(990, 455, 24, 17)],
  zones: [
    z('farm', 780, 505, 150, 70), z('farm', 650, 410, 90, 60), z('grass', 870, 420, 120, 80),
    z('forest', 565, 430, 50, 60), z('highland', 920, 360, 60, 50), z('city', 735, 440, 46, 34),
  ],
};
const SILVANEL: LandDef = {
  key: 'silvanel', cont: CONT.silvanel, amp: 1.2,
  blobs: [b(250, 262, 140, 122), b(345, 200, 105, 72, -0.2), b(238, 392, 105, 66), b(150, 305, 80, 95), b(402, 345, 72, 66), b(452, 425, 52, 40, 0.2), b(470, 190, 62, 26, -0.12), b(120, 200, 55, 62)],
  cuts: [b(160, 385, 26, 18, 0.5), b(330, 290, 22, 14), b(62, 330, 40, 26), b(280, 108, 34, 20), b(380, 255, 24, 16)],
  zones: [z('forest', 255, 265, 190, 160), z('tree', 265, 280, 56, 50), z('swamp', 150, 405, 55, 28), z('highland', 405, 345, 45, 40)],
};
const NEBULIA: LandDef = {
  key: 'nebulia', cont: CONT.nebulia, amp: 1.1,
  blobs: [b(650, 140, 130, 60), b(770, 135, 150, 66), b(885, 150, 100, 58), b(580, 170, 70, 40)],
  cuts: [b(705, 150, 44, 20), b(640, 95, 36, 20), b(890, 105, 30, 16)],
  zones: [z('fog', 735, 140, 240, 90), z('pit', 705, 150, 50, 26), z('swamp', 620, 170, 60, 30), z('swamp', 870, 160, 60, 30)],
};
const MECHARIA: LandDef = {
  key: 'mecharia', cont: CONT.mecharia, amp: 0.85,
  blobs: [b(1135, 240, 140, 98), b(1090, 345, 102, 62), b(1245, 180, 85, 66), b(1195, 330, 92, 60), b(1050, 262, 46, 46)],
  cuts: [b(1170, 258, 22, 14), b(1318, 285, 28, 20), b(1020, 300, 20, 16)],
  zones: [z('city', 1150, 255, 120, 90), z('farm', 1220, 335, 70, 45), z('ruin', 1115, 305, 38, 30), z('highland', 1255, 175, 60, 50), z('badland', 1085, 350, 50, 35)],
};
const SAHARAN: LandDef = {
  key: 'saharan', cont: CONT.saharan, amp: 1.05,
  blobs: [b(1215, 575, 126, 132), b(1100, 515, 70, 60), b(1265, 660, 82, 62), b(1180, 650, 70, 58)],
  cuts: [b(1335, 690, 38, 26), b(1120, 640, 24, 18)],
  zones: [
    z('mountain', 1255, 490, 90, 50), z('mountain', 1300, 550, 50, 90), z('highland', 1150, 480, 60, 40),
    z('dune', 1170, 650, 120, 70), z('glass', 1240, 700, 60, 40), z('oasis', 1180, 570, 12, 10), z('oasis', 1250, 620, 10, 8), z('sand', 1200, 580, 140, 130),
  ],
};
const KAZDURUM: LandDef = {
  key: 'kazdurum', cont: CONT.kazdurum, amp: 1.0,
  blobs: [b(905, 740, 125, 75), b(1015, 715, 92, 60), b(795, 800, 85, 40), b(960, 790, 100, 42)],
  cuts: [b(955, 815, 46, 16)],
  zones: [z('lava', 930, 750, 90, 50), z('crater', 1010, 715, 40, 30), z('ash', 1040, 725, 60, 45), z('highland', 850, 750, 50, 35), z('pit', 770, 805, 28, 20)],
};
const MORHAVEN: LandDef = {
  key: 'morhaven', cont: CONT.morhaven, amp: 1.4,
  blobs: [b(215, 655, 150, 115), b(130, 565, 85, 60), b(345, 735, 125, 80), b(470, 800, 135, 38), b(590, 815, 95, 30)],
  zones: [z('badland', 215, 655, 160, 120), z('ash', 330, 745, 90, 60), z('oasis', 330, 725, 14, 10), z('lava', 120, 560, 40, 30), z('pit', 645, 815, 26, 14)],
};

// ---- necks of land (ground routes in the docs), thin and never carved ----
const bridge = (key: string, cont: number, x1: number, y1: number, x2: number, y2: number, w = 11): LandDef => ({ key, cont, blobs: [], caps: [{ x1, y1, x2, y2, w }], bridge: true, amp: 0.3 });
const BRIDGES: LandDef[] = [
  bridge('br_ald_sil', CONT.aldria, 540, 430, 450, 424),
  bridge('br_ald_neb', CONT.aldria, 770, 300, 770, 170, 12),
  bridge('br_ald_mec', CONT.aldria, 945, 385, 1040, 325),
  bridge('br_ald_sah', CONT.aldria, 955, 500, 1070, 515),
  bridge('br_ald_kaz', CONT.aldria, 868, 585, 868, 705, 12),
  bridge('br_sil_mor', CONT.silvanel, 205, 430, 195, 545, 12),
  bridge('br_mor_kaz', CONT.kazdurum, 640, 812, 765, 802),
];

// ---- Azgar: ten floating islands (AZ-01 … AZ-10) over the eastern sea ----
const sky = (key: string, country: number, blobs: Blob[], zones: Zone[] = []): LandDef => ({ key, cont: CONT.azgar, country, blobs, zones, float: true, amp: 0.45 });
const AZGAR: LandDef[] = [
  sky('az01', 0, [b(1478, 305, 78, 46), b(1425, 332, 22, 15), b(1537, 270, 20, 14), b(1405, 290, 14, 10), b(1548, 335, 16, 11), b(1445, 262, 15, 10), b(1500, 360, 14, 10)], [z('city', 1478, 305, 70, 40)]),
  sky('az02', 1, [b(1522, 128, 40, 30)], [z('crater', 1522, 128, 18, 14), z('lava', 1522, 128, 22, 16)]),
  sky('az03', 2, [b(1425, 195, 30, 21), b(1465, 215, 13, 9)]),
  sky('az04', 3, [b(1418, 618, 38, 27)], [z('mountain', 1418, 618, 22, 16)]),
  sky('az05', 4, [b(1535, 435, 38, 28)], [z('ruin', 1535, 435, 16, 12)]),
  sky('az06', 5, [b(1472, 722, 38, 28)], [z('oasis', 1472, 722, 26, 18)]),
  sky('az07', 6, [b(1402, 470, 52, 32), b(1445, 495, 20, 12)], [z('farm', 1402, 470, 44, 24)]),
  sky('az08', 7, [b(1532, 572, 31, 23)], [z('badland', 1532, 572, 20, 14)]),
  sky('az09', 8, [b(1380, 385, 27, 19)], [z('city', 1380, 385, 16, 11)]),
  sky('az10', 9, [b(1410, 92, 26, 19)], [z('fog', 1410, 92, 24, 16)]),
];

// ---- Nerea: sixteen island nations (NR-01 … NR-16): a ring around the inner sea and a chain to the south-east ----
const isle = (n: number, blobs: Blob[], zones: Zone[] = []): LandDef => ({ key: `nr${String(n).padStart(2, '0')}`, cont: CONT.nerea, country: n - 1, blobs, zones, amp: 0.6 });
const NEREA: LandDef[] = [
  isle(1, [b(595, 692, 40, 27), b(625, 672, 20, 12)], [z('city', 595, 692, 26, 18)]),
  isle(2, [b(1478, 812, 30, 20)], [z('oasis', 1478, 812, 14, 9)]),
  isle(3, [b(523, 645, 24, 16)]),
  isle(4, [b(500, 735, 22, 15)]),
  isle(5, [b(560, 762, 20, 12)]),
  isle(6, [b(655, 745, 24, 16)]),
  isle(7, [b(692, 668, 26, 17), b(716, 684, 12, 9)]),
  isle(8, [b(545, 612, 16, 10)]),
  isle(9, [b(655, 622, 18, 12)]),
  isle(10, [b(738, 735, 18, 12)]),
  isle(11, [b(1148, 836, 24, 15)]),
  isle(12, [b(1240, 806, 26, 17)]),
  isle(13, [b(1325, 842, 28, 17)]),
  isle(14, [b(1395, 806, 22, 14)]),
  isle(15, [b(1198, 868, 22, 12)]),
  isle(16, [b(1545, 840, 24, 15)]),
];

export const DEFS: LandDef[] = [ALDRIA, SILVANEL, NEBULIA, MECHARIA, SAHARAN, KAZDURUM, MORHAVEN, ...BRIDGES, ...AZGAR, ...NEREA];
export const defIndex = (key: string) => DEFS.findIndex((d) => d.key === key);

/** Where each continent's name is written on the map (MU). */
export const CONT_LABELS: { x: number; y: number }[] = [
  { x: 1470, y: 205 }, // อัซการ์
  { x: 230, y: 660 }, // มอร์เฮเวน
  { x: 930, y: 750 }, // คาซ-ดูรัม
  { x: 600, y: 715 }, // เนเรีย
  { x: 725, y: 445 }, // อัลเดรีย
  { x: 1150, y: 255 }, // เมคาเรีย
  { x: 1215, y: 590 }, // ซาฮารัน
  { x: 250, y: 265 }, // ซิลวาเนล
  { x: 730, y: 105 }, // เนบูเลีย
];

// ---- the land field ----
const wn1 = makeNoise(101), wn2 = makeNoise(202), cn1 = makeNoise(303), cn2 = makeNoise(404), cn3 = makeNoise(505);
const SMOOTH = 11; // MU: how softly the blobs of one landmass blend
const SEPARATION = 4.5; // MU of v: two landmasses closer than this are split by a channel
const PAD = 90;

interface Box { x0: number; y0: number; x1: number; y1: number }
const boxes: Box[] = DEFS.map((d) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const bl of d.blobs) { const r = Math.max(bl.rx, bl.ry); x0 = Math.min(x0, bl.x - r); y0 = Math.min(y0, bl.y - r); x1 = Math.max(x1, bl.x + r); y1 = Math.max(y1, bl.y + r); }
  for (const c of d.caps ?? []) { x0 = Math.min(x0, c.x1 - c.w, c.x2 - c.w); y0 = Math.min(y0, c.y1 - c.w, c.y2 - c.w); x1 = Math.max(x1, c.x1 + c.w, c.x2 + c.w); y1 = Math.max(y1, c.y1 + c.w, c.y2 + c.w); }
  return { x0: x0 - PAD, y0: y0 - PAD, x1: x1 + PAD, y1: y1 + PAD };
});

/** signed "inland distance" of a point to one blob, in MU (≈ positive inside) */
export function blobValue(bl: Blob, x: number, y: number): number {
  let dx = x - bl.x, dy = y - bl.y;
  if (bl.rot) { const c = Math.cos(bl.rot), s = Math.sin(bl.rot); const t = dx * c + dy * s; dy = -dx * s + dy * c; dx = t; }
  const d = Math.sqrt((dx * dx) / (bl.rx * bl.rx) + (dy * dy) / (bl.ry * bl.ry));
  return (1 - d) * Math.min(bl.rx, bl.ry) * 0.92;
}

/** inland distance to a thick segment (positive inside) */
export function capValue(c: Cap, x: number, y: number): number {
  const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
  const t = Math.max(0, Math.min(1, ((x - c.x1) * dx + (y - c.y1) * dy) / (dx * dx + dy * dy)));
  return c.w - Math.hypot(x - (c.x1 + dx * t), y - (c.y1 + dy * t));
}

export interface Sample { v: number; def: number }
const out: Sample = { v: -999, def: -1 };

/** land value at a map point: > 0 is land. `def` is the index into DEFS of the landmass that owns the point. */
export function sampleLand(x: number, y: number): Sample {
  const wx = (wn1(x / 150, y / 150, 3) - 0.5) * 64, wy = (wn2(x / 150 + 17, y / 150 + 9, 3) - 0.5) * 64;
  const n = (cn1(x / 75, y / 75, 3) - 0.5) * 62 + (cn2(x / 28 + 5, y / 28 + 3, 2) - 0.5) * 22 + (cn3(x / 9 + 1, y / 9 + 7, 2) - 0.5) * 3.2;
  let best = -999, bi = -1, c1 = -999, c2 = -999;
  for (let i = 0; i < DEFS.length; i++) {
    const bx = boxes[i];
    if (x < bx.x0 || x > bx.x1 || y < bx.y0 || y > bx.y1) continue;
    const d = DEFS[i];
    const px = x + wx, py = y + wy;
    let m = -999;
    for (const bl of d.blobs) { const v = blobValue(bl, px, py); if (v > m) m = v; }
    if (d.caps) for (const c of d.caps) { const v = capValue(c, px, py); if (v > m) m = v; }
    // soft union: add the contribution of the other blobs
    if (d.blobs.length > 1 && m > -SMOOTH * 3) {
      let s = 0;
      for (const bl of d.blobs) s += Math.exp((blobValue(bl, px, py) - m) / SMOOTH);
      m += SMOOTH * Math.log(s) * 0.55;
    }
    let v = m + n * (d.amp ?? 1);
    if (d.cuts) for (const c of d.cuts) { const cv = blobValue(c, px, py); if (cv > -6) v = Math.min(v, -cv * 1.1 + n * 0.25 + 1.5); }
    if (v > best) { best = v; bi = i; }
    if (!d.bridge && !d.float) { if (v > c1) { c2 = c1; c1 = v; } else if (v > c2) c2 = v; }
  }
  // channels between separate landmasses (bridges and floating islands are exempt)
  let v = best;
  if (bi >= 0 && !DEFS[bi].bridge && !DEFS[bi].float && c2 > -999) v = Math.min(v, c1 - c2 - SEPARATION);
  out.v = v; out.def = bi;
  return out;
}

/** which landmass (index into DEFS) a map point belongs to, or -1 for open sea */
export function ownerAt(x: number, y: number): number {
  const s = sampleLand(x, y);
  return s.v > 0 ? s.def : -1;
}
