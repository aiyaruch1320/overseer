// The painter of scene backgrounds (M7 ก2). This first version is a placeholder of the contract in types.ts: a flat sky and ground, so the
// stage (ก1) can be built against it while the real painter is written.
import type { Frame } from '../paint';
import { GROUND_Y, SCENE_H, SCENE_W, type Scenery, type ScenerySpec } from './types';

export * from './types';

function flat(w: number, h: number, top: number, bottom: number, rgb: [number, number, number]): Frame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = top; y < bottom; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  return { w, h, data };
}

/** The layers of a place, painted once (the caller keeps them). */
export function paintScenery(spec: ScenerySpec): Scenery {
  return {
    spec,
    layers: [
      { name: 'sky', speed: 0, frame: flat(SCENE_W, SCENE_H, 0, SCENE_H, [26, 28, 36]) },
      { name: 'ground', speed: 1, frame: flat(SCENE_W * 2, SCENE_H, GROUND_Y - 6, SCENE_H, [12, 13, 18]) },
    ],
    light: '#c8d4ee',
  };
}
