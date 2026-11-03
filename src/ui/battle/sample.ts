// Sample fights for the storybook and the tests: log entries written in the shape the combat system writes (src/core/combat/fight.ts, clash.ts, war.ts),
// with the optional fields that make the watch exact (`rolls` `dream` `whisper` `max` `lastStand`). Real enemies of enemies.json, real clash rows of
// clashes.json; the numbers are made up so that every roll is consistent with its DC. Nothing here plays the game.
import type { ClashesData } from '../../core/data/types-combat';
import type { GameData } from '../../core/game';
import { items } from '../../core/text/labels';
import type { GameState, LogEntry } from '../../core/types';

/** One beat of `rolls`: stance, d20, bonus, dc, passed, hit points after, wounds of the foe left after. */
export type Roll = [stance: string, d20: number, bonus: number, dc: number, ok: 0 | 1, hp: number, left: number];

export const rollsOf = (list: readonly Roll[]): string => list.map((r) => r.join('/')).join(';');

export interface FightSpec {
  enemies: string;
  foe: string;
  end: 'win' | 'flawless' | 'talk' | 'tame' | 'draw' | 'flee' | 'lose' | 'dead';
  kind?: string;
  node?: string | null;
  rolls: Roll[];
  max?: number;
  hpBefore: number;
  wounds?: string;
  loot?: string;
  first?: 'hero' | 'foe' | 'even';
  dream?: string;
  whisper?: boolean;
  lastStand?: boolean;
  level?: LogEntry['level'];
}

let counter = 900000;

/** A `combat/battle` entry as the core writes it. */
export function battleEntry(s: FightSpec, n = ++counter): LogEntry {
  const last = s.rolls[s.rolls.length - 1];
  const hp = s.end === 'dead' ? 0 : last ? last[5] : s.hpBefore;
  const word = s.end === 'flawless' || s.end === 'talk' || s.end === 'tame' ? 'win' : s.end;
  return {
    n,
    worldYear: 1060,
    age: 30,
    quarter: 1,
    sys: 'combat',
    kind: 'battle',
    id: s.enemies,
    level: s.level ?? 2,
    data: {
      result: word,
      end: s.end,
      enemies: s.enemies,
      foe: s.foe,
      node: s.node ?? null,
      text: null,
      kind: s.kind ?? 'travel',
      beats: s.rolls.length,
      hpLost: Math.max(0, s.hpBefore - hp),
      hp,
      stances: s.rolls.map((r) => r[0]).join(','),
      first: s.first ?? 'hero',
      wounds: s.wounds ?? '',
      loot: s.loot ?? '',
      rolls: rollsOf(s.rolls),
      max: s.max ?? 100,
      ...(s.dream ? { dream: s.dream } : {}),
      ...(s.whisper ? { whisper: 1 } : {}),
      ...(s.lastStand ? { lastStand: 1 } : {}),
    },
  };
}

/** The sample state with entries added to its log (the life stays: its name reads in the view). */
export function withEntries(state: GameState, entries: LogEntry[]): GameState {
  const top = state.log.reduce((m, e) => Math.max(m, e.n), 0);
  return { ...state, log: [...state.log, ...entries.map((e, i) => ({ ...e, n: top + 1 + i }))] };
}

/** A `combat/clash` entry for the row of clash `id` and the kind of outcome the fight picked. */
export function clashEntry(data: GameData, id: string, kind: string, end: string, opener: string, n: number): LogEntry {
  const c = items<ClashesData>(data, 'clashes')?.items.find((x) => x.id === id);
  const row = c?.outcomes.find((o) => o.kind === kind);
  return {
    n,
    worldYear: 1060,
    age: 30,
    quarter: 1,
    sys: 'combat',
    kind: 'clash',
    id,
    level: 2,
    data: { npc: c?.npc ?? '', opener, result: kind === 'lose' ? 'lose' : 'win', end, outcome: row?.outcome ?? null, kind, text: row?.text ?? null, killed: kind === 'win_kill', beats: 4 },
  };
}

// ---------- the fights of the stories ----------

export const FIGHTS = {
  // a fight won in three beats, one roll missed
  won: {
    enemies: 'bandits',
    foe: 'กลุ่มโจรภูเขา',
    end: 'win',
    kind: 'travel',
    hpBefore: 100,
    level: 1,
    loot: 'gold+8,fame+1,rune+1',
    rolls: [
      ['melee', 14, 3, 11, 1, 100, 1],
      ['magic', 6, 2, 11, 0, 88, 1],
      ['melee', 12, 3, 11, 1, 88, 0],
    ],
  },
  // a mountain troll, weak to fire: a dream named magic ×3 and a whisper pointed at the weak point
  dreamed: {
    enemies: 'troll',
    foe: 'โทรลล์ภูเขา',
    end: 'win',
    kind: 'story',
    node: 'cv.5',
    hpBefore: 100,
    dream: 'magic',
    whisper: true,
    loot: 'gold+14,fame+3',
    rolls: [
      ['magic', 20, 2, 15, 1, 100, 1],
      ['melee', 7, 3, 15, 0, 79, 1],
      ['magic', 15, 2, 15, 1, 79, 0],
    ],
  },
  // the same troll without the god: four beats and a defeat with a scar and a limp
  lost: {
    enemies: 'troll',
    foe: 'โทรลล์ภูเขา',
    end: 'lose',
    kind: 'story',
    node: 'cv.5',
    hpBefore: 100,
    wounds: 'scar,c_limp',
    first: 'foe',
    rolls: [
      ['melee', 9, 3, 15, 0, 78, 3],
      ['melee', 16, 3, 15, 1, 78, 2],
      ['guard', 8, 4, 15, 0, 52, 2],
      ['melee', 5, 3, 15, 0, 24, 2],
    ],
  },
  // the beats ran out with the foe on its last wound: a draw
  draw: {
    enemies: 'skeleton',
    foe: 'กองทัพโครงกระดูก',
    end: 'draw',
    kind: 'hunt',
    hpBefore: 100,
    level: 1,
    rolls: [
      ['magic', 15, 2, 11, 1, 100, 1],
      ['ranged', 4, 2, 11, 0, 80, 1],
      ['magic', 7, 2, 11, 0, 60, 1],
    ],
  },
  // an old lich: five wounds, six beats, the dream names magic
  boss: {
    enemies: 'lich',
    foe: 'ลิชโบราณ',
    end: 'win',
    kind: 'story',
    node: 'hu.a1',
    hpBefore: 100,
    dream: 'magic',
    loot: 'gold+60,fame+12,rune+1',
    rolls: [
      ['magic', 17, 4, 21, 1, 100, 4],
      ['magic', 12, 4, 21, 0, 84, 4],
      ['magic', 20, 4, 21, 1, 84, 2],
      ['guard', 9, 3, 21, 0, 70, 2],
      ['magic', 18, 4, 21, 1, 70, 1],
      ['magic', 19, 4, 21, 1, 70, 0],
    ],
  },
  // a last stand against the titan: no flight, and the hero falls
  lastStand: {
    enemies: 'awakened_titan',
    foe: 'ไททันตื่น',
    end: 'dead',
    kind: 'story',
    node: 'gi.e2.b',
    hpBefore: 100,
    lastStand: true,
    first: 'foe',
    rolls: [
      ['melee', 20, 5, 29, 1, 100, 22],
      ['melee', 14, 5, 29, 0, 78, 22],
      ['guard', 18, 6, 29, 0, 55, 22],
      ['melee', 20, 5, 29, 1, 55, 20],
      ['melee', 10, 5, 29, 0, 38, 20],
      ['melee', 17, 5, 29, 0, 17, 20],
      ['melee', 6, 5, 29, 0, 0, 20],
    ],
  },
  // a duel with a named duke: the clash row picks "he yields"
  clash: {
    enemies: 'AZ02-1',
    foe: 'ซากโรวีร์ ดยุกนักดวล',
    end: 'win',
    kind: 'duel',
    node: 'NF-AZ02-1',
    hpBefore: 100,
    rolls: [
      ['melee', 15, 6, 19, 1, 100, 3],
      ['guard', 8, 4, 19, 0, 84, 3],
      ['melee', 20, 6, 19, 1, 84, 1],
      ['melee', 13, 6, 19, 1, 84, 0],
    ],
  },
} satisfies Record<string, FightSpec>;
