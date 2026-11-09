// The M8 numbers (docs/guide/code-plan.md §11 row M8, RAW_PLAN §4.5): reads play records exported from the browser (settings panel, src/app/record.ts) and, when asked, runs simulated lives
// through the same reader (src/app/record-facts.ts), then prints the tables as Markdown.
//
//   npx tsx scripts/tools/m8-report.ts <record.json ...>                         records of real players
//   npx tsx scripts/tools/m8-report.ts --sim=เมตตา,ลงโทษ,สุ่ม --seeds=1-20 [--arms] [--lives=1]   simulated players (CLI god policies); --arms runs each seed with the director off and on (fake LLM)
//   options: --json (raw numbers as JSON)  --out=<file> (write instead of print)  --title=<text>
//
// Numbers (every table says its source): vows chosen / kept per vow, ally crises (made, reached a card, called, answered), director callbacks per life by arm (llm/04-story.md §3.5),
// stops and cards per life, time per life, the player's interventions per life. A record keeps no log, so everything here is counted from the events the recorder wrote.
import { readFileSync, writeFileSync } from 'node:fs';
import { RECORD_FORMAT, type PlayRecord } from '../../src/app/record';
import { INTERVENTIONS, Tally, type LifeMeta, type RecEvent } from '../../src/app/record-facts';
import { SEC_PER_YEAR } from '../../src/core/attention';
import { intArg, parseArgs } from './args';
import { runLineageReport, runLineageReportLlm } from './lineage-run';
import { runLifeReport, runLifeReportLlm } from './life-run';
import { llmFromArgs } from './llm';
import { loadAll } from './node-data';
import { POLICIES, type Policy } from './session';

/** The kinds of a callback the log of the story writes (`story/node.callbackKind`, llm/04-story.md §3.5). */
const CALLBACK_KINDS = ['npc', 'event', 'thread'] as const;

// ---------- lives out of records ----------

export interface Life {
  /** Where it came from: a file name, or `sim`. */
  src: string;
  /** Group of the table by player: the god policy of a simulated player, or `player`. */
  group: string;
  arm: 'on' | 'off' | null;
  /** The director switch changed during the life (the arm is not clean). */
  switched: boolean;
  llmServer: boolean;
  seed: number | null;
  start: RecEvent;
  end: RecEvent | undefined;
  events: RecEvent[];
}

/** Splits the events of one record into lives (the events carry the number of their life; session notes without one are left out). */
export function livesOf(events: RecEvent[], src: string, group = 'player'): Life[] {
  const byLife = new Map<number, RecEvent[]>();
  for (const e of events) if (e.life) (byLife.get(e.life) ?? byLife.set(e.life, []).get(e.life)!).push(e);
  const out: Life[] = [];
  for (const [, evs] of [...byLife].sort((a, b) => a[0] - b[0])) {
    const start = evs.find((e) => e.k === 'life.start');
    if (!start) continue;
    const arm = (start.arm as 'on' | 'off' | null | undefined) ?? null;
    const switched = evs.some((e) => e.k === 'settings' && e.source === 'player' && (e.llm as { director?: boolean } | undefined)?.director !== undefined);
    out.push({
      src,
      group: (start.policy as string | undefined) ?? group,
      arm,
      switched,
      llmServer: start.llmServer === true,
      seed: typeof start.seed === 'number' ? start.seed : null,
      start,
      end: evs.find((e) => e.k === 'life.end'),
      events: evs,
    });
  }
  return out;
}

export function readRecord(file: string): Life[] {
  const rec = JSON.parse(readFileSync(file, 'utf8')) as PlayRecord;
  if (rec.format !== RECORD_FORMAT || !Array.isArray(rec.events)) throw new Error(`${file}: not a play record`);
  return livesOf(rec.events, file.split('/').pop() ?? file);
}

// ---------- small statistics ----------

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);
export const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a: number, b: number): string => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');
const f1 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2).replace(/\.?0+$/, '') || '0' : '-');
const n = (e: RecEvent, key: string): number => (typeof e[key] === 'number' ? (e[key] as number) : 0);

// ---------- tables ----------

/** All 19 vows of 08-goals.md §2 and the "no vow" row. */
export const VOWS = Array.from({ length: 20 }, (_, i) => `GV-${String(i + 1).padStart(2, '0')}`);

export interface Report {
  lives: number;
  worlds: number;
  tables: { title: string; note?: string; head: string[]; rows: (string | number)[][] }[];
  raw: Record<string, unknown>;
}

function table(title: string, head: string[], rows: (string | number)[][], note?: string) {
  return { title, head, rows, ...(note ? { note } : {}) };
}

const finished = (l: Life): boolean => !!l.end && l.end.cause !== 'unfinished';

export function analyse(all: Life[], title = 'M8'): Report {
  const lives = all;
  const done = lives.filter(finished);
  const tables: Report['tables'] = [];
  const raw: Record<string, unknown> = {};

  // -- the lives
  const groups = [...new Set(lives.map((l) => l.group))].sort();
  tables.push(
    table(
      `${title}: lives read`,
      ['group', 'lives', 'ended', 'arm on', 'arm off', 'no arm', 'director switched by hand', 'LLM server'],
      [
        ...groups.map((g) => {
          const ls = lives.filter((l) => l.group === g);
          return [g, ls.length, ls.filter(finished).length, ls.filter((l) => l.arm === 'on').length, ls.filter((l) => l.arm === 'off').length, ls.filter((l) => !l.arm).length, ls.filter((l) => l.switched).length, ls.filter((l) => l.llmServer).length];
        }),
        ['all', lives.length, done.length, lives.filter((l) => l.arm === 'on').length, lives.filter((l) => l.arm === 'off').length, lives.filter((l) => !l.arm).length, lives.filter((l) => l.switched).length, lives.filter((l) => l.llmServer).length],
      ],
    ),
  );

  // -- vows: offered, chosen (the last take or change of the life), kept / broken
  const chosenOf = (l: Life): string | null => {
    const takes = l.events.filter((e) => e.k === 'vow.take' || e.k === 'vow.change');
    return takes.length ? (takes[takes.length - 1].vow as string) : null;
  };
  const vowRows: (string | number)[][] = [];
  const vowRaw: Record<string, unknown> = {};
  for (const v of VOWS) {
    const offered = lives.filter((l) => l.events.some((e) => (e.k === 'vow.offer' || e.k === 'vow.reoffer') && (e.ids as string[]).includes(v))).length;
    const chosen = lives.filter((l) => chosenOf(l) === v);
    const kept = chosen.filter((l) => l.events.some((e) => e.k === 'vow.result' && e.vow === v && e.result === 'kept')).length;
    const broken = chosen.filter((l) => l.events.some((e) => e.k === 'vow.result' && e.vow === v && e.result === 'broken')).length;
    vowRaw[v] = { offered, chosen: chosen.length, kept, broken };
    vowRows.push([v, offered, chosen.length, v === 'GV-20' ? '-' : kept, v === 'GV-20' ? '-' : broken, v === 'GV-20' ? '-' : pct(kept, chosen.length)]);
  }
  const noChoice = lives.filter((l) => chosenOf(l) === null).length;
  tables.push(table(`${title}: vows (all groups)`, ['vow', 'offered', 'chosen', 'kept', 'broken', 'kept of chosen'], vowRows, `lives with no vow choice recorded: ${noChoice} · target (08-goals.md §8): kept 40-90% when chosen on purpose, at most 25% when random`));
  raw.vows = vowRaw;
  // vows by group (kept of chosen, all vows together)
  tables.push(
    table(
      `${title}: vows by group`,
      ['group', 'lives', 'chose a vow', 'kept', 'broken', 'kept of chosen', 'top vows chosen'],
      groups.map((g) => {
        const ls = lives.filter((l) => l.group === g);
        const chose = ls.filter((l) => chosenOf(l) && chosenOf(l) !== 'GV-20');
        const res = (r: string) => chose.filter((l) => l.events.some((e) => e.k === 'vow.result' && e.result === r)).length;
        const count: Record<string, number> = {};
        for (const l of chose) count[chosenOf(l)!] = (count[chosenOf(l)!] ?? 0) + 1;
        const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, c]) => `${k}×${c}`).join(' ');
        return [g, ls.length, chose.length, res('kept'), res('broken'), pct(res('kept'), chose.length), top];
      }),
    ),
  );

  // -- ally crisis
  const crisisRows = groups.map((g) => {
    const ls = lives.filter((l) => l.group === g);
    const c = (k: string, f?: (e: RecEvent) => boolean) => sum(ls.map((l) => l.events.filter((e) => e.k === k && (!f || f(e))).length));
    const made = c('crisis');
    const cards = c('crisis', (e) => e.card === true);
    const called = sum(ls.map((l) => l.events.filter((e) => e.k === 'call' && String(e.cards).split(',').includes('crisis')).length));
    const answered = c('crisis.answer');
    const byPlayer = c('crisis.answer', (e) => !!e.by);
    const missed = c('missed', (e) => e.kind === 'crisis');
    return [g, ls.length, f1(made / (ls.length || 1)), cards, called, answered, byPlayer, missed, pct(cards, made)];
  });
  tables.push(
    table(
      `${title}: ally crisis (bonds/04 stage 3)`,
      ['group', 'lives', 'crises per life', 'reached a card', 'calls with a crisis card', 'cards answered (by the character)', '... moved by the player (whisper/dream)', 'cards that ran out', 'share that became a card'],
      crisisRows,
      'a crisis is every stage-3 event of a tie the life takes part in; the target of the card share is bonds/ CRISIS_CARD (07-attention.md §2: about 1.5 cards a life)',
    ),
  );

  // -- director callbacks by arm
  const armKeys: ('on' | 'off' | 'none')[] = ['off', 'on', 'none'];
  const armLives = (a: 'on' | 'off' | 'none') => lives.filter((l) => (l.arm ?? 'none') === a && finished(l));
  const dir = (ls: Life[]) => {
    const nodes = sum(ls.map((l) => n(l.end!, 'nodes')));
    const chances = sum(ls.map((l) => n(l.end!, 'chances')));
    const callbacks = sum(ls.map((l) => n(l.end!, 'callbacks')));
    const kinds = ls.some((l) => l.end && CALLBACK_KINDS.some((k) => l.end![`cb_${k}`] !== undefined)) ? CALLBACK_KINDS.map((k) => sum(ls.map((l) => n(l.end!, `cb_${k}`)))) : null;
    const bond = sum(ls.map((l) => n(l.end!, 'bondEndings')));
    const picks = ls.flatMap((l) => l.events.filter((e) => e.k === 'llm.director'));
    const used = picks.filter((e) => e.pick !== 'none');
    const reason = (r: string) => used.filter((e) => e.reason === r).length;
    return { lives: ls.length, nodes, chances, callbacks, kinds, bond, asked: picks.length, used: used.length, old_face: reason('old_face'), dream: reason('dream'), life_question: reason('life_question'), vow: reason('vow'), rest: reason('rest'), tension: reason('tension') };
  };
  const dirRaw: Record<string, ReturnType<typeof dir>> = {};
  const dirRows = armKeys
    .filter((a) => armLives(a).length)
    .map((a) => {
      const d = dir(armLives(a));
      dirRaw[a] = d;
      const L = d.lives || 1;
      return [a, d.lives, f1(d.nodes / L), f1(d.chances / L), f1(d.callbacks / L), d.kinds ? d.kinds.map((x) => f1(x / L)).join(' / ') : 'n/a (simulated lives only)', pct(d.callbacks, d.nodes), f1(d.bond / L), f1(d.asked / L), f1(d.used / L), `${f1(d.old_face / L)} / ${f1(d.dream / L)} / ${f1((d.life_question + d.vow) / L)} / ${f1((d.rest + d.tension) / L)}`];
    });
  raw.director = dirRaw;
  tables.push(
    table(
      `${title}: director callbacks per life by arm (llm/04-story.md §3.5)`,
      ['arm (llm_director)', 'lives', 'story nodes', 'forks with a callback way', 'callbacks (way chosen ties back)', 'by kind per life: npc met again / event of the life / thread settled', 'callbacks per node', 'bond stories settled (involved)', 'LLM points decided', 'LLM picks used', 'picks: old face / dream / question+vow / rest+tension'],
      dirRows,
      'callback = a node whose chosen way names someone or something the life already met (NPC again, event, turning point); "settled" counts the involved endings of ally stories, the nearest thing the log holds to open threads settled',
    ),
  );
  if (dirRaw.on && dirRaw.off) {
    const a = dirRaw.on.callbacks / (dirRaw.on.lives || 1);
    const b = dirRaw.off.callbacks / (dirRaw.off.lives || 1);
    tables.push(table(`${title}: A/B lift`, ['measure', 'off', 'on', 'lift', 'target'], [['callbacks per life', f1(b), f1(a), b ? `${(((a - b) / b) * 100).toFixed(0)}%` : '-', '+15% at least (04-story.md §3.5, real players)']], 'the player-preference half of the A/B ("which life felt more like one story", target 60%) is asked of the tester in person, not recorded'));
  }

  // -- stops and cards per life
  const callRows = groups.map((g) => {
    const ls = done.filter((l) => l.group === g);
    const stops = ls.map((l) => l.events.filter((e) => e.k === 'call' && e.call === 'stop').length);
    const cards = ls.map((l) => l.events.filter((e) => e.k === 'call' && e.call === 'card').length);
    const missed = ls.map((l) => l.events.filter((e) => e.k === 'missed').length);
    return [g, ls.length, f1(median(stops)), f1(mean(stops)), f1(median(cards)), f1(mean(cards)), f1(mean(missed))];
  });
  tables.push(table(`${title}: stops and cards per life`, ['group', 'lives', 'stops p50', 'stops mean', 'cards p50', 'cards mean', 'cards that ran out (mean)'], callRows, 'targets (07-attention.md §5, normal setting): stops p50 6-10, cards p50 12-22, cards that ran out at most 3'));
  const whyCount: Record<string, number> = {};
  for (const l of done) for (const e of l.events) if (e.k === 'call') whyCount[`${e.call}/${e.why}`] = (whyCount[`${e.call}/${e.why}`] ?? 0) + 1;
  tables.push(table(`${title}: calls by kind`, ['call/why', 'count', 'per life'], Object.entries(whyCount).sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, c, f1(c / (done.length || 1))])));

  // -- time per life
  const timeRows = groups.map((g) => {
    const ls = done.filter((l) => l.group === g);
    const wall = ls.filter((l) => l.src !== 'sim').map((l) => (l.end!.t - l.start.t) / 60);
    const scripted = ls.map((l) => (n(l.end!, 'hAge') * SEC_PER_YEAR) / 60);
    const ages = ls.map((l) => n(l.end!, 'hAge'));
    return [g, ls.length, wall.length ? f1(median(wall)) : '-', wall.length ? f1(mean(wall)) : '-', f1(median(scripted)), f1(median(ages))];
  });
  tables.push(table(`${title}: time per life`, ['group', 'lives', 'wall minutes p50', 'wall minutes mean', 'minutes at normal speed (age x SEC_PER_YEAR) p50', 'age at death p50'], timeRows, 'wall time includes pauses and the time between a life ending and the tester going on; target 25-45 minutes at normal speed (experience/01-one-life.md)'));

  // -- interventions
  const actRows = groups.map((g) => {
    const ls = done.filter((l) => l.group === g);
    const per = (a: string) => f1(sum(ls.map((l) => l.events.filter((e) => e.k === 'act' && e.ok === true && e.action === a).length)) / (ls.length || 1));
    const total = ls.map((l) => l.events.filter((e) => e.k === 'act' && e.ok === true && (INTERVENTIONS as readonly string[]).includes(e.action as string)).length);
    return [g, ls.length, f1(mean(total)), f1(median(total)), ...INTERVENTIONS.map(per)];
  });
  tables.push(table(`${title}: interventions per life`, ['group', 'lives', 'total mean', 'total p50', ...INTERVENTIONS], actRows, 'confirmed commands only (a preview is not counted); GV-12 asks for at most 5 in a life'));

  // -- how the player ran the game (records only)
  const player = lives.filter((l) => l.group === 'player');
  if (player.length) {
    const ev = (k: string, f?: (e: RecEvent) => boolean) => sum(player.map((l) => l.events.filter((e) => e.k === k && (!f || f(e))).length));
    const held = player.flatMap((l) => l.events.filter((e) => e.k === 'clock' && e.what === 'resume' && typeof e.heldMs === 'number').map((e) => (e.heldMs as number) / 1000));
    tables.push(
      table(
        `${title}: how the tester ran the game`,
        ['measure', 'value'],
        [
          ['lives', player.length],
          ['pauses by the player per life', f1(ev('clock', (e) => e.what === 'pause') / player.length)],
          ['speed changes by the player per life', f1(ev('settings', (e) => e.source === 'player' && !!e.speed) / player.length)],
          ['setting changes by the player per life (attention, LLM, cards)', f1(ev('settings', (e) => e.source === 'player' && !e.speed) / player.length)],
          ['stops held, seconds (p50 / max)', held.length ? `${f1(median(held))} / ${f1(Math.max(...held))}` : '-'],
          ['refused commands per life', f1(ev('act', (e) => e.ok === false) / player.length)],
        ],
      ),
    );
  }

  // -- endings
  const cause: Record<string, number> = {};
  for (const l of done) cause[String(l.end!.cause)] = (cause[String(l.end!.cause)] ?? 0) + 1;
  const titles: Record<string, number> = {};
  for (const l of done) for (const e of l.events) if (e.k === 'ending') titles[String(e.title ?? '(no title)')] = (titles[String(e.title ?? '(no title)')] ?? 0) + 1;
  tables.push(table(`${title}: endings`, ['cause of death', 'lives'], Object.entries(cause).sort((a, b) => b[1] - a[1])));
  tables.push(table(`${title}: ending titles (top 12)`, ['title', 'lives'], Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 12)));

  return { lives: lives.length, worlds: new Set(lives.map((l) => `${l.src}`)).size, tables, raw };
}

export function render(r: Report, head: string): string {
  const out = [`# ${head}`, '', `${r.lives} lives from ${r.worlds} source(s).`, ''];
  for (const t of r.tables) {
    out.push(`## ${t.title}`, '');
    if (t.note) out.push(`_${t.note}_`, '');
    out.push(`| ${t.head.join(' | ')} |`, `|${t.head.map(() => ' --- ').join('|')}|`);
    for (const row of t.rows) out.push(`| ${row.map((c) => String(c).replace(/\|/g, '/')).join(' | ')} |`);
    out.push('');
  }
  return out.join('\n');
}

// ---------- simulated players ----------

/** Seeds from `1-20`, `5,9,12` or `7`. */
export function seedsOf(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(',')) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
    else if (part.trim()) out.push(intArg(part.trim(), 'seeds'));
  }
  return out;
}

/** A simulated life (or a lineage of several) as lives of a record: the log read by `Tally`, the policy as the group, the arm as given. */
export async function simulate(data: ReturnType<typeof loadAll>, o: { seed: number; policy: Policy; arm: 'on' | 'off' | null; lives: number }): Promise<Life[]> {
  const base = { seed: o.seed, policy: o.policy, minLevel: 0 as const };
  // the arm on asks the fake LLM director (the fixture of the tools); the arm off asks nothing, which is what the director switch off does
  const tl = o.arm === 'on' ? llmFromArgs({ llm: 'fake' }) : undefined;
  const run =
    o.lives > 1
      ? tl
        ? await runLineageReportLlm(data, { ...base, lives: o.lives }, tl)
        : runLineageReport(data, { ...base, lives: o.lives })
      : tl
        ? await runLifeReportLlm(data, base, tl)
        : runLifeReport(data, base);
  const st = run.state;
  const meta = (): LifeMeta => ({ seed: o.seed, arm: o.arm, policy: o.policy, llmServer: o.arm === 'on', llm: { master: true, setup: true, director: o.arm !== 'off', epitaph: true } });
  const t = new Tally({ meta, actsFromLog: true });
  t.ingest(st.log);
  t.finish();
  const out = livesOf(t.events, 'sim', o.policy);
  // the kind of each callback (npc / event / thread) is in the log (`story/node.callbackKind`); the Tally of the app does not read it, so a one-life run adds the counts to the end event here
  if (o.lives === 1 && out.length === 1 && out[0].end) {
    for (const k of CALLBACK_KINDS) out[0].end[`cb_${k}`] = st.log.filter((e) => e.sys === 'story' && e.kind === 'node' && e.data.callbackKind === k).length;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const all: Life[] = [];
  for (const f of files) all.push(...readRecord(f));
  if (args.sim) {
    const policies = args.sim.split(',').filter(Boolean) as Policy[];
    for (const p of policies) if (!POLICIES.includes(p)) throw new Error(`--sim policy must be one of ${POLICIES.join(' ')}, got "${p}"`);
    const seeds = seedsOf(args.seeds ?? '1-10');
    const lives = Math.max(1, intArg(args.lives, 'lives', 1));
    const data = loadAll();
    const arms: ('on' | 'off' | null)[] = args.arms ? ['off', 'on'] : [null];
    for (const p of policies) {
      for (const seed of seeds) {
        for (const arm of arms) {
          const ls = await simulate(data, { seed, policy: p, arm, lives });
          all.push(...ls);
        }
      }
      process.stderr.write(`sim ${p}: ${seeds.length * arms.length} runs\n`);
    }
  }
  if (!all.length) {
    process.stderr.write('usage: m8-report.ts <record.json ...> | --sim=เมตตา,ลงโทษ --seeds=1-20 [--arms] [--lives=1]  [--json] [--out=file]\n');
    process.exit(2);
  }
  const report = analyse(all, args.title ?? 'M8');
  const text = args.json ? JSON.stringify({ lives: report.lives, tables: report.tables, raw: report.raw }, null, 2) : render(report, args.title ?? 'M8 report');
  if (args.out) writeFileSync(args.out, text + '\n');
  else process.stdout.write(text + '\n');
}

if (process.argv[1] && /m8-report\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
