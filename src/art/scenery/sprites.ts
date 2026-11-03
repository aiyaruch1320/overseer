// The small things a background is built of (trees, houses by style, towers, tents, lamps and the landmarks of a town centre), drawn by the same
// painter as the people (src/art/paint.ts) so they are shaded and outlined the same way. Each returns a finished Frame whose bottom row is the
// ground line. Adapted from the lab's map (src/lab/art/map.ts) and the city plan (src/map/city.ts), which are not edited.
import { Paint, type Frame } from '../paint';
import { dark, hex, light, lum, mix, toHex, type Rgb } from './util';

const NO_SHADOW = { cx: 0, cy: 0, rx: 1e-6, ry: 1e-6 };
/** A sprite drawn with `draw` at `scale` times the size of its coordinates (default 1). */
export function sprite(w: number, h: number, draw: (p: Paint) => void, scale = 1): Frame {
  return scale === 1 ? baseSprite(w, h, draw) : baseSprite(Math.round(w * scale), Math.round(h * scale), (p) => draw(scaled(p, scale)));
}
function baseSprite(w: number, h: number, draw: (p: Paint) => void): Frame {
  const p = new Paint(w, h);
  draw(p);
  return p.finish({ ...NO_SHADOW, cy: h });
}
const hx = (c: string | Rgb): string => (typeof c === 'string' ? c : toHex(c));
const tone = (c: string, t: number): string => toHex(t >= 0 ? light(hex(c), t) : dark(hex(c), -t));

export type TreeKind = 'oak' | 'round' | 'conifer' | 'palm' | 'cactus' | 'dead' | 'shrub' | 'mushroom' | 'fern' | 'trunk' | 'willow' | 'mangrove';

/** A tree of height `h` (art pixels). `leaf` is the foliage, `bark` the trunk. `v` 0..1 varies the shape. */
export function tree(kind: TreeKind, leaf: string, bark: string, h: number, v = 0.5): Frame {
  h = Math.round(h);
  switch (kind) {
    case 'conifer': {
      const w = Math.round(h * 0.6) | 1;
      return sprite(w, h, (p) => {
        const L = p.mat(leaf), L2 = p.mat(tone(leaf, 0.08)), B = p.mat(bark), c = w >> 1;
        p.rect(c - 1, h - Math.round(h * 0.18), 2, Math.round(h * 0.18), B);
        const tiers = 3 + (h > 30 ? 1 : 0), th = Math.round((h * 0.88) / tiers);
        for (let t = tiers - 1; t >= 0; t--) {
          const y0 = Math.round(h * 0.82) - (t + 1) * th * 0.78 - th * 0.3, hw = (w / 2) * (0.45 + 0.55 * ((tiers - t) / tiers));
          p.poly([[c, y0 - th * 0.2], [c + hw, y0 + th * 1.15], [c - hw, y0 + th * 1.15]], t % 2 ? L2 : L);
        }
      });
    }
    case 'palm':
      return sprite(Math.round(h * 0.9) | 1, h, (p) => {
        const L = p.mat(leaf), B = p.mat(bark), w = p.w, lean = (v - 0.5) * h * 0.3, tx = w / 2 + lean, ty = h * 0.3;
        for (let i = 0; i <= 12; i++) { const t = i / 12; p.rect(Math.round(w / 2 + lean * t * t) - 1, Math.round(h - 1 - (h - ty) * t), 2, 2, B); }
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2, len = h * 0.36;
          for (let s = 1; s <= 10; s++) {
            const t = s / 10;
            p.px(tx + Math.cos(a) * len * t, ty + Math.sin(a) * len * t * 0.5 + t * t * len * 0.55 * (Math.sin(a) > -0.2 ? 1 : 0.3), L);
          }
        }
        p.rect(Math.round(tx) - 1, Math.round(ty), 3, 2, B);
      });
    case 'cactus':
      return sprite(Math.round(h * 0.7) | 1, h, (p) => {
        const L = p.mat(leaf), c = p.w >> 1, sw = Math.max(3, Math.round(h / 6));
        p.rect(c - (sw >> 1), 2, sw, h - 2, L);
        p.rect(c - (sw >> 1) + 1, 1, sw - 2, 1, L);
        const ay = Math.round(h * (0.35 + v * 0.1));
        p.rect(c - sw - 2, ay, 2, 2, L); p.rect(c - sw - 2, ay - Math.round(h * 0.25), 2, Math.round(h * 0.25) + 2, L);
        p.rect(c - sw, ay, sw - 1, 2, L);
        const by = Math.round(h * 0.5);
        p.rect(c + (sw >> 1) + 1, by + 1, 2, 2, L); p.rect(c + (sw >> 1) + 1, by - Math.round(h * 0.2), 2, Math.round(h * 0.2) + 3, L);
      });
    case 'dead':
      return sprite(Math.round(h * 0.8) | 1, h, (p) => {
        const B = p.mat(bark), c = p.w >> 1;
        p.line([c, h], [c + (v - 0.5) * 3, h * 0.35], B, 2);
        const tx = c + (v - 0.5) * 3;
        p.line([tx, h * 0.55], [tx - h * 0.3, h * 0.28], B);
        p.line([tx, h * 0.45], [tx + h * 0.28, h * 0.15], B);
        p.line([tx, h * 0.35], [tx - h * 0.1, h * 0.04], B);
        p.line([tx - h * 0.2, h * 0.38], [tx - h * 0.32, h * 0.42], B);
      });
    case 'shrub':
      return sprite(Math.round(h * 1.4), h, (p) => {
        const L = p.mat(leaf), L2 = p.mat(tone(leaf, 0.1));
        p.ell(p.w / 2, h * 0.62, p.w * 0.46, h * 0.4, L);
        p.ell(p.w * 0.35, h * 0.5, p.w * 0.25, h * 0.3, L2);
        p.ell(p.w * 0.68, h * 0.56, p.w * 0.22, h * 0.26, L);
      });
    case 'mushroom':
      return sprite(Math.round(h * 0.9), h, (p) => {
        const cap = p.mat(leaf), stalk = p.mat(bark), spot = p.mat(tone(leaf, 0.5), { flat: true });
        const c = p.w / 2;
        p.rect(Math.round(c) - 1, Math.round(h * 0.45), Math.max(2, Math.round(h * 0.16)), Math.round(h * 0.55), stalk);
        p.ell(c, h * 0.36, p.w * 0.48, h * 0.34, cap);
        p.rect(0, Math.round(h * 0.36), p.w, Math.round(h * 0.1), cap);
        p.px(c - 2, h * 0.24, spot); p.px(c + 2, h * 0.3, spot); p.px(c + 5, h * 0.36, spot);
      });
    case 'fern':
      return sprite(Math.round(h * 1.3), h, (p) => {
        const L = p.mat(leaf), c = p.w / 2;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI * (0.1 + 0.8 * (k / 6)), len = h * (0.7 + 0.3 * ((k * 37) % 5) / 5);
          for (let s = 1; s <= 9; s++) { const t = s / 9; p.px(c + Math.cos(a) * len * t, h - 1 + Math.sin(a) * len * t + t * t * len * 0.35, L); }
        }
      });
    case 'trunk': {
      // a giant trunk of the forest: width from `v`, root flare at the foot, bark streaks
      const w = Math.round(h * (0.06 + 0.12 * v)) | 1;
      return sprite(w + 14, h, (p) => {
        const B = p.mat(bark), B2 = p.mat(tone(bark, 0.12)), c = (w + 14) >> 1;
        for (let y = 0; y < h; y++) {
          const flare = y > h * 0.84 ? (y - h * 0.84) * 0.7 : 0, hw = w / 2 + flare;
          p.rect(Math.round(c - hw), y, Math.round(hw * 2), 1, (y + c) % 5 === 0 ? B2 : B);
        }
        for (let i = 0; i < 6; i++) p.rect(c - (w >> 1) + 1 + ((i * 7) % (w - 2)), Math.round(h * (0.1 + 0.13 * i)), 1, Math.round(h * 0.1), B2);
      });
    }
    case 'mangrove':
      return sprite(Math.round(h * 1.1), h, (p) => {
        const L = p.mat(leaf), L2 = p.mat(tone(leaf, 0.1)), B = p.mat(bark), c = p.w / 2;
        p.ell(c, h * 0.3, p.w * 0.46, h * 0.26, L);
        p.ell(c - p.w * 0.14, h * 0.24, p.w * 0.2, h * 0.14, L2);
        for (let k = 0; k < 5; k++) p.line([c + (k - 2) * 2, h * 0.5], [c + (k - 2) * (p.w * 0.17), h - 1], B);
      });
    case 'willow':
      return sprite(Math.round(h * 0.9), h, (p) => {
        const L = p.mat(leaf), B = p.mat(bark), c = p.w / 2;
        p.rect(Math.round(c) - 1, Math.round(h * 0.4), 2, Math.round(h * 0.6), B);
        p.ell(c, h * 0.3, p.w * 0.46, h * 0.26, L);
        for (let i = 0; i < p.w - 4; i += 2) p.rect(2 + i, Math.round(h * 0.3), 1, Math.round(h * (0.25 + 0.2 * (((i * 13) % 7) / 7))), L);
      });
    case 'round':
      return sprite(Math.round(h * 0.7) | 1, h, (p) => {
        const L = p.mat(leaf), L2 = p.mat(tone(leaf, 0.1)), B = p.mat(bark), c = p.w / 2;
        p.rect(Math.round(c) - 1, Math.round(h * 0.6), 2, Math.round(h * 0.4), B);
        p.ell(c, h * 0.36, p.w * 0.48, h * 0.34, L);
        p.ell(c - p.w * 0.16, h * 0.28, p.w * 0.22, h * 0.2, L2);
      });
    case 'oak':
    default:
      return sprite(Math.round(h * 0.95) | 1, h, (p) => {
        const L = p.mat(leaf), L2 = p.mat(tone(leaf, 0.1)), B = p.mat(bark), c = p.w / 2;
        p.rect(Math.round(c) - 1, Math.round(h * 0.52), Math.max(2, Math.round(h / 9)), Math.round(h * 0.48), B);
        p.ell(c, h * 0.34, p.w * 0.48, h * 0.3, L);
        p.ell(c - p.w * 0.26, h * 0.42, p.w * 0.24, h * 0.2, L);
        p.ell(c + p.w * 0.26, h * 0.4, p.w * 0.24, h * 0.2, L);
        p.ell(c - p.w * 0.1, h * 0.24, p.w * 0.22, h * 0.16, L2);
      });
  }
}

export type HouseStyle =
  | 'gable' | 'hut' | 'dome' | 'spire' | 'brick' | 'stone' | 'terrace' | 'stilt' | 'tree' | 'tent' | 'keep' | 'carved' | 'forge' | 'adobe'
  | 'tower' | 'aframe' | 'boomtown' | 'mushroom' | 'burrow';

export interface HouseOpts { roof: string; wall: string; trim?: string; glow?: string; v?: number; wood?: string; /** Draw it this many times larger (the houses of a town stand taller than the people). */ scale?: number }

/** A Paint whose drawing calls take the coordinates of the small drawing and lay them `s` times larger. */
function scaled(p: Paint, s: number): Paint {
  const r = Math.round;
  return {
    mat: (...a: Parameters<Paint['mat']>) => p.mat(...a),
    rect: (x: number, y: number, w: number, h: number, k: number) => { const x0 = r(x * s), y0 = r(y * s); p.rect(x0, y0, Math.max(1, r((x + w) * s) - x0), Math.max(1, r((y + h) * s) - y0), k); },
    ell: (cx: number, cy: number, rx: number, ry: number, k: number) => p.ell(cx * s, cy * s, rx * s, ry * s, k),
    poly: (pts: [number, number][], k: number) => p.poly(pts.map(([x, y]) => [x * s, y * s] as [number, number]), k),
    line: (a: [number, number], b: [number, number], k: number, thick = 1) => p.line([a[0] * s, a[1] * s], [b[0] * s, b[1] * s], k, Math.max(1, r(thick * s * 0.7)) > 1 ? 2 : 1),
    px: (x: number, y: number, k: number) => p.rect(r(x * s), r(y * s), Math.max(1, r(s)), Math.max(1, r(s)), k),
  } as unknown as Paint;
}

/** A house of one of the styles of the docs (`styles=`). Roughly 24 to 48 wide and 24 to 56 high; `v` 0..1 varies it. */
export function house(style: HouseStyle, o: HouseOpts): Frame {
  const S = o.scale ?? 1;
  const sprite = (w: number, h: number, draw: (p: Paint) => void): Frame => baseSprite(Math.round(w * S), Math.round(h * S), (p) => draw(S === 1 ? p : scaled(p, S)));
  const v = o.v ?? 0.5, roof = o.roof, wall = o.wall, trim = o.trim ?? tone(o.wall, -0.4), win = o.glow ?? '#d8c080';
  const wood = o.wood ?? '#5a3a24';
  const wv = Math.round(20 + v * 10);
  switch (style) {
    case 'hut':
      return sprite(wv + 6, 26, (p) => {
        const R = p.mat(roof), W = p.mat(wall), D = p.mat(wood);
        p.rect(3, 15, wv, 11, W);
        p.poly([[0, 17], [wv / 2 + 3, 2], [wv + 6, 17]], R);
        p.rect(wv / 2, 18, 5, 8, D);
        p.rect(wv / 2 + 5, 6, 1, 2, p.mat(trim));
      });
    case 'dome':
      return sprite(wv + 8, 38, (p) => {
        const R = p.mat(roof, { deep: true }), W = p.mat(wall, { deep: true }), D = p.mat(wood), G = p.mat(win, { flat: true }), T = p.mat(trim);
        p.rect(4, 22, wv, 16, W);
        p.ell((wv + 8) / 2, 22, wv / 2 + 2, 14, R);
        p.rect(0, 22, wv + 8, 3, W);
        p.rect(wv / 2 + 3, 3, 1, 7, T); p.rect(wv / 2 + 4, 3, 3, 2, p.mat('#e8d070', { flat: true }));
        p.rect(wv / 2 + 1, 28, 5, 10, D);
        p.rect(7, 28, 3, 4, G); p.rect(wv - 2, 28, 3, 4, G);
      });
    case 'spire':
      return sprite(wv - 4, 54, (p) => {
        const R = p.mat(roof), W = p.mat(wall), G = p.mat(win, { flat: true }), c = (wv - 4) / 2, T = p.mat(trim);
        p.rect(3, 26, wv - 10, 28, W);
        p.poly([[c, 0], [c + 7, 28], [c - 7, 28]], R);
        p.rect(2, 26, wv - 8, 2, T);
        p.rect(c - 1, 36, 3, 5, G); p.rect(c - 1, 46, 3, 8, p.mat(wood));
        p.px(c, -1, p.mat('#e8d070', { flat: true }));
      });
    case 'brick':
      return sprite(wv + 8, 40, (p) => {
        const W = p.mat(wall), W2 = p.mat(tone(wall, -0.12)), R = p.mat(roof), G = p.mat(win, { flat: true }), D = p.mat(wood), C = p.mat(tone(wall, -0.3));
        p.rect(4, 12, wv, 28, W);
        for (let y = 14; y < 40; y += 4) p.rect(4, y, wv, 1, W2);
        p.rect(2, 8, wv + 4, 5, R);
        p.rect(wv - 4, 0, 4, 9, C);
        p.rect(7, 18, 3, 4, G); p.rect(14, 18, 3, 4, G); p.rect(wv - 6, 18, 3, 4, G);
        p.rect(7, 28, 3, 4, G); p.rect(wv - 6, 28, 3, 4, G);
        p.rect(wv / 2 - 1, 32, 5, 8, D);
      });
    case 'stone':
      return sprite(wv + 8, 32, (p) => {
        const W = p.mat(wall), W2 = p.mat(tone(wall, -0.16)), R = p.mat(roof), D = p.mat(wood), G = p.mat(win, { flat: true });
        p.rect(3, 14, wv + 2, 18, W);
        for (let i = 0; i < 6; i++) p.rect(3 + ((i * 11) % (wv - 2)), 16 + ((i * 5) % 14), 3, 1, W2);
        p.poly([[0, 16], [8, 5], [wv, 5], [wv + 8, 16]], R);
        p.rect(wv / 2, 22, 5, 10, D);
        p.rect(8, 20, 3, 3, G);
        p.rect(wv - 4, 20, 3, 3, G);
      });
    case 'terrace':
      return sprite(wv + 10, 44, (p) => {
        const W = p.mat(wall), W2 = p.mat(tone(wall, -0.18)), R = p.mat(roof), D = p.mat(wood), G = p.mat('#2a2030', { flat: true });
        p.rect(0, 26, wv + 10, 18, W);
        p.rect(5, 14, wv, 13, W);
        p.rect(wv / 2 + 1, 4, wv / 2 - 4, 11, W);
        p.rect(0, 25, wv + 10, 1, R); p.rect(5, 13, wv, 1, R); p.rect(wv / 2 + 1, 3, wv / 2 - 4, 1, R);
        p.rect(3, 31, 3, 4, G); p.rect(wv + 3, 31, 3, 4, G);
        p.rect(wv / 2 + 3, 36, 5, 8, D);
        p.rect(wv / 2 + 6, 17, 3, 4, G);
        for (let i = 0; i < 4; i++) p.px(8 + i * 5, 22, p.mat(wood, { flat: true }));
        p.rect(4, 18, 1, 8, W2);
      });
    case 'adobe':
      return sprite(wv + 8, 32, (p) => {
        const W = p.mat(wall, { deep: true }), R = p.mat(roof), D = p.mat(wood), G = p.mat('#3a2a30', { flat: true }), B = p.mat(wood);
        p.rect(2, 8, wv + 4, 24, W);
        p.rect(1, 6, wv + 6, 3, W);
        p.rect(3, 4, wv + 2, 2, R);
        p.rect(0, 12, 3, 1, B); p.rect(wv + 5, 12, 3, 1, B); p.rect(0, 17, 3, 1, B); p.rect(wv + 5, 17, 3, 1, B);
        p.rect(wv / 2 + 1, 20, 5, 12, D);
        p.rect(7, 14, 3, 4, G);
        p.line([wv + 3, 32], [wv + 3, 10], B);
      });
    case 'stilt':
      return sprite(wv + 10, 42, (p) => {
        const W = p.mat(wall), R = p.mat(roof), D = p.mat(wood), P = p.mat(tone(wood, -0.1)), G = p.mat(win, { flat: true });
        for (let i = 0; i < 4; i++) p.rect(3 + i * Math.round((wv + 2) / 3), 28, 2, 14, P);
        p.rect(0, 26, wv + 10, 2, D);
        p.rect(4, 14, wv + 2, 12, W);
        p.poly([[1, 15], [wv / 2 + 5, 3], [wv + 9, 15]], R);
        p.rect(wv / 2 + 2, 18, 4, 8, D);
        p.rect(wv - 1, 18, 3, 3, G);
        p.line([wv + 9, 28], [wv + 9, 38], P);
      });
    case 'tree': {
      return sprite(46, 54, (p) => {
        const B = p.mat(wood, { deep: true }), L = p.mat(tone(roof, 0), { deep: true }), L2 = p.mat(tone(roof, 0.1)), W = p.mat(wall), G = p.mat(win, { flat: true });
        p.rect(18, 24, 10, 30, B);
        p.rect(14, 46, 18, 8, B);
        p.ell(23, 18, 22, 15, L);
        p.ell(12, 22, 11, 8, L); p.ell(34, 22, 11, 8, L);
        p.ell(18, 12, 9, 6, L2);
        p.rect(19, 28, 9, 8, W); p.rect(21, 31, 2, 3, G);
        p.rect(18, 26, 11, 2, p.mat(tone(wood, -0.2)));
      });
    }
    case 'tent':
      return sprite(wv + 8, 28, (p) => {
        const R = p.mat(roof, { deep: true }), T = p.mat(trim), D = p.mat('#1e1a1c', { flat: true });
        const c = (wv + 8) / 2;
        p.poly([[c, 3], [wv + 8, 28], [0, 28]], R);
        p.poly([[c - 2, 28], [c, 15], [c + 3, 28]], D);
        p.rect(c, 0, 1, 5, T);
        p.px(c + 1, 0, p.mat('#8a2a22', { flat: true })); p.px(c + 2, 1, p.mat('#8a2a22', { flat: true }));
        p.line([c - 6, 16], [c - 3, 26], T); p.line([c + 6, 16], [c + 4, 26], T);
      });
    case 'keep':
      return sprite(wv + 6, 48, (p) => {
        const W = p.mat(wall, { deep: true }), W2 = p.mat(tone(wall, -0.2)), D = p.mat(wood), G = p.mat(win, { flat: true });
        p.rect(3, 8, wv, 40, W);
        for (let x = 3; x < wv + 3; x += 5) p.rect(x, 3, 3, 6, W);
        for (let i = 0; i < 8; i++) p.rect(4 + ((i * 7) % (wv - 4)), 14 + i * 4, 3, 1, W2);
        p.rect(wv / 2 + 1, 36, 5, 12, D);
        p.rect(wv / 2 + 2, 20, 2, 5, G);
        p.rect(0, 46, wv + 6, 2, W2);
      });
    case 'carved':
      return sprite(wv + 14, 40, (p) => {
        const W = p.mat(wall, { deep: true }), W2 = p.mat(tone(wall, -0.2)), G = p.mat('#1a1214', { flat: true }), F = p.mat(win, { flat: true });
        p.poly([[0, 40], [6, 16], [14, 6], [wv, 4], [wv + 10, 14], [wv + 14, 40]], W);
        p.rect(wv / 2 + 3, 26, 6, 14, G);
        p.rect(7, 22, 3, 5, G); p.rect(wv, 22, 3, 5, G);
        p.rect(wv / 2 + 4, 24, 4, 1, W2);
        p.px(wv / 2 + 5, 36, F);
      });
    case 'forge':
      return sprite(wv + 10, 44, (p) => {
        const W = p.mat(wall), R = p.mat(roof), C = p.mat(tone(wall, -0.3)), F = p.mat('#f0a830', { flat: true }), F2 = p.mat('#e0662a', { flat: true }), D = p.mat('#1a1414', { flat: true });
        p.rect(3, 22, wv + 2, 22, W);
        p.rect(0, 18, wv + 8, 5, R);
        p.rect(wv - 3, 2, 6, 18, C);
        p.rect(wv - 2, 0, 4, 3, C);
        p.rect(wv / 2 - 1, 30, 8, 14, D);
        p.rect(wv / 2, 36, 6, 8, F2); p.rect(wv / 2 + 1, 39, 4, 5, F);
        p.px(wv, -1, p.mat('#f0a830', { flat: true }));
      });
    case 'tower':
      return sprite(20, 56, (p) => {
        const W = p.mat(wall, { deep: true }), R = p.mat(roof), G = p.mat(win, { flat: true });
        p.rect(4, 24, 12, 32, W);
        p.poly([[10, 4], [18, 25], [2, 25]], R);
        p.rect(9, 32, 2, 5, G); p.rect(9, 44, 2, 5, G);
        p.rect(7, 50, 6, 6, p.mat(wood));
      });
    case 'aframe':
      return sprite(wv + 4, 34, (p) => {
        const R = p.mat(roof, { deep: true }), D = p.mat(wood), T = p.mat(trim), G = p.mat(win, { flat: true });
        p.poly([[(wv + 4) / 2, 2], [wv + 4, 34], [0, 34]], R);
        p.rect((wv + 4) / 2 - 2, 22, 5, 12, D);
        p.rect((wv + 4) / 2, 12, 2, 4, G);
        p.rect((wv + 4) / 2, 0, 1, 4, T);
      });
    case 'boomtown':
      return sprite(wv + 8, 46, (p) => {
        const W = p.mat(wall), R = p.mat(roof), T = p.mat(trim), G = p.mat(win, { flat: true }), D = p.mat(wood), S = p.mat('#d8d070', { flat: true });
        p.rect(3, 12, wv + 2, 34, W);
        p.rect(0, 6, wv + 8, 7, R);
        p.rect(wv / 2 - 3, 8, 10, 4, S);
        p.rect(7, 18, 4, 5, G); p.rect(wv - 3, 18, 4, 5, G);
        p.rect(7, 29, 4, 5, G); p.rect(wv - 3, 29, 4, 5, G);
        p.rect(wv / 2 + 1, 36, 5, 10, D);
        p.rect(3, 12, wv + 2, 1, T);
      });
    case 'mushroom':
      return sprite(wv + 10, 42, (p) => {
        const R = p.mat(roof, { deep: true }), W = p.mat(wall), D = p.mat(wood), G = p.mat(win, { flat: true }), S = p.mat(tone(roof, 0.5), { flat: true });
        p.rect(wv / 2 + 1, 18, wv / 2 - 2, 24, W);
        p.ell((wv + 10) / 2, 16, (wv + 10) / 2 - 1, 14, R);
        p.rect(0, 16, wv + 10, 3, R);
        p.rect((wv + 10) / 2 - 1, 30, 4, 12, D);
        p.rect((wv + 10) / 2 + 4, 24, 2, 3, G);
        p.px(8, 10, S); p.px(wv - 4, 8, S); p.px(wv / 2 + 4, 5, S);
      });
    case 'burrow':
      return sprite(wv + 8, 22, (p) => {
        const M = p.mat(roof, { deep: true }), D = p.mat('#1e1612', { flat: true }), W = p.mat(wood);
        p.ell((wv + 8) / 2, 22, (wv + 8) / 2 - 1, 20, M);
        p.ell((wv + 8) / 2, 22, 5, 7, D);
        p.rect((wv + 8) / 2 - 5, 20, 10, 2, W);
      });
    case 'gable':
    default:
      return sprite(wv + 8, 36, (p) => {
        const R = p.mat(roof), W = p.mat(wall), D = p.mat(wood), G = p.mat(win, { flat: true }), C = p.mat(tone(wall, -0.3));
        p.rect(4, 17, wv, 19, W);
        if (v > 0.55) p.rect(wv - 2, 3, 4, 8, C);
        p.poly([[0, 19], [10, 3], [wv - 2, 3], [wv + 8, 19]], R);
        p.rect(wv / 2 + 1, 25, 5, 11, D);
        p.rect(7, 23, 4, 4, G); p.rect(wv - 4, 23, 4, 4, G);
      });
  }
}

// ── landmarks and props ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function tent(hide: string, bone = '#c8c0a0'): Frame {
  return sprite(34, 26, (p) => {
    const R = p.mat(hide, { deep: true }), B = p.mat(bone), D = p.mat('#1a1214', { flat: true });
    p.poly([[17, 2], [33, 26], [1, 26]], R);
    p.poly([[15, 26], [17, 14], [20, 26]], D);
    p.line([17, 2], [17, 0], B); p.line([17, 2], [11, 20], B); p.line([17, 2], [24, 20], B);
  });
}

export function banner(pole: string, cloth: string, h = 30): Frame {
  return sprite(12, h, (p) => {
    const P = p.mat(pole), C = p.mat(cloth);
    p.rect(1, 0, 1, h, P);
    p.poly([[2, 1], [11, 2], [8, 5], [11, 9], [2, 8]], C);
  });
}

export function lamp(post: string, glow: string, h = 26): Frame {
  return sprite(10, h, (p) => {
    const P = p.mat(post), G = p.mat(glow, { flat: true });
    p.rect(4, 5, 1, h - 5, P);
    p.rect(3, h - 2, 3, 2, P);
    p.rect(2, 1, 5, 5, P);
    p.rect(3, 2, 3, 3, G);
  });
}

export function chimney(brick: string, w = 8, h = 40): Frame {
  return sprite(w + 2, h, (p) => {
    const B = p.mat(brick), B2 = p.mat(tone(brick, -0.2)), T = p.mat(tone(brick, -0.4));
    p.rect(1, 3, w, h - 3, B);
    for (let y = 6; y < h; y += 5) p.rect(1, y, w, 1, B2);
    p.rect(0, 0, w + 2, 4, T);
  });
}

export function windmill(body: string, sail: string, h = 44): Frame {
  return sprite(h, h + 4, (p) => {
    const W = p.mat(body), S = p.mat(sail), R = p.mat(tone(body, -0.3)), c = h / 2, hub = Math.round(h * 0.38);
    const bw = Math.round(h * 0.2);
    p.poly([[c - bw, h + 3], [c - bw * 0.6, hub + 2], [c + bw * 0.6, hub + 2], [c + bw, h + 3]], W);
    p.poly([[c - bw * 0.8, hub + 3], [c, hub - 6], [c + bw * 0.8, hub + 3]], R);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      for (let s = 3; s <= h * 0.42; s++) p.px(c + Math.cos(a) * s, hub + Math.sin(a) * s, S);
      for (let s = 8; s <= h * 0.4; s++) { p.px(c + Math.cos(a) * s - Math.sin(a), hub + Math.sin(a) * s + Math.cos(a), S); p.px(c + Math.cos(a) * s - Math.sin(a) * 2, hub + Math.sin(a) * s + Math.cos(a) * 2, S); }
    }
    p.rect(Math.round(c) - 1, hub - 1, 3, 3, R);
  });
}

export function lighthouse(body = '#e8e8f0', cap = '#b87a3a', h = 56, beam = '#f4e090'): Frame {
  return sprite(18, h, (p) => {
    const W = p.mat(body), C = p.mat(cap), R = p.mat('#a04a3a'), G = p.mat(beam, { flat: true }), D = p.mat('#2a3038');
    p.poly([[4, h], [7, 12], [11, 12], [14, h]], W);
    p.rect(5, Math.round(h * 0.5), 8, 4, R);
    p.rect(5, Math.round(h * 0.78), 8, 4, R);
    p.rect(5, 8, 8, 5, D);
    p.rect(7, 9, 4, 3, G);
    p.poly([[9, 0], [14, 8], [4, 8]], C);
    p.rect(3, 12, 12, 1, C);
  });
}

export function gear(iron: string, r = 14, teeth = 10): Frame {
  return sprite(r * 2 + 6, r * 2 + 6, (p) => {
    const G = p.mat(iron), H = p.mat('#101418', { flat: true }), c = r + 3;
    p.ell(c, c, r, r, G);
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * Math.PI * 2;
      p.rect(Math.round(c + Math.cos(a) * (r + 1)) - 1, Math.round(c + Math.sin(a) * (r + 1)) - 1, 3, 3, G);
    }
    p.ell(c, c, r * 0.4, r * 0.4, H);
    p.ell(c, c, r * 0.18, r * 0.18, G);
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + 0.4; p.line([c, c], [c + Math.cos(a) * r * 0.9, c + Math.sin(a) * r * 0.9], G, 2); }
  });
}

export function clockTower(body: string, roof: string, h = 60, face = '#e8e4d0'): Frame {
  return sprite(22, h, (p) => {
    const W = p.mat(body), R = p.mat(roof), F = p.mat(face, { flat: true }), H = p.mat('#1a1814', { flat: true });
    p.rect(4, 18, 14, h - 18, W);
    p.poly([[11, 2], [19, 18], [3, 18]], R);
    p.ell(11, 28, 5, 5, F);
    p.line([11, 28], [11, 24], H); p.line([11, 28], [14, 29], H);
    p.rect(9, h - 10, 4, 10, p.mat('#3a2a20'));
  });
}

export function obelisk(stone: string, h = 40, rune = '#6ad0ff'): Frame {
  return sprite(14, h, (p) => {
    const S = p.mat(stone), R = p.mat(rune, { flat: true });
    p.poly([[7, 0], [11, 6], [12, h], [2, h], [3, 6]], S);
    p.rect(1, h - 4, 12, 4, S);
    for (let y = 12; y < h - 8; y += 6) p.px(7, y, R);
  });
}

export function fountain(stone: string, water = '#9ad0e8'): Frame {
  return sprite(34, 24, (p) => {
    const S = p.mat(stone), Wt = p.mat(water, { flat: true });
    p.ell(17, 19, 16, 5, S);
    p.ell(17, 18, 13, 3, Wt);
    p.rect(15, 8, 4, 12, S);
    p.ell(17, 8, 6, 2, S);
    p.line([17, 2], [17, 8], Wt); p.line([17, 2], [13, 9], Wt); p.line([17, 2], [21, 9], Wt);
  });
}

export function statue(stone: string, h = 34): Frame {
  return sprite(18, h, (p) => {
    const S = p.mat(stone);
    p.rect(2, h - 10, 14, 10, S);
    p.rect(6, h - 22, 6, 12, S);
    p.ell(9, h - 25, 3, 3, S);
    p.line([12, h - 20], [16, h - 30], S);
  });
}

export function crystal(c: string, h = 34): Frame {
  return sprite(24, h, (p) => {
    const A = p.mat(c, { flat: true }), B = p.mat(tone(c, -0.25)), L = p.mat(tone(c, 0.4), { flat: true });
    p.poly([[12, 0], [18, h * 0.35], [16, h], [8, h], [6, h * 0.35]], B);
    p.poly([[12, 3], [16, h * 0.4], [13, h - 2], [10, h * 0.4]], A);
    p.poly([[4, h * 0.6], [7, h * 0.4], [9, h]], B);
    p.px(11, 6, L); p.px(11, 7, L);
  });
}

export function gate(stone: string, w = 40, h = 38): Frame {
  return sprite(w, h, (p) => {
    const S = p.mat(stone), D = p.mat('#14100e', { flat: true });
    p.rect(0, 0, 9, h, S); p.rect(w - 9, 0, 9, h, S);
    p.rect(0, 0, w, 8, S);
    p.rect(9, 8, w - 18, h - 8, D);
    for (let x = 4; x < w; x += 6) p.rect(x, 0, 3, 3, p.mat(tone(stone, -0.2)));
  });
}

export function pyramid(stone: string, w = 70, steps = 7): Frame {
  const h = steps * 5;
  return sprite(w, h, (p) => {
    const S = p.mat(stone), S2 = p.mat(tone(stone, -0.2));
    for (let i = 0; i < steps; i++) p.rect(Math.round(((w / 2) * i) / steps), h - (i + 1) * 5, Math.round(w - (w * i) / steps), 5, i % 2 ? S : S2);
  });
}

export function bones(bone = '#d8d0b8'): Frame {
  return sprite(26, 14, (p) => {
    const B = p.mat(bone);
    for (let i = 0; i < 5; i++) p.line([4 + i * 4, 13], [6 + i * 4, 3 + (i === 2 ? 0 : 2)], B);
    p.line([2, 13], [24, 13], B);
    p.ell(22, 9, 3, 3, B);
  });
}

export function boat(hull: string, sail: string): Frame {
  return sprite(34, 30, (p) => {
    const H = p.mat(hull), S = p.mat(sail), M = p.mat('#5a3a24');
    p.poly([[0, 24], [34, 24], [28, 30], [6, 30]], H);
    p.rect(16, 2, 1, 22, M);
    p.poly([[18, 3], [30, 22], [18, 22]], S);
    p.poly([[15, 6], [6, 22], [15, 22]], S);
  });
}

export function arch(stone: string, w = 34, h = 40): Frame {
  return sprite(w, h, (p) => {
    const S = p.mat(stone), D = p.mat('#14161a', { flat: true });
    p.rect(0, 10, w, h - 10, S);
    p.ell(w / 2, 14, w / 2, 14, S);
    p.rect(8, 16, w - 16, h - 16, D);
    p.ell(w / 2, 17, (w - 16) / 2, 9, D);
    p.rect(w - 9, 0, 5, 14, S);
  });
}

export function pillar(stone: string, h = 36, w = 8, broken = false): Frame {
  return sprite(w + 4, h, (p) => {
    const S = p.mat(stone), S2 = p.mat(tone(stone, -0.18));
    p.rect(1, 0, w + 2, 3, S2);
    p.rect(2, 3, w, h - 6, S);
    p.rect(1, h - 3, w + 2, 3, S2);
    if (broken) p.poly([[0, 0], [w + 4, 0], [w + 4, 6], [w / 2 + 2, 3], [0, 8]], 0);
  });
}

export function belltower(stone: string, bell = '#b89048', h = 64): Frame {
  return sprite(28, h, (p) => {
    const S = p.mat(stone), S2 = p.mat(tone(stone, -0.2)), B = p.mat(bell), D = p.mat('#101216', { flat: true });
    p.rect(6, 22, 16, h - 22, S);
    p.poly([[14, 2], [24, 22], [4, 22]], S2);
    p.rect(10, 26, 8, 12, D);
    p.rect(12, 28, 4, 6, B);
    p.px(14, 38, B);
    for (let y = 44; y < h; y += 7) p.rect(7 + ((y * 3) % 9), y, 4, 1, S2);
  });
}

export function drape(cloth: string, h = 30): Frame {
  return sprite(12, h, (p) => {
    const C = p.mat(cloth), P = p.mat('#2a2a32');
    p.rect(0, 0, 12, 2, P);
    p.rect(1, 2, 10, h - 6, C);
    p.poly([[1, h - 4], [11, h - 4], [6, h]], C);
  });
}

export function crate(wood: string, w = 12): Frame {
  return sprite(w, w, (p) => {
    const W = p.mat(wood), W2 = p.mat(tone(wood, -0.25));
    p.rect(0, 0, w, w, W);
    p.rect(0, 0, w, 1, W2); p.rect(0, w - 1, w, 1, W2);
    p.line([1, 1], [w - 2, w - 2], W2);
  });
}

export function barrel(wood: string, h = 14): Frame {
  return sprite(11, h, (p) => {
    const W = p.mat(wood), H = p.mat('#3a3a42');
    p.ell(5.5, h / 2, 5.4, h / 2, W);
    p.rect(0, 3, 11, 1, H); p.rect(0, h - 4, 11, 1, H);
  });
}

export function stalk(c: string, h: number, tipc = c): Frame {
  return sprite(5, h, (p) => { const S = p.mat(c), T = p.mat(tipc); p.rect(2, 3, 1, h - 3, S); p.ell(2.5, 2, 1.5, 3, T); });
}

export const luminance = (h: string): number => lum(hex(h));
export const blend = (a: string, b: string, t: number): string => toHex(mix(hex(a), hex(b), t));
export { hx };
