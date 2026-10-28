import Phaser from 'phaser';
import { raceById } from '../data/races';
import { iconCanvas } from '../ui/icons';

// Draw a tiny pixel-art villager for a race (12x16)
export function drawPortrait(ctx: CanvasRenderingContext2D, raceId: string, scale: number) {
  const r = raceById(raceId);
  const px = (x: number, y: number, c: number, w = 1, h = 1) => {
    ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  };
  ctx.clearRect(0, 0, 12 * scale, 16 * scale);
  if (raceId === 'slime') {
    px(2, 8, r.color, 8, 7); px(3, 6, r.color, 6, 2); px(4, 5, r.color, 4, 1);
    px(4, 9, 0x10203a, 1, 2); px(7, 9, 0x10203a, 1, 2); px(3, 7, 0xbfe8ff, 2, 1);
    return;
  }
  const body = raceId === 'vampire' || raceId === 'darkelf' ? 0x2a1a3a : raceId === 'orc' ? 0x6a4a2a : raceId === 'merfolk' ? 0x2a6a8a : 0x5a4a8a;
  if (raceId === 'fae') { px(0, 5, 0xe0f8ff, 3, 4); px(9, 5, 0xe0f8ff, 3, 4); }
  if (raceId === 'dragonkin' || raceId === 'demonkin') { px(1, 10, raceId === 'dragonkin' ? 0xb04a3a : 0x601020, 2, 4); }
  px(3, 2, r.hair, 6, 2); px(3, 4, r.color, 6, 5); px(2, 4, r.hair, 1, 3); px(9, 4, r.hair, 1, 3);
  px(4, 6, 0x101018, 1, 1); px(7, 6, 0x101018, 1, 1);
  if (raceId === 'vampire') { px(5, 8, 0xffffff, 1, 1); px(6, 8, 0xffffff, 1, 1); px(4, 6, 0xd02020, 1, 1); px(7, 6, 0xd02020, 1, 1); }
  if (raceId === 'orc') { px(4, 8, 0xf0f0d0, 1, 1); px(7, 8, 0xf0f0d0, 1, 1); }
  if (raceId === 'elf' || raceId === 'darkelf') { px(1, 4, r.color, 1, 1); px(10, 4, r.color, 1, 1); }
  if (raceId === 'beast') { px(3, 0, r.hair, 2, 2); px(7, 0, r.hair, 2, 2); }
  if (raceId === 'demonkin') { px(3, 0, 0x3a2a2a, 1, 2); px(8, 0, 0x3a2a2a, 1, 2); }
  if (raceId === 'dragonkin') { px(2, 1, 0xd9a030, 1, 2); px(9, 1, 0xd9a030, 1, 2); }
  if (raceId === 'naga') { px(4, 13, 0x4f8f7a, 5, 3); }
  px(3, 9, body, 6, 4); px(2, 9, r.color, 1, 3); px(9, 9, r.color, 1, 3);
  if (raceId !== 'naga' && raceId !== 'merfolk') { px(4, 13, 0x3a2a1a, 2, 3); px(6, 13, 0x3a2a1a, 2, 3); }
  if (raceId === 'merfolk') { px(4, 13, 0x3a9ab0, 4, 2); px(3, 15, 0x3a9ab0, 6, 1); }
  if (raceId === 'dwarf') { px(3, 7, r.hair, 6, 3); }
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
