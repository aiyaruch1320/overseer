// Turns log entries into readable Thai (code-plan §6.3: screens and text read only the log).
// Pure: the same entry gives the same line, nothing is drawn from the seed streams and nothing is written to the state.
// Used by `npm run life`, `npm run play` and the debug page. The real screens (M5) will use the same function for their story log.
import type { GameData } from '../game';
import type { LogEntry } from '../types';
import type { TemplatesData } from '../data/types-text';
import { CALENDAR_BASE } from './tuning';

type D = LogEntry['data'];

interface Labels {
  /** id → name for events, nodes, convergence points, local events, countries, continents, NPCs. */
  name: Map<string, string>;
  /** node id → choice key → label */
  choice: Map<string, Map<string, string>>;
}

const cache = new WeakMap<GameData, Labels>();

function items<T>(data: GameData, file: string): T | undefined {
  return data[file]?.items as T | undefined;
}

export function labels(data: GameData): Labels {
  const hit = cache.get(data);
  if (hit) return hit;
  const name = new Map<string, string>();
  const choice = new Map<string, Map<string, string>>();
  const put = (list: { id: string; name?: string; title?: string }[] | undefined) => {
    for (const x of list ?? []) name.set(x.id, x.title ?? x.name ?? x.id);
  };
  const we = items<{ events: { id: string; name: string }[]; branch: { id: string; name: string }[]; lastEra: { id: string; name: string }[] }>(data, 'world-events');
  if (we) {
    put(we.events);
    put(we.branch);
    put(we.lastEra);
  }
  const le = items<{ events: { id: string; name: string }[]; generated: { id: string; name: string }[] }>(data, 'local-events');
  if (le) {
    put(le.events);
    put(le.generated);
  }
  const sl = items<{ nodes: { id: string; title: string; choices: { key: string; label: string }[] }[] }>(data, 'storylines');
  const cv = items<{ points: { id: string; title: string; choices: { key: string; label: string }[] }[] }>(data, 'convergence');
  for (const list of [sl?.nodes, cv?.points]) {
    for (const n of list ?? []) {
      name.set(n.id, n.title);
      choice.set(n.id, new Map(n.choices.map((c) => [c.key, c.label])));
    }
  }
  put(items<{ id: string; name: string }[]>(data, 'countries'));
  put(items<{ continents: { id: string; name: string }[] }>(data, 'continents')?.continents);
  put(items<{ npcs: { id: string; name: string }[] }>(data, 'npcs')?.npcs);
  const out = { name, choice };
  cache.set(data, out);
  return out;
}

/** Name of anything with an id the data knows; the id itself when it is unknown. */
export function nameOfId(data: GameData, id: string | undefined): string {
  if (!id) return '';
  return labels(data).name.get(id) ?? id;
}

// ---------- pure choice among variants ----------

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/** What picks the variant of a line: the content of the entry, never its running number (that shifts when an entry before it is not written). */
function variantOf(e: LogEntry): string {
  return `${e.sys}|${e.kind}|${e.id ?? ''}|${e.worldYear}|${JSON.stringify(e.data)}`;
}

function templateOf(data: GameData, file: string, family: string, keys: Record<string, string>, variant: string): string | undefined {
  const t = items<TemplatesData>(data, file);
  if (!t) return undefined;
  const list = t.templates.filter((x) => x.family === family && Object.entries(keys).every(([k, v]) => x.keys[k] === v));
  return list.length ? list[hash(variant) % list.length].text : undefined;
}

function sub(text: string, v: Record<string, string | number | undefined>): string | undefined {
  let miss = false;
  const out = text.replace(/\{([^{}]+)\}/g, (_m, k: string) => {
    const x = v[k.trim()];
    if (x === undefined || x === '') {
      miss = true;
      return '';
    }
    return String(x);
  });
  return miss ? undefined : out;
}

const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

// ---------- entries ----------

/** The line for one log entry, or null when the entry is not for reading (trace noise the screens skip). */
export function describe(data: GameData, e: LogEntry): string | null {
  const d: D = e.data;
  const L = labels(data);
  const nm = (id: unknown) => (typeof id === 'string' ? L.name.get(id) ?? id : '');
  const at = (p: unknown) => (p ? `ที่${nm(p)}` : '');

  if (e.sys === 'npc' && e.kind === 'npc') {
    const who = s(d.holder);
    const role = d.role ? ` (${s(d.role)})` : '';
    const w = ` ${who} `;
    switch (d.what) {
      case 'open':
        return `เรื่องของ${w}${role}เริ่มขึ้น${at(d.place)}`;
      case 'event':
        return `${who}: ${nm(d.id)} เปิดเรื่องของเขา`;
      case 'end': {
        if (d.path === '-' || d.path === undefined) return `${who}${role}: เรื่องจางหายไปโดยไม่เกิดอะไร`;
        const forced = d.forced ? ' (เกิดโดยปริยาย)' : '';
        return `${who}${role} · ทาง ${s(d.path)}) ${s(d.text)}${forced}`;
      }
      case 'die':
        return `${who}${role} ตาย${at(d.place)} อายุ ${s(d.age)} · ${s(d.cause)}`;
      case 'vanish':
        return `${who}${role} หายสาบสูญ${at(d.place)}`;
      case 'succeed':
        return `${who} รับตำแหน่ง${s(d.role)}${at(d.place)}${d.from ? ` ต่อจาก ${s(d.from)}` : ''}${d.twist ? ` · ${s(d.twist)}` : ''}`;
      case 'move':
        return `${who} ย้ายไปอยู่ที่${nm(d.to)}${d.cause ? ` · ${s(d.cause)}` : ''}`;
      case 'meet':
        return `ได้พบ${w}${role}${at(d.place)}`;
      case 'ally':
        return `${who} ยินดีเป็นพวกพ้อง`;
    }
    return `${who}: ${s(d.what)}`;
  }

  if (e.kind === 'named' && e.sys === 'text') {
    const t = templateOf(data, 'templates-ending', 'life_fact', { ชนิด: 'เกิด' }, variantOf(e));
    const line = t && sub(t, { name: s(d.name), race: s(d.race), home: s(d.home), class_birth: s(d.cls), year: s(d.year) });
    if (line) return line;
    return `${s(d.name)} เกิดเป็น${s(d.race)}ที่${s(d.home)}`;
  }

  if (e.kind === 'death') {
    const cause = d.cause ? ` · ${s(d.cause)}` : '';
    return `ตายเมื่ออายุ ${s(d.hAge ?? e.age)}${cause}`;
  }

  if (e.sys === 'world' || e.kind === 'event') {
    const ev = e.id ? nm(e.id) : s(d.name);
    const where = d.country || d.place ? ` ${at(d.country ?? d.place)}` : '';
    const year = e.worldYear !== undefined ? ` (ศ.ม. ${CALENDAR_BASE + e.worldYear})` : '';
    if (e.kind === 'event' || e.kind === 'fire' || e.kind === 'happened') return `เหตุการณ์โลก: ${ev}${where}${year}`;
    if (e.kind === 'omen') return `ลางของเหตุการณ์โลก: ${ev}${where}`;
    if (e.kind === 'era') return `ยุคที่ ${s(d.era ?? d.to)} เริ่มขึ้น${year}`;
    if (e.kind === 'dragon') return `มังกร ${s(d.name ?? e.id)} ${s(d.what ?? d.state ?? 'ล้ม')}${year}`;
  }

  if (e.sys === 'story' || e.kind === 'node' || e.kind === 'choice') {
    const title = e.id ? nm(e.id) : s(d.title);
    const key = s(d.choice ?? d.key ?? d.path);
    const label = e.id && key ? L.choice.get(e.id)?.get(key) : undefined;
    if (e.kind === 'node' || e.kind === 'choice' || e.kind === 'pass') {
      if (label) return `${title} → ${key}) ${label}`;
      return key && key !== '-' ? `${title} → ${key}` : title;
    }
    if (e.kind === 'converge') return `เส้นเรื่องบรรจบที่ ${title}`;
    if (e.kind === 'jump') return `เรื่องข้ามไป ${title}`;
    if (e.kind === 'battle') return `ศึก: ${s(d.enemies ?? d.text ?? e.id)}`;
  }

  if (e.kind === 'unhandled') return null;
  if (e.level === 0) return null;
  // an entry of a system that has no phrasing yet: show it plainly so nothing is silently lost
  const tail = Object.entries(d).map(([k, v]) => `${k}=${s(v)}`).join(' ');
  return `[${e.sys}/${e.kind}${e.id ? ` ${e.id}` : ''}${tail ? ` ${tail}` : ''}]`;
}

export interface Line {
  n: number;
  age: number | undefined;
  year: number;
  level: LogEntry['level'];
  sys: string;
  text: string;
}

/** Lines of a log at or above `minLevel`, with the age and the ศ.ม. year the readers print in front. */
export function lines(data: GameData, log: LogEntry[], minLevel: LogEntry['level'] = 1): Line[] {
  const out: Line[] = [];
  for (const e of log) {
    if (e.level < minLevel) continue;
    const text = describe(data, e);
    if (text === null) continue;
    out.push({ n: e.n, age: e.age, year: CALENDAR_BASE + e.worldYear, level: e.level, sys: e.sys, text });
  }
  return out;
}

/** One printed line: `อายุ 23 · ศ.ม. 10,450 │ text`; entries before the life have no age. */
export function formatLine(l: Line): string {
  const when = l.age === undefined ? `ศ.ม. ${l.year.toLocaleString('en-US')}` : `อายุ ${String(l.age).padStart(2)} · ศ.ม. ${l.year.toLocaleString('en-US')}`;
  const mark = l.level >= 3 ? '!' : l.level === 2 ? '*' : ' ';
  return `${mark} ${when} │ ${l.text}`;
}
