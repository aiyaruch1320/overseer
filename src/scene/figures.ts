// What the stage draws for an actor of a script (M7 ก1). The script names an actor by an id and a label only (`a` ตัวละคร, `b` อีกคน, a foe's name,
// `crowd` ผู้คน); the app resolves each to a look (src/app/views/scene.ts) and hands the stage this, so the stage never reads the game's data.
import type { BeastLook } from '../art/beast/look';
import type { PersonLook } from '../art/look';

export type Figure =
  /** A person; a group of `count` takes the looks one by one (a crowd is several different people). */
  | { kind: 'person'; looks: PersonLook[] }
  /** A creature, an enemy of the 200, a dragon of the fifteen, an NPC that is a beast. */
  | { kind: 'beast'; look: BeastLook }
  /** Nobody knows who it is: the dark placeholder. */
  | { kind: 'silhouette' };

/** The figure of an actor by the id and label of the actor beat and the number of figures it shows. */
export type FigureOf = (a: { id: string; label: string; count: number }) => Figure;

/** Everyone is a silhouette (a stage with no life behind it: the storybook's beat specimens). */
export const allSilhouettes: FigureOf = () => ({ kind: 'silhouette' });

/** A short text that tells two figures apart (the stage rebuilds a sprite when it changes). */
export const figureKey = (f: Figure): string => (f.kind === 'person' ? `p:${f.looks.map((l) => l.key).join(',')}` : f.kind === 'beast' ? `b:${f.look.kind}:${f.look.id}` : 's');
