// The trees of the town level (the `tree=` value of a country: oak palm cactus jungle dead), drawn with the pixel painter of the people. 16 × 24 to 32 × 40.
import { Paint, type Frame } from '../paint';
import { mixHex } from './color';
import { FOOT } from './houses';

export interface TreeSpec {
  kind: string;
  /** Height of the crown and trunk in art pixels (16..32). */
  h: number;
  /** A changed land turns the leaves toward this colour (`mix` 0..1). */
  fate?: { color: string; mix: number };
  /** Leaf colour that replaces the kind's own (a continent whose leaves are not green). */
  leaf?: string;
  v?: number;
}

const LEAF: Record<string, string> = { oak: '#3f8a3a', palm: '#3f9a52', jungle: '#1f6a34', pine: '#2e6a3a' };

export function treeFrame(s: TreeSpec): Frame {
  const h = Math.min(34, Math.max(16, Math.round(s.h)));
  const w = Math.max(14, Math.round(h * 0.85));
  const fw = w + 4, fh = h + FOOT + 2;
  const p = new Paint(fw, fh);
  const cx = fw / 2, fy = fh - FOOT;
  const f = s.fate;
  const col = (c: string) => (f ? mixHex(c, f.color, f.mix) : c);
  const Tk = p.mat(col('#6a4a2e'));
  const v = s.v ?? 0.5;
  if (s.kind === 'dead') {
    p.rect(Math.round(cx) - 1, fy - h + 4, 2, h - 4, Tk);
    p.line([cx, fy - h * 0.55], [cx + h * 0.28, fy - h * 0.85], Tk);
    p.line([cx, fy - h * 0.4], [cx - h * 0.26, fy - h * 0.7], Tk);
    p.line([cx + h * 0.28, fy - h * 0.85], [cx + h * 0.4, fy - h * 0.82], Tk);
  } else if (s.kind === 'cactus') {
    const C = p.mat(col('#5a8a4a'));
    p.rect(Math.round(cx) - 2, fy - h + 2, 4, h - 2, C);
    p.rect(Math.round(cx) - 7, fy - h * 0.6, 3, 2, C); p.rect(Math.round(cx) - 7, fy - h * 0.6 - 5, 3, 6, C);
    p.rect(Math.round(cx) + 4, fy - h * 0.45, 3, 2, C); p.rect(Math.round(cx) + 4, fy - h * 0.45 - 4, 3, 5, C);
  } else if (s.kind === 'boulder') {
    const B = p.mat(col('#8a8a86'));
    p.ell(cx, fy - h * 0.2, Math.min(w * 0.45, 8), h * 0.22, B);
  } else if (s.kind === 'shrub' || s.kind === 'fern') {
    const L = p.mat(s.leaf ?? col(s.kind === 'fern' ? '#4a9a44' : '#3f7a3a'));
    if (s.kind === 'shrub') { p.ell(cx, fy - 4, 6, 4, L); p.ell(cx + 3, fy - 5, 4, 3, L); }
    else for (const dx of [-6, -3, 0, 3, 6]) p.line([cx, fy], [cx + dx, fy - h * 0.45 + Math.abs(dx) * 0.5], L);
  } else if (s.kind === 'mushroom') {
    p.rect(Math.round(cx) - 2, fy - h * 0.5, 4, h * 0.5, p.mat('#e8e0d0'));
    p.ell(cx, fy - h * 0.5, h * 0.4, h * 0.28, p.mat(s.leaf ?? col('#b04a4a')));
    p.rect(Math.round(cx - h * 0.45), fy - h * 0.5 + 1, Math.round(h * 0.9), 6, 0);
    p.rect(Math.round(cx) - 2, fy - h * 0.5, 4, h * 0.5, p.mat('#e8e0d0'));
  } else if (s.kind === 'pine') {
    const L = p.mat(s.leaf ?? col(LEAF.pine));
    p.rect(Math.round(cx) - 1, fy - 5, 3, 5, Tk);
    for (let k = 0; k < 3; k++) { const top = fy - h + k * (h * 0.22), bw = 4 + k * 3; p.poly([[cx - bw, top + h * 0.34], [cx, top], [cx + bw, top + h * 0.34]], L); }
  } else if (s.kind === 'palm') {
    const L = p.mat(s.leaf ?? col(LEAF.palm));
    p.line([cx - 1, fy], [cx + 1 + v * 2, fy - h + 5], Tk, 2);
    const tx = cx + 1 + v * 2, ty = fy - h + 5;
    for (const [dx, dy] of [[-9, 2], [-6, -3], [6, -3], [9, 2], [0, -5], [-4, 4], [4, 4]]) p.line([tx, ty], [tx + dx, ty + dy], L, 2);
  } else {
    const L = p.mat(s.leaf ?? col(LEAF[s.kind] ?? LEAF.oak));
    const L2 = p.mat(mixHex(s.leaf ?? col(LEAF[s.kind] ?? LEAF.oak), '#c8e890', 0.28));
    p.rect(Math.round(cx) - 1, fy - Math.round(h * 0.42), 3, Math.round(h * 0.42), Tk);
    const r = h * 0.38, ccy = fy - h + r + 1;
    p.ell(cx, ccy, r + (s.kind === 'jungle' ? 2 : 0), r, L);
    p.ell(cx - r * 0.6, ccy + r * 0.25, r * 0.55, r * 0.5, L);
    p.ell(cx + r * 0.6, ccy + r * 0.2, r * 0.55, r * 0.5, L);
    p.ell(cx - r * 0.25, ccy - r * 0.3, r * 0.4, r * 0.3, L2);
    if (s.kind === 'willow') for (const dx of [-r, -r * 0.5, 0, r * 0.5, r]) p.line([cx + dx, ccy + r * 0.5], [cx + dx, ccy + r * 1.1], L);
  }
  return p.finish({ cx, cy: fh - 2, rx: Math.max(4, w * 0.32), ry: 1.8 });
}
