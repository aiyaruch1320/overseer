// The god in the test tools (docs/guide/code-plan.md §8.0): the commands of `npm run play`, the policy of `npm run life`.
// The god system itself is written elsewhere, so the tests register a stand-in action and a stand-in policy.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { command, hasAction, onAction, resetActions } from '../../src/core/command';
import type { Game, GameData } from '../../src/core/game';
import { write } from '../../src/core/log';
import { GodConsole, callLines, parseGod } from '../../scripts/tools/god-commands';
import { clearPolicySteps, registerPolicyStep } from '../../scripts/tools/god-hooks';
import { runLifeReport } from '../../scripts/tools/life-run';
import { loadAll } from '../../scripts/tools/node-data';
import { POLICIES, afterBeat, createSession, runToCall, startLife, type Session } from '../../scripts/tools/session';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const comparable = (text: string) => text.split('\n').filter((l) => !l.startsWith('กติกาที่ยังไม่มีใครรับ')).join('\n');
const cli = (script: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync('npx', ['tsx', `scripts/tools/${script}.ts`, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 50000 });

/** A stand-in for the chest action: costs 5 light, needs 5 light, writes the chronicle and one log line. */
function registerChest() {
  onAction('chest.open', {
    check: (ctx) => (ctx.state.god.light < 5 ? 'แสงศรัทธาไม่พอ' : null),
    preview: () => ({ cost: { light: 5 }, expected: 'การ์ดหกใบ', chance: 0.5, secret_key: 1 }),
    run(ctx) {
      ctx.state.god.light -= 5;
      ctx.state.god.chronicle.push({ worldYear: ctx.state.clock.worldYear, hAge: ctx.state.life?.hAge, kind: 'chest.open', id: 'x', result: 'ทดสอบ' });
      write(ctx.state, { sys: 'god', kind: 'test', level: 1, data: {} });
    },
  });
}

function fresh(seed = 1, policy?: (typeof POLICIES)[number]): Session {
  const s = createSession(data, { seed, policy });
  startLife(s);
  return s;
}

beforeEach(() => {
  resetActions();
  clearPolicySteps();
});
afterEach(() => {
  resetActions();
  clearPolicySteps();
});

describe('the words of the god', () => {
  it('turns each line into an action and its arguments', () => {
    expect(parseGod('chest', [])).toEqual({ action: 'chest.open', args: {} });
    expect(parseGod('pick', ['2'])).toEqual({ action: 'chest.pick', args: { slot: 2 } });
    expect(parseGod('dream', ['3'])).toEqual({ action: 'dream.send', args: { path: 3 } });
    expect(parseGod('whisper', ['ระวัง'])).toEqual({ action: 'whisper', args: { hint: 'ระวัง' } });
    expect(parseGod('answer', ['1', 'ให้'])).toEqual({ action: 'prayer.answer', args: { id: 1, mode: 'ให้' } });
    expect(parseGod('miracle', ['mr-04', 'ไอซิลโนวา'])).toEqual({ action: 'miracle', args: { id: 'MR-04', target: 'ไอซิลโนวา' } });
    expect(parseGod('decree', ['WR-04', '2'])).toEqual({ action: 'decree', args: { event: 'WR-04', mult: 2 } });
    expect(parseGod('yes', [])).toEqual({ meta: 'yes' });
  });

  it('says how to type a command that was typed wrong', () => {
    for (const [w, rest] of [['pick', []], ['dream', ['x']], ['whisper', []], ['answer', ['1']], ['miracle', ['07']], ['decree', ['WR-04']], ['decree', ['WR-04', 'x']]] as const) {
      const r = parseGod(w, [...rest]);
      expect('error' in r && r.error.startsWith('ใช้:')).toBe(true);
    }
  });
});

describe('the console: preview first, then yes', () => {
  it('says "ยังไม่มีพลังนี้" for a power nobody registered, and lists it in options', () => {
    const s = fresh();
    const god = new GodConsole({ game: s.game, data });
    expect(god.handle('chest')).toEqual(['เปิดหีบประทาน: ยังไม่มีพลังนี้']);
    expect(god.pending).toBeNull();
    expect(god.handle('yes')![0]).toContain('ไม่มีคำสั่งที่รอยืนยัน');
    expect(god.options().join('\n')).toContain('chest (เปิดหีบประทาน) — ยังไม่มีพลังนี้');
    expect(god.power().join('\n')).toContain('ยังไม่มีพลังใดลงทะเบียน');
    expect(god.handle('status')).toBeUndefined();
  });

  it('a preview changes nothing; yes pays, writes the chronicle and shows what was written', () => {
    registerChest();
    const s = fresh();
    const g = s.game;
    g.state.god.light = 12;
    const god = new GodConsole({ game: g, data });
    const before = JSON.stringify(g.state);
    const p = god.handle('chest')!;
    expect(JSON.stringify(g.state)).toBe(before);
    expect(p[0]).toBe('-- ตัวอย่างผล: เปิดหีบประทาน --');
    expect(p.join('\n')).toContain('ราคา: แสงศรัทธา 5');
    expect(p.join('\n')).toContain('ผลที่คาด: การ์ดหกใบ');
    expect(p.join('\n')).toContain('โอกาส: 50%');
    expect(p.join('\n')).not.toContain('secret_key');
    expect(p[p.length - 1]).toContain('yes');
    expect(god.pending?.action).toBe('chest.open');
    // `options` and `power` are looks too
    god.options();
    god.power();
    expect(JSON.stringify(g.state)).toBe(before);

    const done = god.handle('yes')!;
    expect(done[0]).toBe('-- ทำแล้ว: เปิดหีบประทาน --');
    expect(done.join('\n')).toContain('แสงศรัทธา 12 → 7');
    expect(g.state.god.light).toBe(7);
    expect(g.state.god.chronicle).toHaveLength(1);
    expect(god.pending).toBeNull();
    expect(god.handle('yes')![0]).toContain('ไม่มีคำสั่งที่รอยืนยัน');
  });

  it('`no` drops the waiting command; a refused command says why and waits for nothing', () => {
    registerChest();
    const s = fresh();
    const god = new GodConsole({ game: s.game, data });
    s.game.state.god.light = 2;
    expect(god.handle('chest')![0]).toBe('เปิดหีบประทาน: ทำไม่ได้ — แสงศรัทธาไม่พอ');
    expect(god.pending).toBeNull();
    s.game.state.god.light = 9;
    god.handle('chest');
    expect(god.handle('no')![0]).toContain('ยกเลิก');
    expect(god.handle('yes')![0]).toContain('ไม่มีคำสั่งที่รอยืนยัน');
    expect(s.game.state.god.light).toBe(9);
  });

  it('--yes runs at once; a waiting command survives a second console (the file of play) and the clock drops it', () => {
    registerChest();
    const a = fresh();
    a.game.state.god.light = 20;
    const auto = new GodConsole({ game: a.game, data, autoYes: true });
    expect(auto.handle('chest')!.join('\n')).toContain('-- ทำแล้ว: เปิดหีบประทาน --');
    expect(a.game.state.god.light).toBe(15);

    const b = fresh();
    b.game.state.god.light = 20;
    const first = new GodConsole({ game: b.game, data });
    first.handle('chest');
    const again = new GodConsole({ game: b.game, data, pending: JSON.parse(JSON.stringify(first.pending)) });
    expect(again.handle('yes')![0]).toContain('ทำแล้ว');
    first.handle('chest');
    expect(first.drop()[0]).toContain('ยกเลิก');
    expect(first.pending).toBeNull();
  });

  it('options reads the check of every registered action', () => {
    registerChest();
    const s = fresh();
    const god = new GodConsole({ game: s.game, data });
    s.game.state.god.light = 2;
    expect(god.options().join('\n')).toContain('chest (เปิดหีบประทาน) — ยังทำไม่ได้: แสงศรัทธาไม่พอ');
    s.game.state.god.light = 30;
    expect(god.options().join('\n')).toMatch(/chest \(เปิดหีบประทาน\) — ทำได้ · ราคา แสงศรัทธา 5/);
    expect(god.doableNow()).toEqual(['chest']);
    expect(god.power().join('\n')).toContain('ราคาตอนนี้: เปิดหีบประทาน แสงศรัทธา 5');
    expect(hasAction('chest.open')).toBe(true);
  });

  it('a handler that fails on bad arguments is answered, not thrown, in a preview', () => {
    onAction('miracle', {
      check: (_c, a) => (a.id === 'MR-04' ? null : `ไม่มีปาฏิหาริย์ ${(a.target as { x: string }).x}`),
      preview: () => ({ lines: ['ผลที่คาด: ฝนตก'] }),
      run: () => undefined,
    });
    const s = fresh();
    const god = new GodConsole({ game: s.game, data });
    expect(god.handle('miracle MR-09')![0]).toContain('ใส่รายละเอียดไม่ครบหรือไม่ถูก');
    expect(god.handle('miracle MR-04')!.join('\n')).toContain('ผลที่คาด: ฝนตก');
  });
});

describe('the call of the game', () => {
  it('stops at an attention call when the attention system exists, and tells why', () => {
    const s = fresh(5);
    const g: Game = s.game;
    let fired = false;
    g.systems.push({
      name: 'attention',
      beat(ctx) {
        if (!fired && (ctx.state.life?.hAge ?? 0) >= 2) {
          fired = true;
          write(ctx.state, { sys: 'attention', kind: 'call', level: 2, data: { reason: 'หน้าต่างพระเจ้า: ทางแยกแรก', source: 'เรื่อง' } });
        }
      },
    });
    // an entry of level 3 from another system no longer stops it
    g.systems.push({ name: 'noise', beat: (ctx) => void (ctx.state.life!.hAge === 1 && write(ctx.state, { sys: 'story', kind: 'x', level: 3, data: {} })) });
    const r = runToCall(g);
    expect(r.stoppedBy).toBe('call');
    expect(r.call?.sys).toBe('attention');
    expect(g.state.life!.hAge).toBeGreaterThanOrEqual(2);
    const why = callLines(data, r.call!).join('\n');
    expect(why).toContain('เกมเรียกเพราะ: หน้าต่างพระเจ้า: ทางแยกแรก');
    expect(why).toContain('ที่มา: เรื่อง');
  });

  it('without the attention system the old rule holds: an entry of level 3', () => {
    const s = fresh(5);
    // take the attention system out to see the rule that holds without it
    const at = s.game.systems.findIndex((x) => x.name === 'attention');
    if (at >= 0) s.game.systems.splice(at, 1);
    s.game.systems.push({ name: 'noise', beat: (ctx) => void (ctx.state.life!.hAge === 1 && !ctx.state.log.some((e) => e.kind === 'x') && write(ctx.state, { sys: 'story', kind: 'x', level: 3, data: {} })) });
    const r = runToCall(s.game);
    expect(r.stoppedBy).toBe('call');
    expect(callLines(data, r.call!)[0]).toContain('บันทึกระดับ 3');
  });
});

describe('npm run play with the commands of the god', () => {
  it('answers help, power and options, and "ยังไม่มีพลังนี้" for a power that is not there', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-god-'));
    try {
      const out = cli('play', ['--seed=1', '--new', '--cmd=help; power; options; chest'], { OVERSEER_PLAY_DIR: dir });
      for (const w of ['chest', 'pick N', 'reroll', 'skip', 'dream N', 'whisper <คำใบ้>', 'answer <ใบ>', 'miracle MR-xx', 'decree <เหตุการณ์> <ตัวคูณ>', 'yes']) expect(out).toContain(w);
      expect(out).toContain('-- พลังของพระเจ้า --');
      expect(out).toContain('แสงศรัทธา');
      expect(out).toContain('-- สิ่งที่ทำได้ตอนนี้ --');
      // before the god system exists every power says so; after it, a power may answer for itself
      if (!/chest \(เปิดหีบประทาน\) — (ทำได้|ยังทำไม่ได้)/.test(out)) expect(out).toContain('เปิดหีบประทาน: ยังไม่มีพลังนี้');
      expect(out).not.toMatch(/undefined|\[object|NaN/);
      const bad = cli('play', ['--seed=1', '--cmd=pick; dream x; miracle 7'], { OVERSEER_PLAY_DIR: dir });
      expect(bad).toContain('ใช้: pick N');
      expect(bad).toContain('ใช้: dream N');
      expect(bad).toContain('ใช้: miracle MR-xx');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a policy name that is not one of the eight', () => {
    expect(POLICIES).toHaveLength(8);
    const r = spawnSync('npx', ['tsx', 'scripts/tools/play.ts', '--seed=1', '--policy=เทพบุตร'], { cwd: root, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--policy must be one of');
  });
});

describe('npm run life --policy', () => {
  /** A stand-in policy of the god: once a year (first beat) it opens the chest if it can, and writes the policy name into the chronicle. */
  function standInPolicy(calls: string[] = []) {
    registerChest();
    registerPolicyStep('god', (ctx, policy) => {
      calls.push(policy);
      if (policy === 'เงียบ' || ctx.state.clock.quarter !== 0) return;
      ctx.state.god.light += 8; // income, so the policy has something to spend
      const r = command(ctx, { type: 'god', action: 'chest.open', args: {}, confirm: true });
      if (r.ok) ctx.state.god.chronicle[ctx.state.god.chronicle.length - 1].id = policy;
    });
    return calls;
  }

  it('calls the policy function after every beat, in the same way twice, and ends with the hand of the god', () => {
    const calls = standInPolicy();
    const a = runLifeReport(data, { seed: 2, policy: 'เมตตา' });
    const n = calls.length;
    expect(n).toBeGreaterThan(100);
    expect(new Set(calls)).toEqual(new Set(['เมตตา']));
    const b = runLifeReport(data, { seed: 2, policy: 'เมตตา' });
    expect(comparable(b.text)).toBe(comparable(a.text));
    expect(a.text).toContain('-- พระหัตถ์ --');
    expect(a.text).toContain('นโยบายพระเจ้า เมตตา');
    expect(a.text).toMatch(/พลังที่เหลือ: แสงศรัทธา [\d.]+ · ความหวาดกลัว [\d.]+/);
    expect(a.text).toMatch(/ใช้พลัง \d+ ครั้ง: เปิดหีบ ×\d+/);
    expect(a.text).toContain('พงศาวดารพระหัตถ์:');
    expect(a.text).toMatch(/│ เปิดหีบ เมตตา → ทดสอบ/);
    expect(a.text).not.toContain('ยังไม่พบฟังก์ชันนโยบาย');
    expect(a.state.god.chronicle.length).toBeGreaterThan(5);
  });

  it('the silent policy uses no power; every policy name is accepted', () => {
    standInPolicy();
    const q = runLifeReport(data, { seed: 2, policy: 'เงียบ' });
    expect(q.text).toContain('ใช้พลัง 0 ครั้ง');
    expect(q.text).not.toContain('พงศาวดารพระหัตถ์:');
    for (const p of POLICIES) expect(runLifeReport(data, { seed: 3, policy: p }).state.god.ext.policy).toBe(p);
  });

  it('without a policy the hooks are never called and the life is the life of the systems alone', () => {
    const calls = standInPolicy();
    const plain = runLifeReport(data, { seed: 2 });
    expect(calls).toEqual([]);
    expect(plain.text).not.toContain('-- พระหัตถ์ --');
    clearPolicySteps();
    expect(comparable(runLifeReport(data, { seed: 2 }).text)).toBe(comparable(plain.text));
  });

  it('says the policy has no effect when no policy function is found', () => {
    const r = runLifeReport(data, { seed: 2, policy: 'ลงโทษ' });
    expect(r.text).toContain('ยังไม่พบฟังก์ชันนโยบายของระบบพระเจ้า (policyStep)');
    expect(r.text).toContain('-- พระหัตถ์ --');
    expect(r.text).toContain('ใช้พลัง 0 ครั้ง');
  });

  it('afterBeat does nothing for a dead character or without a policy', () => {
    const calls = standInPolicy();
    const s = fresh(2);
    expect(afterBeat(s)).toBe(0);
    const p = fresh(2, 'เมตตา');
    expect(afterBeat(p)).toBe(1);
    p.game.state.life!.dead = { year: 0, hAge: 1, cause: 'x' };
    expect(afterBeat(p)).toBe(0);
    expect(calls).toEqual(['เมตตา']);
  });

  it('npm run life accepts every policy name from the command line', () => {
    for (const p of ['ปั้นนิสัย', 'เร่งจบ']) expect(cli('life', ['--seed=1', `--policy=${p}`])).toContain(`นโยบายพระเจ้า ${p}`);
    const bad = spawnSync('npx', ['tsx', 'scripts/tools/life.ts', '--seed=1', '--policy=เทพบุตร'], { cwd: root, encoding: 'utf8' });
    expect(bad.status).toBe(2);
  });
});
