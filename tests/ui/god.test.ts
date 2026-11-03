// The view models of the god's screens (src/app/views/god.ts), on a real life run to its first call of the game.
import { beforeAll, describe, expect, it } from 'vitest';
import { command } from '../../src/core/command';
import type { Game, GameData } from '../../src/core/game';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToCall, startLife } from '../../scripts/tools/session';
import { ask, chestView, chronicleView, confirmView, conjurePreview, conjureView, dreamView, effectLine, miracleArgs, miracleTargets, miracleView, powerView, prayerView, rerollInfo, resultView, whisperView } from '../../src/app/views/god';
import { spinOf } from '../../src/ui/god/wheel';
import { addTie, bondsSystem, crisesWaiting, extOf } from '../../src/core/bonds';
import { arcsYear } from '../../src/core/bonds/arcs';
import { sortSystems, type System } from '../../src/core/game';
import { godActsSystem } from '../../src/core/god/acts';
import { bondageSystem } from '../../src/core/bondage';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function atCall(seed = 7): Game {
  const s = createSession(data, { seed });
  startLife(s);
  runToCall(s.game);
  return s.game;
}

const run = (g: Game, action: Parameters<typeof ask>[2], args: Record<string, unknown>) => command(g.ctx, { type: 'god', action, args, confirm: true });

describe('god view models', () => {
  it('the power view reads the purse and the caps', () => {
    const g = atCall();
    const p = powerView(g);
    expect(p.alive).toBe(true);
    expect(p.light).toBeGreaterThan(0);
    expect(p.caps.chest.limit).toBeGreaterThanOrEqual(1);
  });

  it('a preview never changes the state, a refusal comes as a reason', () => {
    const g = atCall();
    const before = JSON.stringify(g.state);
    const c = confirmView(g, data, 'chest.open', {});
    expect(c.ok).toBe(true);
    expect(c.lines.length).toBeGreaterThan(0);
    expect(c.caps.length).toBe(1);
    const bad = confirmView(g, data, 'chest.pick', { slot: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBeTruthy();
    expect(JSON.stringify(g.state)).toBe(before);
  });

  it('the chest: closed, then open with cards in three columns, a reroll price, and a pick', () => {
    const g = atCall();
    const v0 = chestView(g, data);
    expect(v0.isOpen).toBe(false);
    expect(v0.canOpen.ok).toBe(true);
    expect(run(g, 'chest.open', {}).ok).toBe(true);
    const v = chestView(g, data);
    expect(v.isOpen).toBe(true);
    expect(v.columns).toHaveLength(3);
    const cards = v.cards.filter((c) => c);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c!.name).toBeTruthy();
      expect(['C', 'U', 'R', 'E', 'L']).toContain(c!.tier);
    }
    const r = rerollInfo(g, data);
    expect(r.price).toBeGreaterThan(0);
    const slot = cards[0]!.slot;
    const cf = confirmView(g, data, 'chest.pick', { slot });
    expect(cf.cost.faith + cf.cost.dread).toBeGreaterThan(0);
    const done = run(g, 'chest.pick', { slot });
    expect(done.ok).toBe(true);
    const rv = resultView(g, data, done, { light: 0, dread: 0 });
    expect(rv.lines.length).toBeGreaterThan(0);
    expect(chestView(g, data).isOpen).toBe(false);
    expect(chronicleView(g, data).rows.length).toBeGreaterThan(0);
  });

  it('the dream: doors with chances, and a preview that explains', () => {
    const g = atCall();
    const v = dreamView(g, data);
    expect(v.alive).toBe(true);
    for (const d of v.doors) {
      expect(['เต็มใจ', 'ลังเล', 'ขัดขืน']).toContain(d.level);
      expect(d.band).toMatch(/%$/);
    }
    if (v.doors.length) expect(confirmView(g, data, 'dream.send', { path: 1 }).ok).toBe(true);
  });

  it('the whisper: nine hints, the ones that point carry targets', () => {
    const g = atCall();
    const v = whisperView(g, data);
    expect(v.hints).toHaveLength(9);
    const go = v.hints.find((h) => h.hint === 'จงไป')!;
    expect(go.needs).toBe('place');
    expect(go.targets.length).toBeGreaterThan(5);
    const plain = v.hints.find((h) => h.hint === 'ระวัง')!;
    expect(plain.needs).toBeNull();
    expect(plain.ok).toBe(true);
    expect(confirmView(g, data, 'whisper', { hint: 'ระวัง' }).lines.join('\n')).toContain('ระวัง');
  });

  it('the miracles: a table by line, targets for each kind, a preview with a target', () => {
    const g = atCall();
    const v = miracleView(g, data);
    expect(v.rows.length).toBeGreaterThanOrEqual(24);
    expect(new Set(v.rows.map((r) => r.line))).toEqual(new Set([0, 1, 2]));
    const rain = v.rows.find((r) => r.id === 'MR-01')!;
    expect(rain.target).toBe('country');
    const targets = miracleTargets(g, data, 'country');
    expect(targets.length).toBeGreaterThan(100);
    expect(targets.some((t) => t.here)).toBe(true);
    const args = miracleArgs('MR-01', 'country', targets[0]);
    expect(args).toEqual({ id: 'MR-01', country: targets[0].id });
    expect(miracleTargets(g, data, 'dragon').length).toBeGreaterThan(0);
  });

  it('a big miracle is held for 1.5 seconds, a grand one for 3; an omen shows its countdown', () => {
    const g = atCall();
    g.state.god.light = 200;
    g.state.god.dread = 200;
    const targets = miracleTargets(g, data, 'country');
    const far = targets.find((t) => !t.here)!;
    const c = confirmView(g, data, 'miracle', miracleArgs('MR-17', 'country', far));
    expect(c.ok).toBe(true);
    expect(c.hold).toBe(1.5);
    expect(run(g, 'miracle', miracleArgs('MR-17', 'country', far)).ok).toBe(true);
    const v = miracleView(g, data);
    expect(v.omens.length).toBe(1);
    expect(v.omens[0].left).toBeGreaterThan(0);
    expect(v.omens[0].fraction).toBeGreaterThan(0);
    const cancel = confirmView(g, data, 'miracle', { cancel: v.omens[0].n });
    expect(cancel.ok).toBe(true);
    expect(cancel.hold).toBe(0);
    const grand = confirmView(g, data, 'miracle', { id: 'MR-22', continent: 'AL' });
    if (grand.ok) expect(grand.hold).toBe(3);
  });

  it('the prayer: five answers each, with cost and effect', () => {
    const g = atCall(11);
    // run on until a prayer waits (a life gets them within a few years)
    let guard = 0;
    while (!prayerView(g, data).cards.length && guard++ < 400) g.beat();
    const v = prayerView(g, data);
    expect(v.cards.length).toBeGreaterThan(0);
    const c = v.cards[0];
    expect(c.answers.map((a) => a.key)).toEqual(['give', 'strange', 'deny', 'punish', 'silent']);
    expect(c.answers[0].cost).toBeTruthy();
    expect(c.fraction).toBeGreaterThan(0);
  });

  it('the conjuring: the circle opens some verbs, a preview names the result and the quota', () => {
    const g = atCall();
    const v = conjureView(g);
    expect(v.verbs.length).toBe(6);
    expect(v.cores.length).toBe(8);
    expect(v.scales.length).toBe(4);
    const open = v.verbs.filter((x) => x.open);
    expect(open.length).toBeGreaterThan(0);
    const verb = open[0].id;
    const core = v.cores.find((x) => x.open)!.id;
    const p = conjurePreview(g, data, { verb, core, scale: 'country' });
    expect(p.ok || p.reason).toBeTruthy();
    if (p.ok) expect(p.lines.length).toBeGreaterThan(0);
  });
});

describe('the fixes of the M5 review on the god screens', () => {
  it('the chest preview of belief is the change the pick really makes (halved while he does not know the god)', () => {
    const g = atCall(5);
    g.state.life!.godFaith = 0;
    g.state.god.light = 200;
    g.state.god.dread = 200;
    expect(run(g, 'chest.open', {}).ok).toBe(true);
    for (const c of chestView(g, data).cards.filter((x) => x && (x.kind === 'bless' || x.kind === 'curse'))) {
      const shown = c!.belief;
      const pv = ask(g, data, 'chest.pick', { slot: c!.slot });
      expect(pv.ok).toBe(true);
      if (pv.ok) expect(Math.abs(Number(pv.preview.belief) - shown)).toBeLessThan(0.11);
    }
    const bless = chestView(g, data).cards.find((x) => x && x.kind === 'bless')!;
    const start = g.state.life!.godFaith;
    expect(run(g, 'chest.pick', { slot: bless.slot }).ok).toBe(true);
    expect(Math.round((g.state.life!.godFaith - start) * 10) / 10).toBe(bless.belief);
  });

  it('a miracle in the other line within the year says the belief it will cost', () => {
    const g = atCall(5);
    g.state.god.light = 200;
    g.state.god.dread = 200;
    const t = miracleTargets(g, data, 'country').find((x) => !x.here)!;
    expect(run(g, 'miracle', miracleArgs('MR-01', 'country', t)).ok).toBe(true);
    const c = confirmView(g, data, 'miracle', { id: 'MR-07', country: t.id });
    expect(c.ok).toBe(true);
    expect(c.lines.join('\n')).toContain('−4');
    const same = confirmView(g, data, 'miracle', { id: 'MR-04', country: t.id });
    expect(same.lines.join('\n')).not.toContain('เปลี่ยนสายพลัง');
  });

  it('cancelling an omen says what comes back and what does not', () => {
    const g = atCall(5);
    g.state.god.light = 200;
    g.state.god.dread = 200;
    const far = miracleTargets(g, data, 'country').find((x) => !x.here)!;
    expect(run(g, 'miracle', miracleArgs('MR-17', 'country', far)).ok).toBe(true);
    const n = miracleView(g, data).omens[0].n;
    const text = confirmView(g, data, 'miracle', { cancel: n }).lines.join('\n');
    expect(text).toContain('ได้พลังคืน');
    expect(text).toContain('ไม่คืน');
    expect(text).not.toMatch(/MR-\d\d/);
  });

  it('the chronicle speaks in words: the world year as ศ.ม., a name for every row, no ids or effect words', () => {
    const g = atCall(5);
    g.state.god.light = 200;
    run(g, 'dream.send', { path: 1 });
    run(g, 'whisper', { hint: 'ระวัง' });
    const rows = chronicleView(g, data).rows;
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      expect(r.yearWord).toMatch(/^ศ\.ม\. [\d,]{5,}$/);
      expect(r.text).toBeTruthy();
      expect(r.text).not.toMatch(/\b(obey|vit[+-]|hp[+-]|npc:)|\b[A-Z]{2,3}-\d\d|\bT\d\b/);
    }
  });

  it('a small miracle leaves a line for the scene area, for a season', () => {
    const g = atCall(5);
    g.state.god.light = 200;
    const t = miracleTargets(g, data, 'country').find((x) => !x.here)!;
    expect(effectLine(g, data)).toBeNull();
    expect(run(g, 'miracle', miracleArgs('MR-01', 'country', t)).ok).toBe(true);
    const e = effectLine(g, data)!;
    expect(e.name).toBe('ฝนต้องฤดู');
    expect(e.where).toBeTruthy();
    expect(e.text).not.toMatch(/MR-\d\d/);
  });

  it('the whisper from a crisis card knows the ally in crisis and marks him in the target list', () => {
    let found: Game | null = null;
    let tieId = '';
    for (let seed = 1; seed < 80 && !found; seed++) {
      const s = createSession(data, { seed, race: 'hu', startYear: 120 });
      const list = s.game.systems as System[];
      for (const x of [bondsSystem, bondageSystem, godActsSystem]) if (!list.some((y) => y.name === x.name)) list.push(x);
      list.splice(0, list.length, ...sortSystems(list));
      s.game.state.god.light = 200;
      const life = startLife(s);
      life.hAge = 30;
      const t = addTie(s.game.ctx, life, { line: 'สหาย', level: 3, from: 'test', quiet: true, country: life.country, gap: 0, race: 'same' });
      t.arc = { code: 'FT-03', stage: 2, next: life.hAge };
      arcsYear(s.game.ctx, life, extOf(life));
      if (crisesWaiting(s.game.ctx).length) {
        found = s.game;
        tieId = t.id;
      }
    }
    expect(found).not.toBeNull();
    const g = found!;
    const v = whisperView(g, data);
    expect(v.crises.map((c) => c.id)).toContain(tieId);
    const help = v.hints.find((h) => h.hint === 'ช่วย')!;
    const hot = help.targets.filter((t) => t.crisis);
    expect(hot.length).toBeGreaterThan(0);
    expect(hot[0].name).toContain('ขณะวิกฤต');
    expect(help.targets[0].crisis).toBe(true);
    // a person is listed once: no two rows with one name, and no person of the country repeats an ally
    const names = help.targets.map((t) => t.plain ?? t.name);
    expect(new Set(names).size).toBe(names.length);
    const c = confirmView(g, data, 'whisper', { hint: 'ช่วย', target: tieId });
    expect(c.lines.join('\n')).toContain('ขณะวิกฤต');
  });

  it('the wheel turns a cell under the line at the top: half a cell back, whole cells for the next', () => {
    expect(spinOf(-1, 6)).toBe(0);
    expect(spinOf(0, 6)).toBe(-30);
    expect(spinOf(1, 4)).toBe(-135);
  });
});
