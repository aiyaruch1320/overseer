// The condition kinds, effect kinds and stats the story system owns (src/core/README.md "กติกาของระบบ").
// Registered when this module is imported; tests that call resetRules() register again with registerStoryRules().
//   condition: node
//   effects:   converge jump battle · nodeWeight choiceMod entryMod variant battleFor outcome ending replaces ref jobpath check llm level qty place
//   stat:      convergence.passed
import { write } from '../log';
import { apply, onCond, onEffect, onStat, test } from '../rules';
import type { Ctx } from '../game';
import { battleStub } from './battle-stub';
import { indexOf } from './data';
import { addOnce, extOf, lifeOf } from './state';
import { jumpTo, normalize, queueCv } from './walk';
import { registerStubRules } from './stubs';
import type { NodeId } from '../types';

const trace = (ctx: Ctx, kind: string, id: string | undefined, data: Record<string, string | number | boolean | null> = {}, level: 0 | 1 = 0) =>
  write(ctx.state, { sys: 'story', kind, id, data, level });

export function registerStoryRules(): void {
  // ---------- condition ----------
  /** Passed that node, and took that choice when one is named (`ต้องผ่าน el.b2 ทาง ก`). */
  onCond('node', (ctx, c) => {
    const got = ctx.state.life?.passed[c.id];
    return got !== undefined && (c.choice === undefined || got === c.choice);
  });

  // ---------- stat ----------
  onStat('convergence.passed', {
    read: (ctx) => Object.keys(ctx.state.life?.passed ?? {}).filter((id) => /^cv\.[1-9]\d*$/.test(id)).length,
  });

  // ---------- the walk ----------
  onEffect('converge', (ctx, e) => queueCv(ctx, e.to));
  onEffect('jump', (ctx, e, src) => {
    const forced = (e as { choice?: 'a' | 'b' | 'c' }).choice;
    jumpTo(ctx, src.id, e.to, e.years, forced);
    trace(ctx, 'jump', e.to, { from: src.id ?? null, years: e.years ?? 0 });
  });
  onEffect('battle', (ctx, e, src) => void battleStub(ctx, e.enemies, src, e.text));
  onEffect('battleFor', (ctx, e, src) => {
    const cur = lifeOf(ctx) && extOf(lifeOf(ctx)!).cur;
    if (cur && cur.choice !== '-' && e.choices.includes(cur.choice)) battleStub(ctx, e.enemies, src, e.role);
  });

  // ---------- weights that act on a later or the same choice ----------
  onEffect('nodeWeight', (ctx, e, src) => {
    const life = lifeOf(ctx);
    if (!life || !e.node) return trace(ctx, 'nodeWeight', src.id, { skipped: 'no node' });
    extOf(life).nodeMods.push({ node: e.node, label: e.label, mul: e.mul });
  });
  onEffect('entryMod', (ctx, e, src) => {
    const life = lifeOf(ctx);
    if (!life) return;
    const row: NodeId | undefined = e.to || (src.id ? indexOf(ctx).nodes.get(src.id)?.converge?.[0] : undefined);
    if (row) extOf(life).entryMods.push({ to: row, choice: e.choice, mul: e.mul, cond: e.cond });
  });
  // read before the way is chosen (walk.ts pullOf, contentOf); nothing left to do when the effects are applied
  onEffect('choiceMod', () => undefined);
  onEffect('variant', () => undefined);
  /** A run of these is turned into a `pick` before applying; one left alone happens as written. */
  onEffect('outcome', (ctx, e, src) => apply(ctx, normalize(e.effects), src));

  // ---------- facts the story keeps for later systems ----------
  onEffect('ending', (ctx, e) => {
    const life = lifeOf(ctx);
    if (life && test(ctx, e.cond) && addOnce(extOf(life).endings, e.title)) trace(ctx, 'ending', e.title, {}, 1);
  });
  onEffect('replaces', (ctx, e) => {
    const life = lifeOf(ctx);
    if (!life || !test(ctx, e.when)) return;
    for (const id of e.nodes) if (life.passed[id] === undefined) addOnce(extOf(life).skipped, id);
  });
  onEffect('ref', (ctx, e, src) => trace(ctx, 'ref', src.id, { nodes: e.nodes.join(','), rel: e.rel }));
  onEffect('jobpath', (ctx, e, src) => {
    const life = lifeOf(ctx);
    if (!life || !test(ctx, e.need)) return;
    const ex = extOf(life);
    if (!ex.jobpaths.some((j) => j.job === e.job)) {
      ex.jobpaths.push({ job: e.job, secret: e.secret });
      trace(ctx, 'jobpath', e.job, { secret: e.secret, node: src.id ?? null }, 1);
    }
  });
  onEffect('check', (ctx, e, src) => {
    const life = lifeOf(ctx);
    if (!life) return;
    const sides = e.die ? Number(e.die.replace(/\D/g, '')) || 20 : 20;
    const roll = ctx.rng(src.stream ?? 'life.story.check').int(1, sides);
    const ok = roll >= e.dc;
    extOf(life).checks.push({ dc: e.dc, roll, ok });
    trace(ctx, 'check', src.id, { dc: e.dc, roll, ok });
  });
  onEffect('llm', (ctx, e, src) => trace(ctx, 'llm', e.role, { node: src.id ?? null }, 1));
  onEffect('level', (ctx, e) => {
    const life = lifeOf(ctx);
    if (life) extOf(life).levels[e.scale] = e.values;
    trace(ctx, 'level', e.scale, { values: e.values.join(',') });
  });
  onEffect('qty', (ctx, e, src) => trace(ctx, 'qty', src.id, { n: e.n, unit: e.unit }));
  onEffect('place', (ctx, e) => {
    const life = lifeOf(ctx);
    if (life) for (const id of e.ids) addOnce(extOf(life).places, id);
  });

  registerStubRules();
}

registerStoryRules();
