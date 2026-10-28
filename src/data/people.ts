import type { Storylet } from '../sim/types';

// ===================== NPC lives =====================
// Every in-game year each NPC may live through one of these. `scope` decides when it reaches the protagonist:
//   rel  = only if this NPC is in the protagonist's life (friend, lover, rival…)
//   near = also if they live in the same town
// hero.fx is applied directly; hero.story queues a choice event with this NPC as {npc}.
export interface NpcEvent {
  id: string;
  w: number;
  t: string; // {n} = NPC, {hero} = protagonist, {town}
  npc: string; // tag:+x tag:-x fame+N att+N die move
  roles?: string[];
  rels?: string[]; // relation types to the protagonist ('none' = town notable)
  needTag?: string;
  notTag?: string;
  minAge?: number;
  countryFlag?: string;
  scope?: 'rel' | 'near';
  hero?: { fx?: string; story?: string; p?: number; log?: string };
}

export const NOTABLE_ROLES = ['ผู้ใหญ่บ้าน', 'นักบวชประจำวิหาร', 'เจ้าของโรงเตี๊ยม', 'หัวหน้าทหารยาม', 'พ่อค้าใหญ่', 'ช่างตีเหล็ก', 'หมอยาประจำเมือง', 'นักกวีพเนจร'];

export const NPC_EVENTS: NpcEvent[] = [
  { id: 'marry', w: 3, t: '{n} แต่งงานแล้ว งานเลี้ยงจัดกันทั้งคืน', npc: 'tag:+married', notTag: 'married', minAge: 18, scope: 'near', hero: { fx: 'social+3' } },
  { id: 'lover_arranged', w: 4, t: 'ครอบครัวของ {n} จับคู่ให้แต่งงานกับขุนนางต่างเมือง', npc: 'tag:+engaged', rels: ['lover'], notTag: 'engaged', scope: 'rel', hero: { story: 'npc_lover_arranged', p: 1 } },
  { id: 'baby', w: 2, t: '{n} มีลูกคนแรก ตั้งชื่อตามดวงดาวที่ส่องในคืนนั้น', npc: 'tag:+parent', needTag: 'married', scope: 'rel', hero: { fx: 'kind+3', log: '{hero} ไปร่วมงานรับขวัญลูกของ {n}' } },
  { id: 'rich', w: 2, t: '{n} ร่ำรวยขึ้นจากการค้าครั้งใหญ่', npc: 'tag:+rich fame+5', notTag: 'rich', scope: 'rel', hero: { fx: 'gold+20', log: '{n} ส่งของขวัญมาให้ {hero} ด้วยความระลึกถึง' } },
  { id: 'rival_rich', w: 2, t: '{n} คู่แข่งของ {hero} ร่ำรวยและอวดไปทั่วเมือง', npc: 'tag:+rich fame+5', rels: ['rival', 'nemesis'], notTag: 'rich', scope: 'rel', hero: { fx: 'ambition+8', log: '{hero} ทนเห็น {n} อวดรวยไม่ไหว ความทะเยอทะยานลุกโชน' } },
  { id: 'bankrupt', w: 2, t: '{n} ล้มละลาย ร้านถูกยึด', npc: 'tag:-rich tag:+poor', rels: ['friend', 'spouse', 'lover'], scope: 'rel', hero: { story: 'npc_friend_loan', p: 0.8 } },
  { id: 'sick', w: 2, t: '{n} ล้มป่วยด้วยไข้ประหลาด', npc: 'tag:+sick', notTag: 'sick', scope: 'rel', hero: { story: 'npc_sick', p: 0.7 } },
  { id: 'recover', w: 3, t: '{n} หายป่วยแล้ว', npc: 'tag:-sick', needTag: 'sick' },
  { id: 'die_sick', w: 1.5, t: '{n} จากไปด้วยโรคร้าย', npc: 'die', needTag: 'sick', scope: 'rel', hero: { fx: 'kind+5', log: '{hero} ไปส่ง {n} เป็นครั้งสุดท้าย' } },
  { id: 'die_old', w: 1, t: '{n} จากไปอย่างสงบในวัยชรา', npc: 'die', minAge: 65, scope: 'rel', hero: { story: 'npc_inheritance', p: 0.5 } },
  { id: 'promoted_rival', w: 2, t: '{n} ได้รับแต่งตั้งเป็นหัวหน้าทหารรักษาเมือง', npc: 'tag:+power fame+10', rels: ['rival', 'nemesis'], notTag: 'power', minAge: 20, scope: 'rel', hero: { story: 'npc_rival_power', p: 0.9 } },
  { id: 'promoted_friend', w: 1, t: '{n} ได้รับบรรดาศักดิ์จากราชสำนัก', npc: 'tag:+power fame+10', rels: ['friend', 'mentor'], notTag: 'power', minAge: 20, scope: 'rel', hero: { story: 'npc_friend_opportunity', p: 0.45 } },
  { id: 'bandit', w: 1, t: '{n} หายตัวไปจากเมือง มีข่าวว่ากลายเป็นหัวหน้าโจรภูเขา', npc: 'tag:+bandit', notTag: 'power', minAge: 16, scope: 'rel', hero: { story: 'npc_bandit_friend', p: 0.7 } },
  { id: 'hero_party', w: 1, t: '{n} ได้รับเลือกเข้าปาร์ตี้ของผู้กล้า', npc: 'tag:+hero_party fame+15', rels: ['friend', 'rival', 'lover'], notTag: 'demon_army', minAge: 16, scope: 'rel', hero: { story: 'npc_party_invite', p: 0.5 } },
  { id: 'demon_army', w: 0.8, t: '{n} ทิ้งทุกอย่างไปเข้ากับกองทัพจอมมาร', npc: 'tag:+demon_army att-10', rels: ['friend', 'lover', 'rival', 'nemesis'], notTag: 'hero_party', minAge: 16, scope: 'rel', hero: { story: 'npc_demon_friend', p: 0.8 } },
  { id: 'confess', w: 1.5, t: '{n} แอบมอง {hero} มานานแล้ว', npc: 'att+15', rels: ['friend', 'none'], minAge: 16, scope: 'rel', hero: { story: 'npc_confession', p: 0.5 } },
  { id: 'gossip', w: 2, t: '{n} ปล่อยข่าวลือเสีย ๆ หาย ๆ เกี่ยวกับ {hero}', npc: 'att-5', rels: ['rival', 'nemesis', 'none'], scope: 'near', hero: { fx: 'fame-3' } },
  { id: 'praise', w: 2, t: '{n} เล่าเรื่องความดีของ {hero} ให้คนทั้งโรงเตี๊ยมฟัง', npc: 'att+5', rels: ['friend', 'mentor', 'none'], scope: 'near', hero: { fx: 'fame+3' } },
  { id: 'move_away', w: 1, t: '{n} ย้ายไปอยู่เมืองอื่น', npc: 'move', rels: ['friend', 'rival', 'none'] },
  { id: 'feud', w: 1.5, t: '{n} ทะเลาะใหญ่กับเพื่อนบ้านจนต้องไปให้ผู้ใหญ่บ้านตัดสิน', npc: 'fame-2', scope: 'near' },
  // notables of the protagonist's town
  { id: 'mayor_tax', w: 2, t: '{n} ผู้ใหญ่บ้านประกาศเก็บภาษีสร้างกำแพงเมือง', npc: 'fame-2', roles: ['ผู้ใหญ่บ้าน'], scope: 'near', hero: { fx: 'gold-10' } },
  { id: 'mayor_feast', w: 1.5, t: '{n} ผู้ใหญ่บ้านจัดงานเลี้ยงฉลองการเก็บเกี่ยว', npc: 'fame+3', roles: ['ผู้ใหญ่บ้าน'], scope: 'near', hero: { fx: 'social+3 hp+5' } },
  { id: 'priest_rite', w: 2, t: '{n} ทำพิธีอวยพรทั้งเมือง', npc: 'fame+2', roles: ['นักบวชประจำวิหาร'], scope: 'near', hero: { fx: 'belief+4 faith+2' } },
  { id: 'priest_scandal', w: 1, t: '{n} นักบวชถูกจับได้ว่ายักยอกเงินทำบุญ', npc: 'fame-10 att-5', roles: ['นักบวชประจำวิหาร'], scope: 'near', hero: { fx: 'belief-4' } },
  { id: 'inn_rumor', w: 2, t: '{n} กระซิบข่าวลือว่ามีสมบัติซ่อนอยู่ใต้ซากหอคอยนอกเมือง', npc: '', roles: ['เจ้าของโรงเตี๊ยม'], scope: 'near', hero: { story: 'adult_treasure_map', p: 0.4 } },
  { id: 'guard_arrest', w: 1.2, t: '{n} หัวหน้าทหารยามจับคนบริสุทธิ์ไปขังเพื่อเอาผลงาน', npc: 'att-5', roles: ['หัวหน้าทหารยาม'], scope: 'near', hero: { story: 'npc_guard_arrest', p: 0.35 } },
  { id: 'smith_blade', w: 1.2, t: '{n} ตีดาบชั้นดีสำเร็จหลังลองมาสามปี', npc: 'fame+5', roles: ['ช่างตีเหล็ก'], scope: 'near', hero: { story: 'npc_smith_blade', p: 0.5 } },
  { id: 'merchant_deal', w: 1.5, t: '{n} พ่อค้าใหญ่หาหุ้นส่วนสำหรับกองเรือสินค้า', npc: '', roles: ['พ่อค้าใหญ่'], scope: 'near', hero: { story: 'adult_merchant_deal', p: 0.4 } },
  { id: 'healer_cure', w: 1.5, t: '{n} หมอยาคิดค้นยาแก้ไอสูตรใหม่', npc: 'fame+3', roles: ['หมอยาประจำเมือง'], scope: 'near', hero: { fx: 'hp+10' } },
  { id: 'bard_song', w: 1.5, t: '{n} แต่งเพลงเกี่ยวกับ {hero} ร้องไปทั่วเมือง', npc: 'fame+2', roles: ['นักกวีพเนจร'], scope: 'near', hero: { fx: 'fame+4' } },
  { id: 'plague_victim', w: 3, t: '{n} ติดโรคระบาด', npc: 'tag:+sick', countryFlag: 'plague', notTag: 'sick', scope: 'rel', hero: { story: 'npc_sick', p: 0.6 } },
  { id: 'war_draft', w: 3, t: '{n} ถูกเกณฑ์ไปรบที่ชายแดน', npc: 'tag:+soldier', countryFlag: 'war', notTag: 'soldier', minAge: 16, scope: 'rel', hero: { fx: 'kind+3', log: '{hero} ไปส่ง {n} ที่ประตูเมือง' } },
  { id: 'war_dead', w: 1, t: '{n} เสียชีวิตในสงคราม', npc: 'die', needTag: 'soldier', countryFlag: 'war', scope: 'rel', hero: { fx: 'kind+5 thread:+rebel:1', log: 'ข่าวการตายของ {n} มาถึง {hero}' } },
];

// ===================== world figures =====================
export const HERO_NAMES = ['อาเธอร์ เรย์', 'ลีโอ นาร์ด', 'เซร่า ไลท์ฮาร์ท', 'คาซูมะ', 'ริน โฮชิโนะ', 'อัลวิน ดอว์น', 'ไอริส แบรฟ', 'ทาคุมิ'];
export const DEMON_NAMES = ['ซาร์กอส', 'มัลวาซ', 'เบลซาร์', 'ไนต์มอร์', 'อัซราเอล', 'โมร์โกธ'];
export const CARAVAN_NAMES = ['คาราวานจันทร์เสี้ยว', 'กองเกวียนสิงห์ทอง', 'คาราวานเกลือทะเลทราย', 'สมาคมการค้าเจ็ดคาบสมุทร'];

const ADULT = { stage: ['teen', 'adult', 'elder'] as ('teen' | 'adult' | 'elder')[] };

export const PEOPLE_STORYLETS: Storylet[] = [
  // ----- NPC → protagonist -----
  { id: 'npc_lover_arranged', tone: 'dark', w: 0, c: { ...ADULT, rel: 'lover' }, t: '{npc} คนรักของ {name} ร้องไห้มาหาตอนดึก "ครอบครัวข้าจะให้ข้าแต่งกับขุนนางต่างเมืองเดือนหน้า"', ch: [
    { l: 'พาหนีไปด้วยกันคืนนี้', tags: ['love', 'travel', 'defy'], ax: { brave: 1 }, chk: ['spd', 12], ok: ['หนีสำเร็จ แต่งงานกันเงียบ ๆ ในเมืองไกล', 'marry move thread:+romance:2'], ng: ['ถูกจับได้ที่ประตูเมือง', 'relkill:lover hp-15'] },
    { l: 'ท้าดวลคู่หมั้น', tags: ['fight', 'love'], ax: { brave: 1, temper: 1 }, chk: ['pow', 14], ok: ['ชนะ! ครอบครัวยอมยกให้', 'marry fame+6'], ng: ['พ่ายแพ้และเสียคนรักไป', 'relkill:lover hp-20'] },
    { l: 'ปล่อยให้เป็นไปตามครอบครัว', tags: ['safe', 'stay'], ok: ['หัวใจแตกสลาย', 'relkill:lover kind+5'] },
  ] },
  { id: 'npc_friend_loan', tone: 'grim', w: 0, c: ADULT, t: '{npc} ล้มละลาย มาขอยืมเงิน {name} "แค่สามเดือน ข้าสาบาน"', ch: [
    { l: 'ให้ยืม', tags: ['help', 'trust'], ax: { kind: 1 }, chk: ['luk', 11], ok: ['{npc} กลับมาคืนเงินพร้อมดอกเบี้ย', 'gold+10 npc:att+20 karma+2'], ng: ['{npc} หายไปพร้อมเงิน', 'gold-30 npc:att-10'] },
    { l: 'ปฏิเสธ', tags: ['selfish', 'safe'], ok: ['{npc} พยักหน้าเงียบ ๆ แล้วเดินจากไป', 'npc:att-15'] },
  ] },
  { id: 'npc_sick', tone: 'grim', w: 0, c: ADULT, t: '{npc} ป่วยหนัก ไข้ไม่ลดมาเจ็ดวัน', ch: [
    { l: 'ออกตามหาสมุนไพรในป่า', tags: ['help', 'risk', 'travel'], ax: { kind: 1 }, chk: ['int', 12], bonusTag: ['heal', 'nature'], ok: ['ได้สมุนไพรทันเวลา {npc} หายดี', 'npc:heal npc:att+20 karma+3'], ng: ['หลงป่าสองวัน กลับมาไม่ทัน… {npc} ทรุดหนัก', 'hp-10'] },
    { l: 'สวดภาวนาข้างเตียง', tags: ['pray', 'stay'], ax: { piety: 1 }, ok: ['คืนนั้นไข้ลดลงอย่างน่าประหลาด', 'npc:heal belief+6 faith+3'] },
    { l: 'ปล่อยให้หมอดูแล', tags: ['safe'], ok: ['ได้แต่รอข่าว', ''] },
  ] },
  { id: 'npc_inheritance', tone: 'warm', w: 0, c: ADULT, t: 'ทนายมาเคาะประตู "{npc} ทิ้งมรดกไว้ให้ท่าน พร้อมจดหมายหนึ่งฉบับ"', e: 'gold+40 skill:random' },
  { id: 'npc_rival_power', tone: 'grim', w: 0, c: ADULT, t: '{npc} คู่แข่งเก่าได้เป็นหัวหน้าทหารรักษาเมือง และเริ่มหาเรื่อง {name} ทุกครั้งที่เจอ', ch: [
    { l: 'อดทนและไม่ตอบโต้', tags: ['safe', 'stay'], ax: { temper: -1 }, ok: ['ผ่านไปได้ แต่ทุกวันอึดอัด', 'temper-5'] },
    { l: 'เปิดโปงการคอร์รัปชัน', tags: ['defy', 'learn'], ax: { honest: 1, brave: 1 }, chk: ['int', 14], ok: ['{npc} ถูกปลดจากตำแหน่ง ชาวเมืองยกย่อง {name}', 'fame+8 npc:att-30 thread:+rebel:2'], ng: ['หลักฐานไม่พอ ถูกจับขังข้อหาหมิ่นประมาท', 'hp-15 +flag:criminal'] },
    { l: 'ย้ายไปเมืองอื่น', tags: ['flee', 'travel'], ok: ['เริ่มชีวิตใหม่ในเมืองข้าง ๆ', 'move'] },
  ] },
  { id: 'npc_friend_opportunity', tone: 'warm', w: 0, c: ADULT, t: '{npc} เพื่อนเก่าได้บรรดาศักดิ์ และส่งจดหมายชวน {name} ไปทำงานในราชสำนัก', ch: [
    { l: 'รับตำแหน่ง', tags: ['greed', 'trust'], ax: { ambition: 1 }, ok: ['ชีวิตใหม่ในราชสำนักเริ่มต้นขึ้น', 'job:diplomat +flag:noble fame+5'] },
    { l: 'ขอบคุณแต่ปฏิเสธ', tags: ['stay'], ok: ['ยังคงเป็นเพื่อนที่ดีต่อกัน', 'npc:att+5'] },
  ] },
  { id: 'npc_bandit_friend', tone: 'dark', w: 0, c: ADULT, t: 'ระหว่างเดินทาง โจรกลุ่มหนึ่งดักปล้น หัวหน้าโจรถอดผ้าคลุมหน้า… คือ {npc}!', ch: [
    { l: 'พูดดึงสติเพื่อนเก่า', tags: ['help', 'trust'], ax: { kind: 1 }, chk: ['luk', 13], bonusTag: ['charm', 'peace'], ok: ['{npc} น้ำตาไหล และปล่อยทุกคนไป', 'npc:att+20 karma+3'], ng: ['{npc} หัวเราะเย็นชา "เจ้าไม่รู้อะไรเลย"', 'gold-30'] },
    { l: 'เข้าร่วมกลุ่มโจร', tags: ['greed', 'selfish', 'risk'], ax: { honest: -1 }, ok: ['ชีวิตนอกกฎหมายเริ่มต้น', 'job:thief +flag:outlaw thread:+outlaw:3 gold+30'] },
    { l: 'สู้', tags: ['fight'], chk: ['pow', 13], ok: ['ชนะ {npc} หนีไปพร้อมแผลเป็น', 'npc:att-30 kill fame+4'], ng: ['ถูกปล้นจนหมดตัว', 'gold-40 hp-15'] },
  ] },
  { id: 'npc_party_invite', tone: 'warm', w: 0, c: ADULT, t: '{npc} เข้าปาร์ตี้ผู้กล้าแล้ว และเขียนจดหมายมา "ปาร์ตี้ยังขาดคนอีกหนึ่ง มาด้วยกันไหม?"', ch: [
    { l: 'ไปร่วมปาร์ตี้', tags: ['travel', 'fight', 'help'], ax: { brave: 1, curious: 1 }, ok: ['ได้เป็นผู้ติดตามผู้กล้า!', '+flag:follower_hero job:hero_companion fame+8 thread:+hero:3'] },
    { l: 'ส่งของขวัญไปอวยพรแทน', tags: ['stay', 'safe'], ok: ['{npc} ส่งจดหมายขอบคุณกลับมา', 'npc:att+5 gold-5'] },
  ] },
  { id: 'npc_demon_friend', tone: 'dark', w: 0, c: ADULT, t: 'จดหมายผนึกเลือดจาก {npc} "จอมมารให้พลังที่โลกนี้ไม่เคยให้เรา มาอยู่ข้างเดียวกันเถอะ"', ch: [
    { l: 'ไปเข้ากับจอมมาร', tags: ['greed', 'defy', 'risk'], ax: { kind: -1, ambition: 1 }, ok: ['สาบานตนรับใช้จอมมาร', '+flag:follower_demon job:demon_servant thread:+dark:3 belief-10 dread+10'] },
    { l: 'ออกไปพาเพื่อนกลับมา', tags: ['help', 'risk', 'travel'], ax: { kind: 1, brave: 1 }, chk: ['luk', 15], bonusTag: ['charm', 'holy'], ok: ['{npc} ได้สติและหนีออกมาด้วยกัน', 'npc:att+30 karma+6 thread:+hero:2'], ng: ['เกือบไม่รอดจากค่ายปีศาจ', 'hp-30'] },
    { l: 'แจ้งทหาร', tags: ['safe', 'trust'], ax: { honest: 1 }, ok: ['ทางการตั้งค่าหัว {npc}', 'npc:att-40 fame+3'] },
  ] },
  { id: 'npc_confession', tone: 'warm', w: 0, c: { ...ADULT, noRel: 'lover', married: false }, t: '{npc} ยื่นดอกไม้ให้ {name} มือสั่น "ข้า… ชอบเจ้ามานานแล้ว"', ch: [
    { l: 'รับไว้ด้วยรอยยิ้ม', tags: ['love', 'trust'], ax: { social: 1 }, ok: ['ความรักเริ่มต้นกลางตลาด', 'rel:+lover npc:att+20'] },
    { l: 'ปฏิเสธอย่างสุภาพ', tags: ['safe'], ok: ['{npc} ยิ้มทั้งน้ำตา', 'npc:att-10'] },
  ] },
  { id: 'npc_guard_arrest', tone: 'grim', w: 0, c: ADULT, t: '{npc} หัวหน้าทหารยามจับ {name} ข้อหาลักทรัพย์ที่ไม่ได้ทำ', ch: [
    { l: 'พิสูจน์ความบริสุทธิ์', tags: ['defy', 'learn'], ax: { honest: 1 }, chk: ['int', 13], bonusTag: ['truth', 'scholar'], ok: ['พิสูจน์ได้ {npc} เสียหน้า', 'fame+5 npc:att-10'], ng: ['ถูกขังหนึ่งเดือน', 'hp-10 +flag:criminal'] },
    { l: 'จ่ายสินบน', tags: ['greed', 'safe'], ax: { honest: -1 }, ok: ['เงินพูดแทนได้เสมอ', 'gold-25'] },
    { l: 'แหกคุกหนี', tags: ['flee', 'risk'], chk: ['spd', 13], ok: ['หนีออกนอกเมือง', 'move +flag:wanted'], ng: ['ถูกจับได้ โดนหนักกว่าเดิม', 'hp-20 +flag:criminal'] },
  ] },
  { id: 'npc_smith_blade', tone: 'warm', w: 0, c: ADULT, t: '{npc} ช่างตีเหล็กประจำเมืองยื่นดาบเล่มใหม่ให้ดู "ข้าขายให้เจ้าในราคาเพื่อน"', ch: [
    { l: 'ซื้อ', tags: ['greed', 'fight'], ok: ['ได้อาวุธชั้นดีมาครอบครอง', 'gold-35 weapon:holy::U'] },
    { l: 'ไม่ซื้อ', tags: ['safe'], ok: ['ชื่นชมฝีมือแล้วเดินจากไป', ''] },
  ] },

  // ----- world figures -----
  { id: 'actor_hero_recruit', tone: 'warm', w: 0, important: true, c: ADULT, t: 'ผู้กล้า {actor} และปาร์ตี้แวะพักที่{town} ขณะเดินทางไปปราบจอมมาร พวกเขาบอกว่ากำลังหาคนร่วมทาง', ch: [
    { l: 'ขอร่วมเดินทาง', tags: ['travel', 'fight', 'help'], ax: { brave: 1, curious: 1 }, chk: ['luk', 13], bonusTag: ['combat', 'heal', 'magic', 'charm'], ok: ['ผู้กล้ายิ้มรับ ได้เป็นผู้ติดตามผู้กล้า!', '+flag:follower_hero job:hero_companion fame+10 thread:+hero:3'], ng: ['ผู้กล้าบอกว่า "เจ้ายังไม่พร้อม" แต่ให้ของที่ระลึกไว้', 'gold+10'] },
    { l: 'ให้เสบียงและอวยพร', tags: ['help', 'stay'], ax: { kind: 1 }, ok: ['ผู้กล้าจดจำน้ำใจนี้', 'gold-10 karma+3 thread:+hero:1'] },
    { l: 'ไม่สนใจ', tags: ['stay', 'safe'], ok: ['ผู้กล้าจากไปตอนรุ่งสาง', ''] },
  ] },
  { id: 'actor_demon_arrives', tone: 'dark', w: 0, important: true, c: ADULT, t: 'กองทัพของจอมมาร {actor} บุกถึง{town}! ฟ้ากลายเป็นสีม่วง เสียงกลองศึกดังสนั่น', ch: [
    { l: 'จับอาวุธป้องกันเมือง', tags: ['fight', 'help'], ax: { brave: 1, kind: 1 }, chk: ['pow', 15], bonusTag: ['holy', 'light', 'demon_bane', 'leader'], ok: ['ต้านทัพหน้าไว้ได้! ชาวเมืองหนีรอดมากมาย', 'fame+15 karma+5 kill thread:+hero:2'], ng: ['เมืองแตก รอดมาได้อย่างหวุดหวิด', 'hp-40 move'] },
    { l: 'คุกเข่าสวามิภักดิ์', tags: ['greed', 'selfish'], ax: { kind: -1, brave: -1 }, ok: ['จอมมารหัวเราะ "คนฉลาด" แล้วรับเป็นสมุน', '+flag:follower_demon job:demon_servant thread:+dark:3 belief-15 dread+15'] },
    { l: 'พาครอบครัวหนี', tags: ['flee', 'love'], chk: ['spd', 12], ok: ['หนีรอดออกนอกประเทศ', 'move:far'], ng: ['หนีรอดแต่บาดเจ็บ', 'hp-25 move'] },
  ] },
  { id: 'actor_caravan', tone: 'warm', w: 0, c: ADULT, t: '{actor} แวะพักที่{town} อูฐและเกวียนเต็มลานตลาด กลิ่นเครื่องเทศโชยไปทั้งเมือง', ch: [
    { l: 'ค้าขายด้วย', tags: ['greed', 'trust'], chk: ['int', 11], bonusTag: ['trade', 'charm'], ok: ['กำไรงาม', 'gold+30'], ng: ['ถูกโก่งราคา', 'gold-10'] },
    { l: 'ขอติดตามคาราวานไปต่างแดน', tags: ['travel', 'risk'], ax: { curious: 1 }, ok: ['ออกเดินทางไกลกับคาราวาน', 'move:far thread:+wanderer:2'] },
    { l: 'แอบขโมยของ', tags: ['greed', 'selfish', 'risk'], ax: { honest: -1 }, chk: ['spd', 13], bonusTag: ['stealth'], ok: ['ได้ผ้าไหมม้วนใหญ่', 'gold+50 karma-3'], ng: ['ถูกจับได้ คาราวานประจานกลางตลาด', 'fame-6 +flag:criminal'] },
  ] },
  { id: 'actor_final_battle', tone: 'dark', w: 0, important: true, c: ADULT, t: 'ศึกสุดท้ายมาถึง ผู้กล้า {actor} เผชิญหน้าจอมมาร {demon} บนซากปราสาท {name} อยู่ในสนามรบนั้นด้วย', ch: [
    { l: 'ปกป้องผู้กล้าด้วยชีวิต', tags: ['help', 'fight'], ax: { kind: 1, brave: 1 }, chk: ['vit', 14], bonusTag: ['guard', 'holy'], ok: ['รับคมดาบแทนผู้กล้า ผู้กล้าฟาดดาบสุดท้ายใส่จอมมาร!', 'actor:herowin fame+30 hp-20 thread:+hero:3'], ng: ['ล้มลงก่อน… ผู้กล้าต้องสู้ต่อเพียงลำพัง', 'hp-50 actor:coin'] },
    { l: 'แทงจอมมารจากด้านหลัง', tags: ['fight', 'risk'], ax: { brave: 1 }, chk: ['pow', 18], bonusTag: ['demon_bane', 'holy', 'stealth'], ok: ['ดาบทะลุหัวใจจอมมาร! ชื่อ {name} จะถูกจารึกคู่กับผู้กล้า', 'actor:herowin fame+50 kill +flag:demonking_slayer'], ng: ['จอมมารหันมาพอดี…', 'hp-60 actor:demonwin'] },
    { l: 'หักหลังผู้กล้า', tags: ['selfish', 'greed'], ax: { kind: -2, honest: -1 }, ok: ['ผู้กล้าล้มลงด้วยความไม่เชื่อ จอมมารยิ้มพอใจ', 'actor:demonwin karma-20 thread:+dark:4 +flag:follower_demon job:demon_servant'] },
  ] },
  { id: 'actor_final_battle_demon', tone: 'dark', w: 0, important: true, c: ADULT, t: 'ผู้กล้า {actor} บุกถึงห้องบัลลังก์ของจอมมาร {demon} ในฐานะสมุน {name} ถูกสั่งให้ขวางทาง', ch: [
    { l: 'สู้เพื่อจอมมาร', tags: ['fight', 'greed'], chk: ['pow', 16], bonusTag: ['dark', 'infernal', 'combat'], ok: ['ผู้กล้าล้มลงต่อหน้า {name}', 'actor:demonwin fame+20 kill thread:+dark:3'], ng: ['ผู้กล้าฝ่าไปได้…', 'hp-40 actor:coin'] },
    { l: 'กลับใจ ช่วยผู้กล้า', tags: ['help', 'defy'], ax: { kind: 2 }, ok: ['หันดาบใส่จอมมาร! ผู้กล้าชนะด้วยความช่วยเหลือที่ไม่คาดคิด', 'actor:herowin karma+15 -flag:follower_demon job:adventurer thread:+hero:3'] },
    { l: 'หนีไปจากที่นี่', tags: ['flee'], ok: ['ทิ้งทุกอย่างไว้เบื้องหลัง', '-flag:follower_demon job:adventurer move:far actor:coin'] },
  ] },
  // following the hero / the demon lord
  { id: 'party_campfire', tone: 'warm', w: 3, c: { stage: ['teen', 'adult'], flag: ['follower_hero'] }, t: 'คืนหนึ่งข้างกองไฟ ผู้กล้าเล่าว่าตัวเองมาจากโลกอีกใบ และกลัวว่าจะไม่ได้กลับบ้าน', e: 'kind+5 thread:+hero:1 belief+3' },
  { id: 'party_monster', tone: 'grim', w: 3, c: { stage: ['teen', 'adult'], flag: ['follower_hero'] }, t: 'ปาร์ตี้ผู้กล้าบุกรังไวเวิร์นที่ทำร้ายหมู่บ้าน หน้าที่ของ {name} คือ[ล่อมันออกมา|คุ้มกันนักเวท|เปิดทางให้ผู้กล้า]', ch: [
    { l: 'ทำหน้าที่ให้ดีที่สุด', tags: ['fight', 'help'], chk: ['spd', 13], bonusTag: ['combat', 'ranged', 'magic'], ok: ['ภารกิจสำเร็จ ผู้กล้าตบไหล่ชื่นชม', 'fame+8 kill skill:random'], ng: ['บาดเจ็บ แต่ปาร์ตี้ชนะ', 'hp-25 fame+3'] },
    { l: 'ขโมยสมบัติในรังก่อนใคร', tags: ['greed', 'selfish'], ok: ['ได้ทองเต็มกระเป๋า แต่นักบวชในปาร์ตี้มองด้วยสายตาสงสัย', 'gold+60 karma-3'] },
  ] },
  { id: 'party_rift', tone: 'dark', w: 1.5, c: { stage: ['adult'], flag: ['follower_hero'] }, t: 'สมาชิกในปาร์ตี้ผู้กล้าแตกคอกันเรื่อง[ส่วนแบ่งสมบัติ|การไว้ชีวิตปีศาจที่ยอมแพ้|ความรักสามเส้า] ทุกคนมองมาที่ {name}', ch: [
    { l: 'ไกล่เกลี่ย', tags: ['help', 'trust'], chk: ['luk', 13], bonusTag: ['charm', 'peace', 'leader'], ok: ['ปาร์ตี้กลับมาเป็นหนึ่งเดียว', 'fame+5 thread:+hero:2'], ng: ['ทะเลาะหนักกว่าเดิม', 'fame-3'] },
    { l: 'ถอนตัวจากปาร์ตี้', tags: ['travel', 'flee'], ok: ['แยกทางกับผู้กล้า', '-flag:follower_hero job:adventurer'] },
  ] },
  { id: 'demon_order', tone: 'dark', w: 3, c: { stage: ['teen', 'adult'], flag: ['follower_demon'] }, t: 'จอมมารสั่งให้ {name} นำทัพเผาหมู่บ้านที่ไม่ยอมจ่ายบรรณาการ', ch: [
    { l: 'ทำตามคำสั่ง', tags: ['selfish', 'fight'], ax: { kind: -1 }, ok: ['ไฟลุกท่วมหมู่บ้าน จอมมารพอใจ', 'karma-10 dread+10 mag+1 thread:+dark:2'] },
    { l: 'แอบปล่อยชาวบ้านหนี', tags: ['help', 'risk'], ax: { kind: 1 }, chk: ['int', 13], bonusTag: ['stealth', 'illusion'], ok: ['ชาวบ้านรอดทั้งหมด ไม่มีใครรู้', 'karma+8'], ng: ['ถูกนายพลอีกคนจับได้ โดนลงโทษ', 'hp-30 karma+5'] },
  ] },
  { id: 'demon_reward', tone: 'dark', w: 2, c: { stage: ['adult'], flag: ['follower_demon'] }, t: 'จอมมารพอใจในผลงาน ยื่นถ้วยเลือดสีดำให้ {name} "ดื่มเสีย แล้วเจ้าจะแข็งแกร่งขึ้น"', ch: [
    { l: 'ดื่ม', tags: ['greed', 'risk'], ok: ['พลังมืดไหลเข้าร่าง', 'mag+2 pow+1 curse:random thread:+dark:2'] },
    { l: 'แกล้งดื่มแล้วเทลงพื้น', tags: ['distrust', 'risk'], chk: ['spd', 14], ok: ['ไม่มีใครเห็น', 'int+1'], ng: ['จอมมารเห็นและโกรธ', 'hp-35'] },
  ] },

  // ----- new careers -----
  { id: 'job_scribe', tone: 'comedy', w: 4, c: { job: ['scribe'] }, t: 'ระหว่างคัดลอกจดหมายของขุนนาง {name} เห็นว่ามีรหัสลับซ่อนอยู่ระหว่างบรรทัด', ch: [
    { l: 'ถอดรหัส', tags: ['learn', 'risk'], chk: ['int', 13], ok: ['เป็นแผนกบฏ! ขายข้อมูลได้ราคางาม', 'gold+50 fame+3'], ng: ['ถอดไม่ออก แต่ปวดหัวไปสามวัน', 'int+1'] },
    { l: 'คัดลอกตามหน้าที่', tags: ['safe', 'stay'], ok: ['ไม่รู้ไม่ชี้ ปลอดภัยกว่า', 'gold+5'] },
  ] },
  { id: 'job_shepherd', tone: 'warm', w: 4, c: { job: ['shepherd'] }, t: 'ลูกแกะตัวหนึ่งหายไปในหมอก เสียงร้องดังมาจาก[ถ้ำ|หน้าผา|ป่าต้องห้าม]', ch: [
    { l: 'ตามหาจนเจอ', tags: ['help', 'risk'], chk: ['vit', 11], ok: ['เจอลูกแกะ… และไข่มังกรหนึ่งฟอง', 'gold+30 thread:+wild:2'], ng: ['ถูกหมาป่ากัด', 'hp-15'] },
    { l: 'ยอมเสียไปหนึ่งตัว', tags: ['safe'], ok: ['ฝูงที่เหลือปลอดภัย', ''] },
  ] },
  { id: 'job_carpenter', tone: 'warm', w: 4, c: { job: ['carpenter'] }, t: 'เจ้าเมืองจ้าง {name} สร้างสะพานข้ามแม่น้ำเชี่ยว', ch: [
    { l: 'ออกแบบใหม่ทั้งหมด', tags: ['learn', 'risk'], chk: ['int', 12], bonusTag: ['rune', 'earth'], ok: ['สะพานงดงามจนกลายเป็นสัญลักษณ์ของเมือง', 'fame+10 gold+40'], ng: ['สะพานพังในพายุแรก', 'fame-5'] },
    { l: 'สร้างตามแบบเดิม', tags: ['safe', 'stay'], ok: ['งานเสร็จตามกำหนด', 'gold+25'] },
  ] },
  { id: 'job_weaver', tone: 'warm', w: 4, c: { job: ['weaver', 'performer'] }, t: 'ผ้าทอ/การแสดงของ {name} เล่าเรื่องตำนานในอดีตจนผู้ชมร้องไห้ ราชสำนักส่งคนมาทาบทาม', ch: [
    { l: 'รับใช้ราชสำนัก', tags: ['greed', 'stay'], ok: ['มีชื่อเสียงไปทั่วเมืองหลวง', 'fame+10 gold+30'] },
    { l: 'อยู่กับชาวบ้านต่อไป', tags: ['help', 'stay'], ok: ['ผลงานยังคงเป็นของประชาชน', 'karma+2 fame+3'] },
  ] },
  { id: 'job_servant', tone: 'grim', w: 4, c: { job: ['servant'] }, t: '{name} ได้ยินเจ้าหญิงกระซิบวางแผนหนีออกจากวังกับคนรัก', ch: [
    { l: 'ช่วยเจ้าหญิงหนี', tags: ['help', 'risk', 'love'], chk: ['spd', 13], bonusTag: ['stealth'], ok: ['เจ้าหญิงหนีสำเร็จ และส่งจดหมายขอบคุณมาจากต่างแดน', 'karma+5 thread:+romance:2 gold+20'], ng: ['ถูกจับได้และไล่ออกจากวัง', 'job:adventurer fame-3'] },
    { l: 'รายงานราชินี', tags: ['greed', 'trust'], ok: ['ได้เลื่อนตำแหน่ง แต่เจ้าหญิงเกลียดเข้าไส้', 'gold+30 rel:+nemesis'] },
  ] },
  { id: 'job_teacher', tone: 'warm', w: 4, c: { job: ['teacher'] }, t: 'นักเรียนคนหนึ่งของ {name} ชื่อ {npc} มีพรสวรรค์ผิดธรรมดา แต่ครอบครัวยากจนไม่ให้เรียนต่อ', ch: [
    { l: 'สอนฟรีและหาทุนให้', tags: ['help'], ax: { kind: 1 }, ok: ['หลายปีต่อมา {npc} กลายเป็นนักปราชญ์ที่ไม่เคยลืมครู', 'rel:+friend karma+5 fame+5'] },
    { l: 'ปล่อยให้เป็นเรื่องของครอบครัว', tags: ['safe'], ok: ['ห้องเรียนเงียบลงไปหนึ่งที่นั่ง', ''] },
  ] },
  { id: 'job_seer', tone: 'dark', w: 4, c: { job: ['seer'] }, t: 'ลูกค้าคนหนึ่งขอให้ {name} ดูดวง ไพ่ทุกใบออกมาเป็น "ความตาย"', ch: [
    { l: 'บอกความจริง', tags: ['trust'], ax: { honest: 1 }, ok: ['ลูกค้าระวังตัวจนรอดจากการลอบสังหาร และกลับมาขอบคุณ', 'fame+6 gold+30'] },
    { l: 'โกหกว่าดวงดี', tags: ['selfish', 'safe'], ax: { honest: -1 }, ok: ['ลูกค้าจ่ายเงินอย่างมีความสุข… และไม่กลับมาอีกเลย', 'gold+10 karma-2'] },
  ] },
  { id: 'job_archaeologist', tone: 'grim', w: 4, c: { job: ['archaeologist'] }, t: '{name} ขุดพบประตูหินที่มีอักษรเตือน "ผู้ใดเปิด ผู้นั้นปลุกราชาผู้หลับใหล"', ch: [
    { l: 'เปิดประตู', tags: ['risk', 'learn'], chk: ['luk', 13], bonusTag: ['rune', 'appraise'], ok: ['พบห้องสมุดโบราณ!', 'skill:random gold+60 fame+8'], ng: ['ลิชตื่นขึ้น… วิ่งหนีแทบไม่ทัน', 'hp-35 curse:random'] },
    { l: 'ฝังกลับคืนและบันทึกไว้', tags: ['safe', 'learn'], ok: ['รายงานของ {name} ถูกเก็บในหอสมุดหลวง', 'int+1 fame+3'] },
  ] },
  { id: 'job_spy', tone: 'dark', w: 4, c: { job: ['spy'] }, t: 'สองประเทศจ้าง {name} ให้สอดแนมกันและกัน ทั้งคู่ไม่รู้ว่าจ้างคนเดียวกัน', ch: [
    { l: 'เล่นสองหน้าต่อไป', tags: ['greed', 'risk'], chk: ['int', 14], bonusTag: ['stealth', 'illusion'], ok: ['รับเงินสองทาง!', 'gold+80'], ng: ['ถูกจับได้ทั้งสองฝ่าย', 'hp-25 +flag:wanted move:far'] },
    { l: 'เลือกข้างเดียว', tags: ['trust'], ok: ['ได้ความไว้วางใจจากฝ่ายหนึ่ง', 'gold+30 +flag:noble'] },
  ] },
  { id: 'job_diplomat', tone: 'grim', w: 4, c: { job: ['diplomat'], countryFlag: 'war' }, t: '{name} ได้รับมอบหมายให้เจรจาสงบศึกกับศัตรูที่เพิ่งเผาเมืองชายแดน', ch: [
    { l: 'เจรจาด้วยความจริงใจ', tags: ['help', 'trust'], chk: ['int', 14], bonusTag: ['charm', 'peace', 'polyglot'], ok: ['สงบศึกสำเร็จ! ผู้คนนับพันรอดชีวิต', 'fame+20 karma+8 country:+golden'], ng: ['ทูตฝ่ายตรงข้ามโกรธจนการเจรจาล่ม', 'fame-5'] },
    { l: 'แอบวางยาทูตฝ่ายตรงข้าม', tags: ['selfish', 'risk'], ok: ['สงครามจบเร็ว… ด้วยวิธีที่ไม่มีใครภูมิใจ', 'karma-10 fame+5'] },
  ] },
  { id: 'job_gravekeeper', tone: 'dark', w: 4, c: { job: ['gravekeeper'] }, t: 'ตีสาม หลุมศพใหม่ในสุสานเริ่มสั่น มีมือโผล่ขึ้นมาจากดิน', ch: [
    { l: 'สวดส่งวิญญาณ', tags: ['pray', 'help'], chk: ['mag', 12], bonusTag: ['holy', 'light', 'necro'], ok: ['วิญญาณสงบลงและขอบคุณ', 'belief+5 skill:random'], ng: ['ผีดิบลุกขึ้นมาได้ ต้องสู้ตัวต่อตัว', 'hp-20'] },
    { l: 'ฟาดด้วยพลั่ว', tags: ['fight'], chk: ['pow', 11], ok: ['ศพกลับลงไปนอน', 'kill'], ng: ['พลั่วหัก', 'hp-15'] },
  ] },
  { id: 'job_innkeeper', tone: 'comedy', w: 4, c: { job: ['innkeeper', 'cook'] }, t: 'ปาร์ตี้นักผจญภัยกินดื่มในโรงเตี๊ยมของ {name} ทั้งคืนแล้วพยายามจ่ายด้วย "แผนที่สมบัติ"', ch: [
    { l: 'รับแผนที่', tags: ['risk', 'greed'], chk: ['luk', 12], ok: ['แผนที่เป็นของจริง!', 'gold+70'], ng: ['เป็นภาพวาดเด็กเล่น', 'gold-20'] },
    { l: 'ให้ล้างจานแทน', tags: ['safe'], ok: ['ห้องครัวสะอาดที่สุดในประวัติศาสตร์', 'social+3'] },
  ] },
  { id: 'job_miner', tone: 'grim', w: 4, c: { job: ['miner'] }, t: 'อุโมงค์เหมืองถล่ม! {name} ติดอยู่กับคนงานอีกสามคน อากาศเริ่มหมด', ch: [
    { l: 'ขุดทางออกเอง', tags: ['risk', 'help'], chk: ['vit', 13], bonusTag: ['earth', 'mine'], ok: ['พาทุกคนออกมาได้ และเจอแร่มิธริลระหว่างทาง', 'gold+50 karma+3 fame+4'], ng: ['ออกมาได้แต่ซี่โครงหัก', 'hp-30'] },
    { l: 'ประหยัดอากาศรอคนช่วย', tags: ['safe', 'stay'], chk: ['luk', 11], ok: ['ทีมกู้ภัยมาทันเวลา', ''], ng: ['รอนานจนหมดสติ', 'hp-20'] },
  ] },
  { id: 'job_sailor', tone: 'comedy', w: 4, c: { job: ['sailor', 'fisher'] }, t: 'เงือกสาวโผล่ขึ้นข้างเรือและท้า {name} ร้องเพลงแข่ง ถ้าแพ้ต้องกระโดดลงทะเล', ch: [
    { l: 'ร้องสุดเสียง', tags: ['risk', 'love'], chk: ['luk', 12], bonusTag: ['music', 'charm'], ok: ['เงือกหลงรักเสียงเพลง มอบไข่มุกให้', 'gold+40 thread:+romance:1'], ng: ['แพ้… ต้องว่ายน้ำกลับฝั่ง', 'hp-10'] },
    { l: 'ปิดหูแล้วพายหนี', tags: ['flee', 'safe'], ok: ['รอดมาได้แต่ลูกเรือหัวเราะทั้งลำ', 'fame-1'] },
  ] },
  { id: 'job_alchemist', tone: 'comedy', w: 4, c: { job: ['alchemist'] }, t: 'การทดลองของ {name} ได้ของเหลวที่[ทำให้ตะกั่วเป็นทองได้ห้านาที|ทำให้คนดื่มพูดความจริง|ทำให้แมวบินได้]', ch: [
    { l: 'ทดลองกับตัวเอง', tags: ['risk', 'learn'], chk: ['vit', 12], ok: ['ร่างกายแข็งแรงขึ้นอย่างประหลาด', 'vit+1 skill:alchemy_2'], ng: ['ผมเปลี่ยนเป็นสีม่วงถาวร', 'fame-2'] },
    { l: 'ขายให้ขุนนาง', tags: ['greed'], ok: ['ขุนนางจ่ายหนัก', 'gold+50'] },
  ] },
  { id: 'job_royal_guard', tone: 'grim', w: 4, c: { job: ['royal_guard'] }, t: 'นักฆ่าบุกเข้าห้องบรรทมของกษัตริย์ {name} เป็นราชองครักษ์คนเดียวที่อยู่ใกล้', ch: [
    { l: 'กระโจนบังกษัตริย์', tags: ['help', 'fight'], chk: ['vit', 13], bonusTag: ['guard'], ok: ['รอดทั้งคู่! ได้รับบรรดาศักดิ์อัศวิน', 'fame+15 +flag:noble job:knight'], ng: ['กษัตริย์รอด แต่ได้แผลลึก', 'hp-40 fame+10'] },
    { l: 'ไล่จับนักฆ่า', tags: ['fight', 'risk'], chk: ['spd', 14], ok: ['จับนักฆ่าได้คาตัว', 'fame+10 kill'], ng: ['นักฆ่าหนีไปได้', 'fame-3'] },
  ] },
];

// ===================== regional happenings =====================
// Big events that only happen in certain kinds of lands. They set a country flag; while it lasts the
// protagonist living there feeds a story thread and can be drawn into the matching storylet.
export interface RegionEvent {
  id: string;
  name: string;
  icon: string;
  flag: string;
  dur: [number, number]; // ticks
  w: number;
  religion?: string[];
  climate?: string[];
  continent?: number[];
  major?: string[]; // majority race
  text: string; // {c} = country
  thread?: string;
  story?: string;
}

export const REGION_EVENTS: RegionEvent[] = [
  { id: 'inquisition', name: 'ศาลศาสนาล่าแม่มด', icon: 'bless', flag: 'inquisition', dur: [12, 24], w: 3, religion: ['light'], text: 'ศาลศาสนาแห่ง{c}ประกาศล่าแม่มดและพวกนอกรีต', thread: 'faithful', story: 'region_inquisition' },
  { id: 'holy_war', name: 'สงครามศักดิ์สิทธิ์', icon: 'herosword', flag: 'holy_war', dur: [16, 32], w: 2, religion: ['light', 'war'], text: '{c}ประกาศสงครามศักดิ์สิทธิ์ต่อดินแดนปีศาจ', thread: 'warrior', story: 'region_holy_war' },
  { id: 'dragon_awake', name: 'มังกรตื่น', icon: 'dragon', flag: 'dragon_awake', dur: [12, 30], w: 3, religion: ['dragon'], climate: ['volcanic'], text: 'มังกรโบราณตื่นจากการหลับใหลเหนือ{c}', thread: 'warrior', story: 'region_dragon_tribute' },
  { id: 'pirates', name: 'กองเรือโจรสลัด', icon: 'jolly', flag: 'pirate_raid', dur: [8, 20], w: 3, climate: ['islands'], religion: ['sea'], text: 'กองเรือโจรสลัดนับร้อยลำปิดล้อมชายฝั่ง{c}', thread: 'outlaw', story: 'region_pirates' },
  { id: 'sandstorm', name: 'พายุทรายร้อยปี', icon: 'desert', flag: 'sandstorm', dur: [8, 16], w: 3, climate: ['desert'], text: 'พายุทรายร้อยปีกลืนเส้นทางคาราวานทั้งหมดของ{c}', thread: 'wanderer', story: 'region_sandstorm' },
  { id: 'long_night', name: 'ราตรีนิรันดร์', icon: 'omen', flag: 'long_night', dur: [8, 16], w: 3, climate: ['frozen'], text: 'ดวงอาทิตย์ไม่ขึ้นเหนือ{c}มาสี่สิบวันแล้ว', thread: 'dark', story: 'region_long_night' },
  { id: 'eruption', name: 'ภูเขาไฟใหญ่ระเบิด', icon: 'volcanic', flag: 'eruption', dur: [6, 12], w: 2, climate: ['volcanic'], text: 'ภูเขาไฟใหญ่ใจกลาง{c}ระเบิด เถ้าถ่านปกคลุมฟ้า', story: 'region_eruption' },
  { id: 'demon_gate', name: 'ประตูนรกเปิด', icon: 'demon', flag: 'demon_gate', dur: [12, 28], w: 3, religion: ['demon'], continent: [5, 8], text: 'ประตูนรกเปิดออกใน{c} ปีศาจไหลทะลักออกมา', thread: 'dark', story: 'region_demon_gate' },
  { id: 'bloodmoon', name: 'จันทร์สีเลือด', icon: 'moon', flag: 'bloodmoon', dur: [4, 8], w: 3, religion: ['moon'], climate: ['frozen'], text: 'จันทร์สีเลือดปรากฏเหนือ{c} มนุษย์หมาป่าและแวมไพร์ออกล่า', thread: 'dark', story: 'region_bloodmoon' },
  { id: 'naga_rise', name: 'พญานาคขึ้นจากน้ำ', icon: 'snake', flag: 'naga_rise', dur: [6, 12], w: 3, religion: ['naga'], text: 'พญานาคขึ้นจากแม่น้ำใหญ่ของ{c} เพื่อทดสอบผู้คน', thread: 'faithful', story: 'region_naga_trial' },
  { id: 'bloom', name: 'ต้นไม้โลกผลิบาน', icon: 'leaf', flag: 'bloom', dur: [8, 16], w: 3, religion: ['nature'], text: 'ต้นไม้ศักดิ์สิทธิ์ทั่ว{c}ผลิดอกพร้อมกันในคืนเดียว', thread: 'wild', story: 'region_bloom' },
  { id: 'undead', name: 'คนตายลุกจากหลุม', icon: 'undead', flag: 'undead_rising', dur: [8, 16], w: 1.5, religion: ['ancestor', 'none', 'demon'], text: 'ศพในสุสานทั่ว{c}ลุกขึ้นมาเดิน', thread: 'dark', story: 'region_undead' },
  { id: 'festival', name: 'เทศกาลร้อยปี', icon: 'golden', flag: 'festival', dur: [4, 8], w: 3, climate: ['temperate', 'islands'], text: '{c}จัดเทศกาลร้อยปีที่คนทั้งทวีปเดินทางมาร่วม', thread: 'romance', story: 'region_festival' },
  { id: 'migration', name: 'การอพยพใหญ่ของสัตว์ป่า', icon: 'paw', flag: 'migration', dur: [6, 12], w: 3, climate: ['tropical'], major: ['beast'], text: 'ฝูงสัตว์ป่านับล้านอพยพผ่าน{c}', thread: 'wild', story: 'region_migration' },
  { id: 'horde', name: 'ทัพออร์คกวาดล้าง', icon: 'humanoid', flag: 'horde', dur: [10, 20], w: 3, major: ['orc'], climate: ['desert'], text: 'ทัพออร์คนับหมื่นรวมตัวกันใน{c}ภายใต้ขุนศึกคนใหม่', thread: 'warrior', story: 'region_horde' },
  { id: 'council', name: 'สภาเอลฟ์เรียกประชุม', icon: 'leaf', flag: 'council', dur: [6, 12], w: 3, major: ['elf'], text: 'สภาผู้อาวุโสแห่ง{c}เรียกประชุมครั้งแรกในรอบห้าร้อยปี', thread: 'arcane', story: 'region_council' },
  { id: 'gold_rush', name: 'ตื่นทอง', icon: 'gold', flag: 'gold_rush', dur: [8, 16], w: 2, major: ['dwarf', 'human'], climate: ['volcanic', 'frozen', 'temperate'], text: 'พบสายแร่ทองคำมหาศาลใน{c} ผู้คนแห่กันมาขุด', thread: 'greed', story: 'region_gold_rush' },
];

const R = (flag: string) => ({ countryFlag: flag });
export const REGION_STORYLETS: Storylet[] = [
  { id: 'region_inquisition', tone: 'dark', w: 2, c: { ...R('inquisition'), stage: ['teen', 'adult', 'elder'] }, aff: { minority: 3, 'tag:dark': 4, 'tag:necro': 4, 'tag:infernal': 4, 'race:demonkin': 4, 'race:vampire': 4 }, t: 'ศาลศาสนาเคาะประตูทีละบ้าน ใครมีเครื่องหมายผิดปกติจะถูกนำตัวไปไต่สวน คืนนี้ถึงคิวถนนของ {name}', ch: [
    { l: 'ซ่อนตัวในห้องใต้ดิน', tags: ['flee', 'safe'], chk: ['luk', 12], bonusTag: ['stealth'], ok: ['รอดพ้นการตรวจค้น', ''], ng: ['ถูกพบและถูกไต่สวนสามวัน', 'hp-20 belief-5'] },
    { l: 'ช่วยเพื่อนบ้านที่ถูกกล่าวหาหนี', tags: ['help', 'defy', 'risk'], ax: { kind: 1, brave: 1 }, chk: ['spd', 13], ok: ['พาเพื่อนบ้านหนีรอด กลายเป็นตำนานใต้ดิน', 'karma+6 thread:+rebel:2 fame+3'], ng: ['ถูกจับพร้อมกัน', 'hp-25 +flag:wanted'] },
    { l: 'ชี้ตัวคนอื่นแทน', tags: ['selfish', 'safe'], ax: { kind: -2 }, ok: ['ตัวเองรอด คนที่ถูกชี้ไม่รอด', 'karma-8 thread:+dark:1'] },
  ] },
  { id: 'region_holy_war', tone: 'grim', w: 2, c: { ...R('holy_war'), stage: ['teen', 'adult'] }, t: 'นักบวชประกาศกลางจัตุรัส "ใครร่วมสงครามศักดิ์สิทธิ์ บาปทั้งหมดจะถูกลบล้าง!"', ch: [
    { l: 'ร่วมทัพศักดิ์สิทธิ์', tags: ['fight', 'pray', 'travel'], ax: { piety: 1, brave: 1 }, chk: ['pow', 14], bonusTag: ['holy', 'combat'], ok: ['กลับมาพร้อมเกียรติและอาวุธที่ได้รับพร', 'weapon:holy:light:U fame+12 kill thread:+holy:2'], ng: ['สงครามโหดร้ายกว่าที่คิด', 'hp-35 kind-5'] },
    { l: 'บริจาคเสบียงแทน', tags: ['help', 'safe'], ok: ['ได้ใบลบบาปหนึ่งแผ่น', 'gold-20 karma+2 belief+5'] },
    { l: 'ปฏิเสธสงครามในนามศาสนา', tags: ['defy'], ax: { piety: -1 }, ok: ['ถูกมองว่าเป็นคนนอกรีต', 'fame-3 thread:+rebel:1'] },
  ] },
  { id: 'region_dragon_tribute', tone: 'dark', w: 2, c: { ...R('dragon_awake'), stage: ['teen', 'adult'] }, t: 'มังกรที่ตื่นขึ้นเรียกร้องบรรณาการ: ทองครึ่งเมือง หรือหญิงสาวหนึ่งคน ชาวเมืองจับฉลากกัน', ch: [
    { l: 'อาสาไปเจรจากับมังกร', tags: ['risk', 'trust', 'help'], ax: { brave: 1 }, chk: ['int', 15], bonusTag: ['polyglot', 'dragon_blood', 'charm'], ok: ['มังกรพอใจในปริศนาที่ได้ฟัง และยอมกลับไปหลับ', 'fame+20 +flag:dragon_bond thread:+hero:2'], ng: ['มังกรพ่นไฟใส่แต่ปล่อยกลับมาเล่าความน่ากลัว', 'hp-40'] },
    { l: 'ร่วมทัพล่ามังกร', tags: ['fight', 'risk'], chk: ['pow', 18], bonusTag: ['dragon_bane', 'ice', 'hero_luck'], ok: ['มังกรล้มลง! ผู้ฆ่ามังกรคนใหม่ถือกำเนิด', 'fame+35 gold+120 kill +flag:dragonslayer'], ng: ['ทัพแตกพ่าย', 'hp-50'] },
    { l: 'ลงขันบริจาคทอง', tags: ['safe', 'help'], ok: ['เมืองรอดด้วยทองของทุกคน', 'gold-30'] },
  ] },
  { id: 'region_pirates', tone: 'grim', w: 2, c: { ...R('pirate_raid'), stage: ['teen', 'adult'] }, t: 'ธงหัวกะโหลกเต็มอ่าว โจรสลัดยึดท่าเรือและเปิดรับลูกเรือใหม่', ch: [
    { l: 'สมัครเป็นโจรสลัด', tags: ['greed', 'travel', 'risk'], ax: { honest: -1 }, ok: ['ชีวิตกลางทะเลเริ่มต้น', 'job:pirate gold+30 thread:+outlaw:2'] },
    { l: 'ร่วมกองอาสาป้องกันท่าเรือ', tags: ['fight', 'help'], chk: ['pow', 13], bonusTag: ['sea', 'combat'], ok: ['ขับไล่โจรสลัดได้!', 'fame+10 kill'], ng: ['ท่าเรือถูกปล้น', 'gold-30 hp-20'] },
    { l: 'ซ่อนทรัพย์สินแล้วรอให้ผ่านไป', tags: ['safe', 'stay'], ok: ['รอดมาได้', 'gold-5'] },
  ] },
  { id: 'region_sandstorm', tone: 'grim', w: 2, c: { ...R('sandstorm'), stage: ['teen', 'adult'] }, t: 'พายุทรายตัดขาดเมืองจากโลกภายนอก โอเอซิสแห่งเดียวกลายเป็นที่แย่งชิง', ch: [
    { l: 'นำคนหาโอเอซิสใหม่', tags: ['travel', 'help', 'risk'], chk: ['int', 14], bonusTag: ['navigator', 'heat_res', 'survival'], ok: ['พบโอเอซิสลับ! ทั้งเมืองรอด', 'fame+15 karma+5'], ng: ['หลงทางกลางพายุ', 'hp-35'] },
    { l: 'ยึดบ่อน้ำไว้ขายน้ำ', tags: ['greed', 'selfish'], ok: ['รวยมหาศาลท่ามกลางความกระหาย', 'gold+80 karma-8'] },
  ] },
  { id: 'region_long_night', tone: 'dark', w: 2, c: { ...R('long_night'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ราตรีที่ไม่มีวันสิ้นสุด ฟืนใกล้หมด และมีเงาบางอย่างเดินตามถนนโดยไม่มีเสียงเท้า', ch: [
    { l: 'จุดไฟกองใหญ่กลางเมือง', tags: ['help', 'pray'], chk: ['vit', 12], bonusTag: ['fire', 'light'], ok: ['แสงไฟขับไล่เงาออกไป ผู้คนมารวมตัวกัน', 'fame+8 belief+5'], ng: ['ไฟดับกลางดึก… เงาเข้ามาใกล้', 'hp-20'] },
    { l: 'ตามเงานั้นไป', tags: ['risk', 'learn'], chk: ['luk', 14], bonusTag: ['darkvision', 'dark'], ok: ['พบที่มาของราตรีนิรันดร์ และได้พลังบางอย่าง', 'apt:dark thread:+dark:2'], ng: ['หลงในความมืดเกือบตาย', 'hp-35'] },
  ] },
  { id: 'region_eruption', tone: 'dark', w: 2, c: { ...R('eruption'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ลาวาไหลลงสู่หุบเขา เถ้าถ่านตกเหมือนหิมะสีดำ ทั้ง{town}ต้องอพยพ', ch: [
    { l: 'ช่วยคนแก่และเด็กออกมาก่อน', tags: ['help', 'risk'], chk: ['spd', 13], bonusTag: ['fire_res'], ok: ['ช่วยได้หลายสิบชีวิต', 'karma+8 fame+10 move'], ng: ['ถูกเถ้าร้อนลวก', 'hp-35 karma+5 move'] },
    { l: 'อพยพทันที', tags: ['flee', 'safe'], ok: ['รอดชีวิตพร้อมของจำเป็น', 'move gold-10'] },
  ] },
  { id: 'region_demon_gate', tone: 'dark', w: 2, c: { ...R('demon_gate'), stage: ['teen', 'adult'] }, t: 'ประตูนรกเปิดค้างอยู่นอกเมือง นักบวชบอกว่าต้องมีคนเข้าไปปิดจากด้านใน', ch: [
    { l: 'อาสาเข้าไปปิดประตู', tags: ['help', 'risk', 'fight'], ax: { brave: 2 }, chk: ['mag', 16], bonusTag: ['holy', 'light', 'demon_bane', 'rune'], ok: ['ประตูถูกผนึก! {name} กลับมาพร้อมผมขาวโพลน', 'fame+30 karma+10 thread:+hero:3'], ng: ['ถูกปีศาจลากเข้าไปลึก… หนีออกมาได้ด้วยราคาแพง', 'hp-50 curse:random'] },
    { l: 'แอบเก็บเศษหินนรกไปขาย', tags: ['greed', 'risk'], ok: ['ขายได้ราคาดีแก่จอมเวทมืด', 'gold+70 thread:+dark:2'] },
    { l: 'อพยพไปเมืองอื่น', tags: ['flee', 'safe'], ok: ['ห่างจากประตูนรกให้ไกลที่สุด', 'move'] },
  ] },
  { id: 'region_bloodmoon', tone: 'dark', w: 2, c: { ...R('bloodmoon'), stage: ['teen', 'adult', 'elder'] }, t: 'จันทร์สีเลือดขึ้น เสียงหอนดังจากทุกทิศ ชาวเมืองปิดประตูลงกลอน', ch: [
    { l: 'ออกลาดตระเวนกับทหาร', tags: ['fight', 'help'], chk: ['pow', 14], bonusTag: ['holy', 'silver', 'light'], ok: ['ปราบมนุษย์หมาป่าได้สองตัว', 'kill fame+8'], ng: ['ถูกกัด… รอยแผลร้อนผ่าว', 'hp-25 curse:c_moonfrenzy'] },
    { l: 'อยู่ในบ้านสวดภาวนา', tags: ['pray', 'safe'], ok: ['ผ่านคืนนั้นไปได้', 'belief+5'] },
  ] },
  { id: 'region_naga_trial', tone: 'warm', w: 2, c: { ...R('naga_rise'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'พญานาคตนใหญ่ชูคอจากแม่น้ำ ถามคำถามเดียว: "เจ้ามีชีวิตอยู่เพื่ออะไร?"', ch: [
    { l: 'ตอบว่าเพื่อผู้อื่น', tags: ['help', 'pray'], ax: { kind: 1 }, ok: ['พญานาคพ่นละอองน้ำศักดิ์สิทธิ์ใส่', 'bless:tag=water belief+10 thread:+faithful:2'] },
    { l: 'ตอบว่าเพื่อตัวเอง', tags: ['selfish', 'greed'], ok: ['พญานาคหัวเราะ "อย่างน้อยเจ้าก็ซื่อสัตย์"', 'luk+1'] },
    { l: 'ไม่ตอบ วิ่งหนี', tags: ['flee'], ok: ['พญานาคมองตามด้วยความผิดหวัง', 'belief-5'] },
  ] },
  { id: 'region_bloom', tone: 'warm', w: 2, c: { ...R('bloom'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'กลีบดอกจากต้นไม้ศักดิ์สิทธิ์ปลิวไปทั่วเมือง ใครที่กลีบดอกตกบนศีรษะจะได้รับพร', e: 'bless:tag=nature thread:+wild:2' },
  { id: 'region_undead', tone: 'dark', w: 2, c: { ...R('undead_rising'), stage: ['teen', 'adult', 'elder'] }, t: 'ศพของ[คุณปู่|เพื่อนบ้านคนเก่า|อาจารย์ผู้ล่วงลับ]เดินกลับมาเคาะประตูบ้าน {name}', ch: [
    { l: 'ส่งวิญญาณด้วยความเคารพ', tags: ['pray', 'help'], chk: ['mag', 13], bonusTag: ['holy', 'light', 'necro'], ok: ['ร่างนั้นสงบลง และกระซิบขอบคุณ', 'karma+4 belief+5'], ng: ['ร่างนั้นตะปบใส่', 'hp-20'] },
    { l: 'สู้และเผาร่าง', tags: ['fight'], chk: ['pow', 12], bonusTag: ['fire', 'blunt'], ok: ['เผาร่างจนเป็นเถ้า', 'kill'], ng: ['ถูกกัดจนติดเชื้อ', 'hp-25 curse:c_undeadtouch'] },
    { l: 'ศึกษาว่าทำไมศพลุกได้', tags: ['learn', 'risk'], ax: { curious: 1 }, ok: ['ได้ความรู้ต้องห้ามบางอย่าง', 'apt:necro thread:+dark:2'] },
  ] },
  { id: 'region_festival', tone: 'comedy', w: 2, c: { ...R('festival'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'เทศกาลร้อยปี! มีทั้ง[ประกวดกินพาย|แข่งขี่หมู|เต้นรำกลางจัตุรัส|ประกวดกวีรัก]', ch: [
    { l: 'ลงแข่งขัน', tags: ['risk', 'love'], chk: ['luk', 12], ok: ['ชนะเลิศ! ได้รับมงกุฎดอกไม้', 'fame+8 gold+20 thread:+romance:1'], ng: ['แพ้แต่ได้เพื่อนใหม่', 'rel:+friend'] },
    { l: 'เปิดซุ้มขายของ', tags: ['greed'], chk: ['int', 11], bonusTag: ['trade', 'cook'], ok: ['ขายหมดเกลี้ยง', 'gold+40'], ng: ['ขายไม่ออก', 'gold-5'] },
  ] },
  { id: 'region_migration', tone: 'warm', w: 2, c: { ...R('migration'), stage: ['child', 'teen', 'adult', 'elder'] }, t: 'ฝูงสัตว์ป่าเคลื่อนผ่านทุ่งไม่ขาดสาย ลูกสัตว์ตัวหนึ่งพลัดหลงจากฝูง', ch: [
    { l: 'พามันกลับเข้าฝูง', tags: ['help', 'risk'], ax: { kind: 1 }, chk: ['spd', 12], bonusTag: ['beast_friend', 'beast'], ok: ['จ่าฝูงก้มหัวให้ ราวกับขอบคุณ', 'thread:+wild:3 bless:tag=beast_friend'], ng: ['ถูกฝูงชนเข้าเต็มแรง', 'hp-25'] },
    { l: 'ล่าสัตว์ที่ผ่านมา', tags: ['greed', 'fight'], ok: ['ได้เนื้อและหนังมากมาย', 'gold+40'] },
  ] },
  { id: 'region_horde', tone: 'dark', w: 2, c: { ...R('horde'), stage: ['teen', 'adult'] }, t: 'ขุนศึกออร์คส่งผู้ส่งสารมาทุกหมู่บ้าน "เข้าร่วมกับเรา หรือถูกเหยียบเป็นผุยผง"', ch: [
    { l: 'เข้าร่วมทัพ', tags: ['fight', 'greed'], ax: { brave: 1 }, ok: ['ได้เป็นนักรบในทัพออร์ค', 'job:soldier thread:+warrior:3 gold+20'] },
    { l: 'ท้าดวลผู้ส่งสาร', tags: ['fight', 'defy'], chk: ['pow', 14], bonusTag: ['berserk', 'combat'], ok: ['ชนะ! ออร์คเคารพคนที่แข็งแกร่ง และเลี่ยงหมู่บ้านนี้', 'fame+12 kill'], ng: ['พ่ายแพ้ หมู่บ้านต้องจ่ายส่วย', 'hp-30 gold-20'] },
    { l: 'อพยพ', tags: ['flee'], ok: ['ย้ายไปไกลจากเส้นทางทัพ', 'move'] },
  ] },
  { id: 'region_council', tone: 'warm', w: 2, c: { ...R('council'), stage: ['teen', 'adult', 'elder'] }, t: 'สภาผู้อาวุโสเปิดให้คนทั่วไปเข้าฟังการประชุม เรื่องที่ถกกันคือ "ควรเปิดพรมแดนให้มนุษย์หรือไม่"', ch: [
    { l: 'ลุกขึ้นพูดสนับสนุนการเปิดพรมแดน', tags: ['help', 'trust'], chk: ['int', 13], bonusTag: ['charm', 'scholar', 'leader'], ok: ['สภาฟังและลงมติเห็นด้วย', 'fame+10 karma+4'], ng: ['ผู้อาวุโสหัวเราะใส่', 'fame-3'] },
    { l: 'ฟังเงียบ ๆ และจดบันทึก', tags: ['learn', 'safe'], ok: ['ได้เรียนรู้ภาษาและประวัติศาสตร์โบราณ', 'int+1 skill:scholar_1'] },
  ] },
  { id: 'region_gold_rush', tone: 'comedy', w: 2, c: { ...R('gold_rush'), stage: ['teen', 'adult'] }, t: 'ทุกคนในเมืองทิ้งงานไปขุดทอง แม้แต่นักบวชก็ถือจอบ', ch: [
    { l: 'ไปขุดทองด้วย', tags: ['greed', 'risk'], chk: ['luk', 13], bonusTag: ['mine', 'earth', 'treasure'], ok: ['เจอก้อนทองขนาดเท่ากำปั้น!', 'gold+90'], ng: ['ขุดทั้งปีได้แต่ก้อนหิน', 'gold-10 vit+1'] },
    { l: 'ขายจอบและอาหารให้คนขุด', tags: ['greed', 'safe'], chk: ['int', 11], bonusTag: ['trade'], ok: ['รวยกว่าคนขุดทองเสียอีก', 'gold+60'], ng: ['ขายของแพงจนถูกด่า', 'fame-3 gold+10'] },
  ] },
];
