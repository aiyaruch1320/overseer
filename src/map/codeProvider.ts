// The code-drawn map art provider (code-plan §8.4): the default, and the only one that covers every zoom level and every look. It paints a tile on
// demand with the painters of terrain.ts (the sheet, the continents, the countries) and city.ts (a town, close and inside), keeps what it painted
// in a small cache, and always answers. Deterministic: the same data, seed and look give the same pixels.
import type { GameData } from '../core/game';
import type { Country } from '../core/data/types-npcs';
import { posterize } from '../art/mapart/pixelize';
import { planCity, type CityLook, type CityPlan } from './city';
import { layoutOf, type MapLayout } from './layout';
import { domCanvas, tileKey, type CanvasFactory, type MapArtProvider, type TileImage, type TileRequest } from './provider';
import { paintTerrain } from './terrain';
import { townGround, type TownGround } from './townGround';
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
  /** The plan of a town with its look and the pixel ground (the picture and the grid the people walk on); cached. */
  town(cityId: string, req: Pick<TileRequest, 'looks' | 'seed'>): { plan: CityPlan; look: CityLook; ground: TownGround; country: string; continent: string } | null;
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

  const grounds = new Map<string, TownGround>();
  function town(cityId: string, req: Pick<TileRequest, 'looks' | 'seed'>) {
    const p = plan(cityId, req);
    const city = layout.cities.find((c) => c.id === cityId);
    const mc = city && layout.byId.get(city.country);
    if (!p || !city || !mc) return null;
    const look = lookOf(req, city.country, mc.continent);
    const k = `${cityId}|${req.seed}|${look.fate ?? ''}|${(look.ruin ?? 0).toFixed(2)}`;
    let ground = grounds.get(k);
    if (!ground) {
      ground = townGround(p, look);
      grounds.set(k, ground);
      if (grounds.size > 12) grounds.delete(grounds.keys().next().value as string);
    }
    return { plan: p, look, ground, country: city.country, continent: mc.continent };
  }

  return {
    id: 'code',
    layout,
    plan,
    town,
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
      let canvas = make(size.w, size.h);
      if ((req.level === 'city' || req.level === 'inside') && !req.px) {
        const t = town(req.key, req);
        if (!t) return null;
        // the pixel ground of the plan, one art pixel to a canvas pixel
        canvas = make(t.ground.w, t.ground.h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const im = ctx.createImageData(t.ground.w, t.ground.h);
          im.data.set(t.ground.data);
          ctx.putImageData(im, 0, 0);
        }
      } else {
        paintTerrain(canvas, req, layout);
        posterize(canvas);
      }
      painted++;
      const img: TileImage = { source: canvas as unknown as CanvasImageSource, width: canvas.width, height: canvas.height, rect: req.rect, origin: 'code' };
      cache.set(k, img);
      if (cache.size > keep) cache.delete(cache.keys().next().value as string);
      return img;
    },
  };
}
