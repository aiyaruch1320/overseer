// Prompts live only on the server. The browser sends a task name and a few short fields; it can never send
// its own messages, so the API key cannot be used as a general-purpose chat proxy.
import { setupCatalog } from '../src/sim/setup';

const SYSTEM = 'คุณคือผู้บรรยายเกมจำลองชีวิตในโลกแฟนตาซีต่างโลก สไตล์นิยายไลท์โนเวลผสมนิทานพื้นบ้าน';

// keys an LLM-written flavor event may pick (the game maps them to fixed effects)
export const FX_KEYS = ['pow', 'mag', 'spd', 'luk', 'int', 'vit', 'gold', 'loss', 'fame', 'shame', 'hurt', 'heal', 'kind', 'cruel', 'brave', 'faith', 'doubt', 'none'];
const TOPICS = ['อาหาร', 'สัตว์', 'ข่าวลือ', 'สภาพอากาศ', 'เพื่อนบ้าน', 'ของหาย', 'เทศกาล', 'คนแปลกหน้า', 'งานที่ทำ', 'ครอบครัว', 'ความเชื่อ', 'เรื่องน่าอาย'];

// DeepSeek only creates cache units at the end of a user message, so the fixed rules sit in their own user turn
// → that whole prefix is billed at the cache-hit price after the first call
const RULES = `กติกาการบรรยาย:
- ตอบเป็นภาษาไทยเท่านั้น ห้ามมีคำภาษาอังกฤษ สั้นกระชับ บรรทัดเดียว ไม่ใช้ markdown ไม่ใส่เครื่องหมายคำพูดครอบทั้งข้อความ
- โทนดาร์ก ตลกร้าย หรืออบอุ่น ตามเหตุการณ์ ห้ามขัดแย้งกับข้อเท็จจริงที่ให้มา
- ต้องสมเหตุสมผลกับเผ่า ภูมิอากาศ วัย และอาชีพ (ทารกคิดซับซ้อนไม่ได้ เด็กยังไม่มีอาชีพ แวมไพร์แพ้แดด ภูตพรายแพ้เหล็ก ฯลฯ)
ข้อมูลตัวละครมาในรูปแบบ: ชื่อ|เผ่า|เพศ|อายุ|วัย|อาชีพ|ที่อยู่(ภูมิอากาศ)|นิสัย|ความเชื่อในเทพ(-100 ถึง 100)
งานที่จะได้รับ:
[ชะตา] เล่าเสริมผลลัพธ์ของจุดชะตา 2 ประโยค ให้มีรายละเอียดเฉพาะตัว
[ฝัน] ความคิดในใจของตัวละครหลังตื่นจากฝัน 1 ประโยค ถ้าระบุว่าฝันเลือนราง ให้ตัวละครเชื่อการตีความที่ผิดนั้นอย่างจริงจัง
[จารึก] คำจารึกหน้าหลุมศพแบบกวีหรือตลกร้าย ไม่เกิน 2 ประโยค
[สุ่ม] แต่งเหตุการณ์เล็ก ๆ ในชีวิตประจำวันตามหัวข้อ 1-2 ประโยค ตอบรูปแบบ ข้อความ||ผล โดยผลเลือกหนึ่งคำจาก: ${FX_KEYS.join(',')}
เฉพาะงาน [สุ่ม] เท่านั้นที่มี ||ผล งานอื่นตอบเป็นข้อความล้วน`;

let setupRules = '';
const SETUP_RULES = () => (setupRules ||= `คุณคือระบบสร้างตัวละครของเกมจำลองชีวิตต่างโลก อ่านคำขอของผู้เล่นแล้วเลือกค่าเริ่มต้นจากรายการนี้เท่านั้น
${setupCatalog()}
กติกา:
- ตอบเป็น JSON บรรทัดเดียวเท่านั้น รูปแบบ {"race":null,"gender":null,"climate":null,"religion":null,"continent":null,"traits":[],"aptitudes":[],"job":null,"birthTime":null,"birthSign":null,"blessing":null,"noble":false,"note":""}
- ใช้ id ภาษาอังกฤษตามรายการ ค่าที่ผู้เล่นไม่ได้พูดถึงให้เป็น null หรือ [] เพื่อให้เกมสุ่มเอง
- ห้ามทำให้ตัวละครเก่งเกินไป: traits ไม่เกิน 3, aptitudes ไม่เกิน 2, blessing ไม่เกิน 1 และใส่เฉพาะเมื่อผู้เล่นขอพรหรือพลังพิเศษจริง ๆ
- ถ้าผู้เล่นขอสิ่งที่ไม่มีในเกมหรือเกินขอบเขต เช่น อมตะ ไร้เทียมทาน skill พิเศษ อาชีพลับ เป็นผู้กล้าตั้งแต่เกิด ให้เลือกสิ่งใกล้เคียงที่สมดุล แล้วอธิบายใน note
- note เป็นภาษาไทยล้วน 1-2 ประโยค สรุปเฉพาะสิ่งที่อยู่ใน JSON ห้ามอ้างพลัง ค่าสถานะ หรือสิ่งที่ไม่ได้เลือก`);

const STAGE_TH: Record<string, string> = { infant: 'ทารก', child: 'เด็ก', teen: 'วัยรุ่น', adult: 'ผู้ใหญ่', elder: 'ชรา' };

// short, clean strings only
const cut = (v: unknown, n: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, n);
const line = (c: Record<string, unknown>) =>
  [c.name, c.race, c.gender, `${cut(c.age, 5)}ปี`, STAGE_TH[cut(c.stage, 10)] || '', c.job, `${cut(c.place, 60)}(${cut(c.climate, 30)})`, c.traits, c.belief].map((x) => cut(x, 60)).join('|');

export interface Built { messages: { role: string; content: string }[]; max_tokens: number; temperature: number; raw: boolean }

export function buildPrompt(task: string, d: Record<string, unknown>): Built | null {
  const narr = (user: string, max: number): Built => ({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: RULES }, { role: 'assistant', content: 'รับทราบ' }, { role: 'user', content: user }], max_tokens: max, temperature: 1.1, raw: false });
  switch (task) {
    case 'fate': return narr(`[ชะตา] ${line(d)}\nเหตุการณ์:${cut(d.event, 300)}\nเลือก:${cut(d.choice, 120)}\nผล:${cut(d.outcome, 200)}`, 140);
    case 'dream': return narr(`[ฝัน] ${line(d)}\nเห็น:${cut(d.symbol, 20)} ตีความว่า:${cut(d.meaning, 80)}${d.clear === 'false' ? ' (ฝันเลือนราง)' : ''}`, 70);
    case 'epitaph': return narr(`[จารึก] ${line(d)}\nชีวิต:${cut(d.summary, 240)}\nฉายา:${cut(d.title, 40)}`, 110);
    case 'flavor': return narr(`[สุ่ม] ${line(d)}\nหัวข้อ:${TOPICS.includes(String(d.topic)) ? d.topic : TOPICS[0]}`, 120);
    case 'setup': return { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: SETUP_RULES() }, { role: 'assistant', content: 'รับทราบ' }, { role: 'user', content: `คำขอของผู้เล่น: ${cut(d.wish, 300)}` }], max_tokens: 260, temperature: 0.3, raw: true };
    default: return null;
  }
}
