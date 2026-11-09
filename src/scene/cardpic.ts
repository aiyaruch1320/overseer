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
import { bayer, glyphSprite, Sprite, toneOf, type Buf } from '../art/mapart/pixelmap';
import { parse } from '../art/mapart/color';

/** The plain place of a card that carries none (and no life gives one): the first continent under the sky. */
const PLAIN: ScenerySpec = { continent: 'AZ', setting: 'outdoor' };

export interface CardPicture {
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** The particles of an event whose air is grey: the card drains the colour of the land. */
const GREY_FX = new Set(['ash', 'smoke', 'fog', 'dust']);

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
  // a grey card sky (the category grey most cards of the dragons have) tints lightly, so the picture keeps the colours of its stage; a coloured one tints as before
  const dull = chroma(sky) < CARD_PIC.dull;
  const [skyK, groundK] = !own ? [CARD_PIC.plainSky, CARD_PIC.plainGround] : dull ? [CARD_PIC.dullSky, CARD_PIC.dullGround] : [CARD_PIC.sky, CARD_PIC.ground];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blend(d, (y * w + x) * 4, sky, y < horizon ? skyK : groundK, false);
  // the colour goes out of the land only for an event of grey air (a volcano that has gone out is not red): ash, smoke, fog or dust in its words
  if (own && dull && card.fx.some((k) => GREY_FX.has(k))) {
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
 * The picture of a card of form M (12-event-visuals "รูปแบบการแสดง 4 แบบ": a colour or line layer over the world map, no scene): the pixel map of the game (the
 * painters of src/art/mapart/pixelmap: dithered sea, a one-pixel coast, trees, peaks and hills, small towns), the layer of the event laid over it as a dithered tint
 * with a line along its edge, and a flag and a sail drifting over the map (the thing the world-event captions of the sea and the wind speak of). No scene, no figures.
 */
export function paintMapLayer(card: Cardish): CardPicture {
  const w = ART.w;
  const h = ART.h;
  const out: CardPicture = { w, h, data: new Uint8ClampedArray(w * h * 4) };
  const d = out.data;
  const layer = rgb(hexNum(card.frame ?? '#a89860'));
  const rnd = (() => { let a = seedOf(card.id) || 1; return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  // a main landmass and an island: sums of discs with a ragged edge; the sea deepens away from the coast
  const discs: [number, number, number][] = [];
  const blob = (cx: number, cy: number, n: number, spread: number, r0: number): void => {
    for (let k = 0; k < n; k++) discs.push([cx + (rnd() - 0.5) * spread * 2, cy + (rnd() - 0.5) * spread * 0.8, r0 * (0.6 + rnd() * 0.7)]);
  };
  blob(70, 80, 9, 62, 26);
  blob(250, 138, 6, 36, 20);
  blob(262, 34, 4, 22, 14);
  const field = (x: number, y: number): number => {
    let m = 0;
    for (const [cx, cy, r] of discs) m = Math.max(m, 1 - Math.hypot((x - cx) / 1.35, y - cy) / r);
    return m + Math.sin(x * 0.31 + y * 0.17) * 0.025;
  };
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = field(x, y);
  const setc = (x: number, y: number, c: readonly number[]): void => {
    const o = (y * w + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  };
  const seaC = (v: number, x: number, y: number): number[] => {
    const t = toneOf(v, 3, x, y);
    return [parse('#1c3c5c'), parse('#24507a'), parse('#2e6490'), parse('#3a78a4')][Math.round(t * 3)];
  };
  const landC = (v: number, x: number, y: number): number[] => {
    const t = toneOf(v, 3, x, y);
    return [parse('#6a8a4a'), parse('#587a40'), parse('#4a6c38'), parse('#3e5c30')][Math.round(t * 3)];
  };
  // the band of the layer: a diagonal strip over the map, its place from the card
  const a = 0.35 + rnd() * 0.3;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = m[y * w + x];
      const isLand = v > 0.1;
      let c: number[];
      if (isLand) c = landC(0.7 - v * 0.6 + (bayer(x * 3, y * 3) - 0.5) * 0.05, x, y);
      else c = seaC(Math.min(1, Math.max(0, 1 + v * 1.4 - 0.15)), x, y);
      // the coast: a one-pixel sand line round the land, a lighter surf in the sea beside it
      if (isLand && v < 0.18) c = parse('#d6c58a');
      else if (!isLand && v > -0.07) c = parse('#8ac0d4');
      const t = (x / w) * 0.6 + (y / h) * 0.4 - a;
      const dist = Math.abs(t);
      if (dist < 0.12 && bayer(x, y) < 0.5 - dist * 2) c = c.map((q, k) => Math.round(q + (layer[k] - q) * 0.45));
      if (Math.abs(dist - 0.12) < 0.005) c = layer;
      setc(x, y, c);
    }
  const b: Buf = { data: d, w, h };
  const landAt = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && m[Math.floor(y) * w + Math.floor(x)] > 0.28;
  // the icons of the ground, scattered on the land by the seed of the card, then the towns
  const marks: ['tree' | 'oak' | 'peak' | 'hill', number][] = [['tree', 7], ['oak', 6], ['tree', 8], ['peak', 11], ['hill', 6], ['oak', 7]];
  for (let k = 0; k < 46; k++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
    if (!landAt(x, y) || !landAt(x, y + 3)) continue;
    const [kind, n] = marks[Math.floor(rnd() * marks.length)];
    glyphSprite(kind, n, 'AZ', undefined, Math.floor(rnd() * 99)).stamp(b, x, y);
  }
  let towns = 0;
  for (let k = 0; k < 400 && towns < 4; k++) {
    const x = 24 + Math.floor(rnd() * (w - 48)), y = 24 + Math.floor(rnd() * (h - 40));
    if (!landAt(x, y) || !landAt(x - 6, y) || !landAt(x + 6, y) || !landAt(x, y + 5)) continue;
    towns++;
    const t = new Sprite(9, 7);
    t.rect(0, 3, 4, 4, '#c8b08a'); t.tri([-1, 3], [2, 0], [5, 3], '#a8483a'); t.rect(5, 4, 4, 3, '#b8a07a'); t.rect(5, 3, 4, 1, '#8a4a3a'); t.px(1, 5, '#3a2a20');
    t.outlined('#1e1a14').stamp(b, x, y);
  }
  // a sail drifting over the sea (a torn flag on a mast, a billowed sail) with its wake, and a lone flag on the land: the signs the caption speaks of
  const sx = 214 + Math.floor(rnd() * 24), sy = 88 + Math.floor(rnd() * 16);
  const ship = new Sprite(24, 24);
  ship.rect(0, 20, 18, 2, '#5a3a24'); ship.rect(1, 22, 16, 1, '#3a2418'); ship.line(9, 20, 9, 1, '#4a3424');
  ship.tri([10, 2], [10, 18], [21, 18], '#efe6cc'); ship.tri([8, 4], [8, 18], [1, 18], '#d8cdb0');
  ship.rect(10, 0, 5, 2, '#d03a3a'); ship.px(15, 1, '#d03a3a');
  ship.outlined('#1e1a14').stamp(b, sx, sy);
  for (let i = 0; i < 5; i++) { setc(Math.max(0, sx - 12 - i * 5), Math.min(h - 1, sy - 2 + (i & 1)), [214, 232, 240]); setc(Math.max(0, sx - 11 - i * 5), Math.min(h - 1, sy - 2 + (i & 1)), [214, 232, 240]); }
  const fl = new Sprite(10, 14);
  fl.line(1, 0, 1, 13, '#4a3424'); fl.rect(2, 1, 7, 4, '#d03a3a'); fl.rect(2, 3, 7, 1, '#f0d060'); fl.px(9, 2, '#d03a3a');
  for (let k = 0; k < 200; k++) {
    const x = 20 + Math.floor(rnd() * (w - 40)), y = 30 + Math.floor(rnd() * (h - 50));
    if (landAt(x, y) && landAt(x - 5, y) && landAt(x + 5, y)) { fl.outlined('#1e1a14').stamp(b, x, y); break; }
  }
  return out;
}
