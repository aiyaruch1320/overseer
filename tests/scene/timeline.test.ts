// The time of a scene: a frame is a function of the script and the second, so a scene plays the same at any speed and after a skip.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BEAT_KINDS, type ScenesFile } from '../../src/core/data/types-scenes';
import { BEAT_DEMOS } from '../../src/scene/demo';
import { hash01, particlesAt, seedOf } from '../../src/scene/particles';
import { frameAt, mixColor, resolveScript, soundsBetween } from '../../src/scene/timeline';

const D = (JSON.parse(readFileSync('data/gen/scenes.json', 'utf8')) as ScenesFile).items;
const S = (id: string) => D.scripts.find((s) => s.id === id)!;

describe('the ten kinds of beat each do their one thing', () => {
  it('there is a specimen of each of the ten', () => {
    expect(BEAT_KINDS).toHaveLength(10);
    for (const k of BEAT_KINDS) expect(BEAT_DEMOS[k].beats.some((b) => b.k === k), k).toBe(true);
  });
  it('bg: the last background that has begun', () => {
    const s = BEAT_DEMOS.bg;
    expect(frameAt(s, 1).place).toBe('พื้นหลัง');
    expect(frameAt(s, 4).place).toBe('ฟ้าเปลี่ยน');
    expect(frameAt(s, 4).sky).toBe('#5a2a2a');
  });
  it('actor: stands where the beat puts it, walks to the next place in 0.6 s, leaves nothing behind', () => {
    const s = BEAT_DEMOS.actor;
    expect(frameAt(s, 1).actors.map((a) => [a.id, a.x, a.pose])).toEqual([['a', 0.5, 'stand']]);
    const mid = frameAt(s, 2.8).actors[0];
    expect(mid.x).toBeLessThan(0.5);
    expect(mid.x).toBeGreaterThan(0.2);
    expect(frameAt(s, 3.5).actors[0]).toMatchObject({ x: 0.2, pose: 'walk' });
    expect(frameAt(s, 7).actors.find((a) => a.id === 'crowd')!.count).toBe(4);
  });
  it('camera: eased between frames', () => {
    const s = BEAT_DEMOS.camera;
    expect(frameAt(s, 1).camera.frame).toBe('wide');
    const z = [1, 3.4, 4.6, 7, 8].map((t) => frameAt(s, t).camera.zoom);
    expect(z[0]).toBeLessThan(z[2]); // wide to eye zooms in
    expect(z[3]).toBeGreaterThan(z[4]); // eye to high zooms out
    expect(z[1]).toBeGreaterThan(z[0]);
  });
  it('light: pass is warm from the front, fail cold from behind, a tie even', () => {
    const s = BEAT_DEMOS.light;
    expect(frameAt(s, 1).light.mode).toBe('warm-front');
    expect(frameAt(s, 4).light.mode).toBe('cold-back');
    expect(frameAt(s, 7).light.mode).toBe('diffuse');
  });
  it('fx: on during its time only', () => {
    const s = BEAT_DEMOS.fx;
    expect(frameAt(s, 1).fx.map((f) => f.kind)).toEqual(['ash']);
    expect(frameAt(s, 2.5).fx.map((f) => f.kind)).toEqual(['ash', 'embers']);
    expect(frameAt(s, 5).fx.map((f) => f.kind).sort()).toEqual(['embers', 'rain']);
  });
  it('tone: the colours move over their time and stay', () => {
    const s = BEAT_DEMOS.tone;
    expect(frameAt(s, 0.5).sky).toBe('#2a3a5a');
    const half = frameAt(s, 2.5).sky;
    expect(half).not.toBe('#2a3a5a');
    expect(half).not.toBe('#6a6a70');
    expect(frameAt(s, 4.5).sky).toBe('#6a6a70');
    expect(frameAt(s, 7).wash?.amount).toBeCloseTo(0.3);
  });
  it('text: shown during its time, faded at the edges', () => {
    const s = BEAT_DEMOS.text;
    expect(frameAt(s, 0.1).texts).toHaveLength(0);
    const at = frameAt(s, 2).texts.map((t) => t.role);
    expect(at).toEqual(['title', 'line']);
    expect(frameAt(s, 0.45).texts[0].alpha).toBeLessThan(1);
    expect(frameAt(s, 2).texts[0].alpha).toBe(1);
  });
  it('strike: the old name is struck and the new one comes in', () => {
    const s = BEAT_DEMOS.strike;
    expect(frameAt(s, 0.2).strike).toBeNull();
    expect(frameAt(s, 1).strike!.progress).toBeLessThan(frameAt(s, 4).strike!.progress);
    expect(frameAt(s, 4).strike).toMatchObject({ from: 'ชื่อเดิม', to: 'ชื่อใหม่' });
  });
  it('sound: a cue is on while it is on, and the player is told as the clock passes it', () => {
    const s = BEAT_DEMOS.sound;
    expect(frameAt(s, 1).sounds).toEqual(['ระฆังต่ำหนึ่งครั้ง']);
    expect(frameAt(s, 2.8).sounds).toEqual([]);
    expect(soundsBetween(s, 0, 1)).toEqual(['ระฆังต่ำหนึ่งครั้ง']);
    expect(soundsBetween(s, -1, 0)).toEqual([]);
    expect(soundsBetween(s, 1, 6)).toEqual(['ลมแรงสั้น']);
  });
  it('hold: the particles stop and the clock of motion stays', () => {
    const s = BEAT_DEMOS.hold;
    expect(frameAt(s, 2).motion).toBe(2);
    expect(frameAt(s, 4).motion).toBe(3);
    expect(frameAt(s, 5.5).motion).toBe(3);
    expect(frameAt(s, 7).motion).toBe(4);
  });
});

describe('a frame is the same every time', () => {
  it('any script at any second gives the same frame twice and nothing depends on the order of asking', () => {
    for (const id of ['DR-04', 'NF-AZ02-1', 'mr.MR-17', 'dest.hu', 'LC-01']) {
      const s = S(id);
      const ts = [0, 0.7, s.seconds / 3, s.seconds / 2, s.seconds];
      const a = ts.map((t) => JSON.stringify(frameAt(s, t)));
      const b = [...ts].reverse().map((t) => JSON.stringify(frameAt(s, t))).reverse();
      expect(a).toEqual(b);
    }
  });
  it('the end is done; time outside the scene is clamped', () => {
    const s = S('DR-04');
    expect(frameAt(s, s.seconds).done).toBe(true);
    expect(frameAt(s, 9999).t).toBe(s.seconds);
    expect(frameAt(s, -5).t).toBe(0);
    expect(frameAt(s, 1).done).toBe(false);
  });
  it('the day of an event moves the colours to the new continent (11-world-changes §1.2 beat 4)', () => {
    const s = S('DR-04');
    const before = frameAt(s, 1);
    const after = frameAt(s, 33);
    expect(before.sky).not.toBe(after.sky);
    expect(after.sky).toBe('#8a8a86');
  });
  it('colours mix', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColor('#102030', '#102030', 0.7)).toBe('#102030');
  });
});

describe('variants', () => {
  it('a rite plays the region, then the result, after its own beats', () => {
    const rite = S('rite.hu');
    const flat = resolveScript(rite, ['ทุ่งราบ', 'pass']);
    expect(flat.seconds).toBe(rite.seconds + rite.variants!['ทุ่งราบ'].seconds + rite.variants!.pass.seconds);
    expect(flat.variants).toBeUndefined();
    const last = frameAt(flat, flat.seconds - 1);
    expect(last.light.mode).toBe('warm-front');
    expect(last.actors.find((a) => a.id === 'a')!.pose).toBe('raise');
    expect(resolveScript(rite, ['ทุ่งราบ', 'fail']).beats.some((b) => b.k === 'light' && b.mode === 'cold-back')).toBe(true);
  });
  it('a key the script does not know is skipped; the standard closing fills in for a clash', () => {
    const nf = S('NF-AZ02-1');
    expect(resolveScript(nf, ['ไม่มีอย่างนี้']).seconds).toBe(nf.seconds);
    expect(resolveScript(nf, [undefined, '']).seconds).toBe(nf.seconds);
    const std = S('std.clash');
    expect(resolveScript(nf, ['หนี'], std).seconds).toBe(nf.seconds + std.variants!['หนี'].seconds);
    expect(resolveScript(nf, ['หนี']).seconds).toBe(nf.seconds);
  });
  it('the result of a clash puts the loser down (15-npc-clash-scenes §2)', () => {
    const flat = resolveScript(S('NF-AZ02-1'), ['แพ้']);
    const f = frameAt(flat, flat.seconds - 0.5);
    expect(f.actors.find((a) => a.id === 'a')!.pose).toBe('fall');
    expect(f.light.mode).toBe('cold-back');
  });
});

describe('particles', () => {
  it('a particle is where the number and the time put it', () => {
    expect(particlesAt('ash', 0.5, 7, 3.2)).toEqual(particlesAt('ash', 0.5, 7, 3.2));
    expect(particlesAt('ash', 0.5, 7, 3.2)).not.toEqual(particlesAt('ash', 0.5, 7, 3.3));
    expect(particlesAt('ash', 0.5, 7, 0)).not.toEqual(particlesAt('ash', 0.5, 8, 0));
  });
  it('more amount, more particles; all inside the stage', () => {
    expect(particlesAt('snow', 1, 1, 0).length).toBeGreaterThan(particlesAt('snow', 0.2, 1, 0).length);
    expect(particlesAt('fog', 1, 1, 0).length).toBeLessThan(particlesAt('dust', 1, 1, 0).length);
    for (const k of ['ash', 'embers', 'rain', 'leaves', 'fog', 'sparks'] as const) for (const p of particlesAt(k, 1, 3, 12.5)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1);
    }
  });
  it('the hash is stable and spread', () => {
    expect(hash01(1, 2)).toBe(hash01(1, 2));
    expect(hash01(1, 2)).not.toBe(hash01(2, 1));
    expect(seedOf('DR-01')).not.toBe(seedOf('DR-02'));
  });
});
