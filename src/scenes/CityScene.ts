import Phaser from 'phaser';
import { RNG, hashString } from '../sim/rng';
import { generateWorld, type Town } from '../sim/worldgen';
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

import { Heap } from '../world/roads';
import { T, CW, CH, Tile, getCity, type CityData, type BuildingRec, type Pt } from '../city/citygen';

const TEMPLE_ICON: Record<string, string> = { light: 'bless', dragon: 'dragon', sea: 'river', moon: 'moon', war: 'weapon', demon: 'demon', naga: 'snake', nature: 'leaf', ancestor: 'death' };
const HEAD = 30; // px above a person's feet where bubbles and marks sit
const DAY_LEN = 150; // seconds of real time for a full day in town

interface Anim { frames: number[]; fps: number; fx?: 'spark' | 'dust' | 'chip' | 'steam' | 'splash' | 'sparkle' | 'note' | 'halo' | 'none' }

// A person in town: a sprite that walks with a step cycle, works with its hands and goes home at night
interface Person {
  id?: number; name: string; race: string; role: string; look: Look;
  img: Phaser.GameObjects.Image; root: Phaser.GameObjects.Image | Phaser.GameObjects.Container; hero?: boolean;
  job?: NpcJob; skill?: number; goal?: string;
  state: 'idle' | 'move' | 'act' | 'locked'; wait: number; actT: number; frame: number; carry: boolean; speed: number; moveSpeed?: number;
  to?: Pt; path?: Pt[]; then?: () => void; act?: Anim; actEnd?: number; fx: number; tag: number; asleep: boolean; goesHome: boolean; frozen?: boolean;
  mark?: Phaser.GameObjects.Image; onRemove?: () => void;
  home?: Pt; work?: Pt; roam: number;
}

export class CityScene extends Phaser.Scene {
  game_: Game | null = null;
  town!: Town;
  plan!: CityData;
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
  onNews: (text: string) => void = () => {};
  follow = false; // only when the player asks (the target button, or flying to the protagonist's own town)
  private ambientT = 0;
  private hovered: Person | null = null;
  private nav!: Uint8Array; // 0 = blocked; otherwise the cost of stepping on the tile (streets are cheapest)
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

  // The town lives on the world map: WorldScene owns the camera and calls syncCamera every frame, so zooming in from the
  // continent to the street is one continuous move. This scene only adds the people, light and weather on top.
  create() {
    this.rng = new RNG(hashString('folk' + this.town.id));
    const data = getCity(this.town, this.country);
    this.plan = data;
    this.grid = data.grid;
    this.buildings = data.buildings;
    this.walk = data.walk;
    this.spec = data.spec;
    this.computeSpots(this.buildings);
    this.buildNav();

    // temple of the land's faith
    const temple = this.buildings.find((b) => b.kind === 'temple');
    const relIcon = TEMPLE_ICON[this.country.religion];
    if (temple && relIcon) {
      const ic = this.add.image((temple.x + temple.w / 2) * T, temple.y * T - 4, iconTex(this, relIcon, 2)).setDepth(3);
      this.tweens.add({ targets: ic, y: ic.y - 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // the light of the hour covers everything in view (the map under the town too); flood water and window glow stay on the plan
    this.cameras.main.setRoundPixels(false); // the world scene drives this camera at fractional positions
    const W = CW * T, H = CH * T;
    this.dayT = DAY_LEN * (0.18 + this.rng.next() * 0.3);
    this.shade = this.add.rectangle(W / 2, H / 2, W * 4, H * 4, 0x101840, 0).setDepth(50);
    this.flood = this.add.rectangle(0, H * 0.55, W, H * 0.45, 0x3f82b8, 0).setOrigin(0).setDepth(49);
    for (const b of this.buildings) this.glows.push(this.add.ellipse((b.x + b.w / 2) * T, (b.y + b.h) * T - 4, 34, 22, 0xffd070, 0).setDepth(2));
    for (const l of data.lamps) this.glows.push(this.add.ellipse(l.x, l.y - 12, 30, 24, 0xffd070, 0).setDepth(2));
    this.spawnNpcs();
    this.time.delayedCall(30, () => this.refresh());
    this.newsTimer = this.time.addEvent({ delay: 3500, loop: true, callback: () => this.townLife() });
    this.events.once('shutdown', () => this.newsTimer?.remove());
  }

  /** place this camera so the plan sits exactly where the world camera sees it (cityPx = world units / CITY_S) */
  syncCamera(zoom: number, cx: number, cy: number) {
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(cx, cy);
  }

  // Crisp small text: draw at 4× the size and scale down (setResolution is unreliable on the canvas renderer)
  txt(x: number, y: number, text: string, o: { fontFamily: string; fontSize: number; color: string; stroke?: string; strokeThickness?: number; backgroundColor?: string; pad?: number; wrap?: number }) {
    const k = 4;
    return this.add.text(x, y, text, {
      fontFamily: o.fontFamily, fontSize: `${o.fontSize * k}px`, color: o.color, stroke: o.stroke, strokeThickness: (o.strokeThickness || 0) * k,
      backgroundColor: o.backgroundColor, padding: o.pad ? { x: o.pad * k, y: (o.pad * k) / 1.5 } : undefined, wordWrap: o.wrap ? { width: o.wrap * k } : undefined,
    }).setScale(1 / k);
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
      else if (t === Tile.Road) { S.road.push(at(x, y)); if (((x - CW / 2) / this.plan.extent.rx) ** 2 + ((y - CH / 2) / this.plan.extent.ry) ** 2 > 0.62) S.gate.push(at(x, y)); }
      else if (t === Tile.Tree && y + 1 < CH && this.grid[(y + 1) * CW + x] === Tile.Ground) S.tree.push(at(x, y + 1));
      else if (t === Tile.Ground) {
        const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < CW && y + dy < CH && [Tile.Water, Tile.Void].includes(this.grid[(y + dy) * CW + x + dx]));
        if (wet) S.water.push(at(x, y));
      }
    }
    for (const b of buildings) {
      const door = at(b.x + Math.floor(b.w / 2), b.y + b.h);
      const MAP: Record<string, Place> = { house: 'home', palace: 'guild', cathedral: 'temple', library: 'guild', barracks: 'gate', granary: 'smithy', warehouse: 'dock', minehead: 'smithy', arena: 'plaza', market: 'market' };
      const place = (MAP[b.kind] || b.kind) as Place;
      S[place].push(door);
      if (b.kind !== 'house') S.home.push(door);
    }
    for (const st of this.plan.stalls) S.market.push({ x: st.x + 11, y: st.y + 26 });
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
    let n = Math.max(14, Math.min(170, Math.round(this.buildings.length * 0.85)));
    const homes = this.rng.shuffle(this.spots.home.slice());
    let hi = 0;
    const nextHome = () => homes[hi++ % homes.length];
    const g = this.game_;
    if (g) {
      const REL_ICON: Record<string, string> = { mentor: 'mentor', rival: 'rival', lover: 'lover', spouse: 'spouse', nemesis: 'nemesis', friend: 'friend', parent: 'parent' };
      // people with lives of their own who live here: the town notables and anyone in the protagonist's life
      for (const p of g.s.npcs.filter((x) => x.alive && x.townId === this.town.id).slice(0, 24)) {
        const rel = g.c.relations.find((r) => r.npcId === p.id && r.alive);
        const job = p.job ? npcJob(p.job) : undefined;
        const per = this.addPerson({ race: p.race, role: rel ? relRole(rel.type) : job?.role || p.role, name: p.name, id: p.id, job, skill: p.skill, goal: goalText(p), elder: p.hAge >= 60, gender: undefined, home: nextHome() });
        if (rel) per.mark = this.add.image(per.root.x, per.root.y - HEAD - 4, iconTex(this, REL_ICON[rel.type] || 'friend', 1)).setDepth(40);
        n--;
      }
    }
    const fest = this.festival();
    if (flags.includes('plague')) n = Math.round(n * 0.6);
    if (flags.includes('golden') || fest) n += 12;
    for (let i = 0; i < n; i++) {
      const race = this.rng.weighted(co.races, (r) => r.w)!.race;
      const kid = this.rng.chance(0.13);
      let job = kid ? undefined : pickTownJob(this.rng, this.town.id, co, race);
      if (flags.includes('war') && i < 3) job = npcJob('guard');
      if (flags.includes('famine') && i < 2) job = npcJob('beggar');
      this.addPerson({ race, role: kid ? 'เด็ก' : job!.role, job, elder: !kid && this.rng.chance(0.12), home: nextHome() });
    }
  }

  addPerson(o: { race: string; role: string; name?: string; id?: number; job?: NpcJob; skill?: number; goal?: string; elder?: boolean; gender?: string; at?: Pt; hero?: boolean; look?: Look; home?: Pt }): Person {
    const nm = o.name || makeName(this.rng, o.race);
    const look = o.look || lookFor(`${nm}@${this.town.id}`, o.race, o.role, { climate: this.country.climate, gender: o.gender, elder: o.elder });
    const raw = o.at || (o.home ? { x: o.home.x + this.rng.int(-10, 10), y: o.home.y + this.rng.int(4, 16) } : this.tilePos(this.rng.pick(this.walk)));
    const p0 = o.at ? raw : this.snapOpen(raw);
    const key = personFrames(this, look, 1);
    const img = this.add.image(0, 0, key, POSE.idle).setOrigin(0.5, 1);
    const per: Person = {
      id: o.id, name: nm, race: o.race, role: o.role, look, img, root: img, job: o.job, skill: o.skill ?? this.rng.int(10, 80), goal: o.goal, hero: !!o.hero,
      state: 'idle', wait: this.rng.float(0.1, 3), actT: 0, frame: 0, carry: false, speed: look.child ? 46 : look.elder ? 22 : this.rng.float(30, 40), fx: 0, tag: 0, asleep: false,
      goesHome: this.rng.chance(0.75), home: o.home, roam: this.rng.float(6, 14),
    };
    if (o.job && o.home) per.work = this.spot(o.job.place);
    if (!o.goal && o.job) per.goal = this.randomGoal(per);
    img.setPosition(p0.x, p0.y).setDepth(5);
    this.npcs.push(per);
    return per;
  }

  /**
   * Hover info for the person under the cursor. Nothing here is a Phaser "interactive" object on purpose: the scene on top captures
   * every pointer event that lands on one of its interactive objects, so a crowd of clickable people would swallow the drag and the
   * wheel that belong to the map underneath. WorldScene feeds the pointer in instead.
   */
  hoverAt(sx: number, sy: number) {
    const wp = this.cameras.main.getWorldPoint(sx, sy);
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.asleep || n.hero || !n.root.active || n === this.mother) continue;
      if (Math.abs(wp.x - n.root.x) < 9 && wp.y < n.root.y + 2 && wp.y > n.root.y - 26) {
        if (this.hovered !== n) { this.hovered = n; this.bubble(n.root, this.describe(n), 3000, '#2a2438'); }
        return;
      }
    }
    this.hovered = null;
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
      this.go(p, p.home ? { x: p.home.x + this.rng.int(-3, 3), y: p.home.y } : this.spot('home', here), p.speed, () => { p.asleep = true; this.tweens.add({ targets: p.root, alpha: 0, duration: 500 }); p.wait = 2; });
      return;
    }
    if (p.asleep) { p.asleep = false; this.tweens.add({ targets: p.root, alpha: 1, duration: 500 }); }
    // everyone lives in their own corner of town: they work, rest and roam near it, and only a festival pulls them to the square
    const base = p.home || here;
    if (this.festival() && this.rng.chance(0.3)) {
      this.go(p, this.spot('plaza'), p.speed * 1.2, () => this.doAct(p, FEST_ANIM, this.rng.float(5, 10)));
      return;
    }
    if (p.look.child) {
      if (this.rng.chance(0.5)) this.go(p, this.nearby(base, 6), 44, () => this.doAct(p, { frames: [POSE.cheer, POSE.idle], fps: 3, fx: 'none' }, this.rng.float(1, 2.5)));
      else this.go(p, this.nearby(base, 4), 38, () => { p.wait = this.rng.float(2, 6); });
      return;
    }
    if (p.look.elder && this.rng.chance(0.5)) {
      this.go(p, this.nearby(base, 5), p.speed, () => this.doAct(p, { frames: [POSE.sit], fps: 1, fx: 'none' }, this.rng.float(8, 18)));
      return;
    }
    if (p.job && this.rng.chance(0.85)) { this.doJob(p, p.job); return; }
    if (this.rng.chance(0.25)) { // stop and chat with a neighbour
      const near = this.npcs.filter((x) => x !== p && x.state !== 'locked' && !x.asleep && Math.hypot(x.root.x - here.x, x.root.y - here.y) < T * 12);
      const o = near.length ? this.rng.pick(near) : undefined;
      if (o) {
        this.go(p, { x: o.root.x + (p.root.x < o.root.x ? -12 : 12), y: o.root.y }, p.speed, () => {
          p.img.setFlipX(o.root.x < p.root.x);
          this.doAct(p, { frames: [POSE.idle, POSE.breath], fps: 1.6, fx: 'none' }, this.rng.float(3, 6));
          if (this.rng.chance(0.5)) this.emote(p, 'bubble');
        });
        return;
      }
    }
    this.go(p, this.nearby(base, p.roam), p.speed, () => { p.wait = this.rng.float(3, 9); });
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
    if (w === 'stroll') { this.go(p, this.nearby(p.home || here, 10), p.speed * 0.6, () => { p.wait = this.rng.float(4, 9); }); return; }
    if (w === 'hunt') { this.go(p, this.spot('gate'), p.speed, () => { this.go(p, this.spot('tree'), p.speed, () => this.doAct(p, ANIM.tend, 4)); }); return; }
    if (w === 'serve') { this.go(p, this.spot('tavern', here), p.speed, () => { p.carry = true; this.go(p, this.spot('plaza'), p.speed, () => { p.carry = false; this.emote(p, 'mug'); p.wait = 1; }); }); return; }
    const at = p.work ? { x: p.work.x + this.rng.int(-8, 8), y: p.work.y + this.rng.int(-3, 3) } : this.spot(job.place, here);
    this.go(p, at, p.speed, () => {
      this.doAct(p, A || ANIM.tend, this.rng.float(10, 24));
      if (w === 'sell') this.bubble(p.root, this.rng.pick(['ของสดจ้า!', 'ลดราคา วันนี้วันเดียว', 'มาดูก่อนได้นะ', 'ของดีราคาถูก']), 2200);
      if (this.rng.chance(0.25) && p.goal) this.bubble(p.root, `อยาก${p.goal.replace(/^อยาก/, '')}`, 2800, '#4a3a6a');
    });
  }

  // ---------- walking: people follow streets and open ground, never through walls, houses, trees or water ----------
  private buildNav() {
    const nav = new Uint8Array(CW * CH);
    for (let i = 0; i < nav.length; i++) {
      const t = this.grid[i];
      nav[i] = t === Tile.Road || t === Tile.Plaza || t === Tile.Dock ? 2 : t === Tile.Ground || t === Tile.Field || t === Tile.Grave ? 4 : 0;
    }
    this.nav = nav;
  }

  /** the tile of a point (feet position) */
  private tileOf(p: Pt) { return { x: Math.max(0, Math.min(CW - 1, Math.floor(p.x / T))), y: Math.max(0, Math.min(CH - 1, Math.floor(p.y / T))) }; }

  /** the closest walkable tile to (x, y), searching outward in rings */
  private nearestOpen(x: number, y: number): { x: number; y: number } | null {
    for (let r = 0; r < 24; r++) {
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || !this.nav[ny * CW + nx]) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x: nx, y: ny }; }
      }
      if (best) return best;
    }
    return null;
  }

  /** a point moved to the nearest walkable tile (people never start inside a house) */
  private snapOpen(p: Pt): Pt {
    const t = this.tileOf(p);
    if (this.nav[t.y * CW + t.x]) return p;
    const n = this.nearestOpen(t.x, t.y);
    return n ? { x: n.x * T + T / 2, y: n.y * T + T - 2 } : p;
  }

  /** A* over the walkable tiles: waypoints (feet positions) from `from` to `to`, or null if there is no way */
  route(from: Pt, to: Pt): Pt[] | null {
    const a0 = this.tileOf(from), b0 = this.tileOf(to);
    const a = this.nav[a0.y * CW + a0.x] ? a0 : this.nearestOpen(a0.x, a0.y), b = this.nav[b0.y * CW + b0.x] ? b0 : this.nearestOpen(b0.x, b0.y);
    if (!a || !b) return null;
    const start = a.y * CW + a.x, goal = b.y * CW + b.x;
    if (start === goal) return [];
    const g = new Float32Array(CW * CH).fill(1e9), from_ = new Int32Array(CW * CH).fill(-1), closed = new Uint8Array(CW * CH);
    const open = new Heap();
    g[start] = 0; open.push(0, start);
    let expanded = 0;
    while (open.size && expanded < 14000) {
      const cur = open.pop();
      if (closed[cur]) continue;
      closed[cur] = 1; expanded++;
      if (cur === goal) break;
      const cx = cur % CW, cy = (cur - cx) / CW;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        const ni = ny * CW + nx, cost = this.nav[ni];
        if (!cost || closed[ni]) continue;
        if (dx && dy && (!this.nav[cy * CW + nx] || !this.nav[ny * CW + cx])) continue; // no cutting a corner of a house
        const ng = g[cur] + cost * (dx && dy ? 1.41 : 1);
        if (ng >= g[ni]) continue;
        g[ni] = ng; from_[ni] = cur;
        const ddx = Math.abs(nx - b.x), ddy = Math.abs(ny - b.y);
        open.push(ng + 2 * (Math.max(ddx, ddy) + 0.41 * Math.min(ddx, ddy)), ni);
      }
    }
    if (from_[goal] < 0) return null;
    const pts: Pt[] = [];
    for (let n = goal; n !== start; n = from_[n]) pts.push({ x: (n % CW) * T + T / 2, y: Math.floor(n / CW) * T + T - 2 });
    pts.reverse();
    // drop waypoints that lie on a straight run
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = i ? pts[i - 1] : { x: (a.x) * T + T / 2, y: a.y * T + T - 2 }, p1 = pts[i], p2 = pts[i + 1];
      if (p2 && Math.sign(p1.x - p0.x) === Math.sign(p2.x - p1.x) && Math.sign(p1.y - p0.y) === Math.sign(p2.y - p1.y)) continue;
      out.push(p1);
    }
    return out;
  }

  go(p: Person, to: Pt, speed: number, then: () => void) {
    p.state = 'move'; p.moveSpeed = speed; p.then = then; p.actEnd = 0;
    const path = this.route({ x: p.root.x, y: p.root.y }, to);
    if (!path) { p.to = { x: p.root.x, y: p.root.y }; p.path = []; return; } // nowhere to walk: stay put
    // the last leg ends exactly where it was asked (within its own tile) so people stand at doors and stalls
    const lastTile = path.length ? this.tileOf(path[path.length - 1]) : this.tileOf({ x: p.root.x, y: p.root.y });
    const dest = this.nav[this.tileOf(to).y * CW + this.tileOf(to).x] && this.tileOf(to).x === lastTile.x && this.tileOf(to).y === lastTile.y ? to : (path.pop() ?? { x: p.root.x, y: p.root.y });
    p.path = path; p.to = dest;
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
    for (const n of this.npcs) if (n.mark) n.mark.setPosition(n.root.x, n.root.y - HEAD - 4);
  }

  step(p: Person, dt: number) {
    const r = p.root;
    r.setDepth(5 + r.y / 1000);
    if (p.state === 'move' && p.to) {
      const tgt = p.path && p.path.length ? p.path[0] : p.to;
      const dx = tgt.x - r.x, dy = tgt.y - r.y, d = Math.hypot(dx, dy);
      const sp = (p.moveSpeed || p.speed) * dt;
      if (d <= sp + 0.5) {
        r.setPosition(tgt.x, tgt.y);
        if (p.path && p.path.length) { p.path.shift(); return; }
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
    const x = p.root.x + (p.img.flipX ? -6 : 6), y = p.root.y - 3;
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
    const t = this.txt(target.x, target.y - HEAD, text, {
      fontFamily: 'Sarabun, sans-serif', fontSize: 7, color: bg === '#fff8e0' ? '#1b1626' : '#ffffff', backgroundColor: bg, pad: 3, wrap: 120,
    }).setOrigin(0.5, 1).setDepth(60);
    this.tweens.add({ targets: t, y: t.y - 8, alpha: { from: 1, to: 0 }, delay: ms - 500, duration: 500, onComplete: () => t.destroy() });
    return t;
  }

  emote(p: Person, icon: string) {
    const e = this.add.image(p.root.x, p.root.y - HEAD - 2, iconTex(this, icon, 1)).setDepth(61);
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
      const side = b.root.x < a.root.x ? -17 : 17;
      const meet = this.nav[this.tileOf({ x: a.root.x + side, y: a.root.y }).y * CW + this.tileOf({ x: a.root.x + side, y: a.root.y }).x] ? { x: a.root.x + side, y: a.root.y } : { x: a.root.x, y: a.root.y };
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
    const legs = this.route({ x: p.root.x, y: p.root.y }, to);
    if (legs === null) { done(); return; }
    legs.push(to);
    let t = 0;
    const ev = this.time.addEvent({ delay: 110, loop: true, callback: () => { t++; p.img.setFrame(WALK[t % 4]); } });
    const next = () => {
      const leg = legs.shift();
      if (!leg || !p.root.active) { ev.remove(); p.img.setFrame(POSE.idle); done(); return; }
      const d = Math.hypot(leg.x - p.root.x, leg.y - p.root.y);
      if (Math.abs(leg.x - p.root.x) > 0.5) p.img.setFlipX(leg.x < p.root.x);
      this.tweens.add({ targets: p.root, x: leg.x, y: leg.y, duration: Math.max(60, (d / 40) * 1000), onComplete: next });
    };
    next();
  }

  brawl(a: Person, b: Person, text: string) {
    a.state = b.state = 'locked';
    this.tweens.killTweensOf([a.root, b.root]);
    b.root.setPosition(this.nav[this.tileOf({ x: a.root.x + 20, y: a.root.y }).y * CW + this.tileOf({ x: a.root.x + 20, y: a.root.y }).x] ? a.root.x + 20 : a.root.x, a.root.y);
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
    // the country's own air: embers over a war camp, fog over Nebulia, drifting leaves in the groves, sand, clouds low on a sky island
    const amb = this.plan.theme.ambient;
    const ex = (CW / 2 + rnd(-1, 1) * this.plan.extent.rx) * T, ey = (CH / 2 + rnd(-1, 1) * this.plan.extent.ry) * T;
    if (amb === 'embers') bit(this.rng.pick([0xffb030, 0xf06a20, 0xffe680]), ex, ey, rnd(-10, 10), -rnd(30, 70), 1800, 2);
    else if (amb === 'smoke') { const b = this.buildings.find((x, i) => x.style === 'brick' && i % 3 === 0); if (b && this.rng.chance(0.7)) bit(0x6a6a70, (b.x + b.w) * T - 6, b.y * T - 8, rnd(6, 16), -rnd(28, 50), 2600, 4); }
    else if (amb === 'leaves') bit(this.rng.pick([0x6acb6a, 0xe8e0a0, 0x9be07a]), ex, -4, rnd(-30, 30), H, 5200, 2);
    else if (amb === 'sand' && this.rng.chance(0.6)) bit(0xe8c880, -4, ey, W + 20, rnd(0, 20), 2600, 2);
    else if (amb === 'fog' && this.rng.chance(0.5)) bit(0xdcdcf0, -10, ey, W + 40, rnd(-10, 10), 6500, 14);
    else if (amb === 'clouds' && this.rng.chance(0.3)) bit(0xffffff, -10, ey, W + 40, rnd(-10, 10), 7000, 10);
    else if (amb === 'gulls' && this.rng.chance(0.15)) bit(0xf4f4f4, -6, rnd(0, H * 0.5), W + 20, rnd(-20, 20), 6000, 3);
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
      const img = this.add.image(0, 0, personFrames(this, look, 1), POSE.idle).setOrigin(0.5, 1);
      const name = this.txt(0, -HEAD, g.c.name, { fontFamily: 'Sarabun, sans-serif', fontSize: 7, color: '#ffe680', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 1);
      const root = this.add.container(home.x, home.y, [ring, img, name]).setDepth(6);
      const per: Person = {
        name: g.c.name, race: g.c.race, role: g.c.job || 'ชาวบ้าน', look, img, root, hero: true, state: 'idle', wait: 1, actT: 0, frame: 0, carry: false,
        speed: 34, fx: 0, tag: 0, asleep: false, goesHome: false, skill: 50, roam: 10,
      };
      this.hero = per;
      this.heroForm = '';
      this.setHeroForm(true);
      // an encounter that was already waiting when we arrived
      const mid = g.s.pending?.monsterId;
      const m = mid && MONSTERS.find((x) => x.id === mid);
      if (m) this.time.delayedCall(400, () => this.startBattle(m.icon));
    } else if (!this.heroHere() && this.hero) {
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
      h.img.setAngle(0).setTexture(personFrames(this, look, 1), POSE.idle).setOrigin(0.5, 1);
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
    this.monster = this.add.image(h.root.x + 120, h.root.y, iconTex(this, icon, 3)).setOrigin(0.5, 1).setDepth(7).setFlipX(true);
    this.tweens.add({ targets: this.monster, x: h.root.x + 40, duration: 900, ease: 'Quad.out' });
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
