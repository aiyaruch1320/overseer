// Scans seeds for the key points `directorAhead` finds and checks them against the forks that were played; with `--llm=fake` it also asks the director after every beat (the fake provider, offline)
// and measures how many points were asked, how many answers came before their fork and how many were used. Each life gets its own client (the life ids repeat from seed to seed and the client
// keeps a token budget per life id).
// `npx tsx scripts/tools/ahead-scan.ts --from=1 --to=60 [--llm=fake] [--list]`
import { directorAhead } from '../../src/core/story';
import { parseArgs } from './args';
import { askDirector, llmFromArgs } from './llm';
import { loadAll } from './node-data';
import { afterBeat, createSession, startLife, stepBeat } from './session';

const args = parseArgs(process.argv.slice(2));
const from = Number(args.from ?? 1);
const to = Number(args.to ?? 40);
const data = loadAll();

async function main(): Promise<void> {
  let lives = 0;
  const byKind: Record<string, number> = {};
  let found = 0;
  let hit = 0;
  let asked = 0;
  let reached = 0;
  let early = 0;
  let late = 0;
  let taken = 0;
  let capped = 0;
  for (let seed = from; seed <= to; seed++) {
    const tl = llmFromArgs(args);
    const s = createSession(data, { seed });
    const g = s.game;
    startLife(s);
    const seen = new Map<string, string>();
    const forks = new Map<string, string>();
    let n = 0;
    while (g.state.life && !g.state.life.dead && n++ < 1600) {
      const mark = g.state.logN;
      for (const p of directorAhead(g.ctx)) if (!seen.has(p.id)) seen.set(p.id, p.kind);
      stepBeat(g);
      afterBeat(s);
      await askDirector(tl, g.ctx);
      for (const e of g.state.log) if (e.n >= mark && e.sys === 'story' && e.kind === 'node') forks.set(`${e.id}:${e.worldYear}`, String(e.data.choice));
    }
    lives++;
    for (const [id, k] of seen) {
      if (args.list) console.log('found', seed, id, k, forks.has(id) ? 'played' : 'miss');
      found++;
      byKind[k] = (byKind[k] ?? 0) + 1;
      if (forks.has(id)) hit++;
    }
    if (tl) {
      const asks = Object.keys(g.state.llmAnswers).filter((k) => k.startsWith('director.asked:')).length;
      asked += asks;
      if (asks >= 10) capped++;
      for (const e of g.state.log) {
        if (e.sys !== 'llm' || e.kind !== 'director') continue;
        reached++;
        if (e.data.reason === 'late') late++;
        else if (e.data.pick !== 'none') {
          early++;
          if (forks.get(String(e.id)) === e.data.pick) taken++;
        }
      }
    }
  }
  console.log({ lives, found, perLife: found / lives, byKind, idMatchesPlayedFork: hit, share: found ? hit / found : 0 });
  if (args.llm) {
    console.log({ asked, askedPerLife: asked / lives, capped, forkReached: reached, answerBeforeFork: early, late, shareBeforeFork: reached ? early / reached : 0, usedOfAsked: asked ? early / asked : 0, pickTaken: taken, shareTaken: early ? taken / early : 0 });
  }
}

void main();
