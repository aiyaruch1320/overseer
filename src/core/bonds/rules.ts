// The condition, effect and stat kinds the bond system owns (src/core/README.md "กติกาของระบบ"), and its hooks on the story nodes of bn and kn.
//   condition: bond
//   effects:   mood template bond
//   stats:     B · บุญคุณ · พวกพ้อง · family.childrenAlive · bonds.close · bonds.count
// Registered when this module is imported; tests that call resetRules() register again with registerBondsRules().
import type { Ctx } from '../game';
import { write } from '../log';
import { onCond, onStat, apply, type EffectSource } from '../rules';
import { onNode } from '../story';
import type { LifeState, StoryNode } from '../types';
import { bondsIndex, floorB, lineName } from './data';
import { startArc, withFocus } from './arcs';
import { addChild, closeKin } from './family';
import { grantPair } from './items';
import { showMood } from './moods';
import { addGratitude, addTie, changeB, endTie, hAgeOf, setLine } from './people';
import { hasRoom, meet } from './sources';
import { extOf, isLive, levelOf, reindex, tiesOf, closeTies, type BondsExt, type Tie } from './state';
import { JOURNEY_LINES, WORK_LINES } from './tuning';
import { caps } from './year';
import { stubHooks } from '../story/stubs';

const life = (ctx: Ctx): LifeState | null => {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
};

const SRC: EffectSource = { sys: 'bonds', stream: 'bonds.fx' };

/** Kin role a family template is about (05 §2); the relative is made when the life has none. */
const KIN_OF: Record<string, string[]> = {
  'KN-01': ['uncle'], 'KN-02': ['aunt', 'uncle'], 'KN-03': ['aunt', 'uncle', 'grand'], 'KN-04': ['uncle', 'aunt'], 'KN-05': ['elder_sibling'], 'KN-06': ['younger_sibling'], 'KN-07': ['grand'], 'KN-08': ['uncle', 'aunt', 'cousin'],
};

const focusOf = (e: BondsExt): Tie | undefined => (e.focus ? e.ties[e.focus] : undefined);

/** The tie among a list the node is about: alive, free of an owner, the one with the highest bond. */
function bestTie(e: BondsExt, pred: (t: Tie) => boolean): Tie | undefined {
  return tiesOf(e).filter((t) => isLive(t) && pred(t)).sort((a, b) => b.b - a.b || b.opened - a.opened)[0];
}

function kinRole(ctx: Ctx, l: LifeState, e: BondsExt, roles: string[], make = true): Tie | undefined {
  const pool = tiesOf(e).filter((t) => isLive(t) && t.kin && roles.includes(t.kin) && !t.arc);
  const have = pool.sort((a, b) => b.b - a.b)[0];
  if (have) return have;
  const again = tiesOf(e).filter((t) => isLive(t) && t.kin && roles.includes(t.kin)).sort((a, b) => b.b - a.b)[0];
  if (again || !make) return again;
  const role = roles[0];
  const sib = role.endsWith('sibling') || role === 'cousin';
  const kin = bondsIndex(ctx).data.family.kin;
  const row = kin.find((k) => k.term === (sib ? 'พี่น้อง' : 'ญาติผู้ใหญ่'));
  return addTie(ctx, l, {
    line: sib ? 'พี่น้อง' : 'ญาติผู้ใหญ่', level: row?.startLevel ?? 2, from: 'kin', kin: role, light: false,
    gap: sib ? (role === 'elder_sibling' ? 3 : role === 'cousin' ? 0 : -3) : role === 'grand' ? 52 : 28, race: 'same', quiet: true,
  });
}

// ---------- node hooks (the subject of a node's effects) ----------

interface Bind {
  lines?: string[];
  kin?: string[];
  /** Make a friend of this line when the life has none. */
  ensure?: { line: string; level: number; from: string };
}

const BIND: Record<string, Bind> = {
  'bn.t1': { lines: ['สหาย', 'คู่หู'], ensure: { line: 'สหาย', level: 2, from: 'peer' } },
  'bn.a1': { lines: ['สหาย', 'คู่หู', 'พี่น้อง'], ensure: { line: 'สหาย', level: 2, from: 'peer' } },
  'bn.a2': { lines: ['สหาย', 'คู่หู'], ensure: { line: 'สหาย', level: 2, from: 'work' } },
  'bn.a3': { lines: ['คนรัก'] },
  'bn.a4': { lines: ['สหาย', 'คู่หู'], ensure: { line: 'สหาย', level: 2, from: 'peer' } },
  'bn.e1': { lines: ['สหาย', 'คู่หู'], ensure: { line: 'สหาย', level: 3, from: 'peer' } },
  'kn.t1': { kin: ['uncle', 'aunt'] },
  'kn.a1': { kin: ['elder_sibling', 'younger_sibling', 'cousin'] },
  'kn.a2': { kin: ['child', 'adopted'] },
  'kn.e1': { kin: ['uncle', 'aunt', 'grand'] },
};

function bind(ctx: Ctx, l: LifeState, e: BondsExt, id: string): void {
  const b = BIND[id];
  if (!b) return;
  let t: Tie | undefined;
  if (b.lines) {
    t = bestTie(e, (x) => b.lines!.includes(x.line) && !x.light && !x.bound);
    if (!t && b.ensure) {
      t = hasRoom(ctx, e, b.ensure.level) ? meet(ctx, l, b.ensure.from, [b.ensure.line], { level: b.ensure.level, race: 'any' }) : undefined;
    }
  } else if (b.kin) {
    t = bestTie(e, (x) => !!x.kin && b.kin!.includes(x.kin));
    if (!t && id !== 'kn.a2') t = kinRole(ctx, l, e, b.kin);
  }
  e.focus = t ? t.id : null;
}

const hooks = {
  before(ctx: Ctx, n: StoryNode, id: string) {
    const l = life(ctx);
    if (!l) return;
    const e = extOf(l);
    e.focus = null;
    bind(ctx, l, e, id);
  },
  after(ctx: Ctx, n: StoryNode, id: string, key: 'a' | 'b' | 'c' | '-') {
    const l = life(ctx);
    if (!l) return;
    const e = extOf(l);
    const t = focusOf(e);
    after(ctx, l, e, n, id, key, t);
    e.focus = null;
    // a node can lift a tie to level 3 in the middle of a year: the caps of 01 §2 hold at every moment, not only at the year's end
    caps(ctx, l, e);
  },
};

function after(ctx: Ctx, l: LifeState, e: BondsExt, n: StoryNode, id: string, key: 'a' | 'b' | 'c' | '-', t: Tie | undefined): void {
  const rng = ctx.rng('bonds.node');
  switch (id) {
    case 'bn.e1':
      // the closest friend dies and the character is beside him (a)
      if (key === 'a' && t && t.line !== 'คนรัก') endTie(ctx, t, 'death', id, { cause: 'old' });
      break;
    case 'bn.a4':
      // the friend breaks his word or betrays: the line ends in a split or a betrayal (c)
      if (key === 'c' && t) endTie(ctx, t, rng.chance(0.6) ? 'split' : 'betray', id);
      break;
    case 'bn.a3':
      // the love fails (c): the lover is a friend again or goes
      if (key === 'c' && t) (rng.chance(0.5) ? setLine(ctx, t, 'สหาย', id) : endTie(ctx, t, 'split', id));
      break;
    case 'kn.t1':
      // after the parents died or were sold (b), the relatives raise the child; no one takes him (c) and he falls a class (05 §2 KN-02; kn.t1)
      if (key === 'b') for (const p of tiesOf(e)) if (isLive(p) && (p.kin === 'father' || p.kin === 'mother')) endTie(ctx, p, 'death', id, { cause: 'orphan' });
      if (key === 'c') apply(ctx, [{ k: 'stat', stat: 'class', delta: -1 }], SRC);
      break;
    case 'kn.e1':
      if (key !== 'c' && t && t.line !== 'พี่น้อง') endTie(ctx, t, 'death', id, { cause: 'old' });
      break;
    default:
  }
  // candidates met on the way (03 §1): a journey node that names an NPC is a candidate 25%, a node of work with others 30%
  const line = n.line;
  const names = n.notes.some((x) => x.k === 'npc') || n.choices.some((c) => c.effects.some((x) => x.k === 'npc'));
  if (JOURNEY_LINES.has(line) && (names || rng.chance(0.1)) && rng.chance(0.25)) meet(ctx, l, 'journey', ['สหาย', 'คู่หู', 'คู่แข่ง'], { level: 1, race: 'any' });
  else if (WORK_LINES.has(line) && rng.chance(0.3)) meet(ctx, l, 'work', ['คู่หู', 'สหาย'], { level: 2, race: 'any' });
}

// ---------- registration ----------

let removeHooks: (() => void) | undefined;

export function registerBondsRules(): void {
  // ---------- condition ----------
  /** `สายสหายระดับ 3`: a living tie on the line at that level or more. */
  onCond('bond', (ctx, c) => {
    const l = life(ctx);
    if (!l) return false;
    const e = extOf(l);
    const line = lineName(ctx, c.line);
    if (!line) return false;
    return tiesOf(e).some((t) => isLive(t) && t.line === line && levelOf(ctx, t) >= (c.level ?? 1));
  });

  // ---------- effects ----------
  /** `{สหาย:คิดถึง@2}`: the character shows the mood toward the tie the node is about, or toward the best tie of the line. */
  stubHooks.mood = (ctx, e, src) => {
    const l = life(ctx);
    if (!l) return;
    const b = extOf(l);
    const line = lineName(ctx, e.line);
    let t = focusOf(b);
    if (!t || !isLive(t)) {
      t = bestTie(b, (x) => x.line === line && !!x.arc && !x.light) ?? bestTie(b, (x) => x.line === line && !(x.kin === 'father' || x.kin === 'mother'));
      t ??= bestTie(b, (x) => x.line === line);
      if (t && src.id && /^(bn|kn)\./.test(src.id)) b.focus = t.id;
    }
    if (!t) {
      write(ctx.state, { sys: 'bonds', kind: 'mood-held', id: src.id, data: { line: e.line, mood: e.mood, reason: 'no one' }, level: 0 });
      b.counts.blocked++;
      return;
    }
    showMood(ctx, l, t, e.mood, src.id ?? src.sys);
  };

  /** `FT-03` `KN-02` `PR-01` (`FT-01 ถึง FT-05`): a story, or a pair of items, for the tie the node is about. */
  stubHooks.template = (ctx, e, src) => {
    const l = life(ctx);
    if (!l) return;
    const b = extOf(l);
    const rng = ctx.rng('bonds.fx');
    if (e.chance !== undefined && !rng.chance(e.chance)) return;
    const ix = bondsIndex(ctx);
    if (e.kind === 'PR') {
      const pair = ix.pairs.get(e.code);
      if (!pair) return;
      let t = focusOf(b);
      if (!t || !isLive(t) || !pair.lines.includes(t.line)) t = bestTie(b, (x) => pair.lines.includes(x.line) && !x.light && !x.bound);
      // a pair is given when the story is a happy one and the node has no chance of its own: a share of them (06 §2, assumption 30%)
      if (t && (e.chance !== undefined || rng.chance(0.3)) && (!t.tpl || t.tpl !== `${src.id}:PR`)) {
        if (grantPair(ctx, l, t, e.code)) t.tpl = `${src.id}:PR`;
      }
      return;
    }
    const code = e.to ? [...Array(Math.max(0, Number(e.to.slice(3)) - Number(e.code.slice(3)) + 1)).keys()].map((i) => `${e.kind}-${String(Number(e.code.slice(3)) + i).padStart(2, '0')}`) : [e.code];
    let t = focusOf(b);
    if (e.kind === 'KN') {
      const roles = KIN_OF[e.code] ?? ['uncle'];
      if (!t || !isLive(t) || !t.kin || t.kin === 'father' || t.kin === 'mother') t = kinRole(ctx, l, b, roles);
      if (!b.done.includes('closeKin')) b.done.push('closeKin');
    } else if (!t || !isLive(t)) {
      t = bestTie(b, (x) => !x.light && !x.bound && code.some((c) => ix.templates.get(c)?.lines.includes(x.line) || ix.templates.get(c)?.allLines));
    }
    if (!t || !isLive(t)) return;
    // the codes written one after the other are ways, not three stories: one of them per node (28-allies.md: `KN-01` `KN-04` `KN-07`)
    const mark = `${src.id}:${e.kind}`;
    if (t.tpl === mark) return;
    t.tpl = mark;
    b.focus = t.id;
    // a story already on its way goes on; a node starts one only for a tie with none or whose story is done
    if (t.arc && !t.arc.end && t.arc.stage < 5) return;
    t.light = false;
    const pool = code.filter((c) => ix.templates.has(c));
    if (!pool.length) return;
    const pick = e.to ? pool[rng.int(0, pool.length - 1)] : pool[0];
    t.arc = undefined;
    startArc(ctx, l, t, pick);
  };

  /** `สายสหายระดับ 2` `เปิดสายคู่หู` and the prayers `lover` `child`: a tie of the line opens, or the tie the node is about changes line or rises. */
  stubHooks.bond = (ctx, e, src) => {
    const l = life(ctx);
    if (!l) return;
    const b = extOf(l);
    const word = e.line.trim().toLowerCase();
    if (word === 'child') {
      addChild(ctx, l, { from: 'prayer' });
      return;
    }
    const line = lineName(ctx, e.line);
    if (!line) return;
    const lv = e.level;
    const have = tiesOf(b).filter((t) => isLive(t) && t.line === line && !t.light).sort((a, c) => c.b - a.b)[0];
    const f = focusOf(b);
    if (f && isLive(f) && f.line !== line && !f.kin && transition(f.line, line)) {
      setLine(ctx, f, line, src.id ?? src.sys);
      if (lv && levelOf(ctx, f) < lv) changeB(ctx, f, floorB(ctx, lv) - f.b, src.id ?? src.sys);
      return;
    }
    const ex = line === 'ญาติรุ่นเยาว์' ? tiesOf(b).filter((t) => isLive(t) && (t.kin === 'child' || t.kin === 'adopted')).sort((a, c) => c.b - a.b)[0] : have;
    if (ex) {
      b.focus = ex.id;
      if (lv && levelOf(ctx, ex) < lv) changeB(ctx, ex, floorB(ctx, lv) - ex.b, src.id ?? src.sys);
      return;
    }
    if (line === 'ญาติรุ่นเยาว์') return;
    if (!hasRoom(ctx, b, lv ?? 1)) return;
    const prayer = word === 'lover';
    const t = addTie(ctx, l, { line, level: lv ?? 1, from: prayer ? 'prayer' : src.id ?? 'node', race: prayer ? 'any' : 'same' });
    b.focus = t.id;
    startArc(ctx, l, t);
    caps(ctx, l, b);
  };

  // ---------- stats ----------
  /** `B ±n`: the bond with the tie the node is about. */
  onStat('B', {
    read: (ctx) => {
      const l = life(ctx);
      const t = l ? focusOf(extOf(l)) : undefined;
      return t ? t.b : 0;
    },
    add: (ctx, _n, d) => {
      const l = life(ctx);
      if (!l) return;
      const t = focusOf(extOf(l));
      if (t) changeB(ctx, t, d, 'story');
    },
  });
  /** `บุญคุณ ±n`: the gratitude the person owes the character; with no one in mind it is kept as a total. */
  onStat('บุญคุณ', {
    read: (ctx) => {
      const l = life(ctx);
      return l ? extOf(l).favor : 0;
    },
    add: (ctx, _n, d) => {
      const l = life(ctx);
      if (!l) return;
      const b = extOf(l);
      b.favor += d;
      const t = focusOf(b);
      if (t) addGratitude(ctx, t, d);
    },
  });
  /** `พวกพ้อง +2`: comrades who stand beside him (hu.b2 "ในฐานะเด็ก"); read as the ties at level 2 or more. */
  onStat('พวกพ้อง', {
    read: (ctx) => {
      const l = life(ctx);
      return l ? tiesOf(extOf(l)).filter((t) => isLive(t) && !t.light && levelOf(ctx, t) >= 2).length : 0;
    },
    add: (ctx, _n, d) => {
      const l = life(ctx);
      if (!l) return;
      const b = extOf(l);
      for (let i = 0; i < Math.round(d); i++) if (hasRoom(ctx, b, 1)) meet(ctx, l, 'comrade', ['สหาย'], { level: 1, race: 'any' });
    },
  });
  /** `ความรู้จักผู้ร่วมทาง +1`: the fellow travellers are known one more (npcs/README §4 axis "ความรู้จัก", 0 to 5). */
  onStat('ความรู้จักผู้ร่วมทาง', {
    read: (ctx) => {
      const l = life(ctx);
      return l ? Math.max(0, ...extOf(l).party.map((id) => extOf(l).ties[id]?.known ?? 0)) : 0;
    },
    add: (ctx, _n, d) => {
      const l = life(ctx);
      if (!l) return;
      const b = extOf(l);
      for (const id of b.party) {
        const t = b.ties[id];
        if (t) t.known = Math.max(0, Math.min(5, t.known + d));
      }
    },
  });
  onStat('family.childrenAlive', { read: (ctx) => (life(ctx) ? extOf(life(ctx)!).children.length : 0) });
  onStat('bonds.close', { read: (ctx) => (life(ctx) ? closeTies(ctx, extOf(life(ctx)!)).length : 0) });
  onStat('bonds.count', { read: (ctx) => (life(ctx) ? tiesOf(extOf(life(ctx)!)).filter(isLive).length : 0) });

  // ---------- the nodes ----------
  removeHooks?.();
  removeHooks = onNode(hooks);
}

/** The line transitions of 01 §4 an effect may ask for on the tie it is about. */
function transition(from: string, to: string): boolean {
  const ok: Record<string, string[]> = { สหาย: ['คู่หู', 'คนรัก'], คู่หู: ['คนรัก', 'สหาย'], คู่แข่ง: ['สหาย'], ศิษย์: ['สหาย'], คนรัก: ['สหาย'] };
  return (ok[from] ?? []).includes(to);
}

/** The state of the tie the node being played is about, for tests. */
export function focusTie(ctx: Ctx): Tie | undefined {
  const l = life(ctx);
  return l ? focusOf(extOf(l)) : undefined;
}

export { reindex, hAgeOf };
