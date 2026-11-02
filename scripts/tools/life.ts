// npm run life -- --seed=N [--lives=3 [--strict]] [--policy=เงียบ|เมตตา|ลงโทษ|ปั้นนิสัย|ให้ของ|เก็บพลัง|สุ่ม|เร่งจบ] [--race=hu] [--country=AL-01] [--year=450] [--level=1]
// Runs a world to the start year, bears a main character and walks the whole life, then prints the readable log
// (docs/guide/code-plan.md §8.0). With a policy, the god system's `policyStep` plays every life year;
// the report ends with the power used and the chronicle of the hand.
// --llm=fake|anthropic adds the summary of the ending from the LLM layer (src/core/llm; default: no LLM, the output is as before).
import { intArg, parseArgs } from './args';
import { runLifeReport } from './life-run';
import { runLineageReport } from './lineage-run';
import { llmFromArgs, summaryReport } from './llm';
import { loadAll } from './node-data';
import { POLICIES, type Policy } from './session';

const args = parseArgs(process.argv.slice(2));
const policy = args.policy as Policy | undefined;
if (policy && !POLICIES.includes(policy)) {
  console.error(`--policy must be one of ${POLICIES.join(' ')}`);
  process.exit(2);
}
const lives = Math.max(1, Math.floor(intArg(args.lives, 'lives', 1)));
const level = intArg(args.level, 'level', lives > 1 ? 2 : 1);
const data = loadAll();
const tl = llmFromArgs(args);
const base = {
  seed: intArg(args.seed, 'seed', 1),
  policy,
  race: args.race,
  country: args.country,
  startYear: args.year === undefined ? undefined : intArg(args.year, 'year'),
  minLevel: Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3,
};
// several lives in a row in one world (the lineage); --strict follows the docs when the family ends (no newcomer in the old world)
const run = lives > 1 ? runLineageReport(data, { ...base, lives, strict: args.strict === 'true' }) : runLifeReport(data, base);
process.stdout.write(run.text);
if (tl) {
  process.stdout.write((await summaryReport(tl, data, run.state, 'beats' in run ? run.beats : 0)).join('\n') + '\n');
  tl.flush();
}
