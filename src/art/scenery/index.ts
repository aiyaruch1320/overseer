// The painter of scene backgrounds (M7 ก2): for a continent and a setting (outdoor, town, indoor) the layers sky, far, mid and ground, painted
// once from the UI values of the docs (docs/appearance/01-continents.md, countries/*.md) and handed over as pixel frames. Pure and deterministic:
// the same spec gives the same pixels, no DOM, so Node tests run it. Contract: types.ts.
import { makeCtx } from './ctx';
import { COUNTRIES } from './countries';
import { indoorPainter } from './indoor';
import { AL, AZ, KD, MH, NR, type Painter } from './outdoor-a';
import { MK, NB, SH, SV } from './outdoor-b';
import { profileOf, type Base } from './profiles';
import { finish, seasonLight } from './season';
import { townPainter } from './town';
import { type Scenery, type ScenerySpec, type SceneryLayer } from './types';
import { Grade } from './util';

export * from './types';

const OUTDOOR: Record<Base, Painter> = { AZ, MH, KD, NR, AL, MK, SH, SV, NB };

/** The speed of each layer (the share of the camera's move it follows). */
const SPEED = { sky: 0, far: 0.2, mid: 0.5, ground: 1 } as const;

/** The layers of a place, painted once (the caller keeps them). */
export function paintScenery(spec: ScenerySpec): Scenery {
  const P = profileOf(spec.continent, spec.country);
  const season = spec.season !== undefined && Number.isFinite(spec.season) ? Math.min(3, Math.max(0, Math.floor(spec.season))) : undefined;
  const g = new Grade(season, P.snow);
  const country = spec.country ? COUNTRIES[spec.country] : undefined;
  const cx = makeCtx(P, g, spec.setting, country, Math.floor(spec.seed ?? 0) | 0);
  const pt = spec.setting === 'indoor' ? indoorPainter(cx) : spec.setting === 'town' ? townPainter(cx, OUTDOOR[P.base]) : OUTDOOR[P.base];
  const make = (name: SceneryLayer['name'], f: (c: typeof cx) => SceneryLayer['frame']): SceneryLayer => ({ name, speed: SPEED[name], frame: f(cx) });
  const layers: SceneryLayer[] = [make('sky', pt.sky), make('far', pt.far), make('mid', pt.mid), make('ground', pt.ground)];
  // the finishing grade over every pixel: the season's climate of the continent (outdoors and in town) and the continent's ceiling of colour
  for (const l of layers) finish(l.frame, l.name, P.base, season, spec.setting !== 'indoor');
  const ambient = ambientOf(cx.country?.ambient, spec.setting, P.ambient);
  return { spec, layers, light: spec.setting === 'indoor' ? P.lamp : seasonLight(P.light, P.base, season), ...(ambient ? { ambient } : {}) };
}

/** The ambient particle: the country's own when it names one, else the continent's (outdoors and in town); inside only a fire's or a machine's. */
function ambientOf(country: string | undefined, setting: string, continent: string): string | undefined {
  if (setting === 'indoor') return continent === 'embers' || continent === 'smoke' ? continent : 'dust';
  return country && country !== 'none' ? country : continent;
}
