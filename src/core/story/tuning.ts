// Numbers the story system needs that no document states exactly (code-plan §2 rule 3: one tuning file per system).
// Every value says where it comes from, so the lead can move it into the documents later.
import type { Condition } from '../types';

/** Natural death at hAge 75 (world-time.md §3): the last life year is the year that ends at 75, so hAge 74. */
export const NATURAL_END = 75;
export const LAST_YEAR = NATURAL_END - 1;

/** Race id (data/gen/races.json) → storyline code, so tests without races.json still resolve the main line. */
export const RACE_LINE: Record<string, string> = {
  human: 'hu', elf: 'el', darkelf: 'de', dwarf: 'dw', orc: 'or', halfling: 'ha', beast: 'be', naga: 'na', dragonkin: 'dk',
  vampire: 'va', fae: 'fa', slime: 'sl', demonkin: 'dm', merfolk: 'me', winged: 'wi', giant: 'gi', lavakin: 'la',
  construct: 'co', soulmachine: 'so', mummy: 'mu', ghoul: 'gh',
};

/** Overlay lines of the nodes `xc` (one node per race, titled `<race name>: ...`). */
export const XC_LINE = 'xc';

/**
 * Share of lives that open an overlay line, from scripts/sim/sim-life.mjs OVERLAY_RATE and XC_RATE (travel/01-travel-rules.md §2 and
 * storylines/25-journeys.md §3 for the journey lines; bd bo ab are the sim's own guesses). The rate is read as "chance that a life
 * opens the line once its condition holds", so a life that never meets the condition opens nothing; the travel, economy, bonds and
 * bondage systems (M3) will replace the roll with their own causes through `openLine`.
 */
export const OPEN_RATE: Record<string, number> = {
  sf: 0.08, ps: 0.06, ml: 0.08, sc: 0.08, ex: 0.1, wd: 0.08, tr: 0.15, cr: 0.12, md: 0.06, ld: 0.06, fm: 0.3,
  bd: 0.05, bo: 0.04, ab: 0.12, bn: 0.85, kn: 0.6, le: 0.1, xc: 0.45,
};

/** Overlay lines whose opening rule is a plain condition, not a share of lives (no rate). Conditions come from the documents. */
export const OPEN_COND: Record<string, Condition> = {
  // 24-economy.md §2 rule 2
  pv: { k: 'class', max: 2 },
  iv: { k: 'and', of: [{ k: 'class', min: 3 }, { k: 'cmp', stat: 'gold', op: '>=', value: 150 }] },
  nl: { k: 'class', min: 5 },
  wk: { k: 'or', of: [{ k: 'has', kind: 'job', id: 'miner' }, { k: 'has', kind: 'job', id: 'laborer' }, { k: 'has', kind: 'job', id: 'factory_worker' }] },
  // 22-halfblood.md: the central half-blood line for every half-blood life
  hb: { k: 'half' },
  // 30-last-era.md: lives that overlap era 4
  le: { k: 'era', min: 4 },
};

/**
 * Lines the story system never opens by itself because another system owns the cause. They open through `openLine(ctx, line)`:
 *  ec: 24-economy.md says "every character", which would add 9 nodes per life on top of the 31 to 33 of the code-plan target;
 *      the economy system (M3) decides when it joins.
 *  mr dp: after the god acted (god/04-miracles.md, god/03-dreams.md): only when the god chronicle is not empty.
 *  hr: heirs (lineage has an earlier life).
 */
export const EXTERNAL_LINES: ReadonlySet<string> = new Set(['ec']);

/** Lines whose opening depends on the state, not on a condition tree. */
export const OPEN_PRED: Record<string, (s: { lives: number; chronicle: number }) => boolean> = {
  hr: (s) => s.lives > 0,
  mr: (s) => s.chronicle > 0,
  dp: (s) => s.chronicle > 0,
};

/** The pair sets cover half-bloods (22-halfblood.md §3): they open with the half-blood line. */
export const PAIR_RATE = 1;

/** Rites written as a ceremony per sub-line with pass and fail columns and no weights (be.t1, me.t1): chance to pass. */
export const RITE_PASS = 0.65;

/** A closed convergence may open again at the next adult node, once per life (00-convergence.md §3). */
export const WAIT_STAGES: readonly string[] = ['a'];

/** Chance that a node linked to open convergences (`links`) takes the character into one of them. */
export const LINK_ENTER = 1;

/** Director (llm/04-story.md §3.1): a choice that ties back to someone or something this life met. */
export const DIRECTOR_TIE = 1.75;
export const DIRECTOR_CAP = 2;

/** Eight lines of director memory (llm/04-story.md §3.1 rule 2). */
export const MEMORY_LINES = 8;

/** Battle stand-in until the combat system (M3): win, lose, flee. */
export const BATTLE_ODDS = { win: 0.6, lose: 0.25, flee: 0.15 } as const;
