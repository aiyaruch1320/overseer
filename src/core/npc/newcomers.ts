// NPCs that come new with the eras (docs/lore/npcs/succession.md §5): NT-01 ... NT-54.
// Every 100 world years from the start, at the start of era 2 and 3 and at each sub-period 4ก 4ข 4ค of the last era, each country has
// a 40% chance of a newcomer drawn from the templates of that era whose condition the country meets; the templates of a continent
// (NT-19 ... NT-54) weigh double; one template is used once per country per world.
// The docs write the conditions of the templates as prose ("มีหอสมุดหรือสำนักปราชญ์"), so they are coded here (`WHEN`), with the
// event ids, country ids and words the prose names; where the prose names a thing the data does not hold (a library, an old relic)
// the marks and words of the country file stand in for it.
import { write } from '../log';
import type { Ctx } from '../game';
import type { Rng } from '../rng';
import type { GameState } from '../types';
import type { Country, NpcRow, NpcTemplate } from '../data/types-npcs';
import { lifeOfRow, npcIndex, rowOf, type NpcIndex } from './data';
import { drawOpenDelay, drawSpan, lastEraPhase, newStory, note } from './engine';
import { npcState, slotsOf, type NpcSlotX } from './types';

// ---------- what a condition can look at ----------

interface Env {
  ctx: Ctx;
  state: GameState;
  idx: NpcIndex;
  c: Country;
  /** Words of the country file that stand in for a thing the data does not hold. */
  text: string;
  marks: string[];
  /** The people ids of the roster rows of the country. */
  peoples: string[];
  ev(id: string): boolean;
  /** World years since the event, Infinity when it has not happened. */
  since(id: string): number;
  v(name: string): number;
  has(re: RegExp): boolean;
  mark(...m: string[]): boolean;
  inList(...ids: string[]): boolean;
}

const wordsOf = (c: Country): string =>
  [c.name, c.title, c.gov, c.races, c.religionRaw, c.story, c.relationsRaw, c.hook, c.bloc, c.ui.mark.join(' '), c.ui.sacred ?? '', c.ui.seat ?? '', Object.keys(c.ui.extra ?? {}).join(' ')].join(' ');

/** The peoples of a country: those of its roster rows and those its file names in the cell "เผ่า". */
function peoplesOf(idx: NpcIndex, c: Country, rows: NpcRow[]): string[] {
  const out = new Set(rows.map((r) => r.peopleId).filter((x): x is string => !!x));
  for (const l of idx.file.rules.lives) if (l.id && c.races.includes(l.people.replace(/ \(.*\)$/, ''))) out.add(l.id);
  return [...out];
}

function envOf(ctx: Ctx, idx: NpcIndex, c: Country): Env {
  const st = ctx.state;
  const text = wordsOf(c);
  const marks = c.ui.mark;
  const rows = idx.byCountry.get(c.id) ?? [];
  return {
    ctx,
    state: st,
    idx,
    c,
    text,
    marks,
    peoples: peoplesOf(idx, c, rows),
    ev: (id) => st.world.happened[id] !== undefined,
    since: (id) => (st.world.happened[id] === undefined ? Infinity : st.clock.worldYear - st.world.happened[id]),
    v: (n) => st.world.vars[n] ?? 0,
    has: (re) => re.test(text),
    mark: (...m) => m.some((x) => marks.includes(x)),
    inList: (...ids) => ids.includes(c.id),
  };
}

/** The continent that changed shape with each event (succession.md NT-02: "อยู่ติดทวีปที่เปลี่ยนรูปแล้ว"). */
const CHANGED_BY: Record<string, string> = { AZ: 'DR-01', KD: 'DR-04', NR: 'DR-05', AL: 'DR-07', SV: 'BIO-02', MK: 'MC-04', NB: 'FG-11' };

const neighboursOf = (e: Env): string[] => {
  const file = e.ctx.data.continents?.items as { continents: { id: string; map: { neighbours: { id: string }[] } }[] } | undefined;
  return file?.continents.find((x) => x.id === e.c.continent)?.map.neighbours.map((n) => n.id) ?? [];
};

const lifeHi = (e: Env, people: string): number => {
  const lives = e.idx.file.rules.lives;
  return lives[e.idx.lifeById.get(people) ?? e.idx.lifeById.get('hu') ?? 0].lifeHi;
};

const WAR_OPEN = ['feud', 'frequent', 'total'];

/** The condition column of succession.md §5, one function per template. The era and the continent are checked before (template data). */
const WHEN: Record<string, (e: Env) => boolean> = {
  // era 2 to 4 general templates
  'NT-01': (e) => e.mark('library', 'archive', 'academy', 'observatory') || e.has(/หอสมุด|สำนักปราชญ์|ห้องสมุด|นักปราชญ์|ปราชญ์/),
  'NT-02': (e) => [e.c.continent, ...neighboursOf(e)].some((k) => k !== e.c.continent && CHANGED_BY[k] && e.ev(CHANGED_BY[k])),
  'NT-03': (e) => e.c.religions.length >= 2 || e.has(/นิกาย|แตกแยก|แตกเป็น|สองฝ่าย/),
  'NT-04': (e) => e.state.world.ruins.some((r) => r.country === e.c.id) || (e.state.world.countryFlags[e.c.id] ?? []).includes('fallen') || e.mark('ruins') || e.has(/ซาก/) || (e.c.continent === 'AZ' && e.ev('DR-01')),
  'NT-05': (e) => (e.state.world.countryFlags[e.c.id] ?? []).includes('war') || WAR_OPEN.includes(e.c.ui.war ?? ''),
  'NT-06': (e) => e.c.continent === 'NB' || neighboursOf(e).includes('NB') || e.has(/หมอก/),
  'NT-07': (e) => e.c.religions.some((r) => /มังกร|นาคราช|ไวเวิร์น|พญา/.test(r.name)) || /มังกร/.test(e.c.religionRaw),
  'NT-08': (e) => e.peoples.some((p) => lifeHi(e, p) < 100),
  'NT-09': (e) => e.mark('vault', 'ossuary', 'crypt', 'ruins', 'archive', 'library') || e.has(/ของเก่า|ตกทอด|โบราณ|สุสาน|พิพิธ|ซาก|ศิลา|ของวิเศษ|เทวาลัย|วัด/),
  'NT-10': (e) => keeperNear(e),
  'NT-11': (e) => e.mark('refugeecamp', 'warcamp', 'caravanserai') || e.has(/ค่าย|ชายแดน|ผู้ลี้ภัย|เป็นกลาง/),
  'NT-12': (e) => !!e.c.ui.sacred || e.mark('library', 'archive', 'mourninghall', 'ossuary', 'warmemorial', 'graveyard') || e.has(/วัด|ศาล|หอสมุด|บันทึก/),
  // era 1 general templates
  'NT-13': (e) => {
    const his = e.peoples.map((p) => lifeHi(e, p));
    return his.length > 1 && Math.max(...his) > 2 * Math.min(...his);
  },
  'NT-14': (e) => e.c.religions.find((r) => r.primary)?.channel === 'A' && (e.state.world.countryFaith[e.c.id] ?? 0) >= 50,
  'NT-15': (e) => ['peace', 'watch'].includes(e.c.ui.war ?? '') && e.c.relations.some((r) => r.kind === 'trade'),
  'NT-16': (e) => WAR_OPEN.includes(e.c.ui.war ?? ''),
  'NT-17': (e) => e.mark('smithrow', 'foundry', 'kiln', 'masonyard', 'guildhall') && (!e.ev('MC-07') || e.since('MC-07') <= 50),
  'NT-18': (e) => e.v('T') < 65 && !e.has(/ใต้พิภพ|ใต้ดิน|เมืองบนเรือ|กองเรือ/),
  // Azgar
  'NT-19': (e) => e.c.id !== 'AZ-09' && !e.ev('DR-01'),
  'NT-20': (e) => e.inList('AZ-01', 'AZ-07', 'AZ-08', 'AZ-09') && !e.ev('DR-01') && (e.v('FLOAT') < 60 || e.ev('DR-02')),
  'NT-21': (e) => e.ev('DR-01') && (e.ev('SF-01') || e.since('DR-01') >= 5) && !e.ev('SF-10'),
  'NT-22': (e) => e.ev('DR-01') && (e.c.id === 'AZ-01' || e.ev('SF-08')),
  // Morhaven
  'NT-23': (e) => e.inList('MH-01', 'MH-02', 'MH-03', 'MH-04', 'MH-05', 'MH-10') && !e.ev('END-02'),
  'NT-24': (e) => e.v('H') >= 70 && !e.ev('HP-07') && (e.inList('MH-04', 'MH-06', 'MH-09', 'MH-11') || e.c.relations.some((r) => r.kind === 'trade' && !r.to.startsWith('MH'))),
  'NT-25': (e) => e.ev('END-02'),
  'NT-26': (e) => e.ev('HP-07') && e.v('H') < 40 && !e.ev('END-02'),
  // Kaz-Durum
  'NT-27': (e) => e.inList('KD-01', 'KD-02', 'KD-06', 'KD-08', 'KD-11') && !e.ev('END-03'),
  'NT-28': (e) => e.c.id !== 'KD-12' && !e.ev('DR-04') && !e.ev('END-03') && e.has(/ลาวา|ภูเขาไฟ|คัลดรา/),
  'NT-29': (e) => e.ev('DR-04') && !e.ev('END-03'),
  'NT-30': (e) => (e.ev('GI-05') || e.ev('AS-04')) && !e.ev('END-03'),
  // Nerea
  'NT-31': (e) => e.inList('NR-02', 'NR-09', 'NR-13') && !e.ev('WR-20'),
  'NT-32': (e) => (e.inList('NR-16', 'NR-02') || e.has(/วาฬ/)) && !e.ev('DR-05'),
  'NT-33': (e) => e.ev('DR-05') && (e.inList('NR-01', 'NR-12') || e.has(/กลางน้ำ|ยกพื้น|เสา/)),
  'NT-34': (e) => e.inList('NR-11', 'NR-05') && !e.ev('LE-03'),
  // Aldria
  'NT-35': (e) => (e.has(/พันธมิตรแสงศักดิ์สิทธิ์|แสงศักดิ์สิทธิ์|แสง|สงคราม/) || WAR_OPEN.includes(e.c.ui.war ?? '')) && !e.ev('PO-05'),
  'NT-36': (e) => e.inList('AL-14', 'AL-16', 'AL-17', 'AL-24') && !e.ev('END-05'),
  'NT-37': (e) => e.ev('DR-07') && (e.inList('AL-01', 'AL-15') || e.has(/เหว/)),
  'NT-38': (e) => e.inList('AL-01', 'AL-06', 'AL-07', 'AL-13', 'AL-19', 'AL-26', 'AL-27') && e.ev('LE-05'),
  // Mecharia
  'NT-39': (e) => e.inList('MK-10', 'MK-12', 'MK-14') && !e.ev('MC-02'),
  'NT-40': (e) => e.inList('MK-01', 'MK-04', 'MK-05', 'MK-06', 'MK-09', 'MK-14', 'MK-15', 'MK-16') && !e.ev('MC-11'),
  'NT-41': (e) => e.inList('MK-04') && e.ev('MC-05') && !e.ev('END-06'),
  'NT-42': (e) => e.inList('MK-03', 'MK-12', 'MK-15') && !e.ev('MC-06'),
  // Saharan
  'NT-43': (e) => e.has(/ผืนทราย|ใต้ทราย|ทะเลทราย|สัตว์ทราย/) && (!e.ev('WR-24') || e.since('WR-24') <= 30),
  'NT-44': (e) => e.has(/ยักษ์/) && !e.ev('DR-01') && !e.ev('GI-01'),
  'NT-45': (e) => e.ev('GI-02') || e.ev('END-07'),
  'NT-46': (e) => (e.has(/แก้ว|อัญมณี|เหมือง/) || e.mark('kiln')) && !e.ev('LE-04'),
  // Silvanel
  'NT-47': (e) => !e.ev('BIO-02') && e.has(/น้ำเลี้ยง|นักบำบัด|รักษา|หมอ/),
  'NT-48': (e) => !e.ev('BIO-02') && e.has(/เผ่าสัตว์|สัตว์|หมาป่า|กวาง/),
  'NT-49': (e) => e.ev('BIO-02'),
  'NT-50': () => true,
  // Nebulia
  'NT-51': (e) => !e.ev('FG-11') && !e.ev('FG-10') && e.has(/ประตู|ย่าน/),
  'NT-52': (e) => !e.ev('BIO-05') && !e.ev('FG-11') && (e.has(/แวมไพร์/) || e.peoples.includes('va')),
  'NT-53': (e) => e.ev('FG-02') || e.ev('FG-11'),
  'NT-54': (e) => ((e.has(/กระซิบ/) && !e.ev('BIO-06') && !e.ev('CL-04') && !e.ev('FG-10')) || e.ev('FG-11')),
};

/** NT-10: a keeper of a key (an NPC with the post) lives in the country, the continent or one next to it. */
function keeperNear(e: Env): boolean {
  const slots = slotsOf(e.state);
  const near = [e.c.continent, ...neighboursOf(e)];
  for (const id of e.idx.keepers) {
    const s = slots[id];
    const row = e.idx.rows.get(id);
    if (s && s.status === 'alive' && row && (s.place === e.c.id || near.includes(row.continent))) return true;
  }
  return false;
}

/** The people the template names: the holder is of this people whatever the country (succession.md §5 condition column). */
const PEOPLE_OF: Record<string, string> = { 'NT-21': 'wi', 'NT-42': 'so', 'NT-44': 'gi', 'NT-52': 'va', 'NT-53': 'co' };

// ---------- the eras ----------

const TAG_OF_PHASE = { '4ก': '4a', '4ข': '4b', '4ค': '4c' } as const;

/** The era tag of the template table for this moment: `1` `2` `3` or the sub-period `4a` `4b` `4c` (none after the end of the world). */
export function eraTag(state: GameState): string | null {
  const era = state.world.era;
  if (era >= 5) return null;
  if (era >= 4) {
    const p = lastEraPhase(state);
    return p ? TAG_OF_PHASE[p] : '4a';
  }
  return String(Math.max(1, era));
}

// ---------- the roll ----------

/** The templates a country can be given now, with their weights (continent templates double). */
export function candidatesFor(ctx: Ctx, country: Country, tag: string): { t: NpcTemplate; w: number }[] {
  const idx = npcIndex(ctx);
  const used = npcState(ctx.state).ntUsed?.[country.id] ?? [];
  const env = envOf(ctx, idx, country);
  const mult = idx.file.rules.newcomer.continentWeight;
  const out: { t: NpcTemplate; w: number }[] = [];
  for (const t of idx.file.templates) {
    if (!t.eras.includes(tag as never) || used.includes(t.id)) continue;
    if (t.continents.length && !t.continents.includes(country.continent)) continue;
    const f = WHEN[t.id];
    if (f && !f(env)) continue;
    out.push({ t, w: t.continentTemplate ? mult : 1 });
  }
  return out;
}

function maxSeq(idx: NpcIndex, country: string, nx: ReturnType<typeof npcState>): number {
  let m = 0;
  for (const r of idx.byCountry.get(country) ?? []) m = Math.max(m, r.seq);
  return Math.max(m, nx.ntSeq?.[country] ?? 0);
}

const u = (rng: Rng, a: number, b: number) => a + rng.next() * (b - a);

/** Puts the newcomer of a template in the country: a slot with a holder of the people the template or the leader names, whose story opens by age. */
function arrive(ctx: Ctx, country: Country, t: NpcTemplate, rng: Rng): string {
  const st = ctx.state;
  const idx = npcIndex(ctx);
  const nx = npcState(st);
  const now = st.clock.worldYear;
  const seq = maxSeq(idx, country.id, nx) + 1;
  (nx.ntSeq ??= {})[country.id] = seq;
  const id = `${country.id.replace('-', '')}-${seq}`;
  const leader = (idx.byCountry.get(country.id) ?? []).find((r) => r.seq === 1);
  let people = PEOPLE_OF[t.id] ?? leader?.peopleId ?? 'hu';
  if (t.id === 'NT-13') {
    // the template is the people of the country that lives longest
    const env = envOf(ctx, idx, country);
    people = env.peoples.length ? env.peoples.reduce((a, b) => (lifeHi(env, b) > lifeHi(env, a) ? b : a)) : people;
  }
  const slot = { nt: { tpl: t.id, people, seq, year: now }, home: country.id } as NpcSlotX;
  slotsOf(st)[id] = slot;
  const row = rowOf(ctx, id)!;
  const life = lifeOfRow(idx, row);
  const age = Math.round(u(rng, life.adult, life.elder));
  const span = drawSpan(rng, life.lo, life.hi, age);
  Object.assign(slot, {
    holder: id,
    alive: true,
    step: 0,
    place: country.id,
    rel: {},
    name: t.name,
    gen: 1,
    status: 'alive',
    born: now - age,
    span,
    refill: false,
    keeper: false,
    story: newStory(now + drawOpenDelay(rng, life.adult, life.elder, age)),
    evFired: false,
  } satisfies Partial<NpcSlotX>);
  (nx.ntUsed ??= {})[country.id] = [...(nx.ntUsed[country.id] ?? []), t.id];
  nx.newcomers.push(id);
  note(ctx, slot as NpcSlotX, row, 'newcomer', { tpl: t.id, year: now, age: Math.round(age / life.rate) });
  return id;
}

/**
 * One roll of the newcomers: each country has `newcomer.chance` to get one template drawn by weight from those the era and the country allow.
 * Returns the ids that arrived.
 */
export function rollNewcomers(ctx: Ctx, tag: string | null = eraTag(ctx.state)): string[] {
  if (!tag) return [];
  const idx = npcIndex(ctx);
  const rng = ctx.rng('npc.nt');
  const chance = idx.file.rules.newcomer.chance;
  const out: string[] = [];
  for (const country of idx.countries.values()) {
    if (!rng.chance(chance)) continue;
    const cand = candidatesFor(ctx, country, tag);
    if (!cand.length) continue;
    const t = cand[rng.weighted(cand.map((c) => c.w))].t;
    out.push(arrive(ctx, country, t, rng));
  }
  if (out.length)
    write(ctx.state, { sys: 'npc', kind: 'npc-roll', level: 0, data: { tag, n: out.length } });
  return out;
}

/**
 * Called after the world step: the 100-year blocks since the start (world year 0), the start of era 2 and 3 (the era-4 sub-periods come from the
 * fate roll of the last era, engine.ts `eraFate`).
 */
export function stepNewcomers(ctx: Ctx): void {
  const st = ctx.state;
  const nx = npcState(st);
  const every = npcIndex(ctx).file.rules.newcomer.everyYears;
  const block = Math.floor(st.clock.worldYear / every);
  const era = st.world.era;
  if (nx.ntBlock === undefined) nx.ntBlock = Math.max(0, block);
  if (nx.ntEra === undefined) nx.ntEra = String(Math.min(era, 4) >= 2 ? era : 1);
  // era 2 and 3 start: a roll of its own
  if (era >= 2 && era <= 3 && nx.ntEra !== String(era)) {
    nx.ntEra = String(era);
    rollNewcomers(ctx);
  } else if (era >= 4 && nx.ntEra !== '4') {
    // the last era rolls with the fate table (eraFate); only remember it
    nx.ntEra = '4';
  }
  while (nx.ntBlock < block) {
    nx.ntBlock++;
    rollNewcomers(ctx);
  }
}

