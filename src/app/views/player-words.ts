// Words for the player on the start, ending, character and battle screens (M5 review M1 S5): the documents' own sentences carry ids (GV-12, KD-10, vampire, b_longevity),
// links to other documents ("([../bonds/README.md](../bonds/README.md))", "ดู 11-world-changes หัวข้อ 3") and the writer's words ("ใบเกิดแสดงในแถว ห้าม", "ผู้แปล").
// `playerWords` cuts all of that and gives the data's names back. Pure: (data, text) -> text.
import type { GameData } from '../../core/game';
import { leaks, reasonText, tidy } from '../../core/text/plain';
import { labels } from '../../core/text/labels';

/** A link to another document, in brackets or not: `([../bonds/README.md](../bonds/README.md))`, `[19-wish.md](19-wish.md)`, `[ชื่อ](path)`. */
const DOC_LINK = /\s*\(\s*\[[^\]]*\]\([^)]*\)\s*\)|\s*\[[^\]]*\]\([^)]*\)/g;
/** A pointer to a part of a document in the writer's words: `ดู 11-world-changes หัวข้อ 3`, `(เรื่อง 5)`, `(หลักข้อ 6 ของ 19-wish)`. */
const DOC_POINTER = /\s*\(?\s*ดู\s+[\w./-]+(?:\s+หัวข้อ\s*[\d.ก-ฮ]+)?\s*\)?|\s*\((?:เรื่อง|หลักข้อ|ขั้น)[^()]*\)/g;

/** The writer's words that mean something else to a player, with what the player reads instead. */
const WRITER_WORDS: [RegExp, string][] = [
  [/\s*ใบเกิดแสดงในแถว\s*["“”]?ห้าม["“”]?/g, ''],
  [/(?:และ)?\s*(?:ขึ้น|แสดง|แจ้ง)(?:อยู่)?(?:ใน)?ใบเกิด(?:ว่า)?/g, ''],
  [/ผู้แปล/g, 'เกม'],
  [/ตามขั้น\s*\d+[ก-ฮ]?\s*:?/g, ':'],
  [/ตัวแปลคำพ้อง/g, 'เกม'],
  [/น้ำหนักเป็น 0/g, 'จึงไม่ให้เกิด'],
  [/ไม่มีค่านี้ในข้อมูล/g, 'เกมไม่รู้จักคำนี้'],
  [/\s*\(ตาราง[^()]*\)/g, ''],
];

/** Ids the plain list of names gets wrong (`vampire` is also a count in the enemy list): the kind of thing that the sentence speaks of decides. */
function named(data: GameData, id: string): string | undefined {
  const k = labels(data).kind;
  return k.race.get(id) ?? k.blessing.get(id) ?? k.curse.get(id) ?? k.job.get(id) ?? k.aptitude.get(id) ?? k.trait.get(id) ?? k.skill.get(id);
}

/** The names of the vows (`GV-12`), from the god's data. */
function vowNames(data: GameData): Map<string, string> {
  const rows = (data.god?.items as { goals?: { vows?: { id: string; name: string }[] } } | undefined)?.goals?.vows ?? [];
  return new Map(rows.map((v) => [v.id, v.name]));
}

/** Ids replaced by the names the data gives for their own kind (race, gift, job, vow); the rest is left to `scrub`. */
function withNames(data: GameData, text: string): string {
  const v = vowNames(data);
  return text.replace(/\bGV-\d{2}\b/g, (m) => v.get(m) ?? ' ').replace(/(?<![A-Za-z0-9_.-])[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?![A-Za-z0-9_.-])/g, (m) => named(data, m) ?? m);
}

/** A sentence of the documents as the player reads it: no ids, no links, no writer's words. */
export function playerWords(data: GameData, text: string | null | undefined): string {
  if (!text) return '';
  let x = withNames(data, text.replace(DOC_LINK, ' ').replace(DOC_POINTER, ' '));
  for (const [re, to] of WRITER_WORDS) x = x.replace(re, to);
  x = reasonText(data, x);
  // a name the id gave back next to the same name written in Thai: "แวมไพร์ แวมไพร์"
  x = x.replace(/([฀-๿]{3,})\s+\1/g, '$1');
  return tidy(x);
}

/** The condition of a vow as the player reads it; the numbers stay ("ศรัทธาเทพ ≥ 85"). */
export const plainCondition = playerWords;

/** A line that already reads as words is left alone; one that holds an id, a link or a pointer to a document is cut to words (M5 review M1). */
export function clean(data: GameData, text: string): string {
  if (!text) return text;
  return leaks(text).length || /\]\(|\.md\b|ดู\s+[\w-]+\s+หัวข้อ/.test(text) ? playerWords(data, text) : text;
}
