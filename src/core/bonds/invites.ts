// Invitations (docs/systems/bonds/03-formation.md §3), the changes of line (01 §4) and the party of travellers (01 §3).
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { bondsIndex } from './data';
import { grantPair } from './items';
import { changeB, hAgeOf, setLine, setB } from './people';
import { showMood } from './moods';
import { closeTies, extOf, isLive, levelOf, reindex, tiesOf, type BondsExt, type Tie } from './state';
import { ASK_BUSINESS, ASK_LOVER, ASK_SPOUSE, FRIEND_TO_PARTNER, LOVER_FROM, PARTY_YEARS, PAIR_ITEM_SOURCES, RIVAL_TO_FRIEND, STUDENT_TO_FRIEND } from './tuning';

export type InviteKind = 'travel' | 'business' | 'lover' | 'spouse' | 'mentor' | 'student' | 'reconcile';

const KIND_ID: Record<InviteKind, string> = { travel: 'travel', business: 'business', lover: 'lover', spouse: 'spouse', mentor: 'mentor', student: 'student', reconcile: 'reconcile' };

/** The war flag shuts the road between countries (03 §4: "เส้นทางถูกปิดโดยสงคราม"). */
function roadClosed(ctx: Ctx, a: string, b: string): boolean {
  const f = ctx.state.world.countryFlags;
  return !!(f[a]?.includes('war') || f[b]?.includes('war'));
}

/**
 * The chance the other side says yes, in percent (03 §3): 15 + 0.7 × B + fit − burden, held between 5 and 95.
 * Pure: the fear of an enemy (−15 for a journey to fight what he fears) is passed in, not rolled here.
 */
export function inviteChance(ctx: Ctx, life: LifeState, t: Tie, opt: { feared?: boolean } = {}): number {
  const rule = bondsIndex(ctx).data.formation.inviteChance;
  let fit = 0;
  const arc = t.arc;
  if (arc && !arc.end && arc.stage >= 2 && arc.stage !== 3) fit += rule.compat[0].delta;
  if (t.rapport) fit += rule.compat[1].delta;
  if (t.gratitude >= bondsIndex(ctx).data.ties.npcAxes.gratitudeMin) fit += rule.compat[2].delta;
  let burden = 0;
  if (!t.gate) {
    if (arc && !arc.end && arc.stage === 3) burden += -rule.burden[0].delta;
    if (t.family) burden += -rule.burden[1].delta;
    if (t.country.slice(0, 2) !== life.country.slice(0, 2) && roadClosed(ctx, t.country, life.country)) burden += -rule.burden[2].delta;
    if (opt.feared) burden += -rule.burden[3].delta;
  }
  const p = rule.base + rule.perB * t.b + fit - burden;
  return Math.max(rule.min, Math.min(rule.max, p));
}

/** The lowest level of the other side for the kind of invite (03 §3 table); null = the level before the split. */
export function inviteFloor(ctx: Ctx, kind: InviteKind): number | null {
  return bondsIndex(ctx).data.formation.invites.find((i) => i.id === KIND_ID[kind])?.minLevel ?? null;
}

/** May the line become the character's lover (01 §4: both adults, a gap of 20 years at most, no kin, no other lover)? */
export function loverEligible(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie): boolean {
  const rule = bondsIndex(ctx).data.formation.pairing;
  if (life.hAge < LOVER_FROM || !isLive(t) || t.bound || t.kin) return false;
  if (tiesOf(e).some((x) => x.id !== t.id && isLive(x) && x.line === 'คนรัก')) return false;
  const his = hAgeOf(ctx, t);
  if (his < LOVER_FROM || Math.abs(his - life.hAge) > rule.loverMaxAgeGap) return false;
  return t.line === 'สหาย' || t.line === 'คู่หู' || t.line === 'คู่แข่ง' || t.line === 'คนรัก';
}

export interface InviteResult {
  ok: boolean;
  chance: number;
  refusal?: 'plain' | 'condition' | 'hurt';
}

/** The character invites a tie. Rolls the answer and applies what follows. */
export function invite(ctx: Ctx, life: LifeState, t: Tie, kind: InviteKind): InviteResult {
  const e = extOf(life);
  const rng = ctx.rng('bonds.invite');
  const ix = bondsIndex(ctx);
  const feared = kind === 'travel' && rng.chance(0.2);
  const chance = inviteChance(ctx, life, t, { feared });
  e.counts.invites++;
  const ok = rng.chance(chance / 100);
  if (ok) {
    e.counts.accepted++;
    t.gate = false;
    accept(ctx, life, e, t, kind);
    reindex(e);
    write(ctx.state, { sys: 'bonds', kind: 'invite', id: t.id, data: { name: t.name, line: t.line, ask: kind, ok: true, chance: Math.round(chance) }, level: 1 });
    return { ok: true, chance };
  }
  const refusals = ix.data.formation.refusals;
  const r = refusals[Math.max(0, rng.weighted(refusals.map((x) => x.chance)))];
  if (r.id === 'condition') t.gate = true;
  if (r.id === 'hurt') {
    changeB(ctx, t, r.deltaB, 'refused');
    const mood = r.moods.length ? rng.pick(r.moods) : 'ผิดหวัง';
    showMood(ctx, life, t, mood, `ปฏิเสธ ${kind}`);
  }
  write(ctx.state, { sys: 'bonds', kind: 'invite', id: t.id, data: { name: t.name, line: t.line, ask: kind, ok: false, chance: Math.round(chance), refusal: r.id }, level: 1 });
  return { ok: false, chance, refusal: r.id };
}

function accept(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, kind: InviteKind): void {
  const rng = ctx.rng('bonds.invite');
  switch (kind) {
    case 'travel':
      joinParty(ctx, life, e, t);
      break;
    case 'business':
      setLine(ctx, t, 'คู่หู', 'ร่วมกิจการ');
      t.workedWith = life.hAge;
      if (rng.chance(PAIR_ITEM_SOURCES.partner)) grantPair(ctx, life, t, 'PR-02');
      break;
    case 'lover':
      setLine(ctx, t, 'คนรัก', 'ขอเป็นคนรัก');
      showMood(ctx, life, t, 'รัก', 'ขอเป็นคนรัก');
      break;
    case 'spouse':
      t.spouse = true;
      changeB(ctx, t, 4, 'joy');
      showMood(ctx, life, t, 'ยินดี', 'คู่ชีวิต');
      if (rng.chance(PAIR_ITEM_SOURCES.spouse)) grantPair(ctx, life, t, 'PR-05');
      break;
    case 'mentor':
      setLine(ctx, t, 'ครู', 'ขอเป็นครู');
      break;
    case 'student':
      setLine(ctx, t, 'ศิษย์', 'รับเป็นศิษย์');
      break;
    case 'reconcile':
      t.state = 'alive';
      setB(ctx, t, Math.floor(t.peak / 2), 'reconcile');
      break;
  }
}

// ---------- the party ----------

export function joinParty(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie): boolean {
  const max = bondsIndex(ctx).data.ties.party.maxParty;
  if (e.party.includes(t.id)) return true;
  if (e.party.length >= max) return false;
  e.party.push(t.id);
  t.party = life.hAge;
  return true;
}

/** What the party gives to a battle (01 §3): the partner line adds to the roll and cuts damage by level; the totals are capped. */
export function partyEffects(ctx: Ctx): { rollPct: number; cutPct: number; members: string[]; legend: boolean } {
  const life = ctx.state.life;
  if (!life) return { rollPct: 0, cutPct: 0, members: [], legend: false };
  const e = extOf(life);
  const ix = bondsIndex(ctx);
  const rule = ix.data.ties.party;
  const cell = ix.data.ties.lineEffects.filter((x) => x.line === 'คู่หู').find((x) => /ศึก/.test(x.variant ?? ''));
  const by = [0, 0, 0, cell?.lv3.pcts ?? [], cell?.lv4.pcts ?? [], cell?.lv5.pcts ?? []];
  let roll = 0;
  let cut = 0;
  const members = e.party.map((id) => e.ties[id]).filter((t): t is Tie => !!t && isLive(t));
  for (const t of members) {
    if (t.line !== 'คู่หู') continue;
    const lv = levelOf(ctx, t);
    const p = (by[Math.min(5, lv)] ?? []) as number[];
    if (p.length) {
      roll += p[0] ?? 0;
      cut += p[1] ?? 0;
    }
  }
  const legend = members.filter((t) => levelOf(ctx, t) >= rule.legendMinLevel).length >= rule.legendCount;
  return { rollPct: Math.min(rule.bonusCapPct, roll), cutPct: Math.min(rule.damageCutCapPct, cut), members: members.map((t) => t.id), legend };
}

// ---------- the year ----------

/** Yearly changes of line and the invitations the character makes by his nature (rates are assumptions of tuning). */
export function linesYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.invite');
  const ix = bondsIndex(ctx);
  const live = tiesOf(e).filter((t) => isLive(t) && !t.light && !t.bound);
  const near = (t: Tie) => t.country === life.country;
  // a lover (01 §4 row 2): a friend of level 3 or more, once a year at most
  const lov = live.filter((t) => (t.line === 'สหาย' || t.line === 'คู่หู') && levelOf(ctx, t) >= (inviteFloor(ctx, 'lover') ?? 3) && loverEligible(ctx, life, e, t) && near(t));
  if (lov.length && rng.chance(ASK_LOVER)) invite(ctx, life, lov.sort((a, b) => b.b - a.b)[0], 'lover');
  // a life partner (03 §3): a lover of level 4 or more
  const sp = live.find((t) => t.line === 'คนรัก' && !t.spouse && levelOf(ctx, t) >= (inviteFloor(ctx, 'spouse') ?? 4) && near(t));
  if (sp && rng.chance(ASK_SPOUSE)) invite(ctx, life, sp, 'spouse');
  // a business partner: a friend who works beside the character (01 §4 row 3)
  const bz = live.find((t) => t.line === 'สหาย' && levelOf(ctx, t) >= (inviteFloor(ctx, 'business') ?? 2) && near(t) && life.hAge >= 18 && hAgeOf(ctx, t) >= 18);
  if (bz && rng.chance(Math.min(ASK_BUSINESS, FRIEND_TO_PARTNER * 1.2))) invite(ctx, life, bz, 'business');
  // a rival who is accepted becomes a friend (01 §4 row 1; the paired medal does it by itself at level 4)
  for (const t of live) {
    if (t.line === 'คู่แข่ง' && levelOf(ctx, t) >= 3) {
      const medal = e.pairs.some((p) => p.tie === t.id && p.code === 'PR-09' && p.status === 'full') && levelOf(ctx, t) >= 4;
      if (medal || rng.chance(RIVAL_TO_FRIEND)) {
        setLine(ctx, t, 'สหาย', 'ยอมรับกัน');
        if (rng.chance(PAIR_ITEM_SOURCES.rival)) grantPair(ctx, life, t, 'PR-09');
      }
    } else if (t.line === 'ศิษย์' && levelOf(ctx, t) >= 4 && rng.chance(STUDENT_TO_FRIEND)) setLine(ctx, t, 'สหาย', 'ผ่านการทดสอบ');
  }
  // a split is sometimes mended (03 §3 "ขอคืนดี")
  const split = tiesOf(e).find((t) => t.state === 'ended' && t.peak >= 20 && t.grudge < ix.data.ties.npcAxes.grudgeBars);
  if (split && ix.data.ties.endings && rng.chance(0.04)) invite(ctx, life, split, 'reconcile');
}

/** The party: members stay a year, then the character asks again; time together binds (01 §2.1: +4 a year). */
export function partyYear(ctx: Ctx, life: LifeState, e: BondsExt, adventuring: boolean): void {
  const ix = bondsIndex(ctx);
  for (const id of [...e.party]) {
    const t = e.ties[id];
    if (!t || !isLive(t) || !adventuring || t.country !== life.country) {
      e.party = e.party.filter((x) => x !== id);
      if (t) t.party = undefined;
      continue;
    }
    // a member who stays with the party another year needs no new invite (01 §2.1: +4 for a year in the same party)
    if (t.party !== undefined && life.hAge - t.party >= PARTY_YEARS) t.party = life.hAge;
    changeB(ctx, t, ix.data.ties.bChanges.find((c) => c.id === 'party')?.delta ?? 4, 'party');
  }
  if (!adventuring) return;
  const rng = ctx.rng('bonds.invite');
  const pool = closeTies(ctx, e).filter((t) => ['สหาย', 'คู่หู', 'พี่น้อง', 'คนรัก'].includes(t.line) && t.country === life.country && !e.party.includes(t.id) && !t.bound && hAgeOf(ctx, t) >= 16);
  for (const t of pool) if (e.party.length < ix.data.ties.party.maxParty && rng.chance(0.5)) invite(ctx, life, t, 'travel');
}
