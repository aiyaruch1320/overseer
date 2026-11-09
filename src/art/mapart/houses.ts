// The houses of the town level (21-pixel-art.md §2: things on the map are 16 × 24 to 48 × 48 art pixels, from the UI values of the country: `styles=`
// and `roofs=`). Drawn with the pixel painter of the people (src/art/paint.ts): flat materials, then one pass of four-tone shading and a dark ring.
// A sprite stands on its bottom row (its foot): the anchor is (w / 2, h - FOOT) and the ground shadow lies under it.
import { Paint, type Frame } from '../paint';
import { mixHex, shadeHex } from './color';

export interface HouseSpec {
  /** Style of the UI value (gable dome spire tower hut tent aframe burrow mushroom brick stone terrace stilt carved keep adobe boomtown forge tree). */
  style: string;
  roof: string;
  wall: string;
  /** Width of the footprint in art pixels (clamped to 16..46). */
  w: number;
  floors: number;
  /** A named special building (palace castle temple ...): drawn larger and apart. */
  special?: string;
  /** A house that fell (a ruin): rubble and stumps of wall. */
  broken?: boolean;
  continent?: string;
  /** 0..1, a stable number that varies windows and doors of one style. */
  v?: number;
}

/** Rows under the foot line of a sprite (the ground shadow). */
export const FOOT = 3;

export const SPECIAL_COLOR: Record<string, string> = {
  palace: '#e8e0c8', castle: '#8a8a90', hall: '#b09070', manor: '#c8b898', tent: '#c8a878', temple: '#e0d8c0', shrine: '#d8d0b8', altar: '#9a9488', cathedral: '#ece6d8',
  forgealtar: '#5a4040', warehouse: '#9a7a52', library: '#8a6a4a', barracks: '#7a6a5a', market: '#c85a3a', arena: '#c8b080', granary: '#c8a050', minehead: '#4a4040',
  aerie: '#d8d4cc', fortress: '#6a6a70', drill: '#8a7a5a', skydock: '#b8c8d8',
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const GLASS = '#2a3a4a';
const DOOR = '#5a3a24';

/** The sprite of a house: its RGBA frame. */
export function houseFrame(spec: HouseSpec): Frame {
  if (spec.broken) return rubble(spec);
  if (spec.special) return special(spec);
  return ordinary(spec);
}

function ordinary(s: HouseSpec): Frame {
  const W = clamp(Math.round(s.w), 16, 46);
  const floors = clamp(s.floors, 1, 3);
  const style = s.style;
  const v = s.v ?? 0;
  const tall = style === 'spire' || style === 'tower' || style === 'keep';
  const Hh = tall ? 14 + floors * 6 : style === 'hut' || style === 'tent' || style === 'aframe' ? 7 : 8 + floors * 7;
  const Rh = style === 'spire' ? 16 : style === 'dome' ? Math.round(W * 0.4) : clamp(Math.round(W * 0.36), 7, 14);
  const fw = W + 6, fh = Hh + Rh + FOOT + 7;
  const p = new Paint(fw, fh);
  const ox = 3, fy = fh - FOOT; // foot line
  const wallC = style === 'stone' || style === 'keep' || style === 'carved' ? shadeHex(s.wall, -0.15) : style === 'adobe' ? '#c89a68' : style === 'brick' ? mixHex(s.wall, '#b07050', 0.5) : s.wall;
  const Wl = p.mat(wallC), R = p.mat(s.roof), D = p.mat(DOOR), G = p.mat(GLASS, { flat: true }), Ch = p.mat('#7a6a60');
  const trim = p.mat(shadeHex(wallC, -0.28));
  const y0 = fy - Hh; // top of the wall
  const door = (cx: number, h = 6) => p.rect(Math.round(cx - 2), fy - h, 4, h, D);
  const win = (x: number, y: number) => p.rect(x, y, 3, 3, G);

  switch (style) {
    case 'dome': {
      p.rect(ox + 1, y0, W - 2, Hh, Wl);
      p.ell(ox + W / 2, y0 + 1, W / 2 - 1, Rh + 1, R);
      p.rect(ox, y0 + 1, W, Hh, 0); // cut the lower half of the dome
      p.rect(ox + 1, y0 + 1, W - 2, Hh - 1, Wl);
      p.rect(ox + W / 2 - 1, y0 - Rh - 3, 2, 3, p.mat('#d8b050')); // finial
      door(ox + W / 2);
      for (let i = 0; i < Math.floor((W - 6) / 9); i++) win(ox + 4 + i * 9, y0 + 4);
      break;
    }
    case 'spire':
    case 'tower': {
      const tw = Math.max(12, Math.round(W * 0.62)), tx = ox + Math.round((W - tw) / 2);
      p.rect(tx, y0, tw, Hh, Wl);
      p.poly([[tx - 1, y0 + 1], [tx + tw / 2, y0 - Rh - 2], [tx + tw + 1, y0 + 1]], R);
      for (let f = 0; f < floors; f++) win(tx + Math.round(tw / 2) - 1, y0 + 3 + f * 6);
      door(tx + tw / 2, 5);
      break;
    }
    case 'keep': {
      p.rect(ox + 1, y0, W - 2, Hh, Wl);
      for (let x = ox + 1; x < ox + W - 2; x += 4) p.rect(x, y0 - 3, 2, 3, Wl);
      p.rect(ox + 1, y0 + 1, W - 2, 2, trim);
      door(ox + W / 2, 7);
      win(ox + 3, y0 + 5); win(ox + W - 6, y0 + 5);
      break;
    }
    case 'hut':
    case 'aframe': {
      p.rect(ox + 3, fy - 6, W - 6, 6, Wl);
      p.poly([[ox, fy - 4], [ox + W / 2, fy - 6 - Rh - 3], [ox + W, fy - 4]], R);
      door(ox + W / 2, 5);
      break;
    }
    case 'tent': {
      p.poly([[ox, fy], [ox + W / 2, fy - Rh - 8], [ox + W, fy]], R);
      p.poly([[ox + W / 2 - 3, fy], [ox + W / 2, fy - 8], [ox + W / 2 + 3, fy]], D);
      break;
    }
    case 'burrow':
    case 'mushroom': {
      if (style === 'mushroom') {
        // the cap (the upper half of an ellipse) on a stem, spotted
        p.ell(ox + W / 2, fy - 9, W / 2, Rh - 1, R);
        p.rect(ox, fy - 9, W, 12, 0);
        p.rect(ox + W / 2 - 3, fy - 9, 6, 9, Wl);
        const spot = p.mat('#f0e8d0', { flat: true });
        for (const [dx, dy] of [[-W * 0.25, 4], [W * 0.1, 7], [W * 0.28, 3]]) p.px(ox + W / 2 + dx, fy - 9 - dy, spot);
        door(ox + W / 2, 5);
      } else {
        p.ell(ox + W / 2, fy, W / 2, Rh + 2, R);
        p.rect(ox, fy, W, 3, 0);
        p.ell(ox + W / 2, fy - 3, 4, 4, D);
        p.rect(ox + W / 2 - 4, fy - 3, 8, 3, D);
      }
      break;
    }
    case 'tree': {
      // a house in a tree: the trunk, a cabin among the boughs, the crown over it
      const lc = p.mat(mixHex(s.roof, '#3a8a40', 0.6)), Tk = p.mat('#6a4a2e');
      p.rect(ox + W / 2 - 3, fy - Hh - 2, 6, Hh + 2, Tk);
      p.rect(ox + 3, y0 - 1, W - 6, 6, Wl);
      p.ell(ox + W / 2, y0 - 3, W / 2, Rh * 0.8 + 3, lc);
      p.rect(ox + 3, y0 + 2, W - 6, 4, Wl);
      win(ox + 5, y0 + 2);
      door(ox + W / 2, 5);
      break;
    }
    default: {
      // gable, brick, stone, terrace, stilt, carved, adobe, boomtown, forge
      const lift = style === 'stilt' ? 5 : 0;
      const by = y0 - lift, bh = Hh - 0;
      if (style === 'stilt') { p.rect(ox + 2, fy - lift, 2, lift, Ch); p.rect(ox + W - 4, fy - lift, 2, lift, Ch); p.rect(ox + W / 2 - 1, fy - lift, 2, lift, Ch); }
      if (style === 'forge') p.rect(ox + W - 9, by - Rh - 7, 4, 9, Ch);
      else p.rect(ox + Math.round(W * (0.62 + v * 0.1)), by - Rh - 3, 3, 6, Ch);
      p.rect(ox + 1, by, W - 2, bh - lift * 0 - 0, Wl);
      if (style === 'brick' || style === 'stone') {
        for (let y = by + 3; y < by + bh - 1; y += 3) for (let x = ox + 2 + ((y / 3) % 2) * 2; x < ox + W - 2; x += 4) p.px(x, y, trim);
      }
      if (style === 'terrace' || style === 'adobe') {
        p.rect(ox, by - 2, W, 3, R);
        p.rect(ox, by - 4, 2, 2, R); p.rect(ox + W - 2, by - 4, 2, 2, R);
      } else if (style === 'carved') {
        p.poly([[ox, by + 2], [ox + 2, by - 3], [ox + W - 2, by - 3], [ox + W, by + 2]], trim);
      } else if (style === 'boomtown') {
        p.rect(ox, by - Rh + 2, W, Rh - 1, Wl); p.rect(ox + 3, by - Rh + 4, W - 6, 3, trim);
        p.poly([[ox - 1, by + 2], [ox + 2, by - 1], [ox + W - 2, by - 1], [ox + W + 1, by + 2]], R);
      } else {
        p.poly([[ox - 1, by + 1], [ox + Rh * 0.85, by - Rh], [ox + W - Rh * 0.85, by - Rh], [ox + W + 1, by + 1]], R);
        p.rect(ox + 2, by + 1, W - 4, 1, trim);
      }
      door(ox + W * (0.35 + v * 0.3), 6);
      for (let f = 0; f < floors; f++) { win(ox + 3 + Math.round(v * 2), by + 3 + f * 7); if (W > 24) win(ox + W - 7, by + 3 + f * 7); }
      if (style === 'forge') p.glow(ox + W - 8, by - Rh - 7, '#ff7a2a', 0.95);
    }
  }
  return p.finish({ cx: fw / 2, cy: fh - 2, rx: W / 2 + 1, ry: 2.2 });
}

/** Palace, castle, temple and the other named buildings, by the shape that reads best at this size. */
function special(s: HouseSpec): Frame {
  const kind = s.special!;
  const W = clamp(Math.round(s.w * 1.25), 30, 46);
  const base = SPECIAL_COLOR[kind] ?? s.roof;
  const fh = 48, fw = W + 6;
  const p = new Paint(fw, fh);
  const ox = 3, fy = fh - FOOT;
  const Wl = p.mat(shadeHex(base, 0.18)), R = p.mat(base), Dk = p.mat(shadeHex(base, -0.3)), D = p.mat(DOOR), G = p.mat(GLASS, { flat: true });
  const Gold = p.mat('#d8b050');
  const door = (cx: number, h = 8) => p.rect(Math.round(cx - 2), fy - h, 5, h, D);
  const holy = kind === 'cathedral' || kind === 'temple' || kind === 'shrine' || kind === 'altar' || kind === 'aerie';
  const fort = kind === 'castle' || kind === 'fortress' || kind === 'barracks' || kind === 'drill';
  const H = fort ? 20 : holy ? 17 : 15;
  const y0 = fy - H;
  if (fort) {
    p.rect(ox + 2, y0, W - 4, H, Wl);
    for (let x = ox + 2; x < ox + W - 4; x += 4) p.rect(x, y0 - 3, 2, 3, Wl);
    for (const tx of [ox, ox + W - 8]) { p.rect(tx, y0 - 8, 8, H + 8, Wl); for (let x = tx; x < tx + 8; x += 4) p.rect(x, y0 - 11, 2, 3, Wl); p.rect(tx + 3, y0 - 4, 2, 4, G); }
    p.rect(ox + 8, y0 + 3, W - 16, 2, Dk);
    door(ox + W / 2, 10);
  } else if (kind === 'arena') {
    p.ell(ox + W / 2, fy - 8, W / 2, 10, Wl);
    p.ell(ox + W / 2, fy - 8, W / 2 - 4, 6, p.mat('#d8c690'));
    for (let x = ox + 4; x < ox + W - 3; x += 5) p.rect(x, fy - 15, 2, 3, Dk);
  } else if (kind === 'market') {
    p.rect(ox + 1, fy - 6, W - 2, 6, Wl);
    for (let i = 0, x = ox; x < ox + W - 3; i++, x += 5) p.poly([[x, y0 + 6], [x + 5, y0 + 6], [x + 5, y0 + 12], [x, y0 + 12]], i % 2 ? p.mat('#f0e8d8') : R);
    p.rect(ox, y0 + 5, W, 2, Dk);
    for (const x of [ox + 1, ox + W - 3]) p.rect(x, y0 + 6, 2, H - 6, p.mat('#6a4a2e'));
  } else if (kind === 'granary' || kind === 'minehead' || kind === 'skydock' || kind === 'forgealtar') {
    p.rect(ox + 4, y0 + 2, W - 8, H - 2, Wl);
    p.poly([[ox + 2, y0 + 3], [ox + W / 2, y0 - 8], [ox + W - 2, y0 + 3]], R);
    if (kind === 'forgealtar') { p.rect(ox + W - 10, y0 - 12, 5, 12, Dk); p.glow(ox + W - 8, y0 - 12, '#ff7a2a', 0.95); }
    if (kind === 'skydock') { p.rect(ox, y0 + H - 3, W, 3, Dk); p.rect(ox + W - 3, y0 - 10, 2, 10, Dk); }
    door(ox + W / 2, 7);
  } else {
    // palace hall library warehouse manor tent: a wide house with a roof band; the holy ones add a spire
    p.rect(ox + 1, y0, W - 2, H, Wl);
    p.poly([[ox - 1, y0 + 2], [ox + 6, y0 - 7], [ox + W - 6, y0 - 7], [ox + W + 1, y0 + 2]], R);
    if (kind === 'palace') { for (const tx of [ox, ox + W - 7]) { p.rect(tx, y0 - 6, 7, H + 6, Wl); p.poly([[tx - 1, y0 - 5], [tx + 3.5, y0 - 14], [tx + 8, y0 - 5]], Gold); } p.rect(ox + W / 2 - 4, y0 - 12, 8, 6, Gold); }
    if (holy) { p.poly([[ox + W / 2 - 5, y0 - 6], [ox + W / 2, y0 - 22], [ox + W / 2 + 5, y0 - 6]], Dk); p.rect(ox + W / 2 - 1, y0 - 26, 2, 5, Gold); }
    for (let x = ox + 5; x < ox + W - 7; x += 7) p.rect(x, y0 + 4, 3, 5, G);
    door(ox + W / 2, 9);
  }
  return p.finish({ cx: fw / 2, cy: fh - 2, rx: W / 2, ry: 2.6 });
}

/** A house that fell (20-god-ui.md §7.4): the footprint of ash and rubble, stumps of wall at different heights, a black beam. */
function rubble(s: HouseSpec): Frame {
  const W = clamp(Math.round(s.w), 16, 46);
  const fw = W + 6, fh = 22;
  const p = new Paint(fw, fh);
  const ox = 3, fy = fh - FOOT;
  const Ash = p.mat('#4a4742'), St = p.mat(shadeHex(s.wall, -0.4)), Bl = p.mat('#16140f');
  const v = s.v ?? 0.5;
  p.ell(ox + W / 2, fy - 2, W / 2, 3.5, Ash);
  p.rect(ox + 1, fy - 5 - Math.round(v * 5), 4, 5 + Math.round(v * 5), St);
  p.rect(ox + W - 6, fy - 6 - Math.round((1 - v) * 4), 4, 6 + Math.round((1 - v) * 4), St);
  p.rect(ox + Math.round(W * 0.35), fy - 3, Math.round(W * 0.3), 3, St);
  p.line([ox + 4, fy - 3], [ox + W / 2 + 2, fy - 11 - Math.round(v * 3)], Bl, 2);
  p.glow(ox + W * 0.5, fy - 3, '#d86a3a', 0.9);
  return p.finish({ cx: fw / 2, cy: fh - 2, rx: W / 2, ry: 2 });
}
