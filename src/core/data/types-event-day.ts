// Shape of data/gen/event-day.json: the day a miracle happens (docs/appearance/20-god-ui.md §7.3), one row for each miracle the table names.
import type { GenFile } from '../types';

export interface EventDayRow {
  /** MR-xx */
  id: string;
  name: string;
  /** beat 2, the last omen · beat 3, what happens · beat 4, after the event · the main sound */
  omen: string;
  happens: string;
  after: string;
  sound: string;
  /** beat 3 reuses the scene of this card (`ใช้ฉาก GD-04`), else null */
  sceneRef: string | null;
  src: string;
}

export interface EventDayData {
  rows: EventDayRow[];
  /** Seconds of the scene: a small miracle is a short scene, the middle ones and above use the five beats of 11-world-changes.md §1.2. */
  seconds: { small: [number, number]; middle: [number, number] };
  /** The miracles that are not in the table use the scene of the nearest in the same line (the document's last sentence). */
  fallback: 'same-line';
}

export type EventDayFile = GenFile<EventDayData>;
