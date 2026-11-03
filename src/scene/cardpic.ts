// The picture of an event card (M7 ก4): a small pixel picture of 320 x 180 art pixels, painted into a plain RGBA buffer, not a Phaser game (a card is still, and many are on
// screen at once). The painted place of the event (src/art/scenery), tinted by the card's `sky`, and the card's effects as the pixels of src/scene/fx at one still moment.
// Pure and deterministic: the same card gives the same buffer, so a test reads it in Node; the component (EventCard.tsx) puts it on a canvas shown with pixelated scaling.
import type { ScenerySpec } from '../art/scenery';
import type { CardModel } from './card';
import { fxPixels, hexNum, type FxItem } from './fx';
import { sceneryFor, specKey } from './scenery';
import { seedOf } from './seed';
import { ART, CARD_PIC } from './tuning';

/** The plain place of a card that carries none (and no life gives one): the first continent under the sky. */
const PLAIN: ScenerySpec = { continent: 'AZ', setting: 'outdoor' };

export interface CardPicture {
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

const cache = new Map<string, CardPicture>();

const rgb = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

/** Lays `c` over the pixel at `i` by `alpha`, or adds it as light. */
function blend(d: Uint8ClampedArray, i: number, c: readonly number[], alpha: number, add: boolean): void {
  for (let k = 0; k < 3; k++) d[i + k] = add ? d[i + k] + c[k] * alpha : d[i + k] + (c[k] - d[i + k]) * alpha;
  d[i + 3] = 255;
}

/** The picture of a card: its place (its own, else a plain one), the tint of its sky and its effects. Kept by what it is made of, so the many cards of a storybook cost one painting each. */
type Cardish = Pick<CardModel, 'id' | 'sky' | 'fx' | 'scenery'>;

export function cardPicture(card: Cardish): CardPicture {
  const key = `${specKey(card.scenery ?? PLAIN)}|${card.sky}|${card.fx.join(',')}|${card.id}`;
  const have = cache.get(key);
  if (have) {
    cache.delete(key);
    cache.set(key, have);
    return have;
  }
  const out = paintCard(card);
  cache.set(key, out);
  if (cache.size > CARD_PIC.keep) cache.delete(cache.keys().next().value!);
  return out;
}

/** The picture of a card painted afresh (no cache): a pure function of the card. */
export function paintCard(card: Cardish): CardPicture {
  const spec = card.scenery ?? PLAIN;
  const w = ART.w;
  const h = ART.h;
  const out: CardPicture = { w, h, data: new Uint8ClampedArray(w * h * 4) };
  const d = out.data;
  const sky = rgb(hexNum(card.sky));
  for (let i = 0; i < w * h; i++) blend(d, i * 4, sky, 1, false);
  const scenery = sceneryFor(spec);
  for (const l of scenery.layers) {
    const x0 = Math.round(-(l.frame.w - w) / 2);
    for (let y = 0; y < Math.min(h, l.frame.h); y++)
      for (let x = 0; x < w; x++) {
        const sx = x - x0;
        if (sx < 0 || sx >= l.frame.w) continue;
        const j = (y * l.frame.w + sx) * 4;
        const a = l.frame.data[j + 3] / 255;
        if (a > 0) blend(d, (y * w + x) * 4, [l.frame.data[j], l.frame.data[j + 1], l.frame.data[j + 2]], a, false);
      }
  }
  // the card's sky colour lies lightly over the place: the sky rows more than the ground
  const horizon = ART.groundY - 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blend(d, (y * w + x) * 4, sky, y < horizon ? CARD_PIC.sky : CARD_PIC.ground, false);
  const items: FxItem[] = card.fx.map((kind) => ({ kind, amount: CARD_PIC.amount }));
  for (const p of fxPixels(items, CARD_PIC.motion, seedOf(card.id), scenery.ambient)) {
    const c = rgb(p.color);
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) blend(d, (y * w + x) * 4, c, p.alpha, p.add);
  }
  return out;
}
