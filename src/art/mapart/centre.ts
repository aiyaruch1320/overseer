// The centre of a town (the `centre=` value of a country: fountain bonfire gear worldtree pyramid ...), a sprite on the plaza, 24 × 24 to 48 × 48.
import { Paint, type Frame } from '../paint';
import { mixHex } from './color';
import { FOOT } from './houses';

/** Sprite of a centre. `r` is the plaza radius in art pixels, `dead` greys what lives and burns (a changed land). Null for a plain plaza. */
export function centreFrame(kind: string, r: number, dead: boolean): Frame | null {
  const S = Math.max(26, Math.min(46, Math.round(r * 1.5)));
  const fw = S + 8, fh = S + FOOT + 6;
  const p = new Paint(fw, fh);
  const cx = fw / 2, fy = fh - FOOT;
  const stone = p.mat('#8a8680'), dark = p.mat('#5a5650');
  const water = dead ? '#6a8a94' : '#5aa8d0';
  const col = (c: string, g = '#8a8a8e') => (dead ? mixHex(c, g, 0.6) : c);
  switch (kind) {
    case 'fountain': case 'lake': case 'oasis': case 'pump': {
      const rr = kind === 'lake' ? S * 0.5 : S * 0.36;
      p.ell(cx, fy - rr * 0.5, rr, rr * 0.55, stone);
      p.ell(cx, fy - rr * 0.5, rr - 2, rr * 0.55 - 1.5, p.mat(water));
      if (kind === 'fountain' || kind === 'pump') { p.rect(Math.round(cx) - 1, fy - rr - 5, 3, 7, stone); p.glow(cx, fy - rr - 6, '#d8f0ff', 0.9); }
      if (kind === 'oasis') { p.rect(Math.round(cx) + 4, fy - 14, 2, 9, p.mat('#6a4a2e')); p.ell(cx + 5, fy - 16, 6, 3, p.mat(col('#3f9a52'))); }
      break;
    }
    case 'bonfire': case 'caldera': case 'forge': case 'abyss': {
      p.ell(cx, fy - 4, S * 0.3, S * 0.16, p.mat('#2a2220'));
      p.ell(cx, fy - 5, S * 0.2, S * 0.1, p.mat(dead ? '#5a5a5e' : '#ff7a2a'));
      p.poly([[cx - 3, fy - 5], [cx, fy - 15], [cx + 3, fy - 5]], p.mat(dead ? '#8a8a8e' : '#ffb040', { flat: true }));
      break;
    }
    case 'gear': case 'clock': case 'arkea': {
      const G = p.mat('#6a6e72');
      p.ell(cx, fy - 10, 9, 9, G); p.ell(cx, fy - 10, 5, 5, 0);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.rect(Math.round(cx + Math.cos(a) * 10) - 1, Math.round(fy - 10 + Math.sin(a) * 10) - 1, 3, 3, G); }
      break;
    }
    case 'lighthouse': case 'obelisk': case 'tower': case 'rainspire': case 'eridan': {
      const T = p.mat(kind === 'lighthouse' ? '#f0eadc' : '#b8b0a0');
      const h = Math.min(S + 4, 40);
      p.poly([[cx - 6, fy], [cx - 3, fy - h], [cx + 3, fy - h], [cx + 6, fy]], T);
      p.rect(Math.round(cx) - 4, fy - h - 4, 8, 4, p.mat(kind === 'lighthouse' ? '#e0b030' : '#8a8478'));
      if (kind === 'lighthouse') p.glow(cx, fy - h - 3, '#fff0a0', 0.95);
      break;
    }
    case 'worldtree': case 'sapling': {
      const big = kind === 'worldtree';
      const L = p.mat(col('#2e7a3e', '#8a8a66'));
      const h = big ? S : S * 0.6;
      p.rect(Math.round(cx) - (big ? 3 : 1), fy - h * 0.55, big ? 7 : 3, h * 0.55, p.mat('#6a4a2e'));
      p.ell(cx, fy - h * 0.7, big ? S * 0.5 : S * 0.28, h * 0.4, L);
      p.ell(cx - 4, fy - h * 0.82, big ? S * 0.28 : S * 0.15, h * 0.2, p.mat(col('#6ab058', '#a8a07a')));
      break;
    }
    case 'pyramid': case 'crystal': case 'skynest': case 'stairgate': case 'gate': case 'council': case 'twinpalace': case 'liftmine': case 'airship': case 'statue': {
      const c = kind === 'crystal' ? '#8ad8e0' : kind === 'pyramid' ? '#d8b868' : kind === 'skynest' ? '#d8d4cc' : '#9a948a';
      p.poly([[cx - S * 0.34, fy], [cx, fy - S * 0.8], [cx + S * 0.34, fy]], p.mat(col(c)));
      if (kind === 'crystal') p.glow(cx, fy - S * 0.8 + 3, '#e8ffff', 0.9);
      break;
    }
    default:
      return null;
  }
  void dark;
  return p.finish({ cx, cy: fh - 2, rx: S * 0.36, ry: 2.4 });
}
