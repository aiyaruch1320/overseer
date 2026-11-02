// What a miracle leaves in the world until the economy and combat systems of M3 can carry it: country flags with a time, and modifiers
// (food ×0.8 for two years, W −1 for five ...) kept in `god.ext.acts.mods` for those systems to read through `modMul` and `modAdd`.
import type { Ctx } from '../../game';
import type { CountryId } from '../../types';
import { clamp, continentOf } from './geo';
import { actsOf, yearOf, type Mod } from './state';

// ---------- country flags with a time ----------

/** Puts a flag on a country, for `years` world years (for good when omitted). */
export function setFlag(ctx: Ctx, country: CountryId, flag: string, years?: number): void {
  const w = ctx.state.world;
  const flags = (w.countryFlags[country] ??= []);
  if (!flags.includes(flag)) flags.push(flag);
  const a = actsOf(ctx.state);
  a.timers = a.timers.filter((t) => !(t.country === country && t.flag === flag));
  if (years !== undefined) a.timers.push({ country, flag, until: yearOf(ctx) + years });
}

/** Takes a flag off a country; `war` also leaves the world's own war timer, which would bring the flag back. */
export function clearFlag(ctx: Ctx, country: CountryId, flag: string): void {
  const w = ctx.state.world;
  w.countryFlags[country] = (w.countryFlags[country] ?? []).filter((f) => f !== flag);
  if (flag === 'war') delete w.chains['warflag:' + country];
  const a = actsOf(ctx.state);
  a.timers = a.timers.filter((t) => !(t.country === country && t.flag === flag));
}

// ---------- modifiers ----------

export function addMod(ctx: Ctx, m: Omit<Mod, 'id' | 'from' | 'until'> & { years?: number }): Mod {
  const { years, ...rest } = m;
  const a = actsOf(ctx.state);
  const mod: Mod = { id: `m${yearOf(ctx)}.${++a.modN}`, from: yearOf(ctx), ...rest, ...(years !== undefined ? { until: yearOf(ctx) + years } : {}) };
  a.mods.push(mod);
  return mod;
}

export const activeMods = (ctx: Ctx): Mod[] => actsOf(ctx.state).mods.filter((m) => m.until === undefined || m.until > yearOf(ctx));

interface Where {
  country?: CountryId;
  continent?: string;
}

const applies = (m: Mod, w: Where): boolean => {
  if (m.country) return m.country === w.country;
  if (m.continent) return m.continent === w.continent || (w.country !== undefined && continentOf(w.country) === m.continent);
  return true;
};

/** The product of the multipliers on a subject (`food` `medicine` `wood` `sea` `mercenary`) that hold at this place now. The economy multiplies its price by it. */
export function modMul(ctx: Ctx, subject: string, where: Where = {}): number {
  let v = 1;
  for (const m of activeMods(ctx)) if (m.subject === subject && m.mul !== undefined && applies(m, where)) v *= m.mul;
  return v;
}

/** The sum of the additions on a subject (`W` `C` `defense` `war-risk`) that hold at this place now. */
export function modAdd(ctx: Ctx, subject: string, where: Where = {}): number {
  let v = 0;
  for (const m of activeMods(ctx)) if (m.subject === subject && m.add !== undefined && applies(m, where)) v += m.add;
  return v;
}

// ---------- faith of a country ----------

/** Moves the faith of one country (channel B, 0..100). */
export function faithAt(ctx: Ctx, country: CountryId, delta: number): void {
  const f = ctx.state.world.countryFaith;
  if (f[country] === undefined) return;
  f[country] = clamp(f[country] + delta, 0, 100);
}

// ---------- time ----------

/** Drops the flags and modifiers whose time is over. Called every beat and every world step. */
export function expire(ctx: Ctx): void {
  const a = actsOf(ctx.state);
  const y = yearOf(ctx);
  if (a.timers.length) {
    const done = a.timers.filter((t) => t.until <= y);
    if (done.length) {
      a.timers = a.timers.filter((t) => t.until > y);
      for (const t of done) {
        if (a.timers.some((x) => x.country === t.country && x.flag === t.flag)) continue;
        ctx.state.world.countryFlags[t.country] = (ctx.state.world.countryFlags[t.country] ?? []).filter((f) => f !== t.flag);
      }
    }
  }
  if (a.mods.some((m) => m.until !== undefined && m.until <= y)) a.mods = a.mods.filter((m) => m.until === undefined || m.until > y);
  for (const [id, f] of Object.entries(a.fates)) if (f.until <= y) delete a.fates[id];
}
