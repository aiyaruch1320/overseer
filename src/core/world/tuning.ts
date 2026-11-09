// Numbers the world system needs that no document states as a table (code-plan §2.3: one tuning file per system).
// Every value here is the one scripts/sim/sim-world.mjs uses (docs/systems/simulation/world-sim.md §2), so the
// statistical targets of the doc-level simulation carry over to the core. The tables of the docs (rates, caps, moods,
// closures, last-era feedback ...) are read from data/gen/world-events.json, never repeated here.
import type { Mark } from '../data/types-events';

export const TUNING = {
  /** a start-of-world dragon's mood is the table value plus this much noise (sim: `gauss × 4`) */
  moodStartNoise: 4,
  /** mood noise per decade (`gauss × 1.5`) */
  moodNoise: 1.5,
  /** mood lost per decade is the table's decay times this (world-sim.md §2: 0.7 of the dragons README factor) */
  stress: 0.7,
  /** share of the gap to the cap a dragon recovers per decade, times world faith ÷ `faithRef` */
  recover: 0.03,
  faithRef: 60,
  /** a dragon can fall below this mood (world-sim.md §1: "ล้มเมื่ออารมณ์ต่ำกว่า 10") */
  fallBelow: 10,
  /** below this mood it falls for certain; between the two it falls with `fallChance` × the religion weight of its fall event */
  fallSure: 3,
  fallChance: 0.35,
  /** a hero kills the dragon with the weight `100 − mood + heroBase` (DR-13) */
  heroBase: 10,
  /** the mourning wave is bigger by this much when the dragon that fell has no single closest sibling (Rahu, whose two heads quarrel) */
  loneMournExtra: 1.6,
  /** LE-11: END-12 / END-11 chance is multiplied by `match` when WR-15 ended on that ending's side and by `miss` otherwise (04-last-era.md §3.1) */
  leanMul: { match: 2, miss: 0.5 },
  /** the docs say "มังกรอารมณ์ลดทุกตัว" without a number; the sim takes 5 */
  moodOfEvent: { 'GD-05': -5 } as Record<string, number>,
  /** events that open only through the god system (world-sim.md §3.1: GD-04 and GD-05 come from the acts of the god; the sim has no god, so they never happen there) */
  godOnly: ['GD-04', 'GD-05'] as string[],
  /**
   * Tension between the continents (world-events.md §0.1.1: +1 per pair with an open knot). The docs name no count of pairs, so one number stands for all:
   * it starts at `start` and rises `drift` a decade; HP-01 −30, HP-04 −10, MC-01 +20, FG-14 +30 move it (the event effects).
   */
  tension: { start: 20, drift: 2 },
  /** a pillar that falls while "the fog core leaks" (END-09 opened through FG-11) loses this much mood (world-events.md §0.4 rule 10) */
  leakMood: 20,
  /** chance multiplier of an event whose numeric state condition holds (sim `stateBoost`) */
  stateBoost: 2,
  /** years an event stays "running" (`กำลังเดิน`) after it fired, by mark */
  running: { '⭐': 30, '●': 20, '○': 10 } as Record<Mark, number>,
  /** how long a war flag stays on the countries a war names */
  warFlagYears: 40,
  /**
   * Country flags the events put on (economy/01-world-economy.md §6 and the war rows: "ธง `famine` ประเทศ W 1 ถึง 2 สามปี" CT-02 · "ธง `war` ทุกประเทศ MH" DM-01).
   * `w` = only countries whose W is in the band; `except` = continents left out; `years` = how long the flag stays. CT-03 is "เก้าทวีป" with the forest as the last
   * place of cure (world-events.md §14): every country but SV, ten years (assumption: the docs give no length; the length of a decade stands for a plague).
   */
  flagEvents: {
    'CT-02': { flag: 'famine', w: [1, 2], years: 3 },
    'CT-03': { flag: 'plague', except: ['SV'], years: 10 },
    'DM-01': { flag: 'war', continents: ['MH'], years: 40 },
  } as Record<string, { flag: string; w?: [number, number]; continents?: string[]; except?: string[]; years: number }>,
  /** events that end a flag everywhere (HP-06 "โรคระบาดหายตลอดยุค") */
  flagCures: { 'HP-06': 'plague' } as Record<string, string>,
  /** the mood a revived dragon comes back with (HP-08 `DFC −1`: the heir of the sky) and the dragon it is */
  revive: { mood: 60, dragon: 0 },
  /** `DFC +1` effects do not say which dragon: the dragon of the event, else one of these (index list), picked by the effect stream */
  dfcPool: {
    'DR-09': { from: [1, 2, 3, 4, 5], needEra: true },
    'DR-10': { from: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], needEra: false },
  } as Record<string, { from: number[]; needEra: boolean }>,
  /** `DFC +1` of a pick that names one dragon: FG-10 "นิเวรีหลับลึกถาวร" (counts in DFC and calls DR-15, END-09 stays closed). Off: with it the eras start about 80 years earlier than world-sim.md §3.1 (see the report) */
  dfcTarget: {} as Record<string, number>,
  /** events whose `DFC +1` is left out on purpose (the doc-level sim leaves it out, world-sim.md §1 "ที่ไม่ได้จำลอง") */
  dfcIgnore: ['FG-10'] as string[],
  /** the level a world event gets in the log by its mark (log level 0 trace · 1 story · 2 card · 3 call) */
  level: { '⭐': 2, '●': 1, '○': 0 } as Record<Mark, 0 | 1 | 2 | 3>,
  /** the omen of a ⭐ or ● event comes 1 to 3 seasons (beats) before the event is told (world-events.md §0.3: "1–3 ฤดูก่อนเกิด"); log level 1 (story) */
  omen: { on: true, min: 1, max: 3, level: 1 as const },
  /** the ending events call the player */
  endingLevel: 3 as const,
  /** the world starts with FG-01 already happened this many years before the first decade (world-events.md §0.4 rule 6: 10,388 vs 10,400) */
  startedBefore: 12,
  /** events the run skips from the sim's behaviour on purpose; empty = follow the docs */
  skipEffects: [] as string[],
};
