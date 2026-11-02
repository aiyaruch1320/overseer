// Conditions written so the effect parser does not see them (code-plan §5.2 "ห้ามซ่อนเงื่อนไข"): a condition moved
// into brackets, "ทุกคน (…)", "ยุค ≥ 1 (…)", or a number written in words. Not a gate: the list keeps them visible
// until a grammar form exists (review/m0/doc-review.md proposal 1).
import { listDocs, readDoc, Unparsed } from '../lib/table';
import type { GenReport } from '../run-all';

const DIRS = ['docs/lore/storylines', 'docs/systems/events', 'docs/systems/events/branches', 'docs/systems/character', 'docs/systems/god', 'docs/systems/combat', 'docs/systems/economy'];
const PATTERNS: [RegExp, string][] = [
  [/ทุกคน\s*\([^)]+\)/g, 'ทุกคน (…)'],
  [/ยุค\s*≥\s*1\s*\([^)]+\)/g, 'ยุค ≥ 1 (…)'],
  [/\(\s*หรือ\s[^)]+\)/g, '(หรือ …)'],
  [/\(\s*(?:ตอน|กรณี|เฉพาะ|หาก)[^)]+\)/g, '(ตอน/กรณี/เฉพาะ/หาก …)'],
  [/(?:สอง|สาม|สี่|ห้า|สิบ|หนึ่ง)(?:เท่า(?:ครึ่ง)?|ในห้า|ในสิบ|ร้อย)|ครึ่งหนึ่ง|หนึ่งเท่าครึ่ง/g, 'ตัวเลขเป็นคำ'],
];

export default function run(): GenReport {
  const out = new Unparsed('hidden');
  for (const dir of DIRS)
    for (const f of listDocs(dir)) {
      readDoc(f)
        .split('\n')
        .forEach((line, i) => {
          if (!line.startsWith('|')) return; // only table rows feed the generators
          for (const [re, why] of PATTERNS) for (const m of line.matchAll(re)) out.add(f, i + 1, m[0], why);
        });
    }
  out.write();
  return { group: 'hidden', files: [], unparsed: out.count };
}
