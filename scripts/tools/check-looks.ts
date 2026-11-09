// npm run check:looks   (code-plan §9.3, docs/appearance/README.md rule 5: one person differs from the neighbours by one thing seen from afar)
// Resolves the Look of every NPC and ally successor, paints the idle frame 0 of each with the person painter and checks, per country:
//   1. SIGNATURE   the Look signature (race line stage outfit main-colour hair hat held-thing pose) is unique in the whole world;
//   2. SILHOUETTE  the shape of the idle frame (the filled cells of the 56 x 56 art grid, ground shadow left out) differs from every other
//                  person of the same country by at least SILHOUETTE_MIN: the cells that one figure fills and the other does not, as a share of
//                  the cells of the larger figure ("figure" basis, the default) or of the whole 3136-cell grid (`--basis=grid`, the literal reading
//                  of the plan; a figure fills only 12% of the grid, so on this basis 88% of all pairs fail and the report says nothing);
//   3. COLOUR      the main clothes colour is at least COLOUR_MIN apart (CIE76 delta E, in L*a*b* under D65) from every other person of the country.
// A successor sits in the country of the person it succeeds, and the pair (original, own successor) is not compared: they are meant to read as one line.
// Also lists the people whose Look came mostly from the generator's defaults (UNDERSPECIFIED_MIN or more of the 5 fields outfit hair hairColor eye skin).
// Writes the whole pair list to review/m6/check-looks.md. Exit code 1 when any check fails. Pure Node: no DOM, no network, no LLM.
//
// Thresholds (state them in every report):
//   SILHOUETTE_MIN = 0.08  the code plan's "start with 8% of the pixels", of the larger figure (a median figure is 367 cells, so 8% is 29 cells)
//   COLOUR_MIN     = 12    CIE76 delta E: a difference a viewer sees between two flat patches at a glance (about 2.3 is the just-noticeable
//                          difference; 12 is the gap between two named shades of one hue, e.g. a dark and a mid green)
// A pair FAILS when it fails the silhouette check or the colour check or both; the pairs that fail both are listed first (nothing tells the two
// apart from afar, the first to fix). Exit code 1 when a signature repeats or any pair fails.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PersonLook } from '../../src/art/look';
import type { Frame } from '../../src/art/paint';
import { paintPerson } from '../../src/art/person';
import { npcLook, successorLook } from '../../src/art/resolve';
import type { LooksData } from '../../src/core/data/types-looks';
import { genDir, root } from '../codegen/lib/table';

export const SILHOUETTE_MIN = 0.08;
export const COLOUR_MIN = 12;
export const UNDERSPECIFIED_MIN = 3;
/** A pixel with at least this alpha belongs to the figure (the ground shadow is 70, a ghost's tail 102, the outline 255). */
export const ALPHA_MIN = 90;

// ── the three measures (pure, tested on small synthetic looks in tests/art/check-looks.test.ts) ───────────────────────────────────────
/** The filled cells of a frame, one byte per cell. */
export function maskOf(f: Frame, minAlpha = ALPHA_MIN): Uint8Array {
  const m = new Uint8Array(f.w * f.h);
  for (let i = 0; i < m.length; i++) if (f.data[i * 4 + 3] >= minAlpha) m[i] = 1;
  return m;
}
export type Basis = 'figure' | 'grid';
/** The cells that one figure fills and the other does not (0 = the same shape). */
export function silhouetteCells(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}
export const areaOf = (a: Uint8Array): number => a.reduce((n, v) => n + v, 0);
/** The share of the larger figure's cells (`figure`) or of the whole grid (`grid`) in which exactly one of the two figures is filled. */
export function silhouetteDiff(a: Uint8Array, b: Uint8Array, basis: Basis = 'figure'): number {
  const n = silhouetteCells(a, b);
  return n / (basis === 'grid' ? a.length : Math.max(1, areaOf(a), areaOf(b)));
}
const lin = (v: number): number => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** `#rrggbb` to CIE L*a*b* (D65). */
export function labOf(hex: string): [number, number, number] {
  const r = lin(parseInt(hex.slice(1, 3), 16)), g = lin(parseInt(hex.slice(3, 5), 16)), b = lin(parseInt(hex.slice(5, 7), 16));
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** CIE76: the distance between two colours in L*a*b*. */
export function deltaE(a: string, b: string): number {
  const A = labOf(a), B = labOf(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
/** The Look signature: what a viewer reads of a person at once (race line stage outfit main colour hair hat held thing pose). */
export function signatureOf(L: PersonLook, pose = ''): string {
  return JSON.stringify([L.race, L.line ?? '', L.stage, L.outfit, L.main.toLowerCase(), L.hair, L.hat, L.tool, pose]);
}
/** A short hash of a signature, for the report. */
export function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).padStart(7, '0');
}

// ── the check ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Entry {
  id: string;
  kind: 'npc' | 'successor';
  country: string;
  continent: string;
  /** the NPC this person succeeds (successors only) */
  of?: string;
  name: string;
  look: PersonLook;
  pose: string;
  defaults: string[];
}
export interface Pair {
  country: string;
  continent: string;
  a: string;
  b: string;
  /** share (of the chosen basis) in which exactly one of the two is filled */
  silhouette: number;
  /** the same cells as a share of the whole 56 x 56 grid, for the report */
  silhouetteGrid: number;
  /** CIE76 distance of the main colours */
  colour: number;
  failSilhouette: boolean;
  failColour: boolean;
}
export interface Result {
  entries: Entry[];
  signatures: { signature: string; hash: string; ids: string[] }[];
  /** every pair of one country that fails at least one measure */
  pairs: Pair[];
  /** the pairs that fail both: they cannot be told apart from afar */
  confusable: Pair[];
  /** the ten pairs of one country nearest to each other whether they fail or not (shape first, then colour), for the report */
  nearest: Pair[];
  underspecified: Entry[];
  pairCount: number;
  /** the measure of every compared pair (not only the failing ones), for the percentile table of the report */
  dist: { silhouette: number[]; silhouetteGrid: number[]; colour: number[] };
}

export interface Opts { silhouetteMin?: number; colourMin?: number; underspecifiedMin?: number; basis?: Basis; frame?: (L: PersonLook) => Frame }

/** The check on a list of entries (no files, no painting beyond `opts.frame`, so tests can feed small synthetic looks). */
export function checkEntries(entries: Entry[], opts: Opts = {}): Result {
  const sMin = opts.silhouetteMin ?? SILHOUETTE_MIN, cMin = opts.colourMin ?? COLOUR_MIN, uMin = opts.underspecifiedMin ?? UNDERSPECIFIED_MIN;
  const paint = opts.frame ?? ((L: PersonLook) => paintPerson(L, 'idle', 0));
  const masks = new Map(entries.map((e) => [e.id, maskOf(paint(e.look))]));
  // 1. the signatures
  const bySig = new Map<string, string[]>();
  for (const e of entries) {
    const s = signatureOf(e.look, e.pose);
    bySig.set(s, [...(bySig.get(s) ?? []), e.id]);
  }
  const signatures = [...bySig.entries()].filter(([, ids]) => ids.length > 1).map(([signature, ids]) => ({ signature, hash: shortHash(signature), ids }));
  // 2 and 3. the pairs of one country
  const byCountry = new Map<string, Entry[]>();
  for (const e of entries) byCountry.set(e.country, [...(byCountry.get(e.country) ?? []), e]);
  const pairs: Pair[] = [], confusable: Pair[] = [], nearest: Pair[] = [];
  const closeness = (p: Pair): number => p.silhouette + p.colour / 100;
  let pairCount = 0;
  const dist: Result['dist'] = { silhouette: [], silhouetteGrid: [], colour: [] };
  for (const [country, list] of byCountry)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        if (A.of === B.id || B.of === A.id) continue;
        pairCount++;
        const ma = masks.get(A.id)!, mb = masks.get(B.id)!;
        const silhouette = silhouetteDiff(ma, mb, opts.basis ?? 'figure'), silhouetteGrid = silhouetteDiff(ma, mb, 'grid'), colour = deltaE(A.look.main, B.look.main);
        dist.silhouette.push(silhouette); dist.silhouetteGrid.push(silhouetteGrid); dist.colour.push(colour);
        const failSilhouette = silhouette < sMin, failColour = colour < cMin;
        const p: Pair = { country, continent: A.continent, a: A.id, b: B.id, silhouette, silhouetteGrid, colour, failSilhouette, failColour };
        nearest.push(p);
        if (nearest.length > 40) { nearest.sort((x, y) => closeness(x) - closeness(y)); nearest.length = 10; }
        if (!failSilhouette && !failColour) continue;
        pairs.push(p);
        if (failSilhouette && failColour) confusable.push(p);
      }
  const underspecified = entries.filter((e) => e.defaults.length >= uMin);
  nearest.sort((x, y) => closeness(x) - closeness(y)); nearest.length = Math.min(nearest.length, 10);
  return { entries, signatures, pairs, confusable, nearest, underspecified, pairCount, dist };
}

/** An exit code of 1 when a signature repeats or any pair of one country is too close in shape or in colour. */
export const failed = (r: Result): boolean => r.signatures.length > 0 || r.pairs.length > 0;

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function loadEntries(looks: LooksData): Entry[] {
  const out: Entry[] = [];
  for (const [id, row] of Object.entries(looks.npcs))
    out.push({ id, kind: 'npc', country: row.country, continent: row.continent, name: row.name, look: npcLook(looks, id), pose: row.pose, defaults: row.defaults });
  for (const [id, row] of Object.entries(looks.successors)) {
    const proto = looks.npcs[row.of];
    out.push({ id, kind: 'successor', country: proto?.country ?? '?', continent: proto?.continent ?? '?', of: row.of, name: row.name, look: successorLook(looks, id), pose: row.pose, defaults: row.defaults });
  }
  return out;
}

// ── the report ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const kinds = (p: Pair): string => [p.failSilhouette ? 'เงาร่าง' : '', p.failColour ? 'สีหลัก' : ''].filter(Boolean).join('+');

function count<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function summary(r: Result, basis: Basis = 'figure'): string[] {
  const names = new Map(r.entries.map((e) => [e.id, e]));
  const L: string[] = [];
  L.push(`check:looks  ${r.entries.length} คน (${r.entries.filter((e) => e.kind === 'npc').length} NPC, ${r.entries.filter((e) => e.kind === 'successor').length} ผู้สืบ)  ${r.pairCount} คู่ในประเทศเดียวกัน`);
  L.push(`เกณฑ์: เงาร่างต่างกันอย่างน้อย ${pct(SILHOUETTE_MIN)} ของ${basis === 'grid' ? 'ตาราง 56×56 ทั้งตาราง' : 'ช่องของรูปที่ใหญ่กว่า'} · สีหลักห่างกันอย่างน้อย ΔE76 ${COLOUR_MIN} · ตกข้อใดข้อหนึ่ง = ไม่ผ่าน (ตกทั้งสองข้อแก้ก่อน)`);
  L.push(`ลายเซ็นซ้ำ: ${r.signatures.length} ลาย (${r.signatures.reduce((n, s) => n + s.ids.length, 0)} คน)`);
  L.push(`คู่ที่ตกเงาร่าง: ${r.pairs.filter((p) => p.failSilhouette).length}  ตกสีหลัก: ${r.pairs.filter((p) => p.failColour).length}  ตกทั้งสอง (แยกไม่ออกจากไกล): ${r.confusable.length}`);
  L.push('ต่อทวีป (คู่ที่ตก):  เงาร่าง · สีหลัก · ทั้งสอง');
  for (const c of [...new Set(r.entries.map((e) => e.continent))].sort()) {
    const ps = r.pairs.filter((p) => p.continent === c);
    L.push(`  ${c}: ${ps.filter((p) => p.failSilhouette).length} · ${ps.filter((p) => p.failColour).length} · ${ps.filter((p) => p.failSilhouette && p.failColour).length}`);
  }
  L.push(`NPC ที่เอกสารระบุไม่พอ (ค่าเริ่มต้น ${UNDERSPECIFIED_MIN} ใน 5 ช่องขึ้นไป): ${r.underspecified.filter((e) => e.kind === 'npc').length} NPC, ${r.underspecified.filter((e) => e.kind === 'successor').length} ผู้สืบ`);
  const worst = r.confusable.length ? [...r.confusable].sort((a, b) => a.silhouette + a.colour / 100 - (b.silhouette + b.colour / 100)).slice(0, 10) : r.nearest;
  L.push(r.confusable.length ? 'คู่ที่ตกทั้งสองข้อ (ใกล้ที่สุด 10 คู่):' : 'คู่ที่ใกล้ที่สุด 10 คู่:');
  for (const p of worst) L.push(`  ${p.country} ${p.a} ${names.get(p.a)!.name} ~ ${p.b} ${names.get(p.b)!.name}  เงา ${pct(p.silhouette)}  สี ΔE ${p.colour.toFixed(1)}`);
  return L;
}

export function report(r: Result, basis: Basis = 'figure'): string {
  const names = new Map(r.entries.map((e) => [e.id, e]));
  const L: string[] = [];
  L.push('# check:looks', '', '(สร้างโดย `npm run check:looks` ห้ามแก้มือ; code-plan §9.3, appearance/README.md ข้อ 5)', '');
  L.push('```', ...summary(r, basis), '```', '');
  L.push('## ลายเซ็นซ้ำ', '');
  if (!r.signatures.length) L.push('ไม่มี', '');
  else {
    L.push('| แฮช | คน | ลายเซ็น (เผ่า สาย วัย ชุด สีหลัก ผม หมวก ของถือ ท่า) |', '| --- | --- | --- |');
    for (const s of r.signatures) L.push(`| ${s.hash} | ${s.ids.map((i) => `${i} ${names.get(i)!.name}`).join(' · ')} | \`${s.signature.replace(/\|/g, '\\|')}\` |`);
    L.push('');
  }
  const pc = (a: number[], p: number, f: (v: number) => string) => f([...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0);
  L.push('## ตัวเลขของเกณฑ์', '', 'ค่าของทุกคู่ในประเทศเดียวกัน (ไม่ใช่เฉพาะคู่ที่ตก) ไว้ปรับเกณฑ์', '', '| ค่า | 5% | 10% | 25% | 50% | 75% | เกณฑ์ | คู่ที่ต่ำกว่าเกณฑ์ |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  const row = (name: string, a: number[], f: (v: number) => string, min: number) =>
    `| ${name} | ${[0.05, 0.1, 0.25, 0.5, 0.75].map((p) => pc(a, p, f)).join(' | ')} | ${f(min)} | ${a.filter((v) => v < min).length} |`;
  L.push(row(`เงาต่าง (ของรูปที่ใหญ่กว่า${basis === 'figure' ? ', ที่ใช้ตัดสิน' : ''})`, r.dist.silhouette, pct, SILHOUETTE_MIN));
  L.push(row(`เงาต่าง (ของตาราง 56×56${basis === 'grid' ? ', ที่ใช้ตัดสิน' : ''})`, r.dist.silhouetteGrid, pct, SILHOUETTE_MIN));
  L.push(row('สีหลัก ΔE76', r.dist.colour, (v) => v.toFixed(1), COLOUR_MIN), '');
  L.push('## ต่อประเทศ', '', '| ประเทศ | คน | คู่ที่ตกเงาร่าง | คู่ที่ตกสีหลัก | ตกทั้งสอง |', '| --- | --- | --- | --- | --- |');
  for (const c of [...new Set(r.entries.map((e) => e.country))].sort()) {
    const ps = r.pairs.filter((p) => p.country === c);
    if (ps.length) L.push(`| ${c} | ${r.entries.filter((e) => e.country === c).length} | ${ps.filter((p) => p.failSilhouette).length} | ${ps.filter((p) => p.failColour).length} | ${ps.filter((p) => p.failSilhouette && p.failColour).length} |`);
  }
  L.push('');
  const conf = new Set(r.confusable);
  const section = (title: string, list: Pair[]) => {
    L.push(`## ${title}`, '');
    if (!list.length) { L.push('ไม่มี', ''); return; }
    L.push(`${list.length} คู่`, '', '| ประเทศ | A | B | ตก | เงาต่าง | (ของตาราง) | สี ΔE |', '| --- | --- | --- | --- | --- | --- | --- |');
    const sorted = [...list].sort((a, b) => a.country.localeCompare(b.country) || a.silhouette - b.silhouette || a.a.localeCompare(b.a));
    for (const p of sorted) L.push(`| ${p.country} | ${p.a} ${names.get(p.a)!.name} | ${p.b} ${names.get(p.b)!.name} | ${kinds(p)} | ${pct(p.silhouette)} | ${pct(p.silhouetteGrid)} | ${p.colour.toFixed(1)} |`);
    L.push('');
  };
  section('คู่ที่ตกทั้งเงาร่างและสีหลัก (แยกไม่ออกจากไกล)', r.confusable);
  section('คู่ที่ตกเงาร่างอย่างเดียว', r.pairs.filter((p) => p.failSilhouette && !conf.has(p)));
  section('คู่ที่ตกสีหลักอย่างเดียว', r.pairs.filter((p) => p.failColour && !conf.has(p)));
  L.push('## คนที่เอกสารระบุไม่พอ', '', `ช่องที่ตัวสร้างเติมจากค่าเริ่มต้น (ชุด ผม สีผม สีตา สีผิว; ผู้สืบอาจมีสีชุดด้วย) ${UNDERSPECIFIED_MIN} ช่องขึ้นไป ให้ subagent เขียนค่า UI เพิ่มในเอกสาร`, '');
  L.push('| ประเทศ | รหัส | ชื่อ | ช่องที่เติม |', '| --- | --- | --- | --- |');
  for (const e of [...r.underspecified].sort((a, b) => a.country.localeCompare(b.country) || a.id.localeCompare(b.id))) L.push(`| ${e.country} | ${e.id} | ${e.name} | ${e.defaults.join(' ')} |`);
  L.push('');
  return L.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const looks = (JSON.parse(readFileSync(path.join(genDir, 'looks.json'), 'utf8')) as { items: LooksData }).items;
  const basis: Basis = process.argv.includes('--basis=grid') ? 'grid' : 'figure';
  const r = checkEntries(loadEntries(looks), { basis });
  const out = path.join(root, 'review/m6/check-looks.md');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, report(r, basis));
  console.log(summary(r, basis).join('\n'));
  console.log(`\nรายการเต็ม: ${path.relative(root, out)}`);
  if (failed(r)) process.exit(1);
}
