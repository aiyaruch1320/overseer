// Readable text of a game for the test tools: the log as a timeline, the NPCs met, the status of the life, the summary of a life.
// Pure TypeScript, shared by `npm run life`, `npm run play` and the debug page.
import { extOf as bondageOf } from '../../src/core/bondage';
import { adultAgeOf, crisesWaiting, extOf as bondsOf, hAgeOf, isChild, isLive, isPartner, levelOf as bondLevelOf, stageOfAge, tiesOf, type Tie } from '../../src/core/bonds';
import { makeCtx, type Ctx, type GameData } from '../../src/core/game';
import { countSlots } from '../../src/core/npc';
import { calendarYear, causeWord, chronicleText, classLabel, formatLine, labels, lineWord, lines, peopleCode, placeName, questionOf, raceName, Reader, scrub, unphrased } from '../../src/core/text';
import { OUTCOME_TH } from '../../src/core/text/tuning';
import { BOND_LEVEL_TH, TRAVEL_LEVEL_TH } from '../../src/core/text/words';
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
    case 'attention':
      return 'เรียก';
    case 'character':
      return 'ตัวละคร';
    case 'tools':
      return 'ชีวิต';
    case 'bonds':
      return 'พวกพ้อง';
    case 'bondage':
      return 'พันธะ';
    case 'travel':
      return 'เดินทาง';
    case 'items':
      return 'ของ';
    case 'economy':
      return 'เงินทอง';
    case 'combat':
      return 'ศึก';
    default:
      return e.sys;
  }
}

/** A change the tools noticed between two beats that the systems wrote no log entry for (the social class, review M1 T9). */
export interface ToolNote {
  /** The running number of the log when it was noticed: the note sits before the entry with this number. */
  n: number;
  worldYear: number;
  age: number | undefined;
  quarter: number;
  from: string;
  to: string;
}

/** The notes as log entries of the system `tools` (not part of the game state). */
export function noteEntries(notes: ToolNote[]): LogEntry[] {
  return notes.map((x) => ({
    n: x.n - 0.5,
    worldYear: x.worldYear,
    age: x.age,
    quarter: x.quarter,
    sys: 'tools',
    kind: 'class',
    data: { from: x.from, to: x.to, up: Number(x.to.replace(/\D/g, '')) - Number(x.from.replace(/\D/g, '')) },
    level: 2 as LogLevel,
  }));
}

/** The log with the tool notes in their places. */
export function withNotes(log: LogEntry[], notes: ToolNote[] = []): LogEntry[] {
  if (!notes.length) return log;
  const extra = noteEntries(notes);
  const out: LogEntry[] = [];
  let i = 0;
  for (const e of log) {
    while (i < extra.length && extra[i].n < e.n) out.push(extra[i++]);
    out.push(e);
  }
  while (i < extra.length) out.push(extra[i++]);
  return out;
}

/**
 * The timeline of a log: `อายุ 23 · ศ.ม. 10,450 │ [NPC] text`, lines below `minLevel` left out. `fromN` keeps the entries from that
 * running number on; the whole log is still read, so a death names the place and an NPC the character did not meet stays out.
 */
export function timeline(data: GameData, log: LogEntry[], minLevel: LogLevel = 1, opts: { fromN?: number; notes?: ToolNote[] } = {}): string[] {
  return lines(data, withNotes(log, opts.notes), minLevel, opts.fromN ?? -Infinity).map((l) => formatLine({ ...l, text: `[${tagOf(l.entry)}] ${l.text}` }));
}

export interface Met {
  id: string;
  holder: string;
  role: string;
  place: string;
  age: number | undefined;
  year: number;
}

/** NPCs the main character met (log entries `npc` / `meet`), first meeting of each holder; the place is a name, never a code. */
export function metNpcs(data: GameData, log: LogEntry[]): Met[] {
  const seen = new Set<string>();
  const names = labels(data).name;
  const out: Met[] = [];
  for (const e of log) {
    if (e.sys !== 'npc' || e.data.what !== 'meet') continue;
    const key = `${e.id}|${String(e.data.holder)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = String(e.data.place ?? '');
    out.push({ id: e.id ?? '', holder: scrub(data, String(e.data.holder)), role: scrub(data, String(e.data.role ?? '')), place: names.get(place) ?? '', age: e.age, year: calendarYear(e.worldYear) });
  }
  return out;
}

const KIN_LINES = new Set(['ญาติผู้ใหญ่', 'ญาติรุ่นเยาว์', 'พี่น้อง']);
const STAGE_TH = { infant: 'ทารก', child: 'วัยเรียน', youth: 'วัยรุ่น', adult: 'ผู้ใหญ่' } as const;

/** `ชื่อ (สาย ระดับ)`: a person of the bonds as the status reads him. */
function tieWord(ctx: Ctx, data: GameData, t: Tie): string {
  const lv = bondLevelOf(ctx, t);
  const names = (data.bonds?.items as { ties?: { levels?: { n: number; name: string }[] } } | undefined)?.ties?.levels;
  return `${t.name} (${lineWord(t.line, t.kin)} ${names?.find((l) => l.n === lv)?.name ?? BOND_LEVEL_TH[lv] ?? ''})`.replace(' )', ')');
}

/** The allies and the family of the life, the travel, the arm in hand, the debt and the bondage: what the systems of M3 keep that the player may ask about. */
export function systemStatus(data: GameData, state: GameState): string[] {
  const life = state.life;
  if (!life) return [];
  const ctx = makeCtx(state, data);
  const L = labels(data);
  const out: string[] = [];
  // ties: the family and the allies, the closest first; a name only, with the line and the level
  const ties = data.bonds ? tiesOf(bondsOf(life)).filter(isLive) : [];
  const byCloseness = (a: Tie, b: Tie) => b.b - a.b;
  const children = ties.filter(isChild).sort((a, b) => hAgeOf(ctx, b) - hAgeOf(ctx, a));
  const family = ties.filter((t) => KIN_LINES.has(t.line) && !t.light && !isChild(t)).sort(byCloseness);
  const kinFar = ties.filter((t) => KIN_LINES.has(t.line) && t.light).length;
  // the partner, the children (their age, stage and the other parent) and the crises that wait for the character's answer
  const partnerId = data.bonds ? bondsOf(life).partner : null;
  const partner = ties.find((t) => t.id === partnerId) ?? ties.find(isPartner);
  if (partner) out.push(`${partner.spouse ? 'คู่ชีวิต' : 'คนรัก'} ${tieWord(ctx, data, partner)}${partner.country !== life.country ? ` · อยู่ที่${placeName(ctx, partner.country) ?? ''}` : ''}`);
  if (children.length) out.push(`ลูก ${children.map((c) => `${c.name} (อายุ ${Math.floor(hAgeOf(ctx, c))} ${STAGE_TH[stageOfAge(Math.floor(hAgeOf(ctx, c)), adultAgeOf(ctx, c))]}${c.kin === 'adopted' ? ' · ลูกบุญธรรม' : ''}${c.otherName ? ` · อีกฝ่ายคือ ${c.otherName}` : ''})`).join(' · ')}`);
  const allies = ties.filter((t) => !KIN_LINES.has(t.line) && t.id !== partner?.id).sort(byCloseness);
  const waiting = data.bonds ? crisesWaiting(ctx) : [];
  if (waiting.length) out.push(`วิกฤตที่รอคำตอบ ${waiting.map((w) => `${w.tie.name} (${w.tie.line}): ${scrub(data, w.crisis.text)}`).join(' · ')}`);
  if (allies.length) out.push(`พวกพ้อง ${allies.slice(0, 8).map((t) => tieWord(ctx, data, t)).join(' · ')}${allies.length > 8 ? ` · และอีก ${allies.length - 8} คน` : ''}`);
  if (family.length || kinFar) out.push(`ครอบครัว ${[...family.slice(0, 8).map((t) => tieWord(ctx, data, t)), ...(kinFar ? [`ญาติห่าง ๆ อีก ${kinFar} คน`] : [])].join(' · ')}`);
  // travel: the level of the life and where he stands
  const tr = life.ext.travel as { level?: number; visited?: string[]; away?: { to: string; settle: boolean } } | undefined;
  if (tr && tr.level !== undefined) {
    const away = tr.away ? ` · กำลังเดินทางไป${placeName(ctx, tr.away.to) ?? ''}` : '';
    out.push(`การเดินทาง ${TRAVEL_LEVEL_TH[tr.level] ?? ''}${tr.visited?.length ? ` · เคยไป ${tr.visited.length} ประเทศ` : ''}${away}`);
  }
  // the arm in hand
  const it = life.ext.items as { wield?: string; armor?: string } | undefined;
  const wield = it?.wield ? L.name.get(it.wield) : undefined;
  const armor = it?.armor ? L.name.get(it.armor) : undefined;
  if (wield || armor) out.push(`อาวุธที่ถือ ${wield ?? 'ไม่มี'}${armor ? ` · สวม ${armor}` : ''}`);
  // debt and bondage
  const eco = life.ext.economy as { debt?: number } | undefined;
  if (eco?.debt && eco.debt > 0) out.push(`หนี้ ${Math.round(eco.debt)} ทอง`);
  if (life.ext.bondage) {
    const b = bondageOf(life);
    const lvName = (data.bondage?.items as { levels?: { n: number; name: string }[] } | undefined)?.levels?.find((l) => l.n === b.level)?.name;
    if (b.level > 0) {
      const where = b.country ? placeName(ctx, b.country) : undefined;
      out.push(`การผูกตัว ${lvName ?? 'ถูกผูกตัว'}${where ? ` ที่${where}` : ''}${b.owner ? ` · เจ้าของ ${b.owner}` : ''}${b.price ? ` · ค่าไถ่ ${b.price} ทอง` : ''}${b.debt ? ` · หนี้ผูกตัวเหลือ ${Math.round(b.debt)} ทอง` : ''}${b.years ? ` · สัญญาเหลือ ${b.years} ปี` : ''}`);
    }
    const held = b.held.filter((h) => !h.gone);
    if (held.length) out.push(`ผู้ที่ถือสัญญาไว้ ${held.map((h) => h.name).join(' · ')}`);
  }
  return out;
}

const SEX = { m: 'ชาย', f: 'หญิง', n: '' } as const;

/** What the player knows of the life now (review M1 T7): who, where, the class and the gold, the work, the traits, the gifts, the last person met, the question. */
export function statusLines(data: GameData, state: GameState): string[] {
  const life = state.life;
  const out: string[] = [];
  const ctx = makeCtx(state, data);
  if (!life) return ['ยังไม่มีชีวิต'];
  const L = labels(data);
  const className = (c: typeof ctx, cls: string) => {
    const n = classLabel(c, cls);
    return n.startsWith('ชนชั้น') ? n : `ชนชั้น${n}`;
  };
  const home = (id: string) => placeName(ctx, id) ?? '';
  const sex = SEX[life.gender];
  out.push(`${life.name} · ${raceName(ctx, life.race)}${sex ? ` ${sex}` : ''} · อายุ ${life.hAge} (ปีชีวิต) · ศ.ม. ${calendarYear(state.clock.worldYear).toLocaleString('en-US')}`);
  const where = home(life.country);
  const born = home(life.home);
  out.push(`อยู่ที่ ${where}${born && born !== where ? ` (เกิดที่ ${born})` : ''} · ${className(ctx, life.cls)} · ทอง ${life.gold}`);
  const job = life.job ? L.kind.job.get(life.job) : undefined;
  const secret = life.secretJob ? L.kind.job.get(life.secretJob) : undefined;
  out.push(`อาชีพ ${[job, secret ? `${secret} (ลับ)` : undefined].filter(Boolean).join(' · ') || 'ยังไม่มี'}`);
  const named = (ids: string[], map: Map<string, string>) => ids.map((x) => map.get(x) ?? L.name.get(x)).filter((x): x is string => !!x);
  const traits = named(life.traits, L.kind.trait);
  if (traits.length) out.push(`นิสัย ${traits.join(' · ')}`);
  const apt = Object.entries(life.aptitudes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, v]) => `${L.kind.aptitude.get(id) ?? L.name.get(id) ?? ''} ระดับ ${v}`)
    .filter((x) => !x.startsWith(' '));
  if (apt.length) out.push(`ความถนัดเด่น ${apt.join(' · ')}`);
  const blessings = named(life.blessings, L.kind.blessing);
  const curses = named(life.curses, L.kind.curse);
  if (blessings.length || curses.length) out.push(`พร ${blessings.join(' · ') || 'ไม่มี'} · คำสาป ${curses.join(' · ') || 'ไม่มี'}`);
  // what the god gave that is carried: a weapon or a thing shows here, so that "ประทาน" can be seen in the status (review M2 P5)
  const carried = named(life.items, L.name);
  if (carried.length) out.push(`ของติดตัว ${carried.join(' · ')}`);
  out.push(...systemStatus(data, state));
  const last = [...state.log].reverse().find((e) => e.sys === 'npc' && e.data.what === 'meet');
  if (last) {
    const role = last.data.role ? ` (${scrub(data, String(last.data.role))})` : '';
    const place = L.name.get(String(last.data.place ?? ''));
    out.push(`พบล่าสุด ${scrub(data, String(last.data.holder))}${role}${place ? ` ที่${place}` : ''} เมื่ออายุ ${last.age ?? '?'}`);
  }
  const q = questionOf(data, peopleCode(ctx, life.race));
  if (q) out.push(`คำถามของชีวิต ${q}`);
  if (life.dead) {
    const c = causeWord(life.dead.cause);
    out.push(`ตายแล้ว${c ? ` (${c})` : ''} เมื่ออายุ ${life.dead.hAge}`);
  }
  return out;
}

/** The numbers of the world and the NPC roster: for the developer (`npm run play -- --cmd=world`), not for the player. */
export function worldLines(state: GameState): string[] {
  const out: string[] = [];
  const c = countSlots(state);
  out.push(`NPC: มีชีวิต ${c.alive} (เรื่องเปิดอยู่ ${c.open} รอ ${c.waiting} จบแล้ว ${c.done}) · ตาย ${c.dead} · หาย ${c.gone} · ไม่ปรากฏ ${c.absent}`);
  const w = state.world;
  out.push(`โลก: ยุค ${w.era} · มังกรล้ม ${w.dfc} · เหตุการณ์ที่เกิดแล้ว ${Object.keys(w.happened).length}`);
  const life = state.life;
  if (life) {
    out.push(`ช่วงที่ ${state.clock.quarter + 1}/4 ของปี · ศรัทธาต่อพระเจ้า ${life.godFaith} · ภาระใจ ${life.heart}`);
    if (life.memory.length) out.push(`ความทรงจำของผู้กำกับ: ${life.memory.join(' · ')}`);
  }
  return out;
}

export function summaryLines(data: GameData, state: GameState, beats: number): string[] {
  const life = state.life;
  const out: string[] = [];
  const bySys: Record<string, number> = {};
  // the level the player reads each entry at (the small lines of the systems of M3 are trace), not the level the system wrote
  const reader = new Reader(data);
  for (const e of state.log) {
    reader.read(e);
    if (reader.levelOf(e) >= 1) bySys[e.sys] = (bySys[e.sys] ?? 0) + 1;
  }
  if (life) {
    out.push(`${life.name} ${life.dead ? `ตายเมื่ออายุ ${life.dead.hAge} (${causeWord(life.dead.cause) || 'ไม่ทราบเหตุ'}) ศ.ม. ${calendarYear(life.dead.year).toLocaleString('en-US')}` : `ยังมีชีวิต อายุ ${life.hAge}`} · ${beats} จังหวะ`);
  }
  out.push(`บันทึกระดับ 1 ขึ้นไป: ${Object.entries(bySys).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ไม่มี'}`);
  const unhandled = state.log.filter((e) => e.sys === 'rules' && e.kind === 'unhandled').map((e) => e.id);
  if (unhandled.length) out.push(`กติกาที่ยังไม่มีใครรับ: ${unhandled.join(' ')}`);
  const plain = unphrased(data, state.log);
  if (Object.keys(plain).length) out.push(`บันทึกที่ยังไม่มีข้อความ (ไม่แสดงต่อผู้เล่น): ${Object.entries(plain).map(([k, v]) => `${k} ×${v}`).join(' ')}`);
  return out;
}

/** The kinds of the chronicle in the count of the power used: what the player calls them. */
const CHRONICLE_KIND: Record<string, string> = {
  'chest.pick': 'ประทาน',
  'chest.skip': 'ข้ามหีบ',
  dream: 'ฝัน',
  burden: 'ภาระใจ',
  whisper: 'กระซิบ',
  'prayer.give': 'ให้ตามคำอธิษฐาน',
  'prayer.strange': 'ให้แบบแปลก',
  'prayer.deny': 'ปฏิเสธคำอธิษฐาน',
  'prayer.punish': 'ลงโทษผู้ขอ',
  miracle: 'ปาฏิหาริย์',
  'miracle.omen': 'ลางปาฏิหาริย์',
  'miracle.cancel': 'ยกเลิกลาง',
};

/**
 * The hand of the god over one life, for the end of `npm run life`: the power left, how many times each kind of act was used, and
 * the chronicle of the hand (`state.god.chronicle`). Empty when the god did nothing and there is no policy.
 */
export function godLines(data: GameData, state: GameState, policy?: string): string[] {
  const g = state.god;
  // a prayer that ran out unanswered is in the chronicle (the silence is part of the hand), but it is not a use of power
  const lapsed = g.chronicle.filter((c) => c.kind === 'prayer.lapse').length;
  // the chronicle holds a dream twice: when it was sent and when the character reached the crossroads; only the sending is a use of power (review M2 P16)
  const isOutcome = (c: { kind: string; result?: string }) => c.kind === 'dream' && !String(c.result ?? '').startsWith('sent:');
  const outcomes = g.chronicle.filter(isOutcome);
  const acts = g.chronicle.filter((c) => c.kind !== 'prayer.lapse' && !isOutcome(c));
  if (!policy && !acts.length) return lapsed ? [`คำอธิษฐานที่ไม่ได้ตอบ ${lapsed} ใบ`] : [];
  const out: string[] = [];
  const round = (n: number) => Math.round(n * 10) / 10;
  out.push(`พลังที่เหลือ: แสงศรัทธา ${round(g.light)} · ความหวาดกลัว ${round(g.dread)}${state.life ? ` · ศรัทธาเทพ ${state.life.godFaith} · ภาระใจ ${state.life.heart}` : ''}`);
  const used: Record<string, number> = {};
  for (const c of acts) {
    const k = CHRONICLE_KIND[c.kind] ?? c.kind;
    used[k] = (used[k] ?? 0) + 1;
  }
  out.push(`ใช้พลัง ${acts.length} ครั้ง${acts.length ? `: ${Object.entries(used).map(([k, v]) => `${k} ×${v}`).join(' · ')}` : ''}`);
  if (outcomes.length) {
    const tally: Record<string, number> = {};
    for (const c of outcomes) {
      const r = String(c.result ?? '');
      const k = r === 'faded' ? 'เลือนหายก่อนถึงทางแยก' : (OUTCOME_TH[r.split(':')[1]]?.plain ?? r).replace('ของท่าน', '').trim();
      tally[k] = (tally[k] ?? 0) + 1;
    }
    out.push(`ผลของฝันที่ส่งไป ${outcomes.length} ครั้ง: ${Object.entries(tally).map(([k, v]) => `${k} ×${v}`).join(' · ')}`);
  }
  if (lapsed) out.push(`คำอธิษฐานที่ไม่ได้ตอบ ${lapsed} ใบ`);
  if (acts.length || outcomes.length) {
    out.push('พงศาวดารพระหัตถ์:');
    for (const c of g.chronicle.filter((x) => x.kind !== 'prayer.lapse')) {
      out.push(`  ${c.hAge !== undefined ? `อายุ ${c.hAge} · ` : ''}ศ.ม. ${calendarYear(c.worldYear).toLocaleString('en-US')} │ ${chronicleText(data, c) || CHRONICLE_KIND[c.kind] || 'พระหัตถ์'}`);
    }
  }
  return out;
}
