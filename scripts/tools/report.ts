// Readable text of a game for the test tools: the log as a timeline, the NPCs met, the summary of a life.
// Pure TypeScript, shared by `npm run life`, `npm run play` and the debug page.
import { makeCtx, type GameData } from '../../src/core/game';
import { countSlots } from '../../src/core/npc';
import { calendarYear, classLabel, describe, formatLine, lines, placeName, raceName } from '../../src/core/text';
import type { GameState, LogEntry, LogLevel } from '../../src/core/types';

/** The short tag in front of a line: which part of the game said it. */
export function tagOf(e: LogEntry): string {
  switch (e.sys) {
    case 'story':
      return 'เรื่อง';
    case 'world':
      return 'โลก';
    case 'npc':
      return 'NPC';
    case 'game':
      return 'ตาย';
    case 'text':
      return 'เกิด';
    case 'god':
      return 'พระเจ้า';
    default:
      return e.sys;
  }
}

/** The timeline of a log: `อายุ 23 · ศ.ม. 10,450 │ [NPC] text`, entries below `minLevel` left out. */
export function timeline(data: GameData, log: LogEntry[], minLevel: LogLevel = 1): string[] {
  const out: string[] = [];
  for (const e of log) {
    if (e.level < minLevel) continue;
    const ls = lines(data, [e], 0);
    if (!ls.length) continue;
    out.push(formatLine({ ...ls[0], text: `[${tagOf(e)}] ${ls[0].text}` }));
  }
  return out;
}

export interface Met {
  id: string;
  holder: string;
  role: string;
  place: string;
  age: number | undefined;
  year: number;
}

/** NPCs the main character met (log entries `npc` / `meet`), first meeting of each holder. */
export function metNpcs(data: GameData, log: LogEntry[]): Met[] {
  const seen = new Set<string>();
  const out: Met[] = [];
  for (const e of log) {
    if (e.sys !== 'npc' || e.data.what !== 'meet') continue;
    const key = `${e.id}|${String(e.data.holder)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: e.id ?? '', holder: String(e.data.holder), role: String(e.data.role ?? ''), place: String(e.data.place ?? ''), age: e.age, year: calendarYear(e.worldYear) });
  }
  void data;
  return out;
}

export function statusLines(data: GameData, state: GameState): string[] {
  const life = state.life;
  const out: string[] = [];
  const ctx = makeCtx(state, data);
  if (!life) return ['ยังไม่มีชีวิต'];
  const home = (id: string) => placeName(ctx, id) ?? id;
  out.push(`${life.name} · ${raceName(ctx, life.race)} · ${life.gender === 'm' ? 'ชาย' : 'หญิง'} · ${classLabel(ctx, life.cls)}`);
  out.push(`อายุ ${life.hAge} (ปีชีวิต) · ศ.ม. ${calendarYear(state.clock.worldYear).toLocaleString('en-US')} · ช่วงที่ ${state.clock.quarter + 1}/4 ของปี`);
  out.push(`อยู่ที่ ${home(life.country)} · เกิดที่ ${home(life.home)} · ทอง ${life.gold}`);
  if (life.dead) out.push(`ตายแล้ว: ${life.dead.cause} เมื่ออายุ ${life.dead.hAge}`);
  const c = countSlots(state);
  out.push(`NPC: มีชีวิต ${c.alive} (เรื่องเปิดอยู่ ${c.open} รอ ${c.waiting} จบแล้ว ${c.done}) · ตาย ${c.dead} · หาย ${c.gone} · ไม่ปรากฏ ${c.absent}`);
  if (life.memory.length) out.push(`ความทรงจำ: ${life.memory.join(' · ')}`);
  const w = state.world;
  out.push(`โลก: ยุค ${w.era} · มังกรล้ม ${w.dfc} · เหตุการณ์ที่เกิดแล้ว ${Object.keys(w.happened).length}`);
  return out;
}

export function summaryLines(data: GameData, state: GameState, beats: number): string[] {
  const life = state.life;
  const out: string[] = [];
  const bySys: Record<string, number> = {};
  for (const e of state.log) if (e.level >= 1) bySys[e.sys] = (bySys[e.sys] ?? 0) + 1;
  if (life) {
    out.push(`${life.name} ${life.dead ? `ตายเมื่ออายุ ${life.dead.hAge} (${life.dead.cause}) ศ.ม. ${calendarYear(life.dead.year).toLocaleString('en-US')}` : `ยังมีชีวิต อายุ ${life.hAge}`} · ${beats} จังหวะ`);
  }
  out.push(`บันทึกระดับ 1 ขึ้นไป: ${Object.entries(bySys).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ไม่มี'}`);
  const unhandled = state.log.filter((e) => e.sys === 'rules' && e.kind === 'unhandled').map((e) => e.id);
  if (unhandled.length) out.push(`กติกาที่ยังไม่มีใครรับ: ${unhandled.join(' ')}`);
  void data;
  return out;
}
