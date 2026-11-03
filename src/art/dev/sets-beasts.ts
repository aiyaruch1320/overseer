// The sets of the beasts. `SET_DEFS` is what the characters page (sets.ts) merges: there the humanoid enemies drawn by the person painter
// show as people. `BEAST_SETS` is all the beasts, for the beasts page (beasts.html, src/art/beast/dev.ts).
import { BEASTS, DRAGONS, ENEMIES, personLookOf, type BeastLook } from '../beast/look';
import type { SizeClass } from '../../core/data/types-beast-looks';
import type { PersonLook } from '../look';
import { NPC_BEAST_IDS, npcBeast } from '../npc-beasts';

export interface BeastEntry { id: string; label: string; look: BeastLook }
export type BeastSetDef = { label: string; entries: () => BeastEntry[] };

const SIZES: SizeClass[] = ['S', 'M', 'L', 'XL', 'XXL'];
const entry = (look: BeastLook): BeastEntry => ({ id: look.id, label: look.name, look });

export const BEAST_SETS: Record<string, BeastSetDef> = {
  ...Object.fromEntries(SIZES.map((sz) => [`enemies:${sz}`, { label: `ศัตรูชั้น ${sz} (${ENEMIES.filter((e) => e.size === sz).length})`, entries: () => ENEMIES.filter((e) => e.size === sz).map(entry) }])),
  dragons: { label: `มังกรตำนาน ${DRAGONS.length} ตัว`, entries: () => DRAGONS.map(entry) },
  'npc-beasts': { label: `NPC ที่เป็นสัตว์ (${NPC_BEAST_IDS.length})`, entries: () => NPC_BEAST_IDS.flatMap((id) => { const l = npcBeast(id); return l ? [{ id, label: l.name, look: l }] : []; }) },
  all: { label: `ศัตรูกับมังกรทั้งหมด (${BEASTS.length})`, entries: () => BEASTS.map(entry) },
};

// the characters page knows people only: it gets the enemies the person painter draws
const isPerson = (e: (typeof ENEMIES)[number]) => e.plan === 'humanoid' && (e.form === 'person' || e.form === 'wolfman');
export const SET_DEFS: Record<string, { label: string; entries: () => { id: string; label: string; look: PersonLook }[] }> = Object.fromEntries(
  SIZES.filter((sz) => ENEMIES.some((e) => e.size === sz && isPerson(e))).map((sz) => [`enemies-people:${sz}`, {
    label: `ศัตรูที่เป็นคน ชั้น ${sz}`, entries: () => ENEMIES.filter((e) => e.size === sz && isPerson(e)).map((e) => ({ id: e.id, label: e.name, look: personLookOf(e) })),
  }]),
);
