// The large and grand miracles (04-miracles.md §3): MR-17 ดาวตก · MR-18 แผ่นดินกลืนเมือง · MR-19 น้ำท่วมใหญ่ · MR-20 ยกแผ่นดินใหม่ · MR-22 พระพิโรธ
// (MR-21 is in acts/set.ts). The price, the wait and the caps are the table's and the command layer's (acts/miracles.ts); the seal layer (seal.ts) answers
// a destroying miracle that falls on a seal before the handler here is asked. Rolls draw from `god.ruin`; checks and previews roll nothing.
import type { Ctx } from '../../game';
import { weighEvent } from '../../world';
import { clearFlag, addMod, faithAt, setFlag } from '../acts/mods';
import { registerMiracle, countryArg, type Handler, type Outcome } from '../acts/miracles';
import { continentOf, countriesOf, countryName, godOf, hasCountry, hasFlag, lifeCountry } from '../acts/geo';
import { lifeKey, livingOf, yearOf } from '../acts/state';
import { addIncomeAdjust } from '../power';
import { geoOf } from '../../world/place';
import { landName } from './names';
import { noteBig } from './gd08';
import { acceptors } from './people';
import { cultsNow } from './events';
import { kinNotes } from './kin';
import { makeRuin, ruinFacts } from './ruin';
import { sealAt, sealCountries, wrathOnSeals } from './seal';
import { ruinExt, viewRuin, type LandRec, type RuinKind } from './state';
import { CULT_DREAD, FLOOD_REFUGE_YEARS, STREAM } from './tuning';

const ctry = (ctx: Ctx, args: Record<string, unknown>): string | undefined => countryArg(ctx, args) ?? lifeCountry(ctx);
const need = (ctx: Ctx, args: Record<string, unknown>): string | null => {
  const c = ctry(ctx, args);
  return c ? (hasCountry(ctx, c) ? null : `ไม่มีประเทศ ${c}`) : 'ไม่ระบุประเทศ';
};
const wordsOf = (ctx: Ctx, c: string): string => countryName(ctx, c);

// ---------- MR-17 · MR-18: the ruin ----------

const BIG_BACK = (ctx: Ctx): number => godOf(ctx).miracles.ruin.numbers.dread;

function ruinHandler(kind: RuinKind): Handler {
  return {
    line: 'destroy',
    // a large miracle that falls on a seal makes no ruin: it does not use the ruin of the life, nor the hundred years between ruins
    makesRuin: (ctx, _m, args) => {
      const c = ctry(ctx, args);
      return !(c && sealAt(ctx, c));
    },
    back: (ctx, m, args, cost) => {
      const c = ctry(ctx, args);
      return c && sealAt(ctx, c) ? Math.round((cost.dread ?? m.cost.dread ?? 0) / 3) : BIG_BACK(ctx);
    },
    check: (ctx, _m, args) => {
      const no = need(ctx, args);
      if (no) return no;
      const c = ctry(ctx, args)!;
      if (hasFlag(ctx, c, 'god_ruin')) return `${wordsOf(ctx, c)}เป็นซากพระเจ้าอยู่แล้ว`;
      if (hasFlag(ctx, c, 'fallen')) return `${wordsOf(ctx, c)}เป็นซากของมหาล่มสลายอยู่แล้ว`;
      return null;
    },
    preview: (ctx, m, args) => {
      const c = ctry(ctx, args)!;
      const f = ruinFacts(ctx, c, kind);
      const npcs = f.npcs as { here: number; die: number; flee: number; stay: number };
      const n = godOf(ctx).miracles.ruin.numbers;
      const notes = sealAt(ctx, c)
        ? []
        : [
            `เมืองหลักหายจากแผนที่ ประเทศกลายเป็นซาก ผู้คนเหลือ ${n.pop[0]}–${n.pop[1]}% ของเดิม`,
            `NPC ในประเทศ ${npcs.here} คน แต่ละคนทอย: ตาย ${npcs.die}% · หนี ${npcs.flee}% · อยู่เป็นผู้นำซาก ${npcs.stay}% (ผู้นำที่รอดอยู่เสมอ)`,
            ...kinNotes(ctx, c, n.allyDie),
            `เหตุการณ์ที่ยึดกับประเทศนี้ปิด ${(f.closes as string[]).length} เรื่อง${(f.closes as string[]).length ? ` (${(f.closes as string[]).join(' · ')})` : ''} และเหตุการณ์ท้องถิ่น ${f.localCloses} เรื่อง`,
            `ศรัทธาตรงของประเทศข้างเคียง ${n.neighbourFaith} · ท่านได้ความหวาดกลัวคืน ${BIG_BACK(ctx)}`,
            kind === 'MR-18' ? 'หลุมจะกลายเป็นทะเลสาบ นักดำน้ำมาแทนนักขุดซาก' : 'ดาวตกทิ้งเหล็กดาวในหลุม',
            'ผู้ลี้ภัย นักขุดซาก ลัทธิ และผู้แค้นฟ้าจะตามมาภายในสิบปี เมืองใหม่ราว 40–80 ปีหลัง',
          ];
      return { target: c, targetName: countryName(ctx, c), flags: ctx.state.world.countryFlags[c] ?? [], ruin: f, notes, sealed: !!sealAt(ctx, c) };
    },
    run: (ctx, m, args): Outcome => {
      const c = ctry(ctx, args)!;
      const rec = makeRuin(ctx, c, kind);
      noteBig(ctx, 1, c);
      return {
        target: c,
        result: kind === 'MR-17' ? `ดาวตกกลางเมือง กลายเป็น${rec.label} ผู้คนเหลือ ${Math.round(rec.pop * 100)}%` : `เมืองจมลงดิน กลายเป็น${rec.label} ผู้คนเหลือ ${Math.round(rec.pop * 100)}%`,
        country: c,
        back: BIG_BACK(ctx),
      };
    },
  };
}
registerMiracle('MR-17', ruinHandler('MR-17'));
registerMiracle('MR-18', ruinHandler('MR-18'));

// ---------- MR-19: the great flood ----------

registerMiracle('MR-19', {
  line: 'destroy',
  back: (ctx, m, args, cost) => {
    const c = ctry(ctx, args);
    return c && sealAt(ctx, c) ? Math.round((cost.dread ?? m.cost.dread ?? 0) / 3) : BIG_BACK(ctx);
  },
  check: (ctx, _m, args) => {
    const no = need(ctx, args);
    if (no) return no;
    const c = ctry(ctx, args)!;
    const g = geoOf(ctx, c);
    if (!g?.coast && !g?.river) return `${wordsOf(ctx, c)}ไม่ติดทะเลและไม่อยู่ริมแม่น้ำ น้ำท่วมใหญ่ไม่ตกที่นั่น`;
    if (hasFlag(ctx, c, 'god_ruin')) return `${wordsOf(ctx, c)}เป็นซากอยู่แล้ว`;
    if (hasFlag(ctx, c, 'flood')) return `${wordsOf(ctx, c)}น้ำท่วมอยู่แล้ว`;
    return null;
  },
  preview: (ctx, m, args) => {
    const c = ctry(ctx, args)!;
    const fl = godOf(ctx).miracles.grand.flood;
    const acc = acceptors(ctx, c);
    return {
      target: c,
      targetName: countryName(ctx, c),
      flags: ctx.state.world.countryFlags[c] ?? [],
      notes: [
        `น้ำท่วม ${fl.years} ปี W ของประเทศนี้ −2 ห้าปี ไม่เป็นซาก`,
        `ผู้ลี้ภัยไป ${acc.length ? acc.map((x) => countryName(ctx, x)).join(' · ') : 'ไม่มีประเทศข้างเคียงรับ'} อาหารที่นั่น ×${fl.refugeeFood}`,
        `ท่านได้ความหวาดกลัวคืน ${sealAt(ctx, c) ? Math.round((m.cost.dread ?? 0) / 3) : BIG_BACK(ctx)}`,
      ],
    };
  },
  run: (ctx, m, args): Outcome => {
    const c = ctry(ctx, args)!;
    const fl = godOf(ctx).miracles.grand.flood;
    const w = m.wDeltas[0];
    setFlag(ctx, c, 'flood', fl.years);
    addMod(ctx, { subject: 'W', country: c, add: w?.delta ?? -2, years: w?.years ?? 5, src: 'MR-19' });
    for (const to of acceptors(ctx, c)) addMod(ctx, { subject: 'food', country: to, mul: fl.refugeeFood, years: FLOOD_REFUGE_YEARS, src: 'MR-19' });
    noteBig(ctx, 1, c);
    return { target: c, result: `น้ำท่วมใหญ่ ${fl.years} ปี`, country: c, back: BIG_BACK(ctx) };
  },
});

// ---------- MR-20: new land ----------

registerMiracle('MR-20', {
  line: 'create',
  check: (ctx, _m, args) => {
    const no = need(ctx, args);
    if (no) return no;
    const c = ctry(ctx, args)!;
    if (!geoOf(ctx, c)?.coast) return `${wordsOf(ctx, c)}ไม่ติดทะเล ยกแผ่นดินใหม่ไม่ได้`;
    if (viewRuin(ctx.state).lands.some((l) => l.beside === c && l.founded === undefined)) return 'ที่ดินใหม่ข้างประเทศนี้ยังรอผู้ตั้งรกรากอยู่';
    return null;
  },
  preview: (ctx, m, args) => {
    const c = ctry(ctx, args)!;
    const within = godOf(ctx).miracles.grand.land.settleWithin;
    return {
      target: c,
      targetName: countryName(ctx, c),
      notes: [`เกาะหรือแหลมใหม่โผล่จากทะเลข้าง${countryName(ctx, c)}`, `ผู้ตั้งรกรากมาภายใน ${within} ปี แล้วที่นั่นเป็นประเทศใหม่ W ${m.newCountryW ?? 2}`],
    };
  },
  run: (ctx, _m, args): Outcome => {
    const c = ctry(ctx, args)!;
    const e = ruinExt(ctx.state);
    const k = continentOf(c);
    const n = e.lands.length + 1;
    const id = `${k}-N${String(n).padStart(2, '0')}`;
    const name = landName(ctx, k, `land:${id}`);
    const land: LandRec = { id, beside: c, continent: k, name, year: yearOf(ctx), due: yearOf(ctx) + ctx.rng(STREAM).int(1, godOf(ctx).miracles.grand.land.settleWithin) };
    e.lands.push(land);
    return { target: c, result: `${name}โผล่จากทะเล`, country: c };
  },
});

// ---------- MR-22: the wrath ----------

const continentOfArgs = (ctx: Ctx, args: Record<string, unknown>): string | undefined => (args.continent === undefined ? (lifeCountry(ctx) ? continentOf(lifeCountry(ctx)!) : undefined) : String(args.continent));

registerMiracle('MR-22', {
  line: 'destroy',
  check: (ctx, _m, args) => {
    const k = continentOfArgs(ctx, args);
    return k && countriesOf(ctx, k).length ? null : 'ไม่มีทวีปนั้น';
  },
  preview: (ctx, _m, args) => {
    const k = continentOfArgs(ctx, args)!;
    const w = godOf(ctx).miracles.grand.wrath;
    const cs = countriesOf(ctx, k);
    const seals = cs.filter((c) => sealCountries(ctx).includes(c));
    return {
      target: k,
      notes: [
        `ฟ้ามืดเจ็ดวัน ธงสงครามหายทั้งทวีป ${w.warYears} ปี (${cs.filter((c) => hasFlag(ctx, c, 'war')).length} ประเทศมีสงครามอยู่)`,
        `ศรัทธาตรงทั้งทวีป ${w.faith} · ความหวาดกลัวรายปีของท่าน ×${w.dreadMul} ตลอดชีวิตที่เหลือ · เทพองค์อื่นตื่นง่ายขึ้น ×${w.gd08Mul}`,
        seals.length ? `หมุดผนึก ${seals.length} แห่งในทวีปรับผลระดับกลาง มังกรทุกตัวในทวีปอารมณ์ ${w.moodAll}` : 'ทวีปนี้ไม่มีหมุดผนึก',
        'ลัทธิผู้กลัวพระเจ้าเกิดขึ้น ผู้ล่าเทพได้ผู้ติดตามในทวีปนั้น',
      ],
    };
  },
  run: (ctx, _m, args): Outcome => {
    const k = continentOfArgs(ctx, args)!;
    const w = godOf(ctx).miracles.grand.wrath;
    const e = ruinExt(ctx.state);
    const y = yearOf(ctx);
    for (const c of countriesOf(ctx, k)) {
      clearFlag(ctx, c, 'war');
      faithAt(ctx, c, w.faith);
    }
    e.peace[k] = y + w.warYears;
    const life = livingOf(ctx);
    if (life) e.wrath = lifeKey(life);
    weighEvent(ctx, 'GD-08', { mul: w.gd08Mul });
    if (!e.followers.includes(k)) e.followers.push(k);
    wrathOnSeals(ctx, k);
    return { target: k, result: 'ฟ้ามืดเจ็ดวัน สงครามทั้งทวีปหยุดด้วยความกลัว', continent: k };
  },
});

// ---------- the dread of a year ----------

// the wrath doubles the yearly dread for the rest of the life that called it (MR-22) · each cult of a ruin brings a half (RU-04)
addIncomeAdjust((ctx, income) => {
  const life = livingOf(ctx);
  const e = ctx.state.god.ext.ruin as ReturnType<typeof ruinExt> | undefined;
  if (!life || !e) return;
  if (e.wrath === lifeKey(life)) income.dread *= godOf(ctx).miracles.grand.wrath.dreadMul;
  income.dread += CULT_DREAD * cultsNow(ctx);
});

