// Numbers the bond system needs that docs/systems/bonds/ does not state exactly (code-plan §2 rule 3: one tuning file per system).
// Every value says where it comes from. "assumption" = the docs are silent; the lead can move it into the documents later.

/** The words of the legacy `Relation` kinds and of the prayer effects (`bond lover` `bond child`) → the Thai line names (bonds/01 §1). */
export const LINE_ALIASES: Record<string, string> = {
  friend: 'สหาย', partner: 'คู่หู', lover: 'คนรัก', spouse: 'คนรัก', mentor: 'ครู', student: 'ศิษย์', elder: 'ญาติผู้ใหญ่', parent: 'ญาติผู้ใหญ่',
  junior: 'ญาติรุ่นเยาว์', child: 'ญาติรุ่นเยาว์', sibling: 'พี่น้อง', rival: 'คู่แข่ง',
};

/** Lines whose ties are never "light" family and never fade by the cap: the partner and the children (bonds/01 §2). */
export const NO_FADE_LINES: ReadonlySet<string> = new Set(['ญาติรุ่นเยาว์']);

// ---------- the pace of a life (assumptions: the docs give "one step a year" and no more) ----------

/** Years between two stages of a story. */
export const STAGE_GAP: [number, number] = [2, 4];
/** A stage that waits for the level it opens at is passed without the character after this many years of waiting (04 §2: the story walks on alone). */
export const STAGE_PATIENCE = 6;
/** B at the end of a story by its ending key (assumption: the docs say "แน่นขึ้น" `ห่างขึ้น` `สายจางหาย` without a number). */
export const ENDING_B: Record<'a' | 'b' | 'c', number> = { a: 8, b: 0, c: -15 };
/** Chance that the character helps in a crisis (stage 3), before the traits (bonds/01 §3 reads 20% to 50% for the friend line as the chance the friend helps the character; the character's own help is an assumption). */
export const HELP_BASE = 0.55;
/** What helping costs and gives (bonds/01 §2.1: crisis +8, asked +6; bn.a1: help fully +8 with gold −30 to −150). */
export const HELP = { bGain: 8, bSmall: 2, bRefuse: -3, refusedKnowsPct: 0.5, goldMin: 30, goldMax: 150 };

// ---------- who the persons are (assumptions) ----------

/** Share of persons whose nature suits the character's (03 §3 "นิสัยเข้ากัน" +10 on an invite; assumption, tuned so that a level-3 friend asked to a big fight says yes 45 to 65%). */
export const RAPPORT = 0.5;

/** Share of the persons of the character's own people when the docs say "เผ่าเดียวกัน 70%" (03 §1 row 1). */
export const SAME_RACE = 0.7;
/** A person of the same age group: hAge gap range by line (03 §2 limits: friends ≤ 25, lovers ≤ 20, students ≥ 10 younger). */
export const AGE_GAP: Record<string, [number, number]> = {
  สหาย: [-4, 4], คู่หู: [-6, 6], คนรัก: [-5, 5], ครู: [12, 30], ศิษย์: [-30, -10], คู่แข่ง: [-5, 5], ญาติผู้ใหญ่: [20, 40], ญาติรุ่นเยาว์: [-40, -20], พี่น้อง: [-8, 8],
};
/** Natural death of a person: hAge drawn around 75 (world-time.md §3), and the untimely hazard of the character system applied to every person (assumption: the same 0.4% from 15). */
export const DEATH_AGE = { mean: 75, sd: 5, min: 52, max: 92 };
export const UNTIMELY = { fromAge: 15, perYear: 0.004 };
/** Chance that a letter or a visit reaches the character in a year: same country 1, same continent, other continent (03 §4: letters at most once a year, far news late). */
export const CONTACT = { sameCountry: 0.65, sameContinent: 0.5, otherContinent: 0.3, house: 1, houseAdult: 0.6, distantKin: 0.15, lover: 0.9, partner: 0.7 };
/** A person's letters are told as a line once in this many life years (the others still count as contact). */
export const LETTER_GAP = 5;
/** Kin who share the house while the character is a child (and still see him often after). */
export const HOUSE_KIN: ReadonlySet<string> = new Set(['father', 'mother', 'elder_sibling', 'younger_sibling', 'child', 'adopted']);
export const HOUSE_UNTIL = 18;
/** Years a mood lasts: heavy moods fade slowly, light moods fast (02 §4 rule 4). */
export const MOOD_YEARS = { heavy: 3, light: 1 };
export const HEAVY_MOODS: ReadonlySet<string> = new Set(['โกรธ', 'แค้น', 'เสียใจ', 'รู้สึกผิด', 'กลัวเสีย', 'เหงา']);
/** Moods the matrix forbids on a line, with the nearest mood the doc names instead (02 §3 right column). */
export const SUBSTITUTE: Record<string, string[]> = {
  หึง: ['น้อยใจ', 'ผิดหวัง'], รัก: ['ไว้ใจ', 'เอ็นดู', 'ห่วง'], หวงแหน: ['ห่วง'], เอ็นดู: ['ชื่นชม'], อิจฉา: ['ชื่นชม', 'เคารพ'], เคารพ: ['ชื่นชม'], เกรงใจ: ['ขอบคุณ'],
};

// ---------- sources of candidates (03 §1) ----------

/** Journey lines whose nodes name NPCs (25-journeys.md): each node is 25% a candidate (03 §1 row "ระหว่างเดินทาง"). */
export const JOURNEY_LINES: ReadonlySet<string> = new Set(['sf', 'ps', 'ml', 'sc', 'ex', 'wd', 'xc']);
/** Work lines (economy lines of 24-economy.md): "30% ต่อโหนดงานที่มีผู้ร่วม" (assumption for which lines count). */
export const WORK_LINES: ReadonlySet<string> = new Set(['tr', 'cr', 'md', 'wk', 'iv']);
/** School years of 03 §1 row 3 (teacher 50%, schoolmate 40%). */
export const SCHOOL_AGE: [number, number] = [10, 24];
/** A flagship person met in the country the character lives in: chance per life year while he lives there (assumption: the docs say "ปรากฏเมื่อตัวละครโตทันช่วงชีวิตของเขา"). */
export const FLAG_MEET = 0.1;
/** The character must be at least this old to meet a flagship person on his own (the teen friends come from the nodes). */
export const FLAG_MEET_AGE = 14;
// ---------- invites (03 §3) ----------

/** The character's own taste for inviting: chance per year that he asks an eligible friend to be his lover (assumption; the docs say "ตามนิสัย"). */
export const ASK_LOVER = 0.08; // 0.05 before the lives travelled by the causes of the travel table: a lover must live in the same country (M3 wiring)
export const ASK_SPOUSE = 0.25;
export const ASK_BUSINESS = 0.04;
/** hAge a character can have a lover from (adult). */
export const LOVER_FROM = 18;
/** Years a travel party membership lasts after the invite (assumption). */
export const PARTY_YEARS = 1;
/** Chance per year that a rival of level 3 or more is accepted as a friend (01 §4 row 1, assumption). */
export const RIVAL_TO_FRIEND = 0.2;
/** Chance per year that a friend of level 3 working with the character for a year becomes a partner (01 §4 row 3, assumption). */
export const FRIEND_TO_PARTNER = 0.1;
/** Student turns friend: level 4 and a test passed (01 §4 row 5, assumption). */
export const STUDENT_TO_FRIEND = 0.15;

// ---------- family (05) ----------

/** A couple's chance of a child in a year while both are of age (assumption: the docs give no rate; the prayer `heir` waits on it). */
export const CHILD_CHANCE = 0.2;
export const CHILD_AGE: [number, number] = [18, 46];
export const MAX_CHILDREN = 4;
/** Parents' hAge at the birth of the character (05 §1 "ตามโค้ดเดิม"; assumption). */
export const PARENT_AGE: [number, number] = [22, 38];
/** A child of a prayer or a couple starts at level 3 (05 §3). */
export const CHILD_START_B = 40;
// ---------- crisis rates (07-attention.md §2: about 1.5 a life, together with the bondage escape) ----------

/** Chance that a tie of the story keeps its stage-3 crisis for the character (a card) rather than passing it quietly. */
export const CRISIS_CARD = 0.4;

// ---------- the pair of items (06) ----------

export const PAIR_ITEM_SOURCES = { childhood: 0.3, partner: 0.25, spouse: 0.4, mentor: 0.35, craft: 0.2, rival: 0.25 };

// ---------- fading ----------

/** Years of silence before a loose tie (levels 1 and 2) can fade when the cap is full (assumption). */
export const FADE_AFTER = 4;

/** Template codes grouped by role of a relative, for the close kin at 5 to 12 (05 §2; assumption which template fits which relative). */
export const KIN_TEMPLATES: Record<string, string[]> = {
  uncle: ['KN-01', 'KN-03', 'KN-04', 'KN-08'],
  aunt: ['KN-02', 'KN-03', 'KN-04', 'KN-08'],
  grand: ['KN-07'],
  elder_sibling: ['KN-05'],
  younger_sibling: ['KN-06'],
  cousin: ['KN-05', 'KN-06'],
};

/** Jobs of people who go to war or on the road: the party of travellers is asked for while the character holds one (01 §3; assumption which jobs). */
export const ADVENTURING: ReadonlySet<string> = new Set(['hero', 'adventurer', 'knight', 'mercenary', 'bounty_hunter', 'soldier', 'beast_hunter', 'explorer', 'caravan_guard', 'gladiator', 'hero_companion', 'royal_guard', 'dragonknight', 'swordsaint']);

// ---------- the children and the partner over the years (M3 review H6 H7; 05 §3) ----------

type Stage = 'infant' | 'child' | 'youth' | 'adult';
/**
 * Stages of a child by his own age, as shares of the age his race becomes an adult at (races `adultAge`, in life years; 20 for most): a baby until about
 * the sixth of it, a child of the house until 7/10, a young person until grown. The table of 05 §3 (0–5 · 6–14 · 15–25) reads the same for a human but kept a
 * person of 22 a "young person" and a child of 4 a baby (M3 round-two review N11).
 */
export const CHILD_STAGES = { infant: 0.15, child: 0.7 };
/** The adult age in life years when the race gives none. */
export const ADULT_LIFE_AGE = 20;
/**
 * The feeling the character shows toward a child by the stage (05 §3 column "ตัวละครหลักแสดงได้"); `far` are added for a child who lives
 * away, `farOnly` are shown only then (น้อยใจ is the doc's own for the 6–14 "ถ้าลูกห่างตัวละคร"). The chance and the gap are assumptions
 * (the doc gives none): a child is told about once in a few years, not every year.
 */
export const CHILD_FEELS = {
  gapYears: 3,
  chance: 0.4,
  /** The same feeling toward the same child in the same stage is not told again for this many years (582 told "ภูมิใจ" about one child six times). */
  repeatYears: 10,
  byStage: {
    infant: ['เอ็นดู', 'ห่วง', 'หวงแหน'],
    child: ['เอ็นดู', 'ห่วง', 'ภูมิใจ', 'น้อยใจ'],
    youth: ['ภูมิใจ', 'ผิดหวัง', 'ละอาย', 'กลัวเสีย'],
    adult: ['ภูมิใจ', 'ห่วง', 'คิดถึง', 'เหงา'],
  } as Record<Stage, string[]>,
  far: { infant: [], child: ['น้อยใจ'], youth: ['คิดถึง'], adult: ['คิดถึง', 'เหงา'] } as Record<Stage, string[]>,
  farOnly: ['น้อยใจ'],
};
/** The words of a child reaching a stage, for the line of the log (the stage itself is in the data: the text system may tell it in its own words). */
export const GROW_TEXT: Record<Stage, string> = { infant: 'ยังเป็นทารก', child: 'โตเป็นเด็กวัยเรียน', youth: 'โตเป็นหนุ่มสาว', adult: 'เป็นผู้ใหญ่เต็มตัวแล้ว' };
/** A child's own marriage: the ages he may marry at and the chance per year (assumption: the docs only say "ลูกเลือกทางเอง"). */
export const CHILD_WED = { ages: [20, 34] as [number, number], chance: 0.1 };
/** The partner is told again: years since the last feeling toward him, the chance per year after that, and the feelings (02 §3 the lover line; assumption). */
export const PARTNER_FEELS = {
  gapYears: 6,
  chance: 0.35,
  near: ['ไว้ใจ', 'ห่วง', 'รัก'],
  close: ['รัก', 'ไว้ใจ', 'ขอบคุณ'],
  far: ['คิดถึง', 'ห่วง', 'เหงา'],
};

// ---------- the crisis of a tie, announced before it is decided (M3 review H5) ----------

/** Beats the character waits for the player before he answers a crisis the player was called for: the card runs two life years (attention DEFAULT_DEADLINES.crisis, 07-attention.md §3), a beat is a quarter. */
export const CRISIS_MAX_BEATS = 8;
/** What the god's hand adds to (or takes from) the chance the character helps: a whisper `ช่วย` · a dream of the one in trouble · a whisper that he lies (assumption; the chance is held between 0.1 and 0.95). */
export const NUDGE = { whisper: 0.2, dream: 0.3, liar: -0.25 };
/** Life years a nudge waits for the crisis it was meant for. */
export const NUDGE_YEARS = 2;
