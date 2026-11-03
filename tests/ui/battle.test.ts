// The view models of the battle view and the war panel (src/app/views/battle.ts): what a `combat/battle` entry says of the foe, the beats, the god's hand,
// the aftermath, and what the combat system keeps of a soldier's war. Pure models, no browser. Real entries of seeded lives are read too.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';
import type { GameData } from '../../src/core/game';
import type { GameState, LogEntry } from '../../src/core/types';
import { battleAt, battleEntries, battleModel, hpAt, leftAt, parseRolls, stepsOf, warFromCampaign, warInput, warModel } from '../../src/app/views/battle';
import { FIGHTS, battleEntry, clashEntry, withEntries } from '../../src/ui/battle/sample';
import { posesAt } from '../../src/ui/battle/BattleView';

let data: GameData;
let base: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 1 });
  startLife(s);
  for (let i = 0; i < 40; i++) s.game.beat();
  base = s.game.state;
});

function model(spec: Parameters<typeof battleEntry>[0], more: (n: number) => ReturnType<typeof clashEntry>[] = () => []) {
  const st = withEntries(base, [battleEntry(spec)]);
  const n = st.log[st.log.length - 1].n;
  const full = withEntries(st, more(n));
  return battleModel(data, full, full.log.find((e) => e.n === n)!);
}

describe('battle: the foe', () => {
  it('a normal foe has two wounds and three beats; a chief three and four; a boss the wounds of its row', () => {
    expect(model(FIGHTS.won).foe).toMatchObject({ name: 'กลุ่มโจรภูเขา', tier: 'ปกติ', wounds: 2, maxBeats: 3, heavy: false });
    expect(model(FIGHTS.lost).foe).toMatchObject({ tier: 'หัวหน้า', wounds: 3, maxBeats: 4, heavy: false });
    expect(model(FIGHTS.boss).foe).toMatchObject({ tier: 'บอส', wounds: 5, maxBeats: 6, heavy: true });
  });

  it('a last stand is a host: three times the wounds and twice the beats of a legend', () => {
    const f = model(FIGHTS.lastStand).foe;
    expect(f).toMatchObject({ tier: 'ตำนาน', heavy: true });
    expect(f.wounds).toBe(24);
    expect(f.maxBeats).toBe(16);
  });

  it('the weak points of the foe are listed, and the whisper marks them', () => {
    expect(model(FIGHTS.dreamed).foe.weak).toEqual([{ name: 'ไฟ', mark: '★', whispered: true }]);
    expect(model(FIGHTS.lost).foe.weak[0].whispered).toBe(false);
  });
});

describe('battle: a draw says why it is one (review round two R6)', () => {
  it('the beats ran out with the foe standing: the model says so, and what the missed beats cost', () => {
    const m = model(FIGHTS.draw);
    expect(m.end).toBe('draw');
    expect(m.why).toContain('ครบ');
    expect(m.why).toContain('ศัตรูยังไม่ล้ม');
    const missed = m.beats.filter((b) => b.ok === false).length;
    if (missed) expect(m.why).toContain('พลาด');
    expect(model(FIGHTS.won).why).toBe('');
    expect(model(FIGHTS.lost).why).toBe('');
  });

  it('a fight in which every beat missed reads as a draw that cost hit points, not as a defeat', () => {
    const m = model({ enemies: 'skeleton', foe: 'กองทัพโครงกระดูก', end: 'draw', kind: 'hunt', hpBefore: 64, rolls: [['melee', 4, 2, 11, 0, 48, 2], ['melee', 3, 2, 11, 0, 32, 2], ['melee', 6, 2, 11, 0, 16, 2]] });
    expect(m.hpLost).toBe(48);
    expect(m.why).toContain('พลาดทุกจังหวะ');
    expect(m.why).toContain('48');
    expect(m.why).toContain('เสมอ');
  });
});

describe('battle: the beats', () => {
  it('each beat has its stance by name, its roll and whether it passed', () => {
    const m = model(FIGHTS.won);
    expect(m.beats.map((b) => b.name)).toEqual(['ปะทะประชิด', 'ร่ายเวท', 'ปะทะประชิด']);
    expect(m.beats[0].roll).toMatchObject({ d20: 14, bonus: 3, dc: 11, total: 17, crit: false });
    expect(m.beats.map((b) => b.ok)).toEqual([true, false, true]);
    expect(m.exact).toBe(true);
  });

  it('a natural 20 is marked, and the steps are the meeting, the beats and the result', () => {
    const m = model(FIGHTS.dreamed);
    expect(m.beats[0].roll?.crit).toBe(true);
    expect(stepsOf(m)).toBe(m.beats.length + 2);
  });

  it('hit points and wounds follow the fight step by step', () => {
    const m = model(FIGHTS.dreamed);
    expect([0, 1, 2, 3, 4].map((s) => hpAt(m, s))).toEqual([100, 100, 79, 79, 79]);
    expect([0, 1, 2, 3, 4].map((s) => leftAt(m, s))).toEqual([3, 1, 1, 0, 0]);
  });

  it('a defeat ends with fewer hit points than it began with', () => {
    const m = model(FIGHTS.lost);
    expect(m.end).toBe('lose');
    expect(m.tone).toBe('lose');
    expect(m.hero.hpBefore).toBe(100);
    expect(m.hero.hpAfter).toBe(24);
    expect(m.hpLost).toBe(76);
    expect(m.first).toBe('foe');
  });

  it('a hero who dies ends at zero', () => {
    const m = model(FIGHTS.lastStand);
    expect(m.end).toBe('dead');
    expect(hpAt(m, stepsOf(m) - 1)).toBe(0);
    expect(m.lastStand).toBe(true);
  });

  it('parseRolls reads the records, and a field left out is null', () => {
    expect(parseRolls('melee/14/3/11/1/90/2;guard/5/2/11/0')).toEqual([
      { stance: 'melee', d20: 14, bonus: 3, dc: 11, ok: true, hp: 90, left: 2 },
      { stance: 'guard', d20: 5, bonus: 2, dc: 11, ok: false, hp: null, left: null },
    ]);
    expect(parseRolls('')).toEqual([]);
  });
});

describe('battle: the entry as the core writes it today (no rolls)', () => {
  const plain = () => {
    const e = battleEntry(FIGHTS.won);
    const { rolls: _r, max: _m, ...d } = e.data;
    void [_r, _m];
    const st = withEntries(base, [{ ...e, data: d }]);
    return battleModel(data, st, st.log[st.log.length - 1]);
  };

  it('keeps the stances and the end, never invents a roll or a count, and gives every beat a result worked out from the end (M5 fix M4)', () => {
    const m = plain();
    expect(m.exact).toBe(false);
    expect(m.beats.map((b) => b.stance)).toEqual(['melee', 'magic', 'melee']);
    expect(m.beats.map((b) => b.roll)).toEqual([null, null, null]);
    // a won fight with W wounds in B beats took W successes: every beat has a result, marked as worked out, and the same fight always gives the same ones
    expect(m.beats.every((b) => typeof b.ok === 'boolean' && b.guessed)).toBe(true);
    expect(m.beats[m.beats.length - 1].ok).toBe(true);
    expect(m.beats.filter((b) => b.ok).length).toBe(Math.min(m.beats.length, Math.max(1, m.foe.wounds)));
    expect(plain().beats.map((b) => b.ok)).toEqual(m.beats.map((b) => b.ok));
    expect(hpAt(plain(), 1)).toBe(m.hero.hpBefore);
    expect(leftAt(m, 1)).toBe(m.foe.wounds);
    expect(leftAt(m, stepsOf(m) - 1)).toBe(0);
  });
});

describe('battle: the hand of the god', () => {
  it('a dream names a stance and marks the beats that took it; a whisper is told', () => {
    const m = model(FIGHTS.dreamed);
    expect(m.god.dream).toEqual({ id: 'magic', name: 'ร่ายเวท' });
    expect(m.god.whisper).toBe(true);
    expect(m.beats.map((b) => b.dream)).toEqual([true, false, true]);
  });

  it('without the god there is nothing to show', () => {
    const m = model(FIGHTS.won);
    expect(m.god).toEqual({ dream: null, whisper: false });
    expect(m.beats.some((b) => b.dream)).toBe(false);
  });
});

describe('battle: after the fight', () => {
  it('wounds are told by their words, curses with their names', () => {
    const m = model(FIGHTS.lost);
    expect(m.wounds[0]).toBe('แผลเป็นถาวร');
    expect(m.wounds).toHaveLength(2);
    expect(m.wounds[1]).toMatch(/ติดตัว$/);
  });

  it('loot is told in words: gold, fame, and a skill that grew; no code reaches the player', () => {
    const m = model(FIGHTS.won);
    expect(m.loot).toContain('ทอง +8');
    expect(m.loot).toContain('ชื่อเสียง +1');
    expect(m.loot.length).toBe(3);
    for (const t of [...m.loot, ...m.wounds]) expect(t).not.toMatch(/[a-z]+_[a-z]+|\+\d+$.*[a-z]/);
  });

  it('the result word and the line of the log come from the end of the fight', () => {
    expect(model(FIGHTS.won).resultLabel).toBe('ชนะ');
    expect(model(FIGHTS.draw).resultLabel).toBe('เสมอ');
    expect(model(FIGHTS.draw).tone).toBe('draw');
    expect(model(FIGHTS.won).line).toMatch(/ศึก/);
  });
});

describe('battle: a clash with a named NPC', () => {
  it('names the clash, how it opened and what the row says happened', () => {
    const m = model(FIGHTS.clash, (n) => [clashEntry(data, 'NF-AZ02-1', 'win_spare', 'win', 'T', n + 1)]);
    expect(m.clash).not.toBeNull();
    expect(m.clash?.name).toBe('ซากโรวีร์');
    expect(m.clash?.opener).toBe('ท้าหรือทดสอบ');
    expect(m.clash?.result).toMatch(/ไว้ชีวิต/);
    expect(m.clash?.story).not.toMatch(/เส้น|`/);
    expect(m.foe.named).toBe(true);
  });

  it('an ordinary fight has no clash', () => {
    expect(model(FIGHTS.won).clash).toBeNull();
  });
});

describe('battle: the entries a screen can open', () => {
  it('finds a battle by its running number and none for another kind of entry', () => {
    const st = withEntries(base, [battleEntry(FIGHTS.won)]);
    const e = st.log[st.log.length - 1];
    expect(battleAt(st, e.n)).toBe(e);
    expect(battleAt(st, st.log[0].n)).toBeUndefined();
    expect(battleEntries(st).at(-1)).toBe(e);
  });

  it('the real fights of a seeded life make models whose numbers agree', () => {
    const s = createSession(data, { seed: 6 });
    startLife(s);
    runToDeath(s.game);
    const st = s.game.state;
    const all = battleEntries(st, 0);
    expect(all.length).toBeGreaterThan(3);
    for (const e of all) {
      const m = battleModel(data, st, e);
      expect(m.beats.length).toBe(Number(e.data.beats));
      expect(m.foe.name).not.toBe('');
      expect(m.foe.wounds).toBeGreaterThan(0);
      expect(m.hero.hpBefore - m.hero.hpAfter).toBe(m.hpLost);
      expect(hpAt(m, stepsOf(m) - 1)).toBe(m.hero.hpAfter);
      // the core keeps the rolls, so the screen follows the fight beat by beat
      expect(m.exact).toBe(true);
      expect(m.beats.every((b) => b.roll && b.hp !== null && b.left !== null)).toBe(true);
      expect(m.foe.wounds).toBe(Number(e.data.foeWounds));
      expect(m.hero.max).toBe(Number(e.data.max));
    }
  });
});

describe('battle: the poses on the stage', () => {
  it('a win ends with the foe down, a defeat with the hero kneeling, a flight with the hero away', () => {
    expect(posesAt(model(FIGHTS.won), 5).foe).toBe('fall');
    expect(posesAt(model(FIGHTS.lost), 6).hero).toBe('kneel');
    expect(posesAt(model(FIGHTS.lastStand), 9).hero).toBe('lie');
    expect(posesAt(model({ ...FIGHTS.draw, end: 'flee' }), 5).heroX).toBeLessThan(0.1);
  });

  it('who has the first beat shows at the meeting', () => {
    expect(posesAt(model(FIGHTS.lost), 0)).toMatchObject({ hero: 'stand', foe: 'raise' });
    expect(posesAt(model(FIGHTS.won), 0)).toMatchObject({ hero: 'raise', foe: 'stand' });
  });
});

describe('war panel', () => {
  const input = { id: 'WR-03', country: 'MH-09', rank: 2, points: 3, since: 22, age: 27, battles: 9, held: 5, won: 3, lost: 1, pay: 41, foes: ['npc_knight', 'npc_inquisitor'] };

  it('names the war, the rank and the road to the next, the counts and the foes', () => {
    const w = warModel(data, input);
    expect(w.name).toBe('สงครามอาหาร');
    expect(w.rank).toBe('สิบตรี');
    expect(w.next).toBe('จ่า');
    expect(w.progress).toEqual({ points: 3, need: 5 });
    expect([w.battles, w.won, w.held, w.lost, w.pay]).toEqual([9, 3, 5, 1, 41]);
    expect(w.foes).toEqual(['อัศวิน', 'ผู้พิพากษาศาลศาสนา']);
    expect(w.years).toBe(5);
    expect(w.rate).toBeCloseTo(8 / 9);
  });

  it('the highest rank has no road ahead, and a war without a name is told by its place', () => {
    const top = warModel(data, { ...input, rank: 4, points: 0 });
    expect(top.next).toBeNull();
    expect(top.progress).toBeNull();
    expect(warModel(data, { ...input, id: '' }).name).toContain('ศึกใหญ่');
  });

  it('reads the war the combat system keeps on the life, and none when there is none', () => {
    expect(warInput(base)).toBeNull();
    const life = { ...base.life!, ext: { ...base.life!.ext, combat: { rank: 1, war: { id: 'WR-03', foes: ['wolf'], since: 20, battles: 2, held: 1, won: 1, lost: 0, pay: 7, points: 1 } } } };
    const w = warInput({ ...base, life });
    expect(w).toMatchObject({ id: 'WR-03', rank: 1, battles: 2, pay: 7 });
  });

  it('a campaign line tells the same war', () => {
    const e: LogEntry = {
      n: 1, worldYear: 1, sys: 'combat', kind: 'campaign', level: 1,
      data: { war: 'WR-03', country: 'MH-09', end: false, years: 3, since: 22, battles: 4, held: 2, won: 1, lost: 1, pay: 12, foes: 'wolf', rank: 'soldier', rankN: 1, totalBattles: 4, total: false },
    };
    expect(warFromCampaign(e)).toMatchObject({ id: 'WR-03', rank: 1, battles: 4, won: 1, held: 2, lost: 1, pay: 12, foes: ['wolf'], age: 25 });
  });
});
