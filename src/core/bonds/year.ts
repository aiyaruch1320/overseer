// A life year of the ties: death of a person, contact and silence (bonds/01 §2.1), moods, stories, changes of line, the party, the caps.
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { arcsYear } from './arcs';
import { closeKin, familyYear } from './family';
import { linesYear, partyYear } from './invites';
import { pairsYear } from './items';
import { moodYear, showMood } from './moods';
import { amongYear, rosterYear, schoolYear } from './sources';
import { bondsIndex } from './data';
import { changeB, endTie, hAgeOf, isChild, isPartner, personAlive } from './people';
import { holderPlace, rowOf, slotOf } from './npcs';
import { closeTies, extOf, isLive, levelOf, looseTies, reindex, tiesOf, type BondsExt, type Tie } from './state';
import { ADVENTURING, CONTACT, FADE_AFTER, LETTER_GAP, HOUSE_KIN, HOUSE_UNTIL, NO_FADE_LINES, UNTIMELY } from './tuning';

const CAUSES = [{ id: 'illness', w: 5 }, { id: 'accident', w: 3 }, { id: 'violence', w: 2 }];

function die(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, cause: string): void {
  const lv = levelOf(ctx, t);
  endTie(ctx, t, 'death', 'ตาย', { cause });
  const near = isPartner(t) || isChild(t);
  // a child's death is told to the parent whatever the bond was, after the funeral or the news (a feeling may be held back by the limits of 02 §4; the grief of a parent is not)
  const grief = () => {
    if (isChild(t)) write(ctx.state, { sys: 'bonds', kind: 'grief', id: t.id, data: { name: t.name, kin: t.kin ?? null, gender: t.gender, age: Math.round(hAgeOf(ctx, t)), cause }, level: 2 });
  };
  if (lv < 2) return grief();
  // the grief (02 §1 "เสียใจ") and the funeral scene: a full scene at most once in 15 life years, the rest are news (01 §6)
  showMood(ctx, life, t, 'เสียใจ', `${t.name} ตาย`);
  if (lv >= 3) {
    if (life.hAge - e.funeralAt >= 15) {
      e.funeralAt = life.hAge;
      e.funerals++;
      write(ctx.state, { sys: 'bonds', kind: 'funeral', id: t.id, data: { name: t.name, line: t.line, cause, level: lv, kin: t.kin ?? null, age: Math.round(hAgeOf(ctx, t)), partner: isPartner(t) }, level: 2 });
    } else {
      e.counts.news++;
      // the news of the death of a lover, a life partner or a child is a mark of the life (level 2); of the others, level 1
      write(ctx.state, { sys: 'bonds', kind: 'news', id: t.id, data: { name: t.name, line: t.line, text: `${t.name} จากไป (${cause})`, kind: 'death', kin: t.kin ?? null, age: Math.round(hAgeOf(ctx, t)), partner: isPartner(t), spouse: !!t.spouse, gender: t.gender }, level: near ? 2 : 1 });
    }
    if (lv >= 4) showMood(ctx, life, t, 'เหงา', `${t.name} ตาย`);
  }
  grief();
}

/** A person grows old and dies; a roster position whose holder died or was replaced loses its tie. */
function deaths(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.death');
  for (const t of tiesOf(e)) {
    if (!isLive(t)) continue;
    if (t.npc) {
      if (!personAlive(ctx, t)) die(ctx, life, e, t, slotOf(ctx, t.npc)?.cause ?? 'ตาย');
      continue;
    }
    const age = hAgeOf(ctx, t);
    if (age >= t.dieAge) die(ctx, life, e, t, 'old');
    else if (age >= UNTIMELY.fromAge && rng.chance(UNTIMELY.perYear)) die(ctx, life, e, t, CAUSES[Math.max(0, rng.weighted(CAUSES.map((c) => c.w)))].id);
  }
}

function sameContinent(a: string, b: string): boolean {
  return a.slice(0, 2) === b.slice(0, 2);
}

/** Meeting, letters and silence (01 §2.1; 03 §4: same country meets, other countries write, far news is late, a war shuts the road). */
export function contact(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.contact');
  const ix = bondsIndex(ctx);
  const ch = ix.data.ties.bChanges;
  const meet = ch.find((c) => c.id === 'meet')?.delta ?? 3;
  const sil = ch.find((c) => c.id === 'silentSame');
  const far = ch.find((c) => c.id === 'silentFar');
  // letters that were on the road arrive; at most one is told in a year, the others are kept as a mark of contact
  let told = false;
  e.mail = e.mail.filter((m) => {
    if (m.due > life.hAge) return true;
    const t = e.ties[m.tie];
    if (t && isLive(t)) {
      t.last = life.hAge;
      // a letter is told once in a few years for the same person; the others only mark the contact (615 told eight identical letters)
      if (!told && levelOf(ctx, t) >= 2 && life.hAge - (t.letterAt ?? -99) >= LETTER_GAP) {
        told = true;
        t.letterAt = life.hAge;
        e.counts.news++;
        write(ctx.state, { sys: 'bonds', kind: 'letter', id: t.id, data: { name: t.name, line: t.line, from: t.country, kin: t.kin ?? null }, level: 1 });
      }
    }
    return false;
  });
  for (const t of tiesOf(e)) {
    if (!isLive(t)) continue;
    if (t.npc) {
      const slot = slotOf(ctx, t.npc);
      if (slot) t.country = holderPlace(slot, rowOf(ctx, t.npc));
    }
    const closed = ctx.state.world.countryFlags[t.country]?.includes('war') && t.country !== life.country;
    let met = false;
    if (t.country === life.country) {
      const house = !!t.kin && HOUSE_KIN.has(t.kin);
      const p = house ? (life.hAge < HOUSE_UNTIL ? CONTACT.house : CONTACT.houseAdult) : t.light ? CONTACT.distantKin : t.line === 'คนรัก' ? CONTACT.lover : t.line === 'คู่หู' ? CONTACT.partner : CONTACT.sameCountry;
      met = rng.chance(p);
    }
    else if (!closed && sameContinent(t.country, life.country)) {
      if (rng.chance(CONTACT.sameContinent)) t.last = life.hAge;
    } else if (!closed && rng.chance(CONTACT.otherContinent)) {
      // news from another continent arrives one to three years late (03 §4)
      e.mail.push({ tie: t.id, due: life.hAge + rng.int(ix.data.formation.news.otherContinentDelay[0], ix.data.formation.news.otherContinentDelay[1]), text: '' });
    }
    if (met) {
      t.last = life.hAge;
      changeB(ctx, t, meet, 'meet');
    } else if (life.hAge - t.last > (sil?.silentYears ?? 3)) {
      const c = t.country === life.country || sameContinent(t.country, life.country) ? sil : far;
      changeB(ctx, t, c?.delta ?? -1, 'silent');
    }
  }
}

/** A person another owner holds is let go sometimes once his third stage has passed (bonds/03 §2: the fourth stage opens only after he is free). */
function boundYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.bound');
  for (const t of tiesOf(e)) {
    if (!isLive(t) || !t.bound || !t.arc || t.arc.stage < 3) continue;
    if (rng.chance(0.12)) freeTie(ctx, life, e, t, 'owner');
  }
}

/** A bound person is free: the lid of level 3 is lifted and he owes the one who freed him (03 §2). */
export function freeTie(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, how: string): void {
  if (!t.bound) return;
  t.bound = undefined;
  write(ctx.state, { sys: 'bonds', kind: 'freed', id: t.id, data: { name: t.name, how }, level: 1 });
  reindex(e);
}

/** Over the cap, the lowest and farthest tie fades (01 §2): the partner and the children do not. */
export function caps(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rule = bondsIndex(ctx).data.ties.caps;
  const fadeable = (list: Tie[]) => list.filter((t) => !NO_FADE_LINES.has(t.line) && t.line !== 'คนรัก' && !t.spouse).sort((a, b) => a.b - b.b || a.last - b.last);
  for (let n = 0; n < 20 && closeTies(ctx, e).length > rule.close; n++) {
    const t = fadeable(closeTies(ctx, e))[0];
    if (!t) break;
    endTie(ctx, t, 'fade', 'เกินเพดานสายสนิท');
  }
  for (let n = 0; n < 20 && looseTies(ctx, e).length > rule.loose; n++) {
    const t = fadeable(looseTies(ctx, e))[0];
    if (!t) break;
    endTie(ctx, t, 'fade', 'เกินเพดานสายห่าง');
  }
  // a loose tie nobody has written to or seen for years drops out of the book as news stops (assumption of tuning FADE_AFTER)
  // (a life partner does not drop out of the book for silence: he leaves by a split or a death, each told as a line of its own)
  for (const t of looseTies(ctx, e)) if (!t.spouse && life.hAge - t.last > FADE_AFTER + 6 && t.b < 10) endTie(ctx, t, 'fade', 'ห่างจนไม่มีข่าว');
}

/** The party of travellers is asked for while the character goes to war or on the road: by his job or by a journey line he walks. */
function adventuring(ctx: Ctx, life: LifeState): boolean {
  if (life.job && ADVENTURING.has(life.job)) return true;
  const ex = life.ext.story as { open?: Record<string, boolean> } | undefined;
  return !!ex?.open && ['ml', 'ex', 'wd', 'sf', 'xc', 'ps'].some((l) => ex.open![l]);
}

/** One life year of the whole book of ties. */
export function lifeYear(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  reindex(e);
  deaths(ctx, life, e);
  contact(ctx, life, e);
  moodYear(ctx, life, e);
  arcsYear(ctx, life, e);
  boundYear(ctx, life, e);
  // the node kn.b1 (age 5 to 14) usually gives the close kin first; this is the fallback, once
  if (life.hAge >= 13) closeKin(ctx, life);
  schoolYear(ctx, life, e);
  rosterYear(ctx, life, e);
  linesYear(ctx, life, e);
  partyYear(ctx, life, e, adventuring(ctx, life));
  amongYear(ctx, life, e);
  familyYear(ctx, life, e);
  pairsYear(ctx, life, e);
  caps(ctx, life, e);
  reindex(e);
}
