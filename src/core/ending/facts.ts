// The facts of a life (docs/systems/llm/07-ending-templates.md §2): read from the log of the life and the state at its death.
// Nothing here draws a random number or writes: the same life always gives the same list.
import { worldYearsPerLifeYear } from '../clock';
import type { Ctx } from '../game';
import { extOf as bondsExt, isLive, levelOf, tiesOf } from '../bonds';
import { NO_VOW, lifeGoals, vowName } from '../god/goals';
import { pickHeir } from '../lineage/heir';
import { lx } from '../lineage/state';
import { currentThreads } from '../lineage/threads';
import { calendarYear, classLabel, continentName, placeName, raceName } from '../text/pick';
import { knownName } from '../text/labels';
import { questionOf } from '../text/render';
import type { LifeState, LogEntry } from '../types';
import { CAUSE_WORD, DEATH_ROLE_BONUS, SCORE, ELDER_AGE, dragonName, FACT_KINDS, HAND_WEIGHT, HAND_WORD, SILENT_KINDS, groupOf, isHandAct } from './tuning';
import type { CauseGroup, HandSummary, QuestionGrade } from './types';

type Slots = Record<string, string | number>;

export interface RawFact {
  kind: string;
  age?: number;
  slots: Slots;
  /** Conditions the sentence variants ask for (tuning USE_WHEN). */
  flags: string[];
  /** Ids the bonuses of 07 §2.3 compare: `event:WR-01` `npc:T10`; two facts with the same tag are one thing (step 2). */
  tags: string[];
  /** Plus score from the bonuses that depend on the fact itself (a big event +2, the hand changed it +2). */
  bonus?: number;
  /** Only the sentences that ask for one of the flags may tell it (a lover who left tells with the sentence of leaving, never with the one of meeting). */
  strict?: boolean;
  /** A turning point of the card with no sentence in the summary (`EXTRA_MOMENT`): the card shows its short line. */
  moment?: boolean;
}

/** The entries written during this life (from its birth entry on). */
export function lifeLog(ctx: Ctx): LogEntry[] {
  const log = ctx.state.log;
  let i = log.length - 1;
  for (; i >= 0; i--) if (log[i].sys === 'character' && log[i].kind === 'birth') break;
  return log.slice(Math.max(0, i));
}

/** A year of the calendar as the player reads it: `ศ.ม. 11,479`. */
export const yr = (worldYear: number): string => calendarYear(worldYear).toLocaleString('en-US');

export const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
export const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Where the character was in a world year: home until the first move, then the place each move went to. */
export function placeAtFn(ctx: Ctx, life: LifeState, log: LogEntry[]): (year: number) => string | undefined {
  const moves = log.filter((e) => e.sys === 'travel' && e.kind === 'move').map((e) => ({ y: e.worldYear, to: str(e.data.to) }));
  return (year) => {
    let at = life.home;
    for (const m of moves) if (m.y <= year) at = m.to;
    return placeName(ctx, at);
  };
}

const ageAtYear = (life: LifeState, year: number): number => Math.max(0, Math.round((year - life.birthYear) / worldYearsPerLifeYear(life.lifespan, life.race)));

/** How the question of the life was answered (07 §5.3). Assumption: the story keeps no answer, so an ending after the elder age is a good answer, none at that age is an open one. */
export function gradeOf(life: LifeState, ending: string | null): QuestionGrade {
  const age = life.dead?.hAge ?? life.hAge;
  if (ending && age >= ELDER_AGE) return 'good';
  if (age < ELDER_AGE) return 'early';
  return 'open';
}

export function handOf(ctx: Ctx, life: LifeState): HandSummary {
  const dead = life.dead?.year ?? ctx.state.clock.worldYear;
  // an heir lived in the world before the player took it over: the hand counts from the takeover
  const from = lx(ctx.state).recs.find((r) => r.id === life.id)?.startYear ?? life.birthYear;
  const mine = ctx.state.god.chronicle.filter((c) => c.worldYear >= from && c.worldYear <= dead);
  // the same reader as the power block and the summary of the world (`isHandAct`): this life's part of it
  const hand = mine.filter(isHandAct);
  const byKind: Record<string, number> = {};
  for (const c of hand) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  let top: HandSummary['top'];
  let best = 0;
  for (const c of hand) {
    const w = HAND_WEIGHT[c.kind] ?? 0;
    if (w > best) {
      best = w;
      top = { kind: c.kind, ...(c.hAge !== undefined ? { age: c.hAge } : {}), id: c.id, ...(c.kind === 'conjure' && c.result ? { name: c.result } : {}) };
    }
  }
  const conjured = hand.filter((c) => c.kind === 'conjure' && c.result).map((c) => c.result!);
  return { total: hand.length, byKind, ...(top ? { top } : {}), ...(conjured.length ? { conjured } : {}), silent: mine.filter((c) => SILENT_KINDS.includes(c.kind)).length };
}

function handResult(kind: string, result: string | undefined): string {
  if (kind === 'whisper') return /ไม่ทำตาม/.test(result ?? '') ? 'ตัวละครไม่ทำตาม' : 'ตัวละครทำตาม';
  return ({ 'chest.pick': 'ตัวละครได้ของประทาน', dream: 'ตัวละครได้ความฝัน', miracle: 'โลกเปลี่ยนไปตามปาฏิหาริย์', conjure: 'โลกเปลี่ยนไปตามที่เสก', 'prayer.give': 'คำอธิษฐานเป็นจริง', 'prayer.strange': 'คำอธิษฐานเป็นจริงในทางที่ไม่คาด', 'prayer.punish': 'ผู้อธิษฐานได้รับโทษ' } as Record<string, string>)[kind] ?? 'ชีวิตเปลี่ยนไป';
}

const BATTLE_WORD: Record<string, string> = { win: 'ชัยชนะ', lose: 'ความพ่ายแพ้', draw: 'การเสมอ', flee: 'การหนี' };

/** Everything the templates can say about the life that just died (state.life is dead). */
export function gatherFacts(ctx: Ctx, ending: string | null): { facts: RawFact[]; group: CauseGroup; grade: QuestionGrade; enemy?: string; place: string } {
  const st = ctx.state;
  const life = st.life!;
  const log = lifeLog(ctx);
  const data = ctx.data;
  const placeAt = placeAtFn(ctx, life, log);
  const deadAge = life.dead?.hAge ?? life.hAge;
  const deadYear = life.dead?.year ?? st.clock.worldYear;
  const cause = life.dead?.cause ?? 'old';
  const group = groupOf(cause);
  const where = placeName(ctx, life.country) ?? '';
  // an heir lived in the world before the player took the life over: what happened to the world before that is not a turning point of this life
  const takeover = lx(st).recs.find((r) => r.id === life.id)?.startYear ?? life.birthYear;
  const from = Math.max(life.birthYear, takeover);
  const out: RawFact[] = [];
  const add = (kind: string, slots: Slots, o: Partial<RawFact> = {}) => {
    // a slot with nothing in it is left out, so a sentence that needs it falls away (07 §10.1 rule 3)
    const clean: Slots = {};
    for (const [k, v] of Object.entries(slots)) if (v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))) clean[k] = v;
    out.push({ kind, slots: clean, flags: [], tags: [], ...o });
  };
  const hAgeOf = (e: LogEntry): number => e.age ?? ageAtYear(life, e.worldYear);

  // --- born
  const born = log.find((e) => e.sys === 'character' && e.kind === 'birth');
  add('เกิด', {
    name: life.name,
    race: raceName(ctx, life.race),
    home: placeName(ctx, life.home) ?? '',
    class_birth: classLabel(ctx, str(born?.data.cls ?? life.cls)),
    year: yr(life.birthYear),
  }, { age: 0, flags: [...(life.race === 'soulmachine' || life.race === 'mummy' ? ['wake'] : []), ...(life.race === 'ghoul' ? ['ghoul'] : [])] });

  // --- death
  const lastFight = [...log].reverse().find((e) => e.sys === 'combat' && e.kind === 'battle' && (e.data.result === 'lose' || e.data.end === 'lose'));
  const enemy = group === 'ศึก' && lastFight ? str(lastFight.data.foe) || undefined : undefined;
  add('ความตาย', { name: life.name, age: deadAge, place: where, year: yr(deadYear), enemy: enemy ?? '' }, { age: deadAge, flags: [group] });

  // --- the question of the life
  const grade = gradeOf(life, ending);
  const question = questionOf(data, life.race);
  if (question) {
    // the title of an ending answers the question only when the ending belongs to the line of the race that asked it: "ผู้ปิดสมุดตระกูล" does not answer what a slime is
    const raceLine = (life.ext.story as { line?: string } | undefined)?.line;
    const endNode = log.find((e) => e.sys === 'story' && e.kind === 'ending');
    const answer = grade === 'good' && ending && endNode?.data.line === raceLine ? ending : '';
    add('คำตอบของคำถามชีวิต', { question, answer, age: deadAge, place: where }, { age: deadAge, flags: [grade], tags: ['question'], bonus: grade === 'good' ? 4 : 0 });
  }

  // --- convergence points
  for (const e of log) {
    if (e.sys !== 'story' || e.kind !== 'node' || !str(e.id).startsWith('cv.')) continue;
    add('จุดบรรจบ', { convergence: str(e.data.title), place: placeName(ctx, str(e.data.at)) ?? placeAt(e.worldYear) ?? '', age: e.age ?? 0, year: yr(e.worldYear) }, { age: e.age, tags: [`node:${e.id}`] });
  }

  // --- secret job, jobs
  for (const e of log) {
    if (e.sys !== 'character' || e.kind !== 'job' || e.data.type !== 'secret') continue;
    add('อาชีพลับ', { job: knownName(data, str(e.id)) ?? '', age: e.age ?? 0, place: placeAt(e.worldYear) ?? '', year: yr(e.worldYear) }, { age: e.age, tags: [`job:${e.id}`] });
  }
  if (life.job) {
    const since = num((life.ext.character as { jobSince?: number } | undefined)?.jobSince);
    const years = Math.max(1, deadAge - since);
    add('อาชีพ', { job: knownName(data, life.job) ?? '', years, place: where, age: since }, { age: since, tags: [`job:${life.job}`] });
  }

  // --- legendary weapons
  for (const e of log) {
    if (e.sys !== 'items' || e.kind !== 'legend') continue;
    const held = life.items.includes(str(e.id));
    add('อาวุธตำนาน', { weapon: str(e.data.name), age: e.age ?? 0, place: placeAt(e.worldYear) ?? '', years_together: Math.max(1, deadAge - (e.age ?? 0)) }, { age: e.age, flags: [held ? 'held' : 'lost'], tags: [`item:${e.id}`] });
  }

  // --- dragons and ruins that fell in the span of the life
  const we = data['world-events']?.items as { dragons?: { name: string; title: string; fallEvent: string }[]; events?: { id: string; name: string; mark?: string }[] } | undefined;
  const fellIds = new Set<string>();
  for (const d of we?.dragons ?? []) {
    const y = st.world.happened[d.fallEvent];
    if (y === undefined || y > deadYear) continue;
    if (y < from) {
      fellIds.add(d.fallEvent);
      continue;
    }
    fellIds.add(d.fallEvent);
    add('มังกร', { dragon: dragonName(d), year: yr(y), age: ageAtYear(life, y), place: placeAt(y) ?? '' }, { age: ageAtYear(life, y), flags: ['fell'], tags: [`event:${d.fallEvent}`], bonus: 2 });
  }
  for (const r of st.world.ruins) {
    if (r.year < from || r.year > deadYear) continue;
    const name = placeName(ctx, r.country);
    if (!name) continue;
    add('ซากและประเทศล่ม', { ruin: name, home: placeName(ctx, life.home) ?? '', age: ageAtYear(life, r.year), year: yr(r.year), place: placeAt(r.year) ?? '' }, { age: ageAtYear(life, r.year), flags: r.country === life.home ? ['ruinHome'] : [], tags: [`ruin:${r.id}`] });
  }

  // --- the people
  const bonds = life.ext.bonds ? bondsExt(life) : undefined;
  const ties = bonds ? tiesOf(bonds) : [];
  const partner = bonds?.partner ? bonds.ties[bonds.partner] : ties.filter((t) => t.line === 'คนรัก').sort((a, b) => b.peak - a.peak)[0];
  if (partner) {
    // how it ended decides which sentences may tell it (E1): a lover who died is not "separated", and the age of leaving is not the age of meeting
    const died = partner.gone?.way === 'death' || partner.state === 'dead';
    const live = isLive(partner);
    const apart = !live && !died;
    const until = partner.gone?.age ?? partner.died?.age ?? deadAge;
    // a friend who became a lover: the love began when the line changed, not when they met (a childhood friend is not a lover of the childhood)
    const became = [...log].reverse().find((e) => e.sys === 'bonds' && e.kind === 'line' && e.id === partner.id && e.data.to === 'คนรัก');
    const since = became ? Math.max(partner.opened, hAgeOf(became)) : partner.opened;
    const late = since > partner.opened;
    add('คนรัก', { lover: partner.name, tie_level: levelOf(ctx, partner), years_together: Math.max(1, until - since), age: apart ? until : partner.opened }, { age: since, flags: [live ? 'together' : apart ? 'apart' : 'gone', ...(late ? ['late'] : [])], strict: apart, tags: [`npc:${partner.id}`] });
    if (late) add('คนรักเริ่ม', { lover: partner.name, age: since }, { age: since, tags: [`love:${partner.id}`], moment: true });
  }
  // the people who ended in the life: a lover or a child lost counts for more, a betrayal is a turning point of its own
  for (const e of log) {
    if (e.sys !== 'bonds' || e.kind !== 'end') continue;
    const way = str(e.data.way);
    const kin = str(e.data.kin);
    const line = str(e.data.line);
    const lover = e.data.partner === true || e.data.spouse === true || line === 'คนรัก';
    const child = kin === 'child' || kin === 'adopted';
    const age = hAgeOf(e);
    if (way === 'death' && (lover || child) && num(e.data.level) >= 2) {
      add(lover ? 'คนรักตาย' : 'ลูกตาย', { npc: str(e.data.name), npc_role: line, age, place: placeAt(e.worldYear) ?? '' }, { age, tags: [`npc:${e.id}`], moment: true });
    }
    if (way === 'betray') add('หักหลัง', { npc: str(e.data.name), npc_role: line, age, place: placeAt(e.worldYear) ?? '' }, { age, tags: [`npc:${e.id}`], moment: true });
  }
  for (const e of log) {
    if (e.sys !== 'bonds' || e.kind !== 'funeral') continue;
    const lover = e.data.partner === true || str(e.data.line) === 'คนรัก';
    add('คนใกล้ตัวตาย', { npc: str(e.data.name), npc_role: str(e.data.line), npc_cause: str(e.data.cause) === 'old' ? 'ชราภาพ' : '', age: e.age ?? 0, place: placeAt(e.worldYear) ?? '' }, { age: e.age, tags: [`npc:${e.id}`], bonus: lover || str(e.data.kin) === 'child' ? DEATH_ROLE_BONUS : 0 });
  }
  // the curses the life took: a turning point of the card, no sentence of the summary
  for (const e of log) {
    if (e.sys !== 'character' || e.kind !== 'grant' || e.data.kind !== 'curse') continue;
    const name = knownName(data, str(e.id));
    // a curse the character was born with is what he is (a ghoul's hunger), not a turning point of his life
    if (!name || hAgeOf(e) < 1) continue;
    add('คำสาป', { curse: name, age: hAgeOf(e), place: placeAt(e.worldYear) ?? '' }, { age: hAgeOf(e), tags: [`curse:${e.id}`], moment: true });
  }
  const kids = ties.filter((t) => t.kin === 'child' || t.kin === 'adopted').sort((a, b) => (a.born ?? a.opened) - (b.born ?? b.opened));
  const heir = pickHeir(ctx);
  if (kids.length) add('ลูกเกิด', { child: kids[0].name, child_count: kids.length, age: kids[0].born ?? kids[0].opened }, { age: kids[0].born ?? kids[0].opened, tags: [`npc:${kids[0].id}`], moment: true });
  if (kids.length || !heir) {
    // {age} of the sentence "the first child was born when he was {age}" is the age of the parent at the birth, not the age at death (E1)
    add('ทายาท', { child_count: kids.length, child: kids[0]?.name ?? '', heir: heir?.name ?? '', heir_age: heir?.age ?? '', age: kids[0] ? kids[0].born ?? kids[0].opened : deadAge }, { age: deadAge, flags: [...(heir ? [] : ['noHeir'])], tags: [] });
  }
  const threads = currentThreads(ctx);
  if (threads.length) {
    add('เรื่องค้าง', { thread: threads[0].text, thread_kind: threads[0].kind, thread_count: threads.length }, { flags: heir ? ['heir'] : [] });
  }

  // --- class
  const rank = (c: string) => num(/\d/.exec(c)?.[0]);
  for (const e of log) {
    if (e.sys !== 'character' || e.kind !== 'class') continue;
    const up = rank(str(e.data.to)) > rank(str(e.data.from));
    add('เปลี่ยนชนชั้น', { class_from: classLabel(ctx, str(e.data.from)), class_to: classLabel(ctx, str(e.data.to)), age: e.age ?? 0, place: placeAt(e.worldYear) ?? '' }, { age: e.age, flags: [up ? 'up' : 'down'], tags: ['class'] });
  }

  // --- the world during the life
  const seenEvents = new Set<string>();
  for (const e of log) {
    if (e.sys !== 'world' || e.kind !== 'event' || e.age !== undefined) continue;
    const id = str(e.id);
    if (e.worldYear < from || fellIds.has(id) || seenEvents.has(id)) continue;
    const mark = str(e.data.mark);
    if (!/[⭐●]/.test(mark)) continue;
    seenEvents.add(id);
    const age = ageAtYear(life, e.worldYear);
    add('เหตุการณ์โลก', { event: str(e.data.name), event_role: 'ได้ยินข่าวนั้น', place: placeAt(e.worldYear) ?? '', year: yr(e.worldYear), age }, { age, tags: [`event:${id}`], bonus: mark.includes('⭐') ? 2 : 0 });
  }
  // events the log has with an age (the life was there)
  for (const e of log) {
    if (e.sys !== 'world' || e.kind !== 'event' || e.age === undefined) continue;
    const id = str(e.id);
    const mark = str(e.data.mark);
    if (fellIds.has(id) || seenEvents.has(id) || !/[⭐●]/.test(mark) || e.worldYear < from) continue;
    seenEvents.add(id);
    add('เหตุการณ์โลก', { event: str(e.data.name), event_role: 'ได้ยินข่าวนั้น', place: placeAt(e.worldYear) ?? '', year: yr(e.worldYear), age: e.age }, { age: e.age, tags: [`event:${id}`], bonus: mark.includes('⭐') ? 2 : 0 });
  }

  // --- the hand of the god
  const hand = handOf(ctx, life);
  const mineHand = st.god.chronicle.filter((c) => c.worldYear >= from && c.worldYear <= deadYear && isHandAct(c));
  if (hand.total === 0) {
    add('พระหัตถ์', { god_total: 0 }, { flags: ['zero'] });
  } else if (hand.top) {
    const c = mineHand.find((x) => x.kind === hand.top!.kind && x.id === hand.top!.id) ?? mineHand[0];
    // a conjured miracle has the name the god gave it: the world remembers the name (07 §6)
    const kindWord = hand.top.kind === 'conjure' && hand.top.name ? `เสก${hand.top.name}` : HAND_WORD[hand.top.kind] ?? hand.top.kind;
    const big = hand.top.kind === 'miracle' || hand.top.kind === 'conjure';
    add('พระหัตถ์', { intervention_kind: kindWord, intervention_result: handResult(hand.top.kind, c.result), god_total: hand.total, age: hand.top.age ?? deadAge }, { age: hand.top.age, flags: hand.byKind['prayer.give'] ? ['prayer'] : [], bonus: big ? SCORE.godChanged : 0 });
  }

  // --- the roads and the fights
  const moves = log.filter((e) => e.sys === 'travel' && e.kind === 'move');
  const visited = new Set<string>([life.home, ...moves.map((m) => str(m.data.to))]);
  const lands = new Set([...visited].map((c) => continentName(ctx, c)).filter((x): x is string => !!x));
  add('การเดินทาง', { country_n: visited.size, continent_n: lands.size, home: placeName(ctx, life.home) ?? '', place: placeName(ctx, str(moves[0]?.data.to)) ?? '', age: moves[0]?.age ?? 0 }, {
    age: moves[0]?.age,
    flags: [...(visited.size === 1 ? ['never'] : []), ...(moves.length && str(moves[moves.length - 1].data.to) === life.home ? ['home'] : [])],
  });
  const fights = log.filter((e) => e.sys === 'combat' && e.kind === 'battle');
  if (fights.length) {
    const last = fights[fights.length - 1];
    add('ศึก', { battle_n: fights.length, battle_result: BATTLE_WORD[str(last.data.result)] ?? '', place: placeAt(last.worldYear) ?? '', age: last.age ?? 0 }, { age: last.age });
  }

  // --- the titles of the life (08-goals §3) and the vow (08-goals §2): the goals judged them at the death, before the card
  const goals = lifeGoals(life).result;
  if (goals?.titles.length) add('ฉายาชีวิต', { titles: goals.titles.join(' · '), title: goals.titles[0], title_n: goals.titles.length }, {});
  if (goals?.vow && goals.vow !== NO_VOW && goals.result !== 'none') {
    add('ผลคำปฏิญาณ', { vow: vowName(ctx, goals.vow, life.race), age: deadAge }, { age: deadAge, flags: [goals.result === 'kept' ? 'done' : 'fail'], tags: [`vow:${goals.vow}`] });
  }

  // --- the place where the most years were spent
  const stay = new Map<string, number>();
  let at = life.home;
  let since = 0;
  for (const m of moves) {
    stay.set(at, (stay.get(at) ?? 0) + Math.max(0, (m.age ?? since) - since));
    at = str(m.data.to);
    since = m.age ?? since;
  }
  stay.set(at, (stay.get(at) ?? 0) + Math.max(0, deadAge - since));
  const longest = [...stay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (longest && longest[1] > 0) add('ถิ่นที่อยู่นานที่สุด', { place: placeName(ctx, longest[0]) ?? '', years: longest[1] }, {});

  return { facts: out, group, grade, enemy, place: where };
}

export const baseOf = (kind: string): number => FACT_KINDS[kind]?.base ?? 0;
export { CAUSE_WORD };
