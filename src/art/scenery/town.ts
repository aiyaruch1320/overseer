// A town scene: the continent's own sky and far land, then a row of houses of the country's styles and roof colours with its wall in front, the
// landmark of its centre (`centre=`), trees (`tree=`) and lamps, and a street paved the way of the continent over the ground.
import type { Frame } from '../paint';
import type { Ctx } from './ctx';
import { FAR_W, GND_W, GY, H, MID_W, place } from './ctx';
import { halo, hash2 } from './draw';
import type { Painter } from './outdoor-a';
import { banner, belltower, chimney, clockTower, crystal, fountain, gate, gear, house, lamp, lighthouse, obelisk, sprite, statue, tree, type HouseStyle, type TreeKind } from './sprites';
import { bayer, hex, mix, Pix, rng, toHex, type Rgb } from './util';

/** The houses of the street stand this many times larger than the drawing: a door about as tall as a person, the house set back. */
const HOUSE_SCALE = 1.8;
const STYLES: readonly HouseStyle[] = ['gable', 'hut', 'dome', 'spire', 'brick', 'stone', 'terrace', 'stilt', 'tree', 'tent', 'keep', 'carved', 'forge', 'adobe', 'tower', 'aframe', 'boomtown', 'mushroom', 'burrow'];
const isStyle = (s: string): s is HouseStyle => (STYLES as readonly string[]).includes(s);

/** The paving of the street by continent. */
type Pave = 'slab' | 'cobble' | 'plank' | 'dirt' | 'flag' | 'brick' | 'stones';
const PAVE: Record<string, { kind: Pave; a: string; b: string; seam: string }> = {
  AZ: { kind: 'slab', a: '#cdd1d8', b: '#a8aebc', seam: '#8a90a2' },
  MH: { kind: 'dirt', a: '#9a8a64', b: '#7a6c4c', seam: '#5a4c36' },
  KD: { kind: 'flag', a: '#3c3436', b: '#2a2426', seam: '#d86a2a' },
  NR: { kind: 'plank', a: '#8a7a64', b: '#6e6050', seam: '#4a3e30' },
  AL: { kind: 'cobble', a: '#9c8c7a', b: '#7a6c5c', seam: '#52483c' },
  MK: { kind: 'brick', a: '#8a6a5a', b: '#6a4e42', seam: '#443630' },
  SH: { kind: 'flag', a: '#c8a468', b: '#a88448', seam: '#7a5a34' },
  SV: { kind: 'stones', a: '#7a7a68', b: '#5a5a4c', seam: '#3a3e30' },
  NB: { kind: 'cobble', a: '#6a6e74', b: '#50545a', seam: '#363a40' },
};

/** The colours a country's materials text names, without the blues and greens (a flag or a roof, not a wall of mud or stone). */
const earthy = (m: readonly string[]): string[] => m.filter((h) => { const [r, g, b] = hex(h); return b < r + 18 && g < r + 40; });

function wallColour(cx: Ctx, style: HouseStyle, v: number): string {
  const m = earthy(cx.country?.mats ?? []), I = cx.P.inside;
  const stone = ['stone', 'keep', 'carved', 'tower'].includes(style), clay = ['adobe', 'terrace', 'dome'].includes(style);
  if (style === 'brick' || style === 'boomtown') return cx.P.base === 'MK' ? '#8a5a48' : m[1] ?? '#8a5a48';
  // Nebulia §9: low stone and wood houses, every colour held down: the country's materials only tint a grey stone or a grey weathered timber
  if (cx.P.base === 'NB') {
    const base: Rgb = stone || style === 'tower' ? [112, 114, 120] : [124, 116, 106], pal = [[92, 94, 100], [110, 106, 102], [128, 124, 118]][(v * 4) % 3 | 0] as Rgb;
    return toHex(mix(mix(base, pal, 0.5), m.length ? hex(m[(v * 4) % m.length | 0]) : base, 0.18));
  }
  // Kaz-Durum §3: black stone forts cut into the mine wall (not the pale boulders of a plain stone)
  if (stone && cx.P.base === 'KD') return toHex(mix(m[0] ? hex(m[0]) : [58, 52, 56], [44, 40, 46], 0.65));
  if (stone) return m[0] ? toHex(mix(hex(m[0]), [138, 138, 144], 0.5)) : '#8a8a90';
  if (clay) return m[1] ?? m[0] ?? (cx.P.base === 'SH' ? '#d8b080' : I.wall);
  return m[(v * 3) | 0] ?? I.wall;
}

function pick<T>(r: () => number, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let t = r() * total;
  for (let i = 0; i < items.length; i++) { t -= weights[i]; if (t <= 0) return items[i]; }
  return items[0];
}

function houseOf(cx: Ctx, r: () => number, scale = 1): { f: Frame; key: string } {
  const c = cx.country, P = cx.P;
  const names = (c?.styles.filter(isStyle) ?? []) as HouseStyle[];
  const styles = names.length ? names : P.styles;
  const style = pick(r, styles, [4, 2, 1].slice(0, styles.length));
  const roofs = c?.roofs.length ? c.roofs : P.roofs, ri = Math.floor(r() * roofs.length), v = Math.floor(r() * 4) / 4;
  let roof = roofs[ri];
  if (cx.g.snowAmt > 0) roof = toHex(mix(hex(roof), [232, 238, 246], cx.g.snowAmt * 0.45));
  const wall = wallColour(cx, style, v);
  const key = `th${style}${ri}${v}x${scale}`;
  return { f: cx.spr(key, () => house(style, { roof: toHex(cx.g.c(roof, 'man')), wall: toHex(cx.g.c(wall, 'man')), wood: P.base === 'NR' ? '#5a4a3a' : undefined, glow: P.base === 'KD' ? '#f0a830' : P.base === 'MK' ? '#d8d070' : undefined, v, scale })), key };
}

function treeKindOf(cx: Ctx): TreeKind | '' {
  const t = cx.country?.tree || cx.P.tree;
  return (['oak', 'palm', 'cactus', 'dead'] as string[]).includes(t) ? (t as TreeKind) : '';
}

/** The landmark of a town centre: a sprite and the glow it gives, or nothing for a centre the painter does not know. */
function landmark(cx: Ctx, centre: string): { f: Frame; glow?: [string, number] } | undefined {
  const g = cx.g, stone = toHex(g.c('#9a9aa2', 'man'));
  switch (centre) {
    case 'bonfire': return { f: cx.spr('cbon', () => sprite(24, 20, (p) => { const L = p.mat('#4a3424'), F = p.mat('#f0a830', { flat: true }), F2 = p.mat('#e0662a', { flat: true }); p.line([4, 19], [20, 14], L, 2); p.line([20, 19], [4, 14], L, 2); p.poly([[12, 1], [18, 15], [6, 15]], F2); p.poly([[12, 6], [16, 15], [8, 15]], F); })), glow: ['#ffb060', 24] };
    case 'obelisk': return { f: cx.spr('cobe', () => obelisk(stone, 48)), glow: ['#6ad0ff', 7] };
    case 'lighthouse': return { f: cx.spr('clh', () => lighthouse('#e8e8f0', '#b87a3a', 64)), glow: ['#f4e090', 12] };
    case 'forge': return { f: cx.spr('cfo', () => house('forge', { roof: '#5a2a22', wall: '#3a3438', v: 0.9 })), glow: ['#e0662a', 14] };
    case 'gear': return { f: cx.spr('cge', () => gear(toHex(g.c('#7a8494', 'man')), 20, 12)) };
    case 'clock': return { f: cx.spr('ccl', () => clockTower(toHex(g.c('#8a8e94', 'man')), '#5a2a22', 66)) };
    case 'crystal': case 'skynest': return { f: cx.spr('ccr', () => crystal('#8ad0e8', 40)), glow: ['#8ad0e8', 14] };
    case 'fountain': return { f: cx.spr('cfn', () => fountain(stone)) };
    case 'gate': case 'stairgate': return { f: cx.spr('cga', () => gate(stone, 44, 46)) };
    case 'statue': case 'council': return { f: cx.spr('cst', () => statue(stone, 40)) };
    case 'tower': case 'pump': case 'liftmine': return { f: cx.spr('cto', () => house('tower', { roof: '#5a5e66', wall: '#8a8e94', v: 0.5 })) };
    case 'oasis': return { f: cx.spr('coa', () => sprite(56, 40, (p) => { const W = p.mat('#4a9ac0', { flat: true }); p.ell(28, 36, 26, 4, W); p.ell(28, 36, 20, 2, p.mat('#7ac0d8', { flat: true })); })) };
    case 'lake': return { f: cx.spr('cla', () => sprite(64, 12, (p) => { p.ell(32, 10, 31, 3, p.mat('#4a8ab8', { flat: true })); p.ell(30, 10, 22, 1.5, p.mat('#8ac0e0', { flat: true })); })) };
    case 'airship': return { f: cx.spr('cai', () => sprite(60, 38, (p) => { const B = p.mat('#e9e0cc', { deep: true }), R = p.mat('#c9a23a'), G = p.mat('#4a3a2a'); p.ell(30, 14, 28, 12, B); p.rect(8, 14, 44, 3, R); p.rect(24, 28, 12, 6, G); p.line([18, 22], [26, 28], G); p.line([42, 22], [34, 28], G); })) };
    case 'worldtree': case 'sapling': return { f: cx.spr('cwt', () => tree('oak', toHex(g.c('#2e7a3e', 'foliage')), '#5a3e2c', centre === 'sapling' ? 34 : 90, 0.5)), glow: ['#9ad0a0', 12] };
    default: return undefined;
  }
}

function paveStreet(cx: Ctx, px: Pix): void {
  const pv = PAVE[cx.P.base], g = cx.g, a = g.c(pv.a, 'ground'), b = g.c(pv.b, 'ground'), seam = g.c(pv.seam, 'ground');
  const y0 = 147, y1 = 168, r = cx.rand(77);
  for (let y = y0; y < y1; y++) for (let x = 0; x < px.w; x++) {
    const row = (y - y0) >> 2, off = row & 1 ? 4 : 0;
    let c = a;
    switch (pv.kind) {
      case 'slab': { const sx = x % 24, sy = (y - y0) % 11; c = sx === 0 || sy === 0 ? seam : bayer(x, y) < 0.1 ? b : a; break; }
      case 'cobble': { const jx = (x + off) % 6, jy = (y - y0) % 4; c = jy === 3 || jx === 5 ? seam : jy === 0 ? a : hash2((x + off) / 6 | 0, row, 3) < 0.5 ? b : mix(a, b, 0.5); break; }
      case 'plank': { const jy = (y - y0) % 5; c = jy === 4 ? seam : (x + (y - y0 >> 2) * 37) % 52 === 0 ? seam : (jy === 0 ? a : bayer(x, y) < 0.12 ? b : mix(a, b, 0.25)); if (jy === 2 && (x % 52 === 3 || x % 52 === 49)) c = mix(seam, a, 0.3); break; }
      case 'brick': { const jx = (x + off) % 9, jy = (y - y0) % 4; c = jy === 3 || jx === 8 ? seam : hash2((x + off) / 9 | 0, row, 3) < 0.3 ? b : a; break; }
      case 'flag': { const cell = hash2(x / 13 | 0, (y - y0) / 7 | 0, 5), jx = x % 13, jy = (y - y0) % 7; c = jx === 0 || jy === 0 ? (pv.seam === '#d86a2a' && cell < 0.35 && jy === 0 ? hex(pv.seam) : mix(a, seam, 0.55)) : bayer(x, y) < 0.15 * cell * 2 ? b : a; break; }
      case 'stones': { c = bayer(x, y) < 0.3 ? b : mix(a, b, 0.6); const sx = Math.floor(x / 20), cx0 = sx * 20 + 10 + Math.floor(hash2(sx, 1, 6) * 6), cy0 = y0 + 10; const dd = ((x - cx0) / 8) ** 2 + ((y - cy0) / 3.4) ** 2; if (dd < 1) c = dd < 0.5 ? a : mix(a, seam, 0.2); break; }
      case 'dirt': default: c = hash2(x, y, 4) < 0.1 ? b : bayer(x, y) < 0.1 ? seam : a; break;
    }
    if (g.snowAmt > 0 && bayer(x, y) < g.snowAmt * 0.45) c = mix([228, 236, 246], c, 0.2);
    px.set(x, y, c);
  }
  // the kerbs
  for (let x = 0; x < px.w; x++) { px.set(x, y0, mix(a, [255, 244, 214], 0.3)); px.set(x, y0 - 1, seam); px.set(x, y1, seam); px.set(x, y1 + 1, mix(seam, [0, 0, 0], 0.2), 120); }
  if (pv.kind === 'dirt') for (let x = 0; x < px.w; x++) { px.set(x, 154, seam, 120); px.set(x, 160, seam, 120); }
  void r;
}

/** The wall of the country in front of the houses. */
function drawWall(cx: Ctx, px: Pix, kind: string): void {
  const g = cx.g;
  const base = 150, hgt = kind === 'palisade' ? 20 : kind === 'hedge' ? 12 : 17;
  for (let x = 0; x < px.w; x++) {
    if (kind === 'stone') {
      const top = base - hgt + ((x % 14) < 8 ? 0 : -3);
      for (let y = top; y < base; y++) { const row = (y - top) >> 2, jx = (x + (row & 1 ? 4 : 0)) % 8; px.set(x, y, jx === 7 || (y - top) % 4 === 3 ? g.c('#5a5c60', 'rock') : y === top ? g.c('#b4b6ba', 'rock') : bayer(x, y) < 0.15 ? g.c('#8a8c92', 'rock') : g.c('#9a9ca2', 'rock')); }
    } else if (kind === 'iron') {
      for (let y = base - hgt; y < base; y++) px.set(x, y, x % 20 === 0 || (y - base) % 8 === 0 ? g.c('#20242c', 'rock') : bayer(x, y) < 0.15 ? g.c('#5a6272', 'rock') : g.c('#464e5c', 'rock'));
      if (x % 6 === 2) for (let k = 1; k < 5; k++) px.set(x, base - hgt - k, g.c('#20242c', 'rock'));
      if (x % 20 === 4) px.set(x, base - hgt + 4, g.c('#8a94a4', 'rock'));
    } else if (kind === 'palisade') {
      if (x % 5 < 4) { const top = base - hgt + (hash2(x / 5 | 0, 0, 9) * 5 | 0); for (let y = top; y < base; y++) px.set(x, y, x % 5 === 0 ? g.c('#8a6a46', 'man') : x % 5 === 3 ? g.c('#4a3424', 'man') : g.c('#6a4a30', 'man')); px.set(x, top - 1, g.c('#8a6a46', 'man')); if (x % 5 === 1 || x % 5 === 2) px.set(x, top - 2, g.c('#8a6a46', 'man')); }
    } else if (kind === 'hedge') {
      const top = base - hgt + Math.round(Math.sin(x * 0.4) * 1.5);
      for (let y = top; y < base; y++) px.set(x, y, bayer(x, y) < 0.25 ? g.c('#2e6a2e', 'foliage') : y < top + 2 ? g.c('#5a9a44', 'foliage') : g.c('#3e7a36', 'foliage'));
    }
  }
}

export function townPainter(cx: Ctx, out: Painter): Painter {
  const P = cx.P, wallKind = cx.country?.wall ?? P.wall, centre = cx.country?.centre ?? '';
  return {
    sky: out.sky,
    far(c) {
      const f = out.far(c);
      const px = new Pix(FAR_W, H, true, f), r = c.rand(101), fog = c.fog;
      // the roofs of the far quarter, pulled into the haze
      let x = 0;
      while (x < FAR_W) {
        const hs = houseOf(c, r).f;
        place(px, hs, x + hs.w / 2, 156, fog, 0.58);
        x += hs.w - 2 + Math.floor(r() * 8);
      }
      return px.frame();
    },
    mid(c) {
      const px = new Pix(MID_W, H, true), r = c.rand(102), g = c.g;
      // the hill the town stands on, then houses edge to edge with small gaps, taller ones behind
      const land = g.c(PAVE[P.base].a, 'ground');
      px.rect(0, 146, MID_W, H - 146, land);
      const cxw = 215 + Math.floor((c.seed % 5) * 6);
      const lm = landmark(c, centre);
      let x = 6;
      while (x < MID_W - 20) {
        if (lm && Math.abs(x + 20 - cxw) < lm.f.w / 2 + 10) { x = cxw + lm.f.w / 2 + 12; continue; }
        const { f } = houseOf(c, r, HOUSE_SCALE);
        const tk = treeKindOf(c);
        if (tk && r() < 0.28) {
          const tf = c.spr(`tt${tk}${x % 3}`, () => tree(tk, toHex(g.c(tk === 'palm' ? '#3a8a4a' : tk === 'cactus' ? '#6a8a4e' : '#3e7a3a', 'foliage')), '#5a3e28', 40 + Math.floor(r() * 14), r()));
          place(px, tf, x + tf.w / 2, 150);
          x += tf.w + 2;
        }
        place(px, f, x + f.w / 2, 150);
        if (r() < 0.2 && P.base !== 'NB') place(px, c.spr('tbn', () => banner('#3a3a40', toHex(g.c(P.pal[(x >> 3) % 3], 'man')), 22)), x + f.w - 2, 150);
        x += f.w + 2 + Math.floor(r() * 10);
      }
      if (lm) {
        const ty = centre === 'airship' ? 78 : centre === 'lake' || centre === 'oasis' ? 152 : 150;
        place(px, lm.f, cxw, ty);
        if (lm.glow) halo(px, cxw, ty - lm.f.h * 0.55, lm.glow[1], hex(lm.glow[0]), 0.8);
        if (centre === 'oasis') for (let k = 0; k < 3; k++) place(px, c.spr('tpm', () => tree('palm', '#3a8a4a', '#6a4a30', 30)), cxw - 22 + k * 22, 148);
      }
      if (wallKind !== 'none') drawWall(c, px, wallKind);
      return px.frame();
    },
    ground(c) {
      const px = new Pix(GND_W, H, true, out.ground(c)), r = c.rand(103);
      paveStreet(c, px);
      if (cx.country ? cx.country.lamps : false) for (let i = 0; i < 8; i++) { const x = 50 + i * 160 + Math.floor(r() * 20); place(px, c.spr('tla', () => lamp('#2a2e38', toHex(hex(P.lamp)), 30)), x, 149); halo(px, x, 120, 10, hex(P.lamp), 0.9); }
      void rng;
      return px.frame();
    },
  };
}
void belltower; void chimney;
