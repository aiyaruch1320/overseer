// The town and in-town levels in Phaser (21-pixel-art.md §4): the ground is a tile from the art provider (townGround.ts); the houses, trees, centre, gate
// towers and lamps of the plan are sprites painted with the pixel painter of the people (src/art/mapart); the people are the sprites of their looks
// (src/art/phaser.ts) walking on the grid of the ground. One art pixel is TOWN_PX⁻¹ MU, so a sprite is scaled by WU / TOWN_PX and the camera zoom
// 6.25 to 50 is the art zoom 1× to 8×. Sprites are built a few at a time (a town of 300 sprites is not painted in one frame), people last.
import type Phaser from 'phaser';
import { POSE_OF, FRAME, frameIndex } from '../art/anim';
import type { PersonLook } from '../art/look';
import { lookTexture } from '../art/phaser';
import { centreFrame } from '../art/mapart/centre';
import { mixHex, hash01 } from '../art/mapart/color';
import { houseFrame, chimneyOf, FOOT, type HouseSpec } from '../art/mapart/houses';
import { AIR_FRAMES, AIR_MS, AIR_SIDE, GULL, SMOKE, airKind, airScroll, airSheet, gullSheet, smokeSheet } from '../art/mapart/ambient';
import { treeFrame, type TreeSpec } from '../art/mapart/trees';
import { Paint, type Frame } from '../art/paint';
import type { CityLook, CityPlan, PlanBuilding } from './city';
import { cityRect } from './tiles';
import type { MapCity, Rect } from './layout';
import { CITY_H, CITY_W, FATE_BY_ID, TOWN_PX, WU } from './tuning';
import type { WalkGrid } from './townGround';

export interface TownInfo {
  plan: CityPlan;
  look: CityLook;
  ground: { walk: WalkGrid; w: number; h: number };
  country: string;
}

export interface TownLayerOpts {
  town: (cityId: string) => TownInfo | null;
  /** The looks of the people of a country (a handful; the crowd repeats them). */
  crowd: (country: string) => PersonLook[];
  /** The number of people in a town of N houses is `N * crowdScale` (up to 1500 for the speed test). */
  crowdScale?: number;
  depth: number;
}

const K = WU / TOWN_PX; // world units per art pixel
const KEEP = 3; // towns kept built, hidden, after they leave the view

interface Person {
  img: Phaser.GameObjects.Image;
  look: number;
  x: number; y: number; // art px in the town
  tx: number; ty: number;
  rest: number;
  speed: number;
  t0: number;
  moving: boolean;
  frame: number;
}

interface Town {
  id: string;
  info: TownInfo;
  ox: number; oy: number; // world units of the top-left of the ground
  tasks: (() => void)[];
  sprites: (Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite)[];
  people: Person[];
  looks: string[]; // texture keys of the crowd
  looksWant: PersonLook[];
  peopleWant: number;
  visible: boolean;
  used: number;
  /** Smoke of the chimneys: a sprite and the frame it starts on. */
  smoke: { img: Phaser.GameObjects.Image; off: number }[];
  gulls: { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; ph: number }[];
}

// colours rounded to steps, so that a hundred houses do not make a hundred textures
const q = (hex: string, step = 16) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v / step) * step));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

export class TownLayer {
  private towns = new Map<string, Town>();
  private frameNo = 0;
  private rng = 1;
  private view: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private show = false;
  /** The one loop of air over the view: fog, embers or clouds of the nearest town, faded in and out (no edge: it is the whole screen, like the weather of the country). */
  private sky: { ts: Phaser.GameObjects.TileSprite; key: string; vx: number; vy: number; x: number; y: number } | null = null;

  constructor(private scene: Phaser.Scene, private o: TownLayerOpts) {}

  private rnd(): number {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  /** Builds the towns in the view (a rect of the sheet in MU), hides the others. `show` is false below the town level. */
  sync(view: Rect, cities: MapCity[], show: boolean): void {
    this.frameNo++;
    this.view = view;
    this.show = show;
    const inView = new Set<string>();
    if (show)
      for (const c of cities) {
        const r = cityRect(c);
        if (r.x < view.x + view.w && r.x + r.w > view.x && r.y < view.y + view.h && r.y + r.h > view.y) inView.add(c.id);
      }
    for (const id of inView) {
      let t = this.towns.get(id);
      if (!t) {
        const info = this.o.town(id);
        const c = cities.find((q2) => q2.id === id);
        if (!info || !c) continue;
        t = this.make(id, info, cityRect(c));
        this.towns.set(id, t);
      }
      t.used = this.frameNo;
    }
    for (const t of this.towns.values()) {
      const on = inView.has(t.id);
      if (on !== t.visible) {
        t.visible = on;
        for (const s of t.sprites) s.setVisible(on);
        for (const p of t.people) p.img.setVisible(on);
      }
    }
    if (this.towns.size > KEEP + inView.size) {
      const old = [...this.towns.values()].filter((t) => !t.visible).sort((a, b) => a.used - b.used);
      for (const t of old.slice(0, this.towns.size - KEEP - inView.size)) this.drop(t);
    }
  }

  /** Forgets every town (the look of the world changed: a ruin, a flood). */
  reset(): void {
    for (const t of [...this.towns.values()]) this.drop(t);
  }

  private drop(t: Town): void {
    for (const s of t.sprites) s.destroy();
    for (const p of t.people) p.img.destroy();
    t.smoke = []; t.gulls = [];
    this.towns.delete(t.id);
  }

  destroy(): void {
    this.reset();
    this.sky?.ts.destroy();
    this.sky = null;
  }

  // ---- building ----
  /** A texture painted once; `frames` of `fw` pixels cut from it side by side when it is a loop. */
  private texture(key: string, make: () => Frame | null, frames = 0, fw = 0): string | null {
    if (this.scene.textures.exists(key)) return key;
    const f = make();
    if (!f) return null;
    const c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    c.getContext('2d')!.putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
    const tex = this.scene.textures.addCanvas(key, c);
    if (tex) for (let i = 0; i < frames; i++) tex.add(i, 0, i * fw, 0, fw, f.h);
    return key;
  }

  private place(t: Town, key: string | null, ax: number, ay: number, h: number, flip = false): Phaser.GameObjects.Image | null {
    if (!key) return null;
    const img = this.scene.add.image(t.ox + ax * K, t.oy + ay * K, key).setOrigin(0.5, 1 - FOOT / h).setScale(K).setFlipX(flip);
    img.setDepth(this.o.depth + (t.oy + ay * K) / 10000);
    img.setVisible(t.visible);
    t.sprites.push(img);
    return img;
  }

  private make(id: string, info: TownInfo, rect: Rect): Town {
    const t: Town = { id, info, ox: rect.x * WU, oy: rect.y * WU, tasks: [], sprites: [], people: [], looks: [], looksWant: [], peopleWant: 0, visible: true, used: this.frameNo, smoke: [], gulls: [] };
    const { plan, look } = info;
    const S = TOWN_PX;
    const fate = look.fate ? FATE_BY_ID[look.fate] : undefined;
    const ruin = look.ruin ?? 0;
    const leafs = plan.leaf;

    // the centre and the gates first (they are few), then houses, trees, lamps
    t.tasks.push(() => {
      const r = plan.plaza.r * S;
      const key = `tc:${plan.centre.kind}:${Math.round(r / 4)}:${fate ? 1 : 0}`;
      const k = this.texture(key, () => centreFrame(plan.centre.kind, r, !!fate));
      if (k) this.place(t, k, plan.centre.x * S, plan.centre.y * S + 2, this.scene.textures.get(k).getSourceImage().height);
    });
    if (plan.wall) {
      const wallC = plan.wall.kind === 'iron' ? '#5a5e66' : plan.wall.kind === 'palisade' ? '#8a6a4a' : plan.wall.kind === 'hedge' ? '#4f8a4a' : '#a8a298';
      for (const g of plan.wall.gates) {
        const dx = g[0] - plan.plaza.x, dy = g[1] - plan.plaza.y, d = Math.hypot(dx, dy) || 1;
        for (const sgn of [-1, 1])
          t.tasks.push(() => {
            const spec: HouseSpec = { style: 'keep', roof: wallC, wall: wallC, w: 14, floors: 1, v: 0 };
            const key = `tg:${wallC}`;
            const k = this.texture(key, () => houseFrame(spec));
            if (k) this.place(t, k, (g[0] + (-dy / d) * sgn * 0.62) * S, (g[1] + (dx / d) * sgn * 0.62) * S, this.scene.textures.get(k).getSourceImage().height);
          });
      }
    }
    for (const b of plan.buildings) t.tasks.push(() => this.house(t, b, ruin, fate?.id));
    t.tasks.push(() => this.air(t, plan.ambient));
    plan.trees.forEach((tr, i) =>
      t.tasks.push(() => {
        const h = Math.round(Math.min(34, Math.max(16, tr.r * S * 3.2)) / 2) * 2;
        const leaf = leafs.length ? leafs[i % leafs.length] : undefined;
        const spec: TreeSpec = { kind: tr.kind, h, leaf, fate: fate ? { color: fate.after[0], mix: fate.tint * 0.7 } : undefined, v: (i % 3) / 3 };
        const key = `tt:${tr.kind}:${h}:${leaf ?? ''}:${fate?.id ?? ''}:${i % 3}`;
        const k = this.texture(key, () => treeFrame(spec));
        if (k) this.place(t, k, tr.x * S, tr.y * S, this.scene.textures.get(k).getSourceImage().height, i % 2 === 0);
      }),
    );
    for (const l of plan.lamps)
      t.tasks.push(() => {
        const k = this.texture('tl', () => lamp());
        if (k) this.place(t, k, l[0] * S + 8, l[1] * S, 16);
      });

    t.looksWant = this.o.crowd(info.country);
    const n = Math.round((plan.buildings.length * 1.3 + 12) * (this.o.crowdScale ?? 1));
    t.peopleWant = ruin > 0.5 ? Math.round(n * (1 - ruin) * 0.4) : Math.min(1600, n);
    return t;
  }

  private house(t: Town, b: PlanBuilding, ruin: number, fate?: string): void {
    const S = TOWN_PX;
    const along = Math.abs(Math.cos(b.rot)) >= Math.abs(Math.sin(b.rot));
    const w = Math.round(((along ? b.w : b.h) * S * 0.95) / 2) * 2;
    const broken = ruin > 0 && ((t.sprites.length * 2654435761) >>> 0) / 4294967296 < ruin;
    const spec: HouseSpec = {
      style: b.style, roof: q(b.roof), wall: q(b.wall), w: b.special ? b.w * S : w, floors: b.floors, special: b.special, broken,
      continent: t.info.plan.continent, v: Math.floor(hash01(`${b.x.toFixed(1)}${b.y.toFixed(1)}`) * 3) / 3,
    };
    const key = `th:${spec.style}:${spec.roof}:${spec.wall}:${Math.round(spec.w)}:${spec.floors}:${spec.special ?? ''}:${broken ? 1 : 0}:${spec.v}:${fate ?? ''}`;
    const k = this.texture(key, () => houseFrame(spec));
    if (!k) return;
    const flip = Math.cos(b.rot) < 0;
    const src = this.scene.textures.get(k).getSourceImage();
    this.place(t, k, b.x * S, (b.y + b.h * 0.4) * S, src.height, flip);
    // the smoke of a chimney: a loop of puffs from its top (a town of `ambient=smoke`: most of its chimneys smoke)
    const ch = t.info.plan.ambient === 'smoke' && !broken ? chimneyOf(spec) : null;
    if (ch && hash01(`${b.x.toFixed(2)}${b.y.toFixed(2)}s`) < 0.75) {
      const sk = this.texture('smk', () => smokeSheet(), SMOKE.frames, SMOKE.w);
      if (!sk) return;
      const ax = b.x * S + (ch[0] - src.width / 2 + 0.5) * (flip ? -1 : 1), ay = (b.y + b.h * 0.4) * S + (ch[1] - (src.height - FOOT));
      const img = this.scene.add.image(t.ox + ax * K, t.oy + ay * K, sk, 0).setOrigin(0.5, 1).setScale(K);
      img.setDepth(this.o.depth + 0.9).setVisible(t.visible);
      t.sprites.push(img);
      t.smoke.push({ img, off: Math.floor(hash01(`${ax}${ay}`) * SMOKE.frames) });
    }
  }

  /** The gulls of a seaside town (the air of the others is the loop of `updateAir`). */
  private air(t: Town, ambient: string): void {
    if (ambient === 'gulls') {
      const gk = this.texture('gull', () => gullSheet(), GULL.frames, GULL.w);
      if (!gk) return;
      const g = t.info.ground;
      for (let i = 0; i < 5; i++) {
        const x = this.rnd() * g.w, y = 20 + this.rnd() * (g.h - 40);
        const img = this.scene.add.image(t.ox + x * K, t.oy + y * K, gk, 0).setScale(K).setDepth(this.o.depth + 0.95).setVisible(t.visible);
        t.sprites.push(img);
        t.gulls.push({ img, x, y, vx: (this.rnd() < 0.5 ? -1 : 1) * (9 + this.rnd() * 8), ph: this.rnd() * 6 });
      }
      return;
    }
    }

  // ---- frame ----
  /** Builds some of what is waiting, then moves the people. `ms` is the time of the scene. */
  update(ms: number, dt: number): void {
    const t0 = performance.now();
    for (const t of this.towns.values()) {
      if (!t.visible) continue;
      while (t.tasks.length && performance.now() - t0 < 5) t.tasks.shift()!();
      if (!t.tasks.length) this.spawn(t, t0);
      this.walk(t, ms, dt);
      this.animateAir(t, ms, dt);
    }
    this.updateAir(ms, dt);
  }

  /** The air over the view: the ambient of the visible town nearest the centre of the screen; one baked loop played as a tile sprite that covers the screen. */
  private updateAir(ms: number, dt: number): void {
    const dtc = Math.min(0.1, dt), v = this.view;
    let best: Town | null = null, bd = Infinity;
    if (this.show)
      for (const t of this.towns.values()) {
        if (!t.visible || !airKind(t.info.plan.ambient)) continue;
        const d = Math.hypot(t.ox / WU + CITY_W / 2 - (v.x + v.w / 2), t.oy / WU + CITY_H / 2 - (v.y + v.h / 2));
        if (d < bd) { bd = d; best = t; }
      }
    const want = best ? `air:${best.info.plan.ambient}:${best.info.plan.ambient === 'leaves' ? best.info.plan.leaf.join('') : ''}` : '';
    if (!this.sky) {
      if (!best) return;
      const k = this.texture(want, () => airSheet(best!.info.plan.ambient, best!.info.plan.leaf), AIR_FRAMES, AIR_SIDE);
      if (!k) return;
      const ts = this.scene.add.tileSprite(0, 0, 16, 16, k, 0).setOrigin(0, 0).setScale(K).setDepth(this.o.depth + 0.9).setAlpha(0);
      this.sky = { ts, key: want, vx: 0, vy: 0, x: 0, y: 0 };
    }
    const a = this.sky;
    if (a.key !== want) {
      // another air (or none): the old one fades out, then the new one comes in
      a.ts.setAlpha(Math.max(0, a.ts.alpha - dtc * 2));
      if (a.ts.alpha > 0) { this.placeAir(ms); return; }
      if (best) {
        const amb = best.info.plan.ambient;
        const k = this.texture(want, () => airSheet(amb, best!.info.plan.leaf), AIR_FRAMES, AIR_SIDE);
        if (k) {
          a.ts.setTexture(k, 0).setBlendMode(airKind(amb)!.blend === 'add' ? 1 : 0);
          const sc = airScroll(amb);
          a.vx = sc[0]; a.vy = sc[1]; a.key = want;
        }
      } else a.key = '';
      return;
    }
    if (!want) return;
    a.x += a.vx * dtc; a.y += a.vy * dtc;
    a.ts.setAlpha(Math.min(1, a.ts.alpha + dtc * 2));
    this.placeAir(ms);
  }

  private placeAir(ms: number): void {
    const a = this.sky!, v = this.view;
    a.ts.setFrame(Math.floor(ms / AIR_MS) % AIR_FRAMES);
    a.ts.setPosition(v.x * WU, v.y * WU).setSize(Math.ceil(v.w * TOWN_PX) + 1, Math.ceil(v.h * TOWN_PX) + 1);
    a.ts.setTilePosition(Math.round(v.x * TOWN_PX + a.x), Math.round(v.y * TOWN_PX + a.y)); // anchored to the ground, drifting, whole art pixels
  }

  /** The baked loops play: the frame of the air and of the smoke from the clock, the sheet of the air scrolls, the gulls fly. */
  private animateAir(t: Town, ms: number, dt: number): void {
    const dtc = Math.min(0.1, dt);
    if (t.smoke.length) {
      const f = Math.floor(ms / SMOKE.ms);
      for (const s of t.smoke) s.img.setFrame((f + s.off) % SMOKE.frames);
    }
    if (t.gulls.length) {
      const g = t.info.ground;
      for (const b of t.gulls) {
        b.x += b.vx * dtc;
        if (b.x > g.w + 10) b.x = -10; else if (b.x < -10) b.x = g.w + 10;
        b.img.setPosition(t.ox + Math.round(b.x) * K, t.oy + Math.round(b.y + Math.sin(ms / 900 + b.ph) * 3) * K).setFlipX(b.vx < 0);
        b.img.setFrame(Math.floor(ms / 260 + b.ph) % GULL.frames);
      }
    }
  }

  /** The people of a town appear a few at a time once the sprites stand; each look is painted when first needed (one a frame). */
  private spawn(t: Town, t0: number): void {
    if (t.looks.length < t.looksWant.length) {
      if (performance.now() - t0 < 5) t.looks.push(lookTexture(this.scene, t.looksWant[t.looks.length]));
      return;
    }
    if (!t.looks.length) return;
    const walk = t.info.ground.walk;
    let guard = 0;
    while (t.people.length < t.peopleWant && guard++ < 60 && performance.now() - t0 < 6) {
      let spot = this.randomSpot(walk, true);
      if (!spot) { t.peopleWant = t.people.length; return; }
      // not on top of someone: a few tries for a place with air round it (a crowded plaza keeps its crowd, a dense town stays readable)
      for (let k = 0; k < 8 && this.crowded(t, spot[0], spot[1], 9); k++) spot = this.randomSpot(walk, true) ?? spot;
      const look = Math.floor(this.rnd() * t.looks.length);
      const img = this.scene.add.image(t.ox + spot[0] * K, t.oy + spot[1] * K, t.looks[look], frameIndex('idle', 0))
        .setOrigin(0.5 - 3 / FRAME.w, FRAME.foot / FRAME.h).setScale(K);
      t.people.push({ img, look, x: spot[0], y: spot[1], tx: spot[0], ty: spot[1], rest: this.rnd() * 3, speed: 15 + this.rnd() * 9, t0: this.rnd() * 1000, moving: false, frame: 0 });
    }
  }

  /** True when a person stands within `r` art pixels of the point (only the first 400 are asked: the crowd of a speed test does not slow the walk). */
  private crowded(t: Town, x: number, y: number, r: number): boolean {
    const n = Math.min(t.people.length, 400), r2 = r * r;
    for (let i = 0; i < n; i++) {
      const p = t.people[(i * 7919) % t.people.length];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < r2) return true;
    }
    return false;
  }

  /** A random place a person can stand; on a street or the plaza when `road` and one is found. */
  private randomSpot(g: WalkGrid, road: boolean): [number, number] | null {
    for (let i = 0; i < 40; i++) {
      const c = Math.floor(this.rnd() * g.cols), r = Math.floor(this.rnd() * g.rows), k = r * g.cols + c;
      if (!g.ok[k] || (road && i < 30 && !g.road[k])) continue;
      return [(c + this.rnd()) * g.cell, (r + this.rnd()) * g.cell];
    }
    return null;
  }

  private clear(g: WalkGrid, x0: number, y0: number, x1: number, y1: number): boolean {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (g.cell * 0.75));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      const c = Math.floor(x / g.cell), r = Math.floor(y / g.cell);
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || !g.ok[r * g.cols + c]) return false;
    }
    return true;
  }

  private walk(t: Town, ms: number, dt: number): void {
    const g = t.info.ground.walk;
    const walkP = POSE_OF.walk, idleP = POSE_OF.idle;
    const dtc = Math.min(0.1, dt);
    const base = this.o.depth;
    for (const p of t.people) {
      if (p.moving) {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        const step = p.speed * dtc;
        if (d <= step) { p.x = p.tx; p.y = p.ty; p.moving = false; p.rest = 0.5 + this.rnd() * 4; }
        else { p.x += (dx / d) * step; p.y += (dy / d) * step; if (Math.abs(dx) > 0.5) p.img.setFlipX(dx < 0); }
        p.img.setPosition(t.ox + p.x * K, t.oy + p.y * K).setDepth(base + (t.oy + p.y * K) / 10000);
      } else {
        p.rest -= dtc;
        if (p.rest < 0) {
          // a new place along the way: near, preferably on a street
          const ang = this.rnd() * Math.PI * 2, len = 25 + this.rnd() * 70;
          const nx = p.x + Math.cos(ang) * len, ny = p.y + Math.sin(ang) * len;
          if (this.clear(g, p.x, p.y, nx, ny) && !this.crowded(t, nx, ny, 7)) { p.tx = nx; p.ty = ny; p.moving = true; } else p.rest = 0.2 + this.rnd();
        }
      }
      const pose = p.moving ? walkP : idleP;
      const f = frameIndex(p.moving ? 'walk' : 'idle', Math.floor((ms + p.t0) / pose.ms) % pose.n);
      if (f !== p.frame) { p.frame = f; p.img.setFrame(f); }
    }
  }
}

/** A street lamp: a post with a warm light (7 × 16). */
function lamp(): Frame {
  const p = new Paint(7, 16);
  const post = p.mat('#4a4a52');
  p.rect(3, 4, 1, 9, post);
  p.rect(2, 12, 3, 1, post);
  p.rect(2, 2, 3, 3, p.mat(mixHex('#ffd88a', '#ffffff', 0.2), { flat: true }));
  p.glow(3, 3, '#fff0b0', 0.9);
  return p.finish({ cx: 3.5, cy: 14, rx: 2.5, ry: 1.2 });
}
