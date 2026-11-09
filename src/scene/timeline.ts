// The time of a scene as pure functions: `frameAt(script, t)` says what is on the stage at second t, from the beats alone, so a scene
// plays the same at any speed, after a skip, and in a test (code-plan §2.2 rule 2: no clock and no random in the state of a scene).
// The player (ScenePlayer.tsx) only moves t and draws the frame.
import type { Beat, CameraFrame, FxKind, FxPreset, LightMode, Pose, SceneScript, TextRole } from '../core/data/types-scenes';
import { CAMERA, MOVE_TIME, TEXT_FADE } from './tuning';

// ---------- colours ----------

const rgb = (h: string): [number, number, number] => {
  const m = h.replace('#', '');
  const f = m.length === 3 ? m.replace(/./g, (c) => c + c) : m;
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
};
const hex = (v: number[]) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
/** `t` (0 to 1) of the way from colour `a` to colour `b`. */
export const mixColor = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Smooth start and end. */
export const ease = (p: number) => p * p * (3 - 2 * p);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- variants ----------

/**
 * One flat script out of a script and the variants chosen for it, in the order of `keys` (a human rite: the region, then pass or fail).
 * The beats of a variant are placed after the scene; a key the script does not know is looked up in `fallback` (the standard closings of a
 * clash, 15-npc-clash-scenes §2), and one neither knows is skipped.
 */
export function resolveScript(script: SceneScript, keys: readonly (string | undefined)[] = [], fallback?: SceneScript): SceneScript {
  let seconds = script.seconds;
  const beats: Beat[] = [...script.beats];
  for (const k of keys) {
    if (!k) continue;
    const v = script.variants?.[k] ?? fallback?.variants?.[k];
    if (!v) continue;
    for (const b of v.beats) beats.push({ ...b, at: Math.round((b.at + seconds) * 100) / 100 });
    seconds += v.seconds;
  }
  const { variants: _variants, ...rest } = script;
  void _variants;
  return { ...rest, seconds: Math.round(seconds * 100) / 100, beats: beats.map((b, i) => ({ b, i })).sort((x, y) => x.b.at - y.b.at || x.i - y.i).map((x) => x.b) };
}

// ---------- frames ----------

export interface ActorView {
  id: string;
  label: string;
  /** 0 to 1 across the stage, eased from the previous place. */
  x: number;
  pose: Pose;
  tint?: string;
  count: number;
}

export interface TextView {
  role: TextRole;
  text: string;
  /** 0 to 1: the fade at the edges of the line. */
  alpha: number;
}

export interface Frame {
  t: number;
  done: boolean;
  place: string;
  /** The effect of its own the scene has (a miracle: the shooting star, the wide beam), from the script. */
  fxPreset?: FxPreset;
  sky: string;
  ground: string;
  wash: { color: string; amount: number } | null;
  camera: { frame: CameraFrame; zoom: number; lift: number; x: number };
  light: { mode: LightMode; color?: string };
  fx: { kind: FxKind; amount: number; color?: string }[];
  actors: ActorView[];
  texts: TextView[];
  strike: { from: string; to: string; progress: number } | null;
  sounds: string[];
  /** The time the particles move by: it stops while a `hold` beat is on. */
  motion: number;
}

const endOf = (b: Beat, total: number) => (b.dur === undefined ? total : b.at + b.dur);
const within = (b: Beat, t: number, total: number) => t >= b.at && t < endOf(b, total) + 1e-9;
const isKind = <K extends Beat['k']>(b: Beat, k: K): b is Extract<Beat, { k: K }> => b.k === k;

/** What is on the stage at second `t` (clamped to the scene). */
export function frameAt(script: SceneScript, tIn: number): Frame {
  const total = script.seconds;
  const t = Math.max(0, Math.min(total, tIn));
  const beats = script.beats;

  // background: the last one that has begun
  let place = script.title;
  let sky = '#1a1c24';
  let ground = '#0c0d12';
  for (const b of beats) if (isKind(b, 'bg') && b.at <= t) ({ place, sky, ground } = b);

  // tone: a colour change eased over its time, then kept; a wash is the last one's share
  let wash: Frame['wash'] = null;
  for (const b of beats) {
    if (!isKind(b, 'tone') || b.at > t) continue;
    const p = ease(clamp01(b.dur ? (t - b.at) / b.dur : 1));
    if (b.sky) sky = mixColor(sky, b.sky, p);
    if (b.ground) ground = mixColor(ground, b.ground, p);
    if (b.wash) wash = { color: b.wash, amount: (b.amount ?? 0.2) * p };
  }

  // camera: eased from the frame before to the frame of the beat
  let cam = { frame: 'eye' as CameraFrame, zoom: CAMERA.eye.zoom, lift: CAMERA.eye.lift, x: 0 };
  for (const b of beats) {
    if (!isKind(b, 'camera') || b.at > t) continue;
    const goal = CAMERA[b.frame];
    const p = ease(clamp01(b.dur ? (t - b.at) / b.dur : 1));
    cam = { frame: b.frame, zoom: lerp(cam.zoom, (b.zoom ?? 1) * goal.zoom, p), lift: lerp(cam.lift, goal.lift, p), x: lerp(cam.x, b.x ?? 0, p) };
  }

  // light: the last beat that has begun
  let light: Frame['light'] = { mode: 'diffuse' };
  for (const b of beats) if (isKind(b, 'light') && b.at <= t) light = { mode: b.mode, color: b.color };

  // particles on now
  const fx: Frame['fx'] = [];
  for (const b of beats) if (isKind(b, 'fx') && within(b, t, total)) fx.push({ kind: b.kind, amount: b.amount, color: b.color });

  // characters: the beats of one id are its keyframes; it stands from its first beat to the end of its last (or forever)
  const ids = new Map<string, Extract<Beat, { k: 'actor' }>[]>();
  for (const b of beats) if (isKind(b, 'actor')) ids.set(b.id, [...(ids.get(b.id) ?? []), b]);
  const actors: ActorView[] = [];
  for (const [id, list] of ids) {
    const live = list.filter((b) => b.at <= t);
    if (!live.length) continue;
    const cur = live[live.length - 1];
    if (cur.dur !== undefined && t >= cur.at + cur.dur) continue;
    const prev = live.length > 1 ? live[live.length - 2] : undefined;
    const p = prev ? ease(clamp01((t - cur.at) / MOVE_TIME)) : 1;
    actors.push({ id, label: cur.label, x: prev ? lerp(prev.x, cur.x, p) : cur.x, pose: cur.pose, tint: cur.tint, count: cur.count ?? 1 });
  }

  // text on now, faded at the edges
  const texts: TextView[] = [];
  for (const b of beats) {
    if (!isKind(b, 'text') || !within(b, t, total)) continue;
    const e = endOf(b, total);
    const a = Math.min(clamp01((t - b.at) / TEXT_FADE), clamp01((e - t) / TEXT_FADE));
    texts.push({ role: b.role, text: b.text, alpha: Math.max(0.001, a) });
  }

  let strike: Frame['strike'] = null;
  for (const b of beats) if (isKind(b, 'strike') && within(b, t, total)) strike = { from: b.from, to: b.to, progress: clamp01((t - b.at) / Math.max(0.5, (b.dur ?? total - b.at) * 0.5)) };

  const sounds: string[] = [];
  for (const b of beats) if (isKind(b, 'sound') && within(b, t, total)) sounds.push(b.cue);

  // the clock of the particles stops under a hold
  let held = 0;
  for (const b of beats) if (isKind(b, 'hold')) held += Math.max(0, Math.min(t, endOf(b, total)) - b.at);

  return { t, done: t >= total, place, ...(script.fxPreset ? { fxPreset: script.fxPreset } : {}), sky, ground, wash, camera: cam, light, fx, actors, texts, strike, sounds, motion: t - held };
}

/** The cues of sound whose time is in (from, to]: the player plays them once as the clock passes. */
export function soundsBetween(script: SceneScript, from: number, to: number): string[] {
  return script.beats.filter((b): b is Extract<Beat, { k: 'sound' }> => b.k === 'sound' && b.at > from && b.at <= to).map((b) => b.cue);
}
