// Turns the vector painter into Phaser sprites. A person is a PersonImage: it looks like an ordinary Image to the scene (setFrame, flip,
// angle, depth all work) but its texture is an atlas of pose frames painted on demand at the resolution the camera needs. Zoomed out
// it is a 20-pixel-wide atlas; zoomed in the same person is repainted at up to 8 times that, so details (buttons, eyes, runes) appear.
import Phaser from 'phaser';
import { FW, FH, FOOT, UNIT, type Look } from './kit';
import { paintFrame } from './paint';
import { FRAMES } from './pose';

/** texture pixels per unit; one unit is a third of a city pixel */
export const LODS = [0.35, 0.7, 1.4, 2.8];
const COLS = 7;
const ORIGIN_Y = FOOT / FH;
const MAX_BYTES = 150 * 1024 * 1024;

export function lookKey(L: Look): string {
  return [L.race, L.line || '', L.outfit, L.skin, L.hair, L.hairStyle, L.beard, L.eye, L.mark, L.build, +L.tall, L.cloth, L.cloth2, L.pattern, L.hat, L.tool,
    L.stage || (L.child ? 'c' : L.elder ? 'e' : 'a'), +L.fem, L.accent ?? '', (L.extra || []).join('+'), L.role].join('_');
}

interface Atlas {
  key: string; look: Look; lod: number; ppu: number; fw: number; fh: number; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  tex: Phaser.Textures.CanvasTexture; drawn: Uint8Array; users: number; used: number; bytes: number;
}
const atlases = new Map<string, Atlas>();
let totalBytes = 0;

function atlasFor(scene: Phaser.Scene, L: Look, lod: number): Atlas {
  const key = `pv_${lookKey(L)}@${lod}`;
  const have = atlases.get(key);
  if (have && scene.textures.exists(key)) return have;
  const ppu = LODS[lod], fw = Math.ceil(FW * ppu), fh = Math.ceil(FH * ppu), rows = Math.ceil(FRAMES / COLS);
  const tex = scene.textures.createCanvas(key, fw * COLS, fh * rows)!;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (let i = 0; i < FRAMES; i++) tex.add(i, 0, (i % COLS) * fw, Math.floor(i / COLS) * fh, fw, fh);
  const a: Atlas = { key, look: L, lod, ppu, fw, fh, canvas: tex.getSourceImage() as HTMLCanvasElement, ctx: tex.getContext(), tex, drawn: new Uint8Array(FRAMES), users: 0, used: performance.now(), bytes: fw * COLS * fh * rows * 4 };
  atlases.set(key, a);
  totalBytes += a.bytes;
  if (totalBytes > MAX_BYTES) evict(scene);
  return a;
}

function evict(scene: Phaser.Scene) {
  const now = performance.now();
  for (const [k, a] of [...atlases].sort((x, y) => x[1].used - y[1].used)) {
    if (totalBytes < MAX_BYTES * 0.8) break;
    if (a.users > 0 || now - a.used < 3000) continue;
    scene.textures.remove(k); atlases.delete(k); totalBytes -= a.bytes;
  }
}

// painting is spread over frames: when a lot of new poses are needed at once, people hold their last painted pose a moment
let winStart = 0, spent = 0;
function paint(a: Atlas, frame: number): boolean {
  if (a.drawn[frame]) return true;
  const now = performance.now();
  if (now - winStart > 24) { winStart = now; spent = 0; }
  if (spent > 5 && a.drawn[0] && frame !== 0) return false;
  const x = (frame % COLS) * a.fw, y = Math.floor(frame / COLS) * a.fh;
  const c = a.ctx;
  c.save(); c.beginPath(); c.rect(x, y, a.fw, a.fh); c.clip(); c.translate(x, y); c.scale(a.ppu, a.ppu);
  paintFrame(c, a.look, frame);
  c.restore();
  a.drawn[frame] = 1;
  a.tex.refresh();
  spent += performance.now() - now;
  return true;
}

const byKey = (k: string) => atlases.get(k);

export class PersonImage extends Phaser.GameObjects.Image {
  // `declare` keeps the class fields from being re-initialised after Phaser's constructor has already set the texture
  declare look: Look;
  declare private atlas: Atlas;
  declare private lodT: number;
  declare private lastFrame: number;

  constructor(scene: Phaser.Scene, x: number, y: number, look: Look, frame = 0) {
    const a = atlasFor(scene, look, 0);
    paint(a, 0);
    super(scene, x, y, a.key, frame);
    this.look = look;
    this.atlas = a;
    this.lastFrame = 0;
    this.lodT = Math.random() * 0.3;
    this.setScale(UNIT / a.ppu);
    scene.add.existing(this); // having a preUpdate puts it on the update list: it checks the zoom a few times a second
    this.on(Phaser.GameObjects.Events.DESTROY, () => { const at = byKey(this.texture?.key); if (at) at.users = Math.max(0, at.users - 1); });
    this.setFrame(frame);
  }

  /** the frame's feet sit on the sprite position whatever origin the scene asks for */
  setOrigin(_x?: number, _y?: number) { return super.setOrigin(0.5, ORIGIN_Y); }

  setFrame(frame: string | number | Phaser.Textures.Frame, updateSize?: boolean, updateOrigin?: boolean) {
    const a = byKey(this.texture?.key);
    if (a && typeof frame === 'number') {
      a.used = performance.now();
      if (paint(a, frame)) this.lastFrame = frame; else frame = a.drawn[this.lastFrame] ? this.lastFrame : 0;
    }
    return super.setFrame(frame, updateSize, updateOrigin);
  }

  setTexture(key: string, frame?: string | number) {
    const old = byKey(this.texture?.key);
    const next = byKey(key);
    if (old && old !== next) old.users = Math.max(0, old.users - 1);
    if (next && next !== old) next.users++;
    if (next) { this.atlas = next; this.look = next.look; }
    super.setTexture(key, frame);
    this.setScale(next ? UNIT / next.ppu : 1);
    return this;
  }

  /** switch this person to a different look (the protagonist grows up) */
  setLook(look: Look) {
    this.look = look;
    const a = atlasFor(this.scene, look, this.atlas.lod);
    this.setTexture(a.key, this.lastFrame);
    return this;
  }

  preUpdate(_t: number, dt: number) {
    this.lodT -= dt / 1000;
    if (this.lodT > 0 || !byKey(this.texture?.key)) return;
    this.lodT = 0.25 + Math.random() * 0.1;
    const cam = this.scene.cameras.main;
    const wp = this.parentContainer ? this.parentContainer.getWorldTransformMatrix().transformPoint(this.x, this.y) : { x: this.x, y: this.y };
    const v = cam.worldView, pad = 40;
    const near = wp.x > v.x - pad && wp.x < v.right + pad && wp.y > v.y - pad && wp.y < v.bottom + pad + 40;
    const need = cam.zoom / 3 / (this.parentContainer ? 1 : 1); // screen pixels per unit
    let want = LODS.findIndex((p) => p >= need * 0.9);
    if (want < 0) want = LODS.length - 1;
    if (!near) want = Math.min(want, 0);
    if (want === this.atlas.lod) return;
    const a = atlasFor(this.scene, this.look, want);
    if (!a.drawn[this.lastFrame] && !paint(a, this.lastFrame)) return;
    this.setTexture(a.key, this.lastFrame);
  }
}

/** a person at the default resolution (for scenes that only need a texture key) */
export function personTexture(scene: Phaser.Scene, L: Look, lod = 0): string {
  const a = atlasFor(scene, L, lod);
  paint(a, 0);
  return a.key;
}
export { FRAMES };
