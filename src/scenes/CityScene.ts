import Phaser from 'phaser';
import { RNG, hashString } from '../sim/rng';
import { generateWorld, RELIGIONS, type Town } from '../sim/worldgen';
import { raceById } from '../data/races';
import { MONSTERS } from '../data/lore';
import { makeName } from '../sim/character';
import type { Game } from '../sim/game';
import { iconTex, raceTex } from './sprites';
import { relRole, goalText } from '../sim/society';
import { lookFor, heroLook, personFrames, cradleTex, POSE, WALK, CARRY_WALK, JOB_WORK, type Look } from './people';
import { townLifeEvent, EMOTE, TOWN_PLACES, type LifeKind } from '../data/townlife';
import { NPC_JOBS, NPC_GOALS, npcJob, type Place, type NpcJob } from '../data/npclife';
import { pickTownJob, townSpecialty } from '../sim/locale';
import { DISASTERS } from '../data/disasters';
import type { Specialty } from '../data/npclife';

const T = 16;
const CW = 48, CH = 30;
enum Tile { Ground, Road, Plaza, Building, Water, Tree, Wall, Dock, Field, Grave }

const GROUND: Record<string, number> = { temperate: 0x6aa84f, tropical: 0x3c8f45, desert: 0xe3cc8a, frozen: 0xe6eef4, volcanic: 0x6b5446, islands: 0x8cc860 };
const ROOF: Record<string, number[]> = {
  temperate: [0xb04a3a, 0x8a5a3a, 0x5a6a8a], tropical: [0xc8a050, 0xa88040], desert: [0xd8b878, 0xc8a060], frozen: [0x5a4a3a, 0x6a5a4a],
  volcanic: [0x4a3a3a, 0x3a3030], islands: [0x4a7ab0, 0xe0e0e0, 0x3a9ab0],
};
const TEMPLE_ICON: Record<string, string> = { light: 'bless', dragon: 'dragon', sea: 'river', moon: 'moon', war: 'weapon', demon: 'demon', naga: 'snake', nature: 'leaf', ancestor: 'death' };
const DAY_LEN = 150; // seconds of real time for a full day in town

interface Pt { x: number; y: number }
interface BuildingRec { x: number; y: number; w: number; h: number; kind: string; roof: number }
interface Anim { frames: number[]; fps: number; fx?: 'spark' | 'dust' | 'chip' | 'steam' | 'splash' | 'sparkle' | 'note' | 'halo' | 'none' }

// A person in town: a sprite that walks with a step cycle, works with its hands and goes home at night
interface Person {
  id?: number; name: string; race: string; role: string; look: Look;
  img: Phaser.GameObjects.Image; root: Phaser.GameObjects.Image | Phaser.GameObjects.Container; hero?: boolean;
  job?: NpcJob; skill?: number; goal?: string;
  state: 'idle' | 'move' | 'act' | 'locked'; wait: number; actT: number; frame: number; carry: boolean; speed: number; moveSpeed?: number;
  to?: Pt; then?: () => void; act?: Anim; actEnd?: number; fx: number; tag: number; asleep: boolean; goesHome: boolean; frozen?: boolean;
  mark?: Phaser.GameObjects.Image; onRemove?: () => void;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export class CityScene extends Phaser.Scene {
  game_: Game | null = null;
  town!: Town;
  grid!: Uint8Array;
  walk: [number, number][] = [];
  npcs: Person[] = [];
  hero: Person | null = null;
  mother: Person | null = null;
  heroForm = '';
  spots!: Record<Place, Pt[]>;
  buildings: BuildingRec[] = [];
  spec!: Specialty;
  shade!: Phaser.GameObjects.Rectangle;
  flood!: Phaser.GameObjects.Rectangle;
  glows: Phaser.GameObjects.Ellipse[] = [];
  ufo?: Phaser.GameObjects.Image;
  beam?: Phaser.GameObjects.Triangle;
  dayT = 0;
  nightAmt = 0;
  fxT = 0;
  monster: Phaser.GameObjects.Image | null = null;
  rng!: RNG;
  kind: 'grid' | 'river' | 'coast' | 'village' = 'grid';
  style: 'gable' | 'dome' | 'aframe' | 'hut' | 'tree' | 'stone' = 'gable';
  onBack: () => void = () => {};
  onNews: (text: string) => void = () => {};
  follow = true;
  private newsTimer?: Phaser.Time.TimerEvent;

  constructor() { super('city'); }

  init(data: { townId: number }) {
    this.town = generateWorld().towns[data.townId];
    this.npcs = [];
    this.walk = [];
    this.hero = null;
    this.mother = null;
    this.heroForm = '';
    this.monster = null;
    this.ufo = undefined;
    this.beam = undefined;
    this.glows = [];
  }

  setGame(g: Game) { this.game_ = g; }

  get country() { return (this.game_?.s.countries || generateWorld().countries)[this.town.countryId]; }

  create() {
    this.rng = new RNG(hashString('town' + this.town.id));
    const climate = this.country.climate;
    const major = this.country.races[0].race;
    // building style follows the people who live here and the climate
    this.style = climate === 'desert' ? 'dome' : climate === 'frozen' ? 'aframe' : ['orc', 'beast'].includes(major) ? 'hut' : ['elf', 'fae'].includes(major) ? 'tree' : ['dwarf', 'dragonkin'].includes(major) || climate === 'volcanic' ? 'stone' : 'gable';
    this.grid = new Uint8Array(CW * CH);
    const buildings = this.layout(climate);
    this.buildings = buildings;
    this.spec = townSpecialty(this.town.id, this.country);
    this.computeSpots(buildings);
    this.drawTexture(climate, buildings);
    this.add.image(0, 0, `city_${this.town.id}`).setOrigin(0).setDepth(0);

    // temple of the land's faith
    const temple = buildings.find((b) => b.kind === 'temple');
    const relIcon = TEMPLE_ICON[this.country.religion];
    if (temple && relIcon) {
      const ic = this.add.image((temple.x + temple.w / 2) * T, temple.y * T - 4, iconTex(this, relIcon, 2)).setDepth(3);
      this.tweens.add({ targets: ic, y: ic.y - 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const cam = this.cameras.main;
    const W = CW * T, H = CH * T;
    cam.setBounds(0, 0, W, H);
    cam.setBackgroundColor(hex(GROUND[climate]));
    const fit = Math.max(this.scale.width / W, this.scale.height / H);
    cam.setZoom(fit * 1.15);
    cam.centerOn(W / 2, H / 2);

    // the light of the hour, flood water, and window glow at night all sit above the streets
    this.dayT = DAY_LEN * (0.18 + this.rng.next() * 0.3);
    this.shade = this.add.rectangle(0, 0, W, H, 0x101840, 0).setOrigin(0).setDepth(50);
    this.flood = this.add.rectangle(0, H * 0.55, W, H * 0.45, 0x3f82b8, 0).setOrigin(0).setDepth(49);
    for (const b of buildings) this.glows.push(this.add.ellipse((b.x + b.w / 2) * T, (b.y + b.h) * T - 4, 34, 22, 0xffd070, 0).setDepth(2));
    this.spawnNpcs();
    this.time.delayedCall(30, () => this.refresh());

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const minZ = Math.max(this.scale.width / W, this.scale.height / H);
      if (dy > 0 && cam.zoom <= minZ + 0.01) { this.onBack(); return; } // zoom out past the town → world map
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.88 : 1.14), minZ, 4));
    });
    let sx = 0, sy = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { sx = p.x; sy = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.x - sx) / cam.zoom; cam.scrollY -= (p.y - sy) / cam.zoom;
      sx = p.x; sy = p.y;
      this.follow = false;
    });
    this.newsTimer = this.time.addEvent({ delay: 3500, loop: true, callback: () => this.townLife() });
    this.add.rectangle(0, 0, 1, 1, 0, 0); // keeps the display list non-empty during setup
    this.events.once('shutdown', () => this.newsTimer?.remove());
  }

  // Crisp small text: draw at 4× the size and scale down (setResolution is unreliable on the canvas renderer)
  txt(x: number, y: number, text: string, o: { fontFamily: string; fontSize: number; color: string; stroke?: string; strokeThickness?: number; backgroundColor?: string; pad?: number; wrap?: number }) {
    const k = 4;
    return this.add.text(x, y, text, {
      fontFamily: o.fontFamily, fontSize: `${o.fontSize * k}px`, color: o.color, stroke: o.stroke, strokeThickness: (o.strokeThickness || 0) * k,
      backgroundColor: o.backgroundColor, padding: o.pad ? { x: o.pad * k, y: (o.pad * k) / 1.5 } : undefined, wordWrap: o.wrap ? { width: o.wrap * k } : undefined,
    }).setScale(1 / k);
  }

  // ---------- town layout ----------
  layout(climate: string) {
    const g = this.grid;
    const set = (x: number, y: number, v: Tile) => { if (x >= 0 && y >= 0 && x < CW && y < CH) g[y * CW + x] = v; };
    const get = (x: number, y: number) => (x < 0 || y < 0 || x >= CW || y >= CH ? Tile.Wall : g[y * CW + x]);
    // which kind of town: on the coast, on a river, a small village, or a planned grid
    const W0 = generateWorld();
    let nearSea = climate === 'islands';
    for (let dy = -3; dy <= 3 && !nearSea; dy++) for (let dx = -3; dx <= 3; dx++) { const x = this.town.x + dx, y = this.town.y + dy; if (x >= 0 && y >= 0 && x < W0.w && y < W0.h && W0.country[y * W0.w + x] < 0) { nearSea = true; break; } }
    this.kind = nearSea ? 'coast' : this.town.size === 1 && !this.town.capital ? 'village' : this.rng.chance(0.4) ? 'river' : 'grid';
    const coast = this.kind === 'coast';
    const cy = Math.floor(CH / 2) - 1, cx = Math.floor(CW / 2) - 1;
    if (coast) for (let y = CH - 6; y < CH; y++) for (let x = 0; x < CW; x++) set(x, y, Tile.Water);
    if (this.kind === 'river') {
      // a meandering river with bridges where the roads cross it
      let rx = this.rng.int(CW * 0.62, CW * 0.78);
      for (let y = 0; y < CH; y++) { rx += this.rng.int(-1, 1); rx = Math.max(CW * 0.55, Math.min(CW - 4, rx)); set(rx, y, Tile.Water); set(rx + 1, y, Tile.Water); set(rx + 2, y, Tile.Water); }
    }
    for (let x = 0; x < CW; x++) for (const y of [cy, cy + 1]) set(x, y, get(x, y) === Tile.Water ? (coast && y >= CH - 6 ? Tile.Water : Tile.Dock) : Tile.Road);
    for (let y = 0; y < CH; y++) for (const x of [cx, cx + 1]) set(x, y, get(x, y) === Tile.Water ? Tile.Dock : Tile.Road);
    if (this.kind === 'village') {
      // winding dirt paths and farmland around a small square
      for (let k = 0; k < 4; k++) {
        let x = cx, y = cy;
        for (let s = 0; s < 40; s++) { x += this.rng.int(-1, 1); y += this.rng.int(-1, 1); x = Math.max(1, Math.min(CW - 2, x)); y = Math.max(1, Math.min(CH - 2, y)); if (get(x, y) === Tile.Ground) set(x, y, Tile.Road); }
      }
      for (let f = 0; f < 7; f++) {
        const fx = this.rng.int(2, CW - 10), fy = this.rng.int(2, CH - 8), fw = this.rng.int(4, 8), fh = this.rng.int(3, 5);
        for (let x = fx; x < fx + fw; x++) for (let y = fy; y < fy + fh; y++) if (get(x, y) === Tile.Ground) set(x, y, Tile.Field);
      }
    } else if (this.town.size >= 2) {
      for (let x = 6; x < CW - 6; x++) { set(x, 7, Tile.Road); if (!coast) set(x, CH - 8, Tile.Road); }
      for (let y = 5; y < CH - (coast ? 7 : 5); y++) { set(10, y, Tile.Road); set(CW - 11, y, Tile.Road); }
    }
    const pw = this.kind === 'village' ? 3 : 5;
    for (let y = cy - 3; y <= cy + 4; y++) for (let x = cx - pw; x <= cx + pw + 1; x++) if (get(x, y) !== Tile.Water) set(x, y, Tile.Plaza);
    if (this.town.capital) {
      for (let x = 0; x < CW; x++) { if (get(x, 0) !== Tile.Road) set(x, 0, Tile.Wall); if (!coast && get(x, CH - 1) !== Tile.Road) set(x, CH - 1, Tile.Wall); }
      for (let y = 0; y < (coast ? CH - 6 : CH); y++) { if (get(0, y) !== Tile.Road) set(0, y, Tile.Wall); if (get(CW - 1, y) !== Tile.Road) set(CW - 1, y, Tile.Wall); }
    }
    const buildings: { x: number; y: number; w: number; h: number; kind: string; roof: number }[] = [];
    const nearRoad = (x: number, y: number, w: number, h: number) => {
      for (let i = x - 1; i <= x + w; i++) for (let j = y - 1; j <= y + h + 1; j++) { const t = get(i, j); if (t === Tile.Road || t === Tile.Plaza) return true; }
      return false;
    };
    const free = (x: number, y: number, w: number, h: number) => {
      for (let i = x - 1; i <= x + w; i++) for (let j = y - 1; j <= y + h; j++) if (get(i, j) !== Tile.Ground) return false;
      return true;
    };
    const want = this.kind === 'village' ? 8 : [10, 18, 30][this.town.size - 1];
    const kinds = ['temple', 'tavern', 'smithy', 'guild'];
    for (let tries = 0; buildings.length < want && tries < 3000; tries++) {
      const special = buildings.length < kinds.length && buildings.length < this.town.size + 1;
      const w = special ? this.rng.int(5, 7) : this.rng.int(3, 5);
      const h = special ? this.rng.int(4, 5) : this.rng.int(3, 4);
      const x = this.rng.int(1, CW - w - 1), y = this.rng.int(1, CH - h - 1);
      if (!free(x, y, w, h) || !nearRoad(x, y, w, h)) continue;
      if (special && Math.hypot(x - cx, y - cy) > 16) continue;
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) set(i, j, Tile.Building);
      const pal = ROOF[climate] || ROOF.temperate;
      buildings.push({ x, y, w, h, kind: special ? kinds[buildings.length] : 'house', roof: this.rng.pick(pal) });
    }
    // a graveyard for towns that honour (or fear) their dead
    const religion = this.country.religion;
    if (['ancestor', 'light', 'demon', 'none'].includes(religion) || this.country.flags.includes('undead_rising')) {
      for (let tries = 0; tries < 200; tries++) {
        const gx = this.rng.int(2, CW - 8), gy = this.rng.int(2, CH - 6);
        if (!free(gx, gy, 5, 3)) continue;
        for (let x = gx; x < gx + 5; x++) for (let y = gy; y < gy + 3; y++) set(x, y, Tile.Grave);
        break;
      }
    }
    const treeChance = this.style === 'tree' ? 0.22 : this.kind === 'village' ? 0.12 : 0.07;
    for (let i = 0; i < CW * CH; i++) if (g[i] === Tile.Ground && this.rng.chance(treeChance)) g[i] = Tile.Tree;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const t = get(x, y);
      if (t === Tile.Road || t === Tile.Plaza || t === Tile.Dock) this.walk.push([x, y]);
    }
    return buildings;
  }

  drawTexture(climate: string, buildings: BuildingRec[]) {
    const key = `city_${this.town.id}`;
    if (this.textures.exists(key)) return;
    const cv = document.createElement('canvas');
    cv.width = CW * T; cv.height = CH * T;
    const x2 = cv.getContext('2d')!;
    const r = new RNG(hashString('paint' + this.town.id));
    const fill = (c: number | string, x: number, y: number, w: number, h: number) => { x2.fillStyle = typeof c === 'number' ? hex(c) : c; x2.fillRect(x, y, w, h); };
    const shadeC = (c: number, f: number) => ((Math.min(255, ((c >> 16) & 255) * f) << 16) | (Math.min(255, ((c >> 8) & 255) * f) << 8) | Math.min(255, (c & 255) * f)) >>> 0;
    const ground = GROUND[climate] || GROUND.temperate;
    const cobble = this.town.capital || this.town.size >= 2;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const t = this.grid[y * CW + x];
      const X = x * T, Y = y * T;
      fill(ground, X, Y, T, T);
      for (let k = 0; k < 4; k++) fill(shadeC(ground, r.float(0.85, 1.12)), X + r.int(0, 14), Y + r.int(0, 14), 2, 2);
      if (t === Tile.Road) {
        fill(cobble ? 0x9a948a : 0xa88a64, X, Y, T, T);
        for (let k = 0; k < 5; k++) fill(cobble ? 0x7e786e : 0x8a6e4e, X + r.int(0, 13), Y + r.int(0, 13), 3, 2);
      } else if (t === Tile.Plaza) {
        fill(0xb8b0a0, X, Y, T, T);
        fill(0xa49c8c, X, Y, T, 1); fill(0xa49c8c, X, Y, 1, T);
      } else if (t === Tile.Water) {
        fill(0x3f82b8, X, Y, T, T);
        if ((x + y) % 3 === 0) fill(0x6fb0d8, X + r.int(0, 8), Y + r.int(2, 12), 6, 1);
      } else if (t === Tile.Dock) {
        fill(0x3f82b8, X, Y, T, T); fill(0x8a5a3a, X + 1, Y, T - 2, T);
        for (let k = 0; k < T; k += 4) fill(0x6a4228, X + 1, Y + k, T - 2, 1);
      } else if (t === Tile.Wall) {
        fill(0x8a8478, X, Y, T, T); fill(0x6a645a, X, Y + 7, T, 2); fill(0x6a645a, X + 7, Y, 2, 7); fill(0x5a544a, X, Y + T - 2, T, 2);
      } else if (t === Tile.Field) {
        fill(0x8a6a3a, X, Y, T, T);
        for (let k = 2; k < T; k += 5) fill(climate === 'desert' ? 0xc8a050 : 0x6aa84f, X, Y + k, T, 2);
      } else if (t === Tile.Grave) {
        fill(shadeC(ground, 0.85), X, Y, T, T);
        if ((x + y) % 2 === 0) { fill(0x9aa0a8, X + 5, Y + 4, 6, 9); fill(0x7a8088, X + 5, Y + 11, 6, 2); fill(0x6a7078, X + 7, Y + 6, 2, 4); }
      } else if (t === Tile.Tree) {
        if (climate === 'desert') { fill(0x4a8a3a, X + 6, Y + 2, 4, 12); fill(0x4a8a3a, X + 2, Y + 6, 4, 2); fill(0x4a8a3a, X + 10, Y + 4, 4, 2); }
        else if (climate === 'frozen') { fill(0x2e5a3e, X + 4, Y + 2, 8, 10); fill(0xffffff, X + 4, Y + 2, 8, 2); fill(0x5e3a26, X + 7, Y + 12, 2, 3); }
        else if (climate === 'volcanic') { fill(0x3a2a22, X + 7, Y + 4, 2, 10); fill(0x3a2a22, X + 4, Y + 5, 3, 1); fill(0x3a2a22, X + 9, Y + 7, 3, 1); }
        else if (climate === 'tropical' || climate === 'islands') { fill(0x8a5a3a, X + 7, Y + 6, 2, 9); fill(0x2e8a3e, X + 2, Y + 2, 12, 4); fill(0x3eaa4e, X + 4, Y + 1, 8, 2); }
        else { fill(0x5e3a26, X + 7, Y + 10, 2, 5); fill(0x2e7a3e, X + 3, Y + 2, 10, 9); fill(0x4aa04e, X + 5, Y + 3, 4, 3); }
      }
    }
    // fountain or statue at the plaza centre
    const px = (CW / 2) * T, py = (CH / 2) * T;
    if (this.town.capital) { fill(0x8a8478, px - 10, py - 4, 20, 14); fill(0xd8d0c0, px - 5, py - 18, 10, 16); fill(0xf2c94c, px - 3, py - 22, 6, 5); }
    else if (climate === 'desert') { x2.fillStyle = '#5aa0ea'; x2.beginPath(); x2.ellipse(px, py, 22, 12, 0, 0, Math.PI * 2); x2.fill(); fill(0x8a5a3a, px + 16, py - 22, 2, 14); fill(0x2e8a3e, px + 10, py - 26, 14, 5); }
    else if (this.kind === 'village') { fill(0x7e786e, px - 6, py - 6, 12, 12); fill(0x3f82b8, px - 4, py - 4, 8, 8); fill(0x8a5a3a, px - 7, py - 12, 2, 8); fill(0x8a5a3a, px + 5, py - 12, 2, 8); fill(0x8a5a3a, px - 7, py - 13, 14, 2); }
    else { x2.fillStyle = '#7e786e'; x2.beginPath(); x2.arc(px, py, 14, 0, Math.PI * 2); x2.fill(); x2.fillStyle = '#5aa0ea'; x2.beginPath(); x2.arc(px, py, 10, 0, Math.PI * 2); x2.fill(); fill(0xc9ccd6, px - 2, py - 6, 4, 6); }
    // buildings: roof seen from above, front wall with door and windows
    const wallC: Record<string, number> = { desert: 0xe8d4a8, frozen: 0x8a6a4a, volcanic: 0x5a4a44, tropical: 0xb89a6a, islands: 0xf0eadc, temperate: 0xd8c8a8 };
    for (const b of buildings) {
      const X = b.x * T, Y = b.y * T, Wd = b.w * T, Ht = b.h * T;
      const roof = b.kind === 'temple' ? 0xf0e0b0 : b.roof;
      fill(0x000000, X + 3, Y + 4, Wd, Ht); // shadow
      const style = b.kind === 'temple' ? 'gable' : this.style;
      const wall = style === 'stone' ? 0x7a7068 : wallC[climate] || wallC.temperate;
      if (style === 'dome') {
        fill(wall, X, Y + 4, Wd, Ht - 4);
        x2.fillStyle = hex(shadeC(wall, 1.08)); x2.beginPath(); x2.ellipse(X + Wd / 2, Y + Ht / 2, Wd / 2.4, (Ht - T) / 1.8, 0, 0, Math.PI * 2); x2.fill();
        fill(shadeC(wall, 0.85), X, Y + Ht - T, Wd, 2);
      } else if (style === 'hut') {
        x2.fillStyle = hex(0xa88a4a); x2.beginPath(); x2.ellipse(X + Wd / 2, Y + Ht / 2, Wd / 2, Ht / 2, 0, 0, Math.PI * 2); x2.fill();
        x2.fillStyle = hex(0x8a6a32); x2.beginPath(); x2.ellipse(X + Wd / 2, Y + Ht / 2, Wd / 3, Ht / 3, 0, 0, Math.PI * 2); x2.fill();
        fill(0x5a3a1a, X + Wd / 2 - 1, Y + Ht / 2 - 1, 3, 3);
      } else if (style === 'aframe') {
        for (let k = 0; k < Ht - T; k++) { const inset = Math.round((k / (Ht - T)) * 2); fill(k < 5 ? 0xf6f2e8 : shadeC(roof, k % 3 === 0 ? 0.8 : 1), X + inset, Y + k, Wd - inset * 2, 1); }
        fill(wall, X, Y + Ht - T, Wd, T);
      } else if (style === 'tree') {
        fill(wall, X + 2, Y + T / 2, Wd - 4, Ht - T / 2);
        x2.fillStyle = hex(0x2e7a3e); x2.beginPath(); x2.arc(X + Wd / 2, Y + T / 2, Wd / 1.6, 0, Math.PI * 2); x2.fill();
        x2.fillStyle = hex(0x4aa04e); x2.beginPath(); x2.arc(X + Wd / 2 - 4, Y + T / 2 - 4, Wd / 3, 0, Math.PI * 2); x2.fill();
      } else {
        fill(roof, X, Y, Wd, Ht - T);
        fill(shadeC(roof, 0.8), X, Y + (Ht - T) / 2, Wd, (Ht - T) / 2);
        fill(shadeC(roof, 0.6), X, Y + (Ht - T) / 2 - 1, Wd, 2);
        if (style === 'stone') for (let k = 0; k < Ht - T; k += 4) fill(shadeC(roof, 0.7), X, Y + k, Wd, 1);
        for (let k = 0; k < Wd; k += 4) fill(shadeC(roof, 0.9), X + k, Y, 1, Ht - T);
      }
      if (style !== 'hut' && style !== 'tree' && style !== 'dome' && style !== 'aframe') fill(wall, X, Y + Ht - T, Wd, T);
      fill(0x5e3a26, X + Wd / 2 - 3, Y + Ht - 10, 6, 10);
      for (let k = 4; k < Wd - 6; k += 12) if (Math.abs(k - Wd / 2) > 6) fill(0x9ae6f6, X + k, Y + Ht - 12, 5, 5);
      if (b.kind === 'tavern') { fill(0xb07a1e, X + Wd - 8, Y + Ht - T - 6, 8, 6); fill(0xf2c94c, X + Wd - 7, Y + Ht - T - 5, 6, 4); }
      if (b.kind === 'smithy') { fill(0x4a4f60, X + 3, Y + 2, 5, 6); fill(0xf08c3a, X + 4, Y + 1, 3, 2); }
      if (b.kind === 'guild') { fill(0x8c2030, X + 2, Y + Ht - T - 8, 4, 8); fill(0x2c5a9c, X + Wd - 6, Y + Ht - T - 8, 4, 8); }
    }
    // market stalls around the plaza
    for (let k = 0; k < 4; k++) {
      const sx = (CW / 2 - 5 + k * 3) * T, sy = (CH / 2 + 3) * T;
      const awn = [0xe04848, 0x5aa0ea, 0xf2c94c, 0x6cc05a][k];
      fill(0x8a5a3a, sx + 2, sy + 6, 2, 8); fill(0x8a5a3a, sx + 18, sy + 6, 2, 8);
      for (let j = 0; j < 22; j += 4) fill(j % 8 ? 0xffffff : awn, sx + j, sy, 4, 6);
    }
    this.drawProps(x2, fill, buildings);
    this.textures.addCanvas(key, cv);
  }

  // what the town is known for, drawn into the street scene (fish racks, barrels, anvils, cloth lines...)
  drawProps(x2: CanvasRenderingContext2D, fill: (c: number | string, x: number, y: number, w: number, h: number) => void, buildings: BuildingRec[]) {
    const id = this.spec?.id;
    const r = new RNG(hashString('props' + this.town.id));
    const spotsNear = (kind: string) => buildings.filter((b) => b.kind === kind);
    const free = (x: number, y: number) => this.grid[y * CW + x] === Tile.Ground;
    const place = (n: number, draw: (X: number, Y: number) => void, near?: BuildingRec) => {
      for (let k = 0, got = 0; k < 160 && got < n; k++) {
        const x = near ? r.int(near.x - 2, near.x + near.w + 1) : r.int(2, CW - 3), y = near ? r.int(near.y - 1, near.y + near.h + 2) : r.int(2, CH - 3);
        if (x < 1 || y < 1 || x >= CW - 1 || y >= CH - 1 || !free(x, y)) continue;
        this.grid[y * CW + x] = Tile.Tree; // blocks buildings; people stand next to it
        draw(x * T, y * T); got++;
      }
    };
    const barrel = (X: number, Y: number) => { fill(0x8a5a3a, X + 3, Y + 4, 10, 10); fill(0x5e3a26, X + 3, Y + 7, 10, 1); fill(0x5e3a26, X + 3, Y + 11, 10, 1); fill(0xa87a4a, X + 4, Y + 4, 3, 10); };
    const sack = (X: number, Y: number, c: number) => { fill(c, X + 3, Y + 6, 10, 8); fill('rgba(0,0,0,0.22)', X + 3, Y + 12, 10, 2); fill(0xf0e0b0, X + 6, Y + 4, 4, 3); };
    const hay = (X: number, Y: number) => { fill(0xd8b040, X + 1, Y + 6, 14, 9); fill(0xf0cc60, X + 3, Y + 3, 10, 5); fill(0xb8902a, X + 1, Y + 12, 14, 2); };
    const rack = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 3, 2, 12); fill(0x5e3a26, X + 13, Y + 3, 2, 12); fill(0x5e3a26, X + 1, Y + 3, 14, 2); for (let k = 0; k < 4; k++) { fill(0x9ab8c8, X + 3 + k * 3, Y + 5, 2, 6); fill(0x6a8898, X + 3 + k * 3, Y + 10, 2, 2); } };
    const cloth = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 2, 2, 13); fill(0x5e3a26, X + 13, Y + 2, 2, 13); for (let k = 0; k < 4; k++) fill([0xe04848, 0x5aa0ea, 0xf2c94c, 0xc07aff][k], X + 3 + k * 3, Y + 4, 3, 9); };
    const cart = (X: number, Y: number) => { fill(0x5e3a26, X + 1, Y + 6, 14, 6); fill(0x2a2a30, X + 3, Y + 5, 10, 3); fill(0xf2c94c, X + 5, Y + 4, 3, 2); fill(0x3a2a1a, X + 3, Y + 12, 3, 3); fill(0x3a2a1a, X + 10, Y + 12, 3, 3); };
    const anvil = (X: number, Y: number) => { fill(0x4a4f60, X + 3, Y + 8, 10, 3); fill(0x7a7f90, X + 2, Y + 6, 12, 3); fill(0x4a4f60, X + 6, Y + 11, 4, 4); };
    const book = (X: number, Y: number) => { fill(0x8a2a2a, X + 3, Y + 9, 10, 3); fill(0x2a5a8a, X + 4, Y + 6, 9, 3); fill(0x3a7a3a, X + 3, Y + 3, 10, 3); };
    const hitch = (X: number, Y: number) => { fill(0x5e3a26, X + 2, Y + 6, 2, 9); fill(0x5e3a26, X + 12, Y + 6, 2, 9); fill(0x8a5a3a, X + 2, Y + 7, 12, 2); };
    const herb = (X: number, Y: number) => { fill(0x6a4a2a, X + 1, Y + 8, 14, 7); for (let k = 0; k < 5; k++) { fill(0x3aa04a, X + 2 + k * 3, Y + 4, 2, 6); fill(['#f06aa0', '#ffd060', '#c07aff'][k % 3], X + 2 + k * 3, Y + 3, 2, 2); } };
    const net = (X: number, Y: number) => { fill(0x7a6a4a, X + 1, Y + 5, 14, 8); for (let k = 0; k < 14; k += 3) fill(0x4a3a22, X + 1 + k, Y + 5, 1, 8); fill(0xe04848, X + 2, Y + 3, 3, 3); };
    const stand = (X: number, Y: number) => { fill(0x8c2030, X + 1, Y + 2, 2, 12); fill(0xf2c94c, X + 3, Y + 2, 8, 5); fill(0x6a4a2a, X + 1, Y + 13, 12, 2); };
    const forge: Record<string, () => void> = {
      fish: () => { place(3, rack); place(3, net); },
      trade: () => { place(4, (X, Y) => sack(X, Y, r.pick([0xc8a050, 0xa05a2a, 0x8a8f9a]))); place(2, barrel); },
      wine: () => place(6, barrel, spotsNear('tavern')[0]),
      grain: () => place(6, hay),
      spice: () => place(5, (X, Y) => sack(X, Y, r.pick([0xe04848, 0xf2c94c, 0xe08030, 0x6cc05a]))),
      forge: () => { place(3, anvil, spotsNear('smithy')[0]); place(2, barrel); },
      mine: () => { place(3, cart); place(2, anvil, spotsNear('smithy')[0]); },
      scholar: () => place(4, book, spotsNear('guild')[0]),
      magic: () => place(3, book, spotsNear('guild')[0]),
      herb: () => place(5, herb),
      pilgrim: () => place(3, stand, spotsNear('temple')[0]),
      arena: () => place(4, stand),
      horse: () => place(5, hitch),
      silk: () => place(4, cloth),
    };
    forge[id]?.();
    void x2;
  }

  // ---------- where things happen ----------
  // Every place type has spots people walk to: building doors, fields, docks, the plaza, the gate...
  computeSpots(buildings: BuildingRec[]) {
    const S: Record<Place, Pt[]> = { field: [], dock: [], smithy: [], temple: [], tavern: [], guild: [], market: [], plaza: [], gate: [], tree: [], grave: [], home: [], road: [], water: [] };
    const at = (tx: number, ty: number): Pt => ({ x: tx * T + T / 2, y: ty * T + T - 2 });
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const t = this.grid[y * CW + x];
      if (t === Tile.Field) S.field.push(at(x, y));
      else if (t === Tile.Dock) S.dock.push(at(x, y));
      else if (t === Tile.Plaza) S.plaza.push(at(x, y));
      else if (t === Tile.Grave) S.grave.push(at(x, y));
      else if (t === Tile.Road) { S.road.push(at(x, y)); if (x < 4 || x > CW - 5 || y < 3 || y > CH - 4) S.gate.push(at(x, y)); }
      else if (t === Tile.Tree && y + 1 < CH && this.grid[(y + 1) * CW + x] === Tile.Ground) S.tree.push(at(x, y + 1));
      else if (t === Tile.Ground) {
        const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < CW && y + dy < CH && this.grid[(y + dy) * CW + x + dx] === Tile.Water);
        if (wet) S.water.push(at(x, y));
      }
    }
    for (const b of buildings) {
      const door = at(b.x + Math.floor(b.w / 2), b.y + b.h);
      (b.kind === 'house' ? S.home : S[b.kind as Place]).push(door);
      if (b.kind !== 'house') S.home.push(door);
    }
    for (let k = 0; k < 4; k++) S.market.push({ x: (CW / 2 - 5 + k * 3) * T + 11, y: (CH / 2 + 3) * T + 26 });
    // anything missing falls back to somewhere sensible so nobody walks into the sea
    const fb = S.plaza.length ? S.plaza : S.road;
    for (const k of Object.keys(S) as Place[]) if (!S[k].length) S[k] = k === 'gate' ? S.road : k === 'grave' || k === 'tree' || k === 'field' ? S.road : fb;
    this.spots = S;
  }

  spot(place: Place, near?: Pt): Pt {
    const list = this.spots[place];
    let p = this.rng.pick(list);
    if (near) { let best = 1e9; for (let i = 0; i < 3; i++) { const q = this.rng.pick(list); const d = Math.hypot(q.x - near.x, q.y - near.y); if (d < best) { best = d; p = q; } } }
    return { x: p.x + this.rng.int(-5, 5), y: p.y + this.rng.int(-2, 2) };
  }

  // ---------- people ----------
  spawnNpcs() {
    const co = this.country;
    const flags = co.flags;
    let n = [10, 16, 24][this.town.size - 1];
    const g = this.game_;
    if (g) {
      const REL_ICON: Record<string, string> = { mentor: 'mentor', rival: 'rival', lover: 'lover', spouse: 'spouse', nemesis: 'nemesis', friend: 'friend', parent: 'parent' };
      // people with lives of their own who live here: the town notables and anyone in the protagonist's life
      for (const p of g.s.npcs.filter((x) => x.alive && x.townId === this.town.id).slice(0, 12)) {
        const rel = g.c.relations.find((r) => r.npcId === p.id && r.alive);
        const job = p.job ? npcJob(p.job) : undefined;
        const per = this.addPerson({ race: p.race, role: rel ? relRole(rel.type) : job?.role || p.role, name: p.name, id: p.id, job, skill: p.skill, goal: goalText(p), elder: p.hAge >= 60, gender: undefined });
        if (rel) per.mark = this.add.image(per.root.x, per.root.y - 54, iconTex(this, REL_ICON[rel.type] || 'friend', 1)).setDepth(40);
        n--;
      }
    }
    const fest = this.festival();
    if (flags.includes('plague')) n = Math.round(n * 0.6);
    if (flags.includes('golden') || fest) n += 5;
    for (let i = 0; i < n; i++) {
      const race = this.rng.weighted(co.races, (r) => r.w)!.race;
      const kid = this.rng.chance(0.13);
      let job = kid ? undefined : pickTownJob(this.rng, this.town.id, co, race);
      if (flags.includes('war') && i < 3) job = npcJob('guard');
      if (flags.includes('famine') && i < 2) job = npcJob('beggar');
      this.addPerson({ race, role: kid ? 'เด็ก' : job!.role, job, elder: !kid && this.rng.chance(0.12) });
    }
  }

  addPerson(o: { race: string; role: string; name?: string; id?: number; job?: NpcJob; skill?: number; goal?: string; elder?: boolean; gender?: string; at?: Pt; hero?: boolean; look?: Look }): Person {
    const nm = o.name || makeName(this.rng, o.race);
    const look = o.look || lookFor(`${nm}@${this.town.id}`, o.race, o.role, { climate: this.country.climate, gender: o.gender, elder: o.elder });
    const p0 = o.at || this.tilePos(this.rng.pick(this.walk));
    const key = personFrames(this, look);
    const img = this.add.image(0, 0, key, POSE.idle).setOrigin(0.5, 1);
    const per: Person = {
      id: o.id, name: nm, race: o.race, role: o.role, look, img, root: img, job: o.job, skill: o.skill ?? this.rng.int(10, 80), goal: o.goal, hero: !!o.hero,
      state: 'idle', wait: this.rng.float(0.1, 3), actT: 0, frame: 0, carry: false, speed: look.child ? 46 : look.elder ? 22 : this.rng.float(30, 40), fx: 0, tag: 0, asleep: false,
      goesHome: this.rng.chance(0.75),
    };
    if (!o.goal && o.job) per.goal = this.randomGoal(per);
    img.setPosition(p0.x, p0.y).setDepth(5);
    if (!o.hero) {
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => this.bubble(img, this.describe(per), 3000, '#2a2438'));
    }
    this.npcs.push(per);
    return per;
  }

  describe(p: Person): string {
    const bits = [`${p.name} (${raceById(p.race).name}·${p.role})`];
    if (p.job && p.skill !== undefined) bits.push(`ฝีมือ${p.job.skill} ${Math.round(p.skill)}/100`);
    if (p.goal) bits.push(`ใฝ่ฝัน: ${p.goal}`);
    return bits.join('\n');
  }

  // a goal for a townsperson who is not tracked by the world simulation (deterministic per person)
  randomGoal(p: Person): string {
    const r = new RNG(hashString(`goal${p.name}${this.town.id}`));
    const pool = NPC_GOALS.filter((g) => !g.countryFlag && (!g.jobs || g.jobs.includes(p.job?.id || '')) && !(g.minAge && p.look.child));
    const g = r.weighted(pool, (x) => x.w);
    return g ? g.text.replace('{skill}', p.job?.skill || 'ชีวิต').replace('{town}', this.town.name) : '';
  }

  // something happened in this NPC's own life
  npcSay(id: number, text: string) {
    const n = this.npcs.find((x) => x.id === id);
    if (n) this.bubble(n.root, text, 3500, '#2c5a9c');
  }

  // ---------- time of day ----------
  night() { return this.nightAmt; }

  festival() {
    return this.country.flags.find((f) => f.startsWith('fest_'))?.slice(5) || '';
  }

  panic(): boolean {
    return DISASTERS.some((d) => ['dragon_raid', 'titan', 'quake', 'alien', 'kraken', 'meteor'].includes(d.id) && this.country.flags.includes(d.flag));
  }

  // ---------- behaviour ----------
  // what to do next: dusk sends people home, festivals draw them to the plaza, trades keep them busy
  think(p: Person) {
    if (!p.root.active || p.state === 'locked') return;
    const here = { x: p.root.x, y: p.root.y };
    p.carry = false;
    if (this.panic() && !p.hero) { this.go(p, this.spot('road'), 78, () => { p.wait = this.rng.float(0.2, 1); }); this.emote(p, 'warning'); return; }
    if (this.nightAmt > 0.55 && p.goesHome && !p.hero) {
      this.go(p, this.spot('home', here), p.speed, () => { p.asleep = true; this.tweens.add({ targets: p.root, alpha: 0, duration: 500 }); p.wait = 2; });
      return;
    }
    if (p.asleep) { p.asleep = false; this.tweens.add({ targets: p.root, alpha: 1, duration: 500 }); }
    if (this.festival() && this.rng.chance(0.7)) {
      this.go(p, this.spot('plaza'), p.speed * 1.2, () => this.doAct(p, FEST_ANIM, this.rng.float(5, 10)));
      return;
    }
    if (p.look.child) {
      if (this.rng.chance(0.55)) this.go(p, this.nearby(here, 7), 52, () => this.doAct(p, { frames: [POSE.cheer, POSE.idle], fps: 3, fx: 'none' }, this.rng.float(1, 2.5)));
      else this.go(p, this.nearby(here, 5), 46, () => { p.wait = this.rng.float(0.5, 2); });
      return;
    }
    if (p.look.elder && this.rng.chance(0.45)) {
      this.go(p, this.spot('plaza', here), p.speed, () => this.doAct(p, { frames: [POSE.sit], fps: 1, fx: 'none' }, this.rng.float(6, 14)));
      return;
    }
    if (p.job && this.rng.chance(0.78)) { this.doJob(p, p.job); return; }
    if (this.rng.chance(0.4)) { // stop and chat with someone
      const o = this.rng.pick(this.npcs.filter((x) => x !== p && x.state !== 'locked' && !x.asleep)) as Person | undefined;
      if (o) {
        this.go(p, { x: o.root.x + (p.root.x < o.root.x ? -16 : 16), y: o.root.y }, p.speed, () => {
          p.img.setFlipX(o.root.x < p.root.x);
          this.doAct(p, { frames: [POSE.idle, POSE.breath], fps: 1.6, fx: 'none' }, this.rng.float(2, 4));
          if (this.rng.chance(0.5)) this.emote(p, 'bubble');
        });
        return;
      }
    }
    this.go(p, this.nearby(here, 9), p.speed, () => { p.wait = this.rng.float(0.6, 3); });
  }

  nearby(from: Pt, tiles: number): Pt {
    const pool = this.walk.filter(([x, y]) => Math.abs(x * T - from.x) < T * tiles && Math.abs(y * T - from.y) < T * tiles * 0.7);
    return this.tilePos(this.rng.pick(pool.length ? pool : this.walk));
  }

  tilePos(t: [number, number]) { return { x: t[0] * T + T / 2, y: t[1] * T + T - 2 }; }

  // each trade: where it is done and what the hands do
  doJob(p: Person, job: NpcJob) {
    const here = { x: p.root.x, y: p.root.y };
    const w = job.work;
    const A = ANIM[w];
    if (w === 'patrol') { this.go(p, this.spot('gate'), p.speed * 0.9, () => this.go(p, this.spot('plaza'), p.speed * 0.9, () => { p.wait = 1; })); return; }
    if (w === 'run') { this.go(p, this.spot('road'), 80, () => this.go(p, this.spot('road'), 80, () => { p.wait = 0.5; this.emote(p, 'scroll'); })); return; }
    if (w === 'haul') { p.carry = true; this.go(p, this.spot('dock'), p.speed, () => { p.carry = true; this.go(p, this.spot('market'), p.speed, () => { p.carry = false; p.wait = 1; }); }); return; }
    if (w === 'stroll') { this.go(p, this.spot('plaza', here), p.speed * 0.6, () => { p.wait = this.rng.float(2, 5); }); return; }
    if (w === 'hunt') { this.go(p, this.spot('gate'), p.speed, () => { this.go(p, this.spot('tree'), p.speed, () => this.doAct(p, ANIM.tend, 4)); }); return; }
    if (w === 'serve') { this.go(p, this.spot('tavern', here), p.speed, () => { p.carry = true; this.go(p, this.spot('plaza'), p.speed, () => { p.carry = false; this.emote(p, 'mug'); p.wait = 1; }); }); return; }
    this.go(p, this.spot(job.place, here), p.speed, () => {
      this.doAct(p, A || ANIM.tend, this.rng.float(6, 14));
      if (w === 'sell') this.bubble(p.root, this.rng.pick(['ของสดจ้า!', 'ลดราคา วันนี้วันเดียว', 'มาดูก่อนได้นะ', 'ของดีราคาถูก']), 2200);
      if (this.rng.chance(0.25) && p.goal) this.bubble(p.root, `อยาก${p.goal.replace(/^อยาก/, '')}`, 2800, '#4a3a6a');
    });
  }

  go(p: Person, to: Pt, speed: number, then: () => void) {
    p.state = 'move'; p.to = to; p.moveSpeed = speed; p.then = then; p.actEnd = 0;
  }

  doAct(p: Person, a: Anim, secs: number) {
    p.state = 'act'; p.act = a; p.actT = secs; p.fx = 0;
    p.img.setFrame(a.frames[0]);
  }

  // ---------- per-frame update ----------
  update(_t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    this.dayT += dt;
    this.updateDay();
    for (const p of this.npcs) this.step(p, dt);
    if (this.hero) this.step(this.hero, dt);
    this.updateFx(dt);
    for (const n of this.npcs) if (n.mark) n.mark.setPosition(n.root.x, n.root.y - 54);
  }

  step(p: Person, dt: number) {
    const r = p.root;
    r.setDepth(5 + r.y / 1000);
    if (p.state === 'move' && p.to) {
      const dx = p.to.x - r.x, dy = p.to.y - r.y, d = Math.hypot(dx, dy);
      const sp = (p.moveSpeed || p.speed) * dt;
      if (d <= sp + 0.5) {
        r.setPosition(p.to.x, p.to.y);
        p.state = 'idle'; p.wait = 0.15; p.img.setFrame(POSE.idle);
        const cb = p.then; p.then = undefined; cb?.();
        return;
      }
      r.x += (dx / d) * sp; r.y += (dy / d) * sp;
      if (Math.abs(dx) > 0.5) p.img.setFlipX(dx < 0);
      p.tag += dt * Math.max(5, (p.moveSpeed || p.speed) / 6);
      const seq = p.carry ? CARRY_WALK : WALK;
      p.img.setFrame(seq[Math.floor(p.tag) % seq.length]);
    } else if (p.state === 'act' && p.act) {
      p.actT -= dt;
      p.tag += dt * p.act.fps;
      p.img.setFrame(p.act.frames[Math.floor(p.tag) % p.act.frames.length]);
      p.fx -= dt;
      if (p.fx <= 0) { p.fx = p.act.fps > 0 ? 1 / p.act.fps : 1; this.workFx(p, p.act); }
      if (p.actT <= 0) { p.state = 'idle'; p.wait = this.rng.float(0.3, 1.2); p.img.setFrame(POSE.idle); p.act = undefined; }
    } else if (p.state === 'idle') {
      p.tag += dt * 1.2;
      p.img.setFrame(Math.floor(p.tag) % 2 ? POSE.breath : POSE.idle);
      p.wait -= dt;
      if (p.wait <= 0 && !(p.hero && p.frozen)) this.think(p);
    }
  }

  // little effects tied to the hands: sparks from the anvil, dust from the hoe, steam, notes, halos
  workFx(p: Person, a: Anim) {
    if (!a.fx || a.fx === 'none') return;
    const x = p.root.x + (p.img.flipX ? -9 : 9), y = p.root.y - 4;
    const dot = (col: number, dx: number, dy: number, sz = 2) => {
      const d = this.add.rectangle(x, y, sz, sz, col).setDepth(30);
      this.tweens.add({ targets: d, x: x + dx, y: y + dy, alpha: 0, duration: 520, onComplete: () => d.destroy() });
    };
    if (a.fx === 'spark') for (let i = 0; i < 3; i++) dot(this.rng.pick([0xffe680, 0xf08c3a, 0xffffff]), this.rng.int(-9, 9), this.rng.int(-14, -3));
    else if (a.fx === 'dust') for (let i = 0; i < 2; i++) dot(0xb8a078, this.rng.int(-6, 6), this.rng.int(-7, -2), 3);
    else if (a.fx === 'chip') for (let i = 0; i < 2; i++) dot(0xa07040, this.rng.int(-7, 7), this.rng.int(-10, -3));
    else if (a.fx === 'steam') dot(0xf0f0f0, this.rng.int(-3, 3), -16, 3);
    else if (a.fx === 'splash') { dot(0x9ad0ff, 0, -8, 2); if (this.rng.chance(0.3)) this.emote(p, 'fish'); }
    else if (a.fx === 'sparkle') for (let i = 0; i < 3; i++) dot(this.rng.pick([0xc07aff, 0x7ad0ff, 0xffffff]), this.rng.int(-12, 12), this.rng.int(-22, -6));
    else if (a.fx === 'note') { if (this.rng.chance(0.6)) this.emote(p, 'note'); }
    else if (a.fx === 'halo') { if (this.rng.chance(0.3)) this.emote(p, 'faith'); }
  }

  bubble(target: { x: number; y: number }, text: string, ms = 2600, bg = '#fff8e0') {
    const t = this.txt(target.x, target.y - 50, text, {
      fontFamily: 'Sarabun, sans-serif', fontSize: 7, color: bg === '#fff8e0' ? '#1b1626' : '#ffffff', backgroundColor: bg, pad: 3, wrap: 120,
    }).setOrigin(0.5, 1).setDepth(60);
    this.tweens.add({ targets: t, y: t.y - 8, alpha: { from: 1, to: 0 }, delay: ms - 500, duration: 500, onComplete: () => t.destroy() });
    return t;
  }

  emote(p: Person, icon: string) {
    const e = this.add.image(p.root.x, p.root.y - 52, iconTex(this, icon, 1)).setDepth(61);
    this.tweens.add({ targets: e, y: e.y - 8, alpha: { from: 1, to: 0 }, delay: 1400, duration: 600, onUpdate: () => { e.x = p.root.x; }, onComplete: () => e.destroy() });
  }

  // ---------- small events in other people's lives (grammar in data/townlife.ts) ----------
  townLife() {
    const live = this.npcs.filter((n) => !n.asleep && n.state !== 'locked');
    if (live.length < 2 || this.monster) return;
    const g = this.game_;
    const co = this.country;
    const a = this.rng.pick(live), b = this.rng.pick(live.filter((x) => x !== a));
    const here = g && this.heroHere();
    const ev = townLifeEvent(this.rng, {
      a: a.name, b: b.name, roleA: a.role, raceA: a.race, town: this.town.name, place: this.rng.pick(TOWN_PLACES),
      weather: co.weather || 'clear', flags: co.flags, religion: co.religion,
      hero: here ? g!.c.name : undefined, heroFame: g?.c.fame, minority: here ? g!.ctx().tags.has('minority') : false,
    });
    this.onNews(ev.text);
    this.act(a, b, ev.kind, ev.text);
  }

  // show what happened: an emote over the head and a little behaviour
  act(a: Person, b: Person, kind: LifeKind, text: string) {
    if (kind === 'fight') { this.brawl(a, b, text); return; }
    this.bubble(a.root, text);
    this.emote(a, EMOTE[kind]);
    const release = (ms: number, ...ps: Person[]) => this.time.delayedCall(ms, () => { for (const p of ps) { if (p.state === 'locked') { p.state = 'idle'; p.wait = 0.2; } } });
    if (kind === 'love' || kind === 'trade' || kind === 'talk') {
      a.state = b.state = 'locked';
      b.to = undefined; a.to = undefined;
      const meet = { x: a.root.x + (b.root.x < a.root.x ? -17 : 17), y: a.root.y };
      this.walkLocked(b, meet, () => { b.img.setFlipX(a.root.x < b.root.x); a.img.setFlipX(b.root.x < a.root.x); if (kind === 'love') this.emote(b, 'lover'); });
      this.pose(a, kind === 'trade' ? [POSE.work0, POSE.idle] : [POSE.idle, POSE.breath], 1.6, 3200);
      this.pose(b, [POSE.idle, POSE.breath], 1.6, 3200);
      release(3300, a, b);
    } else if (kind === 'celebrate' || kind === 'sing') {
      a.state = 'locked'; this.pose(a, [POSE.cheer, POSE.idle], 4, 3000); release(3100, a);
    } else if (kind === 'chase') {
      a.state = 'idle'; this.go(a, this.nearby({ x: a.root.x, y: a.root.y }, 12), 80, () => { a.wait = 0.5; });
    } else if (kind === 'pray' || kind === 'cry') {
      a.state = 'locked'; this.pose(a, [POSE.kneel], 1, 2800); release(2900, a);
    }
  }

  // hold a person on a looping pose for a while
  pose(p: Person, frames: number[], fps: number, ms: number) {
    p.state = 'locked';
    let t = 0;
    const ev = this.time.addEvent({ delay: 120, loop: true, callback: () => { t += 0.12; if (p.root.active) p.img.setFrame(frames[Math.floor(t * fps) % frames.length]); } });
    this.time.delayedCall(ms, () => { ev.remove(); if (p.root.active) p.img.setFrame(POSE.idle); });
  }

  // walk a locked person to a point (used when two people meet)
  walkLocked(p: Person, to: Pt, done: () => void) {
    const d = Math.hypot(to.x - p.root.x, to.y - p.root.y);
    p.img.setFlipX(to.x < p.root.x);
    let t = 0;
    const ev = this.time.addEvent({ delay: 110, loop: true, callback: () => { t++; p.img.setFrame(WALK[t % 4]); } });
    this.tweens.add({ targets: p.root, x: to.x, y: to.y, duration: Math.max(200, (d / 40) * 1000), onComplete: () => { ev.remove(); p.img.setFrame(POSE.idle); done(); } });
  }

  brawl(a: Person, b: Person, text: string) {
    a.state = b.state = 'locked';
    this.tweens.killTweensOf([a.root, b.root]);
    b.root.setPosition(a.root.x + 20, a.root.y);
    b.img.setFlipX(true); a.img.setFlipX(false);
    this.bubble(a.root, text);
    const star = this.add.image(a.root.x + 10, a.root.y - 18, iconTex(this, 'miracle', 1)).setDepth(62).setAlpha(0);
    this.pose(a, [POSE.work1, POSE.work0], 3.5, 2800);
    this.pose(b, [POSE.work0, POSE.work1], 3.2, 2800);
    this.tweens.add({ targets: a.root, x: a.root.x + 5, yoyo: true, duration: 140, repeat: 8 });
    this.tweens.add({ targets: star, alpha: 1, scale: 1.6, yoyo: true, duration: 140, repeat: 7, onComplete: () => star.destroy() });
    const loser = this.rng.chance(0.5) ? a : b;
    this.time.delayedCall(2000, () => { loser.img.setFrame(POSE.kneel); loser.img.setAngle(90); });
    this.time.delayedCall(3600, () => { loser.img.setAngle(0); a.state = b.state = 'idle'; a.wait = b.wait = 0.5; });
  }

  // ---------- time of day, festivals and the weather of the times ----------
  updateDay() {
    const p = (this.dayT % DAY_LEN) / DAY_LEN;
    // 0 dawn … 0.5 afternoon … 0.75 dusk … 1 night→dawn
    const night = p < 0.05 ? 1 - p / 0.05 : p > 0.7 ? Math.min(1, (p - 0.7) / 0.08) : 0;
    this.nightAmt = night;
    let dark = night * 0.5;
    const flags = this.country.flags;
    if (flags.includes('eclipse')) dark = Math.max(dark, 0.62);
    else if (flags.includes('long_night')) dark = Math.max(dark, 0.55);
    this.shade.setAlpha(dark);
    this.shade.setFillStyle(flags.includes('eclipse') ? 0x14081c : flags.includes('dragon_raid') || flags.includes('eruption') ? 0x3a1008 : 0x101840);
    for (const l of this.glows) l.setAlpha(Math.min(1, night * 1.6 + (flags.includes('eclipse') ? 1 : 0)) * 0.85);
  }

  // ambience that follows what is happening in this land: festivals, disasters, specialties
  updateFx(dt: number) {
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.45;
    const W = CW * T, H = CH * T, flags = this.country.flags;
    const rnd = (a: number, b: number) => this.rng.float(a, b);
    const spawn = (icon: string, x: number, y: number, dx: number, dy: number, ms: number, sc = 1, rot = 0) => {
      const s = this.add.image(x, y, iconTex(this, icon, 1)).setDepth(58).setScale(sc);
      this.tweens.add({ targets: s, x: x + dx, y: y + dy, alpha: { from: 1, to: 0 }, angle: rot, duration: ms, onComplete: () => s.destroy() });
    };
    const bit = (col: number, x: number, y: number, dx: number, dy: number, ms: number, sz = 2) => {
      const d = this.add.rectangle(x, y, sz, sz, col).setDepth(58);
      this.tweens.add({ targets: d, x: x + dx, y: y + dy, alpha: { from: 1, to: 0 }, duration: ms, onComplete: () => d.destroy() });
    };
    const fest = this.festival();
    if (fest === 'lantern' || fest === 'ancestor_night' || fest === 'light_procession') spawn('lantern', rnd(0, W), H - 20, rnd(-20, 20), -H * 0.8, 6000);
    else if (fest === 'harvest' || fest === 'flower_fest' || fest === 'brew_fest') bit(this.rng.pick([0xe8b830, 0xf06aa0, 0xffffff]), rnd(0, W), -4, rnd(-30, 30), H, 4500, 3);
    else if (fest === 'ice_fest') bit(0xffffff, rnd(0, W), -4, rnd(-30, 10), H, 5000, 2);
    else if (fest === 'fire_fest') { const x = W / 2 + rnd(-20, 20); bit(this.rng.pick([0xffe680, 0xf08c3a, 0xe04848]), x, H / 2 + 20, rnd(-14, 14), -rnd(30, 60), 900, 3); }
    else if (fest === 'dragon_dance' || fest === 'tournament' || fest === 'masquerade' || fest === 'sand_race' || fest === 'boat_race' || fest === 'great_hunt' || fest === 'star_watch') {
      for (let i = 0; i < 2; i++) bit(this.rng.pick([0xff6a6a, 0xffd060, 0x7aff9a, 0x6ac0ff, 0xe07aff]), rnd(0, W), rnd(0, H * 0.4), rnd(-20, 20), rnd(30, 120), 2200, 3);
      if (fest === 'masquerade' && this.rng.chance(0.3)) spawn('mask', rnd(0, W), rnd(40, H - 60), rnd(-30, 30), -30, 3000);
      if (fest === 'star_watch' && this.rng.chance(0.4)) { const x = rnd(0, W); for (let k = 0; k < 6; k++) bit(0xffffff, x + k * 3, 4 + k * 2, 50, 30, 500, 2); }
    }
    if (this.nightAmt > 0.5 && fest) this.firework(rnd(80, W - 80), rnd(30, H * 0.4));
    // disasters
    if (flags.includes('dragon_raid') && this.rng.chance(0.5)) { const y = rnd(30, 140); spawn('dragon', -30, y, W + 60, rnd(-20, 20), 4200, 2.4); this.rng.chance(0.5) && bit(0xf08c3a, rnd(0, W), rnd(100, H - 100), 0, -20, 800, 4); }
    if (flags.includes('meteor') && this.rng.chance(0.25)) { const x = rnd(40, W - 100); for (let k = 0; k < 8; k++) bit(this.rng.pick([0xffffff, 0xffe680, 0xf08c3a]), x + k * 5, 6 + k * 4, 90, 60, 600, 4 - k / 3); }
    if (flags.includes('alien')) this.alienFx();
    if (flags.includes('locust')) for (let i = 0; i < 6; i++) bit(0x2a1a08, -4, rnd(0, H), W + 20, rnd(-30, 30), rnd(2500, 4500), 2);
    if (flags.includes('magic_storm')) { for (let i = 0; i < 3; i++) bit(this.rng.pick([0xff6a6a, 0xffd060, 0x7aff9a, 0x6ac0ff, 0xc07aff]), rnd(0, W), rnd(0, H), rnd(-40, 40), rnd(-40, 20), 1400, 3); if (this.rng.chance(0.15)) spawn(this.rng.pick(['book', 'mug', 'key', 'orb']), rnd(0, W), H - 40, rnd(-30, 30), -H * 0.6, 3500); }
    if (flags.includes('sky_whale') && this.rng.chance(0.08)) spawn('whale', -40, rnd(20, 90), W + 80, rnd(-10, 10), 9000, 3);
    if (flags.includes('flood')) this.flood.setAlpha(0.28 + Math.sin(this.dayT) * 0.04);
    else this.flood.setAlpha(0);
    if ((flags.includes('quake') || flags.includes('titan')) && this.rng.chance(0.18)) this.cameras.main.shake(380, 0.004);
    if (flags.includes('eruption') && this.rng.chance(0.4)) bit(0x5a4a44, rnd(0, W), -4, rnd(-10, 10), H, 4000, 3);
    if (flags.includes('sandstorm')) for (let i = 0; i < 4; i++) bit(0xe8c080, -4, rnd(0, H), W + 20, rnd(0, 30), 1400, 2);
    // town specialties show in the air too
    const sp = this.spec.id;
    if (sp === 'forge' || sp === 'mine') { const s = this.buildings.find((b) => b.kind === 'smithy'); if (s && this.rng.chance(0.5)) bit(0x9a9a9a, (s.x + 1) * T, s.y * T, rnd(-6, 10), -rnd(20, 40), 1800, 3); }
    if (sp === 'magic' || sp === 'scholar') { const s = this.buildings.find((b) => b.kind === 'guild'); if (s && this.rng.chance(0.4)) bit(this.rng.pick([0xc07aff, 0x7ad0ff]), (s.x + s.w / 2) * T + rnd(-12, 12), s.y * T, rnd(-8, 8), -rnd(10, 30), 1600, 2); }
    if (sp === 'pilgrim' && this.rng.chance(0.15)) { const t = this.buildings.find((b) => b.kind === 'temple'); if (t) spawn('halo', (t.x + t.w / 2) * T, t.y * T, 0, -22, 2200); }
  }

  firework(x: number, y: number) {
    const col = this.rng.pick([0xff6a6a, 0xffd060, 0x7aff9a, 0x6ac0ff, 0xe07aff]);
    for (let a = 0; a < 14; a++) {
      const ang = (a / 14) * Math.PI * 2;
      const d = this.add.rectangle(x, y, 3, 3, col).setDepth(58);
      this.tweens.add({ targets: d, x: x + Math.cos(ang) * 34, y: y + Math.sin(ang) * 34 + 8, alpha: 0, duration: 900, onComplete: () => d.destroy() });
    }
  }

  alienFx() {
    if (!this.ufo) {
      this.ufo = this.add.image(CW * T * 0.3, 40, iconTex(this, 'ufo', 4)).setDepth(58);
      this.beam = this.add.triangle(0, 0, 0, 0, -34, 300, 34, 300, 0x7aff9a, 0.25).setOrigin(0.5, 0).setDepth(57);
      this.tweens.add({ targets: this.ufo, x: CW * T * 0.7, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: this.ufo, y: 52, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.beam!.setPosition(this.ufo.x, this.ufo.y + 14);
    this.time.delayedCall(450, () => { if (!this.country.flags.includes('alien')) { this.ufo?.destroy(); this.beam?.destroy(); this.ufo = undefined; this.beam = undefined; } });
  }

  // ---------- protagonist ----------
  heroHere() { return !!this.game_ && this.game_.c.alive && this.game_.c.townId === this.town.id; }

  // the protagonist's form follows their life stage: a baby in a cradle watched by a parent, a child at play,
  // then someone who works, and in old age someone who rests on a bench
  refresh() {
    const g = this.game_;
    if (!g || !this.sys.settings.active) return;
    const stage = g.stage();
    if (this.heroHere() && !this.hero) {
      const home = this.spot('home');
      const ring = this.add.ellipse(0, 0, 22, 8, 0xffe680, 0.7);
      this.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 1200, repeat: -1 });
      const look = heroLook(g.c, this.country.climate);
      const img = this.add.image(0, 0, personFrames(this, look), POSE.idle).setOrigin(0.5, 1);
      const name = this.txt(0, -50, g.c.name, { fontFamily: 'Sarabun, sans-serif', fontSize: 7, color: '#ffe680', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 1);
      const root = this.add.container(home.x, home.y, [ring, img, name]).setDepth(6);
      const per: Person = {
        name: g.c.name, race: g.c.race, role: g.c.job || 'ชาวบ้าน', look, img, root, hero: true, state: 'idle', wait: 1, actT: 0, frame: 0, carry: false,
        speed: 34, fx: 0, tag: 0, asleep: false, goesHome: false, skill: 50,
      };
      this.hero = per;
      this.heroForm = '';
      this.setHeroForm(true);
      if (this.follow) this.cameras.main.startFollow(root, true, 0.08, 0.08);
      // an encounter that was already waiting when we arrived
      const mid = g.s.pending?.monsterId;
      const m = mid && MONSTERS.find((x) => x.id === mid);
      if (m) this.time.delayedCall(400, () => this.startBattle(m.icon));
    } else if (!this.heroHere() && this.hero) {
      this.cameras.main.stopFollow();
      this.dropMother();
      this.hero.root.destroy();
      this.hero = null;
    }
    if (this.hero) this.setHeroForm(false);
    void stage;
  }

  // rebuild the protagonist's sprite when their stage or job changes
  setHeroForm(force: boolean) {
    const g = this.game_!, h = this.hero;
    if (!h) return;
    const stage = g.stage();
    const form = `${stage}|${g.c.job || ''}|${g.c.hAge >= 55}`;
    if (!force && form === this.heroForm) return;
    this.heroForm = form;
    const look = heroLook(g.c, this.country.climate);
    h.look = look; h.job = g.c.job ? jobFor(g.c.job) : undefined;
    h.speed = look.child ? 46 : look.elder ? 22 : 34;
    if (stage === 'infant') {
      // too small to walk: a cradle by the door, a parent watching over
      h.state = 'locked'; h.frozen = true;
      h.img.setTexture(cradleTex(this, look.skin), undefined).setOrigin(0.5, 1);
      this.tweens.killTweensOf(h.img);
      this.tweens.add({ targets: h.img, angle: { from: -4, to: 4 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const door = this.spot('home');
      h.root.setPosition(door.x, door.y);
      this.addMother(door);
    } else {
      this.tweens.killTweensOf(h.img);
      h.img.setAngle(0).setTexture(personFrames(this, look), POSE.idle).setOrigin(0.5, 1);
      if (h.frozen) { h.frozen = false; h.state = 'idle'; h.wait = 0.5; }
      this.dropMother();
    }
  }

  addMother(door: Pt) {
    if (this.mother) return;
    const g = this.game_!;
    const rel = g.c.relations.find((r) => r.type === 'parent' && r.alive);
    const per = this.addPerson({ race: rel?.race || g.c.race, role: 'พ่อแม่', name: rel?.name, at: { x: door.x + 16, y: door.y }, gender: 'หญิง' });
    per.state = 'locked'; per.goesHome = false; per.img.setFlipX(true);
    const rock = this.time.addEvent({ delay: 450, loop: true, callback: () => { if (per.root.active) per.img.setFrame(Math.floor(this.dayT * 1.1) % 5 === 4 ? POSE.cheer : Math.floor(this.dayT * 2) % 2 ? POSE.breath : POSE.idle); } });
    per.onRemove = () => rock.remove();
    this.mother = per;
    this.time.addEvent({ delay: 5500, loop: true, callback: () => { if (this.mother === per) this.emote(this.hero!, 'heart'); } });
  }

  dropMother() {
    if (!this.mother) return;
    this.mother.onRemove?.();
    this.mother.root.destroy();
    this.npcs = this.npcs.filter((x) => x !== this.mother);
    this.mother = null;
  }

  setFollow(v: boolean) {
    this.follow = v;
    if (v && this.hero) this.cameras.main.startFollow(this.hero.root, true, 0.08, 0.08); else this.cameras.main.stopFollow();
  }

  // something happens to the protagonist: a "!" over their head
  alert(text: string) {
    if (!this.hero) return;
    this.bubble(this.hero.root, text, 3000, '#8c2030');
  }

  // a monster arrives — townsfolk scatter
  startBattle(icon: string) {
    const h = this.hero;
    if (!h || this.monster) return;
    h.state = 'locked';
    this.tweens.killTweensOf(h.root);
    this.cameras.main.shake(250, 0.004);
    this.monster = this.add.image(h.root.x + 160, h.root.y, iconTex(this, icon, 4)).setOrigin(0.5, 1).setDepth(7).setFlipX(true);
    this.tweens.add({ targets: this.monster, x: h.root.x + 56, duration: 900, ease: 'Quad.out' });
    this.tweens.add({ targets: this.monster, scaleY: 0.92, yoyo: true, duration: 300, repeat: -1 });
    h.img.setFlipX(false); h.img.setFrame(h.look.child ? POSE.cheer : POSE.work0);
    for (const n of this.npcs) {
      if (Math.abs(n.root.x - h.root.x) > T * 12 || n === this.mother) continue;
      const away = n.root.x < h.root.x ? -1 : 1;
      this.go(n, { x: Math.max(8, Math.min(CW * T - 8, n.root.x + away * T * 10)), y: n.root.y }, 80, () => { n.wait = 1; });
    }
  }

  floatText(x: number, y: number, text: string, color: string) {
    const t = this.txt(x, y, text, { fontFamily: 'Itim, sans-serif', fontSize: 11, color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  // play how a confrontation ended: win / lose / flee
  playOutcome(kind: 'win' | 'lose' | 'flee') {
    const hero = this.hero, mon = this.monster;
    if (!hero) return;
    const root = hero.root;
    const cam = this.cameras.main;
    const strike = this.time.addEvent({ delay: 130, repeat: 8, callback: () => hero.img.setFrame(Math.random() < 0.5 ? POSE.work0 : POSE.work1) });
    if (kind === 'win' && mon) {
      this.tweens.add({ targets: root, x: mon.x - 20, duration: 160, yoyo: true, repeat: 2 });
      const slash = this.add.image(mon.x, mon.y - 24, iconTex(this, 'kill', 3)).setDepth(71).setAlpha(0);
      this.tweens.add({ targets: slash, alpha: 1, scale: 1.4, yoyo: true, duration: 140, repeat: 2, onComplete: () => slash.destroy() });
      this.tweens.add({ targets: mon, alpha: 0, angle: 90, delay: 700, duration: 600, onComplete: () => { mon.destroy(); this.monster = null; } });
      this.time.delayedCall(1300, () => hero.img.setFrame(POSE.cheer));
      this.floatText(mon.x, mon.y - 50, 'ชนะ!', '#ffe680');
      cam.shake(200, 0.006);
    } else if (kind === 'lose') {
      if (mon) this.tweens.add({ targets: mon, x: root.x + 14, duration: 140, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: root, x: root.x - 30, duration: 300, delay: 300 });
      this.time.delayedCall(700, () => { hero.img.setFrame(POSE.kneel); });
      cam.flash(250, 160, 30, 30);
      this.floatText(root.x, root.y - 50, 'บาดเจ็บ!', '#ff6a6a');
      if (mon) this.tweens.add({ targets: mon, alpha: 0, x: mon.x + 120, delay: 1400, duration: 700, onComplete: () => { mon.destroy(); this.monster = null; } });
    } else {
      strike.remove();
      hero.img.setFlipX(true);
      const run = this.time.addEvent({ delay: 90, repeat: 8, callback: () => hero.img.setFrame(WALK[Math.floor(Math.random() * 4)]) });
      this.tweens.add({ targets: root, x: root.x - 140, duration: 700, onComplete: () => run.remove() });
      this.floatText(root.x, root.y - 50, 'หนี!', '#9ae6f6');
      if (mon) this.tweens.add({ targets: mon, alpha: 0, delay: 900, duration: 600, onComplete: () => { mon.destroy(); this.monster = null; } });
    }
    this.time.delayedCall(2600, () => { hero.state = 'idle'; hero.wait = 0.4; hero.img.setFrame(POSE.idle); });
  }

  // a fight that is not against a monster (brawl, duel, war)
  playBrawl(win: boolean) {
    if (!this.hero) return;
    const foeRace = this.rng.weighted(this.country.races, (r) => r.w)!.race;
    const foe = this.add.image(this.hero.root.x + 26, this.hero.root.y, raceTex(this, foeRace, 2)).setOrigin(0.5, 1).setDepth(7).setFlipX(true);
    this.monster = foe;
    this.hero.state = 'locked';
    this.time.delayedCall(200, () => this.playOutcome(win ? 'win' : 'lose'));
  }
}

// ---------- animation tables ----------
interface Anim { frames: number[]; fps: number; fx?: 'spark' | 'dust' | 'chip' | 'steam' | 'splash' | 'sparkle' | 'note' | 'halo' | 'none' }
const ANIM: Record<string, Anim> = {
  hammer: { frames: [POSE.work0, POSE.work1], fps: 2.4, fx: 'spark' },
  hoe: { frames: [POSE.work0, POSE.work1], fps: 1.5, fx: 'dust' },
  chop: { frames: [POSE.work0, POSE.work1], fps: 1.8, fx: 'chip' },
  dig: { frames: [POSE.work0, POSE.work1], fps: 1.6, fx: 'dust' },
  train: { frames: [POSE.work1, POSE.work0, POSE.idle], fps: 3, fx: 'spark' },
  sweep: { frames: [POSE.work1, POSE.work0], fps: 1.4, fx: 'dust' },
  cook: { frames: [POSE.work0, POSE.idle], fps: 1.4, fx: 'steam' },
  brew: { frames: [POSE.work0, POSE.idle, POSE.cheer], fps: 1.2, fx: 'steam' },
  sew: { frames: [POSE.sit, POSE.breath], fps: 1.1, fx: 'none' },
  read: { frames: [POSE.sit, POSE.sit, POSE.breath], fps: 0.9, fx: 'none' },
  cast: { frames: [POSE.cheer, POSE.idle, POSE.work0], fps: 1.2, fx: 'sparkle' },
  sing: { frames: [POSE.cheer, POSE.idle], fps: 1.6, fx: 'note' },
  pray: { frames: [POSE.kneel], fps: 1, fx: 'halo' },
  beg: { frames: [POSE.kneel, POSE.sit], fps: 0.5, fx: 'none' },
  wash: { frames: [POSE.kneel, POSE.work0], fps: 1.3, fx: 'splash' },
  fish: { frames: [POSE.sit, POSE.sit, POSE.work0], fps: 0.9, fx: 'splash' },
  sell: { frames: [POSE.idle, POSE.cheer, POSE.breath], fps: 1, fx: 'none' },
  heal: { frames: [POSE.kneel, POSE.work0], fps: 0.9, fx: 'sparkle' },
  tend: { frames: [POSE.idle, POSE.breath, POSE.work0], fps: 0.8, fx: 'none' },
  stroll: { frames: [POSE.idle, POSE.breath], fps: 1, fx: 'none' },
  play: { frames: [POSE.cheer, POSE.idle], fps: 3, fx: 'none' },
};
const FEST_ANIM: Anim = { frames: [POSE.cheer, POSE.idle, POSE.cheer, POSE.breath], fps: 3.2, fx: 'note' };

export const WORK_JOB = (w: string) => NPC_JOBS.find((j) => j.work === w);
function jobFor(heroJob: string): NpcJob | undefined {
  const w = JOB_WORK[heroJob];
  return w ? WORK_JOB(w) || undefined : undefined;
}
