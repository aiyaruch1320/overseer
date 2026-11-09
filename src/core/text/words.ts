// The words of the systems of M3 (bonds, bondage, travel, items, economy, npc, combat) that no document lists as one table
// (docs/guide/code-plan.md §2 rule 3). Used by `m3.ts`. Each table says what the player reads for a word the systems write in the log.

/** The five levels of a bond (bonds/01-ties-and-levels.md §2), when the data file is not loaded. */
export const BOND_LEVEL_TH: Record<number, string> = { 1: 'รู้จัก', 2: 'คุ้นเคย', 3: 'สนิท', 4: 'ไว้ใจ', 5: 'ชั่วชีวิต' };

/** What the character does with each of the 24 moods toward a person (bonds/02-feelings.md): `{who} {verb} {person}`. */
export const MOOD_TH: Record<string, string> = {
  ห่วง: 'ห่วง', คิดถึง: 'คิดถึง', ภูมิใจ: 'ภูมิใจในตัว', ไว้ใจ: 'ไว้ใจ', ขอบคุณ: 'ขอบคุณ', ยินดี: 'ยินดีกับ', เสียใจ: 'เสียใจเรื่อง', น้อยใจ: 'น้อยใจ', โกรธ: 'โกรธ', ผิดหวัง: 'ผิดหวังใน',
  อิจฉา: 'อิจฉา', หึง: 'หึงหวงเพราะ', หวงแหน: 'หวงแหน', เกรงใจ: 'เกรงใจ', เคารพ: 'เคารพ', ชื่นชม: 'ชื่นชม', ละอาย: 'ละอายใจต่อ', รู้สึกผิด: 'รู้สึกผิดต่อ', กลัวเสีย: 'กลัวจะเสีย',
  เหงา: 'เหงาเมื่อขาด', ระแวง: 'ระแวง', แค้น: 'แค้น', รัก: 'รัก', เอ็นดู: 'เอ็นดู',
};

/** Where a person came from (`from` of a bond line), as the player reads it. A story node is read by its title. */
export const TIE_FROM_TH: Record<string, string> = {
  school: 'ที่โรงเรียน', work: 'ที่ทำงาน', journey: 'ระหว่างเดินทาง', peer: 'ในวัยเดียวกัน', roster: 'คนที่โลกรู้จักชื่อ', redeem: 'ที่ไถ่ตัวมา', prayer: 'ตามคำอธิษฐาน', closeKin: 'ญาติสนิท',
  couple: 'ลูกของสองคน', child: 'ลูกของเขา', party: 'ร่วมคณะเดินทาง',
};

/** Why a bond moved (`why` of a bond level or line line). */
export const BOND_WHY_TH: Record<string, string> = {
  meet: 'พบกันบ่อย', silent: 'ห่างหายกันไปนาน', party: 'ร่วมเดินทางด้วยกัน', refused: 'ถูกปฏิเสธเมื่อขอความช่วยเหลือ', story: 'จากเรื่องที่ผ่านมาด้วยกัน', crisis: 'ผ่านวิกฤตด้วยกัน',
  asked: 'ได้ขอความช่วยเหลือกัน', joy: 'ดีใจด้วยกัน', reconcile: 'คืนดีกัน', goodEnd: 'จบเรื่องร่วมกันด้วยดี', ตาย: 'เขาจากไป',
};

/** The causes a person of the bonds died of, besides the four of the character system (`CAUSE_TH`). */
export const BOND_CAUSE_TH: Record<string, string> = { orphan: 'พ่อแม่ไม่อยู่แล้ว', ตาย: '', เรื่องของเขาจบ: 'เรื่องของเขาจบลงที่ความตาย' };

/** The answer of the character to a crisis of a bond. */
export const CRISIS_ANSWER_TH: Record<string, string> = { full: 'ช่วยเขาเต็มกำลัง', small: 'ช่วยได้เพียงเล็กน้อย', refuse: 'ไม่ได้ช่วยเขา' };

/** Why an invitation was refused. */
export const REFUSAL_TH: Record<string, string> = { plain: 'เขาปฏิเสธ', condition: 'เขาปฏิเสธเพราะยังติดภาระอยู่', hurt: 'เขาปฏิเสธและเสียน้ำใจ' };

/** What the character asks of a bond. `{p}` is the person. */
export const INVITE_TH: Record<string, { ask: string; ok: string }> = {
  travel: { ask: 'ชวน {p} ออกเดินทางด้วยกัน', ok: 'เขาตกลง' },
  lover: { ask: 'ขอให้ {p} เป็นคนรัก', ok: 'เขารับ' },
  spouse: { ask: 'ขอให้ {p} ใช้ชีวิตคู่ด้วยกัน', ok: 'เขารับ' },
  business: { ask: 'ชวน {p} ร่วมกิจการ', ok: 'เขาตกลง' },
  reconcile: { ask: 'ขอคืนดีกับ {p}', ok: 'เขาให้อภัย' },
};

/** How a held person is freed. */
export const FREED_BY_TH: Record<string, string> = {
  ransom: 'ไถ่เขาออกมา', crossed: 'พาเขาข้ามแดนไปสู่อิสระ', bribe: 'ติดสินบนให้ปล่อยเขา', freed: 'ปล่อยเขาเป็นอิสระ', helped: 'ช่วยเขาหนี',
  owner: 'เจ้าของเขาปล่อยตัวให้',
};

/** The causes that send the character on the road (keys of the travel system). */
export const TRAVEL_CAUSE_TH: Record<string, string> = {
  sc: 'ไปเรียนต่างแดน', ps: 'ไปแสวงบุญ', ml: 'ไปรับจ้างรบ', ex: 'ลี้ภัยจากภัยพิบัติ', exile: 'ถูกเนรเทศหรือหนีโทษ', xc: 'ตอบรับคำเชิญจากต่างเผ่า', wd: 'ออกเดินทางเพราะอยากรู้อยากเห็น', tr: 'ไปตามหนี้หรือสัญญา',
};

/** Why a trip was made (`why` of a trip), beyond the causes. */
export const TRIP_WHY_TH: Record<string, string> = {
  return: 'เดินทางกลับ', home: 'กลับบ้านเกิดยามชรา', city: 'ไปทำงานในเมือง', forge: 'ไปหาช่างตีอาวุธ', visitor: 'ไปตามคำเชิญ', d6: 'ไปตามทางทหารรับจ้าง', pilgrimage: 'ไปแสวงบุญ', ...TRAVEL_CAUSE_TH,
};

/** The things met on the road (`note` of `travel/road`). */
export const ROAD_TH: Record<string, string> = {
  resist: 'ไม่ยอมจ่ายให้ด่านเรียกภาษี', bandits: 'ถูกโจรหรือสัตว์ร้ายดักทาง', 'fellow traveller': 'ได้ร่วมทางกับผู้เดินทางต่างเผ่า', festival: 'ผ่านเทศกาลหรือตลาดนัด ทางช้าลงหนึ่งฤดู', refugees: 'พบผู้ลี้ภัยตามทาง',
  draft: 'ทหารเกณฑ์เกวียนไปใช้หนึ่งฤดู', 'mercenary road': 'ทางชวนให้ไปเป็นทหารรับจ้าง', 'carried the sickness': 'ติดไข้ระหว่างทาง', quarantine: 'ถูกกักตัวที่ด่านผู้ป่วย', delayed: 'พาหนะขัดข้อง ทางช้าลงหนึ่งฤดู',
  'safe inn': 'ได้พักที่พักปลอดภัยและฟังเรื่องเล่า', 'met again': 'พบผู้เดินทางที่เคยพบกันมาก่อน',
};

/** The levels of travel. */
export const TRAVEL_LEVEL_TH: Record<number, string> = { 0: 'อยู่ถิ่น', 1: 'ในทวีป', 2: 'ข้ามทวีป' };

/** How a poor year was got through (`economy/tight`). */
export const TIGHT_TH: Record<string, string> = {
  help: 'พึ่งญาติพี่น้องช่วยเหลือ', loan: 'กู้ยืมมาใช้จนติดหนี้', work: 'รับงานเสี่ยงอันตรายแลกเงิน', sell: 'ขายของติดตัวแลกเงิน', bond: 'ขายตัวเข้าพันธะ',
};

/** How the character took part in a raid on his land. */
export const RAID_TH: Record<string, string> = {
  saved: 'ปกป้องบ้านเมืองไว้ได้', cost: 'รับมือได้แต่เสียชื่อเสียงไปกับวิธีที่ใช้', lost: 'พ่ายแพ้ ชาวบ้านต้องเสียหาย', fled: 'หนีออกมา', dead: 'สิ้นชีวิตในศึก', skip: 'ไม่ได้ลงมือ',
};

/** The role of a soldier in a war battle. */
export const WAR_ROLE_TH: Record<string, string> = { front: 'แนวหน้า', archer: 'พลธนู', mage: 'จอมเวท', commander: 'ผู้บัญชาการ', medic: 'หมอสนาม', spy: 'สายลับ' };

/** The wounds the combat system writes. */
export const WOUND_TH: Record<string, string> = { scar: 'แผลเป็นถาวร', injury: 'บาดเจ็บสาหัสจนไม่เหมือนเดิม' };

/** The result of a clash with a named NPC, seen from the character (the standard kinds of combat/07 §3). */
export const CLASH_RESULT_TH: Record<string, string> = {
  win_kill: '{who}ชนะและอีกฝ่ายล้มลง', win_spare: '{who}ชนะและไว้ชีวิตอีกฝ่าย', talk: 'จบลงด้วยการเจรจา', draw: 'ไม่มีใครเหนือกว่า', lose: '{who}เป็นฝ่ายแพ้', flee: '{who}หนีไป',
};

/** The rescues in the last breath of a fight. */
export const RESCUE_TH: Record<string, string> = {
  b_laststand: 'พรยืนหยัดครั้งสุดท้ายช่วยชีวิตเขาไว้',
  rewind: 'เวลาย้อนกลับไปชั่วขณะ เขารอดตายมาได้',
  guardian_angel: 'ผู้พิทักษ์ที่มองไม่เห็นยื่นมือช่วยเขาไว้',
};

/** Why a legend weapon cannot come to the character. */
export const LEGEND_GONE_TH: Record<string, string> = { broken: 'แตกสลายไปแล้ว', held: 'อยู่ในมือผู้อื่นแล้ว' };

/** The end of an order at a smith, and the way it was paid. */
export const FORGE_OUTCOME_TH: Record<string, string> = { ordered: 'ได้ตามที่สั่ง', flawed: 'ออกมามีตำหนิ', fail: 'ล้มเหลว เสียทั้งเงินและเวลา', masterpiece: 'ออกมาเป็นผลงานชิ้นเอก' };
export const FORGE_PAY_TH: Record<string, string> = {
  ก: 'จ่ายเต็มราคา', 'ข+': 'ต่อรองจนได้ลดราคา', 'ข-': 'ต่อรองไม่สำเร็จ ช่างเสียน้ำใจ', ค: 'จ่ายครึ่งหนึ่งและช่วยงานช่างแทน', ง: 'เก็บเงินจนครบแล้วจ่าย', self: 'ตีเอง',
};

/** The buyers of an ancient talisman and what became of it (`items/talisman`). */
export const TALISMAN_TH: Record<string, string> = { found: 'ถูกขุดพบจากซาก', accepted: 'เจ้าของยอมรับวิญญาณในเครื่องราง', sold: 'ถูกขายต่อให้คนอื่น', buried: 'ถูกฝังกลับลงซาก' };

/** Why a person who was sick fell ill. */
export const SICK_TH: Record<string, string> = { old: 'ด้วยวัย', plague: 'ด้วยโรคระบาด' };

/** The ranks of a soldier (`RANKS` of the combat system) as the player reads them. */
export const RANK_TH: Record<string, string> = { recruit: 'พลทหารใหม่', soldier: 'พลทหาร', corporal: 'สิบตรี', sergeant: 'จ่า', captain: 'หัวหน้ากอง' };

/**
 * The battle lines of a war, several wordings for each outcome so that a long war does not read the same line twenty times. The entry picks one by
 * a hash of its content (never the seed streams). Slots: `{who}` `{role}` `{foe}` `{place}`.
 */
export const WAR_HELD_TH: string[] = [
  '{who}ถือแนวในหน้าที่{role} สู้กับ{foe}{place} และยังยืนอยู่',
  'ศึกกับ{foe}{place}: {who}ทำหน้าที่{role}ได้ครบ ฝ่ายเราไม่เสียแนว',
  '{foe}โหมเข้ามาอีกระลอก {who}สู้ในฐานะ{role} จนข้าศึกต้องถอยหลัง',
  '{who}ร่วมรบกับ{foe}{place} ในหน้าที่{role} ผ่านวันนั้นมาได้โดยไม่เสียแนว',
  'วันนั้น{who}อยู่ในหน้าที่{role}{place} ต้านทัพ{foe}ไว้ได้',
  '{who}ผ่านศึกกับ{foe}อีกครั้ง ในหน้าที่{role}{place}',
  'ฝ่ายเรายันทัพ{foe}ไว้{place} {who}ในหน้าที่{role}ได้กลับมาพร้อมเพื่อนร่วมรบ',
];
export const WAR_WON_TH: string[] = [
  '{who}นำชัยเหนือ{foe}{place} ในหน้าที่{role} ฝ่ายตรงข้ามแตกพ่าย',
  'ศึกกับ{foe}{place}จบด้วยชัยชนะ {who}ทำหน้าที่{role}ได้โดดเด่น',
  '{who}ในหน้าที่{role}ช่วยให้ฝ่ายเราชนะ{foe}อย่างเด็ดขาด{place}',
  '{foe}ถูกตีแตก{place} {who}เป็นหนึ่งในผู้ที่พลิกศึกในหน้าที่{role}',
  'ชัยชนะเหนือ{foe}{place} มีฝีมือของ{who}ในหน้าที่{role}อยู่ในนั้น',
];
export const WAR_FIRST_TH: string[] = [
  '{who}เข้าร่วมสงคราม{war}{place} ในฐานะ{rank}ประจำหน้าที่{role}: ศึกแรกกับ{foe}{result}',
  'ศึกแรกของ{who}ในสงคราม{war}{place}: {foe}อยู่ตรงหน้า {who}ในฐานะ{rank}ประจำหน้าที่{role}{result}',
];
export const WAR_FIRST_RESULT_TH = { held: ' ผ่านไปได้ ฝ่ายเรายังยืนอยู่', won: ' จบด้วยชัยชนะ' };
export const WAR_LOST_TH: string[] = [
  'ฝ่ายของ{who}ถูก{foe}ตีแตก{place} {who}ทำหน้าที่{role}ได้เท่านี้',
  'ศึกกับ{foe}{place}พ่ายแพ้ แนวของ{who}ในหน้าที่{role}ถูกฝ่าเข้ามา',
  '{who}ถอยร่นจาก{foe}{place} ทัพฝ่ายเราแตกกระเจิง',
  '{foe}ตีฝ่ายของ{who}แตก{place} {who}ในหน้าที่{role}ต้องหนีเอาตัวรอด',
];
export const WAR_DEAD_TH: string[] = [
  '{who}สิ้นชีวิตในศึกกับ{foe}{place}',
  '{foe}พรากชีวิต{who}กลางศึก{place}',
  '{who}ล้มลงในหน้าที่{role}{place} ศึกกับ{foe}จบชีวิตเขา',
];
/** A promotion in a war. Slots: `{who}` `{from}` `{to}` `{war}`. */
export const WAR_RANK_TH: string[] = [
  '{who}ได้เลื่อนยศจาก{from}เป็น{to}{war}',
  'ผลงานในสนามรบทำให้{who}ได้เลื่อนเป็น{to} (จาก{from}){war}',
  '{who}ขึ้นเป็น{to}แล้ว หลังรบมาหลายศึก{war}',
];

/** How a partner or a child went from the character (`reason` of `bonds/end`). Slots: `{name}` `{tag}` (what he was to the character) `{who}`. */
export const END_PARTNER_TH: Record<string, string> = {
  ตาย: '{name} {tag} จากไปแล้ว',
  แยกทาง: '{who}กับ {name} แยกทางกัน ความสัมพันธ์ที่เคยเป็น{role}จบลงแล้ว{because}',
  ห่างหาย: '{name} {tag} ห่างหายไปจนไม่มีข่าวคราวถึง{who}อีก',
  หายไป: '{name} {tag} หายไปโดยไม่มีใครรู้ว่าไปไหน',
  หักหลัง: '{name} {tag} หักหลัง{who} ความสัมพันธ์จบลงด้วยความเจ็บปวด',
};
export const END_CHILD_TH: Record<string, string> = {
  ตาย: '{name} {tag} จากไปแล้ว',
  แยกทาง: '{name} {tag} แยกตัวออกไปและตัดขาดจาก{who}{because}',
  ห่างหาย: '{name} {tag} ห่างหายไปจนไม่มีข่าวคราวถึง{who}อีก',
  หายไป: '{name} {tag} หายไปโดยไม่มีใครรู้ว่าไปไหน',
  หักหลัง: '{name} {tag} หันมาทำร้าย{who} สายเลือดจึงขาดลง',
};

/** What a child has become when he reaches a stage (`stage` of `bonds/news` grow). */
export const GROW_TH: Record<string, string> = {
  child: 'เติบโตเป็นเด็กวัยเรียนแล้ว',
  youth: 'โตเป็นหนุ่มสาวแล้ว',
  adult: 'เป็นผู้ใหญ่เต็มตัวแล้ว',
};

/**
 * What the hand of the god did to the answer to a crisis (`by` of `bonds/trouble`): the push matched the answer (`with`) or the answer went the other way (`against`).
 * A whisper `ช่วย` and a dream push toward helping, a whisper that he lies pushes away from it.
 */
export const CRISIS_BY_TH: Record<string, { with: string; against: string }> = {
  whisper: { with: ' ตามที่ท่านกระซิบ', against: ' แม้ท่านกระซิบให้ช่วย' },
  dream: { with: ' หลังความฝันที่ท่านส่งถึงเขา', against: ' แม้ท่านส่งฝันถึงเขา' },
  liar: { with: ' เพราะท่านกระซิบว่าเขาโกหก', against: ' แม้ท่านกระซิบว่าเขาโกหก' },
};

/** Why a partner or a friend parted, by the feeling held toward him when the tie broke (`bmood` of `bonds/end`). */
export const MOOD_BREAK_TH: Record<string, string> = {
  แค้น: 'ความแค้นที่สะสมมานาน', โกรธ: 'ความโกรธที่ค้างคาใจ', หึง: 'ความหึงหวง', ระแวง: 'ความระแวงที่ไม่เคยหาย', น้อยใจ: 'ความน้อยใจที่สะสมมา', ผิดหวัง: 'ความผิดหวังที่สะสมมา', ละอาย: 'ความละอายใจ',
};

/** The story nodes that break a tie, said as the reason (a node's title says nothing about why: "ความรัก"). */
export const NODE_BREAK_TH: Record<string, string> = {
  'bn.a3': 'ความรักไปต่อไม่ได้',
  'bn.a4': 'เขาผิดคำพูดหรือหักหลังกัน',
};

/** Why the character did not reach a place, or was kept from it (`why` of `travel/stay` and `travel/blocked`). */
export const NO_GO_TH: Record<string, string> = {
  bound: 'ถูกผูกตัวอยู่ จึงไปไหนเองไม่ได้',
  purse: 'เงินไม่พอค่าเดินทาง',
  war: 'สงครามปิดเส้นทางไปที่นั่น',
  'route closed': 'เส้นทางไปที่นั่นถูกปิด',
  'no route': 'ไม่มีเส้นทางไปถึงที่นั่น',
  closed: 'ที่นั่นปิดไม่รับคนนอก',
  wanted: 'ที่นั่นตามจับตัวอยู่',
  extradition: 'ที่นั่นจะส่งตัวผู้ต้องหาให้เมืองที่ตามจับ',
  fallen: 'ที่นั่นล่มสลายไปแล้ว',
  'deep water': 'ที่นั่นอยู่ใต้น้ำลึก',
  cold: 'ร่างกายทนความหนาวที่นั่นไม่ได้',
  dry: 'ร่างกายทนความแห้งแล้งที่นั่นไม่ได้',
  'no dust': 'ไม่มีฝุ่นศักดิ์สิทธิ์ติดตัวไว้ประคองร่าง',
  necro: 'ที่นั่นไม่รับผู้ใช้ศาสตร์ของผู้ตาย',
  'tree burner': 'ที่นั่นล่าตัวผู้เผาต้นไม้โลก',
  'god thief': 'ที่นั่นรู้ว่าเขาขโมยของเทพ',
  far: 'ข้ามทวีปไกลเกินไป จึงเลือกอยู่ที่เดิม',
  chance: 'ยังเลือกอยู่ที่เดิม',
};
