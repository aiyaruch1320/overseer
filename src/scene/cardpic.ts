// The picture of an event card (M7 ก4): a small pixel picture of 320 x 180 art pixels, painted into a plain RGBA buffer, not a Phaser game (a card is still, and many are on
// screen at once). The painted place of the event (src/art/scenery), tinted by the card's `sky`, and the card's effects as the pixels of src/scene/fx at one still moment.
// Pure and deterministic: the same card gives the same buffer, so a test reads it in Node; the component (EventCard.tsx) puts it on a canvas shown with pixelated scaling.
import type { ScenerySpec } from '../art/scenery';
import type { CardModel } from './card';
import { fxPixels, hexNum, type FxItem } from './fx';
import { sceneryFor, specKey } from './scenery';
import { seedOf } from './seed';
import { ART, CARD_PIC } from './tuning';
import { PLAIN_SKY } from './card';

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
type Cardish = Pick<CardModel, 'id' | 'sky' | 'fx' | 'scenery'> & Partial<Pick<CardModel, 'form' | 'frame'>>;

export function cardPicture(card: Cardish): CardPicture {
  const key = `${specKey(card.scenery ?? PLAIN)}|${card.sky}|${card.fx.join(',')}|${card.id}|${card.form ?? ''}|${card.frame ?? ''}`;
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

/** The painted place alone (its layers on the sky colour), the picture a stage shows while it is still loading and the ground of a card picture. */
export function paintPlace(spec: ScenerySpec, skyColor = '#14161e'): CardPicture {
  const w = ART.w;
  const h = ART.h;
  const out: CardPicture = { w, h, data: new Uint8ClampedArray(w * h * 4) };
  const d = out.data;
  const sky = rgb(hexNum(skyColor));
  for (let i = 0; i < w * h; i++) blend(d, i * 4, sky, 1, false);
  for (const l of sceneryFor(spec).layers) {
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
  return out;
}

/** How colourful a colour is, 0 (grey) to 1 (pure): the card sky of a grey event is grey, and the whole picture goes grey with it. */
export function chroma(c: readonly number[]): number {
  const hi = Math.max(c[0], c[1], c[2]);
  return hi === 0 ? 0 : (hi - Math.min(c[0], c[1], c[2])) / hi;
}

/** The picture of a card painted afresh (no cache): a pure function of the card. */
export function paintCard(card: Cardish): CardPicture {
  // a layer of the world map (form M) is not a place: it is the map with the layer laid over it
  if (card.form === 'M') return paintMapLayer(card);
  const spec = card.scenery ?? PLAIN;
  const out = paintPlace(spec, card.sky);
  const { w, h, data: d } = out;
  const sky = rgb(hexNum(card.sky));
  const scenery = sceneryFor(spec);
  // the card's sky colour lies over the place (the sky rows more than the ground): a card of ash is grey, a card of a dawn is warm, whatever land it stands on
  const horizon = ART.groundY - 6;
  // a card of an entry that has none of its own (the plain dark sky) is only touched
  const own = card.sky !== PLAIN_SKY;
  const [skyK, groundK] = own ? [CARD_PIC.sky, CARD_PIC.ground] : [CARD_PIC.plainSky, CARD_PIC.plainGround];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blend(d, (y * w + x) * 4, sky, y < horizon ? skyK : groundK, false);
  // a dull sky takes the colour out of the land too (a volcano that has gone out is not red)
  if (own && chroma(sky) < CARD_PIC.dull) {
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const grey = d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11;
      for (let k = 0; k < 3; k++) d[o + k] += (grey - d[o + k]) * CARD_PIC.drain;
    }
  }
  const items: FxItem[] = card.fx.map((kind) => ({ kind, amount: CARD_PIC.amount }));
  for (const p of fxPixels(items, CARD_PIC.motion, seedOf(card.id), scenery.ambient)) {
    const c = rgb(p.color);
    // a card is shown small: a one-pixel speck is two so the ash and the snow are seen
    const grow = p.w === 1 && p.h === 1 ? CARD_PIC.speck - 1 : 0;
    for (let y = p.y; y < Math.min(h, p.y + p.h + grow); y++) for (let x = p.x; x < Math.min(w, p.x + p.w + grow); x++) blend(d, (y * w + x) * 4, c, p.alpha, p.add);
  }
  return out;
}

/**
 * The picture of a card of form M (12-event-visuals "รูปแบบการแสดง 4 แบบ": a colour or line layer over the world map, no scene): a dark chart with its grid, nine
 * landmasses, and the layer of the event laid over them in the colour of the card's frame, as a band of hatching with a line along its edge. No scene, no figures.
 */
export function paintMapLayer(card: Cardish): CardPicture {
  const w = ART.w;
  const h = ART.h;
  const out: CardPicture = { w, h, data: new Uint8ClampedArray(w * h * 4) };
  const d = out.data;
  const sea = [18, 28, 44];
  const land = [52, 64, 70];
  const edge = [96, 110, 112];
  const layer = rgb(hexNum(card.frame ?? '#a89860'));
  const rnd = (() => { let a = seedOf(card.id) || 1; return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  // nine blobs of land on a three by three spread, each a union of discs
  const lands: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const cx = 40 + (i % 3) * 120 + (rnd() - 0.5) * 24;
    const cy = 30 + Math.floor(i / 3) * 60 + (rnd() - 0.5) * 14;
    for (let k = 0; k < 4; k++) lands.push([cx + (rnd() - 0.5) * 40, cy + (rnd() - 0.5) * 20, 12 + rnd() * 12]);
  }
  const inLand = (x: number, y: number): number => {
    let m = 0;
    for (const [cx, cy, r] of lands) m = Math.max(m, 1 - Math.hypot((x - cx) / 1.5, y - cy) / r);
    return m;
  };
  // the band of the layer: a diagonal strip across the chart, its place from the card
  const a = 0.35 + rnd() * 0.3;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const m = inLand(x, y);
      let c = m > 0.12 ? land : sea;
      if (m > 0 && m <= 0.12) c = edge;
      if (x % 32 === 0 || y % 30 === 0) c = c.map((v) => v + 10);
      const t = (x / w) * 0.6 + (y / h) * 0.4 - a;
      const on = Math.abs(t) < 0.12;
      const hatch = (x + y) % 6 < 3;
      for (let k = 0; k < 3; k++) d[o + k] = on && hatch ? c[k] + (layer[k] - c[k]) * 0.55 : on ? c[k] + (layer[k] - c[k]) * 0.2 : c[k];
      if (Math.abs(Math.abs(t) - 0.12) < 0.006) for (let k = 0; k < 3; k++) d[o + k] = layer[k];
      d[o + 3] = 255;
    }
  return out;
}
