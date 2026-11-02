// Shape of data/gen/attention.json (code-plan §5.1). Owned by the attention generator.
import type { GenFile } from '../types';

/** Seconds are real seconds at normal speed (experience/07-attention.md §1 rule 6). */
export interface AttentionRule {
  stopGap: number;
  merge: number;
  cardGap: number;
  stopWait: number;
  /** Kinds of card the setting still shows; null = all. */
  cards: string[] | null;
  /** false = windows never stop the game, they only glow on the life line. */
  windows: boolean;
}

export interface AttentionData {
  principles: { n: number; title: string; effect: string }[];
  levels: { id: 'stop' | 'card' | 'log'; name: string; screen: string; time: string }[];
  triggers: { name: string; level: string; perLife: number | null; source: string; kind?: string; src: string }[];
  /** Default rule ("ปกติ") and the three settings. */
  rule: AttentionRule;
  settings: { low: AttentionRule; normal: AttentionRule; high: AttentionRule };
  /** How long a waiting card may wait before it is moot, in life years. */
  deadlines: Record<string, number>;
  /** Trigger rates the sim builds one life from. */
  rates: { window: number; prayer: number; omen: number; majorOmen: number; battle: number; crisis: number };
  /** What `rates` counts: `life` = per whole life (75 life years) · `lifeYear` = per life year (the prayer tick; ×75 for a life, doc §2 "ราว 16"). */
  ratePer: Record<'window' | 'prayer' | 'omen' | 'majorOmen' | 'battle' | 'crisis', 'life' | 'lifeYear'>;
  ageStops: number[];
  lifeMinutes: { min: number; max: number; sim: number };
  lifeYears: number;
  earlyDeath: { perYear: number; fromAge: number };
  rulesTable: { rule: string; value: string }[];
  targets: { what: string; value: string; min: number | null; max: number | null }[];
  simResults: { rule: string; cells: string[] }[];
  oldCodeChanges: { old: string; becomes: string }[];
  settingsText: { level: string; diff: string }[];
}

export type AttentionFile = GenFile<AttentionData>;
