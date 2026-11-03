// The scene player (code-plan §2 src/scene, §8.3): scripts of beats from data/gen/scenes.json, played on a stage, and the event card.
export { ScenePlayer, type ScenePlayerProps } from './ScenePlayer';
export { EventCard } from './EventCard';
export { Stage, Silhouette, type CharacterSlot } from './Stage';
export { cardFrom, plainCard, type CardModel } from './card';
export { frameAt, resolveScript, soundsBetween, type Frame, type ActorView } from './timeline';
export { BEAT_KINDS } from '../core/data/types-scenes';
