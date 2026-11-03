// Small vector icons of the map (trees, peaks, dunes, fields…) and the great landmarks (world-map.md §1 "จุดเด่นที่วาดไว้"). Every shape is drawn
// from a handful of strokes at the size asked for, and the only variation comes from the `seed` it is given, so a tile paints the same every time.
import { mix } from './color';
import { Stream } from './noise';
import { FATE_BY_ID, type FateId } from './tuning';

export type GlyphKind = 'tree' | 'oak' | 'deadtree' | 'palm' | 'reed' | 'peak' | 'hill' | 'dune' | 'mesa' | 'field' | 'tuft' | 'volcano' | 'crack' | 'crystal' | 'ruin' | 'chimney';

export interface GlyphOpts {
  cid: string;
  fate?: FateId;
  seed: number;
}

/** Leaf, trunk and rock colours of each continent. */
const FOLIAGE: Record<string, string> = { AZ: '#5f9a52', MH: '#7a6a3a', KD: '#5a4a3a', NR: '#4f8a52', AL: '#3f8a3a', MK: '#6a7a5a', SH: '#7a8a4a', SV: '#1f5a2e', NB: '#5a6a5a' };
const ROCK: Record<string, string> = { AZ: '#9a9aa6', MH: '#8a6a4a', KD: '#4a3c38', NR: '#8a8a82', AL: '#8a8680', MK: '#7a7e84', SH: '#a8805a', SV: '#6a6a5a', NB: '#7a7e84' };

function paint(hex: string, o: GlyphOpts, k = 0.6): string {
  if (!o.fate) return hex;
  const f = FATE_BY_ID[o.fate];
  return mix(hex, f.after[0], Math.min(0.95, f.tint * k + 0.2));
}

export function drawGlyph(ctx: CanvasRenderingContext2D, kind: GlyphKind, x: number, y: number, s: number, o: GlyphOpts): void {
  const r = new Stream(o.seed);
  const leaf = paint(FOLIAGE[o.cid] ?? '#3f8a3a', o);
  const rock = paint(ROCK[o.cid] ?? '#8a8680', o);
  const dark = 'rgba(20,16,10,0.55)';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (kind) {
    case 'tree':
    case 'oak': {
      const t = s * (0.8 + r.next() * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(x + t * 0.25, y + t * 0.1, t * 0.7, t * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = paint('#4a3624', o);
      ctx.fillRect(x - t * 0.07, y - t * 0.3, t * 0.14, t * 0.4);
      ctx.fillStyle = mix(leaf, '#000000', 0.25);
      ctx.beginPath(); ctx.arc(x, y - t * 0.7, t * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.arc(x - t * 0.1, y - t * 0.8, t * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mix(leaf, '#ffffff', 0.25);
      ctx.beginPath(); ctx.arc(x - t * 0.22, y - t * 0.92, t * 0.22, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'deadtree': {
      const t = s;
      ctx.strokeStyle = paint('#3a2c20', o);
      ctx.lineWidth = Math.max(0.8, t * 0.12);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - t * 1.1);
      ctx.moveTo(x, y - t * 0.6); ctx.lineTo(x + t * 0.45, y - t * 1.0);
      ctx.moveTo(x, y - t * 0.8); ctx.lineTo(x - t * 0.4, y - t * 1.15);
      ctx.stroke();
      break;
    }
    case 'palm': {
      const t = s;
      ctx.strokeStyle = paint('#6a5030', o);
      ctx.lineWidth = Math.max(0.8, t * 0.12);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + t * 0.2, y - t * 0.6, x + t * 0.05, y - t * 1.1); ctx.stroke();
      ctx.strokeStyle = leaf;
      ctx.lineWidth = Math.max(0.8, t * 0.1);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.7;
        ctx.beginPath(); ctx.moveTo(x + t * 0.05, y - t * 1.1); ctx.quadraticCurveTo(x + t * 0.05 + Math.cos(a) * t * 0.5, y - t * 1.1 + Math.sin(a) * t * 0.5 - t * 0.1, x + t * 0.05 + Math.cos(a) * t * 0.8, y - t * 1.1 + Math.sin(a) * t * 0.7 + t * 0.2); ctx.stroke();
      }
      break;
    }
    case 'reed': {
      ctx.strokeStyle = paint('#5a7a3a', o);
      ctx.lineWidth = Math.max(0.7, s * 0.1);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.25, y); ctx.lineTo(x + i * s * 0.35, y - s * (0.7 + r.next() * 0.4)); ctx.stroke(); }
      break;
    }
    case 'peak': {
      const t = s * (0.9 + r.next() * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x + t * 0.3, y + t * 0.05, t * 0.9, t * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rock;
      ctx.beginPath(); ctx.moveTo(x - t * 0.85, y); ctx.lineTo(x - t * 0.05, y - t * 1.35); ctx.lineTo(x + t * 0.85, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mix(rock, '#000000', 0.35);
      ctx.beginPath(); ctx.moveTo(x - t * 0.05, y - t * 1.35); ctx.lineTo(x + t * 0.85, y); ctx.lineTo(x + t * 0.2, y); ctx.closePath(); ctx.fill();
      if (o.cid !== 'SH' && o.cid !== 'KD' && !o.fate) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.moveTo(x - t * 0.05, y - t * 1.35); ctx.lineTo(x - t * 0.3, y - t * 0.92); ctx.lineTo(x - t * 0.05, y - t * 1.0); ctx.lineTo(x + t * 0.18, y - t * 0.88); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'hill': {
      ctx.fillStyle = mix(rock, '#5a7a3a', 0.35);
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.9, s * 0.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.9, s * 0.5, 0, Math.PI, 0); ctx.stroke();
      break;
    }
    case 'dune': {
      ctx.strokeStyle = paint('#a8803a', o);
      ctx.lineWidth = Math.max(0.8, s * 0.12);
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.8, x + s * 0.2, y - s * 0.2); ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.1, x + s, y - s * 0.1); ctx.stroke();
      break;
    }
    case 'mesa': {
      ctx.fillStyle = paint('#a87450', o);
      ctx.fillRect(x - s * 0.6, y - s * 0.7, s * 1.2, s * 0.7);
      ctx.fillStyle = paint('#c8905e', o);
      ctx.fillRect(x - s * 0.6, y - s * 0.7, s * 1.2, s * 0.18);
      break;
    }
    case 'field': {
      const a = r.int(0, 1);
      const cols = a ? ['#c8c860', '#a8b848'] : ['#d6b448', '#b8d070'];
      ctx.fillStyle = paint(cols[0], o);
      ctx.fillRect(x - s, y - s * 0.55, s * 2, s * 0.5);
      ctx.fillStyle = paint(cols[1], o);
      ctx.fillRect(x - s, y, s * 2, s * 0.5);
      ctx.strokeStyle = 'rgba(60,40,10,0.35)'; ctx.lineWidth = 0.6; ctx.strokeRect(x - s, y - s * 0.55, s * 2, s * 1.05);
      break;
    }
    case 'tuft': {
      ctx.strokeStyle = paint(mix(leaf, '#ffffff', 0.15), o);
      ctx.lineWidth = Math.max(0.6, s * 0.12);
      ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s * 0.5, y - s * 0.5); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.6); ctx.moveTo(x + s * 0.4, y); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.stroke();
      break;
    }
    case 'volcano': {
      ctx.fillStyle = paint('#2a2220', o);
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.25, y - s * 1.1); ctx.lineTo(x + s * 0.25, y - s * 1.1); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = o.fate ? '#5a5a60' : '#e0662a';
      ctx.beginPath(); ctx.ellipse(x, y - s * 1.1, s * 0.25, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crack': {
      ctx.strokeStyle = o.fate ? '#3a3a3e' : 'rgba(224,102,42,0.8)';
      ctx.lineWidth = Math.max(0.7, s * 0.1);
      ctx.beginPath(); ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x - s * 0.1, y - s * 0.25); ctx.lineTo(x + s * 0.15, y + s * 0.05); ctx.lineTo(x + s * 0.6, y - s * 0.2); ctx.stroke();
      break;
    }
    case 'crystal': {
      ctx.fillStyle = paint('#8ad8e0', o);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.25, y - s * 0.6); ctx.lineTo(x, y - s * 1.0); ctx.lineTo(x + s * 0.25, y - s * 0.6); ctx.closePath(); ctx.fill();
      break;
    }
    case 'ruin': {
      ctx.fillStyle = paint('#9a9a9e', o);
      ctx.fillRect(x - s * 0.5, y - s * 0.8, s * 0.22, s * 0.8);
      ctx.fillRect(x + s * 0.1, y - s * 0.5, s * 0.22, s * 0.5);
      ctx.fillRect(x - s * 0.6, y - s * 0.1, s * 1.2, s * 0.12);
      break;
    }
    case 'chimney': {
      ctx.fillStyle = paint('#6a4a3a', o);
      ctx.fillRect(x - s * 0.18, y - s * 1.1, s * 0.36, s * 1.1);
      ctx.fillStyle = 'rgba(80,80,80,0.5)';
      ctx.beginPath(); ctx.arc(x + s * 0.1, y - s * 1.35, s * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export type LandmarkKind = 'worldtree' | 'arkea' | 'abyss' | 'whirlpool' | 'volcano';

/** The great landmarks of the sheet (world-map.md §1): `k` is the size factor of the tile, `fate` the look of the continent. */
export function drawLandmark(ctx: CanvasRenderingContext2D, kind: LandmarkKind, x: number, y: number, k: number, fate?: FateId): void {
  ctx.save();
  ctx.lineCap = 'round';
  const dead = fate === 'withered';
  switch (kind) {
    case 'worldtree': {
      const R = 26 * k;
      const g = ctx.createRadialGradient(x, y, 2, x, y, R * 1.6);
      g.addColorStop(0, dead ? 'rgba(120,110,80,0.5)' : 'rgba(224,240,150,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R * 1.6, 0, Math.PI * 2); ctx.fill();
      const layers = [dead ? '#6a6a50' : '#1f5a2e', dead ? '#8a8a66' : '#2e7a3e', dead ? '#a8a07a' : '#6ab058'];
      layers.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y - i * R * 0.12, R * (1 - i * 0.22), R * 0.62 * (1 - i * 0.18), 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = dead ? '#4a4030' : '#5a4028';
      ctx.fillRect(x - R * 0.07, y - R * 0.2, R * 0.14, R * 0.6);
      break;
    }
    case 'arkea': {
      const R = 18 * k;
      ctx.strokeStyle = 'rgba(170,176,186,0.95)';
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, R * 0.6, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.fillStyle = fate === 'rust' ? '#4a8a6a' : '#6ad0ff';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, Math.max(1.2, 2 * k), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(170,176,186,0.7)'; ctx.lineWidth = Math.max(0.8, k);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.stroke();
      }
      break;
    }
    case 'abyss': {
      const R = 16 * k;
      const g = ctx.createRadialGradient(x, y, 1, x, y, R);
      g.addColorStop(0, fate === 'ash' ? '#2a2a2e' : '#ff5a20'); g.addColorStop(0.5, fate === 'ash' ? '#1a1a1e' : '#6a1a10'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.2, R * 0.55, -0.25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#120a0a'; ctx.lineWidth = Math.max(1, 1.5 * k);
      ctx.beginPath(); ctx.moveTo(x - R * 1.2, y + R * 0.2); ctx.lineTo(x - R * 0.3, y - R * 0.1); ctx.lineTo(x + R * 0.3, y + R * 0.15); ctx.lineTo(x + R * 1.2, y - R * 0.25); ctx.stroke();
      break;
    }
    case 'whirlpool': {
      const R = 16 * k;
      ctx.strokeStyle = 'rgba(210,225,235,0.9)'; ctx.lineWidth = Math.max(1, 1.4 * k);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.05) {
          const a = t * Math.PI * 3.2 + i * 2.1, rr = R * (0.25 + 0.75 * t);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.62;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = fate === 'fog' ? '#c8c8d0' : '#f0d070';
      for (let i = 0; i < 5; i++) { const a = i * 1.3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.3, Math.max(0.9, 1.3 * k), 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'volcano': {
      const R = 20 * k;
      ctx.fillStyle = fate === 'ash' ? '#6a6a6e' : '#241c1a';
      ctx.beginPath(); ctx.moveTo(x - R, y + R * 0.3); ctx.lineTo(x - R * 0.28, y - R * 0.7); ctx.lineTo(x + R * 0.28, y - R * 0.7); ctx.lineTo(x + R, y + R * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fate === 'ash' ? '#8a8a90' : '#ff7a2a';
      ctx.beginPath(); ctx.ellipse(x, y - R * 0.7, R * 0.28, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      if (fate !== 'ash') { ctx.strokeStyle = '#e0662a'; ctx.lineWidth = Math.max(1, k); ctx.beginPath(); ctx.moveTo(x, y - R * 0.65); ctx.quadraticCurveTo(x + R * 0.1, y - R * 0.2, x + R * 0.35, y + R * 0.3); ctx.stroke(); }
      ctx.fillStyle = 'rgba(70,70,70,0.45)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * R * 0.12, y - R * (1.0 + i * 0.28), R * (0.2 + i * 0.08), 0, Math.PI * 2); ctx.fill(); }
      break;
    }
  }
  ctx.restore();
}
