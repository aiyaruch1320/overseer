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
  ransom: 'ไถ่เขาออกมาด้วยทอง', crossed: 'พาเขาข้ามแดนไปสู่อิสระ', bribe: 'ติดสินบนให้ปล่อยเขา', freed: 'ปล่อยเขาเป็นอิสระ', helped: 'ช่วยเขาหนี',
  owner: 'เจ้าของเขาปล่อยตัวให้',
};

/** The causes that send the character on the road (keys of the travel system). */
export const TRAVEL_CAUSE_TH: Record<string, string> = {
  sc: 'ไปเรียนต่างแดน', ps: 'ไปแสวงบุญ', ml: 'ไปรับจ้างรบ', ex: 'ลี้ภัยจากภัยพิบัติ', exile: 'ถูกเนรเทศหรือหนีโทษ', xc: 'ตอบรับคำเชิญจากต่างเผ่า', wd: 'ออกเดินทางเพราะอยากรู้อยากเห็น', tr: 'ไปตามหนี้หรือสัญญา',
};

/** Why a trip was made (`why` of a trip), beyond the causes. */
export const TRIP_WHY_TH: Record<string, string> = {
  return: 'เดินทางกลับ', city: 'ไปทำงานในเมือง', forge: 'ไปหาช่างตีอาวุธ', visitor: 'ไปตามคำเชิญ', d6: 'ไปตามทางทหารรับจ้าง', ...TRAVEL_CAUSE_TH,
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
