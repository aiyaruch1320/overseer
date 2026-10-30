// Half-bloods. A person of two peoples keeps the build and the dress of the people they were raised in and carries one or two marks of the
// other: the ears, a tail, tusks, gills, a little of the skin and the eyes (docs/lore/storylines/22-halfblood.md). Only the signature marks are
// grafted on, never the whole costume of the second people, so a half-orc is still a person first and the crowd keeps reading as people.
import { mix, type Look } from '../render/characters/kit';
import { themeOf } from '../render/characters/themes';
import { RNG, hashString } from '../sim/rng';

interface Graft { feats: string[]; ears?: string; tint?: number }
const GRAFT: Record<string, Graft> = {
  human: { feats: [], ears: 'round' },
  elf: { feats: [], ears: 'point' },
  darkelf: { feats: ['slit'], ears: 'point', tint: 0x6a5a78 },
  dwarf: { feats: ['runes'] },
  orc: { feats: ['tusks'], tint: 0x7a8a62 },
  halfling: { feats: ['hairyfeet'] },
  beast: { feats: ['tail:fluffy'], ears: 'beast' },
  naga: { feats: ['scales', 'slit'], tint: 0x6a8a5a },
  dragonkin: { feats: ['horns', 'tail:lizard'], tint: 0x9a6a50 },
  vampire: { feats: ['fangs', 'redeyes'], tint: 0xe0d4d4 },
  fae: { feats: ['sparkle'], ears: 'point' },
  demonkin: { feats: ['horns', 'tail:spade'], tint: 0x8a5a60 },
  merfolk: { feats: ['gills', 'scales'], ears: 'fin', tint: 0x7aa0a8 },
  winged: { feats: ['wings:feather'] },
  giant: { feats: ['heavybrow'] },
  lavakin: { feats: ['cracks', 'embers'], tint: 0x8a4a38 },
};

const family = (f: string) => f.split(':')[0];

/** the look of someone whose other parent was of the people `second` */
export function applyBlend(L: Look, second: string, seed: string): Look {
  const g = GRAFT[second], main = themeOf(L.race), sec = themeOf(second);
  if (!g || second === L.race) return L;
  const r = new RNG(hashString('blend:' + seed));
  const has = new Set([...main.feats, ...(L.extra || [])].map(family));
  const extra = [...(L.extra || []), `blend:${second}`, ...g.feats.filter((f) => !has.has(family(f)))];
  // ears: the second people's, unless the main people already wears distinctive ones (an elf with a human parent has shorter points)
  if (g.ears && g.ears !== 'round' && (main.ears === 'round' || main.ears === 'none')) extra.push(`ears:${g.ears}`);
  else if (main.ears === 'long' && second === 'human') extra.push('ears:point');
  const skins = sec.skins;
  const skin = g.tint !== undefined ? mix(L.skin, g.tint, 0.28) : second === 'human' && main.skins !== skins ? mix(L.skin, r.pick(skins), 0.4) : L.skin;
  return { ...L, extra, skin, eye: r.chance(0.5) && sec.eyes?.length ? r.pick(sec.eyes) : L.eye, accent: r.chance(0.5) ? r.pick(sec.accent) : L.accent };
}

/** the second people of a half-blood look, or undefined */
export const blendOf = (L: Look): string | undefined => L.extra?.find((f) => f.startsWith('blend:'))?.slice(6);
