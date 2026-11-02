// The machine cache (god/05-llm.md §5 "แคชตรงตัว" and "แคชร่วมระหว่างผู้เล่น"): an answer that passed the check, kept by the hash of the exact input,
// so the same input is never paid for twice. A store is only a map; where it lives (memory, a file of the player, a server) is the caller's choice.
import type { LlmPoint } from './types';

export interface CacheEntry {
  /** The raw answer text that passed the check when it was stored. It is checked again when read (a rule may have changed since). */
  text: string;
  point: LlmPoint;
  model: string;
}

export interface CacheStore {
  get(key: string): CacheEntry | undefined;
  set(key: string, e: CacheEntry): void;
}

export class MemoryCache implements CacheStore {
  private readonly map = new Map<string, CacheEntry>();
  constructor(initial?: Record<string, CacheEntry>) {
    for (const [k, v] of Object.entries(initial ?? {})) this.map.set(k, v);
  }
  get(key: string) {
    return this.map.get(key);
  }
  set(key: string, e: CacheEntry) {
    this.map.set(key, e);
  }
  get size() {
    return this.map.size;
  }
  /** Plain object for saving to a file. */
  toJSON(): Record<string, CacheEntry> {
    return Object.fromEntries(this.map);
  }
}

/** Stores asked in order (the player's own first, then the shared one); a hit is copied into the stores before it, a write goes to all. */
export function layered(...stores: CacheStore[]): CacheStore {
  return {
    get(key) {
      for (let i = 0; i < stores.length; i++) {
        const hit = stores[i].get(key);
        if (hit) {
          for (let j = 0; j < i; j++) stores[j].set(key, hit);
          return hit;
        }
      }
      return undefined;
    },
    set(key, e) {
      for (const s of stores) s.set(key, e);
    },
  };
}
