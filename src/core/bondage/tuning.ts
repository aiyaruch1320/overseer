// Numbers the bondage system needs that docs/systems/economy/10-bondage.md does not state exactly (code-plan §2 rule 3).
// "assumption" = the docs are silent. The stances, shares, prices, gratitude and ally chances come from data/gen/bondage.json.

/** Chance per life year that a life falls into bondage by each route of 10-bondage.md §5 (assumptions; calibrated so that about 5% of lives are ever bound: the story sim's guess for the `bd` line). */
export const ENTRY = {
  /** Sold by the family: ages 12 to 19, class 1 or 2, in a country with W 1 or 2 where the stance allows it (§5 "ถูกขาย"). */
  sold: { age: [12, 19] as [number, number], perYear: 0.012, maxClass: 2, maxW: 2 },
  /** In debt: adults of class 1 or 2 with little gold (§5 "เป็นหนี้": pv.a1 way b). */
  debt: { age: [20, 55] as [number, number], perYear: 0.006, maxClass: 2, maxGold: 20 },
  /** Captured in a raid: a country at war, stances L M D (§5 "ถูกจับ"). */
  captured: { age: [15, 45] as [number, number], perYear: 0.004 },
  /** Sells himself (§5 "ขายตัวเอง"): the poor adult. */
  selfSale: { age: [20, 50] as [number, number], perYear: 0.001, maxGold: 5 },
  /** The court orders labour (§5 "ถูกศาลสั่ง"): a country of stances D L M H. */
  court: { age: [20, 55] as [number, number], perYear: 0.0008 },
};

/** Debt of a B1 life, in gold, at the start (10-bondage.md §7: 20 to 150). Paid down by 30 to 60% of the wage a year; the wage of a class-1 life is an assumption. */
export const WAGE_B1 = [10, 24] as [number, number];
/** Contract years of a B2 life (assumption: the docs say "ระยะยาว"; ×5 gold per remaining year in the price gives 30 to 150 gold for 6 to 30 years). */
export const CONTRACT_YEARS: [number, number] = [6, 24];
/** Chance a year that a B3 owner dies with no heir (10-bondage.md §6 "ตายพันธะ", assumption) and that an owner lets a person go (§6 "ถูกปล่อย", assumption). */
export const OWNER_DIES = 0.012;
export const RELEASED = 0.015;
/** Gold the character saves a year as a bound person at W 3: the data has 2 to 14; the draw is uniform in that range scaled by the income index of the country. */

/** Chance that an attempt to cross the border to a stance-A country succeeds: a country of stance A on the same continent / only on another (assumption; §6 "หนีข้ามแดน"). */
export const FLEE = { near: 0.7, far: 0.4, chaseBack: 0.7 };

/** Opening the `bo` and `ab` lines (27-bondage.md §2, rates per life year inside the node ages; assumption, calibrated to the sim's guesses 4% and 12% of lives). */
export const OPEN = {
  bo: { age: [26, 44] as [number, number], perYear: 0.03, minGold: 30, minClass: 3 },
  ab: { age: [22, 46] as [number, number], perYear: 0.005 },
};

/** Share of the persons the character holds who are skilled enough to cost B3 prices (skill 1 to 6, uniform: §7). */
export const SKILL: [number, number] = [1, 6];

/** Extra income of a held person's work: the node says +10% for good treatment, +5% when strained; capped by the role table (+15%). */
export const HOLD_INCOME = { good: 10, strained: 5, cap: 15 };

/** Sale of a held person to another buyer: the margin over the price (assumption; the node says "ทอง +ส่วนต่าง"). */
export const SALE_MARGIN: [number, number] = [0.15, 0.5];

/**
 * The ways of the nodes of bd that suit one state of the life and not the other (M3 review B2; 27-bondage.md §3): the `label` is a part of the label of the way, the
 * factor is by the state (`bound` now, `free` now, `born` bound, `left` as a child). The weights of the table are kept; a factor of 0 shuts a way.
 */
export interface WayState {
  bound: boolean;
  free: boolean;
  born: boolean;
  left: boolean;
}
export const BD_WAYS: Record<string, { label: string; mul: (s: WayState) => number }[]> = {
  // a life bound from the start is not taken in by a kind stranger without a contract (that is the way of the one who is B0); the way says which of the two he is
  'bd.b1': [
    { label: 'ไม่ผูกสัญญา', mul: (s) => (s.bound ? 0 : 1) },
    { label: 'ครอบครัวผู้รับใช้', mul: (s) => (s.left ? 0.1 : 1) },
    { label: 'ถูกทิ้งหน้าวัด', mul: (s) => (s.left ? 1 : 0.1) },
  ],
  // the elders: "ยังไม่พ้นพันธะ ตายในสัญญา" is the way of one who is still bound, "ไถ่ผู้อื่นด้วยทรัพย์ที่เหลือ" of one who has the means and his freedom
  'bd.e1': [
    { label: 'ยังไม่พ้นพันธะ', mul: (s) => (s.bound ? 6 : 0) },
    { label: 'ไถ่ผู้อื่น', mul: (s) => (s.bound ? 0 : 1) },
  ],
};

/** Years a bound person has been held before he buys his freedom without having decided to at bd.a2 (assumption; bd.a2 way a says "ใช้เวลาหลายปี"). */
export const RANSOM_AFTER_YEARS = 4;
