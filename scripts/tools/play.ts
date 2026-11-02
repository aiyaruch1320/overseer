// npm run play -- --seed=N [--persona=ชื่อ] [--policy=...] [--race=hu] [--cmd="advance 4; status"] [--new] [--yes] [--dev]
// Plays one life a command at a time and keeps the state in a file, so many commands can follow each other
// (docs/guide/code-plan.md §8.0). Each run does the commands given by --cmd (default: advance to the next call of the game),
// prints what the player sees, and saves the state.
// State file: <dir>/<seed>.json where dir is $OVERSEER_PLAY_DIR or <os temp dir>/overseer-play (outside the repo on purpose).
// Commands: advance [N] · status · log [N] · npcs · world (developer numbers) · help · quit, and the commands of the god
// (god-commands.ts): chest · pick N · reroll · skip · dream N · whisper <hint> · answer <card> <mode> · miracle MR-xx [target] ·
// decree <event> <mult> · conjure <words> · vow N · power · options · yes · no. A command of the god shows its preview first and
// waits for `yes` (it may be in the next --cmd; the waiting command is kept in <seed>.pending.json). `--yes` does it at once.
// `advance` without a number stops at the next call of the game: the `attention` system's call if it exists, else a level 3 entry.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { versions } from '../../src/core/game';
import type { LogEntry } from '../../src/core/types';
import { npcsAt } from '../../src/core/npc';
import { load, save } from '../../src/core/save';
import { placeName } from '../../src/core/text';
import { timeline, statusLines, worldLines } from './report';
import { GodConsole, callLines, godHelp, isGodWord, type PendingGod } from './god-commands';
import { loadGodHooks } from './god-hooks-node';
import { intArg, parseArgs } from './args';
import { loadAll } from './node-data';
import { POLICIES, afterBeat, createSession, resumeSession, runToCall, startLife, stepBeat, toolNotes, type Policy, type Session } from './session';

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args.seed, 'seed', 1);
const dir = process.env.OVERSEER_PLAY_DIR ?? path.join(os.tmpdir(), 'overseer-play');
const file = path.join(dir, `${seed}.json`);
const pendingFile = path.join(dir, `${seed}.pending.json`);
const policy = args.policy as Policy | undefined;
if (policy && !POLICIES.includes(policy)) {
  console.error(`--policy must be one of ${POLICIES.join(' ')}`);
  process.exit(2);
}

await loadGodHooks();
const data = loadAll();
const opts = { seed, race: args.race, country: args.country, persona: args.persona, policy, startYear: args.year === undefined ? undefined : intArg(args.year, 'year') };

function open(): { s: Session; fresh: boolean } {
  if (args.new) rmSync(pendingFile, { force: true });
  if (args.new && existsSync(file)) rmSync(file);
  if (existsSync(file)) {
    const { state, stale } = load(readFileSync(file, 'utf8'), versions(data));
    if (policy) state.god.ext.policy = policy;
    const s = resumeSession(data, state, opts);
    if (stale.length) s.notes.push(`ข้อมูลเปลี่ยนตั้งแต่เซฟ (${stale.join(' ')}) ผลอาจไม่ตรงเดิม`);
    return { s, fresh: false };
  }
  const s = createSession(data, opts);
  startLife(s);
  return { s, fresh: true };
}

const { s, fresh } = open();
const g = s.game;
const out: string[] = [];
const say = (...l: string[]) => out.push(...l);

say(`== เล่นทดสอบ · เมล็ด ${seed}${g.state.god.ext.persona ? ` · ผู้เล่น ${String(g.state.god.ext.persona)}` : ''} ==`);
if (fresh) for (const n of s.notes) say(`หมายเหตุ: ${n}`);
else say(`(เล่นต่อจาก ${file})`);

function seen(mark: number, max = 80): string[] {
  const ls = timeline(g.ctx.data, g.state.log, 1, { fromN: mark, notes: toolNotes(g.state) });
  return ls.length > max ? [...ls.slice(0, max), `… และอีก ${ls.length - max} บรรทัด (ใช้ log เพื่อดูทั้งหมด)`] : ls;
}

function readPending(): PendingGod | null {
  if (!existsSync(pendingFile)) return null;
  try {
    return JSON.parse(readFileSync(pendingFile, 'utf8')) as PendingGod;
  } catch {
    return null;
  }
}

const god = new GodConsole({ game: g, data, autoYes: !!args.yes, dev: !!args.dev, pending: fresh ? null : readPending() });

function run(cmdText: string): boolean {
  const [cmd, ...rest] = cmdText.split(/\s+/).filter(Boolean);
  const st = g.state;
  if (isGodWord(cmd)) {
    say(...god.handle(cmdText)!);
    return true;
  }
  switch (cmd) {
    case 'advance': {
      if (!st.life || st.life.dead) {
        say('ชีวิตนี้จบแล้ว (ใช้ --new เพื่อเริ่มโลกใหม่ด้วยเมล็ดเดิม)');
        return true;
      }
      say(...god.drop());
      const mark = st.logN;
      let why: string;
      let call: LogEntry | undefined;
      const after = () => void afterBeat(s);
      if (rest[0] !== undefined) {
        const n = Math.max(1, Math.floor(Number(rest[0])));
        if (!Number.isFinite(n)) {
          say(`advance ต้องตามด้วยจำนวนจังหวะ (หนึ่งปีชีวิต = 4 จังหวะ) ได้ "${rest[0]}"`);
          return true;
        }
        let done = 0;
        while (done < n && st.life && !st.life.dead) {
          stepBeat(g);
          after();
          done++;
        }
        why = `เดิน ${done} จังหวะ`;
      } else {
        const r = runToCall(g, undefined, after);
        call = r.call;
        why = `เดิน ${r.beats} จังหวะ จนถึง${r.stoppedBy === 'call' ? 'จุดที่เกมเรียก' : r.stoppedBy === 'death' ? 'จุดจบของชีวิต' : 'ขีดจำกัด'}`;
      }
      say(`-- ${why} --`, ...seen(mark));
      if (call) {
        say(...callLines(data, call, !!args.dev));
        const doable = god.doableNow();
        say(doable.length ? `ทำได้ตอนนี้: ${doable.join(' ')} (options เพื่อดูละเอียด)` : 'ยังไม่มีพลังใดให้ใช้ตอนนี้ (พิมพ์ advance เพื่อไปต่อ)');
      }
      if (st.life?.dead) say('-- ชีวิตจบ --', ...statusLines(g.ctx.data, st));
      return true;
    }
    case 'status':
      say('-- สถานะ --', ...statusLines(g.ctx.data, st));
      return true;
    case 'log': {
      const n = rest[0] ? Math.max(1, Math.floor(Number(rest[0]))) : 20;
      const ls = timeline(g.ctx.data, st.log, 1, { notes: toolNotes(st) });
      say(`-- บันทึก ${Math.min(n, ls.length)} บรรทัดล่าสุด --`, ...ls.slice(-n));
      return true;
    }
    case 'world':
      say('-- โลก (ดีบัก) --', ...worldLines(st));
      return true;
    case 'npcs': {
      const life = st.life;
      if (!life) return true;
      say(`-- NPC ที่ ${placeName(g.ctx, life.country) ?? life.country} --`);
      for (const v of npcsAt(g.ctx, life.country)) say(`  ${v.id} ${v.name}${v.role ? ` (${v.role})` : ''} · อายุ ${v.age} · เรื่อง ${v.story === 'open' ? 'เปิดอยู่' : v.story === 'wait' ? 'รอ' : 'จบแล้ว'}${v.slot.story.mc ? ' · พบแล้ว' : ''}`);
      return true;
    }
    case 'help':
      say('คำสั่ง: advance [N] (N จังหวะ; ไม่ใส่ = จนเกมเรียก) · status · log [N] · npcs · world (ตัวเลขของโลก สำหรับดีบัก) · help · quit', ...godHelp(), 'ตัวเลือก: --yes ทำคำสั่งพระเจ้าทันทีหลังตัวอย่างผล · --dev แสดงช่องที่เครื่องมือยังไม่มีคำพูด · --policy=<นโยบาย> ให้ระบบพระเจ้าเล่นแทนทุกจังหวะ');
      return true;
    case 'quit':
      say(`จบการเล่น สถานะเก็บไว้ที่ ${file}`);
      return false;
    default:
      say(`คำสั่งไม่รู้จัก: "${cmdText}" (ใช้ help)`);
      return true;
  }
}

if (fresh) {
  say('-- เกิด --', ...timeline(g.ctx.data, g.state.log, 1).filter((l) => l.includes('[เกิด]')), '', '-- สถานะ --', ...statusLines(g.ctx.data, g.state));
}
const cmds = (args.cmd ?? 'advance').split(';').map((x) => x.trim()).filter(Boolean);
for (const c of cmds) if (!run(c)) break;

mkdirSync(dir, { recursive: true });
writeFileSync(file, save(g.state));
if (god.pending) writeFileSync(pendingFile, JSON.stringify(god.pending));
else rmSync(pendingFile, { force: true });
process.stdout.write(out.join('\n') + '\n');
