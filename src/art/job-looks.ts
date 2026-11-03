// What each of the 157 jobs wears and holds (code-plan §9.2 row "ตัวละครหลัก": the Look follows the life, and the job is the first thing that changes it).
// The table is the vocabulary between data/gen/jobs.json and the part ids of src/art/parts/ids.ts: outfit, hat, the tool of the hand and, where the
// job has a look of its own, the hair. The colours are not here: they are the `สีชุด` of the job's weapon set in docs/appearance/10-job-weapons.md
// (data/gen/weapons.json `jobSets[].ui.colors`), which main-look.ts reads. The tool is the job's C-tier weapon or tool (the same file), as the closest
// part the tables draw; a held weapon of the life (items) takes its place in main-look.ts. '' = none.
//
// Palette and silhouette sources, by group (the docs say little of clothes by job, so each choice names the doc line it follows):
//   - docs/appearance/poc-visuals/README.md "แนวภาพ" (สี): noble = dark jewel and gold · priest = cream and gold · soldier = iron and house colour ·
//     mage = indigo and violet; docs/appearance/02-races.md §1 human: "แต่งตามถิ่นและอาชีพ"
//   - docs/appearance/10-job-weapons.md: the C weapon of each job set (tool) and the set's two colours
//   - docs/systems/character/09-jobs-common.md, 10-jobs-secret.md, 11-jobs-special.md: what the job does (apron for work at a bench, goggles for
//     glass, fire or machines, a veil for bees or the blessed, a lantern for the night watch ...)

export interface JobLook {
  outfit: string;
  hat?: string;
  tool?: string;
  hair?: string;
}

const J = (outfit: string, hat = '', tool = '', hair?: string): JobLook => ({ outfit, hat, tool, ...(hair ? { hair } : {}) });

export const JOB_LOOKS: Record<string, JobLook> = {
  // ── เดิมในโค้ด (09-jobs-common.md, 39 jobs) ──────────────────────────────────────────────────────────────────────────────────────────────────
  farmer: J('tunic', 'straw', 'hoe'),
  hunter: J('leather', 'hood', 'bow'),
  soldier: J('armor', 'helmet', 'sword'),
  adventurer: J('leather', '', 'sword'),
  merchant: J('cloak', 'cap', 'ledger'),
  mage: J('robe', 'wizard', 'wand'),
  priest: J('priest', '', 'staff'),
  thief: J('cloak', 'hood', 'dagger'),
  smith: J('apron', '', 'hammer'),
  scholar: J('scholar', '', 'book'),
  bard: J('light', 'feather', 'lute'),
  fisher: J('light', 'straw', 'trident'),
  healer: J('apron', 'cap', 'flask'),
  knight: J('knight', 'helmet', 'sword'),
  assassin: J('cloak', 'cowl', 'dagger'),
  druid: J('cloak', 'laurel', 'staff'),
  pirate: J('sailor', 'bandana', 'sword'),
  cook: J('apron', 'chef', 'ladle'),
  warlock: J('robe', 'cowl', 'book'),
  tamer: J('leather', 'cap', 'rod'),
  noble: J('noble', 'feather', 'sword'),
  monk: J('robe', '', 'staff', 'bald'),
  scribe: J('scholar', 'cap', 'scroll'),
  shepherd: J('tunic', 'straw', 'crook'),
  carpenter: J('apron', 'cap', 'hammer'),
  weaver: J('light', 'bandana', ''),
  servant: J('light', '', 'bowl'),
  performer: J('light', 'feather', 'sword'),
  teacher: J('scholar', '', 'rod'),
  seer: J('robe', 'veil', 'orbstaff'),
  archaeologist: J('leather', 'wide', 'shovel'),
  spy: J('cloak', 'hood', 'dagger'),
  diplomat: J('scholar', '', 'cane'),
  gravekeeper: J('cloak', 'hood', 'shovel'),
  innkeeper: J('apron', '', 'mug'),
  miner: J('miner', 'minerhat', 'pickaxe'),
  sailor: J('sailor', 'bandana', 'dagger'),
  alchemist: J('apron', 'goggles', 'flask'),
  royal_guard: J('plate', 'helmet', 'spear'),

  // ── ช่างฝีมือ (14) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  woodcutter: J('tunic', 'cap', 'axe'),
  baker: J('apron', 'chef', 'bowl'),
  tailor: J('apron', 'cap', ''),
  potter: J('apron', 'bandana', 'bowl'),
  brewer: J('apron', 'cap', 'mug'),
  glassblower: J('apron', 'goggles', ''),
  jeweler: J('scholar', 'goggles', ''),
  tanner: J('apron', '', 'dagger'),
  stonemason: J('apron', 'cap', 'hammer'),
  shipwright: J('apron', 'cap', 'axe'),
  clockmaker: J('apron', 'goggles', ''),
  rune_carver: J('apron', 'goggles', 'dagger'),
  painter: J('apron', 'cap', ''),
  sculptor: J('apron', '', 'hammer'),

  // ── งานบริการและพลเรือน (15) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  courier: J('light', 'cap', 'staff'),
  ferryman: J('sailor', 'straw', 'staff'),
  lamplighter: J('cloak', 'cap', 'lantern'),
  lighthouse_keeper: J('sailor', 'cap', 'lantern'),
  librarian: J('scholar', '', 'book'),
  chronicler: J('scholar', '', 'scroll'),
  cartographer: J('scholar', 'cap', 'scroll'),
  accountant: J('scholar', 'cap', 'ledger'),
  banker: J('noble', '', 'ledger'),
  tax_collector: J('scholar', 'cap', 'ledger'),
  lawyer: J('scholar', '', 'book'),
  mayor: J('tunic', '', 'cane'),
  midwife: J('apron', '', 'bowl'),
  apothecary: J('apron', '', 'flask'),
  veterinarian: J('apron', '', 'flask'),

  // ── งานเทคนิคและวิชาการ (6) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  physician: J('apron', '', 'flask'),
  engineer: J('apron', 'goggles', 'hammer'),
  mechanic: J('apron', 'goggles', 'hammer'),
  rail_driver: J('apron', 'cap', 'shovel'),
  airship_pilot: J('leather', 'goggles', ''),
  navigator: J('sailor', 'cap', 'scroll'),

  // ── งานต่อสู้และเสี่ยงอันตราย (8) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  city_guard: J('armor', 'helmet', 'club'),
  mercenary: J('armor', '', 'sword'),
  caravan_guard: J('leather', 'turban', 'sword'),
  bounty_hunter: J('leather', 'wide', 'bow'),
  gladiator: J('light', '', 'sword', 'mohawk'),
  beast_hunter: J('fur', 'furhat', 'spear'),
  explorer: J('leather', 'wide', 'dagger'),
  smuggler: J('cloak', 'cap', 'dagger'),

  // ── งานศาสนา (4) · งานศิลปะ (2) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  temple_servant: J('robe', '', 'broom'),
  exorcist: J('priest', '', 'censer'),
  inquisitor: J('priest', '', 'mace'),
  pilgrim: J('cloak', 'wide', 'staff'),
  dancer: J('light', '', ''),
  jester: J('cape', 'cap', 'rod'),

  // ── ชีวิตช้า (12) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  farm_owner: J('tunic', 'straw', 'cane'),
  vegetable_gardener: J('apron', 'straw', 'shovel'),
  orchardist: J('apron', 'straw', ''),
  beekeeper: J('light', 'veil', ''),
  tea_grower: J('light', 'straw', ''),
  flower_grower: J('apron', 'straw', ''),
  cheesemaker: J('apron', 'cap', ''),
  miller: J('apron', 'cap', ''),
  herb_shop: J('apron', '', 'flask'),
  tea_house: J('apron', '', 'bowl'),
  bookshop: J('scholar', '', 'book'),
  temple_gardener: J('robe', 'straw', 'broom'),

  // ── ย้ายจากอาชีพลับ (7) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  world_walker: J('cloak', 'wide', 'staff'),
  black_market_king: J('noble', '', 'dagger'),
  philosopher_stone_maker: J('scholar', '', 'flask'),
  shadowless_thief: J('cloak', 'cowl', ''),
  bridge_walker: J('cloak', '', 'banner'),
  twin_fire_smith: J('apron', '', 'hammer'),
  pack_bridge_rider: J('leather', 'hood', 'bow'),

  // ── การค้า (8) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  peddler: J('tunic', 'wide', 'staff'),
  guide: J('leather', 'wide', 'staff'),
  broker: J('scholar', 'cap', 'scroll'),
  appraiser: J('scholar', 'goggles', ''),
  caravan_master: J('cloak', 'turban', 'rod'),
  moneylender: J('noble', '', 'ledger'),
  investor: J('noble', '', 'cane'),
  shipowner: J('cloak', 'cap', 'ledger'),

  // ── อาชีพลับเดิมในโค้ด (10-jobs-secret.md ก, 15) ─────────────────────────────────────────────────────────────────────────────────────────────
  lich: J('robe', 'cowl', 'staff'),
  demonlord: J('regal', 'horned', 'sword'),
  saint: J('priest', '', 'staff'),
  hero: J('knight', '', 'sword'),
  swordsaint: J('robe', '', 'sword', 'topknot'),
  dragonknight: J('knight', 'helmet', 'spear'),
  archmage: J('robe', 'wizard', 'orbstaff'),
  beastking: J('fur', 'furhat', 'club'),
  piratelord: J('sailor', 'feather', 'sword'),
  slimeking: J('regal', 'crown', 'sword'),
  sage: J('scholar', '', 'book'),
  vampirelord: J('regal', '', 'dagger'),
  shadowmaster: J('cloak', 'cowl', 'dagger'),
  godslayer: J('plate', '', 'spear'),
  prophet: J('robe', '', 'staff'),

  // ── อาชีพลับใหม่ (ข, 8) · ของลูกครึ่ง (ค, 3) ─────────────────────────────────────────────────────────────────────────────────────────────────
  dragon_whisperer: J('robe', '', 'lute'),
  seal_keeper: J('plate', '', 'hammer'),
  seal_breaker: J('cloak', 'cowl', 'dagger'),
  peacemaker_legend: J('cloak', '', 'banner'),
  tree_warden: J('cloak', 'laurel', 'staff'),
  awakened_pharaoh: J('regal', 'crown', 'scepter'),
  resurrector: J('priest', '', 'staff'),
  mountain_heart_waker: J('miner', 'minerhat', 'pickaxe'),
  third_home_founder: J('tunic', '', 'hammer'),
  old_water_singer: J('sarong', '', 'lute'),
  contract_redeemer: J('scholar', '', 'scroll'),

  // ── พิเศษ (11-jobs-special.md, 16) ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  hero_companion: J('leather', '', 'sword'),
  demon_servant: J('armor', 'horned', 'spear'),
  sky_priest_orphan: J('priest', 'veil', 'staff'),
  waterfall_keyholder: J('robe', '', 'spear'),
  gate_warden: J('plate', 'helmet', 'lantern'),
  nine_delegate: J('noble', '', 'cane'),
  bell_heir: J('robe', '', 'hammer'),
  refugee_leader: J('cloak', 'wide', 'staff'),
  rust_collector: J('cloak', 'hood', 'crook'),
  sapling_guardian: J('tunic', 'straw', 'shovel'),
  naga_egg_warden: J('robe', '', 'trident'),
  cooled_hearth_keeper: J('apron', '', 'hammer'),
  fog_guide: J('cloak', 'hood', 'staff'),
  water_city_mayor: J('sarong', '', 'staff'),
  treaty_arbiter: J('scholar', '', 'scroll'),
  ruin_city_lord: J('regal', 'crown', 'sword'),
};

/** Jobs that rule: the class-5 holder of one of these wears the regal cut, any other noble-born the noble one (main-look.ts). */
export const RULER_JOBS: ReadonlySet<string> = new Set(['noble', 'mayor', 'nine_delegate', 'water_city_mayor', 'ruin_city_lord', 'awakened_pharaoh', 'demonlord', 'slimeking', 'vampirelord']);
