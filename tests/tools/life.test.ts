// The test tools of the system phase: `npm run life`, `npm run play` (docs/guide/code-plan.md §8.0).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runLifeReport } from '../../scripts/tools/life-run';
import { loadAll } from '../../scripts/tools/node-data';
import { statusLines } from '../../scripts/tools/report';
import { createSession, resumeSession, runToCall, runToDeath, startLife, toolNotes, toolSystems } from '../../scripts/tools/session';
import { versions, type GameData } from '../../src/core/game';
import { leaks, lines, unphrased } from '../../src/core/text';
import { load, save } from '../../src/core/save';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let data: GameData;
beforeAll(() => {
  data = loadAll();
});

/** The rules layer reports an unhandled kind once per process, so a second run in one process lacks that one line. */
const comparable = (text: string) => text.split('\n').filter((l) => !l.startsWith('กติกาที่ยังไม่มีใครรับ')).join('\n');

const cli = (script: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync('npx', ['tsx', `scripts/tools/${script}.ts`, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 50000 });

describe('life: a whole life as text', () => {
  it('runs a seed without failing and gives the same text twice', () => {
    const a = runLifeReport(data, { seed: 1 });
    const b = runLifeReport(data, { seed: 1 });
    expect(comparable(a.text)).toBe(comparable(b.text));
    expect(a.state.life!.dead).toBeTruthy();
    for (const head of ['== ชีวิตหนึ่ง · เมล็ด 1', '-- บันทึก --', '-- NPC ที่พบ --', '-- สรุป --']) expect(a.text).toContain(head);
    expect(a.text).toContain('[ตาย]');
    expect(a.text).not.toMatch(/undefined|\[object|NaN/);
  });

  it('a seed gives the same life whatever was played before it in the process (the data indexes keep nothing of one world)', () => {
    // two loads of the data have two sets of indexes: in one, another world is played first; the seed must not notice
    const after = loadAll();
    for (const seed of [3, 11]) startLife(createSession(after, { seed }));
    const birthOf = (d: GameData) => {
      const s = createSession(d, { seed: 7 });
      startLife(s);
      return JSON.stringify(s.game.state);
    };
    expect(birthOf(after)).toBe(birthOf(loadAll()));
  });

  it('another seed or another people gives another life', () => {
    const a = runLifeReport(data, { seed: 1 });
    expect(comparable(runLifeReport(data, { seed: 2 }).text)).not.toBe(comparable(a.text));
    const elf = runLifeReport(data, { seed: 1, race: 'el' });
    expect(elf.state.life!.race).toBe('elf');
    expect(elf.state.life!.dead!.hAge).toBeGreaterThan(30);
  });

  it('records the policy without effect while there is no god system', () => {
    const r = runLifeReport(data, { seed: 3, policy: 'เมตตา' });
    expect(r.text).toContain('นโยบายพระเจ้า เมตตา');
    // once the god system is part of the core list the policy has an effect (tests/tools/god.test.ts covers that)
    if (!toolSystems().systems.some((s) => s.name === 'god')) expect(r.text).toContain('ยังไม่มีผล');
    expect(r.state.god.ext.policy).toBe('เมตตา');
  });

  it('a life saved in the middle and loaded again ends exactly like the one that was not stopped', () => {
    const whole = createSession(data, { seed: 4 });
    startLife(whole);
    runToDeath(whole.game);

    const part = createSession(data, { seed: 4 });
    startLife(part);
    for (let i = 0; i < 70; i++) part.game.beat();
    const { state, stale } = load(save(part.game.state), versions(data));
    expect(stale).toEqual([]);
    const rest = resumeSession(data, state, { seed: 4 });
    runToDeath(rest.game);

    const view = (s: typeof whole) => ({ life: s.game.state.life, npcs: s.game.state.npcs.slots, clock: s.game.state.clock, log: s.game.state.log.filter((e) => e.sys !== 'rules').map((e) => ({ ...e, n: 0 })) });
    expect(JSON.parse(JSON.stringify(view(rest)))).toEqual(JSON.parse(JSON.stringify(view(whole))));
  });

  it('runToCall stops at an entry of level 3 (the game calls the player) and at the death', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    let calls = 0;
    for (let i = 0; i < 100; i++) {
      const mark = s.game.state.logN;
      const r = runToCall(s.game);
      if (r.stoppedBy === 'call') {
        calls++;
        expect(s.game.state.log.some((e) => e.n >= mark && e.level === 3)).toBe(true);
        continue;
      }
      expect(r.stoppedBy).toBe('death');
      break;
    }
    expect(s.game.state.life!.dead).toBeTruthy();
    // the story system marks the windows of the god as level 3; the toy character alone has none
    expect(calls).toBeGreaterThanOrEqual(0);
  });
});

describe('the commands', () => {
  it('npm run life prints the same text for the same seed, in two processes', () => {
    const a = cli('life', ['--seed=1']);
    const b = cli('life', ['--seed=1']);
    expect(a).toBe(b);
    expect(a).toContain('-- สรุป --');
    expect(cli('life', ['--seed=1', '--policy=ลงโทษ'])).toContain('นโยบายพระเจ้า ลงโทษ');
  });

  it('npm run play keeps the state between commands and plays the same life as one long run', () => {
    const dirA = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-a-'));
    const dirB = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-b-'));
    try {
      const first = cli('play', ['--seed=1', '--new', '--cmd=advance 4'], { OVERSEER_PLAY_DIR: dirA });
      expect(first).toContain('-- เดิน 4 จังหวะ --');
      expect(first).toContain('-- เกิด --');
      const status = cli('play', ['--seed=1', '--cmd=status'], { OVERSEER_PLAY_DIR: dirA });
      expect(status).toContain('(เล่นต่อจาก');
      expect(status).toMatch(/อายุ \d+ \(ปีชีวิต\)/);
      // chunked in three runs against one run to the end
      cli('play', ['--seed=1', '--cmd=advance 100'], { OVERSEER_PLAY_DIR: dirA });
      const end = cli('play', ['--seed=1', '--cmd=advance 1000; log 500'], { OVERSEER_PLAY_DIR: dirA });
      expect(end).toContain('-- ชีวิตจบ --');
      const once = cli('play', ['--seed=1', '--new', '--cmd=advance 1000; log 500'], { OVERSEER_PLAY_DIR: dirB });
      const tail = (s: string) => s.slice(s.indexOf('-- บันทึก'));
      expect(tail(end)).toBe(tail(once));
      expect(cli('play', ['--seed=1', '--cmd=help;quit'], { OVERSEER_PLAY_DIR: dirA })).toContain('จบการเล่น');
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it('npm run play: status tells who the character is, `world` holds the numbers of the world (T7)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-c-'));
    try {
      const out = cli('play', ['--seed=201', '--new', '--race=be', '--cmd=advance 60; status; world'], { OVERSEER_PLAY_DIR: dir });
      const status = out.slice(out.indexOf('-- สถานะ --', out.indexOf('-- เดิน')), out.indexOf('-- โลก (ดีบัก) --'));
      for (const word of ['อายุ', 'เผ่าสัตว์', 'ชนชั้น', 'ทอง', 'อาชีพ', 'นิสัย', 'คำถามของชีวิต', 'พวกพ้อง', 'ครอบครัว', 'การเดินทาง']) expect(status, word).toContain(word);
      expect(status).not.toMatch(/NPC: มีชีวิต|โลก: ยุค|มังกรล้ม/);
      expect(out.slice(out.indexOf('-- โลก (ดีบัก) --'))).toMatch(/NPC: มีชีวิต[\s\S]*โลก: ยุค/);
      expect(out).toContain('คำถามของชีวิต: จะล่าตามสิทธิ์เดิม');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('status after the systems of M3', () => {
  it('tells the allies and the family with their line and level, the travel, the arm in hand, the debt and the bondage', () => {
    const s = createSession(data, { seed: 201, race: 'be' });
    startLife(s);
    for (let i = 0; i < 80; i++) s.game.beat();
    const life = s.game.state.life!;
    const plain = statusLines(data, s.game.state).join('\n');
    expect(plain).toMatch(/พวกพ้อง [^\n]+\((?:สหาย|คู่หู|คนรัก|ครู|ศิษย์|คู่แข่ง) (?:รู้จัก|คุ้นเคย|สนิท|ไว้ใจ|ชั่วชีวิต)\)/);
    expect(plain).toMatch(/ครอบครัว [^\n]+\((?:ญาติผู้ใหญ่|ญาติรุ่นเยาว์|พี่น้อง) /);
    expect(plain).toMatch(/การเดินทาง (?:อยู่ถิ่น|ในทวีป|ข้ามทวีป)/);
    expect(plain).not.toMatch(/หนี้ \d|การผูกตัว/);
    // what the other systems keep on the life is read: the arm, the debt, a bondage and a person the character holds
    (life.ext.items as { wield?: string }).wield = 'ws_rapier';
    (life.ext.economy as { debt: number }).debt = 120;
    life.ext.bondage = { level: 2, owner: 'อัลโกร', price: 101, country: 'AL-01', years: 3, held: [{ id: 'H1', name: 'ฟีทิส', level: 'B2' }] };
    const more = statusLines(data, s.game.state);
    const text = more.join('\n');
    expect(text).toMatch(/อาวุธที่ถือ \S+/);
    expect(text).toContain('หนี้ 120 ทอง');
    expect(text).toMatch(/การผูกตัว ผู้รับใช้ตามสัญญา ที่\S+ · เจ้าของ อัลโกร · ค่าไถ่ 101 ทอง · สัญญาเหลือ 3 ปี/);
    expect(text).toContain('ผู้ที่ถือสัญญาไว้ ฟีทิส');
    for (const l of more) expect(leaks(l), l).toEqual([]);
  });
});

describe('status tells the partner and the children (M3 text)', () => {
  it('lists the partner, and each child with age, stage and the other parent', () => {
    const s = createSession(data, { seed: 92 });
    startLife(s);
    for (let i = 0; i < 4 * 55; i++) s.game.beat();
    const text = statusLines(data, s.game.state).join('\n');
    expect(text).toMatch(/(?:คนรัก|คู่ชีวิต) [^\n]+\((?:คนรัก|ไม่|สหาย)/);
    expect(text).toMatch(/ลูก [^\n]+\(อายุ \d+ (?:ทารก|วัยเรียน|วัยรุ่น|ผู้ใหญ่) · อีกฝ่ายคือ [^\n)]+\)/);
    // the partner is not listed twice, and a child is told once
    expect(text.match(/ลูก /g)?.length).toBe(1);
    for (const l of text.split('\n')) expect(leaks(l), l).toEqual([]);
  });
});

describe('what the player reads holds no code (review M1 T1 T3)', () => {
  const PEOPLES = ['hu', 'el', 'de', 'dw', 'or', 'ha', 'be', 'na', 'dk', 'va', 'fa', 'sl', 'dm', 'me', 'wi', 'gi', 'la', 'co', 'so', 'mu', 'gh'];

  /** The lines of the story log and the people met, without the tag in front. */
  const readable = (text: string) =>
    text
      .split('\n')
      .filter((l) => l.includes('│') || l.startsWith('  ') || l.startsWith('!'))
      .map((l) => l.replace(/^[* !]*อายุ[^│]*│\s*|^[* !]*ศ\.ม\.[^│]*│\s*/, '').replace(/^\[[^\]]*\]\s*/, ''));

  it('twenty-one peoples and a few free seeds give lines with no id, no stray mark and no badly cut sentence', () => {
    const bad: string[] = [];
    const seen = new Set<string>();
    let n = 0;
    const lives = [...PEOPLES.map((r, i) => ({ seed: 40 + i, race: r })), { seed: 201, race: 'be' }, { seed: 101, race: 'hu' }, { seed: 7, race: undefined }, { seed: 8, race: undefined }];
    for (const l of lives) {
      const run = runLifeReport(data, { seed: l.seed, race: l.race, minLevel: 1 });
      const body = run.text.split('-- บันทึก --')[1].split('-- สรุป --')[0];
      for (const line of readable(body)) {
        n++;
        const found = leaks(line);
        if (found.length) bad.push(`${l.seed}${l.race ?? ''} ${found.join(',')}: ${line}`);
      }
      for (const line of statusLines(data, run.state)) {
        const found = leaks(line);
        if (found.length) bad.push(`status ${l.seed}${l.race ?? ''} ${found.join(',')}: ${line}`);
      }
      // M3: nothing is left without a phrasing, and the small lines kept for level 0 hold no code either
      const left = unphrased(data, run.state.log);
      if (Object.keys(left).length) bad.push(`unphrased ${l.seed}${l.race ?? ''} ${JSON.stringify(left)}`);
      for (const x of lines(data, run.state.log, 0)) {
        const found = leaks(x.text);
        if (found.length) bad.push(`level0 ${l.seed}${l.race ?? ''} ${found.join(',')}: ${x.text}`);
        seen.add(`${x.sys}/${x.entry.kind}`);
      }
    }
    expect(n).toBeGreaterThan(1500);
    expect(bad).toEqual([]);
    // the lives walk through the systems of M3: their lines are in the text
    for (const kind of ['bonds/tie', 'bonds/arc', 'bonds/mood', 'bonds/funeral', 'travel/trip', 'items/get', 'combat/prelude', 'economy/tight']) expect(seen.has(kind), kind).toBe(true);
  });

  it('the birth tells who, family, traits and the question of the life; the death tells cause, place and age', () => {
    const run = runLifeReport(data, { seed: 201, race: 'be', minLevel: 1 });
    const ls = readable(run.text.split('-- บันทึก --')[1].split('-- NPC ที่พบ --')[0]);
    expect(ls[0]).toContain('เผ่าสัตว์');
    expect(ls[1]).toContain('เพศหญิง');
    expect(ls[1]).toContain('ครอบครัว');
    expect(ls[2]).toMatch(/^นิสัยเด่น: /);
    expect(ls[3]).toMatch(/^คำถามของชีวิต: จะล่าตามสิทธิ์เดิม/);
    // the death line, then the one ending chosen at death (review M1 S1)
    const lines = ls.filter((l) => l.trim());
    const death = lines.find((l) => l.includes(run.state.life!.name) && l.includes(`อายุ ${run.state.life!.dead!.hAge}`) && /ตาย|สิ้น|จากไป/.test(l))!;
    expect(death).toBeDefined();
    expect(death).toMatch(/ที่\S+/);
    expect(lines.filter((l) => l.startsWith('ปลายทาง:')).length).toBeLessThanOrEqual(1);
  });

  it('a change of social class is one line of the log, written by the character system (T9)', () => {
    const run = runLifeReport(data, { seed: 101, race: 'hu', minLevel: 1 });
    const changes = run.state.log.filter((x) => x.sys === 'character' && x.kind === 'class');
    expect(changes.length).toBeGreaterThan(0);
    const said = run.text.split('\n').filter((l) => /ฐานะ(สูงขึ้น|ตก)จาก/.test(l));
    expect(said).toHaveLength(changes.length);
  });

  it('the NPCs met are listed by place name, not by id', () => {
    const run = runLifeReport(data, { seed: 201, race: 'be', minLevel: 1 });
    const met = run.text.split('-- NPC ที่พบ --')[1].split('-- สรุป --')[0];
    expect(met).not.toMatch(/\b[A-Z]{2}-\d{2}\b/);
    expect(met).toMatch(/ที่\S+/);
  });
});
