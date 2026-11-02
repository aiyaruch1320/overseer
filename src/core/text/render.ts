// Turns log entries into readable Thai (code-plan §6.3: screens and text read only the log).
// Pure: the same log gives the same lines, nothing is drawn from the seed streams and nothing is written to the state.
// Used by `npm run life`, `npm run play` and the debug page. The real screens (M5) will use the same functions for their story log.
//
// A line holds words only (review M1 T1 T3): ids become names, the notes of a table cell are cut (`plain.ts`). A reader keeps what
// earlier lines told (the name, the country, the people met) so that a death names the place and an NPC the character never heard
// of stays out (T5). Mood and bond-template lines wait for the bond system (T4); death says the cause and the place (T8).
import type { GameData } from '../game';
import type { LogEntry, LogLevel } from '../types';
import type { TemplatesData } from '../data/types-text';
import { attentionText, godTemplate, godText, type TemplateStyle } from './god';
import { goalsText } from './goals';
import { items, labels, type Labels } from './labels';
import { endingTail, isM3, m3Level, m3Say, npcMore, type M3Cx } from './m3';
import { endingSay, isEnding } from './ending';
import { hashText as hash, plainName, riteSentence, scrub, sentence, spaceDigits, tidy } from './plain';
import { BORN_TH, CALENDAR_BASE, CAUSE_TH, DEATH_TH, GIFT_TH, SEASONS, SPECIAL_TH } from './tuning';
import { BOND_LEVEL_TH, MOOD_TH } from './words';

type D = LogEntry['data'];

export { labels, nameOfId, knownName, type Labels, type RiteLite } from './labels';

// ---------- pure choice among variants ----------

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
export function classWord(data: GameData, cls: unknown): string {
  const n = Number(/\d/.exec(s(cls))?.[0]);
  if (!n) return s(cls);
  return items<{ classes?: { n: number; name: string }[] }>(data, 'economy')?.classes?.find((c) => c.n === n)?.name ?? `ชั้น ${n}`;
}

/** The Thai for a cause of death: a known word, Thai text as written, or nothing (never a code). */
export function causeWord(cause: unknown): string {
  const c = s(cause);
  if (CAUSE_TH[c]) return CAUSE_TH[c];
  return /[฀-๿]/.test(c) ? c : '';
}

/** The question of the life for a race (`human` or `hu`): the sentence of the race file's section 1; empty when the data has none. */
export function questionOf(data: GameData, race: string | undefined): string {
  if (!race) return '';
  const r = items<{ races?: { id: string; storyPrefix: string }[] }>(data, 'races')?.races?.find((x) => x.id === race || x.storyPrefix === race);
  return labels(data).lines.get(r?.storyPrefix ?? race)?.question ?? '';
}

// ---------- what the player sees at which level ----------

/**
 * The level a line is shown at. The mood lines of the story and its bond templates mean nothing to the player until the bond system has a
 * person behind them (review M1 T4): they are trace, unless `bondLines` (the lines the reader has seen a bond on) holds the line. The small lines
 * of the systems of M3 are trace too (`m3Level`).
 */
export function displayLevel(e: LogEntry, bondLines?: ReadonlySet<string>): LogLevel {
  if (e.sys === 'story' && (e.kind === 'mood' || e.kind === 'bond' || e.kind === 'template')) return e.kind !== 'template' && bondLines?.has(s(e.id)) ? e.level : 0;
  return isM3(e) ? m3Level(e) : e.level;
}

export interface ReadOpts {
  /** Show also what has no phrasing yet, plainly (`[sys/kind id k=v]`), for the developer. */
  raw?: boolean;
}

const DEAD_NPC = new Set(['die', 'vanish']);

// ---------- the reader ----------

/**
 * Reads entries one after another. It remembers the name and the country of the main character and the NPCs met,
 * so that lines about NPCs the character has nothing to do with are left out and a death can say where.
 */
export class Reader {
  name = '';
  country = '';
  readonly met = new Set<string>();
  /** Holders the character met by name: a slot passes to heirs, and a stranger's death or heir is not news (review M1 round 2). */
  readonly metHolders = new Set<string>();
  /** Life years that already told a meeting: one meeting line a year, the rest wait in the list of people met. */
  private readonly meetYears = new Set<number>();
  /** The lines (`สหาย`) the character has a bond on, as the bond system told them: the mood of a story line is for the player only then (T4). */
  readonly bondLines = new Set<string>();
  /** Bonds whose end a line already told (the ending of their story): the plain `end` of the same tie is not told again. */
  private readonly endedTies = new Set<string>();
  /** The people of the crises announced to the player, by the number of the entry: the card that calls for a crisis names the person. */
  private readonly crisisNames = new Map<number, string>();
  /** The last story node played, for a death caused by a node. */
  private node: { id: string; title: string; year: number } | undefined;
  private readonly L: Labels;

  constructor(
    readonly data: GameData,
    readonly opts: ReadOpts = {},
  ) {
    this.L = labels(data);
  }

  private nm(id: unknown): string {
    return plainName(this.data, id);
  }
  private at(p: unknown): string {
    const n = this.nm(p);
    return n ? `ที่${n}` : '';
  }

  /** The level an entry is shown at, after the reader has read it. */
  levelOf(e: LogEntry): LogLevel {
    return displayLevel(e, this.bondLines);
  }

  private cx(): M3Cx {
    return {
      data: this.data,
      who: this.name || 'ตัวละคร',
      endedTold: (tie) => this.endedTies.has(tie),
      met: (id) => !!id && this.met.has(id),
      npcText: (text, withMc) => this.npcText(text, withMc),
      npcName: (id) => scrub(this.data, this.L.npc.get(id) ?? ''),
      pick: (list) => list[0],
    };
  }

  /**
   * The name of the character, taken from the log before it is read: a line written before the birth lines (the bondage of a child born in it) is
   * read after them, and says his name and not "ตัวละคร" (round-two review N9).
   */
  prime(log: readonly LogEntry[]): void {
    const named = log.find((e) => e.sys === 'text' && e.kind === 'named');
    if (named && !this.name) this.name = s(named.data.name);
  }

  /** The line of an entry again, without remembering it (a line rewritten when another entry joins it). */
  reread(e: LogEntry): string | null {
    const line = this.say(e);
    return line === null ? null : spaceDigits(tidy(line, false));
  }

  /** True when the last entry read was left out on purpose (an NPC the character does not know), not because it has no phrasing. */
  filtered = false;

  /** The line for this entry (or null), then the entry is remembered. */
  read(e: LogEntry): string | null {
    this.filtered = false;
    const line = this.say(e);
    this.remember(e);
    return line === null ? null : spaceDigits(tidy(line, false));
  }

  private remember(e: LogEntry): void {
    const d = e.data;
    if (e.sys === 'text' && e.kind === 'named') {
      this.name = s(d.name);
      if (s(d.country)) this.country = s(d.country);
    }
    if (e.sys === 'character' && e.kind === 'birth' && s(d.country)) this.country = s(d.country);
    if (e.sys === 'npc' && d.what === 'meet' && e.id) {
      // the first holder of a slot the character meets is the person known; the heirs that follow are the slot going on
      if (!this.met.has(e.id) && s(d.holder)) this.metHolders.add(s(d.holder));
      this.met.add(e.id);
    }
    if (e.sys === 'story' && e.kind === 'node') this.node = { id: s(e.id), title: s(d.title) || this.nm(e.id), year: e.worldYear };
    if (e.sys === 'bonds') {
      if (e.kind === 'tie' || e.kind === 'mood' || e.kind === 'level') {
        if (s(d.line)) this.bondLines.add(s(d.line));
      } else if (e.kind === 'line' && s(d.to)) this.bondLines.add(s(d.to));
      else if (e.kind === 'ending' && d.involved === true && e.id) this.endedTies.add(e.id);
      if (e.kind === 'crisis' && s(d.name)) this.crisisNames.set(e.n, `${s(d.name)}${s(d.line) ? ` (${s(d.line)})` : ''}`);
    }
  }

  /**
   * NPC lines are for people the character knows (T5): a meeting in the character's country, and the death, heir or end of
   * the story of a holder the character met in person. Successions of a slot whose holders were never met stay out.
   */
  private knows(e: LogEntry): boolean {
    if (this.opts.raw || !this.country) return true;
    const what = s(e.data.what);
    // a fight the character is in, and a healing he brought about, are always news
    if (what === 'clash' || what === 'clash-open' || what === 'heal') return true;
    if (what === 'die' || what === 'succeed' || what === 'end') return this.metHolders.has(s(e.data.holder)) || this.metHolders.has(s(e.data.from));
    if (what !== 'meet') return (e.id !== undefined && this.met.has(e.id)) || s(e.data.place) === this.country;
    // a meeting is always news (the character was there), one a life year
    if (e.age === undefined) return true;
    if (this.meetYears.has(e.age)) return false;
    this.meetYears.add(e.age);
    return true;
  }

  private say(e: LogEntry): string | null {
    const d: D = e.data;
    const nm = (id: unknown) => this.nm(id);
    const at = (p: unknown) => this.at(p);
    const data = this.data;

    if (e.sys === 'npc' && e.kind === 'npc') {
      if (!this.knows(e)) {
        this.filtered = true;
        return null;
      }
      const who = scrub(data, s(d.holder));
      const role = d.role ? ` (${scrub(data, s(d.role))})` : '';
      const where = at(d.place);
      switch (d.what) {
        case 'open':
          return `เรื่องของ ${who}${role} เริ่มขึ้น${where}`;
        case 'event': {
          const ev = nm(d.id);
          return ev ? `${who}: ${ev} เปิดเรื่องของเขา` : `${who}: เรื่องของเขาเปิดขึ้น`;
        }
        case 'end': {
          if (d.path === '-' || d.path === undefined) return `${who}${role}: เรื่องจางหายไปโดยไม่เกิดอะไร`;
          const text = this.npcText(s(d.text), d.mc === true);
          const forced = d.forced ? ' (เกิดโดยปริยาย)' : '';
          return text ? `${who}${role}: ${text}${forced}` : `${who}${role}: เรื่องของเขาคลี่คลาย${forced}`;
        }
        case 'die': {
          const c = causeWord(d.cause);
          return `${who}${role} ตาย${where} เมื่ออายุ ${s(d.age)}${c ? ` (${c})` : ''}`;
        }
        case 'vanish':
          return `${who}${role} หายสาบสูญ${where}`;
        case 'succeed': {
          const from = d.from ? ` ต่อจาก ${scrub(data, s(d.from))}` : '';
          const twist = this.npcText(s(d.twist), false);
          return `${who} รับตำแหน่ง${scrub(data, s(d.role))}${where}${from}${twist ? ` · ${twist}` : ''}`;
        }
        case 'move': {
          const to = nm(d.to);
          const why = this.npcText(s(d.cause), false);
          return `${who} ย้ายไปอยู่${to ? `ที่${to}` : 'ที่อื่น'}${why ? ` · ${why}` : ''}`;
        }
        case 'meet':
          return `ได้พบ ${who}${role}${where ? ` ${where}` : ''}`;
        case 'ally':
          return `${who} ยินดีเป็นพวกพ้อง`;
      }
      const more = npcMore(this.cx(), e);
      if (more !== undefined) return more;
      return this.opts.raw ? `${who}: ${s(d.what)}` : null;
    }

    if (e.sys === 'text') return this.text(e);

    if (e.sys === 'god') {
      const cx = this.godCx(e);
      const t = goalsText(cx, e) ?? godText(cx, e, variantOf(e));
      if (t !== undefined) return t;
    }
    if (e.sys === 'attention') {
      const t = attentionText(data, e, (n) => this.crisisNames.get(n));
      if (t !== undefined) return t;
    }

    if (isM3(e)) {
      const t = m3Say(this.cx(), e);
      if (t !== undefined) return t;
    }
    if (isEnding(e)) {
      const t = endingSay(e);
      if (t !== undefined) return t;
    }

    if (e.sys === 'game' && e.kind === 'death') return this.death(e);

    if (e.sys === 'tools' && e.kind === 'class') {
      const from = classWord(data, d.from);
      const to = classWord(data, d.to);
      return Number(d.up) > 0 ? `ฐานะสูงขึ้นจาก${from} เป็น${to}` : `ฐานะตกจาก${from} เหลือ${to}`;
    }

    if (e.sys === 'character') {
      switch (e.kind) {
        case 'birth':
          return null; // the text system says the birth in words
        case 'class': {
          // written by the character system when the class changes (review M1 T9)
          const n = (x: unknown) => Number(/\d/.exec(s(x))?.[0] ?? 0);
          const from = classWord(data, d.from);
          const to = classWord(data, d.to);
          return n(d.to) > n(d.from) ? `ฐานะสูงขึ้นจาก${from} เป็น${to}` : `ฐานะตกจาก${from} เหลือ${to}`;
        }
        case 'grant':
        case 'remove': {
          const k = s(d.kind);
          const kindMap = this.L.kind[k as keyof Labels['kind']];
          const named = kindMap?.get(s(e.id)) ?? this.nm(e.id);
          if (!named) return null;
          const from = this.nm(d.from);
          return `${e.kind === 'grant' ? 'ได้รับ' : 'สูญเสีย'}${GIFT_TH[k] ?? ''} ${named}${from ? ` (จาก ${from})` : ''}`;
        }
        case 'job': {
          const named = this.L.kind.job.get(s(e.id)) ?? this.nm(e.id);
          return named ? `${d.type === 'secret' ? 'ได้อาชีพลับ' : 'ได้เป็น'} ${named}` : null;
        }
        case 'jobFail': {
          const named = this.L.kind.job.get(s(e.id)) ?? this.nm(e.id);
          return named ? `สมัครเป็น ${named} ไม่สำเร็จ${d.reason === 'req' ? ' (ยังไม่ถึงเงื่อนไข)' : ''}` : null;
        }
        case 'secretJobRefused': {
          const named = this.L.kind.job.get(s(e.id)) ?? this.nm(e.id);
          return named ? `อาชีพลับ ${named} เรียกหา แต่ไม่ใช่ทางของเขา` : null;
        }
        case 'wound':
          return 'ได้บาดแผลถาวร';
      }
    }

    if (e.sys === 'world' || e.kind === 'event') {
      const ev = s(d.name) || this.nm(e.id);
      const place = at(d.country ?? d.place);
      const where = place ? ` ${place}` : '';
      const year = e.worldYear !== undefined ? ` (ศ.ม. ${CALENDAR_BASE + e.worldYear})` : '';
      if (e.kind === 'event' || e.kind === 'fire' || e.kind === 'happened') return ev ? `เหตุการณ์โลก: ${ev}${where}${year}` : null;
      if (e.kind === 'omen') return ev ? `ลางของเหตุการณ์โลก: ${ev}${where}` : null;
      if (e.kind === 'ending') return ev ? `โลกถึงจุดจบ: ${ev}${year}` : 'โลกถึงจุดจบ';
      if (e.kind === 'era') return `ยุคที่ ${s(d.era ?? d.to)} เริ่มขึ้น${year}`;
      if (e.kind === 'dragon') {
        const dn = s(d.name) || this.nm(e.id);
        return `มังกร${dn ? ` ${dn}` : ''} ${scrub(data, s(d.what ?? d.state)) || 'ล้ม'}${year}`;
      }
    }

    if (e.sys === 'combat' && e.kind === 'battle') return this.battle(e);
    if (e.sys === 'story' || e.kind === 'node' || e.kind === 'choice') {
      if (e.kind === 'node' || e.kind === 'choice' || e.kind === 'pass') return this.node_(e);
      if (e.kind === 'converge') return `เส้นเรื่องบรรจบที่ ${this.nodeTitle(e)}`;
      if (e.kind === 'jump') return `เรื่องข้ามไป ${this.nodeTitle(e)}`;
      if (e.kind === 'battle') return this.battle(e);
      // the mood and the bond of a story line: told only when the bond system has a person on that line (T4); the templates belong to the bond system
      if (e.kind === 'mood') {
        if (this.bondLines.has(s(e.id))) return `ใจของ${this.name || 'ตัวละคร'}ที่มีต่อสาย${s(e.id)}: ${MOOD_TH[s(d.mood)] ? s(d.mood) : 'รู้สึกบางอย่าง'}`;
        return this.opts.raw ? `สาย${s(e.id)} รู้สึก${s(d.mood)}` : null;
      }
      if (e.kind === 'bond') {
        if (!this.bondLines.has(s(e.id))) return null;
        const lv = Number(d.level);
        return `สาย${s(e.id)}ของ${this.name || 'ตัวละคร'}${lv ? `ขึ้นเป็นระดับ${BOND_LEVEL_TH[lv] ?? ''}` : 'เปลี่ยนไป'}`;
      }
      if (e.kind === 'ending') return `ปลายทาง: ${s(e.id)}${endingTail(data, d, this.name || 'ตัวละคร')}`;
      if (e.kind === 'template' || e.kind === 'skip') return null;
      // the window the story opens for the god and the job a node gave are for the log: the call of the game and the job line tell them
      // and a request the story makes of the LLM system (a role to write) is read by that system, not by the player
      if (e.kind === 'window' || e.kind === 'jobpath' || e.kind === 'llm') return null;
    }

    if (e.kind === 'unhandled') return null;
    if (e.level === 0) return null;
    if (!this.opts.raw) return null;
    // an entry of a system that has no phrasing yet: shown plainly only for the developer
    const tail = Object.entries(d).map(([k, v]) => `${k}=${s(v)}`).join(' ');
    return `[${e.sys}/${e.kind}${e.id ? ` ${e.id}` : ''}${tail ? ` ${tail}` : ''}]`;
  }

  /** What the lines of the god need to know: the character, the place, the season, and the way to pick a story. */
  private godCx(e: LogEntry) {
    const place = this.nm(this.country);
    const season = SEASONS[e.quarter ?? -1] ?? '';
    const continent = this.country ? this.nm(this.country.slice(0, 2)) : '';
    return {
      data: this.data,
      who: this.name,
      country: this.country,
      tpl: (family: string, keys: Record<string, string>, vars: Record<string, string | undefined>, variant: string, style?: TemplateStyle) =>
        godTemplate(this.data, family, keys, { ชื่อของที่นี่: place || undefined, ฤดู: season || undefined, ทวีป: continent || undefined, ...vars }, variant, hash, style),
    };
  }

  /**
   * What happened to an NPC, as the roster writes it: the event, then `[ช่วย]` `[ร่วม]` `[ขัดขวาง]` `[ปล่อย]` branches that happen
   * when the main character is in it, and notes with numbers or conditions. The branches are read only when the character was in it.
   */
  npcText(text: string, withMc: boolean): string {
    const parts = text.split(/\s*\[(?:ช่วย|ร่วม|ขัดขวาง|ปล่อย)\]\s*/);
    const who = this.name || 'ตัวละคร';
    const take = (t: string) => sentence(this.data, t.replace(/ตัวละครหลัก/g, who));
    const out = [take(parts[0])];
    if (withMc) for (const p of parts.slice(1)) out.push(take(p));
    return out.filter(Boolean).join(' — ');
  }

  private nodeTitle(e: LogEntry): string {
    return s(e.data.title) || this.nm(e.id) || s(e.id);
  }

  /** The node played and the way taken, as `title — the sentence of the way`. */
  private node_(e: LogEntry): string | null {
    const d = e.data;
    const data = this.data;
    const L = this.L;
    // a convergence standing in for a row carries the id of the row and the convergence in `cv`
    const nodeId = s(d.cv) || s(e.id);
    const title = s(d.title) || this.nm(nodeId);
    if (!title) return null;
    const key = s(d.choice ?? d.key ?? d.path);
    // the story keeps the first 120 letters of the way it took: the whole cell is in the data
    const full = L.choice.get(nodeId)?.get(s(d.choice ?? d.key ?? d.path));
    const lab = s(d.label);
    const given = full && lab.length >= 100 && full.startsWith(lab) ? full : lab;
    const rite = !d.cv ? L.rites.get(s(e.id)) : undefined;
    let way = '';
    if (key && key !== '-') {
      if (rite) way = riteSentence(data, rite, key, given);
      if (!way) way = sentence(data, given) || sentence(data, L.choice.get(nodeId)?.get(key));
    }
    const t = scrub(data, title) || title;
    return way ? `${t} — ${way}` : t;
  }

  private battle(e: LogEntry): string {
    const d = e.data;
    const data = this.data;
    const ids = s(d.enemies).split(',').filter(Boolean);
    let names = ids.map((x) => this.L.kind.enemy.get(x) ?? '').filter(Boolean);
    if (!names.length) {
      // a battle the document names in words: find an enemy of the roster in the text
      const text = s(d.text);
      const found = this.L.enemies.find((x) => text.includes(x.name));
      if (found) names = [found.name];
    }
    const RES: Record<string, string> = { win: 'ชนะ', lose: 'แพ้', flee: 'หนี', draw: 'เสมอ', dead: 'ตายในศึก' };
    const res = RES[s(d.result)] ?? scrub(data, s(d.result));
    return names.length ? `ศึก: ${names.join(' · ')} · ${res}` : `ศึก · ${res}`;
  }

  private text(e: LogEntry): string | null {
    const d = e.data;
    const data = this.data;
    switch (e.kind) {
      case 'named': {
        const t = templateOf(data, 'templates-ending', 'life_fact', { ชนิด: 'เกิด' }, variantOf(e));
        const line = t && sub(t, { name: s(d.name), race: s(d.race), home: s(d.home), class_birth: s(d.cls), year: s(d.year) });
        // the templates say `ชนชั้น{class_birth}` and the class names of the economy file begin with ชนชั้น themselves
        return (line || `${s(d.name)} เกิดเป็น${s(d.race)}ที่${s(d.home)}`).replace(/ชนชั้น\s*(?=ชนชั้น)/g, '');
      }
      case 'family': {
        const who = s(d.name) || this.name || 'ตัวละคร';
        const parts: string[] = [];
        if (d.gender === 'f') parts.push('เป็นเพศหญิง');
        else if (d.gender === 'm') parts.push('เป็นเพศชาย');
        if (s(d.born) && BORN_TH[s(d.born)]) parts.push(`เกิด${BORN_TH[s(d.born)]}`);
        if (s(d.cls)) parts.push(`ครอบครัวเป็น${classWord(data, d.cls)}`);
        const tail: string[] = [];
        if (s(d.second)) tail.push(`เลือดผสมกับ${this.L.kind.race.get(s(d.second)) ?? ''}`);
        if (s(d.meet)) tail.push(`พ่อแม่พบกันเพราะ${this.L.kind.meet.get(s(d.meet)) ?? ''}`);
        if (s(d.special) && SPECIAL_TH[s(d.special)]) tail.push(`เกิดพิเศษเป็น${SPECIAL_TH[s(d.special)]}`);
        if (s(d.sign) && s(d.sign) !== 'none') tail.push(`ดวงวันเกิดคือ${this.L.kind.sign.get(s(d.sign)) ?? ''}`);
        return `${who}${parts.length ? ' ' : ''}${parts.join(' ')}${tail.length ? ` · ${tail.join(' · ')}` : ''}`;
      }
      case 'traits':
        return s(d.traits) ? `นิสัยเด่น: ${s(d.traits).split(',').join(' · ')}` : null;
      case 'question':
        return s(d.question) ? `คำถามของชีวิต: ${s(d.question)}` : null;
    }
    return this.opts.raw ? `[text/${e.kind}]` : null;
  }

  private death(e: LogEntry): string {
    const d = e.data;
    const age = s(d.hAge ?? e.age);
    const cause = s(d.cause);
    const who = this.name || 'ตัวละคร';
    const where = this.country ? this.at(this.country) : '';
    const form = DEATH_TH[cause];
    if (form) return form.replace('{who}', who).replace('{where}', where).replace('{age}', age);
    // another cause: the node that ended the life, when the log says which
    const nodeId = s(d.node) || (this.node && this.node.year === e.worldYear ? this.node.id : '');
    const title = nodeId ? this.nm(nodeId) || (this.node?.id === nodeId ? this.node.title : '') : '';
    const c = causeWord(cause);
    const why = title ? `จากเหตุ “${title}”` : c ? `(${c})` : '';
    return `${who}สิ้นชีวิต${why ? ` ${why}` : ''}${where} เมื่ออายุ ${age}`;
  }
}

/** The line for one log entry, or null when the entry is not for reading. Without the entries before it, a death cannot name the place. */
export function describe(data: GameData, e: LogEntry, opts: ReadOpts = {}): string | null {
  return new Reader(data, opts).read(e);
}

export interface Line {
  n: number;
  age: number | undefined;
  year: number;
  level: LogEntry['level'];
  sys: string;
  text: string;
  /** The entry the line came from. */
  entry: LogEntry;
}

/**
 * Lines of a log at or above `minLevel` (by `displayLevel`), with the age and the ศ.ม. year the readers print in front.
 * The whole log is read in order so that later lines know the name, the country and the people met; `fromN` keeps only the
 * entries from that running number on (the new part of a log that was read before).
 */
export function lines(data: GameData, log: LogEntry[], minLevel: LogEntry['level'] = 1, fromN = -Infinity, opts: ReadOpts = {}): Line[] {
  const out: Line[] = [];
  const reader = new Reader(data, opts);
  reader.prime(log);
  let prev: { line: Line; e: LogEntry } | undefined;
  for (const e of log) {
    const text = reader.read(e);
    if (text === null || reader.levelOf(e) < minLevel || e.n < fromN) continue;
    const line: Line = { n: e.n, age: e.age, year: CALENDAR_BASE + e.worldYear, level: reader.levelOf(e), sys: e.sys, text, entry: e };
    // a holder who dies and the successor who takes the post in the same year: one line instead of two
    if (prev && e.sys === 'npc' && e.data.what === 'succeed' && prev.e.sys === 'npc' && DEAD_NPC.has(s(prev.e.data.what)) && prev.e.id === e.id && prev.e.worldYear === e.worldYear) {
      const who = scrub(data, s(e.data.holder));
      const twist = new Reader(data).npcText(s(e.data.twist), false);
      prev.line.text = `${prev.line.text} · ${who} รับตำแหน่งสืบต่อ${twist ? ` (${twist})` : ''}`;
      continue;
    }
    // the ways of one node that named several places and the character stayed from all of them for one reason: one line, not one for each place
    if (prev && e.sys === 'travel' && e.kind === 'stay' && prev.e.sys === 'travel' && prev.e.kind === 'stay' && prev.e.age === e.age && prev.e.data.node === e.data.node && prev.e.data.why === e.data.why) {
      const more = [...(s(prev.e.data.more) ? s(prev.e.data.more).split(',') : []), s(e.data.to)].join(',');
      prev.e = { ...prev.e, data: { ...prev.e.data, more } };
      const joined = reader.reread(prev.e);
      if (joined !== null) prev.line.text = joined;
      continue;
    }
    out.push(line);
    prev = { line, e };
  }
  return birthFirst(out, log);
}

const BIRTH_KINDS = new Set(['named', 'family', 'traits', 'question']);

/**
 * The four lines of the birth open the life: who the character is comes before anything the other systems wrote in the same
 * moment (people met, the first node), because the hooks of those systems run first (one-life.md §2 ข้อ 1).
 */
function birthFirst(out: Line[], log: LogEntry[]): Line[] {
  const at = out.findIndex((l) => l.sys === 'text' && l.entry.kind === 'named');
  if (at < 0) return out;
  const named = out[at].entry;
  const born = [...log].reverse().find((e) => e.sys === 'character' && e.kind === 'birth' && e.n < named.n);
  if (!born) return out;
  let end = at;
  while (end + 1 < out.length && out[end + 1].sys === 'text' && BIRTH_KINDS.has(out[end + 1].entry.kind)) end++;
  const block = out.slice(at, end + 1);
  const before = out.slice(0, at);
  const split = before.findIndex((l) => l.entry.n > born.n);
  if (split < 0) return out;
  return [...before.slice(0, split), ...block, ...before.slice(split), ...out.slice(end + 1)];
}

/** Entries of level 1 or more that have no phrasing yet, counted by `sys/kind`: for the developer's summary, never for the player. */
export function unphrased(data: GameData, log: LogEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  const reader = new Reader(data);
  const raw = new Reader(data, { raw: true });
  reader.prime(log);
  raw.prime(log);
  for (const e of log) {
    const a = reader.read(e);
    const b = raw.read(e);
    if (a === null && b !== null && !reader.filtered && reader.levelOf(e) >= 1 && e.kind !== 'unhandled') out[`${e.sys}/${e.kind}`] = (out[`${e.sys}/${e.kind}`] ?? 0) + 1;
  }
  return out;
}

/** One printed line: `อายุ 23 · ศ.ม. 10,450 │ text`; entries before the life have no age. */
export function formatLine(l: Line): string {
  const when = l.age === undefined ? `ศ.ม. ${l.year.toLocaleString('en-US')}` : `อายุ ${String(l.age).padStart(2)} · ศ.ม. ${l.year.toLocaleString('en-US')}`;
  const mark = l.level >= 3 ? '!' : l.level === 2 ? '*' : ' ';
  return `${mark} ${when} │ ${l.text}`;
}

