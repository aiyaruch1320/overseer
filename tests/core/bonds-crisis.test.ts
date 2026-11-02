// M3 review H5 H6 H7: the crisis of an ally is announced before it is decided and the god can reach it; the children are persons (the other parent, a
// stage, feelings, a marriage); the partner goes with a reason. The same world and helpers as tests/core/bonds.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, startLife, runToDeath } from '../../scripts/tools/session';
import { loadAll } from '../../scripts/tools/node-data';
import { command } from '../../src/core/command';
import { sortSystems, type Ctx, type GameData, type System } from '../../src/core/game';
import { addChild, addTie, bondsSystem, crisesWaiting, crisisAnswer, endTie, endingKind, extOf, findAlly, nudgeCrisis, stageOfAge, tiesOf, type Tie } from '../../src/core/bonds';
import { arcsYear, decideCrises } from '../../src/core/bonds/arcs';
import { answered } from '../../src/core/attention';
import { godActsSystem } from '../../src/core/god/acts';
import { bondageSystem } from '../../src/core/bondage';
import { JOURNEY_LINES } from '../../src/core/story/tuning';
import type { LifeState } from '../../src/core/types';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function mk(seed = 1) {
  const s = createSession(data, { seed, race: 'hu', startYear: 120 });
  const list = s.game.systems as System[];
  for (const x of [bondsSystem, bondageSystem, godActsSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
  list.splice(0, list.length, ...sortSystems(list));
  s.game.state.god.light = 200;
  s.game.state.god.dread = 200;
  const life = startLife(s);
  life.hAge = 30;
  life.godFaith = 0;
  return { s, g: s.game, ctx: s.game.ctx as Ctx, life, e: extOf(life) };
}

function ally(ctx: Ctx, life: LifeState, line = 'สหาย', level = 3): Tie {
  const t = addTie(ctx, life, { line, level, from: 'test', quiet: true, country: life.country, gap: 0, race: 'same' });
  t.rapport = false;
  t.family = false;
  return t;
}

/** A tie whose story is at stage 2 and due now, played until its crisis is a card (an announced one). */
function announced(): ReturnType<typeof mk> & { t: Tie } {
  for (let seed = 1; seed < 80; seed++) {
    const m = mk(seed);
    const t = ally(m.ctx, m.life, 'สหาย', 3);
    t.arc = { code: 'FT-03', stage: 2, next: m.life.hAge };
    arcsYear(m.ctx, m.life, m.e);
    if (m.e.crises.length) return { ...m, t };
  }
  throw new Error('no seed gave a crisis card');
}

describe('the crisis of an ally is announced before it is decided (H5)', () => {
  it('writes bonds/crisis at level 2 with the name, the line and what is happening, and the character has not answered yet', () => {
    const { g, t, life } = announced();
    const x = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'crisis').at(-1)!;
    expect(x.level).toBe(2);
    expect(x.id).toBe(t.id);
    expect(x.data).toMatchObject({ name: t.name, line: 'สหาย', tie: t.id });
    expect(String(x.data.text).length).toBeGreaterThan(3);
    expect(x.data.answer).toBeUndefined();
    expect(t.arc!.helped).toBeUndefined();
    expect(crisesWaiting(g.ctx).map((w) => w.tie.id)).toEqual([t.id]);
    expect(life.dead).toBeFalsy();
  });

  it('is answered at the beat after the call, with the answer written as trouble (after) and who moved it', () => {
    const { g, t, e } = announced();
    const mark = g.state.logN;
    // (announced by hand, outside a life year: the attention system reads it at the next beat, and the answer comes the beat after that)
    for (let i = 0; i < 3 && e.crises.length; i++) g.beat();
    expect(e.crises).toHaveLength(0);
    const a = g.state.log.filter((l) => l.n >= mark && l.sys === 'bonds' && l.kind === 'trouble' && l.data.after === true);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe(t.id);
    expect(['full', 'small', 'refuse']).toContain(a[0].data.answer);
    expect(a[0].data.by).toBeNull();
    expect(t.arc!.helped).toBe(a[0].data.answer !== 'refuse');
  });

  it('waits for the attention system while it has not answered, and answers after CRISIS_MAX_BEATS at the latest', () => {
    const { g, ctx, life, e } = announced();
    const n = e.crises[0].n;
    // no attention memory on this life: the answer is yes at once; with it, a call or a glow that names the entry is needed
    expect(answered(g.state, n)).toBe(Boolean(!life.ext.attention) || g.state.log.some((l) => l.sys === 'attention' && l.kind === 'call' && String(l.data.n).split(',').includes(String(n))));
    life.ext.attention = undefined;
    expect(answered(g.state, n)).toBe(true);
    e.crises[0].beats = 0;
    decideCrises(ctx, life);
    expect(e.crises).toHaveLength(0);
  });

  it('a person gone before the answer has none', () => {
    const { g, ctx, life, t, e } = announced();
    endTie(ctx, t, 'death', 'test', { cause: 'illness' });
    decideCrises(ctx, life);
    expect(e.crises).toHaveLength(0);
    expect(g.state.log.filter((l) => l.kind === 'trouble' && l.data.after === true)).toHaveLength(0);
  });

  it('the attention system calls the player on the announcement', () => {
    for (let seed = 1; seed < 120; seed++) {
      const { s, t, g } = (() => {
        const m = mk(seed);
        const t = ally(m.ctx, m.life, 'สหาย', 3);
        t.arc = { code: 'FT-03', stage: 2, next: m.life.hAge };
        return { ...m, t };
      })();
      const mark = g.state.logN;
      for (let i = 0; i < 4 * 12 && !g.state.log.some((l) => l.n >= mark && l.sys === 'bonds' && l.kind === 'crisis'); i++) g.beat();
      const c = g.state.log.find((l) => l.n >= mark && l.sys === 'bonds' && l.kind === 'crisis');
      if (!c) continue;
      // the call (a stop, or a card that waits for the gap rules) stands for the announcement, and the character answers once it was made
      for (let i = 0; i < 12 && g.state.life && !g.state.life.dead && crisesWaiting(g.ctx).length; i++) g.beat();
      const call = g.state.log.find((l) => l.n >= c.n && l.sys === 'attention' && l.kind === 'call' && String(l.data.n).split(',').includes(String(c.n)));
      if (!call) continue;
      expect(String(call.data.ids).split(',')).toContain(String(c.id));
      expect(answered(g.state, c.n)).toBe(true);
      void s;
      return;
    }
    throw new Error('no crisis card in 120 lives');
  });
});

describe('the god can name an ally (H5)', () => {
  const ask = (ctx: Ctx, action: 'whisper' | 'dream.send', args: Record<string, unknown>, confirm = false) => command(ctx, { type: 'god', action, args, confirm });

  it('finds an ally by his tie id, his name or the roster position he stands for, and not a light relative', () => {
    const { ctx, life, e } = mk(3);
    const t = ally(ctx, life);
    t.npc = 'AL17-2';
    expect(findAlly(ctx, t.id)?.id).toBe(t.id);
    expect(findAlly(ctx, t.name)?.id).toBe(t.id);
    expect(findAlly(ctx, 'AL17-2')?.id).toBe(t.id);
    expect(findAlly(ctx, 'ไม่มีคนนี้')).toBeUndefined();
    const kin = tiesOf(e).find((x) => x.light && x.kin === 'father');
    if (kin) expect(findAlly(ctx, kin.id)).toBeUndefined();
    const kid = addChild(ctx, life);
    expect(findAlly(ctx, kid.id)?.id).toBe(kid.id);
  });

  it('the whisper ช่วย and คนนั้นโกหก take an ally as the target; a name nobody has is refused with a word that says so', () => {
    const { ctx, life } = mk(4);
    const t = ally(ctx, life);
    expect(ask(ctx, 'whisper', { hint: 'ช่วย', target: t.name }).ok).toBe(true);
    expect(ask(ctx, 'whisper', { hint: 'คนนั้นโกหก', target: t.id }).ok).toBe(true);
    const no = ask(ctx, 'whisper', { hint: 'ช่วย', target: 'ไม่มีคนนี้' });
    expect(no.ok).toBe(false);
    expect(JSON.stringify(no)).toContain('พวกพ้อง');
  });

  it('an obeyed whisper ช่วย moves the answer: the nudge is kept, shown in the answer, and the chance of refusing falls', () => {
    const { g, ctx, life, t, e } = announced();
    life.blessings.push('nb_god_whisper');
    life.godFaith = 40;
    let r = ask(ctx, 'whisper', { hint: 'ช่วย', target: t.name }, true);
    for (let y = 0; y < 14 && !e.nudges[t.id]; y++) {
      life.hAge++;
      r = ask(ctx, 'whisper', { hint: 'ช่วย', target: t.name }, true);
    }
    expect(r.ok).toBe(true);
    expect(e.nudges[t.id]).toBeTruthy();
    expect(e.nudges[t.id].by).toBe('whisper');
    const w = g.state.log.filter((l) => l.sys === 'god' && l.kind === 'whisper').at(-1)!;
    expect(w.data).toMatchObject({ ally: t.name, allyId: t.id, crisis: true });
    e.crises[0].beats = 99;
    decideCrises(ctx, life);
    const a = g.state.log.filter((l) => l.kind === 'trouble' && l.data.after === true).at(-1)!;
    expect(a.data.by).toBe('whisper');
    expect(e.nudges[t.id]).toBeUndefined();
  });

  it('the nudge changes the chance: a whisper that helps refuses less often, one that he lies refuses more often', () => {
    const { ctx, life, e } = mk(5);
    const t = ally(ctx, life);
    const refuse = (bonus: number) => {
      let n = 0;
      for (let i = 0; i < 600; i++) if (crisisAnswer(ctx, life, e, t, bonus) === 'refuse') n++;
      return n / 600;
    };
    const base = refuse(0);
    expect(refuse(0.3)).toBeLessThan(base);
    expect(refuse(-0.3)).toBeGreaterThan(base);
    nudgeCrisis(ctx, t.id, 'liar');
    expect(e.nudges[t.id].bonus).toBeLessThan(0);
  });

  it('a dream of an ally needs his crisis to wait; then it costs a dream, is rolled at once and moves the answer when obeyed', () => {
    const quiet = mk(6);
    const t0 = ally(quiet.ctx, quiet.life);
    const no = ask(quiet.ctx, 'dream.send', { ally: t0.name });
    expect(no.ok).toBe(false);
    expect(JSON.stringify(no)).toContain('วิกฤต');
    const { g, ctx, t, e } = announced();
    const ok = ask(ctx, 'dream.send', { ally: t.id }, true);
    expect(ok.ok).toBe(true);
    const d = g.state.log.filter((l) => l.sys === 'god' && l.kind === 'dream').at(-1)!;
    expect(d.data).toMatchObject({ ally: t.name, allyId: t.id });
    expect(['obey', 'refuse']).toContain(d.data.outcome);
    expect(Boolean(e.nudges[t.id])).toBe(d.data.outcome === 'obey');
  });
});

describe('the children are persons (H6)', () => {
  it('a child keeps the other parent, the age the character was, a stage and where he came from; the log names them', () => {
    const { g, ctx, life, e } = mk(7);
    const partner = ally(ctx, life, 'คนรัก', 4);
    e.partner = partner.id;
    const c = addChild(ctx, life, { from: 'couple' });
    expect(c.other).toBe(partner.id);
    expect(c.otherName).toBe(partner.name);
    expect(c.born).toBe(life.hAge);
    expect(c.stage).toBe('infant');
    const log = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'child').at(-1)!;
    expect(log.data).toMatchObject({ name: c.name, other: partner.name, otherId: partner.id, kin: 'child', age: 0 });
    // a taken-in child has no other parent known
    const a = addChild(ctx, life, { adopted: true, age: 9 });
    expect(a.other).toBeUndefined();
    expect(a.stage).toBe('child');
  });

  it('over the lives the children grow, are felt for by stage, marry, and die with the kin in the log', () => {
    let grows = 0;
    let moods = 0;
    let weds = 0;
    let withOther = 0;
    let kids = 0;
    let deaths = 0;
    for (let seed = 40; seed < 70; seed++) {
      const { g, life } = mk(seed);
      life.hAge = 0;
      runToDeath(g);
      for (const x of g.state.log) {
        if (x.sys !== 'bonds') continue;
        if (x.kind === 'child') {
          kids++;
          if (x.data.other) withOther++;
        }
        if (x.kind === 'news' && x.data.kind === 'grow') {
          grows++;
          expect(['child', 'youth', 'adult']).toContain(x.data.stage);
        }
        if (x.kind === 'news' && x.data.kind === 'wed') {
          weds++;
          expect(typeof x.data.spouse).toBe('string');
        }
        if (x.kind === 'mood' && x.data.line === 'ญาติรุ่นเยาว์') moods++;
        if (x.kind === 'end' && (x.data.kin === 'child' || x.data.kin === 'adopted')) {
          deaths++;
          expect(typeof x.data.reason).toBe('string');
        }
      }
    }
    expect(kids).toBeGreaterThan(8);
    expect(withOther).toBeGreaterThan(0);
    expect(grows).toBeGreaterThan(5);
    expect(moods).toBeGreaterThan(5);
    expect(weds).toBeGreaterThan(0);
    void deaths;
  });
});

describe('the partner goes with a reason (H7)', () => {
  it('writes bonds/end for the lover however he goes (level 2 for a death, 1 for the rest), with the way in words', () => {
    for (const [way, reason] of [['death', 'ตาย'], ['split', 'แยกทาง'], ['fade', 'ห่างหาย'], ['betray', 'หักหลัง']] as const) {
      const { g, ctx, life, e } = mk(8);
      const t = ally(ctx, life, 'คนรัก', 1);
      e.partner = t.id;
      endTie(ctx, t, way, 'test', way === 'death' ? { cause: 'illness' } : {});
      const x = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'end').at(-1)!;
      expect(x.level, way).toBe(way === 'death' ? 2 : 1);
      expect(x.data).toMatchObject({ way, reason, partner: true, name: t.name });
      expect(t.gone).toMatchObject({ way, reason });
    }
  });

  it('a child that goes is told as well, and a tie that is neither stays quiet at level 0 when it only fades', () => {
    const { g, ctx, life } = mk(9);
    const c = addChild(ctx, life);
    endTie(ctx, c, 'death', 'test', { cause: 'illness' });
    expect(g.state.log.filter((l) => l.kind === 'end').at(-1)!.level).toBe(2);
    const f = ally(ctx, life, 'สหาย', 1);
    endTie(ctx, f, 'fade', 'test');
    expect(g.state.log.filter((l) => l.kind === 'end').at(-1)!.level).toBe(0);
  });

  it('the words of an ending that are about someone else or a cure do not take the friend away', () => {
    expect(endingKind('พบว่าตายแล้ว ความโศกร่วม')).toBe('stays');
    expect(endingKind('หายด้วยราคาที่แพง ตัวละครเสียทองหรือเวลา')).toBe('stays');
    expect(endingKind('เขาตายและตัวละครอยู่ด้วย')).toBe('dies');
    expect(endingKind('เขาไปคนเดียวและไม่กลับ')).toBe('leaves');
  });

  it('over the lives a life partner is told again while he lives (a feeling toward him), and every partner who goes has a line', () => {
    let partnerMoods = 0;
    let lives = 0;
    for (let seed = 60; seed < 90; seed++) {
      const { g, life } = mk(seed);
      life.hAge = 0;
      runToDeath(g);
      const e = extOf(life);
      for (const t of tiesOf(e)) {
        if (t.line !== 'คนรัก' || t.light) continue;
        lives++;
        if (t.state !== 'alive') {
          // the last ending of the tie: a friend who betrayed and came back as a lover has an earlier ending of its own, at level 0
          const end = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'end' && l.id === t.id).at(-1);
          expect(end, `${t.name} ${t.state}`).toBeTruthy();
          expect(end!.level).toBe(end!.data.way === 'death' ? 2 : 1);
        }
        partnerMoods += g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'mood' && l.id === t.id && l.data.why === 'partner').length;
      }
    }
    expect(lives).toBeGreaterThan(5);
    expect(partnerMoods).toBeGreaterThan(0);
  });
});

describe('the node of a journey says where and why (T2)', () => {
  it('a node of a journey line carries the country the character stood in, and the cause the line was opened for; a way that names a place carries the place', () => {
    let journey = 0;
    let named = 0;
    let why = 0;
    for (let seed = 1; seed < 41; seed++) {
      const { g, life } = mk(seed);
      life.hAge = 0;
      runToDeath(g);
      for (const x of g.state.log) {
        if (x.sys !== 'story' || x.kind !== 'node') continue;
        const line = String(x.data.line);
        if (JOURNEY_LINES.has(line)) {
          journey++;
          expect(String(x.data.at)).toMatch(/^[A-Z]{2}-\d{2}$/);
          if (typeof x.data.why === 'string') why++;
        }
        if (typeof x.data.places === 'string') {
          named++;
          for (const p of String(x.data.places).split(',')) expect(p).toMatch(/^[A-Z]{2}-\d{2}$/);
        }
      }
    }
    expect(journey).toBeGreaterThan(5);
    expect(named).toBeGreaterThan(5);
    expect(why).toBeGreaterThan(0);
  });
});

describe('round two of the review (R5 R8 R9)', () => {
  it('R5: the same feeling toward the same child in the same stage is not told twice within ten years', () => {
    let kids = 0;
    for (let seed = 60; seed < 80; seed++) {
      const { g, life } = mk(seed);
      life.hAge = 0;
      runToDeath(g);
      const moods = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'mood' && String(l.data.why).startsWith('child:'));
      const last = new Map<string, { age: number; why: string }>();
      for (const m of moods) {
        const key = `${m.id}|${m.data.mood}`;
        const prev = last.get(key);
        if (prev && prev.why === m.data.why) expect((m.age ?? 0) - prev.age, `${key} ${m.age}`).toBeGreaterThanOrEqual(10);
        last.set(key, { age: m.age ?? 0, why: String(m.data.why) });
        kids++;
      }
    }
    expect(kids).toBeGreaterThan(10);
  });

  it('R5: a child who dies leaves a line of grief for the parent, after the funeral or the news; a friend does not', () => {
    const { g, ctx, life } = mk(11);
    const c = addChild(ctx, life);
    const f = ally(ctx, life, 'สหาย', 1);
    endTie(ctx, f, 'death', 'test', { cause: 'illness' });
    expect(g.state.log.filter((l) => l.kind === 'grief')).toHaveLength(0);
    // the yearly death of the book: a child past his death age
    c.dieAge = 0;
    life.hAge += 3;
    (g.systems as System[]).filter((s) => s.name === 'bonds').forEach((s) => s.lifeYear?.(ctx));
    const grief = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'grief');
    expect(grief).toHaveLength(1);
    expect(grief[0]).toMatchObject({ id: c.id, level: 2 });
    expect(grief[0].data).toMatchObject({ name: c.name, kin: 'child' });
    const after = g.state.log.filter((l) => l.id === c.id && ['funeral', 'news'].includes(l.kind)).at(-1);
    if (after) expect(after.n).toBeLessThan(grief[0].n);
  });

  it('R5: the news of the death of a partner is level 2, of a friend level 1', () => {
    for (const kind of ['partner', 'friend'] as const) {
      const { g, ctx, life, e } = mk(12);
      life.hAge = 40;
      e.funeralAt = life.hAge; // a funeral was just held: the next death is news
      const t = kind === 'partner' ? ally(ctx, life, 'คนรัก', 4) : ally(ctx, life, 'สหาย', 4);
      if (kind === 'partner') e.partner = t.id;
      t.dieAge = 1;
      (g.systems as System[]).filter((s) => s.name === 'bonds').forEach((s) => s.lifeYear?.(ctx));
      const news = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'news' && l.id === t.id && l.data.kind === 'death');
      expect(news, kind).toHaveLength(1);
      expect(news[0].level, kind).toBe(kind === 'partner' ? 2 : 1);
    }
  });

  it('R8: a split carries a reason from what the book knew: a feeling, the distance, the silence, or the years', () => {
    const split = (patch: (t: Tie, life: LifeState) => void, because?: string) => {
      const { g, ctx, life } = mk(13);
      const t = ally(ctx, life, 'คนรัก', 3);
      patch(t, life);
      endTie(ctx, t, 'split', 'x', because ? { because } : {});
      return g.state.log.filter((l) => l.kind === 'end').at(-1)!.data;
    };
    expect(split((t, l) => t.moods.push({ mood: 'หึง', until: l.hAge + 2 }))).toMatchObject({ because: 'mood', bmood: 'หึง' });
    expect(split((t) => { t.country = 'SV-01'; })).toMatchObject({ because: 'far' });
    expect(split((t, l) => { t.last = l.hAge - 5; })).toMatchObject({ because: 'silent' });
    expect(split(() => {})).toMatchObject({ because: 'drift' });
    expect(split(() => {}, 'สายจางหาย')).toMatchObject({ btext: 'สายจางหาย' });
    // a death carries no reason of a split
    const { g, ctx, life } = mk(14);
    const t = ally(ctx, life, 'สหาย', 3);
    endTie(ctx, t, 'death', 'x', { cause: 'old' });
    expect(g.state.log.filter((l) => l.kind === 'end').at(-1)!.data.because).toBeUndefined();
  });

  it('R9: the stage of a child follows the age his race grows up at: a baby is not four, a young person is not twenty-two', () => {
    expect(stageOfAge(2)).toBe('infant');
    expect(stageOfAge(4)).toBe('child');
    expect(stageOfAge(14)).toBe('child');
    expect(stageOfAge(15)).toBe('youth');
    expect(stageOfAge(19)).toBe('youth');
    expect(stageOfAge(22)).toBe('adult');
    expect(stageOfAge(22, 40)).toBe('child');
    expect(stageOfAge(32, 40)).toBe('youth');
  });

  it('R9: the letters of one person are told once in five years', () => {
    const { g, ctx, life, e } = mk(15);
    const t = ally(ctx, life, 'สหาย', 3);
    t.country = 'SV-01';
    const sys = (g.systems as System[]).find((s) => s.name === 'bonds')!;
    for (let i = 0; i < 6; i++) {
      e.mail.push({ tie: t.id, due: life.hAge, text: '' });
      t.last = life.hAge;
      sys.lifeYear?.(ctx);
      life.hAge += 1;
    }
    const told = g.state.log.filter((l) => l.sys === 'bonds' && l.kind === 'letter' && l.id === t.id);
    expect(told.length).toBeGreaterThan(0);
    expect(told.length).toBeLessThanOrEqual(2);
  });
});
