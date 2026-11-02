// The lineage system (code-plan §7 row "lineage"; docs/lore/heirs/, docs/systems/experience/05-world-across-lives.md):
// the lives of a family in one world. Hooks: birth writes the record of the life; the life year lets the heir settle the threads it inherited;
// the death keeps the life in the lineage (the line, the book, the threads, the chronicle) and picks the heir. `nextLife(game)` bears the next life.
// State: `state.lineage` (types.ts) plus the extension `state.lineage.x` (state.ts). The summary of the world is `worldSummary(state, data)`.
import { registerStat } from './stats';
import type { System } from '../game';
import { write } from '../log';
import { cardOf } from '../ending';
import { calendarYear } from '../text/pick';
import { updateBook } from './book';
import { emitLifeChange } from './carry';
import { chronicleLines, writeChronicle } from './chronicle';
import { pickHeir } from './heir';
import { lx } from './state';
import { keepThreads, settleYear } from './threads';

registerStat();

export { nextLife, canContinue, type NextOpts, type NextResult } from './next';
export { pickHeir, pickHeirTie, inherit, type Carried } from './heir';
export { currentThreads, detect as detectThreads, settleYear, KIND_WEIGHT, MAX_THREADS, DROP_LIMIT } from './threads';
export { onLifeChange, emitLifeChange, type LifeChange, type LifeChangeFn } from './carry';
export { worldSummary, type WorldSummary } from './summary';
export { lx, recOf, generationOf, type LineageX, type LifeRec, type Thread, type HeirSpec, type HeirHow, type Origin, type Book } from './state';

export const lineageSystem: System = {
  name: 'lineage',
  birth(ctx) {
    const st = ctx.state;
    const life = st.life;
    if (!life) return;
    const x = lx(st);
    if (x.recs.some((r) => r.id === life.id)) return;
    let startN = st.logN;
    for (let i = st.log.length - 1; i >= 0; i--) {
      const e = st.log[i];
      if (e.sys === 'character' && e.kind === 'birth') {
        startN = e.n;
        break;
      }
    }
    const begin = x.begin;
    delete x.begin;
    const generation = st.lineage.lives.length + 1;
    x.recs.push({ id: life.id, generation, origin: begin?.origin ?? 'first', ...(begin?.parent ? { parent: begin.parent } : {}), startAge: life.hAge, age: life.hAge, cause: '', startN, endN: startN, threads: [] });
    // the family is named after the first life; its name is given by the text system, which runs after this hook, so the name is taken at the first death
    if (!begin) emitLifeChange(ctx, { phase: 'begin', life, origin: 'first', generation, heir: null });
  },
  lifeYear(ctx) {
    settleYear(ctx);
  },
  death(ctx) {
    const st = ctx.state;
    const life = st.life;
    if (!life || !life.dead) return;
    const x = lx(st);
    if (st.lineage.lives.some((l) => l.id === life.id)) return;
    if (!x.dynasty) x.dynasty = st.lineage.lives[0]?.name ?? life.name;
    const rec = x.recs.find((r) => r.id === life.id);
    const card = cardOf(st, life.id);
    const ending = (life.ext.story as { ended?: string } | undefined)?.ended;
    const generation = st.lineage.lives.length + 1;
    // the threads, the book, the heir
    const threads = keepThreads(ctx);
    updateBook(ctx);
    const heir = pickHeir(ctx);
    x.heir = heir;
    if (rec) {
      rec.age = life.dead.hAge;
      rec.cause = life.dead.cause;
      rec.endN = st.logN;
      if (ending) rec.ending = ending;
      if (heir) rec.heir = heir.name;
      rec.threads = threads.map((t) => t.id);
    }
    st.lineage.lives.push({ id: life.id, name: life.name, race: life.race, born: life.birthYear, died: life.dead.year, ...(ending ? { title: ending } : {}) });
    st.lineage.open = x.threads.filter((t) => t.state === 'open').map((t) => t.text);
    if (card) writeChronicle(ctx, card, chronicleLines(ctx, card, heir, threads.length, threads[0]?.text ?? ''));
    write(st, {
      sys: 'lineage',
      kind: 'end',
      id: life.id,
      data: { name: life.name, generation, year: calendarYear(life.dead.year), heir: heir?.name ?? null, how: heir?.how ?? null, threads: threads.length },
      level: 2,
    });
    emitLifeChange(ctx, { phase: 'end', life, origin: rec?.origin ?? 'first', generation, heir });
  },
};
