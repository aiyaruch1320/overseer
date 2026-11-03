// Styles of the battle view and the war panel. Colours, fonts and sizes come from tokens.ts only.
import type { JSX } from 'preact';
import type { Tone } from '../../app/views/battle';
import { color, font, motion, size } from '../tokens';

type CSS = JSX.CSSProperties;

export const tint = (c: string, pct: number): string => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/** The colour of the result: the light for a win, the dread for a loss, the fate grey for a standoff or a quiet end. */
export const toneColor: Record<Tone, string> = { win: color.light, lose: color.dread, draw: color.fate, quiet: color.fate };

export const box: CSS = { background: color.panel, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: size.pad };

export const heading: CSS = { fontSize: size.small, color: color.textDim, marginBottom: size.gap / 2, lineHeight: 1.5 };

export const button: CSS = {
  background: tint(color.text, 6),
  color: color.text,
  border: `1px solid ${color.line}`,
  borderRadius: size.radius,
  padding: `${size.gap - 2}px ${size.pad}px`,
  fontFamily: font.body,
  fontSize: size.small,
  cursor: 'pointer',
};

export const chip = (c: string): CSS => ({
  display: 'inline-block',
  fontSize: size.small,
  color: c,
  border: `1px solid ${tint(c, 55)}`,
  background: tint(c, 10),
  borderRadius: size.radius,
  padding: '1px 8px',
});

export const css = `
.bt-root { box-sizing: border-box; }
.bt-root *, .bt-root *::before, .bt-root *::after { box-sizing: border-box; }
.bt-btn:hover:not([disabled]) { border-color: ${color.textDim}; background: ${tint(color.text, 12)}; }
.bt-btn:focus-visible, .bt-beat:focus-visible { outline: 2px solid ${color.text}; outline-offset: 1px; }
.bt-btn[disabled] { opacity: 0.45; cursor: default; }
.bt-beat { cursor: pointer; transition: border-color 0.2s, background 0.2s, opacity 0.2s; }
.bt-beat:hover { border-color: ${color.textDim}; }
@keyframes bt-pop { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-34px); opacity: 0; } }
@keyframes bt-in { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes bt-edge { 0%, 100% { box-shadow: 0 0 0 1px ${tint(color.light, 35)}; } 50% { box-shadow: 0 0 7px 1px ${tint(color.light, 75)}; } }
@keyframes bt-dread { 0%, 100% { box-shadow: 0 0 0 1px ${tint(color.dread, 40)}; } 50% { box-shadow: 0 0 9px 1px ${tint(color.dread, 80)}; } }
.bt-pop { animation: bt-pop 1.3s ease-out forwards; }
.bt-in { animation: bt-in ${motion.fade} ease-out; }
.bt-god { animation: bt-edge ${motion.flicker} ease-in-out infinite; }
.bt-boss { animation: bt-dread ${motion.flicker} ease-in-out infinite; }
.bt-bar { transition: width 0.5s ease-out; }
@media (prefers-reduced-motion: reduce) { .bt-pop, .bt-in, .bt-god, .bt-boss { animation: none; } .bt-bar { transition: none; } }
`;
