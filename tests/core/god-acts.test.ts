// The acts of the god, G3 and G4 (god/03-dreams.md §6 and §7, god/04-miracles.md): prices, waits, caps, the iron rules, the effects of the
// table, previews that roll nothing, the prayer maker, the policies. The data is the generated data/gen/ (the same files the game loads).
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, type Session } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { command } from '../../src/core/command';
import { extOf, idx } from '../../src/core/character';
import { Game, sortSystems, type GameData } from '../../src/core/game';
import type { GodData } from '../../src/core/data/types-god';
import {
  actsPolicyStep,
  actsOf,
  applyFx,
  cardsOf,
  choiceWhisperMul,
  decisionMade,
  fateCost,
  fateTargets,
  godActsSystem,
  grantPrice,
  kindOf,
  holdsKind,
  strangeOptions,
  implementedMiracles,
  modAdd,
  modMul,
  obeyChance,
  whisperPrice,
} from '../../src/core/god/acts';
import { OMEN } from '../../src/core/god/acts/tuning';
import { prayerBeat } from '../../src/core/god/acts/prayers';
import { blessingPool, compOf, count, gx, openChest, rerollChest } from '../../src/core/god';
import { lifeCounters } from '../../src/core/god/acts/state';
import { silent } from '../../src/core/god/acts';
import { npcIndex } from '../../src/core/npc/data';
import { slotsOf } from '../../src/core/npc/types';
import { weightOf } from '../../src/core/world';
import { classify, prayersWaiting } from '../../src/core/attention';
import { EXTERNAL } from '../../src/core/attention/tuning';
import type { Choice, CommandResult, GameState } from '../../src/core/types';

let data: GameData;
let god: GodData;

beforeAll(() => {
  data = loadAll();
  god = data.god.items as GodData;
});

/** A world run to year 120 with a human born in it and the acts of the god in the loop; the light and the dread are given. */
function mk(seed = 1, power = { light: 200, dread: 200 }): { s: Session; g: Game; st: GameState; ctx: Game['ctx'] } {
  const s = createSession(data, { seed, race: 'hu', startYear: 120 });
  const systems = (s.game as unknown as { systems: unknown[] }).systems;
  if (!(systems as { name: string }[]).some((x) => x.name === 'god.acts')) systems.push(godActsSystem); // the tools' list holds it already
  systems.splice(0, systems.length, ...sortSystems(systems as never));
  s.game.state.god.light = power.light;
  s.game.state.god.dread = power.dread;
  startLife(s);
  s.game.state.life!.hAge = 30;
  s.game.state.life!.godFaith = 0;
  return { s, g: s.game, st: s.game.state, ctx: s.game.ctx };
}

const run = (c: Game['ctx'], action: 'whisper' | 'prayer.answer' | 'miracle' | 'decree', args: Record<string, unknown>, confirm = true) =>
  command(c, { type: 'god', action, args, confirm });

/** The preview of a command that was allowed. */
const prev = (r: CommandResult) => (r as { ok: true; preview: Record<string, any> }).preview;

describe('prayer kinds', () => {
  it('the data holds 17 kinds, each with a condition, and every effect word is one the acts understand', () => {
    const { ctx } = mk();
    expect(god.prayers.kinds.length).toBe(17);
    for (const k of god.prayers.kinds) {
      expect(typeof holdsKind(ctx, k.id), k.id).toBe('boolean');
      for (const fx of [k.grantFx, k.punishFx]) for (const w of applyFxWords(fx)) expect(w, `${k.id}: ${fx}`).toBe(true);
    }
  });

  it('each kind raises its prayer on the conditions of the table 7.1', () => {
    const { ctx, st } = mk();
    const life = st.life!;
    const reset = () => {
      life.flags = [];
      life.curses = [];
      life.gold = 100;
      life.hAge = 30;
      life.godFaith = 0;
      life.job = 'soldier';
      delete life.ext.bonds;
      st.world.countryFlags[life.country] = [];
    };
    reset();
    expect(holdsKind(ctx, 'heal')).toBe(false);
    life.flags = ['wounded'];
    expect(holdsKind(ctx, 'heal')).toBe(true);
    reset();
    for (const [kind, flags] of [['rain', ['famine']], ['rain', ['sandstorm']], ['plague', ['plague']], ['plague', ['undead_rising']], ['peace', ['war']], ['peace', ['horde']], ['peace', ['demon_raid']]] as const) {
      reset();
      expect(holdsKind(ctx, kind), `${kind} before`).toBe(false);
      st.world.countryFlags[life.country] = [...flags];
      expect(holdsKind(ctx, kind), `${kind} ${flags}`).toBe(true);
    }
    reset();
    expect(holdsKind(ctx, 'love')).toBe(true); // an adult with no partner
    life.ext.bonds = { partner: { id: 'x' }, children: 0 };
    expect(holdsKind(ctx, 'love')).toBe(false);
    expect(holdsKind(ctx, 'heir')).toBe(true);
    life.hAge = 55;
    expect(holdsKind(ctx, 'heir')).toBe(false);
    reset();
    life.gold = 10;
    expect(holdsKind(ctx, 'wealth')).toBe(true);
    life.gold = 25;
    expect(holdsKind(ctx, 'wealth')).toBe(false);
    reset();
    expect(holdsKind(ctx, 'wisdom')).toBe(false);
    life.hAge = 15;
    expect(holdsKind(ctx, 'wisdom')).toBe(true);
    expect(holdsKind(ctx, 'mother')).toBe(false);
    life.hAge = 3;
    expect(holdsKind(ctx, 'mother')).toBe(true);
    life.hAge = 8;
    expect(holdsKind(ctx, 'mother')).toBe(true);
    reset();
    expect(holdsKind(ctx, 'courage')).toBe(false);
    st.world.countryFlags[life.country] = ['war'];
    expect(holdsKind(ctx, 'courage')).toBe(true);
    life.hAge = 8;
    expect(holdsKind(ctx, 'courage')).toBe(false); // a child does not
    reset();
    expect(holdsKind(ctx, 'uncurse')).toBe(false);
    life.curses = ['c_weakarm'];
    expect(holdsKind(ctx, 'uncurse')).toBe(true);
    reset();
    expect(holdsKind(ctx, 'harvest')).toBe(false);
    life.job = 'farmer';
    expect(holdsKind(ctx, 'harvest')).toBe(true);
    reset();
    life.hAge = 60;
    expect(holdsKind(ctx, 'grandchild')).toBe(false);
    life.ext.bonds = { children: 2 };
    expect(holdsKind(ctx, 'grandchild')).toBe(true);
    reset();
    expect(holdsKind(ctx, 'challenge')).toBe(false);
    life.godFaith = -20;
    expect(holdsKind(ctx, 'challenge')).toBe(true);
    life.godFaith = -10;
    expect(holdsKind(ctx, 'challenge')).toBe(false); // "ต่ำกว่า −10"
    reset();
    extOf(life).axes.ambition = 20;
    expect(holdsKind(ctx, 'fame')).toBe(false);
    extOf(life).axes.ambition = 30;
    expect(holdsKind(ctx, 'fame')).toBe(true);
    // the NPC kinds
    reset();
    const ids = Object.keys(slotsOf(st));
    const a = slotsOf(st)[ids[0]];
    a.status = 'alive';
    a.rel['mc.grudge'] = 3;
    expect(holdsKind(ctx, 'vengeance')).toBe(true);
    a.rel['mc.grudge'] = 0;
    expect(holdsKind(ctx, 'vengeance')).toBe(false);
    a.rel['mc.known'] = 3;
    a.born = st.clock.worldYear - a.span;
    expect(holdsKind(ctx, 'kin_sick')).toBe(true);
    a.born = st.clock.worldYear;
    expect(holdsKind(ctx, 'kin_sick')).toBe(false);
  });
});

/** The words of an effect cell the acts read: used to check that the data holds nothing they would skip. */
function applyFxWords(fx: string): boolean[] {
  return fx.split(/\s+/).filter(Boolean).map((w) => !applyFx(mk(3).ctx, w, {})[0].startsWith('?'));
}

describe('the maker of prayers', () => {
  it('the prayer it writes is the entry the attention system waits for: a card is queued, and a third prayer is not raised', () => {
    const { g, ctx, st } = mk(2);
    const life = st.life!;
    st.world.countryFlags[life.country] = ['famine', 'plague', 'war'];
    let seen = 0;
    for (let i = 0; i < 4 * 30 && seen < 2; i++) {
      g.beat();
      seen = st.log.filter((e) => e.sys === 'god' && e.kind === 'prayer').length;
    }
    const first = st.log.find((e) => e.sys === 'god' && e.kind === 'prayer')!;
    expect(first).toBeDefined();
    expect(EXTERNAL[`${first.sys}/${first.kind}`]).toBe('prayer');
    expect(classify(ctx, first)?.kind).toBe('prayer');
    expect(first.level).toBe(2);
    expect(prayersWaiting(st)).toBeGreaterThan(0);
    expect(prayersWaiting(st)).toBeLessThanOrEqual(2);
    expect(st.log.filter((e) => e.sys === 'attention' && e.kind === 'call' && e.data.why === 'prayer').length).toBeGreaterThan(0);
  });

  it('raises at most two at once, lets one lapse after 14 ticks for belief −2, never the same kind within 24 ticks', () => {
    const { ctx, st } = mk(2);
    const life = st.life!;
    life.hAge = 30;
    st.clock.quarter = 0;
    st.world.countryFlags[life.country] = ['famine', 'plague'];
    for (let i = 0; i < 400 && cardsOf(ctx).length < 2; i++) {
      st.clock.quarter = (st.clock.quarter + 1) % 4;
      if (st.clock.quarter === 0) life.hAge++;
      prayerBeat(ctx);
    }
    // push the chance up by hand so the test does not wait: the maker is called until two cards stand
    expect(cardsOf(ctx).length).toBe(2);
    const before = [...cardsOf(ctx)];
    for (let i = 0; i < 30; i++) {
      st.clock.quarter = (st.clock.quarter + 1) % 4;
      if (st.clock.quarter === 0) life.hAge++;
      const n = cardsOf(ctx).length;
      prayerBeat(ctx);
      expect(cardsOf(ctx).length).toBeLessThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(2);
    }
    expect(cardsOf(ctx).some((c) => before.some((b) => b.n === c.n))).toBe(false); // the first two lapsed
    const lapses = st.log.filter((e) => e.sys === 'god' && e.kind === 'prayer.lapse');
    expect(lapses.length).toBeGreaterThanOrEqual(2);
    const spawns = st.log.filter((e) => e.sys === 'god' && e.kind === 'prayer');
    for (let i = 0; i < spawns.length; i++)
      for (let j = i + 1; j < spawns.length; j++)
        if (spawns[i].id === spawns[j].id) {
          const ti = (spawns[i].age ?? 0) * 4 + (spawns[i].quarter ?? 0);
          const tj = (spawns[j].age ?? 0) * 4 + (spawns[j].quarter ?? 0);
          expect(tj - ti, `${spawns[i].id}`).toBeGreaterThanOrEqual(24);
        }
    for (const sp of spawns) expect(sp.level).toBe(2); // a prayer calls the player
    for (const c of before) expect(c.exp - c.tick).toBe(14);
  });

  it('raises nothing when the belief is below −70', () => {
    const { ctx, st } = mk(2);
    st.life!.godFaith = -71;
    st.world.countryFlags[st.life!.country] = ['famine', 'war'];
    for (let i = 0; i < 300; i++) prayerBeat(ctx);
    expect(cardsOf(ctx).length).toBe(0);
  });
});

describe('answering a prayer', () => {
  /** Makes the matter of the kind true for the character: a prayer whose matter is not true (or whose asker is dead) cannot be answered. */
  function matter(ctx: Game['ctx'], kind: string, npc?: string) {
    const st = ctx.state;
    const life = st.life!;
    if (npc && (kind === 'kin_sick' || kind === 'vengeance')) {
      const slot = slotsOf(st)[npc];
      slot.rel['mc.known'] = 9;
      if (kind === 'kin_sick') slot.born = st.clock.worldYear - slot.span; // old enough to be gravely ill
      else slot.rel['mc.grudge'] = 9;
      return;
    }
    if (holdsKind(ctx, kind)) return;
    if (kind === 'heal') life.flags.push('wounded');
    else if (kind === 'rain' || kind === 'plague' || kind === 'peace') st.world.countryFlags[life.country] = [{ rain: 'famine', plague: 'plague', peace: 'war' }[kind]!];
    else if (kind === 'wealth') life.gold = Math.min(life.gold, 10);
    else if (kind === 'fame') extOf(life).axes.ambition = 40;
    else if (kind === 'uncurse') life.curses = ['c_weakarm'];
    else if (kind === 'mother') life.hAge = 6;
  }

  function card(ctx: Game['ctx'], kind: string, npc?: string) {
    matter(ctx, kind, npc);
    const a = actsOf(ctx.state);
    const tick = ctx.state.life!.hAge * 4 + ctx.state.clock.quarter;
    const c = { n: ++a.prayerN, kind, tick, exp: tick + 14, year: ctx.state.clock.worldYear, ...(npc ? { npc } : {}) };
    cardsOf(ctx).push(c);
    return c;
  }

  it('give: pays the price of the kind, does what the table says, belief +8, light +2', () => {
    const { ctx, st } = mk(4, { light: 100, dread: 50 });
    const life = st.life!;
    life.godFaith = 0;
    st.world.countryFlags[life.country] = ['famine', 'sandstorm'];
    const gold = life.gold;
    const c = card(ctx, 'rain');
    const r = run(ctx, 'prayer.answer', { id: c.n, answer: 'give' });
    expect(r.ok).toBe(true);
    expect(st.god.light).toBe(100 - 18 + 2);
    expect(st.world.countryFlags[life.country]).toEqual([]);
    expect(life.gold).toBe(gold + 10);
    expect(life.godFaith).toBe(8 + 0); // not a devout one
    expect(cardsOf(ctx).length).toBe(0);
    expect(st.god.chronicle.at(-1)).toMatchObject({ kind: 'prayer.give', id: 'rain' });
  });

  it('give: belief +12 for the devout (piety above 30)', () => {
    const { ctx, st } = mk(4, { light: 100, dread: 50 });
    extOf(st.life!).axes.piety = 60;
    st.life!.godFaith = 0;
    run(ctx, 'prayer.answer', { id: card(ctx, 'mother').n, answer: 'give' });
    expect(st.life!.godFaith).toBe(12);
  });

  it('refuses a gift the light cannot pay', () => {
    const { ctx, st } = mk(4, { light: 10, dread: 0 });
    const c = card(ctx, 'peace');
    const r = run(ctx, 'prayer.answer', { id: c.n, answer: 'give' });
    expect(r.ok).toBe(false);
    expect(st.god.light).toBe(10);
  });

  it('the price rises ×1.5 for the one who has turned away (belief below −30)', () => {
    const { ctx, st } = mk(4, { light: 100, dread: 0 });
    st.life!.godFaith = -40;
    const c = card(ctx, 'heal');
    const p = run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }, false);
    expect(prev(p).cost.faith).toBe(18);
  });

  it('punish: dread +6 to +10 by the kind, belief −12, the effect of the punishment', () => {
    const { ctx, st } = mk(4, { light: 50, dread: 20 });
    st.life!.godFaith = 5;
    st.life!.gold = 20;
    const c = card(ctx, 'wealth');
    run(ctx, 'prayer.answer', { id: c.n, answer: 'punish' });
    expect(st.god.dread).toBe(26);
    expect(st.life!.godFaith).toBe(5 - 12);
    expect(st.life!.gold).toBe(10);
    expect(st.life!.curses).toContain('c_poverty');
    expect(st.life!.flags).toContain('god_wronged');
    expect(gx(ctx).punishedAge).toBe(30);
    expect(gx(ctx).answered).toBe(0); // a punishment is no grant
  });

  it('deny: free, belief −3 (−1 for the devout)', () => {
    const { ctx, st } = mk(4);
    const light = st.god.light;
    run(ctx, 'prayer.answer', { id: card(ctx, 'fame').n, answer: 'deny' });
    expect(st.life!.godFaith).toBe(-3);
    expect(st.god.light).toBe(light);
    extOf(st.life!).axes.piety = 50;
    st.life!.godFaith = 0;
    run(ctx, 'prayer.answer', { id: card(ctx, 'fame').n, answer: 'deny' });
    expect(st.life!.godFaith).toBe(-1);
  });

  it('silent: the card stays until it lapses, and the lapse costs belief −2', () => {
    const { ctx, st } = mk(4);
    const c = card(ctx, 'fame');
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'silent' }).ok).toBe(true);
    expect(cardsOf(ctx).length).toBe(1);
    expect(st.life!.godFaith).toBe(0);
    st.clock.quarter = c.exp % 4;
    st.life!.hAge = Math.floor(c.exp / 4);
    prayerBeat(ctx);
    expect(cardsOf(ctx).find((x) => x.n === c.n)).toBeUndefined();
    expect(st.life!.godFaith).toBe(-2);
  });

  it('strange: three gifts that help the same matter, the player takes one, belief +5', () => {
    const { ctx, st } = mk(4, { light: 100, dread: 0 });
    const c = card(ctx, 'wealth');
    const p = prev(run(ctx, 'prayer.answer', { id: c.n, answer: 'strange', option: 0 }, false)) as { options: { id: string }[]; cost: { faith: number } };
    expect(p.options.length).toBe(3);
    expect(new Set(p.options.map((o) => o.id)).size).toBe(3);
    expect(p.cost.faith).toBe(10);
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'strange' }).ok).toBe(false); // no pick
    const pick = p.options[1].id;
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'strange', option: 1 }).ok).toBe(true);
    expect(st.life!.blessings).toContain(pick);
    expect(st.life!.godFaith).toBe(5);
    expect(st.god.light).toBe(100 - 10 + 2);
  });

  it('a preview rolls nothing and changes nothing', () => {
    const { ctx, st } = mk(4);
    const c = card(ctx, 'uncurse');
    st.life!.curses = ['c_weakarm'];
    const before = JSON.stringify(st);
    for (const answer of ['give', 'deny', 'punish', 'silent']) run(ctx, 'prayer.answer', { id: c.n, answer }, false);
    expect(JSON.stringify(st)).toBe(before);
  });

  it('npc prayers: a sick one is healed, a nemesis dies by the god; a refused punishment kills the sick one', () => {
    const { ctx, st } = mk(5, { light: 100, dread: 50 });
    const ids = Object.keys(slotsOf(st)).filter((id) => slotsOf(st)[id].status === 'alive');
    const [a, b] = ids;
    const sa = slotsOf(st)[a];
    const span = sa.span;
    run(ctx, 'prayer.answer', { id: card(ctx, 'kin_sick', a).n, answer: 'give' });
    expect(sa.span).toBeGreaterThan(span);
    expect(sa.status).toBe('alive');
    const genB = slotsOf(st)[b].gen;
    run(ctx, 'prayer.answer', { id: card(ctx, 'kin_sick', b).n, answer: 'punish' });
    expect(slotsOf(st)[b].gen).toBe(genB + 1); // the holder died, a successor holds the post
    const n = ids.find((id) => id !== a && id !== b)!;
    slotsOf(st)[n].rel['mc.grudge'] = 4;
    const genN = slotsOf(st)[n].gen;
    run(ctx, 'prayer.answer', { id: card(ctx, 'vengeance', n).n, answer: 'give' });
    expect(slotsOf(st)[n].gen).toBe(genN + 1);
    expect(npcIndex(ctx).rows.has(n)).toBe(true);
  });
});

describe('whispers', () => {
  it('nine hints, 5 light for the four cheap and 8 for the five dear, from the table', () => {
    const { ctx } = mk(6);
    expect(god.dreams.whispers.length).toBe(9);
    for (const w of god.dreams.whispers) expect(whisperPrice(ctx, w.hint), w.hint).toBe(w.cost);
  });

  it('three a life year, the same hint once a year, a hint that names something needs a target', () => {
    const { ctx, st } = mk(6);
    const l0 = st.god.light;
    expect(run(ctx, 'whisper', { hint: 'ระวัง' }).ok).toBe(true);
    expect(st.god.light).toBe(l0 - 5);
    expect(run(ctx, 'whisper', { hint: 'ระวัง' }).ok).toBe(false);
    expect(run(ctx, 'whisper', { hint: 'กล้าเถิด' }).ok).toBe(true);
    expect(run(ctx, 'whisper', { hint: 'จงอยู่' }).ok).toBe(true);
    expect(run(ctx, 'whisper', { hint: 'จุดอ่อนของศัตรู' }).ok).toBe(false); // the fourth this year
    st.life!.hAge++;
    expect(run(ctx, 'whisper', { hint: 'จงไป' }).ok).toBe(false); // names a place
    expect(run(ctx, 'whisper', { hint: 'จงไป', target: 'ZZ-99' }).ok).toBe(false);
    expect(run(ctx, 'whisper', { hint: 'จงไป', target: 'MK' }).ok).toBe(true);
    expect(run(ctx, 'whisper', { hint: 'ไม่มีคำนี้' }).ok).toBe(false);
  });

  it('a window or an age stop takes ×0.7 off, a turned-away heart ×1.5 on', () => {
    const { ctx, st } = mk(6);
    gx(ctx).window = { age: st.life!.hAge, nodes: [], stop: true, played: 0 }; // the god system sets it each life year
    expect(whisperPrice(ctx, 'ระวัง')).toBe(4); // 5 × 0.7 = 3.5, up
    expect(whisperPrice(ctx, 'ช่วย')).toBe(6); // 8 × 0.7 = 5.6, up
    gx(ctx).window = null;
    st.life!.godFaith = -40;
    expect(whisperPrice(ctx, 'ระวัง')).toBe(8); // 7.5 up
  });

  it('obeys on a base of 0.50 with the dream formula, and says only the level', () => {
    const { ctx, st } = mk(6);
    st.life!.godFaith = 0;
    st.life!.stats.int = 10;
    st.life!.skills = [];
    st.life!.blessings = [];
    expect(obeyChance(ctx, 'ระวัง').p).toBeCloseTo(0.5, 5);
    expect(obeyChance(ctx, 'ระวัง').level).toBe('ลังเล');
    st.life!.godFaith = 100;
    expect(obeyChance(ctx, 'ระวัง').p).toBeCloseTo(0.95, 5); // 0.5 + 100/140 is cut at 0.95
    st.life!.godFaith = 56;
    expect(obeyChance(ctx, 'ระวัง').p).toBeCloseTo(0.9, 5);
    expect(obeyChance(ctx, 'ระวัง').level).toBe('เต็มใจ');
    st.life!.godFaith = -100;
    expect(obeyChance(ctx, 'ระวัง').level).toBe('ขัดขืน');
    st.life!.godFaith = 0;
    st.life!.blessings = ['nb_god_whisper'];
    expect(obeyChance(ctx, 'ระวัง').p).toBeCloseTo(0.7, 5);
  });

  it('a preview does not roll', () => {
    const { ctx, st } = mk(6);
    const before = JSON.stringify(st);
    run(ctx, 'whisper', { hint: 'ระวัง' }, false);
    expect(JSON.stringify(st)).toBe(before);
  });

  it('an obeyed ระวัง weighs the safe ways ×2 for the next two decisions; กล้าเถิด the risky ways', () => {
    const { ctx, st } = mk(6);
    st.life!.godFaith = 100;
    st.life!.stats.int = 20;
    const safe: Choice = { key: 'a', weight: 50, label: 'อยู่บ้าน', effects: [], mods: [] };
    const risky: Choice = { key: 'b', weight: 50, label: 'ออกรบ', effects: [{ k: 'battle', enemies: ['goblin'] }], mods: [] };
    expect(choiceWhisperMul(ctx, safe, [safe, risky])).toBe(1);
    // with the odds at 0.95 one of a few tries is obeyed
    for (let y = 0; y < 8 && actsOf(st).whisper.active.length === 0; y++) {
      st.life!.hAge++;
      run(ctx, 'whisper', { hint: 'ระวัง' });
    }
    expect(actsOf(st).whisper.active.length).toBe(1);
    expect(choiceWhisperMul(ctx, safe, [safe, risky])).toBe(2);
    expect(choiceWhisperMul(ctx, risky, [safe, risky])).toBe(1);
    expect(choiceWhisperMul(ctx, safe, [safe, safe])).toBe(1); // all the ways alike
    decisionMade(ctx);
    expect(choiceWhisperMul(ctx, safe, [safe, risky])).toBe(2);
    decisionMade(ctx);
    expect(choiceWhisperMul(ctx, safe, [safe, risky])).toBe(1);
  });
});

describe('miracles: the table', () => {
  it('MR-01 to 16, 21, 23, 24, 25 are implemented; 17 to 20 and 22 wait for the step of the ruins', () => {
    expect(implementedMiracles()).toEqual(['MR-01', 'MR-02', 'MR-03', 'MR-04', 'MR-05', 'MR-06', 'MR-07', 'MR-08', 'MR-09', 'MR-10', 'MR-11', 'MR-12', 'MR-13', 'MR-14', 'MR-15', 'MR-16', 'MR-21', 'MR-23', 'MR-24', 'MR-25']);
    const { ctx } = mk(7);
    const r = run(ctx, 'miracle', { id: 'MR-17', country: 'AL-01' });
    expect(r.ok).toBe(false);
  });

  it('every one of MR-01 to 16 costs the table price in the right line, and waits as long as the table says', () => {
    for (const m of god.miracles.list.filter((x) => /^MR-(0\d|1[0-6])$/.test(x.id))) {
      const { ctx, st } = mk(8);
      const life = st.life!;
      const args: Record<string, unknown> = { id: m.id, country: life.country };
      if (m.id === 'MR-05') st.world.countryFlags[life.country] = ['war'];
      if (m.id === 'MR-10') st.world.countryFlags[life.country] = ['famine'];
      if (m.id === 'MR-06') {
        args.npc = Object.keys(slotsOf(st)).find((i) => slotsOf(st)[i].status === 'alive');
        delete args.country;
      }
      const pre = run(ctx, 'miracle', args, false) as { ok: boolean; reason?: string; preview?: { cost: Record<string, number> } };
      expect(pre.ok, `${m.id} ${pre.reason}`).toBe(true);
      expect(pre.preview!.cost, m.id).toEqual(m.cost.faith ? { faith: m.cost.faith } : { dread: m.cost.dread });
      const l = st.god.light;
      const d = st.god.dread;
      expect(run(ctx, 'miracle', args).ok, m.id).toBe(true);
      const paid = m.cost.faith ? l - st.god.light : d - st.god.dread;
      // a destroying miracle gives back a third of the dread it took
      const back = m.cost.dread ? Math.round(m.cost.dread / 3) : 0;
      expect(paid, m.id).toBe((m.cost.faith ?? m.cost.dread)! - back);
      // the same miracle again before its wait is over is refused; after it, it is open (the world gap of the mid tier is passed too)
      const again = run(ctx, 'miracle', args, false);
      expect(again.ok, `${m.id} again`).toBe(false);
      st.clock.worldYear += m.wait!;
      st.god.cooldowns['world.mid'] = 0;
      if (m.id === 'MR-14') actsOf(st).deeds = []; // one guardian at a time
      if (m.id === 'MR-10') st.world.countryFlags[life.country] = ['famine'];
      if (m.id === 'MR-05') st.world.countryFlags[life.country] = ['war'];
      expect(run(ctx, 'miracle', args, false).ok, `${m.id} after ${m.wait} years`).toBe(true);
    }
  });

  it('the flags and the multipliers of the table: MR-01 to 05', () => {
    const { ctx, st } = mk(8);
    const c = st.life!.country;
    st.world.countryFlags[c] = ['famine', 'plague', 'war'];
    run(ctx, 'miracle', { id: 'MR-01' });
    expect(st.world.countryFlags[c]).not.toContain('famine');
    expect(modMul(ctx, 'food', { country: c })).toBeCloseTo(0.8);
    run(ctx, 'miracle', { id: 'MR-02' });
    expect(st.world.countryFlags[c]).not.toContain('plague');
    expect(modMul(ctx, 'medicine', { country: c })).toBeCloseTo(0.7);
    run(ctx, 'miracle', { id: 'MR-03' });
    expect(st.world.countryFlags[c]).toContain('golden');
    expect(modMul(ctx, 'food', { country: c })).toBeCloseTo(0.64); // 0.8 × 0.8
    const faith = st.world.countryFaith[c];
    run(ctx, 'miracle', { id: 'MR-04' });
    expect(st.world.countryFaith[c]).toBe(Math.min(100, faith + 10));
    run(ctx, 'miracle', { id: 'MR-05' });
    expect(st.world.countryFlags[c]).not.toContain('war');
    // five years later the golden flag is gone (five years) and the food multiplier of MR-01 (two years) too
    st.clock.worldYear += 6;
    godActsSystem.worldStep!(ctx);
    expect(st.world.countryFlags[c]).not.toContain('golden');
    expect(modMul(ctx, 'food', { country: c })).toBe(1);
  });

  it('MR-07 and MR-08 set the flags, W −1; MR-08 may leave a lesser ruin', () => {
    const { ctx, st } = mk(9);
    const c = st.life!.country;
    run(ctx, 'miracle', { id: 'MR-07' });
    expect(st.world.countryFlags[c]).toContain('plague');
    expect(modMul(ctx, 'medicine', { country: c })).toBe(3);
    expect(modAdd(ctx, 'W', { country: c })).toBe(-1);
    run(ctx, 'miracle', { id: 'MR-08' });
    expect(st.world.countryFlags[c]).toContain('famine');
    expect(modAdd(ctx, 'W', { country: c })).toBe(-2);
    st.clock.worldYear += 3;
    godActsSystem.worldStep!(ctx);
    expect(modAdd(ctx, 'W', { country: c })).toBe(-1); // MR-07's two years are over, MR-08's five are not
    expect(st.world.countryFlags[c]).not.toContain('plague');
  });

  it('MR-08 leaves a lesser ruin in about one case in five', () => {
    let ruins = 0;
    const n = 120;
    for (let i = 0; i < n; i++) {
      const { ctx, st } = mk(100 + i);
      run(ctx, 'miracle', { id: 'MR-08' });
      ruins += st.world.ruins.length;
    }
    expect(ruins / n).toBeGreaterThan(0.1);
    expect(ruins / n).toBeLessThan(0.32);
  });

  it('MR-09 to 16: the multipliers, the cap of W +4, the guardian, the monster, the hidden thing', () => {
    const { ctx, st } = mk(10);
    const c = st.life!.country;
    const k = c.slice(0, 2);
    st.god.cooldowns = {};
    const go = (id: string, args: Record<string, unknown> = {}) => {
      st.god.cooldowns['world.mid'] = 0;
      st.god.light = 200;
      st.god.dread = 200;
      return run(ctx, 'miracle', { id, ...args });
    };
    expect(go('MR-09').ok).toBe(true);
    expect(modMul(ctx, 'sea', { continent: k })).toBe(2);
    expect(modAdd(ctx, 'C', { continent: k })).toBe(-5);
    expect(go('MR-10').ok).toBe(false); // not a desert and no drought here
    st.world.countryFlags[c] = ['famine'];
    for (let i = 0; i < 4; i++) {
      st.life!.hAge = 30;
      lifeCounters(ctx).mid = 0; // the cap of the life is not what this checks
      st.god.cooldowns['MR-10'] = 0;
      expect(go('MR-10').ok, `fountain ${i}`).toBe(true);
    }
    expect(modAdd(ctx, 'W', { country: c })).toBe(4);
    lifeCounters(ctx).mid = 0;
    st.god.cooldowns['MR-10'] = 0;
    expect(go('MR-10').ok).toBe(false); // W +4 is the most
    lifeCounters(ctx).mid = 0;
    expect(go('MR-11').ok).toBe(true);
    expect(modMul(ctx, 'wood', { country: c })).toBeCloseTo(0.7);
    lifeCounters(ctx).mid = 0;
    expect(go('MR-12').ok).toBe(true);
    expect(modMul(ctx, 'food', { country: c })).toBe(3);
    lifeCounters(ctx).mid = 0;
    expect(go('MR-13').ok).toBe(true);
    expect(modMul(ctx, 'wood', { country: c })).toBeCloseTo(1.4); // 0.7 × 2
    lifeCounters(ctx).mid = 0;
    expect(go('MR-14').ok).toBe(true);
    expect(modAdd(ctx, 'defense', { country: c })).toBe(2);
    expect(actsOf(st).deeds.some((d) => d.kind === 'guardian' && d.country === c)).toBe(true);
    st.god.cooldowns['MR-14'] = 0;
    lifeCounters(ctx).mid = 0;
    expect(go('MR-14').ok).toBe(false); // one guardian at a time
    lifeCounters(ctx).mid = 0;
    expect(go('MR-15').ok).toBe(true);
    expect(st.world.countryFlags[c]).toContain('war');
    expect(modMul(ctx, 'mercenary', { country: c })).toBe(2);
    expect(actsOf(st).deeds.some((d) => d.kind === 'monster')).toBe(true);
    lifeCounters(ctx).mid = 0;
    expect(go('MR-16').ok).toBe(true);
    const hidden = actsOf(st).deeds.find((d) => d.kind === 'hidden')!;
    expect(['R', 'E']).toContain(hidden.data!.tier);
  });

  it('MR-06 kills or gravely hurts one NPC, never an ally of the character, and the post gets a successor', () => {
    const { ctx, st } = mk(11);
    const ids = Object.keys(slotsOf(st)).filter((i) => slotsOf(st)[i].status === 'alive');
    slotsOf(st)[ids[0]].rel['mc.ally'] = 1;
    expect(run(ctx, 'miracle', { id: 'MR-06', npc: ids[0] }).ok).toBe(false);
    let dead = 0;
    let hurt = 0;
    for (let i = 0; i < 60; i++) {
      const g = mk(200 + i);
      const target = Object.keys(slotsOf(g.st)).find((x) => slotsOf(g.st)[x].status === 'alive')!;
      const gen = slotsOf(g.st)[target].gen;
      run(g.ctx, 'miracle', { id: 'MR-06', npc: target });
      if (slotsOf(g.st)[target].gen > gen || slotsOf(g.st)[target].status !== 'alive') dead++;
      else hurt++;
      expect(g.st.life!.dead).toBeUndefined(); // iron rule 1
    }
    expect(dead + hurt).toBe(60);
    expect(dead).toBeGreaterThan(15);
    expect(hurt).toBeGreaterThan(15);
  });
});

describe('miracles: caps and waits', () => {
  it('the mid tier: four a life, one in five world years', () => {
    const { ctx, st } = mk(12);
    const ids = ['MR-01', 'MR-02', 'MR-03', 'MR-04']; // small ones do not count
    for (const id of ids) expect(run(ctx, 'miracle', { id }).ok, id).toBe(true);
    expect(lifeCounters(ctx).mid).toBe(0);
    const mid = ['MR-09', 'MR-11', 'MR-13', 'MR-12'];
    for (const id of mid) {
      const r = run(ctx, 'miracle', { id });
      expect(r.ok, id).toBe(true);
      const again = run(ctx, 'miracle', { id: id === 'MR-09' ? 'MR-11' : 'MR-09' }, false);
      expect(again.ok, `${id} then another within five years`).toBe(false);
      st.clock.worldYear += 5;
    }
    expect(lifeCounters(ctx).mid).toBe(4);
    st.clock.worldYear += 100;
    const fifth = run(ctx, 'miracle', { id: 'MR-14' }, false);
    expect(fifth.ok).toBe(false);
    expect((fifth as { reason: string }).reason).toContain('4');
    // a new life starts the counters again
    st.life!.id = 'L2';
    expect(run(ctx, 'miracle', { id: 'MR-14' }, false).ok).toBe(true);
  });

  it('the small tier has no cap, only its own wait', () => {
    const { ctx, st } = mk(12);
    for (let i = 0; i < 8; i++) {
      expect(run(ctx, 'miracle', { id: 'MR-01' }).ok, `${i}`).toBe(true);
      st.clock.worldYear += 5;
    }
  });

  it('light and dread must be there; a price paid in the other line costs belief once in a life year', () => {
    const { ctx, st } = mk(12, { light: 50, dread: 100 });
    expect(run(ctx, 'miracle', { id: 'MR-01' }).ok).toBe(true);
    st.life!.godFaith = 0; // the believer who saw the rain is set back to nought
    expect(run(ctx, 'miracle', { id: 'MR-07' }).ok).toBe(true); // dread after light in the same life year: belief −4, and −10 for the plague he saw
    expect(st.life!.godFaith).toBe(-4 - 10);
    st.god.light = 0;
    expect(run(ctx, 'miracle', { id: 'MR-02' }, false).ok).toBe(false);
  });

  it('belief above 60 raises the dread price ×1.2; below −30 the light price ×1.5', () => {
    const { ctx, st } = mk(12);
    st.life!.godFaith = 61;
    expect(prev(run(ctx, 'miracle', { id: 'MR-07' }, false)).cost.dread).toBe(24);
    st.life!.godFaith = -31;
    expect(prev(run(ctx, 'miracle', { id: 'MR-01' }, false)).cost.faith).toBe(23); // 22.5 up
  });

  it('without a living character nothing is done', () => {
    const { ctx, st } = mk(12);
    st.life!.dead = { year: 1, hAge: 30, cause: 'test' };
    expect(run(ctx, 'miracle', { id: 'MR-01' }).ok).toBe(false);
    expect(run(ctx, 'whisper', { hint: 'ระวัง' }).ok).toBe(false);
  });
});

describe('miracles: the world answers (04-miracles.md §6)', () => {
  it('create small +5, mid +10 and +3 next door; destroy small −5, mid −10 and −3; a third of the dread comes back; the character who sees it believes', () => {
    const { ctx, st } = mk(13);
    const c = st.life!.country;
    const f0 = st.world.countryFaith[c];
    st.life!.godFaith = 0;
    run(ctx, 'miracle', { id: 'MR-01' });
    expect(st.world.countryFaith[c]).toBe(Math.min(100, f0 + 5));
    expect(st.life!.godFaith).toBe(5);
    const f1 = st.world.countryFaith[c];
    st.clock.worldYear += 30;
    const d0 = st.god.dread;
    run(ctx, 'miracle', { id: 'MR-07' }); // destroy small
    expect(st.world.countryFaith[c]).toBe(f1 - 5);
    expect(st.god.dread).toBe(d0 - 20 + Math.round(20 / 3));
    expect(st.life!.godFaith).toBeLessThanOrEqual(5 - 10 + 5); // −10 for seeing it, +5 earlier; the lesser blow of the switch of line
    // a mid destroy hurts the neighbours too
    const nb = Object.keys(st.world.countryFaith).filter((x) => x !== c && x.slice(0, 2) === c.slice(0, 2));
    const n0 = Object.fromEntries(nb.map((x) => [x, st.world.countryFaith[x]]));
    run(ctx, 'miracle', { id: 'MR-13' });
    let moved = 0;
    for (const x of nb) if (st.world.countryFaith[x] < n0[x]) moved++;
    expect(moved).toBeGreaterThan(0);
  });

  it('the character is never killed by a miracle, only hurt (iron rule 1)', () => {
    let hurt = 0;
    for (let i = 0; i < 80; i++) {
      const { ctx, st } = mk(300 + i);
      run(ctx, 'miracle', { id: 'MR-13' });
      run(ctx, 'miracle', { id: 'MR-07' });
      expect(st.life!.dead).toBeUndefined();
      if (st.life!.flags.includes('wounded')) hurt++;
    }
    expect(hurt).toBeGreaterThan(0);
  });
});

describe('the dragons: MR-23 and MR-24 (mood only)', () => {
  it('±10 on the mood of one dragon, never above the cap, never a death; 50 years before the same dragon again', () => {
    const { ctx, st } = mk(14);
    const d = st.world.dragons;
    const i = d.findIndex((x) => x.alive);
    d[i].mood = 40;
    expect(run(ctx, 'miracle', { id: 'MR-23', dragon: i }).ok).toBe(true);
    expect(d[i].mood).toBeCloseTo(50);
    expect(st.god.light).toBe(200 - 40);
    expect(run(ctx, 'miracle', { id: 'MR-24', dragon: i }, false).ok).toBe(false); // either one: the dragon rests 50 years
    expect(run(ctx, 'miracle', { id: 'MR-23', dragon: i }, false).ok).toBe(false);
    const j = d.findIndex((x, k) => x.alive && k !== i);
    d[j].mood = 40;
    const dread = st.god.dread;
    expect(run(ctx, 'miracle', { id: 'MR-24', dragon: j }).ok).toBe(true);
    expect(d[j].mood).toBeCloseTo(30);
    expect(d[j].alive).toBe(true);
    expect(st.god.dread).toBe(dread - 40 + Math.round(40 / 3)); // the provoking returns a third
    st.clock.worldYear += 50;
    expect(run(ctx, 'miracle', { id: 'MR-23', dragon: i }, false).ok).toBe(true);
    // the cap
    const cap = 100 - 3 * st.world.dfc;
    d[i].mood = cap - 4;
    st.clock.worldYear += 50;
    run(ctx, 'miracle', { id: 'MR-23', dragon: i });
    expect(d[i].mood).toBe(cap);
    // a dragon that fell cannot be reached
    d[j].alive = false;
    expect(run(ctx, 'miracle', { id: 'MR-23', dragon: j }, false).ok).toBe(false);
    expect(run(ctx, 'miracle', { id: 'MR-23' }, false).ok).toBe(false);
  });
});

describe('MR-25 ลิขิต', () => {
  /** A dragon near its fall: low mood, so its fall event shows an omen. */
  function omen(seed = 15) {
    const g = mk(seed);
    g.st.world.era = 4;
    g.st.world.dragons.forEach((d, k) => (d.mood = k === 3 ? 5 : 60));
    return g;
  }

  it('is paid by the table: the price × |1 − multiplier|, at least half; light to slow, dread to speed', () => {
    const { ctx } = mk(15);
    expect(fateCost(ctx, '⭐', 0.5)).toEqual({ faith: 30 });
    expect(fateCost(ctx, '⭐', 0.2)).toEqual({ faith: 48 });
    expect(fateCost(ctx, '⭐', 0.9)).toEqual({ faith: 30 }); // not under half
    expect(fateCost(ctx, '●', 2)).toEqual({ dread: 30 });
    expect(fateCost(ctx, '●', 3)).toEqual({ dread: 60 });
    expect(fateCost(ctx, '○', 1.1)).toEqual({ dread: 8 }); // half of 15, up
    expect(fateCost(ctx, '○', 0.4)).toEqual({ faith: 9 });
  });

  it('bends the weight of a dragon fall that shows an omen, for ten world years', () => {
    const { ctx, st } = omen();
    const t = fateTargets(ctx).find((x) => x.dragon === 3)!;
    expect(t).toBeDefined();
    expect(weightOf(ctx, t.id)).toBe(1);
    const light = st.god.light;
    const r = run(ctx, 'decree', { dragon: 3, mul: 0.5 });
    expect(r.ok).toBe(true);
    expect(st.god.light).toBeLessThan(light);
    expect(weightOf(ctx, t.id)).toBe(0.5);
    expect(actsOf(st).fates[t.id].mul).toBe(0.5);
    st.clock.worldYear += 11;
    expect(weightOf(ctx, t.id)).toBe(1);
  });

  it('a dragon fall: slow to ×0.5 at the least, speed to ×2 at the most; other events to ×0.2 and ×3', () => {
    const { ctx } = omen();
    const t = fateTargets(ctx).find((x) => x.dragon === 3)!;
    expect(run(ctx, 'decree', { event: t.id, mul: 0.4 }, false).ok).toBe(false);
    expect(run(ctx, 'decree', { event: t.id, mul: 2.5 }, false).ok).toBe(false);
    expect(run(ctx, 'decree', { event: t.id, mul: 1 }, false).ok).toBe(false);
    expect(run(ctx, 'decree', { event: t.id, mul: 2 }, false).ok).toBe(true);
    expect(run(ctx, 'decree', { event: t.id, mul: 0.5 }, false).ok).toBe(true);
    expect(run(ctx, 'decree', { event: t.id, mul: 0.1 }, false).ok).toBe(false); // outside every range
  });

  it('one fate to an event, none on an ending or on an event with no omen, and the power must be there', () => {
    const { ctx, st } = omen();
    const t = fateTargets(ctx).find((x) => x.dragon === 3)!;
    expect(run(ctx, 'decree', { event: t.id, mul: 2 }).ok).toBe(true);
    expect(run(ctx, 'decree', { event: t.id, mul: 0.5 }, false).ok).toBe(false); // no stacking
    expect(run(ctx, 'decree', { event: 'END-10', mul: 2 }, false).ok).toBe(false);
    expect(run(ctx, 'decree', { event: 'XX-99', mul: 2 }, false).ok).toBe(false);
    for (const x of fateTargets(ctx)) expect(x.id.startsWith('END')).toBe(false);
    st.god.dread = 0;
    const t2 = fateTargets(ctx).find((x) => x.id !== t.id);
    if (t2) expect(run(ctx, 'decree', { event: t2.id, mul: 2 }, false).ok).toBe(false);
  });

  it('an event ⭐ or ● that could happen at the next roll can be bent with the weight the world reads', () => {
    const { ctx, st } = mk(16);
    st.world.era = 2;
    const ts = fateTargets(ctx).filter((x) => x.dragon === undefined);
    expect(ts.length).toBeGreaterThan(0);
    const t = ts[0];
    const r = run(ctx, 'miracle', { id: 'MR-25', event: t.id, mul: 3 });
    expect(r.ok).toBe(true);
    expect(weightOf(ctx, t.id)).toBe(3);
  });
});

describe('MR-21 and GD-04', () => {
  it('needs 120 light, spends it all, opens GD-04 at once (world faith +30) and puts the light sword in the hand of the one who sees', () => {
    const { g, ctx, st } = mk(17, { light: 110, dread: 0 });
    expect(run(ctx, 'miracle', { id: 'MR-21' }, false).ok).toBe(false);
    st.god.light = 150;
    const f = st.world.vars.F;
    const r = run(ctx, 'miracle', { id: 'MR-21' });
    expect(r.ok).toBe(true);
    expect(st.god.light).toBe(0);
    expect(st.world.happened['GD-04']).toBeUndefined(); // the omen: a season
    expect(actsOf(st).pending.length).toBe(1);
    g.beat();
    expect(st.world.happened['GD-04']).toBeDefined();
    expect(st.world.vars.F).toBe(f + 30);
    expect(st.life!.items).toContain('wl_light_sword');
    expect(run(ctx, 'miracle', { id: 'MR-21' }, false).ok).toBe(false); // once
  });

  it('GD-04 and GD-05 open only through the god: world faith above 90 opens the first, a god who never answers opens the second', () => {
    const { ctx, st } = mk(18);
    expect(silent(ctx)).toBe(false);
    const a = actsOf(st);
    a.lapsed = [100, 105, 110, 115, 118];
    st.clock.worldYear = 130;
    expect(silent(ctx)).toBe(true);
    a.lastAnswer = 125;
    expect(silent(ctx)).toBe(false);
  });
});

describe('omens', () => {
  it('a miracle with an omen is paid now and happens the season after; cancelling gives back half', () => {
    const was = { ...OMEN };
    OMEN.mid = 1;
    try {
      const { g, ctx, st } = mk(19);
      const c = st.life!.country;
      st.world.countryFlags[c] = [];
      const light = st.god.light;
      expect(run(ctx, 'miracle', { id: 'MR-11' }).ok).toBe(true);
      expect(st.god.light).toBeLessThan(light);
      expect(actsOf(st).pending.length).toBe(1);
      expect(modMul(ctx, 'wood', { country: c })).toBe(1);
      g.beat();
      expect(actsOf(st).pending.length).toBe(0);
      expect(modMul(ctx, 'wood', { country: c })).toBeCloseTo(0.7);
      expect(st.log.some((e) => e.kind === 'miracle.omen')).toBe(true);
      // cancel
      st.clock.worldYear += 40;
      st.god.cooldowns['world.mid'] = 0;
      const l1 = st.god.light;
      run(ctx, 'miracle', { id: 'MR-13' });
      const paid = l1 - st.god.light;
      const dread = st.god.dread;
      const n = actsOf(st).pending[0].n;
      const p = run(ctx, 'miracle', { cancel: n }, false) as unknown as { preview: { refund: { dread: number } } };
      expect(p.preview.refund.dread).toBe(15);
      run(ctx, 'miracle', { cancel: n });
      expect(actsOf(st).pending.length).toBe(0);
      expect(st.god.dread).toBeGreaterThan(dread);
    } finally {
      Object.assign(OMEN, was);
    }
  });

  it('by the docs the small and mid miracles have no omen, the large ones have one season', () => {
    expect(OMEN.small).toBe(0);
    expect(OMEN.mid).toBe(0);
    expect(OMEN.big).toBe(1);
    expect(OMEN.grand).toBe(1);
  });
});

describe('the commands', () => {
  it('a command without confirm shows the preview, rolls nothing and changes nothing; the chronicle and the log follow a confirm', () => {
    const { ctx, st } = mk(20);
    const before = JSON.stringify(st);
    const p = run(ctx, 'miracle', { id: 'MR-01' }, false);
    expect(p.ok).toBe(true);
    expect(JSON.stringify(st)).toBe(before);
    const r = run(ctx, 'miracle', { id: 'MR-01' });
    expect(r.ok && r.log.some((e) => e.sys === 'god' && e.kind === 'miracle')).toBe(true);
    expect(st.god.chronicle.at(-1)).toMatchObject({ kind: 'miracle', id: 'MR-01', target: st.life!.country });
    expect(st.god.chronicle.at(-1)!.worldYear).toBe(st.clock.worldYear);
    expect(st.god.chronicle.at(-1)!.hAge).toBe(30);
  });
});

describe('one payer: the acts pay through god/power.ts', () => {
  it('using the other power line in the same life year costs belief once, −4, however many files pay (a whisper in light, a miracle in dread)', () => {
    const { ctx, st } = mk(31, { light: 100, dread: 100 });
    const life = st.life!;
    life.hAge = 30;
    st.god.counters = {};
    const country = life.country;
    expect(run(ctx, 'whisper', { hint: 'จงอยู่' }).ok).toBe(true);
    expect(count(ctx, 'l.switch')).toBe(0);
    expect(run(ctx, 'miracle', { id: 'MR-07', country }).ok).toBe(true);
    expect(count(ctx, 'l.switch')).toBe(4);
    expect(st.log.filter((e) => e.sys === 'god' && e.kind === 'belief' && e.id === 'switch-line').map((e) => e.data.delta)).toEqual([-4]);
    // light again in the same year: a second switch, −4 more
    expect(run(ctx, 'whisper', { hint: 'ระวัง' }).ok).toBe(true);
    expect(count(ctx, 'l.switch')).toBe(8);
    expect(st.log.filter((e) => e.sys === 'god' && e.kind === 'belief' && e.id === 'switch-line')).toHaveLength(2);
  });

  it('the price of a prayer, a whisper and a miracle carries the window, the turned-away heart and the heart that fears (one table)', () => {
    const { ctx, st } = mk(32, { light: 100, dread: 100 });
    st.life!.godFaith = -40;
    expect(grantPrice(ctx, kindOf(ctx, 'wealth')!)).toBe(Math.ceil(kindOf(ctx, 'wealth')!.grantCost * 1.5 - 1e-9));
    st.life!.godFaith = 70;
    const m = run(ctx, 'miracle', { id: 'MR-07', country: st.life!.country }, false);
    expect(prev(m).cost.dread).toBe(Math.ceil(20 * 1.2 - 1e-9));
    // the window is the god system's flag, set each life year
    st.life!.godFaith = 0;
    gx(ctx).window = { age: st.life!.hAge, nodes: [], stop: true, played: 0 };
    expect(whisperPrice(ctx, 'ช่วย')).toBe(6);
    const q = run(ctx, 'miracle', { id: 'MR-07', country: st.life!.country }, false);
    expect(prev(q).cost.dread).toBe(20); // a miracle gets no window price
  });

  it('a prayer is not raised while the attention system holds two waiting', () => {
    const { ctx, st } = mk(33);
    const life = st.life!;
    life.hAge = 30;
    st.world.countryFlags[life.country] = ['famine', 'plague'];
    const mem = life.ext.attention as { queue: { kind: string }[] };
    mem.queue.push({ kind: 'prayer' }, { kind: 'prayer' });
    for (let i = 0; i < 200; i++) {
      st.clock.quarter = (st.clock.quarter + 1) % 4;
      if (st.clock.quarter === 0) life.hAge++;
      prayerBeat(ctx);
    }
    expect(cardsOf(ctx)).toHaveLength(0);
    mem.queue.length = 0;
    for (let i = 0; i < 200 && cardsOf(ctx).length === 0; i++) {
      st.clock.quarter = (st.clock.quarter + 1) % 4;
      if (st.clock.quarter === 0) life.hAge++;
      prayerBeat(ctx);
    }
    expect(cardsOf(ctx).length).toBeGreaterThan(0);
  });
});

describe('the policies', () => {
  function withCards(ctx: Game['ctx'], kinds: string[]) {
    const a = actsOf(ctx.state);
    // the matters are true for him (a card whose matter is not true is taken back): poor, and wanting a name
    ctx.state.life!.gold = 5;
    ctx.state.life!.cls = 'c2';
    extOf(ctx.state.life!).axes.ambition = 40;
    const tick = 30 * 4;
    for (const k of kinds) cardsOf(ctx).push({ n: ++a.prayerN, kind: k, tick, exp: tick + 14, year: ctx.state.clock.worldYear });
  }

  it('เงียบ answers nothing; เมตตา and เก็บพลัง give; ลงโทษ punishes; สุ่ม does a bit of everything', () => {
    for (const [policy, expect_] of [['เงียบ', 'none'], ['เมตตา', 'give'], ['เก็บพลัง', 'give'], ['ให้ของ', 'give'], ['ลงโทษ', 'punish']] as const) {
      const { ctx, st } = mk(21);
      withCards(ctx, ['wealth', 'fame']);
      actsPolicyStep(ctx, policy, 'beat');
      const kinds = st.god.chronicle.map((c) => c.kind);
      if (expect_ === 'none') expect(kinds).toEqual([]);
      if (expect_ === 'give') expect(kinds.filter((k) => k === 'prayer.give').length).toBe(2);
      if (expect_ === 'punish') expect(kinds.filter((k) => k === 'prayer.punish').length).toBe(2);
    }
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { ctx, st } = mk(400 + i);
      withCards(ctx, ['wealth']);
      actsPolicyStep(ctx, 'สุ่ม', 'beat');
      seen.add(st.god.chronicle.at(-1)?.kind ?? 'left');
    }
    expect(seen.has('prayer.give')).toBe(true);
    expect(seen.has('prayer.deny')).toBe(true);
    expect(seen.has('prayer.punish')).toBe(true);
    expect(seen.has('left')).toBe(true);
  });

  it('เมตตา soothes the dragon of the lowest mood and slows the fall of one with an omen; เร่งจบ provokes and speeds', () => {
    const a = mk(22);
    a.st.world.dragons.forEach((d, k) => (d.mood = k === 4 ? 30 : 80));
    actsPolicyStep(a.ctx, 'เมตตา', 'world');
    expect(a.st.world.dragons[4].mood).toBeCloseTo(40);
    const b = mk(22);
    b.st.world.dragons.forEach((d, k) => (d.mood = k === 4 ? 30 : 80));
    actsPolicyStep(b.ctx, 'เร่งจบ', 'world');
    expect(b.st.world.dragons[4].mood).toBeCloseTo(20);
    const c = mk(23);
    c.st.world.era = 4;
    c.st.world.dragons.forEach((d, k) => (d.mood = k === 3 ? 5 : 80));
    actsPolicyStep(c.ctx, 'เร่งจบ', 'world');
    const t = fateTargets(c.ctx).find((x) => x.dragon === 3)!;
    expect(weightOf(c.ctx, t.id)).toBe(2);
    const d = mk(23);
    d.st.world.era = 4;
    d.st.world.dragons.forEach((dr, k) => (dr.mood = k === 3 ? 5 : 80));
    actsPolicyStep(d.ctx, 'เมตตา', 'world');
    expect(weightOf(d.ctx, t.id)).toBe(0.5);
  });

  it('the policy step is deterministic: the same seed, the same hand', () => {
    const play = () => {
      const { g, ctx, st } = mk(24, { light: 120, dread: 60 });
      for (let i = 0; i < 160; i++) {
        g.beat();
        actsPolicyStep(ctx, 'เมตตา', 'beat');
      }
      return JSON.stringify([st.god.chronicle, st.god.light, st.life?.godFaith]);
    };
    expect(play()).toBe(play());
  });
});

// ---------- M2 review G5 M1 M3 L1 L4 L5 ----------

describe('prayers follow the state of the character (M2 review G5 L5)', () => {
  const put = (ctx: Game['ctx'], kind: string, npc?: string) => {
    const a = actsOf(ctx.state);
    const tick = ctx.state.life!.hAge * 4 + ctx.state.clock.quarter;
    const c = { n: ++a.prayerN, kind, tick, exp: tick + 14, year: ctx.state.clock.worldYear, ...(npc ? { npc } : {}) };
    cardsOf(ctx).push(c);
    return c;
  };

  it('the ruling class does not pray to be rid of poverty, however empty the purse', () => {
    const { ctx, st } = mk(31);
    st.life!.gold = 3;
    st.life!.cls = 'c3';
    expect(holdsKind(ctx, 'wealth')).toBe(true);
    st.life!.cls = 'c4';
    expect(holdsKind(ctx, 'wealth')).toBe(true);
    st.life!.cls = 'c5';
    expect(holdsKind(ctx, 'wealth')).toBe(false);
  });

  it('a prayer whose matter is gone is taken back at the next beat without a word against the god, and cannot be answered before', () => {
    const { ctx, st } = mk(32);
    st.life!.curses = ['c_weakarm'];
    const c = put(ctx, 'uncurse');
    st.life!.curses = []; // the curse was lifted by other means
    const belief = st.life!.godFaith;
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }, false)).toMatchObject({ ok: false });
    expect((run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }, false) as { reason?: string }).reason ?? '').toContain('ไม่ต้องตอบแล้ว');
    prayerBeat(ctx);
    expect(cardsOf(ctx).some((x) => x.n === c.n)).toBe(false);
    expect(st.life!.godFaith).toBe(belief); // he was not ignored
    expect(st.log.some((e) => e.sys === 'god' && e.kind === 'prayer.moot' && e.data.n === c.n)).toBe(true);
    expect(st.log.some((e) => e.sys === 'god' && e.kind === 'prayer.lapse' && e.data.n === c.n)).toBe(false);
    expect(st.god.chronicle.some((x) => x.kind === 'prayer.moot')).toBe(false); // taking a prayer back is no deed of the hand
    // the number says what became of it
    expect(JSON.stringify(run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }, false))).toContain('เลิกมีความหมาย');
  });

  it('the one who asked is dead: the prayer cannot be answered (no light paid, no word that he was healed) and goes away', () => {
    const { ctx, st } = mk(33, { light: 100, dread: 0 });
    const ids = Object.keys(slotsOf(st)).filter((id) => slotsOf(st)[id].status === 'alive');
    const id = ids[0];
    const slot = slotsOf(st)[id];
    slot.rel['mc.known'] = 9;
    slot.born = st.clock.worldYear - slot.span;
    const c = put(ctx, 'kin_sick', id);
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }, false).ok).toBe(true);
    slot.status = 'dead';
    const light = st.god.light;
    const belief = st.life!.godFaith;
    expect(run(ctx, 'prayer.answer', { id: c.n, answer: 'give' }).ok).toBe(false);
    expect(st.god.light).toBe(light);
    expect(st.life!.godFaith).toBe(belief);
    prayerBeat(ctx);
    expect(cardsOf(ctx).some((x) => x.n === c.n)).toBe(false);
    expect(st.log.find((e) => e.kind === 'prayer.moot' && e.data.n === c.n)!.data.why).toBe('ผู้ขอตายไปแล้ว');
  });

  it('a prayer is not answerable at the tick it runs out, and the answer to a lapsed card says it lapsed (not that there never was one)', () => {
    const { ctx, st } = mk(34);
    st.life!.gold = 3;
    const c = put(ctx, 'wealth');
    st.clock.quarter = c.exp % 4;
    st.life!.hAge = Math.floor(c.exp / 4);
    const at = JSON.stringify(run(ctx, 'prayer.answer', { id: c.n, answer: 'deny' }, false));
    expect(at).toContain('หมดเวลาแล้ว');
    prayerBeat(ctx);
    expect(cardsOf(ctx).some((x) => x.n === c.n)).toBe(false);
    expect(JSON.stringify(run(ctx, 'prayer.answer', { id: c.n, answer: 'deny' }, false))).toContain('หมดเวลาไปแล้ว');
    expect(JSON.stringify(run(ctx, 'prayer.answer', { id: 9999, answer: 'deny' }, false))).toContain('ไม่มีคำอธิษฐานใบนั้น');
    const d = put(ctx, 'wealth');
    run(ctx, 'prayer.answer', { id: d.n, answer: 'deny' });
    expect(JSON.stringify(run(ctx, 'prayer.answer', { id: d.n, answer: 'deny' }, false))).toContain('ตอบคำอธิษฐานใบนั้นไปแล้ว');
  });

  it('the log of a prayer carries how many of its kind this life had and what came just before, so the words can differ from the last one', () => {
    let again = 0;
    let seen = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { g, st } = mk(seed);
      for (let i = 0; i < 4 * 30 && st.life && !st.life.dead; i++) g.beat();
      const prayers = st.log.filter((e) => e.sys === 'god' && e.kind === 'prayer');
      prayers.forEach((e, i) => {
        expect(e.data.seen).toBe(prayers.slice(0, i).filter((x) => x.id === e.id).length);
        if (i === 0) expect(e.data.prev).toBeUndefined();
        else expect(e.data.prev).toBe(prayers[i - 1].id);
        if (e.data.again) again++;
        seen++;
      });
    }
    expect(seen).toBeGreaterThan(10);
    expect(again).toBeLessThan(seen);
  });

  it('no prayer is raised once the scene before the end has begun', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { g, st } = mk(seed);
      st.life!.hAge = 0;
      for (let i = 0; i < 4 * 80 && st.life && !st.life.dead; i++) g.beat();
      const near = st.log.find((e) => e.sys === 'attention' && e.kind === 'call' && (e.data.why === 'nearDeath' || e.data.why === 'death'));
      if (!near) continue;
      expect(st.log.some((e) => e.n > near.n && e.sys === 'god' && e.kind === 'prayer')).toBe(false);
    }
  });
});

describe('the strange answer draws from the pool of the chest (M2 review M1)', () => {
  it('every gift offered passes the filter of the chest, and the tiers follow the odds of the chest: a small prayer does not buy a rare blessing at its price', () => {
    const tiers: Record<string, number> = {};
    let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { ctx, st } = mk(seed, { light: 100, dread: 0 });
      const pool = new Set(blessingPool(ctx).map((b: { id: string }) => b.id));
      st.life!.gold = 3;
      const a = actsOf(st);
      const tick = st.life!.hAge * 4;
      const c = { n: ++a.prayerN, kind: 'wealth', tick, exp: tick + 14, year: st.clock.worldYear };
      for (const o of strangeOptions(ctx, c)) {
        expect(pool.has(o.id), `${o.id} not in the pool of the chest`).toBe(true);
        tiers[o.tier] = (tiers[o.tier] ?? 0) + 1;
        n++;
      }
      expect(new Set(strangeOptions(ctx, c).map((o) => o.id)).size).toBe(strangeOptions(ctx, c).length);
      expect(JSON.stringify(strangeOptions(ctx, c))).toBe(JSON.stringify(strangeOptions(ctx, c)));
    }
    expect(n).toBeGreaterThan(100);
    // before: 30% of the gifts were R; the chest gives R to about one gift in ten
    expect((tiers.R ?? 0) / n).toBeLessThan(0.15);
    expect((tiers.C ?? 0) + (tiers.U ?? 0)).toBeGreaterThan(n * 0.8);
  });

  it('nothing the race of the character forbids, nothing of another people, nothing that is already his', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { ctx, st } = mk(seed, { light: 100, dread: 0 });
      const life = st.life!;
      const a = actsOf(st);
      const tick = life.hAge * 4;
      const c = { n: ++a.prayerN, kind: 'mother', tick, exp: tick + 14, year: st.clock.worldYear };
      const race = idx(ctx).races.get(life.race);
      for (const o of strangeOptions(ctx, c)) {
        expect(race?.blessClash ?? []).not.toContain(o.id);
        expect(life.blessings).not.toContain(o.id);
        expect(idx(ctx).gifts.get(o.id)?.race ?? life.race).toBe(life.race);
      }
    }
  });
});

describe('previews tell the truth about the price and the right (M2 review M3 L4)', () => {
  it('cancelling the omen of MR-21 warns that the right of a great miracle is spent and stays spent', () => {
    const { ctx, st } = mk(35, { light: 150, dread: 0 });
    expect(run(ctx, 'miracle', { id: 'MR-21' }).ok).toBe(true);
    const n = actsOf(st).pending[0].n;
    const p = prev(run(ctx, 'miracle', { cancel: n }, false)) as { refund: { faith: number }; warn: string[]; spent: boolean };
    expect(p.spent).toBe(true);
    expect(p.warn.join(' ')).toContain('มหา');
    expect(p.refund.faith).toBeGreaterThan(0);
    run(ctx, 'miracle', { cancel: n });
    expect(run(ctx, 'miracle', { id: 'MR-21' }, false).ok).toBe(false); // what the warning said
  });

  it('the preview of a miracle that gives back a third of the dread shows what returns and the price after it', () => {
    const { ctx, st } = mk(36, { light: 100, dread: 100 });
    const p = prev(run(ctx, 'miracle', { id: 'MR-07' }, false)) as { cost: { dread: number }; back: { dread: number }; net: { dread: number } };
    expect(p.back.dread).toBe(Math.round(p.cost.dread / 3));
    expect(p.net.dread).toBe(p.cost.dread - p.back.dread);
    const before = st.god.dread;
    run(ctx, 'miracle', { id: 'MR-07' });
    expect(before - st.god.dread).toBe(p.net.dread); // the net is what the god really pays
    const q = prev(run(ctx, 'miracle', { id: 'MR-01' }, false)) as Record<string, unknown>;
    expect(q.back).toBeUndefined(); // a gift of light gives nothing back
  });
});

describe('a truce on a fated event keeps one weight with the floor of the fate (M2 review L1)', () => {
  it('MR-05 on top of a slowing ×0.2 does not go below 0.2, and the fate does not end sooner', () => {
    const { ctx, st } = mk(37, { light: 200, dread: 200 });
    const country = st.life!.country;
    st.world.countryFlags[country] = ['war'];
    const war = fateTargets(ctx).find((t) => t.id.startsWith('WR'));
    if (!war) return; // no war shows an omen in this world: nothing to bend
    expect(run(ctx, 'decree', { event: war.id, mul: 0.2 }).ok).toBe(true);
    const until = actsOf(st).fates[war.id].until;
    run(ctx, 'miracle', { id: 'MR-05', country });
    expect(weightOf(ctx, war.id)).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(actsOf(st).fates[war.id].until).toBe(until);
  });
});

describe('the chest compensator counts chests, not rolls (M2 review L6)', () => {
  it('a reroll that shows no R does not push the compensator up again', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { ctx, st } = mk(seed, { light: 300, dread: 0 });
      st.god.counters.comp = -5;
      openChest(ctx);
      const afterOpen = compOf(ctx);
      let hit = false;
      for (let k = 0; k < 3 && !hit; k++) {
        const before = compOf(ctx);
        const ch = rerollChest(ctx);
        hit = ch.slots.some((x) => x && x.kind !== 'curse' && ['R', 'E', 'L'].includes(x.tier));
        if (!hit) expect(compOf(ctx)).toBe(before);
        else expect(compOf(ctx)).toBe(-5);
      }
      expect(afterOpen).toBeGreaterThanOrEqual(-5);
      st.god.chest = null;
    }
  });
});
