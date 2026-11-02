// Turns log entries into readable Thai (code-plan §6.3: screens and text read only the log).
// Pure: the same entry gives the same line, nothing is drawn from the seed streams and nothing is written to the state.
// Used by `npm run life`, `npm run play` and the debug page. The real screens (M5) will use the same function for their story log.
import type { GameData } from '../game';
import type { LogEntry } from '../types';
import type { TemplatesData } from '../data/types-text';
import { CALENDAR_BASE, CAUSE_TH, GIFT_TH } from './tuning';

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
  // every other generated file that lists things with an id and a name (blessings, curses, jobs, skills, enemies ...): the first name wins
  for (const [file, f] of Object.entries(data)) {
    if (file.startsWith('library.') || file === 'names' || file.startsWith('templates')) continue;
    const top = f.items;
    const lists = Array.isArray(top) ? [top] : top && typeof top === 'object' ? Object.values(top as Record<string, unknown>).filter(Array.isArray) : [];
    for (const list of lists as unknown[][]) {
      for (const x of list) {
        const o = x as { id?: unknown; name?: unknown };
        if (typeof o?.id === 'string' && typeof o?.name === 'string' && !name.has(o.id)) name.set(o.id, o.name);
      }
    }
  }
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
/** `c3` → the name of class 3 in the economy file (สามัญชน), or `ชั้น 3` when the economy file is not loaded. */
function classWord(data: GameData, cls: unknown): string {
  const n = Number(/\d/.exec(s(cls))?.[0]);
  if (!n) return s(cls);
  return items<{ classes?: { n: number; name: string }[] }>(data, 'economy')?.classes?.find((c) => c.n === n)?.name ?? `ชั้น ${n}`;
}
const cause = (v: unknown): string => CAUSE_TH[s(v)] ?? s(v);

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
    const why = d.cause ? ` · ${cause(d.cause)}` : '';
    return `ตายเมื่ออายุ ${s(d.hAge ?? e.age)}${why}`;
  }

  if (e.sys === 'character') {
    switch (e.kind) {
      case 'birth': {
        const second = d.second ? ` ครึ่ง${nm(d.second) || s(d.second)}` : '';
        const born = d.born === 'main' ? 'แผ่นดินของเผ่า' : d.born === 'diaspora' ? 'ถิ่นที่เผ่าไปอยู่' : s(d.born);
        const sign = d.sign && d.sign !== 'none' ? ` · ดวง ${s(d.sign)}` : '';
        return `กำเนิด: ${nm(d.race) || s(d.race)}${second} ${d.gender === 'f' ? 'หญิง' : d.gender === 'm' ? 'ชาย' : ''} ${at(d.country)} (${born}) ชนชั้น ${classWord(data, d.cls)}${sign}${d.special ? ` · เกิดพิเศษ ${s(d.special)}` : ''}`.replace(/ {2,}/g, ' ');
      }
      case 'grant':
      case 'remove': {
        const kind = GIFT_TH[s(d.kind)] ?? s(d.kind);
        return `${e.kind === 'grant' ? 'ได้รับ' : 'สูญเสีย'}${kind} ${nm(e.id)}${d.from ? ` (จาก ${nm(d.from)})` : ''}`;
      }
      case 'job':
        return `${d.type === 'secret' ? 'ได้อาชีพลับ' : 'ได้เป็น'} ${nm(e.id)}`;
      case 'jobFail':
        return `สมัครเป็น ${nm(e.id)} ไม่สำเร็จ${d.reason === 'req' ? ' (ยังไม่ถึงเงื่อนไข)' : d.reason ? ` (${s(d.reason)})` : ''}`;
      case 'secretJobRefused':
        return `อาชีพลับ ${nm(e.id)} เรียกหา แต่ไม่ใช่ทางของเขา`;
      case 'wound':
        return 'ได้บาดแผลถาวร';
    }
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
    if (e.kind === 'battle') {
      const names = s(d.enemies).split(',').filter(Boolean).map((x) => nm(x)).join(' · ');
      const res = d.result === 'win' ? 'ชนะ' : d.result === 'lose' ? 'แพ้' : d.result === 'flee' ? 'หนี' : s(d.result);
      return `ศึก: ${names || s(d.text)} · ${res}`;
    }
    if (e.kind === 'mood') return `${nm(e.id)} รู้สึก${s(d.mood)}`;
    if (e.kind === 'ending') return `ปลายทาง: ${s(e.id)}`;
    // story templates and bond openings belong to the bond system (M3): nothing to read yet
    if (e.kind === 'template' || e.kind === 'bond' || e.kind === 'skip') return null;
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
