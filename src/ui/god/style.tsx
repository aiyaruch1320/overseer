// The look of the god's screens, from the tokens (20-god-ui.md §1): dark velvet, gold light, blood dread, silver fate. One sheet of classes for
// what inline styles cannot say (hover, the flicker of a flame, the burning edge of a prayer); layout stays inline in the components.
import type { JSX } from 'preact';
import { color, font, motion, rarity, size } from '../tokens';

export const sheet = `
.g-root { color: ${color.text}; font-family: ${font.body}; font-size: ${size.text}px; }
.g-root * { box-sizing: border-box; }
.g-root button { font-family: inherit; font-size: inherit; color: inherit; cursor: pointer; }
.g-btn { background: #1a1b24; border: 1px solid ${color.line}; border-radius: ${size.radius}px; padding: 6px 14px; transition: transform .15s, border-color .15s, background .15s; }
.g-btn:hover:not(:disabled) { border-color: ${color.light}; background: #20212c; }
.g-btn:focus-visible, .g-card:focus-visible, .g-door:focus-visible, .g-chip:focus-visible { outline: 2px solid ${color.light}; outline-offset: 2px; }
.g-btn:disabled, .g-btn[aria-disabled="true"] { color: ${color.textDim}; background: #14151b; border-style: dashed; cursor: not-allowed; }
.g-btn.light { border-color: ${color.light}; color: ${color.light}; }
.g-btn.dread { border-color: #b4364a; color: ${color.dreadText}; }
.g-btn.fate { border-color: ${color.fate}; color: ${color.fate}; }
.g-btn.dream { border-color: ${color.dreamMist}; color: #b8a8e8; }
.g-card { background: #15161d; border: 2px solid ${color.line}; border-radius: ${size.radius + 2}px; padding: ${size.pad}px; transition: transform .18s, box-shadow .18s; text-align: left; cursor: pointer; }
.g-card:hover { transform: translateY(-4px); box-shadow: 0 8px 18px #000a; }
.g-card.poor { transform: rotate(-1.5deg) translateY(3px); opacity: .7; }
.g-card.poor:hover { transform: rotate(-1.5deg) translateY(0); }
.g-door { background: linear-gradient(#1c1840, #14122c); border: 1px solid ${color.dreamMist}; border-radius: 40px 40px 6px 6px; padding: ${size.pad}px; text-align: center; cursor: pointer; transition: transform .2s, box-shadow .2s; }
.g-door:hover { transform: translateY(-3px); box-shadow: 0 0 22px #6a5a9a66; }
.g-chip { background: #1a1b24; border: 1px solid ${color.line}; border-radius: 999px; padding: 6px 12px; }
.g-chip[aria-pressed="true"] { border-color: ${color.light}; color: ${color.light}; background: #241f10; }
.g-chip.shut { color: #5a5c66; border-style: dotted; background: #0c0d11; cursor: not-allowed; }
.g-dim { color: ${color.textDim}; }
.g-small { font-size: ${size.small}px; }
.g-title { font-family: ${font.title}; font-size: ${size.title}px; }
.g-flame { display: inline-block; width: 10px; border-radius: 50% 50% 40% 40%; background: linear-gradient(#fff6c8, ${color.light}); transform-origin: bottom; animation: g-flick ${motion.flicker} ease-in-out infinite; }
.g-flame.waver { animation-name: g-waver; }
.g-flame.low { opacity: .6; }
.g-burn { height: 5px; border-radius: 3px; background: #2a1c10; overflow: hidden; }
.g-burn > i { display: block; height: 100%; background: linear-gradient(90deg, #5a2a10, #d86a3a); }
.g-scroll { max-height: 100%; overflow: auto; }
.g-pair { display: grid; gap: ${size.gap}px; }
.g-ring { stroke-dasharray: 100; transition: stroke-dashoffset .1s linear; }
@keyframes g-flick { 0%,100% { transform: scaleY(1) skewX(0); } 50% { transform: scaleY(1.08) skewX(2deg); } }
@keyframes g-waver { 0%,100% { transform: scaleY(.8) translateX(-2px); } 50% { transform: scaleY(.9) translateX(2px); } }
@keyframes g-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.g-rise { animation: g-rise .25s ease-out; }
@media (prefers-reduced-motion: reduce) { .g-flame, .g-rise { animation: none; } .g-card, .g-door { transition: none; } }
`;

/** Puts the sheet on the page once (every god screen draws it; the same text twice does no harm). */
export function GodStyles(): JSX.Element {
  return <style>{sheet}</style>;
}

export const toneColor: Record<string, string> = { light: color.light, dread: color.dreadText, fate: color.fate, dream: '#b8a8e8' };

export const frameOf = (tier: string): string => (rarity as Record<string, string>)[tier] ?? color.line;

export const page: JSX.CSSProperties = { background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text };
export const row: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: size.gap };
export const col: JSX.CSSProperties = { display: 'flex', flexDirection: 'column', gap: size.gap };
export const box: JSX.CSSProperties = { background: '#12131a', border: `1px solid ${color.line}`, borderRadius: size.radius, padding: size.pad };
