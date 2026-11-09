// The play record (M8, code-plan §11): a local, opt-in record of one tester's session, kept in the browser's storage and exported as a JSON file from the settings panel.
// Nothing here touches the network (the old POC telemetry server is gone on purpose). It is fed by the store: what the player did (commands, pauses, speed, switches) and
// what the game did to them (calls, vows, crises, endings, read from the log by `Tally`, record-facts.ts). The words the player types are not kept, only that they typed.
import { signal } from '@preact/signals';
import type { GameState } from '../core/types';
import { Tally, type LifeMeta, type RecEvent } from './record-facts';

export const RECORD_KEY = 'overseer.record.1';
export const RECORD_ON_KEY = 'overseer.record.on';
/** The most events a record keeps (a session of many lives is a few thousand; past this the oldest page of the record is not dropped, new events stop). */
export const RECORD_MAX = 20000;

export const RECORD_FORMAT = 'overseer.record';

export interface PlayRecord {
  format: typeof RECORD_FORMAT;
  v: 1;
  id: string;
  startedAt: string;
  events: RecEvent[];
}

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): boolean {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  del(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      // nothing to remove
    }
  },
};

function readRecord(): PlayRecord | null {
  const text = store.get(RECORD_KEY);
  if (!text) return null;
  try {
    const r = JSON.parse(text) as PlayRecord;
    return r && r.format === RECORD_FORMAT && Array.isArray(r.events) ? r : null;
  } catch {
    return null;
  }
}

const newId = (): string => `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Args of a command as the record keeps them: only short plain values (no free text of the player). */
export function plainArgs(args: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 40 && !/\s/.test(v)) out[k] = v;
  }
  return out;
}

export class Recorder {
  /** The tester switched the record on (kept across page loads). */
  readonly on = signal(store.get(RECORD_ON_KEY) === '1');
  /** Events and lives in the record now, for the settings panel. */
  readonly size = signal(0);
  readonly lives = signal(0);

  private rec: PlayRecord | null = null;
  private tally: Tally | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopAt = 0;
  private metaOf: () => LifeMeta = () => ({});
  /** Set by the store: when the record is switched on inside a game, it joins the life running (`joinLife`). */
  attach: (() => void) | undefined;

  constructor(private readonly clock: () => number = Date.now) {
    if (this.on.value) this.open();
  }

  private open(): void {
    this.rec = readRecord() ?? { format: RECORD_FORMAT, v: 1, id: newId(), startedAt: new Date(this.clock()).toISOString(), events: [] };
    this.size.value = this.rec.events.length;
    this.lives.value = this.rec.events.reduce((m, e) => Math.max(m, e.life ?? 0), 0);
  }

  setOn(on: boolean): void {
    this.on.value = on;
    store.set(RECORD_ON_KEY, on ? '1' : '0');
    if (on) {
      this.open();
      this.note('session', { agent: 'page' });
      this.attach?.();
    } else {
      this.flush();
      this.tally = null;
    }
  }

  /** Seconds since the record began. */
  private now(): number {
    return this.rec ? Math.round(((this.clock() - Date.parse(this.rec.startedAt)) / 1000) * 10) / 10 : 0;
  }

  private add(ev: RecEvent): void {
    if (!this.rec || this.rec.events.length >= RECORD_MAX) return;
    this.rec.events.push(ev);
    this.size.value = this.rec.events.length;
    if (ev.life) this.lives.value = Math.max(this.lives.value, ev.life);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => this.flush(), 500);
  }

  /** Writes the record to the storage now. */
  flush(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.rec) store.set(RECORD_KEY, JSON.stringify(this.rec));
  }

  private lifeNo(): number {
    return this.tally?.life ?? this.lives.value;
  }

  /** A line of the player's session that is not from the log (a new game, a load, the LLM server state, a switch). */
  note(k: string, fields: Record<string, unknown> = {}): void {
    if (!this.on.value || !this.rec) return;
    const life = this.lifeNo();
    this.add({ t: this.now(), k, ...(life ? { life } : {}), ...fields });
  }

  /** A new game: a fresh reader of the log; `meta` is asked at every birth (the arm of the life, the switches). */
  newGame(meta: () => LifeMeta, fields: Record<string, unknown> = {}): void {
    if (!this.on.value) return;
    if (!this.rec) this.open();
    this.metaOf = meta;
    this.tally?.finish();
    this.tally = new Tally({ now: () => this.now(), meta: () => this.metaOf() });
    this.tally.life = this.lives.value;
    // the first life of this world is the next number of the record: `game.new` marks its start as `life.next` marks the others
    this.note('game.new', { ...fields, life: this.lives.value + 1 });
  }

  /** The life of a state as the record knows it at once: race, country, age (the birth entry is not in the record, so it is `partial`). */
  private known(state: GameState): Record<string, unknown> {
    const l = state.life;
    return l ? { race: l.race, country: l.country, age: l.hAge, name: l.name } : {};
  }

  /** The record was switched on inside a game (or a save was loaded): the life running starts its entry now, so the record has a life at once. */
  joinLife(state: GameState, meta: () => LifeMeta): void {
    if (!this.on.value) return;
    if (!this.rec) this.open();
    this.metaOf = meta;
    this.tally?.finish();
    this.tally = new Tally({ now: () => this.now(), meta: () => this.metaOf() });
    this.tally.resume(this.lives.value, state.log.length ? state.log[state.log.length - 1].n : -1, false);
    if (state.life && !state.life.dead) {
      this.tally.join(this.known(state));
      for (const ev of this.tally.events) this.add(ev);
      this.tally.events.length = 0;
    }
  }

  /** A save was loaded: the log up to now is not read again; a life in progress starts its entry at once. */
  loaded(state: GameState, meta: () => LifeMeta): void {
    if (!this.on.value) return;
    this.joinLife(state, meta);
    this.note('game.load', { age: state.life?.hAge ?? null });
  }

  /** After a beat, a new life or a command: reads what the log gained since the last time. */
  sync(state: GameState): void {
    if (!this.on.value || !this.tally) return;
    const mark = this.tally.events.length;
    this.tally.ingest(state.log);
    for (const ev of this.tally.events.slice(mark)) {
      if (ev.k === 'call' && ev.call === 'stop') this.stopAt = this.clock();
      this.add(ev);
    }
    // the tally keeps its own list; the record holds the events
    this.tally.events.length = 0;
  }

  /** A god command that was confirmed (or refused). */
  act(action: string, ok: boolean, args: Record<string, unknown>, reason?: string): void {
    this.note('act', { action, ok, args: plainArgs(args), ...(ok ? {} : { reason: String(reason ?? '').slice(0, 60) }) });
  }

  /** A change of the clock: `pause` `play` `resume` (with how long the stop was held, ms). */
  clockEvent(what: 'pause' | 'play' | 'resume'): void {
    if (!this.on.value) return;
    const held = what === 'resume' && this.stopAt ? this.clock() - this.stopAt : undefined;
    if (what === 'resume') this.stopAt = 0;
    this.note('clock', { what, ...(held !== undefined ? { heldMs: held } : {}) });
  }

  /** The record as the text of the file. */
  text(): string {
    this.flush();
    return JSON.stringify(this.rec ?? readRecord() ?? { format: RECORD_FORMAT, v: 1, id: newId(), startedAt: new Date(this.clock()).toISOString(), events: [] });
  }

  /** The name of the file: the record's id and the day. */
  fileName(): string {
    return `overseer-record-${this.rec?.id ?? 'none'}.json`;
  }

  clear(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    store.del(RECORD_KEY);
    this.rec = this.on.value ? { format: RECORD_FORMAT, v: 1, id: newId(), startedAt: new Date(this.clock()).toISOString(), events: [] } : null;
    this.tally = null;
    this.size.value = 0;
    this.lives.value = 0;
  }
}

/** The recorder of the page. */
export const recorder = new Recorder();

/** Hands the record to the browser as a file download. Returns the file's name, or null when the browser refused. */
export function downloadRecord(r: Recorder = recorder): string | null {
  try {
    const name = r.fileName();
    const url = URL.createObjectURL(new Blob([r.text()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name;
  } catch {
    return null;
  }
}
