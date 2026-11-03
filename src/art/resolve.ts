// From the generated Looks (data/gen/looks.json, written by scripts/codegen/groups/looks.ts) to the PersonLook the painter draws.
// Pure and deterministic: no DOM, no chance; the same id gives the same figure every time, so Node tests and check:looks can call it.
import type { LookBody, LooksData, LookStage, NpcLookRow, PersonLookRow, RaceLookRow, SuccessorLookRow } from '../core/data/types-looks';
import type { Body, PersonLook, Stage } from './look';

// the copies of the painter's shapes in types-looks.ts must stay assignable to the painter's types
const asBody = (b: LookBody): Body => b;
const asStage = (s: LookStage): Stage => s;

export interface ResolveOpts {
  /** draw the person at another life stage than the docs say (a younger or older self) */
  stage?: Stage;
  fem?: boolean;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(a: readonly T[], seed: string): T => a[hash(seed) % a.length];

const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number): string => {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const ELDER_GREY = '#c8c8cc';

function raceOf(looks: LooksData, id: string): RaceLookRow {
  const r = looks.races[id];
  if (!r) throw new Error(`looks: no race ${id}`);
  return r;
}

function person(looks: LooksData, key: string, row: PersonLookRow, opts: ResolveOpts | undefined): PersonLook {
  const R = raceOf(looks, row.race);
  const ov = R.lines.find((l) => l.name === row.line)?.overrides;
  const stage: Stage = opts?.stage ?? asStage(row.stage);
  const fem = opts?.fem ?? row.fem ?? hash(key) % 2 === 1;
  const body: Body = { ...asBody(R.body), scale: ov?.scale ?? R.body.scale };
  const feats = [...new Set([...(ov?.feats ?? R.feats), ...row.feats])];
  const young = stage === 'infant' || stage === 'child';
  return {
    kind: 'person', key, race: row.race, ...(row.line ? { line: row.line } : {}), stage, fem, body,
    skin: row.skin,
    // an older self has the grey of age whatever the docs say of the younger
    hairColor: stage === 'elder' && row.stage !== 'elder' ? mix(row.hairColor, ELDER_GREY, 0.75) : row.hairColor,
    eye: row.eye, accent: ov?.accent ?? R.accents[0], main: row.main, second: row.second,
    outfit: row.outfit, hair: row.hair, hat: young ? '' : row.hat, beard: fem || young || stage === 'teen' ? '' : row.beard, tool: row.tool,
    feats, wear: row.wear,
  };
}

export function npcLook(looks: LooksData, id: string, opts?: ResolveOpts): PersonLook {
  const row: NpcLookRow | undefined = looks.npcs[id];
  if (!row) throw new Error(`looks: no NPC ${id}`);
  return person(looks, id, row, opts);
}

export function successorLook(looks: LooksData, id: string, opts?: ResolveOpts): PersonLook {
  const row: SuccessorLookRow | undefined = looks.successors[id];
  if (!row) throw new Error(`looks: no successor ${id}`);
  return person(looks, id, row, opts);
}

/**
 * A person of a race who is not in the docs by name (a main character's body, a crowd member): the race's body and colours, the sub-line's
 * differences, plain clothes in the race colours. `seed` picks the skin; the same seed gives the same figure.
 */
export function raceLook(looks: LooksData, race: string, o: { line?: string; stage: Stage; fem: boolean; seed: string }): PersonLook {
  const R = raceOf(looks, race);
  const ln = o.line ? R.lines.find((l) => l.name === o.line) : undefined;
  const ov = ln?.overrides;
  const hairless = (ov?.feats ?? R.feats).includes('hairless');
  const key = `race:${race}:${ln?.name ?? ''}:${o.stage}:${o.fem ? 'f' : 'm'}:${o.seed}`;
  return {
    kind: 'person', key, race, ...(ln ? { line: ln.name } : {}), stage: o.stage, fem: o.fem,
    body: { ...asBody(R.body), scale: ov?.scale ?? R.body.scale },
    skin: ov?.skin ?? pick(R.skins, key), hairColor: ov?.hairColor ?? (o.stage === 'elder' ? ELDER_GREY : '#3a2a20'), eye: ov?.eye ?? '#2a2024',
    accent: ov?.accent ?? R.accents[0], main: R.accents[1] ?? R.accents[0], second: R.accents[2] ?? R.accents[0],
    // the race's usual clothes (the dwarves' apron) and the beard its men wear (02-races.md); the young and the women have no beard
    outfit: R.outfit || 'tunic', hair: hairless ? '' : o.fem ? (R.feats.includes('beadbeard') ? 'braid' : 'long') : 'short', hat: '',
    beard: o.fem || hairless || o.stage === 'infant' || o.stage === 'child' || o.stage === 'teen' ? '' : R.beard, tool: '', feats: [...(ov?.feats ?? R.feats)], wear: 0,
  };
}
