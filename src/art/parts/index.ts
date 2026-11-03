// The parts of a person, by id. Each kind lives in its own file so several hands can add parts at once; this file only gathers them.
// A Look names a part by id ('' or an unknown id draws nothing, and the characters page lists the unknown ids).
import type { Part, Tool } from '../rig';
import { BODY_PARTS, EARS, LOWER } from './body';
import { FEATS } from './feats';
import { BEARDS, HAIR } from './hair';
import { HATS } from './hats';
import { OUTFITS } from './outfits';
import { TOOLS } from './tools';

export { BODY_PARTS, EARS, LOWER, FEATS, BEARDS, HAIR, HATS, OUTFITS, TOOLS };

export const NO_TOOL: Tool = { kind: 'none' };
export const part = (table: Record<string, Part>, id: string): Part | undefined => (id ? table[id] : undefined);
