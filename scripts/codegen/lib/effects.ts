// Effect grammar for storyline and event rows (code-plan §5.2). Human words stay as display labels;
// only the patterns in the §5.2 table are read as effects or conditions. Phrases that still hold a digit,
// a percent or a multiplier after parsing are returned as `unparsed` for the report.
import type { Choice, Condition, Effect, IdKind, WeightMod } from '../../../src/core/types';
import type { IdIndex } from './ids';

const NUM = String.raw`[+\-−]?\d+(?:\.\d+)?`;
const toNum = (s: string) => Number(s.replace('−', '-'));
const NPC = /\b([A-Z]{2}\d{2}-\d)\b/g;
const EVENT = /\b((?:NF-)?[A-Z]{2,4}-\d{2})\b/g;
const NODE = /\b([a-z]{2}\.[btaelx]\d+)\b/;
/** Words that name a stat change: `ทอง −50` `ชื่อเสียง +5` `ความถนัดอาชีพ +1` `พวกพ้อง +2`. */
const STAT = new RegExp(String.raw`([฀-๿a-zA-Z_]+(?:\s[฀-๿]+)?)\s*(${NUM})(?![\d%])`, 'g');
const THAI_YEARS: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };

export interface Parsed {
  effects: Effect[];
  mods: WeightMod[];
  label: string;
  unparsed: string[];
}

/** A condition from a short phrase: an event id, a backticked id, an NPC, a node. Null when nothing is readable. */
export function parseCondition(text: string, ids: IdIndex): Condition | null {
  const parts = text.split(/\s+หรือ\s+/);
  if (parts.length > 1) {
    const of = parts.map((p) => parseCondition(p, ids)).filter((c): c is Condition => !!c);
    return of.length ? (of.length === 1 ? of[0] : { k: 'or', of }) : null;
  }
  const neg = /ไม่มี|ยังไม่|ไม่เกิด/.test(text);
  const ev = [...text.matchAll(EVENT)].map((m) => m[1]).filter((id) => !id.startsWith('NF-'));
  if (ev.length) {
    const of: Condition[] = ev.map((id) => ({ k: 'event', id, happened: !neg }));
    return of.length === 1 ? of[0] : { k: 'or', of };
  }
  const code = text.match(/`([^`]+)`/);
  if (code) {
    const c: Condition = { k: 'has', kind: kindOf(code[1], ids), id: code[1] };
    return neg ? { k: 'not', of: c } : c;
  }
  const npc = text.match(/\b([A-Z]{2}\d{2}-\d)\b/);
  if (npc) return { k: 'npc', id: npc[1], alive: !/ตาย/.test(text) };
  const node = text.match(NODE);
  if (node) return { k: 'node', id: node[1] };
  return null;
}

function kindOf(id: string, ids: IdIndex): IdKind {
  return ids.kind(id);
}

/** Effects of one segment (text between ` · `). Mutates `rest` to what was not consumed. */
function segment(seg: string, ids: IdIndex, out: Parsed, battleCtx: boolean): string {
  let rest = seg;
  const eat = (s: string) => {
    rest = rest.replace(s, ' ');
  };

  // weight multipliers: (`freedom` ×3) · (BIO-01 แล้ว ×3)
  for (const m of seg.matchAll(/\(([^()]*?)\s*×\s*(\d+(?:\.\d+)?)\)/g)) {
    const cond = parseCondition(m[1], ids);
    if (cond) {
      out.mods.push({ cond, mul: Number(m[2]) });
      eat(m[0]);
    }
  }

  // era-gated convergence: ยุค 4 → cv.16
  const eraTo = rest.match(/ยุค\s*(\d)(?:\s*ขึ้นไป)?\s*→\s*(cv\.\d+|[a-z]{2}\.[btaelx]\d+)/);
  if (eraTo) {
    out.effects.push({ k: 'if', cond: { k: 'era', min: Number(eraTo[1]) }, then: [{ k: 'converge', to: eraTo[2] }] });
    eat(eraTo[0]);
  }

  // conditional: ถ้า MC-03 หรือ MC-04 เกิด → cv.9
  const iff = rest.match(/ถ้า\s*(.+?)\s*→\s*(cv\.\d+|[a-z]{2}\.[btaelx]\d+)/);
  if (iff) {
    const cond = parseCondition(iff[1], ids);
    if (cond) {
      out.effects.push({ k: 'if', cond, then: [{ k: 'converge', to: iff[2] }] });
      eat(iff[0]);
    }
  }

  // jump: ข้ามไป hu.a1 เร็วขึ้นสองปี
  const jump = rest.match(/ข้ามไป\s*([a-z]{2}\.[btaelx]\d+)(?:\s*เร็วขึ้น\s*(\S+?)\s*ปี)?/);
  if (jump) {
    const y = jump[2] ? (THAI_YEARS[jump[2]] ?? (Number(jump[2]) || undefined)) : undefined;
    out.effects.push(y ? { k: 'jump', to: jump[1], years: y } : { k: 'jump', to: jump[1] });
    eat(jump[0]);
  }

  // convergence: → cv.6
  for (const m of rest.matchAll(/→\s*(cv\.\d+)/g)) {
    out.effects.push({ k: 'converge', to: m[1] });
    eat(m[0]);
  }

  // battle marker
  const isBattle = /ศึก/.test(rest) || battleCtx;
  const battleEnemies: string[] = [];

  // a backticked id with a signed number raises or lowers it: `bow` +1
  for (const m of rest.matchAll(new RegExp('`([a-z_]+)`\\s*(' + NUM + ')(?![\\d%])', 'g'))) {
    if (!/[+\-−]/.test(m[2])) continue;
    out.effects.push({ k: 'stat', stat: m[1], delta: toNum(m[2]) });
    eat(m[0]);
  }

  // backticked ids, with an optional chance after them
  for (const m of rest.matchAll(/`([^`]+)`(?:\s*(\d+(?:\.\d+)?)%)?/g)) {
    const id = m[1].trim();
    const kind = kindOf(id, ids);
    if (kind === 'enemy' && isBattle) {
      battleEnemies.push(id);
      eat(m[0]);
      continue;
    }
    const lvl = ids.aptLevel(id);
    const e: Effect = lvl ? { k: 'grant', kind: 'aptitude', id: lvl.apt, level: lvl.level } : { k: 'grant', kind, id };
    if (m[2] && e.k === 'grant') e.chance = Number(m[2]) / 100;
    out.effects.push(e);
    eat(m[0]);
  }
  if (isBattle) {
    out.effects.push({ k: 'battle', enemies: battleEnemies });
    rest = rest.replace(/ศึก/, ' ');
  }

  // NPC ids and event ids that are still in the text are references
  for (const m of rest.matchAll(NPC)) {
    out.effects.push({ k: 'npc', id: m[1] });
    eat(m[1]);
  }
  for (const m of rest.matchAll(EVENT)) {
    out.effects.push({ k: 'event', id: m[1] });
    eat(m[1]);
  }

  // death with a chance: ตาย 10%
  const death = rest.match(/ตาย\S*\s*(\d+(?:\.\d+)?)%/);
  if (death) {
    out.effects.push({ k: 'death', chance: Number(death[1]) / 100 });
    eat(death[0]);
  }

  // stat changes: ทอง −50 · ชื่อเสียง +5
  for (const m of rest.matchAll(STAT)) {
    if (!/[+\-−]/.test(m[2])) continue; // a bare number is not a change
    out.effects.push({ k: 'stat', stat: m[1].trim(), delta: toNum(m[2]) });
    eat(m[0]);
  }
  return rest;
}

/** Parses a cell made of ` · ` separated segments. `weighted` reads a leading weight (choice cells). */
export function parseCell(cell: string, ids: IdIndex, opts: { weighted?: boolean; battle?: boolean } = {}): Parsed & { weight: number | null } {
  const out: Parsed = { effects: [], mods: [], label: '', unparsed: [] };
  let text = cell.trim();
  let weight: number | null = null;
  if (opts.weighted) {
    const w = text.match(/^(\d+(?:\.\d+)?)\s+/);
    if (w) {
      weight = Number(w[1]);
      text = text.slice(w[0].length);
    }
  }
  const labels: string[] = [];
  for (const seg of text.split(/\s+·\s+/)) {
    const label = seg
      .replace(/`[^`]+`(?:\s*\d+(?:\.\d+)?%)?/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (label) labels.push(label);
    const rest = segment(seg, ids, out, !!opts.battle);
    const left = rest.replace(/\s+/g, ' ').trim();
    if (/\d|%|×/.test(left)) out.unparsed.push(seg.trim());
  }
  out.label = labels.join(' · ');
  return { ...out, weight };
}

/** One choice cell of a storyline node (`40 ลอบสังหารในเมืองใหญ่ · \`c_wanted\``). */
export function parseChoice(key: Choice['key'], cell: string, ids: IdIndex): { choice: Choice; unparsed: string[] } {
  const p = parseCell(cell, ids, { weighted: true });
  const choice: Choice = { key, weight: p.weight ?? 0, label: p.label, effects: p.effects, mods: p.mods };
  if (p.weight === null) p.unparsed.unshift(`(ไม่มีน้ำหนัก) ${cell}`);
  return { choice, unparsed: p.unparsed };
}
