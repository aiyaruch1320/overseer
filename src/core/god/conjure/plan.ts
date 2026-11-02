// A conjuring worked out but not done (07-conjure.md §6 steps 1 to 3): the circle (verb, core, size), the target, what the table of reactions and the table of results say,
// the price, the chance of the shadow, the name the world would give it. Pure: nothing is rolled and nothing is changed; the details the seed chooses come from a stream made of the
// seed and the mix and the target (`detail`), so the same ingredients on the same target in the same world give the same result and the same name ("ผลคงที่").
import type { Ctx } from '../../game';
import { detached, type Rng } from '../../rng';
import { streamStart } from '../../rng';
import { continentName, placeName } from '../../text/pick';
import { bankWords, nameTaken } from '../../text/names';
import { slotsOf } from '../../npc/types';
import { npcIndex } from '../../npc/data';
import { geoOf } from '../../world/place';
import { clamp, continentOf, countriesOf, countryName, hasCountry, neighboursOf } from '../acts/geo';
import { handlerOf } from '../acts/miracles';
import { scaleCost, type Cost } from '../power';
import { godData } from '../state';
import { CELLS, type Cell } from './table';
import { flatten, opText, type Op } from './ops';
import { REACTIONS, SEAL_HIT, type Reaction } from './reactions';
import { CLASH, CLASH_ADD, DETAIL, DREAD_CORES, OMEN_LINE, OMEN_QUARTERS, SEAL_HOME, SIZE_FACTOR, VERB_MUL } from './tuning';

export interface Mix {
  verb: string;
  core: string;
  scale: string;
}
export const mixKey = (m: Mix): string => `${m.verb}.${m.core}.${m.scale}`;

export interface Target {
  /** The country the effect lands on (the NPC's country for a person, the character's for himself). */
  country: string;
  continent?: string;
  npc?: string;
  self?: boolean;
}

export interface Plan {
  mix: Mix;
  key: string;
  target: Target;
  /** The key the target goes by in the name registry and in the chronicle. */
  targetKey: string;
  cell: Cell;
  /** The listed miracle that is run instead when the combination matches one (no quota). */
  mr?: { id: string; args: Record<string, unknown> };
  reaction?: Reaction;
  ops: Op[];
  say: string;
  /** What the words of the cell say at this size (the doc's text, for the preview). */
  expected: string;
  cost: Cost;
  pay: 'faith' | 'dread';
  shadow: number;
  shadowSure: boolean;
  quarters: number;
  name: string;
  omen: string;
  /** Seal pins in the scope that the conjuring would hit. */
  pins: number[];
}

type DataRows = ReturnType<typeof godData>['conjure'];
const rows = (ctx: Ctx): DataRows => godData(ctx).conjure;

/** A stream of the seed, the mix and the target: the same ingredients give the same draws. */
export function detail(ctx: Ctx, tag: string, mix: Mix, targetKey: string): Rng {
  return detached(streamStart(ctx.state.seed, `conjure.${tag}:${mixKey(mix)}:${targetKey}`));
}

// ---------- the circle ----------

/** The mix a command names: the ids (`create` `fire` `country`) or the Thai names (`ให้กำเนิด` `ไฟ` `ประเทศ`). */
export function parseMix(ctx: Ctx, args: Record<string, unknown>): Mix | string {
  const c = rows(ctx);
  const find = <T extends { id: string; name: string }>(list: T[], v: unknown): string | null => {
    const s = String(v ?? '').trim();
    return list.find((x) => x.id === s || x.name === s)?.id ?? null;
  };
  const verb = find(c.verbs, args.verb);
  const core = find(c.cores, args.core);
  const scale = find(c.scales, args.scale);
  if (!verb) return `ไม่รู้จักกริยา "${String(args.verb ?? '')}" (${c.verbs.map((v) => v.name).join(' ')})`;
  if (!core) return `ไม่รู้จักแก่น "${String(args.core ?? '')}" (${c.cores.map((v) => v.name).join(' ')})`;
  if (!scale) return `ไม่รู้จักขนาด "${String(args.scale ?? '')}" (${c.scales.map((v) => v.name).join(' ')})`;
  return { verb, core, scale };
}

export const verbName = (ctx: Ctx, id: string): string => rows(ctx).verbs.find((v) => v.id === id)?.name ?? id;
export const coreName = (ctx: Ctx, id: string): string => rows(ctx).cores.find((v) => v.id === id)?.name ?? id;
export const scaleName = (ctx: Ctx, id: string): string => rows(ctx).scales.find((v) => v.id === id)?.name ?? id;

/** All the combinations of the circle: 6 × 8 × 4 = 192. */
export function allMixes(ctx: Ctx): Mix[] {
  const c = rows(ctx);
  return c.verbs.flatMap((v) => c.cores.flatMap((k) => c.scales.map((s) => ({ verb: v.id, core: k.id, scale: s.id }))));
}

// ---------- the target ----------

const livingCountry = (ctx: Ctx): string | undefined => (ctx.state.life && !ctx.state.life.dead ? ctx.state.life.country : undefined);

/** The target a command names for the size of the mix, or why there is none. */
export function targetOf(ctx: Ctx, mix: Mix, args: Record<string, unknown>): Target | string {
  const home = livingCountry(ctx);
  switch (mix.scale) {
    case 'person': {
      if (args.npc !== undefined && args.npc !== '') {
        const id = String(args.npc);
        if (!npcIndex(ctx).rows.has(id)) return `ไม่มี NPC ${id}`;
        const slot = slotsOf(ctx.state)[id];
        if (!slot || slot.status !== 'alive') return 'NPC นั้นไม่มีชีวิตอยู่';
        return { country: slot.place ?? npcIndex(ctx).rows.get(id)?.country ?? home ?? '', npc: id };
      }
      // no one named: the character himself, who cannot be the target of the verb that destroys
      if (mix.verb === 'destroy') return 'ขนาดคนกับกริยาทำลายต้องระบุ NPC (ตัวละครหลักไม่ใช่เป้า)';
      return home ? { country: home, self: true } : 'ไม่มีตัวละครที่มีชีวิต';
    }
    case 'place':
    case 'country': {
      const c = args.country === undefined || args.country === '' ? home : String(args.country);
      if (!c) return 'ไม่ระบุประเทศ';
      return hasCountry(ctx, c) ? { country: c, continent: continentOf(c) } : `ไม่มีประเทศ ${c}`;
    }
    default: {
      const k = args.continent === undefined || args.continent === '' ? (home ? continentOf(home) : undefined) : String(args.continent);
      if (!k || !countriesOf(ctx, k).length) return k ? `ไม่มีทวีป ${k}` : 'ไม่ระบุทวีป';
      return { country: largest(ctx, k), continent: k };
    }
  }
}

export const targetKeyOf = (mix: Mix, t: Target): string => (mix.scale === 'continent' ? t.continent! : t.npc ? `npc:${t.npc}` : t.self ? 'self' : t.country);

/** The largest country of a continent by the size of its main city (ui.scale), then by id. */
export function largest(ctx: Ctx, continent: string): string {
  const list = countriesOf(ctx, continent);
  const f = ctx.data.countries?.items as Record<string, { id: string; ui?: { scale?: number } }> | undefined;
  const size = (id: string) => (f ? Object.values(f).find((c) => c.id === id)?.ui?.scale ?? 0 : 0);
  return [...list].sort((a, b) => size(b) - size(a) || a.localeCompare(b))[0];
}

/** The countries a conjuring of this size lands on, with the share of the effect each carries. */
export function scopeOf(ctx: Ctx, mix: Mix, t: Target): { country: string; factor: number }[] {
  if (mix.scale === 'continent') return countriesOf(ctx, t.continent!).map((c) => ({ country: c, factor: SIZE_FACTOR.continent }));
  return [{ country: t.country, factor: SIZE_FACTOR[mix.scale] }];
}

/** Dragons whose seal is in the countries of the scope and who are alive (04-miracles.md iron rule 3). */
export function pinsIn(ctx: Ctx, countries: string[]): number[] {
  const out = new Set<number>();
  for (const c of countries) for (const i of SEAL_OF(c)) if (ctx.state.world.dragons[i]?.alive) out.add(i);
  return [...out].sort((a, b) => a - b);
}
const SEAL_OF = (c: string): number[] => SEAL_HOME[c] ?? [];
export const isPin = (c: string): boolean => c in SEAL_HOME;

// ---------- the listed miracle ----------

function mrOf(ctx: Ctx, mix: Mix, cell: Cell, t: Target): { id: string; args: Record<string, unknown> } | undefined {
  const r = cell.mr;
  if (!r) return undefined;
  let id: string | null | undefined;
  let args: Record<string, unknown> = {};
  if (mix.scale === 'country') {
    id = r.country?.(ctx, t.country);
    if (id === 'MR-09') args = { continent: continentOf(t.country) };
    else args = { country: t.country };
  } else if (mix.scale === 'continent') {
    id = r.continent;
    // MR-20 raises land from the sea beside a coastal country; MR-18 swallows the largest city of the continent
    const coast = countriesOf(ctx, t.continent!).find((c) => geoOf(ctx, c)?.coast);
    args = { continent: t.continent, country: id === 'MR-20' ? coast ?? t.country : t.country };
  } else if (mix.scale === 'person') {
    id = r.person;
    args = { npc: t.npc };
  }
  if (!id || !handlerOf(id)) return undefined;
  return { id: String(id), args: { id, ...args } };
}

// ---------- the price ----------

/** The base price of the mix (07-conjure.md §1): the base of the size × the multiplier of the verb, rounded up, then the multipliers of the power. */
export function priceOf(ctx: Ctx, mix: Mix): { cost: Cost; pay: 'faith' | 'dread'; base: number } {
  const base = Math.ceil(rows(ctx).scales.find((s) => s.id === mix.scale)!.base * VERB_MUL[mix.verb] - 1e-9);
  const line = rows(ctx).verbs.find((v) => v.id === mix.verb)!.payLine;
  const pay: 'faith' | 'dread' = line === 'core' ? (DREAD_CORES.includes(mix.core) ? 'dread' : 'faith') : (line as 'faith' | 'dread');
  return { cost: scaleCost(ctx, { [pay]: base }), pay, base };
}

// ---------- the shadow ----------

/** Chance of the shadow (07-conjure.md §4): by size, 15% more when the core clashes with the place; certain after a flood. */
export function shadowChance(ctx: Ctx, mix: Mix, t: Target): number {
  let p = rows(ctx).shadow.chance[mix.scale] ?? 0;
  if (p <= 0) return 0;
  const c = t.country;
  const clash = (CLASH[mix.core] ?? []).includes(continentOf(c)) || (mix.core === 'life' && (ctx.state.world.countryFlags[c] ?? []).some((f) => f === 'god_ruin' || f === 'fallen'));
  if (clash) p += CLASH_ADD;
  return clamp(p, 0, 1);
}

// ---------- the name ----------

/** The name the world would give the conjuring: image of the core (tone by the line paid) + modifier of the verb or of the tone + "แห่ง" + the place. Pure; a name taken is passed over. */
export function nameFor(ctx: Ctx, mix: Mix, t: Target, pay: 'faith' | 'dread', taken: string[] = []): string {
  const tone = pay === 'dread' ? 'หนัก มืด' : 'อุ่น สว่าง';
  const imgs = bankWords(ctx, `2_1.ภาพ.${coreName(ctx, mix.core)}.${tone}`);
  const verbMods = bankWords(ctx, `2_2.คำขยาย.${verbName(ctx, mix.verb)}.คำขยายตามกริยา`);
  const toneMods = bankWords(ctx, `2_2.คำขยาย.${tone}.คำสี`);
  const where = mix.scale === 'continent' ? continentName(ctx, t.continent) ?? t.continent! : placeName(ctx, t.country) ?? countryName(ctx, t.country);
  const r = detail(ctx, 'name', mix, targetKeyOf(mix, t));
  const make = () => `${imgs.length ? r.pick(imgs) : coreName(ctx, mix.core)}${r.chance(0.5) && verbMods.length ? r.pick(verbMods) : toneMods.length ? r.pick(toneMods) : ''}แห่ง${where}`;
  let name = make();
  for (let i = 0; i < 60 && (nameTaken(ctx, name) || taken.includes(name)); i++) name = make();
  for (let k = 2; nameTaken(ctx, name) || taken.includes(name); k++) name = `${name}${k}`;
  return name;
}

/** The detail the seed picks for the day (who sees it first, where it falls, the colour of the light). Changes no number. */
export function dayDetail(ctx: Ctx, mix: Mix, t: Target): { seen: string; spot: string; hue: string } {
  const r = detail(ctx, 'day', mix, targetKeyOf(mix, t));
  return { seen: r.pick(DETAIL.seen), spot: r.pick(DETAIL.spot), hue: r.pick(DETAIL.hue) };
}

// ---------- the whole plan ----------

/** The part of the cell's words that holds at this size (`คน:` `ทวีป:` parts follow the first). */
function expectedText(ctx: Ctx, mix: Mix): string {
  const cell = rows(ctx).cells.find((c) => c.verb === mix.verb && c.core === mix.core);
  const parts = (cell?.text ?? '').split(/\s+·\s+/);
  const tag = mix.scale === 'person' ? 'คน:' : mix.scale === 'continent' ? 'ทวีป:' : '';
  const own = tag ? parts.find((p) => p.startsWith(tag)) : undefined;
  return (own ?? parts.filter((p) => !p.startsWith('คน:') && !p.startsWith('ทวีป:'))[0] ?? cell?.text ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

/** Works out the whole conjuring for a command, or says why the circle and target do not make one. */
export function plan(ctx: Ctx, args: Record<string, unknown>, taken: string[] = []): { ok: true; plan: Plan } | { ok: false; reason: string } {
  const mix = parseMix(ctx, args);
  if (typeof mix === 'string') return { ok: false, reason: mix };
  const target = targetOf(ctx, mix, args);
  if (typeof target === 'string') return { ok: false, reason: target };
  const cell = CELLS[`${mix.verb}.${mix.core}`];
  if (!cell) return { ok: false, reason: 'ส่วนผสมนี้ยังไม่มีผลในตาราง' };
  const key = mixKey(mix);
  // the table of reactions comes first (07-conjure.md §3), at the size of a place or a country
  const single = mix.scale === 'place' || mix.scale === 'country';
  const reaction = single ? REACTIONS.find((r) => r.i !== SEAL_HIT && r.matches(ctx, mix, target.country)) : undefined;
  const replaced = !!reaction && reaction.mode === 'replace';
  const mr = replaced ? undefined : mrOf(ctx, mix, cell, target);
  const price = priceOf(ctx, mix);
  const scope = scopeOf(ctx, mix, target);
  const pins = mix.verb === 'destroy' || (mix.verb === 'create' && mix.core === 'life') ? pinsIn(ctx, scope.map((s) => s.country)) : [];
  const ops = replaced ? reaction!.ops ?? [] : cell.ops;
  const tkey = targetKeyOf(mix, target);
  return {
    ok: true,
    plan: {
      mix,
      key,
      target,
      targetKey: tkey,
      cell,
      ...(mr ? { mr } : {}),
      ...(reaction ? { reaction } : {}),
      ops,
      say: replaced ? reaction!.say : cell.say,
      expected: replaced ? reaction!.text(ctx) : expectedText(ctx, mix),
      cost: price.cost,
      pay: price.pay,
      shadow: shadowChance(ctx, mix, target),
      shadowSure: !!reaction?.shadowSure,
      quarters: OMEN_QUARTERS[mix.scale] ?? 0,
      name: nameFor(ctx, mix, target, price.pay, taken),
      omen: OMEN_LINE[mix.core],
      pins,
    },
  };
}

/** The effects of a plan as words (for the preview). */
export function effectLines(ctx: Ctx, p: Plan): string[] {
  return flatten(ctx, p.ops, p.target.country).map(opText);
}

/** The neighbours of the country the shadow may fall on, besides the country itself. */
export const shadowPlaces = (ctx: Ctx, c: string): string[] => [c, ...neighboursOf(ctx, c)];
