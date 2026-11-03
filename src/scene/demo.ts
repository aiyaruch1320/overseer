// One tiny script per beat kind, for the storybook and the tests: each shows what its kind does and nothing else. These are not game
// scenes (the game's scripts come from the docs, data/gen/scenes.json); they are the specimens of the ten kinds.
import { BEAT_KINDS, type Beat, type BeatKind, type SceneScript } from '../core/data/types-scenes';

const FRAME = '#e8c36a';
const bg: Beat = { k: 'bg', at: 0, place: 'พื้นหลัง', sky: '#2a3a5a', ground: '#14161e' };
const a: Beat = { k: 'actor', at: 0, id: 'a', label: 'ตัวละคร', x: 0.5, pose: 'stand' };

const mk = (kind: BeatKind, title: string, seconds: number, beats: Beat[]): SceneScript => ({ id: `demo.${kind}`, kind: 'world', title, frame: FRAME, seconds, beats, src: 'src/scene/demo.ts' });

export const BEAT_DEMOS: Record<BeatKind, SceneScript> = {
  bg: mk('bg', 'bg · พื้นหลัง', 6, [
    bg,
    { k: 'bg', at: 3, place: 'ฟ้าเปลี่ยน', sky: '#5a2a2a', ground: '#201010' },
  ]),
  actor: mk('actor', 'actor · ตัวละคร', 8, [
    bg,
    a,
    { ...a, at: 2.5, x: 0.2, pose: 'walk' },
    { ...a, at: 4.5, x: 0.75, pose: 'raise' },
    { k: 'actor', at: 5.5, id: 'crowd', label: 'ผู้คน', x: 0.35, pose: 'stand', count: 4 },
  ]),
  camera: mk('camera', 'camera · กล้อง', 9, [
    bg,
    a,
    { k: 'camera', at: 0, frame: 'wide' },
    { k: 'camera', at: 3, dur: 1.5, frame: 'eye' },
    { k: 'camera', at: 6, dur: 1.5, frame: 'high' },
  ]),
  light: mk('light', 'light · แสง', 9, [
    bg,
    a,
    { k: 'light', at: 0, mode: 'warm-front' },
    { k: 'light', at: 3, mode: 'cold-back' },
    { k: 'light', at: 6, mode: 'diffuse' },
  ]),
  fx: mk('fx', 'fx · อนุภาค', 8, [
    bg,
    { k: 'fx', at: 0, dur: 4, kind: 'ash', amount: 0.8 },
    { k: 'fx', at: 2, dur: 6, kind: 'embers', amount: 0.6 },
    { k: 'fx', at: 4, dur: 4, kind: 'rain', amount: 0.8 },
  ]),
  tone: mk('tone', 'tone · สีเลื่อน', 8, [
    bg,
    a,
    { k: 'tone', at: 1, dur: 3, sky: '#6a6a70', ground: '#2a2a30' },
    { k: 'tone', at: 5, dur: 2, wash: '#ffffff', amount: 0.3 },
  ]),
  text: mk('text', 'text · ข้อความ', 8, [
    bg,
    { k: 'text', at: 0.3, dur: 3, role: 'title', text: 'ชื่อฉาก' },
    { k: 'text', at: 1.5, dur: 3, role: 'line', text: 'บรรทัดบรรยาย' },
    { k: 'text', at: 4.5, dur: 3, role: 'result', text: 'ผลหนึ่งบรรทัด' },
  ]),
  strike: mk('strike', 'strike · ชื่อใหม่', 6, [bg, { k: 'strike', at: 0.5, dur: 5, from: 'ชื่อเดิม', to: 'ชื่อใหม่' }]),
  sound: mk('sound', 'sound · เสียง', 6, [bg, { k: 'sound', at: 0.5, dur: 2, cue: 'ระฆังต่ำหนึ่งครั้ง' }, { k: 'sound', at: 3, dur: 2, cue: 'ลมแรงสั้น' }]),
  hold: mk('hold', 'hold · ค้างภาพ', 8, [bg, { k: 'fx', at: 0, kind: 'motes', amount: 0.8 }, { k: 'hold', at: 3, dur: 3 }, { k: 'text', at: 3, dur: 3, role: 'line', text: 'อนุภาคหยุดนิ่ง' }]),
};

// every kind has a specimen
for (const k of BEAT_KINDS) if (!BEAT_DEMOS[k]) throw new Error('scene demo: no specimen for ' + k);
