// Which tiles exist and which of them a view needs (pure geometry, no drawing). A tile is the ground of one part of the sheet at one zoom level:
// the whole sheet at the world level, one box per continent, one per country, and the plan of one town. The scene asks for the tiles its camera
// sees at the level of its zoom, and the provider (code-drawn or a generated picture) answers each.
import { CONT_IDS, type ContId } from './geo';
import type { MapCity, MapLayout, Rect } from './layout';
import type { Looks, TileRequest } from './provider';
import { CAM_MAX, CAM_MIN, CITY_H, CITY_W, GROUND_CHUNK, SHEET, TILE_PAD, TILE_PX, TOWN_PX, WU, ZOOM_LEVELS, type ZoomId } from './tuning';

const pad = (r: Rect, p: number): Rect => {
  const x = Math.max(0, r.x - p), y = Math.max(0, r.y - p);
  return { x, y, w: Math.min(SHEET.w, r.x + r.w + p) - x, h: Math.min(SHEET.h, r.y + r.h + p) - y };
};

export const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The zoom level of a camera zoom (px per world unit): world below 0.33, continent to 0.75, country to 2, city to 7, inside above (world-map.md §3). */
export function levelOf(zoom: number, limits: readonly { id: string; max: number | null }[] = ZOOM_LEVELS): ZoomId {
  for (const l of limits) if (l.max === null || zoom < l.max) return l.id as ZoomId;
  return 'inside';
}

export function levelIndex(level: ZoomId): number {
  return ZOOM_LEVELS.findIndex((l) => l.id === level);
}

/** The sheet area of a tile. */
export function rectFor(layout: MapLayout, level: ZoomId, key: string): Rect {
  if (level === 'world' && key === 'world') return { x: 0, y: 0, w: SHEET.w, h: SHEET.h };
  if (level === 'world' || level === 'continent') return pad(layout.continents[key as ContId]?.box ?? { x: 0, y: 0, w: SHEET.w, h: SHEET.h }, TILE_PAD[level]);
  if (level === 'country') return pad(layout.byId.get(key)?.box ?? { x: 0, y: 0, w: 1, h: 1 }, TILE_PAD.country);
  const c = layout.cities.find((q) => q.id === key);
  return c ? cityRect(c) : { x: 0, y: 0, w: CITY_W, h: CITY_H };
}

export const cityRect = (c: { x: number; y: number }): Rect => ({ x: c.x - CITY_W / 2, y: c.y - CITY_H / 2, w: CITY_W, h: CITY_H });

export function requestFor(layout: MapLayout, level: ZoomId, key: string, looks: Looks, seed: number): TileRequest {
  let continent: ContId | null = null;
  if (key !== 'world') {
    if (level === 'world' || level === 'continent') continent = key as ContId;
    else continent = layout.byId.get(key.split('/')[0])?.continent ?? null;
  }
  return { level, key, continent, rect: rectFor(layout, level, key), looks, seed };
}

/** Pixel size of the canvas for a tile (the density of the level, but never larger than `max` on a side). */
export function tileSize(req: TileRequest, max = 2048): { w: number; h: number; px: number } {
  let px = req.px ?? TILE_PX[req.level];
  px = Math.min(px, max / req.rect.w, max / req.rect.h);
  return { w: Math.max(2, Math.ceil(req.rect.w * px)), h: Math.max(2, Math.ceil(req.rect.h * px)), px };
}

export interface View {
  /** Visible area of the sheet (MU). */
  rect: Rect;
  zoom: number;
}

/** Keys of the tiles of one level that touch the view: the continents, the countries or the towns it sees. */
export function visibleKeys(layout: MapLayout, level: ZoomId, view: Rect): string[] {
  switch (level) {
    case 'world':
      return ['world'];
    case 'continent':
      return CONT_IDS.filter((id) => intersects(rectFor(layout, 'continent', id), view));
    case 'country':
      return layout.countries.filter((c) => intersects(rectFor(layout, 'country', c.id), view)).map((c) => c.id);
    default:
      return layout.cities.filter((c) => intersects(cityRect(c), view)).map((c) => c.id);
  }
}

/**
 * The ground round the towns at the density of the towns (21-pixel-art.md §4: one pixel density at the town and in-town levels): the land of the
 * country is repainted in square chunks of GROUND_CHUNK MU at TOWN_PX pixels to the MU, so that the ground under and round a town is as fine as its houses.
 */
export function groundChunks(layout: MapLayout, view: Rect, looks: Looks, seed: number): TileRequest[] {
  const s = GROUND_CHUNK;
  const out: TileRequest[] = [];
  for (let j = Math.max(0, Math.floor(view.y / s)); j <= Math.min(Math.floor(SHEET.h / s), Math.floor((view.y + view.h) / s)); j++)
    for (let i = Math.max(0, Math.floor(view.x / s)); i <= Math.min(Math.floor(SHEET.w / s), Math.floor((view.x + view.w) / s)); i++) {
      const rect = { x: i * s, y: j * s, w: s, h: s };
      const cx = rect.x + s / 2, cy = rect.y + s / 2;
      const owner = layout.cities.reduce<MapCity | null>((b, c) => (!b || Math.hypot(c.x - cx, c.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? c : b), null);
      const continent = owner ? layout.byId.get(owner.country)?.continent ?? null : null;
      out.push({ level: 'city', key: `g:${i}:${j}`, continent, rect, looks, seed, px: TOWN_PX });
    }
  return out;
}

/** The camera that shows a rect of the sheet in a viewport: centre in MU and zoom in px per world unit. */
export function fitRect(rect: Rect, vw: number, vh: number, margin = 0.92): { x: number; y: number; zoom: number } {
  const zoom = Math.min((vw * margin) / (rect.w * WU), (vh * margin) / (rect.h * WU));
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom: Math.min(CAM_MAX, Math.max(CAM_MIN, zoom)) };
}

/** The sheet area a camera sees. */
export function viewRect(cx: number, cy: number, zoom: number, vw: number, vh: number): Rect {
  const w = vw / zoom / WU, h = vh / zoom / WU;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export const clampZoom = (z: number): number => Math.min(CAM_MAX, Math.max(CAM_MIN, z));

/** Where a camera can look: the sheet plus a little margin. */
export function clampCentre(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(SHEET.w + 40, Math.max(-40, x)), y: Math.min(SHEET.h + 40, Math.max(-40, y)) };
}

/** The camera that shows a town closely (the inside level) or a place at a level. */
export function focusOf(layout: MapLayout, focus: { kind: 'world' | 'continent' | 'country' | 'city'; id?: string }, vw: number, vh: number): { x: number; y: number; zoom: number } {
  if (focus.kind === 'continent' && focus.id && layout.continents[focus.id as ContId]) return fitRect(layout.continents[focus.id as ContId].box, vw, vh);
  if (focus.kind === 'country' && focus.id && layout.byId.get(focus.id)) return fitRect(layout.byId.get(focus.id)!.box, vw, vh, 0.8);
  if (focus.kind === 'city' && focus.id) {
    const c: MapCity | undefined = layout.cities.find((q) => q.id === focus.id) ?? layout.citiesOf(focus.id)[0];
    if (c) return fitRect(cityRect(c), vw, vh, 0.95);
  }
  // the world: the land of all the continents with a little sea round it, not the whole sheet (its sea margins would be empty screen)
  const boxes = CONT_IDS.map((id) => layout.continents[id]?.box).filter((b): b is Rect => !!b);
  if (!boxes.length) return fitRect({ x: 0, y: 0, w: SHEET.w, h: SHEET.h }, vw, vh);
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 30), y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 30);
  const x1 = Math.min(SHEET.w, Math.max(...boxes.map((b) => b.x + b.w)) + 30), y1 = Math.min(SHEET.h, Math.max(...boxes.map((b) => b.y + b.h)) + 30);
  return fitRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, vw, vh, 0.98);
}
