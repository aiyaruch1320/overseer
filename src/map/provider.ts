// The map art provider (code-plan §8.4): one interface, two kinds behind it. The map screen asks for a tile — the ground of a part of the sheet at one
// zoom level — and draws what comes back; it does not know whether the tile was painted by code or loaded from a generated picture.
//
//   code-drawn   codeProvider.ts   every zoom level, every look, always answers (the default)
//   generated    imageProvider.ts  pictures listed in data/art/map/manifest.json; answers only for the tiles the manifest lists
//   layered      `layered([image, code])`: the first provider that has the tile wins, so a missing picture falls back to code, tile by tile
import type { ContId } from './geo';
import type { Rect } from './layout';
import type { FateId, ZoomId } from './tuning';

export type { Rect, ZoomId, FateId };

/** What the map shows of the changed world (11-world-changes.md): the form of each changed continent, and the great flood of the coasts. */
export interface Looks {
  fates: Partial<Record<ContId, FateId>>;
  /** DR-05: the coasts of every continent are under water. */
  flood: boolean;
  /** Country id → 0..1: how much of its towns stands broken (a fallen country, a god ruin). Only the town tiles show it. */
  ruin?: Record<string, number>;
}

export const NORMAL_LOOKS: Looks = { fates: {}, flood: false };

export interface TileRequest {
  level: ZoomId;
  /** `world` · a continent id (`AL`) · a country id (`AL-05`) · a town id (`AL-05/0`). */
  key: string;
  /** The continent the tile is in (the world tile has none). */
  continent: ContId | null;
  /** Area of the sheet the tile covers (MU). */
  rect: Rect;
  looks: Looks;
  seed: number;
}

/** A painted or loaded tile: anything a canvas can draw (a canvas, an image, a bitmap) and the area of the sheet it covers. */
export interface TileImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  rect: Rect;
  origin: 'code' | 'image';
}

export interface MapArtProvider {
  readonly id: string;
  /** The tile, `null` when this provider does not have it. A code provider never answers `null`. */
  tile(req: TileRequest): TileImage | null | Promise<TileImage | null>;
}

/** The part of a look that a tile depends on, as a string: a tile is painted again only when this changes. */
export function lookKey(req: TileRequest): string {
  const f = req.looks.fates;
  if (req.level === 'world' && req.key === 'world') return `${CONT_ORDER.map((c) => f[c] ?? '-').join(',')}|${req.looks.flood ? 'F' : ''}`;
  const c = req.continent;
  const base = `${c ? f[c] ?? '-' : '-'}|${req.looks.flood ? 'F' : ''}`;
  if (req.level === 'city' || req.level === 'inside') return `${base}|r${(req.looks.ruin?.[req.key.split('/')[0]] ?? 0).toFixed(2)}`;
  return base;
}
const CONT_ORDER: ContId[] = ['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB'];

/** The cache key of a tile. */
export const tileKey = (req: TileRequest): string => `${req.level}:${req.key}:${lookKey(req)}:${req.seed}`;

/** The first provider that has the tile (a missing picture falls back to the next, which ends in the code-drawn one). */
export function layered(list: MapArtProvider[]): MapArtProvider {
  return {
    id: list.map((p) => p.id).join('+'),
    async tile(req) {
      for (const p of list) {
        const t = await p.tile(req);
        if (t) return t;
      }
      return null;
    },
  };
}

// ---- canvases ----

/** The canvas the painters draw on: the page's own canvas in the browser, anything with the same shape in a test. */
export interface PaintCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}
export type CanvasFactory = (w: number, h: number) => PaintCanvas;

export const domCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
