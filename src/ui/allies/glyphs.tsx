// The drawings of the allies screen, all by code (docs/appearance/16-ally-scenes.md): the emote of each of the 24 feelings (§4, raw lines, in the colour of the
// line that holds it), the icon of each of the nine lines (§2), and the thread of a tie by its level (§3: dots, dashes, thin, thick, thick with a knot).
// Everything is stroke on a 24 x 24 box with `currentColor`; the screen sets the colour.
import type { JSX } from 'preact';

type Draw = () => JSX.Element;

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

/** The 24 emotes (16-ally-scenes.md §4): the picture the table describes, drawn with raw lines. */
export const EMOTES: Record<string, Draw> = {
  // two zigzag lines over the brows
  ห่วง: () => (
    <g {...S}>
      <path d="M4 9l3-3 3 3 3-3 3 3 3-3" />
      <path d="M4 16l3-3 3 3 3-3 3 3 3-3" />
    </g>
  ),
  // one wisp of smoke drifting aslant
  คิดถึง: () => <path {...S} d="M6 21c-3-5 5-6 3-11s5-4 9-7" />,
  // three small sparks over the shoulder
  ภูมิใจ: () => (
    <g {...S}>
      <path d="M5 16v-3M3.5 14.5h3" />
      <path d="M12 9V5M10 7h4" />
      <path d="M19 16v-3M17.5 14.5h3" />
    </g>
  ),
  // the thread thickens for a moment
  ไว้ใจ: () => (
    <g {...S}>
      <path d="M2 12h20" stroke-width={3.4} />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </g>
  ),
  // two hands pressed together at the chest
  ขอบคุณ: () => (
    <g {...S}>
      <path d="M12 3c-5 5-5 12 0 18 5-6 5-13 0-18z" />
      <path d="M12 8v13" />
    </g>
  ),
  // two bright points by the cheeks, a smile at the corner of the mouth
  ยินดี: () => (
    <g {...S}>
      <circle cx="6" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <path d="M6 3v2M18 3v2M2.5 10h1.5M20 10h1.5" />
      <path d="M8 16c2 2.5 6 2.5 8 0" />
    </g>
  ),
  // a single tear down the cheek
  เสียใจ: () => <path {...S} d="M12 3c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z" />,
  // a puffed cheek and a small cloud
  น้อยใจ: () => (
    <g {...S}>
      <path d="M5 13a3.5 3.5 0 0 1 2-6.5 4.5 4.5 0 0 1 8.5-1 3.5 3.5 0 0 1 3.5 7.5z" />
      <circle cx="8" cy="19" r="1.2" />
      <circle cx="12.5" cy="20.5" r="0.8" />
    </g>
  ),
  // three sharp strokes standing over the head
  โกรธ: () => <path {...S} d="M12 2v8M5 5l3 6M19 5l-3 6M3 14h18" />,
  // a line falling from the corner of the mouth, the shoulders drop
  ผิดหวัง: () => (
    <g {...S}>
      <path d="M12 3v11" />
      <path d="M12 14l-1.5 3" />
      <path d="M3 21c3-6 15-6 18 0" />
    </g>
  ),
  // a small dull-green band wound around the wrist
  อิจฉา: () => (
    <g {...S}>
      <path d="M5 8l14 3M5 12l14 3M5 16l14 3" />
      <path d="M5 8v8M19 11v8" opacity=".5" />
    </g>
  ),
  // a small red fire in the middle of the chest
  หึง: () => (
    <g {...S}>
      <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" />
    </g>
  ),
  // half a ring of arm over the head
  หวงแหน: () => (
    <g {...S}>
      <path d="M3 19a9 9 0 0 1 18 0" />
      <path d="M3 19h3M18 19h3" />
    </g>
  ),
  // a single drop of sweat at the temple
  เกรงใจ: () => (
    <g {...S}>
      <path d="M17 4c-2.5 4-3.5 5.5-3.5 7.5a3.5 3.5 0 0 0 7 0c0-2-1-3.5-3.5-7.5z" />
      <path d="M3 17h8" stroke-dasharray="1 3" />
    </g>
  ),
  // a short straight line over the head (the bow)
  เคารพ: () => (
    <g {...S}>
      <path d="M6 7h12" />
      <path d="M12 7v7" />
      <path d="M8 21v-3h8v3" />
    </g>
  ),
  // two sparks in the eyes
  ชื่นชม: () => (
    <g {...S}>
      <path d="M7 5v10M2 10h10" />
      <path d="M17 9v10M12 14h10" />
    </g>
  ),
  // a faint blush over half the face
  ละอาย: () => (
    <g {...S}>
      <path d="M4 10a8 8 0 0 1 8-6v16a8 8 0 0 1-8-10z" fill="currentColor" fill-opacity=".18" />
      <path d="M7 8l3 3M6 12l4 4M9 6l1 1" />
    </g>
  ),
  // a small stone on the chest
  รู้สึกผิด: () => <path {...S} d="M12 5l7 4 2 7-6 5H8l-5-5 2-7z" fill="currentColor" fill-opacity=".18" />,
  // a ring of heart cracked in half by a thin line
  กลัวเสีย: () => (
    <g {...S}>
      <path d="M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.5-3 7-10 13z" />
      <path d="M12 7l-2 4 3 2-2 4" />
    </g>
  ),
  // the empty space beside him, with the shadow of another
  เหงา: () => (
    <g {...S}>
      <circle cx="7" cy="7" r="3" />
      <path d="M2 21v-4a5 5 0 0 1 10 0v4" />
      <circle cx="18" cy="9" r="2.4" stroke-dasharray="2 2.5" />
      <path d="M13.5 21v-3a4.5 4.5 0 0 1 9 0v3" stroke-dasharray="2 2.5" />
    </g>
  ),
  // two glances aside and a small sharp stroke on the forehead
  ระแวง: () => (
    <g {...S}>
      <path d="M12 2l-1 4" />
      <ellipse cx="7" cy="14" rx="4" ry="2.8" />
      <ellipse cx="17" cy="14" rx="4" ry="2.8" />
      <circle cx="9" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </g>
  ),
  // a small black flame around the shadow
  แค้น: () => (
    <g {...S}>
      <ellipse cx="12" cy="16" rx="5" ry="3.5" fill="currentColor" fill-opacity=".35" />
      <path d="M5 16C3 11 7 9 6 4c3 2 3 5 4 7M19 16c2-5-2-7-1-12-3 2-3 5-4 7M12 11c-1-3 1-5 0-8" />
    </g>
  ),
  // a small deep red heart rising slowly
  รัก: () => <path {...S} d="M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.5-3 7-10 13z" fill="currentColor" fill-opacity=".35" />,
  // one young leaf beside the head
  เอ็นดู: () => (
    <g {...S}>
      <path d="M5 20C5 10 10 4 20 4c0 10-6 16-15 16z" fill="currentColor" fill-opacity=".18" />
      <path d="M5 20L14 11" />
    </g>
  ),
};

/** The emote of a feeling: round bubble of the line's colour, never taller than a sixth of the figure (the screen sizes it). */
export function Emote({ mood, size = 28, label }: { mood: string; size?: number; label?: string }): JSX.Element {
  const draw = EMOTES[mood];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={label ?? mood} data-emote={mood}>
      <title>{label ?? mood}</title>
      {draw ? draw() : <circle cx="12" cy="12" r="3" fill="currentColor" />}
    </svg>
  );
}

/** The icon of each line, in the corner of a card (16-ally-scenes.md §2). */
const ICONS: Record<string, Draw> = {
  // a double rope knot
  สหาย: () => (
    <g {...S}>
      <circle cx="8.5" cy="12" r="5" />
      <circle cx="15.5" cy="12" r="5" />
    </g>
  ),
  // two strands twisted
  คู่หู: () => (
    <g {...S}>
      <path d="M7 3c8 5-8 13 0 18" />
      <path d="M17 3c-8 5 8 13 0 18" />
    </g>
  ),
  // a red thread over two little fingers
  คนรัก: () => (
    <g {...S}>
      <path d="M7 3v9a2 2 0 0 0 4 0V3M13 3v9a2 2 0 0 0 4 0V3" />
      <path d="M6 15c4 5 8 5 12 0" />
    </g>
  ),
  // a straight line pointing up
  ครู: () => <path {...S} d="M12 21V4M6 10l6-6 6 6" />,
  // a straight line pointing down
  ศิษย์: () => <path {...S} d="M12 3v17M6 14l6 6 6-6" />,
  // a thick line, the colour of a root
  ญาติผู้ใหญ่: () => <path {...S} d="M12 3v18M12 9l-5 4M12 14l5 3" stroke-width={2.6} />,
  // a fine line with one young leaf
  ญาติรุ่นเยาว์: () => (
    <g {...S}>
      <path d="M12 21V8" />
      <path d="M12 12c0-5 4-7 8-7 0 5-3 8-8 7z" />
    </g>
  ),
  // two equal lines in parallel
  พี่น้อง: () => <path {...S} d="M8 3v18M16 3v18" />,
  // two lines crossing in the middle
  คู่แข่ง: () => <path {...S} d="M4 4l16 16M20 4L4 20" />,
};

export function LineIcon({ line, size = 18 }: { line: string; size?: number }): JSX.Element {
  const draw = ICONS[line];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" data-line-icon={line}>
      {draw ? draw() : <circle cx="12" cy="12" r="4" {...S} />}
    </svg>
  );
}

/**
 * The thread from the character to a person, by the level of the tie (16-ally-scenes.md §3): 1 dots far apart and pale, 2 a dashed line, 3 a thin solid line,
 * 4 a thick solid line, 5 a thick solid line with a knot in the middle that glows. `lit` lights the knot (the two are in one frame).
 */
export function Thread({ level, width = 120, lit = false }: { level: number; width?: number; lit?: boolean }): JSX.Element {
  const h = 14;
  const y = h / 2;
  const base = { stroke: 'currentColor', 'stroke-linecap': 'round' } as const;
  const lv = Math.max(1, Math.min(5, level));
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={`ระดับ ${lv}`} data-thread={lv}>
      {lv === 1 && <line x1="3" y1={y} x2={width - 3} y2={y} {...base} stroke-width={2} stroke-dasharray="0.1 9" opacity=".6" />}
      {lv === 2 && <line x1="2" y1={y} x2={width - 2} y2={y} {...base} stroke-width={1.6} stroke-dasharray="6 5" />}
      {lv === 3 && <line x1="2" y1={y} x2={width - 2} y2={y} {...base} stroke-width={1.6} />}
      {lv >= 4 && <line x1="2" y1={y} x2={width - 2} y2={y} {...base} stroke-width={3.4} />}
      {lv === 5 && (
        <>
          <circle cx={width / 2} cy={y} r={lit ? 5.5 : 4.5} fill="currentColor" opacity={lit ? 1 : 0.8} />
          {lit && <circle cx={width / 2} cy={y} r={6.5} fill="none" stroke="currentColor" opacity=".4" />}
        </>
      )}
    </svg>
  );
}
