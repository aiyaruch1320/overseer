import type Phaser from 'phaser';
import { Game, COSTS, SEASONS, giftCost, BIRTH_TIME_TH, BIRTH_SIGN_TH, type Meta } from '../sim/game';
import type { Storylet, LogEntry, StatKey, Axis, Choice } from '../sim/types';
import { STATS, STAT_NAMES, AXES, AXIS_NAMES, STAGE_NAMES, TONE_ICON } from '../sim/types';
import { WorldScene, drawPortrait, Z } from '../scenes/WorldScene';
import { Sky } from './sky';
import { WEATHER_TH } from '../sim/society';
import type { CityScene } from '../scenes/CityScene';
import { CONTINENTS, RELIGIONS, generateWorld } from '../sim/worldgen';
import { maxHp, realAge, tagsOf } from '../sim/character';
import { RACES, raceById, climateById } from '../data/races';
import { TRAITS, APTITUDES, SKILLS, aptById, skillById, traitById } from '../data/traits';
import { BLESSINGS, CURSES, giftById, type Gift } from '../data/gifts';
import { JOBS, SYMBOLS, FATES, MONSTERS, fateById, jobById } from '../data/lore';
import { STORYLETS } from '../data/storylets';
import { RARITY, THREAD_NAMES, type Rarity } from '../sim/fortune';
import { Narrator } from '../llm/narrator';
import { Cloud } from '../net/cloud';
import { ic } from './icons';
import { installTips } from './tips';
import { PRAYERS, QUESTS, MAP_POWERS } from '../data/prayers';
import { sanitizeSetup, parseSetupLocal, describeSetup, type Setup } from '../sim/setup';
import { relRole, heroActor, demonActor, actorPos, goalText } from '../sim/society';
import type { Spectacle } from '../sim/types';
import { playScene } from './cine';
import { townSpecialty, countryFestivals } from '../sim/locale';
import { npcJob } from '../data/npclife';
import { DISASTERS } from '../data/disasters';
import { REGION_EVENTS } from '../data/people';

const SAVE_KEY = 'isekai.save.v1';
const META_KEY = 'isekai.meta.v1';
const SPEED_MS: Record<number, number> = { 1: 1500, 3: 500, 10: 140 };
const THREAD_FX: Record<string, string> = {
  holy: 'พร/อาวุธแห่งแสง นิมิตศักดิ์สิทธิ์ อาชีพนักบุญ', dark: 'พลังมืด ผู้อุปถัมภ์ในเงา ลิช/ราชาปีศาจ', warrior: 'อาวุธ ศึกประลอง อาชีพสายนักรบ',
  hero: 'ผู้คนมาขอความช่วยเหลือ พรวีรชน', arcane: 'ตำราเวท อาชีพนักเวท', greed: 'โอกาสทางการค้า โจรหมายตา', faithful: 'นิมิต ฝันชัด พรศักดิ์สิทธิ์',
  romance: 'ความรัก เสน่ห์', wanderer: 'การเดินทาง สมบัติ', rebel: 'การต่อต้าน ผู้นำคนส่วนน้อย', outlaw: 'สมาคมเงา ทักษะลอบเร้น', wild: 'สัตว์คู่หู พรแห่งพงไพร',
};
const THREAD_BY_NAME = Object.fromEntries(Object.entries(THREAD_NAMES).map(([k, v]) => [v, k]));

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// escape, then turn :icon: tokens into pixel icons
const rich = (s: unknown, size = 18) => esc(s).replace(/:([a-z_]+):/g, (_m, name: string) => ic(name, size));
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const rar = (r: Rarity) => `<span class="rar" style="color:${RARITY[r].color};border-color:${RARITY[r].color}">${RARITY[r].name}</span>`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Tab = 'char' | 'fate' | 'world' | 'codex';
type LogFilter = 'all' | 'life' | 'god' | 'world';

export class UI {
  scene: WorldScene;
  city: CityScene;
  game: Game | null = null;
  meta: Meta;
  narrator = new Narrator();
  cloud = new Cloud();
  speed = 0;
  lastSpeed = 1;
  tab: Tab = 'char';
  acc = 0;
  last = 0;
  modalOpen = false;
  minimized = false;
  tiltOpen = -1;
  view: 'world' | 'city' = 'world';
  cityTown = -1;
  selectedCountry: number | null = null;
  selectedTown: number | null = null;
  epitaph = '';
  dirty = true;
  zoomLevel = 'โลก';
  logFilter: LogFilter = 'all';
  dockH = 220;
  dockOpen = true;
  targeting: string | null = null;
  questPick: string | null = null;
  private logSig = '';
  sky!: Sky;
  private panelScroll = 0;
  private lastPendingMonster: string | null = null;
  private pendingSetup: Setup | null = null;
  private wishText = '';
  autoMode = false;
  sideFold = false;
  godFold = false;
  cinePause = true;
  cineOpen = false;
  private cineQ: Spectacle[] = [];
  private cineStop: (() => void) | null = null;
  private bannerStop: (() => void) | null = null;
  private bannerTimer = 0;

  constructor(scene: WorldScene, city: CityScene) {
    this.scene = scene;
    this.city = city;
    let meta: Meta = { karma: 0, codex: [], lives: [], racesPlayed: [] };
    try { meta = { ...meta, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch { /* fresh */ }
    this.meta = meta;
  }

  get phaser(): Phaser.Game { return this.scene.game; }

  async start() {
    await this.narrator.init();
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
    installTips();
    this.sky = new Sky($('#sky') as unknown as HTMLCanvasElement);
    try { this.dockH = Number(localStorage.getItem('isekai.dockH')) || 220; this.dockOpen = localStorage.getItem('isekai.dockOpen') !== 'off'; } catch { /* defaults */ }
    try {
      this.autoMode = localStorage.getItem('isekai.auto') === 'on';
      this.sideFold = localStorage.getItem('isekai.sideFold') === 'on';
      this.godFold = localStorage.getItem('isekai.godFold') === 'on';
      this.cinePause = localStorage.getItem('isekai.cinePause') !== 'off';
    } catch { /* defaults */ }
    document.getElementById('app')!.classList.toggle('sidefold', this.sideFold);
    $('#mapwrap').insertAdjacentHTML('beforeend', '<div class="sidetab" data-act="sidetab" title="เปิดแผงข้อมูล">แผงข้อมูล</div>');
    this.applyDock();
    this.installDockResize();
    this.fitMap();
    window.addEventListener('beforeunload', () => this.save());
    this.scene.onCountryClick = (id) => {
      if (this.targeting) { this.castAt(id); return; }
      this.selectedCountry = id; this.selectedTown = null; this.tab = 'world'; this.dirty = true;
    };
    this.scene.onTownClick = (id) => { this.selectedTown = id; this.selectedCountry = generateWorld().towns[id].countryId; this.tab = 'world'; this.dirty = true; };
    this.scene.onEnterTown = (id) => this.enterCity(id);
    this.scene.onZoom = (lv) => { if (lv !== this.zoomLevel) { this.zoomLevel = lv; this.renderMapCtl(); } };
    this.scene.onCityChange = (id) => {
      this.cityTown = id;
      this.view = id >= 0 ? 'city' : 'world';
      this.renderMapCtl();
    };
    this.city.onNews = (text) => {
      const g = this.game;
      if (!g) return;
      g.s.townNews.unshift({ year: Math.floor(g.s.year), age: g.age(), text: `${generateWorld().towns[this.cityTown]?.name || ''}: ${text}`, kind: 'world' });
      g.s.townNews.length = Math.min(g.s.townNews.length, 40);
      if (this.tab === 'world') this.dirty = true;
    };
    this.showTitle();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ================= views: the city is the map, seen close up =================
  // One continuous camera: flying "into" a town is just zooming and panning; the view flips to 'city'
  // by itself (onCityChange) once the camera is close enough for the town to come alive.
  enterCity(townId: number) {
    const g = this.game;
    this.city.follow = !!g && g.c.townId === townId;
    this.scene.flyToTown(townId);
  }

  exitCity(_animate = false) {
    this.scene.flyOut();
  }

  cityActive() { return this.view === 'city' && this.phaser.scene.isActive('city'); }

  // ================= persistence =================
  save(force = false) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
      if (this.game) {
        const json = JSON.stringify(this.game.s);
        localStorage.setItem(SAVE_KEY, json);
        this.cloud.uploadSave(JSON.stringify({ meta: this.meta, state: this.game.s }), force);
      }
    } catch { /* storage full or blocked */ }
  }

  // no local save on this device: try the cloud copy
  async restoreFromCloud(): Promise<boolean> {
    const raw = await this.cloud.downloadSave();
    if (!raw) return false;
    try {
      const { meta, state } = JSON.parse(raw);
      this.meta = { ...this.meta, ...meta };
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return this.loadSave();
    } catch { return false; }
  }

  loadSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.attach(new Game(JSON.parse(raw), this.meta));
      return true;
    } catch { return false; }
  }

  attach(g: Game) {
    this.game = g;
    g.hooks = {
      onLog: () => { this.dirty = true; },
      onMove: () => { this.scene.refresh(); if (this.cityActive()) this.city.refresh(); },
      onSecretJob: (id) => this.toast(`:book: Codex ใหม่! ปลดล็อกอาชีพลับ「:${jobById(id).icon}: ${jobById(id).name}」`),
      onImportant: (kind, ctx) => this.narrate(kind, ctx),
      onNpcEvent: (id, text) => { if (this.cityActive()) this.city.npcSay(id, text); },
      onPrayer: () => { if (this.speed > 1) this.setSpeed(1); this.toast(':faith: มีคำอธิษฐานส่งถึงคุณ (มุมขวาบนของแผนที่)'); },
      onOmen: (text) => this.toast(`:omen: ลางบอกเหตุ: ${text}`),
      onSpectacle: (s) => { this.cineQ.push(this.cinePause ? s : { ...s, pause: false }); },
      onAuto: (event, choice, ok) => this.toast(`:scroll: ตัวละครตัดสินใจเอง: ${choice}${ok === null ? '' : ok ? ' (สำเร็จ)' : ' (พลาด)'}`),
      onQuest: (name) => { this.toast(`:miracle: พันธกิจสำเร็จ!「${name}」`); this.cloud.track('quest_done', { name }); },
    };
    g.pauseOnChoices = localStorage.getItem('isekai.pauseAll') === 'on';
    g.autoDecide = this.autoMode;
    this.scene.setGame(g);
    this.city.setGame(g);
    this.scene.refresh(true);
    this.dirty = true;
  }

  // ================= extra narration =================
  narrate(kind: string, ctx: Record<string, string>) {
    const g = this.game;
    if (!g || !this.narrator.active) return;
    if (kind === 'fate') this.narrator.fate(ctx).then((t) => { if (t && g === this.game) g.log(`:miracle: ${t}`, 'llm', 'warm'); });
    if (kind === 'dream') this.narrator.dream(ctx).then((t) => { if (t && g === this.game) g.log(`:bubble: ${t}`, 'llm'); });
    if (kind === 'flavor') this.narrator.flavor(ctx).then((r) => {
      if (!r || g !== this.game || !g.c.alive) return;
      g.applyFx(r.fx, {});
      g.log(`:miracle: ${r.text}`, 'llm');
    });
    if (kind === 'death') {
      this.narrator.epitaph({ ...ctx, summary: g.summaryLine(), title: g.title() }).then((t) => {
        if (!t) return;
        this.epitaph = t;
        const el = document.getElementById('epitaph');
        if (el) el.textContent = `“${t}”`;
      });
    }
  }

  // ================= main loop =================
  loop(t: number) {
    const dt = Math.min(500, t - (this.last || t));
    this.last = t;
    const g = this.game;
    if (g && this.speed > 0 && !this.modalOpen && !this.cineOpen && !this.minimized && g.c.alive) {
      this.acc += dt;
      const ms = SPEED_MS[this.speed];
      let steps = 0;
      while (this.acc >= ms && steps < 4) {
        this.acc -= ms;
        steps++;
        const r = g.tick();
        this.dirty = true;
        if (g.s.tick % 12 === 0) this.save();
        if (r.paused) { this.acc = 0; this.handlePending(); break; }
      }
      if (steps) { this.scene.refresh(); if (this.cityActive()) this.city.refresh(); }
    }
    if (this.cineQ.length && !this.cineOpen) this.flushCine();
    if (this.dirty) { this.render(); this.dirty = false; }
    this.skyFrame(dt);
    requestAnimationFrame((tt) => this.loop(tt));
  }

  skyFrame(dt: number) {
    const g = this.game;
    const countries = g?.s.countries;
    if (this.scene.cameras?.main) {
      this.sky.mode = 'world';
      const v = this.scene.view();
      this.sky.view = { ...v, townZoom: Z.town };
      this.sky.weather = (countries && v.country >= 0 && countries[v.country].weather) || 'clear';
    }
    this.sky.frame(dt);
  }

  setSpeed(v: number) {
    if (v > 0) this.lastSpeed = v;
    this.speed = v;
    this.acc = 0;
    this.dirty = true;
  }

  handlePending() {
    const g = this.game!;
    const p = g.s.pending;
    if (!p) return;
    if (this.cineOpen || this.cineQ.some((s) => s.pause)) return; // the scene plays first; closing it brings the event back
    if (p.kind === 'omen') this.showOmen();
    else if (p.kind === 'death') { this.minimized = false; this.hideDock(); this.showDeathDoor(); }
    else {
      // show it in town too
      if (this.cityActive() && this.lastPendingMonster !== (p.monsterId || null)) {
        if (p.monsterId) { const m = MONSTERS.find((x) => x.id === p.monsterId); if (m) this.city.startBattle(m.icon); }
        else this.city.alert('!');
      }
      this.lastPendingMonster = p.monsterId || null;
      if (this.minimized) this.showDock(); else this.showEvent();
    }
  }

  // ================= rendering =================
  render() {
    this.renderTop();
    this.renderPanel();
    this.renderGodbar();
    this.renderMapCtl();
    this.renderLog();
    this.renderPrayers();
  }

  // the map canvas follows its container (panels folding changes the container's size)
  fitMap() {
    requestAnimationFrame(() => {
      const h = $('#map');
      this.phaser.scale.resize(Math.max(320, h.clientWidth), Math.max(240, h.clientHeight));
    });
  }

  // ---------- cutscenes for big happenings ----------
  // Region-scale disasters that hit the protagonist's land stop time and play a short animated scene; the rest
  // (festivals, things in neighbouring lands) appear as a small banner that never blocks play.
  flushCine() {
    const q = this.cineQ.splice(0);
    const big = q.find((s) => s.pause);
    for (const s of q) if (!s.pause) this.showBanner(s);
    if (big) this.showCine(big);
  }

  private cineHtml(s: Spectacle, banner: boolean) {
    const kicker = s.mine ? (s.pause ? 'เหตุการณ์ใหญ่ในดินแดนของตัวละคร' : 'เกิดขึ้นในดินแดนของตัวละคร') : 'เกิดขึ้นใกล้ ๆ ดินแดนของตัวละคร';
    return `<div class="${banner ? 'cine-banner' : 'cine-card'} ${esc(s.tone)}" ${banner ? 'data-act="cineclose"' : ''}>
      <canvas></canvas>
      <div class="cine-body"><div class="cine-kicker">${ic(s.pause ? 'warning' : 'omen', 14)} ${kicker}</div><h2>${esc(s.title)}</h2><div class="cine-text">${esc(s.text)}</div>
      ${banner ? '' : `<div class="actions" style="margin:0"><button class="btn primary" data-act="cineclose">${ic('play', 14)} ดำเนินต่อ</button></div>`}</div></div>`;
  }

  showCine(s: Spectacle) {
    this.cineOpen = true;
    this.hideBanner();
    $('#cine').insertAdjacentHTML('beforeend', `<div class="cine-back" id="cineback">${this.cineHtml(s, false)}</div>`);
    this.cineStop = playScene($('#cineback').querySelector('canvas')!, s.anim);
    this.cloud.track('cine', { anim: s.anim });
    this.dirty = true;
  }

  closeCine() {
    this.cineStop?.(); this.cineStop = null;
    document.getElementById('cineback')?.remove();
    this.cineOpen = false;
    this.dirty = true;
    if (this.game?.s.pending && !this.modalOpen) this.handlePending();
    else if (this.cineQ.length) this.flushCine();
  }

  showBanner(s: Spectacle) {
    this.hideBanner();
    $('#cine').insertAdjacentHTML('beforeend', `<div id="cinebanner">${this.cineHtml(s, true)}</div>`);
    this.bannerStop = playScene($('#cinebanner').querySelector('canvas')!, s.anim);
    this.bannerTimer = window.setTimeout(() => this.hideBanner(), 6500);
  }

  hideBanner() {
    window.clearTimeout(this.bannerTimer);
    this.bannerStop?.(); this.bannerStop = null;
    document.getElementById('cinebanner')?.remove();
  }

  // ---------- story log dock (bottom of the map, resizable, collapsible) ----------
  applyDock() {
    const h = this.dockOpen ? this.dockH : 34;
    $('#mapwrap').style.setProperty('--dock-h', `${h}px`);
    try { localStorage.setItem('isekai.dockH', String(this.dockH)); localStorage.setItem('isekai.dockOpen', this.dockOpen ? 'on' : 'off'); } catch { /* ignore */ }
    this.logSig = '';
  }

  installDockResize() {
    let start = 0, startH = 0, drag = false;
    document.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('.dockgrip')) return;
      drag = true; start = e.clientY; startH = this.dockH; e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.dockH = Math.max(90, Math.min(window.innerHeight * 0.7, startH + (start - e.clientY)));
      this.dockOpen = true;
      this.applyDock();
      this.renderLog();
    });
    document.addEventListener('mouseup', () => { drag = false; });
  }

  renderLog() {
    const g = this.game;
    const dock = $('#logdock');
    const sig = `${g ? g.s.log.length + ':' + (g.s.log.at(-1)?.text.length || 0) : 'none'}|${this.logFilter}|${this.dockOpen}`;
    if (sig === this.logSig) return;
    this.logSig = sig;
    const f = (id: LogFilter, label: string) => `<button data-act="logf" data-v="${id}" class="${this.logFilter === id ? 'on' : ''}">${label}</button>`;
    const head = `<div class="dockgrip" title="ลากเพื่อปรับขนาด"></div><div class="dockhead">${ic('scroll', 16)} <b>เรื่องราว</b>
      <div class="dockfilters">${f('all', 'ทั้งหมด')}${f('life', 'ชีวิตตัวละคร')}${f('god', 'พระเจ้า')}${f('world', 'โลก')}</div>
      <button class="iconbtn" data-act="docktoggle" title="${this.dockOpen ? 'ย่อ' : 'ขยาย'}">${ic(this.dockOpen ? 'down' : 'up', 16)}</button></div>`;
    if (!g || !this.dockOpen) { dock.innerHTML = head; return; }
    const keep = (e: LogEntry) => this.logFilter === 'all' || (this.logFilter === 'god' ? ['god', 'dream', 'llm'].includes(e.kind) : this.logFilter === 'world' ? e.kind === 'world' : !['god', 'world'].includes(e.kind));
    const body = dock.querySelector('.dockbody') as HTMLElement | null;
    const atBottom = !body || body.scrollHeight - body.scrollTop - body.clientHeight < 40;
    const items = g.s.log.filter(keep).slice(-120).map((e) => `<div class="entry ${e.tone || ''} ${e.kind}"><span class="when">ปี ${e.year} · อายุ ${e.age}</span>${rich(e.text, 16)}</div>`).join('');
    const prevTop = body?.scrollTop || 0;
    dock.innerHTML = `${head}<div class="dockbody">${items}</div>`;
    const nb = dock.querySelector('.dockbody') as HTMLElement;
    nb.scrollTop = atBottom ? nb.scrollHeight : prevTop;
  }

  // ---------- prayer cards (time keeps running) ----------
  renderPrayers() {
    const g = this.game;
    const box = $('#prayers');
    if (!g || !g.c.alive || !g.s.prayers.length) { box.innerHTML = ''; return; }
    box.innerHTML = g.s.prayers.map((card) => {
      const pr = PRAYERS.find((x) => x.id === card.id)!;
      const left = Math.max(0, (card.expires - g.s.tick) / 14);
      return `<div class="prayer" data-tip="res:prayer">
        <div class="ptitle">${ic(pr.icon, 18)} <b>คำอธิษฐาน</b><div class="bar ptimer"><i style="width:${left * 100}%"></i></div></div>
        <div class="ptext">${esc(g.fill(pr.text, card.vars))}</div>
        <div class="pacts">
          <button class="btn faith" data-act="pray" data-v="grant" data-i="${card.uid}" ${g.s.faith >= pr.grant.cost ? '' : 'disabled'}>${ic('bless', 13)} ประทาน ${pr.grant.cost}</button>
          <button class="btn" data-act="pray" data-v="deny" data-i="${card.uid}">เพิกเฉย</button>
          <button class="btn dread" data-act="pray" data-v="punish" data-i="${card.uid}">${ic('curse', 13)} ลงโทษ +${pr.punish.gain}</button>
        </div></div>`;
    }).join('');
  }

  // ---------- powers cast on the world map ----------
  showMapPowers(from?: string) {
    const g = this.game!;
    const items = MAP_POWERS.map((p) => {
      const have = p.pool === 'faith' ? g.s.faith : g.s.dread;
      return `<button class="gift" data-act="target" data-v="${p.id}" data-tip="mappower:${p.id}" ${have >= p.cost ? '' : 'disabled'}><span class="cost">${p.cost}${ic(p.pool, 14)}</span><b>${ic(p.icon, 16)} ${p.name}</b><small>${esc(p.desc)}</small></button>`;
    }).join('');
    this.modal(`<h2>${ic('globe', 24)} พลังบนแผนที่</h2><p class="hint">เลือกพลัง แล้วคลิกประเทศบนแผนที่ ผลจะเกิดกับทุกคนในประเทศนั้น ถ้าตัวละครอยู่ที่นั่นจะได้เห็นกับตา</p>
      <div class="grid2">${items}</div><div class="actions"><button class="btn" data-act="back" data-from="${from || ''}">ย้อนกลับ</button></div>`, 'wide');
  }

  startTargeting(id: string) {
    this.targeting = id;
    const p = MAP_POWERS.find((x) => x.id === id)!;
    this.exitCity();
    $('#modal-root').innerHTML = '';
    this.modalOpen = false;
    $('#targetbar').innerHTML = `${ic(p.icon, 18)} คลิกประเทศเป้าหมายเพื่อ<b>${p.name}</b> <button class="btn small" data-act="canceltarget">ยกเลิก (Esc)</button>`;
    $('#targetbar').style.display = 'flex';
    $('#map').classList.add('targeting');
  }

  cancelTargeting() {
    this.targeting = null;
    $('#targetbar').style.display = 'none';
    $('#map').classList.remove('targeting');
    if (this.game?.s.pending) this.handlePending();
  }

  castAt(countryId: number) {
    const g = this.game;
    if (!g || !this.targeting) return;
    const r = g.castOnCountry(this.targeting, countryId);
    if (r) this.cloud.track('map_power', { id: this.targeting, own: countryId === g.c.countryId });
    this.toast(r ? `:${MAP_POWERS.find((x) => x.id === this.targeting)!.icon}: ${r} → ${g.s.countries[countryId].name}` : ':warning: พลังไม่พอ');
    this.scene.showHighlight(countryId);
    this.scene.refresh();
    this.dirty = true;
    this.cancelTargeting();
  }

  renderTop() {
    const g = this.game;
    const sp = (v: number, icon: string, label: string) => `<button data-act="speed" data-v="${v}" class="${this.speed === v ? 'on' : ''}" title="${v ? 'ความเร็ว ' + v + 'x' : 'หยุดเวลา (Space)'}">${ic(icon, 14)}${label}</button>`;
    let res = '', clock = '';
    if (g) {
      const b = g.c.belief;
      const left = b < 0 ? 50 + b / 2 : 50, width = Math.abs(b) / 2;
      res = `<div class="pill faith" data-tip="res:faith">${ic('faith', 18)} ${Math.floor(g.s.faith)}</div>
        <div class="pill dread" data-tip="res:dread">${ic('dread', 18)} ${Math.floor(g.s.dread)}</div>
        <div data-tip="res:belief"><div class="tagline">ความเชื่อ ${b > 0 ? '+' : ''}${b}</div><div class="belief"><i style="left:${left}%;width:${width}%;background:${b >= 0 ? 'var(--faith)' : 'var(--dread)'}"></i></div></div>`;
      clock = `<div class="clock">ปี ${Math.floor(g.s.year)} <span>ฤดู${SEASONS[g.s.tick % 4]}</span></div>`;
    }
    $('#topbar').innerHTML = `<div class="logo">เกมจำลองต่างโลก</div>${clock}
      <div class="speed">${sp(0, 'pause', '')}${sp(1, 'play', '1x')}${sp(3, 'play', '3x')}${sp(10, 'fast', '10x')}
        <button data-act="auto" class="auto ${this.autoMode ? 'on' : ''}" title="โหมดอัตโนมัติ: ตัวละครตัดสินใจทางแยกเอง (ไม่หยุดเกม) คุณยังมอบพร ส่งฝัน กระซิบ หรือใช้พลังได้ทุกเมื่อ">${ic('dice', 14)} ตัดสินใจเอง: ${this.autoMode ? 'เปิด' : 'ปิด'}</button></div>
      <div class="res">${res}<button class="iconbtn" data-act="settings" title="ตั้งค่า">${ic('gear', 20)}</button><button class="iconbtn" data-act="menu" title="เมนูหลัก">${ic('home', 20)}</button></div>`;
  }

  renderMapCtl() {
    const g = this.game;
    if (this.view === 'city') {
      const t = generateWorld().towns[this.cityTown];
      $('#mapctl').innerHTML = `<button data-act="exitcity" title="ซูมออกไปดูทั้งประเทศ (หรือหมุนล้อเมาส์ออก)">${ic('globe', 20)}</button>
        <button data-act="cityfollow" title="ติดตามตัวละคร">${ic('target', 20)}</button>
        <button data-act="sidefold" title="${this.sideFold ? 'เปิด' : 'หุบ'}แผงข้อมูลด้านข้าง">${ic(this.sideFold ? 'up' : 'down', 18)}</button>
        <div class="maplabel">${ic(t?.capital ? 'castle' : 'home', 16)} ${esc(t?.name || '')}${t && g ? ` · ${ic(townSpecialty(t.id, g.s.countries[t.countryId]).icon, 14)} ${esc(townSpecialty(t.id, g.s.countries[t.countryId]).name)}` : ''}${g && g.c.townId === this.cityTown ? ' · ตัวละครอยู่ที่นี่' : ''}</div>`;
    } else {
      $('#mapctl').innerHTML = `<button data-act="zoomin" title="ซูมเข้า">${ic('plus', 18)}</button><button data-act="zoomout" title="ซูมออก">${ic('minus', 18)}</button>
        <button data-act="focus" title="ไปที่ตัวละคร">${ic('target', 20)}</button>
        <button data-act="sidefold" title="${this.sideFold ? 'เปิด' : 'หุบ'}แผงข้อมูลด้านข้าง">${ic(this.sideFold ? 'up' : 'down', 18)}</button>
        ${g ? `<button data-act="entercity" title="เข้าไปในเมืองของตัวละคร">${ic('castle', 20)}</button>` : ''}
        <div class="maplabel">มุมมอง: ${this.zoomLevel} · ${WEATHER_TH[this.sky?.weather || 'clear'] || ''} · ซูมต่อเนื่องจนเห็นชีวิตในเมือง</div>`;
    }
  }

  renderGodbar() {
    const g = this.game;
    if (!g || !g.c.alive) { $('#godbar').style.display = 'none'; return; }
    $('#godbar').style.display = 'flex';
    $('#godbar').classList.toggle('folded', this.godFold);
    const pw = (act: string, icon: string, name: string, cost: string, cls = '') => `<button class="power ${cls}" data-act="${act}">${ic(icon, 26)}<span>${name}</span><small>${cost}</small></button>`;
    $('#godbar').innerHTML = pw('bless', 'bless', 'มอบพร', `${RARITY.C.faith}-${RARITY.L.faith} ศรัทธา`)
      + pw('curse', 'curse', 'มอบคำสาป', `${RARITY.C.dread}-${RARITY.L.dread} กลัว`, 'dark')
      + pw('weapon', 'weapon', 'อาวุธ', `${COSTS.weaponCursed}-${COSTS.weaponHoly}`)
      + pw('dream', 'dream', 'เข้าฝัน', `${COSTS.dream} ศรัทธา`)
      + pw('miracle', 'heal', 'ปาฏิหาริย์', `${COSTS.heal} ศรัทธา`)
      + pw('mappowers', 'globe', 'พลังบนแผนที่', '10-35')
      + `<button class="power" data-act="tab" data-v="fate">${ic('fate', 26)}<span>เส้นชะตา</span><small>ฝืนชะตา</small></button>`
      + `<button class="foldbtn" data-act="godfold" title="${this.godFold ? 'แสดง' : 'ซ่อน'}ปุ่มพลังเทพ">${this.godFold ? `${ic('up', 14)} พลังเทพ` : ic('down', 14)}</button>`;
  }

  renderPanel() {
    const panel = $('#panel');
    const body = panel.querySelector('.tabbody') as HTMLElement | null;
    if (body) this.panelScroll = body.scrollTop;
    const tb = (id: Tab, icon: string, label: string) => `<button data-act="tab" data-v="${id}" class="${this.tab === id ? 'on' : ''}">${ic(icon, 16)} ${label}</button>`;
    let content = '';
    if (!this.game) content = '<p class="muted">เริ่มชีวิตใหม่จากเมนูหลัก</p>';
    else if (this.tab === 'char') content = this.charHtml();
    else if (this.tab === 'fate') content = this.fateHtml();
    else if (this.tab === 'world') content = this.worldHtml();
    else content = this.codexHtml();
    panel.innerHTML = `<div class="tabs">${tb('char', 'birth', 'ตัวละคร')}${tb('fate', 'fate', 'ชะตา')}${tb('world', 'globe', 'โลก')}${tb('codex', 'book', 'Codex')}</div><div class="tabbody">${content}</div>`;
    const nb = panel.querySelector('.tabbody') as HTMLElement;
    nb.scrollTop = this.panelScroll;
    panel.querySelectorAll('canvas[data-portrait]').forEach((cv) => drawPortrait((cv as HTMLCanvasElement).getContext('2d')!, (cv as HTMLCanvasElement).dataset.portrait!, 4));
  }

  portrait(race: string) {
    return `<div class="portrait"><canvas width="48" height="64" data-portrait="${race}"></canvas></div>`;
  }

  giftChip(gf: Gift) {
    return `<span class="chip ${gf.kind === 'blessing' ? 'bless' : 'curse'}" style="border-color:${RARITY[gf.rarity].color}" data-tip="gift:${gf.id}">${esc(gf.name)}</span>`;
  }

  charHtml(): string {
    const g = this.game!;
    const c = g.c;
    const r = raceById(c.race);
    const co = g.country;
    const cl = climateById(co.climate);
    const hpMax = maxHp(c);
    const job = c.job ? jobById(c.job) : null;
    const stats = STATS.map((k: StatKey) => `<span data-tip="stat:${k}">${STAT_NAMES[k]}</span><div class="bar"><i style="width:${Math.min(100, c.stats[k] * 5)}%;background:${k === 'mag' ? '#8a7ae8' : k === 'luk' ? '#60c0a0' : k === 'int' ? '#7ab8e8' : '#d89a5a'}"></i></div><span class="v">${c.stats[k]}</span>`).join('');
    const axes = AXES.map((a: Axis) => `<span class="l">${AXIS_NAMES[a][1]}</span><div class="axisbar" data-tip="axis:${a}"><i style="left:calc(${(c.axes[a] + 100) / 2}% - 2px)"></i></div><span>${AXIS_NAMES[a][0]}</span>`).join('');
    const chip = (name: string, tip: string, cls = '') => `<span class="chip ${cls}" data-tip="${esc(tip)}">${esc(name)}</span>`;
    const RELI: Record<string, [string, string]> = { mentor: ['mentor', 'อาจารย์'], rival: ['rival', 'คู่แข่ง'], lover: ['lover', 'คนรัก'], spouse: ['spouse', 'คู่ชีวิต'], nemesis: ['nemesis', 'คู่อาฆาต'], friend: ['friend', 'เพื่อน'], child: ['child', 'ลูก'], parent: ['parent', 'พ่อ/แม่'] };
    const rels = c.relations.map((rl) => `<span class="chip">${ic(RELI[rl.type][0], 14)} ${RELI[rl.type][1]} ${esc(rl.name)}${rl.alive ? '' : ' ✝'}</span>`).join('');
    const kids = c.children.map((k) => `<span class="chip">${ic('child', 14)} ${esc(k.name)} (${esc(raceById(k.race).name)}, ${esc(k.gender)})${k.alive ? '' : ' ✝'}</span>`).join('');
    const w = c.weapon;
    const dream = g.s.dream ? `<div class="dreambias">${ic('dream', 16)} อิทธิพลความฝัน: "${esc(g.s.dream.meaning)}" (เหลือ ${g.s.dream.remaining} เหตุการณ์)</div>` : '';
    const threads = Object.entries(g.s.threads).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `<div class="thread" data-tip="thread:${k}"><span>${THREAD_NAMES[k] || k}</span><div class="bar"><i style="width:${Math.min(100, v * 10)}%;background:var(--gold)"></i></div><small>${esc(THREAD_FX[k] || '')}</small></div>`).join('');
    const town = g.town;
    return `
      <div class="charhead">${this.portrait(c.race)}
        <div style="flex:1">
          <div class="charname">${esc(c.name)} <span class="muted" style="font-size:14px">แห่งตระกูล${esc(c.dynastyName)}${c.generation > 1 ? ` · รุ่นที่ ${c.generation}` : ''}</span></div>
          <div class="charsub">${r.name} · ${esc(c.gender)} · อายุ ${realAge(c)} ปี (${STAGE_NAMES[g.stage()]})${c.alive ? '' : ' · ✝ เสียชีวิต'}</div>
          <div class="charsub">${job ? `<span data-tip="job:${job.id}">${ic(job.icon, 14)} ${job.name}</span>${job.secret ? ' <span style="color:var(--gold)">★อาชีพลับ</span>' : ''}` : 'ยังไม่มีอาชีพ'} · ${ic(co.climate, 14)} ${esc(town.name)}, ${esc(co.name)}</div>
          <div class="row" style="margin-top:6px">${ic('hp', 14)}<div class="bar" style="flex:1"><i style="width:${Math.max(0, (c.hp / hpMax) * 100)}%;background:var(--hp)"></i></div><span style="font-size:12px">${Math.max(0, Math.round(c.hp))}/${hpMax}</span></div>
        </div>
      </div>
      <div class="kv"><div><b>${ic('gold', 14)} ${c.gold}</b>ทอง</div><div><b>${ic('fame', 14)} ${c.fame}</b>ชื่อเสียง</div><div><b>${ic('kill', 14)} ${c.kills}</b>สังหาร</div><div><b>${ic('karma', 14)} ${g.s.karmaLife}</b>กรรม</div></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">${BIRTH_TIME_TH[c.birthTime] || ''} ${BIRTH_SIGN_TH[c.birthSign] || ''} · ดินแดน${RELIGIONS[co.religion]} · ${cl.name}</div>
      ${this.questHtml()}
      ${dream}
      ${threads ? `<h3>${ic('fate', 16)} เส้นเรื่องที่กำลังก่อตัว</h3><div class="threads">${threads}</div>` : ''}
      <h3>ค่าสถานะ</h3><div class="stats">${stats}</div>
      <h3>นิสัย</h3><div class="chips">${c.traits.map((t) => chip(traitById(t).name, `trait:${t}`)).join('')}</div>
      <div class="axes" style="margin-top:8px">${axes}</div>
      <h3>ความถนัด & Skill</h3>
      <div class="chips">${c.aptitudes.map((a) => chip('◆ ' + aptById(a).name, `apt:${a}`)).join('')}</div>
      <div class="chips" style="margin-top:6px">${c.skills.map((s) => { const sk = skillById(s); return chip(sk.name + (sk.unique ? '' : ` Lv${sk.tier}`), `skill:${s}`, sk.unique ? 'unique' : ''); }).join('')}</div>
      <h3>พร (${c.blessings.length}) & คำสาป (${c.curses.length})</h3>
      <div class="chips">${c.blessings.map((b) => this.giftChip(giftById(b))).join('')}${c.curses.map((b) => this.giftChip(giftById(b))).join('')}${!c.blessings.length && !c.curses.length ? '<span class="muted">ยังไม่มี</span>' : ''}</div>
      ${w ? `<h3>อาวุธ</h3><div class="weapon" style="border-color:${RARITY[w.rarity || 'R'].color}">${ic(w.kind === 'holy' ? 'herosword' : 'nemesis', 18)} <b>${esc(w.name)}</b> ${rar(w.rarity || 'R')} <span class="muted">พลัง +${w.power} · สังหาร ${w.kills}</span><ul>${w.history.slice(-5).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      <h3>ความสัมพันธ์</h3><div class="chips">${rels || '<span class="muted">ยังไม่มีใครในชีวิต</span>'}</div>
      ${kids ? `<h3>ลูกหลาน</h3><div class="chips">${kids}</div>` : ''}
      <h3>เผ่า${r.name}</h3><div class="muted" style="font-size:13px">${esc(r.desc)} · อายุขัยราว ${r.lifespan} ปี · ชอบ: ${r.likes.map((x) => climateById(x).name).join(', ')}${r.dislikes.length ? ` · ไม่ถูกกับ: ${r.dislikes.map((x) => climateById(x).name).join(', ')}` : ''}</div>`;
  }

  questHtml(): string {
    const g = this.game!;
    const q = g.s.quest;
    if (!q) return '';
    const def = QUESTS.find((x) => x.id === q.id)!;
    const p = q.done ? 1 : def.progress(g);
    return `<div class="quest" data-tip="quest:${def.id}">${ic(def.icon, 18)} <div style="flex:1"><b>พันธกิจ: ${esc(def.name)}</b>${q.done ? ' <span style="color:var(--good)">สำเร็จแล้ว</span>' : ''}<div class="muted" style="font-size:12px">${esc(def.desc)}</div><div class="bar"><i style="width:${p * 100}%;background:var(--gold)"></i></div></div></div>`;
  }

  logHtml(): string {
    const g = this.game!;
    const items = g.s.log.slice(-160).reverse().map((e: LogEntry) => `<div class="entry ${e.tone || ''} ${e.kind}"><span class="when">ปี ${e.year} · อายุ ${e.age}${e.tone ? ' ' + ic(TONE_ICON[e.tone], 12) : ''}</span>${rich(e.text)}</div>`).join('');
    const past = g.s.pastLives.length ? `<h3>บรรพบุรุษ</h3>${g.s.pastLives.map((l, i) => `<div class="news">รุ่น ${i + 1}: ${esc(l)}</div>`).join('')}` : '';
    return `<div class="log">${items}</div>${past}`;
  }

  fateHtml(): string {
    const g = this.game!;
    const c = g.c;
    const tags = tagsOf(c);
    const seer = tags.has('seer') || tags.has('oracle');
    const scale = raceById(c.race).lifespan / 75;
    const rows = c.fate.map((fp, i) => {
      const f = fateById(fp.fateId);
      const known = fp.done || fp.omenShown || seer;
      const age = Math.round(fp.hAge * scale);
      const name = known ? `${ic(f.good ? 'miracle' : 'omen', 16)} ${f.name}` : `${ic('secret', 16)} ชะตาที่ยังมองไม่เห็น`;
      const acts = fp.done || !c.alive ? '' : `<div class="acts"><button class="btn faith" data-act="fate" data-i="${i}" data-v="good" title="เปลี่ยนเป็นชะตาดี">ดี ${COSTS.fateGood}${ic('faith', 12)}</button><button class="btn dread" data-act="fate" data-i="${i}" data-v="bad" title="เปลี่ยนเป็นชะตาร้าย">ร้าย ${COSTS.fateBad}${ic('dread', 12)}</button></div>`;
      return `<div class="fate ${fp.done ? 'done' : ''}"><span class="age">${fp.done ? '✓' : '≈'} ${age} ปี</span><span>${name}${fp.forced ? ' <span class="muted">(ถูกฝืน)</span>' : ''}${fp.omenShown && !fp.done ? `<br><span class="muted" style="font-size:12px">${esc(f.omen)}</span>` : ''}</span>${acts}</div>`;
    }).join('');
    const chains = g.s.chains.map((ch) => `<div class="news">${ic('fate', 14)} มีเรื่องเก่ารอวันกลับมา… (โอกาส ~${pct(g.chainChance(ch.id))})</div>`).join('');
    return `<p class="muted" style="font-size:13px">เส้นชะตาถูกสุ่มตั้งแต่เกิด และเผยตัวเมื่อลางบอกเหตุปรากฏ (หรือเมื่อตัวละครมีพลังหยั่งรู้) การฝืนชะตามีโอกาส 30% ที่ชะตาจะตีกลับ</p>${rows || '<p class="muted">ไม่มีชะตาเหลืออยู่</p>'}
      ${chains ? `<h3>เรื่องที่ยังค้างคา</h3>${chains}` : ''}`;
  }

  worldHtml(): string {
    const g = this.game!;
    const world = generateWorld();
    const id = this.selectedCountry ?? g.c.countryId;
    const co = g.s.countries[id];
    const cont = CONTINENTS[co.continent];
    const cl = climateById(co.climate);
    const total = co.races.reduce((a, b) => a + b.w, 0);
    const FL: Record<string, string> = { war: 'สงคราม', plague: 'โรคระบาด', famine: 'อดอยาก', golden: 'ยุคทอง', ...Object.fromEntries(DISASTERS.map((d) => [d.flag, d.name])), ...Object.fromEntries(REGION_EVENTS.map((e) => [e.flag, e.name])) };
    const FI: Record<string, string> = { ...Object.fromEntries(DISASTERS.map((d) => [d.flag, d.icon])), ...Object.fromEntries(REGION_EVENTS.map((e) => [e.flag, e.icon])) };
    const fests = countryFestivals(co);
    const festLine = `<span class="muted">เทศกาลประจำแคว้น:</span> ${fests.map((f) => `${ic(f.icon, 14)} ${esc(f.name)} <span class="muted">(ฤดู${SEASONS[f.season]})</span>`).join(' · ')}<br>`;
    const towns = co.towns.map((tid) => {
      const t = world.towns[tid];
      const sp = townSpecialty(tid, co);
      return `<button class="townbtn ${this.selectedTown === tid ? 'on' : ''}" data-act="gotown" data-v="${tid}" title="${esc(sp.name)}">${ic(t.capital ? 'castle' : 'home', 14)} ${esc(t.name)}${g.c.townId === tid ? ' ★' : ''} <small class="muted">${ic(sp.icon, 11)} ${esc(sp.name)}</small></button>`;
    }).join('');
    const info = `<div class="countryinfo"><b style="font-size:16px">${esc(co.name)}</b>${id === g.c.countryId ? ` <span style="color:var(--gold)">${ic('target', 12)} ตัวละครอยู่ที่นี่</span>` : ''}<br>
      <span class="muted">ทวีป${esc(cont.name)} · ${ic(co.climate, 14)} ${cl.name} · อันตราย ${'☠'.repeat(co.danger)} · ${RELIGIONS[co.religion]}</span><br>
      เผ่าพันธุ์: ${co.races.map((r) => `${raceById(r.race).name} ${Math.round((r.w / total) * 100)}%`).join(', ')}<br>
      ${festLine}
      ${co.flags.length ? `สถานะ: ${co.flags.filter((f) => !f.startsWith('fest_')).map((f) => `${ic(FI[f] || f, 14)} ${FL[f] || f}`).join(' ')}${co.warWith !== null ? ` กับ ${esc(g.s.countries[co.warWith].name)}` : ''}<br>` : ''}
      <b>เมือง</b> <span class="muted" style="font-size:12px">(กดเพื่อเข้าไปดูในเมือง)</span><div class="towns">${towns}</div>
      <b>ประวัติศาสตร์</b><ul>${co.history.slice(-6).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>`;
    const townNews = g.s.townNews.slice(0, 12).map((n) => `<div class="news">${esc(n.text)}</div>`).join('');
    const news = g.s.worldNews.slice(0, 25).map((n) => `<div class="news">ปี ${n.year}: ${rich(n.text, 14)}</div>`).join('');
    const conts = CONTINENTS.map((ct) => `<div class="news"><b style="color:var(--ink)">${ct.name}</b> (${ct.count} ประเทศ) — ${esc(ct.desc)}</div>`).join('');
    const REL_ICON: Record<string, string> = { mentor: 'mentor', rival: 'rival', lover: 'lover', spouse: 'spouse', nemesis: 'nemesis', friend: 'friend', parent: 'parent' };
    const people = g.s.npcs.filter((n) => n.alive && (g.c.relations.some((r) => r.npcId === n.id && r.alive) || n.townId === g.c.townId))
      .sort((a, b) => Number(g.c.relations.some((r) => r.npcId === b.id)) - Number(g.c.relations.some((r) => r.npcId === a.id))).slice(0, 14)
      .map((n) => {
        const rel = g.c.relations.find((r) => r.npcId === n.id && r.alive);
        const away = n.townId !== g.c.townId ? ` · อยู่ที่${esc(world.towns[n.townId].name)}` : '';
        const att = n.attitude >= 30 ? 'ชอบ' : n.attitude <= -30 ? 'ไม่ชอบ' : 'เฉย ๆ';
        return `<div class="person">${ic(rel ? REL_ICON[rel.type] || 'friend' : 'home', 16)}<div><b>${esc(n.name)}</b> <span class="muted">${esc(rel ? relRole(rel.type) : n.role)} · ${esc(raceById(n.race).name)}${n.job ? ` · ${esc(npcJob(n.job).role)} ฝีมือ ${Math.round(n.skill || 0)}` : ''} · รู้สึก${att}ต่อ${esc(g.c.name)}${away}</span>${n.goal ? `<br><span class="muted" style="font-size:12px">${ic('target', 11)} ใฝ่ฝัน: ${esc(goalText(n))}${n.deeds?.length ? ` · สำเร็จแล้ว ${n.deeds.length} อย่าง` : ''}</span>` : ''}${n.last ? `<br><span class="muted" style="font-size:12px">ล่าสุด: ${esc(n.last)}</span>` : ''}</div></div>`;
      }).join('');
    const fig = (a: ReturnType<typeof heroActor>, label: string, icon: string) => {
      if (!a) return '';
      const p = actorPos(a);
      const nearest = world.towns.reduce((b, t) => (Math.hypot(t.x - p.x, t.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? t : b), world.towns[a.to]);
      return `<div class="person">${ic(icon, 16)}<div><b>${label} ${esc(a.name)}</b> <span class="muted">${a.alive ? `กำลังเดินทาง ใกล้${esc(nearest.name)} (${esc(g.s.countries[nearest.countryId].name)}) · ผลงาน ${a.deeds}` : 'ล่วงลับแล้ว… รอผู้สืบทอด'}</span></div></div>`;
    };
    const follow = g.c.flags.includes('follower_hero') ? ` · ${esc(g.c.name)} เป็นผู้ติดตามผู้กล้า` : g.c.flags.includes('follower_demon') ? ` · ${esc(g.c.name)} เป็นสมุนจอมมาร` : '';
    return `<p class="muted" style="font-size:13px">คลิกประเทศหรือเมืองบนแผนที่ · ซูมเข้าเพื่อเห็นเมือง · ซูมสุดเพื่อเข้าไปในเมือง</p>
      <h3>${ic('friend', 16)} ผู้คนในชีวิต</h3>${people || '<p class="muted">ยังไม่มีใคร</p>'}
      <h3>${ic('herosword', 16)} บุคคลสำคัญของโลก${follow}</h3>${fig(heroActor(g), 'ผู้กล้า', 'herosword')}${fig(demonActor(g), 'จอมมาร', 'demon')}
      <h3>${ic('castle', 16)} ประเทศ</h3>${info}
      ${townNews ? `<h3>${ic('home', 16)} ความเคลื่อนไหวในเมือง</h3>${townNews}` : ''}
      <h3>${ic('globe', 16)} ข่าวสารจากทั่วโลก</h3>${news || '<p class="muted">ยังสงบ…</p>'}<h3>9 ทวีป</h3>${conts}`;
  }

  codexHtml(): string {
    const secrets = JOBS.filter((j) => j.secret);
    const grid = secrets.map((j) => this.meta.codex.includes(j.id) ? `<div title="${esc(j.desc)}">${ic(j.icon, 28)}<br>${j.name}</div>` : `<div class="locked" title="ยังไม่ค้นพบ">${ic('secret', 28)}<br>???</div>`).join('');
    const races = RACES.map((r) => `<span class="chip" style="${this.meta.racesPlayed.includes(r.id) ? '' : 'opacity:.4'}">${r.name}</span>`).join('');
    return `<h3>อาชีพลับ ${this.meta.codex.length}/${secrets.length}</h3><div class="codex">${grid}</div>
      <p class="muted" style="font-size:12.5px">อาชีพลับเกิดจากการผสมเงื่อนไข เช่น เผ่า + คำสาป + skill + นิสัย ลองทดลองดู</p>
      <h3>กรรมสะสม: ${this.meta.karma}</h3><p class="muted" style="font-size:12.5px">กรรมดีทำให้ชาติหน้าเกิดมาโชคดีและมีโอกาสได้พรแต่กำเนิด กรรมชั่วเพิ่มโอกาสเกิดมาพร้อมคำสาป</p>
      <h3>ระดับความหายาก</h3><div class="chips">${(['C', 'U', 'R', 'E', 'L'] as Rarity[]).map((r) => rar(r)).join(' ')}</div>
      <h3>เผ่าที่เคยเกิด ${this.meta.racesPlayed.length}/14</h3><div class="chips">${races}</div>
      <h3>ชาติภพที่ผ่านมา</h3>${this.meta.lives.map((l) => `<div class="news">${esc(l)}</div>`).join('') || '<p class="muted">ยังไม่มี</p>'}`;
  }

  // ================= modals =================
  modal(html: string, cls = '') {
    this.modalOpen = true;
    $('#modal-root').innerHTML = `<div class="backdrop"><div class="modal ${cls}">${html}</div></div>`;
    $('#modal-root').querySelectorAll('canvas[data-portrait]').forEach((cv) => drawPortrait((cv as HTMLCanvasElement).getContext('2d')!, (cv as HTMLCanvasElement).dataset.portrait!, 4));
  }

  closeModal() {
    $('#modal-root').innerHTML = '';
    this.modalOpen = false;
    this.dirty = true;
    this.save();
    if (this.game?.s.pending) this.handlePending();
  }

  // collapse the event so the map can be inspected; a dock reopens it
  minimize() {
    $('#modal-root').innerHTML = '';
    this.modalOpen = false;
    this.minimized = true;
    this.showDock();
  }

  showDock() {
    const p = this.game?.s.pending;
    if (!p) { this.hideDock(); return; }
    const plain = p.text.replace(/:[a-z_]+:\s*/g, '');
    $('#dock').innerHTML = `<div>${ic('hourglass', 18)} <b>เหตุการณ์รอการตัดสินใจ</b><br><span class="muted">${esc(plain.slice(0, 64))}…</span></div><button class="btn primary" data-act="restore">${ic('up', 14)} เปิดเหตุการณ์</button>`;
    $('#dock').style.display = 'flex';
  }

  hideDock() { $('#dock').style.display = 'none'; }

  restore() {
    this.minimized = false;
    this.hideDock();
    if (this.game?.s.pending) this.showEvent();
  }

  toast(text: string) {
    const box = $('#toast');
    if ([...box.children].some((x) => (x as HTMLElement).dataset.t === text)) return;
    while (box.children.length >= 3) box.firstElementChild!.remove();
    const d = document.createElement('div');
    d.dataset.t = text;
    d.innerHTML = rich(text, 16);
    $('#toast').appendChild(d);
    setTimeout(() => d.remove(), 3400);
  }

  showTitle() {
    this.setSpeed(0);
    this.hideDock();
    this.minimized = false;
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    const st = (icon: string, n: string | number, label: string) => `<div>${ic(icon, 22)}<b>${n}</b>${label}</div>`;
    this.modal(`<div class="title">
      <h1>เกมจำลองต่างโลก</h1>
      <div class="tag">คุณคือพระเจ้า เฝ้ามองชีวิตหนึ่งชีวิตในต่างโลก… จะช่วยเหลือ หรือทำลาย?</div>
      <div class="worldstats">${st('globe', 9, 'ทวีป')}${st('castle', 143, 'ประเทศ')}${st('birth', 14, 'เผ่าพันธุ์')}${st('tropical', 6, 'ภูมิอากาศ')}
      ${st('heart', TRAITS.length, 'นิสัย')}${st('scroll', APTITUDES.length, 'ความถนัด')}${st('orb', SKILLS.length, 'Skill')}${st('bless', `${BLESSINGS.length}/${CURSES.length}`, 'พร/คำสาป')}</div>
      <div class="muted" style="font-size:13px">เหตุการณ์ ${STORYLETS.length} แบบ · มอนสเตอร์ ${MONSTERS.length} ชนิด · ชะตา ${FATES.length} สาย · เมือง ${generateWorld().towns.length} แห่ง → ความเป็นไปได้ราว <b style="color:var(--gold)">${estimateCombos()}</b> รูปแบบ</div>
      <div class="actions" style="justify-content:center;margin-top:18px">
        ${hasSave ? `<button class="btn primary" data-act="continue">${ic('play', 14)} เล่นต่อ</button>` : ''}
        <button class="btn ${hasSave ? '' : 'primary'}" data-act="newlife">${ic('birth', 14)} เริ่มชีวิตใหม่</button>
        <button class="btn" data-act="howto">${ic('book', 14)} วิธีเล่น</button>
        ${hasSave ? '' : `<button class="btn" data-act="cloudload">${ic('globe', 14)} โหลดเซฟจากเซิร์ฟเวอร์</button>`}
      </div>
      <div class="wishbox">
        <div class="wishhead">${ic('birth', 16)} อยากเกิดเป็นแบบไหน? <span class="muted">(ไม่บังคับ — เขียนคร่าว ๆ แล้วระบบจะเลือกให้ภายในขอบเขตของเกม)</span></div>
        <textarea id="wish" class="input" rows="2" maxlength="300" placeholder="เช่น เอลฟ์สาวขี้สงสัย เกิดในป่าดิบ ถนัดเวทลม อยากเป็นนักปราชญ์ เกิดใต้ดาวหาง">${esc(this.wishText)}</textarea>
        <div class="row" style="justify-content:space-between;margin-top:6px"><span class="muted" style="font-size:12.5px">Seed: <input id="seed" class="input" placeholder="ไม่ใส่ = สุ่ม" style="width:150px"></span>
        <button class="btn primary" data-act="wish">${ic('miracle', 14)} เกิดตามคำขอ</button></div>
      </div>
      ${this.meta.lives.length ? `<h3 style="text-align:left">ชาติภพล่าสุด</h3>${this.meta.lives.slice(0, 4).map((l) => `<div class="news" style="text-align:left">${esc(l)}</div>`).join('')}` : ''}
    </div>`, 'wide');
  }

  showHowTo() {
    const li = (icon: string, text: string) => `<li>${ic(icon, 18)} <span>${text}</span></li>`;
    this.modal(`<h2>วิธีเล่น</h2><ul class="howto">
      ${li('play', 'เวลาเดินเอง (หยุด / 1x / 3x / 10x หรือกด Space) ตัวละครใช้ชีวิตตามนิสัย ที่เกิด และเส้นชะตา')}
      ${li('scroll', 'เมื่อถึงทางเลือก เกมจะหยุด แต่ละทางบอก <b>แนวโน้ม</b> ที่ตัวละครจะเลือก <b>โอกาสสำเร็จ</b> (ทอย d20) และ <b>ผลที่อาจตามมา</b>')}
      ${li('target', 'คุณเลือกแทนไม่ได้! กด <b>“ช่วยให้เลือกทางนี้”</b> ใต้ทางที่อยากให้เกิด เกมจะบอกว่าส่งฝันแบบไหนหรือพรอะไรจะเอียงไปทางนั้น')}
      ${li('down', 'กด <b>“ย่อ”</b> (หรือ Esc) เพื่อพับหน้าต่างเหตุการณ์ไว้ แล้วไปดูแผนที่ก่อนตัดสินใจ')}
      ${li('dream', 'เข้าฝัน: ตัวละครตีความสัญลักษณ์ตามเผ่า ภูมิอากาศ และปัญญา ถ้าเชื่อในเราน้อย ฝันจะเลือนรางและตีความผิด')}
      ${li('bless', 'พร / คำสาป / อาวุธ / อาชีพ มีระดับความหายาก ธรรมดา → ตำนาน ของหายากสุ่มเจอยาก แต่ถ้าเรื่องราวสอดคล้อง เช่น เกิดยามกลางวันในดินแดนแห่งแสง พรสายแสงจะโผล่บ่อยขึ้น')}
      ${li('fate', 'ทุกการเลือกสร้าง <b>เส้นเรื่อง</b> (วีรชน, ความมืด, นักรบ…) ที่เพิ่มโอกาสเหตุการณ์ที่เกี่ยวข้อง และเรื่องในอดีตอาจย้อนกลับมาหาตัวละครหลายปีต่อมา')}
      ${li('castle', 'ซูมแผนที่จากโลก → ทวีป → ประเทศ → เมือง ในเมืองจะเห็นผู้คน เหตุการณ์ของพวกเขา และการต่อสู้ของตัวละคร')}
      ${li('faith', 'ศรัทธาได้จากการที่ตัวละครเชื่อในเรา ความกลัวได้จากภัยและคำสาป ถ้าสลับใช้ไปมาบ่อย ๆ ตัวละครจะสับสน')}
      ${li('birth', 'ถ้าตัวละครมีลูก เมื่อตายจะเล่นต่อเป็นทายาทได้ อาวุธจะสืบทอดไปด้วย และกรรมสะสมส่งผลถึงชาติหน้า')}
      </ul><div class="actions"><button class="btn primary" data-act="title">เข้าใจแล้ว</button></div>`);
  }

  async readWish() {
    const text = (($('#wish') as HTMLTextAreaElement | null)?.value || '').trim();
    this.wishText = text;
    if (!text) { this.newLife(); return; }
    const seed = (($('#seed') as HTMLInputElement | null)?.value.trim()) || '';
    this.modal(`<h2>${ic('hourglass', 22)} กำลังอ่านคำขอ…</h2><div class="story">“${esc(text)}”</div>`);
    const fromNarrator = await this.narrator.setup(text);
    const { setup, refused } = sanitizeSetup(fromNarrator || parseSetupLocal(text));
    this.pendingSetup = setup;
    const lines = describeSetup(setup);
    this.modal(`<h2>${ic('birth', 24)} ชีวิตที่จะได้เกิด</h2>
      <div class="story plain" style="font-size:14.5px">${lines.length ? lines.map((l) => `• ${esc(l)}`).join('<br>') : 'ระบบหาสิ่งที่ตรงกับคำขอไม่เจอ จะสุ่มทั้งหมดให้'}</div>
      ${setup.note ? `<p class="hint">${ic('bubble', 14)} ${esc(setup.note)}</p>` : ''}
      ${refused.length ? `<p class="hint">${ic('warning', 14)} ไม่ได้ตามคำขอ: ${esc(refused.join(' · '))}</p>` : ''}
      <p class="hint">ส่วนที่ไม่ได้ระบุ (ค่าสถานะ เส้นชะตา พรหรือคำสาปแต่กำเนิด ฯลฯ) จะสุ่มตามปกติ และความแข็งแกร่งต้องได้มาระหว่างทาง</p>
      <div class="actions"><button class="btn" data-act="title">แก้คำขอ</button><button class="btn primary" data-act="wishgo" data-v="${esc(seed)}">${ic('play', 14)} เกิดตามนี้</button></div>`);
  }

  newLife(seed?: string, setup?: Setup) {
    const s = seed || (($('#seed') as HTMLInputElement | null)?.value.trim()) || String(Date.now());
    this.narrator.newLife();
    this.epitaph = '';
    this.exitCity();
    this.attach(Game.newGame(s, this.meta, setup));
    this.save();
    this.showBirth();
  }

  showBirth() {
    const g = this.game!;
    const c = g.c;
    const r = raceById(c.race);
    const co = g.country;
    const cl = climateById(co.climate);
    const gifts = [...c.blessings, ...c.curses].map((id) => giftById(id));
    const uniq = c.skills.map(skillById).filter((s) => s.unique);
    const why = (gf: Gift) => { const w = g.whyHint(gf.tags); return w.length ? ` <span class="muted">(สอดคล้องกับ: ${esc(w.join(', '))})</span>` : ''; };
    this.modal(`<h2>${ic('birth', 24)} ชีวิตใหม่ถือกำเนิด</h2>
      <div class="charhead">${this.portrait(c.race)}<div>
        <div class="charname">${esc(c.name)}</div>
        <div class="charsub">${r.name} (${r.en}) · ${esc(c.gender)} · ตระกูล${esc(c.dynastyName)}${c.flags.includes('noble') ? ` · ${ic('crown', 14)} ขุนนาง` : ''}</div>
        <div class="charsub">เกิดที่ ${esc(g.town.name)}, ${esc(co.name)} · ทวีป${CONTINENTS[co.continent].name} · ${ic(co.climate, 14)} ${cl.name}</div>
        <div class="charsub">${BIRTH_TIME_TH[c.birthTime]} ${BIRTH_SIGN_TH[c.birthSign]} · ดินแดน${RELIGIONS[co.religion]}</div>
      </div></div>
      <div class="story plain" style="font-size:14.5px">${esc(r.desc)}<br>
นิสัย: ${c.traits.map((t) => traitById(t).name).join(', ')}<br>
ความถนัด: ${c.aptitudes.map((a) => aptById(a).name).join(', ')}<br>
${uniq.length ? `Unique Skill: ${uniq.map((u) => esc(u.name)).join(', ')}<br>` : ''}${gifts.length ? gifts.map((gf) => `${ic(gf.kind === 'blessing' ? 'bless' : 'curse', 16)} ${gf.kind === 'blessing' ? 'พร' : 'คำสาป'}แต่กำเนิด: <b>${esc(gf.name)}</b> ${rar(gf.rarity)} — ${esc(gf.desc)}${why(gf)}`).join('<br>') : 'ไม่มีพรหรือคำสาปแต่กำเนิด'}<br>
ค่าสถานะ: ${STATS.map((k) => `${STAT_NAMES[k]} ${c.stats[k]}`).join(' · ')}</div>
      <h3>${ic('miracle', 16)} เลือกพันธกิจของคุณในชีวิตนี้</h3>
      <div class="grid3">${g.questOffers().map((id, i) => { const q = QUESTS.find((x) => x.id === id)!; if (i === 0 && !this.questPick) this.questPick = id; return `<button class="gift questopt ${this.questPick === id ? 'on' : ''}" data-act="questpick" data-v="${id}" data-tip="quest:${id}"><b>${ic(q.icon, 16)} ${esc(q.name)}</b><small>${esc(q.desc)}</small></button>`; }).join('')}</div>
      <p class="hint">เส้นชะตา ${c.fate.length} จุดซ่อนอยู่ในชีวิตนี้… ${this.meta.karma > 20 ? 'กรรมดีจากชาติก่อนส่งผลให้โชคดีขึ้น' : this.meta.karma < -20 ? 'กรรมชั่วจากชาติก่อนตามมาหลอกหลอน' : ''}</p>
      <div class="actions"><button class="btn" data-act="editwish" title="กลับไปแก้คำขอ หรือเปลี่ยน Seed">${ic('up', 14)} กลับไปแก้คำขอ</button><button class="btn" data-act="reroll">${ic('dice', 14)} สุ่มเกิดใหม่${this.pendingSetup ? ' (ตามคำขอเดิม)' : ''}</button><button class="btn primary" data-act="beginlife">เริ่มเฝ้ามอง ${ic('play', 14)}</button></div>`);
  }

  eventTitle(): string {
    const g = this.game!;
    const p = g.s.pending!;
    const st = p.storylet;
    if (p.fateId) return `${ic('fate', 22)} จุดชะตา: ${fateById(p.fateId).name}`;
    if (st.id === 'coming_of_age') return `${ic('job', 22)} เลือกเส้นทางชีวิต`;
    if (st.id === 'secret_job') return `${ic('secret', 22)} การตื่นรู้`;
    if (p.monsterId) return `${ic('monster', 22)} เผชิญอสูร`;
    if (st.id.startsWith('chain_')) return `${ic('fate', 22)} เรื่องในอดีตหวนกลับมา`;
    if (st.id === 'career_change') return `${ic('job', 22)} ทางแยกของชีวิต`;
    if (st.id.startsWith('npc_')) return `${ic('friend', 22)} เรื่องของคนรอบตัว`;
    if (st.id.startsWith('actor_hero') || st.id.startsWith('party_') || st.id === 'actor_final_battle') return `${ic('herosword', 22)} ผู้กล้าแห่งยุค`;
    if (st.id.startsWith('actor_demon') || st.id.startsWith('demon_') || st.id === 'actor_final_battle_demon') return `${ic('demon', 22)} จอมมาร`;
    if (st.id.startsWith('actor_caravan')) return `${ic('gold', 22)} กองคาราวาน`;
    if (st.id.startsWith('region_')) return `${ic('globe', 22)} เหตุการณ์ใหญ่ของแผ่นดิน`;
    return `${ic(TONE_ICON[st.tone], 22)} เหตุการณ์`;
  }

  hintChips(list: string[], cls: string) {
    return list.map((h) => `<span class="hchip ${cls}">${rich(h, 13)}</span>`).join('');
  }

  // how the god could push toward choice i: dreams that shift the tilt, blessings that raise success
  tiltPanel(st: Storylet, i: number, ch: Choice): string {
    const g = this.game!;
    const base = g.choiceProbs(st)[i];
    const clarity = g.dreamClarity();
    const dreams = SYMBOLS.map((s) => { const r = g.probsWithDream(st, s.id); return { s, p: r.probs[i], meaning: r.meaning }; })
      .filter((d) => d.p - base > 0.03).sort((a, b) => b.p - a.p).slice(0, 3);
    const canDream = g.s.faith >= COSTS.dream;
    const dreamRows = dreams.map((d) => `<div class="tiltrow">${ic(d.s.icon, 22)}<div><b>ฝันเห็น${d.s.name}</b> <span class="muted">→ น่าจะตีความว่า “${esc(d.meaning)}”</span><br>แนวโน้มทางนี้ ${pct(base)} → <b style="color:var(--good)">${pct(d.p)}</b></div>
      <button class="btn" data-act="senddream" data-id="${d.s.id}" data-from="event" ${canDream ? '' : 'disabled'}>ส่งฝัน ${COSTS.dream}${ic('faith', 12)}</button></div>`).join('');
    let giftRows = '';
    if (ch.chk) {
      const sc = g.successChance(ch);
      const offer = g.offerGifts('blessing', 6).map((gf) => ({ gf, p: g.successWithGift(ch, gf) })).filter((x) => x.p - sc > 0.03).sort((a, b) => b.p - a.p).slice(0, 2);
      giftRows = offer.map(({ gf, p }) => `<div class="tiltrow">${ic('bless', 22)}<div><b>${esc(gf.name)}</b> ${rar(gf.rarity)}<br>โอกาสสำเร็จ ${pct(sc)} → <b style="color:var(--good)">${pct(p)}</b></div>
        <button class="btn" data-act="give" data-kind="blessing" data-id="${gf.id}" data-from="event" ${g.s.faith >= giftCost(gf) ? '' : 'disabled'}>มอบพร ${giftCost(gf)}${ic('faith', 12)}</button></div>`).join('');
    }
    const none = !dreamRows && !giftRows ? '<div class="muted">ตอนนี้ยังไม่มีพลังที่ช่วยทางนี้ได้ชัดเจน (ตัวเลือกพรสุ่มใหม่ทุกฤดู)</div>' : '';
    return `<div class="tilt">
      ${dreamRows ? `<div class="tilthead">${ic('dream', 14)} ส่งฝันเพื่อเอียงใจ <span class="muted">(ฝันชัด ~${pct(clarity)} ถ้าเลือนรางอาจตีความผิด)</span></div>${dreamRows}` : ''}
      ${giftRows ? `<div class="tilthead">${ic('bless', 14)} มอบพรเพื่อเพิ่มโอกาสสำเร็จ</div>${giftRows}` : ''}${none}</div>`;
  }

  showEvent(outcome?: { idx: number; entry: LogEntry }) {
    const g = this.game!;
    const p = g.s.pending;
    if (!p && !outcome) return;
    this.hideDock();
    this.minimized = false;
    if (outcome) {
      const died = !!g.s.pending && g.s.pending.kind === 'death';
      this.modal(`<h2>ผลลัพธ์</h2><div class="story">${rich(outcome.entry.text)}</div>
        <div class="actions"><button class="btn primary" data-act="closeoutcome">${died ? '…' : `ดำเนินชีวิตต่อ ${ic('play', 14)}`}</button></div>`, outcome.entry.tone === 'dark' ? 'dark' : '');
      return;
    }
    const st: Storylet = p!.storylet;
    const probs = g.choiceProbs(st);
    const dream = g.s.dream;
    const c = g.c;
    const choices = (st.ch || []).map((ch, i) => {
      const sc = g.successChance(ch);
      const dreamed = dream && ch.tags.some((t) => dream.tags.includes(t));
      const h = g.choiceHints(ch, p!.vars);
      const hints = (h.ok.length ? `<div class="hints"><span class="hl">${ch.ng ? 'ถ้าสำเร็จ' : 'ผล'}</span>${this.hintChips(h.ok, 'good')}</div>` : '')
        + (h.ng.length ? `<div class="hints"><span class="hl">ถ้าพลาด</span>${this.hintChips(h.ng, 'bad')}</div>` : '')
        + (h.path.length ? `<div class="hints"><span class="hl">เส้นเรื่อง</span>${this.hintChips(h.path.map((x) => `เสริม${x}`), 'path')}</div>` : '');
      return `<div class="choice ${dreamed ? 'dreamed' : ''}">
        <div class="top"><span class="clabel">${rich(ch.l, 18)}</span>${ch.chk ? `<span class="sbadge" title="ทอย d20 + โบนัส ต้องได้ ${ch.chk[1]}">${ic('dice', 14)} ${STAT_NAMES[ch.chk[0]]} สำเร็จ ${pct(sc)}</span>` : '<span class="sbadge muted">ไม่ต้องทอย</span>'}</div>
        <div class="meta"><span style="width:150px">แนวโน้มที่จะเลือก ${pct(probs[i])}</span><div class="bar"><i style="width:${probs[i] * 100}%;background:${dreamed ? '#8090f0' : 'var(--gold)'}"></i></div></div>
        ${hints}
        <div class="row" style="gap:6px;margin-top:7px">
          <button class="btn faith whisper" data-act="whisper" data-i="${i}" data-tip="res:whisper" ${g.s.faith >= g.whisperCost() ? '' : 'disabled'}>${ic('bubble', 14)} กระซิบให้เลือกทางนี้ · ${g.whisperCost()}${ic('faith', 12)} · เชื่อฟัง ${pct(g.obeyChance())}</button>
          <button class="tiltbtn ${this.tiltOpen === i ? 'on' : ''}" data-act="tilt" data-i="${i}">${ic('target', 14)} ${this.tiltOpen === i ? 'ซ่อน' : 'ทางอ้อม: ฝัน/พร'}</button>
        </div>
        ${this.tiltOpen === i ? this.tiltPanel(st, i, ch) : ''}
      </div>`;
    }).join('');
    const rarity = st.r && st.r !== 'C' ? rar(st.r) : '';
    this.modal(`<div class="mhead"><h2>${this.eventTitle()} ${rarity}</h2><button class="btn small" data-act="minimize" title="ย่อไว้ก่อน ไปดูแผนที่ (Esc)">${ic('down', 14)} ย่อ</button></div>
      <div class="muted" style="font-size:13px">${esc(c.name)} · อายุ ${g.age()} · HP ${Math.round(c.hp)}/${maxHp(c)} · ${ic('faith', 12)} ${Math.floor(g.s.faith)} ${ic('dread', 12)} ${Math.floor(g.s.dread)}</div>
      <div class="story">${rich(p!.text)}</div>
      ${dream ? `<div class="dreambias">${ic('dream', 16)} ความฝันยังติดอยู่ในใจ: "${esc(dream.meaning)}"</div>` : ''}
      <div class="choices">${choices}</div>
      <p class="hint">${ic('bubble', 14)} นี่คือ<b>ทางแยกสำคัญ</b>ของชีวิต ${esc(c.name)} คุณ<b>กระซิบ</b>บอกทางได้โดยตรง (ตัวละครอาจไม่เชื่อฟัง) หรือใช้ทางอ้อมด้วยฝันและพร หรือจะปล่อยให้เลือกเองก็ได้</p>
      <div class="actions">
        <button class="btn" data-act="curse" data-from="event">${ic('curse', 14)} คำสาป</button>
        <button class="btn" data-act="miracle" data-from="event">${ic('miracle', 14)} ปาฏิหาริย์</button>
        <button class="btn primary" data-act="decide">ปล่อยให้${esc(c.name)}ตัดสินใจ ${ic('play', 14)}</button>
      </div>`, st.tone === 'dark' ? 'dark wide' : 'wide');
  }

  showOmen() {
    const g = this.game!;
    const p = g.s.pending!;
    const f = fateById(p.fateId!);
    const tags = tagsOf(g.c);
    const reveal = tags.has('seer') || tags.has('oracle') ? `<p>ด้วยพลังหยั่งรู้ เห็นชัดว่าคือ: <b>${ic(f.good ? 'miracle' : 'omen', 16)} ${f.name}</b></p>` : '<p class="muted">ยังไม่แน่ชัดว่าเป็นชะตาดีหรือร้าย… เปิดแท็บ "ชะตา" เพื่อดูชื่อชะตาที่เผยแล้ว</p>';
    this.modal(`<h2>${ic('omen', 24)} ลางบอกเหตุ</h2><div class="story">${esc(p.text)}</div>${reveal}
      <p class="hint">อีกไม่นานจุดชะตาจะมาถึง นี่คือเวลาเตรียมแทรกแซง: มอบพร เข้าฝัน หรือฝืนชะตา</p>
      <div class="actions"><button class="btn" data-act="omen-fate">${ic('fate', 14)} ไปที่เส้นชะตา</button><button class="btn primary" data-act="omen-ok">เฝ้าดูต่อ ${ic('play', 14)}</button></div>`, 'dark');
  }

  showDeathDoor() {
    const g = this.game!;
    const c = g.c;
    const cause = g.s.pending!.text;
    const canF = !c.revived && g.s.faith >= COSTS.reviveFaith;
    const canD = !c.revived && g.s.dread >= COSTS.reviveDread;
    this.modal(`<h2>${ic('death', 24)} ณ ประตูแห่งความตาย</h2><div class="story">${esc(c.name)} อายุ ${g.age()} ปี กำลังจะสิ้นใจ… (${esc(cause)})</div>
      <p class="hint">${c.revived ? 'ปาฏิหาริย์ช่วยชีวิตใช้ได้เพียงครั้งเดียวต่อชีวิต และได้ใช้ไปแล้ว' : 'ปาฏิหาริย์ช่วยชีวิตใช้ได้ครั้งเดียวต่อชีวิต และมีราคาแพงมาก'}</p>
      <div class="actions">
        <button class="btn faith" data-act="revive" data-v="faith" ${canF ? '' : 'disabled'}>${ic('miracle', 14)} ชุบชีวิตด้วยแสง (${COSTS.reviveFaith}${ic('faith', 12)})</button>
        <button class="btn dread" data-act="revive" data-v="dread" ${canD ? '' : 'disabled'}>${ic('tone_dark', 14)} ฉุดกลับจากนรก (${COSTS.reviveDread}${ic('dread', 12)} + คำสาป)</button>
        <button class="btn primary" data-act="letdie">ปล่อยให้จากไป</button>
      </div>`, 'dark');
  }

  showSummary() {
    const g = this.game!;
    const c = g.c;
    const heirs = g.heirs();
    this.modal(`<div class="lifecard" id="lifecard">
        <div class="title2">การ์ดสรุปชีวิต · เกมจำลองต่างโลก</div>
        <div class="row" style="justify-content:center;margin:8px 0">${this.portrait(c.race)}</div>
        <div class="big">${esc(c.name)}</div><div style="color:var(--gold)">「${esc(g.title())}」</div>
        <div class="sum">${esc(g.summaryLine())}</div>
        <div class="cardstats"><div><b>${c.fame}</b>ชื่อเสียง</div><div><b>${c.kills}</b>สังหาร</div><div><b>${c.children.length}</b>ลูกหลาน</div><div><b>${g.s.karmaLife}</b>กรรม</div>
        <div><b>${g.s.lifeStats.blessings}</b>พรที่ได้รับ</div><div><b>${g.s.lifeStats.curses}</b>คำสาป</div><div><b>${g.s.lifeStats.dreams}</b>ความฝัน</div><div><b>${c.belief}</b>ความเชื่อ</div></div>
        <div class="epitaph" id="epitaph">${this.epitaph ? `“${esc(this.epitaph)}”` : this.narrator.active ? '…กำลังสลักคำจารึก…' : ''}</div>
      </div>
      <div class="actions">
        <button class="btn" data-act="copycard">${ic('scroll', 14)} คัดลอกการ์ด</button>
        <button class="btn" data-act="savecard">${ic('image', 14)} บันทึกรูป</button>
        ${heirs.map((k, i) => `<button class="btn primary" data-act="heir" data-i="${i}">${ic('child', 14)} เล่นต่อเป็น ${esc(k.name)} (${esc(raceById(k.race).name)})</button>`).join('')}
        <button class="btn ${heirs.length ? '' : 'primary'}" data-act="reincarnate">${ic('birth', 14)} กลับชาติมาเกิด</button>
      </div>`);
  }

  // ---- god power pickers ----
  showGifts(kind: 'blessing' | 'curse', from?: string) {
    const g = this.game!;
    const offer = g.offerGifts(kind, 6);
    const pool = kind === 'blessing' ? 'faith' : 'dread';
    const have = pool === 'faith' ? g.s.faith : g.s.dread;
    const mult = g.costMult(pool);
    const items = offer.map((gf) => {
      const cost = Math.round(giftCost(gf) * mult);
      const why = g.whyHint(gf.tags);
      const feeds = g.feedHint(gf.tags);
      const boosts = feeds.map((f) => THREAD_FX[THREAD_BY_NAME[f]] || '').filter(Boolean).join(' / ');
      return `<button class="gift" data-act="give" data-kind="${kind}" data-id="${gf.id}" data-from="${from || ''}" ${have >= cost ? '' : 'disabled'} style="border-color:${RARITY[gf.rarity].color}">
        <span class="cost">${cost}${ic(pool, 14)}</span><b>${ic(kind === 'blessing' ? 'bless' : 'curse', 16)} ${esc(gf.name)}</b> ${rar(gf.rarity)}
        <small>${esc(gf.desc)}</small>
        ${why.length ? `<small class="why">${ic('miracle', 12)} ปรากฏบ่อยขึ้นเพราะ: ${esc(why.join(', '))}</small>` : ''}
        ${feeds.length ? `<small class="why">${ic('fate', 12)} เสริมเส้นเรื่อง${esc(feeds.join(', '))} → เพิ่มโอกาส ${esc(boosts)}</small>` : ''}
      </button>`;
    }).join('');
    this.modal(`<h2>${ic(kind === 'blessing' ? 'bless' : 'curse', 24)} ${kind === 'blessing' ? 'มอบพร' : 'มอบคำสาป'}</h2>
      <p class="hint">ตัวเลือกสุ่มใหม่ทุกฤดู · ยิ่งหายากยิ่งสุ่มเจอยาก แต่เรื่องราวที่สอดคล้องจะทำให้โผล่บ่อยขึ้น · ${kind === 'blessing' ? 'การมอบพรเพิ่มความเชื่อ' : 'คำสาปลดความเชื่อ แต่เพิ่มความกลัว'}${mult > 1 ? ` · ราคา x${mult} เพราะความเชื่อ` : ''}</p>
      <div class="grid2">${items}</div>
      <div class="actions"><button class="btn" data-act="back" data-from="${from || ''}">ย้อนกลับ</button></div>`, 'wide');
  }

  showWeapon(from?: string) {
    const g = this.game!;
    const odds = (kind: 'holy' | 'cursed') => {
      const o = g.weaponOdds(kind);
      return (Object.keys(o) as Rarity[]).filter((r) => o[r] > 0.001).map((r) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${pct(o[r])}</span>`).join(' · ');
    };
    this.modal(`<h2>${ic('weapon', 24)} ประทานอาวุธ</h2><p class="hint">อาวุธเพิ่มโบนัสการต่อสู้ จดจำประวัติ และสืบทอดสู่ลูกหลาน (แทนที่อาวุธเดิม) ธาตุของอาวุธขึ้นกับศาสนาของดินแดน ความหายากขึ้นกับเรื่องราวของตัวละคร</p>
      <div class="grid2">
        <button class="gift" data-act="giveweapon" data-v="holy" data-from="${from || ''}" ${g.s.faith >= COSTS.weaponHoly ? '' : 'disabled'}><span class="cost">${COSTS.weaponHoly}${ic('faith', 14)}</span><b>${ic('herosword', 16)} อาวุธศักดิ์สิทธิ์</b><small>ได้เปรียบอันเดดและปีศาจ · ความเชื่อ +10</small><small class="why">โอกาส: ${odds('holy')}</small></button>
        <button class="gift" data-act="giveweapon" data-v="cursed" data-from="${from || ''}" ${g.s.dread >= COSTS.weaponCursed ? '' : 'disabled'}><span class="cost">${COSTS.weaponCursed}${ic('dread', 14)}</span><b>${ic('nemesis', 16)} อาวุธต้องสาป</b><small>พลังสูงกว่า แต่ทำให้โหดร้ายขึ้น</small><small class="why">โอกาส: ${odds('cursed')}</small></button>
      </div>
      <div class="actions"><button class="btn" data-act="back" data-from="${from || ''}">ย้อนกลับ</button></div>`);
  }

  showDream(from?: string) {
    const g = this.game!;
    const cl = Math.round(g.dreamClarity() * 100);
    const syms = SYMBOLS.map((s) => `<button class="symbol" data-act="senddream" data-id="${s.id}" data-from="${from || ''}" title="ความหมายทั่วไป: ${esc(s.base.text)} (แต่ละเผ่าอาจตีความต่างกัน)" ${g.s.faith >= COSTS.dream ? '' : 'disabled'}>${ic(s.icon, 34)}<br>${s.name}</button>`).join('');
    this.modal(`<h2>${ic('dream', 24)} เข้าฝัน</h2><p class="hint">ส่งสัญลักษณ์ ${COSTS.dream}${ic('faith', 12)} · ความชัดของฝัน <b style="color:var(--gold)">${cl}%</b> (ขึ้นกับความเชื่อ ศรัทธา ปัญญา) · ${esc(raceById(g.c.race).name)}ใน${esc(climateById(g.country.climate).name)}อาจตีความต่างจากที่คุณคิด · ฝันมีผล 3 เหตุการณ์</p>
      <div class="symbols">${syms}</div>
      <div class="actions"><button class="btn" data-act="back" data-from="${from || ''}">ย้อนกลับ</button></div>`);
  }

  showMiracle(from?: string) {
    const g = this.game!;
    const btn = (k: string, icon: string, name: string, desc: string, cost: number, pool: 'faith' | 'dread') =>
      `<button class="gift" data-act="domiracle" data-v="${k}" data-from="${from || ''}" ${(pool === 'faith' ? g.s.faith : g.s.dread) >= cost ? '' : 'disabled'}><span class="cost">${cost}${ic(pool, 14)}</span><b>${ic(icon, 16)} ${name}</b><small>${desc}</small></button>`;
    this.modal(`<h2>${ic('miracle', 24)} ปาฏิหาริย์</h2><p class="hint">ปาฏิหาริย์ระดับโลกช่วยหรือทำลายตัวละคร "ทางอ้อม" ผ่านแผ่นดินที่เขาอยู่</p>
      <div class="grid2">
        ${btn('heal', 'heal', 'รักษาบาดแผล', 'ฟื้น HP เต็ม', COSTS.heal, 'faith')}
        ${btn('harvest', 'rain', 'ฝนชุ่มฉ่ำ อวยพรแผ่นดิน', 'ยุติอดอยาก/โรคระบาด ประเทศเข้าสู่ยุคทอง', COSTS.harvest, 'faith')}
        ${btn('quake', 'quake', 'แผ่นดินไหว', 'ประเทศอดอยาก ตัวละครบาดเจ็บ ความกลัวพุ่ง', COSTS.quake, 'dread')}
        ${btn('meteor', 'meteor', 'อุกกาบาต', 'ยุติสงคราม หรือ…ตกใส่ศัตรูของตัวละคร', COSTS.meteor, 'dread')}
      </div>
      <div class="actions"><button class="btn" data-act="back" data-from="${from || ''}">ย้อนกลับ</button></div>`);
  }

  showSettings() {
    const g = this.game;
    const n = this.narrator.stats;
    const dev = import.meta.env.DEV;
    this.modal(`<h2>${ic('gear', 24)} ตั้งค่า</h2>
      <label class="switch"><input type="checkbox" id="cinePause" ${this.cinePause ? 'checked' : ''}> หยุดเกมและแสดงอนิเมชั่นเมื่อเกิดเหตุการณ์ใหญ่ในดินแดนของตัวละคร (มังกรบุก อุกกาบาต สงคราม ฯลฯ) — ปิด = แสดงเป็นแถบเล็กไม่หยุดเกม</label>
      <label class="switch"><input type="checkbox" id="pauseAll" ${!g || g.pauseOnChoices ? 'checked' : ''}> หยุดเกมทุกครั้งที่ตัวละครต้องเลือก (ค่าเริ่มต้น: ปิด — หยุดเฉพาะทางแยกสำคัญ เหตุการณ์อื่นไหลในบันทึกเรื่องราว)</label>
      ${n.enabled ? `<label class="switch"><input type="checkbox" id="llmOn" ${this.narrator.userEnabled ? 'checked' : ''}> เรื่องเล่าเสริม (ข้อความที่แต่งเติมเฉพาะชีวิตนี้)</label>` : ''}
      ${dev && n.enabled ? `<details class="dev"><summary>สำหรับนักพัฒนา</summary>
        <div class="muted" style="font-size:13px">ชีวิตนี้เรียกไปแล้ว ${n.calls}/${n.budget} ครั้ง (ชะตา ${n.byRole.fate} · ฝัน ${n.byRole.dream} · สุ่ม ${n.byRole.flavor} · จารึก ${n.byRole.epitaph}) · input ${n.promptTokens} (cache ${n.cacheHitTokens}) · output ${n.completionTokens}${n.errors ? ` · ผิดพลาด ${n.errors}: ${esc(n.lastError)}` : ''}</div>
        <div class="row" style="margin-top:6px"><span class="muted" style="font-size:13px">งบต่อชีวิต</span><input id="llmBudget" class="input" type="number" min="0" max="40" value="${n.budget}" style="width:80px"></div></details>` : ''}
      <label class="switch"><input type="checkbox" id="statsOn" ${this.cloud.enabled ? 'checked' : ''}> ส่งสถิติการเล่นแบบไม่ระบุตัวตน (ช่วยปรับสมดุลเกม)</label>
      <h3>ข้อมูล</h3>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-act="howto">${ic('book', 14)} วิธีเล่น</button><button class="btn" data-act="wipe">${ic('death', 14)} ล้างเซฟทั้งหมด</button></div>
      <div class="actions"><button class="btn primary" data-act="savesettings">บันทึก</button></div>`);
  }

  // ================= input =================
  onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.code === 'Space' && !this.modalOpen && this.game) { e.preventDefault(); this.setSpeed(this.speed ? 0 : this.lastSpeed); }
    if (e.key === 'Enter' && this.modalOpen) { const b = document.querySelector('.modal .btn.primary') as HTMLButtonElement | null; if (b && !b.disabled) b.click(); }
    if (e.key === 'Escape' && this.targeting) this.cancelTargeting();
    else if (e.key === 'Escape' && this.modalOpen && this.game?.s.pending?.kind === 'story') this.minimize();
    if (!this.modalOpen && ['1', '2', '3'].includes(e.key)) this.setSpeed([1, 3, 10][+e.key - 1]);
  }

  backTo(from?: string) {
    if (from === 'event' && this.game?.s.pending) this.showEvent();
    else if (this.minimized) { $('#modal-root').innerHTML = ''; this.modalOpen = false; this.showDock(); }
    else this.closeModal();
  }

  // replay the outcome in town (battle or brawl)
  afterResolve(res: { choice: number; success: boolean } | null, st: Storylet | undefined, wasMonster: boolean) {
    if (!res || !st?.ch || !this.cityActive()) return;
    const ch = st.ch[res.choice];
    if (wasMonster) this.city.playOutcome(ch.tags.includes('flee') ? 'flee' : res.success ? 'win' : 'lose');
    else if (ch.tags.includes('fight')) this.city.playBrawl(res.success);
  }

  onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    const act = el.dataset.act!;
    const v = el.dataset.v;
    const from = el.dataset.from;
    const g = this.game;
    switch (act) {
      case 'speed': if (g && g.c.alive) this.setSpeed(+v!); break;
      case 'auto':
        this.autoMode = !this.autoMode;
        if (g) g.autoDecide = this.autoMode;
        try { localStorage.setItem('isekai.auto', this.autoMode ? 'on' : 'off'); } catch { /* ignore */ }
        this.toast(this.autoMode ? ':dice: ตัวละครจะตัดสินใจทางแยกเอง คุณยังแทรกแซงด้วยพร ฝัน และพลังต่าง ๆ ได้ตลอด' : ':dice: กลับมาหยุดรอคุณที่ทางแยกสำคัญ');
        // a crossroad already waiting is decided now
        if (this.autoMode && g?.s.pending?.kind === 'story' && !this.modalOpen && !this.cineOpen) { this.minimized = false; this.hideDock(); g.resolve(); }
        this.dirty = true; break;
      case 'sidefold': case 'sidetab':
        this.sideFold = !this.sideFold;
        document.getElementById('app')!.classList.toggle('sidefold', this.sideFold);
        try { localStorage.setItem('isekai.sideFold', this.sideFold ? 'on' : 'off'); } catch { /* ignore */ }
        this.fitMap();
        this.dirty = true; break;
      case 'godfold': this.godFold = !this.godFold; try { localStorage.setItem('isekai.godFold', this.godFold ? 'on' : 'off'); } catch { /* ignore */ } this.dirty = true; break;
      case 'cineclose': if (this.cineOpen) this.closeCine(); else this.hideBanner(); break;
      case 'tab': this.tab = v as Tab; this.dirty = true; break;
      case 'zoomin': this.scene.zoomBy(1.4); break;
      case 'zoomout': this.scene.zoomBy(1 / 1.4); break;
      case 'focus': if (g) { this.scene.focusChar(); this.selectedCountry = g.c.countryId; this.dirty = true; } break;
      case 'entercity': if (g) this.enterCity(g.c.townId); break;
      case 'exitcity': this.exitCity(true); break;
      case 'cityfollow': this.city.setFollow(true); break;
      case 'gotown': this.enterCity(+v!); break;
      case 'menu': this.save(); this.showTitle(); break;
      case 'title': this.showTitle(); break;
      case 'editwish': this.questPick = null; this.showTitle(); setTimeout(() => ($('#wish') as HTMLTextAreaElement | null)?.focus(), 50); break;
      case 'howto': this.showHowTo(); break;
      case 'settings': this.setSpeed(0); this.showSettings(); break;
      case 'cloudload': this.restoreFromCloud().then((ok) => { if (ok) { this.closeModal(); if (!this.game!.s.pending) this.setSpeed(1); } else this.toast(':warning: ไม่พบเซฟบนเซิร์ฟเวอร์'); }); break;
      case 'continue': if (this.loadSave()) { this.closeModal(); if (!this.game!.c.alive) this.showSummary(); else if (!this.game!.s.pending) this.setSpeed(1); } break;
      case 'newlife': this.pendingSetup = null; this.newLife(); break;
      case 'wish': this.readWish(); break;
      case 'wishgo': this.newLife(v || undefined, this.pendingSetup || undefined); break;
      case 'reroll': this.pendingSetup ? this.newLife(String(Date.now()), this.pendingSetup) : this.newLife(String(Date.now())); break;
      case 'beginlife': this.cloud.track('life_start', { race: this.game!.c.race, country: this.game!.c.countryId, quest: this.questPick, wish: !!this.wishText }); if (this.questPick) this.game!.setQuest(this.questPick); this.questPick = null; this.pendingSetup = null; this.closeModal(); this.setSpeed(1); this.scene.focusChar(); break;
      case 'bless': if (g?.c.alive) this.showGifts('blessing', from); break;
      case 'curse': if (g?.c.alive) this.showGifts('curse', from); break;
      case 'weapon': if (g?.c.alive) this.showWeapon(from); break;
      case 'dream': if (g?.c.alive) this.showDream(from); break;
      case 'miracle': if (g?.c.alive) this.showMiracle(from); break;
      case 'back': this.backTo(from); break;
      case 'minimize': this.minimize(); break;
      case 'logf': this.logFilter = v as LogFilter; this.renderLog(); break;
      case 'docktoggle': this.dockOpen = !this.dockOpen; this.applyDock(); this.renderLog(); break;
      case 'pray': {
        const r = g!.answerPrayer(+el.dataset.i!, v as 'grant' | 'deny' | 'punish');
        if (r) this.cloud.track('prayer', { answer: v });
        if (!r) this.toast(':warning: ศรัทธาไม่พอ');
        this.dirty = true; this.scene.refresh(); break;
      }
      case 'mappowers': if (g?.c.alive) this.showMapPowers(from); break;
      case 'target': this.startTargeting(v!); break;
      case 'canceltarget': this.cancelTargeting(); break;
      case 'questpick': this.questPick = v!; this.showBirth(); break;
      case 'whisper': {
        const st = g!.s.pending?.storylet;
        const wasMonster = !!g!.s.pending?.monsterId;
        const before = g!.s.log.length;
        const r = g!.whisper(+el.dataset.i!);
        if (r) this.cloud.track('whisper', { obeyed: r.obeyed });
        if (!r) { this.toast(':warning: ศรัทธาไม่พอ'); break; }
        this.tiltOpen = -1; this.lastPendingMonster = null; this.dirty = true; this.scene.refresh();
        this.afterResolve({ choice: +el.dataset.i!, success: true }, st, wasMonster);
        const entry = g!.s.log[g!.s.log.length - 1];
        this.toast(r.obeyed ? ':bubble: ตัวละครเชื่อฟังเสียงกระซิบ' : ':bubble: ตัวละครไม่ฟัง… และเลือกเอง');
        if (g!.s.log.length > before) this.showEvent({ idx: 0, entry }); else this.closeModal();
        break;
      }
      case 'restore': this.restore(); break;
      case 'tilt': this.tiltOpen = this.tiltOpen === +el.dataset.i! ? -1 : +el.dataset.i!; this.showEvent(); break;
      case 'give': {
        const r = el.dataset.kind === 'blessing' ? g!.giveBlessing(el.dataset.id!) : g!.giveCurse(el.dataset.id!);
        if (r) this.toast(`${el.dataset.kind === 'blessing' ? ':bless: มอบพร' : ':curse: สาป'}「${r}」`); else this.toast(':warning: พลังไม่พอ');
        this.dirty = true; this.backTo(from); break;
      }
      case 'giveweapon': { const r = g!.giveWeapon(v as 'holy' | 'cursed'); if (r) this.toast(`:weapon: ${r}`); this.dirty = true; this.backTo(from); break; }
      case 'senddream': {
        const r = g!.sendDream(el.dataset.id!);
        if (r) this.toast(r.clear ? `:dream: ฝันชัดเจน: "${r.meaning}"` : `:bubble: ฝันเลือนราง… ตีความว่า "${r.meaning}"`);
        this.dirty = true; this.backTo(from); break;
      }
      case 'domiracle': {
        const r = g!.miracle(v as 'heal' | 'harvest' | 'quake' | 'meteor');
        this.dirty = true; this.scene.refresh();
        if (r && g!.s.pending?.kind === 'death') { this.showDeathDoor(); break; }
        this.backTo(from); break;
      }
      case 'fate': {
        const r = g!.alterFate(+el.dataset.i!, v as 'good' | 'bad');
        if (r) this.toast(`:fate: ชะตาเปลี่ยนเป็น「${r}」`); else this.toast(':warning: พลังไม่พอ');
        this.dirty = true; break;
      }
      case 'decide': {
        const before = g!.s.log.length;
        const st = g!.s.pending?.storylet;
        const wasMonster = !!g!.s.pending?.monsterId;
        const res = g!.resolve();
        this.tiltOpen = -1;
        this.lastPendingMonster = null;
        this.dirty = true;
        this.scene.refresh();
        this.afterResolve(res, st, wasMonster);
        const entry = g!.s.log[g!.s.log.length - 1];
        if (res && g!.s.log.length > before) this.showEvent({ idx: res.choice, entry });
        else this.closeModal();
        break;
      }
      case 'closeoutcome': this.closeModal(); break;
      case 'omen-ok': g!.resolve(); this.closeModal(); break;
      case 'omen-fate': g!.resolve(); this.tab = 'fate'; this.setSpeed(0); this.closeModal(); break;
      case 'revive': {
        const ok = g!.decideDeath(v as 'faith' | 'dread');
        this.dirty = true;
        if (ok) { this.closeModal(); this.toast(':miracle: ปาฏิหาริย์!'); } else this.showSummary();
        break;
      }
      case 'letdie': g!.decideDeath(null); this.setSpeed(0); this.dirty = true; this.save(true); this.cloud.track('death', { hAge: g!.c.hAge, cause: g!.c.deathCause, title: g!.title(), job: g!.c.job, quest: g!.s.quest, prayersAnswered: g!.s.lifeStats.interventions, fame: g!.c.fame }); this.showSummary(); break;
      case 'heir': g!.continueAsHeir(+el.dataset.i!); this.narrator.newLife(); this.epitaph = ''; this.scene.refresh(true); if (this.cityActive()) this.city.refresh(); this.closeModal(); this.setSpeed(1); break;
      case 'reincarnate': this.newLife(String(Date.now())); break;
      case 'copycard': {
        const text = `【เกมจำลองต่างโลก】${g!.c.name} 「${g!.title()}」\n${g!.summaryLine()}\nชื่อเสียง ${g!.c.fame} · สังหาร ${g!.c.kills} · ลูกหลาน ${g!.c.children.length} · กรรม ${g!.s.karmaLife}${this.epitaph ? `\n“${this.epitaph}”` : ''}\nseed: ${g!.s.seed}`;
        navigator.clipboard?.writeText(text).then(() => this.toast(':check: คัดลอกแล้ว!'), () => this.toast(':cross: คัดลอกไม่สำเร็จ'));
        break;
      }
      case 'savecard': this.downloadCard(); break;
      case 'savesettings': {
        const pa = ($('#pauseAll') as HTMLInputElement).checked;
        localStorage.setItem('isekai.pauseAll', pa ? 'on' : 'off');
        if (g) g.pauseOnChoices = pa;
        this.cinePause = ($('#cinePause') as HTMLInputElement).checked;
        localStorage.setItem('isekai.cinePause', this.cinePause ? 'on' : 'off');
        const so = document.getElementById('statsOn') as HTMLInputElement | null;
        if (so) this.cloud.setStats(so.checked);
        const lo = document.getElementById('llmOn') as HTMLInputElement | null;
        if (lo) this.narrator.setEnabled(lo.checked);
        const lb = document.getElementById('llmBudget') as HTMLInputElement | null;
        if (lb) this.narrator.stats.budget = Math.max(0, Math.min(40, +lb.value || 0));
        this.closeModal(); break;
      }
      case 'wipe': if (confirm('ลบเซฟและ Codex ทั้งหมด?')) { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(META_KEY); location.reload(); } break;
    }
  }

  downloadCard() {
    const g = this.game!;
    const c = g.c;
    const cv = document.createElement('canvas');
    cv.width = 600; cv.height = 340;
    const x = cv.getContext('2d')!;
    const grd = x.createLinearGradient(0, 0, 600, 340);
    grd.addColorStop(0, '#2a2438'); grd.addColorStop(1, '#141722');
    x.fillStyle = grd; x.fillRect(0, 0, 600, 340);
    x.strokeStyle = '#e8c46a'; x.lineWidth = 6; x.strokeRect(3, 3, 594, 334);
    const pc = document.createElement('canvas'); pc.width = 60; pc.height = 80;
    drawPortrait(pc.getContext('2d')!, c.race, 5);
    x.imageSmoothingEnabled = false; x.drawImage(pc, 30, 40);
    x.fillStyle = '#e8c46a'; x.font = '16px Itim, sans-serif'; x.fillText('การ์ดสรุปชีวิต · เกมจำลองต่างโลก', 110, 40);
    x.fillStyle = '#efe8d6'; x.font = '32px Itim, sans-serif'; x.fillText(c.name, 110, 80);
    x.fillStyle = '#e8c46a'; x.font = '18px Sarabun, sans-serif'; x.fillText(`「${g.title()}」`, 110, 108);
    x.fillStyle = '#efe8d6'; x.font = '15px Sarabun, sans-serif';
    wrap(x, g.summaryLine(), 110, 140, 460, 22);
    x.fillStyle = '#9d9786';
    x.fillText(`ชื่อเสียง ${c.fame} · สังหาร ${c.kills} · ลูกหลาน ${c.children.length} · กรรม ${g.s.karmaLife} · ความเชื่อ ${c.belief}`, 30, 250);
    if (this.epitaph) { x.fillStyle = '#c8e8e0'; x.font = 'italic 14px Sarabun, sans-serif'; wrap(x, `“${this.epitaph}”`, 30, 280, 540, 20); }
    x.fillStyle = '#5a5648'; x.font = '11px Sarabun, sans-serif'; x.fillText(`seed: ${g.s.seed}`, 30, 328);
    const a = document.createElement('a');
    a.download = `life-${c.name}.png`; a.href = cv.toDataURL('image/png'); a.click();
  }
}

function wrap(x: CanvasRenderingContext2D, text: string, left: number, top: number, maxW: number, lh: number) {
  let line = '';
  let y = top;
  for (const ch of Array.from(text)) {
    if (x.measureText(line + ch).width > maxW) { x.fillText(line, left, y); line = ''; y += lh; }
    line += ch;
  }
  if (line) x.fillText(line, left, y);
}

// Count of distinct event renderings: text alternatives × placeholder pools × (choice, success/fail) outcomes, plus monsters.
function estimateCombos(): string {
  const npc = RACES.reduce((a, r) => a + r.syl[0].length * (r.syl[1].length + 1) * r.syl[2].length, 0);
  const pools: Record<string, number> = {
    npc, npc2: npc, town: 5 * 10 * 10, place: 143, item: 12, food: 10, animal: 8, loc: 10, god: 5, race: 14, raceNpc: 14, job: JOBS.length,
    lover: npc, spouse: npc, mentor: npc, rival: npc, nemesis: npc, friend: npc, child: npc,
  };
  const variants = (text: string) => {
    let n = 1;
    for (const m of text.match(/\[([^\]]+)\]/g) || []) n *= m.split('|').length;
    for (const k of new Set((text.match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1)))) n *= pools[k] || 1;
    return n;
  };
  let total = 0;
  for (const s of STORYLETS) {
    const base = variants(s.t);
    const outs = (s.ch || []).reduce((a, ch) => a + variants(ch.ok[0]) + (ch.ng ? variants(ch.ng[0]) : 0), 0) || 1;
    total += base * outs;
  }
  total += MONSTERS.reduce((a, m) => a + (m.climates === 'any' ? 6 : m.climates.length) * 4 * 2, 0);
  if (total > 1e9) return `${(total / 1e9).toFixed(1)} พันล้าน`;
  return `${(total / 1e6).toFixed(1)} ล้าน`;
}
