// Beasts in a Phaser scene, the same way people are (src/art/phaser.ts): the sheet becomes a texture with one frame per cell, and each pose an
// animation at the timing of anim.ts.
import type Phaser from 'phaser';
import { POSE_OF, SHEET_COLS, type Pose } from '../anim';
import { BEAST_POSES, FRAMES, poseN, poseRow } from './kit';
import { beastKey, type BeastLook } from './look';
import { beastSheetCanvas } from './sheet';

const frameIndex = (pose: Pose, i: number): number => poseRow(pose) * SHEET_COLS + i;

/** The texture key of a beast in this scene (added the first time). */
export function beastTexture(scene: Phaser.Scene, L: BeastLook): string {
  const key = `beast:${beastKey(L)}`;
  if (scene.textures.exists(key)) return key;
  const fr = FRAMES[L.size];
  const t = scene.textures.addCanvas(key, beastSheetCanvas(L))!;
  BEAST_POSES.forEach((pose, row) => { for (let i = 0; i < poseN(pose); i++) t.add(row * SHEET_COLS + i, 0, i * fr.w, row * fr.h, fr.w, fr.h); });
  for (const pose of BEAST_POSES) {
    const p = POSE_OF[pose];
    scene.anims.create({ key: `${key}:${pose}`, frames: Array.from({ length: p.n }, (_, i) => ({ key, frame: frameIndex(pose, i) })), frameRate: 1000 / p.ms, repeat: p.loop ? -1 : 0 });
  }
  return key;
}

/** A sprite of a beast standing with its feet at (x, y), playing a pose. A swarm shows several bodies in the one sprite. */
export function addBeast(scene: Phaser.Scene, L: BeastLook, x: number, y: number, pose: Pose = 'idle'): Phaser.GameObjects.Sprite {
  const key = beastTexture(scene, L);
  const fr = FRAMES[L.size];
  return scene.add.sprite(x, y, key, frameIndex(pose, 0)).setOrigin(0.5, fr.foot / fr.h).play(`${key}:${pose}`);
}

export function playBeast(sprite: Phaser.GameObjects.Sprite, pose: Pose): void {
  sprite.play(`${sprite.texture.key}:${pose}`, true);
}
