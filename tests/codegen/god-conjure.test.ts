// The conjuring numbers the document gives in words (07-conjure.md) are read by the generator, and the constants of the code (src/core/god/conjure/tuning.ts) must equal them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GenFile } from '../../src/core/types';
import type { GodConjureData } from '../../scripts/codegen/groups/god-conjure';
import { CLASH_ADD, SIZE_FACTOR, VERB_MUL } from '../../src/core/god/conjure/tuning';

const G = (JSON.parse(readFileSync('data/gen/god-conjure.json', 'utf8')) as GenFile<GodConjureData>).items;
const god = JSON.parse(readFileSync('data/gen/god.json', 'utf8')).items as { conjure: { verbs: { id: string; name: string }[]; cells: unknown[]; reactions: unknown[] } };

describe('god-conjure generator', () => {
  it('reads the six multipliers of the verbs, the sizes and the clash from the document', () => {
    expect(Object.keys(G.verbMul).length).toBe(6);
    expect(G.sizeFactor).toEqual({ place: 0.5, continent: 0.6 });
    expect(G.clashAdd).toBe(0.15);
  });
  it('the constants of the code are the numbers of the document', () => {
    for (const v of god.conjure.verbs) expect(VERB_MUL[v.id], v.name).toBe(G.verbMul[v.name]);
    expect(SIZE_FACTOR.place).toBe(G.sizeFactor.place);
    expect(SIZE_FACTOR.continent).toBe(G.sizeFactor.continent);
    expect(CLASH_ADD).toBe(G.clashAdd);
  });
  it('god.json holds the 48 cells and the 10 reactions of the tables', () => {
    expect(god.conjure.cells.length).toBe(48);
    expect(god.conjure.reactions.length).toBe(10);
  });
});
