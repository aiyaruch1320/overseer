// npm run life -- --seed=N [--policy=เงียบ|เมตตา|ลงโทษ|ปั้นนิสัย|ให้ของ|เก็บพลัง|สุ่ม|เร่งจบ] [--race=hu] [--country=AL-01] [--year=450] [--level=1]
// Runs a world to the start year, bears a main character and walks the whole life, then prints the readable log
// (docs/guide/code-plan.md §8.0). With a policy, the policy functions of the god system (god-hooks.ts) act after every beat;
// the report ends with the power used and the chronicle of the hand. Without the god system the policy changes nothing and says so.
import { intArg, parseArgs } from './args';
import { loadGodHooks } from './god-hooks-node';
import { runLifeReport } from './life-run';
import { loadAll } from './node-data';
import { POLICIES, type Policy } from './session';

const args = parseArgs(process.argv.slice(2));
const policy = args.policy as Policy | undefined;
if (policy && !POLICIES.includes(policy)) {
  console.error(`--policy must be one of ${POLICIES.join(' ')}`);
  process.exit(2);
}
await loadGodHooks();
const level = intArg(args.level, 'level', 1);
const run = runLifeReport(loadAll(), {
  seed: intArg(args.seed, 'seed', 1),
  policy,
  race: args.race,
  country: args.country,
  startYear: args.year === undefined ? undefined : intArg(args.year, 'year'),
  minLevel: Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3,
});
process.stdout.write(run.text);
