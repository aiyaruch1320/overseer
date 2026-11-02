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
