// Where every NPC was born, as the story allows. A person lives in one country but was not always born there: the people of a land are born at
// home (docs/character/01-origin.md หัวข้อ 3), a half-blood is born where the parents of two peoples can live together (หัวข้อ 4), and what an
// NPC's own story says (born in a camp, a refugee, an exile) overrides the odds. The same person always gets the same answer.
import { HOMES, PAIRS } from './birthTables';
import { COUNTRY_DOCS } from './countries';
import { RNG, hashString } from '../sim/rng';

export interface Birth { code: string; name: string; why: string; here: boolean }

const nameOf = (code: string) => COUNTRY_DOCS.find((c) => c.code === code)?.name ?? code;
/** the climate a land gives its people's dress and skin, by the continent of its code */
export const CLIMATE_OF: Record<string, string> = { AZ: 'temperate', MH: 'volcanic', KD: 'volcanic', NR: 'islands', AL: 'temperate', MK: 'temperate', SH: 'desert', SV: 'tropical', NB: 'frozen' };
export const climateOfCode = (code: string) => CLIMATE_OF[code.slice(0, 2)] ?? 'temperate';

export function birthOf(id: string, race: string, blend: string | undefined, flag: string, note: string): Birth {
  const res = id.replace(/^([A-Z]{2})(\d\d)-.*/, '$1-$2');
  const rng = new RNG(hashString('birth:' + id));
  const mk = (code: string, why: string): Birth => ({ code, name: nameOf(code), why, here: code === res });
  if (id === 'AL19-4') return mk(res, 'ค่ายผู้ลี้ภัยที่ไม่มีใครถามเรื่องเผ่า');
  if (flag === 'h') return mk(res, note);
  const h = HOMES[race];
  const fromHome = (why: string) => { const main = (h?.main ?? []).filter((c) => c !== res), pool = main.length ? main : (h?.dia ?? []).filter((c) => c !== res && c !== 'BIG'); return pool.length ? mk(rng.pick(pool), why) : mk(res, 'ถิ่นที่อยู่'); };
  if (blend) {
    const pair = PAIRS.find((p) => (p.a === race && p.b === blend) || (p.a === blend && p.b === race));
    if (pair) {
      if (pair.mains.includes(res)) return mk(res, `ถิ่นหลักของเผ่า เหตุพิเศษ: ${pair.note || 'พ่อแม่มีเหตุ'}`);
      if (pair.meet.some((m) => m[0] === res) && rng.chance(0.75)) return mk(res, 'ถิ่นที่พ่อแม่สองเผ่าพบกันและอยู่ร่วมกันได้');
      const [code] = rng.weighted(pair.meet, (m) => m[1])!;
      return mk(code, code === res ? 'ถิ่นที่พ่อแม่สองเผ่าพบกันและอยู่ร่วมกันได้' : 'ถิ่นที่พ่อแม่สองเผ่าพบกัน ภายหลังย้ายมาอยู่ที่นี่');
    }
  }
  if (!h) return mk(res, 'ถิ่นที่อยู่');
  if (flag === 'm') return fromHome('เกิดที่อื่น ย้ายมาเพราะภัยหรือการเนรเทศ');
  if (h.main.includes(res)) return rng.chance(0.88) ? mk(res, 'ถิ่นหลักของเผ่า') : fromHome('ครอบครัวย้ายมาจากถิ่นหลักอื่นของเผ่า');
  if (h.dia.includes(res)) return rng.chance(0.65) ? mk(res, 'ชุมชนพลัดถิ่นของเผ่า') : fromHome('ครอบครัวย้ายมาจากถิ่นหลักของเผ่า');
  return rng.chance(0.35) ? mk(res, 'เกิดนอกถิ่นหลักของเผ่า') : fromHome('ครอบครัวย้ายมาจากถิ่นหลักของเผ่า');
}

/** the line the hover card and the docs show */
export const birthText = (b: Birth) => `เกิดที่ ${b.name} (${b.code}) · ${b.why}`;
