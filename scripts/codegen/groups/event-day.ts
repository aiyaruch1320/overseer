// The day of a miracle (docs/appearance/20-god-ui.md §7.3): one row of beats and sound for each miracle of the table, and the seconds of a small and a
// middle scene. Writes data/gen/event-day.json. The scene scripts of the same table are made by groups/scenes.ts (`mr.MR-xx`); this is the plain table for the screen.
import type { EventDayData, EventDayRow } from '../../../src/core/data/types-event-day';
import { finish, nums, Unparsed } from '../helpers-m0b';
import { readDoc, tables, writeGen } from '../lib/table';

const F = 'docs/appearance/20-god-ui.md';
const un = new Unparsed('event-day');

const plain = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').trim();

export default function run() {
  const table = tables(F).find((t) => t.header[0] === 'ปาฏิหาริย์' && /จังหวะ 2/.test(t.header[1]));
  if (!table) throw new Error('event-day: the table of 20-god-ui.md §7.3 is missing');
  const rows: EventDayRow[] = [];
  for (const r of table.rows) {
    const m = plain(r.cells[0]).match(/^(MR-\d+)\s+(.*)$/);
    if (!m) {
      un.add(F, r.line, r.cells[0], 'miracle row');
      continue;
    }
    const happens = plain(r.cells[2]);
    rows.push({ id: m[1], name: m[2], omen: plain(r.cells[1]), happens, after: plain(r.cells[3]), sound: plain(r.cells[4]), sceneRef: happens.match(/ใช้ฉาก\s+([A-Z]+-\d+)/)?.[1] ?? null, src: `${table.file}:${r.line}` });
  }
  // "ปาฏิหาริย์ระดับเล็กเป็นฉากสั้น 3 ถึง 5 วินาที ... (20 ถึง 40 วินาที)"
  const line = readDoc(F).split('\n').find((l) => /ปาฏิหาริย์ระดับเล็กเป็นฉากสั้น/.test(l));
  if (!line) throw new Error('event-day: the line of the seconds is missing');
  const n = nums(line.replace(/11-world-changes\.md.*?หัวข้อ\s*[\d.]+/, ''));
  const [a, b, c, d] = n.filter((x) => x >= 3);
  const data: EventDayData = { rows, seconds: { small: [a, b], middle: [c, d] }, fallback: 'same-line' };
  if (!rows.length || data.seconds.small.some((x) => !x) || data.seconds.middle.some((x) => !x)) throw new Error(`event-day: the seconds were not read from "${line}"`);
  writeGen('event-day', data, [F], 'scripts/codegen/groups/event-day.ts');
  return finish('event-day', ['event-day.json'], un);
}
