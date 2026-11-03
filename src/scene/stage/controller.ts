// The scene stage in Phaser (M7 ก1; code-plan §8.3, 21-pixel-art.md §4): a game of 320 × 180 art pixels that draws one `Frame` of a scene. This file is the
// only one of the scene player that imports Phaser; the component (../Stage.tsx) loads it on demand so a page that plays no scene never loads Phaser.
//
// The stage holds no time. `set()` hands it the latest frame and it draws that: the painted layers of the place (moved by the camera's pan, each at its own
// speed), the mood colours of the beats over them, the figures of the actors (sprites of their looks, in the pose of the beat), the light and the wash. The
// words are not here: Thai text is DOM over the canvas (../Stage.tsx).
import Phaser from 'phaser';
import { addBeast, playBeast } from '../../art/beast/phaser';
import { BEAST_POSES } from '../../art/beast/kit';
import type { Pose } from '../../art/anim';
import { addLook, playPose } from '../../art/phaser';
import { paintScenery, type Scenery, type ScenerySpec } from '../../art/scenery';
import { BEAST_POSE, PERSON_POSE } from '../../ui/figure';
import { figureKey, type Figure, type FigureOf } from '../figures';
import { cameraOf, clampPan, layerX, slotsOf, type Cam } from '../layout';
import { mixColor, type ActorView, type Frame } from '../timeline';
import { ART, CAST, DEPTH, LIGHT, LIGHT_BANDS, MOOD, POSE, SCENERY_KEEP, SHADOW, SIL } from '../tuning';

const hex = (s: string): number => parseInt(s.replace('#', '').slice(0, 6), 16) || 0;

/** What the component hands the stage on every frame. */
export interface StageInput {
  frame: Frame;
  /** The colour of the scene's frame: the rim of a silhouette. */
  frameColor: string;
  scenery: ScenerySpec;
  figureOf: FigureOf;
}

// ---------- the painted backgrounds: painted once per place and kept, whatever number of stages ask ----------

const painted = new Map<string, Scenery>();
const specKey = (s: ScenerySpec): string => `${s.continent}|${s.country ?? ''}|${s.setting}|${s.season ?? ''}|${s.seed ?? ''}`;

/** The layers of a place, from the cache (the oldest unused place is let go past `SCENERY_KEEP`). */
function sceneryFor(spec: ScenerySpec): Scenery {
  const key = specKey(spec);
  const have = painted.get(key);
  if (have) {
    painted.delete(key);
    painted.set(key, have);
    return have;
  }
  const made = paintScenery(spec);
  painted.set(key, made);
  if (painted.size > SCENERY_KEEP) painted.delete(painted.keys().next().value!);
  return made;
}

interface Shown {
  key: string;
  scenery: Scenery;
  images: { image: Phaser.GameObjects.Image; w: number; speed: number }[];
}

interface Figured {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  pose: string;
}

class StageScene extends Phaser.Scene {
  want: StageInput | null = null;
  dirty = false;
  private ready = false;
  private serial = 0;
  private shown: Shown | null = null;
  private figured = new Map<string, Figured>();
  private before = new Map<string, number>();
  private mood!: Phaser.GameObjects.Graphics;
  private shadows!: Phaser.GameObjects.Graphics;
  private light!: Phaser.GameObjects.Graphics;
  private wash!: Phaser.GameObjects.Graphics;
  private drawn = { mood: '', light: '', wash: '' };

  constructor() {
    super('scene-stage');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.mood = this.add.graphics().setDepth(DEPTH.mood);
    this.shadows = this.add.graphics().setDepth(DEPTH.shadow);
    this.light = this.add.graphics().setDepth(DEPTH.light);
    this.wash = this.add.graphics().setDepth(DEPTH.wash);
    this.ready = true;
  }

  update(): void {
    if (!this.ready || !this.want || !this.dirty) return;
    this.dirty = false;
    this.apply(this.want);
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
    this.paintMood(f);
    this.figures(w, view);
    this.paintLight(f, sc.scenery.light);
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

  /** The colours of the sky and the ground that the beats set (`bg`, `tone`) laid thinly over the painted place: the mood of the story over the look of the land. */
  private paintMood(f: Frame): void {
    const k = `${f.sky}|${f.ground}`;
    if (this.drawn.mood === k) return;
    this.drawn.mood = k;
    const horizon = ART.groundY - 6;
    this.mood.clear();
    this.mood.fillStyle(hex(f.sky), MOOD.sky).fillRect(0, 0, ART.w, horizon);
    this.mood.fillStyle(hex(f.ground), MOOD.ground).fillRect(0, horizon, ART.w, ART.h - horizon);
  }

  /** The light of the beat in bands (an even gradient would blur the pixels): from the front below, from behind above, from the middle in rings, or over all. */
  private paintLight(f: Frame, placeLight: string): void {
    const L = LIGHT[f.light.mode];
    const col = f.light.color ?? (f.light.mode === 'diffuse' ? placeLight : L.color);
    const k = `${f.light.mode}|${col}`;
    if (this.drawn.light === k) return;
    this.drawn.light = k;
    const g = this.light.clear();
    g.fillStyle(hex(col), 1);
    const n = LIGHT_BANDS;
    if (L.from === 'all') {
      g.fillStyle(hex(col), L.alpha).fillRect(0, 0, ART.w, ART.h);
      return;
    }
    for (let b = 0; b < n; b++) {
      const a = L.alpha * (1 - (b + 0.5) / n);
      g.fillStyle(hex(col), a);
      if (L.from === 'centre') {
        const k2 = 1 - b / n;
        g.fillEllipse(ART.w / 2, ART.h * 0.55, ART.w * 0.9 * k2, ART.h * 1.1 * k2);
      } else {
        const span = ART.h * 0.7;
        const y0 = L.from === 'front' ? ART.h - ((b + 1) * span) / n : (b * span) / n;
        g.fillRect(0, Math.round(y0), ART.w, Math.ceil(span / n));
      }
    }
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
        this.figured.delete(s.key);
        have = undefined;
      }
      const x = s.x - cam.pan;
      if (!have) {
        have = { sprite: this.build(fig, s.i, x, s.y, a, w), key, pose: '' };
        this.figured.set(s.key, have);
        // a group does not step in time
        if (a.count > 1) have.sprite.anims?.setProgress((s.i * 0.37) % 1);
      }
      this.setPose(have, fig, a, w);
      const sprite = have.sprite;
      sprite.setFlipX(s.flip);
      sprite.setDepth(DEPTH.figure + s.y);
      const drop = fig.kind === 'silhouette' ? POSE[a.pose].drop * SIL.h * 0.85 : 0;
      sprite.setPosition(x, s.y + drop);
      sprite.setTint(this.cast(a, w, fig));
      this.shadows.fillStyle(0x000000, SHADOW.alpha).fillEllipse(x, s.y, SHADOW.w * (fig.kind === 'beast' ? 2.5 : 1), SHADOW.h);
    }
    for (const [k, v] of this.figured)
      if (!live.has(k)) {
        v.sprite.destroy();
        this.figured.delete(k);
      }
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
    if (fig.kind === 'person') {
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
  constructor(parent: HTMLElement, zoom: number) {
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
