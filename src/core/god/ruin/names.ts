// The names the ruins and the new lands give to things (llm/05-name-bank.md §4, §5, §6; llm/03-naming.md): the map's name of a ruin, a cult of a ruin
// (RU-04), the new city on the ruin (RU-07) and a new land (MR-20). The game names them from the word banks and the seed (`names` stream); a name
// is unique in the world (the registry of the text system).
import type { Ctx } from '../../game';
import type { NamesData } from '../../data/types-text';
import { dataOf } from '../../game';
import { bankWords, registerName } from '../../text';
import { countryName } from '../acts/geo';

const MAX = 24;

/** "ซากซอร์เนบ"; a name that begins with "ซาก" already takes "ซากเมือง" before it (03-naming.md §1). */
export function ruinLabel(ctx: Ctx, country: string): string {
  const n = countryName(ctx, country);
  return n.startsWith('ซาก') ? `ซากเมือง${n}` : `ซาก${n}`;
}

const rngOf = (ctx: Ctx) => ctx.rng('names');

/** The cult of a ruin: a form of two (do · belong), the verbs by the power of the god on the day, the word for the pit or the water by the shape of the ruin. */
export function cultName(ctx: Ctx, country: string, lake: boolean): string {
  const r = rngOf(ctx);
  const fear = ctx.state.god.dread > ctx.state.god.light;
  const verbs = bankWords(ctx, fear ? '4.ลัทธิจากซาก.เกรง.คำ' : '4.ลัทธิจากซาก.เฝ้ารอ.คำ');
  const pit = bankWords(ctx, lake ? '4.ลัทธิจากซาก.น้ำ.คำ' : '4.ลัทธิจากซาก.หลุม.คำ');
  const belong = bankWords(ctx, 'cult.affiliation');
  const old = countryName(ctx, country).replace(/^ซาก(เมือง)?/, '');
  const make = (): string => {
    if (!pit.length) return `ลัทธิ${old}`;
    return r.chance(0.5) && verbs.length ? `ผู้${r.pick(verbs)}${r.pick(pit)}${old}` : belong.length ? `${r.pick(belong)}${r.pick(pit)}${old}` : `ผู้${r.pick(verbs)}${r.pick(pit)}${old}`;
  };
  return registerName(ctx, `cult:${country}`, make(), make);
}

/** The root of a country's name (the 143 roots of the name bank), else the name without its first letters. */
function rootOf(ctx: Ctx, country: string): { root: string; spare: string } {
  const t = dataOf<NamesData>(ctx, 'names').tables.find((x) => x.header[0] === 'รหัส' && x.header[2] === 'ราก');
  const row = t?.rows.find((x) => x[0] === country);
  if (row) return { root: row[2], spare: row[3] || row[2] };
  const n = countryName(ctx, country);
  return { root: n.slice(0, Math.max(2, Math.min(4, n.length - 1))), spare: n };
}

/** The new city on a ruin: {revive}{root} or {root}{new}; the spare root when the first name is taken or too long. */
export function cityName(ctx: Ctx, country: string): string {
  const r = rngOf(ctx);
  const { root, spare } = rootOf(ctx, country);
  const revive = bankWords(ctx, 'newcity.revive');
  const fresh = bankWords(ctx, 'newcity.fresh');
  let tries = 0;
  const make = (): string => {
    const base = tries++ === 0 ? root : spare;
    const a = revive.length && r.chance(0.5) ? `${r.pick(revive)}${base}` : `${base}${fresh.length ? r.pick(fresh) : 'ใหม่'}`;
    return [...a].length <= MAX ? a : `${base}ใหม่`;
  };
  return registerName(ctx, `city:${country}`, make(), make);
}

const HIGH = new Set(['หาด', 'สันดอน']);
const LOW = new Set(['ผา', 'เนิน', 'ภูเขา', 'ลานหิน']);

/** A new land: {kind}{trait} with the traits of the continent of the country beside the sea; `*` traits do not go with a beach or a bar, `~` traits not with a cliff, a hill, a mountain or a rock. */
export function landName(ctx: Ctx, continent: string, key: string): string {
  const r = rngOf(ctx);
  const cs = (ctx.data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? [];
  const cname = cs.find((c) => c.id === continent)?.name ?? '';
  const kinds = bankWords(ctx, 'land.kind');
  const traits = bankWords(ctx, `6.แผ่นดินใหม่.${cname}.ลักษณะ`);
  const make = (): string => {
    for (let i = 0; i < 30; i++) {
      const k = kinds.length ? r.pick(kinds) : 'เกาะ';
      const raw = traits.length ? r.pick(traits) : 'ใหม่';
      const star = raw.endsWith('*');
      const wave = raw.endsWith('~');
      if ((star && HIGH.has(k)) || (wave && LOW.has(k))) continue;
      return `${k}${raw.replace(/[*~]$/, '')}`;
    }
    return 'เกาะใหม่';
  };
  return registerName(ctx, key, make(), make);
}
