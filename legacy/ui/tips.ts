// Hover explanations. Elements carry data-tip="kind:id"; the text is built on demand from game data,
// so every blessing, skill, trait, stat and power explains exactly what it does.
import { STAT_NAMES, AXIS_NAMES, type StatKey, type Axis } from '../sim/types';
import { fmtDelta, COSTS } from '../sim/game';
import { giftById } from '../data/gifts';
import { skillById, traitById, aptById } from '../data/traits';
import { jobById, SYMBOLS } from '../data/lore';
import { RARITY, THREAD_NAMES, TAG_AFF, type Rarity } from '../sim/fortune';
import { QUESTS, MAP_POWERS } from '../data/prayers';
import { ic } from './icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// What the important tags actually do in play
export const TAG_DESC: Record<string, string> = {
  light: 'ได้เปรียบอันเดด ปีศาจ และแวมไพร์ (+4 ทอยเมื่อสู้ศัตรูที่แพ้แสง)', holy: 'พลังศักดิ์สิทธิ์ ใช้ได้กับศัตรูที่แพ้ของศักดิ์สิทธิ์ และช่วยในพิธีกรรม',
  undead_bane: '+4 ทอยเมื่อสู้อันเดด', demon_bane: '+4 ทอยเมื่อสู้ปีศาจ', dragon_bane: '+4 ทอยเมื่อสู้มังกร',
  fire: 'ได้เปรียบโทรลล์ มัมมี่ เอนท์ สไลม์ มังกรน้ำแข็ง', ice: 'ได้เปรียบมังกรเพลิง อสูรเพลิง ไวเวิร์น', water: 'ได้เปรียบอสูรเพลิงและหนอนทราย', lightning: 'ได้เปรียบคราเคน ไวเวิร์น โกเลม',
  blade: 'อาวุธมีคม (บางศัตรูต้านทาน)', blunt: 'อาวุธทุบ ได้เปรียบโครงกระดูกและแมงป่อง', ranged: 'โจมตีระยะไกล ได้เปรียบศัตรูบินได้', rune: 'ได้เปรียบโกเลมและงานเวทอักษร',
  fire_res: 'ไม่กลัวไฟ ทนลาวาและเปลวมังกร', cold_res: 'ไม่กลัวความหนาว', heat_res: 'ทนแดดทะเลทราย', poison_res: 'ต้านพิษ', plague_res: 'ไม่ติดโรคระบาดง่าย',
  curse_ward: 'คำสาปที่ส่งมาจะเด้งกลับ', monster_ward: 'มอนสเตอร์เข้าใกล้น้อยลงมาก', mind_ward: 'เสน่ห์และมายาใช้ไม่ได้ผล',
  last_stand: 'เมื่อจะตาย รอดได้หนึ่งครั้ง (พรนี้จะหายไป)', rewind: 'เมื่อจะตาย ย้อนเวลาได้หนึ่งครั้ง', guardian_angel: '50% รอดตายเมื่อบาดเจ็บสาหัส', regen: 'ฟื้น HP เร็วขึ้นสองเท่า', longevity: 'อายุขัย +12 ปี (มนุษย์)',
  hero_luck: '+1 ทุกการทอย', lucky: 'โอกาสทอยใหม่เมื่อพลาด +15%', second_chance: 'โอกาสทอยใหม่เมื่อพลาด +20%', jinx: 'โอกาสทอยใหม่ลดลง',
  seer: 'มองเห็นชื่อเส้นชะตาล่วงหน้า', oracle: 'ได้ยินเสียงเทพชัด: ฝันชัดขึ้น สวดบ่อยขึ้น เชื่อฟังเสียงกระซิบง่ายขึ้น', lucid: 'ความฝันชัดขึ้น +25%',
  charm: 'ได้เปรียบเรื่องความรักและการเจรจา', leader: 'ได้เปรียบเมื่อนำผู้คน', stealth: 'หนีและลอบเร้นได้ดี', trade: 'ได้เปรียบการค้า',
  beast_friend: 'สื่อสารและสงบสัตว์อสูรได้', treasure: 'หาสมบัติเจอบ่อยขึ้น', polyglot: 'คุยกับทุกเผ่า รวมถึงมังกร',
  weak_sun: 'โดนแดดแล้วบาดเจ็บ (ทะเลทรายอันตราย)', weak_light: 'แพ้พลังแสง', weak_iron: 'อาวุธเหล็กทำร้ายได้มาก', weak_ice: 'แพ้ความหนาว', weak_fire: 'แพ้ไฟ',
  short_life: 'อายุขัย -22 ปี (มนุษย์)', fast_aging: 'อายุขัย -10 ปี', barren: 'มีลูกไม่ได้', love_doom: 'คนรักมีโอกาสตายด้วยโรคประหลาด', monster_lure: 'มอนสเตอร์มาหาบ่อยขึ้น 2 เท่า',
  poverty: 'ได้เงินเพียงครึ่งเดียว', gold_luck: 'ได้เงินเพิ่ม 50%', fate_chain: 'ฝืนชะตาแพงขึ้นสองเท่า', fate_shift: 'ฝืนชะตาถูกลงครึ่งหนึ่ง', nightmare: 'ฝันเลือนรางบ่อยขึ้น',
  undead: 'เป็นอันเดด', dark: 'พลังความมืด', necro: 'วิชาปลุกผี', infernal: 'สายเลือดนรก',
};

const tagLine = (tags: string[]) => tags.map((t) => `<div class="tip-tag">${esc(t)}${TAG_DESC[t] ? ` — ${esc(TAG_DESC[t])}` : ''}</div>`).join('');
const fx = (s: string) => { const d = fmtDelta(s); return d ? `<div class="tip-fx">ผล: ${esc(d)}</div>` : ''; };
const affLine = (tags: string[]) => {
  const keys = [...new Set(tags.flatMap((t) => TAG_AFF[t] || []))].slice(0, 5);
  return keys.length ? `<div class="tip-dim">สุ่มเจอบ่อยขึ้นเมื่อ: ${esc(keys.map((k) => k.replace('thread:', 'เส้นทาง').replace('religion:', 'ศาสนา ').replace('birth:', 'เกิดยาม ').replace('birthsign:', 'เกิดใต้ ').replace('race:', 'เผ่า ').replace('job:', 'อาชีพ ').replace('climate:', '')).join(', '))}</div>` : '';
};
const rar = (r: Rarity) => `<span style="color:${RARITY[r].color}">${RARITY[r].name}</span>`;

const STAT_DESC: Record<StatKey, string> = {
  pow: 'แรงต่อสู้ระยะประชิด งานใช้แรง ทอยเช็กด้วยกายภาพ', mag: 'พลังเวท ร่ายเวทใส่อสูร พิธีกรรม', spd: 'หลบหนี ลอบเร้น ยิงธนู',
  luk: 'โอกาสทอยใหม่เมื่อพลาด (+1.5% ต่อแต้ม) และเหตุการณ์ที่ต้องเสี่ยงดวง', int: 'การเรียนรู้ เจรจา วางแผน ความชัดของฝัน', vit: 'HP สูงสุด (40 + 4×แต้ม) อายุขัย ความทนทาน',
};

export function tipHtml(key: string): string {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  switch (kind) {
    case 'gift': {
      const g = giftById(id);
      if (!g) return '';
      return `<b>${g.kind === 'blessing' ? ic('bless', 14) + ' พร' : ic('curse', 14) + ' คำสาป'}「${esc(g.name)}」</b> ${rar(g.rarity)}<div>${esc(g.desc)}</div>${fx(g.fx)}${tagLine(g.tags)}${affLine(g.tags)}<div class="tip-dim">ราคา ${g.kind === 'blessing' ? RARITY[g.rarity].faith + ' ศรัทธา' : RARITY[g.rarity].dread + ' ความกลัว'}</div>`;
    }
    case 'skill': {
      const s = skillById(id);
      if (!s) return '';
      return `<b>${esc(s.name)}</b> ${s.unique ? '<span style="color:#9ad8ff">Unique Skill</span>' : `· ${esc(s.apt ? aptById(s.apt).name : '')} ระดับ ${s.tier}`}${s.desc ? `<div>${esc(s.desc)}</div>` : ''}${fx(s.fx)}${tagLine(s.tags)}<div class="tip-dim">ทักษะระดับถัดไปได้จากการฝึก อาจารย์ หรือเหตุการณ์</div>`;
    }
    case 'trait': {
      const t = traitById(id);
      return `<b>นิสัย: ${esc(t.name)}</b><div>${esc(t.desc)}</div>${fx(t.fx)}<div class="tip-dim">นิสัยเปลี่ยน "แนวโน้ม" ที่ตัวละครจะเลือกในแต่ละเหตุการณ์</div>`;
    }
    case 'apt': {
      const a = aptById(id);
      return `<b>ความถนัด: ${esc(a.name)}</b><div>ปลดล็อกทักษะ 3 ระดับ (${a.skills.map((s) => esc(skillById(s).name)).join(' → ')}) ทักษะแต่ละระดับเพิ่ม${STAT_NAMES[a.stat]}</div>${tagLine(a.tags)}`;
    }
    case 'stat': return `<b>${STAT_NAMES[id as StatKey]}</b><div>${STAT_DESC[id as StatKey]}</div><div class="tip-dim">โบนัสทอย = (ค่า − 10) ÷ 2 ปัดลง</div>`;
    case 'axis': { const [a, b] = AXIS_NAMES[id as Axis]; return `<b>${b} ↔ ${a}</b><div>บุคลิกที่ขยับได้ตามประสบการณ์ ใช้คำนวณว่าตัวละครอยากเลือกทางไหน</div>`; }
    case 'job': {
      const j = jobById(id);
      return `<b>${ic(j.icon, 14)} ${esc(j.name)}</b>${j.secret ? ' <span style="color:var(--gold)">อาชีพลับ</span>' : ` ${rar(j.r || 'C')}`}<div>${esc(j.desc)}</div>${j.apts.length ? `<div class="tip-dim">เหมาะกับความถนัด: ${j.apts.map((a) => esc(aptById(a).name)).join(', ')}</div>` : ''}<div class="tip-dim">อาชีพเปิดเหตุการณ์เฉพาะของอาชีพนั้น</div>`;
    }
    case 'rarity': return `<b>${rar(id as Rarity)}</b><div>น้ำหนักการสุ่ม ${RARITY[id as Rarity].w} (ธรรมดา = 100) · ราคา ${RARITY[id as Rarity].faith} ศรัทธา / ${RARITY[id as Rarity].dread} ความกลัว · พลังอาวุธ +${RARITY[id as Rarity].power}</div>`;
    case 'thread': return `<b>เส้นเรื่อง: ${esc(THREAD_NAMES[id] || id)}</b><div>สะสมจากทางที่ตัวละครเลือกและพรที่คุณให้ ค่อย ๆ จางลงตามเวลา ยิ่งสูง เหตุการณ์และของที่เกี่ยวข้องยิ่งโผล่บ่อย</div>`;
    case 'quest': { const q = QUESTS.find((x) => x.id === id); return q ? `<b>${ic(q.icon, 14)} ${esc(q.name)}</b><div>${esc(q.desc)}</div><div class="tip-dim">รางวัล: ${q.reward.faith ? `ศรัทธา +${q.reward.faith} ` : ''}${q.reward.dread ? `ความกลัว +${q.reward.dread} ` : ''}${q.reward.karma ? `กรรม +${q.reward.karma}` : ''}</div>` : ''; }
    case 'mappower': { const p = MAP_POWERS.find((x) => x.id === id); return p ? `<b>${ic(p.icon, 14)} ${esc(p.name)}</b><div>${esc(p.desc)}</div><div class="tip-dim">ใช้ ${p.cost} ${p.pool === 'faith' ? 'ศรัทธา' : 'ความกลัว'} · คลิกประเทศบนแผนที่ · ถ้าตัวละครอยู่ที่นั่นจะเห็นและความเชื่อเปลี่ยน ${p.belief > 0 ? '+' : ''}${p.belief}</div>` : ''; }
    case 'symbol': { const s = SYMBOLS.find((x) => x.id === id); return s ? `<b>${ic(s.icon, 14)} ${esc(s.name)}</b><div>ความหมายทั่วไป: ${esc(s.base.text)}</div><div class="tip-dim">แต่ละเผ่าหรือภูมิอากาศอาจตีความต่างออกไป</div>` : ''; }
    case 'res': return ({
      faith: `<b>${ic('faith', 14)} ศรัทธา</b><div>ได้เรื่อย ๆ ตามความเชื่อของตัวละคร ใช้ประทานพร ตอบคำอธิษฐาน เข้าฝัน กระซิบ และปาฏิหาริย์ฝ่ายดี</div>`,
      dread: `<b>${ic('dread', 14)} ความกลัว</b><div>ได้จากภัยพิบัติ คำสาป และการลงโทษ ใช้สาป อาวุธต้องสาป และพลังทำลายบนแผนที่</div>`,
      belief: '<b>ความเชื่อในตัวเรา</b><div>สูง: ฝันชัด เชื่อฟังเสียงกระซิบ ได้ศรัทธามากขึ้น · ต่ำ: ไม่ฟังเรา ศรัทธาแพงขึ้น · ต่ำมาก: อาจกลายเป็นผู้ล่าเทพ</div>',
      whisper: '<b>เสียงกระซิบ</b><div>บอกให้ตัวละครเลือกทางนี้โดยตรง โอกาสเชื่อฟังขึ้นกับความเชื่อ ความศรัทธา และนิสัย (ดื้อรั้น = ไม่ค่อยฟัง, หูเบา = ฟังง่าย) ถ้าไม่ฟัง ตัวละครจะเลือกเองและเชื่อเราน้อยลง</div>',
      prayer: `<b>คำอธิษฐาน</b><div>ประทาน: ใช้ศรัทธา ตัวละครเชื่อเรามากขึ้น · ลงโทษ: ได้ความกลัว แต่ตัวละครเชื่อเราน้อยลงมาก · เพิกเฉย: เชื่อน้อยลงเล็กน้อย · ปล่อยให้หมดเวลา: เชื่อน้อยลง</div>`,
      dream: `<b>${ic('dream', 14)} เข้าฝัน</b><div>ส่งสัญลักษณ์ให้ตัวละครตีความเอง มีผล 3 เหตุการณ์ ใช้ ${COSTS.dream} ศรัทธา</div>`,
    } as Record<string, string>)[id] || '';
  }
  return '';
}

// One floating tooltip for the whole page
export function installTips() {
  const box = document.createElement('div');
  box.id = 'tip';
  document.body.appendChild(box);
  let current: HTMLElement | null = null;
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
    if (el === current) return;
    current = el;
    if (!el) { box.style.display = 'none'; return; }
    const html = el.dataset.tip!.includes(':') && !el.dataset.tip!.includes(' ') ? tipHtml(el.dataset.tip!) : esc(el.dataset.tip);
    if (!html) { box.style.display = 'none'; return; }
    box.innerHTML = html;
    box.style.display = 'block';
  });
  document.addEventListener('mousemove', (e) => {
    if (box.style.display !== 'block') return;
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = `${Math.min(window.innerWidth - w - 8, e.clientX + 14)}px`;
    box.style.top = `${e.clientY + h + 20 > window.innerHeight ? e.clientY - h - 10 : e.clientY + 16}px`;
  });
}
