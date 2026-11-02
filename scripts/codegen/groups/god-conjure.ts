// Conjuring numbers that the document gives in words and not in a table (07-conjure.md): the multiplier of each verb in the price, the share of the effect a size carries, the 15% a
// clash with the climate adds to the shadow, and the omen. Writes data/gen/god-conjure.json. The tables (the 48 cells, the reactions, the shadow, the caps) are in god.json
// (groups/god.ts); a test (tests/codegen/god-conjure.test.ts) holds the constants of src/core/god/conjure/tuning.ts to these values, so a change of the document is seen.
import { readDoc, writeGen } from '../lib/table';
import { finish, nums } from '../helpers-m0b';
import { Unparsed } from '../lib/table';

const F = 'docs/systems/god/07-conjure.md';
const un = new Unparsed('god-conjure');

export interface GodConjureData {
  /** Thai name of the verb → multiplier of the price (`เผย` 0.8 ...). */
  verbMul: Record<string, number>;
  /** Share of the effect of a country that a place carries and that each country of a continent carries. */
  sizeFactor: { place: number; continent: number };
  /** Added to the chance of the shadow when the core clashes with the climate of the place. */
  clashAdd: number;
  /** Lines of the document the numbers were read from. */
  src: Record<string, string>;
}

export default function run() {
  const lines = readDoc(F).split('\n');
  const at = (re: RegExp) => {
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) throw new Error(`god-conjure: line not found ${re}`);
    return { text: lines[i], n: i + 1 };
  };

  // **ราคา** = ราคาฐานของขนาด × ตัวคูณกริยา (เผย ×0.8 · สงบ ×0.9 · ให้กำเนิด ×1.0 · ทำลาย ×1.1 · เปลี่ยน ×1.2 · ปลุก ×1.2)
  const price = at(/^\*\*ราคา\*\*/);
  const verbMul: Record<string, number> = {};
  const inner = /\(([^)]*×[^)]*)\)/.exec(price.text)?.[1] ?? '';
  for (const part of inner.split('·')) {
    const m = /^\s*(\S+)\s*×\s*(\d+(?:\.\d+)?)/.exec(part);
    if (m) verbMul[m[1]] = Number(m[2]);
  }
  if (Object.keys(verbMul).length !== 6) throw new Error('god-conjure: the price line does not give six verb multipliers');

  // | ถิ่น | ... ผลครึ่งหนึ่งของประเทศ | and | ทวีป | ... ผลต่อประเทศ ×0.6 |
  const place = at(/^\| ถิ่น \|/);
  const continent = at(/^\| ทวีป \|/);
  const placeFactor = /ครึ่งหนึ่ง/.test(place.text) ? 0.5 : null;
  const contFactor = nums(continent.text.split('ผลต่อประเทศ')[1] ?? '').find((x) => x > 0 && x < 1) ?? null;
  if (placeFactor === null || contFactor === null) throw new Error('god-conjure: size factors not found');

  // แก่นที่ขัดกับภูมิอากาศของที่ (ไฟในเขตน้ำแข็ง ...) +15% เงาสะท้อน ...
  const clash = at(/ขัดกับภูมิอากาศของที่/);
  const add = /\+\s*(\d+)%/.exec(clash.text);
  if (!add) throw new Error('god-conjure: the clash with the climate has no percentage');

  const data: GodConjureData = {
    verbMul,
    sizeFactor: { place: placeFactor, continent: contFactor },
    clashAdd: Number(add[1]) / 100,
    src: { verbMul: `${F}:${price.n}`, place: `${F}:${place.n}`, continent: `${F}:${continent.n}`, clash: `${F}:${clash.n}` },
  };
  writeGen('god-conjure', data, [F], 'scripts/codegen/groups/god-conjure.ts');
  return finish('god-conjure', ['god-conjure.json'], un);
}
