// The effect words of a prayer (`grantFx` `punishFx` of data/gen/god.json, 03-dreams.md §7.1): `hp+45` `gold+10` `curse:c_lonely`
// `country:-famine` `rel:+lover` `npc:heal` ... Each word becomes a change of the state through the shared rules (rules/) or the
// world and NPC functions. A word nobody can read is returned with a `?` so a test and the log show it.
import { extOf as characterExt, idx } from '../../character';
import type { Ctx } from '../../game';
import { apply, type EffectSource } from '../../rules';
import type { Effect } from '../../types';
import { belief } from './pay';
import { godOf } from './geo';
import { favourNpc, healNpc, killNpc, nemeses } from './npcs';
import { livingOf } from './state';
import { HP_HEAL_AT, HP_WOUND_AT } from './tuning';

const SRC: EffectSource = { sys: 'god', id: 'prayer', stream: 'god.acts' };

/** Numbers a prayer word may move; the character system registers these names (`hp` is the hit points, a wound stands for them until combat). */
const STATS = new Set(['gold', 'int', 'vit', 'brave', 'kind', 'fame', 'pow', 'mag', 'spd', 'luk']);

export interface FxWho {
  /** The NPC the prayer is for (`kin_sick`). */
  npc?: string;
}

function hp(ctx: Ctx, n: number): string {
  const life = livingOf(ctx);
  if (!life) return 'hp';
  const ext = characterExt(life);
  if (n >= HP_HEAL_AT) {
    if (ext.wounds > 0) ext.wounds -= 1;
    if (ext.wounds === 0) life.flags = life.flags.filter((f) => f !== 'wounded');
  } else if (n <= -HP_WOUND_AT) {
    apply(ctx, [{ k: 'wound' }], SRC);
  }
  return `hp${n >= 0 ? '+' : ''}${n}`;
}

function countryFlag(ctx: Ctx, sign: string, flag: string): void {
  const life = livingOf(ctx);
  if (!life) return;
  const w = ctx.state.world;
  const flags = (w.countryFlags[life.country] ??= []);
  if (sign === '-') {
    w.countryFlags[life.country] = flags.filter((f) => f !== flag);
    if (flag === 'war') delete w.chains['warflag:' + life.country];
  } else if (!flags.includes(flag)) flags.push(flag);
}

function pickCurse(ctx: Ctx): string | undefined {
  const life = livingOf(ctx);
  if (!life) return undefined;
  const w = godOf(ctx).chest.tierWeights;
  const list = idx(ctx).curses.filter((c) => !life.curses.includes(c.id) && !c.id.startsWith('rc_'));
  if (!list.length) return undefined;
  const i = ctx.rng('god.acts').weighted(list.map((c) => w[c.tier as keyof typeof w] ?? 1));
  return i < 0 ? undefined : list[i].id;
}

function skillRandom(ctx: Ctx): string {
  const life = livingOf(ctx);
  if (!life) return 'skill';
  const rng = ctx.rng('god.acts');
  const raise = Object.entries(life.aptitudes)
    .filter(([, lv]) => lv < 3)
    .map(([k]) => k)
    .sort();
  if (raise.length) {
    const k = rng.pick(raise);
    apply(ctx, [{ k: 'stat', stat: k, delta: 1 }], SRC);
    return `skill:${k}`;
  }
  const fresh = [...idx(ctx).skills.values()].filter((s) => s.kind === 'new' && !life.skills.includes(s.id)).map((s) => s.id).sort();
  if (!fresh.length) return 'skill:none';
  const id = rng.pick(fresh);
  apply(ctx, [{ k: 'grant', kind: 'skill', id }], SRC);
  return `skill:${id}`;
}

/** Applies the words of one effect cell. Returns the words as they were understood, for the log. */
export function applyFx(ctx: Ctx, fx: string, who: FxWho = {}): string[] {
  const out: string[] = [];
  const life = livingOf(ctx);
  for (const word of fx.split(/\s+/).filter(Boolean)) {
    let m: RegExpExecArray | null;
    if ((m = /^hp([+-]\d+)$/.exec(word))) out.push(hp(ctx, Number(m[1])));
    else if ((m = /^country:([+-])(\w+)$/.exec(word))) {
      countryFlag(ctx, m[1], m[2]);
      out.push(word);
    } else if ((m = /^belief([+-]\d+)$/.exec(word))) {
      belief(ctx, Number(m[1]));
      out.push(word);
    } else if ((m = /^([a-z]+)([+-]\d+)$/.exec(word)) && STATS.has(m[1])) {
      apply(ctx, [{ k: 'stat', stat: m[1], delta: Number(m[2]) } as Effect], SRC);
      out.push(word);
    } else if ((m = /^karma([+-]\d+)$/.exec(word))) {
      out.push(word); // the sin of the one who wished for a death: kept in the chronicle (no karma number before the ending system)
    } else if (word === 'rel:+lover') {
      if (life && !life.flags.includes('god_lover')) life.flags.push('god_lover');
      apply(ctx, [{ k: 'bond', line: 'lover', level: 1 }], SRC);
      out.push(word);
    } else if (word === 'child') {
      if (life && !life.flags.includes('god_child')) life.flags.push('god_child');
      apply(ctx, [{ k: 'bond', line: 'child', level: 1 }], SRC);
      out.push(word);
    } else if ((m = /^curse:(.+)$/.exec(word))) {
      const id = m[1] === 'random' ? pickCurse(ctx) : m[1];
      if (id) apply(ctx, [{ k: 'grant', kind: 'curse', id }], SRC);
      out.push(id ? `curse:${id}` : 'curse:none');
    } else if (word === 'uncurse:random') {
      if (life && life.curses.length) {
        const id = ctx.rng('god.acts').pick([...life.curses].sort());
        apply(ctx, [{ k: 'remove', kind: 'curse', id }], SRC);
        out.push(`uncurse:${id}`);
      } else out.push('uncurse:none');
    } else if (word === 'skill:random') out.push(skillRandom(ctx));
    else if (word === 'relkill:nemesis') {
      const list = nemeses(ctx);
      const id = list.length ? ctx.rng('god.acts').pick(list) : undefined;
      if (id) killNpc(ctx, id, 'กรรมตามสนอง');
      out.push(id ? `relkill:${id}` : 'relkill:none');
    } else if (word === 'npc:heal') {
      if (who.npc) healNpc(ctx, who.npc, 0);
      out.push(word);
    } else if ((m = /^npc:att([+-]\d+)$/.exec(word))) {
      // "att" = attitude: +15 of the 0..100 feeling is one step of the favour axis (0..5)
      if (who.npc) favourNpc(ctx, who.npc, Math.sign(Number(m[1])));
      out.push(word);
    } else if (word === 'npc:die') {
      if (who.npc) killNpc(ctx, who.npc, 'พระเจ้าไม่ตอบคำอธิษฐาน');
      out.push(word);
    } else out.push(`?${word}`);
  }
  return out;
}

/** Does the number exist for this prayer word (a test reads every word of the data through this)? */
export function understood(word: string): boolean {
  return /^(hp[+-]\d+|country:[+-]\w+|belief[+-]\d+|karma[+-]\d+|rel:\+lover|child|curse:.+|uncurse:random|skill:random|relkill:nemesis|npc:heal|npc:att[+-]\d+|npc:die)$/.test(word) || /^[a-z]+[+-]\d+$/.test(word) && STATS.has(word.replace(/[+-]\d+$/, ''));
}

