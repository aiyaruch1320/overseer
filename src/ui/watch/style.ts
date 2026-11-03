// Styles of the watch screen. Colours, fonts and sizes come from tokens.ts only; `layout` holds the measures of this one screen's frame.
import type { JSX } from 'preact';
import type { Tone } from '../../app/views/watch';
import { color, font, motion, size } from '../tokens';

type CSS = JSX.CSSProperties;

/** The frame of the screen (20-god-ui.md §2: the life line is the lowest eighth of the screen, the god panel is narrow on the right edge). */
export const layout = {
  panelWidth: 200,
  lineHeight: 96,
  logHeight: 150,
  mapWidth: 200,
  mapHeight: 130,
  cardWidth: 250,
} as const;

export const toneColor: Record<Tone, string> = { light: color.light, dread: color.dread, fate: color.fate };

/** A colour at a share of its strength over the panel. */
export const tint = (c: string, pct: number): string => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

export const panelBox: CSS = {
  background: color.panel,
  border: `1px solid ${color.line}`,
  borderRadius: size.radius,
  padding: size.pad,
};

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

export const buttonOff: CSS = { ...button, color: color.textDim, background: tint(color.text, 2), cursor: 'default', opacity: 0.55 };

/** The rules that need selectors or keyframes; the rest is inline. One <style> in the screen. */
export const css = `
.wt-root { box-sizing: border-box; }
.wt-root *, .wt-root *::before, .wt-root *::after { box-sizing: border-box; }
.wt-btn:hover:not([disabled]) { border-color: ${color.textDim}; background: ${tint(color.text, 12)}; }
.wt-btn:focus-visible { outline: 2px solid ${color.text}; outline-offset: 1px; }
.wt-btn[disabled] { cursor: default; }
.wt-log::-webkit-scrollbar { width: 8px; }
.wt-log::-webkit-scrollbar-thumb { background: ${color.line}; border-radius: 4px; }
@keyframes wt-flicker { 0%, 100% { transform: scale(1, 1) translateX(0); } 25% { transform: scale(0.96, 1.04) translateX(-0.6px); } 50% { transform: scale(1.03, 0.97) translateX(0.5px); } 75% { transform: scale(0.98, 1.02) translateX(-0.3px); } }
@keyframes wt-beat { 0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); } }
@keyframes wt-edge { 0%, 100% { box-shadow: 0 0 0 1px ${tint(color.light, 35)}; } 50% { box-shadow: 0 0 6px 1px ${tint(color.light, 70)}; } }
@keyframes wt-slide { from { transform: translateX(-24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes wt-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
@keyframes wt-dim { from { opacity: 0; } to { opacity: 1; } }
.wt-flame { transform-origin: 50% 100%; animation: wt-flicker ${motion.flicker} ease-in-out infinite; }
.wt-beat { animation: wt-beat 1.6s ease-in-out 3; }
.wt-beat-open { animation: wt-beat 1.6s ease-in-out infinite; }
.wt-edge { animation: wt-edge 2.4s ease-in-out infinite; }
.wt-card { animation: wt-slide ${motion.fade} ease-out; }
.wt-rise { animation: wt-rise 1.6s ease-out forwards; }
.wt-veil { animation: wt-dim 0.5s ease-out; }
@media (prefers-reduced-motion: reduce) { .wt-flame, .wt-beat, .wt-beat-open, .wt-edge, .wt-card, .wt-rise, .wt-veil { animation: none; } }
`;
