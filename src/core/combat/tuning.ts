// Numbers the combat system needs that no document states exactly (code-plan §2 rule 3: one tuning file per system).
// What the docs do state as tables (stances, the weakness matrix, tiers, rolls, damage, wound table, rewards, encounter flags and job
// multipliers, mass battle roles) is read from data/gen/combat.json and enemies.json and clashes.json, not repeated here.
// Each value says where it comes from; "assumption" means the docs are silent and the value can change without a doc change.

/** Seed streams (code-plan §6.2). Their names start with the system. */
export const STREAM = { fight: 'life.combat', encounter: 'life.combat.enc', loot: 'life.combat.loot', clash: 'life.combat.clash' } as const;

// ---------- hit points (01-core.md §1 "ฐาน": legacy/sim/character.ts maxHp, game.ts regen) ----------

/** Maximum hit points: 40 + vit × 4 (the base code), plus `hp+n` of gifts (character ext hpBonus). */
export const HP = { base: 40, perVit: 4, regenPerBeat: 3, regenTag: 6, floor: 10 };
/** A hero at or below this share of maximum hit points yields: the fight is lost (01-core.md §7 "แพ้: hp เหลือน้อย"; assumption for the share). */
export const YIELD_AT = 0.2;

// ---------- how hard a fight is (M3 review C1) ----------

/**
 * Added to the DC of a foe by its tier id (assumption). The DC column of 03-enemies.md was written for one roll a fight; with 2 to 8 beats, a
 * reroll and the stat and skill bonuses of a grown hero the same DC gave a hero who lost 1% of 1,460 fights (M3 review C1: lose 1% draw 40%).
 * The shift is read by every stance (stance.ts `dcOf`), so the talk, the calm and the flight get harder with it by the same amount.
 */
export const TIER_DC_SHIFT: Record<string, number> = { grunt: 0, normal: 2, veteran: 2, chief: 2, elite: 2, boss: 2, legend: 0 };
/**
 * The damage of a lost beat is DC × 2.4 ÷ the most beats (01-core.md §5) times this (assumption). The doc keeps "the damage of the whole fight
 * near the old code" (one failed roll took DC × 2.4); a hero of 80 hit points who meets that once a fight never reaches the yield line, which is why
 * only bosses ever beat him. With the factor a fight of three failed beats against a chief costs most of his hit points.
 */
export const DAMAGE_SCALE = 1.35;
/**
 * Chance that a lost fight ends in death, by the tier id of the foe, and the factor when the blow took the hero to zero (assumption). The doc lets
 * the hero die at zero hit points (01-core.md §7 "ตาย") but a hero at 20% who is struck again almost never reached zero, so no fight killed (M3
 * review C1 target: about 2.5% of lives end in battle, the ways of the story that say so included). A hero beaten by a boss may still be left alive.
 */
export const DEATH_ON_LOSS: Record<string, number> = { grunt: 0, normal: 0.0007, veteran: 0.0013, chief: 0.004, elite: 0.007, boss: 0.013, legend: 0.04 };
export const DEATH_AT_ZERO_MUL = 3;
/** … and ×this again when the hero began the fight at or under the yield line (he fought on while hurt; assumption). */
export const DEATH_LOW_START_MUL = 3;
/**
 * A fight that ran out of beats with the foe one wound from falling goes on for one more beat (assumption). The doc ends it as a draw ("เสมอ ครบจังหวะสูงสุด"),
 * which with 2 wounds in 3 beats made 4 fights in 10 draws in the M3 review; a draw should be a stand-off, not a fight left one blow short.
 */
export const OVERTIME = { maxLeft: 1, beats: 1 };
/** hp below this share: −2 to the roll, flee ×2 (01-core.md §4 and §6; the data rows say 30%). */
export const LOW_HP = 0.3;
/** Hit points a last-stand rescue leaves (legacy: `b_laststand` hp 10), `rewind` (half), `guardian_angel` (15, 50%). */
export const RESCUE = { lastStand: 10, rewindShare: 0.5, angel: 15, angelChance: 0.5 };
/** After a fight that ended lost the hero is carried away with at least this share of hp (assumption; keeps a lost fight from being a death on its own). */
export const AFTER_LOSS_HP = 0.1;

// ---------- tiers the damage table has no row for (03-enemies.md §ค: NPC levels "ทหารผ่านศึก" "ยอดฝีมือ") ----------

/** Wounds and most beats of the NPC levels between the tiers of 01-core.md §2 (assumption). */
export const EXTRA_TIERS: Record<string, { id: string; wounds: number; maxBeats: number; rewardRow: string }> = {
  ทหารผ่านศึก: { id: 'veteran', wounds: 3, maxBeats: 4, rewardRow: 'chief' },
  ยอดฝีมือ: { id: 'elite', wounds: 4, maxBeats: 5, rewardRow: 'boss' },
};

/** Tier names of 01-core.md §2 and their ids in combat.json. */
export const TIER_ID: Record<string, string> = { ลูกกระจ๊อก: 'grunt', ปกติ: 'normal', หัวหน้า: 'chief', บอส: 'boss', ตำนาน: 'legend', ทหารผ่านศึก: 'veteran', ยอดฝีมือ: 'elite' };

/** A group of several enemies: DC + 1 per this many enemies (01-core.md §4 "ฝูง +1 ต่อศัตรูเพิ่มทุก 2 ตัว สูงสุด +5"). */
export const GROUP = { dcPerTwo: 1, dcCap: 5, maxWounds: 8, together: 2 };

// ---------- the roll (01-core.md §4) ----------

/** The 'DC' of an escape is the enemy's DC less this (assumption: the docs give a roll "เร็ว" and no number). */
export const FLEE_EASE = 3;
/** Talking down and calming are rolled at the DC less this (assumption). */
export const TALK_EASE = 2;
/** `ยาก` negotiations of the enemy table (enemies.json `negotiable`). */
export const HARD_TALK = -2;
/** A prayer that works gives +2 for the beats that remain (01-core.md §8 "ตอบคำอธิษฐาน: โบนัส +2 จังหวะที่เหลือ"); the character prays from this belief. */
export const PRAY = { minFaith: 20, bonus: 2, heal: 0.1 };
/** Evade: a good dodge spares the hero the blow and gives +2 for the next beat (assumption; the docs name the stance and the stat only). */
export const EVADE = { nextBonus: 2, cap: 4 };
/** Guard: damage ×0.5 and the foe loses a wound only when the roll is this or more (01-core.md §3). */
export const GUARD = { woundRoll: 18, damageMul: 0.5 };
/** Perception: the roll against this DC (the enemy's stealth; assumption, the doc names no number). */
export const PERCEIVE_DC = 10;
/** Damage multipliers by what protects the hero (01-core.md §5). */
/** A weapon that parries (items README §3 `ปัด`): −20% of the damage of a lost beat. */
export const PARRY = 0.8;
export const DAMAGE_MUL = { guardTag: 0.8, tough: 0.87, resistTag: 0.5, weakTag: 1.5, huge: 1.3 };
/** Companion `pa_thick_hide` by level 1..3; `pa_life_share` takes this share of one blow by level (assumption: "ตามระดับ"). */
export const THICK_HIDE = [1, 0.95, 0.9, 0.85];
export const LIFE_SHARE = [0, 0.4, 0.7, 1];
/** The abilities of a companion that add to the roll (01-core.md §4: one a beat, +1 +2 +3 by level). */
export const COMPANION_ASSIST = ['pa_bite_assist', 'pa_flank', 'pa_claw_dive', 'pa_intimidate', 'pa_breath_fire', 'pa_breath_frost', 'pa_venom_bite', 'pa_shock_touch'];
/** The attack tag a companion ability adds to a melee beat (02-type-matrix.md §1 "สัตว์คู่หู"). */
export const COMPANION_TAG: Record<string, string> = { pa_breath_fire: 'fire', pa_breath_frost: 'ice', pa_shock_touch: 'lightning', pa_venom_bite: 'poison' };

/** Tags of the hero that guard against an element of the enemy's attack (damage ×0.5) and that make it worse (×1.5); 01-core.md §5. */
export const RESIST_TAG: Record<string, string> = { fire_res: 'fire', heat_res: 'fire', cold_res: 'ice', poison_res: 'poison' };
export const WEAK_TAG: Record<string, string> = { weak_fire: 'fire', weak_ice: 'ice', weak_light: 'light', weak_poison: 'poison', weak_silver: 'silver', weak_iron: 'iron' };
/** Tags that turn into a kill mark (★) against one kind whatever the weapon (02-type-matrix.md §1 "แท็กสังหาร"). */
export const BANE_TAG: Record<string, string> = { undead_bane: 'undead', demon_bane: 'demon', dragon_bane: 'dragon' };

/** Tags of the character that tame or calm (01-core.md §3), the aptitudes that count, and the kinds that can be calmed. */
export const CALM = { tags: ['beast_friend', 'beast', 'polyglot'], aptitudes: ['taming', 'husbandry'], kinds: ['beast', 'sea', 'plant'] };
/** Kinds that can think and so can be talked with (01-core.md §3 "มนุษย์ เผ่าต่าง ๆ ปีศาจ มังกร"); ghosts and the rest talk only when a row says so. */
export const THINKING = ['humanoid', 'demon', 'dragon', 'giant', 'fey', 'elemental_storm'];
/** A negotiation with a dragon needs one of these (06-dragon-encounters.md §1). */
export const DRAGON_TONGUE = ['polyglot', 'dragon_voice'];
/** Tags that show the hero a weakness before the first blow (01-core.md §6 "รู้จุดอ่อน"); `u_appraisal` is a skill. */
export const SEER_TAGS = ['seer', 'truth', 'oracle'];
export const SEER_SKILLS = ['u_appraisal'];

// ---------- choosing a stance (01-core.md §6) ----------

/** Base weight of each stance before the hero's nature (assumption: "ใช้น้ำหนักนิสัยเดิม" has no table in the data). */
export const STANCE_WEIGHT: Record<string, number> = { melee: 3, ranged: 2.5, magic: 2.5, guard: 0.9, negotiate: 0.8, calm_beast: 1.2, evade: 0.7, pray: 0.5, flee: 0.25 };
/** How much the roll bonus of a stance tilts the choice: weight × exp(this × bonus). */
export const CHOICE_SLOPE = 0.1;
/** The traits and tags the rules of §6 name. */
export const REASON = {
  fearless: ['reckless', 'bloodlust'],
  fearlessTag: ['berserk'],
  cowardTrait: ['coward'],
  cowardCurse: ['c_rabbitheart'],
  gentleTrait: ['kind'],
  gentleTag: ['peace'],
  holyJobs: ['priest', 'exorcist', 'inquisitor', 'gravekeeper', 'saint'],
  tameJobs: ['beast_tamer', 'druid', 'tamer'],
};
export const MUL = { lowHpFlee: 2, cowardFirstFlee: 3, gentleTalk: 2, knownWeak: 3, protectFlee: 0.3, protectGuard: 2, holyUndead: 2, tameBeast: 3, dream: 3 };
/** The axis of the character (−100..100) tilts the stances a little (assumption). */
export const AXIS_TILT = { braveFight: 0.5, braveFlee: 0.7, kindTalk: 1, temperMelee: 0.3 };

// ---------- wounds and the fall (01-core.md §5, §7) ----------

/** The d100 table of 01-core.md §5 is read from combat.json (`damage.wounds`). Which curse an injury leaves, by the kind of blow (assumption: "สุ่มตามชนิดการโจมตี"). */
export const INJURY_CURSE: Record<string, string[]> = {
  blade: ['c_limp', 'c_oneeye'],
  pierce: ['c_oneeye', 'c_limp'],
  blunt: ['c_glassjaw', 'nc_bad_back'],
  default: ['c_limp', 'c_oneeye', 'c_glassjaw', 'nc_bad_back'],
};
/** Extra curse chances (01-core.md §5 last paragraph: assumption for the numbers). */
export const EXTRA_CURSE = { poison: ['c_fever', 0.2], undead: ['c_undeadtouch', 0.15], vampire: ['c_vampbite', 0.25] } as const;
/** A scar with a story: fame +2 (01-core.md §5); a long injury takes 10 from maximum hit points for one life year. */
export const SCAR_FAME = 2;
export const LONG_INJURY = { hp: 10, years: 1 };
/** Mass battles and lost raids double the chance of the curse rows (04-encounters.md §7). */
export const MASS_CURSE_MUL = 2;
/** After a lost fight: the hero is taken prisoner with this chance in a mass battle (04-encounters.md §7: 5%); elsewhere nothing. */
export const CAPTURE = { mass: 0.05 };

// ---------- rewards (05-rewards.md) ----------

/** Gold and fame of a win by tier: the loot of the base code scaled by tier (legacy MONSTERS: wolf gold+5, troll gold+30 fame+5, firedragon gold+300 fame+50). */
export const LOOT: Record<string, { gold: number; fame: number }> = {
  grunt: { gold: 3, fame: 0 },
  normal: { gold: 8, fame: 1 },
  veteran: { gold: 18, fame: 3 },
  chief: { gold: 25, fame: 5 },
  elite: { gold: 45, fame: 10 },
  boss: { gold: 100, fame: 20 },
  legend: { gold: 300, fame: 50 },
};
/** A flawless win: fame +50% and the story thread; every slot of the reward table ×1.5 except the curse (01-core.md §7, 05 §2). */
export const FLAWLESS = { fame: 1.5, slots: 1.5 };
/** Rarity shifts of the reward by tier (05-rewards.md §2): chief R ×2 · boss E ×3 · legend L ×5. Weapons stop at E. */
export const RARITY_SHIFT: Record<string, Record<string, number>> = { chief: { R: 2 }, veteran: { R: 2 }, elite: { R: 2, E: 3 }, boss: { E: 3 }, legend: { L: 5, E: 3 } };
export const WEAPON_MAX_RARITY = 'E';
/** Weight of the gifts the kind of enemy names over the general pool (05 §5 "น้ำหนัก ×4"): share of draws that take from the kind's list. */
export const KIND_GIFT_SHARE = 0.8;
/** Chance that calming a beast brings a companion of its kind, by rarity of the species (05 §6 "ตามระดับความหายาก": assumption). */
export const TAME_COMPANION = { C: 0.3, U: 0.15, R: 0.06, E: 0.02, L: 0.005 } as Record<string, number>;
/** Karma and fame of the quiet wins (05 §6); `kind` axis +5 for sparing. */
export const QUIET = { talk: { fame: 3, karma: 2 }, calm: { karma: 2 }, spare: { kind: 5 }, banish: { chance: 0.1 } };
/** Material by kind of enemy when the enemy has none of its own in materials.json (05 §3). */
export const MATERIAL_BY_KIND: Record<string, string[]> = {
  beast: ['mt_hide', 'mt_fang', 'mt_fur'],
  undead: ['mt_cursed_bone', 'mt_corpse_dust'],
  spirit: ['mt_soul_crystal'],
  demon: ['mt_demon_horn', 'mt_demon_blood'],
  dragon: ['mt_wyrm_scale', 'mt_dragon_fang'],
  giant: ['mt_giant_bone'],
  construct: ['mt_rune_core', 'mt_gear_part'],
  fey: ['mt_fae_dust'],
  plant: ['mt_sap', 'mt_spore'],
  amorphous: ['mt_slime_gel'],
  fog: ['mt_fog_ink'],
  elemental: ['mt_element_core'],
  sea: ['mt_pearl', 'mt_sea_tentacle'],
};
/** Weapons dropped by kind: the share that is holy or cursed and the element wanted (05 §4). */
export const WEAPON_DROP: Record<string, { tags: string[]; share: number }> = {
  undead: { tags: ['dark', 'necro'], share: 0.7 },
  spirit: { tags: ['dark', 'necro'], share: 0.7 },
  demon: { tags: ['fire', 'dark', 'infernal'], share: 0.8 },
  elemental: { tags: ['holy', 'light', 'fire', 'water', 'ice', 'lightning', 'earth', 'wind'], share: 0.5 },
  dragon: { tags: ['holy', 'fire', 'ice'], share: 0.6 },
};
/** Weapons a reward may be (groups of weapons.json that drops stand for: the standard, material and forged ones). */
export const WEAPON_GROUPS = ['standard', 'material', 'forge', 'continent'];
export const RARITY_WEIGHT: Record<string, number> = { C: 100, U: 38, R: 11, E: 2.6, L: 0.5 };
/** Titles (05 §7): the count of wins that earns one and the key it is counted by (`kind:<k>` a kind, `duel`, `calm`, `raid`, `npc`). */
export const TITLES: { id: string; key: string; n: number; fame: number; grant?: string }[] = [
  { id: 'ผู้ส่งวิญญาณ', key: 'kind:undead|spirit', n: 10, fame: 5 },
  { id: 'ผู้ปราบมาร', key: 'kind:demon', n: 10, fame: 8 },
  { id: 'นักล่ามังกร', key: 'wild_dragon', n: 3, fame: 15 },
  { id: 'ผู้พิทักษ์', key: 'raid', n: 3, fame: 8 },
  { id: 'นักดาบไร้พ่าย', key: 'duel', n: 5, fame: 8 },
  { id: 'เพื่อนแห่งพงไพร', key: 'calm', n: 5, fame: 5 },
  { id: 'ฆาตกรที่ทุกคนรู้จัก', key: 'npc_named', n: 3, fame: 0, grant: 'c_infamous' },
];
/** Wild dragons of the code roster (06-dragon-encounters.md §1). */
export const WILD_DRAGONS: ReadonlySet<string> = new Set(['firedragon', 'icedragon', 'wyvern', 'ash_drake', 'scale_wyrmling']);
/** Killing a named NPC: the curse of 05 §5 (`c_wanted`), chance (assumption). */
export const KILL_NPC_CURSE = { id: 'c_wanted', chance: 0.4 };

// ---------- how often a fight comes (04-encounters.md §1) ----------

/** The base rate, the luck factor and the caps are read from combat.json (`encounters`). A country's danger 1..5: assumption (the base code kept it per country; countries.json has none). */
export const DANGER_BY_CONTINENT: Record<string, number> = { AZ: 2, MH: 4, KD: 3, NR: 2, AL: 3, MK: 3, SH: 4, SV: 3, NB: 4 };
/** Danger −1 in a country of this wealth (economy w) or more, +1 when its wealth is 1 (assumption). */
export const WEALTH_SAFE = 4;
/** Product of the world multipliers is held under this (assumption: war 1.8 × famine 1.4 × plague 1.5 would be 3.8). */
export const WORLD_MUL_CAP = 3;
/** A world event keeps the enemies it brings for this many world years (assumption; the doc says "ธงโลก"). */
export const EVENT_ACTIVE_YEARS = 60;
/** The youngest age that meets a fight, and below which only the weakest meet (legacy: `c.hAge >= 13 || m.dc <= 11`). */
export const FIGHT_AGE = 5;
export const ADULT_FIGHT_AGE = 13;
export const CHILD_MAX_DC = 11;
/** Weight of an enemy by DC for the random draw (legacy `monsterEvent`: dc > 18 → 0.4, dc ≤ 12 → 1.5); bosses of the random pool weigh less (assumption). */
export const PICK = { highDc: 18, highMul: 0.4, lowDc: 12, lowMul: 1.5, boss: 0.5, flagMul: 3, jobMul: 2, eventLinked: 3 };
/** A random fight in a town (not on the road) can be a raid when the enemy is one of the raiders (04 §2 "บุกหมู่บ้าน"; assumption for the share). */
export const RAIDERS: ReadonlySet<string> = new Set(['wolf', 'ash_wolf_pack', 'shadow_pack', 'goblin', 'ghoul_horde', 'bandits', 'locust_swarm', 'drowned_dead', 'fog_tentacle', 'sand_raiders']);
export const RAID_SHARE = 0.5;
/** Night: the share of road fights that come at night (assumption). */
export const NIGHT_SHARE = 0.3;
/** Jobs that are always soldiers for the war roll (04 §7) and the jobs whose cap is 8 a year (04 §1). */
export const SOLDIER_JOBS: ReadonlySet<string> = new Set(['soldier', 'knight', 'mercenary', 'city_guard', 'royal_guard', 'adventurer']);
/** Jobs that hunt: they take the first beat (04 §2 "ล่า"). */
export const HUNTER_JOBS: ReadonlySet<string> = new Set(['beast_hunter', 'bounty_hunter', 'hunter', 'adventurer', 'explorer']);
/** A war flag for the mass battle (04 §7): the chance per beat that a soldier of a country at war stands in a big battle (assumption). */
export const WAR_BATTLE_PER_YEAR = 0.5;

// ---------- the call before a named fight (attention, 07-attention.md §2) ----------

/** A fight with a name (story row, NPC, boss) waits this many beats after the `combat/prelude` entry so the god can whisper or dream first (07-attention.md §3: the card waits up to a life year = 4 beats). */
export const PRELUDE_BEATS = 2;

// ---------- a duel that does not kill (04 §2 "ดวล") ----------
export const DUEL_STYLE = /ยอมแพ้/;

// ---------- clash keys (07-npc-clashes.md §3.1 "กุญแจเจรจา") ----------
/** The chance that the hero holds the key of a parenthesised talk outcome when the caller does not say (assumption: the keys are deeds in the story). */
export const TALK_KEY_CHANCE = 0.4;
/** The chance that a win ends with the NPC spared when the row has both (07 §3 "ชนะ (ไว้ชีวิต)"): base plus the kind axis (assumption). */
export const SPARE = { base: 0.3, perKind: 0.3 };
/** A clash between the same pair: DC + 1 the second time and −1 to the first perception (07 §3.1); at most 2 per life. */
export const CLASH_MAX_PER_LIFE = 2;

/** City jobs: ×0.6 (04-encounters.md §4 "อาชีพในเมือง (scribe librarian accountant ฯลฯ)": the three the doc names plus the clerks of the job list; assumption for the rest). */
export const URBAN_JOBS: ReadonlySet<string> = new Set(['scribe', 'librarian', 'accountant', 'clerk', 'banker', 'notary']);
/** Slow lives ×0.4 (04 §4 "ชีวิตช้า (14 อาชีพ)"): the jobs file marks them `slow`; a raid still finds them. */
export const SLOW_MUL = 0.4;
export const URBAN_MUL = 0.6;
/** Raid (04-encounters.md §5): the townsfolk fighting beside the hero, and the warning roll (−2 DC when it passes). */
export const RAID = { allies: 2, warned: -2, fameAll: 8, fameLoss: 4, orphanAge: 13, infamy: 0.3 };
/** A raid is "all saved" when the hero lost less than this share of his hit points. */
export const RAID_CLEAN = 0.25;
/** The mass battle of a war (04 §7): the damage of a lost roll is DC × this share of the whole fight's damage (assumption). */
export const WAR_DAMAGE = 0.25;

// ---------- the war of a soldier (M3 review C2) ----------

/**
 * Who the soldiers of a war meet: the foes (ids of enemies.json) by the war event (WR-xx of world-events) and the continent the hero stands on
 * (`*` = any). The docs name the pairs of a war ("ปีศาจ × ทุ่งราบ", "ภายในพงไพร") and the enemies of the war flag (04-encounters.md §3: npc_deserter
 * npc_mercenary bandits trench_deserters gas_ghoul); which enemy stands on which side is an assumption.
 */
export const WAR_FOES: Record<string, Record<string, string[]>> = {
  'WR-02': { AZ: ['titan_shard', 'sand_raiders'], SH: ['storm_harpy', 'griffon'], '*': ['titan_shard', 'storm_harpy'] },
  'WR-03': { MH: ['npc_knight', 'trench_deserters', 'npc_inquisitor'], AL: ['npc_demon_champion', 'ghoul_horde', 'ash_wolf_pack'], '*': ['npc_mercenary'] },
  'WR-07': { MH: ['reef_serpent', 'drowned_dead', 'ghost_crew'], NR: ['npc_pirate', 'ghoul_horde'], '*': ['npc_pirate'] },
  'WR-10': { SH: ['sand_raiders', 'dust_djinn'], '*': ['sand_raiders'] },
  'WR-13': { AL: ['npc_inquisitor', 'npc_knight', 'trench_deserters'], '*': ['npc_inquisitor'] },
  'WR-17': { SV: ['blighted_ent', 'shadow_pack', 'spore_thrall'], '*': ['blighted_ent'] },
  'WR-18': { AZ: ['storm_harpy', 'cloud_serpent', 'scale_wyrmling'], '*': ['storm_harpy'] },
  'WR-19': { MH: ['ghost_legion', 'npc_demon_champion', 'ghoul_horde'], '*': ['ghost_legion'] },
  'WR-20': { NR: ['reef_serpent', 'npc_pirate', 'siren'], '*': ['reef_serpent'] },
};
/** A war the table above does not name (a flag of war put on a country by another event): the soldiers of the continent meet these (assumption). */
export const WAR_FOES_BY_CONTINENT: Record<string, string[]> = {
  AL: ['trench_deserters', 'npc_knight', 'gas_ghoul'], MH: ['npc_mercenary', 'ghoul_horde'], MK: ['war_automaton', 'npc_mercenary'], SH: ['sand_raiders'],
  KD: ['npc_mercenary', 'magma_salamander'], NR: ['npc_pirate'], SV: ['shadow_pack'], AZ: ['storm_harpy'], NB: ['npc_assassin'],
};
export const WAR_FOE_DEFAULT = 'npc_mercenary';
/** The roll of a battle against a foe is harder by its tier (DC added to the role's DC; assumption). */
export const FOE_DC_SHIFT: Record<string, number> = { grunt: -1, normal: 0, veteran: 1, chief: 2, elite: 2, boss: 3, legend: 4 };
/** A roll this far over the DC wins the battle outright (the foe broken, not only held); a natural 20 does too (assumption). */
export const WAR_DECISIVE = 8;
/** Ranks of the army, lowest first, and the points to reach the next (a held battle is 1 point, a won one 2; assumption: the docs name no rank). */
export const RANKS = ['recruit', 'soldier', 'corporal', 'sergeant', 'captain'] as const;
export const RANK_POINTS = [3, 4, 5, 6];
/** The rank a soldier starts at by his job (assumption); the commander of 04 §7 is a captain at least. */
export const RANK_START: Record<string, number> = { knight: 2, royal_guard: 1, city_guard: 1, general: 4, commander: 4, captain: 4 };
/** Share of the spoils paid for a battle by rank, in gold (assumption: 04-income-and-living.md §1 says "ส่วนแบ่งศึก" without a sum); a won battle pays double, a lost one nothing. */
export const WAR_PAY = { byRank: [2, 3, 5, 8, 14], won: 2, lost: 0 };
/** The best-paying places (04 §1 "MK-16 MH-09 จ่ายดีที่สุด") pay the share × this (the economy's MERC_BEST). */
export const WAR_PAY_BEST = { countries: ['MK-16', 'MH-09'], mul: 1.3 };
/** A summary of the campaign is written every this many life years of war, and when the war ends (assumption). */
export const CAMPAIGN_YEARS = 3;
/** A lost battle of the war kills the hero with this chance when he is at or below this share of his hit points (the rest of the dead go through `DEATH_ON_LOSS`; assumption). */
export const WAR_DEATH = { chance: 0.04, hpShare: 0.4 };

/** A hero with the curse `c_wanted` is hunted by a bounty hunter (04-encounters.md §6: 20% a year, `npc_mercenary`); the hunter lies in wait. */
export const WANTED = { curse: 'c_wanted', perYear: 0.2, enemy: 'npc_mercenary' };
