// The kinds of the effect grammar this system owns (docs/guide/code-plan.md §5.2, src/core/rules): who the character is and what it holds.
// Conditions: has race age class half gender faith sign country continent.
// Effects: grant remove death wound trust class favour statPct statMul range pct.
// Numbers: gold fame the six stats, the eight axes, trust, belief, heart, class and their Thai names.
import type { Ctx } from '../game';
import { write } from '../log';
import { apply, onCond, onEffect, onStat, readStat } from '../rules';
import type { LifeState } from '../types';
import { classNum, extOf, idx } from './data';
import { die } from './death';
import { grantJob } from './jobs';
import { addCanon, giveId, readCanon, STAT_ALIASES, takeId, holds, trustOf } from './life';
import { FAVOUR_DEFAULT } from './tuning';

const alive = (ctx: Ctx): LifeState | null => ctx.state.life;

/** Storyline race codes (`hu` `el` ...) and race ids both name a race. */
export function raceId(ctx: Ctx, code: string): string {
  return idx(ctx).raceByPrefix.get(code) ?? code;
}

let installed = false;

/** Keys whose names only this system registers (throws when a name is taken twice). */
const SURE = new Set(['pow', 'mag', 'spd', 'luk', 'int', 'vit', 'gold', 'fame', 'brave', 'kind', 'ambition', 'piety', 'curious', 'honest', 'temper', 'social']);

/** Registers the rules. Called once when the module is imported; a test that resets the registry can call it again. */
export function registerCharacterRules(force = false): void {
  if (installed && !force) return;
  installed = true;

  // ---------- conditions ----------
  onCond('has', (ctx, c) => {
    const life = alive(ctx);
    return !!life && holds(ctx, life, c.kind, c.id, c.level);
  });
  onCond('race', (ctx, c) => {
    const life = alive(ctx);
    return !!life && c.ids.some((id) => raceId(ctx, id) === life.race);
  });
  onCond('age', (ctx, c) => {
    const life = alive(ctx);
    return !!life && (c.min === undefined || life.hAge >= c.min) && (c.max === undefined || life.hAge <= c.max);
  });
  onCond('class', (ctx, c) => {
    const life = alive(ctx);
    if (!life) return false;
    const n = classNum(life);
    return (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max);
  });
  onCond('half', (ctx) => {
    const life = alive(ctx);
    return !!life && !!extOf(life).second;
  });
  onCond('gender', (ctx, c) => {
    const life = alive(ctx);
    return !!life && !extOf(life).neuter && life.gender === c.value;
  });
  onCond('faith', (ctx, c) => {
    const life = alive(ctx);
    return !!life && extOf(life).faith !== '' && c.ids.includes(extOf(life).faith);
  });
  onCond('sign', (ctx, c) => {
    const life = alive(ctx);
    if (!life) return false;
    const e = extOf(life);
    return c.ids.some((id) => {
      const s = id.replace(/^sign_/, '');
      return s === e.sign || s === e.time;
    });
  });
  onCond('country', (ctx, c) => {
    const life = alive(ctx);
    return !!life && (c.ids.includes(life.country) || c.ids.includes(life.home));
  });
  onCond('continent', (ctx, c) => {
    const life = alive(ctx);
    const ids: string[] = c.ids;
    return !!life && (ids.includes(life.country.slice(0, 2)) || ids.includes(life.home.slice(0, 2)));
  });

  // ---------- numbers ----------
  const stat = (key: string) => ({
    read: (ctx: Ctx) => (ctx.state.life ? readCanon(ctx, ctx.state.life, key) : 0),
    add: (ctx: Ctx, _name: string, delta: number) => {
      if (ctx.state.life) addCanon(ctx, ctx.state.life, key, delta);
    },
  });
  for (const [name, key] of Object.entries(STAT_ALIASES)) {
    // the six stats, gold, fame, the axes and their Thai names are ours; the rest are numbers of the character that
    // another system may also want to name (belief, heart, class ...): the first to register keeps the name
    try {
      onStat(name, stat(key));
    } catch (err) {
      if (SURE.has(key)) throw err;
    }
  }
  onStat('axis.', {
    read: (ctx, name) => (ctx.state.life ? readCanon(ctx, ctx.state.life, name.slice(5)) : 0),
    add: (ctx, name, delta) => {
      if (ctx.state.life) addCanon(ctx, ctx.state.life, name.slice(5), delta);
    },
  });
  // `trust` alone is the count of peoples trusted at least 3 ("ไว้ใจ ≥ 3 จาก 10 เผ่า"); `trust.<people>` is one of them
  onStat('trust', { read: (ctx) => (ctx.state.life ? trustOf(ctx.state.life) : 0) });
  const oneTrust = {
    read: (ctx: Ctx, name: string) => (ctx.state.life ? trustOf(ctx.state.life, name.replace(/^trust[.:]/, '')) : 0),
    add: (ctx: Ctx, name: string, delta: number) => addTrust(ctx, name.replace(/^trust[.:]/, ''), delta),
  };
  onStat('trust.', oneTrust);
  // the generator wrote these two with a colon (`trust:เอลฟ์`), which the registry does not read as a prefix
  for (const who of ['เอลฟ์', 'ทั้งสองเผ่า']) onStat(`trust:${who}`, oneTrust);

  // ---------- effects ----------
  onEffect('grant', (ctx, e, src) => {
    const life = alive(ctx);
    if (!life || life.dead) return;
    if (e.kind === 'job') {
      grantJob(ctx, e.id, src);
      return;
    }
    if (giveId(ctx, life, e.kind, e.id, e.level) && (e.kind === 'blessing' || e.kind === 'curse'))
      write(ctx.state, { sys: 'character', kind: 'grant', id: e.id, data: { kind: e.kind, from: src.id ?? src.sys }, level: 2 });
  });
  onEffect('remove', (ctx, e, src) => {
    const life = alive(ctx);
    if (!life || life.dead) return;
    if (takeId(ctx, life, e.kind, e.id) && (e.kind === 'blessing' || e.kind === 'curse' || e.kind === 'job'))
      write(ctx.state, { sys: 'character', kind: 'remove', id: e.id, data: { kind: e.kind, from: src.id ?? src.sys }, level: 2 });
  });
  onEffect('death', (ctx, e, src) => {
    if (e.chance !== undefined && !ctx.rng(src.stream ?? 'life.death').chance(e.chance)) return;
    die(ctx, e.cause ?? 'story', src.sys === 'story' ? src.id : undefined);
  });
  onEffect('wound', (ctx, e, src) => {
    const life = alive(ctx);
    if (!life || life.dead) return;
    if (e.chance !== undefined && !ctx.rng(src.stream ?? `life.${src.sys}`).chance(e.chance)) return;
    extOf(life).wounds += 1;
    if (!life.flags.includes('wounded')) life.flags.push('wounded');
    write(ctx.state, { sys: 'character', kind: 'wound', data: { from: src.id ?? src.sys }, level: 2 });
  });
  onEffect('trust', (ctx, e) => addTrust(ctx, e.toward, e.delta));
  onEffect('class', (ctx, e) => {
    const life = alive(ctx);
    if (life) addCanon(ctx, life, 'class', e.value - classNum(life));
  });
  onEffect('favour', (ctx, e) => {
    const life = alive(ctx);
    if (!life) return;
    const f = extOf(life).favour;
    const k = `${e.kind}:${e.id}`;
    f[k] = (f[k] ?? 1) * (e.mul ?? FAVOUR_DEFAULT);
  });
  // changes of a number by percent, factor or a drawn range go through the number's own writer, whoever owns the number
  onEffect('statPct', (ctx, e, src) => {
    const v = readStat(ctx, e.stat);
    if (v !== undefined) apply(ctx, [{ k: 'stat', stat: e.stat, delta: (v * e.pct) / 100 }], src);
  });
  onEffect('statMul', (ctx, e, src) => {
    const v = readStat(ctx, e.stat);
    if (v !== undefined) apply(ctx, [{ k: 'stat', stat: e.stat, delta: v * (e.mul - 1) }], src);
  });
  onEffect('range', (ctx, e, src) => {
    const lo = Math.min(e.min, e.max);
    const hi = Math.max(e.min, e.max);
    apply(ctx, [{ k: 'stat', stat: e.stat, delta: ctx.rng(src.stream ?? `life.${src.sys}`).int(lo, hi) }], src);
  });
  // `ดอก 20%`: a percentage the phrase carries; the system that reads the phrase uses it, nothing to do here
  onEffect('pct', () => {});
}

function addTrust(ctx: Ctx, toward: string, delta: number): void {
  const life = alive(ctx);
  if (!life) return;
  const t = extOf(life).trust;
  const k = toward || '*';
  t[k] = (t[k] ?? 0) + delta;
}
