// Thai number words (หนึ่ง … เก้า, สิบ, ยี่สิบ, ร้อย, พัน, หมื่น, แสน, ล้าน, เอ็ด) to a value, strictly: the words must be a number the way Thai writes it, in the order of the places.
// The check of a retelling uses it to find a year or an age told in words (a real trial wrote "สองพันสิบเอ็ดพันห้าร้อยสี่สิบ" for 11,540, which is no number at all).

const DIGIT: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9 };
const WORDS = ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'เอ็ด', 'ยี่', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
/** Places below a million, high to low. */
const PLACES: [string, number][] = [['แสน', 100000], ['หมื่น', 10000], ['พัน', 1000], ['ร้อย', 100], ['สิบ', 10]];

/** The words cut into tokens, or null when anything else is in them. */
export function tokensOf(s: string): string[] | null {
  const out: string[] = [];
  let rest = s;
  while (rest) {
    const w = WORDS.find((k) => rest.startsWith(k));
    if (!w) return null;
    out.push(w);
    rest = rest.slice(w.length);
  }
  return out;
}

/** A number below a million. The places come high to low, once each; a place has a digit before it (only สิบ may stand alone: 10, สิบเอ็ด 11); ยี่ stands only before สิบ; เอ็ด only last, after a place. */
function below(t: string[]): number | undefined {
  if (!t.length) return 0;
  let total = 0;
  let last = Infinity;
  let i = 0;
  while (i < t.length) {
    const w = t[i];
    const place = PLACES.find(([p]) => p === w);
    if (place) {
      // a lone สิบ is ten; any other place needs its digit, which the loop below has already taken
      if (place[1] !== 10) return undefined;
      if (place[1] >= last) return undefined;
      total += 10;
      last = 10;
      i++;
      continue;
    }
    const d = w === 'ยี่' ? 2 : DIGIT[w];
    const next = t[i + 1];
    const np = PLACES.find(([p]) => p === next);
    if (np) {
      if (w === 'เอ็ด') return undefined;
      if (w === 'ยี่' && np[1] !== 10) return undefined;
      if (w === 'หนึ่ง' && np[1] === 10) return undefined;
      if (np[1] >= last) return undefined;
      total += d * np[1];
      last = np[1];
      i += 2;
      continue;
    }
    // the last digit: after a place (or alone), and it ends the number
    if (i !== t.length - 1 || w === 'ยี่') return undefined;
    if (w === 'เอ็ด') {
      if (last === Infinity) return undefined;
      return total + 1;
    }
    if (w === 'หนึ่ง' && last === 10) return undefined; // สิบหนึ่ง is spoken สิบเอ็ด
    return total + d;
  }
  return total;
}

/** The value of the words, or undefined when they are not a Thai number (`ห้าร้อยสี่สิบ` 540 · `หนึ่งหมื่นหนึ่งพันห้าร้อยสี่สิบ` 11540 · `สองพันสิบเอ็ดพันห้าร้อยสี่สิบ` undefined). */
export function parseThaiNumber(words: string): number | undefined {
  const t = tokensOf(words);
  if (!t || !t.length) return undefined;
  // the millions: "(number) ล้าน (rest)", the part before a ล้าน is itself a number
  let total = 0;
  let from = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== 'ล้าน') continue;
    const head = i === from ? undefined : below(t.slice(from, i));
    if (!head) return undefined;
    total += head * 1_000_000;
    from = i + 1;
  }
  const r = below(t.slice(from));
  return r === undefined ? undefined : total + r;
}
