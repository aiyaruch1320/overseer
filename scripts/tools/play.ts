// npm run play -- --seed=N [--persona=ชื่อ] [--policy=<นโยบาย>|ไม่มี] [--race=hu] [--cmd="advance 4; status"] [--new] [--yes] [--dev]
// Plays one life a command at a time and keeps the state in a file, so many commands can follow each other
// (docs/guide/code-plan.md §8.0). Each run does the commands given by --cmd (default: advance to the next call of the game),
// prints what the player sees, and saves the state.
// State file: <dir>/<seed>.json where dir is $OVERSEER_PLAY_DIR or <os temp dir>/overseer-play (outside the repo on purpose).
// Commands: advance [N] · status · log [N] · npcs · world (developer numbers) · help · quit, and the commands of the god
// (god-commands.ts): chest · pick N · reroll · skip · dream N · whisper <hint> · answer <card> <mode> · miracle MR-xx [target] ·
// decree <event> <mult> · conjure <words> · vow N · power · options · yes · no. A command of the god shows its preview first and
// waits for `yes` (it may be in the next --cmd; the waiting command is kept in <seed>.pending.json). `--yes` does it at once.
// `say <words>` turns free words into a whisper through the LLM layer (src/core/llm): tier 0 names the hint, `--llm=fake|deepseek|anthropic` lets the translator try the rest; with no
// match the answer says so and the menu (`options`) is the way. With `--llm`, the card of a dead character holds the LLM summary of the ending (the answer is kept in the save).
// `advance` without a number stops at the next call of the game: the `attention` system's call if it exists, else a level 3 entry.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { versions } from '../../src/core/game';
import type { LogEntry } from '../../src/core/types';
import { npcsAt } from '../../src/core/npc';
import { load, save } from '../../src/core/save';
import { extOf as bondsOf, hAgeOf, isLive, tiesOf } from '../../src/core/bonds';
import { cardOf, collectionView } from '../../src/core/ending';
import { nextLife, pickHeir, pickHeirTie, worldSummary } from '../../src/core/lineage';
import { cardLines, collectionLines, howWord, originWord, worldSummaryLines } from '../../src/core/text/ending';
import { placeName } from '../../src/core/text';
import { godLines, timeline, statusLines, worldLines } from './report';
import { GodConsole, callLines, godHelp, isGodWord, waitingLines, type PendingGod } from './god-commands';
import { intArg, parseArgs } from './args';
import { llmFromArgs, sayLines, summarizeDeath, usageLines } from './llm';
import { loadAll } from './node-data';
import { POLICIES, afterBeat, createSession, policyOf, resumeSession, runToCall, startLife, stepBeat, toolNotes, type Policy, type Session } from './session';

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args.seed, 'seed', 1);
const dir = process.env.OVERSEER_PLAY_DIR ?? path.join(os.tmpdir(), 'overseer-play');
const file = path.join(dir, `${seed}.json`);
const pendingFile = path.join(dir, `${seed}.pending.json`);
// `--policy=ไม่มี` (or `none` `off`) takes the policy out of the save: a policy given once stays in the save and plays for the player in every later run (review M2 L7)
const NO_POLICY = ['ไม่มี', 'none', 'off'];
const clearPolicy = args.policy !== undefined && NO_POLICY.includes(args.policy);
const policy = clearPolicy ? undefined : (args.policy as Policy | undefined);
if (policy && !POLICIES.includes(policy)) {
  console.error(`--policy ต้องเป็นหนึ่งใน ${POLICIES.join(' ')} (หรือ ไม่มี เพื่อปิดนโยบายที่ติดอยู่ในเซฟ)`);
  process.exit(2);
}

const data = loadAll();
const tl = llmFromArgs(args);
const opts = { seed, race: args.race, country: args.country, persona: args.persona, policy, startYear: args.year === undefined ? undefined : intArg(args.year, 'year') };

function open(): { s: Session; fresh: boolean } {
  if (args.new) rmSync(pendingFile, { force: true });
  if (args.new && existsSync(file)) rmSync(file);
  if (existsSync(file)) {
    const { state, stale } = load(readFileSync(file, 'utf8'), versions(data));
    if (policy) state.god.ext.policy = policy;
    if (clearPolicy) delete state.god.ext.policy;
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
// a policy kept in the save plays for the player: say so, and how to stop it (review M2 L7)
{
  const kept = policyOf(s);
  if (kept && (!fresh || !args.policy)) say(`(นโยบาย "${kept}" ทำงานอยู่ ระบบพระเจ้าจะเล่นแทนท่านทุกจังหวะ · ใส่ --policy=ไม่มี เพื่อปิด)`);
  else if (kept) say(`(นโยบาย "${kept}" ทำงานอยู่ ระบบพระเจ้าจะเล่นแทนท่าน และติดอยู่ในเซฟ · ใส่ --policy=ไม่มี เพื่อปิด)`);
  if (clearPolicy && !kept) say('(ปิดนโยบายแล้ว ท่านเล่นเอง)');
}

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

async function run(cmdText: string): Promise<boolean> {
  const [cmd, ...rest] = cmdText.split(/\s+/).filter(Boolean);
  const st = g.state;
  if (isGodWord(cmd)) {
    say(...god.handle(cmdText)!);
    return true;
  }
  switch (cmd) {
    case 'advance': {
      if (!st.life || st.life.dead) {
        say('ชีวิตนี้จบแล้ว (ใช้ next เพื่อไปรุ่นต่อไปในโลกเดิม หรือ --new เพื่อเริ่มโลกใหม่ด้วยเมล็ดเดิม)');
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
        say(...callLines(data, call, !!args.dev, g));
        const waiting = waitingLines(g, data);
        if (waiting.length) say('-- รอท่านอยู่ --', ...waiting);
        const doable = god.doableNow();
        say(st.life?.dead ? 'ชีวิตนี้จบแล้ว (ใช้ next เพื่อไปรุ่นต่อไปในโลกเดิม หรือ --new เพื่อเริ่มโลกใหม่ด้วยเมล็ดเดิม)' : doable.length ? `ทำได้ตอนนี้: ${doable.join(' ')} (options เพื่อดูละเอียด)` : 'ยังไม่มีพลังใดให้ใช้ตอนนี้ (พิมพ์ advance เพื่อไปต่อ)');
      }
      if (st.life?.dead) {
        say('-- ชีวิตจบ --', ...statusLines(g.ctx.data, st));
        const hand = godLines(data, st, policyOf(s));
        if (hand.length) say('-- พระหัตถ์ของท่านในชีวิตนี้ --', ...hand);
        await summarizeDeath(tl, data, st);
        const card = cardOf(st);
        if (card) say('-- การ์ดตอนจบ --', ...cardLines(card), 'พิมพ์ next เพื่อไปรุ่นต่อไปในโลกเดิม (heirs ดูผู้สืบ · summary สรุปโลก · collection ของสะสม)');
      }
      return true;
    }
    case 'next': {
      if (!st.life) return say('ยังไม่มีชีวิต'), true;
      if (!st.life.dead) return say('ชีวิตนี้ยังไม่จบ (advance เพื่อเดินต่อ)'), true;
      say(...god.drop());
      const mark = st.logN;
      const r = nextLife(g, { newcomer: rest[0] === 'newcomer' || rest[0] === 'คนใหม่' });
      if (!r.ok) {
        say(r.reason === 'extinct' ? 'ตระกูลสิ้นสาย: ไม่มีทายาทหรือผู้สืบเรื่อง (เอกสารให้เริ่มโลกใหม่ด้วย --new; พิมพ์ next newcomer เพื่อให้คนใหม่เกิดในโลกเดิมต่อ)' : r.reason === 'world-ended' ? 'โลกจบแล้ว' : `ไปต่อไม่ได้: ${r.reason}`);
        return true;
      }
      say(`-- รุ่นต่อไป · ${originWord(r.origin)} --`, ...seen(mark), '-- สถานะ --', ...statusLines(g.ctx.data, st));
      const first = st.log.find((e) => e.n >= mark && e.sys === 'attention' && e.kind === 'call' && e.data.call === 'stop');
      if (first) say(...callLines(data, first, !!args.dev, g));
      return true;
    }
    case 'heirs': {
      if (!st.life) return say('ยังไม่มีชีวิต'), true;
      const heir = pickHeir(g.ctx);
      const kids = tiesOf(bondsOf(st.life)).filter((t) => isLive(t) && (t.kin === 'child' || t.kin === 'adopted'));
      say('-- ผู้สืบ --', heir ? `ผู้สืบตอนนี้: ${heir.name} (${howWord(heir.how)} อายุ ${heir.age}) รหัส ${heir.tie ?? '-'}` : 'ตอนนี้ไม่มีผู้สืบ (next newcomer ให้คนใหม่เกิดในโลกเดิม)');
      for (const k of kids) say(`  ${k.id} ${k.name} (${k.kin === 'adopted' ? 'ลูกบุญธรรม' : 'ลูก'} อายุ ${Math.floor(hAgeOf(g.ctx, k))})`);
      say('เลือกผู้สืบด้วย heir <รหัส> ก่อน next (ไม่เลือก = คนโต)');
      return true;
    }
    case 'heir': {
      if (!st.life) return say('ยังไม่มีชีวิต'), true;
      say(pickHeirTie(g.ctx, rest[0]) ? (rest[0] ? `เลือก ${rest[0]} เป็นผู้สืบแล้ว` : 'ยกเลิกการเลือก ใช้คนโต') : `${rest[0]} ไม่ใช่ลูกที่ยังมีชีวิต (heirs ดูรายการ)`);
      return true;
    }
    case 'card': {
      const card = cardOf(st);
      say(...(card ? ['-- การ์ดตอนจบของชีวิตล่าสุด --', ...cardLines(card)] : ['ยังไม่มีชีวิตที่จบ']));
      return true;
    }
    case 'summary':
      say(...worldSummaryLines(worldSummary(st, data)));
      return true;
    case 'collection':
      say(...collectionLines(collectionView(st, data)));
      return true;
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
      say(
        'คำสั่ง: advance [N] (N จังหวะ; ไม่ใส่ = จนเกมเรียก) · status · log [N] · npcs · world (ตัวเลขของโลก สำหรับดีบัก) · help · quit',
        'หลังชีวิตจบ: next [newcomer] (รุ่นต่อไปในโลกเดิม; newcomer = ถ้าตระกูลสิ้นให้คนใหม่เกิดต่อ) · heirs / heir <รหัส> (ดู/เลือกผู้สืบ) · card (การ์ดตอนจบ) · summary (สรุปโลก) · collection (ของสะสม)',
        ...godHelp(),
        'ตัวเลือก: --yes ทำคำสั่งพระเจ้าทันทีหลังตัวอย่างผล · --dev แสดงช่องที่เครื่องมือยังไม่มีคำพูด · --policy=<นโยบาย> ให้ระบบพระเจ้าเล่นแทนทุกจังหวะ (ติดอยู่ในเซฟ ใช้ --policy=ไม่มี เพื่อปิด)',
        'คำที่เกมใช้: จังหวะ = หนึ่งในสี่ของปีชีวิต (หนึ่งฤดู) · ปีชีวิต = อายุของตัวละคร · ศ.ม. = ศักราชมังกร นับจากวันที่พระเจ้าตื่น (ปีของโลก) · แสงศรัทธา = พลังสายสร้าง · ความหวาดกลัว = พลังสายทำลาย · ศรัทธาเทพ = ความเชื่อของตัวละครที่มีต่อท่าน · ภาระใจ = ความตึงของใจเมื่อถูกฝันให้ทำขัดนิสัย · หน้าต่างพระเจ้า = ช่วงที่ราคาลด ×0.7',
      );
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
  // the game may already be waiting for the god at birth (a crossroads at age 0): the first call is shown, not found later in the log (review M2 P8)
  const first = g.state.log.find((e) => e.sys === 'attention' && e.kind === 'call' && e.data.call === 'stop');
  if (first) {
    say('', '-- เกมหยุดรอท่านตั้งแต่เกิด --', ...timeline(g.ctx.data, g.state.log.filter((e) => e.sys === 'attention' || e.sys === 'story'), 1).slice(-4));
    say(...callLines(data, first, !!args.dev, g));
    const waiting = waitingLines(g, data);
    if (waiting.length) say('-- รอท่านอยู่ --', ...waiting);
    const doable = god.doableNow();
    if (doable.length) say(`ทำได้ตอนนี้: ${doable.join(' ')} (options เพื่อดูละเอียด)`);
  }
}
const cmds = (args.cmd ?? 'advance').split(';').map((x) => x.trim()).filter(Boolean);
for (const c of cmds) {
  if (/^say(\s|$)/.test(c)) {
    const r = await sayLines(tl, g.ctx, c.slice(3).trim());
    say(...r.lines);
    if (r.cmd && !(await run(r.cmd))) break;
    continue;
  }
  if (!(await run(c))) break;
}
{
  const used = usageLines(tl);
  if (used.length) say('', ...used);
}
tl?.flush();

mkdirSync(dir, { recursive: true });
writeFileSync(file, save(g.state));
if (god.pending) writeFileSync(pendingFile, JSON.stringify(god.pending));
else rmSync(pendingFile, { force: true });
process.stdout.write(out.join('\n') + '\n');
