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
/** The sub-lines whose hair the docs fix (02-races.md merfolk table: the siren's is long and floats, in either sex). */
const LINE_HAIR: Record<string, string> = { 'ไซเรน': 'long' };
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
  // a person's own body fields (the row names only the ones that differ) win over the race's and the line's
  const body: Body = { ...asBody(R.body), scale: ov?.scale ?? R.body.scale, ears: row.ears ?? ov?.ears ?? R.body.ears };
  if (row.body) Object.assign(body, asBody({ ...body, ...row.body }));
  const feats = [...new Set([...(row.raceFeats ?? ov?.feats ?? R.feats), ...row.feats])];
  const young = stage === 'infant' || stage === 'child';
  return {
    kind: 'person', key, race: row.race, ...(row.line ? { line: row.line } : {}), stage, fem, body,
    skin: row.skin,
    // an older self has the grey of age whatever the docs say of the younger
    hairColor: stage === 'elder' && row.stage !== 'elder' ? mix(row.hairColor, ELDER_GREY, 0.75) : row.hairColor,
    eye: row.eye, accent: row.accent ?? ov?.accent ?? R.accents[0], main: row.main, second: row.second,
    outfit: row.outfit, hair: (row.line && LINE_HAIR[row.line]) || row.hair, hat: young ? '' : row.hat, beard: fem || young || stage === 'teen' ? '' : row.beard, tool: row.tool,
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

const KIN_RACES = new Set(['human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'vampire', 'fae', 'giant']);
// What makes two people of one race two people (a family of four children of one dwarf smith): the seed picks among these, a little each, so the race still reads first.
const KIN_TOOLS = ['', 'staff', 'basket', 'book', 'lantern', 'hoe', 'bow', 'ladle', 'axe', 'quill', 'bucket', 'flask', 'lute', 'shovel', 'hammer'];
const KIN_HAIR = ['short', 'long', 'braid', 'bun', 'ponytail', 'tied', 'curly', 'cropped'];
const KIN_HAIR_FEM = ['long', 'braid', 'bun', 'ponytail', 'tied', 'curly'];
const KIN_BEARD = ['', 'short', 'stubble', 'moustache', 'braided', 'long'];
const KIN_OUTFIT = ['tunic', 'leather', 'apron', 'cape', 'robe', 'miner'];
const KIN_HAT = ['', '', '', 'cap', 'hood', 'bandana', 'straw'];
/** A hair colour near the race's own: one of the plain ones the people of this world have, mixed with the race colour so a fair race stays fair. */
const KIN_HAIR_COLOR = ['#2a1c14', '#4a3020', '#6a4a2a', '#8a6a3a', '#b08a4a', '#a0522d', '#1a1a1e'];

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
  const young = o.stage === 'infant' || o.stage === 'child';
  // what the docs say the race wears and does (02-races.md เครื่องแต่ง and หน้าและผิว, read into the race row): clothes and their colours, a hat,
  // the hair, the beard its men wear, a thing carried by habit; the young have no hat, no beard and carry nothing
  // people of the peoples whose looks are not fixed by a coat or a body (not the beast people, the dolls, the spirits) differ by their own seed
  const kin = KIN_RACES.has(race) && !hairless;
  const hh = (w: string): number => hash(`${key}:${w}`);
  const raceHair = (o.fem ? R.hairFem : R.hair) || (o.fem ? 'long' : 'short');
  const kinHair = (o.fem ? KIN_HAIR_FEM : KIN_HAIR)[hh('hair') % (o.fem ? KIN_HAIR_FEM.length : KIN_HAIR.length)];
  const hair = hairless ? '' : (ln && LINE_HAIR[ln.name]) || (kin && hh('hairpick') % 4 !== 0 ? kinHair : raceHair);
  const baseHair = ov?.hairColor ?? (o.stage === 'elder' ? ELDER_GREY : R.hairColor || '#3a2a20');
  const hairColor = kin && o.stage !== 'elder' ? mix(baseHair, KIN_HAIR_COLOR[hh('hc') % KIN_HAIR_COLOR.length], 0.5) : baseHair;
  const baseBeard = o.fem || hairless || young || o.stage === 'teen' ? '' : R.beard;
  const beard = kin && !o.fem && !young && o.stage !== 'teen' && !hairless ? (hh('beardpick') % 3 === 0 ? R.beard : KIN_BEARD[hh('beard') % KIN_BEARD.length]) : baseBeard;
  const tool = young ? '' : kin && hh('toolpick') % 4 !== 0 ? KIN_TOOLS[hh('tool') % KIN_TOOLS.length] : R.tool;
  const hat = young ? '' : kin && hh('hatpick') % 2 === 0 ? KIN_HAT[hh('hat') % KIN_HAT.length] : R.hat;
  // the clothes keep the race's colours, a step toward a family member's own
  const main = kin ? mix(R.main, KIN_HAIR_COLOR[hh('main') % KIN_HAIR_COLOR.length], 0.3) : R.main;
  const outfit = kin && !young && hh('outfitpick') % 3 === 0 ? KIN_OUTFIT[hh('outfit') % KIN_OUTFIT.length] : R.outfit || 'tunic';
  return {
    kind: 'person', key, race, ...(ln ? { line: ln.name } : {}), stage: o.stage, fem: o.fem,
    body: { ...asBody(R.body), scale: ov?.scale ?? R.body.scale, ears: ov?.ears ?? R.body.ears },
    skin: ov?.skin ?? pick(R.skins, key), hairColor, eye: ov?.eye ?? '#2a2024',
    accent: ov?.accent ?? R.accents[0], main, second: R.second,
    outfit, hair, hat,
    beard, tool, feats: [...(ov?.feats ?? R.feats)], wear: 0,
  };
}
