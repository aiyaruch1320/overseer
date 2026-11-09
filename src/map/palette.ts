// The colours of the houses of a country, read from its docs (docs/appearance/countries/*.md): the `roofs=` of the UI value, and the "วัสดุและสี" line
// (look.materials) that names the walls: `ผนัง… (#5a4a4a)`, `อิฐแดงเข้มคล้ำ (#6a2a2a)`. A colour in that line that follows the word หลังคา is a roof, the
// others that follow a material word (หิน อิฐ ผนัง ไม้ เหล็ก ดิน ปูน กำแพง) are walls. When a country gives no hex at all, its colour words (เทาน้ำตาล สนิม ...)
// make the roofs of a `roofs=default` country. Pure data, no DOM.
import { mix, shade } from './color';

const ROOF_WORD = 'หลังคา';
const WALL_WORDS = ['ผนัง', 'อิฐ', 'หิน', 'ไม้', 'เหล็ก', 'ดิน', 'ปูน', 'กำแพง', 'ทราย', 'โคลน'];

/** Hex colours of the walls named by the materials line (empty when it names none). */
export function wallHexes(materials: string): string[] {
  const out: string[] = [];
  const re = /#[0-9a-fA-F]{6}\b/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(materials))) {
    const before = materials.slice(last, m.index);
    last = m.index + m[0].length;
    if (before.includes(ROOF_WORD)) continue;
    if (WALL_WORDS.some((w) => before.includes(w))) out.push(m[0].toLowerCase());
  }
  return out;
}

/** Thai colour words, longest first, to the colour they name (muted: the base colour of an object, before light). */
const WORDS: [string, string][] = [
  ['เทาน้ำตาล', '#7a7062'], ['น้ำตาลแดง', '#8a5a3e'], ['แดงเข้ม', '#7a2e24'], ['เทาเข้ม', '#4a4a50'], ['ขาวนวล', '#e4dcc8'], ['เหลืองอ่อน', '#e0d090'],
  ['สนิม', '#8a5030'], ['น้ำตาล', '#7a5a3e'], ['เทา', '#8a8a8c'], ['ดำ', '#2e2a2c'], ['ขาว', '#e8e4dc'], ['ครีม', '#e0d4b4'], ['ทอง', '#c9a24a'], ['แดง', '#a0392c'],
  ['ฟ้า', '#6a9ac8'], ['เขียว', '#4a8a4a'], ['ม่วง', '#6a4a8a'], ['ส้ม', '#c8742c'], ['ชมพู', '#d89aa8'], ['น้ำเงิน', '#2a4a8a'],
];

/** Roof colours for a `roofs=default` country: the colour words of the first two material phrases, greyed when the line says หม่น (muted). Empty when none. */
export function roofsFromWords(materials: string): string[] {
  const out: string[] = [];
  const text = materials.replace(/\(#[0-9a-fA-F]{6}\)/g, '');
  for (const part of text.split(/\s+/)) {
    for (const [w, c] of WORDS) {
      if (part.includes(w)) {
        if (!out.includes(c)) out.push(c);
        break;
      }
    }
    if (out.length >= 3) break;
  }
  const muted = text.includes('หม่น');
  return out.map((c) => (muted ? mix(c, '#7c7a76', 0.4) : c));
}

/** The wall of each style when the docs give no hex (the stuff the style is built of). */
const STYLE_WALL: Record<string, string> = {
  brick: '#a8623e', stone: '#a09a90', forge: '#5a4a4a', carved: '#6a5a58', keep: '#8a8a90', gable: '#d8c8a8', hut: '#7a6a58', terrace: '#d8c8b0',
  dome: '#e8e0d0', spire: '#e8e4dc', tower: '#9a9aa4', stilt: '#8a6a48', adobe: '#c89a68', aframe: '#8a6a48', boomtown: '#a88a5a', tree: '#7a5a3a',
  mushroom: '#e8d8c0', burrow: '#7a6a50',
};
/** Styles whose walls are the stuff the docs name for the country (the others take the stuff of their style and a little of it). */
const OWN = new Set(['stone', 'brick', 'forge', 'carved', 'keep', 'hut', 'tower']);

/** The wall colour of one house: its style's material, taken to the country's wall colour when the docs name one, then a small stable variation. */
export function wallOf(style: string, walls: string[], roof: string, v: number, muted = false): string {
  const base = STYLE_WALL[style] ?? '#d8c8a8';
  let c: string;
  if (style === 'tent') c = mix(roof, '#e8dcc0', 0.45);
  else if (walls.length) {
    const doc = walls[Math.floor(v * walls.length) % walls.length];
    c = OWN.has(style) ? doc : mix(base, doc, 0.4);
  } else c = style === 'gable' || style === 'terrace' || style === 'dome' || style === 'spire' ? mix(base, roof, 0.18) : base;
  if (muted) c = mix(c, '#6c665c', 0.6);
  return shade(c, (v * 7 % 1 - 0.5) * 0.14);
}
