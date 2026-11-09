// What a play record keeps of the log of a game (M8, code-plan §11 row M8): a few small events per life instead of the log itself.
// Pure (no browser, no storage): the page's recorder (record.ts) and the analysis tool (scripts/tools/m8-report.ts, which feeds it the log of a simulated life)
// both use `Tally`, so a record from a browser and a record from a tool run have the same shape and the same report reads both.
import type { LogEntry } from '../core/types';

/** One line of a record. `t` is seconds since the record began (0 in a tool run), `life` the number of the life inside the record. */
export interface RecEvent {
  t: number;
  k: string;
  life?: number;
  age?: number;
  [field: string]: unknown;
}

/** What the page (or the tool) says about a life when it begins: the arm of the A/B, the switches, the seed. */
export interface LifeMeta {
  seed?: number;
  /** The arm the A/B gave this life: `on` or `off` for `llm_director`; null when no A/B ran. */
  arm?: 'on' | 'off' | null;
  /** `Settings.llm` at the start of the life. */
  llm?: { master: boolean; setup: boolean; director: boolean; epitaph: boolean };
  /** The page had an LLM server to ask (without one the director arm changes nothing). */
  llmServer?: boolean;
  /** The policy of a simulated player (tool runs). */
  policy?: string;
}

export interface TallyOpts {
  now?: () => number;
  meta?: () => LifeMeta;
  /** A tool run has no player: the interventions are read from the god's entries of the log. The page records the real commands instead. */
  actsFromLog?: boolean;
}

/** The god commands that count as an intervention of the player (docs/systems/god/08-goals.md GV-12: gifts picked, dreams, whispers, miracles, a conjuring; a prayer answered too). */
export const INTERVENTIONS = ['chest.pick', 'dream.send', 'whisper', 'prayer.answer', 'miracle', 'decree', 'conjure'] as const;

const LOG_ACT: Record<string, string> = { dream: 'dream.send', whisper: 'whisper', miracle: 'miracle', conjure: 'conjure', 'prayer.give': 'prayer.answer', 'prayer.punish': 'prayer.answer' };

interface Stats {
  nodes: number;
  chances: number;
  callbacks: number;
  bondEndings: number;
}

const blank = (): Stats => ({ nodes: 0, chances: 0, callbacks: 0, bondEndings: 0 });

/** Reads log entries in order and turns them into events; keeps the count of the life it is inside. */
export class Tally {
  readonly events: RecEvent[] = [];
  /** Number of the life now (0 before the first birth). */
  life = 0;
  /** The log number of the last entry seen: `ingest` skips what it has seen. */
  lastN = -1;
  private open = false;
  private stats = blank();
  private lastBirth: LogEntry | undefined;

  constructor(private readonly opts: TallyOpts = {}) {}

  private push(k: string, e: LogEntry | undefined, fields: Record<string, unknown> = {}): void {
    const ev: RecEvent = { t: this.opts.now?.() ?? 0, k, ...(this.life ? { life: this.life } : {}), ...fields };
    if (e?.age !== undefined && e.age !== null) ev.age = e.age;
    this.events.push(ev);
  }

  /** The entries of the log newer than the last one seen (the log grows at its end). Returns the events they made. */
  ingest(log: readonly LogEntry[]): RecEvent[] {
    const from = this.events.length;
    let i = log.length;
    while (i > 0 && log[i - 1].n > this.lastN) i--;
    for (; i < log.length; i++) this.read(log[i]);
    if (log.length) this.lastN = Math.max(this.lastN, log[log.length - 1].n);
    return this.events.slice(from);
  }

  /** Goes on from a loaded game: the log up to `lastN` is not read again; a life that is `inLife` is open (its counts start from here). */
  resume(life: number, lastN: number, inLife: boolean): void {
    this.life = life;
    this.lastN = lastN;
    this.open = inLife;
    this.stats = blank();
  }

  /** Closes a life that ended without a death entry (a tool run that hit its limit, a page that was closed). */
  finish(): void {
    if (this.open) this.close(this.lastBirth, { cause: 'unfinished' });
  }

  private close(e: LogEntry | undefined, fields: Record<string, unknown>): void {
    this.push('life.end', e, { ...fields, ...this.stats });
    this.open = false;
    this.stats = blank();
  }

  private read(e: LogEntry): void {
    const d = e.data as Record<string, unknown>;
    switch (`${e.sys}/${e.kind}`) {
      case 'character/birth': {
        if (this.open) this.close(e, { cause: 'unfinished' });
        this.life++;
        this.open = true;
        this.lastBirth = e;
        const m = this.opts.meta?.() ?? {};
        this.push('life.start', e, { ...m, race: d.race ?? null, country: d.country ?? null, born: d.born ?? null });
        break;
      }
      case 'game/death':
        if (this.open) this.close(e, { cause: d.cause ?? null, hAge: d.hAge ?? null });
        break;
      case 'ending/card':
        this.push('ending', e, { title: d.title ?? null, mark: d.mark ?? null });
        break;
      case 'god/vow.offer':
      case 'god/vow.reoffer':
        this.push(e.kind, e, { ids: String(d.ids ?? '').split(',').filter(Boolean) });
        break;
      case 'god/vow.take':
      case 'god/vow.change':
        this.push(e.kind, e, { vow: e.id ?? null });
        break;
      case 'god/vow.result':
        this.push('vow.result', e, { vow: e.id ?? null, result: d.result ?? null });
        break;
      case 'attention/call':
        this.push('call', e, { call: d.call, why: d.why, cards: d.cards ?? '', n: d.n ?? '' });
        break;
      case 'attention/missed':
        this.push('missed', e, { kind: d.kind ?? null });
        break;
      case 'bonds/crisis':
        // a crisis that reached a card: the person and the story it is
        this.push('crisis', e, { card: true, tie: d.tie ?? null, code: d.code ?? null });
        break;
      case 'bonds/trouble':
        // told without a card (answered at once), or the answer to a card (`after`): `by` is who moved it (the player's whisper or dream), null when the character chose alone
        if (d.after) this.push('crisis.answer', e, { tie: d.tie ?? null, answer: d.answer ?? null, by: d.by ?? null });
        else this.push('crisis', e, { card: false, tie: d.tie ?? null, code: d.code ?? null, answer: d.answer ?? null });
        break;
      case 'bonds/ending':
        if (d.involved) this.stats.bondEndings++;
        break;
      case 'story/node':
        this.stats.nodes++;
        if (d.chance) this.stats.chances++;
        if (d.callback) this.stats.callbacks++;
        break;
      case 'llm/director':
        this.push('llm.director', e, { pick: d.pick ?? null, reason: d.reason ?? null });
        break;
      default:
        if (e.sys === 'llm') this.push('llm.answer', e, { point: e.kind });
        else if (this.opts.actsFromLog && e.sys === 'god' && LOG_ACT[e.kind]) this.push('act', e, { action: LOG_ACT[e.kind], ok: true });
    }
  }
}
