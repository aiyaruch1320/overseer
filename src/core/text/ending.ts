// The words of the ending, the lineage and the collection as lines of Thai text for the test tools and the debug page. Pure: it reads the data the
// ending and lineage systems made (`EndingCard`, `WorldSummary`, `CollectionView`) and writes no state. The card text itself is made by the ending system
// (src/core/ending, tier 0 templates); these functions only lay it out.
import type { CollectionView } from '../ending/collection';
import type { EndingCard } from '../ending/types';
import type { WorldSummary } from '../lineage/summary';
import type { LogEntry } from '../types';
import { HAND_WORD } from '../ending/tuning';

const HOW_WORD: Record<string, string> = { child: 'ลูกของตน', adopted: 'ลูกบุญธรรม', student: 'ศิษย์', partner: 'คู่ที่ยังอยู่', helped: 'ผู้ที่ตนเคยช่วย', newcomer: 'คนใหม่ในโลกเดิม' };
const ORIGIN_WORD: Record<string, string> = { first: 'ชีวิตแรกของโลก', heir: 'ทายาท', successor: 'ผู้สืบเรื่อง', newcomer: 'คนใหม่ในโลกเดิม' };
const CATEGORY_WORD: Record<string, string> = { node: 'เส้นเรื่อง', convergence: 'จุดบรรจบ', job: 'อาชีพลับ', companion: 'สัตว์คู่หู', talisman: 'เครื่องราง', legend: 'อาวุธตำนาน', event: 'เหตุการณ์ใหญ่', ending: 'ปลายทาง', mode: 'แบบเริ่มต้น', vow: 'คำปฏิญาณที่สำเร็จ', title: 'ฉายาชีวิต', godtitle: 'ฉายาของพระเจ้า', miracle: 'ปาฏิหาริย์ในรายการ', conjure: 'ปาฏิหาริย์ที่เสก', reaction: 'ปฏิกิริยาของการเสก' };

// ---------- the log entries of the ending and the lineage (the reader of the text system calls these) ----------

const WAY_WORD: Record<string, string> = { settle: 'สะสางตามที่ผู้ปกครองเริ่มไว้', newway: 'หาทางใหม่ที่ผู้ปกครองไม่เคยลอง', drop: 'ทิ้งไว้' };
const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export const isEnding = (e: LogEntry): boolean => e.sys === 'ending' || e.sys === 'lineage';

/** The line for an entry of the ending system (`ending/card`) or the lineage (`lineage/end` `lineage/begin` `lineage/thread`). */
export function endingSay(e: LogEntry): string | undefined {
  const d = e.data;
  if (e.sys === 'ending' && e.kind === 'card') return `บันทึกชีวิตจบแล้ว${d.title ? ` · ฉายา ${s(d.title)}` : ''} · ผลต่อโลก ${{ none: 'ไม่ทิ้งรอย', local: 'รอยในถิ่น', era: 'รอยในยุค' }[s(d.mark)] ?? ''}${Number(d.earned) ? ` · ได้ของสะสมใหม่ ${s(d.earned)} รายการ` : ''}`;
  if (e.sys === 'lineage' && e.kind === 'end') return d.heir ? `สายตระกูลไปต่อที่ ${s(d.heir)} (${howWord(s(d.how))})${Number(d.threads) ? ` พร้อมเรื่องค้าง ${s(d.threads)} ข้อ` : ''}` : 'ไม่มีผู้สืบ';
  if (e.sys === 'lineage' && e.kind === 'begin')
    return `${s(d.name)} ${d.origin === 'newcomer' ? `เกิดในโลกเดิมหลัง ${s(d.gap)} ปีโลก` : `รับช่วงต่อจาก ${s(d.parent)} เมื่ออายุ ${s(d.age)}`}${Number(d.gold) ? ` · ได้ทอง ${s(d.gold)}` : ''}${Number(d.items) ? ` ของ ${s(d.items)} ชิ้น` : ''}${Number(d.threads) ? ` · เรื่องค้าง ${s(d.threads)} ข้อ` : ''}`;
  if (e.sys === 'lineage' && e.kind === 'thread') return `เรื่องค้างของตระกูล “${s(d.text)}” (${s(d.kind)}): ${WAY_WORD[s(d.way)] ?? s(d.way)}${s(d.outcome) ? ` — ${s(d.outcome)}` : ''}`;
  return undefined;
}

export const howWord =(how: string): string => HOW_WORD[how] ?? how;
export const originWord = (origin: string): string => ORIGIN_WORD[origin] ?? origin;

/** The card of a life as the player reads it: the nine lines, then the summary and the rest of the page of the life record (03 §1). */
export function cardLines(card: EndingCard): string[] {
  const out: string[] = [];
  out.push(`╭── การ์ดตอนจบ · ${card.generation > 0 ? `รุ่นที่ ${card.generation}` : 'คนใหม่ในโลกเดิม'} ──`);
  for (const l of card.lines) out.push(`│ ${l}`);
  out.push('╰──');
  out.push('บทสรุปชีวิต:', `  ${card.summary.text}`);
  if (card.vow) out.push(card.vow.head, ...card.vow.lines.map((l) => `  ${l}`));
  if (card.people.length) out.push('ผู้คน:', ...card.people.map((l) => `  ${l}`));
  if (card.traces.length) out.push('ร่องรอยที่ทิ้งไว้:', ...card.traces.map((l) => `  ${l}`));
  if (card.hand.total) {
    const kinds = Object.entries(card.hand.byKind).map(([k, n]) => `${HAND_WORD[k] ?? k} ${n}`).join(' · ');
    out.push(`มือของพระเจ้า: ${card.hand.total} ครั้ง (${kinds})${card.hand.top ? ` · ครั้งที่เปลี่ยนชีวิตมากที่สุด: ${card.hand.top.name ? `เสก${card.hand.top.name}` : HAND_WORD[card.hand.top.kind] ?? card.hand.top.kind}${card.hand.top.age !== undefined ? ` เมื่ออายุ ${card.hand.top.age}` : ''}` : ''}`);
  } else out.push(`มือของพระเจ้า: ไม่ได้แทรกแซง${card.hand.silent ? ` · คำอธิษฐานที่เงียบไป ${card.hand.silent}` : ''}`);
  out.push(`ผลต่อโลก: ${card.mark.label}`);
  if (card.earned.length) {
    const by: Record<string, number> = {};
    for (const e of card.earned) by[e.split(':')[0]] = (by[e.split(':')[0]] ?? 0) + 1;
    out.push(`ของสะสมที่ได้ในชีวิตนี้: ${card.earned.length} รายการ (${Object.entries(by).map(([k, n]) => `${CATEGORY_WORD[k] ?? k} ${n}`).join(' · ')})`);
  }
  if (card.heir) out.push(`ผู้สืบ: ${card.heir.name} (${howWord(card.heir.how)} อายุ ${card.heir.age})${card.threads.length ? ` · เรื่องค้างที่ส่งต่อ: ${card.threads.join('; ')}` : ''}`);
  else out.push(`ผู้สืบ: ไม่มี${card.threads.length ? ` · เรื่องค้าง: ${card.threads.join('; ')}` : ''}`);
  return out;
}

/** The summary of the world over the lives of the lineage (03 §7) as lines. */
export function worldSummaryLines(s: WorldSummary): string[] {
  const out: string[] = [];
  out.push(`== สรุปโลก · เมล็ด ${s.seed} ==`);
  out.push(`ตอนนี้ ศ.ม. ${s.year.toLocaleString('en-US')} · ยุค ${s.era} · ตั้งแต่ ศ.ม. ${s.span.from.toLocaleString('en-US')} ผ่านไป ${s.span.years} ปีโลก${s.ended ? ` · โลกจบด้วย ${s.ended.name} (ศ.ม. ${s.ended.year.toLocaleString('en-US')})` : ' · โลกยังเดินต่อ'}`);
  out.push(`สายตระกูล${s.family.dynasty}: ${s.family.generations} รุ่น · เรื่องค้างเปิด ${s.family.threads.open} ปิดแล้ว ${s.family.threads.closed} กลายเป็นตำนาน ${s.family.threads.legend}${s.family.extinct ? ' · สิ้นสาย' : ''}`);
  for (const l of s.lives) {
    out.push(`  ${l.origin === 'newcomer' ? '' : `รุ่นที่ ${l.generation} `}${l.name} (${l.raceName}) ${originWord(l.origin)} · ศ.ม. ${l.born.toLocaleString('en-US')}${l.alive ? ' ถึงปัจจุบัน' : ` ถึง ${l.died!.toLocaleString('en-US')} อายุ ${l.age}`}${l.ending ? ` · ${l.ending}` : ''}${l.mark ? ` · ${{ none: 'ไม่ทิ้งรอย', local: 'รอยในถิ่น', era: 'รอยในยุค' }[l.mark] ?? l.mark}` : ''}${l.hand ? ` · พระหัตถ์ ${l.hand}` : ''}`);
  }
  out.push(`มังกรล้ม ${s.dragons.fallen.length} จาก ${s.dragons.total}${s.dragons.fallen.length ? `: ${s.dragons.fallen.map((d) => `${d.name} (ศ.ม. ${d.year.toLocaleString('en-US')}${d.seenBy.length ? ` · ${d.seenBy.join(',')} เห็น` : ''})`).join(' → ')}` : ''}`);
  out.push(`ประเทศล่ม ${s.countries.ruined.length}${s.countries.ruined.length ? `: ${s.countries.ruined.map((r) => `${r.name} (ศ.ม. ${r.year.toLocaleString('en-US')})`).join(' · ')}` : ''}`);
  out.push(`เหตุการณ์ใหญ่ ${s.events.total} เรื่อง ห้าเรื่องสำคัญ: ${s.events.top.map((e) => `${e.name} (ศ.ม. ${e.year.toLocaleString('en-US')}${e.seenBy.length ? ` · ${e.seenBy.join(',')} เห็น` : ' · ไม่มีใครในสายนี้เห็น'})`).join(' · ')}`);
  out.push(`พระหัตถ์ทั้งสาย ${s.hand.total} ครั้ง${Object.keys(s.hand.byLife).length ? ` (${Object.entries(s.hand.byLife).map(([id, n]) => `${id}: ${n}`).join(' · ')})` : ''}`);
  out.push(`ของสะสม ${s.collection.have} จาก ${s.collection.total}`);
  out.push('ตำนานของโลก:', `  ${s.legend.text}`);
  return out;
}

/** The page of the collection as lines: ratios and the names found; what is not found is a shadow. */
export function collectionLines(v: CollectionView): string[] {
  const out = [`== ของสะสม ${v.have}/${v.total} ==`];
  for (const c of v.categories) {
    const names = c.found.slice(0, 6).map((f) => f.name || '?').join(' · ');
    out.push(`  ${c.name}: ${c.unlimited ? `${c.have} ชื่อ` : `${c.have}/${c.total}`}${names ? ` — ${names}${c.found.length > 6 ? ` และอีก ${c.found.length - 6}` : ''}` : ''}`);
  }
  out.push(`แบบเริ่มต้น: ${v.modes.map((m) => (m.open ? `${m.name}${m.used ? ' ✓' : ''}` : '▒▒▒')).join(' · ')}`);
  return out;
}
