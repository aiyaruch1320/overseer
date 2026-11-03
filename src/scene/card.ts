// The event card (code-plan §8.3 step 2): one layout for every world event; the colour of the frame, the corner marks and the picture
// change. This file is the model of a card and how it is made from a card of data/gen/scenes.json; the layout is EventCard.tsx.
import type { CardDef, EventForm, FxKind, ScenesData } from '../core/data/types-scenes';

export interface CardModel {
  id: string;
  title: string;
  /** The words of the entry as the text system says them (src/core/text); empty when the entry is not read. */
  body: string;
  frame: string;
  /** The word of the corner icon (12-event-visuals "ไอคอนมุม"); art draws it from M6. */
  icon: string;
  /** ⭐ ● ○ or empty. */
  mark: string;
  form?: EventForm;
  /** The sound cue that opens the card (12-event-visuals "เสียงเปิด"). */
  sound: string;
  /** The doc's words for the picture, shown under the placeholder. */
  picture: string;
  fx: FxKind[];
  sky: string;
}

/** The colours a card takes when its entry has no card of its own: by the system that wrote it. */
export const SYS_FRAME: Record<string, string> = {
  world: '#a89860',
  story: '#b8c0cc',
  god: '#e8c36a',
  combat: '#8a2a2a',
  npc: '#8a7a4a',
  bonds: '#5a8ad0',
  bondage: '#8a7a6a',
  travel: '#4a7a8a',
  economy: '#c8a030',
  character: '#9a9486',
  ending: '#d8d4cc',
};
export const NEUTRAL_FRAME = '#6a6a7a';

/** A card from its data, with the words of the entry. */
export function cardFrom(def: CardDef, body: string): CardModel {
  return { id: def.id, title: def.name, body, frame: def.frame, icon: def.icon, mark: def.mark, form: def.form, sound: def.sound, picture: def.picture, fx: def.fx, sky: def.sky };
}

/** The card of an entry that has none in the data: the words and the colour of the system that wrote it. */
export function plainCard(id: string, title: string, body: string, sys: string, mark = '', data?: ScenesData, group?: string): CardModel {
  const f = data?.frames.find((x) => x.group === group);
  const frame = f?.color ?? SYS_FRAME[sys] ?? NEUTRAL_FRAME;
  return { id, title, body, frame, icon: f?.icon ?? '', mark, sound: f?.sound ?? '', picture: '', fx: [], sky: '#14161e' };
}
