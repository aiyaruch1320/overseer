// The lines of the systems of M3 as the player reads them: bonds, bondage, travel, items, economy, the newer kinds of npc, and combat
// beyond the battle line (docs/guide/code-plan.md §8.1 rule 2; docs/appearance/16-ally-scenes.md, 19-ally-successors.md).
// Each system writes its log in its own words (names are real names, codes are internal); here every kind becomes one sentence of Thai.
// Pure: the same entry gives the same line, nothing is drawn from the seed streams.
//
// `m3Say` returns a line, `null` when the entry is for the log and not for the player (a trace, or something another line already tells),
// or `undefined` when the kind has no phrasing yet (the developer's list then shows it). `m3Level` is the level the entry is shown at:
// the many small lines of a long life (a mood, a worn blade, a trade trip) are trace for the player (level 0) and still readable at `--level=0`.
import type { GameData } from '../game';
import type { LogEntry, LogLevel } from '../types';
import { items } from './labels';
import { plainName, scrub, sentence } from './plain';
import { CAUSE_TH, TIER_TH } from './tuning';
import {
  BOND_CAUSE_TH, BOND_LEVEL_TH, BOND_WHY_TH, CLASH_RESULT_TH, CRISIS_ANSWER_TH, FORGE_OUTCOME_TH, FORGE_PAY_TH, FREED_BY_TH, INVITE_TH, LEGEND_GONE_TH, MOOD_TH, RAID_TH, REFUSAL_TH, RESCUE_TH, ROAD_TH,
  SICK_TH, TALISMAN_TH, TIE_FROM_TH, TIGHT_TH, TRAVEL_CAUSE_TH, TRAVEL_LEVEL_TH, TRIP_WHY_TH, WAR_ROLE_TH, WOUND_TH,
} from './words';

type D = LogEntry['data'];
const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** What the reader knows that these lines need. */
export interface M3Cx {
  data: GameData;
  /** The name of the main character. */
  who: string;
  /** The line of a bond the reader already told the end of: a second line about the same end is left out. */
  endedTold(tie: string): boolean;
  /** Has the character met this NPC (a roster id)? */
  met(id: string | undefined): boolean;
  /** The sentence of an NPC story text (`[ช่วย]` branches cut). */
  npcText(text: string, withMc: boolean): string;
  /** The name the roster gives a position (`AL01-1`), without the generation. */
  npcName(id: string): string;
  /** A stable pick among variants of a line. */
  pick<T>(list: T[]): T;
}

const nm = (cx: M3Cx, id: unknown): string => plainName(cx.data, id);

const placeCache = new WeakMap<GameData, Map<string, string>>();
/** The name of a country as a place (`อาริเลนอร์`), the way the birth line and the status say it; the title of its state when it has no name. */
function pl(cx: M3Cx, id: unknown): string {
  let m = placeCache.get(cx.data);
  if (!m) {
    m = new Map((items<{ id: string; name?: string }[]>(cx.data, 'countries') ?? []).filter((c) => c.name).map((c) => [c.id, scrub(cx.data, c.name as string) || (c.name as string)]));
    placeCache.set(cx.data, m);
  }
  return m.get(s(id)) ?? nm(cx, id);
}
const at = (cx: M3Cx, id: unknown): string => {
  const n = pl(cx, id);
  return n ? ` ที่${n}` : '';
};
const tidyLine = (t: string): string => t.replace(/\s{2,}/g, ' ').trim();

// ---------- names from the data ----------

interface BondsLike {
  ties?: { levels?: { n: number; name: string }[] };
  arcs?: { templates?: { id: string; name: string }[] };
  family?: { templates?: { id: string; name: string }[] };
}
const titleCache = new WeakMap<GameData, Map<string, string>>();

/** The title of a story of the bonds by its code (`FT-12` `KN-05`); nothing for a hand-written story of a roster person. */
function arcTitle(data: GameData, code: string): string {
  let m = titleCache.get(data);
  if (!m) {
    m = new Map();
    const b = items<BondsLike>(data, 'bonds');
    for (const t of [...(b?.arcs?.templates ?? []), ...(b?.family?.templates ?? [])]) m.set(t.id, t.name);
    titleCache.set(data, m);
  }
  return m.get(code) ?? '';
}

function bondLevel(data: GameData, n: number): string {
  return items<BondsLike>(data, 'bonds')?.ties?.levels?.find((l) => l.n === n)?.name ?? BOND_LEVEL_TH[n] ?? '';
}

function bondageLevel(data: GameData, n: number): string {
  return items<{ levels?: { n: number; name: string }[] }>(data, 'bondage')?.levels?.find((l) => l.n === n)?.name ?? '';
}

interface TravelLike {
  overlays?: { id: string; name: string }[];
  encounters?: { d: number; name: string }[];
}
function overlayName(data: GameData, id: string): string {
  return items<TravelLike>(data, 'travel')?.overlays?.find((o) => o.id === id)?.name ?? '';
}
function roadName(data: GameData, d: number): string {
  return items<TravelLike>(data, 'travel')?.encounters?.find((e) => e.d === d)?.name ?? '';
}

const NODE_ID = /^[a-z]{2}\.[a-z]\d+$/;
const ARC_CODE = /^([A-Z]{2,4}-\d+|[A-Z]{2}\d{2}-\d)(?:\s+\S+)?$/;

/** Why something changed, in words: a word the table knows, a story by its title, or Thai text as written. Nothing for a code the data cannot name. */
function whyWords(cx: M3Cx, why: unknown): string {
  const w = s(why).trim();
  if (!w) return '';
  if (BOND_WHY_TH[w] !== undefined) return BOND_WHY_TH[w];
  const code = ARC_CODE.exec(w);
  if (code) {
    const t = arcTitle(cx.data, code[1]);
    return t ? `เพราะเรื่อง “${t}”` : '';
  }
  const first = w.split(/\s+/)[0];
  if (NODE_ID.test(first)) {
    const t = nm(cx, first);
    return t ? `เพราะเรื่อง “${t}”` : '';
  }
  return /[฀-๿]/.test(w) ? scrub(cx.data, w) : '';
}

function fromWords(cx: M3Cx, from: unknown): string {
  const f = s(from);
  if (TIE_FROM_TH[f]) return ` ${TIE_FROM_TH[f]}`;
  if (NODE_ID.test(f)) {
    const t = nm(cx, f);
    return t ? ` ในเรื่อง “${t}”` : '';
  }
  return '';
}

function deathCause(cause: unknown): string {
  const c = s(cause);
  if (c in BOND_CAUSE_TH) return BOND_CAUSE_TH[c];
  if (CAUSE_TH[c]) return CAUSE_TH[c];
  return /[฀-๿]/.test(c) ? c : '';
}

const paren = (t: string): string => (t ? ` (${t})` : '');

/** A sentence of a document, with a remark in brackets that was left hanging by a link cut out of it (`(ตามท่าทีของประเทศใน)`) taken away. */
function docSentence(data: GameData, text: string, who = 'ตัวละคร'): string {
  return named(sentence(data, text.replace(/\([^()]*ใน\)/g, ' ').replace(/\s+ใน\s*$/, '')), who);
}

/** The documents say `ตัวละคร` for the one who lives the life: the player reads his name. */
function named(text: string, who: string): string {
  return who === 'ตัวละคร' ? text : text.replace(/ตัวละครหลัก|ตัวละคร/g, ` ${who} `).replace(/\s{2,}/g, ' ').trim();
}

/**
 * What happened in a clash, from the cell of the document: the cell holds the story (`เขาโยนตัวละครลงบันไดสองร้อยขั้น`) and then what it does to the
 * paths of the NPC, the weights and the favours (`เส้น ข) เดินต่อ` `ไว้ใจ +2`). The player reads the story and not the sums.
 */
export function clashStory(data: GameData, text: string, who = 'ตัวละคร'): string {
  const x = text
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/เส้น\s*[กขค]\)?(?:\s*(?:และ|หรือ|,)\s*[กขค]\))*(?:\s*(?:บังคับเกิด|ถูกตัด|เดินต่อ|ช้าลง|เร็วขึ้น|ไม่เกิด|น้ำหนัก\s*[×+−-]?\s*\d+))*/g, ' ')
    .replace(/เส้นเดินต่อ|บังคับเกิด|ไม่ทอยบาดแผลถาวร/g, ' ')
    .replace(/น้ำหนัก\s*[×+−-]?\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/(?:ไว้ใจ|บุญคุณ|ความแค้น|แค้นตัวละคร|แค้น|ชื่อเสียง)\s*[+−-]\s*\d+/g, ' ')
    .replace(/^\s*ตาย\s+/, '');
  return named(sentence(data, x), who);
}

// ---------- bonds ----------

const bonds = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  const who = cx.who;
  const name = s(d.name);
  const line = s(d.line);
  const ln = paren(line);
  switch (e.kind) {
    case 'tie': {
      if (!name) return undefined;
      const lv = num(d.level);
      if (d.from === 'closeKin' || lv === 0) return `${name} เป็น${line || 'ญาติ'}ของ${who}`;
      return `ได้รู้จัก ${name}${ln}${fromWords(cx, d.from)}${lv ? ` ระดับ${bondLevel(cx.data, lv)}` : ''}`;
    }
    case 'level': {
      if (!name) return undefined;
      const up = num(d.to) > num(d.from);
      const why = whyWords(cx, d.why);
      return `ความสัมพันธ์กับ ${name}${ln} ${up ? 'แน่นแฟ้นขึ้น' : 'ห่างลง'}จาก${bondLevel(cx.data, num(d.from))}เป็น${bondLevel(cx.data, num(d.to))}${paren(why)}`;
    }
    case 'line': {
      if (!name) return undefined;
      return `${name} จากที่เป็น${s(d.from)} กลายเป็น${s(d.to)}ของ${who}${paren(whyWords(cx, d.why))}`;
    }
    case 'mood': {
      const verb = MOOD_TH[s(d.mood)];
      if (!name || !verb) return undefined;
      return `${who} ${verb} ${name}${ln}`;
    }
    case 'mood-held':
      return null; // a feeling that could not show: for the balance counts
    case 'arc': {
      const title = s(d.title);
      const text = docSentence(cx.data, s(d.text), who);
      if (num(d.stage) <= 1) return name ? `เรื่องของ ${name}${ln} เริ่มขึ้น${title ? `: ${title}` : ''}` : undefined;
      if (!name) return undefined;
      const head = num(d.stage) === 2 && title ? `${name}${ln} — ${title}` : `${name}${ln}`;
      return text ? `${head}: ${text}` : head;
    }
    case 'news': {
      if (!name) return undefined;
      if (d.kind === 'death') {
        const m = /\(([^()]*)\)\s*$/.exec(s(d.text));
        const c = m ? deathCause(m[1]) : '';
        return `ข่าวถึง${who}: ${name}${ln} จากไป${paren(c)}`;
      }
      const text = docSentence(cx.data, s(d.text), who);
      return text ? `ข่าวถึง${who}: เรื่องของ ${name}${ln} — ${text}` : `ข่าวถึง${who}: เรื่องของ ${name}${ln} ก้าวต่อไป`;
    }
    case 'crisis':
    case 'trouble': {
      if (!name) return undefined;
      const text = docSentence(cx.data, s(d.text), who);
      const answer = CRISIS_ANSWER_TH[s(d.answer)] ?? '';
      return `${name}${ln} ประสบเรื่องหนัก${text ? `: ${text}` : ''}${answer ? ` — ${who}${answer}` : ''}`;
    }
    case 'ending': {
      if (!name) return undefined;
      const title = arcTitle(cx.data, s(d.code));
      const text = docSentence(cx.data, s(d.text), who);
      return `เรื่อง${title ? ` “${title}”` : ''}ของ ${name}${ln} จบลง${text ? `: ${text}` : ''}`;
    }
    case 'end': {
      if (!name) return undefined;
      if (cx.endedTold(s(e.id))) return null;
      switch (s(d.way)) {
        case 'death': {
          const c = deathCause(d.cause);
          return `${name}${ln} จากไป${paren(c)}`;
        }
        case 'fade':
          return `ห่างกับ ${name}${ln} จนสายจางหายไป`;
        case 'split':
          return `สายกับ ${name}${ln} แตกหักและแยกทางกัน`;
        case 'betray':
          return `${name}${ln} หักหลัง${who} สายเดิมจึงขาดลง`;
        default:
          return `เรื่องกับ ${name}${ln} จบลงด้วยดี`;
      }
    }
    case 'funeral': {
      if (!name) return undefined;
      const c = deathCause(d.cause);
      return `งานศพของ ${name}${ln}${c ? ` · ${c}` : ''}: ${who}ไปส่งเขาเป็นครั้งสุดท้าย`;
    }
    case 'letter': {
      if (!name) return undefined;
      const place = pl(cx, d.from);
      return `จดหมายจาก ${name}${ln} ถึงมือ${who}${place ? ` ส่งมาจาก${place}` : ''}`;
    }
    case 'invite': {
      const kind = INVITE_TH[s(d.ask)];
      if (!name || !kind) return undefined;
      const ask = kind.ask.replace('{p}', name);
      return d.ok ? `${who}${ask} — ${kind.ok}` : `${who}${ask} — ${REFUSAL_TH[s(d.refusal)] ?? 'เขาปฏิเสธ'}`;
    }
    case 'child': {
      if (!name) return undefined;
      if (d.adopted) return `${who}รับ ${name} เป็นลูกบุญธรรม`;
      return d.from === 'prayer' ? `${who}ได้ลูกชื่อ ${name} ตามคำอธิษฐาน` : `${who}มีลูกชื่อ ${name}`;
    }
    case 'pair': {
      const mine = nm(cx, d.item);
      const status = s(d.status);
      if (!name || !mine) return undefined;
      if (!d.from) return status === 'full' ? `${who}กับ ${name} มี ${mine} ครบทั้งคู่` : `${who}ได้ ${mine} · อีกซีกหนึ่งอยู่กับ ${name}`;
      if (status === 'full') return `ของคู่ ${mine} กลับมาอยู่ครบทั้งสองชิ้นอีกครั้ง`;
      if (status === 'memorial') return `${mine} กลายเป็นของระลึกถึง ${name}`;
      return `${mine} ไม่ได้อยู่ครบคู่อีกต่อไป`;
    }
    case 'among': {
      const a = s(d.a);
      const b = s(d.b);
      return a && b ? `${a} กับ ${b} รู้จักกันผ่าน${who}${paren(s(d.line))}` : undefined;
    }
    case 'pair-story': {
      const a = s(d.a);
      const b = s(d.b);
      const text = sentence(cx.data, s(d.text));
      return a && b ? `${a} กับ ${b}${text ? `: ${text}` : ' มีเรื่องร่วมกัน'}` : undefined;
    }
    case 'successor': {
      if (!name) return undefined;
      const proto = s(d.proto);
      const origin = scrub(cx.data, s(d.origin));
      return `${name}${ln} ผู้สืบทอดต่อจาก${proto ? ` ${proto}` : 'พวกพ้องคนก่อน'}${origin ? ` — ${origin}` : ''}`;
    }
    case 'ally': {
      if (!name) return undefined;
      const origin = scrub(cx.data, s(d.origin));
      return `${name}${ln} ผู้มีชื่อในโลก ได้มาเป็นพวกพ้องของ${who}${origin ? ` — ${origin}` : ''}`;
    }
    case 'thread': {
      if (!name) return undefined;
      return `เรื่องของ ${name}${ln} ยังค้างอยู่ที่ขั้นที่ ${num(d.stage)} จะตกไปถึงผู้สืบทอด`;
    }
    case 'freed': {
      if (!name) return undefined;
      return `${name} เป็นอิสระแล้ว${d.how === 'owner' ? ' เจ้าของเขาปล่อยตัวให้' : ''}`;
    }
  }
  return undefined;
};

// ---------- bondage ----------

const bondage = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  const who = cx.who;
  const name = s(d.name);
  switch (e.kind) {
    case 'enter': {
      const lv = bondageLevel(cx.data, num(d.level));
      const owner = s(d.owner);
      const price = num(d.price);
      return `${who}ตกอยู่ในพันธะ: ${lv || 'ถูกผูกตัว'}${paren(s(d.route))}${at(cx, d.country)}${owner ? ` ภายใต้ ${owner}` : ''}${d.moved ? ' หลังถูกพาข้ามเขตมา' : ''}${price ? ` · ค่าไถ่ราว ${price} ทอง` : ''}`;
    }
    case 'exit':
      if (s(e.id) === 'fled') return null; // the escape tells where he crossed
      return `${who}พ้นจากพันธะ${paren(s(d.way))}${d.classUp ? ' ฐานะสูงขึ้นหนึ่งชั้น' : ''}`;
    case 'escape': {
      if (d.who === 'held') return name ? `${name} ผู้ที่${who}ถือสัญญาไว้ หนีไปได้` : undefined;
      if (d.ok) return `${who}หนีข้ามแดนได้สำเร็จ${d.to ? ` ถึง${pl(cx, d.to)}` : ''} และเป็นอิสระ`;
      return `${who}พยายามหนีข้ามแดนแต่ถูกจับกลับมา`;
    }
    case 'buy': {
      const lv = s(d.level) === 'B3' ? bondageLevel(cx.data, 3) : bondageLevel(cx.data, 2);
      return name ? `${who}ซื้อสัญญาของ ${name}${paren(lv)} ราคา ${num(d.price)} ทอง${at(cx, d.country)}` : undefined;
    }
    case 'free': {
      if (!name) return undefined;
      if (d.how === 'freed') return `${name} ได้รับอิสระจาก${who}`;
      const how = FREED_BY_TH[s(d.how)] ?? FREED_BY_TH.freed;
      return `${name} เป็นอิสระแล้ว — ${who}${how}${num(d.price) ? ` ${num(d.price)} ทอง` : ''}`;
    }
    case 'sell':
      return name ? `${who}ขายสัญญาของ ${name} ต่อ ได้ ${num(d.gain)} ทอง` : undefined;
    case 'sued':
      return name ? `${name} ฟ้องร้องเรื่องที่${who}ถือสัญญาเขาไว้ คนในเมืองไว้ใจ${who}น้อยลง` : undefined;
  }
  return undefined;
};

// ---------- travel ----------

const travel = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  const who = cx.who;
  switch (e.kind) {
    case 'cause': {
      const w = TRAVEL_CAUSE_TH[s(e.id)];
      return w ? `${who}ตัดสินใจออกเดินทาง: ${w}` : undefined;
    }
    case 'open': {
      const o = overlayName(cx.data, s(e.id));
      return o ? `เรื่องของ “${o}” เปิดขึ้นในชีวิตของ${who}` : undefined;
    }
    case 'move':
      return null; // the trip says it
    case 'trip': {
      const from = pl(cx, d.from);
      const to = pl(cx, d.to);
      if (!to) return undefined;
      const why = TRIP_WHY_TH[s(d.why)] ?? (s(d.why).startsWith('job:') ? 'เดินทางตามงาน' : s(d.why).startsWith('story:') ? 'เดินทางตามเรื่องที่เล่น' : '');
      const route = `${from ? `จาก${from} ` : ''}ไป${to}`;
      const cost = num(d.fare) > 0 ? ` ค่าเดินทาง ${num(d.fare)} ทอง` : '';
      return `${why ? `${why}: ` : 'เดินทาง'}${route} ${num(d.legs)} ช่วงทาง ราว ${num(d.days)} วัน${cost}${d.smuggle ? ' โดยลักลอบข้ามด่าน' : ''}`;
    }
    case 'road': {
      const n = s(d.note);
      if (n.startsWith('pay ')) return `ระหว่างทาง: ด่านเรียกภาษีหรือสินบน เสียไป ${num(n.slice(4))} ทอง`;
      if (n.startsWith('repair ')) return `ระหว่างทาง: พาหนะเสีย จ่ายค่าซ่อม ${num(n.slice(7))} ทอง`;
      if (n.startsWith('news')) {
        const ev = nm(cx, n.slice(5).trim());
        return `ระหว่างทาง: ได้ข่าวเหตุการณ์โลก${ev ? ` “${ev}”` : 'จากอีกทวีป'}`;
      }
      const t = ROAD_TH[n];
      return t ? `ระหว่างทาง: ${t}` : undefined;
    }
    case 'settle': {
      const place = pl(cx, e.id);
      return `${who}ตั้งหลักแหล่งใหม่${place ? `ที่${place}` : ''}`;
    }
    case 'blocked': {
      const to = pl(cx, e.id);
      const why = s(d.why) === 'wanted' ? 'เพราะที่นั่นตามจับตัวอยู่' : s(d.why) === 'route closed' ? 'เพราะเส้นทางถูกปิด' : '';
      return `${who}เข้า${to || 'ที่นั่น'}ไม่ได้${why ? ` ${why}` : ''}`;
    }
    case 'stair':
      return `${who}ปีนบันไดหมื่นขั้นไม่ผ่านการทดสอบ ต้องรอและหยุดอยู่ตีนบันไดราว ${num(d.days)} วัน`;
  }
  return undefined;
};

// ---------- items ----------

const itemTier = (t: unknown): string => TIER_TH[s(t)] ?? '';

const itemsLine = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  const who = cx.who;
  const name = s(d.name) ? scrub(cx.data, s(d.name)) || nm(cx, e.id) : nm(cx, e.id);
  switch (e.kind) {
    case 'get': {
      if (!name) return undefined;
      const t = itemTier(d.tier);
      return `${who}ได้ ${name}${t ? ` (ระดับ${t})` : ''} มาไว้ติดตัว`;
    }
    case 'buy': {
      if (!name) return undefined;
      return `ซื้อ ${name} ราคา ${num(d.price)} ทอง${at(cx, d.country)}`;
    }
    case 'gear': {
      const parts: string[] = [];
      for (const [k, label] of [['wield', 'ถือ'], ['armor', 'สวม'], ['charm', 'พก']] as const) {
        const n = nm(cx, d[k]);
        if (n) parts.push(`${label} ${n}`);
      }
      for (const id of s(d.acc).split(',').filter(Boolean)) {
        const n = nm(cx, id);
        if (n) parts.push(`ประดับ ${n}`);
      }
      return parts.length ? `${who}จัดของติดตัวใหม่: ${parts.join(' · ')}` : `${who}ไม่มีของติดตัวที่ใช้ได้`;
    }
    case 'dull':
      return name ? `${name} ทื่อลงจากการใช้` : undefined;
    case 'wear':
      return name ? `${name} สึกหรอจากการพ่ายแพ้ ป้องกันได้น้อยลง` : undefined;
    case 'repair': {
      const n = nm(cx, e.id);
      return n ? `ซ่อม ${n} ให้ใช้ได้อีก${num(d.cost) ? ` เสีย ${num(d.cost)} ทอง` : ''}` : undefined;
    }
    case 'wornout':
      return name ? `${name} ใช้จนพังและทิ้งไป` : undefined;
    case 'legend':
      return name ? `${who}ได้อาวุธในตำนาน ${name} มาครอง` : undefined;
    case 'vanish':
      return name ? `อาวุธในตำนาน ${name} ไม่ปรากฏต่อ${who}: ${LEGEND_GONE_TH[s(d.why)] ?? 'อยู่ที่อื่น'}` : undefined;
    case 'return': {
      const n = nm(cx, e.id) || name;
      if (!n) return undefined;
      if (s(d.to) === 'broken') return `เมื่อ${who}สิ้นชีวิต ${n} แตกสลายไปตลอดกาล`;
      const to = scrub(cx.data, s(d.to));
      return `เมื่อ${who}สิ้นชีวิต ${n} ${to || 'กลับสู่ที่ของมัน'}`;
    }
    case 'unknown':
      return null;
    case 'talisman': {
      const n = nm(cx, e.id);
      const w = TALISMAN_TH[s(d.what)];
      return n && w ? `เครื่องรางโบราณ ${n} ${w}` : undefined;
    }
    case 'forge': {
      const w = nm(cx, e.id);
      const smith = s(d.smith);
      const by = smith ? `ที่ ${smith}` : '';
      switch (s(d.step)) {
        case 'need': {
          const cause = sentence(cx.data, s(d.cause));
          const place = pl(cx, d.place);
          return `${who}ตั้งใจสั่งตีอาวุธใหม่${w ? ` (${w})` : ''}${cause ? ` เพราะ${cause}` : ''}${smith ? ` กับ ${smith}` : ''}${place ? ` ที่${place}` : ''}`;
        }
        case 'wait': {
          const pay = FORGE_PAY_TH[s(d.how)];
          return `สั่งตี${w ? ` ${w}` : 'อาวุธ'} ${by} ราคา ${num(d.price)} ทอง${pay ? ` (${pay})` : ''} รออีก ${num(d.beats)} ฤดู`;
        }
        case 'save':
          return `${who}ยังไม่มีเงินพอจ่ายค่าตี ${num(d.price)} ทอง จึงเก็บเงินไว้ก่อน`;
        case 'trial':
          return `${smith ? `ช่าง ${smith}` : 'ช่าง'}ทดสอบน้ำใจ${who}: ${d.pass ? 'ผ่าน' : 'ไม่ผ่าน'}`;
        case 'abort':
          return `เลิกสั่งตี${w ? ` ${w}` : 'อาวุธ'}${smith ? ` กับ ${smith}` : ''} เพราะ${s(d.why) === 'saved too long' ? 'เก็บเงินไม่ทันเสียที' : 'เหตุขัดข้อง'}`;
        case 'result': {
          const made = s(d.name) ? scrub(cx.data, s(d.name)) : w;
          return `${made ? `${made} ` : 'อาวุธที่สั่ง'}${FORGE_OUTCOME_TH[s(d.outcome)] ?? 'เสร็จแล้ว'}${smith ? ` ฝีมือ ${smith}` : ''}`;
        }
      }
    }
  }
  return undefined;
};

// ---------- economy ----------

const economy = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  switch (e.kind) {
    case 'tight': {
      const w = TIGHT_TH[s(d.way)];
      return w ? `ปีนี้เงินฝืดเคือง ${cx.who}${w}` : undefined;
    }
    case 'default': {
      const n = Number(/\d/.exec(s(d.class))?.[0]);
      const cls = n ? items<{ classes?: { n: number; name: string }[] }>(cx.data, 'economy')?.classes?.find((c) => c.n === n)?.name ?? '' : '';
      return `หนี้ท่วมเกินกว่าจะใช้ไหว ทรัพย์ถูกยึดชำระและฐานะของ${cx.who}ตกลง${cls ? `เหลือ${cls}` : ''}`;
    }
  }
  return undefined;
};

// ---------- combat (beyond the battle line) ----------

const enemyNames = (cx: M3Cx, ids: string): string => {
  const out = ids.split(',').filter(Boolean).map((id) => nm(cx, id)).filter(Boolean);
  return out.join(' · ');
};

const combat = (cx: M3Cx, e: LogEntry): string | null | undefined => {
  const d = e.data;
  const who = cx.who;
  switch (e.kind) {
    case 'prelude': {
      const foe = scrub(cx.data, s(d.foe)) || enemyNames(cx, s(d.enemies));
      const tier = s(d.tier);
      const node = nm(cx, d.node);
      if (!foe) return `ศึกใหญ่กำลังมาถึง${who}`;
      return `${foe}${tier ? ` (${tier})` : ''} ขวางหน้า${who}${node ? ` ใน “${node}”` : ''} ศึกกำลังจะเริ่ม`;
    }
    case 'raid': {
      const foe = nm(cx, e.id);
      const how = RAID_TH[s(d.how)] ?? '';
      return `${foe ? `${foe}บุกเข้า` : 'ผู้บุกรุกบุกเข้า'}${at(cx, d.country)} ${d.warned ? `${who}รู้ตัวก่อน` : `${who}ถูกบุกโดยไม่ทันตั้งตัว`} · ${how}`.replace(/ · $/, '');
    }
    case 'war': {
      const role = WAR_ROLE_TH[s(d.role)] ?? 'ทหารคนหนึ่ง';
      const place = at(cx, e.id);
      switch (s(d.how)) {
        case 'held':
          return `${who}ร่วมศึกใหญ่${place} ในฐานะ${role} และยืนหยัดได้`;
        case 'lost': {
          const wounds = woundWords(cx, s(d.wounds));
          return `ศึกใหญ่${place}: ฝ่ายของ${who}ถูกตีแตก${wounds ? ` ${who}ได้รับ${wounds}` : ''}`;
        }
        default:
          return `${who}สิ้นชีวิตในศึกใหญ่${place}`;
      }
    }
    case 'captured':
      return `${who}ถูกจับเป็นเชลยเมื่อฝ่ายแพ้ศึก${at(cx, e.id)}`;
    case 'wound': {
      const wounds = woundWords(cx, s(d.wounds));
      const foe = nm(cx, e.id);
      return wounds ? `${who}ได้รับ${wounds}${foe ? `จาก ${foe}` : ''}` : undefined;
    }
    case 'title': {
      const t = scrub(cx.data, s(e.id));
      return t ? `${who}ได้รับฉายา “${t}”` : undefined;
    }
    case 'pray':
      return `${who}อธิษฐานกลางศึก แรงศรัทธาช่วยให้ฟื้นกำลังขึ้น`;
    case 'rescue': {
      const t = RESCUE_TH[s(e.id)];
      return t ? `${t}` : undefined;
    }
    case 'clash':
      return null; // the clash of the NPC tells the result (npc/clash)
    case 'skip':
      return null;
  }
  return undefined;
};

function woundWords(cx: M3Cx, list: string): string {
  const out: string[] = [];
  for (const w of list.split(',').filter(Boolean)) {
    const t = WOUND_TH[w] ?? nm(cx, w);
    if (t) out.push(WOUND_TH[w] ? t : `${t}ติดตัว`);
  }
  return out.join(' และ');
}

// ---------- the newer kinds of npc ----------

/** The `what` of an npc entry that is told here: `follow` `tie` `sick` `well` `heal` `newcomer` `clash` `clash-open`. Null = not for the player. */
export function npcMore(cx: M3Cx, e: LogEntry): string | null | undefined {
  const d = e.data;
  const who = scrub(cx.data, s(d.holder));
  const role = d.role ? ` (${scrub(cx.data, s(d.role))})` : '';
  const of = cx.npcName(s(d.of));
  const place = at(cx, d.place);
  const known = cx.met(e.id);
  switch (d.what) {
    case 'sick': {
      if (!known) return null;
      const w = SICK_TH[s(d.why)];
      return `${who}${role} ล้มป่วย${w ? ` ${w}` : ''}`;
    }
    case 'well':
      return known ? `${who}${role} หายป่วยแล้ว` : null;
    case 'heal':
      return `${who}${role} หายป่วยเพราะได้รับการช่วยเหลือ`;
    case 'newcomer':
      return `${who} มาถึง${place || 'ที่นี่'}`;
    case 'tie': {
      if (!of) return null;
      return `เรื่องของ ${who}${role} เกี่ยวพันกับเรื่องของ ${of}`;
    }
    case 'follow': {
      if (!of) return null;
      const kind = s(d.kind);
      if (kind === 'a') {
        return d.doer === 'mc' ? `${who}${role} เก็บความแค้นที่ ${of} ล้มลง และมุ่งมาหา${cx.who}` : `${who}${role} เก็บความแค้นต่อผู้ที่ทำให้ ${of} ล้มลง`;
      }
      if (kind === 'b') {
        const text = cx.npcText(s(d.text), false);
        return `${who}${role} สานต่อเป้าหมายของ ${of}${text ? ` — ${text}` : ''}`;
      }
      if (kind === 'c') return `${who}${role} ปล่อยวางเรื่องที่ ${of} ทิ้งไว้`;
      return s(d.state) === 'open' ? `เรื่องต่อเนื่องจาก ${of} ของ ${who} เริ่มขึ้น` : `${who} ต้องรับช่วงต่อจากเรื่องของ ${of}`;
    }
    case 'clash-open':
      return `${who}${role} กำลังจะปะทะกับ${cx.who}`;
    case 'clash': {
      const res = (CLASH_RESULT_TH[s(d.outcome)] ?? '').replace('{who}', cx.who);
      const text = clashStory(cx.data, s(d.text), cx.who);
      return `${who}${role} ปะทะกับ${cx.who}${res ? `: ${res}` : ''}${text ? ` — ${text}` : ''}`;
    }
  }
  return undefined;
}

// ---------- the entry point ----------

const SYSTEMS: Record<string, (cx: M3Cx, e: LogEntry) => string | null | undefined> = { bonds, bondage, travel, items: itemsLine, economy, combat };

/** The line of an entry of a system of M3 (see the top of the file for the three answers). */
export function m3Say(cx: M3Cx, e: LogEntry): string | null | undefined {
  const f = SYSTEMS[e.sys];
  if (!f) return undefined;
  const t = f(cx, e);
  return typeof t === 'string' ? tidyLine(t) : t;
}

/** Does the entry belong to a system of M3 that this file tells? */
export const isM3 = (e: LogEntry): boolean => e.sys in SYSTEMS || (e.sys === 'combat' && e.kind === 'battle');

// ---------- the level an entry is shown at ----------

const QUIET_KINDS: Record<string, ReadonlySet<string>> = {
  items: new Set(['dull', 'wear', 'repair', 'wornout', 'buy', 'gear', 'talisman', 'unknown']),
  travel: new Set(['move', 'open', 'blocked']),
  combat: new Set(['clash', 'skip']),
  bonds: new Set(['mood-held', 'among', 'pair-story']),
};

/** The moods that mark a turn in a bond (grief, anger, guilt, fear of loss, love): the others are small weather and stay in the log. */
const FELT_MOODS: ReadonlySet<string> = new Set(['เสียใจ', 'โกรธ', 'แค้น', 'รู้สึกผิด', 'กลัวเสีย', 'เหงา', 'รัก', 'หึง', 'หวงแหน', 'ระแวง']);

/**
 * The level a line is shown at. The systems of M3 write many small lines for the log (a feeling, a meeting that moved a bond by a few points,
 * a blade that went dull, a trade trip) that would flood a screen; they stay in the log and are read at level 0.
 */
export function m3Level(e: LogEntry): LogLevel {
  const d = e.data;
  if (QUIET_KINDS[e.sys]?.has(e.kind)) return 0;
  if (e.sys === 'items') {
    if (e.kind === 'forge' && d.step === 'wait') return 0;
    return e.level;
  }
  if (e.sys === 'bonds') {
    switch (e.kind) {
      case 'arc':
        // the third stage is the crisis, which the line of the crisis tells
        return num(d.stage) === 3 ? 0 : e.level;
      case 'tie':
        // a person who is only known (level 1) and met on the road, at school or at work is a name in the book; a person a story brought is told
        return num(d.level) <= 1 && !NODE_ID.test(s(d.from)) ? 0 : e.level;
      case 'mood':
        // a feeling is told when the bond is close and the cause is not a death that the funeral already tells
        return num(d.level) >= 3 && FELT_MOODS.has(s(d.mood)) && !/ตาย$/.test(s(d.why)) ? 1 : 0;
      case 'level': {
        const why = s(d.why);
        if (why === 'meet' || why === 'silent' || why === 'party') return num(d.to) >= 5 && num(d.to) > num(d.from) ? e.level : 0;
        return e.level;
      }
      case 'invite':
        return ['lover', 'spouse', 'reconcile'].includes(s(d.ask)) ? e.level : 0;
      case 'end':
        return d.way === 'split' || d.way === 'betray' ? e.level : 0;
      case 'news':
        return e.level;
    }
    return e.level;
  }
  if (e.sys === 'travel' && e.kind === 'trip') {
    // a trade trip or the way home is trace; a journey that crosses a continent or answers a cause of the road is told
    const why = s(d.why);
    const far = s(d.from).slice(0, 2) !== s(d.to).slice(0, 2);
    return far || !(why === 'return' || why === 'city' || why.startsWith('job:')) ? e.level : 0;
  }
  if (e.sys === 'combat' && e.kind === 'battle') {
    // a win on the road is not news: it is the cost of the road (the fights of a story, a raid and a clash stay)
    return d.kind === 'travel' && ['win', 'flawless', 'talk', 'tame'].includes(s(d.end ?? d.result)) ? 0 : e.level;
  }
  return e.level;
}
