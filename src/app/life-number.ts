// The numbers of prayers and omens count per life on the screen ("คำอธิษฐานใบที่ 1" is the first of this life), while the core counts them across the whole save.
// The core text is not touched: this maps only the words that reach the player (src/app owns the display).
import type { Line } from '../core/text';
import type { GameState, LogEntry } from '../core/types';

/** The log kinds that carry a counter, by the word the text puts before "ใบที่". */
const COUNTERS: { word: string; kinds: string[] }[] = [
  { word: 'คำอธิษฐาน', kinds: ['prayer'] },
  { word: 'ลาง', kinds: ['miracle.omen'] },
];

const cache = new WeakMap<GameState, { n: number; firsts: Map<string, number> }>();

const isBirth = (e: LogEntry): boolean => e.sys === 'character' && e.kind === 'birth';

/** The first number of each counter in each life (key `${birth entry n}:${word}`). Read once per change of the log. */
function firstsOf(state: GameState): Map<string, number> {
  const hit = cache.get(state);
  if (hit && hit.n === state.logN) return hit.firsts;
  const firsts = new Map<string, number>();
  let birth = 0;
  for (const e of state.log) {
    if (isBirth(e)) birth = e.n;
    if (e.sys !== 'god' || typeof e.data.n !== 'number') continue;
    for (const c of COUNTERS) {
      const key = `${birth}:${c.word}`;
      if (c.kinds.includes(e.kind) && !firsts.has(key)) firsts.set(key, e.data.n);
    }
  }
  cache.set(state, { n: state.logN, firsts });
  return firsts;
}

/** The birth entry of the life that the entry `n` belongs to (0 when none). */
function birthOf(state: GameState, n: number): number {
  let birth = 0;
  for (const e of state.log) {
    if (e.n > n) break;
    if (isBirth(e)) birth = e.n;
  }
  return birth;
}

/** The text of a line of the log with its prayer and omen numbers counted from the first of the life the entry belongs to. */
export function perLifeText(state: GameState, entry: LogEntry, text: string): string {
  if (!/ใบที่ \d+/.test(text)) return text;
  const firsts = firstsOf(state);
  const birth = birthOf(state, entry.n);
  let out = text;
  for (const c of COUNTERS) {
    const first = firsts.get(`${birth}:${c.word}`);
    if (first === undefined) continue;
    out = out.replace(new RegExp(`${c.word}ใบที่ (\\d+)`, 'g'), (_m, d: string) => `${c.word}ใบที่ ${Math.max(1, Number(d) - first + 1)}`);
  }
  return out;
}

/** The lines with their numbers counted per life. */
export function perLifeLines(state: GameState, ls: Line[]): Line[] {
  return ls.map((l) => {
    const text = perLifeText(state, l.entry, l.text);
    return text === l.text ? l : { ...l, text };
  });
}
