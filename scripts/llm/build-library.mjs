// Builds the layer-1 library (docs/systems/god/05-llm.md section 2): many lines per state set, written once at dev time by
// DeepSeek with the key in .env, checked, de-duplicated and saved as JSONL under .data/library/. A pilot run takes a slice of
// the sets and reports the acceptance rate, real cost and the projected cost of the full library.
// Usage: node scripts/llm/build-library.mjs [--family=omen|prayer|all] [--sets=40] [--per=10] [--write]
//   --sets caps the state sets per family (pilot); omit it for the full family. --write puts the report into
//   docs/systems/llm/08-live-test.md between the llm-library markers.
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';

const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = env.DEEPSEEK_API_KEY, MODEL = env.DEEPSEEK_MODEL || 'deepseek-flash', BASE = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
if (!KEY) throw new Error('no DEEPSEEK_API_KEY in .env');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const FAMILY = arg('family', 'all'), SETS = Number(arg('sets', 0)), PER = Number(arg('per', 10)), CONC = 6, OPEN_CAP = 0.05; // one opening may take at most 5% of the lines of one hint or prayer kind

const cost = fs.readFileSync(path.join(root, 'docs/systems/llm/01-cost.md'), 'utf8');
const priceRow = (label) => cost.split('\n').find((x) => x.startsWith(`| ${label} |`)).split('|').slice(2, 5).map((x) => Number(x.trim()) / 1e6);
const OFF = priceRow('นอกช่วงเร่งด่วน');
const usd = (u) => (u.prompt_cache_hit_tokens || 0) * OFF[0] + (u.prompt_cache_miss_tokens ?? u.prompt_tokens) * OFF[1] + u.completion_tokens * OFF[2];

// shared prefix, the same text as scripts/llm/test-deepseek.mjs so the cache is shared
const RULES = `You write short in-game text for a Thai-language life simulation set in a fantasy world. The player is a weakened god who watches one person's whole life and can only nudge it.
Rules:
1. Write natural modern Thai. No English words, no numbers or codes in prose, no emoji.
2. Never state a fact that is not in the data you are given. Never decide an outcome, a dice roll, a death, or a world event.
3. Proper names: use only names listed in allowed_names or given in the data. Never invent a new name.
4. The god has no voice. Do not write lines spoken by the god. Write what people saw or understood.
5. Tone: plain and concrete, like a chronicle kept by a careful scribe. Warm or grim as the facts are, never purple.
6. Answer only in the format the task asks for. When asked for JSON, return one JSON object and nothing else.
7. When a choice must be made from a list, choose only from that list.`;

// ---------- families ----------
const CONT = [['อัซการ์', 'หมู่เกาะลอยฟ้า ศิลาลอย มังกรและเผ่าปีก'], ['มอร์เฮเวน', 'ดินแดนปีศาจ ค่ายเผ่า ทุ่งรบ'], ['คาซ-ดูรัม', 'ภูเขาไฟ เหมือง โรงตีเหล็ก'], ['เนเรีย', 'หมู่เกาะ ทะเล ปะการัง'], ['อัลเดรีย', 'ทุ่งราบ หมู่บ้าน วิหารแสง'], ['เมคาเรีย', 'เมืองจักรกล ไอน้ำ เรือเหาะ'], ['ซาฮารัน', 'ภูเขาและทะเลทราย โอเอซิส สุสานหิน'], ['ซิลวาเนล', 'ป่าโบราณ รากยักษ์ แสงลอดใบ'], ['เนบูเลีย', 'หมอก วิญญาณ บึง']];
const SEASON = ['ฤดูใบไม้ผลิ', 'ฤดูร้อน', 'ฤดูใบไม้ร่วง', 'ฤดูหนาว'];
const HINT = [['ระวัง', 'ให้เลือกทางที่ปลอดภัย'], ['กล้าเถิด', 'ให้กล้าเสี่ยง'], ['จงไป', 'ให้ออกเดินทางไปที่ที่ชี้'], ['จงอยู่', 'ให้อยู่ที่เดิม ไม่ย้าย'], ['จุดอ่อนของศัตรู', 'ให้เห็นจุดอ่อนของศัตรูในศึกถัดไป'], ['คนนั้นโกหก', 'ให้ระแวงคนหนึ่ง'], ['ช่วย', 'ให้ช่วยคนหนึ่ง'], ['สางเรื่อง', 'ให้นึกถึงเรื่องค้างของครอบครัว'], ['ชี้ทายาท', 'ให้มองลูกหลานคนหนึ่งต่างไป']];
// prayer kinds and one example line each, kept as a fixture (they were read from the POC prayer table, now deleted)
const PRAYER = JSON.parse(fs.readFileSync(path.join(root, 'scripts/llm/prayer-kinds.json'), 'utf8')).map((p) => [p.id, p.text]);
const RACE = ['มนุษย์', 'เอลฟ์', 'ออร์ค', 'คนแคระ', 'นาคา', 'เผ่าปีศาจ', 'ฮาล์ฟลิง', 'แวมไพร์', 'เงือก'];
const TIER = [['เคร่ง', 'เชื่อพระเจ้ามาก พูดอย่างนอบน้อม'], ['เชื่อ', 'เชื่อแบบคนทั่วไป'], ['ลังเล', 'ไม่แน่ใจว่ามีใครฟัง']];
const SLOT_OK = { omen: [], prayer: ['{ชื่อตัวละคร}', '{NPC}'] };

const FAMILIES = {
  omen: {
    task: `Task omen: write ${PER} different one-sentence Thai lines, each a small sign in the world that a person could notice and read as the given hint, set in the given continent and season. Signs are things like birds, weather, animals, a dropped object, a stranger's word; never a voice from the sky. Do not name the hint. 8 to 25 Thai words each. Return {"lines":[...]}.`,
    sets: () => HINT.flatMap((h) => CONT.flatMap((c) => SEASON.map((s) => ({ hint: h[0], hint_meaning: h[1], continent: c[0], continent_look: c[1], season: s })))),
    perFull: 20,
  },
  prayer: {
    task: `Task prayer: write ${PER} different one-sentence Thai lines of a person praying, for the given prayer kind, in the voice of the given race and faith level. Third person, starting with {ชื่อตัวละคร} or describing what {ชื่อตัวละคร} does. When the prayer is about another person, write {NPC} for that person. 10 to 30 Thai words each. Return {"lines":[...]}.`,
    sets: () => PRAYER.flatMap(([id, text]) => RACE.flatMap((r) => TIER.map((t) => ({ prayer: id, example: text.replace(/\{name\}/g, '{ชื่อตัวละคร}').replace(/\{npc\}|\{nemesis\}/g, '{NPC}'), race: r, faith: t[0], faith_note: t[1] })))),
    perFull: 10,
  },
};

// ---------- checks ----------
const norm = (s) => s.replace(/[\s\p{P}]/gu, '');
function check(line, fam) {
  if (typeof line !== 'string') return 'not text';
  const t = line.trim();
  if (/[A-Za-z]/.test(SLOT_OK[fam].reduce((x, slot) => x.split(slot).join(''), t))) return 'Latin letters';
  if (/[0-9๐-๙]/.test(t)) return 'digits';
  const slots = t.match(/\{[^}]*\}/g) || [];
  if (slots.some((x) => !SLOT_OK[fam].includes(x))) return 'unknown slot';
  const letters = [...t.replace(/\{[^}]*\}/g, '').replace(/[\s\p{P}]/gu, '')];
  if (letters.filter((c) => /[฀-๿]/.test(c)).length / Math.max(1, letters.length) < 0.98) return 'not Thai';
  if (t.length < 20 || t.length > 160) return 'length';
  if (fam === 'prayer' && !t.includes('{ชื่อตัวละคร}')) return 'no name slot'; // otherwise it names someone the game does not know
  return '';
}

async function call(messages) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, messages, temperature: 1.0, max_tokens: 1200, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } }), signal: AbortSignal.timeout(60000) });
      const j = await r.json();
      if (r.ok) return j;
      if (r.status === 429) await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
      else return { error: j?.error?.message };
    } catch (e) { if (attempt === 2) return { error: String(e) }; }
  }
  return { error: 'retries' };
}

const report = [];
const outDir = path.join(root, '.data', 'library');
fs.mkdirSync(outDir, { recursive: true });
for (const [fam, F] of Object.entries(FAMILIES)) {
  if (FAMILY !== 'all' && FAMILY !== fam) continue;
  let sets = F.sets();
  const total = sets.length;
  if (SETS) sets = [...new Set(Array.from({ length: SETS }, (_, i) => (i * 7919 + 13) % total))].map((i) => sets[i]); // a spread-out slice of the whole space
  const prefix = [{ role: 'system', content: RULES }, { role: 'user', content: F.task }, { role: 'assistant', content: 'รับทราบ' }];
  const st = { calls: 0, usd: 0, inTok: 0, hit: 0, outTok: 0, got: 0, kept: 0, reasons: {}, dupes: 0, bad: 0 };
  const lines = [], openings = new Map(); // the first ten letters within one hint or prayer kind, so similar moments do not open the same way
  let k = 1;
  const handle = async (set) => {
      const j = await call([...prefix, { role: 'user', content: JSON.stringify(set) }]);
      st.calls++;
      if (j.error) { st.bad++; return; }
      const u = j.usage; st.usd += usd(u); st.inTok += u.prompt_tokens; st.hit += u.prompt_cache_hit_tokens || 0; st.outTok += u.completion_tokens;
      let o; try { o = JSON.parse(j.choices[0].message.content); } catch { st.bad++; return; }
      const seen = new Set();
      for (const line of o.lines || []) {
        st.got++;
        const why = check(line, fam);
        if (why) { st.reasons[why] = (st.reasons[why] || 0) + 1; continue; }
        const n = norm(line), group = set.hint || set.prayer, open = group + ':' + norm(line.replace(/\{[^}]*\}/g, '')).slice(0, 10);
        if (seen.has(n)) { st.dupes++; continue; }
        if ((openings.get(open) || 0) >= Math.max(3, OPEN_CAP * PER * sets.filter((x) => (x.hint || x.prayer) === group).length)) { st.reasons['same opening'] = (st.reasons['same opening'] || 0) + 1; continue; }
        openings.set(open, (openings.get(open) || 0) + 1);
        seen.add(n); st.kept++;
        lines.push({ ...set, text: line.trim() });
      }
  };
  const worker = async () => { while (k < sets.length) await handle(sets[k++]); };
  await handle(sets[0]); // one call alone first, so the prefix is cached before the rest
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(path.join(outDir, `${fam}${SETS ? '-pilot' : ''}.jsonl`), lines.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const perKept = st.usd / Math.max(1, st.kept), fullLines = total * F.perFull;
  report.push({ fam, total, sets: sets.length, ...st, perKept, fullLines, fullUsd: perKept * fullLines, sample: lines.filter((_, i) => i % Math.max(1, Math.floor(lines.length / 6)) === 0).slice(0, 6) });
  process.stderr.write(`${fam}: ${st.calls} calls, kept ${st.kept}/${st.got}, $${st.usd.toFixed(4)}\n`);
}

const out = [];
out.push(`วัดเมื่อ ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC รุ่น \`${MODEL}\` ราคานอกช่วงเร่งด่วน ${PER} บรรทัดต่อคำขอ ส่งพร้อมกัน ${CONC} คำขอ`, '');
out.push('| ชุด | ชุดสถานะทั้งหมด | ทดลอง | คำขอ | บรรทัดที่ได้ | ผ่านตัวตรวจ | ซ้ำในชุด | เหตุที่ไม่ผ่าน | ชนแคช | ดอลลาร์ | ต่อบรรทัดที่เก็บ | คลังเต็ม (บรรทัด · ดอลลาร์) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of report) out.push(`| ${r.fam} | ${r.total} | ${r.sets} | ${r.calls} | ${r.got} | ${r.kept} (${Math.round((100 * r.kept) / Math.max(1, r.got))}%) | ${r.dupes} | ${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'} | ${Math.round((100 * r.hit) / Math.max(1, r.inTok))}% | ${r.usd.toFixed(4)} | ${r.perKept.toFixed(6)} | ${r.fullLines.toLocaleString('en-US')} · ${r.fullUsd.toFixed(2)} |`);
out.push('', '**ตัวอย่าง**', '');
for (const r of report) for (const x of r.sample) out.push(`- ${r.fam} (${r.fam === 'omen' ? `${x.hint} · ${x.continent} · ${x.season}` : `${x.prayer} · ${x.race} · ${x.faith}`}): ${x.text}`);
const md = out.join('\n');
if (process.argv.includes('--write')) {
  const FILE = path.join(root, 'docs/systems/llm/08-live-test.md');
  const doc = fs.readFileSync(FILE, 'utf8'), a = '<!-- llm-library:start -->', b = '<!-- llm-library:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + md + '\n' + b + doc.split(b)[1]);
  console.log('library pilot written to docs/systems/llm/08-live-test.md');
} else console.log(md);
