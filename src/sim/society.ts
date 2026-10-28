// The rest of the world lives too: NPC lives, travelling world figures (hero of the age, the demon lord's
// host, caravans) and region-specific happenings. Anything that touches the protagonist — because the NPC
// is in their life, lives in their town, or a world figure arrives where they are — reaches them as a
// log line, a direct effect, or a queued choice event.
import type { Game } from './game';
import type { Actor, NpcState, Spectacle } from './types';
import { generateWorld, SCALE } from './worldgen';
import { makeName } from './character';
import { CONTINENTS } from './worldgen';
import { NPC_EVENTS, NOTABLE_ROLES, HERO_NAMES, DEMON_NAMES, CARAVAN_NAMES, REGION_EVENTS } from '../data/people';
import { MONSTERS } from '../data/lore';
import { DISASTERS } from '../data/disasters';
import { NPC_GOALS, NOTABLE_JOB, npcJob } from '../data/npclife';
import { pickTownJob, countryFestivals, isCoastTown } from './locale';
import { stageOf } from './character';

const towns = () => generateWorld().towns;
const REL_ROLE: Record<string, string> = { mentor: 'อาจารย์', rival: 'คู่แข่ง', lover: 'คนรัก', spouse: 'คู่ชีวิต', nemesis: 'คู่อาฆาต', friend: 'เพื่อน', parent: 'พ่อแม่' };

// ---------------- NPCs ----------------
export function newNpc(g: Game, name: string, race: string, townId: number, role: string, hAge?: number): NpcState {
  const n: NpcState = {
    id: g.s.nextNpcId++, name, race, role, townId, hAge: hAge ?? g.rng.int(16, 50), alive: true,
    fame: g.rng.int(0, 10), attitude: g.rng.int(-10, 20), tags: [],
  };
  const co = g.s.countries[towns()[townId].countryId];
  n.job = NOTABLE_JOB[role] || pickTownJob(g.rng, townId, co, race).id;
  n.skill = Math.min(90, Math.round((n.hAge - 12) * g.rng.float(1, 2.2)));
  newGoal(g, n);
  g.s.npcs.push(n);
  return n;
}

// ---------------- purposeful lives ----------------
function newGoal(g: Game, n: NpcState) {
  const co = g.s.countries[towns()[n.townId].countryId];
  const pool = NPC_GOALS.filter((x) => (!x.jobs || x.jobs.includes(n.job || '')) && (!x.minAge || n.hAge >= x.minAge) && (!x.countryFlag || co.flags.includes(x.countryFlag))
    && !(n.deeds || []).includes(x.id) && !(x.id === 'master' && (n.skill || 0) < 30));
  const goal = g.rng.weighted(pool, (x) => x.w);
  n.goal = goal ? { id: goal.id, prog: 0, need: g.rng.int(goal.years[0], goal.years[1]) } : undefined;
}

export function goalText(n: NpcState): string {
  const goal = n.goal && NPC_GOALS.find((x) => x.id === n.goal!.id);
  if (!goal) return '';
  return goal.text.replace('{skill}', npcJob(n.job || '').skill).replace('{town}', towns()[n.townId].name);
}

// a year of work: skill grows, the goal moves forward; reaching it changes the person and sometimes the town
function workYear(g: Game, n: NpcState) {
  n.skill = Math.min(100, (n.skill || 0) + g.rng.float(0.5, 3) * (n.hAge < 40 ? 1.2 : 0.6));
  if (!n.goal) { if (g.rng.chance(0.3)) newGoal(g, n); return; }
  const goal = NPC_GOALS.find((x) => x.id === n.goal!.id);
  if (!goal) { n.goal = undefined; return; }
  const co = g.s.countries[towns()[n.townId].countryId];
  // a crisis goal loses its point when the crisis is over
  if (goal.countryFlag && !co.flags.includes(goal.countryFlag)) { n.goal = undefined; return; }
  n.goal.prog += g.rng.float(0.5, 1.2) * (0.6 + (n.skill || 0) / 100);
  if (n.goal.prog < n.goal.need) return;
  const town = towns()[n.townId].name;
  const text = goal.done.replace(/\{n\}/g, n.name).replace('{skill}', npcJob(n.job || '').skill).replace('{town}', town);
  for (const tok of goal.fx.split(' ')) {
    let m: RegExpMatchArray | null;
    if ((m = tok.match(/^fame\+(\d+)$/))) n.fame += +m[1];
    else if (tok.startsWith('tag:+')) { if (!n.tags.includes(tok.slice(5))) n.tags.push(tok.slice(5)); }
    else if (tok === 'job:knight') { n.job = 'guard'; n.role = 'อัศวิน'; }
    else if (tok.startsWith('role:')) n.role = tok.slice(5);
    else if (tok === 'move') npcFx(g, n, 'move');
    else if (tok === 'cure') { co.flags = co.flags.filter((f) => f !== 'plague'); delete co.until.plague; }
    else if (tok === 'feed') { co.flags = co.flags.filter((f) => f !== 'famine'); delete co.until.famine; }
    else if (tok === 'golden') g.setCountryFlag(co, 'golden', 12);
  }
  (n.deeds ||= []).push(goal.id);
  n.last = text;
  g.hooks.onNpcEvent?.(n.id, text);
  const c = g.c;
  const rel = c.relations.find((r) => r.npcId === n.id && r.alive);
  const big = goal.countryFlag || goal.fx.includes('golden');
  if (c.alive && (rel || (n.townId === c.townId && (big || g.rng.chance(0.5))) || (big && co.id === c.countryId))) {
    g.log(`:friend: ${rel ? `${relRole(rel.type)} ` : ''}${text}`, 'event', 'warm');
    if (rel) rel.affinity = Math.min(100, rel.affinity + 3);
  }
  newGoal(g, n);
}

export function relRole(type: string) { return REL_ROLE[type] || 'คนรู้จัก'; }

// every town the protagonist lives in has a handful of people who matter
export function ensureTownNotables(g: Game, townId: number) {
  if (g.s.npcs.some((n) => n.townId === townId && NOTABLE_ROLES.includes(n.role))) return;
  const co = g.s.countries[towns()[townId].countryId];
  for (const role of g.rng.sample(NOTABLE_ROLES, 4)) {
    const race = g.rng.weighted(co.races, (r) => r.w)!.race;
    newNpc(g, makeName(g.rng, race), race, townId, role, g.rng.int(25, 60));
  }
  // forget people far away who were never part of the protagonist's life
  const linked = new Set(g.c.relations.map((r) => r.npcId));
  g.s.npcs = g.s.npcs.filter((n) => linked.has(n.id) || n.townId === townId || g.s.npcs.length < 50);
}

function npcFx(g: Game, n: NpcState, fx: string) {
  for (const tok of fx.split(/\s+/).filter(Boolean)) {
    let m: RegExpMatchArray | null;
    if (tok.startsWith('tag:+')) { if (!n.tags.includes(tok.slice(5))) n.tags.push(tok.slice(5)); }
    else if (tok.startsWith('tag:-')) n.tags = n.tags.filter((t) => t !== tok.slice(5));
    else if ((m = tok.match(/^fame([+-]\d+)$/))) n.fame += +m[1];
    else if ((m = tok.match(/^att([+-]\d+)$/))) n.attitude = Math.max(-100, Math.min(100, n.attitude + +m[1]));
    else if (tok === 'die') {
      n.alive = false;
      const r = g.c.relations.find((x) => x.npcId === n.id && x.alive);
      if (r) r.alive = false;
    } else if (tok === 'move') {
      const co = g.s.countries[towns()[n.townId].countryId];
      const opts = co.towns.filter((t) => t !== n.townId);
      if (opts.length) n.townId = g.rng.pick(opts);
    }
  }
}

export function npcYear(g: Game) {
  const c = g.c;
  let reached = 0;
  for (const n of g.s.npcs) {
    if (!n.alive) continue;
    n.hAge += 1;
    if (n.hAge > 85 && g.rng.chance(0.15)) { npcFx(g, n, 'die'); continue; }
    if (!n.job) { n.job = NOTABLE_JOB[n.role] || pickTownJob(g.rng, n.townId, g.s.countries[towns()[n.townId].countryId], n.race).id; n.skill = 20; } // older saves
    workYear(g, n);
    if (!g.rng.chance(0.16)) continue;
    const rel = c.relations.find((r) => r.npcId === n.id && r.alive);
    const relType = rel ? rel.type : 'none';
    const co = g.s.countries[towns()[n.townId].countryId];
    const pool = NPC_EVENTS.filter((e) => (!e.rels || e.rels.includes(relType)) && (!e.roles || e.roles.includes(n.role))
      && (!e.needTag || n.tags.includes(e.needTag)) && (!e.notTag || !n.tags.includes(e.notTag))
      && (!e.minAge || n.hAge >= e.minAge) && (!e.countryFlag || co.flags.includes(e.countryFlag)));
    const ev = g.rng.weighted(pool, (e) => e.w);
    if (!ev) continue;
    const town = towns()[n.townId].name;
    const fill = (t: string) => t.replace(/\{n\}/g, n.name).replace(/\{hero\}/g, c.name).replace(/\{town\}/g, town);
    npcFx(g, n, ev.npc);
    n.last = fill(ev.t);
    g.hooks.onNpcEvent?.(n.id, n.last);
    const near = n.townId === c.townId;
    // relations always reach the protagonist; townsfolk news only sometimes, and at most twice a year
    const reaches = c.alive && ev.scope && (rel || (ev.scope === 'near' && near && g.rng.chance(0.5)));
    if (!reaches || reached >= 2) continue;
    reached++;
    const who = rel ? `${relRole(rel.type)} ` : '';
    g.log(`:friend: ${who}${n.last}${ev.hero?.log ? `\n→ ${fill(ev.hero.log)}` : ''}`, 'event', 'warm');
    if (ev.hero?.fx) g.applyFx(ev.hero.fx, {});
    if (ev.hero?.story && g.rng.chance(ev.hero.p ?? 1)) {
      g.queueStory(ev.hero.story, { npc: n.name, npcRace: n.race, npcId: String(n.id) });
    }
  }
}

// ---------------- world figures ----------------
const SPEED: Record<Actor['kind'], number> = { hero: 2.2 * SCALE, demonlord: 1.2 * SCALE, caravan: 3 * SCALE };

export function spawnActors(g: Game) {
  const T = towns();
  const capitals = T.filter((t) => t.capital);
  const lightCaps = capitals.filter((t) => ['light', 'war'].includes(g.s.countries[t.countryId].religion));
  const darkCaps = capitals.filter((t) => g.s.countries[t.countryId].religion === 'demon' || [5, 8].includes(g.s.countries[t.countryId].continent));
  const mk = (kind: Actor['kind'], name: string, race: string, at: number): Actor => ({ id: `${kind}_${g.s.actors.length}`, kind, name, race, from: at, to: at, prog: 1, alive: true, deeds: 0 });
  g.s.actors.push(mk('hero', g.rng.pick(HERO_NAMES), 'human', g.rng.pick(lightCaps.length ? lightCaps : capitals).id));
  g.s.actors.push(mk('demonlord', g.rng.pick(DEMON_NAMES), 'demonkin', g.rng.pick(darkCaps.length ? darkCaps : capitals).id));
  for (const name of g.rng.sample(CARAVAN_NAMES, 3)) g.s.actors.push(mk('caravan', name, 'human', g.rng.pick(T).id));
}

export function actorPos(a: Actor) {
  const T = towns();
  const f = T[a.from], t = T[a.to];
  return { x: f.x + (t.x - f.x) * a.prog, y: f.y + (t.y - f.y) * a.prog };
}

export const heroActor = (g: Game) => g.s.actors.find((a) => a.kind === 'hero');
export const demonActor = (g: Game) => g.s.actors.find((a) => a.kind === 'demonlord');

function nextTarget(g: Game, a: Actor): number {
  const T = towns();
  const here = T[a.to];
  const near = (max: number) => T.filter((t) => t.id !== here.id && Math.hypot(t.x - here.x, t.y - here.y) < max);
  if (a.kind === 'hero') {
    const d = demonActor(g);
    // the hero hunts the demon lord once on the same continent, otherwise roams dangerous lands
    if (d?.alive && g.s.countries[T[d.to].countryId].continent === g.s.countries[here.countryId].continent && g.rng.chance(0.6)) return d.to;
    const pool = near(45 * SCALE);
    return g.rng.weighted(pool, (t) => 1 + g.s.countries[t.countryId].danger + g.s.countries[t.countryId].flags.length * 2)?.id ?? g.rng.pick(T).id;
  }
  if (a.kind === 'demonlord') {
    // spreads into a neighbouring country it has not just taken
    const pool = near(40 * SCALE).filter((t) => t.countryId !== here.countryId);
    return pool.length ? g.rng.pick(pool).id : g.rng.pick(T).id;
  }
  return (g.rng.pick(near(60 * SCALE).length ? near(60 * SCALE) : T)).id;
}

export function actorsTick(g: Game) {
  const T = towns();
  for (const a of g.s.actors) {
    if (!a.alive) {
      if (a.respawnAt !== undefined && g.s.tick >= a.respawnAt) respawn(g, a);
      continue;
    }
    if (a.prog >= 1) { a.from = a.to; a.to = nextTarget(g, a); a.prog = 0; }
    const f = T[a.from], t = T[a.to];
    const dist = Math.max(1, Math.hypot(t.x - f.x, t.y - f.y));
    a.prog = Math.min(1, a.prog + SPEED[a.kind] / dist);
    if (a.prog >= 1) arrive(g, a);
  }
}

function respawn(g: Game, a: Actor) {
  const T = towns();
  a.alive = true; a.deeds = 0; a.respawnAt = undefined; a.prog = 1;
  if (a.kind === 'hero') {
    a.name = g.rng.pick(HERO_NAMES);
    a.from = a.to = g.rng.pick(T.filter((t) => t.capital)).id;
    news(g, `:herosword: ผู้กล้าคนใหม่ ${a.name} ถูกอัญเชิญมาที่${T[a.to].name}`);
  } else {
    a.name = g.rng.pick(DEMON_NAMES);
    a.from = a.to = g.rng.pick(T.filter((t) => [5, 8].includes(g.s.countries[t.countryId].continent))).id;
    news(g, `:demon: จอมมารตนใหม่ ${a.name} ฟื้นคืนชีพที่${T[a.to].name}`);
  }
}

function news(g: Game, text: string, mine = false) {
  g.s.worldNews.unshift({ year: Math.floor(g.s.year), age: g.age(), text, kind: 'world' });
  if (g.s.worldNews.length > 80) g.s.worldNews.pop();
  if (mine) g.log(`:scroll: ${text}`, 'world');
}

function arrive(g: Game, a: Actor) {
  const T = towns();
  const town = T[a.to];
  const co = g.s.countries[town.countryId];
  const c = g.c;
  const here = c.alive && c.townId === town.id;
  const adult = c.hAge >= 16;
  if (a.kind === 'hero') {
    if (g.rng.chance(0.4)) {
      a.deeds++;
      const m = g.rng.pick(MONSTERS);
      co.danger = Math.max(1, co.danger - 1);
      news(g, `:herosword: ผู้กล้า ${a.name} ปราบ${m.name}ที่${town.name}`, here);
    }
    if (here && !c.flags.includes('follower_hero')) spectacle(g, { anim: 'hero_arrives', title: 'ผู้กล้ามาเยือน', text: `ผู้กล้า ${a.name} เดินทางมาถึง${town.name} ผู้คนออกมาต้อนรับเต็มถนน`, countryId: co.id, townId: town.id, tone: 'warm', mine: true });
    if (c.flags.includes('follower_hero')) followTo(g, town.id, `:herosword: ร่วมเดินทางกับผู้กล้า ${a.name} มาถึง${town.name}`);
    else if (here && adult && g.rng.chance(0.6)) g.queueStory('actor_hero_recruit', { actor: a.name });
  } else if (a.kind === 'demonlord') {
    g.setCountryFlag(co, 'demon_raid', 12);
    co.danger = Math.min(5, co.danger + 1);
    news(g, `:demon: กองทัพจอมมาร ${a.name} บุกยึด${town.name} แห่ง${co.name}`, here || c.countryId === co.id);
    if (c.countryId === co.id && !c.flags.includes('follower_demon')) spectacle(g, { anim: 'demon_army', title: 'กองทัพจอมมารบุก', text: `กองทัพจอมมาร ${a.name} บุกยึด${town.name} แห่ง${co.name}`, countryId: co.id, townId: town.id, tone: 'dark', mine: true });
    if (c.flags.includes('follower_demon')) followTo(g, town.id, `:demon: เดินทัพตามจอมมาร ${a.name} มาถึง${town.name}`);
    else if (here && adult) g.queueStory('actor_demon_arrives', { actor: a.name });
  } else if (here && adult && g.rng.chance(0.5)) {
    g.queueStory('actor_caravan', { actor: a.name });
  }
  // the hero and the demon lord meet: the final battle
  const h = heroActor(g), d = demonActor(g);
  if (h?.alive && d?.alive && T[h.to].countryId === T[d.to].countryId && h.prog >= 1 && d.prog >= 1) {
    const follower = c.flags.includes('follower_hero') ? 'actor_final_battle' : c.flags.includes('follower_demon') ? 'actor_final_battle_demon' : null;
    const near = co.id === c.countryId || g.s.countries[c.countryId].neighbors.includes(co.id);
    if (near || follower) spectacle(g, { anim: 'final_battle', title: 'ศึกตัดสินชะตาโลก', text: `ผู้กล้า ${h.name} เผชิญหน้ากับจอมมาร ${d.name} ที่${town.name}`, countryId: co.id, townId: town.id, tone: 'dark', mine: co.id === c.countryId });
    if (follower && c.alive) g.queueStory(follower, { actor: h.name, demon: d.name });
    else finalBattle(g, g.rng.chance(0.5 + h.deeds * 0.03) ? 'hero' : 'demon');
  }
}

function followTo(g: Game, townId: number, text: string) {
  const c = g.c;
  if (!c.alive || c.townId === townId) return;
  const t = towns()[townId];
  c.countryId = t.countryId;
  c.townId = townId;
  ensureTownNotables(g, townId);
  g.log(text, 'event', 'warm');
  g.hooks.onMove?.(c.countryId, t.countryId);
}

export function finalBattle(g: Game, winner: 'hero' | 'demon' | 'coin') {
  const h = heroActor(g), d = demonActor(g);
  if (!h || !d) return;
  if (winner === 'coin') winner = g.rng.chance(0.5 + h.deeds * 0.03) ? 'hero' : 'demon';
  const T = towns();
  const c = g.c;
  if (winner === 'hero') {
    d.alive = false; d.respawnAt = g.s.tick + 4 * 40;
    news(g, `:herosword: ผู้กล้า ${h.name} ปราบจอมมาร ${d.name} ได้สำเร็จ! โลกเข้าสู่ยุคสงบ`, true);
    for (const co of g.s.countries) { co.flags = co.flags.filter((f) => f !== 'demon_raid'); }
    if (c.flags.includes('follower_demon')) { c.flags = c.flags.filter((f) => f !== 'follower_demon'); g.setJob('adventurer'); g.log(':demon: จอมมารล่มสลาย… สมุนทั้งหลายแตกฉานซ่านเซ็น', 'event', 'dark'); }
  } else {
    h.alive = false; h.respawnAt = g.s.tick + 4 * 15;
    news(g, `:demon: จอมมาร ${d.name} สังหารผู้กล้า ${h.name} ที่${T[d.to].name} ความมืดแผ่ขยาย`, true);
    if (c.flags.includes('follower_hero')) { c.flags = c.flags.filter((f) => f !== 'follower_hero'); g.setJob('adventurer'); g.log(':death: ผู้กล้าที่ {name} ติดตามมาตลอดล้มลงแล้ว…'.replace('{name}', c.name), 'event', 'dark'); }
  }
}

// ---------------- region happenings ----------------
export function regionYear(g: Game) {
  const c = g.c;
  const tries: number[] = [];
  if (g.rng.chance(0.45)) tries.push(g.rng.pick(g.s.countries).id);
  if (g.rng.chance(0.07)) tries.push(c.countryId);
  for (const id of tries) {
    const co = g.s.countries[id];
    const major = co.races[0].race;
    const pool = REGION_EVENTS.filter((e) => !co.flags.includes(e.flag) && ((e.religion?.includes(co.religion)) || (e.climate?.includes(co.climate)) || (e.continent?.includes(co.continent)) || (e.major?.includes(major))));
    const ev = g.rng.weighted(pool, (e) => e.w);
    if (!ev) continue;
    g.setCountryFlag(co, ev.flag, g.rng.int(ev.dur[0], ev.dur[1]));
    const text = `:${ev.icon}: ${ev.text.replace('{c}', co.name)}`;
    co.history.push(`ปี ${Math.floor(g.s.year)}: ${ev.text.replace('{c}', co.name)}`);
    const mine = c.countryId === id;
    news(g, text, mine);
    if (mine && c.alive) {
      if (ev.thread) g.addThread(ev.thread, 1.5);
      if (ev.story && g.rng.chance(0.6)) g.queueStory(ev.story, {});
      spectacle(g, { anim: ev.id, title: ev.name, text: ev.text.replace('{c}', co.name), countryId: co.id, tone: 'grim', mine: true });
    }
  }
  disasterYear(g);
}

// Tell the UI. Only region-scale disasters that strike the protagonist's own land stop time (`pause`);
// everything else plays as a short banner animation that does not block play. Banners are spaced out so they never pile up.
const BIG = new Set(['dragon_raid', 'meteor', 'alien', 'titan', 'kraken', 'eclipse', 'quake', 'holy_war', 'eruption', 'demon_gate', 'horde', 'dragon_awake', 'demon_army', 'final_battle']);
export function spectacle(g: Game, s: Omit<Spectacle, 'pause'>) {
  if (!g.c.alive) return;
  const pause = s.mine && BIG.has(s.anim);
  if (!pause) {
    if (g.s.tick - (g.s.lastBanner ?? -99) < 5) return;
    g.s.lastBanner = g.s.tick;
  }
  g.hooks.onSpectacle?.({ ...s, pause });
}

// ---------------- world disasters ----------------
// about one every three years somewhere in the world; now and then it is the protagonist's land or a neighbour
function disasterYear(g: Game) {
  if (!g.rng.chance(0.32)) return;
  const c = g.c;
  const here = g.s.countries[c.countryId];
  const roll = g.rng.next();
  const target = roll < 0.16 ? here : roll < 0.34 && here.neighbors.length ? g.s.countries[g.rng.pick(here.neighbors)] : g.rng.pick(g.s.countries);
  const coast = target.towns.some((t) => isCoastTown(t));
  const ev = g.rng.weighted(DISASTERS.filter((d) => !target.flags.includes(d.flag) && (!d.coast || coast)), (d) => d.w);
  if (!ev) return;
  g.setCountryFlag(target, ev.flag, g.rng.int(ev.dur[0], ev.dur[1]));
  for (const [f, t] of ev.country || []) g.setCountryFlag(target, f, t);
  if (ev.danger) target.danger = Math.min(5, target.danger + ev.danger);
  const text = ev.text.replace('{c}', target.name);
  target.history.push(`ปี ${Math.floor(g.s.year)}: ${text}`);
  const mine = target.id === c.countryId;
  const near = !mine && here.neighbors.includes(target.id);
  news(g, `:${ev.icon}: ${text}`, mine);
  if (!c.alive) return;
  if (mine) {
    const stage = stageOf(c.hAge);
    if (ev.thread) g.addThread(ev.thread, 1.5);
    if (stage === 'infant') g.log(`:${ev.icon}: ครอบครัวอุ้ม ${c.name} ตัวน้อยหนีภัย${ev.name}อย่างทุลักทุเล`, 'event', 'grim');
    else if (stage === 'child' && ev.tone !== 'warm') g.queueStory('disaster_child', { what: ev.name });
    else if (ev.story) g.queueStory(ev.story, {});
    spectacle(g, { anim: ev.id, title: ev.name, text, countryId: target.id, townId: c.townId, tone: ev.tone, mine: true });
  } else if (near) {
    g.log(`:${ev.icon}: ${ev.near.replace('{c}', target.name)}`, 'world', ev.tone);
    spectacle(g, { anim: ev.id, title: ev.name, text: `${text}\n${ev.near.replace('{c}', target.name)}`, countryId: target.id, tone: ev.tone, mine: false });
  }
}

// ---------------- festivals ----------------
// each land keeps its festivals in their season; the protagonist joins the ones at home (and sees the first of each kind)
export function festivalTick(g: Game) {
  const season = g.s.tick % 4;
  const c = g.c;
  for (const co of g.s.countries) {
    for (const f of countryFestivals(co)) {
      if (f.season !== season || !g.rng.chance(0.85)) continue;
      g.setCountryFlag(co, `fest_${f.id}`, 2);
      if (co.id !== c.countryId || !c.alive) continue;
      const text = f.text.replace('{c}', co.name);
      const stage = stageOf(c.hAge);
      const notes = stage === 'infant' ? [] : g.applyFx(f.fx, {});
      g.log(`:${f.icon}: ${f.name}: ${text}${stage === 'infant' ? ` ${c.name} ตัวน้อยมองแสงสีตาแป๋ว` : ''}${notes.length ? ` (${notes.join(', ')})` : ''}`, 'world', 'warm');
      const seen = (g.s.cine ||= []);
      if (!seen.includes(f.id)) { seen.push(f.id); spectacle(g, { anim: `fest_${f.id}`, title: f.name, text, countryId: co.id, townId: c.townId, tone: 'warm', mine: true }); }
    }
  }
}

// while a regional happening lasts, living there slowly shapes the protagonist's story
export function regionThreads(g: Game) {
  for (const f of g.country.flags) {
    const ev = REGION_EVENTS.find((e) => e.flag === f);
    if (ev?.thread) g.addThread(ev.thread, 0.05);
  }
}

// ---------------- weather ----------------
const WEATHER: Record<string, [string, number][]> = {
  temperate: [['clear', 4], ['cloudy', 3], ['rain', 3], ['storm', 1], ['fog', 1], ['snow', 0.5]],
  tropical: [['clear', 2], ['rain', 4], ['storm', 2], ['fog', 1], ['heat', 1]],
  desert: [['clear', 4], ['heat', 3], ['sandstorm', 2]],
  frozen: [['snow', 4], ['blizzard', 2], ['clear', 2], ['fog', 1]],
  volcanic: [['ashfall', 3], ['clear', 2], ['heat', 2], ['storm', 1]],
  islands: [['clear', 4], ['rain', 2], ['storm', 2], ['fog', 1]],
};
export const WEATHER_TH: Record<string, string> = { clear: 'ฟ้าใส', cloudy: 'เมฆครึ้ม', rain: 'ฝนตก', storm: 'พายุฝนฟ้าคะนอง', snow: 'หิมะตก', blizzard: 'พายุหิมะ', sandstorm: 'พายุทราย', fog: 'หมอกลง', heat: 'แดดแผดเผา', ashfall: 'เถ้าภูเขาไฟโปรย' };

// each season every country gets weather that fits its climate (and tends to persist)
export function weatherTick(g: Game) {
  const season = g.s.tick % 4;
  for (const co of g.s.countries) {
    if (co.weather && g.rng.chance(0.35)) continue;
    const table = WEATHER[co.climate] || WEATHER.temperate;
    co.weather = g.rng.weighted(table, ([w, n]) => n * (season === 3 && (w === 'snow' || w === 'blizzard') ? 3 : 1) * (season === 1 && w === 'heat' ? 2 : 1))![0];
  }
}

export const continentName = (id: number) => CONTINENTS[id]?.name || '';
