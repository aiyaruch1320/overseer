// The economy system (docs/systems/economy/, code-plan §7 row "economy"), steps P0 to P2 of 08-implementation.md:
//   P0 data: the countries (W G M, goods), the classes, the income and tax tables, read from data/gen/economy.json (data.ts)
//   P1 class and starting gold: the character system draws them at birth (character/birth.ts) from the same tables; `startGear` gives the tier of the first gear
//   P2 income, living, tax: each life year the life earns, pays and may fall into poverty; the class moves (year.ts)
//   the world: W of each country, the trust C and the prices change with the world events (world.ts, events.ts)
// Importing this module registers its rules (src/core/rules). The extras of a life live in `life.ext.economy`; the numbers of the world in `state.world.vars` (`eco.*`).
import type { System } from '../game';
import './rules';
import { registerEconomyRules } from './rules';
import { eco } from './data';
import { economyYear, startLife } from './year';
import { syncWorld } from './world';

registerEconomyRules();

export { eco, regimeOf, classNumber, GOODS, type CountryEco, type GoodId, type RegimeId, type MoneyUse } from './data';
export { eventEcon, type EventEcon, type WChange, type PriceShock } from './events';
export { wOf, priceOf, trust, trustMul, foodShock, syncWorld, syncEvents, writeCountry } from './world';
export { expectedYear, economyYear, startLife, addGold, payShare, type YearFigures } from './year';
export { grossIncome, livingCost, taxRate, moneyUse, placeOf, inheritanceTax } from './income';
export { extOf, type EconomyExt } from './state';
export { startGear, armourTier, type GearTier } from './gear';
export { registerEconomyRules, SKIPPED } from './rules';

export const economySystem: System = {
  name: 'economy',
  init(ctx) {
    if (!eco(ctx)) return;
    syncWorld(ctx);
  },
  worldStep(ctx) {
    if (!eco(ctx)) return;
    syncWorld(ctx);
  },
  birth(ctx) {
    startLife(ctx);
  },
  lifeYear(ctx) {
    economyYear(ctx);
  },
};
