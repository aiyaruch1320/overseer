// "อยากเกิดเป็นแบบไหน" — the player describes a starting character in their own words. The request is read
// (by the narrator if available, otherwise by keyword matching) into a Setup, which is then clamped to the
// game's rules so it can never be overpowered:
//   • at most 3 traits and 2 aptitudes, only from the normal lists
//   • at most one blessing, and only ธรรมดา/ไม่ธรรมดา — and every requested blessing comes with a small curse
//   • no Unique Skill, secret job, rare items, or stat changes; a wished-for career only makes it more likely
import { RNG } from './rng';
import type { Character, Country } from './types';
import { RACES, CLIMATES, raceById } from '../data/races';
import { TRAITS, APTITUDES, TRAIT_CONFLICTS, traitById, skillById } from '../data/traits';
import { BLESSINGS, CURSES, giftById } from '../data/gifts';
import { JOBS } from '../data/lore';
import { RELIGIONS, CONTINENTS } from './worldgen';
import { createCharacter, applyAxisFx, applyStatFx, maxHp, rollFate, tagsOf } from './character';

export interface Setup {
  race?: string;
  gender?: string;
  climate?: string;
  religion?: string;
  continent?: number;
  traits?: string[];
  aptitudes?: string[];
  job?: string;
  birthTime?: string;
  birthSign?: string;
  blessing?: string;
  noble?: boolean;
  note?: string;
}

const NORMAL_JOBS = JOBS.filter((j) => !j.secret && !j.req);
const SAFE_BLESSINGS = BLESSINGS.filter((b) => b.rarity === 'C' || b.rarity === 'U');
const TIMES: Record<string, string> = { dawn: 'รุ่งอรุณ', day: 'กลางวัน', dusk: 'สนธยา', night: 'กลางคืน' };
const SIGNS: Record<string, string> = { comet: 'ดาวหาง', eclipse: 'สุริยคราส', fullmoon: 'จันทร์เต็มดวง', storm: 'พายุ' };
const GENDERS = ['ชาย', 'หญิง', 'ไร้เพศ'];

// Validate anything (LLM output or keyword parse) into a safe Setup; report what was refused
export function sanitizeSetup(raw: Record<string, unknown>): { setup: Setup; refused: string[] } {
  const refused: string[] = [];
  const s: Setup = {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const race = str(raw.race);
  if (race && RACES.some((r) => r.id === race)) s.race = race;
  const gender = str(raw.gender);
  if (gender && GENDERS.includes(gender)) s.gender = gender;
  if (s.race === 'slime') s.gender = 'ไร้เพศ';
  else if (s.gender === 'ไร้เพศ' && s.race && !raceById(s.race).genders.some((g) => g[0] === 'ไร้เพศ')) delete s.gender;
  const climate = str(raw.climate);
  if (climate && CLIMATES.some((c) => c.id === climate)) s.climate = climate;
  const religion = str(raw.religion);
  if (religion && religion in RELIGIONS) s.religion = religion;
  const cont = Number(raw.continent);
  if (raw.continent !== null && raw.continent !== undefined && Number.isInteger(cont) && cont >= 0 && cont < CONTINENTS.length) s.continent = cont;
  const traits = Array.isArray(raw.traits) ? (raw.traits as unknown[]).map(String).filter((t) => TRAITS.some((x) => x.id === t)) : [];
  s.traits = [];
  for (const t of traits) {
    if (s.traits.length >= 3) { refused.push('นิสัยเกิน 3 อย่าง'); break; }
    if (!s.traits.includes(t) && !TRAIT_CONFLICTS.some(([a, b]) => (a === t && s.traits!.includes(b)) || (b === t && s.traits!.includes(a)))) s.traits.push(t);
  }
  const apts = Array.isArray(raw.aptitudes) ? (raw.aptitudes as unknown[]).map(String).filter((a) => APTITUDES.some((x) => x.id === a) && (a !== 'absorb' || s.race === 'slime')) : [];
  s.aptitudes = [...new Set(apts)].slice(0, 2);
  if (apts.length > 2) refused.push('ความถนัดเกิน 2 อย่าง');
  const job = str(raw.job);
  if (job) { if (NORMAL_JOBS.some((j) => j.id === job)) s.job = job; else refused.push('อาชีพลับหรืออาชีพพิเศษเลือกล่วงหน้าไม่ได้'); }
  const bt = str(raw.birthTime);
  if (bt && bt in TIMES) s.birthTime = bt;
  const bs = str(raw.birthSign);
  if (bs && bs in SIGNS) s.birthSign = bs;
  const bl = str(raw.blessing);
  if (bl) {
    if (SAFE_BLESSINGS.some((b) => b.id === bl)) s.blessing = bl;
    else refused.push('พรระดับหายากขึ้นไปขอไม่ได้ (ต้องได้ระหว่างทางเท่านั้น)');
  }
  if (raw.noble === true) s.noble = true;
  const note = str(raw.note);
  // keep the note in Thai only (drop stray CJK/Latin fragments a model may slip in)
  if (note) s.note = note.replace(/[\u3000-\u9fff\uac00-\ud7af]+/g, '').replace(/[A-Za-z]{2,}/g, '').replace(/ {2,}/g, ' ').trim().slice(0, 220);
  return { setup: s, refused };
}

// Free fallback: read the request by matching names and keywords
export function parseSetupLocal(text: string): Record<string, unknown> {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x.toLowerCase()));
  const out: Record<string, unknown> = { traits: [], aptitudes: [] };
  const race = RACES.find((r) => t.includes(r.name) || t.includes(r.en.toLowerCase()) || (r.id === 'darkelf' && has('ดาร์ก')) || (r.id === 'beast' && has('หูแมว', 'หูหมา', 'ครึ่งสัตว์')) || (r.id === 'demonkin' && has('ปีศาจ')));
  // "ดาร์กเอลฟ์" contains "เอลฟ์": prefer the longer match
  const darkElf = has('ดาร์กเอลฟ์', 'dark elf');
  out.race = darkElf ? 'darkelf' : race?.id;
  if (has('ผู้หญิง', 'หญิง', 'สาว')) out.gender = 'หญิง';
  else if (has('ผู้ชาย', 'ชาย', 'หนุ่ม')) out.gender = 'ชาย';
  const CL: [string, string[]][] = [['desert', ['ทะเลทราย', 'ร้อน', 'ทราย']], ['frozen', ['หิมะ', 'หนาว', 'น้ำแข็ง']], ['volcanic', ['ภูเขาไฟ', 'ลาวา']], ['islands', ['เกาะ', 'ทะเล', 'ชายหาด']], ['tropical', ['ป่าดิบ', 'ป่า', 'ร้อนชื้น']], ['temperate', ['ทุ่งหญ้า', 'ชนบท']]];
  out.climate = CL.find(([, ws]) => has(...ws))?.[0];
  const RL: [string, string[]][] = [['light', ['แสง', 'นักบุญ', 'ศักดิ์สิทธิ์', 'โบสถ์']], ['dragon', ['บูชามังกร']], ['demon', ['ลัทธิปีศาจ', 'บูชาปีศาจ']], ['moon', ['จันทรา', 'ดวงจันทร์']], ['sea', ['เทพสมุทร']], ['naga', ['พญานาค']], ['nature', ['ต้นไม้โลก', 'ธรรมชาติ']], ['war', ['เทพสงคราม']], ['ancestor', ['บรรพบุรุษ']]];
  out.religion = RL.find(([, ws]) => has(...ws))?.[0];
  out.continent = CONTINENTS.findIndex((c) => t.includes(c.name));
  if ((out.continent as number) < 0) delete out.continent;
  out.traits = TRAITS.filter((x) => t.includes(x.name)).map((x) => x.id);
  out.aptitudes = APTITUDES.filter((x) => t.includes(x.name)).map((x) => x.id);
  out.job = NORMAL_JOBS.find((j) => t.includes(j.name))?.id;
  out.birthTime = has('รุ่งอรุณ', 'เช้า') ? 'dawn' : has('กลางวัน', 'เที่ยง') ? 'day' : has('สนธยา', 'เย็น') ? 'dusk' : has('กลางคืน', 'ค่ำ') ? 'night' : undefined;
  out.birthSign = has('ดาวหาง') ? 'comet' : has('สุริยคราส', 'คราส') ? 'eclipse' : has('จันทร์เต็มดวง') ? 'fullmoon' : has('พายุ', 'ฟ้าผ่า') ? 'storm' : undefined;
  out.blessing = SAFE_BLESSINGS.find((b) => t.includes(b.name))?.id;
  out.noble = has('ขุนนาง', 'ลูกเศรษฐี', 'ราชวงศ์', 'เจ้าชาย', 'เจ้าหญิง');
  if (has('โกง', 'ไร้เทียมทาน', 'เก่งที่สุด', 'op', 'เทพสุด', 'อมตะ')) out.note = 'คำขอบางส่วนเกินขอบเขตของเกม จึงเริ่มแบบสมดุลแทน — ความแข็งแกร่งต้องได้มาระหว่างทาง';
  return out;
}

// The id lists the narrator chooses from (fixed text → cached by the provider after the first call)
export function setupCatalog(): string {
  const list = (xs: { id: string; name: string }[]) => xs.map((x) => `${x.id}=${x.name}`).join(', ');
  return [
    `race: ${list(RACES)}`,
    `gender: ชาย, หญิง, ไร้เพศ`,
    `climate: ${list(CLIMATES)}`,
    `religion: ${Object.entries(RELIGIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `continent (เลข): ${CONTINENTS.map((c) => `${c.id}=${c.name}`).join(', ')}`,
    `traits (สูงสุด 3): ${list(TRAITS)}`,
    `aptitudes (สูงสุด 2): ${list(APTITUDES.filter((a) => a.id !== 'absorb'))}, absorb=กลืนกิน(เฉพาะ slime)`,
    `job (อาชีพที่อยากได้ เพิ่มโอกาสเท่านั้น): ${list(NORMAL_JOBS)}`,
    `birthTime: dawn, day, dusk, night · birthSign: comet, eclipse, fullmoon, storm`,
    `blessing (สูงสุด 1): ${list(SAFE_BLESSINGS)}`,
  ].join('\n');
}

const negate = (fx: string) => fx.replace(/([+-])(\d+)/g, (_m, sg: string, n: string) => (sg === '+' ? '-' : '+') + n);

// Build the newborn from a sanitized Setup
export function applySetup(rng: RNG, countries: Country[], karma: number, setup: Setup): Character {
  const fits = (c: Country, keys: ('race' | 'climate' | 'religion' | 'continent')[]) => keys.every((k) =>
    k === 'race' ? !setup.race || c.races.some((r) => r.race === setup.race)
      : k === 'climate' ? !setup.climate || c.climate === setup.climate
        : k === 'religion' ? !setup.religion || c.religion === setup.religion
          : setup.continent === undefined || c.continent === setup.continent);
  // relax the place constraints one by one until a country fits
  const attempts: ('race' | 'climate' | 'religion' | 'continent')[][] = [['race', 'climate', 'religion', 'continent'], ['race', 'climate', 'continent'], ['race', 'climate'], ['race'], []];
  let pool: Country[] = [];
  for (const keys of attempts) { pool = countries.filter((c) => fits(c, keys)); if (pool.length) break; }
  const country = rng.weighted(pool, (c) => c.tiles)!;
  const race = setup.race || rng.weighted(country.races, (r) => r.w)!.race;
  const gender = setup.gender && raceById(race).genders.some((g) => g[0] === setup.gender) ? setup.gender : undefined;
  const c = createCharacter(rng, race, country, 0, { karma }, gender);
  if (setup.birthTime) c.birthTime = setup.birthTime;
  if (setup.birthSign) c.birthSign = setup.birthSign;
  // traits: requested ones first, keep random ones that do not clash
  if (setup.traits?.length) {
    const keep = c.traits.filter((t) => !setup.traits!.includes(t) && !TRAIT_CONFLICTS.some(([a, b]) => (a === t && setup.traits!.includes(b)) || (b === t && setup.traits!.includes(a))));
    const next = [...setup.traits, ...keep].slice(0, 3);
    for (const t of c.traits) if (!next.includes(t)) applyAxisFx(c.axes, negate(traitById(t).fx));
    for (const t of next) if (!c.traits.includes(t)) applyAxisFx(c.axes, traitById(t).fx);
    c.traits = next;
  }
  // aptitudes: requested ones first; starting skills follow
  if (setup.aptitudes?.length) {
    const next = [...setup.aptitudes, ...c.aptitudes.filter((a) => !setup.aptitudes!.includes(a))].slice(0, Math.max(2, c.aptitudes.length));
    for (const sid of [...c.skills]) {
      const sk = skillById(sid);
      if (sk.apt && !next.includes(sk.apt)) { applyStatFx(c.stats, negate(sk.fx)); c.skills = c.skills.filter((x) => x !== sid); }
    }
    c.aptitudes = next;
    const first = `${next[0]}_1`;
    if (!c.skills.includes(first)) { c.skills.unshift(first); applyStatFx(c.stats, skillById(first).fx); }
  }
  // a wished-for blessing always comes with a price
  if (setup.blessing && !c.blessings.includes(setup.blessing)) {
    const b = giftById(setup.blessing);
    c.blessings.push(b.id);
    applyStatFx(c.stats, b.fx); applyAxisFx(c.axes, b.fx);
    const pricey = CURSES.filter((x) => x.rarity === 'C' && !c.curses.includes(x.id));
    const curse = rng.pick(pricey);
    c.curses.push(curse.id);
    applyStatFx(c.stats, curse.fx); applyAxisFx(c.axes, curse.fx);
  }
  if (setup.noble && !c.flags.includes('noble')) c.flags.push('noble');
  if (setup.job) c.flags.push(`pref_job:${setup.job}`);
  c.hp = maxHp(c);
  c.fate = rollFate(rng, 0, tagsOf(c));
  return c;
}

// Human-readable summary for the confirmation screen
export function describeSetup(s: Setup): string[] {
  const out: string[] = [];
  if (s.race) out.push(`เผ่า: ${raceById(s.race).name}`);
  if (s.gender) out.push(`เพศ: ${s.gender}`);
  if (s.continent !== undefined) out.push(`ทวีป: ${CONTINENTS[s.continent].name}`);
  if (s.climate) out.push(`ภูมิอากาศ: ${CLIMATES.find((c) => c.id === s.climate)!.name}`);
  if (s.religion) out.push(`ดินแดน: ${RELIGIONS[s.religion]}`);
  if (s.birthTime) out.push(`เกิดยาม${TIMES[s.birthTime]}`);
  if (s.birthSign) out.push(`เกิดใต้${SIGNS[s.birthSign]}`);
  if (s.traits?.length) out.push(`นิสัย: ${s.traits.map((t) => traitById(t).name).join(', ')}`);
  if (s.aptitudes?.length) out.push(`ความถนัด: ${s.aptitudes.map((a) => APTITUDES.find((x) => x.id === a)!.name).join(', ')}`);
  if (s.job) out.push(`อาชีพที่หวัง: ${JOBS.find((j) => j.id === s.job)!.name} (เพิ่มโอกาสเท่านั้น)`);
  if (s.blessing) out.push(`พร: ${giftById(s.blessing).name} (+ คำสาปเล็ก ๆ หนึ่งอย่างเป็นราคา)`);
  if (s.noble) out.push('เกิดในตระกูลขุนนาง');
  return out;
}
