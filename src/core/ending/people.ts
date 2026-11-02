// The people and the traces of the card (docs/systems/experience/03-ending-and-collection.md §1 "ผู้คน" "ร่องรอยที่ทิ้งไว้"): who stood by the character, who left before him
// and how, the children, what he leaves behind. Plain lines of Thai made from the bond book at the death; every name is a name of the book (the llm layer may use them).
import type { Ctx } from '../game';
import { extOf as bondsExt, isLive, levelOf, tiesOf, type Tie } from '../bonds';
import type { LifeState } from '../types';
import type { EndingCard } from './types';

const LOST_SHOWN = 3;
const STAY_SHOWN = 3;
const KIDS_SHOWN = 4;
/** A person of the family frame (parents, cousins ...) who was no one of the life does not come to the page; a tie from this level on is somebody (bonds/01 §2). */
const CLOSE_LEVEL = 3;

const names = (list: Tie[], more = (t: Tie) => t.name): string => list.map(more).join(' · ');

/** How the partner stood at the end, in the words of the book. */
function partnerLine(ctx: Ctx, p: Tie, deadAge: number): string {
  if (isLive(p)) return `คู่ชีวิต: ${p.name} อยู่ข้างเขาจนวันสุดท้าย`;
  const way = p.gone?.way;
  const at = p.gone?.age ?? p.died?.age ?? deadAge;
  if (way === 'death' || p.state === 'dead') return `คู่ชีวิต: ${p.name} จากไปก่อนเขา ตอนเขาอายุ ${at}`;
  if (way === 'betray') return `คู่ชีวิต: ${p.name} หักหลังเขาเมื่อเขาอายุ ${at}`;
  if (way === 'split') return `คู่ชีวิต: ${p.name} แยกทางกับเขาเมื่อเขาอายุ ${at}`;
  return `คู่ชีวิต: ${p.name} ห่างกันไปเมื่อเขาอายุ ${at}`;
}

export interface Folk {
  people: string[];
  traces: string[];
  /** Names of the book that the lines hold. */
  names: string[];
  /** Names of the book that no line holds (the neighbours of the life). */
  others: string[];
}

/** The two sections of the card. `heir` and `threads` are the ones the card holds; `mark` is its level of mark on the world. */
export function folkOf(ctx: Ctx, life: LifeState, o: { deadAge: number; titles: string[]; conjured: string[]; mark: EndingCard['mark'] }): Folk {
  const bonds = life.ext.bonds ? bondsExt(life) : undefined;
  const ties = bonds ? tiesOf(bonds) : [];
  const partner = bonds?.partner ? bonds.ties[bonds.partner] : ties.filter((t) => t.line === 'คนรัก').sort((a, b) => b.peak - a.peak)[0];
  const kids = ties.filter((t) => t.kin === 'child' || t.kin === 'adopted').sort((a, b) => (a.born ?? a.opened) - (b.born ?? b.opened));
  const kidsLost = kids.filter((t) => !isLive(t));
  const isKid = (t: Tie) => kids.includes(t);
  const people: string[] = [];
  const used = new Set<string>();
  const use = (...t: Tie[]) => t.forEach((x) => used.add(x.name));

  if (partner) {
    people.push(partnerLine(ctx, partner, o.deadAge));
    use(partner);
  }
  if (kids.length) {
    people.push(`ลูก ${kids.length} คน: ${names(kids.slice(0, KIDS_SHOWN))}${kids.length > KIDS_SHOWN ? ` และอีก ${kids.length - KIDS_SHOWN}` : ''}${kidsLost.length ? ` (จากไปก่อนเขา ${kidsLost.length})` : ''}`);
    use(...kids.slice(0, KIDS_SHOWN));
  }
  // the ones who left before him: death first, then those who turned against him; light family frames are not people of the life
  const real = ties.filter((t) => !isKid(t) && t !== partner && !t.light && Math.max(levelOf(ctx, t), t.peak >= 60 ? CLOSE_LEVEL : 0) >= CLOSE_LEVEL);
  const dead = real.filter((t) => t.gone?.way === 'death' || t.state === 'dead').sort((a, b) => (a.gone?.age ?? 0) - (b.gone?.age ?? 0));
  if (dead.length) {
    people.push(`จากไปก่อนเขา: ${names(dead.slice(0, LOST_SHOWN), (t) => `${t.name} (${t.line}) ตอนเขาอายุ ${t.gone?.age ?? t.died?.age ?? '?'}`)}`);
    use(...dead.slice(0, LOST_SHOWN));
  }
  const broke = real.filter((t) => t.gone && (t.gone.way === 'betray' || t.gone.way === 'split'));
  if (broke.length) {
    people.push(`ขาดจากกัน: ${names(broke.slice(0, LOST_SHOWN), (t) => `${t.name} (${t.line}) ${t.gone!.way === 'betray' ? 'หักหลัง' : 'แยกทาง'}`)}`);
    use(...broke.slice(0, LOST_SHOWN));
  }
  const stay = real.filter((t) => isLive(t) && !t.gone && t !== partner).sort((a, b) => b.peak - a.peak);
  if (stay.length) {
    people.push(`ยังอยู่เมื่อเขาจากไป: ${names(stay.slice(0, STAY_SHOWN), (t) => `${t.name} (${t.line})`)}`);
    use(...stay.slice(0, STAY_SHOWN));
  }

  const traces: string[] = [];
  const things = [life.gold > 0 ? `ทอง ${Math.round(life.gold)}` : '', life.items.length ? `ของ ${life.items.length} ชิ้น` : ''].filter(Boolean);
  if (things.length) traces.push(`ของที่ทิ้งไว้: ${things.join(' · ')}`);
  const world = [o.mark.label, ...(o.titles.length ? [`ฉายา ${o.titles.join(' · ')}`] : []), ...(o.conjured.length ? [`ชื่อที่โลกจำ ${o.conjured.join(' · ')}`] : [])];
  traces.push(`โลกจำได้: ${world.join(' · ')}`);

  return { people, traces, names: [...used], others: ties.map((t) => t.name).filter((n) => !used.has(n)) };
}
