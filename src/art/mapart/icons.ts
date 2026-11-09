// Icons of the map levels that are pictures (world, continent, country; 21-pixel-art.md §4: "people and dragons are icons"). Small pixel sprites, drawn
// with the painter of the people, shown one art pixel to a screen pixel (or two) whatever the zoom. 16 × 16 to 32 × 24.
import { Paint, type Frame } from '../paint';
import { mixHex } from './color';

export type IconKind = 'town' | 'capital' | 'ruin' | 'dragon' | 'dragon-dead' | 'person';

/** The icon of a kind; `color` is the accent (roof, scale, cloak). */
export function iconFrame(kind: IconKind, color = '#c9a24a'): Frame {
  switch (kind) {
    case 'town':
    case 'capital':
    case 'ruin': {
      const cap = kind === 'capital', ruin = kind === 'ruin';
      const p = new Paint(cap ? 22 : 16, cap ? 22 : 16);
      const ox = cap ? 3 : 2, fy = p.h - 3;
      const W = p.mat(ruin ? '#6a665e' : '#e8dcc0'), R = p.mat(ruin ? '#4a4742' : color), D = p.mat('#4a3020');
      const w = cap ? 14 : 10, h = cap ? 8 : 6;
      p.rect(ox, fy - h, w, h, W);
      if (ruin) { p.rect(ox + 2, fy - h - 3, 3, 3, W); p.rect(ox + w - 4, fy - h - 1, 3, 1, W); }
      else {
        p.poly([[ox - 1, fy - h + 1], [ox + w / 2, fy - h - (cap ? 6 : 4)], [ox + w + 1, fy - h + 1]], R);
        if (cap) { p.rect(ox + w / 2, fy - h - 12, 1, 6, p.mat('#8a8a8e')); p.rect(ox + w / 2 + 1, fy - h - 12, 4, 3, p.mat('#e8c36a', { flat: true })); }
      }
      p.rect(ox + Math.floor(w / 2) - 1, fy - 3, 2, 3, D);
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
