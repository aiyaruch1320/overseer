import Phaser from 'phaser';
import { lookFor, heroLook } from './people';
import { paintFrame } from '../render/characters/paint';
import { POSE } from '../render/characters/pose';
import { stageOfLook } from '../render/characters/kit';
import { iconCanvas } from '../ui/icons';

// A bust of a person for cards and markers: the vector painter, cropped to head and shoulders. `raceId` is a race id, or
// "race~name~dynasty~gender~job~hAge" to paint the actual character at their stage of life.
const BUST_Y: Record<string, number> = { infant: -38, child: -29, teen: -23, adult: -18, elder: -19 };
export function drawPortrait(ctx: CanvasRenderingContext2D, raceId: string, scale: number) {
  ctx.clearRect(0, 0, 12 * scale, 16 * scale);
  const [race, name, dyn, gender, job, hAge] = raceId.split('~');
  const L = name
    ? heroLook({ name, dynastyName: dyn, race, gender, job: job || null, hAge: +hAge }, '')
    : lookFor(`portrait:${race}`, race, 'ชาวบ้าน', { hAge: 30, gender: 'ชาย' });
  const ppu = (12 * scale) / 34;
  ctx.save(); ctx.scale(ppu, ppu); ctx.translate(-11, BUST_Y[stageOfLook(L)] ?? -18);
  paintFrame(ctx, L, POSE.idle);
  ctx.restore();
}

// Phaser texture for a pixel icon (cached per scene texture manager)
export function iconTex(scene: Phaser.Scene, name: string, scale = 2): string {
  const key = `ic_${name}_${scale}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, iconCanvas(name, scale));
  return key;
}

// Phaser texture for a race villager
export function raceTex(scene: Phaser.Scene, raceId: string, scale = 2): string {
  const key = `race_${raceId}_${scale}`;
  if (!scene.textures.exists(key)) {
    const cv = document.createElement('canvas');
    cv.width = 12 * scale; cv.height = 16 * scale;
    drawPortrait(cv.getContext('2d')!, raceId, scale);
    scene.textures.addCanvas(key, cv);
  }
  return key;
}
