// Icons of the map levels that are pictures (world, continent, country; 21-pixel-art.md §4: "people and dragons are icons"). Small pixel sprites, drawn
// with the painter of the people, shown one art pixel to a screen pixel (or two) whatever the zoom. 16 × 16 to 32 × 24.
import { Paint, type Frame } from '../paint';
import { mixHex } from './color';

/** Wall colour of the icon of a style (the stuff the style is built of). */
const STYLE_WALL: Record<string, string> = {
  brick: '#b0684a', forge: '#6a5a58', stone: '#b0aaa0', keep: '#a0a0a8', carved: '#8a7a78', hut: '#9a8a70', aframe: '#a08a68', burrow: '#8a7a60', stilt: '#a08a68',
  tent: '#d8c8a0', mushroom: '#efe4d0', tree: '#8a6a48', dome: '#f0e8d8', spire: '#f0ece4', tower: '#b8b8c0', adobe: '#d0a878', terrace: '#e0d0b8', boomtown: '#b09068',
};

export type IconKind = 'town' | 'capital' | 'ruin' | 'dragon' | 'dragon-dead' | 'person';

/** The icon of a kind; `color` is the accent (roof, scale, cloak). A town or a capital is drawn in the building style of its country (`styles=` first of the UI value). */
export function iconFrame(kind: IconKind, color = '#c9a24a', style = 'gable'): Frame {
  switch (kind) {
    case 'town':
    case 'capital':
    case 'ruin': {
      const cap = kind === 'capital', ruin = kind === 'ruin';
      const p = new Paint(cap ? 22 : 16, cap ? 22 : 16);
      const ox = cap ? 3 : 2, fy = p.h - 3;
      const W = p.mat(ruin ? '#6a665e' : STYLE_WALL[style] ?? '#e8dcc0'), R = p.mat(ruin ? '#4a4742' : color), D = p.mat('#4a3020');
      const w = cap ? 14 : 10, h = cap ? 8 : 6, cx = ox + w / 2;
      if (ruin) {
        p.rect(ox, fy - h, w, h, W);
        p.rect(ox + 2, fy - h - 3, 3, 3, W); p.rect(ox + w - 4, fy - h - 1, 3, 1, W);
      } else if (style === 'tent') {
        p.poly([[ox - 1, fy], [cx, fy - h - 5], [ox + w + 1, fy]], R);
        p.poly([[cx - 1.5, fy], [cx, fy - 4], [cx + 1.5, fy]], D);
      } else if (style === 'hut' || style === 'aframe' || style === 'burrow') {
        p.rect(ox + 1, fy - h + 2, w - 2, h - 2, W);
        p.poly([[ox - 1, fy - h + 3], [cx, fy - h - 3], [ox + w + 1, fy - h + 3]], R);
      } else if (style === 'mushroom' || style === 'tree') {
        p.rect(cx - 1, fy - h, 2, h, W);
        p.ell(cx, fy - h - 1, w / 2 + 1, h / 2 + 1, R);
      } else if (style === 'dome') {
        p.rect(ox + 1, fy - h + 2, w - 2, h - 2, W);
        p.ell(cx, fy - h + 2, w / 2, h / 2 + 2, R);
        p.rect(ox, fy - h + 2, w, 3, 0);
        p.rect(ox + 1, fy - h + 2, w - 2, h - 2, W);
      } else if (style === 'spire' || style === 'tower') {
        const tw = cap ? 7 : 5, tx = Math.round(cx - tw / 2);
        p.rect(tx, fy - h - 2, tw, h + 2, W);
        p.poly([[tx - 1, fy - h - 1], [cx, fy - h - (cap ? 11 : 8)], [tx + tw + 1, fy - h - 1]], R);
      } else if (style === 'stone' || style === 'keep' || style === 'carved') {
        p.rect(ox, fy - h, w, h, W);
        for (let x = ox; x < ox + w - 1; x += 3) p.rect(x, fy - h - 2, 2, 2, W);
        p.rect(ox, fy - h, w, 1, R);
      } else if (style === 'stilt') {
        p.rect(ox + 1, fy - 2, 1, 2, D); p.rect(ox + w - 2, fy - 2, 1, 2, D);
        p.rect(ox, fy - h, w, h - 2, W);
        p.poly([[ox - 1, fy - h + 1], [cx, fy - h - 4], [ox + w + 1, fy - h + 1]], R);
      } else if (style === 'brick' || style === 'forge' || style === 'boomtown') {
        p.rect(ox, fy - h, w, h, W);
        p.rect(ox - 1, fy - h - 1, w + 2, 2, R);
        const sx = ox + w - 3;
        p.rect(sx, fy - h - (cap ? 7 : 5), 2, cap ? 7 : 5, p.mat('#5a5658'));
        p.px(sx, fy - h - (cap ? 9 : 7), p.mat(style === 'forge' ? '#ff8a2a' : '#9a9a9e', { flat: true }));
      } else {
        p.rect(ox, fy - h, w, h, W);
        p.poly([[ox - 1, fy - h + 1], [cx, fy - h - (cap ? 6 : 4)], [ox + w + 1, fy - h + 1]], R);
      }
      if (cap && !ruin) { p.rect(Math.round(cx), fy - h - 14, 1, 6, p.mat('#8a8a8e')); p.rect(Math.round(cx) + 1, fy - h - 14, 4, 3, p.mat('#e8c36a', { flat: true })); }
      if (style !== 'tent' && style !== 'mushroom' && style !== 'tree') p.rect(ox + Math.floor(w / 2) - 1, fy - 3, 2, 3, D);
      return p.finish({ cx: p.w / 2, cy: p.h - 1, rx: w / 2 + 1, ry: 1.4 });
    }
    case 'dragon': case 'dragon-dead': {
      const dead = kind === 'dragon-dead';
      const p = new Paint(30, 18);
      const B = p.mat(dead ? '#9a9486' : mixHex(color, '#202028', 0.45)), L = p.mat(dead ? '#bcb6a6' : color);
      if (dead) {
        p.line([4, 12], [26, 12], B);
        for (let i = 0; i < 5; i++) p.line([7 + i * 4, 12], [8 + i * 4, 6], L);
        p.ell(26, 10, 3, 2.5, L);
      } else {
        p.ell(15, 10, 8, 3.5, B);                                   // body
        p.poly([[8, 9], [3, 2], [11, 6]], B); p.poly([[20, 9], [27, 2], [18, 6]], B); // wings
        p.ell(24, 8, 3.5, 2.5, B); p.line([22, 12], [29, 14], B);   // head, tail
        p.px(24, 7, p.mat('#ffe070', { flat: true }));              // eye
        p.ell(14, 8, 4, 1.4, L);                                    // sheen
      }
      return p.finish({ cx: 15, cy: 16, rx: 9, ry: 1.6 });
    }
    default: {
      const p = new Paint(12, 20);
      const C = p.mat(color), Sk = p.mat('#f0d8b8');
      p.ell(6, 5, 3, 3, Sk);
      p.poly([[3, 18], [4, 9], [8, 9], [9, 18]], C);
      return p.finish({ cx: 6, cy: 18, rx: 4, ry: 1.4 });
    }
  }
}
