// Which log entries call for the player's attention, and as what (07-attention.md §2 table "แต่ละเรื่องอยู่ระดับไหน").
// Read from the log only: the systems that write these entries know nothing of attention.
import type { Ctx } from '../game';
import type { Home, WorldEventsData } from '../data/types-events';
import type { LogEntry } from '../types';
import type { Trig } from './schedule';
import { EXTERNAL, NAMED_TIERS } from './tuning';

interface EnemyRow {
  id: string;
  tier: string;
}

const named = new WeakMap<object, Set<string>>();
const homes = new WeakMap<object, Map<string, Home>>();

/** Ids of enemies that count as named (boss tiers, and every NPC id: `MH02-1`, `npc_*` stand-ins stay ordinary). */
function namedEnemies(ctx: Ctx): Set<string> {
  const f = ctx.data.enemies;
  if (!f) return new Set();
  let s = named.get(f);
  if (!s) {
    const rows = (f.items as { items?: EnemyRow[] }).items ?? [];
    s = new Set(rows.filter((r) => NAMED_TIERS.has(r.tier) || /^[A-Z]{2}\d{2}-\d+$/.test(r.id)).map((r) => r.id));
    named.set(f, s);
  }
  return s;
}

/** Where each event the world fires lives: world events by their home, branch events by their continent, last-era events everywhere. */
function homeOf(ctx: Ctx, id: string): Home | undefined {
  const f = ctx.data['world-events'];
  if (!f) return undefined;
  let m = homes.get(f);
  if (!m) {
    m = new Map();
    const d = f.items as WorldEventsData;
    const all = (list: Home['continents']) => ({ source: 'row' as const, words: [], countries: [], continents: list, world: false });
    for (const e of d.events) m.set(e.id, e.home);
    for (const b of d.branch) m.set(b.id, all([b.continent as Home['continents'][number]]));
    for (const l of d.lastEra) m.set(l.id, { source: 'world', words: [], countries: [], continents: [], world: true });
    homes.set(f, m);
  }
  return m.get(id);
}

/** `own`: the event lives on the continent of the character only (not the whole world). `touches`: it lives there or everywhere. */
export function reach(ctx: Ctx, id: string): { own: boolean; touches: boolean } {
  const life = ctx.state.life;
  const h = homeOf(ctx, id);
  if (!h || !life) return { own: false, touches: true };
  if (h.world) return { own: false, touches: true };
  const cont = life.country.slice(0, 2);
  const own = (h.continents as string[]).includes(cont) || h.countries.some((c) => c.slice(0, 2) === cont);
  return { own, touches: own };
}

/** What a log entry calls for, or null when it calls for nothing. */
export function classify(ctx: Ctx, e: LogEntry): Trig | null {
  if (e.sys === 'attention') return null;
  const t = (kind: Trig['kind']): Trig => ({ kind, n: e.n, ...(e.id !== undefined ? { id: e.id } : {}) });
  if (e.sys === 'story') {
    // a node with a god window is written at level 3 by the story (walk.ts); the other nodes never reach it
    if (e.kind === 'node' && e.level >= 3) return t('window');
    if (e.kind === 'battle' && typeof e.id === 'string') {
      const set = namedEnemies(ctx);
      return e.id.split(',').some((x) => set.has(x)) ? t('battle') : null;
    }
    return null;
  }
  if (e.sys === 'world' && e.kind === 'event' && e.id) {
    const mark = e.data.mark;
    if (mark !== '⭐' && mark !== '●') return null;
    const r = reach(ctx, e.id);
    if (!r.touches) return null;
    return t(mark === '⭐' && r.own ? 'majorOmen' : 'omen');
  }
  const ext = EXTERNAL[`${e.sys}/${e.kind}`];
  return ext ? t(ext) : null;
}
