// The wheel of conjuring (20-god-ui.md §9): three rings drawn with code, the verbs outside (6 cells), the cores in the middle (8), the sizes inside (4).
// Each ring turns until the cell the player wants lies under the silver line at the top; a shut cell is a silhouette without a name; the middle of
// the wheel shows the three picks as one small image (the glyph of the verb on the colour of the core). The rings are buttons too (Enter or Space),
// so the keyboard turns them as well.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CircleCell } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';

const C = 190;
const SIZE = 2 * C;
/** Radii of the three rings: [inner edge, outer edge]. */
const RINGS = { verb: [128, 184], core: [78, 126], scale: [36, 76] } as const;
const GAP = 1.2;

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (r: number, deg: number): [number, number] => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))];

/** An annular sector from angle `a0` to `a1` (degrees from the top, clockwise). */
function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = at(r1, a0);
  const [x1, y1] = at(r1, a1);
  const [x2, y2] = at(r0, a1);
  const [x3, y3] = at(r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
}

/** The angle a ring has to be turned to so the cell `index` of `n` lies under the line at the top (0 when nothing is picked). */
export const spinOf = (index: number, n: number): number => (index < 0 || !n ? 0 : -((index + 0.5) * 360) / n);

/** An angle that follows `target` by the short way round, eased; at once when the player asks for less motion. */
function useSpin(target: number): number {
  const [a, setA] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      cur.current = target;
      setA(target);
      return;
    }
    const from = cur.current;
    const to = from + ((((target - from) % 360) + 540) % 360) - 180;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      cur.current = from + (to - from) * (1 - Math.pow(1 - k, 3));
      setA(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return a;
}

interface RingProps {
  title: string;
  cells: CircleCell[];
  sel: string | null;
  radii: readonly [number, number];
  onPick: (id: string) => void;
  fill: (c: CircleCell) => string;
  font: number;
}

function Ring(p: RingProps) {
  const n = p.cells.length;
  const idx = p.cells.findIndex((c) => c.id === p.sel);
  const spin = useSpin(spinOf(idx, n));
  const [r0, r1] = p.radii;
  const step = 360 / n;
  const mid = (r0 + r1) / 2;
  return (
    <g role="radiogroup" aria-label={p.title} transform={`rotate(${spin} ${C} ${C})`}>
      {p.cells.map((c, i) => {
        const a0 = i * step + GAP / 2;
        const a1 = (i + 1) * step - GAP / 2;
        const on = c.id === p.sel;
        const [tx, ty] = at(mid, (i + 0.5) * step);
        const col = c.color ?? color.light;
        return (
          <g
            key={c.id}
            role="radio"
            aria-checked={on}
            aria-disabled={!c.open}
            aria-label={c.open ? c.name : W.conjure.shut}
            tabIndex={c.open ? 0 : -1}
            style={{ cursor: c.open ? 'pointer' : 'not-allowed', outline: 'none' }}
            onClick={() => c.open && p.onPick(c.id)}
            onKeyDown={(e) => c.open && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), p.onPick(c.id))}
          >
            <path d={sector(r0, r1, a0, a1)} fill={c.open ? p.fill(c) : '#0a0b0f'} fillOpacity={c.open ? (on ? 0.95 : 0.55) : 1} stroke={on ? col : c.open ? color.line : '#1a1b24'} strokeWidth={on ? 2.5 : 1} />
            {c.open ? (
              <g transform={`rotate(${-spin} ${tx} ${ty})`} pointerEvents="none">
                <text x={tx} y={ty - 2} textAnchor="middle" fontSize={p.font + 6} fill={on ? '#fff' : color.text}>
                  {c.glyph}
                </text>
                <text x={tx} y={ty + p.font + 4} textAnchor="middle" fontSize={p.font} fill={on ? '#fff' : color.text}>
                  {c.name}
                </text>
              </g>
            ) : (
              <g transform={`rotate(${-spin} ${tx} ${ty})`} pointerEvents="none">
                <circle cx={tx} cy={ty} r={p.font * 0.9} fill="#14151b" />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

export interface WheelProps {
  verbs: CircleCell[];
  cores: CircleCell[];
  scales: CircleCell[];
  verb: string | null;
  core: string | null;
  scale: string | null;
  onVerb: (id: string) => void;
  onCore: (id: string) => void;
  onScale: (id: string) => void;
}

export function Wheel(p: WheelProps) {
  const v = p.verbs.find((c) => c.id === p.verb);
  const k = p.cores.find((c) => c.id === p.core);
  const s = p.scales.find((c) => c.id === p.scale);
  const inner = k?.color ?? color.fate;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 380, display: 'block', margin: '0 auto' }} role="group" aria-label={W.conjure.title}>
      <circle cx={C} cy={C} r={188} fill="#0b0c11" stroke={color.line} />
      <Ring title={W.conjure.verbs} cells={p.verbs} sel={p.verb} radii={RINGS.verb} onPick={p.onVerb} fill={() => '#2a2638'} font={10} />
      <Ring title={W.conjure.cores} cells={p.cores} sel={p.core} radii={RINGS.core} onPick={p.onCore} fill={(c) => c.color ?? '#3a3a44'} font={9} />
      <Ring title={W.conjure.scales} cells={p.scales} sel={p.scale} radii={RINGS.scale} onPick={p.onScale} fill={() => '#33342a'} font={9} />
      {/* the heart of the wheel: the small image of what is picked */}
      <circle cx={C} cy={C} r={30} fill="#0e0f14" stroke={inner} strokeWidth={2} strokeOpacity={v && k && s ? 1 : 0.35} />
      <text x={C} y={C + 8} textAnchor="middle" fontSize={26} fill={inner} opacity={v && k ? 1 : 0.3}>
        {v ? v.glyph : '·'}
        {k ? k.glyph : ''}
      </text>
      {/* the silver line the cells are turned under */}
      <path d={`M${C - 8} 0L${C + 8} 0L${C} 14Z`} fill={color.fate} pointerEvents="none" />
      <line x1={C} y1={14} x2={C} y2={22} stroke={color.fate} strokeWidth={2} pointerEvents="none" />
    </svg>
  );
}
