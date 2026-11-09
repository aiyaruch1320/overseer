// The scene stage in Phaser (M7 ก1; code-plan §8.3, 21-pixel-art.md §4): a game of 320 × 180 art pixels that draws one `Frame` of a scene. This file is the
// only one of the scene player that imports Phaser; the component (../Stage.tsx) loads it on demand so a page that plays no scene never loads Phaser.
//
// The stage holds no time. `set()` hands it the latest frame and it draws that: the painted layers of the place (moved by the camera's pan, each at its own
// speed), the mood colours of the beats over them, the figures of the actors (sprites of their looks, in the pose of the beat), the particles, the light and the wash.
// The particles and the light are lists of rectangles of whole art pixels from the pure part (../fx/), drawn here on the screen of the picture (not the world: the
// camera's zoom does not make a particle two pixels), light added to what is behind it. The words are not here: Thai text is DOM over the canvas (../Stage.tsx).
import Phaser from 'phaser';
import { addBeast, playBeast } from '../../art/beast/phaser';
import { BEAST_POSES } from '../../art/beast/kit';
import type { Pose } from '../../art/anim';
import { addLook, playPose } from '../../art/phaser';
import type { Scenery, ScenerySpec } from '../../art/scenery';
import { BEAST_POSE, PERSON_POSE } from '../../ui/figure';
import { figureKey, type Figure, type FigureOf } from '../figures';
import { fxPixels, godOf, godPixels, lightPixels, variantOf, type Px } from '../fx';
import { cameraOf, clampPan, layerX, slotsOf, type Cam } from '../layout';
import { sceneryFor, specKey } from '../scenery';
import { mixColor, type ActorView, type Frame } from '../timeline';
import { ART, CAST, DEPTH, MOOD, POSE, RIM, SHADOW, SIL } from '../tuning';

const hex = (s: string): number => parseInt(s.replace('#', '').slice(0, 6), 16) || 0;

/** What the component hands the stage on every frame. */
export interface StageInput {
  frame: Frame;
  /** The colour of the scene's frame: the rim of a silhouette. */
  frameColor: string;
  scenery: ScenerySpec;
  figureOf: FigureOf;
  /** Makes the particles of this scene differ from another's (a number from its id). */
  seed: number;
  /** Whether the beats' mood colours tint the painted place (default yes; the calm picture of the watch screen has none: its place is the season's). */
  mood?: boolean;
}

interface Shown {
  key: string;
  scenery: Scenery;
  images: { image: Phaser.GameObjects.Image; w: number; speed: number }[];
}

/**
 * Two graphics for a list of pixels: what covers and what adds light. They are drawn in the 320 × 180 screen of the picture and placed over whatever the camera
 * shows (scaled by 1/zoom, moved to its corner), so a pixel of a particle is one art pixel at any camera.
 */
class PxLayer {
  private readonly cover: Phaser.GameObjects.Graphics;
  private readonly add: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, depth: number) {
    this.cover = scene.add.graphics().setDepth(depth);
    this.add = scene.add.graphics().setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
  }
  place(cam: Cam): void {
    for (const g of [this.cover, this.add]) g.setScale(1 / cam.zoom).setPosition(cam.cx - ART.w / 2 / cam.zoom, cam.cy - ART.h / 2 / cam.zoom);
  }
  draw(list: readonly Px[]): void {
    this.cover.clear();
    this.add.clear();
    for (const p of list) (p.add ? this.add : this.cover).fillStyle(p.color, p.alpha).fillRect(p.x, p.y, p.w, p.h);
  }
}

interface Figured {
  sprite: Phaser.GameObjects.Sprite;
  /** Four copies a pixel off to each side, drawn light and behind: the faint rim that keeps a dark figure from vanishing into the ground. */
  rims: Phaser.GameObjects.Sprite[];
  key: string;
  pose: string;
}

class StageScene extends Phaser.Scene {
  want: StageInput | null = null;
  dirty = false;
  /** Told once, when the first frame is drawn. */
  onShown?: () => void;
  private ready = false;
  private serial = 0;
  private shown: Shown | null = null;
  private figured = new Map<string, Figured>();
  private before = new Map<string, number>();
  private mood!: Phaser.GameObjects.Graphics;
  private shadows!: Phaser.GameObjects.Graphics;
  private fx!: PxLayer;
  private light!: PxLayer;
  private wash!: Phaser.GameObjects.Graphics;
  private drawn = { mood: '', light: '', wash: '', fx: '' };

  constructor() {
    super('scene-stage');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.mood = this.add.graphics().setDepth(DEPTH.mood);
    this.shadows = this.add.graphics().setDepth(DEPTH.shadow);
    this.fx = new PxLayer(this, DEPTH.fx);
    this.light = new PxLayer(this, DEPTH.light);
    this.wash = this.add.graphics().setDepth(DEPTH.wash);
    this.ready = true;
  }

  update(): void {
    this.syncRims();
    if (!this.ready || !this.want || !this.dirty) return;
    this.dirty = false;
    this.apply(this.want);
    if (this.onShown) {
      this.onShown();
      this.onShown = undefined;
    }
  }

  // ---------- one frame ----------

  private apply(w: StageInput): void {
    const f = w.frame;
    const cam = cameraOf(f.camera);
    const sc = this.layers(w.scenery);
    const pan = clampPan(cam.pan, sc.images.map((l) => ({ w: l.w, speed: l.speed })));
    const view: Cam = { ...cam, pan };
    this.cameras.main.setZoom(view.zoom).centerOn(view.cx, view.cy);
    for (const l of sc.images) l.image.setX(layerX(l.w, l.speed, pan));
    this.paintMood(f, w.mood !== false);
    this.figures(w, view);
    this.paintLight(f, sc.scenery.light, view);
    this.paintFx(f, sc.scenery.ambient, w.seed, view);
    this.paintWash(f);
  }

  /** The images of the layers of a place; a new place replaces them (its layers are painted once, `sceneryFor`). */
  private layers(spec: ScenerySpec): Shown {
    const key = specKey(spec);
    if (this.shown?.key === key) return this.shown;
    for (const l of this.shown?.images ?? []) {
      this.textures.remove(l.image.texture.key);
      l.image.destroy();
    }
    const scenery = sceneryFor(spec);
    const images = scenery.layers.map((l, i) => {
      const tex = `scenery:${key}:${l.name}:${i}:${this.serial++}`;
      const cv = document.createElement('canvas');
      cv.width = l.frame.w;
      cv.height = l.frame.h;
      cv.getContext('2d')!.putImageData(new ImageData(l.frame.data, l.frame.w, l.frame.h), 0, 0);
      this.textures.addCanvas(tex, cv);
      const image = this.add.image(0, 0, tex).setOrigin(0, 0).setDepth(DEPTH.layer + i);
      return { image, w: l.frame.w, speed: l.speed };
    });
    this.shown = { key, scenery, images };
    return this.shown;
  }

  /** The colours of the sky and the ground that the beats set (`bg`, `tone`) laid lightly over the painted place: the mood of the story over the look of the land (the continent stays recognisable, see `MOOD`). */
  private paintMood(f: Frame, on: boolean): void {
    const k = on ? `${f.sky}|${f.ground}` : '';
    if (this.drawn.mood === k) return;
    this.drawn.mood = k;
    const horizon = ART.groundY - 6;
    this.mood.clear();
    if (!on) return;
    this.mood.fillStyle(hex(f.sky), MOOD.sky).fillRect(0, 0, ART.w, horizon);
    this.mood.fillStyle(hex(f.ground), MOOD.ground).fillRect(0, horizon, ART.w, ART.h - horizon);
  }

  /** The light of the beat (../fx/light.ts: bands from the front below, from behind above, in rings from the middle, over all), added to the picture; drawn again only when the beat's light changes. */
  private paintLight(f: Frame, placeLight: string, cam: Cam): void {
    this.light.place(cam);
    const k = `${f.light.mode}|${f.light.color ?? ''}|${placeLight}`;
    if (this.drawn.light === k) return;
    this.drawn.light = k;
    this.light.draw(lightPixels(f.light.mode, f.light.color, placeLight));
  }

  /**
   * The particles of the beats, the faint ambient of the place under them, and the god's effects when the light is the glow of one of his powers (the pillar of faith
   * with its shaking rim, the smoke of dread, the thread of fate). They depend on the motion clock alone, so they stand still while it is held.
   */
  private paintFx(f: Frame, ambient: string | undefined, seed: number, cam: Cam): void {
    this.fx.place(cam);
    const variant = variantOf(f.place);
    // the shooting star plays on its own clock, the other powers only while their glow is on
    const god = f.light.mode === 'glow' ? godOf(f.light.color) : null;
    const k = `${f.motion}|${seed}|${ambient ?? ''}|${god ?? ''}|${variant ?? ''}|${f.fx.map((x) => `${x.kind}:${x.amount}:${x.color ?? ''}`).join(',')}`;
    if (this.drawn.fx === k) return;
    this.drawn.fx = k;
    const list = fxPixels(f.fx, f.motion, seed, ambient);
    if (god || variant === 'meteor') list.push(...godPixels(god, f.motion, seed, variant));
    this.fx.draw(list);
  }

  private paintWash(f: Frame): void {
    const k = f.wash ? `${f.wash.color}|${f.wash.amount.toFixed(3)}` : '';
    if (this.drawn.wash === k) return;
    this.drawn.wash = k;
    this.wash.clear();
    if (f.wash) this.wash.fillStyle(hex(f.wash.color), f.wash.amount).fillRect(0, 0, ART.w, ART.h);
  }

  // ---------- the figures ----------

  private figures(w: StageInput, cam: Cam): void {
    const f = w.frame;
    const slots = slotsOf(f.actors, this.before);
    this.before = new Map(f.actors.map((a) => [a.id, a.x]));
    const byId = new Map<string, ActorView>(f.actors.map((a) => [a.id, a]));
    const live = new Set<string>();
    this.shadows.clear();
    for (const s of slots) {
      const a = byId.get(s.key.split('#')[0])!;
      const fig = w.figureOf({ id: a.id, label: a.label, count: a.count });
      live.add(s.key);
      const key = figureKey(fig);
      let have = this.figured.get(s.key);
      if (have && have.key !== key) {
        have.sprite.destroy();
        have.rims.forEach((r) => r.destroy());
        this.figured.delete(s.key);
        have = undefined;
      }
      const x = s.x - cam.pan;
      if (!have) {
        const sprite = this.build(fig, s.i, x, s.y, a, w);
        have = { sprite, key, pose: '', rims: fig.kind === 'silhouette' ? [] : RIM.offsets.map(() => this.add.sprite(x, s.y, sprite.texture.key, sprite.frame.name).setOrigin(sprite.originX, sprite.originY).setTintFill(RIM.color).setAlpha(RIM.alpha)) };
        this.figured.set(s.key, have);
        // a group does not step in time
        if (a.count > 1 && have.sprite.anims?.currentAnim) have.sprite.anims.setProgress((s.i * 0.37) % 1);
      }
      this.setPose(have, fig, a, w);
      const sprite = have.sprite;
      sprite.setFlipX(s.flip);
      sprite.setDepth(DEPTH.figure + s.y);
      const drop = fig.kind === 'silhouette' ? POSE[a.pose].drop * SIL.h * 0.85 : 0;
      sprite.setPosition(x, s.y + drop);
      sprite.setTint(this.cast(a, w, fig));
      this.syncRim(have);
      this.shadows.fillStyle(0x000000, SHADOW.alpha).fillEllipse(x, s.y, SHADOW.w * (fig.kind === 'beast' ? 2.5 : 1), SHADOW.h);
    }
    for (const [k, v] of this.figured)
      if (!live.has(k)) {
        v.sprite.destroy();
        v.rims.forEach((r) => r.destroy());
        this.figured.delete(k);
      }
  }

  /** The rim copies follow their figure: its frame (the animation plays on its own between stage frames), place, side and depth. */
  private syncRim(h: Figured): void {
    const sp = h.sprite;
    h.rims.forEach((r, i) => {
      const [dx, dy] = RIM.offsets[i];
      if (r.texture.key !== sp.texture.key || r.frame.name !== sp.frame.name) r.setTexture(sp.texture.key, sp.frame.name);
      r.setFlipX(sp.flipX).setPosition(sp.x + dx, sp.y + dy).setDepth(sp.depth - 0.5).setOrigin(sp.originX, sp.originY);
    });
  }

  private syncRims(): void {
    for (const h of this.figured.values()) this.syncRim(h);
  }

  /** The tint of a figure: a cast of the actor's own colour and of the place's light, white where there is none. */
  private cast(a: ActorView, w: StageInput, fig: Figure): number {
    if (fig.kind === 'silhouette') return 0xffffff;
    let c = '#ffffff';
    if (a.tint) c = mixColor(c, a.tint, CAST.tint);
    return hex(mixColor(c, w.frame.light.color ?? '#ffffff', CAST.place));
  }

  private build(fig: Figure, i: number, x: number, y: number, a: ActorView, w: StageInput): Phaser.GameObjects.Sprite {
    if (fig.kind === 'person') return addLook(this, fig.looks[i % fig.looks.length], x, y, PERSON_POSE[a.pose] ?? 'idle');
    if (fig.kind === 'beast') return addBeast(this, fig.look, x, y, this.beastPose(a));
    return this.silhouette(a.tint ?? w.frameColor, x, y);
  }

  private beastPose(a: ActorView): Pose {
    const p = BEAST_POSE[a.pose] ?? 'idle';
    return BEAST_POSES.includes(p) ? p : 'idle';
  }

  private setPose(h: Figured, fig: Figure, a: ActorView, w: StageInput): void {
    const next = `${a.pose}`;
    if (h.pose === next) return;
    const first = h.pose === '';
    h.pose = next;
    if (a.pose === 'lie' && fig.kind !== 'silhouette') {
      // lying down is the last frame of the die pose held, without the hurt flash of its first frame
      const die = this.anims.get(`${h.sprite.texture.key}:${fig.kind === 'person' ? PERSON_POSE.lie : this.beastPose(a)}`);
      const last = die?.frames[die.frames.length - 1];
      h.sprite.anims.stop();
      if (last) h.sprite.setTexture(last.textureKey, last.textureFrame);
    } else if (fig.kind === 'person') {
      if (!first) playPose(h.sprite, PERSON_POSE[a.pose] ?? 'idle');
    } else if (fig.kind === 'beast') {
      if (!first) playBeast(h.sprite, this.beastPose(a));
    } else {
      const p = POSE[a.pose];
      h.sprite.setAngle(p.rot).setScale(p.scale);
      const arm = p.arm ? 1 : 0;
      const tex = this.silTexture(a.tint ?? w.frameColor, arm);
      h.sprite.setTexture(tex);
    }
  }

  // ---------- the silhouette: a dark head and cloak with a light rim, drawn once per rim colour ----------

  private silTexture(rim: string, arm: number): string {
    const key = `sil:${rim}:${arm}`;
    if (this.textures.exists(key)) return key;
    const t = this.textures.createCanvas(key, SIL.w, SIL.h)!;
    const c = t.getContext();
    const body = (grow: number, fill: string) => {
      c.fillStyle = fill;
      // head
      const hr = SIL.head + grow;
      for (let y = -hr; y <= hr; y++) {
        const half = Math.round(Math.sqrt(Math.max(0, hr * hr - y * y)));
        c.fillRect(SIL.w / 2 - half, SIL.head + 1 + y, half * 2, 1);
      }
      // cloak: a trapezoid from the shoulders to the hem
      for (let y = SIL.cloakTop - grow; y < SIL.h - 1 + grow; y++) {
        const half = 4 + Math.round(((y - SIL.cloakTop) / (SIL.h - SIL.cloakTop)) * 5) + grow;
        c.fillRect(SIL.w / 2 - half, y, half * 2, 1);
      }
    };
    body(1, rim);
    body(0, '#07080c');
    if (arm) {
      c.fillStyle = rim;
      for (let i = 0; i < 14; i++) c.fillRect(SIL.w / 2 + 3 + Math.round(i * 0.45), SIL.cloakTop + 4 - i, 2, 1);
    }
    t.refresh();
    return key;
  }

  private silhouette(rim: string, x: number, y: number): Phaser.GameObjects.Sprite {
    return this.add.sprite(x, y, this.silTexture(rim, 0)).setOrigin(0.5, 1);
  }
}

/** What the component holds: it feeds the stage frames and tears it down. */
export class SceneStage {
  readonly game: Phaser.Game;
  private readonly scene = new StageScene();
  constructor(parent: HTMLElement, zoom: number, onShown?: () => void) {
    this.scene.onShown = onShown;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: ART.w,
      height: ART.h,
      backgroundColor: '#0c0d12',
      scale: { mode: Phaser.Scale.NONE, zoom },
      pixelArt: true,
      roundPixels: true,
      banner: false,
      audio: { noAudio: true },
      disableContextMenu: true,
      input: { mouse: false, touch: false, keyboard: false, gamepad: false },
      render: { antialias: false, powerPreference: 'low-power' },
      scene: this.scene,
    });
  }
  /** The frame to draw next (drawn on the next tick of the game; many calls between two ticks cost nothing). */
  set(input: StageInput): void {
    this.scene.want = input;
    this.scene.dirty = true;
  }
  setZoom(zoom: number): void {
    this.game.scale.setZoom(zoom);
  }
  destroy(): void {
    this.game.destroy(true);
  }
}
