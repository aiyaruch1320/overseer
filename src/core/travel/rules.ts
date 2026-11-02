// The numbers of the travel domain that conditions compare and effects change (src/core/README.md "กติกาของระบบ"):
//   travel.continents  how many continents the character has stood in (the birth continent counts)  · `จำนวนทวีป`
//   travel.countries   how many countries other than the birth country  · "เดินทางครบ 1 ประเทศ" (the mercenary line)
//   travel.level       the level reached, 0 L0 · 1 L1 · 2 L2
//   travel.legs        legs walked  ·  travel.trips  trips made
//   trust.local        trust toward the people of the place the character is in  ·  trust.foreignNpc  how many foreign peoples trust ≥ 3
// Other kinds of this domain already have an owner: `place` condition (world), the `place` effect (story, whose chosen ways this system follows:
// index.ts), `level` effect (story keeps the value; travel L0/L1/L2 is read here as `travel.level`).
import type { Ctx } from '../game';
import { extOf as charExt, trustOf } from '../character';
import { onStat } from '../rules';
import { geo, raceCode } from './data';
import { extOf, lifeOf } from './state';

let installed = false;

export function registerTravelRules(force = false): void {
  if (installed && !force) return;
  installed = true;
  const num = (f: (ctx: Ctx) => number) => ({ read: (ctx: Ctx) => f(ctx) });
  const mine = <T>(ctx: Ctx, f: (ex: ReturnType<typeof extOf>) => T, dflt: T): T => {
    const life = lifeOf(ctx) ?? ctx.state.life;
    return life ? f(extOf(life)) : dflt;
  };
  onStat('travel.continents', num((ctx) => mine(ctx, (e) => e.continents.length, 0)));
  onStat('travel.countries', num((ctx) => mine(ctx, (e) => e.visited.length, 0)));
  onStat('travel.level', num((ctx) => mine(ctx, (e) => e.level, 0)));
  onStat('travel.legs', num((ctx) => mine(ctx, (e) => e.legs, 0)));
  onStat('travel.trips', num((ctx) => mine(ctx, (e) => e.trips, 0)));
  // "ไว้ใจผู้ในถิ่น" (§3.2): the trust toward the first people of the country the character is in
  onStat('trust.local', {
    read: (ctx) => {
      const life = ctx.state.life;
      const c = life ? geo(ctx).countries.get(life.country) : undefined;
      return life && c?.firstName ? trustOf(life, c.firstName) : 0;
    },
  });
  // "NPC ต่างถิ่นที่ไว้ใจ ≥ 3": the peoples other than the character's own that trust it at least 3
  onStat('trust.foreignNpc', {
    read: (ctx) => {
      const life = ctx.state.life;
      if (!life) return 0;
      const own = geo(ctx).peopleName.get(raceCode(ctx, life.race));
      return Object.entries(charExt(life).trust).filter(([who, v]) => v >= 3 && who !== '*' && who !== own).length;
    },
  });
}

registerTravelRules();
