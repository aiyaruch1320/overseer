// The sets the characters page can show (code-plan §9.3: every figure in order, with its id, to check by eye). A set is a list of looks;
// the work of M6 adds sets here (races, NPCs by continent, successors, enemies, dragons).
import type { Pose } from '../anim';
import type { BeastLook } from '../beast/look';
import { HUMAN_BODY, type PersonLook, type Stage } from '../look';

export interface Entry { id: string; label: string; look: PersonLook }
/** `pose` is the pose the characters page plays when the address names none (a set of tools opens on the attack). */
/** `beasts`: the figures of the set that are creatures (a slime, a ghost): the characters page draws them with the beast painter after the people. */
export type SetDef = { label: string; entries: () => Entry[]; pose?: Pose; beasts?: () => { id: string; look: BeastLook }[] };

const STAGES: Stage[] = ['infant', 'child', 'teen', 'adult', 'elder'];

export function human(over: Partial<PersonLook> = {}): PersonLook {
  return {
    kind: 'person', key: 'human', race: 'human', stage: 'adult', fem: false, body: HUMAN_BODY,
    skin: '#e8b48a', hairColor: '#3a2a20', eye: '#1e1a22', accent: '#d9a030', main: '#5a6a4a', second: '#6a4a32',
    outfit: 'tunic', hair: 'short', hat: '', beard: '', tool: '', feats: [], wear: 0, ...over,
  };
}

const BASE: Record<string, SetDef> = {
  sample: {
    label: 'ตัวอย่างฐาน (มนุษย์ ทุกวัย ทุกชิ้นส่วนเริ่มต้น)',
    entries: () => [
      ...STAGES.flatMap((stage) => [false, true].map((fem) => ({ id: `${stage}${fem ? '-f' : ''}`, label: `${stage}${fem ? ' หญิง' : ''}`, look: human({ key: `s-${stage}-${fem}`, stage, fem, hair: fem ? 'long' : 'short' }) }))),
      { id: 'spear', label: 'หอก ฮู้ด ผ้าคลุม', look: human({ key: 'spear', tool: 'spear', hat: 'hood', outfit: 'cape' }) },
      { id: 'sword', label: 'ดาบ หมวกเหล็ก เกราะ', look: human({ key: 'sword', tool: 'sword', hat: 'helmet', outfit: 'armor', main: '#7a2a2a' }) },
      { id: 'axe', label: 'ขวาน เครา', look: human({ key: 'axe', tool: 'axe', beard: 'short', skin: '#c98e62' }) },
      { id: 'staff', label: 'ไม้เท้า เสื้อคลุมยาว หมวกปีก', look: human({ key: 'staff', tool: 'staff', outfit: 'robe', hat: 'wide', main: '#3a3a6a', second: '#2a5a8a', accent: '#9fe0ff' }) },
    ],
  },
};

// more sets live in sets-*.ts files beside this one (one file per piece of work, so they never collide), each exporting SET_DEFS
const more = import.meta.glob<{ SET_DEFS: Record<string, SetDef> }>('./sets-*.ts', { eager: true });
export const SETS: Record<string, SetDef> = Object.assign({}, BASE, ...Object.values(more).map((m) => m.SET_DEFS));
