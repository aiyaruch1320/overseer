// The Looks of the beasts: the 200 enemies and 15 dragons of data/gen/beast-looks.json (generated from the appearance docs), and the PersonLook
// of an enemy that is drawn by the person painter.
import raw from '../../../data/gen/beast-looks.json';
import looksRaw from '../../../data/gen/looks.json';
import type { LooksData } from '../../core/data/types-looks';
import type { BeastLooksData, DragonLook, EnemyLook, SizeClass } from '../../core/data/types-beast-looks';
import { HUMAN_BODY, type PersonLook } from '../look';
import { BEARDS, FEATS, HAIR, HATS, OUTFITS, TOOLS } from '../parts';
import { npcLook } from '../resolve';

export type BeastLook = EnemyLook | DragonLook;
const data = (raw as unknown as { items: BeastLooksData }).items;
export const ENEMIES: readonly EnemyLook[] = data.enemies;
export const DRAGONS: readonly DragonLook[] = data.dragons;
export const BEASTS: readonly BeastLook[] = [...ENEMIES, ...DRAGONS];
const byId = new Map<string, BeastLook>(BEASTS.map((b) => [b.id, b]));
export const beastOf = (id: string): BeastLook | undefined => byId.get(id);

export const sizeOf = (L: BeastLook): SizeClass => L.size;
/** What makes two looks the same picture (sheets and textures are cached by it). */
export const beastKey = (L: BeastLook): string => `${L.kind}:${L.id}`;

/** The nearest part the tables have for a part id the docs' vocabulary names (`''` draws nothing). New parts light up as the tables grow. */
const NEAR: Record<string, string[]> = {
  bow: ['staff'], gun: ['staff'], hammer: ['axe', 'sword'], club: ['axe', 'sword'], dagger: ['sword'], greatsword: ['sword'], mace: ['axe'], banner: ['staff'], trident: ['spear'],
  crown: ['helmet'], cap: ['hood'], turban: ['hood'], cowl: ['hood'], fur: ['tunic'], cloak: ['cape'], plate: ['armor'], knight: ['armor'], leather: ['tunic'], rags: ['tunic'],
};
function resolve(table: Record<string, unknown>, id: string): string {
  if (!id) return '';
  if (table[id]) return id;
  for (const n of NEAR[id] ?? []) if (table[n]) return n;
  return '';
}

/** What the docs say of a person enemy that the generic reading of its row does not give (the mummy's wraps, the gas ghoul's iron mask, the vampire's grey-blue skin, the assassin's dark cowl). */
const FIX: Record<string, Partial<PersonLook>> = {
  // a tall corpse wound in layers of pale linen from head to heel (the wraps feat covers head, chest, legs and arms); the loose ends hang, the dust of the tomb falls
  mummy: { feats: ['wraps', 'dust'], skin: '#a08c68', outfit: '', hair: 'bald', hat: '', main: '#d4c49a', second: '#b8a578', eye: '#5ac880', accent: '#5ad0f0' },
  gas_ghoul: { skin: '#a8b050', second: '#6a6e78', feats: ['mask', 'gaunt', 'sunkeneyes'], hair: 'bald', eye: '#d03020' },
  vampire_spawn: { skin: '#8a98b0', outfit: 'rags', hair: 'wild', hairColor: '#2a1218', feats: ['fangs', 'redeyes'], eye: '#e03040', main: '#7a7a8a' },
  npc_assassin: { hat: 'cowl', second: '#2a2a30', main: '#1c1c22' },
};

/** The build the generic reading of a row does not give (the mummy is tall: 04-enemies.md "ศพชายสูงใหญ่"). */
const BODY: Record<string, Partial<PersonLook['body']>> = {
  mummy: { scale: 1.3, shoulders: 1.1 },
};

/** The person that draws a humanoid enemy (plan `humanoid`, form `person`, `wolfman`; also the siren and the riders). */
export function personLookOf(e: EnemyLook): PersonLook {
  // a named NPC who fights (the enemy table's NPC rows) is the same figure as on the map and the cards: the NPC's own look, at the enemy row's size
  const looks = (looksRaw as unknown as { items: LooksData }).items;
  if (looks.npcs[e.id]) {
    const L = npcLook(looks, e.id);
    return e.scale && e.scale > L.body.scale ? { ...L, body: { ...L.body, scale: Math.min(1.5, e.scale) } } : L;
  }
  const pt = e.parts;
  const scale = Math.min(1.5, e.scale ?? 1);
  const fix = FIX[e.id];
  const siren = e.form === 'siren', wolf = e.form === 'wolfman', wrapped = e.words.includes('bandage') && e.kinds.includes('undead');
  return {
    kind: 'person', key: `enemy-${e.id}`, race: 'enemy', stage: 'adult', fem: siren,
    body: { ...HUMAN_BODY, scale, ears: siren ? 'fin' : pt?.ears ?? 'round', lower: siren ? 'serpent' : 'legs', head: e.id === 'goblin' ? 1.25 : 1, shoulders: wolf ? 1.2 : 1, ...BODY[e.id] },
    skin: siren ? '#9ab8bc' : wolf || wrapped ? e.main : pt?.skin ?? '#d9a47a',
    hairColor: wolf ? e.second : pt?.hairColor ?? '#3a2a20', eye: e.eye, accent: e.eye,
    main: siren ? e.main : wolf ? e.second : e.main, second: e.second,
    outfit: siren ? '' : resolve(OUTFITS, pt?.outfit ?? 'tunic') || 'tunic',
    hair: siren ? 'long' : wolf ? 'long' : resolve(HAIR, pt?.hair ?? 'short'),
    hat: resolve(HATS, pt?.hat ?? ''), beard: resolve(BEARDS, pt?.beard ?? ''), tool: resolve(TOOLS, pt?.tool ?? ''),
    feats: (pt?.feats ?? []).filter((f) => FEATS[f]), wear: 0.35, ...fix,
  };
}
