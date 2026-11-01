import { RNG } from './rng';
import type {
  Axis, Character, Choice, ChoiceTag, Cond, Country, GameState, LogEntry, PendingEvent, Relation, Spectacle, StatKey, Storylet, Tone, Weapon,
} from './types';
import { AXES, STAT_NAMES, AXIS_NAMES } from './types';
import { generateWorld, RELIGIONS } from './worldgen';
import { RARITY, CHOICE_THREADS, TAG_THREAD, THREAD_NAMES, mapAffinity, tagAffinity, boosters, rollRarity, ctxLabel, type Rarity, type Ctx } from './fortune';
import { CHAINS } from '../data/chains';
import { npcYear, weatherTick, ensureTownNotables, spawnActors, actorsTick, regionYear, regionThreads, festivalTick, finalBattle, newNpc, relRole, heroActor, demonActor } from './society';
import { applySetup, type Setup } from './setup';
import { PRAYERS, QUESTS, MAP_POWERS } from '../data/prayers';
import {
  applyAxisFx, applyStatFx, birth, buildCtx, clampAxis, createCharacter, drawGift, lifespanH, makeName, maxHp, realAge, rollFate, stageOf, tagsOf,
} from './character';
import { STORYLETS, storyletById } from '../data/storylets';
import { raceById, climateById, RACES } from '../data/races';
import { APTITUDES, aptById, skillById, UNIQUE_SKILLS, traitById } from '../data/traits';
import { BLESSINGS, CURSES, giftById, type Gift } from '../data/gifts';
import { JOBS, MONSTERS, SYMBOLS, FATES, WORDS, fateById, jobById, type Monster } from '../data/lore';

export const SEASONS = ['ใบไม้ผลิ', 'ร้อน', 'ใบไม้ร่วง', 'หนาว'];

export interface Meta {
  karma: number;
  codex: string[]; // secret job ids unlocked
  lives: string[];
  racesPlayed: string[];
  quests?: string[]; // divine quests ever completed
}

export interface GameHooks {
  onLog?: (e: LogEntry) => void;
  onImportant?: (kind: 'fate' | 'dream' | 'death' | 'flavor', ctx: Record<string, string>) => void;
  onMove?: (from: number, to: number) => void;
  onSecretJob?: (jobId: string) => void;
  onNpcEvent?: (npcId: number, text: string) => void;
  onPrayer?: () => void;
  onOmen?: (text: string) => void;
  onQuest?: (name: string) => void;
  onSpectacle?: (s: Spectacle) => void;
  onAuto?: (event: string, choice: string, success: boolean | null) => void;
}

export const COSTS = {
  bless: [0, 12, 22, 35],
  curse: [0, 8, 15, 25],
  weaponHoly: 40,
  weaponCursed: 30,
  dream: 10,
  heal: 15,
  harvest: 25,
  quake: 20,
  meteor: 35,
  reviveFaith: 60,
  reviveDread: 50,
  fateGood: 40,
  fateBad: 30,
};

const JOB_TAGS: Record<string, { tags: ChoiceTag[]; ax: Partial<Record<Axis, number>> }> = {
  farmer: { tags: ['stay', 'safe'], ax: { ambition: -1 } }, hunter: { tags: ['travel', 'fight'], ax: { social: -1 } },
  soldier: { tags: ['fight', 'stay'], ax: { brave: 1 } }, adventurer: { tags: ['travel', 'risk', 'fight'], ax: { curious: 1, brave: 1 } },
  merchant: { tags: ['greed', 'travel'], ax: { ambition: 1 } }, mage: { tags: ['learn'], ax: { curious: 1 } },
  priest: { tags: ['pray', 'help'], ax: { piety: 1 } }, thief: { tags: ['selfish', 'greed', 'risk'], ax: { honest: -1 } },
  smith: { tags: ['stay', 'learn'], ax: { ambition: 0 } }, scholar: { tags: ['learn', 'safe'], ax: { curious: 1 } },
  bard: { tags: ['love', 'travel'], ax: { social: 1 } }, fisher: { tags: ['stay', 'safe'], ax: { ambition: -1 } },
  healer: { tags: ['help'], ax: { kind: 1 } }, knight: { tags: ['fight', 'help'], ax: { honest: 1, brave: 1 } },
  assassin: { tags: ['selfish', 'fight'], ax: { kind: -1 } }, druid: { tags: ['help', 'stay'], ax: { social: -1 } },
  pirate: { tags: ['greed', 'travel', 'risk'], ax: { honest: -1 } }, cook: { tags: ['stay', 'help'], ax: { social: 1 } },
  warlock: { tags: ['greed', 'risk', 'defy'], ax: { piety: -1 } }, tamer: { tags: ['travel', 'help'], ax: { kind: 1 } },
  noble: { tags: ['greed', 'stay'], ax: { ambition: 1 } }, monk: { tags: ['pray', 'safe'], ax: { temper: -1 } },
  scribe: { tags: ['learn', 'safe'], ax: { curious: 1 } }, shepherd: { tags: ['stay', 'safe'], ax: { social: -1 } },
  carpenter: { tags: ['stay', 'learn'], ax: {} }, weaver: { tags: ['stay', 'love'], ax: { social: 1 } }, servant: { tags: ['safe', 'stay'], ax: { ambition: -1 } },
  performer: { tags: ['love', 'risk'], ax: { social: 1 } }, teacher: { tags: ['help', 'learn'], ax: { kind: 1 } }, seer: { tags: ['pray', 'learn'], ax: { piety: 1 } },
  archaeologist: { tags: ['travel', 'learn', 'risk'], ax: { curious: 1 } }, spy: { tags: ['selfish', 'risk'], ax: { honest: -1 } },
  diplomat: { tags: ['help', 'trust'], ax: { social: 1, temper: -1 } }, gravekeeper: { tags: ['stay', 'pray'], ax: { social: -1 } },
  innkeeper: { tags: ['stay', 'greed'], ax: { social: 1 } }, miner: { tags: ['stay', 'greed'], ax: {} }, sailor: { tags: ['travel', 'risk'], ax: { curious: 1 } },
  alchemist: { tags: ['learn', 'risk'], ax: { curious: 1 } }, royal_guard: { tags: ['fight', 'stay'], ax: { honest: 1 } },
  hero_companion: { tags: ['help', 'fight', 'travel'], ax: { brave: 1 } }, demon_servant: { tags: ['greed', 'fight'], ax: { kind: -1 } },
};

const TOWN_PRE = ['บ้าน', 'เมือง', 'หมู่บ้าน', 'ป้อม', 'ท่าเรือ'];
const TOWN_SYL = [['หิน', 'ทอง', 'เงิน', 'ลม', 'หมอก', 'ดาว', 'จันทร์', 'สน', 'เกลือ', 'กา'], ['ขาว', 'แดง', 'ดำ', 'ใหญ่', 'น้อย', 'เก่า', 'ใหม่', 'ไหล', 'ร้าง', 'หลวง']];

export const fmtDelta = (fx: string): string => {
  const parts: string[] = [];
  for (const tok of fx.split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^(\w+)([+-]\d+)$/);
    if (m) {
      const v = parseInt(m[2], 10);
      if (v === 0) continue;
      const k = m[1];
      const sign = v > 0 ? '+' : '';
      if (k in STAT_NAMES) parts.push(`${STAT_NAMES[k as StatKey]} ${sign}${v}`);
      else if (k === 'hp') parts.push(`HP ${sign}${v}`);
      else if (k === 'gold') parts.push(`ทอง ${sign}${v}`);
      else if (k === 'fame') parts.push(`ชื่อเสียง ${sign}${v}`);
      else if (k === 'karma') parts.push(`กรรม ${sign}${v}`);
      else if (k === 'belief') parts.push(`ความเชื่อ ${sign}${v}`);
      else if (k === 'faith') parts.push(`ศรัทธา ${sign}${v}`);
      else if (k === 'dread') parts.push(`ความกลัว ${sign}${v}`);
      else if (k in AXIS_NAMES) parts.push(`${AXIS_NAMES[k as Axis][v > 0 ? 0 : 1]}↑`);
    }
  }
  return parts.join(', ');
};

export class Game {
  s: GameState;
  rng: RNG;
  meta: Meta;
  hooks: GameHooks = {};
  pauseOnChoices = false; // ordinary events flow into the log; only crossroads stop time
  autoDecide = false; // the character decides every crossroad alone; the god can still intervene before and after

  constructor(state: GameState, meta: Meta) {
    this.s = state;
    this.meta = meta;
    this.rng = new RNG(1);
    this.rng.state = state.rngState;
    // saves from before towns/religions/threads existed
    const w = generateWorld();
    state.threads ??= {}; state.chains ??= []; state.townNews ??= [];
    for (const co of state.countries) { co.religion ??= w.countries[co.id].religion; co.towns ??= w.countries[co.id].towns; }
    const ch = state.char;
    ch.townId ??= w.countries[ch.countryId].towns[0]; ch.birthTime ??= 'day'; ch.birthSign ??= 'none';
    if (ch.weapon) { ch.weapon.rarity ??= 'R'; ch.weapon.element ??= ch.weapon.kind === 'holy' ? 'light' : 'dark'; }
    state.npcs ??= []; state.nextNpcId ??= 1; state.queue ??= []; state.prayers ??= []; state.prayerCd ??= {}; state.quest ??= null;
    if (!state.actors?.length) { state.actors = []; spawnActors(this); }
    ensureTownNotables(this, ch.townId);
  }

  static newGame(seed: string, meta: Meta, setup?: Setup): Game {
    const world = generateWorld();
    const rng = new RNG(seed || String(Date.now()));
    const countries: Country[] = JSON.parse(JSON.stringify(world.countries));
    const char = setup ? applySetup(rng, countries, meta.karma, setup) : birth(rng, countries, { karma: meta.karma });
    const state: GameState = {
      seed, rngState: rng.state, year: 1000 + rng.int(0, 500), tick: 0, char,
      faith: 30, dread: 10, lastPower: null, powerSwitches: 0, dream: null, log: [], worldNews: [],
      countries, pending: null, seenOnce: [], ended: false,
      lifeStats: { blessings: 0, curses: 0, dreams: 0, miracles: 0, interventions: 0 }, llmCalls: 0, pastLives: [], karmaLife: 0, threads: {}, chains: [], townNews: [],
      npcs: [], nextNpcId: 1, actors: [], queue: [], prayers: [], prayerCd: {}, quest: null,
    };
    const g = new Game(state, meta);
    g.rng = rng;
    g.logBirth();
    return g;
  }

  // ---------- helpers ----------
  get c(): Character { return this.s.char; }
  get country(): Country { return this.s.countries[this.c.countryId]; }
  tags() { return tagsOf(this.c); }
  maxHp() { return maxHp(this.c); }
  ctx(): Ctx { return buildCtx(this.c, this.country, this.s.threads); }
  get town() { return generateWorld().towns[this.c.townId]; }
  addThread(name: string, v: number) { this.s.threads[name] = Math.min(10, (this.s.threads[name] || 0) + v); }
  ctxName(key: string) {
    return ctxLabel(key, { religion: RELIGIONS, race: (id) => raceById(id)?.name || id, climate: (id) => climateById(id)?.name || id, job: (id) => jobById(id)?.name || id, trait: (id) => traitById(id)?.name || id });
  }
  stage() { return stageOf(this.c.hAge); }
  age() { return realAge(this.c); }
  sync() { this.s.rngState = this.rng.state; }

  log(text: string, kind: LogEntry['kind'] = 'event', tone?: Tone) {
    const e: LogEntry = { year: Math.floor(this.s.year), age: this.age(), text, kind, tone };
    this.s.log.push(e);
    if (this.s.log.length > 600) this.s.log.shift();
    this.hooks.onLog?.(e);
    return e;
  }

  godTitle(): string {
    const b = this.c.belief;
    if (this.s.dread > this.s.faith * 1.5 && b > 0) return 'ท่านเทพผู้น่าเกรงขาม';
    if (b >= 50) return 'ท่านเทพผู้เมตตา';
    if (b >= 10) return 'ท่านเทพ';
    if (b > -30) return 'เทพนิรนาม';
    return 'เทพจอมปลอม';
  }

  townName(): string {
    return this.rng.pick(TOWN_PRE) + this.rng.pick(TOWN_SYL[0]) + this.rng.pick(TOWN_SYL[1]);
  }

  relName(type: Relation['type']): string {
    const r = this.c.relations.find((x) => x.type === type && x.alive);
    return r ? r.name : makeName(this.rng, this.c.race);
  }

  makeVars(): Record<string, string> {
    const npcRace = this.rng.weighted(this.country.races, (r) => r.w)!.race;
    const aliveKids = this.c.children.filter((k) => k.alive);
    return {
      name: this.c.name, npc: makeName(this.rng, npcRace), npc2: makeName(this.rng, npcRace), npcRace,
      raceNpc: raceById(npcRace).name, place: this.country.name, town: this.townName(),
      item: this.rng.pick(WORDS.item), food: this.rng.pick(WORDS.food), animal: this.rng.pick(WORDS.animal), loc: this.rng.pick(WORDS.place),
      lover: this.relName('lover'), spouse: this.relName('spouse'), mentor: this.relName('mentor'), rival: this.relName('rival'),
      nemesis: this.relName('nemesis'), friend: this.relName('friend'),
      child: aliveKids.length ? this.rng.pick(aliveKids).name : 'ลูก', god: this.godTitle(),
      actor: heroActor(this)?.name || 'ผู้กล้า', demon: demonActor(this)?.name || 'จอมมาร',
      job: this.c.job ? jobById(this.c.job).name : 'คนธรรมดา', race: raceById(this.c.race).name,
    };
  }

  fill(text: string, vars: Record<string, string>): string {
    return text
      .replace(/\[([^\]]+)\]/g, (_, alts: string) => this.rng.pick(alts.split('|')))
      .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
  }

  // ---------- conditions ----------
  condOk(cond: Cond | undefined, tags: Set<string>): boolean {
    if (!cond) return true;
    const c = this.c;
    if (cond.age && (c.hAge < cond.age[0] || c.hAge > cond.age[1])) return false;
    if (cond.stage && !cond.stage.includes(this.stage())) return false;
    if (cond.climate && !cond.climate.includes(this.country.climate)) return false;
    if (cond.race && !cond.race.includes(c.race)) return false;
    if (cond.notRace && cond.notRace.includes(c.race)) return false;
    if (cond.flag && !cond.flag.some((f) => c.flags.includes(f))) return false;
    if (cond.notFlag && cond.notFlag.some((f) => c.flags.includes(f))) return false;
    if (cond.job && !(c.job && cond.job.includes(c.job))) return false;
    if (cond.notJob && c.job && cond.notJob.includes(c.job)) return false;
    if (cond.tag && !cond.tag.some((t) => tags.has(t) || c.traits.includes(t))) return false;
    if (cond.rel && !c.relations.some((r) => r.type === cond.rel && r.alive)) return false;
    if (cond.noRel && c.relations.some((r) => r.type === cond.noRel && r.alive)) return false;
    if (cond.countryFlag && !this.country.flags.includes(cond.countryFlag)) return false;
    if (cond.minStat) for (const [k, v] of Object.entries(cond.minStat)) if (c.stats[k as StatKey] < (v as number)) return false;
    if (cond.axis) for (const [k, v] of Object.entries(cond.axis)) {
      const val = c.axes[k as Axis];
      if ((v as number) >= 0 ? val < (v as number) : val > (v as number)) return false;
    }
    if (cond.gold !== undefined && (cond.gold >= 0 ? c.gold < cond.gold : c.gold > -cond.gold)) return false;
    const married = c.relations.some((r) => r.type === 'spouse' && r.alive);
    if (cond.married !== undefined && cond.married !== married) return false;
    if (cond.belief !== undefined && (cond.belief >= 0 ? c.belief < cond.belief : c.belief > cond.belief)) return false;
    if (cond.wronged && !c.flags.includes('punished')) return false;
    return true;
  }

  // ---------- effects ----------
  applyFx(fx: string, vars: Record<string, string>): string[] {
    const c = this.c;
    const notes: string[] = [];
    for (const tok of fx.split(/\s+/).filter(Boolean)) {
      let m: RegExpMatchArray | null;
      if ((m = tok.match(/^(\w+)([+-]\d+)$/))) {
        const k = m[1], v = parseInt(m[2], 10);
        if (k in STAT_NAMES) { c.stats[k as StatKey] = Math.max(1, c.stats[k as StatKey] + v); }
        else if (k === 'hp') { c.hp = Math.min(maxHp(c), c.hp + v); if (v <= -20) this.s.dread += 2; }
        else if (k === 'gold') {
          const t = this.tags();
          let val = v;
          if (v > 0 && t.has('poverty')) val = Math.ceil(v / 2);
          if (v > 0 && t.has('gold_luck')) val = Math.ceil(v * 1.5);
          c.gold = Math.max(0, c.gold + val);
        } else if (k === 'fame') c.fame += v;
        else if (k === 'belief') c.belief = clampAxis(c.belief + v);
        else if (k === 'faith') this.s.faith = Math.max(0, this.s.faith + v);
        else if (k === 'dread') this.s.dread = Math.max(0, this.s.dread + v);
        else if (k === 'karma') this.s.karmaLife += v;
        else if ((AXES as string[]).includes(k)) c.axes[k as Axis] = clampAxis(c.axes[k as Axis] + v);
      } else if (tok.startsWith('+flag:')) { const f = tok.slice(6); if (!c.flags.includes(f)) c.flags.push(f); }
      else if (tok.startsWith('-flag:')) { c.flags = c.flags.filter((f) => f !== tok.slice(6)); }
      else if (tok.startsWith('skill:')) { const n = this.gainSkill(tok.slice(6)); if (n) notes.push(`ได้ทักษะ「${n}」`); }
      else if (tok.startsWith('apt:')) { const n = this.gainApt(tok.slice(4)); if (n) notes.push(`ค้นพบความถนัด: ${n}`); }
      else if (tok.startsWith('bless:')) { const g = this.pickGift(tok.slice(6), BLESSINGS); if (g) { this.addGift(g); notes.push(`ได้รับพร「${g.name}」`); } }
      else if (tok.startsWith('curse:')) {
        const g = this.pickGift(tok.slice(6), CURSES);
        if (g && !this.tags().has('curse_ward')) { this.addGift(g); notes.push(`ต้องคำสาป「${g.name}」`); }
        else if (g) notes.push('คำสาปเด้งกลับด้วยเกราะกันคำสาป');
      }
      else if (tok.startsWith('rel:+')) { this.addRel(tok.slice(5) as Relation['type'], vars); }
      else if (tok.startsWith('relkill:')) {
        const type = tok.slice(8);
        const r = c.relations.find((x) => x.type === type && x.alive);
        if (r) r.alive = false;
        if (type === 'spouse' || type === 'lover') c.flags = c.flags.filter((f) => f !== 'married');
      } else if (tok === 'marry') {
        const r = c.relations.find((x) => x.type === 'lover' && x.alive);
        if (r) { r.type = 'spouse'; notes.push(`แต่งงานกับ ${r.name}`); }
      } else if (tok === 'child') this.addChild();
      else if (tok === 'move') this.moveTo(this.rng.pick(this.country.neighbors.length ? this.country.neighbors : [this.c.countryId]));
      else if (tok === 'move:far') {
        const raceLikes = raceById(c.race).likes;
        const target = this.rng.weighted(this.s.countries, (o) => (o.continent !== this.country.continent ? (raceLikes.includes(o.climate) ? 3 : 1) : 0))!;
        this.moveTo(target.id);
      } else if (tok.startsWith('die:')) { c.hp = 0; c.deathCause = tok.slice(4).replace(/_/g, ' '); }
      else if (tok.startsWith('job:')) this.setJob(tok.slice(4));
      else if (tok === 'kill') {
        c.kills++;
        if (c.weapon) {
          c.weapon.kills++;
          const what = vars.monsterName || 'ศัตรู';
          if (c.weapon.history.length < 12) c.weapon.history.push(`ปี ${Math.floor(this.s.year)}: ${c.name} ใช้มันสังหาร${what}`);
        }
      } else if (tok.startsWith('weapon:')) {
        const [, kind, element, floor] = tok.split(':');
        const w = this.makeWeapon(kind as Weapon['kind'], element, (floor as Rarity) || 'C');
        if (c.weapon) w.history.unshift(`(แทนที่ ${c.weapon.name})`);
        c.weapon = w;
        notes.push(`ได้อาวุธ「${w.name}」[${RARITY[w.rarity].name}]`);
      } else if (tok.startsWith('thread:+')) {
        const [name, v] = tok.slice(8).split(':');
        this.addThread(name, Number(v) || 2);
      } else if (tok.startsWith('chain:')) this.scheduleChain(tok.slice(6), vars);
      else if (tok.startsWith('country:-')) { const f = tok.slice(9); this.country.flags = this.country.flags.filter((x) => x !== f); delete this.country.until[f]; if (f === 'war') this.country.warWith = null; }
      else if (tok === 'uncurse:random' && c.curses.length) {
        const id = this.rng.pick(c.curses);
        const g = giftById(id);
        c.curses = c.curses.filter((x) => x !== id);
        applyStatFx(c.stats, g.fx.replace(/([+-])(\d+)/g, (_m, sg: string, n: string) => (sg === '+' ? '-' : '+') + n));
        notes.push(`คำสาป「${g.name}」สลายไป`);
      }
      else if (tok.startsWith('npc:') && vars.npcId) {
        const n = this.s.npcs.find((x) => x.id === +vars.npcId);
        const op = tok.slice(4);
        if (n && op === 'heal') n.tags = n.tags.filter((t) => t !== 'sick');
        else if (n && op === 'die') { n.alive = false; const r = c.relations.find((x) => x.npcId === n.id && x.alive); if (r) r.alive = false; }
        else if (n && op.startsWith('att')) n.attitude = Math.max(-100, Math.min(100, n.attitude + parseInt(op.slice(3), 10)));
      } else if (tok.startsWith('actor:')) finalBattle(this, ({ herowin: 'hero', demonwin: 'demon' } as Record<string, 'hero' | 'demon'>)[tok.slice(6)] || 'coin');
      else if (tok.startsWith('country:+')) { this.setCountryFlag(this.country, tok.slice(9), 16); }
      else if (tok.startsWith('fate:+')) {
        const f = fateById(tok.slice(6));
        if (f) c.fate.push({ fateId: f.id, hAge: c.hAge + this.rng.int(3, 8), omenShown: false, done: false });
      }
    }
    if (c.children.some((k) => k.alive) && !c.flags.includes('has_child')) c.flags.push('has_child');
    return notes;
  }

  pickGift(arg: string, pool: Gift[]): Gift | undefined {
    if (arg === 'random') return drawGift(this.rng, pool, this.ctx(), [...this.c.blessings, ...this.c.curses]);
    if (arg.startsWith('tag=')) {
      // a gift fitting a theme, e.g. bless:tag=light
      const tag = arg.slice(4);
      return drawGift(this.rng, pool.filter((g) => g.tags.includes(tag)), this.ctx(), [...this.c.blessings, ...this.c.curses]) || drawGift(this.rng, pool, this.ctx(), [...this.c.blessings, ...this.c.curses]);
    }
    return pool.find((g) => g.id === arg);
  }

  // ---------- chained events ----------
  scheduleChain(id: string, vars: Record<string, string>) {
    const def = CHAINS[id];
    if (!def || this.s.chains.some((x) => x.id === id)) return;
    const keep: Record<string, string> = {};
    for (const k of ['npc', 'npcRace', 'raceNpc', 'town', 'item', 'animal', 'monsterName']) if (vars[k]) keep[k] = vars[k];
    this.s.chains.push({ id, at: this.c.hAge + this.rng.float(def.delay[0], def.delay[1]), vars: keep });
  }

  chainChance(id: string, ctx = this.ctx()): number {
    const def = CHAINS[id];
    return def ? Math.min(0.95, def.p * mapAffinity(def.aff, ctx)) : 0;
  }

  dueChain(): Storylet | null {
    const c = this.c;
    const i = this.s.chains.findIndex((x) => c.hAge >= x.at);
    if (i < 0) return null;
    const [due] = this.s.chains.splice(i, 1);
    const st = storyletById(due.id);
    if (!st || !this.condOk(st.c, this.tags())) return null;
    if (!this.rng.chance(this.chainChance(due.id))) return null;
    this.pendingChainVars = due.vars;
    return st;
  }
  private pendingChainVars: Record<string, string> | null = null;

  addGift(g: Gift) {
    const list = g.kind === 'blessing' ? this.c.blessings : this.c.curses;
    if (list.includes(g.id)) return;
    list.push(g.id);
    applyStatFx(this.c.stats, g.fx);
    applyAxisFx(this.c.axes, g.fx);
    for (const tok of g.fx.split(/\s+/)) {
      const m = tok.match(/^(hp|gold|fame|belief)([+-]\d+)$/);
      if (m) this.applyFx(tok, {});
      if (tok.startsWith('+flag:')) this.applyFx(tok, {});
    }
  }

  gainApt(arg: string): string | null {
    const c = this.c;
    let pool = APTITUDES.filter((a) => !c.aptitudes.includes(a.id) && a.id !== 'absorb');
    if (arg === 'magic') pool = pool.filter((a) => a.tags.includes('magic'));
    else if (arg !== 'random') pool = pool.filter((a) => a.id === arg);
    if (!pool.length) return null;
    const a = this.rng.pick(pool);
    c.aptitudes.push(a.id);
    if (!c.skills.includes(`${a.id}_1`)) { c.skills.push(`${a.id}_1`); applyStatFx(c.stats, skillById(`${a.id}_1`).fx); }
    return a.name;
  }

  gainSkill(arg: string): string | null {
    const c = this.c;
    let id: string | undefined;
    if (arg === 'random') {
      // next tier in an owned aptitude, sometimes a new tier-1 elsewhere
      const options: string[] = [];
      for (const apt of c.aptitudes) {
        for (let t = 1; t <= 3; t++) { const sid = `${apt}_${t}`; if (!c.skills.includes(sid)) { options.push(sid); break; } }
      }
      if (this.tags().has('fast_learner') || this.tags().has('copycat') || !options.length) {
        const extra = APTITUDES.filter((a) => a.id !== 'absorb' && !c.skills.includes(`${a.id}_1`)).map((a) => `${a.id}_1`);
        if (!options.length || this.rng.chance(0.3)) options.push(this.rng.pick(extra));
      }
      id = options.length ? this.rng.pick(options) : undefined;
    } else if (arg === 'unique') {
      const pool = UNIQUE_SKILLS.filter((u) => !c.skills.includes(u.id));
      id = pool.length ? this.rng.pick(pool).id : undefined;
    } else id = arg;
    if (!id || c.skills.includes(id) || !skillById(id)) return null;
    const sk = skillById(id);
    c.skills.push(id);
    applyStatFx(c.stats, sk.fx);
    applyAxisFx(c.axes, sk.fx);
    const bm = sk.fx.match(/belief([+-]\d+)/);
    if (bm) c.belief = clampAxis(c.belief + parseInt(bm[1], 10));
    const fm = sk.fx.match(/fame([+-]\d+)/);
    if (fm) c.fame += parseInt(fm[1], 10);
    if (sk.apt && !c.aptitudes.includes(sk.apt)) c.aptitudes.push(sk.apt);
    return sk.name;
  }

  addRel(type: Relation['type'], vars: Record<string, string>) {
    if (type === 'child') { this.addChild(vars.npc); return; }
    const old = this.c.relations.find((r) => r.type === type && r.alive);
    if (old && (type === 'lover' || type === 'mentor')) return;
    // the person becomes (or already is) an NPC with a life of their own
    const known = vars.npcId ? this.s.npcs.find((n) => n.id === +vars.npcId) : undefined;
    const npc = known || newNpc(this, vars.npc, vars.npcRace || this.c.race, this.c.townId, relRole(type), Math.max(10, this.c.hAge + this.rng.int(-6, 6)));
    if (type === 'mentor') npc.hAge = Math.max(npc.hAge, this.c.hAge + 30);
    this.c.relations.push({ id: this.c.relations.length + 1, type, name: npc.name, race: npc.race, alive: true, affinity: type === 'nemesis' || type === 'rival' ? -50 : 50, npcId: npc.id });
  }

  queueStory(id: string, vars: Record<string, string>) {
    if (this.s.queue.length >= 3 || this.s.queue.some((q) => q.id === id)) return;
    this.s.queue.push({ id, vars });
  }

  addChild(adoptedName?: string) {
    const c = this.c;
    if (!adoptedName && this.tags().has('barren')) { this.log('ความหวังที่จะมีทายาทดับลงอีกครั้ง… คำสาปไร้ทายาทยังคงอยู่', 'event', 'dark'); return; }
    const spouse = c.relations.find((r) => r.type === 'spouse' && r.alive);
    let race = c.race;
    if (spouse && this.rng.chance(0.5)) race = spouse.race;
    const gender = this.rng.weighted(raceById(race).genders, (x) => x[1])![0];
    const traits = this.rng.sample(['kind', 'curious', 'reckless', 'shy', 'ambitious', 'humor', 'stubborn', 'dreamer', 'glutton', 'honest', 'cunning', 'family'], 2);
    c.children.push({ name: adoptedName || makeName(this.rng, race), race, gender, bornAt: c.hAge, traits, alive: true });
    if (!c.flags.includes('has_child')) c.flags.push('has_child');
  }

  moveTo(id: number) {
    if (id === this.c.countryId) return;
    const from = this.c.countryId;
    this.c.countryId = id;
    this.c.townId = this.rng.pick(this.s.countries[id].towns);
    ensureTownNotables(this, this.c.townId);
    this.c.flags = this.c.flags.filter((f) => f !== 'uncomfortable');
    this.log(`:move: ${this.c.name} ย้ายไปอยู่${this.town.name} ${this.country.name} (:${this.country.climate}: ${climateById(this.country.climate).name})`, 'event');
    this.hooks.onMove?.(from, id);
  }

  setJob(id: string) {
    const j = jobById(id);
    if (!j) return;
    this.c.job = id;
    this.c.secretJob = !!j.secret;
    if (j.secret && !this.meta.codex.includes(id)) { this.meta.codex.push(id); this.hooks.onSecretJob?.(id); }
  }

  // element follows the land's faith; rarity rolls higher when the story fits (religion, birth, threads, tags)
  weaponElement(kind: Weapon['kind']): string {
    if (kind === 'cursed') return this.country.religion === 'moon' || this.c.race === 'vampire' ? 'blood' : 'dark';
    const byReligion: Record<string, string> = { dragon: 'fire', sea: 'water', naga: 'water', moon: 'ice', war: 'lightning', nature: 'wind' };
    return byReligion[this.country.religion] && this.rng.chance(0.6) ? byReligion[this.country.religion] : 'light';
  }

  weaponRarityMult(kind: Weapon['kind'], element: string): number {
    return tagAffinity([element, kind === 'holy' ? 'holy' : 'dark'], this.ctx());
  }

  makeWeapon(kind: Weapon['kind'], element?: string, floor: Rarity = 'C'): Weapon {
    const el = element || this.weaponElement(kind);
    const rarity = rollRarity(() => this.rng.next(), this.weaponRarityMult(kind, el), floor);
    const apt = this.c.aptitudes.find((a) => aptById(a).tags.includes('combat') || aptById(a).tags.includes('magic')) || 'sword';
    const base: Record<string, string> = { sword: 'ดาบ', axe: 'ขวาน', spear: 'หอก', bow: 'ธนู', dagger: 'มีดสั้น', unarmed: 'สนับมือ', shield: 'โล่', hammer: 'ค้อน', whip: 'แส้', sling: 'หนังสติ๊ก', mounted: 'ทวน' };
    const noun = base[apt] || 'คทา';
    const ELEM: Record<string, [string, string[]]> = {
      light: ['แห่งแสง', ['light', 'holy']], fire: ['เพลิงมังกร', ['fire']], water: ['แห่งกระแสธาร', ['water']], ice: ['น้ำแข็งจันทรา', ['ice']],
      lightning: ['อัสนี', ['lightning']], wind: ['สายลม', ['wind']], dark: ['แห่งราตรี', ['dark']], blood: ['กระหายโลหิต', ['blood', 'dark']],
    };
    const [elName, elTags] = ELEM[el] || ELEM.light;
    const epithet: Record<Rarity, string[]> = {
      C: [''], U: ['ชั้นดี', 'ของทหารผ่านศึก'], R: ['แห่งคำสัตย์', 'ผู้พิทักษ์', 'ไร้นาม'],
      E: ['แห่งรุ่งอรุณ', 'ผู้กลืนวิญญาณ', 'แห่งตำนานที่ถูกลืม'], L: ['「นิรันดร์」', '「ผู้ตัดชะตา」', '「หัวใจโลก」'],
    };
    const name = `${noun}${elName}${this.rng.pick(epithet[rarity])}`;
    return {
      name, kind, rarity, element: el, power: RARITY[rarity].power + (kind === 'cursed' ? 1 : 0),
      tags: [...elTags, ...(kind === 'holy' ? ['holy'] : ['cursed_weapon'])], kills: 0,
      history: [`ปี ${Math.floor(this.s.year)}: ${kind === 'holy' ? 'ปรากฏพร้อมแสงสวรรค์' : 'ถูกหลอมจากความกลัว'} มอบแก่ ${this.c.name}`],
    };
  }

  setCountryFlag(country: Country, flag: string, ticks: number) {
    if (!country.flags.includes(flag)) country.flags.push(flag);
    country.until[flag] = this.s.tick + ticks;
  }

  // ---------- choice AI ----------
  choiceScores(st: Storylet): number[] {
    const c = this.c;
    const tags = this.tags();
    const dream = this.s.dream;
    return (st.ch || []).map((ch) => {
      let s = 0;
      for (const [k, w] of Object.entries(ch.ax || {})) s += (w as number) * (c.axes[k as Axis] / 50);
      if (dream && dream.remaining > 0) {
        let mult = 1;
        if (tags.has('gullible')) mult = 1.6;
        if (tags.has('stubborn')) mult = 0.5;
        s += ch.tags.filter((t) => dream.tags.includes(t)).length * dream.strength * mult;
      }
      if (ch.tags.includes('pray')) s += c.belief / 60;
      if (ch.tags.includes('greed') && tags.has('greedy')) s += 0.6;
      if (ch.tags.includes('help') && tags.has('justice')) s += 0.4;
      if (ch.tags.includes('travel') && tags.has('wanderer')) s += 0.5;
      if (ch.tags.includes('stay') && tags.has('homebody')) s += 0.5;
      if (ch.tags.includes('fight') && tags.has('bloodlust')) s += 0.6;
      if (ch.tags.includes('love') && tags.has('flirt')) s += 0.4;
      if (ch.tags.includes('distrust') && tags.has('distrustful')) s += 0.5;
      if (ch.tags.includes('risk') && c.hp < maxHp(c) * 0.35) s -= 0.6;
      return s;
    });
  }

  choiceProbs(st: Storylet): number[] {
    const scores = this.choiceScores(st);
    const T = 0.75;
    const mx = Math.max(...scores);
    const ex = scores.map((s) => Math.exp((s - mx) / T));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((e) => e / sum);
  }

  checkBonus(ch: Choice): number {
    if (!ch.chk) return 0;
    const tags = this.tags();
    const c = this.c;
    let b = Math.floor((c.stats[ch.chk[0]] - 10) / 2);
    if (ch.bonusTag?.some((t) => tags.has(t))) b += 4;
    if (ch.malusTag?.some((t) => tags.has(t))) b -= 4;
    if (tags.has('hero_luck')) b += 1;
    if (ch.tags.includes('fight') && c.weapon) b += c.weapon.power;
    if (ch.tags.includes('fight') && tags.has('dull')) b -= 2;
    if (ch.tags.includes('fight') && c.hp < maxHp(c) * 0.3) b -= 2;
    return b;
  }

  rerollChance(): number {
    const tags = this.tags();
    let r = this.c.stats.luk * 0.015;
    if (tags.has('lucky')) r += 0.15;
    if (tags.has('second_chance')) r += 0.2;
    if (tags.has('jinx')) r -= 0.1;
    return Math.max(0, Math.min(0.6, r));
  }

  successChance(ch: Choice): number {
    if (!ch.chk) return 1;
    const need = ch.chk[1] - this.checkBonus(ch);
    const p = Math.max(0.05, Math.min(0.95, (21 - need) / 20));
    const r = this.rerollChance();
    return p + (1 - p) * r * p;
  }

  // ---------- prayers ----------
  prayerTick() {
    const c = this.c;
    // unanswered prayers lapse: silence is an answer too
    for (const p of [...this.s.prayers]) if (this.s.tick >= p.expires) {
      this.s.prayers = this.s.prayers.filter((x) => x !== p);
      c.belief = clampAxis(c.belief - 2);
      this.log(`:bubble: ${this.fill(p.text, p.vars)}\n→ ไม่มีเสียงตอบจากฟ้า (ความเชื่อ -2)`, 'god', 'grim');
    }
    if (this.s.prayers.length >= 2 || c.belief < -70) return;
    const tags = this.tags();
    let p = 0.035 + Math.max(0, c.axes.piety) / 2500 + (tags.has('oracle') ? 0.02 : 0);
    const pool = PRAYERS.filter((x) => (this.s.prayerCd[x.id] ?? -99) + 24 <= this.s.tick && x.when(this));
    if (pool.some((x) => ['heal', 'rain', 'plague', 'peace', 'kin_sick'].includes(x.id))) p *= 3; // trouble makes people pray
    if (!pool.length || !this.rng.chance(p)) return;
    const pr = this.rng.weighted(pool, (x) => x.w)!;
    const who = pr.npc?.(this);
    const vars = { ...this.makeVars(), ...(who ? { npc: who.name, npcId: String(who.id) } : {}) };
    this.s.prayerCd[pr.id] = this.s.tick;
    this.s.prayers.push({ uid: this.s.tick * 10 + this.s.prayers.length, id: pr.id, text: pr.text, expires: this.s.tick + 14, vars });
    this.hooks.onPrayer?.();
  }

  answerPrayer(uid: number, answer: 'grant' | 'deny' | 'punish'): string | null {
    const card = this.s.prayers.find((x) => x.uid === uid);
    if (!card) return null;
    const pr = PRAYERS.find((x) => x.id === card.id)!;
    const c = this.c;
    const devout = c.axes.piety > 30 ? 1.5 : 1;
    const ask = this.fill(pr.text, card.vars);
    if (answer === 'grant') {
      if (!this.spend('faith', pr.grant.cost)) return null;
      const notes = this.applyFx(pr.grant.fx, card.vars);
      const gain = Math.round(8 * devout);
      c.belief = clampAxis(c.belief + gain);
      this.addThread('faithful', 1.5);
      this.log(`:bless: ${ask}\n→ คุณประทานตามคำขอ: ${this.fill(pr.grant.log, card.vars)}${notes.length ? ` (${notes.join(', ')})` : ''} (ความเชื่อ +${gain})`, 'god', 'warm');
    } else if (answer === 'punish') {
      this.s.dread += pr.punish.gain;
      const notes = this.applyFx(pr.punish.fx, card.vars);
      c.belief = clampAxis(c.belief - 12);
      this.markWronged();
      if (this.s.lastPower && this.s.lastPower !== 'dread') this.s.powerSwitches++;
      this.s.lastPower = 'dread';
      this.log(`:curse: ${ask}\n→ คุณลงโทษผู้ร้องขอ: ${this.fill(pr.punish.log, card.vars)}${notes.length ? ` (${notes.join(', ')})` : ''} (ความกลัว +${pr.punish.gain}, ความเชื่อ -12)`, 'god', 'dark');
    } else {
      const loss = c.traits.includes('devout') ? 1 : 3;
      c.belief = clampAxis(c.belief - loss);
      this.log(`:bubble: ${ask}\n→ คุณเลือกไม่ตอบ… ${c.name} เข้าใจว่าฟ้ามีเหตุผลของมัน (ความเชื่อ -${loss})`, 'god', 'grim');
    }
    this.s.prayers = this.s.prayers.filter((x) => x !== card);
    this.s.lifeStats.interventions++;
    this.checkDeath();
    this.sync();
    return answer;
  }

  // ---------- whisper at a crossroads ----------
  whisperCost(): number { return 10 + 4 * (this.s.lifeStats.interventions % 5); }

  obeyChance(): number {
    const c = this.c;
    const t = this.tags();
    let p = 0.4 + c.belief / 140 + c.axes.piety / 400;
    if (t.has('gullible')) p += 0.15;
    if (t.has('oracle') || t.has('lucid')) p += 0.1;
    if (t.has('stubborn')) p -= 0.2;
    if (t.has('faithless')) p -= 0.2;
    return Math.max(0.05, Math.min(0.95, p));
  }

  whisper(index: number): { obeyed: boolean } | null {
    const p = this.s.pending;
    if (!p || p.kind !== 'story' || !p.storylet.ch?.[index]) return null;
    if (!this.spend('faith', this.whisperCost())) return null;
    const obeyed = this.rng.next() < this.obeyChance();
    const c = this.c;
    if (obeyed) {
      c.belief = clampAxis(c.belief + 3);
      this.log(`:bubble: เสียงกระซิบดังขึ้นในใจ ${c.name}: "${p.storylet.ch[index].l.replace(/:\w+:\s*/g, '')}" — ${c.name} เชื่อฟัง`, 'god', 'warm');
      this.resolve(index);
    } else {
      c.belief = clampAxis(c.belief - 4);
      this.log(`:bubble: เสียงกระซิบดังขึ้นในใจ ${c.name}… แต่${c.name}ส่ายหน้า "ข้าจะเลือกทางของข้าเอง" (ความเชื่อ -4)`, 'god', 'comedy');
      this.resolve();
    }
    return { obeyed };
  }

  // ---------- powers cast on a country ----------
  castOnCountry(powerId: string, countryId: number): string | null {
    const pw = MAP_POWERS.find((x) => x.id === powerId);
    const co = this.s.countries[countryId];
    if (!pw || !co || !this.spend(pw.pool, pw.cost)) return null;
    for (const f of pw.remove || []) { co.flags = co.flags.filter((x) => x !== f); delete co.until[f]; if (f === 'war') co.warWith = null; }
    if (pw.add) this.setCountryFlag(co, pw.add[0], pw.add[1]);
    if (pw.pool === 'dread') this.s.dread += Math.round(pw.cost / 3); // fear spreads beyond the target
    const text = `:${pw.icon}: ${pw.news.replace('{c}', co.name)}`;
    this.s.worldNews.unshift({ year: Math.floor(this.s.year), age: this.age(), text, kind: 'world' });
    co.history.push(`ปี ${Math.floor(this.s.year)}: ${pw.news.replace('{c}', co.name)}`);
    if (this.c.countryId === countryId && this.c.alive) {
      const notes = pw.heroFx ? this.applyFx(pw.heroFx, {}) : [];
      this.c.belief = clampAxis(this.c.belief + pw.belief);
      if (pw.pool === 'dread') this.markWronged();
      if (!this.c.flags.includes('saw_miracle') && pw.pool === 'faith') this.c.flags.push('saw_miracle');
      this.log(`${text}\n→ ${this.c.name} เห็นกับตา${pw.pool === 'faith' ? ' และรู้สึกถึงความเมตตาของฟ้า' : ' และหวาดกลัวพลังที่มองไม่เห็น'}${notes.length ? ` (${notes.join(', ')})` : ''}`, 'god', pw.pool === 'faith' ? 'warm' : 'dark');
      this.checkDeath();
    } else this.log(text, 'god');
    this.s.lifeStats.miracles++;
    this.sync();
    return pw.name;
  }

  // ---------- divine quest ----------
  questOffers(): string[] {
    const r = new RNG(this.s.rngState ^ 0x5eed);
    return r.sample(QUESTS, 3).map((q) => q.id);
  }

  setQuest(id: string) { this.s.quest = { id, done: false }; }

  questCheck() {
    const q = this.s.quest;
    if (!q || q.done) return;
    const def = QUESTS.find((x) => x.id === q.id);
    if (!def || def.progress(this) < 1) return;
    q.done = true;
    if (def.reward.faith) this.s.faith += def.reward.faith;
    if (def.reward.dread) this.s.dread += def.reward.dread;
    if (def.reward.karma) this.s.karmaLife += def.reward.karma;
    if (!this.meta.quests) this.meta.quests = [];
    if (!this.meta.quests.includes(q.id)) this.meta.quests.push(q.id);
    this.log(`:miracle: พันธกิจสำเร็จ!「${def.name}」 รางวัล: ${def.reward.faith ? `ศรัทธา +${def.reward.faith} ` : ''}${def.reward.dread ? `ความกลัว +${def.reward.dread} ` : ''}${def.reward.karma ? `กรรม +${def.reward.karma}` : ''}`, 'god', 'warm');
    this.hooks.onQuest?.(def.name);
  }

  // ---------- hints for the god ----------
  // What an outcome may set in motion, in plain words (chain chances are computed from the current story)
  fxHints(fx: string, vars: Record<string, string> = {}): string[] {
    const out: string[] = [];
    const REL: Record<string, string> = { mentor: 'ได้อาจารย์', lover: 'ความรักเริ่มต้น', nemesis: 'ได้ศัตรูคู่อาฆาต', rival: 'ได้คู่แข่ง', friend: 'ได้มิตรสหาย', child: 'ได้ลูกศิษย์', spouse: 'คู่ชีวิต', parent: 'พ่อแม่' };
    const FLAG: Record<string, string> = { wanted: 'ถูกตามล่า', hunted: 'ถูกหมายหัว', noble: 'ได้บรรดาศักดิ์', criminal: 'มีประวัติอาชญากร', veteran: 'กลายเป็นทหารผ่านศึก', prophet: 'กลายเป็นศาสดา', chosen: 'เป็นผู้ถูกเลือก', king: 'ได้ครองบัลลังก์', pet: 'ได้สัตว์คู่ใจ', beast_companion: 'ได้สัตว์อสูรคู่หู', dragon_bond: 'ผูกพันกับมังกร', dragonslayer: 'ได้ฉายาผู้ฆ่ามังกร', outlaw: 'เข้าสู่โลกนอกกฎหมาย', rebel: 'ถูกมองเป็นกบฏ', shadow_guild: 'เข้าสมาคมเงา', godhunter: 'ปฏิญาณล่าเทพ' };
    for (const tok of fx.split(/\s+/).filter(Boolean)) {
      let m: RegExpMatchArray | null;
      if (tok.startsWith('chain:')) {
        const id = tok.slice(6);
        const def = CHAINS[id];
        if (def) out.push(`:fate:${this.fill(def.hint, { ...this.makeVars(), ...vars })} (~${Math.round(this.chainChance(id) * 100)}%)`);
      } else if (tok.startsWith('job:')) out.push(`เป็น${jobById(tok.slice(4))?.name || ''}`);
      else if (tok.startsWith('+flag:') && FLAG[tok.slice(6)]) out.push(FLAG[tok.slice(6)]);
      else if (tok.startsWith('rel:+')) out.push(REL[tok.slice(5)] || '');
      else if (tok.startsWith('relkill:')) out.push(`สูญเสีย${{ mentor: 'อาจารย์', lover: 'คนรัก', spouse: 'คู่ชีวิต', friend: 'เพื่อน', nemesis: 'ศัตรู (จบความแค้น)', rival: 'คู่แข่ง' }[tok.slice(8)] || ''}`);
      else if (tok === 'kill') out.push('ได้ชัยชนะ');
      else if (tok === 'marry') out.push('แต่งงาน');
      else if (tok === 'child') out.push('มีลูก');
      else if (tok.startsWith('bless:')) out.push(tok.includes('tag=') ? `ได้รับพรสาย${tok.split('=')[1]}` : 'ได้รับพร');
      else if (tok.startsWith('curse:')) out.push('ต้องคำสาป');
      else if (tok.startsWith('weapon:')) { const [, kind, el, fl] = tok.split(':'); out.push(`ได้อาวุธ${kind === 'holy' ? 'ศักดิ์สิทธิ์' : 'ต้องสาป'}${el ? `ธาตุ${el}` : ''}${fl ? ` (อย่างน้อย${RARITY[fl as Rarity].name})` : ''}`); }
      else if (tok.startsWith('skill:')) out.push(tok === 'skill:unique' ? 'ได้ Unique Skill' : 'ได้ทักษะใหม่');
      else if (tok.startsWith('apt:')) out.push('ความถนัดใหม่');
      else if (tok === 'move') out.push('ต้องย้ายเมือง');
      else if (tok === 'move:far') out.push('ย้ายไปต่างทวีป');
      else if (tok.startsWith('thread:+')) out.push(`เส้นทาง${THREAD_NAMES[tok.slice(8).split(':')[0]] || ''}`);
      else if (tok.startsWith('country:+')) out.push({ golden: 'บ้านเมืองรุ่งเรือง', famine: 'บ้านเมืองอดอยาก' }[tok.slice(9)] || '');
      else if ((m = tok.match(/^hp-(\d+)$/))) out.push(+m[1] >= 30 ? 'บาดเจ็บสาหัส' : 'บาดเจ็บ');
      else if ((m = tok.match(/^karma([+-]\d+)$/))) out.push(+m[1] > 0 ? 'กรรมดี' : 'กรรมชั่ว');
      else if ((m = tok.match(/^gold([+-]\d+)$/)) && Math.abs(+m[1]) >= 40) out.push(+m[1] > 0 ? 'ร่ำรวยขึ้น' : 'เสียทรัพย์');
      else if ((m = tok.match(/^fame([+-]\d+)$/)) && Math.abs(+m[1]) >= 8) out.push(+m[1] > 0 ? 'มีชื่อเสียง' : 'เสียชื่อเสียง');
      else if ((m = tok.match(/^belief([+-]\d+)$/)) && Math.abs(+m[1]) >= 8) out.push(+m[1] > 0 ? 'เชื่อในเทพมากขึ้น' : 'เสื่อมศรัทธาต่อเทพ');
    }
    return [...new Set(out.filter(Boolean))];
  }

  choiceHints(ch: Choice, vars: Record<string, string> = {}) {
    return {
      ok: this.fxHints(ch.ok[1], vars),
      ng: ch.ng ? this.fxHints(ch.ng[1], vars) : [],
      path: [...new Set(ch.tags.map((t) => CHOICE_THREADS[t]).filter(Boolean))].map((t) => THREAD_NAMES[t]),
    };
  }

  // Tilt preview: the choice odds if this dream were understood clearly
  probsWithDream(st: Storylet, symId: string): { probs: number[]; meaning: string } {
    const saved = this.s.dream;
    const m = this.interpretFor(symId);
    this.s.dream = { tags: m.tags, strength: 1.4, remaining: 3, meaning: m.text };
    const probs = this.choiceProbs(st);
    this.s.dream = saved;
    return { probs, meaning: m.text };
  }

  // Success preview if a gift were given now
  successWithGift(ch: Choice, g: Gift): number {
    const saved = JSON.parse(JSON.stringify(this.s.char));
    try { this.addGift(g); return this.successChance(ch); } finally { this.s.char = saved; }
  }

  // Why an item showed up / what giving it feeds
  whyHint(tags: string[], aff?: Record<string, number>): string[] {
    return boosters(tags, aff, this.ctx()).slice(0, 3).map((k) => this.ctxName(k));
  }
  feedHint(tags: string[]): string[] {
    return [...new Set(tags.map((t) => TAG_THREAD[t]).filter(Boolean))].map((t) => THREAD_NAMES[t]);
  }

  weaponOdds(kind: Weapon['kind']): Record<Rarity, number> {
    const mult = this.weaponRarityMult(kind, kind === 'holy' ? 'light' : 'dark');
    const N = 4000; const r = new RNG(99); const out = { C: 0, U: 0, R: 0, E: 0, L: 0 } as Record<Rarity, number>;
    for (let i = 0; i < N; i++) out[rollRarity(() => r.next(), mult, kind === 'holy' ? 'U' : 'C')]++;
    for (const k of Object.keys(out) as Rarity[]) out[k] = out[k] / N;
    return out;
  }

  // ---------- event creation ----------
  makePending(st: Storylet, extra: Partial<PendingEvent> = {}, varsIn?: Record<string, string>): PendingEvent {
    const vars = { ...this.makeVars(), ...(varsIn || {}) };
    return { kind: 'story', storylet: st, vars, text: this.fill(st.t, vars), ...extra };
  }

  pickStorylet(): Storylet | undefined {
    const tags = this.tags();
    const pool = STORYLETS.filter((s) => s.w > 0 && this.condOk(s.c, tags) && !(s.once && this.s.seenOnce.includes(s.id)));
    const recent = this.s.seenOnce.slice(-12);
    const ctx = this.ctx();
    return this.rng.weighted(pool, (s) => s.w * STORY_RARITY[s.r || 'C'] * mapAffinity(s.aff, ctx) * (recent.includes(s.id) ? 0.15 : 1));
  }

  monsterEvent(): Storylet | undefined {
    const c = this.c;
    const climate = this.country.climate;
    const pool = MONSTERS.filter((m) => (m.climates === 'any' || m.climates.includes(climate)) && (m.minAge || 0) <= c.hAge && (c.hAge >= 13 || m.dc <= 11));
    const m = this.rng.weighted(pool, (x) => (x.dc > 18 ? 0.4 : 1) * (x.dc <= 12 ? 1.5 : 1));
    if (!m) return undefined;
    return this.buildMonster(m);
  }

  buildMonster(m: Monster): Storylet {
    const tags = this.tags();
    const weakMap: Record<string, string[]> = { weak_fire: ['fire'], weak_ice: ['ice'], weak_poison: ['poison'], weak_iron: ['iron'], weak_light: ['light', 'holy'], weak_silver: ['silver'] };
    const malus: string[] = [];
    for (const [w, att] of Object.entries(weakMap)) if (tags.has(w) && att.some((a) => m.attack.includes(a))) malus.push(w);
    const resistHit = ['blade', 'blunt', 'pierce', 'fire', 'ice', 'magic', 'dark', 'water', 'poison'].filter((r) => m.resist.includes(r) && tags.has(r));
    const dmg = Math.round(m.dc * 2.4);
    const lootFame = Math.max(1, Math.round(m.dc / 3));
    const ch: Choice[] = [
      { l: 'ชักอาวุธเข้าสู้', tags: ['fight', 'risk'], ax: { brave: 1, temper: 0.5 }, chk: ['pow', m.dc + (resistHit.length ? 2 : 0)], bonusTag: m.weak, malusTag: malus,
        ok: [`ปราบ${m.name}ได้สำเร็จ!`, `${m.loot} kill fame+${lootFame}`], ng: [`${m.name}แข็งแกร่งเกินไป ถูกโจมตีจนบาดเจ็บ`, `hp-${dmg}`] },
    ];
    if (this.c.aptitudes.some((a) => aptById(a).tags.includes('magic'))) {
      ch.push({ l: 'ร่ายเวทโจมตี', tags: ['fight', 'learn'], ax: { curious: 1 }, chk: ['mag', m.dc], bonusTag: m.weak, malusTag: [...malus, ...(m.resist.includes('magic') ? ['magic'] : [])],
        ok: [`เวทมนตร์พุ่งเข้าใส่${m.name}จนสิ้นฤทธิ์!`, `${m.loot} kill fame+${lootFame} mag+0`], ng: ['เวทพลาดเป้า มานาหมดเกลี้ยง', `hp-${Math.round(dmg * 0.8)}`] });
    }
    if ((m.tags.includes('beast') || m.tags.includes('dragon')) && (tags.has('beast_friend') || tags.has('beast') || tags.has('polyglot'))) {
      ch.push({ l: 'สื่อสารและสงบมัน', tags: ['help', 'trust'], ax: { kind: 1 }, chk: ['luk', m.dc - 2], ok: [`${m.name}สงบลงและจากไปอย่างเป็นมิตร`, 'karma+2 fame+2'], ng: ['มันไม่ฟัง!', `hp-${Math.round(dmg * 0.7)}`] });
    }
    ch.push({ l: 'วิ่งหนี', tags: ['flee', 'safe'], ax: { brave: -1 }, chk: ['spd', m.dc - 3], bonusTag: ['stealth', 'flight'], ok: ['หนีรอดมาได้อย่างหวุดหวิด', ''], ng: ['หนีไม่พ้น ถูกโจมตีจากด้านหลัง', `hp-${Math.round(dmg * 0.6)}`] });
    return { id: `monster_${m.id}`, tone: m.dc >= 15 ? 'dark' : 'grim', w: 0, t: `:${m.icon}: ${m.text}`, ch, important: m.dc >= 15 };
  }

  jobEvent(change = false): Storylet {
    const c = this.c;
    const tags = this.tags();
    const ctx = this.ctx();
    const pref = c.flags.find((f) => f.startsWith('pref_job:'))?.slice(9);
    // three distinct offers, drawn by aptitude fit × rarity × how well the career fits the story so far
    let pool = JOBS.filter((j) => !j.secret && (!j.req || j.req(c, tags)) && j.id !== c.job);
    const cand: { j: (typeof JOBS)[number] }[] = [];
    while (cand.length < 3 && pool.length) {
      const j = this.rng.weighted(pool, (x) => (1 + x.apts.filter((a) => c.aptitudes.includes(a)).length * 3 + c.stats[x.stat] / 6 + raceJobBonus(c.race, x.id))
        * Math.sqrt(RARITY[x.r || 'C'].w) * mapAffinity(x.aff, ctx) * (x.id === pref ? 6 : 1))!;
      cand.push({ j });
      pool = pool.filter((x) => x !== j);
    }
    const ch: Choice[] = cand.map(({ j }) => ({ l: `:${j.icon}: ${j.name} [${RARITY[j.r || 'C'].name}] — ${j.desc}`, tags: JOB_TAGS[j.id]?.tags || ['stay'], ax: JOB_TAGS[j.id]?.ax || {}, ok: [`${c.name} ${change ? 'เปลี่ยนไปเป็น' : 'เลือกเป็น'}${j.name}`, `job:${j.id}${j.chain ? ` chain:${j.chain}` : ''}`] as [string, string] }));
    if (change && c.job) ch.push({ l: `:${jobById(c.job).icon}: ทำงานเป็น${jobById(c.job).name}ต่อไป`, tags: ['stay', 'safe'], ax: { ambition: -1 }, ok: [`${c.name} ตัดสินใจอยู่กับงานเดิม`, ''] });
    return {
      id: change ? 'career_change' : 'coming_of_age', tone: 'warm', w: 0, important: true,
      t: change ? `${c.name} เบื่อชีวิต${c.job ? jobById(c.job).name : ''}แบบเดิม ๆ และเริ่มคิดถึงเส้นทางอื่น` : `${c.name} อายุครบวัยผู้ใหญ่ตามธรรมเนียม${raceById(c.race).name} ถึงเวลาเลือกเส้นทางชีวิต`,
      ch,
    };
  }

  secretJobEvent(): Storylet | undefined {
    const c = this.c;
    if (c.secretJob) return undefined;
    const tags = this.tags();
    const s = JOBS.find((j) => j.secret && j.req && j.req(c, tags) && j.id !== 'prophet' && j.id !== 'godslayer');
    if (!s) return undefined;
    return {
      id: 'secret_job', tone: 'dark', w: 0, important: true,
      t: `พลังบางอย่างตื่นขึ้นในตัว ${c.name}… เงื่อนไขลับครบถ้วน: อาชีพลับ「:${s.icon}: ${s.name}」ปรากฏขึ้น — ${s.desc}`,
      ch: [
        { l: `ยอมรับและกลายเป็น${s.name}`, tags: ['risk', 'greed', 'learn'], ax: { ambition: 1, curious: 1 }, ok: [`${c.name} กลายเป็น${s.name}! โลกจะไม่เหมือนเดิม`, `job:${s.id} fame+15 skill:random`] },
        { l: 'ปฏิเสธพลังนี้', tags: ['safe', 'stay'], ax: { ambition: -1 }, ok: ['พลังเงียบลง… แต่อาจกลับมาอีก', ''] },
      ],
    };
  }

  // ---------- main tick ----------
  tick(): { paused: boolean } {
    if (this.s.ended || !this.c.alive) return { paused: true };
    if (this.s.pending) return { paused: true };
    const c = this.c;
    const race = raceById(c.race);
    this.s.tick++;
    c.hAge += 0.25;
    this.s.year += (0.25 * race.lifespan) / 75;
    const tags = this.tags();
    const season = this.s.tick % 4;

    // passive
    const regen = tags.has('regen') ? 6 : 3;
    c.hp = Math.min(maxHp(c), c.hp + regen);
    this.s.faith = Math.min(200, this.s.faith + 0.25 + Math.max(0, c.belief) / 120 + (c.flags.includes('prophet') ? 1 : 0));
    this.s.dread = Math.min(200, this.s.dread + 0.08 + (c.belief < 0 ? -c.belief / 300 : 0));
    if (race.dislikes.includes(this.country.climate) && !c.flags.includes('uncomfortable') && c.hAge > 4 && this.rng.chance(0.2)) c.flags.push('uncomfortable');
    if (c.flags.includes('uncomfortable')) c.hp -= 1;
    if (tags.has('weak_sun') && this.country.climate === 'desert') c.hp -= 2;

    // country flag expiry + world sim each "year"
    for (const co of this.s.countries) {
      for (const [f, until] of Object.entries(co.until)) {
        if (this.s.tick >= until) {
          co.flags = co.flags.filter((x) => x !== f);
          delete co.until[f];
          if (f === 'war') co.warWith = null;
        }
      }
    }
    actorsTick(this);
    weatherTick(this);
    regionThreads(this);
    if (season === 0) { this.worldYear(); regionYear(this); npcYear(this); }
    festivalTick(this);

    // death by age
    const lh = lifespanH(c, tags);
    if (c.hAge > lh && this.rng.chance(0.02 + (c.hAge - lh) * 0.012)) {
      c.hp = 0;
      c.deathCause = 'ชราภาพ จากไปอย่างสงบ';
    }
    if (this.checkDeath()) return { paused: true };

    // fate & omens
    for (const fp of c.fate) {
      if (fp.done) continue;
      const f = fateById(fp.fateId);
      if (!fp.omenShown && c.hAge >= fp.hAge - 2) {
        fp.omenShown = true;
        // omens no longer stop time: they land in the log and as a notice, giving time to prepare
        this.log(`:omen: ลางบอกเหตุ: ${f.omen}`, 'omen', 'dark');
        this.hooks.onOmen?.(f.omen);
      }
      if (c.hAge >= fp.hAge) {
        fp.done = true;
        const st = storyletById(f.storylet);
        if (st) {
          this.s.pending = this.makePending(st, { fateId: f.id });
          if (this.autoDecide) return this.autoResolve();
          this.sync();
          return { paused: true };
        }
      }
    }

    // coming of age
    if (!c.job && c.hAge >= 15) {
      this.s.pending = this.makePending(this.jobEvent());
      if (this.autoDecide) return this.autoResolve();
      this.sync();
      return { paused: true };
    }
    // secret job awakening
    if (c.job && Math.abs((c.hAge % 7) - 0) < 0.01 && c.hAge >= 18) {
      const sj = this.secretJobEvent();
      if (sj) { this.s.pending = this.makePending(sj); if (this.autoDecide) return this.autoResolve(); this.sync(); return { paused: true }; }
    }

    this.prayerTick();
    if (season === 0) this.questCheck();
    // threads fade unless fed
    for (const k of Object.keys(this.s.threads)) { this.s.threads[k] *= 0.99; if (this.s.threads[k] < 0.05) delete this.s.threads[k]; }
    // a story thread from earlier comes back
    // something in the wider world reached the protagonist
    while (this.s.queue.length) {
      const q = this.s.queue.shift()!;
      const st = storyletById(q.id);
      if (st && this.condOk(st.c, this.tags())) { this.pendingChainVars = q.vars; return this.present(st); }
    }
    if (c.job && !c.secretJob && this.stage() === 'adult' && c.hAge < 55 && !c.flags.some((f) => f.startsWith('follower_')) && this.rng.chance(0.005)) {
      return this.present(this.jobEvent(true));
    }
    const chained = this.dueChain();
    if (chained) return this.present(chained);

    // monsters
    if (c.hAge >= 6) {
      let p = 0.012 * this.country.danger * (1 - c.stats.luk * 0.015);
      if (tags.has('monster_ward') || tags.has('smell')) p *= 0.35;
      if (tags.has('monster_lure')) p *= 2.2;
      if (this.stage() === 'child') p *= 0.4;
      if (this.rng.chance(p)) {
        const st = this.monsterEvent();
        if (st) return this.present(st);
      }
    }

    // storylet
    const pStory = this.stage() === 'infant' ? 0.18 : 0.3;
    if (this.rng.chance(pStory)) {
      const st = this.pickStorylet();
      if (st) return this.present(st);
    }
    // LLM flavor slot (handled outside, deterministic hook)
    if (this.rng.chance(0.05)) this.hooks.onImportant?.('flavor', this.context());
    this.sync();
    return { paused: false };
  }

  // auto mode: the character settles a crossroad alone; the player is told what they chose
  private autoResolve(): { paused: boolean } {
    const p = this.s.pending;
    const r = this.resolve();
    if (r && p?.kind === 'story') this.hooks.onAuto?.(p.text, p.storylet.ch![r.choice].l, p.storylet.ch![r.choice].chk ? r.success : null);
    return { paused: !!this.s.pending };
  }

  present(st: Storylet): { paused: boolean } {
    if (!this.s.seenOnce.includes(st.id) || !st.id.startsWith('monster')) this.s.seenOnce.push(st.id);
    if (this.s.seenOnce.length > 200) this.s.seenOnce.shift();
    const chainVars = this.pendingChainVars || undefined;
    this.pendingChainVars = null;
    const pend = this.makePending(st, st.id.startsWith('monster_') ? { monsterId: st.id.slice(8) } : {}, st.id.startsWith('monster_') ? { monsterName: MONSTERS.find((m) => `monster_${m.id}` === st.id)!.name } : chainVars);
    if (!st.ch || !st.ch.length) {
      const notes = this.applyFx(st.e || '', pend.vars);
      const d = fmtDelta(st.e || '');
      this.log(`${pend.text}${d || notes.length ? ` (${[d, ...notes].filter(Boolean).join(', ')})` : ''}`, 'event', st.tone);
      this.checkDeath();
      this.sync();
      return { paused: !!this.s.pending };
    }
    this.s.pending = pend;
    const pause = !this.autoDecide && (st.important || this.pauseOnChoices);
    if (!pause) {
      if (this.autoDecide && st.important) return this.autoResolve();
      this.resolve();
      return { paused: !!this.s.pending };
    }
    this.sync();
    return { paused: true };
  }

  // Character decides
  resolve(forceIndex?: number): { choice: number; success: boolean } | null {
    const p = this.s.pending;
    if (!p) return null;
    if (p.kind === 'omen') { this.s.pending = null; this.sync(); return null; }
    if (p.kind === 'death') return null;
    const st = p.storylet;
    const chs = st.ch || [];
    if (!chs.length) {
      this.s.pending = null;
      const notes = this.applyFx(st.e || '', p.vars);
      const d = fmtDelta(st.e || '');
      this.log(`${p.text}${d || notes.length ? ` (${[d, ...notes].filter(Boolean).join(', ')})` : ''}`, p.fateId ? 'fate' : 'event', st.tone);
      this.checkDeath();
      this.sync();
      return null;
    }
    const probs = this.choiceProbs(st);
    let idx = forceIndex ?? 0;
    if (forceIndex === undefined) {
      let r = this.rng.next();
      for (let i = 0; i < probs.length; i++) { r -= probs[i]; if (r <= 0) { idx = i; break; } idx = i; }
    }
    const ch = chs[idx];
    let success = true;
    let rollNote = '';
    if (ch.chk) {
      const bonus = this.checkBonus(ch);
      const roll = this.rng.d(20);
      const sign = bonus >= 0 ? '+' : '';
      success = roll === 20 || (roll !== 1 && roll + bonus >= ch.chk[1]);
      rollNote = `:dice: ${roll}${sign}${bonus} vs ${ch.chk[1]}`;
      if (!success && this.rng.chance(this.rerollChance())) {
        const r2 = this.rng.d(20);
        success = r2 === 20 || (r2 !== 1 && r2 + bonus >= ch.chk[1]);
        rollNote += ` → :clover:โชคช่วย ทอยใหม่ ${r2}${sign}${bonus}`;
      }
      rollNote += success ? ' :check:' : ' :cross:';
    }
    for (const t of ch.tags) if (CHOICE_THREADS[t]) this.addThread(CHOICE_THREADS[t], 1);
    const out = success ? ch.ok : ch.ng || ch.ok;
    const outText = this.fill(out[0], p.vars);
    this.s.pending = null;
    const notes = this.applyFx(out[1], p.vars);
    const d = fmtDelta(out[1]);
    const dreamNote = this.s.dream && this.s.dream.remaining > 0 && ch.tags.some((t) => this.s.dream!.tags.includes(t)) ? ' :dream:(ทำตามความฝัน)' : '';
    const kind: LogEntry['kind'] = p.fateId ? 'fate' : 'event';
    this.log(`${p.text}\n→ ${ch.l}${dreamNote}${rollNote ? ` [${rollNote}]` : ''}\n→ ${outText}${d || notes.length ? ` (${[d, ...notes].filter(Boolean).join(', ')})` : ''}`, kind, st.tone);
    if (this.s.dream) { this.s.dream.remaining--; if (this.s.dream.remaining <= 0) this.s.dream = null; }
    // belief reacts: good outcomes after a blessing raise faith
    if (success && ch.chk) this.s.faith += 0.5;
    if (!success) this.s.dread += 1;
    if (p.fateId) this.hooks.onImportant?.('fate', { ...this.context(), event: p.text, choice: ch.l, outcome: outText });
    this.checkDeath();
    this.sync();
    return { choice: idx, success };
  }

  checkDeath(): boolean {
    const c = this.c;
    if (c.hp > 0 || !c.alive) return false;
    const tags = this.tags();
    const cause = c.deathCause || 'บาดแผลสาหัส';
    if (cause.startsWith('ชราภาพ') === false) {
      if (tags.has('last_stand')) { c.blessings = c.blessings.filter((b) => b !== 'b_laststand'); c.hp = 10; this.log(':miracle: พร「รอดตายหนึ่งครา」ทำงาน! ลมหายใจสุดท้ายกลับคืนมา', 'god', 'warm'); c.deathCause = undefined; return false; }
      if (tags.has('rewind') && !c.flags.includes('rewound')) { c.flags.push('rewound'); c.hp = Math.round(maxHp(c) / 2); this.log(':hourglass: โลกหมุนย้อนกลับ… ' + c.name + ' ตื่นขึ้นอีกครั้งก่อนความตายจะมาถึง', 'god', 'warm'); c.deathCause = undefined; return false; }
      if (tags.has('guardian_angel') && this.rng.chance(0.5)) { c.hp = 15; this.log(':angel: ทูตสวรรค์ปัดคมดาบแห่งความตายออกไป', 'god', 'warm'); c.deathCause = undefined; return false; }
    }
    this.s.pending = { kind: 'death', storylet: { id: 'death', tone: 'dark', w: 0, t: cause }, vars: {}, text: cause };
    this.sync();
    return true;
  }

  // god decides at death's door
  decideDeath(revive: 'faith' | 'dread' | null): boolean {
    const c = this.c;
    if (revive && !c.revived) {
      const cost = revive === 'faith' ? COSTS.reviveFaith : COSTS.reviveDread;
      const pool = revive === 'faith' ? this.s.faith : this.s.dread;
      if (pool >= cost) {
        if (revive === 'faith') this.s.faith -= cost; else this.s.dread -= cost;
        c.revived = true;
        c.hp = maxHp(c);
        if (c.deathCause?.startsWith('ชราภาพ')) c.hAge -= 6;
        c.deathCause = undefined;
        this.s.pending = null;
        this.s.lifeStats.miracles++;
        c.belief = clampAxis(c.belief + (revive === 'faith' ? 35 : -10));
        if (revive === 'dread') this.applyFx('curse:random', {});
        this.log(revive === 'faith' ? `:miracle: ปาฏิหาริย์ชุบชีวิต! แสงสวรรค์ส่องลงมา ${c.name} ลืมตาขึ้นอีกครั้ง ผู้คนต่างคุกเข่า` : `:tone_dark: พลังแห่งความกลัวฉุดวิญญาณของ ${c.name} กลับจากนรก… แต่บางอย่างติดตามกลับมาด้วย`, 'god', 'warm');
        c.flags.push('saw_miracle');
        this.sync();
        return true;
      }
    }
    this.die();
    return false;
  }

  die() {
    const c = this.c;
    this.questCheck();
    c.alive = false;
    this.s.pending = null;
    c.deathCause = c.deathCause || 'บาดแผลสาหัส';
    this.log(`:death: ${c.name} สิ้นใจเมื่ออายุ ${this.age()} ปี — ${c.deathCause}`, 'death', 'dark');
    this.meta.karma = Math.round(this.meta.karma * 0.5 + this.s.karmaLife);
    this.meta.lives.unshift(this.summaryLine());
    this.meta.lives = this.meta.lives.slice(0, 30);
    if (!this.meta.racesPlayed.includes(c.race)) this.meta.racesPlayed.push(c.race);
    this.hooks.onImportant?.('death', this.context());
    this.sync();
  }

  summaryLine(): string {
    const c = this.c;
    const r = raceById(c.race);
    const born = this.s.countries[c.birthCountryId];
    const job = c.job ? jobById(c.job).name : 'ไร้อาชีพ';
    return `เกิดเป็น${c.gender === 'ไร้เพศ' ? '' : c.gender}${r.name}ใน${born.name} (${climateById(born.climate).name}) เป็น${job} ${c.deathCause ? 'ตายเพราะ' + c.deathCause : ''} อายุ ${this.age()}`;
  }

  title(): string {
    const c = this.c;
    if (c.flags.includes('demonking_slayer')) return 'ผู้ปราบราชาปีศาจ';
    if (c.flags.includes('king')) return 'กษัตริย์ผู้เริ่มต้นจากศูนย์';
    if (c.flags.includes('prophet')) return 'ศาสดาแห่งเทพนิรนาม';
    if (c.flags.includes('godhunter')) return 'ผู้ล่าเทพ';
    if (c.flags.includes('dragonslayer')) return 'ผู้ฆ่ามังกร';
    if (c.secretJob && c.job) return jobById(c.job).name + 'ในตำนาน';
    if (this.s.karmaLife > 30) return 'นักบุญผู้ไม่มีใครรู้จัก';
    if (this.s.karmaLife < -30) return 'ปีศาจในคราบคน';
    if (c.fame > 60) return 'วีรชนผู้เลื่องลือ';
    if (c.kills > 10) return 'นักล่าผู้ไม่รู้จักพอ';
    if (c.gold > 300) return 'เศรษฐีแห่งยุค';
    if (c.children.length >= 3) return 'ต้นตระกูลผู้ยิ่งใหญ่';
    if (c.fame < -10) return 'ผู้ถูกลืม (และถูกเกลียด)';
    return 'สามัญชนผู้มีเรื่องเล่า';
  }

  context(): Record<string, string> {
    const c = this.c;
    return {
      name: c.name, race: raceById(c.race).name, gender: c.gender, age: String(this.age()),
      job: c.job ? jobById(c.job).name : 'ยังไม่มีอาชีพ', place: this.country.name, climate: climateById(this.country.climate).name,
      traits: c.traits.map((t) => traitById(t).name).join(','), belief: String(c.belief), god: this.godTitle(),
      stage: this.stage(),
    };
  }

  // ---------- world simulation ----------
  worldYear() {
    const cs = this.s.countries;
    const mine = this.country;
    const evs = this.rng.int(1, 3);
    const targets: Country[] = [];
    for (let i = 0; i < evs; i++) targets.push(this.rng.pick(cs));
    if (this.rng.chance(0.09)) targets.push(mine);
    for (const co of targets) this.worldEvent(co, co.id === mine.id || mine.neighbors.includes(co.id));
  }

  worldEvent(co: Country, near: boolean) {
    const r = this.rng.next();
    const yr = Math.floor(this.s.year);
    let text = '';
    if (r < 0.28 && co.neighbors.length && !co.flags.includes('war')) {
      const enemy = this.s.countries[this.rng.pick(co.neighbors)];
      this.setCountryFlag(co, 'war', this.rng.int(8, 24)); co.warWith = enemy.id;
      this.setCountryFlag(enemy, 'war', co.until.war - this.s.tick); enemy.warWith = co.id;
      text = `:war: ${co.name} ประกาศสงครามกับ ${enemy.name}`;
      if (enemy.id === this.c.countryId) near = true;
    } else if (r < 0.42) {
      this.setCountryFlag(co, 'plague', this.rng.int(6, 14));
      text = `:plague: โรคระบาดแพร่ระบาดใน ${co.name}`;
    } else if (r < 0.58) {
      this.setCountryFlag(co, 'famine', this.rng.int(6, 12));
      text = `:famine: ความอดอยากเกิดขึ้นใน ${co.name}`;
    } else if (r < 0.75) {
      this.setCountryFlag(co, 'golden', this.rng.int(10, 24));
      text = `:golden: ${co.name} เข้าสู่ยุคทอง`;
    } else if (r < 0.83) {
      const newGov = this.rng.pick(['สาธารณรัฐ', 'จักรวรรดิ', 'ราชอาณาจักร', 'รัฐทหาร', 'นครรัฐ']);
      const base = co.name.replace(co.gov, '');
      co.name = newGov + base; co.gov = newGov;
      text = `:crown: การรัฐประหาร! ประเทศเปลี่ยนชื่อเป็น ${co.name}`;
    } else if (r < 0.91) {
      text = `:dragon: มังกรโจมตีเมืองหลวงของ ${co.name}`;
      co.danger = Math.min(5, co.danger + 1);
    } else {
      text = `:orb: ${this.rng.pick(['มีผู้ถูกอัญเชิญจากต่างโลกปรากฏตัวใน', 'ดันเจี้ยนใหม่ถูกค้นพบใน', 'นักบุญคนใหม่ถือกำเนิดใน', 'ลัทธิปีศาจถูกกวาดล้างใน'])} ${co.name}`;
    }
    co.history.push(`ปี ${yr}: ${text.replace(/^:\w+:\s*/, '')}`);
    if (co.history.length > 12) co.history.splice(2, 1);
    const e: LogEntry = { year: yr, age: this.age(), text, kind: 'world' };
    this.s.worldNews.unshift(e);
    if (this.s.worldNews.length > 80) this.s.worldNews.pop();
    if (near) this.log(`:scroll: ข่าวใกล้ตัว: ${text}`, 'world');
  }

  // ---------- God powers ----------
  canAfford(pool: 'faith' | 'dread', cost: number) {
    return (pool === 'faith' ? this.s.faith : this.s.dread) >= cost;
  }

  costMult(pool: 'faith' | 'dread'): number {
    const b = this.c.belief;
    if (pool === 'faith' && b < -30) return 1.5;
    if (pool === 'dread' && b > 60) return 1.2;
    return 1;
  }

  spend(pool: 'faith' | 'dread', cost: number): boolean {
    cost = Math.round(cost * this.costMult(pool));
    if (!this.canAfford(pool, cost)) return false;
    if (pool === 'faith') this.s.faith -= cost; else this.s.dread -= cost;
    if (this.s.lastPower && this.s.lastPower !== pool) {
      this.s.powerSwitches++;
      const pen = Math.min(25, 4 * this.s.powerSwitches);
      this.c.belief = clampAxis(this.c.belief - pen);
      this.log(`:tone_comedy: ${this.c.name} สับสน… เทพองค์นี้ต้องการอะไรกันแน่? เดี๋ยวให้พร เดี๋ยวสาป (ความเชื่อ -${pen})`, 'god', 'comedy');
    }
    this.s.lastPower = pool;
    this.s.lifeStats.interventions++;
    return true;
  }

  offerGifts(kind: 'blessing' | 'curse', n = 5): Gift[] {
    // stable for the season; rare gifts surface rarely unless the story favours them
    const r = new RNG(this.s.rngState ^ (this.s.tick * 7919) ^ (kind === 'blessing' ? 1 : 2));
    const ctx = this.ctx();
    const out: Gift[] = [];
    const exclude = [...this.c.blessings, ...this.c.curses];
    while (out.length < n) {
      const g = drawGift(r, kind === 'blessing' ? BLESSINGS : CURSES, ctx, [...exclude, ...out.map((x) => x.id)]);
      if (!g) break;
      out.push(g);
    }
    return out.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  }

  feedThreads(tags: string[]) {
    for (const t of new Set(tags.map((x) => TAG_THREAD[x]).filter(Boolean))) this.addThread(t, 2);
  }

  giveBlessing(id: string): string | null {
    const g = giftById(id);
    if (!this.spend('faith', giftCost(g))) return null;
    this.feedThreads(g.tags);
    this.addGift(g);
    const gain = 5 + g.tier * 3;
    this.c.belief = clampAxis(this.c.belief + gain);
    this.s.lifeStats.blessings++;
    this.log(`:bless: คุณมอบพร「${g.name}」[${RARITY[g.rarity].name}]— ${g.desc}${fmtDelta(g.fx) ? ` (${fmtDelta(g.fx)})` : ''} ${this.c.name} รู้สึกอบอุ่นอย่างประหลาด (ความเชื่อ +${gain})`, 'god', 'warm');
    this.sync();
    return g.name;
  }

  // the god (the player) has hurt this character: only then can they swear to hunt the god
  private markWronged() { if (!this.c.flags.includes('punished')) this.c.flags.push('punished'); }

  giveCurse(id: string): string | null {
    const g = giftById(id);
    if (!this.spend('dread', giftCost(g))) return null;
    this.feedThreads(g.tags);
    this.s.lifeStats.curses++;
    if (this.tags().has('curse_ward')) {
      this.c.belief = clampAxis(this.c.belief - 5);
      this.log(`:shield: คำสาป「${g.name}」เด้งกลับด้วยเกราะกันคำสาป! ${this.c.name} รู้สึกถึงเจตนาร้ายจากฟากฟ้า`, 'god', 'comedy');
      return g.name;
    }
    this.addGift(g);
    this.markWronged();
    const loss = 4 + g.tier * 3;
    this.c.belief = clampAxis(this.c.belief - loss);
    this.s.dread += g.tier * 2;
    this.log(`:curse: คุณสาป「${g.name}」[${RARITY[g.rarity].name}]— ${g.desc}${fmtDelta(g.fx) ? ` (${fmtDelta(g.fx)})` : ''} ${this.c.name} ขนลุกซู่ (ความเชื่อ -${loss})`, 'god', 'dark');
    this.sync();
    return g.name;
  }

  giveWeapon(kind: 'holy' | 'cursed'): string | null {
    const pool = kind === 'holy' ? 'faith' : 'dread';
    if (!this.spend(pool, kind === 'holy' ? COSTS.weaponHoly : COSTS.weaponCursed)) return null;
    const old = this.c.weapon;
    const w = this.makeWeapon(kind, undefined, kind === 'holy' ? 'U' : 'C');
    this.feedThreads(w.tags);
    if (old) w.history.unshift(`(แทนที่ ${old.name})`);
    this.c.weapon = w;
    if (kind === 'holy') { this.c.belief = clampAxis(this.c.belief + 10); this.log(`:weapon: ${w.name} [${RARITY[w.rarity].name}] ตกลงมาจากฟ้าปักตรงหน้า ${this.c.name} แสงสีทองเรืองรอง`, 'god', 'warm'); }
    else { this.c.belief = clampAxis(this.c.belief - 5); this.c.axes.kind = clampAxis(this.c.axes.kind - 10); this.log(`:nemesis: ${w.name} [${RARITY[w.rarity].name}] ปรากฏในมือของ ${this.c.name} ยามหลับ มันกระซิบถึงเลือด`, 'god', 'dark'); }
    this.sync();
    return w.name;
  }

  dreamClarity(): number {
    const t = this.tags();
    let cl = 0.4 + this.c.belief / 200 + Math.min(this.s.faith, 100) / 500 + (this.c.stats.int - 10) * 0.02;
    if (t.has('lucid')) cl += 0.25;
    if (t.has('dreamer')) cl += 0.15;
    if (t.has('oracle')) cl += 0.2;
    if (t.has('nightmare')) cl -= 0.3;
    if (t.has('pragmatic')) cl -= 0.1;
    return Math.max(0.1, Math.min(0.97, cl));
  }

  interpretFor(symId: string) {
    const sym = SYMBOLS.find((s) => s.id === symId)!;
    return sym.race?.[this.c.race] || sym.climate?.[this.country.climate] || sym.base;
  }

  sendDream(symId: string): { meaning: string; clear: boolean } | null {
    if (!this.spend('faith', COSTS.dream)) return null;
    const sym = SYMBOLS.find((s) => s.id === symId)!;
    const clear = this.rng.next() < this.dreamClarity();
    let meaning = this.interpretFor(symId);
    let text: string;
    if (clear) {
      text = `:dream: ${this.c.name} ฝันเห็น:${sym.icon}:${sym.name}อย่างชัดเจน ตื่นมาพร้อมความเชื่อมั่น: "${meaning.text}"`;
    } else {
      const other = this.rng.pick(SYMBOLS.filter((s) => s.id !== symId));
      const wrong = other.race?.[this.c.race] || other.base;
      text = `:bubble: ฝันเลือนราง… ${this.c.name} เห็น:${sym.icon}:แต่จำได้ไม่ชัด คิดว่าน่าจะเป็น:${other.icon}:${other.name} แล้วตีความว่า: "${wrong.text}"`;
      meaning = wrong;
    }
    this.s.dream = { tags: meaning.tags, strength: clear ? 1.4 : 1.0, remaining: 3, meaning: meaning.text };
    this.c.belief = clampAxis(this.c.belief + (clear ? 4 : 1));
    this.s.lifeStats.dreams++;
    this.log(text, 'dream', clear ? 'warm' : 'comedy');
    this.hooks.onImportant?.('dream', { ...this.context(), symbol: sym.name, meaning: meaning.text, clear: String(clear) });
    this.sync();
    return { meaning: meaning.text, clear };
  }

  miracle(kind: 'heal' | 'harvest' | 'quake' | 'meteor'): string | null {
    const c = this.c;
    const co = this.country;
    if (kind === 'heal') {
      if (!this.spend('faith', COSTS.heal)) return null;
      c.hp = maxHp(c);
      c.belief = clampAxis(c.belief + 6);
      this.log(`:heal: แสงอบอุ่นโอบร่าง ${c.name} บาดแผลทั้งหมดสมานในพริบตา`, 'god', 'warm');
    } else if (kind === 'harvest') {
      if (!this.spend('faith', COSTS.harvest)) return null;
      co.flags = co.flags.filter((f) => f !== 'famine' && f !== 'plague');
      this.setCountryFlag(co, 'golden', 12);
      c.gold += 20;
      c.belief = clampAxis(c.belief + 8);
      c.flags.push('saw_miracle');
      this.log(`:rain: ฝนชุ่มฉ่ำตกทั่ว${co.name} ทุ่งนาเขียวขจี โรคภัยและความอดอยากหายไป ผู้คนพากันสรรเสริญ`, 'god', 'warm');
    } else if (kind === 'quake') {
      if (!this.spend('dread', COSTS.quake)) return null;
      c.hp -= 15;
      this.s.dread += 8;
      c.belief = clampAxis(c.belief - 6);
      co.flags = co.flags.filter((f) => f !== 'golden');
      this.setCountryFlag(co, 'famine', 8);
      this.log(`:quake: แผ่นดินไหวรุนแรงถล่ม${co.name}! ${c.name} บาดเจ็บ ผู้คนหวาดกลัวพลังที่มองไม่เห็น`, 'god', 'dark');
      this.checkDeath();
    } else {
      if (!this.spend('dread', COSTS.meteor)) return null;
      const nem = c.relations.find((r) => (r.type === 'nemesis' || r.type === 'rival') && r.alive);
      if (co.flags.includes('war') && co.warWith !== null) {
        const en = this.s.countries[co.warWith];
        co.flags = co.flags.filter((f) => f !== 'war'); en.flags = en.flags.filter((f) => f !== 'war');
        co.warWith = null; en.warWith = null;
        this.log(`:meteor: อุกกาบาตพุ่งชนกองทัพของ${en.name}! สงครามยุติลงทันที ทั้งโลกสั่นสะท้าน`, 'god', 'dark');
        c.fame += 3;
      } else if (nem) {
        nem.alive = false;
        this.log(`:meteor: อุกกาบาตตกใส่บ้านของ ${nem.name} พอดิบพอดี… ${c.name} ไม่รู้จะดีใจหรือกลัวดี`, 'god', 'comedy');
      } else {
        this.log(`:meteor: อุกกาบาตตกกลางทุ่งใกล้${co.name} เกิดหลุมยักษ์ ผู้คนเชื่อว่าเป็นลางร้าย`, 'god', 'dark');
      }
      this.s.dread += 12;
      c.belief = clampAxis(c.belief - 8);
    }
    this.s.lifeStats.miracles++;
    this.sync();
    return kind;
  }

  alterFate(index: number, to: 'good' | 'bad'): string | null {
    const c = this.c;
    const fp = c.fate[index];
    if (!fp || fp.done) return null;
    const t = this.tags();
    let cost = to === 'good' ? COSTS.fateGood : COSTS.fateBad;
    if (t.has('fate_chain')) cost *= 2;
    if (t.has('fate_shift')) cost = Math.round(cost / 2);
    if (!this.spend(to === 'good' ? 'faith' : 'dread', cost)) return null;
    const pool = FATES.filter((f) => f.good === (to === 'good') && f.id !== fp.fateId && f.age[1] >= c.hAge);
    const nf = this.rng.pick(pool);
    const old = fateById(fp.fateId);
    fp.fateId = nf.id;
    fp.forced = true;
    fp.omenShown = c.hAge >= fp.hAge - 2;
    this.log(`:fate: คุณดึงเส้นชะตา: 「${old.name}」กลายเป็น「${nf.name}」`, 'god', to === 'good' ? 'warm' : 'dark');
    if (this.rng.chance(0.3)) {
      const bad = this.rng.pick(FATES.filter((f) => !f.good));
      c.fate.push({ fateId: bad.id, hAge: c.hAge + this.rng.int(4, 12), omenShown: false, done: false });
      c.fate.sort((a, b) => a.hAge - b.hAge);
      this.log(':warning: ชะตาตีกลับ! เส้นด้ายใหม่ที่มืดมิดถักทอขึ้นในอนาคต', 'god', 'dark');
    }
    this.sync();
    return nf.name;
  }

  // ---------- continue the dynasty ----------
  heirs() {
    return this.c.children.filter((k) => k.alive);
  }

  continueAsHeir(index: number) {
    const parent = this.c;
    const kid = this.heirs()[index];
    if (!kid) return;
    const age = Math.max(0, parent.hAge - kid.bornAt);
    const heir = createCharacter(this.rng, kid.race, this.country, age, { karma: this.meta.karma, dynastyName: parent.dynastyName, generation: parent.generation + 1 }, kid.gender);
    heir.name = kid.name;
    heir.townId = parent.townId;
    heir.fate = rollFate(this.rng, age, tagsOf(heir));
    // inheritance
    const best = (Object.keys(parent.stats) as StatKey[]).sort((a, b) => parent.stats[b] - parent.stats[a])[0];
    heir.stats[best] += 1;
    if (parent.weapon) {
      heir.weapon = parent.weapon;
      heir.weapon.history.push(`ปี ${Math.floor(this.s.year)}: สืบทอดจาก ${parent.name} สู่ ${heir.name}`);
    }
    if (parent.flags.includes('noble') || parent.flags.includes('king')) heir.flags.push('noble');
    if (parent.curses.includes('c_heircurse')) heir.curses.push('c_heircurse', this.rng.pick(CURSES.filter((x) => x.tier <= 2)).id);
    heir.gold = Math.floor(parent.gold * 0.7);
    heir.fame = Math.floor(parent.fame / 3);
    heir.belief = Math.round(parent.belief * 0.6);
    heir.relations.push({ id: 1, type: 'parent', name: parent.name, race: parent.race, alive: false, affinity: 80 });
    heir.hp = maxHp(heir);
    this.s.pastLives.push(this.summaryLine());
    this.s.char = heir;
    this.s.pending = null;
    this.s.dream = null;
    this.s.powerSwitches = 0;
    this.s.lifeStats = { blessings: 0, curses: 0, dreams: 0, miracles: 0, interventions: 0 };
    this.s.karmaLife = 0;
    this.log(`:birth: รุ่นที่ ${heir.generation} แห่งตระกูล${heir.dynastyName}: ${heir.name} (${raceById(heir.race).name}, ${heir.gender}) สืบทอดเรื่องราวต่อ อายุ ${realAge(heir)} ปี`, 'birth', 'warm');
    if (age >= 16 && !heir.job) { /* job event will fire next tick */ }
    this.sync();
  }

  logBirth() {
    const c = this.c;
    const r = raceById(c.race);
    const co = this.country;
    const cl = climateById(co.climate);
    const bits = [
      `:birth: ${c.name} ถือกำเนิดเป็น${r.name}${c.gender === 'ไร้เพศ' ? '' : c.gender}ที่${this.town.name} ${co.name} :${cl.icon}:${cl.name}`,
      `${BIRTH_TIME_TH[c.birthTime]}${c.birthSign !== 'none' ? ` ${BIRTH_SIGN_TH[c.birthSign]}` : ''} · ดินแดน${RELIGIONS[co.religion]}`,
      `นิสัย: ${c.traits.map((t) => traitById(t).name).join(', ')}`,
      `ความถนัด: ${c.aptitudes.map((a) => aptById(a).name).join(', ')}`,
    ];
    if (c.blessings.length) bits.push(`พรแต่กำเนิด: ${c.blessings.map((b) => giftById(b).name).join(', ')}`);
    if (c.curses.length) bits.push(`คำสาปแต่กำเนิด: ${c.curses.map((b) => giftById(b).name).join(', ')}`);
    if (c.flags.includes('noble')) bits.push('เกิดในตระกูลขุนนาง');
    this.log(bits.join('\n'), 'birth', 'warm');
  }
}


export const BIRTH_TIME_TH: Record<string, string> = { dawn: 'เกิดยามรุ่งอรุณ', day: 'เกิดยามกลางวัน', dusk: 'เกิดยามสนธยา', night: 'เกิดยามค่ำคืน' };
export const BIRTH_SIGN_TH: Record<string, string> = { none: '', comet: 'ใต้ดาวหาง', eclipse: 'ใต้สุริยคราส', fullmoon: 'ใต้จันทร์เต็มดวง', storm: 'กลางพายุฝนฟ้าคะนอง' };
const STORY_RARITY: Record<Rarity, number> = { C: 1, U: 0.5, R: 0.22, E: 0.08, L: 0.03 };
const RARITY_ORDER: Rarity[] = ['C', 'U', 'R', 'E', 'L'];
export const giftCost = (g: Gift) => (g.kind === 'blessing' ? RARITY[g.rarity].faith : RARITY[g.rarity].dread);

function raceJobBonus(race: string, job: string): number {
  const m: Record<string, string[]> = {
    orc: ['soldier', 'hunter'], dwarf: ['smith'], elf: ['hunter', 'mage', 'druid'], halfling: ['cook', 'merchant', 'thief'],
    merfolk: ['fisher', 'bard', 'pirate'], naga: ['priest', 'healer'], vampire: ['noble', 'assassin', 'warlock'], fae: ['bard', 'druid', 'mage'],
    darkelf: ['assassin', 'warlock'], demonkin: ['warlock', 'mage'], dragonkin: ['knight', 'soldier'], beast: ['hunter', 'tamer'], slime: ['cook', 'adventurer'],
  };
  return m[race]?.includes(job) ? 2 : 0;
}

export { RACES };
