import Phaser from 'phaser';
import { generateWorld, CONTINENTS, type WorldMap } from '../sim/worldgen';
import { TerrainRenderer } from '../render/terrain/terrain';
import { MU_TO_WU, CONT_LABELS } from '../world/geo';
import { CITY_S, CITY_WU, CW, CH, T as CT, getCity, extentOf, setLandProbe, setTownLinks } from '../city/citygen';
import { buildRoads } from '../world/roads';
import type { CityScene } from './CityScene';
import type { Game } from '../sim/game';
import { iconTex, raceTex } from './sprites';
import { townSpecialty } from '../sim/locale';
import { COUNTRY_DOCS } from '../data/countries';
import { cradleTex } from './people';
import { actorPos } from '../sim/society';
import { REGION_EVENTS } from '../data/people';
import { DISASTERS } from '../data/disasters';
import { FESTIVALS } from '../data/npclife';
import { FATES, fateOf, setFate } from '../sim/fate';
import { onTreeRoot } from '../render/treeart';
import type { Fate } from '../sim/types';

export { drawPortrait } from './sprites';
// World coordinates: 8 units per tile. The terrain itself is vector art drawn by TerrainRenderer onto its own DPR-sized
// canvas behind this (transparent) Phaser canvas, so it is re-drawn at the screen's real resolution at every zoom;
// this scene owns the camera, the labels, towns and markers on top.
export const TILE = 8;
const FLAG_ICON: Record<string, string> = { war: 'war', plague: 'plague', famine: 'famine', golden: 'golden', demon_raid: 'demon', ...Object.fromEntries(REGION_EVENTS.map((e) => [e.flag, e.icon])), ...Object.fromEntries(DISASTERS.map((d) => [d.flag, d.icon])), ...Object.fromEntries(FESTIVALS.map((f) => [`fest_${f.id}`, f.icon])) };
// the seven branches of the world tree (docs/countries/08-silvanel.md) each have a light of their own; a country's name is underlined in its branch's colour
const BRANCH_COLOR: Record<string, number> = { 'กิ่งอรุณ': 0xe8c850, 'กิ่งสนธยา': 0x8a6ad8, 'กิ่งน้ำค้าง': 0x4a9aa8, 'กิ่งขวากหนาม': 0xc8483a, 'กิ่งเมฆ': 0xa8e0c8, 'กิ่งดิน': 0x9a6a44, 'กิ่งเหี่ยว': 0xd8a030 };
const ACTOR_ICON: Record<string, string> = { hero: 'herosword', demonlord: 'demon', caravan: 'gold' };
// zoom levels, all one continuous camera: world → continent → country → town markers → city blocks seen from above (sprites on
// the map) → the living city (people, light and weather on top) → down to the cobbles
export const Z = { country: 0.33, capital: 0.42, town: 0.75, townName: 1.15, cityLod: 0.9, icons: 2.2, live: 7, liveOff: 5, max: 160 };
/** the world tree's crown dims a name or marker under it, but never below this: a country must not vanish from the map */
const COVER_FLOOR = 0.45;
const CITY_HALF_H = ((CITY_WU / 2) * CH) / CW; // half the plan's height in world units


/** where the camera is looking: the trail from the world down to the street, each step with the name the player sees on the map */
export interface Locus { cont: number; contName: string; country: number; countryName: string; town: number; townName: string }

export class WorldScene extends Phaser.Scene {
  world!: WorldMap;
  game_!: Game;
  charSprite!: Phaser.GameObjects.Image;
  ring!: Phaser.GameObjects.Ellipse;
  charBox!: Phaser.GameObjects.Container;
  flagIcons: Phaser.GameObjects.Image[] = [];
  actorMarks = new Map<string, { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  countryLabels: Phaser.GameObjects.Text[] = [];
  branchMarks = new Map<number, Phaser.GameObjects.Rectangle>();
  townMarks: { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; capital: boolean; id: number; size: number; halo?: Phaser.GameObjects.Arc }[] = [];
  terrain!: TerrainRenderer;
  onCountryClick: (id: number) => void = () => {};
  onTownClick: (id: number) => void = () => {};
  onEnterTown: (id: number) => void = () => {};
  onCityChange: (townId: number) => void = () => {};
  onZoom: (level: string) => void = () => {};
  onLocate: (loc: Locus) => void = () => {};
  private lastLocus = '';
  onReady: () => void = () => {};
  follow = true;
  minZoom = 0.15;
  targetZoom = 0.15;
  private anchor = { x: 0, y: 0 };
  private lastTown = -1;
  private charRace = '';
  private clickedTown = false;
  private lastTownClick = { id: -1, at: 0 };
  private lastLodZoom = 0;
  private lastView = '';
  private lastDraw = 0;
  private cityImgs = new Map<number, { img: Phaser.GameObjects.Image; mip: number }>();
  private liveTown = -1;
  private livePending = false;

  constructor() { super('world'); }

  setGame(g: Game) {
    this.game_ = g;
    if (this.charSprite) { this.lastTown = -1; this.refresh(true); }
  }

  get W() { return this.world.w * TILE; }
  get H() { return this.world.h * TILE; }

  create() {
    this.world = generateWorld();
    this.terrain = new TerrainRenderer(document.getElementById('terrain') as HTMLCanvasElement);
    this.terrain.setLabels(CONTINENTS.map((c) => c.name));
    // towns read the real coast, and the map's own trees and fields stay out of the built-up ground
    setLandProbe((mx, my) => { const p = this.terrain.probe(mx, my); return { land: p.land, inland: p.inland }; });
    // roads between the towns: drawn on the map, and each town's streets run out to meet them
    const roads = buildRoads(this.world);
    const hw = CITY_WU / 2, hh = CITY_HALF_H, tw = CT * CITY_S;
    const links = new Map<number, { pts: number[]; w: number }[]>();
    const trimmed = roads.map((r) => {
      const ends: [number, number[]][] = [[r.a, r.pts], [r.b, (() => { const q: number[] = []; for (let i = r.pts.length - 2; i >= 0; i -= 2) q.push(r.pts[i], r.pts[i + 1]); return q; })()]];
      const cuts = ends.map(([id, pts]) => {
        const t = this.world.towns[id], cx = t.x * TILE + TILE / 2, cy = t.y * TILE + TILE / 2;
        const line: number[] = [CW / 2, CH / 2];
        let k = 0;
        for (; k * 2 < pts.length; k++) {
          const dx = pts[k * 2] - cx, dy = pts[k * 2 + 1] - cy;
          if (Math.abs(dx) >= hw || Math.abs(dy) >= hh) {
            line.push(dx / tw + CW / 2, dy / tw + CH / 2);
            break;
          }
          line.push(dx / tw + CW / 2, dy / tw + CH / 2);
        }
        if (r.kind === 'road' || r.kind === 'highway') { const l = links.get(id) || []; l.push({ pts: line, w: r.kind === 'highway' ? 3 : 2 }); links.set(id, l); }
        return k;
      });
      // the line the map draws with the stretch inside each end town's plan left out
      const n = r.pts.length / 2;
      const from = Math.min(n - 1, cuts[0]), to = Math.max(from, n - 1 - cuts[1]);
      const mu = (a: number[]) => a.map((v) => v / MU_TO_WU);
      return { kind: r.kind, full: mu(r.pts), cut: mu(r.pts.slice(from * 2, to * 2 + 2)) };
    });
    setTownLinks(links);
    this.terrain.setRoads(trimmed);
    this.terrain.setBorders(this.world.country, this.world.w, this.world.h, TILE / MU_TO_WU);
    this.terrain.setTownAreas(this.world.towns.map((t) => { const e = extentOf(t), k = (CT * CITY_S) / MU_TO_WU; return { x: (t.x * TILE + TILE / 2) / MU_TO_WU, y: (t.y * TILE + TILE / 2) / MU_TO_WU, rx: e.rx * k, ry: e.ry * k }; }));
    // the terrain canvas sits behind this one, so the Phaser canvas stays transparent
    // (Itim is used by the continent names; draw again once the web font has arrived)
    document.fonts?.load('30px Itim').then(() => { this.lastView = ''; });

    const font = 'Itim, Sarabun, sans-serif';
    for (const co of this.world.countries) {
      this.countryLabels.push(this.add.text(co.cx * TILE, co.cy * TILE, co.name.replace(co.gov, ''), {
        fontFamily: font, fontSize: '24px', color: '#fffbe8', stroke: '#1a120a', strokeThickness: 3, // a thin outline keeps Thai vowels and tone marks open; the shadow carries the contrast
      }).setOrigin(0.5, 0).setDepth(7).setShadow(0, 2, '#1a120a', 5, true, true));
      const col = BRANCH_COLOR[COUNTRY_DOCS.find((d) => d.code === co.code)?.bloc ?? ''];
      if (col !== undefined) { const l = this.countryLabels[this.countryLabels.length - 1]; this.branchMarks.set(co.id, this.add.rectangle(0, 0, l.width, 5, col).setOrigin(0.5, 0).setDepth(7)); }
    }
    for (const t of this.world.towns) {
      // the seat of the first dragon, Oran-Sal, is the greatest city of the world: its own icon, larger, in a halo of gold
      const throne = t.capital && this.world.countries[t.countryId].code === 'AZ-01';
      // the marker says what the town is known for, so two towns of one country read apart at a glance; a capital keeps a gold ring
      const icon = throne ? 'dragon' : townSpecialty(t.id, this.world.countries[t.countryId]).icon;
      const img = this.add.image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, iconTex(this, icon, 2)).setDepth(6).setInteractive({ useHandCursor: true });
      const halo = throne || t.capital ? this.add.circle(img.x, img.y, 24, 0xf2c94c, throne ? 0.28 : 0.2).setDepth(5.9) : undefined;
      halo?.setStrokeStyle(throne ? 3 : 2, 0xfff0a0, throne ? 0.7 : 0.8);
      const label = this.add.text(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, t.name, {
        fontFamily: font, fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 2.5,
      }).setOrigin(0.5, 0).setDepth(6).setShadow(0, 1.5, '#000000', 4, true, true);
      img.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() >= 8) return;
        this.clickedTown = true;
        // a second click on the same town within a moment goes in, as the eye expects
        if (this.lastTownClick.id === t.id && this.time.now - this.lastTownClick.at < 400) { this.lastTownClick = { id: -1, at: 0 }; this.onEnterTown(t.id); return; }
        this.lastTownClick = { id: t.id, at: this.time.now };
        this.onTownClick(t.id);
      });
      this.townMarks.push({ img, label, capital: t.capital, id: t.id, size: throne ? 36 : t.capital ? 22 : 16, halo });
    }
    this.setupTreeTowns();

    this.ring = this.add.ellipse(0, 0, 40, 14, 0xffe680, 0.6);
    this.tweens.add({ targets: this.ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 1400, repeat: -1 });
    this.charSprite = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    this.tweens.add({ targets: this.charSprite, y: -4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.charBox = this.add.container(0, 0, [this.ring, this.charSprite]).setDepth(8);

    const cam = this.cameras.main;
    // pixelArt turns on camera pixel rounding, which floors the scroll to whole world units: zoomed in 40× that is a 40 px jump per step
    // (a drag to the right never moves, a drag to the left leaps, and the zoom easing drifts). The map needs a free camera.
    cam.setRoundPixels(false);
    cam.setBounds(0, 0, this.W, this.H);
    this.minZoom = Math.min(this.scale.width / this.W, this.scale.height / this.H);
    cam.setZoom(this.minZoom);
    this.targetZoom = this.minZoom;
    cam.centerOn(this.W / 2, this.H / 2);

    // smooth zoom toward the cursor: the wheel sets a target, update() eases toward it (one continuous move from the continent to the street)
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.stopFollowing();
      this.anchor = { x: p.x, y: p.y };
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom * Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.002), this.minZoom, Z.max);
    });
    let dragging = false, sx = 0, sy = 0, moved = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; sx = p.x; sy = p.y; moved = 0; this.clickedTown = false; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) this.cityScene()?.hoverAt(p.x, p.y);
      if (!dragging || !p.isDown) return;
      cam.scrollX -= (p.x - sx) / cam.zoom; cam.scrollY -= (p.y - sy) / cam.zoom;
      moved += Math.abs(p.x - sx) + Math.abs(p.y - sy);
      sx = p.x; sy = p.y;
      if (moved > 6) this.stopFollowing();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      dragging = false;
      if (moved < 6 && !this.clickedTown) {
        const id = this.countryAt(p.x, p.y);
        if (id >= 0) { this.showHighlight(id); this.onCountryClick(id); }
      }
    });
    this.scale.on('resize', () => {
      this.minZoom = Math.min(this.scale.width / this.W, this.scale.height / this.H);
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

  showHighlight(id: number) {
    const { w, h, country } = this.world;
    this.terrain.setHighlight((i) => country[i] === id, w, h, TILE / MU_TO_WU);
    this.lastView = '';
  }

  // ---------- the world tree stands in front of the towns behind it ----------
  townCover: number[] = [];
  countryCover: number[] = [];
  /** 1 while the whole tree is drawn, fading to 0 as the camera goes in under it */
  private treeOpacity(z: number) { const k = Math.max(0, Math.min(1, (z - 1.3) / 1.3)); return 1 - k * k * (3 - 2 * k); }
  private treeCover(mx: number, my: number) { return this.terrain.treeCover(mx, my); }
  private setupTreeTowns() {
    const holes: { x: number; y: number }[] = [];
    this.townCover = this.world.towns.map((t) => {
      const mx = (t.x * 8 + 4) / MU_TO_WU, my = (t.y * 8 + 4) / MU_TO_WU;
      if (Math.abs(mx - 265) < 150 && Math.abs(my - 282) < 140) {
        // a town on, or among, the roots or the trunk: the roots open around it
        if ([[0, 0], [17, 0], [-17, 0], [0, 11], [0, -11], [12, 8], [-12, 8], [12, -8], [-12, -8]].some(([dx, dy]) => onTreeRoot(mx + dx, my + dy, 0))) holes.push({ x: mx, y: my });
      }
      return this.treeCover(mx, my);
    });
    this.countryCover = this.world.countries.map((c) => this.treeCover((c.cx * 8 + 4) / MU_TO_WU, (c.cy * 8 + 4) / MU_TO_WU));
    this.terrain.setRootHoles(holes);
  }

  // ---------- lands the story has reshaped ----------
  private fateSig = '';
  private countries() { return this.game_?.s.countries ?? this.world.countries; }

  /** reshape a continent (or the listed countries) by a story event, or restore it with null; towns and the world map redraw at once */
  setFate(scope: { continent?: number; ids?: number[] }, fate: Fate | null) {
    setFate(this.countries(), scope, fate);
    this.refreshFates();
  }

  /** put the tint of each fated land on the world map and rebuild the towns that changed (called when the set of fates changes) */
  private refreshFates() {
    const cs = this.countries(), { w, h, country } = this.world;
    this.fateSig = cs.map((c) => fateOf(c) ?? '').join('|');
    const regions = (Object.keys(FATES) as Fate[]).flatMap((f) => {
      const ids = new Set(cs.filter((c) => fateOf(c) === f).map((c) => c.id));
      return ids.size ? [{ inside: (i: number) => ids.has(country[i]), tint: FATES[f].tint }] : [];
    });
    this.terrain.setFates(regions, w, h, TILE / MU_TO_WU);
    this.cityImgs.forEach((c, id) => { c.img.destroy(); for (const m of [1, 2, 4, 8]) { const k = this.townTex(id, m); if (this.textures.exists(k)) this.textures.remove(k); } });
    this.cityImgs.clear();
    this.stopLive();
    this.lastView = '';
  }

  level(): string {
    const z = this.cameras.main.zoom;
    if (z >= Z.live) return 'ในเมือง';
    if (z >= 2) return 'เมือง';
    if (z >= Z.town) return 'ประเทศ';
    if (z >= Z.country) return 'ทวีป';
    return 'โลก';
  }

  // what is visible at the current zoom; sizes stay constant on screen (scale = wanted px / (texture px × zoom))
  updateLod() {
    const z = this.cameras.main.zoom;
    this.lastLodZoom = z;
    const townNames = z >= Z.townName;
    this.countryLabels.forEach((l, i) => {
      const co = this.world.countries[i];
      l.setVisible(z >= Z.country && z < Z.icons).setScale(16 / (24 * z)).setAlpha((townNames ? 0.75 : 1) * Math.max(COVER_FLOOR, 1 - (this.countryCover[co.id] ?? 0) * this.treeOpacity(z)));
      l.setPosition(co.cx * TILE + TILE / 2, co.cy * TILE + (townNames ? -36 / z : 12 / z)).setOrigin(0.5, townNames ? 1 : 0);
      this.branchMarks.get(co.id)?.setVisible(l.visible).setAlpha(l.alpha).setScale(l.scaleX).setPosition(l.x, l.y + (townNames ? 2 / z : l.displayHeight + 1 / z));
    });
    for (const m of this.townMarks) {
      const show = m.capital ? z >= Z.capital : z >= Z.town;
      const hide = Math.max(COVER_FLOOR, 1 - this.townCover[m.id] * this.treeOpacity(z)); // behind the tree's crown or trunk: dimmed, never gone
      m.img.setVisible(show && z < Z.icons && hide > 0.05).setScale(m.size / (24 * z)).setAlpha(hide);
      m.halo?.setVisible(show && z < Z.icons && hide > 0.05).setScale((m.size * 1.7) / (24 * z)).setAlpha(m.size === 36 ? 0.22 + 0.08 * Math.sin(this.time.now / 500) : 0.5 * hide);
      m.label.setVisible(show && townNames && z < Z.live && hide > 0.05).setAlpha(hide).setScale(13 / (18 * z)).setY(m.img.y + (z >= Z.icons ? -CITY_HALF_H * 0.9 : 12 / z));
    }
    this.flagIcons.forEach((t) => t.setScale(18 / (24 * z)));
    this.actorMarks.forEach((m, id) => { m.img.setScale((id.startsWith('caravan') ? 16 : 24) / (24 * z)); m.label.setScale(12 / (16 * z)).setVisible(z >= Z.country).setY(m.img.y + 14 / z); });
    if (this.charBox) this.charBox.setScale(30 / (32 * z)).setVisible(!(this.game_ && this.liveTown === this.game_.c.townId));
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
      if (this.follow && this.cameras.main.zoom < Z.cityLod) this.cameras.main.pan(tx, ty, 900, 'Sine.easeInOut');
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
    this.stopFollowing();
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom * f, this.minZoom, Z.max);
  }

  /** fly toward a town in one smooth move (pan while zooming), no cuts */
  flyToTown(townId: number, zoom = 16) {
    const t = this.world.towns[townId];
    this.follow = false;
    this.cameras.main.pan(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, 1800, 'Sine.easeInOut');
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Math.max(this.targetZoom, zoom);
  }

  /** back out to the country view */
  flyOut(zoom = 1.1) {
    this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Math.min(this.targetZoom, zoom);
  }

  /** the player took the camera: nothing may move it again until they ask (target button) */
  stopFollowing() {
    this.follow = false;
    (this.scene.get('city') as CityScene).follow = false;
  }

  cityScene(): CityScene | null {
    const c = this.scene.get('city') as CityScene | null;
    return c && c.sys && c.sys.isActive() && this.liveTown >= 0 && c.town ? c : null;
  }

  private townTex(id: number, mip: number) { return mip === 1 ? `city_${id}` : `city_${id}_${mip}`; }

  /** the towns in view appear as built-up plans on the map; the one under the camera, close enough, comes alive */
  private updateCities() {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const mx = cam.midPoint.x, my = cam.midPoint.y;
    if (z < Z.cityLod) {
      this.cityImgs.forEach((c) => c.img.setVisible(false));
      this.stopLive();
      return;
    }
    const hw = CITY_WU / 2, vw = cam.width / z / 2 + hw, vh = cam.height / z / 2 + CITY_HALF_H;
    const near: { id: number; d: number }[] = [];
    for (const t of this.world.towns) {
      const dx = t.x * TILE + TILE / 2 - mx, dy = t.y * TILE + TILE / 2 - my;
      if (Math.abs(dx) < vw && Math.abs(dy) < vh) near.push({ id: t.id, d: dx * dx + dy * dy });
    }
    near.sort((a, b) => a.d - b.d);
    const show = new Set<number>();
    let built = 0;
    const r = 1 / (CITY_S * z); // texture pixels per screen pixel
    const mip = r >= 7 ? 8 : r >= 3.5 ? 4 : r >= 1.8 ? 2 : 1;
    for (const n of near.slice(0, 6)) {
      const t = this.world.towns[n.id];
      let rec = this.cityImgs.get(n.id);
      if (!rec) {
        if (built >= 1) continue; // one new plan per frame keeps the camera moving
        built++;
        const data = getCity(t, this.game_?.s.countries[t.countryId] || this.world.countries[t.countryId]);
        const key = `city_${n.id}`;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, data.cv);
        rec = { img: this.add.image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, key).setDepth(3), mip: 1 };
        this.cityImgs.set(n.id, rec);
      }
      if (rec.mip !== mip) {
        const key = this.townTex(n.id, mip);
        if (!this.textures.exists(key)) {
          const src = this.textures.get(`city_${n.id}`).getSourceImage() as HTMLCanvasElement;
          const cv = document.createElement('canvas');
          cv.width = Math.ceil(src.width / mip); cv.height = Math.ceil(src.height / mip);
          const c2 = cv.getContext('2d')!; c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high'; c2.drawImage(src, 0, 0, cv.width, cv.height);
          const tex = this.textures.addCanvas(key, cv);
          tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        rec.img.setTexture(key); rec.mip = mip;
      }
      // a town behind the world tree is seen through it: its plan comes out as the tree fades with the zoom
      const cov = this.treeCover((t.x * 8 + 4) / MU_TO_WU, (t.y * 8 + 4) / MU_TO_WU), fa = this.treeOpacity(z);
      rec.img.setScale(CITY_S * mip).setVisible(true).setAlpha(Math.min(1, (z - Z.cityLod) / 0.5) * (1 - cov * fa));
      show.add(n.id);
    }
    this.cityImgs.forEach((c, id) => { if (!show.has(id)) c.img.setVisible(false); });
    if (this.cityImgs.size > 12) {
      for (const [id, c] of this.cityImgs) {
        if (show.has(id)) continue;
        c.img.destroy(); this.cityImgs.delete(id);
        for (const m of [1, 2, 4, 8]) { const k = this.townTex(id, m); if (this.textures.exists(k)) this.textures.remove(k); }
        if (this.cityImgs.size <= 8) break;
      }
    }
    // life: starts when we are close enough over one town, ends when we leave it
    const first = near[0];
    if (first) {
      const t = this.world.towns[first.id];
      const inside = Math.abs(t.x * TILE + TILE / 2 - mx) < hw * 1.05 && Math.abs(t.y * TILE + TILE / 2 - my) < CITY_HALF_H * 1.05;
      // not while the camera is still flying (zooming or panning): a town we only pass over should not wake up
      const flying = Math.abs(z - this.targetZoom) / z > 0.02 || cam.panEffect.isRunning;
      if (this.liveTown !== first.id && z >= Z.live && inside && !flying && this.cityImgs.has(first.id)) this.startLive(first.id);
    }
    if (this.liveTown >= 0) {
      const t = this.world.towns[this.liveTown];
      const gone = Math.abs(t.x * TILE + TILE / 2 - mx) > hw * 1.7 || Math.abs(t.y * TILE + TILE / 2 - my) > CITY_HALF_H * 1.7;
      if (z < Z.liveOff || gone) this.stopLive();
    }
    this.syncLive();
  }

  private startLive(id: number) {
    if (this.livePending) return;
    this.stopLive();
    this.liveTown = id;
    this.livePending = true;
    this.scene.launch('city', { townId: id });
    this.time.delayedCall(60, () => { this.livePending = false; });
    this.onCityChange(id);
  }

  private stopLive() {
    if (this.liveTown < 0) return;
    this.liveTown = -1;
    this.scene.stop('city');
    this.onCityChange(-1);
    this.updateLod();
  }

  /** the living city's camera is the world camera, scaled and re-centred */
  private syncLive() {
    const city = this.cityScene();
    if (!city || !city.plan) return;
    const cam = this.cameras.main;
    const t = this.world.towns[this.liveTown];
    const tx = t.x * TILE + TILE / 2, ty = t.y * TILE + TILE / 2;
    // following the protagonist: drift the world camera toward them
    if (city.follow && city.hero) {
      const wx = tx + (city.hero.root.x - (CW * CT) / 2) * CITY_S, wy = ty + (city.hero.root.y - 20 - (CH * CT) / 2) * CITY_S;
      cam.centerOn(cam.midPoint.x + (wx - cam.midPoint.x) * 0.06, cam.midPoint.y + (wy - cam.midPoint.y) * 0.06);
    }
    cam.preRender();
    city.syncCamera(cam.zoom * CITY_S, (cam.midPoint.x - tx) / CITY_S + (CW * CT) / 2, (cam.midPoint.y - ty) / CITY_S + (CH * CT) / 2);
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
    if (this.countries().some((c) => (fateOf(c) ?? '') !== '') || this.fateSig.replace(/\|/g, '') !== '') { const sig = this.countries().map((c) => fateOf(c) ?? '').join('|'); if (sig !== this.fateSig) this.refreshFates(); }
    this.updateCities();
    this.updateLocus();
    this.drawTerrain(_t);
  }

  /** the continent, country and town under the middle of the screen (a step is -1 until the zoom is deep enough to name it) */
  private updateLocus() {
    const cam = this.cameras.main, z = cam.zoom, mx = cam.midPoint.x, my = cam.midPoint.y;
    const { w, h, country } = this.world;
    const tx = Math.floor(mx / TILE), ty = Math.floor(my / TILE);
    let cid = tx >= 0 && ty >= 0 && tx < w && ty < h ? country[ty * w + tx] : -1;
    if (cid < 0) { // over the sea or a gap: the nearest country, if it is close
      let bd = 40 * TILE;
      for (const c of this.world.countries) { const d = Math.hypot(c.cx * TILE - mx, c.cy * TILE - my); if (d < bd) { bd = d; cid = c.id; } }
    }
    const co = cid >= 0 ? this.world.countries[cid] : null;
    let town = -1;
    if (co && z >= 2) {
      let bd = Infinity;
      for (const t of this.world.towns) {
        const dx = t.x * TILE + TILE / 2 - mx, dy = t.y * TILE + TILE / 2 - my;
        if (Math.abs(dx) < CITY_WU / 2 && Math.abs(dy) < CITY_HALF_H && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; town = t.id; }
      }
    }
    const loc: Locus = {
      cont: co && z >= Z.country ? co.continent : -1, contName: co ? CONTINENTS[co.continent].name : '',
      country: co && z >= Z.town ? co.id : -1, countryName: co ? co.name.replace(co.gov, '') : '',
      town, townName: town >= 0 ? this.world.towns[town].name : '',
    };
    const sig = `${loc.cont}|${loc.country}|${loc.town}`;
    if (sig !== this.lastLocus) { this.lastLocus = sig; this.onLocate(loc); }
  }

  /** the breadcrumb's steps: fly to the whole world, to a continent, or to a country */
  flyToWorld() { this.stopFollowing(); this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 }; this.targetZoom = this.minZoom; this.cameras.main.pan(this.W / 2, this.H / 2, 1200, 'Sine.easeInOut'); }
  flyToContinent(i: number) {
    this.stopFollowing(); this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = Phaser.Math.Clamp(0.5, this.minZoom, Z.max);
    this.cameras.main.pan(CONT_LABELS[i].x * MU_TO_WU, CONT_LABELS[i].y * MU_TO_WU, 1200, 'Sine.easeInOut');
  }
  flyToCountry(id: number) {
    const c = this.world.countries[id];
    this.stopFollowing(); this.anchor = { x: this.scale.width / 2, y: this.scale.height / 2 };
    this.targetZoom = 1.05;
    this.cameras.main.pan(c.cx * TILE + TILE / 2, c.cy * TILE + TILE / 2, 1200, 'Sine.easeInOut');
  }

  // re-draw the terrain whenever the camera moves, and ~15×/s otherwise so clouds, smoke and water keep drifting
  private drawTerrain(t: number) {
    const cam = this.cameras.main;
    cam.preRender();
    const key = `${cam.midPoint.x.toFixed(2)},${cam.midPoint.y.toFixed(2)},${cam.zoom.toFixed(5)},${cam.width}x${cam.height}`;
    if (key === this.lastView && t - this.lastDraw < 66) return;
    this.lastView = key; this.lastDraw = t;
    this.terrain.render({ cx: cam.midPoint.x, cy: cam.midPoint.y, zoom: cam.zoom, w: cam.width, h: cam.height }, t / 1000);
  }
}
