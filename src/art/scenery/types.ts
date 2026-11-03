// The contract between the scene stage (src/scene/, M7 ก1) and the painter of backgrounds (src/art/scenery/, M7 ก2): the stage asks for the
// layers of a place once and keeps them; the painter knows nothing of time, beats or Phaser. Pure data, so Node tests can check it.
import type { Frame } from '../paint';

/** The art pixels of the stage (docs/appearance/21-pixel-art.md §4): 320 × 180, shown at a whole multiple. */
export const SCENE_W = 320;
export const SCENE_H = 180;
/** The row the feet of the characters stand on. */
export const GROUND_Y = 150;

/** Where a scene is: under the sky, among the houses of a town, or inside a building. */
export type Setting = 'outdoor' | 'town' | 'indoor';
export const SETTINGS: readonly Setting[] = ['outdoor', 'town', 'indoor'];

export interface ScenerySpec {
  /** Continent id of data/gen/continents.json (AZ MH KZ NR AD MK SH SV NB) or of a new continent after a world change. */
  continent: string;
  /** Country id (AZ-01): its `ui` values colour the town and the inside when given. */
  country?: string;
  setting: Setting;
  /** 0 to 3: ฤดูหว่าน ฤดูฝน ฤดูเก็บเกี่ยว ฤดูหนาว (the watch screen's idle picture). Omitted: the plain look of the place. */
  season?: number;
  /** A number that varies the details (the seed of the life, of the scene) so two places of one continent are not the same picture. */
  seed?: number;
}

/** The layers back to front; `speed` is the share of the camera's move a layer follows (sky 0, ground 1). */
export type LayerName = 'sky' | 'far' | 'mid' | 'ground';
export interface SceneryLayer {
  name: LayerName;
  speed: number;
  /** At least SCENE_W wide (wider for the layers that move), SCENE_H high; transparent where a layer behind shows through. */
  frame: Frame;
}

export interface Scenery {
  spec: ScenerySpec;
  layers: SceneryLayer[];
  /** The light of the place, for the stage to tint the characters and the particles (#rrggbb). */
  light: string;
  /** The ambient particle of the place (docs `ambient=`), when the place has one the stage may draw under the beats' own. */
  ambient?: string;
}
