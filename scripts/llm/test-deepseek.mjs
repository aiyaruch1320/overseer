// Live test of the three LLM uses (docs/systems/llm/README.md section 2) against DeepSeek, with the key in .env.
// For setup, director and epitaph it sends sample inputs twice (cold, then warm) and records latency, real token counts,
// cache hits on the shared prefix, whether each answer passes the game's checks, and the answers themselves for reading.
// A second layout (data first, rules after) shows what a bad prompt order does to the cache.
// Usage: node scripts/llm/test-deepseek.mjs [--rounds=2] [--only=epitaph] [--write]
//   --write puts the tables and samples into docs/systems/llm/08-live-test.md between the llm-live markers.
import fs from 'fs';
import path from 'path';
import { root } from '../lib/paths.mjs';
import { races } from '../sim/sim-world.mjs';

const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = env.DEEPSEEK_API_KEY, MODEL = env.DEEPSEEK_MODEL || 'deepseek-flash', BASE = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
if (!KEY) throw new Error('no DEEPSEEK_API_KEY in .env');
const RUN = Date.now().toString(36); // makes every data part new, so only the shared prefix can hit the cache
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7); // run one task family only, for a quick retest
const ROUNDS = Number((process.argv.find((a) => a.startsWith('--rounds=')) || '--rounds=2').slice(9));

// prices per million tokens from docs/systems/llm/01-cost.md section 1 (off-peak and peak)
const cost = fs.readFileSync(path.join(root, 'docs/systems/llm/01-cost.md'), 'utf8');
const priceRow = (label) => cost.split('\n').find((x) => x.startsWith(`| ${label} |`)).split('|').slice(2, 5).map((x) => Number(x.trim()) / 1e6);
const PRICE = { peak: priceRow('ช่วงเร่งด่วน'), off: priceRow('นอกช่วงเร่งด่วน') };
const usd = (u, p = PRICE.off) => (u.prompt_cache_hit_tokens || 0) * p[0] + (u.prompt_cache_miss_tokens ?? u.prompt_tokens) * p[1] + u.completion_tokens * p[2];

// ---------- the shared prefix (01-cost.md section 3): rules in English, world brief in Thai ----------
const RULES = `You write short in-game text for a Thai-language life simulation set in a fantasy world. The player is a weakened god who watches one person's whole life and can only nudge it.
Rules:
1. Write natural modern Thai. No English words, no numbers or codes in prose, no emoji.
2. Never state a fact that is not in the data you are given. Never decide an outcome, a dice roll, a death, or a world event.
3. Proper names: use only names listed in allowed_names or given in the data. Never invent a new name.
4. The god has no voice. Do not write lines spoken by the god. Write what people saw or understood.
5. Tone: plain and concrete, like a chronicle kept by a careful scribe. Warm or grim as the facts are, never purple.
6. Answer only in the format the task asks for. When asked for JSON, return one JSON object and nothing else.
7. When a choice must be made from a list, choose only from that list.`;
const WORLD = `โลกนี้หลังมหาล่มสลาย พระเจ้าอ่อนแรง มังกรตำนานสิบห้าตัวเป็นผนึกที่ค้ำโลก เมื่อมังกรล้ม โลกเปลี่ยนรูปและยุคเปลี่ยน ยุคปลายเป็นการชิงกุญแจของผนึก
เก้าทวีป: อัซการ์ (หมู่เกาะลอยฟ้า ราชวงศ์มังกร เผ่าปีก) มอร์เฮเวน (ทวีปปีศาจ ออร์คและเผ่าปีศาจ) คาซ-ดูรัม (ทวีปแห่งไฟ ภูเขาไฟและคนแคระ) เนเรีย (หมู่เกาะ นาคาและเงือก) อัลเดรีย (ทุ่งราบ อาณาจักรมนุษย์ ศาสนจักรแห่งแสง) เมคาเรีย (เมืองจักรกลและเรือเหาะ) ซาฮารัน (ทะเลทราย มัมมี่และราชวงศ์ทราย) ซิลวาเนล (ป่าโบราณ เอลฟ์และต้นไม้โลก) เนบูเลีย (หมอกและวิญญาณ)
ยี่สิบเอ็ดเผ่า: ${races.map((r) => r.name).join(' ')}
ศาสนาหลัก: ศาสนจักรแห่งแสง บูชามังกร ต้นไม้โลก เทพแห่งสมุทร พญานาค เทพจันทรา เทพแห่งสงคราม บูชาปีศาจ บูชาบรรพบุรุษ และผู้ไม่นับถือ
ชีวิตหนึ่งมีคำถามของชีวิต (ลางตอนเกิดที่ผู้เล่นอยากรู้คำตอบ) คนที่เจอซ้ำไม่กี่คน และเรื่องค้างที่ส่งต่อถึงทายาท`;
const prefix = [{ role: 'system', content: RULES }, { role: 'user', content: WORLD }, { role: 'assistant', content: 'รับทราบ' }];

// ---------- task parts ----------
const TRAITS = JSON.parse(fs.readFileSync(path.join(root, 'data/gen/traits.json'), 'utf8')).items.traits.map((t) => [t.id, t.name]);
const RACES = races.map((r) => [r.code, r.name]);
const CONT = [['AZ', 'อัซการ์'], ['MH', 'มอร์เฮเวน'], ['KD', 'คาซ-ดูรัม'], ['NR', 'เนเรีย'], ['AL', 'อัลเดรีย'], ['MK', 'เมคาเรีย'], ['SH', 'ซาฮารัน'], ['SV', 'ซิลวาเนล'], ['NB', 'เนบูเลีย']];
const setupTool = {
  type: 'function',
  function: {
    name: 'wish_sheet', strict: true,
    description: 'Fill the wish sheet from the player request. Use none or an empty list when the request does not mention a field.',
    parameters: {
      type: 'object', additionalProperties: false,
      required: ['race', 'continent', 'wealth', 'traits', 'story', 'impossible', 'note'],
      properties: {
        race: { type: 'string', enum: [...RACES.map((x) => x[0]), 'none'] },
        continent: { type: 'string', enum: [...CONT.map((x) => x[0]), 'none'] },
        wealth: { type: 'string', enum: ['poorest', 'poor', 'middle', 'rich', 'noble', 'none'] },
        traits: { type: 'array', items: { type: 'string', enum: TRAITS.map((x) => x[0]) } },
        story: { type: 'array', items: { type: 'string', enum: ['orphan', 'meets_dragon', 'tragic', 'romance', 'war', 'faithless', 'faithful', 'wanderer', 'rise', 'fall'] } },
        impossible: { type: 'array', items: { type: 'string' }, description: 'things asked that the game cannot give, in Thai' },
        note: { type: 'string', description: 'one Thai sentence telling the player what was set' },
      },
    },
  },
};
const SETUP_TASK = `Task setup: read a player's request (Thai, may be slang) for the character they want and call wish_sheet.
Catalog (code = Thai name). Races: ${RACES.map((x) => x.join('=')).join(', ')}. Continents: ${CONT.map((x) => x.join('=')).join(', ')}. Wealth: poorest poor middle rich noble. Traits: ${TRAITS.map((x) => x.join('=')).join(', ')}.
At most 3 traits. Never two traits that contradict. If the request asks for something the game cannot give (immortal, strongest in the world, all powers), pick the nearest real values and list the impossible part.`;
const directorTool = {
  type: 'function',
  function: {
    name: 'direct', strict: true,
    description: 'Pick which of the two paths would make this life feel more like one connected story.',
    parameters: { type: 'object', additionalProperties: false, required: ['pick', 'reason'], properties: { pick: { type: 'string', enum: ['a', 'b'] }, reason: { type: 'string', enum: ['old_face', 'dream', 'life_question', 'vow', 'rest', 'tension'] } } },
  },
};
const DIRECTOR_TASK = `Task director: you get the memory of one life (up to eight lines) and the two paths the game ranked highest at a story fork. Call direct with the path that ties back to the memory best. Reasons: old_face (someone seen before returns), dream (a dream sent before), life_question, vow, rest (after a big event, a quiet path), tension (after a long quiet, a path with conflict). The game still rolls the dice; you only nudge.`;
const EPITAPH_TASK = `Task epitaph: you get the facts of one finished life in time order and allowed_names. Return JSON:
{"summary":"3 to 5 Thai sentences telling the life from the facts, in order","card_title":"a title of at most 8 Thai words","card_line":"one Thai sentence for the share card","epitaph":"a gravestone line, at most 20 Thai words, in the style of the race","vow_page":"2 Thai sentences, or empty string when vow is empty"}
The vow belongs to the god (the player), not to the character; the character never knew it. Write vow_page in the third person about the life ("คำปฏิญาณว่า ... เป็นจริง/ไม่เป็นจริง"), never in the god's voice (no ข้า or เรา for the god).
character is the person whose life this is; call them by character.name and character.pronoun only. Use only the facts. Do not add events, causes or feelings the facts do not hold. Every field must be Thai script only, whatever the race's culture.`;
const task = (t) => [{ role: 'user', content: t }, { role: 'assistant', content: 'รับทราบ' }];

// ---------- samples ----------
const SETUP = [
  'อยากเล่นเป็นเด็กกำพร้าที่โตมาเป็นนักดาบ แต่ใจดีเกินไป',
  'ขอเผ่าที่อายุยืนแต่ไม่เอาเอลฟ์ อยู่ใกล้ทะเล',
  'อยากได้ชีวิตโศก ๆ พ่อแม่ตายตั้งแต่เด็ก',
  'ตัวละครที่ไม่เชื่อพระเจ้าเลยสักนิด ขี้ระแวง',
  'อมตะ เก่งที่สุดในโลก มีพลังทุกธาตุ',
  'ลูกพ่อค้าในเมืองทะเลทราย ขี้โกงนิดหน่อย',
  'อะไรก็ได้ ขอให้ได้เจอมังกรสักครั้ง',
  'หุ่นที่อยากเป็นมนุษย์ อยู่เมืองจักรกล',
];
const DIRECTOR = [
  { memory: ['คำถามของชีวิต: เด็กคนนี้จะได้กลับบ้านเกิดไหม', 'คำปฏิญาณ: ให้เขากลับบ้าน', 'คนที่เจอซ้ำ: ครูดาบชื่อเคเรน', 'ความฝันที่ทำตาม: ตามแม่น้ำลงใต้ (อายุ 19)', 'เหตุการณ์ล่าสุด: ศึกชายแดน (อายุ 31)'], a: 'ข่าวว่าเคเรนป่วยหนักที่เมืองริมแม่น้ำ', b: 'พ่อค้าแปลกหน้าชวนไปค้าขายต่างทวีป' },
  { memory: ['คำถามของชีวิต: เธอจะพบรักแท้ไหม', 'คนที่เจอซ้ำ: เพื่อนวัยเด็กชื่อมีรา', 'เหตุการณ์ล่าสุด: เมืองถูกไฟผลาญ (อายุ 40 เมื่อปีก่อน)'], a: 'งานเทศกาลเก็บเกี่ยวของหมู่บ้าน', b: 'กลุ่มโจรปล้นคาราวานบนถนนใหญ่' },
  { memory: ['คำถามของชีวิต: เขาจะแก้แค้นได้ไหม', 'เรื่องค้าง: ผู้ทรยศที่ขายพ่อเขาให้ทัพศัตรู', 'ความฝันที่ปฏิเสธ: ให้อภัยผู้ทรยศ (อายุ 25)', 'ช่วงเงียบ: หกปีไม่มีเรื่องใหญ่'], a: 'ข่าวลือว่าผู้ทรยศซ่อนอยู่ในเมืองท่า', b: 'ลูกสาวป่วยเล็กน้อยต้องหาหมอ' },
  { memory: ['คำปฏิญาณ: ให้เขาเห็นมังกร', 'คนที่เจอซ้ำ: ผู้ปรนนิบัติมังกรชื่ออาลัน', 'เหตุการณ์ล่าสุด: มังกรเซเรเนกระวนกระวาย'], a: 'อาลันขอให้ช่วยขนเครื่องบรรณาการขึ้นเขา', b: 'งานจ้างคุ้มกันกองคาราวานไปทางเหนือ' },
  { memory: ['คำถามของชีวิต: เขาจะเป็นราชาไหม', 'คนที่เจอซ้ำ: พี่ชายต่างแม่ชื่อดาริอุส', 'ความฝันที่ทำตาม: ยืนบนบันไดวัง (อายุ 22)', 'เหตุการณ์ล่าสุด: พระราชาสิ้น (อายุ 35)'], a: 'ดาริอุสส่งจดหมายเชิญไปเจรจาลับ', b: 'สภาขุนนางเรียกประชุมเลือกผู้สำเร็จราชการ' },
  { memory: ['คำถามของชีวิต: เธอจะหายจากคำสาปไหม', 'คำปฏิญาณ: ให้เขาตายอย่างสงบ', 'เหตุการณ์ล่าสุด: ศึกใหญ่ที่เธอเกือบตาย (อายุ 50 เมื่อสองปีก่อน)'], a: 'หมอผีเร่ร่อนบอกว่ารู้วิธีถอนคำสาปที่หุบเขาไกล', b: 'หลานมาขอให้สอนทอผ้า' },
];
const EPITAPH = [
  { character: { name: 'ทอร์เวน', pronoun: 'เขา' }, race: 'มนุษย์', allowed_names: ['ทอร์เวน', 'ลีอา', 'เคเรน', 'โซลาริส'], vow: 'ให้เขากลับบ้าน (สำเร็จ)', facts: ['เกิด ศ.ม. 10,402 ลูกชาวนาในโซลาริส', 'คำถามของชีวิต: จะได้กลับบ้านเกิดไหม', 'อายุ 14 หมู่บ้านถูกน้ำท่วม ครอบครัวย้ายไปเมืองท่า', 'อายุ 20 เป็นศิษย์ของครูดาบเคเรน', 'อายุ 33 ทำตามความฝันที่ชี้ให้กลับขึ้นเหนือ', 'อายุ 41 สร้างบ้านบนที่เดิมของหมู่บ้าน', 'อายุ 68 ตายในบ้านนั้นตามอายุขัย'] },
  { character: { name: 'โบรก', pronoun: 'เขา' }, race: 'ออร์ค', allowed_names: ['โบรก', 'กรุก', 'ทัพหมาป่าเหล็ก'], vow: 'ให้คู่แข่งของเขาล้ม (ไม่สำเร็จ)', facts: ['เกิดในเผ่าของทัพหมาป่าเหล็ก', 'คำถามของชีวิต: จะได้เป็นหัวหน้าเผ่าไหม', 'อายุ 16 แพ้ประลองให้กรุก', 'อายุ 25 ปฏิเสธความฝันที่ให้ออกจากเผ่า', 'อายุ 30 พระเจ้าลงโทษคำขอของเขา', 'อายุ 34 ตายในศึกเคียงข้างกรุก'] },
  { character: { name: 'เอลิเนีย', pronoun: 'เธอ' }, race: 'เอลฟ์', allowed_names: ['เอลิเนีย', 'ไอลีน', 'ซิลเวรา', 'ต้นไม้โลก'], vow: '', facts: ['เกิดใต้ต้นไม้โลก', 'คำถามของชีวิต: ต้นไม้โลกจะรอดไหม', 'อายุ 30 เห็นมังกรซิลเวราล้ม', 'อายุ 45 ได้ฉายาผู้รักษาหลังช่วยคนจากโรคใบเหี่ยว', 'อายุ 70 สอนศิษย์ชื่อไอลีน', 'อายุ 75 ตายตามอายุขัย ต้นไม้โลกยังยืน'] },
];

// ---------- calls ----------
async function call(messages, { tools, toolName, json, temperature = 0.3, max_tokens = 400, beta = false }) {
  const body = { model: MODEL, messages, temperature, max_tokens, stream: false, thinking: { type: 'disabled' } };
  if (tools) { body.tools = tools; body.tool_choice = { type: 'function', function: { name: toolName } }; }
  if (json) body.response_format = { type: 'json_object' };
  const t0 = Date.now();
  const r = await fetch(`${beta ? BASE + '/beta' : BASE}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const j = await r.json();
  const ms = Date.now() - t0;
  if (!r.ok) return { ok: false, ms, error: j?.error?.message || String(r.status) };
  const m = j.choices?.[0]?.message || {};
  const out = tools ? m.tool_calls?.[0]?.function?.arguments : m.content;
  return { ok: true, ms, out: out ?? '', usage: j.usage || {}, finish: j.choices?.[0]?.finish_reason };
}
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const thaiShare = (s) => { const t = String(s).replace(/[\s\p{P}\d]/gu, ''); return t ? [...t].filter((c) => /[฀-๿]/.test(c)).length / [...t].length : 0; };
const checkSetup = (o) => {
  if (!o) return 'not JSON';
  if (o.race && o.race !== 'none' && !RACES.some((x) => x[0] === o.race)) return 'race not in enum';
  if (o.continent && o.continent !== 'none' && !CONT.some((x) => x[0] === o.continent)) return 'continent not in enum';
  if ((o.traits || []).length > 3) return 'too many traits';
  if ((o.traits || []).some((t) => !TRAITS.some((x) => x[0] === t))) return 'trait not in enum';
  if (thaiShare(o.note) < 0.9) return 'note not Thai';
  return '';
};
const checkDirector = (o) => (!o ? 'not JSON' : !['a', 'b'].includes(o.pick) ? 'pick not a/b' : !['old_face', 'dream', 'life_question', 'vow', 'rest', 'tension'].includes(o.reason) ? 'reason not in enum' : '');
const checkEpitaph = (o, s) => {
  if (!o) return 'not JSON';
  for (const k of ['summary', 'card_title', 'card_line', 'epitaph', 'vow_page']) if (typeof o[k] !== 'string') return `no ${k}`;
  const all = ['summary', 'card_title', 'card_line', 'epitaph', 'vow_page'].map((k) => o[k]).join(' '); // extra keys are ignored by the game
  if (/[A-Za-z]/.test(all)) return 'Latin letters';
  if (thaiShare(all) < 0.95) return 'not Thai';
  const sentences = o.summary.split(/\s{1,}|(?<=[.!?])/).filter(Boolean).length;
  if (o.epitaph.length > 120) return 'epitaph too long';
  if (!s.vow && o.vow_page) return 'vow page without vow';
  if (/ข้า(?![งม])|เรา(?!ะ)/.test(o.vow_page)) return 'vow page in the god voice';
  return '';
};

const runs = [];
async function batch(name, items, build, opts, check) {
  if (ONLY && !name.startsWith(ONLY)) return;
  for (let round = 1; round <= ROUNDS; round++) for (const [k, item] of items.entries()) {
    let r = await call(build(item), opts);
    if (!r.ok && opts.beta) { r = await call(build(item), { ...opts, beta: false }); r.nonBeta = true; }
    const o = r.ok ? parse(r.out) : null;
    const err = r.ok ? check(o, item) : r.error;
    runs.push({ name, round, k, ...r, err, o });
    process.stderr.write(`${name} r${round} #${k} ${r.ms}ms ${err || 'ok'} hit=${r.usage?.prompt_cache_hit_tokens ?? '-'} miss=${r.usage?.prompt_cache_miss_tokens ?? '-'} out=${r.usage?.completion_tokens ?? '-'}\n`);
  }
}

await batch('setup', SETUP, (s) => [...prefix, ...task(SETUP_TASK), { role: 'user', content: `request: ${s} (${RUN})` }], { tools: [setupTool], toolName: 'wish_sheet', beta: true }, checkSetup);
await batch('director', DIRECTOR, (d) => [...prefix, ...task(DIRECTOR_TASK), { role: 'user', content: JSON.stringify({ memory: d.memory, a: d.a, b: d.b, run: RUN }) }], { tools: [directorTool], toolName: 'direct', beta: true, max_tokens: 60 }, checkDirector);
await batch('epitaph', EPITAPH, (e) => [...prefix, ...task(EPITAPH_TASK), { role: 'user', content: JSON.stringify({ ...e, run: RUN }) }], { json: true, temperature: 1.0, max_tokens: 900 }, checkEpitaph);
// position bias: the same forks with a and b swapped; a fair director picks the same path
await batch('director (swapped)', DIRECTOR, (d) => [...prefix, ...task(DIRECTOR_TASK), { role: 'user', content: JSON.stringify({ memory: d.memory, a: d.b, b: d.a, run: RUN }) }], { tools: [directorTool], toolName: 'direct', beta: true, max_tokens: 60 }, checkDirector);
// bad layout: the data first and the rules after it, so nothing before the data repeats
await batch('setup (data first)', SETUP.slice(0, 4), (s) => [{ role: 'user', content: `(${RUN}) request: ${s}\n\n${RULES}\n\n${WORLD}\n\n${SETUP_TASK}` }], { tools: [setupTool], toolName: 'wish_sheet', beta: true }, checkSetup);

// ---------- report ----------
const out = [];
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
out.push(`วัดเมื่อ ${now} UTC รุ่น \`${MODEL}\` ปิดโหมดคิด ส่งซ้ำ ${ROUNDS} รอบ (รอบแรกแคชเย็น) ราคาคิดนอกช่วงเร่งด่วนจาก [01-cost.md](01-cost.md) หัวข้อ 1`, '');
out.push('| งาน | รอบ | คำขอ | ผ่านตัวตรวจ | เวลา p50 · p90 (มิลลิวินาที) | เข้า (เฉลี่ย) | ชนแคช | ออก (เฉลี่ย) | ดอลลาร์ต่อคำขอ |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const name of [...new Set(runs.map((r) => r.name))]) for (let round = 1; round <= ROUNDS; round++) {
  const a = runs.filter((r) => r.name === name && r.round === round), ok = a.filter((r) => r.ok);
  const inT = ok.map((r) => r.usage.prompt_tokens), hit = ok.reduce((s, r) => s + (r.usage.prompt_cache_hit_tokens || 0), 0), tot = ok.reduce((s, r) => s + r.usage.prompt_tokens, 0);
  out.push(`| ${name} | ${round} | ${a.length} | ${a.filter((r) => !r.err).length} | ${q(a.map((r) => r.ms), 0.5)} · ${q(a.map((r) => r.ms), 0.9)} | ${Math.round(inT.reduce((s, x) => s + x, 0) / Math.max(1, ok.length))} | ${tot ? Math.round((100 * hit) / tot) : 0}% | ${Math.round(ok.reduce((s, r) => s + r.usage.completion_tokens, 0) / Math.max(1, ok.length))} | ${(ok.reduce((s, r) => s + usd(r.usage), 0) / Math.max(1, ok.length)).toFixed(6)} |`);
}
const fails = runs.filter((r) => r.err);
const pairs = runs.filter((r) => r.name === 'director' && r.o).map((r) => [r, runs.find((x) => x.name === 'director (swapped)' && x.round === r.round && x.k === r.k)]).filter(([, x]) => x?.o);
const same = pairs.filter(([a, b]) => a.o.pick !== b.o.pick).length;
const firstA = runs.filter((r) => r.name.startsWith('director') && r.o).filter((r) => r.o.pick === 'a').length / Math.max(1, runs.filter((r) => r.name.startsWith('director') && r.o).length);
out.push('', `ผู้กำกับเลือกทางเดิมเมื่อสลับตำแหน่ง ${same} จาก ${pairs.length} คู่ · เลือกตำแหน่งแรก ${Math.round(100 * firstA)}% ของคำตอบทั้งหมด (ไม่มีอคติตำแหน่ง ≈ 50%)`);
out.push('', `ไม่ผ่านตัวตรวจ ${fails.length} จาก ${runs.length} คำขอ${fails.length ? ': ' + fails.map((r) => `${r.name} #${r.k} (${r.err})`).join(' · ') : ''}`);
if (runs.some((r) => r.nonBeta)) out.push('', 'tool call แบบ strict ที่ปลายทาง `/beta` ใช้ไม่ได้ จึงส่งที่ปลายทางปกติแทน');
out.push('', '**ตัวอย่างคำตอบ** (รอบแรก)', '');
for (const r of runs.filter((x) => x.round === 1 && x.name === 'setup')) out.push(`- setup "${SETUP[r.k]}" → \`${JSON.stringify(r.o)}\``);
for (const r of runs.filter((x) => x.round === 1 && x.name === 'director')) out.push(`- director #${r.k + 1} (ก: ${DIRECTOR[r.k].a} · ข: ${DIRECTOR[r.k].b}) → ${r.o ? `${r.o.pick} ${r.o.reason}` : r.err}`);
for (const r of runs.filter((x) => x.round === 1 && x.name === 'epitaph')) {
  const o = r.o || {};
  out.push(`- epitaph ${EPITAPH[r.k].race}: **${o.card_title ?? ''}** · ${o.card_line ?? ''}`, `  - สรุป: ${o.summary ?? r.err}`, `  - จารึก: ${o.epitaph ?? ''}`, ...(o.vow_page ? [`  - หน้าคำปฏิญาณ: ${o.vow_page}`] : []));
}
const md = out.join('\n');
fs.writeFileSync(path.join(root, '.data', 'llm-live-test.json'), JSON.stringify(runs, null, 1));
if (process.argv.includes('--write')) {
  const FILE = path.join(root, 'docs/systems/llm/08-live-test.md');
  const doc = fs.readFileSync(FILE, 'utf8'), a = '<!-- llm-live:start -->', b = '<!-- llm-live:end -->';
  if (!doc.includes(a) || !doc.includes(b)) throw new Error('markers missing');
  fs.writeFileSync(FILE, doc.split(a)[0] + a + '\n' + md + '\n' + b + doc.split(b)[1]);
  console.log(`llm live test: ${runs.length} calls · ${fails.length} failed checks · written to docs/systems/llm/08-live-test.md`);
} else console.log(md);
