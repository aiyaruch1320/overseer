// The map in Phaser (code-plan §8.4): one camera, five zoom levels, and the layers back to front — terrain (tiles from the art provider), the look of
// the changed land, ruins, cities, labels, dragons, omens and the aiming circle, the character. This file is the only one that imports Phaser; the
// component loads it on demand, so the core, the painters and the tests never touch it. World units are map units × 3.84, so the camera zoom is the
// zoom of world-map.md §3 and its limits (0.33, 0.75, 2, 7) apply as they are.
import Phaser from 'phaser';
import type { CharacterMark, MapModel } from '../app/views/map';
import { CONT_IDS, type ContId } from './geo';
import type { CityPlan } from './city';
import { type MapCity, type MapCountry, type MapLayout } from './layout';
import { domCanvas, tileKey, type MapArtProvider, type TileImage, type TileRequest } from './provider';
import { paintCountryMask } from './terrain';
import { clampCentre, clampZoom, focusOf, levelIndex, levelOf, requestFor, viewRect, visibleKeys } from './tiles';
import { CITY_H, CITY_W, DEPTH, DRAGON_SIZE, KEY_ZOOM, LABEL, OMEN_COLOR, PAN_SPEED, RUIN, SEA, TILE_KEEP, WHEEL_ZOOM, WU, type ZoomId } from './tuning';
import type { MapAim, MapFocus, MapHover, MapPick } from './types';
import { font } from '../ui/tokens';

const hex = (s: string) => parseInt(s.replace('#', ''), 16);

export interface ControllerOpts {
  layout: MapLayout;
  provider: MapArtProvider;
  seed: number;
  /** Palette (five hex colours) per continent, from the data. */
  palettes: Record<string, string[]>;
  onPick?: (p: MapPick) => void;
  onHover?: (p: MapHover | null) => void;
  onLevel?: (level: ZoomId, zoom: number) => void;
  /** The plan of a town (for the people of the inside level); the code-drawn provider has it, a picture does not. */
  plan?: (cityId: string) => CityPlan | null;
  names: { country: (id: string) => { name: string; title: string }; continent: (id: string) => string };
}

/** What the component holds: it sets the state of the map and tears it down. */
export class MapController {
  game: Phaser.Game;
  scene: MapScene;
  constructor(readonly parent: HTMLElement, readonly opts: ControllerOpts) {
    const w = Math.max(320, parent.clientWidth), h = Math.max(200, parent.clientHeight);
    this.scene = new MapScene(opts);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: w,
      height: h,
      backgroundColor: SEA.deep,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      banner: false,
      audio: { noAudio: true },
      disableContextMenu: true,
      input: { mouse: { preventDefaultWheel: true }, keyboard: false, gamepad: false },
      render: { antialias: true, powerPreference: 'low-power' },
      scene: this.scene,
    });
  }
  setModel(m: MapModel) { this.scene.setModel(m); }
  setFocus(f: MapFocus | undefined, zoom?: number) { this.scene.setFocus(f, zoom); }
  setAim(a: MapAim | null | undefined) { this.scene.aim = a ?? null; }
  setPick(p: MapPick['kind'] | false | undefined) { this.scene.pickMode = p; }
  key(e: KeyboardEvent, down: boolean): boolean { return this.scene.key(e, down); }
  camera() { return this.scene.camState(); }
  destroy() { this.game.destroy(true); }
}

interface Shown { img: Phaser.GameObjects.Image; req: TileRequest; used: number }
interface LabelRec {
  /** The text objects are made when the label is first shown (a Phaser text is costly: 150 of them at the start stall the page). */
  t?: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  strike?: Phaser.GameObjects.Graphics;
  text: string;
  subText: string;
  ruin: boolean;
  size: number;
  col: string;
  bold: boolean;
  kind: 'continent' | 'country' | 'city';
  x: number;
  y: number;
  prio: number;
  country?: string;
  cont?: ContId;
}

class MapScene extends Phaser.Scene {
  aim: MapAim | null = null;
  pickMode: MapPick['kind'] | false | undefined;
  private model: MapModel | null = null;
  private modelSig = '';
  private shown = new Map<string, Shown>();
  private pending = new Set<string>();
  private queue: TileRequest[] = [];
  private frame = 0;
  private level: ZoomId = 'world';
  private lastSync = { x: NaN, y: NaN, z: NaN, sig: '' };
  private labels: LabelRec[] = [];
  private gCity!: Phaser.GameObjects.Graphics;
  private gOverlay!: Phaser.GameObjects.Graphics;
  private gAnim!: Phaser.GameObjects.Graphics;
  private ruinImgs = new Map<string, Phaser.GameObjects.Image>();
  private hoverImgs = new Map<string, Phaser.GameObjects.Image>();
  private keys = new Set<string>();
  private drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null;
  private pointer = { x: 0, y: 0, inside: false };
  private focusWant: { f: MapFocus; zoom?: number } | null = null;
  private ready = false;
  private moved = false;
  private lastHoverKey = '';
  private lastLabelCull = -1e9;
  private lastCityDraw = { z: NaN, sig: '' };

  constructor(private o: ControllerOpts) {
    super('map');
  }

  // ---- setup ----
  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(SEA.deep);
    this.gCity = this.add.graphics().setDepth(DEPTH.cities);
    this.gOverlay = this.add.graphics().setDepth(DEPTH.ruins + 1);
    this.gAnim = this.add.graphics().setDepth(DEPTH.omens);
    this.buildLabels();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.drag = { sx: p.x, sy: p.y, cx: cam.scrollX, cy: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointer = { x: p.x, y: p.y, inside: true };
      if (this.drag && p.isDown) {
        const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 5) { this.drag.moved = true; this.moved = true; }
        if (this.drag.moved) {
          cam.scrollX = this.drag.cx - dx / cam.zoom;
          cam.scrollY = this.drag.cy - dy / cam.zoom;
        }
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const moved = this.drag?.moved;
      this.drag = null;
      if (moved || p.button !== 0) return;
      const t = this.targetAt(p.x, p.y);
      if (t) this.o.onPick?.({ kind: t.kind, id: t.id });
    });
    this.input.on('gameout', () => { this.pointer.inside = false; });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM, p.x, p.y));
    // the canvas takes its size from the page after the first frame: until the player moves the camera, the focus is fitted again
    this.scale.on('resize', () => {
      this.lastSync.z = NaN;
      if (!this.moved && this.focusWant) this.applyFocus(this.focusWant.f, this.focusWant.zoom);
    });
    this.ready = true;
    this.applyFocus((this.focusWant ?? { f: { kind: 'world' as const } }).f, this.focusWant?.zoom);
    if (this.model) this.applyModel();
  }

  private makeText(text: string, size: number, col: string, bold = false) {
    return this.add
      .text(0, 0, text, { fontFamily: font.title, fontSize: `${size}px`, color: col, stroke: '#0a0c12', strokeThickness: Math.max(2, Math.round(size / 6)), fontStyle: bold ? 'bold' : 'normal' })
      .setOrigin(0.5).setDepth(DEPTH.labels).setResolution(Math.min(2, window.devicePixelRatio || 1) * 1.5).setVisible(false);
  }

  private buildLabels() {
    const L = this.o.layout;
    const add = (rec: Omit<LabelRec, 'subText' | 'ruin'>) => this.labels.push({ ...rec, subText: '', ruin: false });
    for (const id of CONT_IDS) {
      const c = L.continents[id];
      add({ text: this.o.names.continent(id), size: LABEL.continent, col: this.o.palettes[id]?.[1] ?? '#f4f0e0', bold: true, kind: 'continent', x: c.label.x, y: c.label.y, prio: 1000, cont: id });
    }
    for (const c of L.countries) {
      const cap = L.citiesOf(c.id)[0];
      const col = this.o.palettes[c.continent]?.[1] ?? '#f4f0e0';
      add({ text: c.name, size: LABEL.country, col, bold: false, kind: 'country', x: c.x, y: c.y + 2.2, prio: Math.sqrt(c.area), country: c.id });
      if (cap) add({ text: c.name, size: LABEL.city + 2, col: '#fff4d8', bold: true, kind: 'city', x: cap.x, y: cap.y - 2.6, prio: 500 + cap.size, country: c.id });
    }
  }

  // ---- model / focus ----
  setModel(m: MapModel) {
    const sig = JSON.stringify([m.looks, m.ruins.map((r) => [r.country, r.kind, r.healed, r.lake, r.city, r.label]), m.fallen, m.dragons.map((d) => [d.alive, d.wounded, Math.round(d.mood / 10)]), m.omens.map((o) => [o.n, o.country, o.continent, o.color]), m.character && [m.character.country, m.character.dead], m.fates.map((f) => f.fate), m.flags, m.lands]);
    this.model = m;
    if (sig === this.modelSig) return;
    this.modelSig = sig;
    if (this.ready) this.applyModel();
  }

  private applyModel() {
    this.lastSync.sig = '';
    this.lastCityDraw.sig = '';
    this.rebuildRuins();
    this.relabel();
  }

  setFocus(f: MapFocus | undefined, zoom?: number) {
    if (!f) return;
    this.focusWant = { f, zoom };
    this.moved = false;
    if (this.ready) this.applyFocus(f, zoom);
  }

  private applyFocus(f: MapFocus, zoom?: number) {
    const cam = this.cameras.main;
    const fit = focusOf(this.o.layout, f, cam.width, cam.height);
    let { x, y } = fit;
    if (f.kind === 'city' && f.id && !this.o.layout.cities.find((c) => c.id === f.id)) {
      const cap = this.o.layout.citiesOf(f.id)[0];
      if (cap) { x = cap.x; y = cap.y; }
    }
    cam.setZoom(clampZoom(zoom ?? fit.zoom));
    cam.scrollX = x * WU - cam.width / 2;
    cam.scrollY = y * WU - cam.height / 2;
    this.lastSync.z = NaN;
  }

  camState() {
    const cam = this.cameras.main;
    return { x: (cam.scrollX + cam.width / 2) / WU, y: (cam.scrollY + cam.height / 2) / WU, zoom: cam.zoom, level: this.level };
  }

  // ---- input ----
  key(e: KeyboardEvent, down: boolean): boolean {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
      if (down) this.keys.add(k); else this.keys.delete(k);
      return true;
    }
    if (!down) return false;
    const cam = this.cameras.main;
    if (k === '+' || k === '=') { this.zoomBy(KEY_ZOOM, cam.width / 2, cam.height / 2); return true; }
    if (k === '-' || k === '_') { this.zoomBy(1 / KEY_ZOOM, cam.width / 2, cam.height / 2); return true; }
    if (k === 'home' || k === '0') { this.moved = false; this.focusWant = { f: { kind: 'world' } }; this.applyFocus({ kind: 'world' }); return true; }
    return false;
  }

  private worldAt(sx: number, sy: number) {
    const cam = this.cameras.main;
    return { x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom, y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom };
  }

  private zoomBy(f: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    this.moved = true;
    const w = this.worldAt(sx, sy);
    cam.setZoom(clampZoom(cam.zoom * f));
    cam.scrollX = w.x - cam.width / 2 - (sx - cam.width / 2) / cam.zoom;
    cam.scrollY = w.y - cam.height / 2 - (sy - cam.height / 2) / cam.zoom;
  }

  /** What a click or an aim at a screen point picks, by the aim, the pick mode or the zoom level. */
  private targetAt(sx: number, sy: number): (MapPick & { country: MapCountry; city?: MapCity }) | null {
    const L = this.o.layout;
    const w = this.worldAt(sx, sy);
    const px = w.x / WU, py = w.y / WU;
    const mode = this.aim?.kind ?? this.pickMode;
    if (mode === false) return null;
    const lv = this.level;
    const kind: MapPick['kind'] = mode ?? (lv === 'world' ? 'continent' : lv === 'continent' || lv === 'country' ? 'country' : 'city');
    const country = L.countryAt(px, py);
    if (!country) return null;
    if (kind === 'continent') return { kind, id: country.continent, country };
    if (kind === 'city') {
      const c = L.cityNear(px, py, CITY_W * 0.6) ?? L.citiesOf(country.id)[0];
      return c ? { kind, id: c.id, country, city: c } : null;
    }
    return { kind: 'country', id: country.id, country };
  }

  // ---- frame ----
  update(time: number, delta: number) {
    this.frame++;
    const cam = this.cameras.main;
    if (this.keys.size) {
      this.moved = true;
      const sp = (PAN_SPEED * delta) / 1000 / cam.zoom;
      if (this.keys.has('arrowleft') || this.keys.has('a')) cam.scrollX -= sp;
      if (this.keys.has('arrowright') || this.keys.has('d')) cam.scrollX += sp;
      if (this.keys.has('arrowup') || this.keys.has('w')) cam.scrollY -= sp;
      if (this.keys.has('arrowdown') || this.keys.has('s')) cam.scrollY += sp;
    }
    const mid = { x: (cam.scrollX + cam.width / 2) / WU, y: (cam.scrollY + cam.height / 2) / WU };
    const cc = clampCentre(mid.x, mid.y);
    if (cc.x !== mid.x || cc.y !== mid.y) { cam.scrollX = cc.x * WU - cam.width / 2; cam.scrollY = cc.y * WU - cam.height / 2; }
    const lv = levelOf(cam.zoom);
    if (lv !== this.level) {
      this.level = lv;
      this.lastSync.z = NaN;
      this.lastCityDraw.z = NaN;
      this.lastLabelCull = -1e9;
      this.o.onLevel?.(lv, cam.zoom);
    } else if (this.frame % 15 === 0) this.o.onLevel?.(lv, cam.zoom);

    this.syncTiles(cam);
    this.drainQueue();
    this.drawCities(cam);
    this.cullLabels(cam, time);
    this.drawAnim(cam, time);
    this.updateHover();
  }

  private syncTiles(cam: Phaser.Cameras.Scene2D.Camera) {
    const mx = (cam.scrollX + cam.width / 2) / WU, my = (cam.scrollY + cam.height / 2) / WU;
    const vw = cam.width / cam.zoom / WU, vh = cam.height / cam.zoom / WU;
    if (Math.abs(mx - this.lastSync.x) < vw * 0.04 && Math.abs(my - this.lastSync.y) < vh * 0.04 && cam.zoom === this.lastSync.z && this.modelSig === this.lastSync.sig) return;
    this.lastSync = { x: mx, y: my, z: cam.zoom, sig: this.modelSig };
    const L = this.o.layout;
    const view = viewRect(mx, my, cam.zoom, cam.width, cam.height);
    const looks = this.model?.looks ?? { fates: {}, flood: false };
    const li = levelIndex(this.level);
    const wanted: TileRequest[] = [requestFor(L, 'world', 'world', looks, this.o.seed)];
    if (this.level === 'world') for (const id of visibleKeys(L, 'continent', view)) wanted.push(requestFor(L, 'world', id, looks, this.o.seed));
    if (li >= 1) for (const k of visibleKeys(L, 'continent', view)) wanted.push(requestFor(L, 'continent', k, looks, this.o.seed));
    if (li >= 2) for (const k of visibleKeys(L, 'country', view)) wanted.push(requestFor(L, 'country', k, looks, this.o.seed));
    if (li >= 3) for (const k of visibleKeys(L, 'city', view)) wanted.push(requestFor(L, this.level === 'inside' ? 'inside' : 'city', k, looks, this.o.seed));
    const want = new Set<string>();
    for (const r of wanted) {
      const k = tileKey(r);
      want.add(k);
      const s = this.shown.get(k);
      if (s) s.used = this.frame;
      else if (!this.pending.has(k) && !this.queue.some((q) => tileKey(q) === k)) this.queue.push(r);
    }
    this.queue = this.queue.filter((q) => want.has(tileKey(q)));
    // the town tile stays under its inside tile until that one is ready
    for (const [k, s] of this.shown) {
      let on = want.has(k);
      if (!on && s.req.level === 'city' && this.level === 'inside') on = ![...this.shown.values()].some((o) => o.req.level === 'inside' && o.req.key === s.req.key);
      if (on && s.req.level === 'city' && this.level === 'inside' && want.has(k) === false) on = true;
      s.img.setVisible(on);
      if (on) s.used = this.frame;
    }
    if (this.shown.size > TILE_KEEP + want.size) {
      const old = [...this.shown.entries()].filter(([k]) => !want.has(k)).sort((a, b) => a[1].used - b[1].used);
      for (const [k, s] of old.slice(0, this.shown.size - TILE_KEEP - want.size)) {
        s.img.destroy();
        this.textures.remove(`t:${k}`);
        this.shown.delete(k);
      }
    }
    this.queue.sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || Math.hypot(a.rect.x + a.rect.w / 2 - mx, a.rect.y + a.rect.h / 2 - my) - Math.hypot(b.rect.x + b.rect.w / 2 - mx, b.rect.y + b.rect.h / 2 - my));
  }

  private drainQueue() {
    if (this.pending.size >= 2) return;
    const req = this.queue.shift();
    if (!req) return;
    const k = tileKey(req);
    this.pending.add(k);
    // painting is synchronous in the code provider; one tile a frame keeps the camera moving
    Promise.resolve(this.o.provider.tile(req))
      .then((t) => { if (t && this.sys.isActive()) this.addTile(k, req, t); })
      .catch(() => undefined)
      .finally(() => this.pending.delete(k));
  }

  private addTile(k: string, req: TileRequest, t: TileImage) {
    if (this.shown.has(k)) return;
    const tk = `t:${k}`;
    if (this.textures.exists(tk)) this.textures.remove(tk);
    const src = t.source as unknown as HTMLCanvasElement | HTMLImageElement;
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) this.textures.addCanvas(tk, src);
    else this.textures.addImage(tk, src as HTMLImageElement);
    const depth = { world: req.key === 'world' ? -5 : DEPTH.terrain + 1, continent: DEPTH.terrain + 2, country: DEPTH.terrain + 3, city: DEPTH.terrain + 4, inside: DEPTH.terrain + 5 }[req.level];
    const img = this.add.image(t.rect.x * WU, t.rect.y * WU, tk).setOrigin(0, 0).setDisplaySize(t.rect.w * WU, t.rect.h * WU).setDepth(depth);
    this.shown.set(k, { img, req, used: this.frame });
    this.lastSync.z = NaN; // look again at what shows
  }

  // ---- cities ----
  private drawCities(cam: Phaser.Cameras.Scene2D.Camera) {
    const z = cam.zoom;
    const lvIdx = levelIndex(this.level);
    const show = lvIdx >= 1 && lvIdx <= 2;
    const sig = `${this.modelSig}|${show}`;
    if (Math.abs(z - this.lastCityDraw.z) / z < 0.03 && sig === this.lastCityDraw.sig) return;
    this.lastCityDraw = { z, sig };
    const g = this.gCity;
    g.clear();
    if (!show) return;
    const L = this.o.layout;
    const px = 1 / z;
    const ruined = new Set((this.model?.ruins ?? []).map((r) => r.country));
    for (const c of L.cities) {
      const mc = L.byId.get(c.country);
      if (!mc || (!c.capital && z < 0.75)) continue;
      const pal = this.o.palettes[mc.continent] ?? [];
      const x = c.x * WU, y = c.y * WU;
      const r = (c.capital ? 5 : c.size === 2 ? 3.4 : 2.6) * px;
      g.fillStyle(0x0a0c12, 0.85).fillCircle(x, y, r + 1.4 * px);
      g.fillStyle(ruined.has(c.country) ? hex(RUIN.fill) : hex(c.capital ? pal[2] ?? '#e8c36a' : pal[1] ?? '#f4f0e0'), 1).fillCircle(x, y, r);
      if (c.capital) g.lineStyle(1.2 * px, 0xfff4d8, 0.9).strokeCircle(x, y, r + 3 * px);
      if (c.capital && z >= 0.75)
        (this.model?.flags[c.country] ?? []).forEach((f, i) => {
          const fx = x + (9 + i * 9) * px, fy = y - 8 * px;
          g.fillStyle(f === 'war' ? 0xd04040 : f === 'famine' ? 0xb08a4a : f === 'plague' ? 0x6aa05a : 0xe8c36a, 1);
          if (f === 'war') g.fillTriangle(fx - 4 * px, fy + 4 * px, fx + 4 * px, fy + 4 * px, fx, fy - 4 * px);
          else if (f === 'golden') g.fillRect(fx - 3.5 * px, fy - 3.5 * px, 7 * px, 7 * px);
          else g.fillCircle(fx, fy, 3.6 * px);
        });
    }
  }

  // ---- ruins and fallen lands ----
  private maskImage(c: MapCountry, pool: Map<string, Phaser.GameObjects.Image>): Phaser.GameObjects.Image {
    let img = pool.get(c.id);
    if (!img) {
      const key = `m:${c.id}`;
      if (!this.textures.exists(key)) {
        const w = Math.min(1024, Math.ceil(c.box.w * 2)), h = Math.min(1024, Math.ceil(c.box.h * 2));
        const cv = domCanvas(w, h);
        paintCountryMask(cv, c.box, this.o.layout, c.n);
        this.textures.addCanvas(key, cv as HTMLCanvasElement);
      }
      img = this.add.image(c.box.x * WU, c.box.y * WU, key).setOrigin(0, 0).setDisplaySize(c.box.w * WU, c.box.h * WU).setVisible(false);
      pool.set(c.id, img);
    }
    return img;
  }

  private rebuildRuins() {
    for (const i of this.ruinImgs.values()) i.setVisible(false);
    const g = this.gOverlay;
    g.clear();
    const m = this.model;
    if (!m) return;
    const L = this.o.layout;
    for (const r of m.ruins) {
      const c = L.byId.get(r.country);
      if (!c) continue;
      this.maskImage(c, this.ruinImgs).setTint(hex(RUIN.fill)).setAlpha(r.healed ? 0.5 : r.kind === 'fallen' ? 0.78 : 0.93).setDepth(DEPTH.ruins).setVisible(true);
      if (r.kind === 'fallen') continue;
      // the pit: a black ring with a glassy rim (MR-17), or green-black water (MR-18, or a ruin that became a lake)
      const cap = L.citiesOf(c.id)[0];
      const x = (cap?.x ?? c.x) * WU, y = (cap?.y ?? c.y) * WU, rr = 5.5 * WU;
      const water = r.kind === 'MR-18' || r.lake;
      g.fillStyle(hex(water ? RUIN.water : RUIN.pit), 0.95).fillEllipse(x, y, rr * 2, rr * 1.5);
      g.lineStyle(2, hex(water ? '#3a7a70' : RUIN.glass), 0.95).strokeEllipse(x, y, rr * 2, rr * 1.5);
    }
    for (const l of m.lands) {
      const c = L.byId.get(l.beside);
      if (!c) continue;
      g.fillStyle(0x2a2e34, 1).fillEllipse((c.x + 14) * WU, (c.y - 10) * WU, 9 * WU, 6 * WU);
      g.lineStyle(2, 0xd8ece8, 0.9).strokeEllipse((c.x + 14) * WU, (c.y - 10) * WU, 9 * WU, 6 * WU);
    }
  }

  // ---- labels ----
  /** Writes the text of every label from the model: a ruin strikes the old name and writes its own under it, a changed continent its new name over the old. */
  private relabel() {
    const m = this.model;
    const ruinOf = new Map((m?.ruins ?? []).map((r) => [r.country, r]));
    const fateOf = new Map((m?.fates ?? []).filter((f) => f.continent !== '*').map((f) => [f.continent as string, f]));
    for (const l of this.labels) {
      if (l.kind === 'continent') {
        const f = fateOf.get(l.cont!);
        l.text = f ? f.name : this.o.names.continent(l.cont!);
        l.subText = f ? this.o.names.continent(l.cont!) : '';
        l.ruin = false;
      } else {
        const r = ruinOf.get(l.country!);
        const c = this.o.layout.byId.get(l.country!)!;
        const dead = !!r && !r.healed;
        l.text = c.name;
        l.col = dead ? RUIN.label : l.kind === 'city' ? '#fff4d8' : this.o.palettes[c.continent]?.[1] ?? '#f4f0e0';
        l.subText = r ? (r.label && r.label !== c.name ? r.label : c.name) : '';
        l.ruin = dead;
      }
      if (l.t) l.t.setText(l.text).setColor(l.col);
      if (l.sub) l.sub.setText(l.subText);
    }
    this.lastLabelCull = -1e9;
  }

  /** Decides which labels show at this zoom (by level, view and overlap, most important first) and keeps them one screen size. */
  private cullLabels(cam: Phaser.Cameras.Scene2D.Camera, time: number) {
    const z = cam.zoom;
    if (time - this.lastLabelCull < 140 && !this.drag) {
      for (const l of this.labels) if (l.t?.visible) { l.t.setScale(1 / z); l.sub?.setScale(1 / z); }
      return;
    }
    this.lastLabelCull = time;
    const lvIdx = levelIndex(this.level);
    const view = viewRect((cam.scrollX + cam.width / 2) / WU, (cam.scrollY + cam.height / 2) / WU, z, cam.width, cam.height);
    const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const wanted = (l: LabelRec) => (l.kind === 'continent' ? lvIdx === 0 : l.kind === 'country' ? lvIdx === 1 : lvIdx === 2 || lvIdx === 3);
    for (const l of this.labels) { l.t?.setVisible(false); l.sub?.setVisible(false); l.strike?.clear(); }
    const order = this.labels.filter(wanted).sort((a, b) => b.prio - a.prio);
    for (const l of order) {
      if (l.x < view.x - 4 || l.x > view.x + view.w + 4 || l.y < view.y - 4 || l.y > view.y + view.h + 4) continue;
      const sx = (l.x * WU - (cam.scrollX + cam.width / 2)) * z + cam.width / 2, sy = (l.y * WU - (cam.scrollY + cam.height / 2)) * z + cam.height / 2;
      // the size of the text is known before the object is made: a Thai name is about half an em a letter
      const w = l.t ? l.t.width : l.text.length * l.size * 0.55 + 8, th = l.t ? l.t.height : l.size * 1.5;
      const h = th + (l.subText ? l.size : 0);
      const box = { x0: sx - w / 2, y0: sy - th / 2, x1: sx + w / 2, y1: sy - th / 2 + h };
      if (taken.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      taken.push(box);
      l.t ??= this.makeText(l.text, l.size, l.col, l.bold);
      l.t.setPosition(l.x * WU, l.y * WU).setScale(1 / z).setVisible(true);
      if (l.subText) {
        l.sub ??= this.makeText(l.subText, LABEL.small + 2, RUIN.label);
        if (l.sub.text !== l.subText) l.sub.setText(l.subText);
        l.sub.setOrigin(0.5, l.kind === 'continent' ? 1 : 0).setPosition(l.x * WU, l.y * WU + (l.kind === 'continent' ? -(l.t.height / 2 + 4) : l.t.height / 2) / z).setScale(1 / z).setVisible(true);
      }
      if (l.ruin) {
        l.strike ??= this.add.graphics().setDepth(DEPTH.labels + 1);
        const half = l.t.width / 2 / z;
        l.strike.lineStyle(2 / z, hex(RUIN.strike), 1).lineBetween(l.x * WU - half, l.y * WU, l.x * WU + half, l.y * WU);
      }
    }
  }

  // ---- animated layers: dragons, omens, the character, the aim ----
  private drawAnim(cam: Phaser.Cameras.Scene2D.Camera, time: number) {
    const g = this.gAnim;
    g.clear();
    const m = this.model;
    if (!m) return;
    const z = cam.zoom, px = 1 / z;
    const L = this.o.layout;
    const lvIdx = levelIndex(this.level);
    // the dragons sleep as shadow, scale and an eye, never whole (03-dragons.md); a fallen one is bones
    const share = new Map<string, number>();
    for (const d of m.dragons) {
      const c = L.byId.get(d.country);
      if (!c) continue;
      const n = share.get(c.id) ?? 0;
      share.set(c.id, n + 1);
      const cap = L.citiesOf(c.id)[0];
      const bx = ((cap?.x ?? c.x) + (n ? 8 : -7)) * WU, by = ((cap?.y ?? c.y) + (n ? 5 : 4)) * WU;
      const R = DRAGON_SIZE[d.index] * WU * 0.8;
      const col = hex(d.color);
      const a = lvIdx <= 1 ? 0.55 : 0.85;
      if (d.alive) {
        const breath = 0.5 + 0.5 * Math.sin(time / 900 + d.index);
        g.fillStyle(0x05060a, 0.35 * a).fillEllipse(bx, by, R * 2, R * 0.8);
        g.fillStyle(col, (0.12 + 0.08 * breath) * a).fillEllipse(bx, by - R * 0.1, R * 1.7, R * 0.6);
        g.lineStyle(Math.max(1.5, 2 * px), col, 0.55 * a);
        for (let i = -2; i <= 2; i++) g.beginPath().arc(bx + i * R * 0.3, by, R * 0.28, Math.PI * 1.1, Math.PI * 1.9).strokePath();
        g.fillStyle(col, Math.min(1, (0.3 + d.mood / 150) * (0.6 + 0.4 * breath)) * a).fillEllipse(bx + R * 0.82, by - R * 0.05, Math.max(5 * px, R * 0.12), Math.max(2.4 * px, R * 0.05));
      } else {
        g.lineStyle(Math.max(1.4, 2 * px), 0x9a9486, 0.6 * a);
        for (let i = -2; i <= 2; i++) g.beginPath().arc(bx + i * R * 0.26, by, R * 0.34, Math.PI * 1.05, Math.PI * 1.95).strokePath();
        g.lineBetween(bx - R * 0.8, by, bx + R * 0.8, by);
      }
    }
    // omens: a ring of mist in the colour of the line that paid, turning slowly (20-god-ui.md §7.2)
    for (const o of m.omens) {
      let cx: number, cy: number, rad: number;
      const c = o.country ? L.byId.get(o.country) : undefined;
      const cont = o.continent ? L.continents[o.continent as ContId] : undefined;
      if (c) { cx = c.x; cy = c.y; rad = Math.max(9, Math.min(40, Math.sqrt(c.area / Math.PI) * 0.85)); }
      else if (cont) { cx = cont.box.x + cont.box.w / 2; cy = cont.box.y + cont.box.h / 2; rad = Math.max(cont.box.w, cont.box.h) * 0.45; }
      else continue;
      this.ring(g, cx * WU, cy * WU, rad * WU, hex(o.color), time, px);
    }
    // the mark of a small or middle miracle: a ring on the place it fell on, fading over the year after its day (20-god-ui.md §7.3)
    for (const k of m.marks ?? []) {
      const c = k.country ? L.byId.get(k.country) : undefined;
      const cont = k.continent ? L.continents[k.continent as ContId] : undefined;
      const cx = c ? c.x : cont ? cont.box.x + cont.box.w / 2 : -1;
      const cy = c ? c.y : cont ? cont.box.y + cont.box.h / 2 : -1;
      if (cx < 0) continue;
      const rad = c ? Math.max(7, Math.min(30, Math.sqrt(c.area / Math.PI) * 0.7)) : Math.max(cont!.box.w, cont!.box.h) * 0.35;
      const wave = ((time / 1800) % 1);
      g.lineStyle(Math.max(2.4 * px, 2.2), hex(k.color), 0.25 + 0.6 * k.fresh).strokeCircle(cx * WU, cy * WU, rad * WU * 0.75);
      g.lineStyle(Math.max(1.6 * px, 1.4), hex(k.color), (1 - wave) * 0.7 * (0.3 + 0.7 * k.fresh)).strokeCircle(cx * WU, cy * WU, rad * WU * (0.75 + 0.5 * wave));
    }
    if (lvIdx === 4) this.walkers(g, cam, time, px);
    if (m.character && !m.character.dead) this.beacon(g, m.character, time, px, lvIdx);
    this.drawAim(g, time, px);
  }

  /** The people of the town under the camera at the inside level: a few walkers on the streets of its plan, going back and forth (a place for the life of a town to grow). */
  private people = new Map<string, { s: number; t: number; v: number; col: number }[]>();
  private walkers(g: Phaser.GameObjects.Graphics, cam: Phaser.Cameras.Scene2D.Camera, time: number, px: number) {
    const L = this.o.layout;
    const cx = (cam.scrollX + cam.width / 2) / WU, cy = (cam.scrollY + cam.height / 2) / WU;
    const city = L.cities.find((c) => Math.abs(c.x - cx) < CITY_W / 2 && Math.abs(c.y - cy) < CITY_H / 2);
    const plan = city && this.o.plan?.(city.id);
    if (!city || !plan || !plan.streets.length) return;
    let list = this.people.get(city.id);
    if (!list) {
      let h = 7;
      for (const ch of city.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
      const cols = [0xe8c36a, 0xd04040, 0x4a8ac0, 0xf0ece0, 0x6aa05a, 0xa05ac8];
      list = Array.from({ length: 36 }, () => ({ s: Math.floor(rnd() * plan.streets.length), t: rnd(), v: 0.012 + rnd() * 0.02, col: cols[Math.floor(rnd() * cols.length)] }));
      this.people.set(city.id, list);
    }
    const ox = (city.x - CITY_W / 2) * WU, oy = (city.y - CITY_H / 2) * WU;
    for (const w of list) {
      const st = plan.streets[w.s];
      const phase = ((w.t + (time / 1000) * w.v) % 2);
      const t = phase > 1 ? 2 - phase : phase;
      const f = t * (st.pts.length - 1), i = Math.min(st.pts.length - 2, Math.floor(f)), k = f - i;
      const a = st.pts[i], b = st.pts[i + 1];
      const x = ox + (a[0] + (b[0] - a[0]) * k) * WU, y = oy + (a[1] + (b[1] - a[1]) * k) * WU;
      g.fillStyle(0x000000, 0.3).fillEllipse(x + 0.5 * px, y + 0.6 * px, 5 * px, 2.4 * px);
      g.fillStyle(w.col, 1).fillCircle(x, y - 2.2 * px, 2.1 * px);
      g.fillStyle(0xf0d8b8, 1).fillCircle(x, y - 4.6 * px, 1.4 * px);
    }
  }

  private ring(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, col: number, time: number, px: number) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 700);
    g.fillStyle(col, 0.1 + 0.07 * pulse).fillCircle(x, y, r);
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.2);
      const a0 = (time / 2400) * (k % 2 ? -1 : 1) + k;
      g.lineStyle(Math.max(2.2 * px, 2.4 - k * 0.4), col, 0.75);
      for (let i = 0; i < 6; i++) g.beginPath().arc(x, y, rr, a0 + (i * Math.PI) / 3, a0 + (i * Math.PI) / 3 + 0.7).strokePath();
    }
  }

  private beacon(g: Phaser.GameObjects.Graphics, ch: CharacterMark, time: number, px: number, lvIdx: number) {
    const L = this.o.layout;
    const city = L.cities.find((c) => c.id === ch.city) ?? L.citiesOf(ch.country)[0];
    if (!city) return;
    const x = city.x * WU, y = city.y * WU;
    const pulse = 0.5 + 0.5 * Math.sin(time / 500);
    const base = lvIdx >= 3 ? 1.6 * WU * 0.2 : 7 * px;
    g.fillStyle(0xe8c36a, 0.2 + 0.2 * pulse).fillCircle(x, y, base * (2.4 + pulse));
    g.lineStyle(Math.max(2 * px, 0.3), 0xe8c36a, 0.95).strokeCircle(x, y, base * 1.5);
    g.fillStyle(0xfff4d8, 1).fillCircle(x, y, base * 0.7);
    g.lineStyle(Math.max(1.5 * px, 0.2), 0xe8c36a, 0.8).lineBetween(x, y - base * 3.2, x, y - base * 1.9);
  }

  private drawAim(g: Phaser.GameObjects.Graphics, time: number, px: number) {
    const a = this.aim;
    if (!a || !this.pointer.inside) return;
    const col = hex(OMEN_COLOR[a.line ?? 'faith']);
    const w = this.worldAt(this.pointer.x, this.pointer.y);
    const r = a.radius ? a.radius * WU : 26 * px;
    g.lineStyle(2 * px, col, 0.95).strokeCircle(w.x, w.y, r);
    g.lineStyle(px, col, 0.6).strokeCircle(w.x, w.y, r * 1.25 + Math.sin(time / 300) * 2 * px);
    g.lineBetween(w.x - r * 1.5, w.y, w.x - r * 0.6, w.y).lineBetween(w.x + r * 0.6, w.y, w.x + r * 1.5, w.y);
    g.lineBetween(w.x, w.y - r * 1.5, w.x, w.y - r * 0.6).lineBetween(w.x, w.y + r * 0.6, w.x, w.y + r * 1.5);
    if (a.hold && a.hold > 0) g.lineStyle(5 * px, col, 1).beginPath().arc(w.x, w.y, r * 1.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, a.hold)).strokePath();
  }

  // ---- hover: the place under the cursor is lit and named ----
  private updateHover() {
    if (!this.pointer.inside || this.drag?.moved) {
      if (this.lastHoverKey) { this.lastHoverKey = ''; this.clearHover(); this.o.onHover?.(null); }
      return;
    }
    if (this.frame % 3) return;
    const t = this.targetAt(this.pointer.x, this.pointer.y);
    const key = t ? `${t.kind}:${t.id}` : '';
    if (key === this.lastHoverKey) return;
    this.lastHoverKey = key;
    this.clearHover();
    if (!t) { this.o.onHover?.(null); return; }
    const L = this.o.layout;
    const list = t.kind === 'continent' ? L.countries.filter((c) => c.continent === t.id) : [t.country];
    const col = this.aim ? hex(OMEN_COLOR[this.aim.line ?? 'faith']) : 0xffffff;
    for (const c of list) this.maskImage(c, this.hoverImgs).setTint(col).setAlpha(this.aim ? 0.34 : 0.2).setDepth(DEPTH.borders).setVisible(true);
    const n = t.kind === 'continent' ? { name: this.o.names.continent(t.id), title: '' } : this.o.names.country(t.country.id);
    this.o.onHover?.({ kind: t.kind, id: t.id, name: n.name, title: n.title, x: this.pointer.x, y: this.pointer.y });
  }

  private clearHover() {
    for (const i of this.hoverImgs.values()) i.setVisible(false);
  }
}
