// The titles of a life (08-goals.md §3 "ฉายาชีวิต"): at death the game sees what has covered the life and gives one to three titles, good and bad,
// the ones that may stack. A title belongs to the character; the titles of the god (01-power.md §7) belong to the player and are not here.
import type { Ctx } from '../../game';
import type { LifeState } from '../../types';
import { dreamsObeyed, dreamsRefused } from '../stats';
import { godData } from '../state';
import { charOf, classOf, fights, giftsReceived, storyOf, convergences, type Facts, factsOf } from './facts';
import { lifeGoals } from './state';

/** At most three titles on one life (08-goals.md §3 "หนึ่งถึงสามฉายา"). */
export const MAX_TITLES = 3;

/**
 * The order the titles are kept in when more than three hold: the rarer the covering, the earlier (assumption: the document says the titles stack
 * and gives no order; the rarest ones tell most about the life).
 */
export const PRIORITY = [
  'ผู้เป็นตำนาน', 'ผู้ฆ่าญาติ', 'ผู้ทรยศ', 'ผู้รอดจากฟ้า', 'ผู้รอฟ้า', 'ผู้ถูกเลือก', 'ผู้ขัดขืนฟ้า', 'ผู้ตกต่ำ', 'ผู้มั่งคั่ง', 'ผู้ถูกผูก', 'ผู้รบ', 'ผู้รักษา', 'ผู้ศรัทธา', 'นักเดินทาง', 'ผู้ไม่มีใครเห็น', 'ผู้อยู่ที่เดิม',
];

/** Numbers in the words of the table: "มากกว่า 30 ครั้ง" "มากกว่าห้าประเทศ" ... fixed here, checked against the data by a test. */
export const THRESH = { fights: 30, countries: 5, heal: 5, betray: 2, obey: 5, refuse: 5, gifts: 15, classShift: 2 };

interface Ctxd {
  ctx: Ctx;
  l: LifeState;
  f: Facts;
}

export const TEST: Record<string, (c: Ctxd) => boolean> = {
  ผู้ศรัทธา: ({ l }) => {
    const t = lifeGoals(l).track;
    return t.adult > 0 && t.years50 > t.adult / 2;
  },
  ผู้ไม่มีใครเห็น: ({ l, f }) => convergences(l).length === 0 && (charOf(l)?.fame ?? 0) <= 0 && (storyOf(l)?.seen.events.length ?? 0) === 0 && f.cv === 0,
  นักเดินทาง: ({ f }) => f.countries.length > THRESH.countries,
  ผู้อยู่ที่เดิม: ({ f }) => f.countries.length <= 1 && f.continents.length <= 1,
  ผู้รบ: ({ l }) => fights(l) > THRESH.fights,
  ผู้รักษา: ({ l }) => lifeGoals(l).track.heal > THRESH.heal,
  ผู้ฆ่าญาติ: ({ f }) => f.killedKin,
  ผู้ทรยศ: ({ f }) => f.betrayals > THRESH.betray,
  ผู้รอดจากฟ้า: ({ l }) => lifeGoals(l).track.skyBorn,
  ผู้ถูกเลือก: ({ ctx }) => dreamsObeyed(ctx) > THRESH.obey,
  ผู้ขัดขืนฟ้า: ({ ctx }) => dreamsRefused(ctx) > THRESH.refuse,
  ผู้รอฟ้า: ({ ctx }) => giftsReceived(ctx) > THRESH.gifts,
  ผู้มั่งคั่ง: ({ l }) => classOf(l) - lifeGoals(l).track.cls0 >= THRESH.classShift,
  ผู้ตกต่ำ: ({ l }) => lifeGoals(l).track.cls0 - classOf(l) >= THRESH.classShift,
  ผู้ถูกผูก: ({ l }) => {
    const t = lifeGoals(l).track;
    return t.adult > 0 && t.bound > t.adult / 2;
  },
  ผู้เป็นตำนาน: ({ f }) => f.secret || f.legend,
};

/** Every title that covers the life, in the order of the table of the data. */
export function titlesHeld(ctx: Ctx, l: LifeState, f: Facts = factsOf(ctx, l)): string[] {
  const rows = godData(ctx).goals.titles;
  return rows.filter((r) => TEST[r.title]?.({ ctx, l, f })).map((r) => r.title);
}

/** The titles the life gets: at most three, the rarer first, none that the table of rows cannot show. */
export function titlesOf(ctx: Ctx, l: LifeState, f?: Facts): string[] {
  const held = titlesHeld(ctx, l, f);
  const rank = (t: string) => {
    const i = PRIORITY.indexOf(t);
    return i < 0 ? PRIORITY.length : i;
  };
  return [...held].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_TITLES);
}
