// The lines of the god's hand and of the calls of the game, as the player reads them (docs/appearance/20-god-ui.md, docs/systems/llm/06-god-templates.md).
// The god system writes `god/chest` `god/dream` `god/burden` `god/prayer` `god/prayer.give` ... `god/whisper` `god/miracle` and the attention system writes
// `attention/call`; here each becomes one line of Thai with no id and no number the game keeps to itself. The small stories (what the prayer said, how the
// prayer was granted or refused, how the dream came back at the crossroads) come from `templates-god.json` when a template fits; the plain sentence is
// always there so a line never goes missing. Pure: nothing is drawn from the seed streams.
import type { GameData } from '../game';
import type { LogEntry } from '../types';
import type { Template, TemplatesData } from '../data/types-text';
import { items, labels } from './labels';
import { plainName, scrub, sentence } from './plain';
import { CHEST_KIND_TH, EFFECT_WORD_TH, FLAG_TH, FOLDED_TH, OUTCOME_TH, STAT_TH, TIER_TH } from './tuning';

type D = LogEntry['data'];
const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** What the reader knows that the lines need. */
export interface GodCx {
  data: GameData;
  /** The name of the main character. */
  who: string;
  /** The country the character is in (an id). */
  country: string;
  /** Picks a template of `family` with the row keys and fills it; undefined when none can be filled. `variant` makes the pick stable. */
  tpl(family: string, keys: Record<string, string>, vars: Record<string, string | undefined>, variant: string): string | undefined;
}

const nm = (cx: GodCx, id: unknown): string => plainName(cx.data, id);

// ---------- the templates of the god ----------

const SLOT = /\{([^{}]+)\}/g;

function fillTemplate(text: string, vars: Record<string, string | undefined>): string | undefined {
  let miss = false;
  const out = text.replace(SLOT, (_m, k: string) => {
    const x = vars[k.trim()];
    if (x === undefined || x === '') {
      miss = true;
      return '';
    }
    return x;
  });
  return miss ? undefined : out;
}

export function godTemplate(data: GameData, family: string, keys: Record<string, string>, vars: Record<string, string | undefined>, variant: string, hash: (t: string) => number): string | undefined {
  const t = items<TemplatesData>(data, 'templates-god');
  if (!t) return undefined;
  const list: string[] = [];
  for (const x of t.templates as Template[]) {
    if (x.family !== family || !Object.entries(keys).every(([k, v]) => x.keys[k] === v)) continue;
    const filled = fillTemplate(x.text, vars);
    if (filled) list.push(filled);
  }
  return list.length ? list[hash(variant) % list.length] : undefined;
}

/** The i-th kind of prayer in the data and the key the template files use for it in a family (`prayer_ask` `prayer_give` `prayer_deny`): the files list the 17 kinds in the order of the table. */
function prayerKey(data: GameData, family: string, kind: string): string | undefined {
  const kinds = (items<{ prayers?: { kinds: { id: string }[] } }>(data, 'god')?.prayers?.kinds ?? []).map((k) => k.id);
  const at = kinds.indexOf(kind);
  if (at < 0) return undefined;
  const seen: string[] = [];
  for (const x of items<TemplatesData>(data, 'templates-god')?.templates ?? []) if (x.family === family && x.keys['ชนิด'] && !seen.includes(x.keys['ชนิด'])) seen.push(x.keys['ชนิด']);
  return seen[at];
}

/** The Thai name of a kind of prayer from the table of 03-dreams.md §7.1. */
export function prayerName(data: GameData, kind: string): string {
  const t = items<{ raw?: { header: string[]; rows: string[][]; src: string }[] }>(data, 'god')?.raw?.find((r) => r.header[0] === 'รหัส' && r.header[1] === 'ชื่อ' && r.src.includes('03-dreams'));
  return t?.rows.find((r) => r[0] === kind)?.[1] ?? '';
}

// ---------- the words of an effect ----------

/** The effect words of a prayer (`hp+45` `country:-famine` `gold+10`) as short Thai phrases; a word with nothing to tell the player is left out. */
export function fxPhrases(data: GameData, fx: unknown): string[] {
  const out: string[] = [];
  for (const word of s(fx).split(/\s+/).filter(Boolean)) {
    let m: RegExpExecArray | null;
    if ((m = /^hp([+-])\d+$/.exec(word))) out.push(m[1] === '+' ? 'ร่างกายฟื้นขึ้น' : 'ร่างกายบาดเจ็บ');
    else if ((m = /^country:([+-])(\w+)$/.exec(word))) out.push(`${FLAG_TH[m[2]] ?? 'ภัย'}${m[1] === '-' ? 'ผ่านพ้นไป' : 'ลามมาถึง'}`);
    else if ((m = /^gold([+-])(\d+)$/.exec(word))) out.push(`${m[1] === '+' ? 'ได้' : 'เสีย'}ทอง ${m[2]}`);
    else if ((m = /^([a-z]+)([+-])(\d+)$/.exec(word)) && STAT_TH[m[1]]) out.push(`${STAT_TH[m[1]]}${m[2] === '+' ? 'เพิ่ม' : 'ลด'}`);
    else if ((m = /^curse:(.+)$/.exec(word))) {
      const n = nm({ data } as GodCx, m[1]);
      out.push(n ? `ติดคำสาป ${n}` : m[1] === 'none' ? '' : 'ติดคำสาป');
    } else if ((m = /^uncurse:(.+)$/.exec(word))) {
      const n = nm({ data } as GodCx, m[1]);
      out.push(m[1] === 'none' ? '' : n ? `คำสาป ${n} หลุดไป` : 'คำสาปหลุดไป');
    } else if ((m = /^skill:(.+)$/.exec(word))) {
      const n = nm({ data } as GodCx, m[1]);
      out.push(n ? `ได้ฝีมือ ${n}` : '');
    } else if (EFFECT_WORD_TH[word]) out.push(EFFECT_WORD_TH[word]);
    else if (/^relkill:/.test(word) && word !== 'relkill:none') out.push('คู่อาฆาตสิ้นชีวิต');
  }
  return out.filter(Boolean);
}

// ---------- the lines ----------

/** Where a miracle fell, in words: the log gives `where` (written by the god system); a code is turned into a name, else nothing. */
function placeOf(cx: GodCx, d: D): string {
  const w = scrub(cx.data, s(d.where)).trim();
  if (w) return w;
  const parts = s(d.target).split(/\s+/).map((x) => nm(cx, x.replace(/^[a-z]+:/, ''))).filter(Boolean);
  return parts.join(' และ');
}

/**
 * The line of a log entry of the god, or `null` when the player reads nothing of it, or `undefined` when the god system has no phrasing for it
 * (the reader then shows it plainly only to the developer).
 */
export function godText(cx: GodCx, e: LogEntry, variant: string): string | null | undefined {
  const d = e.data;
  const who = cx.who || 'ตัวละคร';
  const tier = (t: unknown) => (TIER_TH[s(t)] ? ` ระดับ${TIER_TH[s(t)]}` : '');
  switch (e.kind) {
    // the sums the god keeps (income, pay, gain, belief) are for the panel, not the story
    case 'income':
    case 'pay':
    case 'gain':
    case 'belief':
      return null;
    case 'chest':
      switch (e.id) {
        case 'open':
          return `หีบประทานเปิดขึ้น มี ${num(d.slots)} ใบให้เลือก${d.window ? ' ในหน้าต่างพระเจ้า ราคาลดลง' : ''}`;
        case 'reroll':
          return `ทอยหีบใหม่ครั้งที่ ${num(d.n)}`;
        case 'skip':
          return 'พับหีบเก็บ ไม่เลือกสิ่งใด';
        case 'pick': {
          const thing = nm(cx, d.thing);
          const kind = CHEST_KIND_TH[s(d.kind)] ?? 'ของ';
          const ward = d.warded ? ' แต่พรป้องกันคำสาปสะท้อนมันกลับ' : '';
          return `ประทาน${kind}${thing ? ` ${thing}` : ''}${tier(d.tier)}แก่${who}${ward}`;
        }
      }
      return undefined;
    case 'dream': {
      if (d.outcome === 'fade') return 'ความฝันที่ส่งไปเลือนหายก่อนถึงทางแยก';
      if (d.outcome !== undefined) {
        const out = s(d.outcome);
        const verb = OUTCOME_TH[out];
        if (!verb) return undefined;
        const choices = labels(cx.data).choice.get(s(e.id));
        const way = sentence(cx.data, choices?.get(s(d.choice)));
        const other = sentence(cx.data, choices?.get(s(d.alt)));
        const story = cx.tpl('decision_result', { ผล: verb.key }, { ชื่อตัวละคร: who, สัญลักษณ์: s(d.symbol), ชื่อทาง: way, ชื่อทางอื่น: other }, variant);
        return `${who}${verb.plain}${story ? ` — ${story}` : way ? ` (${way})` : ''}`;
      }
      return `ส่งฝันถึง${who}: เขาเห็นภาพ${s(d.symbol)} ใจของเขา${s(d.level) ? `ดู${s(d.level)}` : ''}`;
    }
    case 'burden': {
      switch (e.id) {
        case 'question':
          return `ภาระใจเต็ม: ${who}ตั้งคำถามกับพระเจ้า ท่านตอบได้ก่อนสิ้นปีนี้`;
        case 'flight':
          return `ภาระใจเต็ม: ${who}ทิ้งงานหรือบ้านไปหนึ่งฤดู`;
        case 'nature': {
          const t = labels(cx.data).kind.trait;
          const from = t.get(s(d.from)) ?? nm(cx, d.from);
          const to = t.get(s(d.to)) ?? nm(cx, d.to);
          return `ภาระใจเต็ม: นิสัยของ${who}เปลี่ยนไป${from && to ? ` จาก${from}เป็น${to}` : ''}`;
        }
      }
      return undefined;
    }
    case 'prayer': {
      const name = s(d.name) || prayerName(cx.data, s(e.id));
      const key = prayerKey(cx.data, 'prayer_ask', s(e.id));
      const story = key ? cx.tpl('prayer_ask', { ชนิด: key }, { ชื่อตัวละคร: who, NPC: s(d.npcName), ชื่อของที่นี่: nm(cx, cx.country) || undefined }, variant) : undefined;
      const by = s(d.npcName) ? ` (ผู้ขอคือ ${scrub(cx.data, s(d.npcName))})` : '';
      return `คำอธิษฐานใบที่ ${num(d.n)}: ${name}${by}${story ? ` — ${story}` : ''}`;
    }
    case 'prayer.give': {
      const name = s(d.name) || prayerName(cx.data, s(e.id));
      const key = prayerKey(cx.data, 'prayer_give', s(e.id));
      const story = key ? cx.tpl('prayer_give', { ชนิด: key }, { ชื่อตัวละคร: who, NPC: s(d.npcName), ชื่อของที่นี่: nm(cx, cx.country) || undefined }, variant) : undefined;
      const gift = nm(cx, d.gift);
      const fx = fxPhrases(cx.data, d.fx).join(' · ');
      const tail = story ?? (fx || undefined);
      return `ท่านให้ตามคำอธิษฐานใบที่ ${num(d.n)} (${name})${gift ? ` ด้วยของแปลก: ${gift}` : ''}${tail ? ` — ${tail}` : ''}`;
    }
    case 'prayer.deny': {
      const name = s(d.name) || prayerName(cx.data, s(e.id));
      const key = prayerKey(cx.data, 'prayer_deny', s(e.id));
      const story = key ? cx.tpl('prayer_deny', { ชนิด: key }, { ชื่อตัวละคร: who, NPC: s(d.npcName), ชื่อของที่นี่: nm(cx, cx.country) || undefined }, variant) : undefined;
      return `ท่านปฏิเสธคำอธิษฐานใบที่ ${num(d.n)} (${name})${story ? ` — ${story}` : ''}`;
    }
    case 'prayer.punish': {
      const name = s(d.name) || prayerName(cx.data, s(e.id));
      const fx = fxPhrases(cx.data, d.fx).join(' · ');
      return `ท่านลงโทษผู้ขอคำอธิษฐานใบที่ ${num(d.n)} (${name})${fx ? ` — ${fx}` : ''}`;
    }
    case 'prayer.silent':
      return `ท่านนิ่งเฉยต่อคำอธิษฐานใบที่ ${num(d.n)} (${s(d.name) || prayerName(cx.data, s(e.id))}) มันยังรออยู่จนกว่าจะหมดเวลา`;
    case 'prayer.lapse':
      return `คำอธิษฐานใบที่ ${num(d.n)} (${s(d.name) || prayerName(cx.data, s(e.id))}) หมดเวลา ไม่มีใครตอบ ศรัทธาของเขาลดลง`;
    case 'whisper': {
      const target = nm(cx, d.target);
      const heard = d.obeyed ? 'เขาได้ยินและทำตาม' : 'เขาไม่ใส่ใจ';
      return `ท่านกระซิบ “${s(d.hint)}”${target ? ` ถึง${target}` : ''} — ${heard}`;
    }
    case 'miracle.omen': {
      const name = s(d.name);
      return `ลางของ${name}ปรากฏขึ้น อีก ${num(d.quarters)} ฤดูจะเกิดเหตุ (ลางใบที่ ${num(d.n)} ยกเลิกได้ ได้คืนครึ่งหนึ่ง)`;
    }
    case 'miracle.cancel':
      return `ท่านยกเลิกลางใบที่ ${num(d.n)} ได้พลังคืนครึ่งหนึ่ง`;
    case 'miracle': {
      const where = placeOf(cx, d);
      const result = scrub(cx.data, s(d.result)).trim();
      return `ปาฏิหาริย์ ${s(d.name)}${where ? ` ที่${where}` : ''}${result ? `: ${result}` : ''}`;
    }
  }
  return undefined;
}

// ---------- the calls of the game ----------

/** The reason the game called the player, in words: `ถึงจุดหยุดตามอายุ 15` `มีคำอธิษฐานใหม่: ขอหายเจ็บ` ... */
export function callReason(data: GameData, e: LogEntry): string {
  const d = e.data;
  const first = s(e.id).split(',')[0];
  const name = (id: string) => plainName(data, id);
  let why: string;
  switch (s(d.why)) {
    case 'age':
      why = `ถึงจุดหยุดตามอายุ ${s(d.age)}`;
      break;
    case 'window': {
      const title = name(first);
      why = `ถึงทางแยกที่พระเจ้าแทรกได้${title ? `: ${title}` : ''}`;
      break;
    }
    case 'majorOmen': {
      const ev = name(first);
      why = `มีลางใหญ่ใกล้ตัว${ev ? `: ${ev}` : ''}`;
      break;
    }
    case 'omen': {
      const ev = name(first);
      why = `มีลางของเหตุการณ์โลก${ev ? `: ${ev}` : ''}`;
      break;
    }
    case 'nearDeath':
      why = 'ชีวิตใกล้ถึงฉากสุดท้าย';
      break;
    case 'death':
      why = 'ชีวิตจบลงแล้ว';
      break;
    case 'prayer': {
      const n = prayerName(data, first);
      why = `มีคำอธิษฐานใหม่${n ? `: ${n}` : ''}`;
      break;
    }
    case 'battle':
      why = 'ศึกกำลังจะมาถึง';
      break;
    case 'crisis':
      why = 'คนใกล้ตัวตกอยู่ในวิกฤต';
      break;
    default:
      why = 'ถึงจังหวะที่ผู้เล่นควรดู';
  }
  const folded = s(d.cards)
    .split(',')
    .filter(Boolean)
    .map((k) => FOLDED_TH[k])
    .filter(Boolean);
  const uniq = [...new Set(folded)];
  return `${why}${d.call === 'stop' && uniq.length ? ` · มีเรื่องรออยู่ด้วย: ${uniq.join(' · ')}` : ''}`;
}

/** The line of an `attention` entry: a stop (the game waits for the player) or a card (time goes on); the glow and the missed card are not told. */
export function attentionText(data: GameData, e: LogEntry): string | null | undefined {
  if (e.kind === 'glow' || e.kind === 'missed') return null;
  if (e.kind !== 'call') return undefined;
  const d = e.data;
  const reason = callReason(data, e);
  if (d.call === 'stop') return `เกมหยุดรอท่าน: ${reason}`;
  const until = typeof d.until === 'number' ? ` · ${d.why === 'prayer' ? 'ตอบได้' : 'รอท่านอยู่'}จนอายุ ${Math.floor(d.until)}` : '';
  return `${reason}${until}`;
}

// ---------- the chronicle of the hand ----------

/** The Thai name of a miracle from its table (04-miracles.md §3). */
export function miracleName(data: GameData, id: string): string {
  return items<{ miracles?: { list: { id: string; name: string }[] } }>(data, 'god')?.miracles?.list.find((m) => m.id === id)?.name ?? '';
}

/** One line of `state.god.chronicle` (the hand of the god over a life) as the player reads it: what the hand did, to whom, with what result. */
export function chronicleText(data: GameData, c: { kind: string; id: string; target?: string; result?: string }): string {
  const name = (id: unknown) => plainName(data, id);
  const target = (t: string | undefined) => {
    const parts = s(t).split(/\s+/).filter(Boolean).map((x) => name(x.replace(/^[a-z]+:/, ''))).filter(Boolean);
    return parts.join(' และ');
  };
  switch (c.kind) {
    case 'chest.pick':
      return `ประทาน ${name(c.id) || 'ของจากหีบ'}${c.result === 'warded' ? ' (พรป้องกันคำสาปไว้)' : ''}`;
    case 'chest.skip':
      return 'ข้ามหีบประทาน';
    case 'dream': {
      const r = s(c.result);
      if (r.startsWith('sent:')) return `ส่งฝัน (ใจของเขา${r.slice(5)})`;
      if (r === 'faded') return 'ความฝันเลือนหายก่อนถึงทางแยก';
      const [level, outcome] = r.split(':');
      return `ความฝันถึงทางแยก (ใจของเขา${level}): ${(OUTCOME_TH[outcome]?.plain ?? outcome).replace('ของท่าน', '')}`;
    }
    case 'burden':
      return 'ภาระใจ: ท่านตอบคำถามที่เขาถามฟ้า';
    case 'miracle.omen':
      return `ลางของ${miracleName(data, c.id) || 'ปาฏิหาริย์'}${target(c.target) ? ` ที่${target(c.target)}` : ''}`;
    case 'miracle.cancel':
      return `ยกเลิกลางของ${miracleName(data, c.id) || 'ปาฏิหาริย์'}`;
    case 'miracle': {
      const t = target(c.target) || (/^dragon:/.test(s(c.target)) ? 'มังกร' : '');
      const r = scrub(data, s(c.result)).trim();
      return `${miracleName(data, c.id) || 'ปาฏิหาริย์'}${t ? ` ที่${t}` : ''}${r ? ` → ${r}` : ''}`;
    }
    case 'prayer.give':
    case 'prayer.strange': {
      const fx = fxPhrases(data, c.result).join(' · ');
      const gift = c.kind === 'prayer.strange' ? name(c.result) : '';
      return `ให้ตามคำอธิษฐาน: ${prayerName(data, c.id)}${gift ? ` (ของแปลก ${gift})` : ''}${fx ? ` → ${fx}` : ''}`;
    }
    case 'prayer.deny':
      return `ปฏิเสธคำอธิษฐาน: ${prayerName(data, c.id)}`;
    case 'prayer.punish': {
      const fx = fxPhrases(data, c.result).join(' · ');
      return `ลงโทษผู้ขอ: ${prayerName(data, c.id)}${fx ? ` → ${fx}` : ''}`;
    }
    case 'prayer.lapse':
      return `คำอธิษฐานหมดเวลา: ${prayerName(data, c.id)}`;
    case 'whisper': {
      const t = target(c.target);
      const r = s(c.result);
      return `กระซิบ “${c.id}”${t ? ` ถึง${t}` : ''}${r ? ` (${r})` : ''}`;
    }
  }
  return '';
}
