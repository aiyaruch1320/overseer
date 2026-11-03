// The small types the map component and its scene share.
import type { ZoomId } from './tuning';

/** Where the camera looks. */
export interface MapFocus {
  kind: 'world' | 'continent' | 'country' | 'city';
  /** A continent id (`AL`), a country id (`AL-05`) or a town id (`AL-05/0`). */
  id?: string;
}

/** What the player picked (a click on the map). */
export interface MapPick {
  kind: 'continent' | 'country' | 'city';
  id: string;
}

/** The aiming of a miracle (20-god-ui.md §7.1): the circle follows the cursor, the target is lit, and a hold ring fills while the player holds. */
export interface MapAim {
  /** What the miracle can be aimed at; a click picks only this kind. */
  kind: MapPick['kind'];
  /** Radius of the circle in map units (default: a little ring). */
  radius?: number;
  /** The line that pays: gold for faith, blood red for dread, silver for fate. */
  line?: 'faith' | 'dread' | 'fate';
  /** 0..1: how far the hold-to-confirm ring is filled. */
  hold?: number;
}

export interface MapHover {
  kind: MapPick['kind'];
  id: string;
  name: string;
  title: string;
  /** Screen position inside the map. */
  x: number;
  y: number;
}

export type { ZoomId };
