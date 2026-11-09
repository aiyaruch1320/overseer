// The typed shared facts (LifeExt, WorldExt, NpcSlotState) are types over the same plain JSON: a save made before they existed loads unchanged
// and the accessors read the same numbers the systems wrote. The fixture was made with the code before the change (seed 7, to age 30).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGen } from '../../scripts/tools/load-gen';
import { versions } from '../../src/core/game';
import { clone, load, save } from '../../src/core/save';
import { bondageFacts, fameOf, savedHp, storyFacts } from '../../src/core/types';

const text = readFileSync(path.join(__dirname, '../fixtures/saves/before-typed-ext.json'), 'utf8');

describe('a save made before the typed ext', () => {
  const { state, stale } = load(text, versions(loadGen()));
  it('loads and round-trips byte for byte (no migration is needed: no stored field moved)', () => {
    // the data files move on with every doc edit, so an old save may name some as stale: it still opens (code-plan §5.3) and keeps its text
    expect(Array.isArray(stale)).toBe(true);
    expect(save(state)).toBe(text.trim());
    expect(clone(state)).toEqual(state);
  });
  it('the typed accessors read what the systems saved', () => {
    const life = state.life!;
    const raw = life.ext.character as { fame?: number };
    expect(fameOf(life)).toBe(raw.fame ?? 0);
    expect(savedHp(life)).toBe((life.ext.combat as { hp: number | null }).hp);
    expect(storyFacts(life)).toBe(life.ext.story);
    expect(bondageFacts(life)?.level ?? 0).toBeGreaterThanOrEqual(0);
  });
  it('a life with no character extras yet reads fame 0 and no hit points', () => {
    const bare = { ...state.life!, ext: {} };
    expect(fameOf(bare)).toBe(0);
    expect(savedHp(bare)).toBeNull();
  });
  it('npc slots carry the shared facts', () => {
    const slots = Object.values(state.npcs.slots);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(typeof s.name).toBe('string');
  });
});
