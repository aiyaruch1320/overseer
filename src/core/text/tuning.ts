// Values the text layer needs that no document lists (docs/guide/code-plan.md §2 rule 3).

/**
 * World years of the story start counted in the calendar the player reads (ศ.ม.): the clock of the state starts at 0 and
 * the NPC roster is written for ศ.ม. 10,400 (data/gen/npcs.json rules.startYear).
 */
export const CALENDAR_BASE = 10400;

/** A life year has four beats; one season per beat (ending-templates slot `ฤดู`). */
export const SEASONS = ['ฤดูหว่าน', 'ฤดูฝน', 'ฤดูเก็บเกี่ยว', 'ฤดูหนาว'] as const;

/** llm/03-naming.md §2: a name is at most 24 Thai characters. */
export const MAX_NAME = 24;

/** The six race groups of llm/06-god-templates.md §2.1, by story prefix. */
export const RACE_GROUP: Record<string, string> = {
  hu: 'คนบ้านเมือง', ha: 'คนบ้านเมือง', sl: 'คนบ้านเมือง',
  el: 'ป่าและฟ้า', fa: 'ป่าและฟ้า', be: 'ป่าและฟ้า', wi: 'ป่าและฟ้า',
  dw: 'ภูผาและเตา', gi: 'ภูผาและเตา', la: 'ภูผาและเตา', co: 'ภูผาและเตา', so: 'ภูผาและเตา',
  na: 'สายน้ำ', me: 'สายน้ำ',
  de: 'เงา', va: 'เงา', dm: 'เงา', gh: 'เงา', mu: 'เงา',
  or: 'ศึกและมังกร', dk: 'ศึกและมังกร',
};

/** The sound of a people's names: three chunks (head, middle, tail), tails split by gender. Modelled on the roster names (ไอรัสวาร์ ธรักซ์มาร์ เซลีนาซา วาสโกร). */
export interface Voice {
  heads: string[];
  mids: string[];
  m: string[];
  f: string[];
}

export const VOICES: Record<string, Voice> = {
  city: {
    heads: ['อัล', 'เอ', 'ไล', 'มา', 'โร', 'คา', 'ธี', 'วี', 'เซ', 'นา', 'ดา', 'เมอ', 'ลู', 'ฮา', 'โบ'],
    mids: ['ริ', 'เร', 'ลิ', 'โด', 'ซา', 'เวน', 'มัน', 'ตัน', 'กัส', 'ริน', 'โล', 'ทา'],
    m: ['วาร์', 'ริก', 'มอน', 'ดอร์', 'ธัน', 'เบิร์ต', 'ลาน', 'โกร'],
    f: ['เนีย', 'ลา', 'รีน', 'ซา', 'มิ', 'ไลรา', 'ทา', 'เวีย'],
  },
  fey: {
    heads: ['ไอ', 'เอ', 'ลี', 'ซิ', 'เซ', 'อี', 'วี', 'นี', 'ไล', 'เมล', 'ฟี', 'ซา', 'อา'],
    mids: ['ลี', 'ริ', 'เล', 'นา', 'ซิ', 'เวล', 'ลิน', 'รัล', 'เฟ', 'ไว', 'มี'],
    m: ['เรียล', 'วาน', 'ลอน', 'เดล', 'ธีส', 'ไวน์', 'ริน', 'เฟล'],
    f: ['เรีย', 'ลินา', 'เซีย', 'ไลรา', 'นิส', 'วีนา', 'มีรา', 'เลีย'],
  },
  wild: {
    heads: ['ธร', 'กร', 'บรอ', 'ครอ', 'ดรอ', 'ฮุก', 'กาธ', 'ซา', 'โก', 'วุล', 'ธุก', 'ออก', 'ตรา'],
    mids: ['ก', 'ซ์', 'รัก', 'โม', 'ดุส', 'ธัน', 'กาล', 'โร', 'มุก', 'บัส'],
    m: ['มาร์', 'โกร', 'รัก', 'ดุส', 'กัซ', 'ธอร์', 'ซ์', 'ครอม'],
    f: ['ซา', 'กา', 'รา', 'มุก', 'ธา', 'โกลา', 'ซีร์', 'บา'],
  },
  stone: {
    heads: ['ดุส', 'โธ', 'บอร์', 'กราน', 'ไอรอน', 'ธอร์', 'มัล', 'คัล', 'นอร์', 'ฮัล', 'เวส', 'ดอร์'],
    mids: ['กัน', 'เบิร์ก', 'ดิน', 'รอน', 'ทัล', 'มอร์', 'ซัน', 'กริม', 'โวล', 'ลัน'],
    m: ['ดอร์', 'รัก', 'บอร์น', 'กริม', 'ธัน', 'โวล', 'ฮาร์ด', 'ครอน'],
    f: ['ดา', 'ฮิลด์', 'ธรา', 'มา', 'วีร์', 'กุน', 'เบรา', 'ซา'],
  },
  dark: {
    heads: ['นอค', 'ซิล', 'ราต', 'มอร์', 'วาส', 'คาล', 'เซร', 'ไซ', 'เนค', 'อัซ', 'ดราก', 'เวน', 'ลิล'],
    mids: ['โร', 'ซา', 'ธรา', 'วิส', 'เมร์', 'คัส', 'ไล', 'นอร์', 'ซิล', 'เดร'],
    m: ['ธาร์', 'ครอส', 'วาน', 'มอร์', 'เลธ', 'ซอร์', 'เดน', 'ริค'],
    f: ['ลิธ', 'ซา', 'เวีย', 'ไนรา', 'ธีส', 'เมล', 'ราห์', 'โซ'],
  },
  grand: {
    heads: ['ไอ', 'วาล', 'ธาร์', 'เอ', 'คัล', 'ซา', 'ดรา', 'อัซ', 'ไซร', 'โอ', 'วีร์', 'เนอ'],
    mids: ['รัส', 'ไลร์', 'ธอ', 'เวียร์', 'ดัล', 'คาน', 'เมอร์', 'ซัน', 'โรน', 'เวล'],
    m: ['วาร์', 'ธัส', 'ดอส', 'ไรน์', 'มาร์', 'เวียร์', 'คัล', 'ซาน'],
    f: ['ไลรา', 'ซา', 'เรียล', 'ธิส', 'วีร์', 'นาร์', 'ดรา', 'โอรา'],
  },
};

/** Which voice each people uses. A people not listed here uses `city`. */
export const VOICE_OF: Record<string, keyof typeof VOICES> = {
  hu: 'city', ha: 'city', sl: 'city',
  el: 'fey', fa: 'fey', wi: 'fey', na: 'fey', me: 'fey',
  be: 'wild', or: 'wild', gi: 'wild', gh: 'wild',
  dw: 'stone', la: 'stone', co: 'stone', so: 'stone', mu: 'stone',
  de: 'dark', va: 'dark', dm: 'dark',
  dk: 'grand',
};

/** A tail typical of a continent replaces the people's own tail with this chance (the "ถิ่น" of a name). */
export const LAND_TAIL_CHANCE = 0.3;
export const LAND_TAILS: Record<string, string[]> = {
  AZ: ['วาร์', 'ธาร์', 'ซาก'],
  MH: ['เฮเวน', 'ริก', 'มอร์'],
  KD: ['ดูรัม', 'คาซ', 'กริม'],
  NR: ['เรีย', 'เนอ', 'ทิส'],
  AL: ['เดรีย', 'ลาน', 'มาร์ค'],
  MK: ['เมค', 'โรน', 'เซล'],
  SH: ['ฮาร์', 'รัน', 'ซาห์'],
  SV: ['เนล', 'วัน', 'ซิล'],
  NB: ['บูล', 'เนบ', 'ลิส'],
};

/** How many tries before a name gets the generation number as a last resort. */
export const NAME_TRIES = 60;

/** Words for the causes of death the character system writes (`life.dead.cause`); a cause it writes in Thai stays as written. */
export const CAUSE_TH: Record<string, string> = { old: 'ชราภาพ', illness: 'โรคภัย', accident: 'อุบัติเหตุ', violence: 'ถูกทำร้าย' };

/** Kinds of things a grant effect hands out. */
export const GIFT_TH: Record<string, string> = {
  blessing: 'พร', curse: 'คำสาป', trait: 'นิสัย', aptitude: 'ความถนัด', skill: 'ทักษะ', job: 'อาชีพ', companion: 'สหาย', story: 'เรื่อง', gear: 'ของ', weapon: 'อาวุธ', flag: 'เครื่องหมาย',
};

/** Words for the ways a life begins that the character system writes (`special` of its birth entry). */
export const SPECIAL_TH: Record<string, string> = { summoned: 'ผู้ถูกอัญเชิญจากต่างโลก', reincarnated: 'ผู้กลับชาติ', woken: 'ผู้ตื่นขึ้นเป็นครั้งแรก' };

/** Where the character was born, by the `born` of the character birth entry. */
export const BORN_TH: Record<string, string> = { main: 'ในแผ่นดินของเผ่า', diaspora: 'ในถิ่นที่เผ่าไปอยู่', outside: 'นอกถิ่นของเผ่า' };

/**
 * The first line of a life that begins grown, an heir who takes over (the lineage; `named` with `heir`): the words of 07-ending-templates.md `เกิด` say a birth, so this one says the taking over.
 * Doc gap: the heir's opening line has no template in the docs; these are the words of the tools until it has.
 */
export const HEIR_OPENING = '{name} รับช่วงต่อเมื่ออายุ {age} ที่{home} ในฐานะ{race}ของครอบครัว{class_birth}';

/**
 * The first line of a life that begins grown and is nobody's heir: the late wakers (the ghoul, the mummy, the soul machine wake at 17) and the summoned (16).
 * They are not taking anything over, so the heir's words are not theirs (review of the wish, 04-start-modes.md "ผู้ถูกกักด้วยความหิว"). Doc gap: no template in the docs.
 */
export const WAKE_OPENING: Record<string, string> = {
  woken: '{name} ตื่นขึ้นเป็น{race}เมื่ออายุ {age} ที่{home} ในครอบครัว{class_birth}',
  summoned: '{name} ถูกอัญเชิญมาถึง{home}เมื่ออายุ {age} ในฐานะ{race} ไม่มีครอบครัวในโลกนี้',
};
/** The tail of the family line for the ways a life begins (the verbs of the line differ: a birth, a waking, a calling). */
export const SPECIAL_LINE: Record<string, string> = { summoned: 'ถูกอัญเชิญมาจากต่างโลก', reincarnated: 'เกิดพิเศษเป็นผู้กลับชาติ', woken: 'ตื่นขึ้นเป็นครั้งแรก' };

/** The death line for each cause the character system writes; `{who}` `{where}` `{age}` are filled by the reader. */
export const DEATH_TH: Record<string, string> = {
  old: '{who}จากไปด้วยชราภาพ{where} เมื่ออายุ {age}',
  illness: '{who}สิ้นชีวิตด้วยโรคภัย{where} เมื่ออายุ {age}',
  accident: '{who}สิ้นชีวิตจากอุบัติเหตุ{where} เมื่ออายุ {age}',
  violence: '{who}ถูกทำร้ายจนสิ้นชีวิต{where} เมื่ออายุ {age}',
  // a death in battle is told as one, whatever story node happened to be the last of that year (M3 fix: "จากเหตุ ความรักและครอบครัว")
  ตายในศึก: '{who}ตายในศึก{where} เมื่ออายุ {age}',
};

// ---------- the god's hand (god.ts) ----------

/** The names of the rarity tiers of a chest (the documents name only the letters C U R E L; these are the words the cards show). Assumption. */
export const TIER_TH: Record<string, string> = { C: 'ธรรมดา', U: 'ไม่ธรรมดา', R: 'หายาก', E: 'หายากยิ่ง', L: 'ตำนาน' };

/** What a slot of the chest is called when it was picked. */
export const CHEST_KIND_TH: Record<string, string> = { bless: 'พร', curse: 'คำสาป', skill: 'ฝีมือ', item: 'ของ', weapon: 'อาวุธ' };

/** The reasons a thing comes up in the chest (the data's `why` codes), as the card says them (02-bestow.md §3, llm/06-god-templates.md `chest_reason`). */
export const WHY_TH: Record<string, string> = {
  story: 'ตรงกับเรื่องที่กำลังจะถึง',
  job: 'ตรงกับอาชีพหรือความถนัดของเขา',
  home: 'ตรงกับถิ่นที่เขาอยู่',
  event: 'ตรงกับเหตุการณ์ของโลกที่เพิ่งเกิด',
};

/** What a dream did at the crossroads: the key of the `decision_result` templates and a plain sentence. */
export const OUTCOME_TH: Record<string, { key: string; plain: string }> = {
  obey: { key: 'ทำตาม', plain: 'ทำตามความฝันของท่าน' },
  misread: { key: 'ตีความผิด', plain: 'ตีความความฝันของท่านผิดไป' },
  refuse: { key: 'ปฏิเสธ', plain: 'ปฏิเสธความฝันของท่าน' },
  defy: { key: 'ขัดขืน', plain: 'ขัดขืนความฝันของท่านอย่างเปิดเผย' },
};

/** The flags of a country that a prayer clears or brings (world/tuning flags). */
export const FLAG_TH: Record<string, string> = {
  famine: 'ข้าวยากหมากแพง',
  sandstorm: 'พายุทราย',
  plague: 'โรคระบาด',
  undead_rising: 'ผีที่ลุกขึ้น',
  war: 'สงคราม',
  demon_raid: 'อสูรที่บุก',
  horde: 'ฝูงอสูร',
  ghoul_plague: 'กูลที่ระบาด',
  golden: 'ยุคทอง',
  flood: 'น้ำท่วมใหญ่',
  cracked: 'เมืองร้าว',
  god_ruin: 'ซากพระเจ้า',
  fallen: 'ซากของมหาล่มสลาย',
};

/** The numbers a prayer moves, in words. */
export const STAT_TH: Record<string, string> = { int: 'ปัญญา', vit: 'ความทนทาน', brave: 'ความกล้า', kind: 'ความใจดี', fame: 'ชื่อเสียง', pow: 'พละกำลัง', mag: 'เวทมนตร์', spd: 'ความเร็ว', luk: 'โชค' };

/** Prayer effect words with a fixed meaning (the rest are read by `fxPhrases`). */
export const EFFECT_WORD_TH: Record<string, string> = {
  'npc:heal': 'คนสำคัญหายป่วย',
  'npc:die': 'คนสำคัญสิ้นชีวิต',
  'rel:+lover': 'ได้พบคนรัก',
  child: 'ได้ลูก',
};

/**
 * Prayer effect words whose result needs a system that does not exist yet. The bond system now keeps a lover and a child (M3), so nothing waits any
 * more; the table stays so that a future effect word can be told as a promise the same way (review M2 G6).
 */
export const PENDING_FX_TH: Record<string, string> = {};

/** How the line of a promise is told after the real effects (`ยังไม่เป็นจริง: …`). */
export const PENDING_NOTE = 'คำมั่นที่ยังไม่เป็นจริง';

/** The cards a stop of the game carries with it, by the kind of card. */
export const FOLDED_TH: Record<string, string> = { prayer: 'คำอธิษฐาน', omen: 'ลาง', majorOmen: 'ลางใหญ่', battle: 'ศึก', crisis: 'วิกฤต' };
