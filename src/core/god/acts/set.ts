// The miracles of the first steps: small MR-01 to 08, mid MR-09 to 16, the dragon pair MR-23 and MR-24, and MR-21 (the only deed that
// opens GD-04). The table of 04-miracles.md §3 is in data/gen/god.json `miracles.list`; what each one does to the world is written here.
// The large miracles MR-17 to 20 and the wrath MR-22 join with `registerMiracle` in the step that makes ruins and seals.
import type { Ctx } from '../../game';
import { apply } from '../../rules';
import type { Miracle } from '../../data/types-god';
import type { CountryId } from '../../types';
import { addMood, holdEvent, moodCap, moodOf, tablesOf, weightOf } from '../../world';
import { fire } from '../../world/core';
import { applyEvent } from '../../world/events';
import { aliveNpc, killNpc, nameOf, slotOf } from './npcs';
import { registerMiracle, countryArg, type Handler, type Line, type Outcome } from './miracles';
import { clamp, continentOf, countriesOf, countryName, godOf, hasCountry, hasFlag, isDesert, lifeCountry } from './geo';
import { addMod, activeMods, clearFlag, faithAt, setFlag } from './mods';
import { actsOf, livingOf, yearOf } from './state';
import { DURATIONS, MR06_DEATH, MR08_RUIN } from './tuning';
import { npcIndex } from '../../npc/data';
import { findAlly } from '../../bonds';

const rng = (ctx: Ctx) => ctx.rng('god.miracle');

function country(ctx: Ctx, args: Record<string, unknown>): CountryId | undefined {
  return countryArg(ctx, args);
}
const needCountry = (ctx: Ctx, args: Record<string, unknown>): string | null => {
  const c = country(ctx, args);
  return c ? (hasCountry(ctx, c) ? null : `ไม่มีประเทศ ${c}`) : 'ไม่ระบุประเทศ';
};

interface Extra {
  check?(ctx: Ctx, c: CountryId, m: Miracle): string | null;
  preview?(ctx: Ctx, c: CountryId, m: Miracle): Record<string, unknown>;
}

/** A miracle that falls on one country. `run` changes the world and says in a few words what happened. */
function onCountry(line: Line, run: (ctx: Ctx, c: CountryId, m: Miracle) => string, extra: Extra = {}): Handler {
  return {
    line,
    check: (ctx, m, args) => needCountry(ctx, args) ?? extra.check?.(ctx, country(ctx, args)!, m) ?? null,
    preview: (ctx, m, args) => {
      const c = country(ctx, args)!;
      return { target: c, targetName: countryName(ctx, c), flags: ctx.state.world.countryFlags[c] ?? [], ...(extra.preview?.(ctx, c, m) ?? {}) };
    },
    run: (ctx, m, args): Outcome => {
      const c = country(ctx, args)!;
      return { target: c, result: run(ctx, c, m), country: c };
    },
  };
}

// ---------- small, create (gold) ----------

registerMiracle(
  'MR-01',
  onCountry('create', (ctx, c) => {
    clearFlag(ctx, c, 'famine');
    clearFlag(ctx, c, 'sandstorm');
    addMod(ctx, { subject: 'food', country: c, mul: 0.8, years: 2, src: 'MR-01' });
    return 'ฝนตกหนึ่งฤดู ภัยแล้งจบ';
  }),
);

registerMiracle(
  'MR-02',
  onCountry('create', (ctx, c) => {
    clearFlag(ctx, c, 'plague');
    addMod(ctx, { subject: 'medicine', country: c, mul: 0.7, years: 2, src: 'MR-02' });
    return 'ผู้ป่วยหาย โรคระบาดจบ';
  }),
);

registerMiracle(
  'MR-03',
  onCountry('create', (ctx, c) => {
    setFlag(ctx, c, 'golden', DURATIONS.golden);
    addMod(ctx, { subject: 'food', country: c, mul: 0.8, years: DURATIONS.food03, src: 'MR-03' });
    addMod(ctx, { subject: 'war-risk', country: c, add: 0.1, years: DURATIONS.war03, src: 'MR-03' }); // the neighbours envy
    return 'ข้าวออกรวงสองเท่า ยุคทองห้าปี';
  }),
);

registerMiracle(
  'MR-04',
  onCountry('create', (ctx, c) => {
    for (const f of ['undead_rising', 'ghoul_plague', 'demon_raid']) clearFlag(ctx, c, f);
    return 'แสงตกกลางเมืองหนึ่งคืน ผีและกูลหนีออก';
  }),
);

// MR-05 may name two countries at war with each other (`countries`)
registerMiracle('MR-05', {
  line: 'create',
  check: (ctx, _m, args) => {
    const list = truceList(ctx, args);
    if (!list.length) return 'ไม่ระบุประเทศ';
    const bad = list.find((c) => !hasCountry(ctx, c));
    if (bad) return `ไม่มีประเทศ ${bad}`;
    return list.some((c) => hasFlag(ctx, c, 'war')) ? null : 'ประเทศนั้นไม่ได้อยู่ในสงคราม';
  },
  preview: (ctx, _m, args) => ({ target: truceList(ctx, args).join(' '), countries: truceList(ctx, args).map((c) => ({ id: c, name: countryName(ctx, c), war: hasFlag(ctx, c, 'war') })) }),
  run: (ctx, _m, args) => {
    const list = truceList(ctx, args);
    const t = tablesOf(ctx);
    for (const c of list) {
      clearFlag(ctx, c, 'war');
      addMod(ctx, { subject: 'truce', country: c, add: 1, years: DURATIONS.truce, src: 'MR-05' });
    }
    // the wars the countries are a party to are weighed ×0.5 for ten years (04-miracles.md §3)
    for (const ev of t.rolled) {
      if (ev.group !== 'WR') continue;
      const party = ev.home.countries.some((x) => list.includes(x)) || (!ev.home.countries.length && ev.home.continents.some((x) => list.some((c) => continentOf(c) === x)));
      if (party) {
        // one weight, with the floor the fate has (04-miracles.md §4: 0.2 to 3): the truce on top of a fate halves what is there, and does not end the fate sooner
        const f = godOf(ctx).miracles.fate;
        const fate = actsOf(ctx.state).fates[ev.id];
        const until = Math.max(yearOf(ctx) + DURATIONS.warWeight, fate && fate.until > yearOf(ctx) ? fate.until : 0);
        holdEvent(ctx, ev.id, clamp(weightOf(ctx, ev.id) * 0.5, f.slowRange[0], f.fastRange[1]), until);
      }
    }
    return { target: list.join(' '), result: 'สงครามหยุดห้าปี', country: list[0] };
  },
});
const truceList = (ctx: Ctx, args: Record<string, unknown>): CountryId[] => {
  const raw = Array.isArray(args.countries) ? (args.countries as unknown[]).map(String) : country(ctx, args) ? [country(ctx, args)!] : [];
  return [...new Set(raw)].slice(0, 2);
};

// ---------- small, destroy (blood) ----------

// MR-06 the lightning: an NPC dies or is gravely hurt, never the main character, a dragon or a companion
registerMiracle('MR-06', {
  line: 'destroy',
  check: (ctx, _m, args) => {
    const id = String(args.npc ?? '');
    if (!id || !npcIndex(ctx).rows.has(id)) return id && findAlly(ctx, id) ? 'พวกพ้องของตัวละครหลักถูกฟ้าผ่าไม่ได้' : 'ไม่ระบุ NPC เป้าหมาย';
    if (!aliveNpc(ctx, id)) return 'NPC นั้นไม่มีชีวิตอยู่';
    if (slotOf(ctx, id)?.rel['mc.ally'] === 1) return 'พวกพ้องของตัวละครหลักถูกฟ้าผ่าไม่ได้';
    return null;
  },
  preview: (ctx, _m, args) => ({ target: String(args.npc), targetName: nameOf(ctx, String(args.npc)), chance: { die: MR06_DEATH, hurt: 1 - MR06_DEATH } }),
  run: (ctx, _m, args) => {
    const id = String(args.npc);
    const slot = slotOf(ctx, id)!;
    const where = slot.place ?? npcIndex(ctx).rows.get(id)?.country;
    const dies = rng(ctx).chance(MR06_DEATH);
    if (dies) killNpc(ctx, id, 'ฟ้าผ่า');
    else actsOf(ctx.state).deeds.push({ kind: 'hurt', id, ...(where ? { country: where } : {}), year: yearOf(ctx) });
    return { target: `npc:${id}`, result: dies ? 'ตาย' : 'บาดเจ็บสาหัส', ...(where ? { country: where } : {}) };
  },
});

registerMiracle(
  'MR-07',
  onCountry('destroy', (ctx, c) => {
    setFlag(ctx, c, 'plague', DURATIONS.plague);
    addMod(ctx, { subject: 'medicine', country: c, mul: 3, years: 2, src: 'MR-07' });
    addMod(ctx, { subject: 'W', country: c, add: -1, years: 2, src: 'MR-07' });
    return 'โรคแพร่หนึ่งปี';
  }),
);

registerMiracle(
  'MR-08',
  onCountry('destroy', (ctx, c) => {
    setFlag(ctx, c, 'famine', DURATIONS.famine);
    addMod(ctx, { subject: 'W', country: c, add: -1, years: 5, src: 'MR-08' });
    if (!rng(ctx).chance(MR08_RUIN)) return 'อาคารพังบางส่วน';
    // 20%: a lesser ruin (RU-03 without RU-01): the city is not lost, the pit is
    ctx.state.world.ruins.push({ id: 'RU-03', country: c, year: yearOf(ctx) });
    actsOf(ctx.state).deeds.push({ kind: 'ruin-minor', id: 'RU-03', country: c, year: yearOf(ctx) });
    return 'อาคารพัง และเกิดซากย่อย';
  }),
);

// ---------- mid, destroy (blood) ----------

// MR-09 the storm falls on the sea of a continent
registerMiracle('MR-09', {
  line: 'destroy',
  check: (ctx, _m, args) => {
    const k = continentArg(ctx, args);
    return k && countriesOf(ctx, k).length ? null : 'ไม่มีทวีปนั้น';
  },
  preview: (ctx, _m, args) => ({ target: continentArg(ctx, args), left: 'ต้นทุนขนส่งทะเล ×2 ห้าปี' }),
  run: (ctx, _m, args) => {
    const k = continentArg(ctx, args)!;
    addMod(ctx, { subject: 'sea', continent: k, mul: 2, years: 5, src: 'MR-09' });
    addMod(ctx, { subject: 'C', continent: k, add: -5, years: 5, src: 'MR-09' });
    return { target: k, result: 'เรือจมหลายลำ', continent: k };
  },
});
const continentArg = (ctx: Ctx, args: Record<string, unknown>): string | undefined => (args.continent === undefined ? (lifeCountry(ctx) ? continentOf(lifeCountry(ctx)!) : undefined) : String(args.continent));

// ---------- mid, create (gold) ----------

registerMiracle(
  'MR-10',
  onCountry(
    'create',
    (ctx, c) => {
      addMod(ctx, { subject: 'W', country: c, add: 1, src: 'MR-10' });
      return 'น้ำพุผุดกลางเมือง W +1 ถาวร';
    },
    {
      check: (ctx, c) => {
        if (!(isDesert(ctx, c) || hasFlag(ctx, c, 'famine', 'sandstorm'))) return 'น้ำพุกลางทรายใช้กับประเทศทะเลทรายหรือประเทศที่แห้งแล้ง';
        const have = activeMods(ctx).filter((m) => m.src === 'MR-10' && m.country === c && m.until === undefined).reduce((s, m) => s + (m.add ?? 0), 0);
        return have >= DURATIONS.wCap ? `ประเทศนี้ได้ W จากน้ำพุครบ ${DURATIONS.wCap} แล้ว` : null;
      },
    },
  ),
);

registerMiracle(
  'MR-11',
  onCountry('create', (ctx, c) => {
    clearFlag(ctx, c, 'forest_blight');
    addMod(ctx, { subject: 'wood', country: c, mul: 0.7, years: 10, src: 'MR-11' });
    return 'ต้นไม้งอกเต็มหนึ่งปี';
  }),
);

// ---------- mid, destroy ----------

registerMiracle(
  'MR-12',
  onCountry(
    'destroy',
    (ctx, c) => {
      addMod(ctx, { subject: 'food', country: c, mul: 3, years: 2, src: 'MR-12' });
      addMod(ctx, { subject: 'W', country: c, add: -1, years: 2, src: 'MR-12' });
      return 'พืชหมดหนึ่งฤดู';
    },
    { check: (ctx, c) => (isDesert(ctx, c) ? 'ทะเลทรายไม่มีพืชให้ตั๊กแตน' : null) },
  ),
);

registerMiracle(
  'MR-13',
  onCountry('destroy', (ctx, c) => {
    addMod(ctx, { subject: 'W', country: c, add: -1, years: 5, src: 'MR-13' });
    addMod(ctx, { subject: 'wood', country: c, mul: 2, years: DURATIONS.wood13, src: 'MR-13' });
    return 'ไฟไหม้ป่าและเมืองหนึ่งฤดู';
  }),
);

// ---------- mid, create ----------

registerMiracle(
  'MR-14',
  onCountry(
    'create',
    (ctx, c, m) => {
      const k = continentOf(c);
      const sp = (ctx.data.companions?.items as { species: { id: string; tier: string; home: string }[] } | undefined)?.species ?? [];
      const pool = sp.filter((s) => (s.tier === 'R' || s.tier === 'E') && (s.home.includes(c) || s.home.split(/\s+/).includes(k)));
      const any = sp.filter((s) => s.tier === 'R' || s.tier === 'E');
      const pick = pool.length ? pool : any;
      const id = pick.length ? rng(ctx).pick(pick.map((s) => s.id).sort()) : 'sp_guardian';
      addMod(ctx, { subject: 'defense', country: c, add: m.defenseBonus ?? 2, src: 'MR-14' });
      actsOf(ctx.state).deeds.push({ kind: 'guardian', id, country: c, year: yearOf(ctx) });
      return `${id} ลงมาเฝ้าเมือง`;
    },
    {
      check: (ctx, c) => (actsOf(ctx.state).deeds.some((d) => d.kind === 'guardian' && d.country === c) ? 'ประเทศนี้มีผู้พิทักษ์อยู่แล้ว' : null),
    },
  ),
);

registerMiracle(
  'MR-15',
  onCountry('destroy', (ctx, c) => {
    setFlag(ctx, c, 'war', DURATIONS.war);
    addMod(ctx, { subject: 'mercenary', country: c, mul: 2, years: DURATIONS.war, src: 'MR-15' });
    const k = continentOf(c);
    const bosses = (ctx.data.enemies?.items as { items?: { id: string; tier: string; continents: string[] }[] } | undefined)?.items?.filter((e) => e.tier === 'บอส') ?? [];
    const here = bosses.filter((e) => e.continents.includes(k));
    const pick = (here.length ? here : bosses).map((e) => e.id).sort();
    const boss = pick.length ? rng(ctx).pick(pick) : 'boss';
    actsOf(ctx.state).deeds.push({ kind: 'monster', id: boss, country: c, year: yearOf(ctx) });
    return `อสูร ${boss} ขึ้นจากใต้ดิน`;
  }),
);

// MR-16 hides a thing of tier R or E in a place of a country (a ruin, a cave or a shrine)
registerMiracle('MR-16', {
  line: 'create',
  noReaction: true,
  check: (ctx, _m, args) => needCountry(ctx, args),
  preview: (ctx, _m, args) => ({ target: country(ctx, args), targetName: countryName(ctx, country(ctx, args)!) }),
  run: (ctx, _m, args) => {
    const c = country(ctx, args)!;
    const r = rng(ctx);
    const tier = r.chance(godOf(ctx).chest.tierWeights.R / (godOf(ctx).chest.tierWeights.R + godOf(ctx).chest.tierWeights.E)) ? 'R' : 'E';
    const items = (ctx.data.items?.items as { items?: { id: string; tier: string; cat: string }[] } | undefined)?.items ?? [];
    const pool = items.filter((i) => i.tier === tier && i.cat !== 'consumable').map((i) => i.id).sort();
    const item = pool.length ? r.pick(pool) : `${tier}-item`;
    const itemName = (items as { id: string; name?: string }[]).find((i) => i.id === item)?.name ?? 'ของลับ';
    const place = r.pick(['ซาก', 'ถ้ำ', 'ศาล']);
    actsOf(ctx.state).deeds.push({ kind: 'hidden', id: item, country: c, year: yearOf(ctx), data: { tier, place } });
    const life = livingOf(ctx);
    if (life && !life.flags.includes('rumor_hidden')) life.flags.push('rumor_hidden'); // the rumour reaches the character
    return { target: c, result: `ซ่อน${itemName}ไว้ใน${place}`, country: c };
  },
});

// ---------- the dragons (mood only: iron rule 2) ----------

const dragonOf = (ctx: Ctx, args: Record<string, unknown>): number => (args.dragon === undefined ? -1 : Number(args.dragon));
const dragonCheck = (ctx: Ctx, args: Record<string, unknown>): string | null => {
  const i = dragonOf(ctx, args);
  const d = ctx.state.world.dragons[i];
  if (!Number.isInteger(i) || !d) return 'ไม่ระบุมังกร (dragon 0 ถึง 14)';
  return d.alive ? null : 'มังกรตัวนั้นล้มแล้ว';
};
const dragonKey = (ctx: Ctx, _m: Miracle, args: Record<string, unknown>): string => `dragon.${dragonOf(ctx, args)}`;

for (const [id, sign] of [['MR-23', 1], ['MR-24', -1]] as const) {
  registerMiracle(id, {
    line: 'dragon',
    noReaction: false,
    waitKey: dragonKey,
    check: (ctx, _m, args) => dragonCheck(ctx, args),
    preview: (ctx, m, args) => {
      const i = dragonOf(ctx, args);
      const mood = moodOf(ctx, i);
      return { target: `dragon:${i}`, name: tablesOf(ctx).dragons[i].name, mood, after: clamp(mood + (m.moodDelta ?? sign * 10), -100, moodCap(ctx)) };
    },
    run: (ctx, m, args) => {
      const i = dragonOf(ctx, args);
      const before = moodOf(ctx, i);
      addMood(ctx, i, m.moodDelta ?? sign * 10);
      return { target: `dragon:${i}`, result: `อารมณ์ ${Math.round(before)} → ${Math.round(moodOf(ctx, i))}` };
    },
  });
}

// ---------- MR-21: the miracle of the god (GD-04 at once) ----------

registerMiracle('MR-21', {
  line: 'create',
  noReaction: true,
  unscaled: true,
  cost: (ctx) => ({ faith: Math.floor(ctx.state.god.light) }),
  check: (ctx, m) => {
    if (ctx.state.god.light < (m.cost.faithMin ?? 120)) return `ต้องมีแสงศรัทธาอย่างน้อย ${m.cost.faithMin ?? 120}`;
    if (ctx.state.world.happened['GD-04'] !== undefined) return 'ทั้งโลกรู้แล้วว่าพระเจ้ามีจริง (GD-04 เกิดแล้ว)';
    return null;
  },
  preview: (ctx) => ({ target: 'world', spends: Math.floor(ctx.state.god.light), opens: 'GD-04' }),
  run: (ctx) => {
    const w = ctx.state.world;
    const ev = tablesOf(ctx).byId.get('GD-04');
    if (ev) {
      // GD-04 happens at once; it brings the +30 world faith itself, outside the cap clock of the ⭐ events
      fire(ctx, 'GD-04');
      applyEvent(ctx, ev);
      for (const c of Object.keys(w.countryFaith)) w.countryFaith[c] = clamp(w.countryFaith[c] + 30, 0, 100);
    }
    const life = livingOf(ctx);
    if (life) apply(ctx, [{ k: 'grant', kind: 'weapon', id: 'wl_light_sword' }], { sys: 'god', id: 'MR-21', stream: 'god.miracle' }); // the one who sees
    actsOf(ctx.state).gd04 = yearOf(ctx);
    return { target: 'world', result: 'ทั้งโลกรู้ว่าพระเจ้ามีจริง' };
  },
});

