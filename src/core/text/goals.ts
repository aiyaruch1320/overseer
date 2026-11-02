// The lines of the goals and of the conjuring (docs/systems/god/07-conjure.md, 08-goals.md): the vows offered, taken and judged, the titles of a life, the line of the chronicle
// of the lineage, what it opened, the rhythm of fate, and the conjuring (its omen, its day, the shadow it cast, the name the world gives it). The god system writes
// `god/vow.*` `god/title` `god/lineage` `god/unlock` `god/rhythm` `god/overreach` `god/conjure*`; here each becomes one line of Thai. Pure: nothing is drawn from the seed streams.
import type { LogEntry } from '../types';
import type { GodCx } from './god';
import { plainName } from './plain';

const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const quote = (t: string) => `“${t}”`;

/** The numbered list of the names of vows: `1 ก · 2 ข · 3 ค`. */
function numbered(names: string): string {
  return names
    .split(' · ')
    .filter(Boolean)
    .map((n, i) => `${i + 1} ${n}`)
    .join(' · ');
}

/** The name of a place in a conjuring: a country or a continent by its code. */
const place = (cx: GodCx, id: unknown): string => plainName(cx.data, id) || s(id);

/** The line of one entry of the goals or the conjuring; undefined when the entry is not theirs. */
export function goalsText(cx: GodCx, e: LogEntry): string | undefined {
  const d = e.data;
  const who = cx.who || 'ตัวละคร';
  switch (e.kind) {
    case 'vow.offer':
      return `เมื่อ${who}เกิด เกมเสนอคำปฏิญาณแก่ท่าน ${num(d.n)} ข้อ: ${numbered(s(d.names))} (หรือไม่ปฏิญาณ: ข้อ ${num(d.n) + 1})`;
    case 'vow.reoffer':
      return `${who}ถึงอายุ 15 ${d.current ? `ท่านเปลี่ยนคำปฏิญาณ ${quote(s(d.current))} ได้ครั้งเดียว` : 'ท่านเลือกคำปฏิญาณได้อีกครั้งเดียว'}: ${numbered(s(d.names))} (หรือไม่ปฏิญาณ: ข้อ ${num(d.n) + 1})`;
    case 'vow.take':
      return e.id === 'GV-20' ? `ท่านไม่ปฏิญาณในชีวิตของ${who}` : `ท่านปฏิญาณ ${quote(s(d.name))}`;
    case 'vow.change':
      return e.id === 'GV-20' ? `ท่านถอนคำปฏิญาณ${d.from ? ` ${quote(s(d.from))}` : ''} ไม่ปฏิญาณอีก` : `ท่านเปลี่ยนคำปฏิญาณ${d.from ? ` จาก ${quote(s(d.from))}` : ''} เป็น ${quote(s(d.name))}`;
    case 'vow.result':
      return d.result === 'kept' ? `คำปฏิญาณ ${quote(s(d.name))} เป็นจริง` : `คำปฏิญาณ ${quote(s(d.name))} ไม่เป็นจริง ชีวิตของ${who}ไปทางอื่น`;
    case 'title':
      return `ฉายาชีวิตของ${who}: ${s(d.title)}`;
    case 'lineage':
      return s(d.text);
    case 'unlock':
      return `พงศาวดารสายตระกูลถึง ${num(d.at)}: เปิด ${s(d.opens)}`;
    case 'rhythm':
      return `จังหวะชะตาของโลกนี้: ${s(d.name)}`;
    case 'overreach':
      return `คนใกล้ตัวเริ่มพูดว่า${who} “รอฟ้า” (ได้รับการประทานมา ${num(d.gifts)} ครั้งแล้ว)`;
    case 'conjure.omen':
      return `ท่านเริ่มเสก “${s(d.name)}” ที่${place(cx, d.target)} ลาง: ${s(d.omen)} (อีก ${num(d.quarters)} ฤดูก่อนเกิดเหตุ)`;
    case 'conjure':
      return `${s(d.name)} — ${s(d.result)} (${s(d.verb)}${s(d.core)} ขนาด${s(d.scale)}${d.target ? ` ที่${place(cx, d.target)}` : ''})${d.react ? ` · ${s(d.react)}` : ''}`;
    case 'conjure.shadow':
      return `เงาสะท้อนของ “${s(d.name)}”: ${s(d.result)}`;
    case 'conjure.cancel':
      return `ท่านยกเลิกลางของ “${s(d.name)}” ได้พลังคืนบางส่วน`;
    default:
      return undefined;
  }
}
