// The look of the allies screens. Colours of the lines are the ones of docs/appearance/16-ally-scenes.md §2; the rest comes from tokens.ts.
import type { JSX } from 'preact';
import { color, font, motion, size } from '../tokens';

/** Colour of the thread of each line (16-ally-scenes.md §2). */
export const LINE_COLOR: Record<string, string> = {
  สหาย: '#5a8ad0',
  คู่หู: '#c8a030',
  คนรัก: '#a02a3a',
  ครู: '#d8d4c8',
  ศิษย์: '#8ac84a',
  ญาติผู้ใหญ่: '#8a5a3a',
  ญาติรุ่นเยาว์: '#f0d070',
  พี่น้อง: '#6a9a8a',
  คู่แข่ง: '#d86a2a',
};

/** A line colour lifted toward white where it has to be read on the dark panel (a deep red or brown is a fine thread but a poor ink). */
export const inkOf = (line: string): string => `color-mix(in srgb, ${LINE_COLOR[line] ?? color.textDim} 62%, #ffffff)`;
export const lineOf = (line: string): string => LINE_COLOR[line] ?? color.line;

export const tint = (c: string, pct: number): string => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

export const box: JSX.CSSProperties = { background: '#13141b', border: `1px solid ${color.line}`, borderRadius: size.radius, padding: size.pad };

export const css = `
.al-root { box-sizing: border-box; color: ${color.text}; font-family: ${font.body}; font-size: ${size.text}px; background: ${color.panel}; min-width: ${size.minWidth}px; min-height: ${size.minHeight}px; height: 100%; display: flex; flex-direction: column; }
.al-root *, .al-root *::before, .al-root *::after { box-sizing: border-box; }
.al-root button { font-family: inherit; font-size: inherit; color: inherit; cursor: pointer; }
.al-head { display: flex; align-items: baseline; gap: ${size.pad}px; padding: ${size.pad}px ${size.pad + 4}px; border-bottom: 1px solid ${color.line}; }
.al-title { font-family: ${font.title}; font-size: ${size.title}px; color: ${color.light}; }
.al-dim { color: ${color.textDim}; }
.al-small { font-size: ${size.small}px; }
.al-tabs { margin-left: auto; display: flex; gap: ${size.gap / 2}px; }
.al-btn { background: #1a1b24; border: 1px solid ${color.line}; border-radius: ${size.radius}px; padding: 6px 12px; transition: border-color .15s, background .15s; }
.al-btn:hover:not(:disabled) { border-color: ${color.textDim}; background: #20212c; }
.al-btn[aria-pressed="true"] { border-color: ${color.light}; color: ${color.light}; background: #241f10; }
.al-btn:focus-visible, .al-row:focus-visible { outline: 2px solid ${color.light}; outline-offset: 2px; }
.al-btn.fate { border-color: ${color.fate}; color: ${color.fate}; }
.al-btn.fate:hover { background: ${tint(color.fate, 14)}; }
.al-body { flex: 1; display: grid; grid-template-columns: 420px 1fr; gap: ${size.pad}px; padding: ${size.pad}px; min-height: 0; }
.al-list { overflow-y: auto; min-height: 0; padding-right: 4px; }
.al-group { margin-bottom: ${size.pad}px; }
.al-group h3 { margin: 0 0 6px; font-weight: normal; font-size: ${size.small}px; color: ${color.textDim}; letter-spacing: .04em; }
.al-row { display: grid; grid-template-columns: 22px 58px 1fr 54px 26px; align-items: center; gap: 8px; width: 100%; text-align: left; background: #13141b; border: 1px solid ${color.line}; border-left-width: 3px; border-radius: ${size.radius}px; padding: 6px 8px; margin-bottom: 4px; }
.al-row:hover { background: #1a1b24; }
.al-row[aria-current="true"] { background: #20212c; border-color: ${color.textDim}; }
.al-row.frame { opacity: .72; }
.al-row .al-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.al-pill { display: inline-block; font-size: ${size.small - 1}px; padding: 0 7px; border: 1px solid ${color.line}; border-radius: 999px; color: ${color.textDim}; margin-right: 4px; }
.al-detail { overflow-y: auto; min-height: 0; border: 1px solid ${color.line}; border-radius: ${size.radius}px; background: #13141b; padding: ${size.pad + 4}px; }
.al-hist { list-style: none; margin: 0; padding: 0; }
.al-hist li { display: grid; grid-template-columns: 54px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dotted ${color.line}; line-height: 1.55; }
.al-crisis { border: 1px solid ${color.fate}; background: ${tint(color.fate, 8)}; border-radius: ${size.radius}px; padding: ${size.pad}px; margin-bottom: ${size.pad}px; animation: al-glow ${motion.flicker} ease-in-out infinite; }
.al-empty { display: grid; place-items: center; text-align: center; color: ${color.textDim}; flex: 1; padding: 40px; }
.al-tree { overflow: auto; flex: 1; padding: ${size.pad + 4}px; }
.al-gen { display: flex; align-items: stretch; gap: ${size.pad}px; }
.al-node { background: #13141b; border: 1px solid ${color.line}; border-radius: ${size.radius}px; padding: 8px 10px; min-width: 150px; max-width: 220px; }
.al-node.dead { opacity: .55; filter: grayscale(.8); border-style: dashed; }
.al-node.heir { border-color: ${color.light}; box-shadow: 0 0 0 1px ${tint(color.light, 40)}, 0 0 14px ${tint(color.light, 25)}; }
.al-node.current { border-color: ${color.text}; background: #1a1b24; }
.al-link { width: 2px; height: 22px; background: ${color.line}; margin: 0 auto; }
.al-link.gold { background: ${color.light}; }
@keyframes al-glow { 0%,100% { box-shadow: 0 0 0 0 ${tint(color.fate, 0)}; } 50% { box-shadow: 0 0 12px 0 ${tint(color.fate, 35)}; } }
@media (prefers-reduced-motion: reduce) { .al-crisis { animation: none; } }
`;
