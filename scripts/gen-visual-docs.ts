// Writes docs/visuals/races.md and docs/visuals/specials.md from the theme and special-NPC data, so the docs cannot drift from the art.
import { writeFileSync } from 'node:fs';
import { THEMES, STAGES, STAGE_NAME, STAGE_AGE } from '../src/render/characters/themes';
import { SPECIALS } from '../src/data/specials';
import { NPC_CAST } from '../src/data/npcCast';
import { castById } from '../src/data/cast';
import { COUNTRY_DOCS } from '../src/data/countries';
import { blendOf } from '../src/data/blood';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const EARS: Record<string, string> = { round: 'หูกลม', long: 'หูยาวชี้ขึ้น', point: 'หูแหลมสั้น', beast: 'หูสัตว์บนหัว', fin: 'หูเป็นครีบ', none: 'ไม่มีหู' };
const LOWER: Record<string, string> = { legs: 'สองขา', serpent: 'ท่อนล่างเป็นหางงู', gown: 'ชายผ้าพลิ้วคล้ายครีบ', blob: 'ก้อนเจล' };
const GAIT: Record<string, string> = { normal: 'เดินปกติ', stomp: 'ก้าวหนัก', glide: 'ก้าวเบาลื่น', hop: 'กระโดดเบา ๆ', shamble: 'เดินลากเท้า', float: 'ลอยเหนือพื้น' };

let r = `# ธีมภาพของทั้ง 21 เผ่า\n\nสร้างจาก \`src/render/characters/themes.ts\` ด้วย \`npm run docs:visuals\` อย่าแก้ไฟล์นี้ด้วยมือ ดูภาพจริงที่ \`/characters.html\` ตอนรัน \`npm run dev\`\n\nเรื่องราวของแต่ละเผ่าอยู่ที่ [../races/README.md](../races/README.md) สายเลือดย่อยตรงกับตารางในไฟล์นั้น\n\n`;
for (const t of Object.values(THEMES)) {
  r += `## ${t.name} (\`${t.id}\`)\n\n${t.motif}\n\n`;
  r += `| รายการ | ค่า |\n| --- | --- |\n| ส่วนสูง | ${t.scale}× มนุษย์ (หัว ${t.head}× ไหล่ ${t.wide}×) |\n| หู | ${EARS[t.ears]} |\n| ท่อนล่าง | ${LOWER[t.lower]} |\n| ท่าเดิน | ${GAIT[t.gait]} |\n| สีผิว | ${t.skins.map(hex).join(' ')} |\n| สีประจำเผ่า | ${t.accent.map(hex).join(' ')} |\n| ลักษณะที่วาดเพิ่ม | ${t.feats.length ? t.feats.map((f) => `\`${f}\``).join(' ') : '-'} |\n`;
  if (t.gesture) r += `| ท่าประจำเผ่า | ${t.gesture.note} |\n`;
  r += '\n';
  const ls = Object.entries(t.lines);
  if (ls.length) { r += `| สายเลือดย่อย | ลักษณะ |\n| --- | --- |\n${ls.map(([k, v]) => `| ${v.name} (\`${k}\`) | ${v.note} |`).join('\n')}\n\n`; }
}
writeFileSync('docs/visuals/races.md', r);

let s = `# NPC พิเศษที่ออกแบบด้วยมือ\n\nสร้างจาก \`src/data/specials.ts\` ด้วย \`npm run docs:visuals\` มี ${SPECIALS.length} ตัว จากรายชื่อใน [../npcs/README.md](../npcs/README.md) (NPC อื่นอีก ${572 - SPECIALS.filter((x) => /^[A-Z]{2}\d{2}-\d$/.test(x.id)).length} ตัวได้ลักษณะจากเผ่า อายุ และบทบาทในเอกสารโดย \`src/data/cast.ts\`) ทุกตัวมีภาพตามช่วงวัยที่ระบุในคอลัมน์ช่วงชีวิต\n\nช่วงชีวิตใช้อายุเทียบมนุษย์ ${STAGES.map((g) => `${STAGE_NAME[g]} (${STAGE_AGE[g]})`).join(' · ')} เครื่องทรงยศ (มงกุฎ รัศมี ธง) จะมีเฉพาะวัยผู้ใหญ่ขึ้นไป ส่วนเด็กและวัยรุ่นสวมเสื้อธรรมดาแต่คงสีประจำตระกูลไว้\n\n| ID | ชื่อ | เผ่า · สาย | อายุ | ช่วงชีวิต | ดีไซน์ |\n| --- | --- | --- | --- | --- | --- |\n`;
for (const x of SPECIALS) s += `| ${x.id} | **${x.name}** ${x.title} | ${THEMES[x.race].name}${x.blend ? 'ครึ่ง' + THEMES[x.blend].name : ''}${x.line ? ' · ' + THEMES[x.race].lines[x.line].name : ''} | ${x.age} | ${x.stages.map((g) => STAGE_NAME[g]).join(' ')} | ${x.design} |\n`;
writeFileSync('docs/visuals/specials.md', s);

// where each of the NPCs was born, and how they look for it
const cname = (code: string) => COUNTRY_DOCS.find((c) => c.code === code)?.name ?? code;
let b = `# ถิ่นเกิดและลักษณะของ NPC ทั้ง ${NPC_CAST.length} ตัว\n\nสร้างจาก \`src/data/birth.ts\` และตารางใน [../character/01-origin.md](../character/01-origin.md) (หัวข้อ 3 และ 4) ด้วย \`npm run docs:visuals\` อย่าแก้ไฟล์นี้ด้วยมือ\n\nทุกตัวมีถิ่นเกิดเดียวที่ตรงกับเนื้อเรื่อง: คนเผ่าหนึ่งเกิดที่ถิ่นหลักของเผ่า (หรือชุมชนพลัดถิ่น) ตามเปอร์เซ็นต์ในตารางกำเนิด ลูกครึ่งเกิดที่ที่พ่อแม่สองเผ่าอยู่ร่วมกันได้ (ถ้าถิ่นที่อยู่ตรงกับถิ่นพบกัน มีโอกาสสูงที่เกิดที่นั่น) และเรื่องของ NPC เอง (เกิดในค่ายเชลย ผู้ลี้ภัย ผู้ถูกเนรเทศ) ชนะตัวเลข ผลต่อภาพ: ลูกครึ่งได้ลักษณะเด่นของเผ่าที่สองผสมกับเผ่าหลัก ([blood.ts](../../src/data/blood.ts)) และเสื้อผ้ากับสีตามภูมิอากาศของถิ่นเกิด\n\n| รหัส | ชื่อ | เผ่า | อาศัยอยู่ | เกิดที่ | เหตุ |\n| --- | --- | --- | --- | --- | --- |\n`;
let halfN = 0, abroadN = 0;
for (const row of NPC_CAST) {
  const c = castById(row[0])!, th = THEMES[c.race], mix = c.blend ? THEMES[c.blend].name : '';
  if (c.blend) halfN++;
  if (!c.birth.here) abroadN++;
  const res = row[0].replace(/^([A-Z]{2})(\d\d)-.*/, '$1-$2');
  b += `| ${row[0]} | ${c.name} | ${th.name}${mix ? 'ครึ่ง' + mix : ''} | ${cname(res)} (${res}) | ${c.birth.name} (${c.birth.code}) | ${c.birth.why} |\n`;
}
b += `\nลูกครึ่ง ${halfN} ตัว เกิดนอกถิ่นที่อาศัย ${abroadN} ตัว\n`;
writeFileSync('docs/visuals/birthplaces.md', b);
void blendOf;
console.log('ok');
