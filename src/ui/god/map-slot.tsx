// The place where the map joins the god's screens (code-plan §8.4): the map agent registers a component here with `registerGodMap`, and the miracle
// and conjure screens mount it for aiming (20-god-ui.md §7.1: the world map fills the screen, the cursor is a ring of the line's colour). Until one is
// registered the screens show the same targets as a list, so aiming works without the map.
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import type { OmenView, RuinView, TargetKind, TargetOption } from '../../app/views/god';
import { W } from '../../app/views/god-words';
import { color } from '../tokens';
import { box } from './style';

export interface GodMapProps {
  /** What the target is: a country (or several), a continent, a person, a dragon. */
  kind: TargetKind;
  /** The targets the core accepts (ids as the commands take them). */
  targets: TargetOption[];
  /** The ids picked now. */
  picked: string[];
  /** The player aims at a target (the map calls it with an id of `targets`). */
  onPick: (id: string) => void;
  /** The colour of the cursor ring by the line of the power: light, dread or fate. */
  tone: 'light' | 'dread' | 'fate';
  /** Omens waiting (their rings on the map) and ruins (their marks). */
  omens: OmenView[];
  ruins: RuinView[];
  /** The map fills the box it is in (the aim of a miracle) instead of a fixed height. */
  fill?: boolean;
}

/** The map component, once the map layer has registered one. */
export const godMap = signal<ComponentType<GodMapProps> | null>(null);

export function registerGodMap(c: ComponentType<GodMapProps> | null): void {
  godMap.value = c;
}

/** Draws the registered map, or a box that says where it will be. */
export function MapSlot(p: GodMapProps) {
  const Map = godMap.value;
  if (Map) return <Map {...p} />;
  return (
    <div data-slot="god-map" role="note" style={{ ...box, borderStyle: 'dashed', color: color.textDim, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {W.miracle.mapSlot}
    </div>
  );
}
