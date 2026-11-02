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
 * Share of lives that open an overlay line, from scripts/sim/sim-life.mjs OVERLAY_RATE (storylines/25-journeys.md §3). The rate is read as
 * "chance that a life opens the line once its condition holds", so a life that never meets the condition opens nothing. The lines whose
 * cause belongs to another system are not here but in EXTERNAL_LINES: they open only through `openLine`.
 */
export const OPEN_RATE: Record<string, number> = {
  tr: 0.15, cr: 0.12, md: 0.06, ld: 0.06, fm: 0.3,
  bn: 0.85, kn: 0.6, le: 0.1,
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
 *      the economy system decides when it joins.
 *  sf ps ml sc ex wd xc: the journey lines, opened by the travel system (travel/01-travel-rules.md §2).
 *  bd bo ab: the bondage system opens them (economy/10-bondage.md).
 *  mr dp: after the god acted (god/04-miracles.md, god/03-dreams.md): only when the god chronicle is not empty.
 *  hr: heirs (lineage has an earlier life).
 */
export const EXTERNAL_LINES: ReadonlySet<string> = new Set(['ec', 'sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc', 'bd', 'bo', 'ab']);

/** Lines whose opening depends on the state, not on a condition tree. */
export const OPEN_PRED: Record<string, (s: { lives: number; chronicle: number }) => boolean> = {
  hr: (s) => s.lives > 0,
  mr: (s) => s.chronicle > 0,
  dp: (s) => s.chronicle > 0,
};

/**
 * Lines that keep no draw of their own: `mr` and `dp` read what the god did, which cannot be known when the line is first due, so the
 * decision to open is made again each year until the god has acted (docs/lore/storylines/31-divine.md §2 rule 3).
 */
export const RETRY_OPEN: ReadonlySet<string> = new Set(['mr', 'dp']);

/**
 * Lines whose nodes wait for their own condition instead of drawing an age and being skipped when it fails (31-divine.md §2 rule 6): a node
 * plays the year its condition holds, in any order, and is skipped once its age window is over. The closing node waits for the last year.
 */
export const ROLLING_LINES: ReadonlySet<string> = new Set(['dp']);

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

/**
 * A way that moves the character to a country the travel filters shut (travel `canGo` is false) is weighed this much of what it is written:
 * the move would be refused, so the way is rarer, not cut (a node whose every way names a place still has a way to take).
 */
export const PLACE_SHUT = 0.25;

// ---------- how a life ends (M1 review S1) ----------

/**
 * Causes of death the story writes besides the character system's own (`old` `illness` `accident` `violence`). Thai words, because the
 * text system prints a cause it does not know as written (text/tuning.ts CAUSE_TH).
 */
export const CAUSE = { battle: 'ตายในศึก', light: 'ออกไปรับแสง', stone: 'กลายเป็นหิน' } as const;

/** A cause, or weighted causes when the way says "A หรือ B" (hu.e2 ทาง ข "โรคหรืออุบัติเหตุ"). */
export type Way = string | readonly { id: string; w: number }[];

/**
 * How the character dies on a way that says it dies (storylines/README.md §6 rule 9: the closing node e2 of a race line, and the
 * overlay nodes whose label says "ตาย…"). The data has no `death` effect for them, so the way is read from the label and written
 * here by hand: key = `<node>.<choice key>`. A way of e2 that is not listed dies a plain death of `old` age (peaceful, a transformation,
 * a return to the earth: the label says how, the cause stays `old`; the node id is kept in `life.dead.node`).
 */
export const DEATH_WAYS: Record<string, Way> = {
  'hu.e2.b': [{ id: 'illness', w: 5 }, { id: 'accident', w: 3 }], // โรคหรืออุบัติเหตุ (character/tuning.ts UNTIMELY.causes weights)
  'or.e2.a': CAUSE.battle, // ตายในศึกตามที่หวัง
  'gi.e2.b': CAUSE.battle, // ตายในศึกกับไททัน
  'de.e2.b': 'violence', // ถูกลอบสังหารโดยศิษย์หรือตระกูล
  'gh.e2.b': 'violence', // ถูกล่าโดยผู้ล่าแวมไพร์
  'sl.e2.b': 'violence', // ถูกกลืนโดยสไลม์ตัวอื่น
  'so.e2.b': 'violence', // ถูกถอดชิ้นส่วนขาย
  'dw.e2.b': 'accident', // ตายใต้ดิน (เหมืองถล่ม ลาวา)
  'dk.e2.b': 'accident', // ตายในเปลวไฟของตัวเอง
  'me.e2.b': 'accident', // ตายบนบก
  'wi.e2.b': 'accident', // ตายบนดิน
  'va.e2.b': CAUSE.light, // เดินออกไปรับแสงอาทิตย์
  // the elders of the overlay lines whose way says the character dies (age 50 to 75, before the closing node)
  'ml.e1.c': CAUSE.battle, // ตายในสนามสุดท้าย
  'sf.e1.c': 'accident', // ตายบนเรือในทะเล
  'wd.e1.b': 'accident', // ตายบนทาง
  'ps.e1.b': 'illness', // ตายระหว่างเดินทางกลับ
  'sc.e1.c': 'illness', // ตายระหว่างวิจัย
  'bd.e1.c': 'illness', // ยังไม่พ้นพันธะ ตายในสัญญา
};

/** A rite outcome that kills: node → the start of the outcome label (na.t1 "ไม่ผ่าน กลายเป็นหิน": "ปลายทางทันที"). */
export const DEADLY_OUTCOMES: Record<string, { label: string; cause: Way }> = {
  'na.t1': { label: 'ไม่ผ่าน', cause: CAUSE.stone },
};

/**
 * Endings that are a death in battle (01-human.md §6 "ผู้ตายในสงคราม"): a life earns one only when it ends in battle, never of old age.
 * The data condition of it is only "passed hu.a4".
 */
export const WAR_ENDINGS: ReadonlySet<string> = new Set(['ผู้ตายในสงคราม']);

/** Endings the table writes with no condition ("—") and the words below it: a plain life earns it when nothing more specific was earned. */
export const PLAIN_ENDINGS: Record<string, { noConvergence: boolean; cause: readonly string[] }> = {
  // "ไม่ได้ผ่าน cv เลย ตายเมื่อแก่"
  คนธรรมดาที่รอด: { noConvergence: true, cause: ['old'] },
};

/** Ending groups of the data whose `line` is not a line id: they count when the life opened one of these lines. */
export const ENDING_GROUPS: Record<string, readonly string[]> = {
  halfblood: ['hb'],
  heir: ['hr'],
  economy: ['ec', 'pv', 'tr', 'iv', 'nl', 'wk'],
};

/**
 * Which ending a life gets when it earned several (assumption; the docs say a life has one ending): drawn by weight, a condition adds
 * to the weight (a harder one to earn is more telling), and one of the life's own race line weighs more than one of an overlay line.
 */
export const ENDING_WEIGHT = { base: 1, perClause: 1, mainLine: 3 };

// ---------- pace (M1 review S2) ----------

/**
 * Nodes played in one life year (assumption; the docs set no number, 31 to 33 nodes over 75 years is about 0.4 a year, so two is a busy
 * year). A node the year has no room for waits for the next year; a closing node of the race line (stage e) is never delayed.
 */
export const NODES_PER_YEAR = 2;

/** The last life year before the natural death holds this many more (the elders of the lines close their stories there; assumption). */
export const LAST_YEAR_EXTRA = 1;

/** A node that waits for a free year may slip this many years past the end of its table age (assumption; the age window of the table is a target). */
export const SLIP_YEARS = 5;

/** Battles fought in one life year (storylines/README.md §8: "นับในเพดานศึก 4 ครั้งต่อปี"). A battle over the number does not happen. */
export const BATTLES_PER_YEAR = 4;

/** The journey lines: a life walks one at a time, the next opens when the first is done (25-journeys.md §2 rule 3). */
export const JOURNEY_LINES: ReadonlySet<string> = new Set(['sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc']);
export const JOURNEY_AT_ONCE = 1;

/**
 * Overlay lines opened by chance (OPEN_RATE) that are walked at the same time (assumption; no document sets a number). A line that is
 * drawn open while the places are full waits and opens when one line is done. Lines whose cause is a state (a condition, a half-blood,
 * an heir, the last era) or another system (`openLine`) are not counted.
 */
export const OVERLAY_AT_ONCE = 4;

// ---------- god windows (07-attention.md §3, M2 review G1) ----------

/**
 * A node with a god window is announced (`story/window`) and decided at a later beat, once the attention system has answered the announcement
 * (a call or a glow). Attention may hold a window up to `stopWait` (60 s, about 2.1 life years) for the gap rules; the node waits that long, no longer.
 */
export const WINDOW_MAX_BEATS = 10;
