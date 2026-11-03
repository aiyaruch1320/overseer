// Outdoor backgrounds of the other four continents: MK (soot-yellow sky, factories, pipes, brick and iron), SH (a sunset desert, red mesas, glass sand),
// SV (the forest under its canopy: giant trunks, moss, glowing mushrooms) and NB (the grey fog, old stones, a bell tower).
import { GY, H, FAR_W, GND_W, MID_W, W, place, type Ctx } from './ctx';
import { fillRidge, halo, hash2, paintGround, smoke, snowDust } from './draw';
import type { Painter } from './outdoor-a';
import { canopy, fogBands, scatterClouds, shafts, skyBase, stars, sun } from './sky';
import { arch, belltower, chimney, drape, gear, house, lamp, pillar, pyramid, tree } from './sprites';
import { bayer, hex, light, mix, Pix, ridgeTops, rng, toHex, type Rgb } from './util';

// ── MK ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MK: Painter = {
  sky(cx) {
    const px = skyBase(cx, 130);
    sun(cx, px, 210, 82, 9, '#ece8b8', '#d8d890', 0.7);
    scatterClouds(cx, px, { n: 8, y: [14, 100], w: [70, 120], h: [12, 20], hi: '#a0985e', base: '#7e7848', lo: '#5a5636' }, 1);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(60), fog = g.c('#c8c488', 'sky');
    const body = g.c('#4e544a', 'man'), top = g.c('#6a7066', 'man'), win = g.c('#d8d070', 'man');
    // a skyline of factories: blocks, saw-tooth roofs, chimneys with their smoke, a clock tower
    let x = 0;
    while (x < FAR_W) {
      const w = 22 + Math.floor(r() * 36), h = 22 + Math.floor(r() * 44), kind = Math.floor(r() * 3);
      for (let i = 0; i < w && x + i < FAR_W; i++) {
        const saw = kind === 1 ? Math.round(((i % 12) / 12) * 8) : 0;
        for (let y = 150 - h + saw; y < H; y++) px.set(x + i, y, bayer(x + i, y) < 0.3 + (y - 100) / 160 ? mix(body, fog, 0.5) : mix(body, fog, 0.32));
        px.set(x + i, 150 - h + saw, mix(top, fog, 0.3));
      }
      for (let k = 0; k < Math.floor(w / 9); k++) for (let j = 0; j < 2; j++) if (r() < 0.55) px.set(x + 3 + k * 8, 150 - h + 8 + j * 8, win, 220);
      if (kind === 2) { const cxm = x + w - 6; for (let y = 150 - h - 18; y < 150 - h; y++) { px.set(cxm, y, mix(body, fog, 0.3)); px.set(cxm + 1, y, mix(body, fog, 0.3)); px.set(cxm + 2, y, mix(body, fog, 0.4)); } if (r() < 0.8) smoke(px, cxm + 1, 150 - h - 20, 18 + Math.floor(r() * 24), g.c('#8a8660', 'sky'), g.c('#a8a478', 'sky'), 0.35 + r() * 0.2, Math.floor(r() * 100)); }
      x += w + Math.floor(r() * 6);
    }
    // a big clock tower in the cleared stretch
    place(px, cx.spr('mkct', () => tower(g.c('#5a6058', 'man'), g.c('#4a3a30', 'man'))), 150, 150, fog, 0.3);
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(61), fog = g.c('#b8b478', 'sky');
    const brick = ['#8a4a38', '#7a4232', '#6a3a2a'].map((h) => g.c(h, 'man'));
    let x = 0;
    while (x < MID_W) {
      const w = 40 + Math.floor(r() * 50), h = 34 + Math.floor(r() * 36);
      for (let i = 0; i < w && x + i < MID_W; i++) for (let y = 150 - h; y < H; y++) {
        const row = (y >> 2) & 1, col = ((x + i + (row ? 3 : 0)) % 7);
        px.set(x + i, y, y === 150 - h ? g.c('#3a3030', 'man') : col === 0 || (y & 3) === 0 ? brick[2] : (i < 3 ? mix(brick[0], [255, 220, 180], 0.1) : brick[(x + i + y) % 5 === 0 ? 1 : 0]));
      }
      // windows lit by gas, one with the cold blue of a rune
      for (let k = 0; k < Math.floor(w / 12); k++) for (let j = 0; j < Math.floor(h / 14); j++) {
        const wx = x + 6 + k * 11, wy = 150 - h + 6 + j * 12, blue = r() < 0.08;
        if (r() < 0.7) { px.rect(wx, wy, 4, 6, blue ? hex('#6ad0ff') : hex('#d8d070')); px.rect(wx, wy + 3, 4, 1, g.c('#3a2a20', 'man')); }
      }
      if (r() < 0.5) { place(px, cx.spr('mkc', () => chimney('#7a4232', 8, 38)), x + w - 10, 150 - h + 3); smoke(px, x + w - 9, 150 - h - 32, 26, g.c('#7a7650', 'sky'), g.c('#9a966a', 'sky'), 0.4, Math.floor(r() * 90)); }
      x += w + 6 + Math.floor(r() * 10);
    }
    // pipes along the buildings with joints, the great gear half behind them, girders
    for (let i = 0; i < 5; i++) { const x0 = 40 + i * 190 + Math.floor(r() * 50), y = 128 + Math.floor(r() * 12), len = 60 + Math.floor(r() * 80); for (let k = 0; k < len; k++) { px.set(x0 + k, y, g.c('#8a94a4', 'man')); px.set(x0 + k, y + 1, g.c('#5a6272', 'man')); if (k % 14 === 0) { px.rect(x0 + k, y - 1, 2, 4, g.c('#c08a3a', 'man')); } } }
    place(px, cx.spr('mkg', () => gear(toHex(g.c('#5a6272', 'man')), 22, 12)), 330, 160);
    place(px, cx.spr('mkg2', () => gear(toHex(g.c('#6a7282', 'man')), 12, 8)), 372, 160);
    for (let i = 0; i < 5; i++) place(px, cx.spr('mkl', () => lamp('#3a3e48', '#e8dc80', 26)), 90 + i * 200 + Math.floor(r() * 30), 150);
    for (let i = 0; i < 5; i++) halo(px, 95 + i * 200, 124, 7, hex('#e8dc80'), 0.9);
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(62);
    // bricks laid in courses, iron plates with rivets, a pair of rails, a gutter of coloured water at the bottom
    for (let y = GY; y < 171; y++) for (let x = 0; x < GND_W; x++) {
      const row = (y - GY) >> 2, off = row & 1 ? 5 : 0, plate = Math.floor(x / 140) % 3 === 1;
      if (plate) { px.set(x, y, (x % 140 === 0 || y === GY) ? g.c('#3a4250', 'rock') : bayer(x, y) < 0.15 ? g.c('#7a8494', 'rock') : g.c('#5e6878', 'rock')); if ((x % 140) % 16 === 4 && (y - GY) % 8 === 2) px.set(x, y, g.c('#9aa4b4', 'rock')); continue; }
      const mortar = (y - GY) % 4 === 3 || (x + off) % 10 === 9;
      px.set(x, y, mortar ? g.c('#4a3e3a', 'ground') : (x + off + row * 3) % 9 < 2 ? g.c('#9a7a68', 'ground') : bayer(x, y) < 0.2 ? g.c('#7a5e50', 'ground') : g.c('#8a6a5a', 'ground'));
    }
    for (let x = 0; x < GND_W; x++) { px.set(x, 160, g.c('#2a2e38', 'rock')); px.set(x, 161, g.c('#9aa4b4', 'rock')); px.set(x, 168, g.c('#2a2e38', 'rock')); px.set(x, 169, g.c('#9aa4b4', 'rock')); if (x % 9 < 2) { px.set(x, 162, g.c('#4a3a2e', 'rock')); px.set(x, 163, g.c('#4a3a2e', 'rock')); px.set(x, 167, g.c('#4a3a2e', 'rock')); px.set(x, 166, g.c('#4a3a2e', 'rock')); } }
    for (let y = 172; y < H; y++) for (let x = 0; x < GND_W; x++) px.set(x, y, bayer(x + y, y) < 0.3 ? g.c('#a8b83a', 'ground') : g.c('#8a9a3a', 'ground'));
    for (let x = 0; x < GND_W; x++) px.set(x, 171, g.c('#2a2e38', 'rock'));
    for (let i = 0; i < 8; i++) { const x = 60 + i * 150 + Math.floor(r() * 50); smoke(px, x, 146, 14, g.c('#c8c8c0', 'sky'), g.c('#e8e8e0', 'sky'), 0.1, i + 2); px.rect(x - 2, 146, 5, 2, g.c('#3a3e48', 'man')); }
    for (let i = 0; i < 6; i++) place(px, cx.spr('mkl2', () => lamp('#2a2e38', '#e8dc80', 34)), 30 + i * 230 + Math.floor(r() * 50), 149);
    snowDust(px, GY, 171, g.snowAmt);
    return px.frame();
  },
};
function tower(body: Rgb, roof: Rgb): import('../paint').Frame {
  // the clock tower of the boom: square shaft, brass face, brick cap
  const w = 22, h = 62, px = new Pix(w, h);
  px.rect(4, 22, 14, h - 22, body); px.rect(2, 20, 18, 3, roof); px.rect(5, 8, 12, 12, body); px.rect(3, 6, 16, 3, roof);
  for (let i = 0; i < 6; i++) px.rect(10 + (i % 2), 0 + i, 2 - (i > 3 ? 1 : 0), 1, roof);
  px.disc(11, 28, 5, hex('#c08a3a')); px.disc(11, 28, 4, hex('#e8e4d0'));
  px.line(11, 28, 11, 25, hex('#1a1814')); px.line(11, 28, 13, 29, hex('#1a1814'));
  px.rect(9, h - 12, 4, 12, hex('#2a2a2a'));
  return px.frame();
}

// ── SH ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const SH: Painter = {
  sky(cx) {
    const px = skyBase(cx, 120);
    stars(cx, px, 70, 64, 1);
    sun(cx, px, 232, 100, 11, '#ffe9a0', '#f8c878', 1.1);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(70), fog = g.c('#d89a78', 'sky');
    const tops = ridgeTops(FAR_W, 146, 96, cx.seed + 71, 4, 4, 0.55, true);
    fillRidge(px, tops, { body: g.c('#7a3e4c', 'rock'), lit: g.c('#a85a58', 'rock'), shade: g.c('#42284a', 'rock'), fog, fogAmt: 0.5, fogFrom: 60, snow: g.snowAmt * 0.4, grain: 0.25 });
    // strata: darker courses across the rock, and a far step pyramid
    for (let y = 60; y < 150; y += 7) for (let x = 0; x < FAR_W; x++) if (y > tops[x] + 2 && bayer(x, y) < 0.4) px.set(x, y, g.c('#5a3248', 'rock'), 120);
    place(px, cx.spr('shp', () => pyramid('#d8b878', 64, 7)), 120 + Math.round(r() * 30), 148, fog, 0.5);
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(71), fog = g.c('#e0b08a', 'sky');
    const bands: Rgb[] = ['#b04a2a', '#8a3a28', '#c8704a', '#e0c8a0', '#9a4430', '#b85a38'].map((h) => g.c(h, 'rock'));
    // mesas: flat tops, banded sides, the lit left edge and the violet shade on the right
    const mesas: [number, number, number][] = [];
    let x = -20;
    while (x < MID_W) { const w = 54 + Math.floor(r() * 60), h = 26 + Math.floor(r() * 36); mesas.push([x, w, h]); x += w + 20 + Math.floor(r() * 50); }
    for (const [x0, w, h] of mesas) {
      for (let i = 0; i < w; i++) {
        const u = i / w, talus = Math.max(0, Math.min(i, w - 1 - i) < 8 ? 8 - Math.min(i, w - 1 - i) : 0);
        for (let y = 150 - h + talus * 0.6; y < H; y++) {
          const band = bands[Math.abs(Math.floor((y - (150 - h)) / 5) + (x0 >> 3)) % bands.length];
          let c = band;
          if (u < 0.12) c = light(c, 0.12); else if (u > 0.78) c = bayer(x0 + i, y) < 0.6 ? g.c('#5a3a50', 'rock') : mix(c, [90, 58, 80], 0.5);
          px.set(x0 + i, y, y === Math.round(150 - h + talus * 0.6) ? light(c, 0.2) : c);
        }
      }
      if (r() < 0.55) place(px, cx.spr('shh', () => house('adobe', { roof: '#7a3a28', wall: '#e0c090', v: r() })), x0 + w * 0.4, 150 - h + 1);
      if (r() < 0.4) place(px, cx.spr('shh2', () => house('terrace', { roof: '#b04a2a', wall: '#e8d4a8', v: r() })), x0 + w * 0.7, 150 - h + 1);
    }
    // the dune in front, the shade of each ridge in violet
    const dune = ridgeTops(MID_W, 152, 16, cx.seed + 74, 12, 2, 0.5);
    fillRidge(px, dune, { body: g.c('#d8b060', 'ground'), lit: g.c('#f0cc80', 'ground'), shade: g.c('#a07040', 'ground'), fog, fogAmt: 0.12, fogFrom: 120, snow: g.snowAmt * 0.4, grain: 0.15 });
    for (let i = 0; i < 9; i++) { const x1 = 40 + i * 105 + Math.round(r() * 40); place(px, cx.spr('shc', () => tree('cactus', '#6a8a4e', '#000', 16 + (i % 3) * 5, (i % 4) / 4)), x1, dune[x1 % MID_W] + 4); }
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(72);
    paintGround(px, {
      base: g.c('#d8b060', 'ground'), shade: g.c('#b8904a', 'ground'), lit: g.c('#ecca80', 'ground'), haze: g.c('#f0c890', 'sky'),
      specks: [g.c('#f8f0d0', 'ground'), g.c('#a8784a', 'ground'), g.c('#e8e0c8', 'ground')], speckDens: 0.03, vignette: 0.25, snow: g.snowAmt, seed: cx.seed + 7,
      path: { y: 155, h: 8, base: g.c('#c09a52', 'ground'), shade: g.c('#a07c40', 'ground') },
    });
    // ripples of wind in the sand and glints of glass
    for (let i = 0; i < 130; i++) { const x = Math.floor(r() * GND_W), y = GY + 4 + Math.floor(r() * 30), len = 6 + Math.floor(r() * 14); for (let k = 0; k < len; k++) px.set(x + k, y + Math.round(Math.sin(k * 0.5) * 0.9), k % 3 ? g.c('#f2d890', 'ground') : g.c('#a8844a', 'ground')); }
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * GND_W), y = GY + 2 + Math.floor(r() * 34); px.set(x, y, hex('#fffbe8')); px.set(x + 1, y, hex('#fffbe8'), 140); }
    for (let i = 0; i < 22; i++) { const x = 20 + i * 58 + Math.round(r() * 30), w = 4 + Math.round(r() * 5); px.rect(x, 170 - Math.round(r() * 4), w, 3, g.c('#8a3a28', 'rock')); px.rect(x, 170 - Math.round(r() * 4), w, 1, g.c('#c8704a', 'rock')); }
    return px.frame();
  },
};

// ── SV ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const SV: Painter = {
  sky(cx) {
    const px = skyBase(cx, 150);
    shafts(cx, px, cx.g.c('#f0e8a0', 'sky'), 5, 1, 0.45, 0.2);
    canopy(cx, px, ['#0e2416', '#1a3c22', '#2a5a30', '#4a8a44'].map((h) => cx.g.c(h, 'foliage')), 52, 1);
    // spores and motes of pollen in the light
    const r = rng(cx.seed + 5);
    for (let i = 0; i < 40; i++) px.set(Math.floor(r() * W), 60 + Math.floor(r() * 90), hex('#f0e8a0'), 140);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(80), fog = g.c('#8ab486', 'sky');
    for (let y = 0; y < H; y++) for (let x = 0; x < FAR_W; x++) if (y > 40 && bayer(x, y) < (y - 40) / 220) px.set(x, y, fog, 160);
    for (let i = 0; i < 10; i++) {
      const x = 20 + i * 62 + Math.round(r() * 24), w = 12 + Math.round(r() * 14);
      place(px, cx.spr(`svf${i % 4}`, () => tree('trunk', '#000', '#2e4a44', 170, (i % 4) / 4 * 0.6)), x, 170, fog, 0.55);
      void w;
    }
    for (let i = 0; i < 40; i++) { const x = Math.floor(r() * FAR_W), y = 140 + Math.floor(r() * 24); px.set(x, y, g.c(r() < 0.5 ? '#8a5a8a' : '#9ad0a0', 'foliage'), 170); }
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(81), fog = g.c('#6a9a6a', 'sky');
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 108 + Math.round(r() * 40), hh = 175 + Math.round(r() * 10);
      place(px, cx.spr(`svm${i % 5}`, () => tree('trunk', '#000', '#6a4a34', hh, 0.3 + (i % 5) * 0.14)), x, 158, fog, 0.1);
      // hanging vines
      for (let k = 0; k < 3; k++) { const vx = x - 14 + k * 11, len = 20 + Math.round(r() * 40); for (let y = 0; y < len; y++) px.set(vx + Math.round(Math.sin(y * 0.15 + k) * 1.2), 54 + y, g.c('#3e7a3a', 'foliage')); px.set(vx, 54 + len, g.c('#9ad0a0', 'foliage')); }
    }
    for (let i = 0; i < 12; i++) { const x = 20 + i * 80 + Math.round(r() * 50); place(px, cx.spr('svfern', () => tree('fern', '#2e7a3e', '#000', 16 + (i % 3) * 5)), x, 152); }
    for (let i = 0; i < 18; i++) { const x = 20 + i * 52 + Math.round(r() * 30), pur = i % 3 !== 2; const m = cx.spr(`svmu${pur}`, () => tree('mushroom', pur ? '#8a5a8a' : '#9ad0a0', '#d8d0c0', 10 + (i % 3) * 4)); place(px, m, x, 152); halo(px, x, 146, 8, hex(pur ? '#8a5a8a' : '#9ad0a0'), 0.8); }
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(82);
    paintGround(px, {
      base: g.c('#2e6a3a', 'ground'), shade: g.c('#1e4a2a', 'ground'), lit: g.c('#4a9a4a', 'ground'), haze: g.c('#7aaa7a', 'sky'), tufts: g.c('#3e8a42', 'foliage'),
      specks: [g.c('#e0c060', 'foliage'), g.c('#9ad0a0', 'foliage'), g.c('#8a5a8a', 'foliage')], speckDens: 0.018, vignette: 0.45, snow: g.snowAmt, seed: cx.seed + 8,
      path: { y: 155, h: 8, base: g.c('#5a4a34', 'ground'), shade: g.c('#3e3224', 'ground') },
    });
    // roots crossing the way, mushrooms that glow, dew
    for (let i = 0; i < 26; i++) {
      let x = Math.floor(r() * GND_W), y = GY + 4 + Math.floor(r() * 30);
      const len = 14 + Math.floor(r() * 30), dir = r() < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) { px.set(x, y, g.c('#5a3e2c', 'ground')); px.set(x, y - 1, g.c('#7a5a3c', 'ground')); x += dir; if (k % 4 === 0) y += r() < 0.5 ? 1 : -1; }
    }
    for (let i = 0; i < 30; i++) { const x = 20 + i * 42 + Math.round(r() * 24), pur = i % 3 !== 2, y = 156 + Math.round(r() * 16); place(px, cx.spr(`svmu${pur}`, () => tree('mushroom', pur ? '#8a5a8a' : '#9ad0a0', '#d8d0c0', 8)), x, y); halo(px, x, y - 4, 7, hex(pur ? '#8a5a8a' : '#9ad0a0'), 0.8); }
    for (let i = 0; i < 90; i++) px.set(Math.floor(r() * GND_W), GY + 2 + Math.floor(r() * 34), hex('#9ad0a0'), 200);
    return px.frame();
  },
};

// ── NB ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const NB: Painter = {
  sky(cx) {
    const px = skyBase(cx, 130);
    halo(px, 150, 66, 96, cx.g.c('#f4f2ee', 'sky'), 0.7);
    fogBands(cx, px, cx.g.c('#f0eee8', 'sky'), [36, 70, 104, 136], 10, 0.7);
    return px.frame();
  },
  far(cx) {
    const { g } = cx, px = new Pix(FAR_W, H, true), r = cx.rand(90), fog = g.c('#d8d6d0', 'sky');
    const tops = ridgeTops(FAR_W, 150, 50, cx.seed + 91, 6, 4, 0.55);
    fillRidge(px, tops, { body: g.c('#a0a4aa', 'rock'), lit: g.c('#b4b8bc', 'rock'), shade: g.c('#8a8e96', 'rock'), fog, fogAmt: 0.62, fogFrom: 50, snow: g.snowAmt * 0.5 });
    // faint towers in the fog
    const ts: [number, number][] = [[70, 96], [200, 120], [330, 80], [470, 110], [570, 90]];
    for (const [x, h] of ts) { place(px, cx.spr(`nbt${h}`, () => house('tower', { roof: '#7a7e86', wall: '#8e9298', v: 0.5 })), x + Math.round(r() * 10), 152, fog, 0.65); void h; }
    place(px, cx.spr('nbb', () => belltower('#8e9298', '#b09860', 70)), 260, 152, fog, 0.6);
    fogBands(cx, px, g.c('#e8e6e0', 'sky'), [120, 138], 8, 0.8, 7);
    return px.frame();
  },
  mid(cx) {
    const { g } = cx, px = new Pix(MID_W, H, true), r = cx.rand(91), fog = g.c('#d0d0d0', 'sky');
    const stone = toHex(g.c('#7a7e86', 'rock'));
    const base = ridgeTops(MID_W, 152, 10, cx.seed + 94, 14, 2, 0.5);
    fillRidge(px, base, { body: g.c('#6a6e76', 'rock'), lit: g.c('#8a8e96', 'rock'), shade: g.c('#50545a', 'rock'), fog, fogAmt: 0.25, fogFrom: 120, snow: g.snowAmt });
    // broken arches, pillars of unequal height, a bell tower with its bell, lamps and a red drape of the count
    for (let i = 0; i < 6; i++) { const x = 60 + i * 150 + Math.round(r() * 50); place(px, cx.spr(`nba${i % 2}`, () => arch(stone, 34 + (i % 2) * 10, 38 + (i % 3) * 6)), x, 151, fog, 0.18); }
    for (let i = 0; i < 12; i++) { const x = 20 + i * 78 + Math.round(r() * 40); place(px, cx.spr(`nbp${i % 4}`, () => pillar(stone, 20 + (i % 4) * 9, 7 + (i % 2) * 2, i % 3 === 0)), x, 151, fog, 0.15); }
    place(px, cx.spr('nbb2', () => belltower('#7a7e86', '#b89048', 66)), 240, 152, fog, 0.12);
    for (let i = 0; i < 12; i++) if (i % 3 === 1) { const x = 20 + i * 78 + 8, ph = 20 + (i % 4) * 9; place(px, cx.spr('nbd', () => drape('#7a1a2a', 30)), x + 18, 151 - ph + 3); }
    for (let i = 0; i < 5; i++) { const x = 100 + i * 180 + Math.round(r() * 40); place(px, cx.spr('nbl', () => lamp('#2a2a32', '#e8c878', 34)), x, 151); halo(px, x, 151 - 30, 12, hex('#d8b060'), 0.9); }
    fogBands(cx, px, g.c('#e0e0dc', 'sky'), [140, 150], 7, 0.85, 9);
    return px.frame();
  },
  ground(cx) {
    const { g } = cx, px = new Pix(GND_W, H, true), r = cx.rand(92);
    // old cobbles, each with a pale top edge and dark joints
    for (let y = GY; y < H; y++) for (let x = 0; x < GND_W; x++) {
      const row = (y - GY) >> 2, off = row & 1 ? 4 : 0, jx = (x + off) % 8, jy = (y - GY) % 4;
      if (jy === 3 || jx === 7) px.set(x, y, g.c('#3e4248', 'ground'));
      else if (jy === 0) px.set(x, y, g.c(hash2(x >> 3, row, 5) < 0.5 ? '#8a8e94' : '#7a7e84', 'ground'));
      else px.set(x, y, g.c(hash2((x + off) >> 3, row, 3) < 0.5 ? '#686c72' : '#5a5e64', 'ground'));
    }
    // puddles that hold a little of the pale sky
    for (let i = 0; i < 18; i++) {
      const x = 30 + i * 70 + Math.round(r() * 30), y = 154 + Math.round(r() * 18), rx = 8 + Math.round(r() * 8);
      for (let dx = -rx; dx <= rx; dx++) { const dy = Math.round(Math.sqrt(1 - (dx / rx) ** 2) * 2); for (let k = -dy; k <= dy; k++) px.set(x + dx, y + k, bayer(x + dx, y + k) < 0.7 ? g.c('#a0a6b0', 'sky') : g.c('#8a909a', 'sky')); }
      px.set(x - 2, y, hex('#e8eaee'));
    }
    for (let x = 0; x < GND_W; x++) for (let k = 0; k < 8; k++) if (bayer(x, GY + k) < (1 - k / 8) * 0.55) px.set(x, GY + k, g.c('#dcdcd8', 'sky'), 120);
    snowDust(px, GY, H, g.snowAmt * 0.8);
    return px.frame();
  },
};
void lamp;
