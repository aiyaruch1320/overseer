// The NPCs that are creatures, not people: the rows of docs/appearance/npcs/*.md that the people tables cannot draw (no `peopleId` in
// data/gen/npcs.json) or that the description makes an animal, a slime, a mushroom or a ghost. `npcBeast(id)` gives the BeastLook the beast
// painters draw (src/art/beast) at the size the description gives; null for a person (draw it with resolve.ts's npcLook).
//
// Every id mapped, and why (the word of the description is in brackets):
//   NR11-2  คราเคนผู้เฝ้า "ออร์โธ"   [คราเคนยักษ์ขนาดเรือรบหลายลำ]  no people id · the kraken boss of 04-enemies.md, XXL (a background piece)
//   NR04-3  ซีนอส                    [สัตว์ทะเลลึกขนาดบ้านหนึ่งหลัง]  no people id · the deep-sea boss of 04-enemies.md, XL
//   SV14-1  ผู้ถือขวานโค่นโลก        [ไม่มีมือที่เห็น ไม่มีผิวที่เห็น]  no people id · no skin or hand shows under the hood: the brute of 04-enemies.md
//   SV18-1  ราชาเห็ด ฟังกัส           [เห็ดยักษ์ขนาดบ้านหลังเล็ก]  people id slime, but a mushroom as big as a small house: plant · mushroom, L
//   MH04-2  เงาเถ้า                  [หมาป่าเถ้าตัวใหญ่กว่าตัวอื่นหนึ่งเท่า]  a wolf (race beast, items ไม่มี (สัตว์)): a big grey wolf with a mane, M
//   SV09-3  หมาป่าเงา อาร์กัส         [หมาป่าเงาตัวใหญ่ขนาดม้าแคระ]  a wolf the size of a pony: a shadow wolf, M
//   NR03-3  สไลม์ผู้เรียนรู้           [สไลม์ทะเลสีเขียวใสขนาดเท่าเด็กหกขวบ ไม่มีตา]  a slime the size of a six-year-old
//   NR03-6  ลูมิ                      [สไลม์ใสสีน้ำเงินครามตัวสูงเพียงเข่าคน]  a slime knee-high
//   SV12-2  สไลม์ผู้ผลิตปุ๋ย กลู       [สไลม์เขียวสดขนาดเท่าถังน้ำเด็ก]  a slime the size of a child's pail
//   SV12-6  ไมสท์                     [สไลม์สีน้ำเงินเทาตัวเท่าถังน้ำเล็ก]  a slime the size of a small pail
//   SV18-6  เบลล่า                    [สไลม์สีเขียวมะนาวตัวสูงเท่าหมวกคน]  a slime as tall as a hat
//   NB06-2  นักเล่นแร่ สไลม์ซอส        [สไลม์วัยห้าสิบห้าปี ขนาดเท่าเด็กห้าขวบ]  a slime the size of a five-year-old
//   SV18-4  เด็กเผ่าเห็ด สปอร์       [เด็กตัวเล็กหมวกเห็ดสีเทาซีด ผิวขาวนวล]  a child with a pale mushroom cap, drawn by the person painter (beast/named.ts)
//   MH12-1 MH12-2 AL25-3 SH14-1 SH14-3 SH14-4 SV13-2 NB08-2 NB08-4   [วิญญาณ โปร่งแสง] ghosts: see-through people of the dead; no people id
//   NB13-3  วิญญาณเงา ซิล              [วิญญาณเงารูปร่างคนบางโปร่งสีดำควัน]  a shadow spirit: a ghost
// Not mapped (they are people, drawn from their own race): AL19-4 AL20-4 AL26-3 AL28-4 NB09-1 (no people id, but a child, a pale traveller, a
// patient, a passenger and a masked broker), the beast-folk (race beast: AL12-4 AL23-x SH04-4 SH05-2 SH10-x SV03-3 SV09-2 SV11-x SV16-x), the
// soul-machines (race construct).
import raw from '../../data/gen/looks.json';
import type { EnemyLook, PersonParts, SizeClass } from '../core/data/types-beast-looks';
import type { LooksData, NpcLookRow } from '../core/data/types-looks';
import { beastOf, type BeastLook } from './beast/look';

const rows = (raw as unknown as { items: LooksData }).items.npcs;

/** The ids of the enemy table that an NPC row is the same body as. */
const ENEMY_BODY = ['NR11-2', 'NR04-3', 'SV14-1'] as const;
const GHOSTS = ['MH12-1', 'MH12-2', 'AL25-3', 'SH14-1', 'SH14-3', 'SH14-4', 'SV13-2', 'NB08-2', 'NB08-4', 'NB13-3'] as const;
/** Slimes: [size class, scale, the colour of the nucleus (the doc's, or the second colour)] */
const SLIMES: Record<string, [SizeClass, number, string]> = {
  'NR03-3': ['S', 0.7, '#4aa8f0'], 'NR03-6': ['S', 0.45, '#e8c060'], 'SV12-2': ['S', 0.45, '#e8d050'], 'SV12-6': ['S', 0.4, '#c0e0f0'], 'SV18-6': ['S', 0.4, '#f0e8a0'], 'NB06-2': ['S', 0.65, '#c4e84a'],
};
export const NPC_BEAST_IDS: readonly string[] = [...ENEMY_BODY, 'SV18-1', 'SV18-4', 'MH04-2', 'SV09-3', ...Object.keys(SLIMES), ...GHOSTS];

function base(id: string, row: NpcLookRow, o: Partial<EnemyLook> & Pick<EnemyLook, 'size' | 'scale' | 'plan' | 'form' | 'atkKind' | 'dieKind' | 'main' | 'second' | 'eye'>): EnemyLook {
  return {
    kind: 'enemy', id, name: row.name, group: 'named', tier: '', kinds: [], scaleNote: '', swarm: null, cloud: false, eyeLabel: 'ตา', eyeGiven: true, extra: [], planBy: 'words',
    poses: { idle: row.pose, atk: '', die: '' }, words: [], parts: null, mount: null, ...o,
  };
}

function ghostParts(row: NpcLookRow, elf: boolean): PersonParts {
  return { skin: row.skin, hairColor: row.hairColor, hair: row.hair, hat: row.hat, beard: row.beard, outfit: row.outfit, tool: row.tool, ears: elf ? 'pointed' : 'round', feats: [] };
}

const cache = new Map<string, BeastLook | null>();
/** The beast look of an NPC that is a creature, or null when the NPC is a person. */
export function npcBeast(id: string): BeastLook | null {
  if (cache.has(id)) return cache.get(id)!;
  cache.set(id, build(id));
  return cache.get(id)!;
}

function build(id: string): BeastLook | null {
  if ((ENEMY_BODY as readonly string[]).includes(id)) return beastOf(id) ?? null;
  const row = rows[id];
  if (!row) return null;
  if (id === 'SV18-1') return base(id, row, { size: 'L', scale: 3, plan: 'plant', form: 'mushroom', atkKind: 'spit', dieKind: 'sag', main: row.main, second: row.second, eye: '#7ad070', words: ['mushrooms'] });
  if (id === 'SV18-4') return base(id, row, { size: 'S', scale: 1, plan: 'humanoid', form: 'person', atkKind: 'slam', dieKind: 'topple', main: row.main, second: row.second, eye: '#e8d868', kinds: ['plant'], words: ['mushrooms'] });
  if (id === 'MH04-2') return base(id, row, { size: 'M', scale: 1.25, plan: 'quadruped', form: 'wolf', atkKind: 'lunge', dieKind: 'topple', main: '#8a8a8a', second: '#c0c0c6', eye: '#c8a030', kinds: ['beast'] });
  if (id === 'SV09-3') return base(id, row, { size: 'M', scale: 1.7, plan: 'quadruped', form: 'shadowwolf', atkKind: 'lunge', dieKind: 'topple', main: '#2a2a30', second: '#5a5a66', eye: '#d8a840', kinds: ['beast'] });
  const sl = SLIMES[id];
  if (sl) return base(id, row, { size: sl[0], scale: sl[1], plan: 'amorphous', form: 'slime', atkKind: 'slam', dieKind: 'melt', main: row.main, second: row.second, eye: sl[2], eyeLabel: 'นิวเคลียส', kinds: ['amorphous'] });
  if ((GHOSTS as readonly string[]).includes(id)) {
    const child = row.stage === 'child';
    return base(id, row, { size: 'M', scale: child ? 0.8 : 1.15, plan: 'humanoid', form: 'ghost', atkKind: 'lash', dieKind: 'dissolve', main: row.main, second: row.second, eye: '#c8e8ff', kinds: ['undead', 'spirit'], parts: ghostParts(row, row.race === 'elf') });
  }
  return null;
}
