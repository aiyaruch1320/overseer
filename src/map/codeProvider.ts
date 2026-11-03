// The code-drawn map art provider (code-plan §8.4): the default, and the only one that covers every zoom level and every look. It paints a tile on
// demand with the painters of terrain.ts (the sheet, the continents, the countries) and city.ts (a town, close and inside), keeps what it painted
// in a small cache, and always answers. Deterministic: the same data, seed and look give the same pixels.
import type { GameData } from '../core/game';
import type { Country } from '../core/data/types-npcs';
import { paintCity, planCity, type CityLook, type CityPlan } from './city';
import { layoutOf, type MapLayout } from './layout';
import { domCanvas, tileKey, type CanvasFactory, type MapArtProvider, type TileImage, type TileRequest } from './provider';
import { paintTerrain } from './terrain';
import { tileSize } from './tiles';
import { FATE_BY_ID } from './tuning';

export interface CodeProviderOpts {
  /** Where tiles are painted; the browser canvas by default. Tests pass a fake. */
  canvas?: CanvasFactory;
  /** Tiles kept (oldest dropped). */
  keep?: number;
}

export interface CodeProvider extends MapArtProvider {
  readonly layout: MapLayout;
  /** The plan of a town (data), for the people of the inside level. */
  plan(cityId: string, req: Pick<TileRequest, 'looks' | 'seed'>): CityPlan | null;
  /** Tiles painted since the start (for tests and the cache). */
  readonly painted: number;
}

export function codeProvider(data: GameData, opts: CodeProviderOpts = {}): CodeProvider {
  const layout = layoutOf(data);
  const make = opts.canvas ?? domCanvas;
  const keep = opts.keep ?? 40;
  const countries = new Map<string, Country>();
  for (const c of (data.countries?.items as Country[] | undefined) ?? []) countries.set(c.id, c);
  const cache = new Map<string, TileImage>();
  const plans = new Map<string, CityPlan>();
  let painted = 0;

  const lookOf = (req: Pick<TileRequest, 'looks'>, countryId: string, continent: string): CityLook => {
    const fate = req.looks.fates[continent as keyof typeof req.looks.fates];
    const ruin = req.looks.ruin?.[countryId] ?? 0;
    return { fate: fate ?? (req.looks.flood ? 'flood' : undefined), ruin: ruin > 0 ? ruin : fate && FATE_BY_ID[fate] ? 0.25 : 0 };
  };

  function plan(cityId: string, req: Pick<TileRequest, 'looks' | 'seed'>): CityPlan | null {
    const city = layout.cities.find((c) => c.id === cityId);
    if (!city) return null;
    const country = countries.get(city.country);
    const mc = layout.byId.get(city.country);
    if (!country || !mc) return null;
    const look = lookOf(req, city.country, mc.continent);
    const key = `${cityId}|${req.seed}|${look.fate ?? ''}`;
    let p = plans.get(key);
    if (!p) {
      p = planCity(country, mc.continent, cityId, city.capital, req.seed, look);
      plans.set(key, p);
      if (plans.size > 80) plans.delete(plans.keys().next().value as string);
    }
    return p;
  }

  return {
    id: 'code',
    layout,
    plan,
    get painted() {
      return painted;
    },
    tile(req: TileRequest): TileImage | null {
      // the code provider paints the whole sheet at the world level; a continent's own world-level picture is for the generated provider only
      if (req.level === 'world' && req.key !== 'world') return null;
      const k = tileKey(req);
      const hit = cache.get(k);
      if (hit) {
        cache.delete(k);
        cache.set(k, hit);
        return hit;
      }
      const size = tileSize(req);
      const canvas = make(size.w, size.h);
      if (req.level === 'city' || req.level === 'inside') {
        const p = plan(req.key, req);
        if (!p) return null;
        const city = layout.cities.find((c) => c.id === req.key)!;
        paintCity(canvas, p, lookOf(req, city.country, req.continent ?? 'AL'));
        feather(canvas);
      } else paintTerrain(canvas, req, layout);
      painted++;
      const img: TileImage = { source: canvas as unknown as CanvasImageSource, width: size.w, height: size.h, rect: req.rect, origin: 'code' };
      cache.set(k, img);
      if (cache.size > keep) cache.delete(cache.keys().next().value as string);
      return img;
    },
  };
}

/** Fades the rim of a town plan to clear, so the ground of the country shows round it. */
function feather(canvas: { width: number; height: number; getContext(t: '2d'): CanvasRenderingContext2D | null }): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !ctx.createRadialGradient) return;
  const { width: w, height: h } = canvas;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.72, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -w / 2, w, w);
  ctx.restore();
}
