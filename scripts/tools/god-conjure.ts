// The words of `conjure` and `vow` for the text tools (G5b, G6b): the circle of the conjuring (docs/systems/god/07-conjure.md), the vows on the table (08-goals.md §2).
// Kept apart from god-commands.ts, which calls into it. The arguments sent to the core are the names `src/core/god/conjure` and `src/core/god/goals` read:
//   conjure {verb, core, scale, country | continent | npc} (the ids or the Thai names) · conjure {cancel} · vow.pick {pick} (1 to 3 of the vows on the table, 4 or 0 for none)
// Browser safe: no node imports.
import type { Game, GameData } from '../../src/core/game';
import { viewConj } from '../../src/core/god/conjure';
import { table, unlocked, vowName, vowRow } from '../../src/core/god/goals';
import { plainName, scrub } from '../../src/core/text';
import type { GodAction } from '../../src/core/types';

export interface Ref {
  country(text: string): string | undefined;
  continent(text: string): string | undefined;
  npc(text: string): string | undefined;
}

export type ParsedGod = { action: GodAction; args: Record<string, unknown> } | { error: string };

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const LINE = { faith: 'แสงศรัทธา', dread: 'ความหวาดกลัว' } as const;
const costWords = (c: unknown): string | undefined => {
  const x = c as { faith?: number; dread?: number } | undefined;
  const parts = [x?.faith ? `${LINE.faith} ${x.faith}` : '', x?.dread ? `${LINE.dread} ${x.dread}` : ''].filter(Boolean);
  return parts.length ? parts.join(' + ') : undefined;
};
/** The text of a table cell without its links to the documents (`([x](../y.md))` and `[x](y)`): the player reads no paths (M4 review M2). */
export const unlink = (t: string): string =>
  t
    .replace(/\s*\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, (_m, label: string) => (/[\/.]/.test(label) ? '' : label))
    .replace(/\s{2,}/g, ' ')
    .trim();

interface ConjureRows {
  verbs: { id: string; name: string }[];
  cores: { id: string; name: string }[];
  scales: { id: string; name: string; base: number }[];
  caps: { perLife: number };
}
const conjureRows = (data: GameData): ConjureRows | undefined => (data.god?.items as { conjure?: ConjureRows } | undefined)?.conjure;

/** `conjure <กริยา> <แก่น> <ขนาด> [เป้าหมาย]` (the Thai names or the ids) · `conjure cancel N`. Undefined when the line is too short. */
export function parseConjure(rest: string[], ref: Ref): ParsedGod | undefined {
  if (rest[0] === 'cancel' || rest[0] === 'ยกเลิก') {
    const n = /^\d+$/.test(rest[1] ?? '') ? Number(rest[1]) : undefined;
    return n === undefined ? { error: 'ใช้: conjure cancel N (ลางเสกตามใจใบที่ N)' } : { action: 'conjure', args: { cancel: n } };
  }
  if (rest.length < 3) return undefined;
  const [verb, core, scale, ...more] = rest;
  const args: Record<string, unknown> = { verb, core, scale };
  const text = more.join(' ');
  if (!text) return { action: 'conjure', args };
  // what the target is depends on the size: a person is an NPC, a place and a country are a country, a continent a continent
  const kind = ['คน', 'person'].includes(scale) ? 'npc' : ['ทวีป', 'continent'].includes(scale) ? 'continent' : 'country';
  const id = kind === 'npc' ? ref.npc(text) : kind === 'continent' ? ref.continent(text) : ref.country(text);
  if (!id) return { error: `ไม่รู้จัก${kind === 'npc' ? ' NPC' : kind === 'continent' ? 'ทวีป' : 'ประเทศ'} "${text}" (พิมพ์ชื่อให้ตรง หรือใช้รหัส)` };
  return { action: 'conjure', args: { ...args, [kind]: id } };
}

export function conjureArgText(args: Record<string, unknown>): string {
  if (args.cancel !== undefined) return ` ยกเลิกลางเสกตามใจใบที่ ${String(args.cancel)}`;
  return ` ${String(args.verb ?? '')} ${String(args.core ?? '')} ขนาด${String(args.scale ?? '')}`;
}

export function vowArgText(args: Record<string, unknown>): string {
  return args.pick === undefined ? '' : ` ข้อที่ ${String(args.pick)}`;
}

/**
 * The preview of a conjuring: the name, the result, the price, the chance of the shadow, the omen and the quota. A combination that is a listed miracle is shown as that
 * miracle (`miracleLines` is the tool's own reading of a miracle preview).
 */
export function conjureLines(data: GameData, p: Record<string, unknown>, miracleLines: (p: Record<string, unknown>) => string[]): string[] {
  if (p.cancel !== undefined) {
    const r = p.refund as { faith?: number; dread?: number } | undefined;
    return [`ยกเลิกลางเสกตามใจใบที่ ${num(p.cancel)} “${str(p.name)}”`, `ได้พลังคืน: ${costWords(r) ?? 'ไม่มี'}`, ...(Array.isArray(p.warn) ? p.warn.map(str) : [])];
  }
  const head = `${str(p.verb)} · ${str(p.core)} · ขนาด${str(p.scale)}`;
  if (p.listed) return [`${head} = ปาฏิหาริย์ในรายการ ${str(p.listed)} — ${str(p.quota)}`, ...miracleLines(p)];
  const out = [`${head}: “${str(p.name)}” — ${str(p.result)}`];
  const where = typeof p.target === 'string' ? plainName(data, p.target) || str(p.target) : '';
  if (where) out.push(`ที่: ${where}`);
  if (p.expected) out.push(`ผลที่คาด: ${scrub(data, str(p.expected), { keepNumbers: true })}`);
  for (const e of Array.isArray(p.effects) ? p.effects : []) out.push(`  - ${scrub(data, str(e), { keepNumbers: true })}`);
  if (p.reaction) {
    const r = p.reaction as { say?: string; text?: string };
    out.push(`ปฏิกิริยากับที่นั่น: ${str(r.say)} (${scrub(data, str(r.text), { keepNumbers: true })})`);
  }
  const rise = num(p.priceMul) > 1 ? ` (ฐาน ${num(p.priceBase)} ×${num(p.priceMul)} เพราะ${str(p.priceWhy) === 'belief-low' ? 'ศรัทธาเทพของเขาต่ำกว่า −30 แสงศรัทธาแพงขึ้น' : 'ศรัทธาเทพของเขาสูงกว่า 60 ความหวาดกลัวแพงขึ้น'})` : '';
  out.push(`ราคา: ${costWords(p.cost) ?? 'ไม่เสียพลัง'}${rise}`);
  const back = (p.back as { dread?: number } | undefined)?.dread;
  if (back) out.push(`เมื่อเหตุเกิดขึ้น ท่านได้ความหวาดกลัวคืน ${back} (ราคาสุทธิ ความหวาดกลัว ${num((p.net as { dread?: number } | undefined)?.dread)})`);
  const sh = (p.chance as { shadow?: number } | undefined)?.shadow ?? 0;
  out.push(sh >= 1 ? 'เงาสะท้อน: แน่นอน (น้ำมาซ้ำหลังน้ำท่วม)' : sh > 0 ? `โอกาสเงาสะท้อน: ${Math.round(sh * 100)}% (ผลเล็กอย่างหนึ่งที่ประเทศข้างเคียงหรือที่เดียวกัน)` : 'ไม่มีเงาสะท้อน (ขนาดคน)');
  if (num(p.omen)) out.push(`ลาง: ${str(p.omenLine)} — อีก ${num(p.omen)} ฤดูก่อนเกิดเหตุ (ยกเลิกได้ ได้คืนครึ่งหนึ่ง)`);
  const q = p.quota as { used?: number; limit?: number } | undefined;
  if (q) out.push(`โควต้าเสกตามใจ: ใช้แล้ว ${num(q.used)} จาก ${num(q.limit)} ครั้งในชีวิตนี้ (ครั้งนี้ใช้ 1)`);
  const seal = p.seal as { mood?: number; note?: string } | undefined;
  if (seal) out.push(`หมุดผนึก: ${str(seal.note)} อารมณ์มังกรที่ผนึกอยู่ ${num(seal.mood)}`);
  return out;
}

/** What `conjure` alone shows: the verbs, cores and sizes that are open, what is still shut, and the quota. */
export function circleLines(game: Game, data: GameData): string[] {
  const c = conjureRows(data);
  if (!c) return ['(ไม่มีข้อมูลเสกตามใจ)'];
  const open = unlocked(game.ctx);
  const names = (list: { id: string; name: string }[], set: Set<string>) => list.map((x) => (set.has(x.id) ? x.name : `(${x.name}: ยังไม่เปิด)`)).join(' ');
  const mine = viewConj(game.state);
  const life = game.state.life;
  const used = life && mine.life.key === `${life.id}/${life.birthYear}` ? mine.life.used : 0;
  return [
    '-- วงเสกตามใจ --',
    `กริยา: ${names(c.verbs, open.verbs)}`,
    `แก่น: ${names(c.cores, open.cores)}`,
    `ขนาด: ${c.scales.map((s) => `${s.name} (ราคาฐาน ${s.base})`).join(' · ')}`,
    'พิมพ์: conjure <กริยา> <แก่น> <ขนาด> [ชื่อประเทศ/ทวีป/NPC] เช่น conjure ให้กำเนิด ไฟ ประเทศ · conjure cancel N ยกเลิกลาง',
    `โควต้า: ใช้แล้ว ${used} จาก ${c.caps.perLife} ครั้งในชีวิตนี้ (ส่วนผสมที่เป็นปาฏิหาริย์ในรายการไม่ใช้โควต้า) · พงศาวดารสายตระกูล ${open.points}`,
    ...(mine.pending.length ? ['ลางที่รออยู่: ' + mine.pending.map((p) => `ใบที่ ${p.n} “${p.name}” อีก ${p.left} ฤดู`).join(' · ')] : []),
  ];
}

export function conjureOption(game: Game): string {
  const open = unlocked(game.ctx);
  return `ทำได้ตามวงที่เปิด (กริยา ${open.verbs.size} แก่น ${open.cores.size}) พิมพ์ conjure เฉย ๆ เพื่อดูวง`;
}

/** The vows on the table now: the three offered (or the second three at the age stop of 15) and the one taken. */
export function vowTable(game: Game): string[] {
  const ctx = game.ctx;
  const life = game.state.life && !game.state.life.dead ? game.state.life : null;
  if (!life) return ['ไม่มีตัวละครที่มีชีวิต'];
  const t = table(ctx, life);
  const taken = (life.ext.goals as { vow?: string | null } | undefined)?.vow ?? null;
  const out = ['-- คำปฏิญาณ --', taken ? `ที่ปฏิญาณอยู่: ${vowName(ctx, taken, life.race)}` : 'ยังไม่ได้ปฏิญาณ'];
  if (!t.phase) {
    out.push('ตอนนี้เลือกหรือเปลี่ยนไม่ได้ (เลือกได้ตั้งแต่เกิดจนถึงอายุ 15 เปลี่ยนได้ครั้งเดียวที่อายุ 15)');
    return out;
  }
  out.push(t.phase === 'change' ? 'อายุ 15: เปลี่ยนได้ครั้งเดียว:' : 'ที่เสนอ:');
  t.ids.forEach((id, i) => out.push(`  ${i + 1} ${vowName(ctx, id, life.race)} — สำเร็จเมื่อ ${unlink(vowRow(ctx, id)?.done ?? '')}`));
  out.push(`  ${t.ids.length + 1} ไม่ปฏิญาณ`, 'พิมพ์ vow N เพื่อเลือก (ตรวจผลตอนตัวละครตาย: สำเร็จพงศาวดารสายตระกูล +3 ไม่สำเร็จ +1)');
  return out;
}

export function vowOption(game: Game): string {
  const life = game.state.life && !game.state.life.dead ? game.state.life : null;
  const t = life ? table(game.ctx, life) : { phase: null };
  return t.phase ? `ทำได้ (${t.phase === 'change' ? 'เปลี่ยนได้ครั้งเดียวตอนนี้' : 'เลือกได้จนถึงอายุ 15'}) พิมพ์ vow เฉย ๆ เพื่อดูข้อที่เสนอ` : 'ตอนนี้เลือกไม่ได้';
}

/** The preview of a vow: its name, what makes it true, what it gives. */
export function vowLines(p: Record<string, unknown>): string[] {
  const reward = p.reward as { kept?: number; broken?: number } | undefined;
  const out: string[] = [];
  if (p.vow) out.push(`คำปฏิญาณ: ${str(p.name)}`, `สำเร็จเมื่อ: ${unlink(str(p.done))}${p.selfJudged ? ' (ระบบพระเจ้าตัดสินเอง)' : ''}`);
  else out.push('ไม่ปฏิญาณ — ไม่มีหน้าพิเศษ ไม่มีโทษ');
  if (p.vow && reward) out.push(`ตอนตัวละครตาย: สำเร็จ พงศาวดารสายตระกูล +${num(reward.kept)} · ไม่สำเร็จ +${num(reward.broken)}`);
  const from = p.from as { name?: string } | null | undefined;
  if (from) out.push(`แทนที่คำปฏิญาณเดิม: ${str(from.name)}`);
  if (p.once) out.push('เปลี่ยนได้ครั้งเดียวตอนอายุ 15 — ครั้งนี้คือครั้งนั้น');
  out.push('คำปฏิญาณไม่เปลี่ยนราคา ไม่ให้พลัง ไม่เปลี่ยนการสุ่มของโลก');
  return out;
}
