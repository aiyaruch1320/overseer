// What the docs say about each of the 143 countries, turned into how its towns are built: the buildings it is known for, the shape
// of its streets, the landmark in its square. Every country of docs/countries/ with a story that shows has an entry here; the rest
// get theirs from the keywords of their own text (harbour, fortress, mine, granary, college...).
import { COUNTRY_DOCS } from '../data/countries';
import type { BStyle, Centre, Plan, WallKind, Ambient } from './themes';
import type { Heart } from './hearts';

export type Special = 'cathedral' | 'granary' | 'warehouse' | 'library' | 'barracks' | 'minehead' | 'arena' | 'market' | 'fortress' | 'drill' | 'shops' | 'bank' | 'hospital' | 'aerie' | 'skydock';
export interface Flavor {
  styles?: [BStyle, number][]; roofs?: number[]; walls?: number[]; leaf?: number[]; plan?: Plan; wall?: WallKind; centre?: Centre; ambient?: Ambient;
  flora?: string[]; extra?: Special[]; lamps?: boolean; farm?: number; tree?: 'oak' | 'pine' | 'palm' | 'dead' | 'jungle' | 'cactus' | 'none'; cobble?: boolean; graves?: boolean;
}

// branches of the world tree (docs/countries/08-silvanel.md): each gives its countries a light of their own
const DAWN = [0xe8c850, 0xf0a860, 0xd8d868, 0xf4e090], TWILIGHT = [0x6a5ac8, 0x4a9a9a, 0x8a6ad8, 0x3a7a8a], DEW = [0x4a9aa8, 0x7ac0c8, 0x3a8a9a, 0x9ad0d8];
const THORN = [0x7a2e3a, 0x5a3a2a, 0x9a4a3a, 0x3a2a30], CLOUD = [0xa8e0c8, 0xc8f0e0, 0x88d0b0, 0xe0f8f0], ROOT = [0x6a4a34, 0x4a6a4a, 0x8a5a8a, 0x5a3a2a];
const WITHER = [0xd8b040, 0xc88a30, 0xb8a050, 0x9a7a30], FUNGI = [0x9a4a8a, 0xc8603a, 0x6a8ad8, 0xd8c070], GREEN = [0x2e7a3e, 0x3d8f45, 0x5aa04e, 0x4a8a5a], RIVER = [0x3a9a8a, 0x5ab8a0, 0x2f8a7a, 0xc8b060];

const F: Record<string, Flavor> = {
  // ---- อัซการ์: the sky islands
  'AZ-01': { styles: [['spire', 6], ['dome', 2], ['gable', 1]], extra: ['aerie', 'aerie', 'aerie', 'fortress', 'cathedral', 'barracks', 'drill', 'library'], centre: 'skynest', roofs: [0x3d78c4, 0xc9a23a, 0xe9e9f6] },
  'AZ-02': { styles: [['forge', 4], ['stone', 3], ['spire', 1]], roofs: [0xa83a2a, 0x7a2e24, 0x4a3a3a], centre: 'caldera', ambient: 'embers', extra: ['barracks', 'arena'] },
  'AZ-03': { styles: [['gable', 4], ['stilt', 2], ['aframe', 1]], centre: 'airship', roofs: [0xf0f0f0, 0x5a8ad0, 0xe0c060], ambient: 'clouds', extra: ['skydock', 'skydock', 'warehouse', 'warehouse'] },
  'AZ-04': { styles: [['stone', 4], ['carved', 3], ['keep', 2]], roofs: [0x6a6a72, 0x5a5a60], wall: 'stone', extra: ['barracks', 'barracks'], centre: 'stairgate' },
  'AZ-05': { styles: [['spire', 5], ['dome', 3]], roofs: [0xe8d070, 0x8a60c8, 0xf4f4ff, 0x4a3a8a], centre: 'twinpalace', extra: ['library'] },
  'AZ-06': { styles: [['dome', 4], ['spire', 3], ['stilt', 1]], roofs: [0x5ac0d8, 0xf4fbff, 0x3a8ad8], centre: 'lake', extra: ['library', 'cathedral'], ambient: 'clouds' },
  'AZ-07': { centre: 'eridan', styles: [['gable', 6], ['hut', 1]], roofs: [0xf4f0e0, 0xd8c890, 0x9ac060], extra: ['granary', 'granary', 'market'], farm: 2 },
  'AZ-08': { styles: [['hut', 3], ['carved', 3], ['stone', 2]], roofs: [0x8a6a4a, 0x6a5440], extra: ['minehead', 'minehead', 'warehouse'], centre: 'liftmine' },
  'AZ-09': { styles: [['brick', 5], ['gable', 2]], roofs: [0x7a7a80, 0x8a5a4a], centre: 'pump', extra: ['warehouse', 'library'], lamps: true },
  'AZ-10': { centre: 'rainspire', styles: [['spire', 4], ['gable', 3], ['stone', 2]], roofs: [0x2a2a5a, 0x3a3a6a, 0x1e1e40], lamps: true, plan: 'organic', ambient: 'fog', extra: ['library'] },
  // ---- มอร์เฮเวน: the hungry lands
  'MH-01': { styles: [['tent', 5], ['hut', 3]], extra: ['barracks', 'barracks', 'arena'], centre: 'bonfire' },
  'MH-02': { styles: [['stone', 4], ['spire', 3]], roofs: [0x2a1a1a, 0x6a1a1a, 0x3a2030], extra: ['cathedral', 'library'], centre: 'obelisk', lamps: true, wall: 'stone' },
  'MH-03': { styles: [['tent', 4], ['hut', 3]], graves: true, ambient: 'embers', extra: ['arena'], centre: 'bonfire' },
  'MH-04': { styles: [['tent', 8]], extra: ['warehouse', 'warehouse'], plan: 'organic', wall: 'none' },
  'MH-05': { styles: [['stone', 5], ['forge', 3], ['keep', 2]], wall: 'iron', extra: ['barracks', 'barracks', 'warehouse'], plan: 'grid', roofs: [0x5a5a64, 0x44444c] },
  'MH-06': { styles: [['hut', 6], ['gable', 2]], farm: 2.2, extra: ['granary', 'granary'], wall: 'none', tree: 'oak', ambient: 'none', roofs: [0xb8a060, 0x9a8a50] },
  'MH-07': { styles: [['stone', 5], ['gable', 2]], extra: ['library', 'library', 'barracks'], roofs: [0x5a4a6a, 0x3a3a50] },
  'MH-08': { styles: [['dome', 5], ['hut', 2]], centre: 'lake', extra: ['cathedral'], tree: 'palm', roofs: [0x5aa0d8, 0xe8e0c8], farm: 0.8 },
  'MH-09': { styles: [['tent', 4], ['stone', 3]], extra: ['market', 'market', 'barracks', 'arena'], lamps: true },
  'MH-10': { styles: [['stone', 4], ['tent', 3]], centre: 'obelisk', extra: ['arena', 'cathedral'], wall: 'stone' },
  'MH-11': { styles: [['stilt', 5], ['hut', 3]], extra: ['warehouse', 'warehouse', 'warehouse'], roofs: [0x5a5048, 0x7a3a30] },
  'MH-12': { styles: [['tent', 3], ['hut', 3]], graves: true, ambient: 'fog', extra: [] },
  // ---- คาซ-ดูรัม: the forge continent
  'KD-01': { styles: [['forge', 4], ['carved', 4], ['stone', 2]], centre: 'forge', extra: ['warehouse', 'library', 'market'], roofs: [0x5a4a4a, 0x7a3a2a] },
  'KD-02': { styles: [['forge', 3], ['carved', 3], ['terrace', 2]], extra: ['warehouse', 'warehouse'], plan: 'canal' },
  'KD-03': { styles: [['carved', 6], ['keep', 3]], wall: 'iron', extra: ['barracks', 'barracks', 'library'] },
  'KD-04': { styles: [['carved', 3], ['stone', 3], ['terrace', 2]], extra: ['library', 'library', 'market'], lamps: true },
  'KD-05': { styles: [['carved', 4], ['spire', 3], ['stone', 1]], roofs: [0x5a3a7a, 0x4a2a60, 0x3a2050], plan: 'radial', lamps: true, ambient: 'fog', extra: ['library'] },
  'KD-06': { styles: [['forge', 5], ['dome', 2], ['stone', 2]], roofs: [0xc2360c, 0x8a2a10, 0x4a2a20], centre: 'abyss', ambient: 'embers' },
  'KD-07': { styles: [['spire', 4], ['stone', 4]], roofs: [0xa83a2a, 0xd8a030], centre: 'statue', extra: ['cathedral', 'arena'] },
  'KD-08': { styles: [['keep', 4], ['carved', 3], ['stone', 2]], wall: 'iron', centre: 'abyss', extra: ['barracks', 'barracks', 'cathedral'], ambient: 'embers' },
  'KD-09': { styles: [['stone', 3], ['dome', 3], ['terrace', 2]], roofs: [0x1a1822, 0x2a2a3a], extra: ['market', 'market', 'warehouse'], lamps: true },
  'KD-10': { styles: [['carved', 5], ['hut', 2]], extra: ['minehead', 'minehead', 'minehead', 'warehouse'], centre: 'bonfire' },
  'KD-11': { styles: [['forge', 4], ['carved', 3], ['stone', 1]], extra: ['cathedral', 'cathedral'], centre: 'forge', ambient: 'embers' },
  'KD-12': { styles: [['aframe', 5], ['stone', 3]], roofs: [0xe8f0f8, 0xb8c8d8], wall: 'stone', extra: ['barracks'], ambient: 'none' },
  // ---- เนเรีย: the sea nations
  'NR-01': { styles: [['terrace', 4], ['stilt', 3], ['gable', 2]], extra: ['warehouse', 'warehouse', 'warehouse', 'market', 'library'], centre: 'lighthouse', lamps: true },
  'NR-02': { styles: [['stilt', 5], ['dome', 2]], centre: 'lake', roofs: [0x5ac0d8, 0xf0f8ff], ambient: 'clouds' },
  'NR-03': { styles: [['stilt', 6], ['hut', 2]], centre: 'gate', extra: ['warehouse'] },
  'NR-04': { styles: [['dome', 6], ['stilt', 2]], roofs: [0x2a5a9a, 0x1a3a7a, 0x3a8aaa], centre: 'gate', extra: ['cathedral'], lamps: true },
  'NR-05': { styles: [['stilt', 5], ['hut', 3]], roofs: [0x2a2a30, 0x6a1a1a], extra: ['warehouse', 'warehouse', 'arena'], wall: 'palisade', centre: 'bonfire' },
  'NR-06': { styles: [['dome', 4], ['stilt', 3]], centre: 'lighthouse', roofs: [0x5ad0d0, 0xf0f8f8], extra: ['cathedral'] },
  'NR-07': { styles: [['dome', 6], ['stone', 2]], roofs: [0x2a8a5a, 0xd8b040, 0x5aa080], centre: 'obelisk', extra: ['cathedral', 'cathedral'] },
  'NR-08': { styles: [['dome', 5], ['spire', 3]], roofs: [0xe8a0c0, 0xf4e8f0, 0xa0c0e8], extra: ['library', 'cathedral'], lamps: true },
  'NR-09': { styles: [['hut', 6], ['stilt', 2]], farm: 1.6, extra: ['granary'], tree: 'palm' },
  'NR-10': { styles: [['stilt', 4], ['hut', 4]], extra: ['warehouse', 'warehouse'], roofs: [0xd8c8a0, 0x7a5a3a] },
  'NR-11': { styles: [['dome', 6], ['stone', 2]], roofs: [0xf0f0f8, 0xd8b8d8], centre: 'gate', extra: ['cathedral', 'cathedral'], wall: 'stone' },
  'NR-12': { styles: [['brick', 3], ['stilt', 3], ['terrace', 2]], extra: ['warehouse', 'warehouse', 'warehouse', 'warehouse'], roofs: [0x6a7a8a, 0xa8603a] },
  'NR-13': { styles: [['dome', 5], ['stilt', 3]], roofs: [0xe86a7a, 0xf0a060, 0x6ad0c8, 0xe8d860], tree: 'palm' },
  'NR-14': { styles: [['stilt', 4], ['stone', 3]], extra: ['warehouse', 'library', 'library'], lamps: true },
  'NR-15': { styles: [['spire', 4], ['stilt', 3], ['gable', 2]], roofs: [0xf0f0f0, 0x5a8ad0], ambient: 'clouds', extra: ['library'] },
  'NR-16': { styles: [['dome', 5], ['stilt', 3]], roofs: [0xa8d8f0, 0xf0f8ff], ambient: 'clouds', extra: ['cathedral'] },
  // ---- อัลเดรีย: the plains, many eras at once
  'AL-01': { styles: [['terrace', 4], ['stone', 3], ['gable', 2], ['dome', 1]], centre: 'council', extra: ['cathedral', 'cathedral', 'library', 'market'], wall: 'none', cobble: true },
  'AL-02': { styles: [['stone', 4], ['gable', 3], ['spire', 3]], extra: ['cathedral', 'cathedral', 'cathedral', 'barracks'], wall: 'stone', roofs: [0xe8e0c0, 0x3a5a9a, 0xd8c070] },
  'AL-03': { styles: [['stone', 4], ['keep', 3], ['gable', 3]], extra: ['barracks', 'barracks'], wall: 'stone' },
  'AL-04': { styles: [['terrace', 4], ['gable', 3], ['stone', 2], ['stilt', 1]], extra: ['warehouse', 'warehouse', 'warehouse', 'barracks'], roofs: [0x2a4a8a, 0xe8e0d0], centre: 'lighthouse' },
  'AL-05': { styles: [['spire', 3], ['terrace', 3], ['gable', 3]], roofs: [0xe8a0c0, 0xc8a0e8, 0xf0d890, 0xa0d0e8], extra: ['market', 'market', 'library'], lamps: true },
  'AL-06': { styles: [['gable', 5], ['terrace', 3], ['brick', 1]], extra: ['library', 'market'], wall: 'none' },
  'AL-07': { styles: [['brick', 6], ['terrace', 2]], extra: ['warehouse', 'warehouse', 'warehouse'], lamps: true, ambient: 'smoke', roofs: [0x6a6a70, 0x8a4a3a] },
  'AL-08': { styles: [['stone', 4], ['keep', 4], ['brick', 2]], extra: ['barracks', 'barracks', 'barracks', 'arena'], wall: 'stone', roofs: [0x5a1a1a, 0x3a3a44] },
  'AL-09': { styles: [['brick', 6], ['terrace', 2]], centre: 'gear', extra: ['warehouse', 'warehouse'], ambient: 'smoke', lamps: true },
  'AL-10': { styles: [['terrace', 5], ['stone', 3], ['gable', 2]], extra: ['market', 'market', 'market', 'warehouse'], roofs: [0xc8a030, 0x7a2a2a, 0x2a4a7a] },
  'AL-11': { styles: [['stone', 4], ['terrace', 3], ['gable', 2]], extra: ['library', 'library', 'library'], centre: 'clock', roofs: [0x3a4a7a, 0x6a3a2a] },
  'AL-12': { styles: [['spire', 4], ['dome', 3], ['tower', 2]], roofs: [0xa8e0f0, 0xd8c8f8, 0x88b8e8], centre: 'crystal', lamps: true, extra: ['library'] },
  'AL-13': { styles: [['tower', 7], ['brick', 2], ['terrace', 1]], roofs: [0xe040c0, 0x40e0e0, 0x8040f0], lamps: true, ambient: 'smoke', extra: ['market', 'market'], cobble: true },
  'AL-14': { styles: [['dome', 6], ['gable', 2]], roofs: [0x6a4ab0, 0x8a6ad8, 0x3a2a7a], ambient: 'fog', centre: 'crystal', extra: ['cathedral'] },
  'AL-15': { styles: [['stone', 4], ['hut', 3], ['brick', 2]], wall: 'palisade', extra: ['barracks', 'barracks', 'warehouse'], graves: true, ambient: 'smoke' },
  'AL-16': { styles: [['burrow', 7], ['gable', 1]], farm: 2, extra: ['granary', 'market'], tree: 'oak', wall: 'hedge', roofs: [0x7aa050, 0xb8a060, 0x9a6a4a] },
  'AL-17': { styles: [['gable', 5], ['hut', 2]], farm: 2.4, extra: ['granary', 'granary', 'granary', 'granary', 'warehouse'], wall: 'none' },
  'AL-18': { styles: [['keep', 4], ['stone', 4]], extra: ['barracks', 'barracks', 'arena', 'cathedral'], wall: 'stone', roofs: [0x3a4a8a, 0x8a2a2a] },
  'AL-19': { styles: [['tent', 3], ['hut', 3], ['gable', 3]], plan: 'organic', wall: 'none', extra: ['market'] },
  'AL-20': { styles: [['stone', 5], ['keep', 3]], wall: 'stone', extra: ['barracks', 'barracks'], lamps: true, ambient: 'fog' },
  'AL-21': { styles: [['stone', 6], ['forge', 2]], extra: ['market', 'market', 'warehouse'], wall: 'stone', roofs: [0x7a6a5a, 0x5a4a40] },
  'AL-22': { styles: [['tree', 5], ['gable', 2]], leaf: GREEN, tree: 'oak', extra: ['library'] },
  'AL-23': { styles: [['hut', 5], ['tent', 3]], plan: 'organic', wall: 'none', farm: 0.6 },
  'AL-24': { styles: [['tent', 5], ['hut', 3]], extra: ['warehouse', 'warehouse', 'arena'], plan: 'organic', farm: 0.3 },
  'AL-25': { styles: [['stone', 6], ['dome', 1]], graves: true, extra: ['cathedral'], ambient: 'fog', roofs: [0x6a6a78, 0x4a4a58] },
  'AL-26': { styles: [['gable', 4], ['stone', 3], ['terrace', 2]], extra: ['cathedral', 'library', 'library'], roofs: [0xf0f0f0, 0x5aa0d0, 0xe8a0a0] },
  'AL-27': { styles: [['boomtown', 6], ['tent', 2], ['hut', 1]], extra: ['minehead', 'minehead', 'market'], plan: 'organic', roofs: [0x8a6a40, 0x6a5030], wall: 'none' },
  'AL-28': { styles: [['brick', 4], ['boomtown', 3], ['terrace', 1]], extra: ['warehouse', 'warehouse', 'warehouse'], lamps: true, ambient: 'smoke', centre: 'clock' },
  // ---- เมคาเรีย: the machine continent
  'MK-01': { styles: [['brick', 5], ['tower', 2], ['spire', 1]], centre: 'gear', extra: ['library', 'warehouse', 'warehouse'], lamps: true, ambient: 'smoke' },
  'MK-02': { styles: [['brick', 5], ['stone', 2]], extra: ['warehouse', 'barracks'], roofs: [0x6a2a2a, 0x4a4a52], wall: 'iron' },
  'MK-03': { styles: [['brick', 4], ['tower', 2], ['dome', 2]], extra: ['library', 'library'], lamps: true, roofs: [0x8ab0c8, 0xd8d8e0] },
  'MK-04': { styles: [['stone', 4], ['brick', 3], ['keep', 3]], centre: 'arkea', wall: 'iron', extra: ['barracks', 'barracks', 'barracks'], ambient: 'fog' },
  'MK-05': { styles: [['brick', 5], ['tower', 1]], extra: ['warehouse', 'warehouse', 'warehouse', 'warehouse'], lamps: true, plan: 'grid' },
  'MK-06': { styles: [['brick', 5], ['forge', 3]], extra: ['barracks', 'warehouse', 'warehouse'], ambient: 'smoke' },
  'MK-07': { styles: [['brick', 4], ['dome', 2], ['gable', 2]], extra: ['library', 'library', 'warehouse'], lamps: true },
  'MK-08': { styles: [['gable', 4], ['dome', 3]], roofs: [0xf4f4f8, 0xc8d8e8], extra: ['library', 'library'], wall: 'iron', lamps: true },
  'MK-09': { styles: [['spire', 3], ['brick', 3], ['gable', 2]], centre: 'airship', extra: ['warehouse', 'warehouse', 'market'], ambient: 'clouds', lamps: true },
  'MK-10': { styles: [['brick', 7]], extra: ['warehouse', 'warehouse'], ambient: 'smoke', roofs: [0x5a5a5e, 0x7a4a3a], plan: 'organic' },
  'MK-11': { styles: [['tree', 3], ['brick', 4]], leaf: GREEN, extra: ['warehouse', 'library'], tree: 'oak' },
  'MK-12': { styles: [['gable', 3], ['boomtown', 2], ['hut', 3]], plan: 'organic', extra: ['warehouse', 'market'], roofs: [0x8a7a5a, 0x6a6a6a] },
  'MK-13': { styles: [['stone', 4], ['brick', 3]], roofs: [0x2a2a40, 0x3a3a50], lamps: true, extra: ['library', 'library'], ambient: 'fog' },
  'MK-14': { styles: [['brick', 7]], extra: ['warehouse', 'warehouse'], ambient: 'smoke', roofs: [0x3a3a3e, 0x4a3a34], ground: undefined } as Flavor,
  'MK-15': { styles: [['brick', 4], ['spire', 3]], centre: 'gear', extra: ['cathedral', 'cathedral'], roofs: [0xd8a030, 0x6a6a6a] },
  'MK-16': { styles: [['brick', 3], ['keep', 4], ['stone', 2]], extra: ['barracks', 'barracks', 'barracks', 'arena'], wall: 'iron' },
  // ---- ซาฮารัน: mountains and sand
  'SH-01': { styles: [['adobe', 4], ['dome', 3], ['tent', 2]], centre: 'oasis', extra: ['market', 'cathedral'], roofs: [0x78b8e8, 0xe8d8a8, 0xc8a060] },
  'SH-02': { styles: [['adobe', 3], ['dome', 3], ['stone', 2]], centre: 'pyramid', extra: ['cathedral', 'cathedral'], graves: true, wall: 'stone' },
  'SH-03': { styles: [['stone', 6], ['keep', 2]], centre: 'obelisk', extra: ['barracks', 'cathedral'], roofs: [0x8a7a6a, 0x6a5a4a], wall: 'stone' },
  'SH-04': { styles: [['adobe', 4], ['tent', 3], ['dome', 2]], extra: ['market', 'market', 'warehouse', 'warehouse'], lamps: true, centre: 'oasis' },
  'SH-05': { styles: [['adobe', 4], ['dome', 3], ['hut', 1]], centre: 'oasis', tree: 'palm', farm: 1.2, extra: ['granary', 'market'] },
  'SH-06': { styles: [['stone', 5], ['dome', 2]], centre: 'obelisk', extra: ['cathedral', 'cathedral'] },
  'SH-07': { styles: [['forge', 5], ['stone', 4]], extra: ['warehouse', 'minehead'], ambient: 'embers', centre: 'forge' },
  'SH-08': { styles: [['dome', 6]], roofs: [0xa8e0e8, 0xe8f4f8, 0x88c8d8], extra: ['market', 'minehead'], lamps: true },
  'SH-09': { styles: [['adobe', 3], ['dome', 4]], extra: ['cathedral', 'cathedral', 'cathedral', 'market'], centre: 'oasis' },
  'SH-10': { styles: [['tent', 5], ['hut', 3]], plan: 'organic', wall: 'none' },
  'SH-11': { styles: [['tent', 6], ['stone', 2]], extra: ['barracks', 'arena'], wall: 'palisade', centre: 'bonfire' },
  'SH-12': { styles: [['burrow', 4], ['adobe', 3], ['hut', 2]], plan: 'organic', wall: 'none', tree: 'cactus' },
  'SH-13': { styles: [['dome', 5], ['stone', 3]], extra: ['library', 'cathedral'], roofs: [0xd8d0b8, 0xb8a890], wall: 'stone' },
  'SH-14': { styles: [['dome', 4], ['stone', 4]], roofs: [0xc8c8d8, 0xa8a8c0], ambient: 'fog', lamps: true, extra: [] },
  'SH-15': { styles: [['adobe', 3], ['stone', 3], ['dome', 2], ['tent', 1]], wall: 'stone', extra: ['market', 'market', 'warehouse', 'barracks'] },
  'SH-16': { styles: [['hut', 4], ['stone', 3], ['gable', 2]], plan: 'organic', extra: ['market'] },
  'SH-17': { styles: [['carved', 6], ['stone', 2]], centre: 'obelisk', extra: ['cathedral', 'cathedral'], roofs: [0x8a7a6a, 0x6a5a4a] },
  // ---- ซิลวาเนล: the world tree and its seven branches
  'SV-01': { flora: ['round', 'fern', 'conifer', 'shrub'], styles: [['tree', 6], ['stone', 1]], leaf: DAWN, centre: 'worldtree', extra: ['library', 'cathedral'], wall: 'hedge' },
  'SV-02': { flora: ['shrub', 'fern', 'round', 'banana'], centre: 'fountain', styles: [['tree', 5], ['gable', 2]], leaf: DAWN, extra: ['cathedral', 'library', 'library'], lamps: true },
  'SV-03': { flora: ['conifer', 'boulder', 'dead', 'shrub'], centre: 'bonfire', styles: [['tree', 4], ['keep', 3]], leaf: [0xb0b060, 0x8a9a50, 0xc8a050], extra: ['barracks', 'barracks'], wall: 'palisade', ambient: 'smoke' },
  'SV-04': { flora: ['willow', 'fern', 'mushroom', 'shrub'], centre: 'council', styles: [['tree', 6], ['mushroom', 2]], leaf: TWILIGHT, lamps: true, ambient: 'leaves', extra: ['library'] },
  'SV-05': { flora: ['willow', 'conifer', 'shrub', 'fern'], centre: 'crystal', styles: [['tree', 5], ['dome', 2]], leaf: TWILIGHT, extra: ['cathedral', 'cathedral'], lamps: true },
  'SV-06': { flora: ['fern', 'conifer', 'boulder', 'willow'], centre: 'pump', styles: [['tree', 5], ['keep', 2]], leaf: DEW, extra: ['barracks', 'library'], ambient: 'fog' },
  'SV-07': { flora: ['conifer', 'round', 'fern', 'bamboo'], styles: [['tree', 5], ['stone', 2]], leaf: DEW, extra: ['library', 'library', 'library'] },
  'SV-08': { flora: ['thorn', 'conifer', 'boulder', 'dead'], styles: [['tree', 3], ['keep', 4]], leaf: THORN, extra: ['barracks', 'barracks', 'barracks'], wall: 'palisade' },
  'SV-09': { flora: ['thorn', 'shrub', 'conifer', 'fern'], styles: [['tree', 4], ['hut', 4]], leaf: THORN, extra: ['warehouse', 'arena'] },
  'SV-10': { flora: ['palm', 'banana', 'fern', 'bamboo'], centre: 'skynest', styles: [['tree', 5], ['spire', 3]], leaf: CLOUD, ambient: 'clouds', extra: ['cathedral'] },
  'SV-11': { flora: ['conifer', 'palm', 'shrub', 'willow'], centre: 'lighthouse', styles: [['tree', 4], ['spire', 4]], leaf: CLOUD, ambient: 'clouds', extra: ['warehouse', 'warehouse'] },
  'SV-12': { flora: ['mushroom', 'fern', 'boulder', 'log'], styles: [['mushroom', 6], ['tree', 2]], leaf: FUNGI, lamps: true, extra: ['library'], ambient: 'leaves' },
  'SV-13': { flora: ['dead', 'log', 'fern', 'mushroom'], centre: 'obelisk', styles: [['tree', 5], ['stone', 2]], leaf: ROOT, graves: true, lamps: true, extra: ['cathedral'], ambient: 'fog' },
  'SV-14': { flora: ['dead', 'shrub', 'log', 'boulder'], styles: [['tree', 6], ['hut', 2]], leaf: WITHER, tree: 'dead', ambient: 'leaves', extra: ['barracks'], wall: 'palisade' },
  'SV-15': { flora: ['shrub', 'round', 'dead', 'banana'], centre: 'lake', styles: [['tree', 4], ['gable', 3]], leaf: WITHER, extra: ['market', 'market', 'warehouse'], lamps: true },
  'SV-16': { flora: ['conifer', 'boulder', 'log', 'fern'], styles: [['hut', 5], ['tree', 3]], leaf: THORN, extra: ['arena', 'warehouse'], wall: 'palisade' },
  'SV-17': { flora: ['palm', 'willow', 'banana', 'bamboo'], styles: [['stilt', 4], ['gable', 3], ['tree', 2]], leaf: RIVER, centre: 'lake', extra: ['warehouse', 'warehouse', 'market'] },
  'SV-18': { flora: ['mushroom', 'willow', 'log', 'reed'], styles: [['mushroom', 8]], leaf: FUNGI, ambient: 'leaves', lamps: true },
  // ---- เนบูเลีย: the fog
  'NB-01': { styles: [['terrace', 3], ['gable', 3], ['stone', 2]], centre: 'clock', extra: ['cathedral', 'library'], lamps: true },
  'NB-02': { styles: [['spire', 4], ['stone', 4]], roofs: [0x3a1a2a, 0x2a1a3a, 0x5a1a2a], wall: 'stone', lamps: true, extra: ['cathedral', 'barracks'], ambient: 'fog' },
  'NB-03': { styles: [['gable', 4], ['terrace', 3], ['aframe', 1]], lamps: true, roofs: [0xd8a040, 0xe0b860, 0x8a5a2a], extra: ['market', 'market'], plan: 'grid' },
  'NB-04': { styles: [['gable', 5], ['stone', 2]], lamps: false, extra: ['library'], ambient: 'fog' },
  'NB-05': { styles: [['stone', 4], ['gable', 3]], roofs: [0x1e1e2a, 0x2a2a3a], extra: ['barracks', 'library'], plan: 'organic', lamps: true },
  'NB-06': { styles: [['gable', 4], ['stone', 3]], extra: ['library', 'library', 'market'], roofs: [0x3a6a4a, 0x4a3a6a], lamps: true },
  'NB-07': { styles: [['stone', 5], ['gable', 2]], extra: ['cathedral', 'cathedral'], ambient: 'fog' },
  'NB-08': { styles: [['stone', 5], ['keep', 3]], centre: 'gate', extra: ['barracks', 'barracks', 'cathedral'], wall: 'stone', ambient: 'fog' },
  'NB-09': { styles: [['tent', 3], ['gable', 3], ['terrace', 2]], extra: ['market', 'market', 'market', 'warehouse'], lamps: true, plan: 'organic', roofs: [0x6a2a5a, 0x2a2a4a, 0xa83a3a] },
  'NB-10': { styles: [['hut', 4], ['gable', 3]], plan: 'organic', extra: ['market'], lamps: true },
  'NB-11': { styles: [['gable', 4], ['terrace', 2], ['spire', 1]], extra: ['market', 'market', 'market'], roofs: [0xd8c0d8, 0xa0c0d8, 0xd8d090], lamps: true },
  'NB-12': { styles: [['stilt', 3], ['gable', 3], ['terrace', 2]], extra: ['warehouse', 'warehouse', 'barracks'], ambient: 'fog', lamps: true },
  'NB-13': { styles: [['stone', 4], ['gable', 3]], roofs: [0x40404a, 0x30303a], ambient: 'fog' },
  'NB-14': { styles: [['tent', 5], ['hut', 3]], plan: 'organic', wall: 'none', lamps: true, extra: ['market', 'warehouse'] },
};

// for countries with no entry above: what their own text talks about
const KEYWORDS: [RegExp, Special[]][] = [
  [/ท่าเรือ|กองเรือ|เมืองท่า|ทะเล/, ['warehouse', 'warehouse']], [/ป้อม|กำแพง|ปราการ|ชายแดน|ทหาร|กองทัพ/, ['barracks', 'barracks']], [/เหมือง|แร่/, ['minehead', 'minehead']],
  [/ไร่|ธัญ|ข้าว|ปศุสัตว์|เกษตร/, ['granary', 'granary']], [/วิหาร|ศาสนจักร|นักบวช|แสวงบุญ/, ['cathedral']], [/วิทยาลัย|สถาบัน|ปราชญ์|ห้องสมุด|มหาวิทยาลัย|บันทึก/, ['library', 'library']],
  [/ตลาด|พ่อค้า|การค้า/, ['market', 'market']], [/ประลอง|ดวล|สนามรบ|แชมเปี้ยน/, ['arena']],
];

const DOC = new Map(COUNTRY_DOCS.map((d) => [d.code, d]));

/** what a country is about, read from its own text: the buildings that make its towns look the part (a land at war has fortresses and drill yards...) */
function roleExtras(d: { title: string; story: string; gov: string; hook: string }): Special[] {
  const text = `${d.title} ${d.story} ${d.gov} ${d.hook}`;
  const hits = (re: RegExp) => (text.match(new RegExp(re.source, 'g')) || []).length;
  const out: Special[] = [];
  if (hits(/สงคราม|ทัพ|ทหาร|นักรบ|ป้อม|อัศวิน|ชายแดน|เกณฑ์|กองเรือรบ|ปืนใหญ่|สนามเพลาะ|ธงรบ|ล้อมเมือง|แนวหน้า/) >= 2) out.push('fortress', 'barracks', 'drill');
  if (hits(/ดวล|ประลอง|ชิงมงกุฎ|แชมเปี้ยน|สังเวียน|นักสู้/) >= 1) out.push('arena');
  if (hits(/ธนาคาร|เงินกู้|สินเชื่อ|การเงิน/) >= 1) out.push('bank');
  if (hits(/โรงพยาบาล|หมอ|รักษา|แพทย์/) >= 1) out.push('hospital');
  if (hits(/ค้า|ตลาด|พ่อค้า|ท่าเรือ|เมืองท่า/) >= 1) out.push('shops');
  return out;
}

export function flavorOf(code: string): Flavor {
  const f = F[code];
  const d = DOC.get(code);
  const role = d ? roleExtras(d) : [];
  if (f) return { ...f, extra: [...role, ...(f.extra || [])] };
  if (!d) return {};
  const text = `${d.title} ${d.story} ${d.gov}`;
  const extra: Special[] = [...role];
  for (const [re, k] of KEYWORDS) if (re.test(text)) extra.push(...k);
  return { extra };
}

const BASE_WEALTH = [0.7, 0.15, 0.5, 0.66, 0.5, 0.56, 0.4, 0.5, 0.45]; // by continent: sky kingdoms, the hungry lands, forge, sea, plains, machines, desert, forest, fog
const RICH = /ร่ำรวย|มั่งคั่ง|ธนาคาร|เงินกู้|การค้า|พ่อค้า|เมืองท่า|สินเชื่อ|ราชสำนัก|ทอง|ไข่มุก|ผ้าไหม/g;
const POOR = /ผู้ลี้ภัย|ยากจน|ค่าย|หิว|ร่อนเร่|ชนชั้นล่าง|ถูกยึด|สนามเพลาะ|ซากเมือง|ไม่มีเมืองถาวร|โจรสลัด|ตื่นทอง|เมืองเถื่อน/g;
/** how rich a country is, from its own text: its streets, its houses and its harbours follow */
export function wealthOf(code: string, continent: number): number {
  const d = DOC.get(code);
  let w = BASE_WEALTH[continent] ?? 0.5;
  if (d) { const t = `${d.title} ${d.story} ${d.gov} ${d.races}`; w += Math.min(0.3, (t.match(RICH) || []).length * 0.1) - Math.min(0.3, (t.match(POOR) || []).length * 0.12); }
  return Math.max(0, Math.min(1, w));
}

const PORT = /ท่าเรือ|เมืองท่า|กองเรือ|ต่อเรือ|เส้นเดินเรือ|การค้า|พ่อค้า|ธนาคาร|ตลาด|สินค้า|ขนส่ง/g;
/** 0 no harbour, 1 a port, 2 a great trading port (the grand quays, piers full of ships, cranes and warehouses) */
export function portOf(code: string, capital: boolean): number {
  const d = DOC.get(code);
  if (!d) return 0;
  const text = `${d.title} ${d.story} ${d.gov}`, n = (text.match(PORT) || []).length, sea = /ท่าเรือ|เมืองท่า|กองเรือ|ต่อเรือ|เส้นเดินเรือ|เรือ/.test(text);
  if (n >= 4 && sea) return 2;
  if (capital && n >= 2 && sea) return 2;
  return n >= 1 && sea ? 1 : 0;
}
/** the sea nations whose towns float on the water: rafts, pontoons and moored hulls, not land */
const FLOATING = new Set(['NR-03', 'NR-05', 'NR-10', 'NR-13', 'NR-14', 'NR-11']);
export const floatsOf = (code: string, hash: number) => FLOATING.has(code) || (code.startsWith('NR-') && hash % 100 < 28);

// ---------------------------------------------------------------- what a land is known for: the heart of its towns
const HEART_WORDS: [Heart, RegExp, number][] = [
  ['minster', /วิหาร|ศาสนจักร|แสวงบุญ|ศักดิ์สิทธิ์|นักบวช|สังฆราช|เทวาธิปไตย|ธรรมราชา|พิธี|ผู้ศรัทธา|ศาสนา|เทพี/g, 1],
  ['towers', /หอคอย|ตึก|บริษัท|โรงงาน|ธนาคาร|เรือเหาะ|จักรกล|ยอดไม้|เมฆ|เวทมนตร์ขั้นสูง|เทคโนโลยี|รถไฟ/g, 1],
  ['citadel', /สงคราม|ทัพ|ทหาร|นักรบ|ป้อม|อัศวิน|ชายแดน|เกณฑ์|ปืนใหญ่|ปราการ|แนวหน้า|ล้อมเมือง/g, 1],
  ['academy', /ห้องสมุด|วิทยาลัย|ปราชญ์|มหาวิทยาลัย|บันทึก|นักวิชาการ|สถาบัน|สภา|หอเวท|ความรู้/g, 1],
  ['bazaar', /ตลาด|พ่อค้า|การค้า|คาราวาน|ตลาดมืด|เส้นทางการค้า|ท่าเรือ|สินค้า/g, 1],
  ['arena', /ดวล|ประลอง|ชิงมงกุฎ|แชมเปี้ยน|สังเวียน|นักสู้|ลานประลอง/g, 2],
  ['tomb', /สุสาน|บรรพบุรุษ|หลุมศพ|ผู้ตาย/g, 2],
];
/** the one great thing a country's capital keeps in place of a square (null when the text has no clear answer), read from its own docs */
const HEART_OVERRIDE: Record<string, Heart> = { 'SV-02': 'minster', 'SV-05': 'minster', 'SV-06': 'citadel', 'SV-10': 'towers', 'SV-13': 'tomb', 'SV-12': 'tomb' };
export function heartOf(code: string): Heart | null {
  if (HEART_OVERRIDE[code]) return HEART_OVERRIDE[code];
  const d = DOC.get(code);
  if (!d) return null;
  const text = `${d.title} ${d.story} ${d.gov} ${d.religion} ${d.hook}`;
  let best: Heart | null = null, bs = 0;
  for (const [h, re, w] of HEART_WORDS) { const n = (text.match(re) || []).length * w; if (n > bs) { bs = n; best = h; } }
  return bs >= 2 ? best : null;
}
