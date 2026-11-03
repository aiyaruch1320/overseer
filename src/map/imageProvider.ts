// The generated-image map art provider (code-plan §8.4). It reads `data/art/map/manifest.json` — the contract the picture team (the ComfyUI POC)
// writes to — and answers a tile only when the manifest lists a picture for it. Everything else is `null`, and `layered([image, code])` then
// takes the code-drawn tile, so the map works with no pictures, with some, or with all of them, tile by tile, without any change to the screens.
//
// THE CONTRACT (data/art/map/manifest.json):
//   {
//     "version": 1,
//     "base": "",                        // optional folder of the files, relative to the manifest
//     "tiles": [
//       { "level": "world",     "key": "AL",    "look": "normal",  "file": "world/AL.normal.webp" },
//       { "level": "continent", "key": "AL",    "look": "split",   "file": "continent/AL.split.webp", "rect": {"x":..,"y":..,"w":..,"h":..} },
//       { "level": "country",   "key": "AL-05", "look": "normal",  "file": "country/AL-05.png" }
//     ]
//   }
//   level  `world` (one picture per continent at the world scale, laid over the sheet), `continent` (one per continent), `country` (one per country).
//          The town and inside levels are always drawn by code.
//   key    the continent id (AZ MH KD NR AL MK SH SV NB) for `world` and `continent`, the country id (AL-05) for `country`.
//   look   `normal` (default) or the form of a changed continent: skyfall ash flood split withered rust light fog (11-world-changes.md §2).
//          A look the manifest lacks falls back to the code-drawn tile of that look, never to the `normal` picture (it would show the wrong world).
//   rect   area of the sheet the picture covers in map units (1600 × 900). Default: the area the code-drawn tile of the same key covers
//          (continent box + 14, country box + 8), so a picture drawn to those bounds needs no rect.
//   file   path from `base`; any image the browser loads (png webp jpg).
import type { MapLayout, Rect } from './layout';
import type { MapArtProvider, TileImage, TileRequest } from './provider';
import { rectFor } from './tiles';
import type { FateId, ZoomId } from './tuning';

export interface ManifestTile {
  level: Extract<ZoomId, 'world' | 'continent' | 'country'>;
  key: string;
  look?: 'normal' | FateId;
  file: string;
  rect?: Rect;
}

export interface MapManifest {
  version: 1;
  base?: string;
  tiles: ManifestTile[];
}

const LEVELS = ['world', 'continent', 'country'];

/** Reads a manifest from parsed JSON; malformed entries are dropped (a bad row never breaks the map). */
export function parseManifest(json: unknown): MapManifest {
  const j = (json ?? {}) as { version?: unknown; base?: unknown; tiles?: unknown };
  const tiles: ManifestTile[] = [];
  if (Array.isArray(j.tiles))
    for (const t of j.tiles as Partial<ManifestTile>[]) {
      if (!t || typeof t.file !== 'string' || typeof t.key !== 'string' || !LEVELS.includes(String(t.level))) continue;
      const rect = t.rect && [t.rect.x, t.rect.y, t.rect.w, t.rect.h].every((n) => typeof n === 'number') ? t.rect : undefined;
      tiles.push({ level: t.level as ManifestTile['level'], key: t.key, look: (t.look as ManifestTile['look']) ?? 'normal', file: t.file, rect });
    }
  return { version: 1, base: typeof j.base === 'string' ? j.base : '', tiles };
}

/** The look a tile request asks for: the form of its continent, the flood, or `normal`. */
export function lookIdOf(req: TileRequest): 'normal' | FateId {
  if (req.continent === null) return 'normal';
  return req.looks.fates[req.continent] ?? (req.looks.flood ? 'flood' : 'normal');
}

export interface ImageIO {
  /** URL of a file of the manifest (joined with its base), or `null` when the file is not shipped. */
  url(path: string): string | null;
  /** Loads a picture. */
  load(url: string): Promise<{ source: CanvasImageSource; width: number; height: number }>;
}

export function imageProvider(manifest: MapManifest, layout: MapLayout, io: ImageIO): MapArtProvider {
  const index = new Map<string, ManifestTile>();
  for (const t of manifest.tiles) index.set(`${t.level}|${t.key}|${t.look ?? 'normal'}`, t);
  const loaded = new Map<string, Promise<TileImage | null>>();
  const join = (f: string) => (manifest.base ? `${manifest.base.replace(/\/$/, '')}/${f}` : f);
  return {
    id: 'image',
    tile(req) {
      if (req.level !== 'world' && req.level !== 'continent' && req.level !== 'country') return null;
      if (req.level === 'world' && req.key === 'world') return null; // the sheet itself is the code-drawn base; the continents lie on it
      const row = index.get(`${req.level}|${req.key}|${lookIdOf(req)}`);
      if (!row) return null;
      const url = io.url(join(row.file));
      if (!url) return null;
      let p = loaded.get(url);
      if (!p) {
        p = io
          .load(url)
          .then((im) => ({ ...im, rect: row.rect ?? rectFor(layout, req.level, req.key), origin: 'image' as const }))
          .catch(() => null); // a picture that does not load is as good as a missing one
        loaded.set(url, p);
      }
      return p;
    },
  };
}
