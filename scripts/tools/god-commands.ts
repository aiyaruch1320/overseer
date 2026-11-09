// The commands of the god in text (docs/guide/code-plan.md §8.0 and §6.4), shared by `npm run play` and the debug page.
// A player (a person or a simulated-player subagent) types `chest`, `pick 2`, `dream 1`, `whisper ระวัง`, `answer 1 ให้`,
// `miracle MR-04 <ประเทศ>`, `decree <เหตุการณ์> <ตัวคูณ>`, `cancel N`. Each one goes through `command()` of the core
// (src/core/command): first the preview (the core checks the right to act and answers the expected result without rolling),
// then, after `yes`, the real run (docs/systems/god/06-implementation.md §3).
//
// What the player reads is Thai (docs/appearance/20-god-ui.md); the only codes are the `MR-xx` of a miracle that the player types.
// The arguments sent to the actions are the names the actions read (src/core/god/actions.ts and src/core/god/acts/):
//   chest.open {} · chest.pick {slot} · chest.reroll {lock?} · chest.skip {} · dream.send {path} (1, 2 or 3 of the ways offered)
//   whisper {hint, target?} · prayer.answer {id, answer, option?} · miracle {id, country | countries | continent | npc | dragon | event+mul}
//   miracle {cancel} (take back an omen) · decree {event, mul} · conjure {verb, core, scale, country | continent | npc} or {cancel} · vow.pick {pick} (1 to 3, 4 for none; see god-conjure.ts)
// Browser safe: no node imports.
import { command, hasAction } from '../../src/core/command';
import type { Ctx, Game, GameData } from '../../src/core/game';
import { actsOf, cardsOf, fateTargets, grantPrice, implementedMiracles, kindOf, nameOfKind, strangeOptions } from '../../src/core/god/acts';
import { chestLimit, currentChest, inWindow, offerCards } from '../../src/core/god';
import { crisesWaiting, findAlly } from '../../src/core/bonds';
import { circleLines, conjureArgText, unlink, conjureLines, conjureOption, parseConjure, vowArgText, vowLines, vowOption, vowTable } from './god-conjure';
import { npcsAt } from '../../src/core/npc';
import { callReason, fxSplit, labels, plainName, reasonText, scrub, sentence } from '../../src/core/text';
import { CHEST_KIND_TH, FLAG_TH, PENDING_NOTE, TIER_TH, WHY_TH } from '../../src/core/text/tuning';
import { DESTROY_RETURN_DIV } from '../../src/core/god/acts/tuning';
import { countriesOf } from '../../src/core/god/acts/geo';
import type { GodAction, LogEntry } from '../../src/core/types';
import { tagOf, timeline } from './report';
import { toolNotes } from './session';

export interface PendingGod {
  action: GodAction;
  args: Record<string, unknown>;
  title: string;
}

export interface GodConsoleOpts {
  game: Game;
  data: GameData;
  /** Run at once after the preview (`--yes`). */
  autoYes?: boolean;
  /** Show what the tool could not put in words (keys of the preview it does not know). */
  dev?: boolean;
  pending?: PendingGod | null;
}

export const TITLE: Record<GodAction, string> = {
  'chest.open': 'เปิดหีบประทาน',
  'chest.pick': 'เลือกการ์ดในหีบ',
  'chest.reroll': 'ทอยหีบใหม่',
  'chest.skip': 'ข้ามหีบ',
  'dream.send': 'ส่งฝัน',
  whisper: 'กระซิบ',
  'prayer.answer': 'ตอบคำอธิษฐาน',
  miracle: 'ปาฏิหาริย์',
  decree: 'ลิขิต',
  conjure: 'เสกตามใจ',
  'vow.pick': 'เลือกคำปฏิญาณ',
};

/** What each action looks like to type, for `options` and `help`. */
const USAGE: Record<GodAction, string> = {
  'chest.open': 'chest',
  'chest.pick': 'pick N',
  'chest.reroll': 'reroll [ล็อก N]',
  'chest.skip': 'skip',
  'dream.send': 'dream N',
  whisper: 'whisper <คำใบ้> [เป้า]',
  'prayer.answer': 'answer <ใบ> <ให้|แปลก N|ปฏิเสธ|ลงโทษ|นิ่ง>',
  miracle: 'miracle MR-xx [เป้าหมาย]',
  decree: 'decree <เหตุการณ์> <ตัวคูณ>',
  conjure: 'conjure <กริยา> <แก่น> <ขนาด> [เป้าหมาย]',
  'vow.pick': 'vow [N]',
};

const ORDER = Object.keys(TITLE) as GodAction[];

type Meta = 'power' | 'options' | 'yes' | 'no';
const WORDS: Record<string, GodAction | Meta | 'cancel'> = {
  chest: 'chest.open',
  pick: 'chest.pick',
  reroll: 'chest.reroll',
  skip: 'chest.skip',
  dream: 'dream.send',
  whisper: 'whisper',
  answer: 'prayer.answer',
  miracle: 'miracle',
  decree: 'decree',
  cancel: 'cancel',
  conjure: 'conjure',
  vow: 'vow.pick',
  power: 'power',
  options: 'options',
  yes: 'yes',
  y: 'yes',
  ยืนยัน: 'yes',
  no: 'no',
  ไม่: 'no',
  ยกเลิก: 'no',
};

/** True when the first word of a line is one of the commands of the god (so `play` knows to hand the line to the console). */
export function isGodWord(word: string | undefined): boolean {
  return !!word && Object.prototype.hasOwnProperty.call(WORDS, word.toLowerCase());
}

export function godHelp(): string[] {
  return [
    'คำสั่งพระเจ้า (ทุกคำสั่งที่เปลี่ยนโลกจะแสดงตัวอย่างผลก่อน แล้วพิมพ์ yes เพื่อทำจริง หรือ no เพื่อยกเลิก; ใส่ --yes เพื่อทำเลย):',
    ...ORDER.map((a) => `  ${USAGE[a]} — ${TITLE[a]}`),
    '  cancel N — ยกเลิกลางของปาฏิหาริย์ใบที่ N (ได้พลังคืนครึ่งหนึ่ง)',
    '  ปาฏิหาริย์ใหญ่: miracle MR-17 <ประเทศ> ดาวตก · MR-18 <ประเทศ> แผ่นดินกลืนเมือง (ทำให้เป็นซาก ชีวิตละครั้ง) · MR-19 <ประเทศ> น้ำท่วมใหญ่ · MR-20 <ประเทศ> ยกแผ่นดินใหม่ · MR-22 <ทวีป> พระพิโรธ (ชีวิตละครั้ง)',
    '    ทุกอย่างมีลางหนึ่งฤดูก่อนเกิดเหตุ ประเทศที่มีมังกรอยู่ (หมุดผนึก) และคองคอร์เดีย รับผลเบากว่าหนึ่งระดับ มังกรเจ็บและตอบกลับภายในหนึ่งปี ตัวอย่างผลบอกก่อนว่าจะเป็นอย่างไร',
    '  power — แสงศรัทธา ความหวาดกลัว ราคา และเพดานที่เหลือ',
    '  options — สิ่งที่ทำได้ตอนนี้ และสิ่งที่รออยู่ (หีบ ความฝัน คำอธิษฐาน ลาง)',
    '  yes / no — ยืนยัน / ยกเลิกคำสั่งที่รออยู่',
    'เป้าหมายพิมพ์เป็นชื่อได้ (ประเทศ ทวีป NPC มังกร เหตุการณ์) หรือรหัสที่ npcs / options บอก',
  ];
}

// ---------- the words of a preview ----------

const LABEL: Record<string, string> = {
  cost: 'ราคา',
  price: 'ราคา',
  chance: 'โอกาส',
  p: 'โอกาส',
  odds: 'โอกาส',
  expected: 'ผลที่คาด',
  effect: 'ผลที่คาด',
  effects: 'ผลที่คาด',
  result: 'ผล',
  risk: 'ความเสี่ยง',
  cooldown: 'ระยะรอ',
  title: 'ชื่อ',
  name: 'ชื่อ',
  text: 'ข้อความ',
  summary: 'สรุป',
  targetName: 'ที่',
  closes: 'เหตุการณ์ที่จะปิด',
  opens: 'เหตุการณ์ที่จะเปิด',
  npcs: 'NPC ที่เสี่ยง',
  note: 'หมายเหตุ',
};

const PERCENT = new Set(['chance', 'p', 'odds']);
const LINE_NAME = { faith: 'แสงศรัทธา', dread: 'ความหวาดกลัว' } as const;

function fmtNum(key: string, n: number): string {
  if (PERCENT.has(key) && n >= 0 && n <= 1) return `${Math.round(n * 100)}%`;
  return String(Math.round(n * 100) / 100);
}

function fmtValue(data: GameData, key: string, v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return fmtNum(key, v);
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่';
  if (typeof v === 'string') {
    const t = scrub(data, v).trim();
    return t || undefined;
  }
  if (Array.isArray(v)) {
    if (!v.length) return 'ไม่มี';
    const parts = v.map((x) => fmtValue(data, key, x)).filter((x): x is string => !!x);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (typeof v === 'object') {
    const parts: string[] = [];
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const label = LINE_NAME[k as 'faith'] ?? LABEL[k];
      const t = fmtValue(data, k, x);
      if (label && t) parts.push(`${label} ${t}`);
    }
    return parts.length ? parts.join(' ') : undefined;
  }
  return undefined;
}

/** A price `{faith, dread}` as `แสงศรัทธา 15` (nothing when free). */
export function costWords(c: unknown): string | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const o = c as { faith?: number; dread?: number };
  const parts: string[] = [];
  if (o.faith) parts.push(`แสงศรัทธา ${o.faith}`);
  if (o.dread) parts.push(`ความหวาดกลัว ${o.dread}`);
  return parts.length ? parts.join(' + ') : undefined;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** A number of the income table of the god (what a granted prayer gives back). */
const incomeOf = (data: GameData, key: string): number => ((data.god?.items as { income?: Record<string, number> } | undefined)?.income?.[key]) ?? 0;
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** What a preview needs to know of the game besides the preview itself (the console fills it from the state; a test may leave it out). */
export interface PreviewEnv {
  /** The names of the curses the character carries (a prayer to lift a curse takes one of them at random). */
  curses?: string[];
  /** The burden of the heart now and the level at which it breaks. */
  heart?: number;
  burdenAt?: number;
  /** The flags (ids) of the countries a miracle names: when the miracle clears a hazard they do not have, the preview says so. */
  flags?: Record<string, string[]>;
}

const MIRACLES = (data: GameData) =>
  ((data.god?.items as { miracles?: { list: { id: string; tier?: string; world?: string; story?: string; immediate?: string; flagsClear?: string[]; cost: { dread?: number } }[] } } | undefined)?.miracles?.list ?? []);

/** The text of a whisper effect as the player reads it: the numbers stay (×2, +2), a branch word in brackets stays as a word. */
export function whisperEffect(data: GameData, text: string): string {
  return scrub(data, text.replace(/ทาง\s*`?\[([^\]]+)\]`?/g, 'ทาง$1'), { keepNumbers: true });
}

/** The preview of one action as lines for the player. The keys the tool has no words for go to a `(ดีบัก)` line only when `dev` is on. */
export function previewLines(data: GameData, preview: Record<string, unknown> | undefined, dev = false, action?: GodAction, env: PreviewEnv = {}): string[] {
  if (!preview) return [];
  const p = preview;
  const nm = (id: unknown) => plainName(data, id);
  switch (action) {
    case 'chest.open':
      return [
        `หีบที่เปิดได้ปีนี้: เหลือ ${num(p.left)} จาก ${num(p.limit)}${p.window ? ' (หน้าต่างพระเจ้า ราคาในหีบลด ×0.7)' : ''}`,
        'ยังไม่รู้ว่าในหีบมีอะไร จนกว่าจะเปิด (ไม่เสียพลังจนกว่าจะเลือกใบ)',
      ];
    case 'chest.pick': {
      const out = [`ใบที่ ${num(p.slot)}: ${str(p.name) || nm(p.id)} (${CHEST_KIND_TH[str(p.kind)] ?? 'ของ'} ระดับ${TIER_TH[str(p.tier)] ?? str(p.tier)})`, `ราคา: ${LINE_NAME[str(p.pay) as 'faith'] ?? 'พลัง'} ${num(p.price)}`];
      const does = cardEffect(data, { kind: str(p.kind), id: str(p.id), variant: str(p.variant) });
      if (does) out.splice(1, 0, `ทำอะไร: ${does}`);
      const b = num(p.belief);
      if (b) out.push(`ศรัทธาเทพของเขา: ${b > 0 ? '+' : ''}${b}`);
      const why = (Array.isArray(p.why) ? p.why : []).map((w) => WHY_TH[str(w)]).filter(Boolean);
      if (why.length) out.push(`เหตุที่ขึ้น: ${why.join(' · ')}`);
      return out;
    }
    case 'chest.reroll':
      return [`ทอยใหม่ครั้งที่ ${num(p.rerolls) + 1}: ราคา แสงศรัทธา ${num(p.price)}${num(p.lock) ? ` (ล็อกใบที่ ${num(p.lock)} ไว้)` : ''}`, 'ใบที่ไม่ล็อกจะเปลี่ยนทั้งหมด'];
    case 'chest.skip':
      return ['พับหีบเก็บ ไม่เลือกสิ่งใด ไม่เสียพลัง'];
    case 'dream.send': {
      const out = [`ทาง: ${sentence(data, str(p.label)) || 'ทางที่เกมเสนอ'}`, `ภาพในฝัน: ${str(p.symbol)}`, `ใจของเขา: ${str(p.level)}${Array.isArray(p.reasons) && p.reasons.length ? ` (${p.reasons.map(str).join(' · ')})` : ''}`];
      const band = ((data.god?.items as { dreams?: { levels?: { name: string; min: number; max: number }[] } } | undefined)?.dreams?.levels ?? []).find((l) => l.name === str(p.level));
      if (band) out.push(`โอกาสทำตามราว ${Math.round(band.min * 100)}–${Math.round(band.max * 100)}% (ทอยตอนเขาถึงทางแยก: ทำตาม ตีความผิด หรือปฏิเสธ ท่านยังไม่รู้ผลตอนนี้)`);
      out.push(p.free ? 'ราคา: ฟรีครั้งนี้ (อาวุธของผู้รู้)' : `ราคา: แสงศรัทธา ${num(p.faith)}`);
      // a way against his nature weighs on his heart when he obeys it (03-dreams.md §4): said before the dream is sent (review M2 P9)
      if (Array.isArray(p.reasons) && p.reasons.some((r) => str(r).includes('ขัดกับนิสัย'))) {
        const at = env.burdenAt ?? 2;
        out.push(`คำเตือน: ถ้าเขาทำตามทางนี้ ภาระใจจะเพิ่มอีก 1${env.heart !== undefined ? ` (ตอนนี้ ${env.heart} จาก ${at})` : ''} ถึง ${at} เขาจะทิ้งงานหรือบ้านไปฤดูหนึ่ง ตั้งคำถามกับท่าน หรือนิสัยเปลี่ยน`);
      }
      return out;
    }
    case 'whisper': {
      const out = [`คำใบ้ “${str(p.hint)}”: ${whisperEffect(data, str(p.effect))}`, `ใจของเขา: ${str(p.level)}`];
      const c = costWords(p.cost);
      out.push(c ? `ราคา: ${c}${p.window ? ' (หน้าต่างพระเจ้า ลดราคา)' : ''}` : 'ราคา: ฟรีครั้งนี้');
      out.push(`กระซิบได้อีก ${num(p.left)} ครั้งในปีนี้`);
      return out;
    }
    case 'prayer.answer': {
      const out = [`คำอธิษฐานใบที่ ${num(p.prayer)}: ${str(p.name)}`];
      const ans = str(p.answer);
      if (ans === 'give' || ans === 'strange') {
        out.push(`ราคา: ${costWords(p.cost) ?? 'ไม่มี'}`);
        const back = num(p.light) || incomeOf(data, 'prayerGrant');
        if (ans === 'give') {
          const { done, promised } = fxSplit(data, p.effect);
          // a lifted curse is drawn at random from the ones he carries: say which (review M2 #12)
          const lift = str(p.effect).includes('uncurse:random');
          const words = lift && env.curses?.length ? done.map((w) => (w === 'คำสาปหลุดไป' ? `คำสาปข้อหนึ่งหลุดไป (สุ่มจาก ${env.curses!.join(' · ')})` : w)) : done;
          if (promised.length) {
            out.push(`ผลที่คาด: ${words.length ? words.join(' · ') : 'ยังไม่เกิดผลทันที'}`);
            out.push(`${PENDING_NOTE}: ${promised.join(' · ')} (ท่านจ่ายราคาเต็ม แต่ผลนี้ยังไม่เป็นจริงตอนนี้)`);
          } else out.push(`ผลที่คาด: ${words.length ? words.join(' · ') : 'เขาได้สิ่งที่ขอ'}`);
        } else if (Array.isArray(p.options)) {
          out.push(`ของแปลกที่ให้เลือก: ${(p.options as { name?: string; tier?: string }[]).map((o, i) => `${i + 1} ${str(o.name)}${o.tier && TIER_TH[o.tier] ? ` (ระดับ${TIER_TH[o.tier]})` : ''}`).join(' · ')}`);
          out.push('ผลที่คาด: เขาได้พรที่เลือก ส่วนสิ่งที่ขอตรง ๆ ไม่เกิด (มีเรื่องเล็กที่เข้ามาแทน)');
        }
        out.push(`ศรัทธาเทพของเขา ${num(p.belief) >= 0 ? '+' : ''}${num(p.belief)}${back ? ` · ท่านได้แสงศรัทธาคืน ${back}` : ''}`);
        const paid = (p.cost as { faith?: number } | undefined)?.faith;
        if (paid && back) out.push(`ราคาสุทธิหลังได้คืน: แสงศรัทธา ${Math.round((paid - back) * 100) / 100}`);
      } else if (ans === 'punish') {
        const { done, promised } = fxSplit(data, p.effect);
        const fx = [...done, ...promised];
        out.push(`ผลที่คาด: ผู้ขอถูกลงโทษ${fx.length ? ` (${fx.join(' · ')})` : ''}`, `ท่านได้ความหวาดกลัว +${num(p.dread)} · ศรัทธาเทพของเขา ${num(p.belief)}`);
      } else if (ans === 'deny') {
        // a prayer against a trouble (war, plague, famine, sickness) that is refused does not end it: the world's event goes on by its own rule (T2-11)
        const kinds = (data.god?.items as { prayers?: { kinds?: { id: string; trouble?: boolean }[] } } | undefined)?.prayers?.kinds ?? [];
        const trouble = kinds.find((k) => k.id === str(p.kind))?.trouble === true;
        out.push(trouble ? `ผลที่คาด: ท่านไม่ช่วย เรื่องที่ขอ (${str(p.name)}) ดำเนินต่อไปตามโลก` : 'ผลที่คาด: ท่านไม่ให้สิ่งที่ขอ ไม่มีอะไรเปลี่ยนจากฝีมือท่าน', `ศรัทธาเทพของเขา ${num(p.belief)}`);
      }
      else out.push('นิ่งเฉย: คำอธิษฐานยังรออยู่จนหมดเวลา (แล้วศรัทธาเทพลด 2)');
      return out;
    }
    case 'conjure':
      return conjureLines(data, p, (x) => previewLines(data, x, dev, 'miracle', env));
    case 'vow.pick':
      return vowLines(p);
    case 'miracle':
    case 'decree': {
      if (p.cancel !== undefined) {
        const r = p.refund as { faith?: number; dread?: number } | undefined;
        const warn = (Array.isArray(p.warn) ? p.warn : []).map(str).filter(Boolean);
        const what = str(p.name) || (typeof p.id === 'string' ? nm(p.id) : '');
        return [
          `ยกเลิกลาง${what ? ` ${what}` : `ใบที่ ${num(p.cancel)}`} เหตุนั้นจะไม่เกิด`,
          `ได้พลังคืน: ${costWords(r) ?? 'ไม่มี'} (ครึ่งหนึ่งของที่จ่าย)`,
          ...(warn.length ? [`ไม่คืน: ${warn.join(' · ')}`] : []),
        ];
      }
      const out = [`${str(p.name)} (ระดับ${str(p.tier)})`];
      const where = str(p.targetName) || (typeof p.target === 'string' ? nm(p.target.replace(/^[a-z]+:/, '')) : '');
      if (where) out.push(`ที่: ${where}`);
      out.push(`ราคา: ${costWords(p.cost) ?? 'ไม่เสียพลัง'}`);
      // the road of ruin gives a third of its fear back when the thing happens (01-power.md §1): said in the preview, with the net price (review M2 L4)
      const dread = (p.cost as { dread?: number } | undefined)?.dread ?? 0;
      if (dread > 0 && (p.line === 'destroy' || p.line === 'dragon')) {
        const back = (p.back as { dread?: number } | undefined)?.dread ?? Math.round(dread / DESTROY_RETURN_DIV);
        out.push(`เมื่อเหตุเกิดขึ้น ท่านได้ความหวาดกลัวคืน ${back} (ราคาสุทธิ ความหวาดกลัว ${dread - back})`);
      }
      const row = typeof p.id === 'string' ? MIRACLES(data).find((m) => m.id === p.id) : undefined;
      if (row?.immediate && typeof p.left !== 'string' && !p.sealed) out.push(`ผลที่คาด: ${scrub(data, unlink(row.immediate))}`);
      // the grand miracle tells what it does to the world and to the ones who see it (M4 review M2): the price is all the light, so the player should know what it buys
      if (row?.tier === 'มหา' && row.world) out.push(`ผลต่อโลก: ${scrub(data, unlink(row.world), { keepNumbers: true })}`);
      if (row?.tier === 'มหา' && row.story) out.push(`ผลต่อเรื่อง: ${scrub(data, unlink(row.story))}`);
      if (row?.flagsClear?.length && env.flags) {
        const have = Object.values(env.flags).flat();
        const gone = row.flagsClear.filter((f) => !have.includes(f));
        // the miracle clears a hazard the country does not have: it is paid for and does nothing but the price of goods (review M2 P6 L4)
        if (gone.length === row.flagsClear.length) out.push(`คำเตือน: ${typeof p.target === 'string' && p.target.length === 2 ? 'ทวีป' : 'ประเทศ'}นั้นไม่มี${gone.map((f) => FLAG_TH[f] ?? f).join(' · ')}ให้ปลด ท่านจะเสียราคาเต็มโดยผลเหลือแค่ราคาของในตลาดที่เปลี่ยนไป`);
      }
      if (num(p.omen)) out.push(`ลาง: อีก ${num(p.omen)} ฤดูก่อนเกิดเหตุ (ยกเลิกได้ ได้คืนครึ่งหนึ่ง)`);
      if (num(p.wait)) out.push(`ระยะรอหลังใช้: ${num(p.wait)} ปีโลก`);
      if (p.mul !== undefined) out.push(`ตัวคูณ: ×${num(p.mul)} นาน ${num(p.years)} ปีโลก${num(p.weight) ? ` (น้ำหนักตอนนี้ ${fmtNum('x', num(p.weight))})` : ''}`);
      const ch = p.chance as { now?: number; after?: number; die?: number; hurt?: number } | undefined;
      if (ch?.now !== undefined) out.push(`โอกาสเกิดในรอบถัดไป: ${Math.round(num(ch.now) * 100)}% → ${Math.round(num(ch.after) * 100)}%`);
      if (ch?.die !== undefined) out.push(`โอกาส: ตาย ${Math.round(num(ch.die) * 100)}% · บาดเจ็บหนัก ${Math.round(num(ch.hurt) * 100)}%`);
      if (typeof p.left === 'string') out.push(`ผลที่คาด: ${scrub(data, p.left)}`);
      else if (p.left && typeof p.left === 'object') {
        const l = p.left as { mid?: number; big?: number; grand?: number };
        out.push(`เหลือในชีวิตนี้: ระดับกลาง ${num(l.mid)} · ใหญ่ ${num(l.big)} · มหา ${num(l.grand)}`);
      }
      const flagWords = (Array.isArray(p.flags) ? p.flags : []).map((f) => FLAG_TH[str(f)] ?? scrub(data, str(f))).filter(Boolean);
      if (flagWords.length) out.push(`สิ่งที่ประเทศนั้นเป็นอยู่: ${flagWords.join(' · ')}`);
      if (p.mood !== undefined) out.push(`อารมณ์ของมังกร ${Math.round(num(p.mood))} → ${Math.round(num(p.after))}`);
      if (typeof p.name === 'string' && p.mood !== undefined) out[0] = `${str(p.name)} (ระดับ${str(p.tier)})`;
      // the large and grand miracles tell what they will do in sentences of their own (ruins, seals, the wrath)
      if (Array.isArray(p.notes)) for (const n of p.notes) if (str(n)) out.push(str(n));
      return out;
    }
    default:
  }
  // a power the tool has no phrasing for: the generic labels
  const out: string[] = [];
  const unknown: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === 'lines' && Array.isArray(v)) {
      for (const l of v) if (typeof l === 'string' && scrub(data, l).trim()) out.push(scrub(data, l).trim());
      continue;
    }
    const label = LABEL[k];
    const t = label ? fmtValue(data, k, v) : undefined;
    if (label && t) out.push(`${label}: ${t}`);
    else if (!label) unknown.push(`${k}=${JSON.stringify(v)}`);
  }
  if (dev && unknown.length) out.push(`(ดีบัก) ${unknown.join(' ')}`);
  return out;
}

/**
 * Why the game called the player: the data of the `attention` call in words, or the old rule (an entry of level 3). With the game at hand it also
 * says what the player can do because of this call (review M2 #6 #8): the prayer that waits, the way to dream, the omen that can or cannot be decreed.
 */
export function callLines(data: GameData, e: LogEntry, dev = false, game?: Game): string[] {
  if (e.sys !== 'attention') return [`เกมเรียกเพราะ: เรื่อง [${tagOf(e)}] ถึงจุดที่ต้องการผู้เล่น (บันทึกระดับ 3)`];
  const mode = e.data.call === 'stop' ? 'เกมหยุดรอท่าน' : 'มีเรื่องรอท่าน (เวลายังเดินอยู่)';
  const tail = dev ? ` (ดีบัก: ${Object.entries(e.data).map(([k, v]) => `${k}=${String(v)}`).join(' ')})` : '';
  // the card of a crisis names the person: the entries it stands for are the announcements of `bonds/crisis`
  const crisis = (n: number): string | undefined => {
    const c = game?.state.log.find((x) => x.n === n && x.sys === 'bonds' && x.kind === 'crisis');
    return c && String(c.data.name ?? '') ? `${String(c.data.name)}${c.data.line ? ` (${String(c.data.line)})` : ''}` : undefined;
  };
  const out = [`เกมเรียกเพราะ: ${callReason(data, e, crisis)} · ${mode}${tail}`];
  const because = game ? becauseLine(game, e) : '';
  if (because) out.push(because);
  return out;
}

/** What the call lets the player do, from the state now. Empty when there is nothing to add. */
function becauseLine(game: Game, e: LogEntry): string {
  const ctx = game.ctx;
  const st = game.state;
  const life = st.life;
  if (!life || life.dead) return 'ชีวิตนี้จบแล้ว ไม่มีสิ่งใดให้ทำอีก';
  const first = String(e.id ?? '').split(',')[0];
  const nm = (id: string) => plainName(ctx.data, id);
  switch (String(e.data.why)) {
    case 'prayer': {
      const cards = cardsOf(ctx).filter((c) => c.kind === first);
      const c = cards[cards.length - 1];
      if (!c) return 'ทำได้เพราะเรื่องนี้: คำอธิษฐานใบนี้ไม่รออยู่แล้ว (ถูกตอบหรือหมดเวลาไปก่อน)';
      const left = Math.max(0, c.exp - (life.hAge * 4 + st.clock.quarter));
      return `ทำได้เพราะเรื่องนี้: คำอธิษฐานใบที่ ${c.n} (${nameOfKind(ctx, c.kind)}) เหลือเวลาราว ${(left / 4).toFixed(1)} ปี — answer ${c.n} <ให้|แปลก N|ปฏิเสธ|ลงโทษ|นิ่ง>`;
    }
    case 'window': {
      const n = offerCards(ctx).length;
      return n ? `ทำได้เพราะเรื่องนี้: ฝันถึงทางแยกที่เปิดอยู่ได้ ${n} ทาง (dream N) ในหน้าต่างพระเจ้านี้ราคาลด ×0.7` : 'ทำได้เพราะเรื่องนี้: ตอนนี้ไม่มีทางแยกให้ฝันถึง (ทางแยกนั้นถูกตัดสินไปแล้วหรือยังไม่มีเส้นเรื่องเปิด) แต่หน้าต่างพระเจ้าลดราคาอย่างอื่นได้ ×0.7';
    }
    case 'age':
      return 'ทำได้เพราะเรื่องนี้: จุดหยุดตามอายุเป็นหน้าต่างพระเจ้า ราคาลด ×0.7 ตลอดปีนี้ (เปิดหีบ ส่งฝัน กระซิบ)';
    case 'omen': {
      const hit = fateTargets(ctx).find((t) => t.id === first);
      if (hit) return `ทำได้เพราะเรื่องนี้: ลิขิตเหตุการณ์นี้ได้ — decree ${hit.name} <ตัวคูณ>`;
      const name = nm(first);
      return `ทำได้เพราะเรื่องนี้: ลางนี้${name ? ` (${name})` : ''}เป็นข่าวให้รู้ ลิขิตเหตุการณ์นี้ไม่ได้ (ลิขิตได้เฉพาะเหตุการณ์ในรายการ decree list)`;
    }
    case 'majorOmen':
      return 'ทำได้เพราะเรื่องนี้: ลางใหญ่ใกล้ตัว ปาฏิหาริย์และลิขิตเบนทางของมันได้';
    case 'nearDeath':
      return 'ทำได้เพราะเรื่องนี้: นี่คือช่วงสุดท้ายของชีวิต ตอบคำอธิษฐานที่ค้างหรือส่งฝันครั้งสุดท้ายได้ก่อนที่ทุกอย่างจะจบ';
    case 'battle':
      return 'ทำได้เพราะเรื่องนี้: ศึกที่กำลังมา กระซิบ “จุดอ่อนของศัตรู” หรือ “ระวัง” ได้';
    case 'crisis': {
      const w = crisesWaiting(ctx).find((x) => x.tie.id === first) ?? crisesWaiting(ctx)[0];
      if (!w) return 'ทำได้เพราะเรื่องนี้: คนใกล้ตัวตกอยู่ในวิกฤต แต่ตัวละครตัดสินใจไปแล้ว';
      return `ทำได้เพราะเรื่องนี้: ${w.tie.name} (${w.tie.line}) ตกอยู่ในวิกฤต — กระซิบ ช่วย ${w.tie.name} (หรือ คนนั้นโกหก ${w.tie.name}) หรือส่งฝันถึงเขาได้ก่อนที่ตัวละครจะตอบ`;
    }
  }
  return '';
}

function costText(preview: Record<string, unknown> | undefined): string | undefined {
  if (!preview) return undefined;
  return costWords(preview.cost) ?? (typeof preview.price === 'number' ? `แสงศรัทธา ${preview.price}` : typeof preview.faith === 'number' && preview.faith ? `แสงศรัทธา ${preview.faith}` : undefined);
}

// ---------- counters shown by `power` ----------

function argText(action: GodAction, args: Record<string, unknown>): string {
  switch (action) {
    case 'chest.pick':
      return ` ใบที่ ${String(args.slot)}`;
    case 'dream.send':
      return ` ทางที่ ${String(args.path)}`;
    case 'whisper':
      return ` “${String(args.hint)}”`;
    case 'prayer.answer':
      return ` ใบที่ ${String(args.id)}`;
    case 'miracle':
      return args.cancel !== undefined ? ` ยกเลิกลางใบที่ ${String(args.cancel)}` : args.id ? ` ${String(args.id)}` : '';
    case 'decree':
      return ` ×${String(args.mul)}`;
    case 'conjure':
      return conjureArgText(args);
    case 'vow.pick':
      return vowArgText(args);
    default:
      return '';
  }
}

/** A multiplier as typed: `0.5`, `×0.5` or `x0.5` (the line of help writes it with the ×). */
function mulOf(w: string | undefined): number {
  return Number((w ?? '').replace(/^[×xX*]/, ''));
}

function int(w: string | undefined): number | undefined {
  if (w === undefined || !/^\d+$/.test(w)) return undefined;
  return Number(w);
}

// ---------- targets by name ----------

/** The way to turn what a player typed into the id the core wants. Each returns undefined when nothing fits. */
export interface TargetRef {
  country(text: string): string | undefined;
  continent(text: string): string | undefined;
  npc(text: string): string | undefined;
  dragon(text: string): number | undefined;
  event(text: string): string | undefined;
  /** Names that fit what was typed, for the answer "no such one" (up to a few). */
  near?(what: 'country' | 'npc' | 'dragon' | 'event', text: string): string[];
}

const ID = { country: /^[A-Z]{2}-\d{2}$/, continent: /^[A-Z]{2}$/, npc: /^[A-Z]{2}\d{2}-\d$/, event: /^[A-Z]{2,4}-\d{1,3}$/ };

/** Resolvers that take an id as it is and know no names (what `parseGod` uses when it gets nothing better). */
export const ID_REF: TargetRef = {
  country: (t) => (ID.country.test(t) ? t : undefined),
  continent: (t) => (ID.continent.test(t) ? t : undefined),
  npc: (t) => (ID.npc.test(t) ? t : undefined),
  dragon: (t) => (/^\d+$/.test(t) ? Number(t) : undefined),
  event: (t) => (ID.event.test(t) ? t : undefined),
};

/** Resolvers that read names from the data and the state of a game. */
export function refOf(game: Game, data: GameData): TargetRef {
  const L = labels(data);
  const inverse = (m: Map<string, string>) => {
    const o = new Map<string, string>();
    for (const [id, n] of m) if (!o.has(n)) o.set(n, id);
    return o;
  };
  const byName = (m: Map<string, string>, t: string) => m.get(t) ?? [...m].find(([, n]) => n.includes(t))?.[0];
  const countries = inverse(L.kind.country);
  // the log calls a country by its title (`สาธารณรัฐวิศวกร`) and the map by its name (`ดอร์ไซต์`): either is a target (M4 review M5)
  for (const c of (data.countries?.items as { id: string; name?: string; title?: string }[] | undefined) ?? []) {
    for (const n of [c.name, c.title]) if (n && !countries.has(n)) countries.set(n, c.id);
  }
  const npcs = inverse(L.npc);
  const continents = new Map<string, string>(((data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? []).map((c) => [c.name, c.id]));
  const ctx = game.ctx;
  // the people `npcs` lists carry names the roster does not (a holder is named by the text system): a player types what `npcs` shows
  const seen = (): Map<string, string> => {
    const out = new Map(npcs);
    const life = game.state.life;
    if (life) for (const v of npcsAt(ctx, life.country)) out.set(v.name, v.id);
    return out;
  };
  const dragons = () => game.state.world.dragons.map((d, i) => ({ i, id: d.id }));
  return {
    country: (t) => ID_REF.country(t) ?? byName(countries, t),
    continent: (t) => ID_REF.continent(t) ?? continents.get(t),
    // a person of the roster the character stands among, else an ally of his (his name, his tie id or the id of the position he stands for): `whisper ช่วย <ally>`
    npc: (t) => ID_REF.npc(t) ?? byName(seen(), t) ?? findAlly(ctx, t)?.id,
    dragon: (t) => {
      // a whole name first; a part of a name only when exactly one dragon has it (a syllable must not pick the first dragon it finds, review M2 L8)
      const all = dragons();
      const exact = all.find((d) => d.id === t);
      if (exact) return exact.i;
      const part = all.filter((d) => d.id.includes(t));
      if (part.length === 1) return part[0].i;
      return part.length ? undefined : ID_REF.dragon(t);
    },
    event: (t) => fateTargets(ctx).find((x) => x.id === t || x.name === t)?.id ?? ID_REF.event(t),
    near: (what, t) => {
      if (!t) return [];
      const names =
        what === 'country' ? [...countries.keys()] : what === 'npc' ? [...seen().keys()] : what === 'dragon' ? dragons().map((d) => d.id) : fateTargets(ctx).map((x) => x.name);
      return names.filter((n) => n.includes(t)).slice(0, 5);
    },
  };
}

type Parsed = { action: GodAction; args: Record<string, unknown> } | { error: string };

/** What kind of target each miracle names (04-miracles.md §3); a miracle that is not here takes no target. */
export const MIRACLE_TARGET: Record<string, 'country' | 'countries' | 'continent' | 'npc' | 'dragon'> = {
  'MR-01': 'country', 'MR-02': 'country', 'MR-03': 'country', 'MR-04': 'country', 'MR-05': 'countries', 'MR-06': 'npc', 'MR-07': 'country', 'MR-08': 'country',
  'MR-09': 'continent', 'MR-10': 'country', 'MR-11': 'country', 'MR-12': 'country', 'MR-13': 'country', 'MR-14': 'country', 'MR-15': 'country', 'MR-16': 'country',
  'MR-17': 'country', 'MR-18': 'country', 'MR-19': 'country', 'MR-20': 'country', 'MR-22': 'continent', 'MR-23': 'dragon', 'MR-24': 'dragon',
};

export const NEEDS: Record<string, 'place' | 'npc'> = { จงไป: 'place', คนนั้นโกหก: 'npc', ช่วย: 'npc', ชี้ทายาท: 'npc' };

/** Turns the words of a line into an action and its arguments, or says how to type it. */
export function parseGod(word: string, rest: string[], ref: TargetRef = ID_REF): Parsed | { meta: Meta } {
  const kind = WORDS[word.toLowerCase()];
  if (kind === 'power' || kind === 'options' || kind === 'yes' || kind === 'no') return { meta: kind };
  const usage = (a: GodAction) => ({ error: `ใช้: ${USAGE[a]}` });
  const unknown = (what: string, t: string, key?: 'country' | 'npc' | 'dragon' | 'event') => {
    const near = key ? ref.near?.(key, t) ?? [] : [];
    const shown = t.length > 30 ? `${t.slice(0, 28)}…` : t;
    if (near.length > 1) return { error: `"${shown}" เป็นชื่อ${what}ได้หลายแห่ง: ${near.join(' · ')} (พิมพ์ให้ยาวขึ้นอีกหน่อย)` };
    return { error: `ไม่รู้จัก${what} "${shown}" (พิมพ์ชื่อให้ตรง หรือใช้รหัสที่ options บอก)` };
  };
  switch (kind) {
    case 'chest.open':
    case 'chest.skip':
      return { action: kind, args: {} };
    case 'chest.reroll': {
      const n = int(rest.find((x) => /^\d+$/.test(x)));
      return { action: kind, args: n === undefined ? {} : { lock: n } };
    }
    case 'chest.pick': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { slot: n } };
    }
    case 'dream.send': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { path: n } };
    }
    case 'vow.pick': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { pick: n } };
    }
    case 'whisper': {
      if (!rest.length) return usage(kind);
      const hint = rest[0];
      const text = rest.slice(1).join(' ');
      const need = NEEDS[hint];
      if (!text) {
        // a hint that points needs the one it points at: the way to name it is told here, not "ต้องชี้เป้า" (review M2 #17)
        if (need === 'place') return { error: `คำใบ้ “${hint}” ต้องชี้ที่ — พิมพ์ชื่อประเทศหรือทวีป เช่น whisper ${hint} <ชื่อ> (ชื่อที่ options และ npcs ใช้อยู่)` };
        if (need === 'npc') return { error: `คำใบ้ “${hint}” ต้องชี้คน — พิมพ์ชื่อหรือรหัส NPC ตามที่ npcs บอก เช่น whisper ${hint} <ชื่อ>` };
        return { action: kind, args: { hint } };
      }
      if (need === 'place') {
        const id = ref.country(text) ?? ref.continent(text);
        return id ? { action: kind, args: { hint, target: id } } : unknown('ที่', text, 'country');
      }
      if (need === 'npc') {
        const id = ref.npc(text);
        return id ? { action: kind, args: { hint, target: id } } : unknown(' NPC', text, 'npc');
      }
      return { action: kind, args: { hint } };
    }
    case 'conjure':
      return parseConjure(rest, ref) ?? usage(kind);
    case 'prayer.answer': {
      if (rest.length < 2) return usage(kind);
      const n = int(rest[0]);
      if (n === undefined) return usage(kind);
      const answer = rest[1];
      const pick = int(rest[2]);
      return { action: kind, args: { id: n, answer, ...(pick !== undefined ? { option: pick - 1 } : {}) } };
    }
    case 'miracle': {
      const id = rest[0]?.toUpperCase();
      if (!id || !/^MR-\d{2}$/.test(id)) return usage(kind);
      const text = rest.slice(1).join(' ');
      if (id === 'MR-25') {
        const mul = mulOf(rest[rest.length - 1]);
        const ev = ref.event(rest.slice(1, -1).join(' '));
        if (!ev || !Number.isFinite(mul) || mul <= 0) return { error: 'ใช้: decree <เหตุการณ์> <ตัวคูณ> (ลิขิตเลือกเหตุการณ์ที่มีลางจาก options)' };
        return { action: 'decree', args: { event: ev, mul } };
      }
      if (!text) return { action: kind, args: { id } };
      switch (MIRACLE_TARGET[id]) {
        case 'country': {
          const c = ref.country(text);
          return c ? { action: kind, args: { id, country: c } } : unknown('ประเทศ', text, 'country');
        }
        case 'countries': {
          const list = text.split(/\s*(?:,|และ)\s*/).map((t) => ref.country(t));
          return list.every(Boolean) ? { action: kind, args: { id, countries: list } } : unknown('ประเทศ', text, 'country');
        }
        case 'continent': {
          const c = ref.continent(text);
          return c ? { action: kind, args: { id, continent: c } } : unknown('ทวีป', text);
        }
        case 'npc': {
          const n = ref.npc(text);
          return n ? { action: kind, args: { id, npc: n } } : unknown(' NPC', text, 'npc');
        }
        case 'dragon': {
          const d = ref.dragon(text);
          return d !== undefined ? { action: kind, args: { id, dragon: d } } : unknown('มังกร', text, 'dragon');
        }
        default:
          return { action: kind, args: { id } };
      }
    }
    case 'decree': {
      if (rest.length < 2) return usage(kind);
      const mul = mulOf(rest[rest.length - 1]);
      if (!Number.isFinite(mul) || mul <= 0) return usage(kind);
      const text = rest.slice(0, -1).join(' ');
      const ev = ref.event(text);
      return ev ? { action: kind, args: { event: ev, mul } } : unknown('เหตุการณ์', text, 'event');
    }
    case 'cancel': {
      const n = int(rest[0]);
      return n === undefined ? { error: 'ใช้: cancel N (ลางใบที่ N)' } : { action: 'miracle', args: { cancel: n } };
    }
    default:
      return { error: 'คำสั่งไม่รู้จัก' };
  }
}

// ---------- what waits for the god ----------

/** How many events with an omen the list shows (the rest are told as a count): the world has dozens. */
const FATE_SHOWN = 8;

const lineName = (pay: string) => LINE_NAME[pay as 'faith'] ?? 'พลัง';

/** What a card of the chest does, from the catalogue: the blessing and the curse say it, a skill says its effect, a weapon says whether it is holy or cursed (review M2 P6). */
export function cardEffect(data: GameData, slot: { kind: string; id: string; variant?: string }): string {
  const find = (file: string, key: string) => (data[file]?.items as { id: string; [k: string]: unknown }[] | undefined)?.find?.((x) => x.id === slot.id)?.[key];
  let text = '';
  if (slot.kind === 'bless') {
    text = str(find('blessings', 'desc'));
    // the blessing of a people is in the row of the race
    if (!text) for (const r of (data.races?.items as { races?: { blessings?: { id: string; text?: string }[] }[] } | undefined)?.races ?? []) text = text || str(r.blessings?.find((b) => b.id === slot.id)?.text);
  }
  else if (slot.kind === 'curse') text = str(find('curses', 'desc'));
  else if (slot.kind === 'skill') text = str(find('skills', 'effect'));
  else if (slot.kind === 'weapon') text = slot.variant === 'cursed' ? 'อาวุธต้องสาป จ่ายด้วยความหวาดกลัว' : slot.variant === 'holy' ? 'อาวุธศักดิ์สิทธิ์ จ่ายด้วยแสงศรัทธา' : '';
  return text ? scrub(data, text, { keepNumbers: true }) : '';
}

/** Chest, dream, prayers and omens that are waiting, as lines. Reads the state, changes nothing. */
export function waitingLines(game: Game, data: GameData): string[] {
  const ctx: Ctx = game.ctx;
  const st = game.state;
  const out: string[] = [];
  const life = st.life && !st.life.dead ? st.life : null;
  if (!life) return out;
  const nm = (id: unknown) => plainName(data, id);
  const cards = cardsOf(ctx);
  for (const c of cards) {
    const price = grantPrice(ctx, kindOf(ctx, c.kind)!);
    const left = Math.max(0, c.exp - (life.hAge * 4 + st.clock.quarter));
    const by = c.npc ? ` (ผู้ขอคือ ${nm(c.npc)})` : '';
    out.push(`คำอธิษฐานใบที่ ${c.n}: ${nameOfKind(ctx, c.kind)}${by} · เหลือเวลาราว ${(left / 4).toFixed(1)} ปี${c.silent ? ' · ท่านนิ่งอยู่' : ''}`);
    out.push(`    answer ${c.n} ให้ (แสงศรัทธา ${price}) · answer ${c.n} แปลก N (${strangeOptions(ctx, c).map((o, i) => `${i + 1} ${o.name}`).join(' · ') || 'ไม่มีของให้เลือก'}) · answer ${c.n} ปฏิเสธ · answer ${c.n} ลงโทษ · answer ${c.n} นิ่ง`);
  }
  const ch = currentChest(ctx);
  if (ch) {
    out.push(`หีบประทานที่เปิดอยู่ (pick N เลือก · reroll ทอยใหม่ · skip ข้าม):`);
    for (const s of ch.slots) {
      if (!s) continue;
      const why = s.why.map((w) => WHY_TH[w]).filter(Boolean).join(' · ');
      const does = cardEffect(data, s);
      out.push(`  ใบที่ ${s.slot}: ${CHEST_KIND_TH[s.kind] ?? 'ของ'} ${s.name} (ระดับ${TIER_TH[s.tier] ?? s.tier})${does ? ` — ${does}` : ''} · ${lineName(s.pay)} ${s.price} · ศรัทธาเทพของเขา ${s.belief > 0 ? '+' : ''}${s.belief}${why ? ` · ${why}` : ''}`);
    }
  }
  const offers = offerCards(ctx);
  if (offers.length) {
    out.push('ทางที่ฝันถึงได้ตอนนี้ (dream N):');
    offers.forEach((o, i) => out.push(`  ทางที่ ${i + 1}: ${sentence(data, o.label) || 'ทางที่เกมเสนอ'} · ภาพ${o.symbol} · ใจของเขา ${o.level}${o.reasons.length ? ` (${o.reasons.join(' · ')})` : ''} · ราคา ${o.free ? 'ฟรี' : `แสงศรัทธา ${o.price}`}`));
  }
  const pend = actsOf(st).pending;
  for (const p of pend) out.push(`ลางใบที่ ${p.n}: ${ctx.data.god ? plainName(data, p.id) || p.id : p.id} (cancel ${p.n} เพื่อยกเลิก)`);
  const fate = fateTargets(ctx);
  if (fate.length) out.push(`เหตุการณ์ของโลกที่มีลาง ลิขิตได้ (decree <ชื่อ> <×0.2–0.9 ชะลอ | ×1.1–3 เร่ง>): ${fate.slice(0, FATE_SHOWN).map((t) => t.name).join(' · ')}${fate.length > FATE_SHOWN ? ` · … และอีก ${fate.length - FATE_SHOWN} เรื่อง (พิมพ์ decree list เพื่อดูทั้งหมด)` : ''}`);
  return out;
}

/** All the events that can be decreed now (`decree list`): the short list of `options` stops at a few. */
export function fateLines(game: Game): string[] {
  const fate = fateTargets(game.ctx);
  if (!fate.length) return ['ตอนนี้ยังไม่มีเหตุการณ์ของโลกที่มีลางให้ลิขิต'];
  return [`เหตุการณ์ของโลกที่ลิขิตได้ตอนนี้ ${fate.length} เรื่อง (decree <ชื่อ> <×0.2–0.9 ชะลอ | ×1.1–3 เร่ง>):`, ...fate.map((t) => `  ${t.name}`)];
}

// ---------- the console ----------

export class GodConsole {
  pending: PendingGod | null;
  autoYes: boolean;
  dev: boolean;
  private readonly game: Game;
  private readonly data: GameData;

  constructor(o: GodConsoleOpts) {
    this.game = o.game;
    this.data = o.data;
    this.autoYes = !!o.autoYes;
    this.dev = !!o.dev;
    this.pending = o.pending ?? null;
  }

  /** Forget a command waiting for `yes` (the clock moved on, so the preview is old). Returns a line when there was one. */
  drop(): string[] {
    if (!this.pending) return [];
    const t = this.pending.title;
    this.pending = null;
    return [`(ยกเลิก ${t} ที่รอยืนยัน เพราะเวลาเดินต่อ)`];
  }

  /** Handles one line; undefined when the first word is not a command of the god. */
  handle(text: string): string[] | undefined {
    const [word, ...rest] = text.split(/\s+/).filter(Boolean);
    if (!isGodWord(word)) return undefined;
    // `decree` alone or `decree list`: every event that can be decreed now (the list in `options` is short)
    if (WORDS[word.toLowerCase()] === 'decree' && (!rest.length || ['list', 'รายการ', 'ทั้งหมด'].includes(rest[0]))) return fateLines(this.game);
    // `conjure` alone shows the circle · `vow` alone shows the vows on the table (the block at the end of this file)
    if (WORDS[word.toLowerCase()] === 'conjure' && !rest.length) return circleLines(this.game, this.data);
    if (WORDS[word.toLowerCase()] === 'vow.pick' && !rest.length) return vowTable(this.game);
    const p = parseGod(word, rest, refOf(this.game, this.data));
    if ('error' in p) return [p.error];
    if ('meta' in p) {
      switch (p.meta) {
        case 'power':
          return this.power();
        case 'options':
          return this.options();
        case 'no': {
          if (!this.pending) return ['ไม่มีคำสั่งที่รอยืนยัน'];
          const t = this.pending.title;
          this.pending = null;
          return [`ยกเลิก ${t} แล้ว`];
        }
        case 'yes': {
          if (!this.pending) return ['ไม่มีคำสั่งที่รอยืนยัน (พิมพ์คำสั่งพระเจ้าก่อน เช่น chest)'];
          const pend = this.pending;
          this.pending = null;
          return this.run(pend);
        }
      }
    }
    return this.preview(p.action, p.args);
  }

  private preview(action: GodAction, args: Record<string, unknown>): string[] {
    const title = `${TITLE[action]}${argText(action, args)}`;
    this.pending = null;
    if (!hasAction(action)) return [`${title}: ยังไม่มีพลังนี้`];
    const r = this.ask(action, args);
    if (!r.ok) return [`${title}: ทำไม่ได้ — ${r.reason}`];
    const out = [`-- ตัวอย่างผล: ${title} --`, ...previewLines(this.data, r.preview, this.dev, action, this.env(args))];
    if (!r.preview || out.length === 1) out.push('(ไม่มีรายละเอียดของผลที่คาด)');
    const pend: PendingGod = { action, args, title };
    if (this.autoYes) return [...out, ...this.run(pend)];
    this.pending = pend;
    out.push('พิมพ์ yes เพื่อทำจริง หรือ no เพื่อยกเลิก');
    return out;
  }

  /** Asks the core without confirming: it checks and answers the preview, and changes nothing. */
  private ask(action: GodAction, args: Record<string, unknown>): { ok: true; preview?: Record<string, unknown> } | { ok: false; reason: string } {
    try {
      const r = command(this.game.ctx, { type: 'god', action, args, confirm: false });
      return r.ok ? { ok: true, preview: r.preview } : { ok: false, reason: this.reason(r.reason, action) };
    } catch (err) {
      return { ok: false, reason: this.dev ? `ผิดพลาด: ${String((err as Error)?.message)}` : 'ใส่รายละเอียดไม่ครบหรือไม่ถูก (ดู help)' };
    }
  }

  /** A refusal of the core in words: the numbers stay (`ต้อง 30 มี 11`, `×0.2 ถึง ×0.9`) and so does what the player typed. */
  private reason(raw: string, action: GodAction): string {
    const t = reasonText(this.data, raw) || 'ไม่ได้ตอนนี้';
    // a hint that does not exist: the ones that do
    if (action === 'whisper' && /ไม่มีคำใบ้/.test(t)) return `${t} (คำใบ้ที่มี: ${this.hintNames().join(' · ')})`;
    return t;
  }

  private hintNames(): string[] {
    return ((this.game.ctx.data.god?.items as { dreams?: { whispers: { hint: string }[] } } | undefined)?.dreams?.whispers ?? []).map((x) => x.hint);
  }

  /** What a preview needs of the state: the curses he carries, the burden of his heart, the hazards of the country a miracle names. */
  private env(args: Record<string, unknown>): PreviewEnv {
    const st = this.game.state;
    const life = st.life && !st.life.dead ? st.life : undefined;
    const burden = (this.game.ctx.data.god?.items as { dreams?: { burden?: { at: number } } } | undefined)?.dreams?.burden;
    // a miracle with no country named falls on the country of the character
    const named = [args.country, ...(Array.isArray(args.countries) ? args.countries : [])].filter((x): x is string => typeof x === 'string');
    const ids = named.length ? named : typeof args.continent === 'string' ? countriesOf(this.game.ctx, args.continent) : life && args.id ? [life.country] : [];
    return {
      curses: life ? life.curses.map((c) => plainName(this.data, c)).filter(Boolean) : [],
      heart: life?.heart,
      burdenAt: burden?.at,
      ...(ids.length ? { flags: Object.fromEntries(ids.map((c) => [c, st.world.countryFlags[c] ?? []])) } : {}),
    };
  }

  /** The whisper hints that need no one to point at and can be said now, the ones that cannot (with the reason), and the ones that point. */
  private whispers(): { ok: string[]; blocked: [string, string][]; points: string[] } {
    const ok: string[] = [];
    const blocked: [string, string][] = [];
    const points: string[] = [];
    for (const h of this.hintNames()) {
      if (NEEDS[h]) {
        points.push(h);
        continue;
      }
      const r = this.ask('whisper', { hint: h });
      if (r.ok) ok.push(h);
      else blocked.push([h, r.reason]);
    }
    return { ok, blocked, points };
  }

  private run(p: PendingGod): string[] {
    if (!hasAction(p.action)) return [`${p.title}: ยังไม่มีพลังนี้`];
    const st = this.game.state;
    const mark = st.logN;
    const before = { light: st.god.light, dread: st.god.dread };
    const r = command(this.game.ctx, { type: 'god', action: p.action, args: p.args, confirm: true });
    if (!r.ok) return [`${p.title}: ทำไม่ได้ — ${this.reason(r.reason, p.action)}`];
    const out = [`-- ทำแล้ว: ${p.title} --`];
    const ls = timeline(this.data, st.log, 1, { fromN: mark, notes: toolNotes(st) });
    out.push(...(ls.length ? ls : ['(ไม่มีบรรทัดบันทึกใหม่)']));
    const moved: string[] = [];
    if (st.god.light !== before.light) moved.push(`แสงศรัทธา ${round(before.light)} → ${round(st.god.light)}`);
    if (st.god.dread !== before.dread) moved.push(`ความหวาดกลัว ${round(before.dread)} → ${round(st.god.dread)}`);
    if (moved.length) out.push(moved.join(' · '));
    // a chest just opened is not yet a choice: the cards are what the player has to read
    if (p.action === 'chest.open' || p.action === 'chest.reroll') out.push(...waitingLines(this.game, this.data).filter((l) => l.startsWith('หีบ') || l.startsWith('  ใบที่')));
    return out;
  }

  power(): string[] {
    const st = this.game.state;
    const g = st.god;
    const ctx = this.game.ctx;
    const out = ['-- พลังของพระเจ้า --', `แสงศรัทธา ${round(g.light)} · ความหวาดกลัว ${round(g.dread)}`];
    if (st.life) out.push(`ศรัทธาเทพของ${st.life.name} ${st.life.godFaith} · ภาระใจ ${st.life.heart}`);
    if (st.life && !st.life.dead && ctx.data.god) {
      const caps = (ctx.data.god.items as { caps: { chestPerYear: number; dreamPerYear: number; whisperPerYear: number } }).caps;
      const c = g.counters;
      out.push(`ปีนี้: หีบ ${c['y.chest'] ?? 0}/${chestLimit(ctx)} · ฝัน ${c['y.dream'] ?? 0}/${caps.dreamPerYear}${inWindow(ctx) ? ' · อยู่ในหน้าต่างพระเจ้า (ราคาลด ×0.7 ตลอดปีชีวิตนี้ ปิดเมื่อขึ้นปีใหม่)' : ''}`);
      out.push(`ชีวิตนี้: ประทานแล้ว ${c['l.pick'] ?? 0} · ส่งฝัน ${c['l.dream'] ?? 0} (ทำตาม ${c['l.dream.obeyed'] ?? 0}) · ใช้พลังไปแล้ว แสงศรัทธา ${c['l.spent.faith'] ?? 0} ความหวาดกลัว ${c['l.spent.dread'] ?? 0}`);
    }
    // the light and the fear pass to the heir at a half when a life ends (01-power.md): the number after a death is what the next life starts with
    if (st.life?.dead) out.push('(ชีวิตนี้จบแล้ว: พลังที่แสดงคือส่วนที่ส่งต่อให้ผู้สืบทอด ซึ่งเหลือครึ่งหนึ่งของที่มีตอนตาย)');
    const cd = Object.entries(g.cooldowns).filter(([k, v]) => /^MR-\d{2}$/.test(k) && v > st.clock.worldYear);
    if (cd.length) out.push(`ปาฏิหาริย์ที่ยังรอ: ${cd.map(([k, v]) => `${k} อีก ${Math.ceil(v - st.clock.worldYear)} ปีโลก`).join(' · ')}`);
    const ms = this.miracleList();
    if (ms.length) out.push(`ปาฏิหาริย์ที่เปิดใช้: ${ms.join(' · ')}`);
    return out;
  }

  /** The miracles that exist in this build, with their price: `MR-01 ฝนต้องฤดู (แสงศรัทธา 15)`. */
  private miracleList(): string[] {
    const ctx = this.game.ctx;
    const list = (ctx.data.god?.items as { miracles?: { list: { id: string; name: string; cost: { faith?: number; dread?: number } }[] } } | undefined)?.miracles?.list ?? [];
    const impl = new Set(implementedMiracles());
    return list.filter((m) => impl.has(m.id) && m.id !== 'MR-25').map((m) => `${m.id} ${m.name} (${costWords(m.cost) ?? 'ทุกแสงศรัทธาที่มี'})`);
  }

  options(): string[] {
    const ctx = this.game.ctx;
    const st = this.game.state;
    const out = ['-- สิ่งที่ทำได้ตอนนี้ --'];
    if (!st.life || st.life.dead) {
      out.push('ชีวิตนี้จบแล้ว ไม่มีสิ่งใดให้ทำ (ใช้ --new เพื่อเริ่มโลกใหม่ด้วยเมล็ดเดิม)');
      return out;
    }
    if (ctx.data.god && inWindow(ctx)) out.push('หน้าต่างพระเจ้าเปิดอยู่ตลอดปีชีวิตนี้ (ราคาของหลายอย่างลด ×0.7) ปิดเมื่อขึ้นปีชีวิตใหม่');
    const cards = cardsOf(ctx);
    const probes: Partial<Record<GodAction, { args: Record<string, unknown>; missing?: string }>> = {
      'chest.pick': { args: { slot: 1 } },
      'dream.send': { args: { path: 1 }, missing: offerCards(ctx).length ? undefined : 'ตอนนี้ไม่มีทางแยกให้ฝันถึง' },
      'prayer.answer': { args: cards.length ? { id: cards[0].n, answer: 'ให้' } : {}, missing: cards.length ? undefined : 'ไม่มีคำอธิษฐานที่รออยู่' },
      miracle: { args: { id: 'MR-21' } },
      decree: { args: { event: fateTargets(ctx)[0]?.id ?? '', mul: 0.5 }, missing: fateTargets(ctx).length ? undefined : 'ยังไม่มีเหตุการณ์ที่มีลางให้ลิขิต' },
    };
    for (const a of ORDER) {
      const head = `  ${USAGE[a]} (${TITLE[a]})`;
      if (!hasAction(a)) {
        out.push(`${head} — ยังไม่มีพลังนี้`);
        continue;
      }
      const probe = probes[a];
      if (probe?.missing) {
        out.push(`${head} — ยังทำไม่ได้: ${probe.missing}`);
        continue;
      }
      if (a === 'chest.pick' && currentChest(ctx)) {
        out.push(`${head} — ทำได้ (ดูใบในหีบด้านล่าง)`);
        continue;
      }
      if (a === 'miracle') {
        out.push(`${head} — ทำได้ตามเงื่อนไขของแต่ละแบบ (รายการและราคาอยู่ใน power)`);
        continue;
      }
      if (a === 'conjure' || a === 'vow.pick') {
        out.push(`${head} — ${a === 'conjure' ? conjureOption(this.game) : vowOption(this.game)}`);
        continue;
      }
      if (a === 'whisper') {
        // every hint is tried (a hint said this year cannot be said again, but the others can): the line says which, not just one of them
        const w = this.whispers();
        const first = w.ok.length ? this.ask('whisper', { hint: w.ok[0] }) : undefined;
        const price = first?.ok ? costText(first.preview) : undefined;
        if (w.ok.length || w.points.length) out.push(`${head} — ทำได้${price ? ` · ราคา ${price}` : ''}`);
        else out.push(`${head} — ยังทำไม่ได้: ${w.blocked[0]?.[1] ?? 'ไม่มีคำใบ้'}`);
        if (w.ok.length) out.push(`      ใช้ได้ตอนนี้: ${w.ok.join(' · ')}`);
        if (w.blocked.length) out.push(`      ใช้ไม่ได้: ${w.blocked.map(([h, why]) => `${h} (${why})`).join(' · ')}`);
        if (w.points.length) out.push(`      ต้องชี้เป้าด้วย: ${w.points.map((h) => `${h} ${NEEDS[h] === 'place' ? '<ที่>' : '<NPC>'}`).join(' · ')}`);
        continue;
      }
      if (a === 'decree') {
        const fee = (this.game.ctx.data.god?.items as { miracles?: { list: { id: string; cost: { fate?: Record<string, number> } }[] } } | undefined)?.miracles?.list.find((m) => m.id === 'MR-25')?.cost.fate;
        const range = fee ? `${Math.min(...Object.values(fee))} ถึง ${Math.max(...Object.values(fee))}` : '';
        out.push(`${head} — ทำได้${range ? ` · ราคา ${range} ตามขนาดของเหตุการณ์ (ชะลอจ่ายแสงศรัทธา เร่งจ่ายความหวาดกลัว) ราคาจริงอยู่ในตัวอย่างผล` : ''}`);
        continue;
      }
      const r = this.ask(a, probe?.args ?? {});
      if (r.ok) {
        const c = a === 'chest.open' || a === 'chest.reroll' ? costText(r.preview) : costText(r.preview);
        out.push(`${head} — ทำได้${c ? ` · ราคา ${c}` : ''}`);
      } else out.push(`${head} — ยังทำไม่ได้: ${r.reason}`);
    }
    const w = waitingLines(this.game, this.data);
    if (w.length) out.push('', '-- ที่รออยู่ --', ...w);
    if (st.life && !st.life.dead) {
      const hints = ((ctx.data.god?.items as { dreams?: { whispers: { hint: string }[] } } | undefined)?.dreams?.whispers ?? []).map((x) => x.hint);
      if (hints.length) out.push('', `คำใบ้กระซิบ: ${hints.map((h) => `${h}${NEEDS[h] === 'place' ? ' <ที่>' : NEEDS[h] === 'npc' ? ' <NPC>' : ''}`).join(' · ')}`);
    }
    return out;
  }

  /** The names of what can be done now, for the line after a call of the game. Empty when no power exists. */
  doableNow(): string[] {
    const ctx = this.game.ctx;
    const names: string[] = [];
    const life = this.game.state.life;
    // once the life has ended nothing can be done to it (review M2 #16)
    if (!life || life.dead) return names;
    const cards = cardsOf(ctx);
    const test: [GodAction, string, Record<string, unknown>, boolean][] = [
      ['chest.open', 'chest', {}, true],
      ['chest.pick', 'pick', { slot: 1 }, !!currentChest(ctx)],
      ['dream.send', 'dream', { path: 1 }, offerCards(ctx).length > 0],
      ['whisper', 'whisper', {}, true],
      ['prayer.answer', 'answer', cards.length ? { id: cards[0].n, answer: 'ให้' } : {}, cards.length > 0],
      ['decree', 'decree', {}, fateTargets(ctx).length > 0],
    ];
    for (const [a, name, args, want] of test) {
      if (!want || !hasAction(a)) continue;
      if (a === 'whisper') {
        const w = this.whispers();
        if (w.ok.length || w.points.length) names.push(name);
      } else if (a === 'decree' || a === 'chest.pick' || this.ask(a, args).ok) names.push(name);
    }
    if (hasAction('miracle')) names.push('miracle');
    return names;
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

