// Looks in a Phaser scene: the sheet becomes a texture with one frame per cell, and each pose an animation at the timing of anim.ts.
import type Phaser from 'phaser';
import { FRAME, POSES, SHEET_COLS, frameIndex, type Pose } from './anim';
import { lookKey, type PersonLook } from './look';
import { sheetCanvas } from './sheet';

/** The texture key of a look in this scene (added the first time). */
export function lookTexture(scene: Phaser.Scene, L: PersonLook): string {
  const key = `look:${lookKey(L)}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.addCanvas(key, sheetCanvas(L))!;
  POSES.forEach((p, row) => { for (let i = 0; i < p.n; i++) t.add(row * SHEET_COLS + i, 0, i * FRAME.w, row * FRAME.h, FRAME.w, FRAME.h); });
  for (const p of POSES)
    scene.anims.create({ key: `${key}:${p.id}`, frames: Array.from({ length: p.n }, (_, i) => ({ key, frame: frameIndex(p.id, i) })), frameRate: 1000 / p.ms, repeat: p.loop ? -1 : 0 });
  return key;
}

/** A sprite of a look standing with its feet at (x, y), playing a pose. */
export function addLook(scene: Phaser.Scene, L: PersonLook, x: number, y: number, pose: Pose = 'idle'): Phaser.GameObjects.Sprite {
  const key = lookTexture(scene, L);
  return scene.add.sprite(x, y, key, frameIndex(pose, 0)).setOrigin(0.5 - 3 / FRAME.w, FRAME.foot / FRAME.h).play(`${key}:${pose}`);
}

export function playPose(sprite: Phaser.GameObjects.Sprite, pose: Pose): void {
  sprite.play(`${sprite.texture.key}:${pose}`, true);
}
