// Turns the picture words of the appearance docs into beats (code-plan §8.3). The docs describe a scene in Thai clauses separated by
// spaces; the composer keeps every clause as text of the scene and reads a few words (fire, ash, fog ...) into particles, light and
// who stands in the frame. The word tables here are the "tables of words" of the look pipeline (code-plan §9.2): extend them when a
// doc uses a word that should draw something.
import type { Beat, CameraFrame, FxKind, LightMode, Pose, SceneKind, SceneScript } from '../../../src/core/data/types-scenes';

// ---------- words ----------

/** First match per kind wins; a text gets at most `FX_MAX` kinds. Order is the order of importance. */
export const FX_WORDS: [RegExp, FxKind][] = [
  [/เถ้า|ขี้เถ้า/, 'ash'],
  [/หิมะ|น้ำแข็ง/, 'snow'],
  [/ลาวา|เปลวไฟ|เปลว|ถ่าน|เพลิง|ภูเขาไฟ|เตาหลอม/, 'embers'],
  [/ฝน|ฟ้าผ่า(?!แห้ง)/, 'rain'],
  [/ใบไม้|เถาวัลย์|กล้า|ต้นไม้|ป่า|ใบเขียว/, 'leaves'],
  [/ทราย|ฝุ่น|ผงขาว|ธุลี|หินร่วง|หุบเหว/, 'dust'],
  [/หมอก/, 'fog'],
  [/ควัน|กำมะถัน|ไอสี/, 'smoke'],
  [/ค้อน|ทั่ง|ประกายส้ม|ประกายแดง|ประกายไฟ|ฟ้าผ่า|สายฟ้า/, 'sparks'],
  [/ดอกไม้|กลีบ/, 'petals'],
  [/ทะเล|คลื่น|น้ำท่วม|น้ำขึ้น|วังวน|น้ำเลี้ยง|น้ำตก/, 'water'],
  [/ขนนก|เกล็ด|ขน/, 'feathers'],
  [/แสง|เรือง|ดาว|มุก|ประกาย/, 'motes'],
];
export const FX_MAX = 2;

export function fxOf(text: string, max = FX_MAX): FxKind[] {
  const out: FxKind[] = [];
  for (const [re, k] of FX_WORDS) if (re.test(text) && !out.includes(k) && out.length < max) out.push(k);
  return out;
}

/** Who stands in the frame: a crowd, a pair, one figure. */
const CROWD = /ผู้คน|ชาวเมือง|ทหาร|กองทัพ|ขบวน|ฝูง|ผู้ชม|ประชาชน|ชาวบ้าน|นักเรียน|ผู้ลี้ภัย|พ่อค้า|นักบวช|ผู้ปรนนิบัติ|คนงาน|ผู้แทน|ผู้รอด|สองฝ่าย|ทุกคน|ผู้อพยพ|ลัทธิ/;
const PAIR = /สองคน|ทั้งสอง|คู่|เพื่อน|พวกพ้อง|พี่น้อง|ญาติ|ผู้เฒ่า|ผู้ใหญ่|ครู|ศิษย์|ลุง|น้า|พ่อ|แม่|ลูก/;
export const crowdIn = (t: string) => CROWD.test(t);
export const pairIn = (t: string) => PAIR.test(t);

/** Light from the words of a scene (13-storyline-scenes §1 "แสง"). */
export function lightOf(text: string, fallback: LightMode = 'diffuse'): LightMode {
  if (/แสงเย็น|ด้านหลัง|เงา|มืด|ดับ|ร่วง|ล้ม|ตาย|หนาว/.test(text) && !/แสงอุ่น|สว่าง/.test(text)) return 'cold-back';
  if (/แสงอุ่น|อุ่น|ทอง|สว่าง|เรือง/.test(text)) return 'warm-front';
  return fallback;
}

// ---------- colours ----------

const hexN = (h: string) => {
  const m = h.replace('#', '');
  const f = m.length === 3 ? m.replace(/./g, (c) => c + c) : m;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const toHex = (v: number[]) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
/** `t` of `b` mixed into `a`. */
export function mix(a: string, b: string, t: number): string {
  const x = hexN(a);
  const y = hexN(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
export const hexes = (s: string): string[] => [...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());

/** Sky and ground of a scene made from its frame colour when the doc gives no palette. */
export function skyOf(frame: string): { sky: string; ground: string } {
  return { sky: mix(frame, '#141620', 0.62), ground: mix(frame, '#07070a', 0.78) };
}

// ---------- text ----------

/** Clauses of a Thai description: the docs separate them with spaces. */
export const clausesOf = (s: string): string[] => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);

/** Joins neighbouring clauses into at most `max` lines of about the same length. */
export function groupClauses(text: string, max: number): string[] {
  const cl = clausesOf(text);
  if (cl.length <= max) return cl;
  const total = cl.reduce((n, c) => n + c.length, 0);
  const goal = total / max;
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (let i = 0; i < cl.length; i++) {
    cur.push(cl[i]);
    len += cl[i].length;
    const left = cl.length - i - 1;
    const slots = max - out.length - 1;
    if ((len >= goal && slots > 0 && left >= slots) || left === slots) {
      out.push(cur.join(' '));
      cur = [];
      len = 0;
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

/** Splits "image words ... เสียง..." at the first clause that starts a sound. */
export function splitSound(text: string): { image: string; sound: string } {
  const cl = clausesOf(text);
  const at = cl.findIndex((c, i) => i > 0 && /^เสียง/.test(c));
  if (at < 0) return /^เสียง/.test(text) ? { image: '', sound: text } : { image: text, sound: '' };
  return { image: cl.slice(0, at).join(' '), sound: cl.slice(at).join(' ') };
}

/** Text of a doc cell without markdown marks and links. */
export const plain = (s: string): string =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- beats ----------

type Cast = { id: string; label: string; x: number; pose: Pose; count?: number; tint?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Spreads lines over [from, to) in equal slots. */
export function lineBeats(lines: string[], from: number, to: number, role: 'line' | 'result' | 'name' = 'line'): Beat[] {
  if (!lines.length) return [];
  const slot = (to - from) / lines.length;
  return lines.map((text, i) => ({ k: 'text' as const, at: r2(from + i * slot), dur: r2(slot), role, text }));
}

/** Figures for a description: a crowd, a pair or one, as placeholders that carry only a label. */
export function castOf(text: string, who = 'ตัวละคร'): Cast[] {
  if (crowdIn(text)) return [{ id: 'crowd', label: 'ผู้คน', x: 0.62, pose: 'stand', count: 4 }, { id: 'a', label: who, x: 0.3, pose: 'stand' }];
  if (pairIn(text)) return [{ id: 'a', label: who, x: 0.34, pose: 'stand' }, { id: 'b', label: 'อีกคน', x: 0.66, pose: 'stand' }];
  return [{ id: 'a', label: who, x: 0.5, pose: 'stand' }];
}

export interface SceneSeed {
  id: string;
  kind: SceneKind;
  title: string;
  frame: string;
  src: string;
  sky: string;
  ground: string;
  /** The place line drawn on the background placeholder. */
  place: string;
  seconds: number;
  /** Lines of text, spread over the body of the scene. */
  lines: string[];
  sounds?: string[];
  fx?: FxKind[];
  cast?: Cast[];
  light?: LightMode;
  camera?: CameraFrame;
  /** Show the title as a name card at the start. */
  titleCard?: boolean;
  /** The last second is held (a permanent result, 17-local-event-visuals §1). */
  hold?: boolean;
}

/** One body of beats: a short scene of the common kind (a local event, an ally node, an arrival, a rite). */
export function composeShort(s: SceneSeed): SceneScript {
  const beats: Beat[] = [
    { k: 'bg', at: 0, place: s.place, sky: s.sky, ground: s.ground },
    { k: 'camera', at: 0, frame: s.camera ?? 'eye' },
    { k: 'light', at: 0, mode: s.light ?? 'diffuse' },
  ];
  for (const k of s.fx ?? []) beats.push({ k: 'fx', at: 0, kind: k, amount: 0.5 });
  (s.cast ?? []).forEach((c, i) => beats.push({ k: 'actor', at: r2(0.4 + i * 0.3), id: c.id, label: c.label, x: c.x, pose: c.pose, count: c.count, tint: c.tint }));
  (s.sounds ?? []).forEach((cue, i) => beats.push({ k: 'sound', at: r2(0.2 + i * 1.5), dur: 2.5, cue }));
  const body0 = s.titleCard === false ? 0.6 : 2.6;
  if (s.titleCard !== false) beats.push({ k: 'text', at: 0.5, dur: 2, role: 'title', text: s.title });
  beats.push(...lineBeats(s.lines, body0, s.seconds - (s.hold ? 1 : 0.4)));
  if (s.hold) beats.push({ k: 'hold', at: s.seconds - 1, dur: 1 });
  return { id: s.id, kind: s.kind, title: s.title, frame: s.frame, seconds: s.seconds, beats: clean(beats), src: s.src };
}

export interface Stage {
  n: number;
  name: string;
  from: number;
  to: number;
  text: string;
}

export interface StagedSeed {
  id: string;
  kind: SceneKind;
  title: string;
  frame: string;
  src: string;
  sky: string;
  ground: string;
  skyAfter?: string;
  groundAfter?: string;
  stages: Stage[];
  fx?: FxKind[];
  /** For stage 5 "ชื่อใหม่": the old name struck, the new one written. */
  strike?: { from: string; to: string };
  seconds?: number;
}

/** The five beats of the day of an event (11-world-changes §1.2), or four for a dragon's fall (§3). */
export function composeStaged(s: StagedSeed): SceneScript {
  const end = s.seconds ?? Math.max(...s.stages.map((x) => x.to));
  const all = s.stages.map((x) => x.text).join(' ');
  const fx = s.fx?.length ? s.fx : fxOf(all);
  const beats: Beat[] = [{ k: 'bg', at: 0, place: s.title, sky: s.sky, ground: s.ground }];
  const st = (n: number) => s.stages.find((x) => x.n === n);
  const s1 = st(1);
  const s2 = st(2);
  const s3 = st(3);
  const s4 = st(4);
  const s5 = st(5);
  if (s1) {
    beats.push({ k: 'camera', at: s1.from, dur: s1.to - s1.from, frame: 'wide' });
    beats.push({ k: 'tone', at: s1.to - 1.5, dur: 1.5, wash: '#ffffff', amount: 0.14 });
  }
  if (s2) beats.push({ k: 'light', at: s2.from, dur: s2.to - s2.from, mode: 'dim' });
  if (s3) {
    const mid = (s3.from + s3.to) / 2;
    beats.push({ k: 'camera', at: s3.from, dur: mid - s3.from, frame: 'high' });
    beats.push({ k: 'camera', at: mid, dur: s3.to - mid, frame: 'eye' });
    beats.push({ k: 'light', at: s3.from, dur: s3.to - s3.from, mode: 'glow', color: s.frame });
    beats.push({ k: 'actor', at: mid, dur: s3.to - mid + 4, id: 'crowd', label: 'ผู้คน', x: 0.5, pose: 'stand', count: 6 });
  }
  if (s4) {
    beats.push({ k: 'camera', at: s4.from, dur: s4.to - s4.from, frame: 'wide' });
    beats.push({ k: 'light', at: s4.from, dur: s4.to - s4.from, mode: 'diffuse' });
    beats.push({ k: 'tone', at: s4.from, dur: s4.to - s4.from, sky: s.skyAfter, ground: s.groundAfter, wash: s.skyAfter ? undefined : '#808080', amount: s.skyAfter ? undefined : 0.18 });
  }
  const on = s3 ? s3.from : (s2?.from ?? 0);
  for (const k of fx) beats.push({ k: 'fx', at: on, dur: end - on, kind: k, amount: 0.6 });
  for (const x of s.stages) {
    const { image, sound } = splitSound(x.text);
    beats.push({ k: 'text', at: x.from, dur: Math.min(1.8, x.to - x.from), role: 'stage', text: `${x.n} ${x.name}` });
    if (x.n === 5 && s.strike) {
      beats.push({ k: 'strike', at: x.from + 0.5, dur: x.to - x.from - 0.5, from: s.strike.from, to: s.strike.to });
    } else if (image) {
      const lines = groupClauses(image, Math.max(1, Math.round((x.to - x.from) / 3.2)));
      beats.push(...lineBeats(lines, x.from + 0.3, x.to - 0.2, x.n === 5 ? 'name' : 'line'));
    }
    if (sound) beats.push({ k: 'sound', at: x.from, dur: Math.min(3, x.to - x.from), cue: sound });
  }
  if (s5 && !s.strike) beats.push({ k: 'text', at: s5.from + 0.2, dur: s5.to - s5.from - 0.2, role: 'title', text: s.title });
  beats.push({ k: 'hold', at: end - 1, dur: 1 });
  return { id: s.id, kind: s.kind, title: s.title, frame: s.frame, seconds: end, beats: clean(beats), src: s.src };
}

/** Drops empty or undefined fields (JSON keeps the file small and the diff quiet) and sorts by time, keeping the order of equal times. */
export function clean(beats: Beat[]): Beat[] {
  const out = beats
    .map((b, i) => ({ b: Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== '')) as Beat, i }))
    .sort((x, y) => x.b.at - y.b.at || x.i - y.i)
    .map((x) => x.b);
  return out;
}

/** A plain variant: poses and light, then a result line. */
export function variantOf(seconds: number, line: string, o: { light?: LightMode; actors?: { id: string; pose: Pose; x?: number; label?: string }[]; fx?: FxKind[]; cue?: string; role?: 'result' | 'line' } = {}): { seconds: number; beats: Beat[] } {
  const beats: Beat[] = [];
  if (o.light) beats.push({ k: 'light', at: 0, mode: o.light });
  for (const a of o.actors ?? []) beats.push({ k: 'actor', at: 0.2, id: a.id, label: a.label ?? (a.id === 'a' ? 'ตัวละคร' : 'อีกคน'), x: a.x ?? (a.id === 'a' ? 0.34 : 0.66), pose: a.pose });
  for (const k of o.fx ?? []) beats.push({ k: 'fx', at: 0, dur: seconds, kind: k, amount: 0.5 });
  if (o.cue) beats.push({ k: 'sound', at: 0, dur: 2, cue: o.cue });
  if (line) beats.push(...lineBeats(groupClauses(line, Math.max(1, Math.round((seconds - 0.8) / 3))), 0.5, seconds - 0.3, o.role ?? 'result'));
  return { seconds, beats: clean(beats) };
}
