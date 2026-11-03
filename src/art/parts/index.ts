// The parts of a person, by id. Each kind lives in its own file so several hands can add parts at once; this file only gathers them.
// A Look names a part by id ('' or an unknown id draws nothing, and the characters page lists the unknown ids).
import type { Part, Tool } from '../rig';
import { BODY_PARTS, EARS, LOWER } from './body';
import { FEATS as FEATS_BASE } from './feats';
import { FEATS_EXTRA } from './feats-extra';
import { BEARDS, HAIR } from './hair';
import { HATS } from './hats';
import { OUTFITS } from './outfits';
import { TOOLS as TOOLS_BASE } from './tools';
import { TOOLS_EXTRA } from './tools-extra';

export const FEATS: Record<string, Part> = { ...FEATS_BASE, ...FEATS_EXTRA };
export const TOOLS: Record<string, Tool> = { ...TOOLS_BASE, ...TOOLS_EXTRA };
export { BODY_PARTS, EARS, LOWER, BEARDS, HAIR, HATS, OUTFITS };

export const NO_TOOL: Tool = { kind: 'none' };
export const part = (table: Record<string, Part>, id: string): Part | undefined => (id ? table[id] : undefined);
