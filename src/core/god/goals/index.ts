// The goals of the player (docs/systems/god/08-goals.md, step G6b of god/06-implementation.md): the vows of the god, the titles of a life, the chronicle of
// the lineage, what it opens, and the rhythm of fate. A life is born with three vows on the table; the player takes one (or none) and may change it once at the
// age stop of 15; when the character dies the vow is judged, the life gets one to three titles, and the chronicle of the lineage grows by one line.
// The numbers that go with the lineage from world to world are in `goalsCarry` / `applyCarry` (carry.ts).
//
// Hooks: birth offers the vows · beat keeps the peak of belief and looks for the sky's hand · lifeYear counts what the vows and titles read · death judges.
// Command: `vow.pick { pick }` (1 to 3 of the vows on the table, 4 or 0 for none).
import { hasAction, onAction } from '../../command';
import type { Ctx, System } from '../../game';
import { onLifeChange } from '../../lineage/carry';
import { write } from '../../log';
import { onNode } from '../../story/walk';
import type { LifeState } from '../../types';
import { tablesOf } from '../../world';
import { homesOf } from '../ruin';
import { lifeChronicle } from '../stats';
import { record } from './chronicle';
import { bondageOf, classOf, factsOf, healJob, rivalsNow } from './facts';
import { armNode, checkRhythm, chooseRhythm, rhythmOf, rhythms, settleNode, yearStep } from './rhythm';
import { goalsOf, lifeGoals, living } from './state';
import { titlesOf } from './titles';
import { ADULT_FROM, CHANGE_AT, UNLOCKS } from './tuning';
import { crossed } from './unlocks';
import { checkPick, judge, missed, offer, previewPick, reoffer, runPick, tellOffer, vowName, vowRow } from './vows';
import { goalsCarry } from './carry';
import { godTitlesOf } from './godtitles';
import './policy';

export * from './carry';
export * from './state';
export { unlocked, unlockedAt, crossed, type Unlocked } from './unlocks';
export { rhythmMul, rhythmOf, rhythms, chooseRhythm, checkRhythm, overreachMul, pullOn } from './rhythm';
export { offer, reoffer, table, judge, missed, MISSED, vowName, vowRow, vowRows, corner, pool, fits, impossible, JUDGE, NO_VOW, checkPick, previewPick, runPick, idOfPick, type VowResult } from './vows';
export { titlesOf, titlesHeld, PRIORITY as TITLE_ORDER, MAX_TITLES } from './titles';
export { factsOf, type Facts } from './facts';
export { gainOf, milestonesOf, lineText } from './chronicle';

// the story tells the goals when it decides a node, so the rhythm and the price of too much help put their pulls on its ways
onNode({ before: (ctx, n) => armNode(ctx, n), after: (ctx) => settleNode(ctx) });

const say = (ctx: Ctx, kind: string, id: string, data: Record<string, string | number | boolean | null>, level: 0 | 1 | 2 | 3 = 1) => write(ctx.state, { sys: 'god', kind, id, data, level });

let installed = false;

/** Registers the command `vow.pick` with `command/` (called when the module is imported; a test that cleared the commands can call it with `force`). */
export function registerGoalsActions(force = false): void {
  if (installed && !force) return;
  installed = true;
  // `vow.pick { rhythm }` chooses the rhythm of fate of the world (08-goals.md §5: "เลือกตอนเริ่มโลก"), the one command of the goals that is not about a vow: the contract has no action of its own for it
  if (!hasAction('vow.pick'))
    onAction('vow.pick', {
      check: (ctx, a) => (a.rhythm !== undefined ? checkWorldRhythm(ctx, String(a.rhythm)) : checkPick(ctx, a)),
      preview: (ctx, a) => (a.rhythm !== undefined ? previewRhythm(ctx, String(a.rhythm)) : previewPick(ctx, a)),
      run: (ctx, a) => (a.rhythm !== undefined ? chooseRhythm(ctx, String(a.rhythm)) : runPick(ctx, a, (k, id, d) => void say(ctx, k, id, d, 1))),
    });
}

/** The rhythm may be chosen when the world begins: before the first life, or while the first one is newborn. */
function checkWorldRhythm(ctx: Ctx, id: string): string | null {
  const life = ctx.state.life;
  if (life && !life.dead && life.hAge >= 1) return 'จังหวะชะตาเลือกได้ตอนเริ่มโลกเท่านั้น';
  if (goalsOf(ctx.state).lives > 0) return 'จังหวะชะตาเลือกได้ตอนเริ่มโลกเท่านั้น';
  return checkRhythm(ctx, id);
}

function previewRhythm(ctx: Ctx, id: string): Record<string, unknown> {
  const r = rhythms(ctx).find((x) => x.id === id)!;
  return { rhythm: r.id, name: r.name, effect: r.effect, from: rhythmOf(ctx) };
}
registerGoalsActions();

/** The words of what a threshold opens, for the line of the chronicle. */
export function opensText(ctx: Ctx, at: number): string {
  const x = UNLOCKS.find((u) => u.at === at);
  if (!x) return '';
  const g = ctx.data.god?.items as { conjure: { verbs: { id: string; name: string }[]; cores: { id: string; name: string }[] } };
  const verb = (id: string) => g.conjure.verbs.find((v) => v.id === id)?.name ?? id;
  const core = (id: string) => g.conjure.cores.find((c) => c.id === id)?.name ?? id;
  const parts: string[] = [];
  if (x.verbs?.length) parts.push(`กริยา ${x.verbs.map(verb).join(' ')}`);
  if (x.cores?.length) parts.push(`แก่น ${x.cores.map(core).join(' ')}`);
  if (x.vowSet) parts.push('คำปฏิญาณชุดที่สอง');
  if (x.rhythms) parts.push('จังหวะชะตาทุกแบบ');
  if (x.startModes) parts.push('แบบเริ่มต้นชุดที่ปลดล็อกด้วยพงศาวดาร');
  return parts.join(' · ');
}

/** What the vows and titles read that no system keeps: counted once a life year. */
function track(ctx: Ctx, life: LifeState): void {
  const t = lifeGoals(life).track;
  t.peakBelief = Math.max(t.peakBelief, life.godFaith);
  if (life.hAge >= ADULT_FROM) {
    t.adult += 1;
    if (life.godFaith >= 50) t.years50 += 1;
    if ((bondageOf(life)?.level ?? 0) > 0) t.bound += 1;
  }
  t.stay = t.stay ?? {};
  t.stay[life.country] = (t.stay[life.country] ?? 0) + 1;
  if (healJob(life)) t.heal += 1;
  const c = classOf(life);
  t.clsMax = Math.max(t.clsMax, c);
  t.clsMin = Math.min(t.clsMin, c);
  for (const id of rivalsNow(ctx, life)) if (!t.rivals.includes(id)) t.rivals.push(id);
  const w = ctx.state.world;
  if ((w.countryFlags[life.home] ?? []).some((f) => f === 'god_ruin' || f === 'fallen') || w.ruins.some((r) => r.country === life.home && r.year >= life.birthYear && !r.healed && r.id !== 'RU-03')) t.homeLost = true;
  if (w.ended && w.ended.year >= life.birthYear) t.ended = true;
}

/** The sky's hand: a large miracle where he lives, or a dragon falling where he is, and he lives (08-goals.md §3 "ผู้รอดจากฟ้า"). */
function sky(ctx: Ctx, life: LifeState): void {
  const t = lifeGoals(life).track;
  const chron = ctx.state.god.chronicle;
  const BIG = new Set(['MR-17', 'MR-18', 'MR-19', 'MR-20']);
  for (let i = t.scan; i < chron.length; i++) {
    const e = chron[i];
    if (e.kind === 'miracle' && BIG.has(e.id) && e.target === life.country) t.skyBorn = true;
  }
  t.scan = chron.length;
  if (ctx.data['world-events']) {
    const tb = tablesOf(ctx);
    const seen = (t.falls ??= []);
    for (const d of tb.dragons) {
      const y = ctx.state.world.happened[d.fallEvent];
      if (y === undefined || y < life.birthYear || seen.includes(d.fallEvent)) continue;
      // each fall is judged once, where he stands when it is first seen. A fall that shakes the whole world is not "in the country" (M4 review T1: 11 lives of 21
      // were "ผู้รอดจากฟ้า"): the country has to be one the table names for the event or the home of the dragon's seal
      seen.push(d.fallEvent);
      const home = tb.byId.get(d.fallEvent)?.home;
      if ((home?.countries ?? []).includes(life.country) || homesOf(ctx, d.index).includes(life.country)) t.skyBorn = true;
    }
  }
}

const namesOf = (ctx: Ctx, ids: string[], race: string) => ids.map((i) => vowName(ctx, i, race)).join(' · ');

export const godGoalsSystem: System = {
  name: 'god.goals',

  init(ctx) {
    goalsOf(ctx.state);
  },

  birth(ctx) {
    const life = ctx.state.life;
    if (!life || !ctx.data.god) return;
    goalsOf(ctx.state);
    delete life.ext.goals;
    const g = lifeGoals(life);
    g.track.cls0 = g.track.clsMax = g.track.clsMin = classOf(life);
    g.track.boundAtBirth = (bondageOf(life)?.level ?? 0) > 0;
    g.track.scan = ctx.state.god.chronicle.length;
    g.track.peakBelief = life.godFaith;
    // the vows are on the table now, but the line that tells them waits for the first beat: the name of the character is not in the log until his own birth line is (M4 review M6)
    offer(ctx, life);
  },

  beat(ctx) {
    const life = living(ctx);
    if (!life || !ctx.data.god) return;
    const g = lifeGoals(life);
    const t = g.track;
    if (life.godFaith > t.peakBelief) t.peakBelief = life.godFaith;
    sky(ctx, life);
    tellOffer(ctx, life);
  },

  lifeYear(ctx) {
    const life = living(ctx);
    if (!life || !ctx.data.god) return;
    track(ctx, life);
    yearStep(ctx);
    if (life.hAge === CHANGE_AT) {
      const ids = reoffer(ctx, life);
      const cur = lifeGoals(life).vow;
      if (ids.length) say(ctx, 'vow.reoffer', life.id, { ids: ids.join(','), names: namesOf(ctx, ids, life.race), n: ids.length, current: cur ? vowName(ctx, cur, life.race) : null });
    }
  },

  death(ctx) {
    const life = ctx.state.life;
    if (!life || !life.dead || !ctx.data.god) return;
    const g = lifeGoals(life);
    if (g.result) return;
    track(ctx, life);
    sky(ctx, life);
    const f = factsOf(ctx, life);
    const result = judge(ctx, life, g.vow, f);
    const titles = titlesOf(ctx, life, f);
    const godTitles = godTitlesOf(ctx, life, f);
    const { line, before } = record(ctx, life, g.vow, result, titles, f);
    g.result = { vow: g.vow, result, titles, godTitles, line, ...(result === 'broken' && g.vow ? { missing: missed(g.vow, f) } : {}) };
    const w = goalsOf(ctx.state);
    for (const e of lifeChronicle(ctx)) if (e.kind === 'miracle' && !w.meta.miraclesUsed.includes(e.id)) w.meta.miraclesUsed.push(e.id);
    if (g.vow && g.vow !== 'GV-20') say(ctx, 'vow.result', g.vow, { result, name: vowName(ctx, g.vow, life.race), done: vowRow(ctx, g.vow)?.done ?? '' }, 2);
    for (const t of titles) say(ctx, 'title', t, { title: t }, 2);
    for (const t of godTitles) {
      if (!w.meta.godTitles.includes(t)) w.meta.godTitles.push(t);
      say(ctx, 'godtitle', t, { title: t }, 2);
    }
    say(ctx, 'lineage', life.id, { text: line.text, gain: line.gain, total: line.total, vow: result }, 1);
    for (const u of crossed(before, line.total)) say(ctx, 'unlock', String(u.at), { at: u.at, opens: opensText(ctx, u.at) }, 2);
  },
};

// the lineage keeps the goals of the god across worlds (08-goals.md: the chronicle, the unlocks, the points): at every death the carry is
// copied into the lineage's carry object, so a new world can take it with `applyCarry(state, carry.goals)`. Inside one world the goals live
// in the god's state and go on by themselves.
onLifeChange((ctx, ev) => {
  if (ev.phase === 'end') ev.carry.goals = goalsCarry(ctx.state);
});
