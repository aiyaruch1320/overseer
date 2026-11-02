// Numbers of the LLM layer. Each says where it comes from (code-plan §2 rule 3: one tuning file per system).
// docs/systems/llm/*.md and docs/systems/god/05-llm.md are the source; "assumption" marks a value no document states.

/** The three points where the game may call an LLM (llm/README.md §2) and the key of each switch in `Settings.llm`. */
export const POINTS = ['command', 'director', 'ending'] as const;
export type LlmPoint = (typeof POINTS)[number];

/** Settings switch of each point: `command` is the doc's `setup` (สั่งตัวละคร), `ending` is `epitaph` (llm/README.md §3). */
export const SWITCH_OF: Record<LlmPoint, 'setup' | 'director' | 'epitaph'> = { command: 'setup', director: 'director', ending: 'epitaph' };

/** Version of the prompts and answer shapes: part of the cache key, bump it when a prompt or a shape changes (god/05-llm.md §5 "แคชตรงตัว"). */
export const PROMPT_VERSION = 1;
export const LANG = 'th';

/** Models by task. The docs chose DeepSeek V4.1 Flash (llm/README.md §1); the lead asked for Claude ids, so these are names in config, not facts of the docs. */
export const MODEL = { light: 'claude-sonnet-5-5', heavy: 'claude-opus-5-5' } as const;
/** Every point is a light task (a choice from a list, a paragraph): no document asks for the heavy model. */
export const MODEL_OF: Record<LlmPoint, string> = { command: MODEL.light, director: MODEL.light, ending: MODEL.light };

/** Longest request time before the call is dropped and tier 0 is used (llm/02-offline.md §5: 15 s). */
export const TIMEOUT_MS = 15_000;
/** Circuit breaker: three failures in a row stop the calls for ten minutes, then one trial call (llm/02-offline.md §5). */
export const BREAKER = { fails: 3, pauseMs: 10 * 60_000 };
/** A bad answer is asked for once more, then tier 0 (llm/02-offline.md §5 "คำตอบเสีย"). */
export const RETRIES = 1;

/** Soft budget of tokens (in + out, cache hits count too) a life may spend; over it, calls go to tier 0 (god/05-llm.md §5 "งบอ่อน"). Assumption: 12 calls of about 1.3k tokens each is 16k; 40k leaves room. */
export const LIFE_TOKEN_BUDGET = 40_000;

/** Output ceilings per point, in tokens (god/05-llm.md §5 "ตัดความยาว"; live test 08 §2: command 185, director 48, epitaph 210). */
export const MAX_TOKENS: Record<LlmPoint, number> = { command: 300, director: 150, ending: 700 };

/** The words of the player sent to the translator are cut here (llm/README.md §5 rule 3). */
export const WORDS_MAX = 300;

/** Director (llm/04-story.md §3.4): the chosen way ×1.5, the two layers together at most ×2.5, at most 10 points a life. */
export const DIRECTOR = { mul: 1.5, totalCap: 2.5, perLife: 10 };
/** The reasons the director may give, one code (llm/04-story.md §3.1 rule 3). */
export const DIRECTOR_REASONS = ['old_face', 'dream', 'life_question', 'vow', 'rest', 'tension'] as const;
export type DirectorReason = (typeof DIRECTOR_REASONS)[number];
/** The key points the docs name (llm/04-story.md §3.4 "ใช้ที่ไหน"). */
export const DIRECTOR_KINDS = ['npc_death', 'heart', 'quiet', 'repeat_meet'] as const;
export type DirectorKind = (typeof DIRECTOR_KINDS)[number];

/** Summary of the ending (llm/04-story.md §2: three to five short paragraphs). Characters, assumption from the live test (about 460 characters on average). */
export const SUMMARY = { min: 60, max: 1200, paragraphs: 5 };

/** Share of letters that must be Thai (god/05-llm.md §7 "เป็นอักษรไทยเป็นหลัก"). */
export const THAI_SHARE = 0.9;
