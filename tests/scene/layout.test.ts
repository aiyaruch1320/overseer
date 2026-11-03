// Where things stand on the pixel stage (M7 ก1): the whole-number scale, the camera in art pixels, the slots of the figures, the parallax of the layers.
import { describe, expect, it } from 'vitest';
import { cameraOf, clampPan, crowdOffsets, facing, fitScale, layerX, project, slotsOf } from '../../src/scene/layout';
import type { ActorView } from '../../src/scene/timeline';
import { ART } from '../../src/scene/tuning';

const actor = (id: string, x: number, pose: ActorView['pose'] = 'stand', count = 1): ActorView => ({ id, label: id, x, pose, count });

describe('the scale', () => {
  it('is the largest whole multiple that fits the box', () => {
    expect(fitScale(960, 540)).toBe(3);
    expect(fitScale(1280, 720)).toBe(4);
    expect(fitScale(1000, 540)).toBe(3);
    expect(fitScale(960, 500)).toBe(2);
    expect(fitScale(700, 900)).toBe(2);
  });
  it('takes a box a few pixels short of a multiple, never less than 1', () => {
    expect(fitScale(958, 539)).toBe(3);
    expect(fitScale(640, 360)).toBe(2);
    expect(fitScale(700, 100)).toBe(1);
  });
  it('fills the width with a fraction when the box is under 640 px wide (a 630 px box is not 1×)', () => {
    expect(fitScale(630, 354.4)).toBeCloseTo(630 / 320, 5);
    expect(fitScale(630, 354.4)).toBeGreaterThan(1.9);
    expect(fitScale(320, 180)).toBe(1);
    expect(fitScale(480, 270)).toBeCloseTo(1.5, 5);
    expect(fitScale(639, 360)).toBeCloseTo(639 / 320, 5);
  });
  it('never scales past the height of a short box', () => {
    expect(fitScale(600, 180)).toBe(1);
  });
});

describe('the camera', () => {
  const cam = (zoom: number, lift = 0, x = 0) => cameraOf({ frame: 'eye', zoom, lift, x });
  it('keeps whole zoom steps: the eased zoom of the timeline snaps', () => {
    expect([0.86, 1, 1.12, 1.29].map((z) => cam(z).zoom)).toEqual([1, 1, 1, 1]);
    expect([1.3, 1.5, 1.8].map((z) => cam(z).zoom)).toEqual([2, 2, 2]);
  });
  it('looks at the middle at 1×, at the figures\' chests at 2×, never outside the picture', () => {
    expect(cam(1)).toMatchObject({ cx: 160, cy: 90 });
    const close = cam(1.5);
    expect(close.cy).toBeGreaterThan(90);
    expect(close.cy - ART.h / 4).toBeGreaterThanOrEqual(0);
    expect(close.cy + ART.h / 4).toBeLessThanOrEqual(ART.h);
    expect(cam(1, 0.5).cy).toBe(90);
    expect(cam(1.5, -0.9).cy + ART.h / 4).toBeLessThanOrEqual(ART.h);
  });
  it('projects the feet of a figure onto the picture', () => {
    expect(project(cam(1), 100, 150)).toEqual({ x: 100, y: 150 });
    const c = cam(1.5);
    const p = project(c, 160, ART.groundY);
    expect(p.x).toBe(160);
    expect(p.y).toBeLessThan(ART.h);
    // a figure at 2× is twice as tall: its head is farther above its feet on the picture
    expect(project(c, 160, ART.groundY - 28).y - p.y).toBe(-56);
  });
});

describe('the parallax of the layers', () => {
  it('a layer as wide as the stage cannot move; a wider one moves by its share and stops at its edge', () => {
    expect(layerX(320, 1, 50)).toBe(0);
    expect(layerX(640, 0, 50)).toBe(-160);
    expect(layerX(640, 1, 50)).toBe(-210);
    expect(layerX(640, 1, 500)).toBe(-320);
    expect(layerX(640, 1, -500)).toBe(0);
    expect(layerX(640, 0.5, 100)).toBe(-210);
  });
  it('the pan the world takes is the most every moving layer allows', () => {
    const layers = [{ w: 320, speed: 0 }, { w: 480, speed: 0.5 }, { w: 640, speed: 1 }];
    expect(clampPan(1000, layers)).toBe(160);
    expect(clampPan(-1000, layers)).toBe(-160);
    expect(clampPan(40, layers)).toBe(40);
    expect(clampPan(40, [{ w: 320, speed: 0 }])).toBe(40);
  });
});

describe('the figures', () => {
  it('a figure stands with its feet on the ground at its x; a crowd spreads about its x, and every figure has a key', () => {
    const slots = slotsOf([actor('a', 0.5), actor('crowd', 0.25, 'walk', 4)]);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toMatchObject({ key: 'a#0', x: 160, y: ART.groundY });
    const xs = slots.filter((s) => s.key.startsWith('crowd')).map((s) => s.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    expect(Math.abs((xs[0] + xs[3]) / 2 - 80)).toBeLessThanOrEqual(1);
    expect(new Set(slots.map((s) => s.key)).size).toBe(5);
  });
  it('a crowd does not stand in one line', () => {
    expect(new Set(crowdOffsets(6).map((o) => o.dy)).size).toBeGreaterThan(1);
    expect(crowdOffsets(1)).toEqual([{ dx: 0, dy: -1 }]);
  });
  it('one who stands faces the nearest other figure; the foe on the right faces left', () => {
    const f = facing([actor('a', 0.3), actor('b', 0.66)]);
    expect(f.get('a')).toBe(false);
    expect(f.get('b')).toBe(true);
  });
  it('a crowd is not faced; alone a figure faces the middle', () => {
    expect(facing([actor('a', 0.3), actor('crowd', 0.7, 'stand', 3)]).get('a')).toBe(false);
    expect(facing([actor('a', 0.8)]).get('a')).toBe(true);
    expect(facing([actor('a', 0.2)]).get('a')).toBe(false);
  });
  it('a walker faces the way it walks', () => {
    const was = new Map([['a', 0.5]]);
    expect(facing([actor('a', 0.45, 'walk'), actor('b', 0.9)], was).get('a')).toBe(true);
    expect(facing([actor('a', 0.55, 'walk'), actor('b', 0.1)], was).get('a')).toBe(false);
  });
});
