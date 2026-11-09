// The fixes of the M7 review round K5 (ก5): a lost clash reaches the stage as a fall and a cold light, the main character is never a silhouette,
// the card picture shows its sky and its effects, the shooting star and the gold beam, the warm light is warmer than the cold.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { cardOfEntry, figuresOf, labelsOf, sceneFor, type SceneView } from '../../src/app/views/scene';
import type { ScenesData } from '../../src/core/data/types-scenes';
import type { GameData } from '../../src/core/game';
import type { GameState, LogEntry } from '../../src/core/types';
import { PERSON_POSE } from '../../src/ui/figure';
import { chroma, paintCard } from '../../src/scene/cardpic';
import { godPixels, lightPixels, type Px } from '../../src/scene/fx';
import { frameAt } from '../../src/scene/timeline';
import { ART, GOD, GOD_FX } from '../../src/scene/tuning';

let data: GameData;
let state: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 3 });
  startLife(s);
  for (let i = 0; i < 12 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  state = s.game.state;
});
const e = (sys: string, kind: string, id: string, d: LogEntry['data'] = {}): LogEntry => ({ n: 1, worldYear: 450, sys, kind, id, data: d, level: 2 });

describe('K5-2 a clash that ends in a loss reaches the stage', () => {
  it('the main actor falls and the light turns cold from behind, after the standing part of the scene', () => {
    const v = sceneFor(data, e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1', outcome: 'แพ้', kind: 'lose' }), state);
    expect(v.kind).toBe('script');
    if (v.kind !== 'script') return;
    const base = (data.scenes.items as ScenesData).scripts.find((s) => s.id === 'NF-AZ02-1')!;
    // the closing is placed after the base scene, so the loss begins at its end, not at 12 s
    expect(v.script.seconds).toBeGreaterThan(base.seconds);
    const before = frameAt(v.script, base.seconds - 1);
    expect(before.actors.find((a) => a.id === 'a')!.pose).toBe('stand');
    expect(before.light.mode).toBe('diffuse');
    const after = frameAt(v.script, base.seconds + 1.5);
    expect(after.actors.find((a) => a.id === 'a')!.pose).toBe('fall');
    expect(after.actors.find((a) => a.id === 'b')!.pose).toBe('stand');
    expect(after.light.mode).toBe('cold-back');
    // the stage plays a lying pose for it (the pose of the sheet that ends on the ground)
    expect(PERSON_POSE.fall).toBe('die');
    expect(PERSON_POSE.lie).toBe('die');
  });
});

describe('K5-3 the main character is never a silhouette', () => {
  const winged = () => sceneFor(data, e('story', 'node', 'wi.e1', { title: 'ปลายทาง' }), state);
  it('the main character is the look of the life, the other person a plain person of the tribe', () => {
    const v = winged();
    expect(v.kind).toBe('script');
    const of = figuresOf(data, state, v);
    const a = of({ id: 'a', label: 'ตัวละคร', count: 1 });
    const b = of({ id: 'b', label: 'อีกคน', count: 1 });
    expect(a.kind).toBe('person');
    expect(b.kind).toBe('person');
    if (b.kind === 'person') expect(b.looks[0].race).toBe('winged');
  });
  it('a stage with no life behind it still shows a person of the scene tribe, not the black placeholder', () => {
    const of = figuresOf(data, null, winged());
    const a = of({ id: 'a', label: 'ตัวละคร', count: 1 });
    expect(a.kind).toBe('person');
    if (a.kind === 'person') expect(a.looks[0].race).toBe('winged');
  });
  it('no actor of any script is a silhouette while the data has looks', () => {
    const scripts = (data.scenes.items as ScenesData).scripts;
    for (const s of scripts.slice(0, 200)) {
      const v: SceneView = { kind: 'script', script: s, card: { id: s.id, title: '', body: '', frame: '', icon: '', mark: '', sound: '', picture: '', fx: [], sky: '' }, entry: e('x', 'y', s.id, {}) };
      for (const lifeState of [state, null]) {
        const of = figuresOf(data, lifeState, v);
        for (const b of s.beats) if (b.k === 'actor') expect(of({ id: b.id, label: b.label, count: b.count ?? 1 }).kind, `${s.id} ${b.label}`).not.toBe('silhouette');
      }
    }
  });
  it('the main character is called by name, the others keep the script label', () => {
    const label = labelsOf(data, state, winged());
    expect(label({ id: 'a', label: 'ตัวละคร' })).toBe(state.life!.name);
    expect(label({ id: 'crowd', label: 'ผู้คน' })).toBe('ผู้คน');
  });
});

describe('K5-9 the card of a clash says the name, not the code', () => {
  it('NF-AZ02-1 is titled by its script', () => {
    const c = cardOfEntry(data, e('combat', 'clash', 'NF-AZ02-1', { npc: 'AZ02-1' }), state);
    expect(c.title).toBe('ซากโรวีร์');
  });
});

describe('K5-6 the card picture shows the sky and the effects of its card', () => {
  const dr04 = () => {
    const c = cardOfEntry(data, e('world', 'event', 'DR-04', { name: 'ฤดูหนาวเถ้า', place: 'KD-01' }), state);
    return { id: c.id, sky: c.sky, fx: c.fx, scenery: c.scenery };
  };
  const mean = (d: Uint8ClampedArray, y0: number, y1: number) => {
    const m = [0, 0, 0];
    for (let y = y0; y < y1; y++) for (let x = 0; x < ART.w; x++) for (let k = 0; k < 3; k++) m[k] += d[(y * ART.w + x) * 4 + k];
    return m.map((v) => v / ((y1 - y0) * ART.w));
  };
  it('DR-04 has a grey sky and ash', () => {
    const c = dr04();
    expect(c.sky).toBe('#5e5e61');
    expect(c.fx).toContain('ash');
  });
  it('the sky rows take the grey of the card on any land, the colour drains, and the picture has specks', () => {
    const c = dr04();
    const withCard = paintCard(c);
    const bare = paintCard({ ...c, sky: '#14161e', fx: [] });
    const skyRows = mean(withCard.data, 0, 100);
    // grey: the three channels are near one another
    expect(Math.max(...skyRows) - Math.min(...skyRows)).toBeLessThan(40);
    expect(chroma([0x5e, 0x5e, 0x61])).toBeLessThan(0.12);
    expect(mean(bare.data, 0, 100)).not.toEqual(skyRows);
    // ash: pixels the effects changed
    const noFx = paintCard({ ...c, fx: [] });
    let changed = 0;
    for (let i = 0; i < withCard.data.length; i += 4) if (withCard.data[i] !== noFx.data[i] || withCard.data[i + 1] !== noFx.data[i + 1]) changed++;
    expect(changed).toBeGreaterThan(300);
  });
  it('a card with a bright sky is not made grey', () => {
    const warm = paintCard({ ...dr04(), sky: '#e8c070', fx: [] });
    const m = mean(warm.data, 0, 100);
    expect(m[0] - m[2]).toBeGreaterThan(30);
  });
});

describe('K5-4 and K5-5 the miracle days', () => {
  it('the shooting star is a red star with a smoke tail, one white frame where it lands, then the crater', () => {
    expect(frameAt((data.scenes.items as ScenesData).scripts.find((x) => x.id === 'mr.MR-17')!, 9).fxPreset).toBe('meteor');
    const M = GOD_FX.meteor;
    const early = godPixels(null, 0.5, 7, 'meteor');
    const late = godPixels(null, 7.5, 7, 'meteor');
    const isRed = (p: Px) => ((p.color >> 16) & 255) > 150 && ((p.color >> 8) & 255) < 90 && !p.add;
    expect(early.filter(isRed).length).toBeGreaterThan(0);
    const area = (l: Px[]) => l.filter(isRed).reduce((s, p) => s + p.w * p.h, 0);
    expect(area(late)).toBeGreaterThan(area(early));
    // not a red wash: nothing covers a fifth of the picture at the start
    expect(early.every((p) => p.w * p.h < ART.w * ART.h * 0.2)).toBe(true);
    // falling: grey smoke trails behind it
    const falling = godPixels(null, 10.5, 7, 'meteor');
    expect(falling.some((p) => !p.add && Math.abs(((p.color >> 16) & 255) - ((p.color >> 8) & 255)) < 30 && p.alpha > 0.1)).toBe(true);
    // one white frame, and only a moment of it
    const flash = (t: number) => godPixels(null, t, 7, 'meteor').some((p) => p.w === ART.w && p.h === ART.h && p.color === 0xffffff);
    expect(flash(M.hitAt + 0.02)).toBe(true);
    expect(flash(M.hitAt - 0.02)).toBe(false);
    expect(flash(M.hitAt + M.flash + 0.05)).toBe(false);
    // after: the dust ring and a black crater that stays
    expect(godPixels(null, 25, 7, 'meteor').some((p) => p.color === 0x050306)).toBe(true);
    expect(godPixels(null, 14, 7, 'meteor').some((p) => p.color === 0xcfc0a0)).toBe(true);
  });
  it('the holy light is gold and a third of the picture wide, with a shimmering rim', () => {
    expect(frameAt((data.scenes.items as ScenesData).scripts.find((x) => x.id === 'mr.MR-04')!, 9).fxPreset).toBe('beam');
    const gold = parseInt(GOD.faith.slice(1), 16);
    const at = (t: number) => godPixels('faith', t, 3, 'beam');
    const list = at(10);
    const row = list.filter((p) => p.y === 140 && p.color === gold && !p.add);
    const span = row.reduce((s, p) => s + p.w, 0);
    expect(span).toBeGreaterThanOrEqual(ART.w / 3);
    expect(span).toBeLessThan(ART.w / 2);
    expect(list.filter((p) => p.color === gold && !p.add).length).toBeGreaterThan(100);
    // the rim shimmers: the lit pixels of the rim are not the same at two moments
    const rim = (l: Px[]) => l.filter((p) => p.w === 2 && p.h === 1 && p.add).map((p) => `${p.x},${p.y},${p.alpha.toFixed(2)}`).join('|');
    expect(rim(at(10))).not.toBe(rim(at(10.4)));
    // the dead rise as white smoke only in the second half
    const white = (l: Px[]) => l.filter((p) => p.color === 0xeeeae4).length;
    expect(white(at(10))).toBe(0);
    expect(white(at(GOD_FX.beam.wispsAt + 2))).toBeGreaterThan(0);
  });
  it('other miracles keep the old effects (no variant)', () => {
    expect(frameAt((data.scenes.items as ScenesData).scripts.find((x) => x.id === 'mr.MR-06')!, 9).fxPreset).toBeUndefined();
    expect(godPixels('faith', 5, 1).length).toBeGreaterThan(0);
    expect(godPixels(null, 5, 1)).toEqual([]);
  });
});

describe('K5-11 the light of a pass is clearly warmer than the light of a fail', () => {
  it('the warm front adds more red than blue, the cold back more blue than red, and both lie over the whole picture', () => {
    const sum = (l: Px[]) => {
      let r = 0;
      let b = 0;
      for (const p of l) {
        const a = p.alpha * p.w * p.h;
        r += ((p.color >> 16) & 255) * a;
        b += (p.color & 255) * a;
      }
      return { r, b };
    };
    const warm = lightPixels('warm-front', undefined, '#ffffff');
    const cold = lightPixels('cold-back', undefined, '#ffffff');
    expect(sum(warm).r / sum(warm).b).toBeGreaterThan(1.5);
    expect(sum(cold).b / sum(cold).r).toBeGreaterThan(1.3);
    for (const l of [warm, cold]) expect(l.some((p) => p.w === ART.w && p.h === ART.h)).toBe(true);
    expect(Math.max(...warm.map((p) => p.alpha))).toBeGreaterThan(0.25);
  });
});
