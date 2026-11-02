// The people of the character when a large miracle falls on a country (M4 review G1): who is at risk, shown before he chooses; who died or came to him,
// told after. The dice themselves are rolled in people.ts (rollPeople); this file only reads and tells.
import type { Ctx } from '../../game';
import { say } from '../acts/record';
import { livingOf } from '../acts/state';
import { godOf } from '../acts/geo';
import { peopleHere, relOf, REL_TH, type Fates } from './people';

/** The preview lines for the people of the character in the country, and for the character himself. `allyDie` is the percent each ally dies. */
export function kinNotes(ctx: Ctx, country: string, allyDie: number): string[] {
  const here = peopleHere(ctx, country);
  const out: string[] = [
    here.length
      ? `คนของตัวละครในเมืองนี้: ${here.map((t) => `${REL_TH[relOf(t)]} ${t.name}`).join(' · ')} — แต่ละคนตายได้ ${allyDie}% ที่รอดหนีมาหาเขา`
      : 'คนของตัวละครในเมืองนี้: ไม่มี',
  ];
  const life = livingOf(ctx);
  if (life && life.country === country) {
    const n = godOf(ctx).miracles.ruin.numbers;
    out.push(`ตัวละครเองอยู่ที่นี่ รอดเสมอ แต่อาจบาดเจ็บถาวร · คำสาปบ้านเกิด ${n.mcCurse.chance}% · ศรัทธาเทพ ${n.mcBelief}`);
  }
  return out;
}

/** After the dice: a line for each person of his who died (a mark of the life for a child or a partner) or who came to him, and one for the character if he stood there. */
export function tellKin(ctx: Ctx, country: string, fates: Fates): void {
  for (const k of fates.kin) {
    const near = k.rel !== 'ally';
    if (k.fate === 'came' && !near) continue;
    say(ctx, { kind: 'ruin', id: 'kin', data: { country, name: k.name, rel: k.rel, fate: k.fate }, level: k.fate === 'died' ? (near ? 2 : 1) : 1 });
  }
  if (fates.main) say(ctx, { kind: 'ruin', id: 'main', data: { country }, level: 2 });
}
