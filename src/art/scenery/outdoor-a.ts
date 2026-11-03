// Outdoor backgrounds of the first five continents: AZ (floating islands over a sea of cloud), MH (rust mountains and a camp of bones and banners),
// KD (a black volcano, glass crags, lava cracks), NR (a grey sea, a lighthouse, stilts and a pebble beach) and AL (hills, wheat, a windmill and an oak).
import type { Frame } from '../paint';
import { GY, H, FAR_W, GND_W, MID_W, W, island, place, type Ctx } from './ctx';
import { fillRidge, halo, hash2, paintGround, smoke } from './draw';
import { scatterClouds, skyBase, sun } from './sky';
import { banner, bones, boat, chimney, house, lighthouse, tent, tree, windmill, belltower } from './sprites';
import { bayer, dark, hex, light, mix, Pix, ridgeTops, rng, type Rgb } from './util';

export interface Painter { sky(cx: Ctx): Frame; far(cx: Ctx): Frame; mid(cx: Ctx): Frame; ground(cx: Ctx): Frame }

const rain = (cx: Ctx): boolean => cx.g.rain;
const rainClouds = (cx: Ctx, px: Pix, salt: number): void => {
  if (rain(cx)) scatterClouds(cx, px, { n: 6, y: [8, 90], w: [80, 130], h: [20, 30], hi: '#aab4c0', base: '#8896a6', lo: '#667484' }, salt);
};

// ── AZ ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const AZ: Painter = {
  sky(cx) {
    const px = skyBase(cx, 135);
    sun(cx, px, 238, 40, 7, '#fff6d0', '#f4d890', 1);
    scatterClouds(cx, px, { n: 8, y: [24, 108], w: [44, 90], h: [16, 26], hi: '#ffffff', base: '#e8f0f8', lo: '#b4c8e2' }, 1);
    rainClouds(cx, px, 2);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(10), fog = g.c('#c8dcf0', 'sky');
    const tops = ridgeTops(FAR_W, 150, 18, cx.seed + 5, 16, 3, 0.55);
    fillRidge(px, tops, { body: g.c('#e8f0f8', 'sky'), lit: g.c('#ffffff', 'sky'), shade: g.c('#b8cce4', 'sky'), fog, fogAmt: 0.1 });
    for (let i = 0; i < 7; i++) {
      const hw = 16 + Math.round(r() * 26), x = 30 + i * 88 + Math.round(r() * 30), cy = 52 + Math.round(r() * 56);
      island(px, x, cy, hw, 12 + hw * 0.5, { grass: g.c('#7aa89a', 'foliage'), rock: g.c('#8a9cbc', 'rock'), rockLit: g.c('#aab8d4', 'rock'), rockShade: g.c('#6a7ca0', 'rock'), fog, fogAmt: 0.4, glow: hex('#f0f4ff'), seed: cx.seed + i * 13 });
      if (i % 2 === 0) { const s = cx.spr('azfs', () => house('spire', { roof: '#3d78c4', wall: '#e9e9f6', v: 0.5 })); place(px, s, x + hw * 0.2, cy + 1, fog, 0.5); }
    }
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(11), fog = g.c('#c8dcf0', 'sky');
    const xs: [number, number, number, number][] = [];
    for (let i = 0; i < 6; i++) xs.push([60 + i * 160 + Math.round(r() * 40), 92 + Math.round(r() * 22), 40 + Math.round(r() * 24), 24 + Math.round(r() * 10)]);
    xs.forEach(([x, cy, hw, d], i) => {
      island(px, x, cy, hw, d, { grass: g.c('#6aa05a', 'foliage'), rock: g.c('#7a8aa6', 'rock'), rockLit: g.c('#a0b0c8', 'rock'), rockShade: g.c('#566684', 'rock'), fog, fogAmt: 0.12, glow: hex('#e8ecff'), roots: g.c('#3e4a40', 'rock'), seed: cx.seed + i * 29 });
      const kind = i % 3;
      if (kind === 0) place(px, cx.spr('azs', () => house('spire', { roof: '#3d78c4', wall: '#e9e9f6', v: 0.7 })), x - hw * 0.25, cy + 1);
      if (kind === 1) place(px, cx.spr('azd', () => house('dome', { roof: '#c08a50', wall: '#f4f0e0', v: 0.3 })), x + hw * 0.1, cy + 1);
      if (kind === 2) { place(px, cx.spr('azg', () => house('gable', { roof: '#3d78c4', wall: '#f4f0e0', v: 0.2 })), x - hw * 0.3, cy + 1); place(px, cx.spr('azg2', () => house('spire', { roof: '#c9a23a', wall: '#f4f0e0', v: 0.1 })), x + hw * 0.3, cy + 1); }
      // a banner of tribute
      place(px, cx.spr('azb', () => banner('#3a3a46', '#3d78c4', 22)), x + hw * 0.62, cy + 1);
    });
    // chain bridges between neighbours
    for (let i = 0; i + 1 < xs.length; i++) {
      const [x0, y0, w0] = xs[i], [x1, y1, w1] = xs[i + 1], a = x0 + w0, b = x1 - w1;
      if (b - a > 3 && b - a < 130)
        for (let x = a; x <= b; x++) { const t = (x - a) / (b - a); px.set(x, y0 + 1 + (y1 - y0) * t + Math.sin(t * Math.PI) * 5, g.c('#2e3440', 'man')); if (x % 4 === 0) px.set(x, y0 + 2 + (y1 - y0) * t + Math.sin(t * Math.PI) * 5, g.c('#8a8a96', 'man')); }
    }
    // cloud banks in front
    const tops = ridgeTops(MID_W, 150, 14, cx.seed + 17, 22, 3, 0.55);
    fillRidge(px, tops, { body: g.c('#f0f6fb', 'sky'), lit: g.c('#ffffff', 'sky'), shade: g.c('#bdd0e6', 'sky') });
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(12);
    paintGround(px, {
      base: g.c('#5e9a58', 'ground'), shade: g.c('#447a48', 'ground'), lit: g.c('#78b068', 'ground'), haze: g.c('#a8d0c0', 'sky'), tufts: g.c('#6aa65e', 'foliage'),
      specks: [g.c('#f4f0e0', 'foliage'), g.c('#c9a24a', 'foliage')], speckDens: 0.012, vignette: 0.4, snow: g.snowAmt, seed: cx.seed + 1,
      path: { y: 154, h: 9, base: g.c('#c8ccd4', 'rock'), shade: g.c('#a0a6b4', 'rock'), edge: g.c('#e8ecf0', 'rock') },
    });
    // slab seams on the white road
    for (let x = 6; x < GND_W; x += 22) for (let y = 155; y < 162; y++) px.set(x + (y & 1), y, g.c('#8a90a2', 'rock'));
    // pennants of the tribute and a rail of black iron at the edge of the island
    for (let i = 0; i < 6; i++) place(px, cx.spr('azb2', () => banner('#2a2e3a', i % 2 ? '#3d78c4' : '#e9e9f6', 24)), 100 + i * 210 + Math.round(r() * 60), 150);
    for (let x = 0; x < GND_W; x += 3) px.set(x, 177, g.c('#1e2230', 'man')), px.set(x, 178, g.c('#1e2230', 'man'));
    for (let x = 0; x < GND_W; x += 12) { px.set(x, 176, g.c('#1e2230', 'man')); px.set(x, 175, g.c('#1e2230', 'man')); }
    return px.frame();
  },
};

// ── MH ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MH: Painter = {
  sky(cx) {
    const px = skyBase(cx, 130), r = rng(cx.seed + 3);
    sun(cx, px, 96, 100, 9, '#c8683a', '#d88a50', 1.2);
    scatterClouds(cx, px, { n: 6, y: [20, 92], w: [80, 140], h: [8, 13], hi: '#a09074', base: '#7e705a', lo: '#584c40' }, 1);
    const ash = cx.g.c('#4a4036', 'sky');
    for (let i = 0; i < 46; i++) px.set(Math.floor(r() * W), Math.floor(r() * 120), ash, 150);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(20), fog = g.c('#c8a878', 'sky');
    const tops = ridgeTops(FAR_W, 138, 62, cx.seed + 21, 6, 4, 0.58, true);
    fillRidge(px, tops, { body: g.c('#8a4a38', 'rock'), lit: g.c('#b06a4a', 'rock'), shade: g.c('#5a2e26', 'rock'), fog, fogAmt: 0.55, fogFrom: 70, snow: g.snowAmt * 0.6, grain: 0.25 });
    const tops2 = ridgeTops(FAR_W, 150, 28, cx.seed + 25, 9, 3, 0.6, true);
    fillRidge(px, tops2, { body: g.c('#7a4636', 'rock'), lit: g.c('#a05a42', 'rock'), shade: g.c('#4a2a24', 'rock'), fog, fogAmt: 0.3, fogFrom: 110, snow: g.snowAmt * 0.5, grain: 0.2 });
    // thin smoke of far camps, and a banner on a crest
    for (let i = 0; i < 3; i++) { const x = 60 + i * 190 + Math.round(r() * 50); smoke(px, x, tops2[x % FAR_W], 22 + Math.round(r() * 12), g.c('#8a7a68', 'sky'), g.c('#a89a84', 'sky'), 0.4, i + 3); }
    for (let i = 0; i < 4; i++) { const x = 40 + i * 160 + Math.round(r() * 40); for (let k = 0; k < 6; k++) px.set(x, tops[x % FAR_W] - k, g.c('#2a1a18', 'man')); px.set(x + 1, tops[x % FAR_W] - 5, g.c('#8a2a22', 'man')); px.set(x + 2, tops[x % FAR_W] - 4, g.c('#8a2a22', 'man')); }
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(21), fog = g.c('#b09a6c', 'sky');
    const tops = ridgeTops(MID_W, 152, 26, cx.seed + 22, 8, 3, 0.55);
    fillRidge(px, tops, { body: g.c('#8a7850', 'ground'), lit: g.c('#a89868', 'ground'), shade: g.c('#5e5038', 'ground'), fog, fogAmt: 0.2, fogFrom: 110, snow: g.snowAmt * 0.6, grain: 0.3 });
    // a camp: tents round a fire, banners on poles, piles of bone, dwarf trees gnawed bare
    const cxp = 250 + Math.round(r() * 40);
    [[-46, '#6a2a22'], [-18, '#5a4a3a'], [24, '#6a2a22'], [52, '#4a3a30']].forEach(([dx, c], i) => place(px, cx.spr(`mht${i}`, () => tent(c as string)), cxp + (dx as number), tops[(cxp + (dx as number)) % MID_W] + 4 + (i % 2) * 3));
    halo(px, cxp + 2, 143, 18, hex('#ffb060'), 1.1);
    for (let k = 0; k < 6; k++) { px.set(cxp + (k % 3) - 1, 146 - (k > 2 ? 1 : 0), hex('#f0a830')); px.set(cxp, 145 - k % 3, hex('#e0662a')); }
    px.rect(cxp - 3, 147, 7, 1, g.c('#3a3030', 'man'));
    for (let i = 0; i < 4; i++) { const x = 90 + i * 215 + Math.round(r() * 80); place(px, cx.spr('mhb', () => banner('#d8d0b8', '#8a2a22', 34)), x, tops[x % MID_W] + 3); }
    for (let i = 0; i < 9; i++) { const x = 30 + i * 105 + Math.round(r() * 60); place(px, cx.spr(`mhd${i % 3}`, () => tree('dead', '#000', '#5a4a3a', 14 + (i % 3) * 5, (i % 3) / 3)), x, tops[x % MID_W] + 3, undefined, 0); }
    for (let i = 0; i < 4; i++) { const x = 140 + i * 230 + Math.round(r() * 60); place(px, cx.spr('mhbn', () => bones()), x, tops[x % MID_W] + 3); }
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(22);
    paintGround(px, {
      base: g.c('#8a7a58', 'ground'), shade: g.c('#6a5c40', 'ground'), lit: g.c('#a8986e', 'ground'), haze: g.c('#c8b088', 'sky'), tufts: g.c('#8a8a50', 'foliage'),
      specks: [g.c('#c8c0a0', 'ground'), g.c('#4a4036', 'ground'), g.c('#6a2a22', 'ground')], speckDens: 0.06, vignette: 0.4, snow: g.snowAmt, seed: cx.seed + 2,
      path: { y: 154, h: 8, base: g.c('#a89a74', 'ground'), shade: g.c('#8a7c5a', 'ground') },
    });
    // cracks in the dry ground, bone splinters, stakes
    const crack = g.c('#3e3426', 'ground');
    for (let i = 0; i < 70; i++) {
      let x = Math.floor(r() * GND_W), y = GY + 3 + Math.floor(r() * 30);
      for (let k = 0; k < 6 + Math.floor(r() * 10); k++) { px.set(x, y, crack); x += r() < 0.5 ? 1 : 0; y += r() < 0.5 ? 1 : r() < 0.5 ? -1 : 0; if (r() < 0.5) x += r() < 0.5 ? 1 : -1; }
    }
    for (let i = 0; i < 14; i++) { const x = 20 + i * 90 + Math.round(r() * 50); place(px, cx.spr('mhbn', () => bones()), x, 172 + Math.round(r() * 6)); }
    for (let i = 0; i < 18; i++) { const x = 30 + i * 70 + Math.round(r() * 40), h = 6 + Math.round(r() * 6); for (let k = 0; k < h; k++) px.set(x, GY + 4 - k, g.c('#4a3a2a', 'man')); px.set(x, GY + 4 - h, g.c('#c8c0a0', 'man')); }
    return px.frame();
  },
};

// ── KD ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const KD: Painter = {
  sky(cx) {
    const px = skyBase(cx, 140);
    halo(px, 160, 132, 150, cx.g.c('#e0662a', 'sky'), 0.55);
    scatterClouds(cx, px, { n: 9, y: [10, 104], w: [90, 150], h: [18, 30], hi: '#6a5a48', base: '#4e4234', lo: '#2e2624' }, 1);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(30), fog = g.c('#7a5238', 'sky');
    const tops = ridgeTops(FAR_W, 146, 50, cx.seed + 31, 8, 4, 0.55, true);
    fillRidge(px, tops, { body: g.c('#2a2222', 'rock'), lit: g.c('#4a3a3a', 'rock'), shade: g.c('#161212', 'rock'), fog, fogAmt: 0.35, fogFrom: 80, snow: g.snowAmt, grain: 0.25 });
    // the volcano: a cone with a crater, streams of lava, a plume
    const vx = 180 + Math.round(r() * 30), vy = 52, vb = 150;
    for (let y = vy; y < vb; y++) {
      const half = 7 + (y - vy) * 1.05 + Math.sin(y * 0.5) * 0.8;
      for (let x = Math.round(vx - half); x <= vx + half; x++) {
        const u = (x - vx) / half, dd = (y - vy) / (vb - vy);
        let c: Rgb = bayer(x, y) < 0.3 + (u + 1) * 0.25 ? g.c('#161212', 'rock') : g.c('#241c1c', 'rock');
        if (u < -0.5 && dd < 0.5) c = g.c('#3a2e2e', 'rock');
        px.set(x, y, bayer(x, y) < 0.35 * dd ? mix(c, fog, 0.5) : c);
      }
    }
    for (let x = vx - 9; x <= vx + 9; x++) { px.set(x, vy, hex('#f0a830')); if (Math.abs(x - vx) < 7) px.set(x, vy + 1, hex('#e0662a')); }
    for (const [off, len] of [[-3, 70], [5, 54], [-9, 36]]) {
      let x = vx + off;
      for (let k = 0; k < len; k++) { const y = vy + 2 + k; px.set(x, y, hex('#e0662a')); if (k % 3 === 0) px.set(x + 1, y, hex('#f0a830')); x += Math.round(Math.sin(k * 0.25 + off) * 0.9) + (off < 0 ? -0.18 : 0.18) > 0.5 ? 1 : 0; x += off < 0 ? -0.22 : 0.22; }
    }
    halo(px, vx, vy, 26, hex('#e0662a'), 0.9);
    smoke(px, vx, vy - 2, 44, g.c('#5a4c42', 'sky'), g.c('#8a7a68', 'sky'), 0.25, 5);
    for (let i = 0; i < 40; i++) { const x = Math.floor(r() * FAR_W), y = tops[x] + 3 + Math.floor(r() * 12); if (r() < 0.5) px.set(x, y, hex('#e0662a'), 200); }
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(31), fog = g.c('#6a4a38', 'sky');
    const tops = ridgeTops(MID_W, 152, 44, cx.seed + 32, 14, 4, 0.6, true);
    fillRidge(px, tops, { body: g.c('#1e1a1c', 'rock'), lit: g.c('#5a5662', 'rock'), shade: g.c('#0e0c0e', 'rock'), fog, fogAmt: 0.2, fogFrom: 100, snow: g.snowAmt, grain: 0.3 });
    // glowing cracks in the glass rock, and shards that catch a steel light
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * MID_W), y0 = tops[x] + 6 + Math.floor(r() * 18);
      let xx = x;
      for (let k = 0; k < 4 + Math.floor(r() * 9); k++) { px.set(xx, y0 + k, hex(k % 4 === 0 ? '#f0a830' : '#e0662a')); xx += r() < 0.5 ? 0 : r() < 0.5 ? 1 : -1; }
    }
    // a foundry-fortress and its chimneys, lit from inside
    const fx = 220 + Math.round(r() * 30);
    place(px, cx.spr('kdk', () => house('keep', { roof: '#5a2a22', wall: '#3a3438', glow: '#f0a830', v: 0.9 })), fx, tops[fx % MID_W] + 8);
    place(px, cx.spr('kdf', () => house('forge', { roof: '#5a2a22', wall: '#3a3438', v: 0.5 })), fx + 50, tops[(fx + 50) % MID_W] + 8);
    place(px, cx.spr('kdf2', () => house('forge', { roof: '#5a2a22', wall: '#4a4448', v: 0.2 })), fx - 48, tops[(fx - 48) % MID_W] + 8);
    for (const dx of [-48, 0, 50]) halo(px, fx + dx + 2, tops[(fx + dx) % MID_W] - 26, 14, hex('#e0662a'), 0.7);
    for (let i = 0; i < 3; i++) { const x = 120 + i * 270 + Math.round(r() * 60); place(px, cx.spr('kdc', () => chimney('#3a3034', 8, 44)), x, tops[x % MID_W] + 8); halo(px, x, tops[x % MID_W] - 36, 10, hex('#e0662a'), 0.8); smoke(px, x, tops[x % MID_W] - 38, 22, g.c('#4a4044', 'sky'), g.c('#7a6a64', 'sky'), 0.3, i + 9); }
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(32);
    paintGround(px, {
      base: g.c('#2c2626', 'ground'), shade: g.c('#1c1818', 'ground'), lit: g.c('#443a3c', 'ground'), haze: g.c('#6a4a38', 'sky'),
      specks: [g.c('#8a90a0', 'rock'), g.c('#d8c040', 'rock'), g.c('#4a3e40', 'rock')], speckDens: 0.025, vignette: 0.35, snow: g.snowAmt, seed: cx.seed + 3,
      path: { y: 154, h: 8, base: g.c('#3c3436', 'ground'), shade: g.c('#2a2426', 'ground') },
    });
    // a network of lava cracks, bright core and dark rim
    for (let i = 0; i < 46; i++) {
      let x = Math.floor(r() * GND_W), y = GY + 12 + Math.floor(r() * 24);
      const len = 10 + Math.floor(r() * 26), dir = r() < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) {
        px.set(x, y - 1, hex('#6a2a22'), 200); px.set(x, y, hex(k % 5 === 0 ? '#f0a830' : '#e0662a')); px.set(x, y + 1, hex('#3a1a18'), 160);
        x += dir; if (r() < 0.45) y += r() < 0.5 ? 1 : -1;
      }
    }
    for (let i = 0; i < 90; i++) { const x = Math.floor(r() * GND_W), y = GY + 3 + Math.floor(r() * 32); px.set(x, y, hex('#d8c040'), 190); px.set(x + 1, y, hex('#d8c040'), 120); }
    for (let i = 0; i < 40; i++) { const x = Math.floor(r() * GND_W), h = 3 + Math.floor(r() * 7); for (let k = 0; k < h; k++) { px.set(x, GY + 5 - k, g.c('#14101a', 'rock')); px.set(x + 1, GY + 5 - Math.floor(k / 2), g.c('#14101a', 'rock')); } px.set(x, GY + 5 - h, hex('#8a90a0')); }
    return px.frame();
  },
};

// ── NR ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const NR: Painter = {
  sky(cx) {
    const px = skyBase(cx, 125), r = rng(cx.seed + 8);
    halo(px, 70, 52, 54, cx.g.c('#f4f6f6', 'sky'), 0.6);
    scatterClouds(cx, px, { n: 9, y: [20, 100], w: [70, 130], h: [10, 18], hi: '#f6f8f8', base: '#d4dadc', lo: '#a4b0b8' }, 1);
    // a band of rain passing on the right
    const c = cx.g.c('#7a8a98', 'sky');
    for (let i = 0; i < 90; i++) { const x = 200 + Math.floor(r() * 80), y = 60 + Math.floor(r() * 54); px.set(x, y, c, 130); px.set(x - 1, y + 1, c, 100); px.set(x - 2, y + 2, c, 70); }
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(40), fog = g.c('#dce0e0', 'sky');
    // the sea to the horizon, deeper with nearness, with glints
    const sea: Rgb[] = [g.c('#7aa0a0', 'ground'), g.c('#5a8a90', 'ground'), g.c('#3a7a78', 'ground'), g.c('#2a6460', 'ground')];
    for (let y = 122; y < H; y++) for (let x = 0; x < FAR_W; x++) {
      const t = (y - 122) / (H - 122) * 3, i = Math.min(2, Math.floor(t));
      px.set(x, y, t - i > bayer(x, y) ? sea[i + 1] : sea[i]);
    }
    for (let i = 0; i < 260; i++) { const x = Math.floor(r() * FAR_W), y = 124 + Math.floor(r() * r() * 52); const w = 1 + Math.floor((y - 122) / 14); for (let k = 0; k < w; k++) px.set(x + k, y, g.c('#e8f0f0', 'sky'), 190); }
    // low islands of grey rock and one of white salt cliffs, mangrove green on their feet
    const islands: [number, number, number, number, string][] = [[40, 60, 12, 9, '#4a6a70'], [150, 84, 22, 13, '#e0e4e8'], [330, 70, 14, 8, '#4a6a70'], [450, 100, 18, 10, '#5a7a7a'], [560, 50, 10, 6, '#4a6a70']];
    for (const [x0, w, h, , cc] of islands) {
      const tops = ridgeTops(w, 124, h, cx.seed + x0, 3, 3, 0.5);
      for (let i = 0; i < w; i++) {
        const t = tops[i] + Math.round(Math.sin((i / w) * Math.PI) * -h * 0.4);
        const edge = Math.min(i, w - 1 - i) / (w * 0.5);
        const top = Math.round(124 - (124 - tops[i]) * Math.sin((i / w) * Math.PI));
        for (let y = top; y < 125 + 3; y++) px.set(x0 + i, y, bayer(x0 + i, y) < 0.3 ? mix(hex(cc), fog, 0.5) : mix(hex(cc), fog, 0.35));
        void t; void edge;
      }
    }
    // the lighthouse of the far shore
    const lx = 248 + Math.round(r() * 20);
    place(px, cx.spr('nrl', () => lighthouse('#e8e8f0', '#b87a3a', 44)), lx, 123, fog, 0.4);
    halo(px, lx, 123 - 36, 9, hex('#f4e090'), 0.9);
    place(px, cx.spr('nrb', () => boat('#4a3a2a', '#e8e4d8')), 90, 150, fog, 0.35);
    place(px, cx.spr('nrb2', () => boat('#6a4a2a', '#e8e4d8')), 400, 140, fog, 0.5);
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(41), fog = g.c('#c8d4d4', 'sky');
    // water between the stilts and a pale wooden jetty
    const w1 = g.c('#3a7a78', 'ground'), w2 = g.c('#4e8e88', 'ground'), w3 = g.c('#2a6460', 'ground');
    for (let y = 130; y < H; y++) for (let x = 0; x < MID_W; x++) px.set(x, y, bayer(x + (y >> 2) * 2, y) < 0.4 + 0.3 * Math.sin(x / 9 + y) * 0.5 ? (y % 6 < 3 ? w1 : w2) : w3);
    for (let i = 0; i < 340; i++) { const x = Math.floor(r() * MID_W), y = 132 + Math.floor(r() * 14); px.set(x, y, g.c('#d0e4e4', 'sky'), 180); px.set(x + 1, y, g.c('#d0e4e4', 'sky'), 120); }
    // salt cliff with strata: a flat top and steep sides
    const cliffW = 110, sm = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
    for (let i = 0; i < cliffW; i++) {
      const top = Math.round(150 - 46 * sm(i / 14) * sm((cliffW - i) / 22) - Math.sin(i * 0.5) * 1.2);
      for (let y = top; y < 152; y++) px.set(8 + i, y, y === top ? g.c('#fbfbff', 'rock') : (y - top) % 8 < 2 ? g.c('#aab2ba', 'rock') : (y - top) % 8 < 4 ? g.c('#d4d8de', 'rock') : i < 5 ? g.c('#f4f4fa', 'rock') : bayer(i, y) < 0.1 + (i / cliffW) * 0.3 ? g.c('#c4c8cc', 'rock') : g.c('#e8e8f0', 'rock'));
    }
    // stilt houses on the water, mangrove trees
    const styles = [['stilt', '#a89880', '#7ac0c8'], ['stilt', '#9a8a74', '#e8e0d0'], ['dome', '#d8d0c0', '#7ac0c8']] as const;
    for (let i = 0; i < 6; i++) { const x = 190 + i * 110 + Math.round(r() * 40), [s, wall, roof] = styles[i % 3]; place(px, cx.spr(`nrh${i % 3}`, () => house(s, { roof, wall, wood: '#5a4a3a', v: (i % 4) / 4 })), x, 150); }
    for (let i = 0; i < 7; i++) { const x = 40 + i * 140 + Math.round(r() * 50); place(px, cx.spr('nrm', () => tree('mangrove', '#3a6a4a', '#4a3a2a', 24 + (i % 3) * 4, 0.5)), x, 152); }
    for (let x = 160; x < MID_W; x += 3) if (x % 110 < 80) px.set(x, 143, g.c('#8a7a64', 'man'));
    place(px, cx.spr('nrb3', () => boat('#6a4a2a', '#e8e4d8')), 640 + Math.round(r() * 40), 156);
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(42);
    paintGround(px, {
      base: g.c('#8a8e90', 'ground'), shade: g.c('#6a7078', 'ground'), lit: g.c('#a8aeb0', 'ground'), haze: g.c('#c8d4d4', 'sky'),
      specks: [g.c('#c8cccc', 'ground'), g.c('#5a6068', 'ground'), g.c('#b87a3a', 'ground'), g.c('#e8e8f0', 'ground')], speckDens: 0.12, vignette: 0.15, snow: g.snowAmt, seed: cx.seed + 4,
    });
    // pebbles with a lit top, then the tide line: foam and shallow water down to the bottom
    for (let i = 0; i < 220; i++) { const x = Math.floor(r() * GND_W), y = GY + 2 + Math.floor(r() * 24), a = 1 + Math.floor(r() * 2); px.rect(x, y, a + 1, a, g.c('#a0a6a8', 'ground')); px.rect(x, y + a, a + 1, 1, g.c('#50565c', 'ground')); px.set(x, y, g.c('#c8cccc', 'ground')); }
    const wave = ridgeTops(GND_W, 169, 5, cx.seed + 46, 40, 2, 0.5);
    for (let x = 0; x < GND_W; x++) for (let y = wave[x]; y < H; y++) {
      const d = y - wave[x];
      px.set(x, y, d < 1 ? g.c('#f4f6f6', 'sky') : d < 3 ? (bayer(x, y) < 0.6 ? g.c('#dce8e8', 'sky') : g.c('#9ac4c0', 'ground')) : bayer(x, y) < 0.25 ? g.c('#4a8a88', 'ground') : g.c('#5a9a94', 'ground'));
    }
    for (let i = 0; i < 12; i++) { const x = 40 + i * 105 + Math.round(r() * 60); for (let k = 0; k < 14; k++) px.set(x + k, 160 - Math.round(Math.sin(k * 0.2) * 1.5), g.c('#6a5a48', 'ground')); }
    for (let i = 0; i < 10; i++) { const x = 70 + i * 120 + Math.round(r() * 50); for (let k = 0; k < 8; k++) px.set(x, 150 - k, g.c('#5a4a38', 'man')); px.set(x, 142, g.c('#b87a3a', 'man')); }
    return px.frame();
  },
};

// ── AL ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const AL: Painter = {
  sky(cx) {
    const px = skyBase(cx, 135);
    sun(cx, px, 60, 36, 6, '#fff8d8', '#f8e8a0', 1);
    scatterClouds(cx, px, { n: 8, y: [26, 104], w: [44, 80], h: [18, 28], hi: '#ffffff', base: '#f0f6fa', lo: '#b4cce6' }, 1);
    rainClouds(cx, px, 2);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(50), fog = g.c('#d8ecf4', 'sky');
    const t1 = ridgeTops(FAR_W, 128, 34, cx.seed + 51, 5, 3, 0.5);
    fillRidge(px, t1, { body: g.c('#6a8ab4', 'rock'), lit: g.c('#8aa8ca', 'rock'), shade: g.c('#566e98', 'rock'), fog, fogAmt: 0.6, fogFrom: 70, snow: g.snowAmt * 0.8 });
    const t2 = ridgeTops(FAR_W, 140, 18, cx.seed + 53, 8, 3, 0.5);
    fillRidge(px, t2, { body: g.c('#7a9aa0', 'foliage'), lit: g.c('#98b4a4', 'foliage'), shade: g.c('#5e7e88', 'foliage'), fog, fogAmt: 0.4, fogFrom: 100, snow: g.snowAmt * 0.8 });
    // a patchwork of fields at the foot of the hills
    const field: Rgb[] = [g.c('#c8b45a', 'foliage'), g.c('#7aa04e', 'foliage'), g.c('#a8bc5e', 'foliage'), g.c('#d8c470', 'foliage'), g.c('#6a9a4e', 'foliage')];
    for (let x = 0; x < FAR_W; x++) {
      const i = Math.floor(x / (18 + (hash2(Math.floor(x / 18), 0, 5) * 20 | 0))) % field.length;
      for (let y = 144; y < H; y++) px.set(x, y, bayer(x, y) < (y - 144) / 40 ? field[(i + 1) % field.length] : field[i]);
    }
    place(px, cx.spr('alw', () => windmill('#e8e4d8', '#c8b898', 26)), 120 + Math.round(r() * 40), 146, fog, 0.3);
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(51), fog = g.c('#d8ecf4', 'sky');
    const tops = ridgeTops(MID_W, 150, 18, cx.seed + 54, 10, 3, 0.5);
    fillRidge(px, tops, { body: g.c('#5a9a48', 'foliage'), lit: g.c('#7ab05a', 'foliage'), shade: g.c('#427a38', 'foliage'), fog, fogAmt: 0.18, fogFrom: 110, snow: g.snowAmt });
    // wheat in rows that fan toward the viewer
    const wheat: Rgb[] = [g.c('#d8b44a', 'foliage'), g.c('#c0982e', 'foliage'), g.c('#ecd070', 'foliage')];
    for (const [x0, w] of [[300, 150], [610, 120], [30, 90]] as [number, number][])
      for (let x = x0; x < x0 + w; x++) for (let y = 136 + (tops[x % MID_W] - 130 > 0 ? 8 : 4); y < 148; y++) {
        const stripe = (x + Math.round((y - 140) * (x - x0 - w / 2) * 0.06)) % 4;
        px.set(x, y, stripe === 0 ? wheat[1] : stripe === 1 ? wheat[2] : wheat[0]);
        if (y === 136 + (tops[x % MID_W] - 130 > 0 ? 8 : 4) && bayer(x, y) < 0.5) px.set(x, y - 1, wheat[2]);
      }
    place(px, cx.spr('aloak', () => tree('oak', '#3e7a3a', '#5a3e28', 48, 0.5)), 210 + Math.round(r() * 30), 150);
    place(px, cx.spr('alwm', () => windmill('#f0ece0', '#b8a888', 50)), 520 + Math.round(r() * 30), 150);
    for (let i = 0; i < 6; i++) { const x = 40 + i * 160 + Math.round(r() * 60); place(px, cx.spr('alb', () => tree('shrub', '#3e7a3a', '#5a3e28', 8, 0.5)), x, 150); }
    for (let i = 0; i < 4; i++) { const x = 90 + i * 220 + Math.round(r() * 70); place(px, cx.spr('alh', () => house('gable', { roof: '#a85a3a', wall: '#e8e0cc', v: (i % 3) / 3 })), x, 150); }
    for (let x = 0; x < MID_W; x += 4) if (x % 120 < 70) { px.set(x, 146, g.c('#6a4a2e', 'man')); if (x % 12 === 0) { px.set(x, 145, g.c('#6a4a2e', 'man')); px.set(x, 147, g.c('#6a4a2e', 'man')); } }
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(52);
    paintGround(px, {
      base: g.c('#5aa04e', 'ground'), shade: g.c('#427a3a', 'ground'), lit: g.c('#78b862', 'ground'), haze: g.c('#a8d0b8', 'sky'), tufts: g.c('#5aa04e', 'foliage'),
      specks: [g.c('#f0e060', 'foliage'), g.c('#f4f0e8', 'foliage'), g.c('#e0786a', 'foliage')], speckDens: 0.008, vignette: 0.3, snow: g.snowAmt, seed: cx.seed + 5,
      path: { y: 153, h: 10, base: g.c('#a8845a', 'ground'), shade: g.c('#8a6a46', 'ground'), edge: g.c('#c4a074', 'ground') },
    });
    // blades that lean in the wind, and ruts of cart wheels in the road
    for (let i = 0; i < 700; i++) { const x = Math.floor(r() * GND_W), y = GY + 2 + Math.floor(r() * 34); if (y > 152 && y < 164) continue; px.set(x, y, g.c('#3e7a34', 'foliage')); px.set(x + 1, y - 1, g.c('#8ac868', 'foliage')); }
    for (let x = 0; x < GND_W; x++) { px.set(x, 157, g.c('#7a5a3a', 'ground'), 190); px.set(x, 160, g.c('#7a5a3a', 'ground'), 190); }
    return px.frame();
  },
};
void dark; void light; void belltower; void bones; void tent; void lighthouse; void boat; void sun; void rng; void GND_W;
