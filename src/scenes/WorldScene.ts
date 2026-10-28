import Phaser from 'phaser';
import { generateWorld, CONTINENTS, SCALE, type WorldMap } from '../sim/worldgen';
import { makePainter, type PaintWorld } from '../render/mappaint';
import type { Game } from '../sim/game';
import { iconTex, raceTex } from './sprites';
import { cradleTex } from './people';
import { actorPos } from '../sim/society';
import { REGION_EVENTS } from '../data/people';
import { DISASTERS } from '../data/disasters';
import { FESTIVALS } from '../data/npclife';

export { drawPortrait } from './sprites';
// World coordinates: 8 units per tile. The whole map is drawn once at 2 px/tile (overview) and, when zoomed in,
// detail chunks are painted at 8 px/tile around the camera (one per frame, kept in a small cache).
export const TILE = 8;
const BASE_PX = 2;
const CHUNK = 32; // tiles per detail chunk side (256 px: a few ms to paint, no hitch)
const MAX_CHUNKS = 160;
const FLAG_ICON: Record<string, string> = { war: 'war', plague: 'plague', famine: 'famine', golden: 'golden', demon_raid: 'demon', ...Object.fromEntries(REGION_EVENTS.map((e) => [e.flag, e.icon])), ...Object.fromEntries(DISASTERS.map((d) => [d.flag, d.icon])), ...Object.fromEntries(FESTIVALS.map((f) => [`fest_${f.id}`, f.icon])) };
const ACTOR_ICON: Record<string, string> = { hero: 'herosword', demonlord: 'demon', caravan: 'gold' };
// zoom levels: world → continent → country → town → (enter the town)
export const Z = { detail: 0.42, country: 0.33, capital: 0.42, town: 0.75, townName: 1.15, max: 3.6 };


export class WorldScene extends Phaser.Scene {
  world!: WorldMap;
  game_!: Game;
  charSprite!: Phaser.GameObjects.Image;
  ring!: Phaser.GameObjects.Ellipse;
  charBox!: Phaser.GameObjects.Container;
  flagIcons: Phaser.GameObjects.Image[] = [];
  actorMarks = new Map<string, { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  contLabels: Phaser.GameObjects.Text[] = [];
  countryLabels: Phaser.GameObjects.Text[] = [];
  townMarks: { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; capital: boolean; id: number }[] = [];
  highlight!: Phaser.GameObjects.Image;
  chunks = new Map<string, { img: Phaser.GameObjects.Image; used: number }>();
  onCountryClick: (id: number) => void = () => {};
  onTownClick: (id: number) => void = () => {};
  onEnterTown: (id: number) => void = () => {};
  onZoom: (level: string) => void = () => {};
  onReady: () => void = () => {};
  follow = true;
  minZoom = 0.15;
  targetZoom = 0.15;
  private anchor = { x: 0, y: 0 };
  private lastTown = -1;
  private charRace = '';
  private clickedTown = false;
  private lastLodZoom = 0;

  constructor() { super('world'); }

  setGame(g: Game) {
    this.game_ = g;
    if (this.charSprite) { this.lastTown = -1; this.refresh(true); }
  }

  get W() { return this.world.w * TILE; }
  get H() { return this.world.h * TILE; }

  create() {
    this.world = generateWorld();
    this.startPainter();
    this.baseImg = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(0).setVisible(false);
    this.paintBase();
    this.highlight = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(2).setVisible(false);

    const font = 'Itim, Sarabun, sans-serif';
    for (const ct of CONTINENTS) {
      this.contLabels.push(this.add.text(ct.cx * SCALE * TILE, (ct.cy - ct.r * 0.55) * SCALE * TILE, ct.name, {
        fontFamily: font, fontSize: '48px', color: '#fff8e0', stroke: '#2a1a0a', strokeThickness: 9,
      }).setOrigin(0.5).setDepth(9));
    }
    for (const co of this.world.countries) {
      this.countryLabels.push(this.add.text(co.cx * TILE, co.cy * TILE, co.name.replace(co.gov, ''), {
        fontFamily: font, fontSize: '24px', color: '#fffbe8', stroke: '#1a120a', strokeThickness: 6,
      }).setOrigin(0.5, 0).setDepth(7));
    }
    for (const t of this.world.towns) {
      const img = this.add.image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, iconTex(this, t.capital ? 'castle' : 'home', 2)).setDepth(6).setInteractive({ useHandCursor: true });
      const label = this.add.text(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, t.name, {
        fontFamily: font, fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5, 0).setDepth(6);
      img.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) { this.clickedTown = true; this.onTownClick(t.id); } });
      this.townMarks.push({ img, label, capital: t.capital, id: t.id });
    }

    this.ring = this.add.ellipse(0, 0, 40, 14, 0xffe680, 0.6);
    this.tweens.add({ targets: this.ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 1400, repeat: -1 });
    this.charSprite = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    this.tweens.add({ targets: this.charSprite, y: -4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.charBox = this.add.container(0, 0, [this.ring, this.charSprite]).setDepth(8);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.W, this.H);
    cam.setBackgroundColor('#13243a');
    this.minZoom = Math.max(this.scale.width / this.W, this.scale.height / this.H);
    cam.setZoom(this.minZoom);
    this.targetZoom = this.minZoom;
    cam.centerOn(this.W / 2, this.H / 2);

    // smooth zoom toward the cursor: the wheel sets a target, update() eases toward it
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy < 0 && this.targetZoom >= Z.max - 0.01) {
        const wp = cam.getWorldPoint(p.x, p.y);
        const t = this.nearestTown(wp.x, wp.y);
        if (t !== null) this.onEnterTown(t);
        return;
      }
      this.anchor = { x: p.x, y: p.y };
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom * (dy > 0 ? 0.82 : 1.22), this.minZoom, Z.max);
    });
    let dragging = false, sx = 0, sy = 0, moved = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; sx = p.x; sy = p.y; moved = 0; this.clickedTown = false; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      cam.scrollX -= (p.x - sx) / cam.zoom; cam.scrollY -= (p.y - sy) / cam.zoom;
      moved += Math.abs(p.x - sx) + Math.abs(p.y - sy);
      sx = p.x; sy = p.y;
      if (moved > 6) this.follow = false;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      dragging = false;
      if (moved < 6 && !this.clickedTown) {
        const id = this.countryAt(p.x, p.y);
        if (id >= 0) { this.showHighlight(id); this.onCountryClick(id); }
      }
    });
    this.scale.on('resize', () => {
      this.minZoom = Math.max(this.scale.width / this.W, this.scale.height / this.H);
      if (this.targetZoom < this.minZoom) this.targetZoom = this.minZoom;
      if (cam.zoom < this.minZoom) cam.setZoom(this.minZoom);
      this.updateLod();
    });
    this.updateLod();
    this.onReady();
  }

  countryAt(sx: number, sy: number): number {
    const wp = this.cameras.main.getWorldPoint(sx, sy);
    const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.world.w || ty >= this.world.h) return -1;
    return this.world.country[ty * this.world.w + tx];
  }

  nearestTown(x: number, y: number): number | null {
    let best: number | null = null, bd = 30 * TILE;
    for (const t of this.world.towns) {
      const d = Math.hypot(t.x * TILE - x, t.y * TILE - y);
      if (d < bd) { bd = d; best = t.id; }
    }
    return best;
  }

  // ----- painting (in a Web Worker; synchronous fallback if workers are unavailable) -----
  private worker: Worker | null = null;
  private painter: ReturnType<typeof makePainter> | null = null;
  private pending = new Set<string>();
  private baseImg!: Phaser.GameObjects.Image;

  private startPainter() {
    const world: PaintWorld = { w: this.world.w, h: this.world.h, country: this.world.country, height: this.world.height, climates: this.world.countries.map((c) => c.climate), scale: SCALE };
    try {
      this.worker = new Worker(new URL('../render/map.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.onPainted(e.data.key, e.data.w, e.data.h, e.data.data);
      this.worker.onerror = () => { this.worker = null; this.painter = makePainter(world); this.pending.clear(); };
      this.worker.postMessage({ type: 'init', world });
    } catch { this.painter = makePainter(world); }
  }

  private request(key: string, x0: number, y0: number, w: number, h: number, ppt: number) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    if (this.worker) this.worker.postMessage({ type: 'paint', key, x0, y0, w, h, ppt });
    else if (this.painter) this.onPainted(key, w, h, this.painter(x0, y0, w, h, ppt));
  }

  private onPainted(key: string, w: number, h: number, data: Uint8ClampedArray) {
    this.pending.delete(key);
    if (!this.sys?.isActive() && !this.sys?.isSleeping()) return;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, cv);
    if (key === 'mapbase') { this.baseImg.setTexture('mapbase').setScale(TILE / BASE_PX).setVisible(true); return; }
    const [cx, cy] = key.slice(6).split(',').map(Number);
    const img = this.add.image(cx * CHUNK * TILE, cy * CHUNK * TILE, key).setOrigin(0).setDepth(1).setVisible(this.cameras.main.zoom >= Z.detail);
    this.chunks.set(key.slice(6), { img, used: this.time.now });
  }

  paintBase() {
    this.request('mapbase', 0, 0, this.world.w * BASE_PX, this.world.h * BASE_PX, BASE_PX);
  }

  // ask for the detail chunks the camera can see (a few in flight at once); drop the least recently seen
  private updateChunks() {
    const cam = this.cameras.main;
    const visible = cam.zoom >= Z.detail;
    this.chunks.forEach((c) => c.img.setVisible(visible));
    if (!visible) return;
    const v = cam.worldView;
    const span = CHUNK * TILE;
    const cx0 = Math.max(0, Math.floor(v.x / span)), cy0 = Math.max(0, Math.floor(v.y / span));
    const cx1 = Math.min(Math.ceil(this.world.w / CHUNK) - 1, Math.floor(v.right / span)), cy1 = Math.min(Math.ceil(this.world.h / CHUNK) - 1, Math.floor(v.bottom / span));
    const now = this.time.now;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = `${cx},${cy}`;
      const hit = this.chunks.get(key);
      if (hit) { hit.used = now; continue; }
      if (this.pending.size >= 4) continue;
      const wTiles = Math.min(CHUNK, this.world.w - cx * CHUNK), hTiles = Math.min(CHUNK, this.world.h - cy * CHUNK);
      this.request(`chunk_${key}`, cx * CHUNK * TILE, cy * CHUNK * TILE, wTiles * TILE, hTiles * TILE, TILE);
    }
    if (this.chunks.size > MAX_CHUNKS) {
      const old = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.chunks.size - MAX_CHUNKS);
      for (const [key, c] of old) { c.img.destroy(); this.textures.remove(`chunk_${key}`); this.chunks.delete(key); }
    }
  }

  showHighlight(id: number) {
    const { w, h, country } = this.world;
    const cv = document.createElement('canvas');
    cv.width = w * BASE_PX; cv.height = h * BASE_PX;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,240,150,0.30)';
    for (let i = 0; i < w * h; i++) if (country[i] === id) ctx.fillRect((i % w) * BASE_PX, Math.floor(i / w) * BASE_PX, BASE_PX, BASE_PX);
    if (this.textures.exists('hl')) this.textures.remove('hl');
    this.textures.addCanvas('hl', cv);
    this.highlight.setTexture('hl').setScale(TILE / BASE_PX).setVisible(true);
  }

  level(): string {
    const z = this.cameras.main.zoom;
    if (z >= Z.town) return 'ประเทศ · เมือง';
    if (z >= Z.country) return 'ทวีป · ประเทศ';
    return 'โลก';
  }

  // what is visible at the current zoom; sizes stay constant on screen (scale = wanted px / (texture px × zoom))
  updateLod() {
    const z = this.cameras.main.zoom;
    this.lastLodZoom = z;
    this.contLabels.forEach((l) => l.setVisible(z < Z.country * 1.6).setAlpha(z < Z.country ? 0.95 : 0.45).setScale(30 / (48 * z)));
    const townNames = z >= Z.townName;
    this.countryLabels.forEach((l, i) => {
      const co = this.world.countries[i];
      l.setVisible(z >= Z.country && z < Z.max * 0.98).setScale(16 / (24 * z)).setAlpha(townNames ? 0.75 : 1);
      l.setPosition(co.cx * TILE + TILE / 2, co.cy * TILE + (townNames ? -36 / z : 12 / z)).setOrigin(0.5, townNames ? 1 : 0);
    });
    for (const m of this.townMarks) {
      const show = m.capital ? z >= Z.capital : z >= Z.town;
      m.img.setVisible(show).setScale((m.capital ? 22 : 16) / (24 * z));
      m.label.setVisible(show && townNames).setScale(13 / (18 * z)).setY(m.img.y + 12 / z);
    }
    this.flagIcons.forEach((t) => t.setScale(18 / (24 * z)));
    this.actorMarks.forEach((m, id) => { m.img.setScale((id.startsWith('caravan') ? 16 : 24) / (24 * z)); m.label.setScale(12 / (16 * z)).setVisible(z >= Z.country).setY(m.img.y + 14 / z); });
    if (this.charBox) this.charBox.setScale(30 / (32 * z));
    this.onZoom(this.level());
  }

  refresh(force = false) {
    const g = this.game_;
    if (!g || !this.charSprite) return;
    const c = g.c;
    // a baby shows as a cradle that rocks in place; everyone else as their people
    const form = g.stage() === 'infant' ? 'cradle' : c.race;
    if (this.charRace !== form) { this.charSprite.setTexture(form === 'cradle' ? cradleTex(this, 0xf6d2b0, 2) : raceTex(this, c.race, 2)); this.charRace = form; }
    const town = this.world.towns[c.townId] || this.world.towns[g.s.countries[c.countryId].towns[0]];
    const tx = town.x * TILE + TILE / 2, ty = town.y * TILE + TILE / 2;
    if (this.lastTown !== c.townId) {
      if (this.lastTown === -1 || force) this.charBox.setPosition(tx, ty);
      else this.tweens.add({ targets: this.charBox, x: tx, y: ty, duration: 1200, ease: 'Sine.inOut' });
      this.lastTown = c.townId;
      if (this.follow) this.cameras.main.pan(tx, ty, 900, 'Sine.easeInOut');
    }
    this.charSprite.setAlpha(c.alive ? 1 : 0.4);
    let k = 0;
    for (const co of g.s.countries) {
      co.flags.forEach((f, fi) => {
        const icon = FLAG_ICON[f];
        if (!icon) return;
        let t = this.flagIcons[k];
        if (!t) { t = this.add.image(0, 0, iconTex(this, icon, 2)).setDepth(7); this.flagIcons.push(t); }
        t.setTexture(iconTex(this, icon, 2)).setPosition(co.cx * TILE + fi * 26 - 10, co.cy * TILE - 18).setVisible(true);
        k++;
      });
    }
    for (; k < this.flagIcons.length; k++) this.flagIcons[k].setVisible(false);
    for (const a of g.s.actors) {
      let m = this.actorMarks.get(a.id);
      if (!m) {
        const img = this.add.image(0, 0, iconTex(this, ACTOR_ICON[a.kind], 2)).setDepth(8.5);
        const label = this.add.text(0, 0, '', { fontFamily: 'Sarabun, sans-serif', fontSize: '16px', color: a.kind === 'demonlord' ? '#e0a0ff' : a.kind === 'hero' ? '#ffe680' : '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(8.5);
        m = { img, label };
        this.actorMarks.set(a.id, m);
        if (a.kind !== 'caravan') this.tweens.add({ targets: img, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 });
      }
      const p = actorPos(a);
      const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
      m.img.setVisible(a.alive);
      m.label.setVisible(a.alive).setText(a.kind === 'hero' ? `ผู้กล้า ${a.name}` : a.kind === 'demonlord' ? `จอมมาร ${a.name}` : a.name);
      if (m.img.x === 0 && m.img.y === 0) { m.img.setPosition(x, y); m.label.setPosition(x, y); }
      else { this.tweens.add({ targets: m.img, x, y, duration: 400 }); this.tweens.add({ targets: m.label, x, duration: 400 }); m.label.y = y; }
    }
    this.updateLod();
  }

  focusChar() {
    this.follow = true;
    const g = this.game_;
    const town = this.world.towns[g.c.townId];
    this.targetZoom = Math.max(this.targetZoom, 1.3);
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.cameras.main.pan(town.x * TILE, town.y * TILE, 700, 'Sine.easeInOut');
    this.showHighlight(g.c.countryId);
  }

  zoomBy(f: number) {
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom * f, this.minZoom, Z.max);
  }

  // fly down toward a town, then hand over (used for the dive into a city)
  diveTo(townId: number, done: () => void) {
    const t = this.world.towns[townId];
    this.cameras.main.pan(t.x * TILE, t.y * TILE, 800, 'Sine.easeInOut');
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Z.max;
    this.time.delayedCall(850, done);
  }

  // camera state for the sky overlay (clouds and weather drawn in the DOM above the map)
  view() {
    const cam = this.cameras.main;
    return { zoom: cam.zoom, minZoom: this.minZoom, maxZoom: Z.max, cx: cam.midPoint.x, cy: cam.midPoint.y, W: this.W, H: this.H, country: this.countryAt(this.scale.width / 2, this.scale.height / 2) };
  }

  update(_t: number, dt: number) {
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.targetZoom) > 0.0005) {
      const before = cam.getWorldPoint(this.anchor.x, this.anchor.y);
      const k = Math.min(1, dt * 0.009);
      cam.setZoom(cam.zoom + (this.targetZoom - cam.zoom) * k);
      cam.preRender();
      const after = cam.getWorldPoint(this.anchor.x, this.anchor.y);
      cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
      if (Math.abs(cam.zoom - this.lastLodZoom) / cam.zoom > 0.04) this.updateLod();
    } else if (cam.zoom !== this.lastLodZoom) this.updateLod();
    this.updateChunks();
  }
}
