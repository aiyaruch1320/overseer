# อาชีพทั่วไป 100 อย่าง

ระบบ: [08-jobs-overview.md](08-jobs-overview.md) · อาชีพลับ: [10-jobs-secret.md](10-jobs-secret.md) · อาชีพพิเศษ: [11-jobs-special.md](11-jobs-special.md) · ของที่เพิ่มรองรับอาชีพ: [12-job-support.md](12-job-support.md)

อาชีพทั่วไปคือที่ถูกเสนอตอนบรรลุนิติภาวะและตอนเปลี่ยนอาชีพ มี **อาชีพเดิม 39** (ในโค้ด) และ **อาชีพใหม่ 61** รวม 100 ตัวละครไม่ได้เลือกเองทั้งหมด ระบบเสนอ 3 อย่างที่สุ่มจากน้ำหนักในไฟล์ภาพรวม

**ระดับ** C ธรรมดา · U ไม่ธรรมดา · R หายาก · E มหากาพย์ **ชั้น** ช่าง · บริการ · เทคนิค · ต่อสู้ · ศาสนา · ศิลปะ · ชีวิตช้า (ดูไฟล์ภาพรวม) ความถนัดและค่าสถานะหลักที่ใช้คือรหัสจาก [catalog/aptitudes-skills.md](catalog/aptitudes-skills.md) และ [12-job-support.md](12-job-support.md)

## ก. อาชีพเดิมในโค้ด 39 อย่าง

เงื่อนไขเพิ่มจากโลกคือสิ่งที่เพิ่มจากเงื่อนไขในโค้ดเดิม เพื่อให้สมเหตุสมผลกับเผ่า ถิ่น และสถาบัน ใช้หลักเดียวกับตารางข้อจำกัดใน [01-origin.md](01-origin.md)

| ID | ชื่อ | ระดับ | ความถนัด | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| farmer | ชาวนา | C | farming cooking | ไม่ใช่ยักษ์ (ตัวใหญ่เกินกว่านาข้าวทั่วไป) · ทุกทวีปที่มีที่ดินปลูก | chain_harvest_spirit |
| hunter | นายพราน | C | bow tracking taming | ถิ่นมีป่าหรือภูเขา · เผ่าที่มี `huge` ล่าได้เฉพาะสัตว์ใหญ่ | chain_light_sword |
| soldier | ทหาร | C | sword spear shield axe | ประเทศที่มีกองทัพประจำ · ถ้าอยู่ถิ่นสงคราม (`war`) น้ำหนัก ×2 | chain_light_sword |
| adventurer | นักผจญภัย | U | sword dagger bow tracking stealth | ประเทศที่มีกิลด์ (AL-18 AL-03 ฯลฯ) อายุ 15 ขึ้นไป | chain_light_sword |
| merchant | พ่อค้า | U | trade charm sailing | ทุกเผ่า ฮาล์ฟลิงและแวมไพร์ได้ง่ายขึ้นตาม SR-56 | chain_caravan_fortune |
| mage | นักเวท | R | fire water wind earth ice lightning summon rune space | ค่าเวท 10 ขึ้นไป · หุ่นวิญญาณ ลูกผสมจักรกลเรียนได้ยาก (ผลลดตาม SR-59) | chain_arcane_tome |
| priest | นักบวช | R | light healing divination | ศาสนาแสง: **พระ ชายเท่านั้น** หญิงเป็น `temple_servant` · เทพีแห่งจันทรา: หญิงเท่านั้น · ลัทธิมังกร: เผ่าปีกเท่านั้น (เผ่าอื่นเป็นผู้ช่วย) · พญานาคราช: ต้องผ่านการทดสอบ | chain_holy_vision |
| thief | โจร | C | dagger stealth whip | ไม่จำกัด · ในประเทศที่มีกฎหมายเข้ม (AL-06 AL-08) น้ำหนักลดและเสี่ยงถูกจับ | chain_guild_invite |
| smith | ช่างตีเหล็ก | U | smithing mining hammer | คนแคระ เผ่าลาวา ยักษ์ได้ง่าย (SR-52) · ต้องค่ากำลัง 8 ขึ้นไป | chain_master_forge |
| scholar | นักปราชญ์ | R | scholar rune alchemy divination | ต้องอ่านออก (ปัญญา 8 ขึ้นไป) · AL-11 SV-07 MK-13 เป็นสำนักใหญ่ | chain_arcane_tome |
| bard | กวีพเนจร | U | music charm | ทุกเผ่า ไซเรนและเงือกได้ง่ายขึ้น · ประเทศที่ศาสนาห้ามดนตรีน้ำหนักลด | chain_royal_song |
| fisher | ชาวประมง | C | sailing water spear | ต้องมีถิ่นติดน้ำ · เงือกนาคาเป็นชาวประมงโดยธรรมชาติ | chain_sea_treasure |
| healer | หมอยา | U | healing alchemy nature | ทุกเผ่า · มัมมี่และกูลรักษาผู้อื่นได้ครึ่งเดียว | chain_plague_cure |
| knight | อัศวิน | R | sword mounted shield leadership | ต้องเป็นขุนนาง (`noble`) หรือศิษย์ AL-18 ไรน์วอลด์ · ไม่จำกัดเพศ | chain_light_sword |
| assassin | นักฆ่า | R | dagger stealth alchemy | เข้ากิลด์เงา (NB-05) ได้ง่ายสุด · ดาร์กเอลฟ์และแวมไพร์ได้ง่าย | chain_guild_invite |
| druid | เดรุยด์ | U | nature taming earth | ซิลวาเนลและเขตป่า · ไม่ได้ในประเทศที่ห้ามผู้นอกร่มไม้ | chain_beast_companion |
| pirate | โจรสลัด | U | sailing sword whip | ต้องมีถิ่นติดน้ำ · NR-05 เป็นศูนย์กลาง | chain_sea_treasure |
| cook | พ่อครัว | C | cooking trade | ทุกเผ่า (สไลม์ ฮาล์ฟลิงเด่น) | chain_royal_banquet |
| warlock | ผู้ทำสัญญา | R | contract dark curse blood | ต้องมีความถนัดสัญญาปีศาจหรือไสยศาสตร์ · เผ่าปีศาจ ดาร์กเอลฟ์เด่น | chain_dark_patron |
| tamer | ผู้ฝึกอสูร | U | taming mounted tracking | เผ่าสัตว์ ออร์ค เด่น · ซิลวาเนล มอร์เฮเวน | chain_beast_companion |
| noble | ขุนนาง | R | leadership charm trade | ต้องมี `noble` เท่านั้น (เกิดในตระกูลขุนนางหรือได้ตำแหน่ง) | chain_court_intrigue |
| monk | นักพรต | U | unarmed healing | สำนัก SH-13 ซีมาร์ · วัดในทุกศาสนา · ยักษ์ผู้สละโลก | chain_enlightenment |
| scribe | เสมียน | C | scholar rune | ต้องอ่านออก · ทุกประเทศที่มีสำนักงาน | — |
| shepherd | คนเลี้ยงแกะ | C | taming farming | ทุ่งหญ้า AL-24 SV ภูเขา | — |
| carpenter | ช่างไม้ | C | smithing mining earth | ทุกเผ่า · ยักษ์ทำงานไม้ขนาดใหญ่ | — |
| weaver | ช่างทอผ้า | C | trade charm illusion | AL-05 SH-04 MK-12 เด่น | — |
| servant | คนรับใช้ในวัง | C | cooking charm stealth | ประเทศที่มีราชสำนัก (AL-05 AL-03 AL-08) | — |
| performer | นักแสดงละคร | U | music charm illusion | เมืองใหญ่ · AL-05 AL-13 | — |
| teacher | ครู | U | scholar leadership | ต้องอ่านออก · AL-11 MK-07 | — |
| seer | หมอดู | R | divination illusion | เทพีแห่งจันทรา · ศรัทธาความฝัน (AL-14) · เผ่าฟาโรห์ | — |
| archaeologist | นักสำรวจซากโบราณ | R | scholar rune mining | AL-11 NR-14 MK-04 MK-13 · ต้องการอ่านออกและทนทาน | — |
| spy | สายลับ | R | stealth charm illusion | ทุกประเทศ · NB-09 MH-08 AL-05 เด่น | — |
| diplomat | นักการทูต | R | charm leadership trade | AL-01 NR-01 · ต้องมีชื่อเสียงขั้นต่ำ | — |
| gravekeeper | คนเฝ้าสุสาน | U | necro curse light | AL-25 SH-02 MH-12 · กูลและมัมมี่ไม่ทำ (ทำให้ผู้ตายไม่สบายใจ) | — |
| innkeeper | เจ้าของโรงเตี๊ยม | C | cooking trade charm | ทุกเมือง · ต้องมีเงินเริ่มต้น 50 | — |
| miner | คนงานเหมือง | C | mining earth | KD SH-08 SH-15 AL-12 · ยักษ์ใหญ่เกินเหมืองเล็ก | — |
| sailor | ลูกเรือ | C | sailing water | ต้องมีถิ่นติดน้ำ | — |
| alchemist | นักเล่นแร่แปรธาตุ | R | alchemy fire | NB-06 AL-12 SV-12 เด่น | — |
| royal_guard | ราชองครักษ์ | R | shield sword spear | ต้องเป็นขุนนางหรือชื่อเสียงขั้นต่ำ 15 | — |

## ข. อาชีพใหม่ 61 อย่าง

### ช่างฝีมือ

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| woodcutter | คนตัดไม้ | C | carpentry (pow) | ซิลวาเนลห้ามตัดในเขตร่มไม้ (SV กฎลำต้น) · ที่อื่นปกติ | thread:wild |
| baker | คนทำขนมปัง | C | cooking (luk) | ทุกเมือง · ชนิดขนมตามถิ่น | อนุญาตให้ร้านเป็นศูนย์ข่าวลือ |
| tailor | ช่างตัดเสื้อ | C | tailoring (luk) | AL-05 เด่นสุด · เปิดขายชุดซ่อนอาวุธได้ (AL05-2) | thread:outlaw ได้ถ้าซ่อนอาวุธ |
| potter | ช่างปั้นหม้อ | C | pottery (luk) | ทุกเมือง · ช่างปั้นถ้วยพิธีให้วัด | — |
| brewer | นักต้มเหล้า | C | brewing (int) | ประเทศที่ศาสนาไม่ห้ามสุรา · คนแคระ ออร์ค | พรเดิม `b_ironstomach` ได้ง่าย |
| glassblower | ช่างเป่าแก้ว | U | art pottery (luk) | SH-08 KD-09 เด่น | แก้วเห็นอดีต (SH08-2) |
| jeweler | ช่างเครื่องประดับ | U | jewelry (spd) | AL-05 SH-08 · เงินทุนเริ่มต้น 80 | พรสาย `#treasure` |
| tanner | ช่างฟอกหนัง | C | tailoring husbandry (vit) | ไม่ใช่เมืองที่ศาสนาห้าม (ศรัทธาวิญญาณสัตว์ห้าม) | `c_smell` ได้ง่าย |
| stonemason | ช่างหิน | C | masonry (pow) | KD AL-21 SH-17 · ยักษ์เด่น | thread:warrior |
| shipwright | ช่างต่อเรือ | U | carpentry engineering (int) | NR-12 AL-04 · ต้องมีถิ่นติดน้ำ | ผูก PO-02 |
| clockmaker | ช่างนาฬิกา | R | mechanics (int) | MK-12 NB-01 | ผูก NB-01 ระฆังกลาง |
| rune_carver | ช่างสลักรูน | R | rune masonry (int) | KD-03 KD-04 MK-13 | ผูก GI-05 |
| painter | จิตรกร | U | art (luk) | AL-05 SH-14 | พรสาย `#seer` ได้ถ้าวาดภาพจากฝัน |
| sculptor | ช่างแกะสลัก | U | art masonry (pow) | SH-17 SH-03 | ผูกศรัทธาศิลา |

### งานบริการและพลเรือน

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| courier | คนส่งสาร | C | tracking piloting (spd) | ทุกประเทศ · ผู้ส่งสารเผ่านก SV-11 เด่น | thread:wanderer |
| ferryman | คนพายเรือรับจ้าง | C | sailing fishing (vit) | ต้องมีแม่น้ำ · NR-09 SV-17 | เห็นผู้ลี้ภัยทางน้ำ (DR-05) |
| lamplighter | คนจุดโคม | C | light (luk) | NB-03 เด่น · ทั่วโลกในเมืองใหญ่ | ผูก FG-13 |
| lighthouse_keeper | ผู้ดูแลประภาคาร | R | sailing piloting (int) | ถิ่นติดทะเล · NR-06 NR-15 | **ชีวิตช้า** ผูก DR-05 DR-06 |
| librarian | บรรณารักษ์ | R | scholar writing (int) | AL-11 SV-07 | **ชีวิตช้า** เข้าถึงบันทึกต้องห้ามช้ากว่านักปราชญ์ |
| chronicler | นักบันทึกประวัติศาสตร์ | R | writing scholar (int) | ทุกเผ่า · AL-01 (นักบันทึกสภา) | ผูกเหตุการณ์ใหญ่ ทำให้ความทรงจำของเหตุการณ์ยั่งยืน |
| cartographer | นักทำแผนที่ | U | art sailing scholar (int) | NR-15 AL-11 | thread:wanderer |
| accountant | นักบัญชี | U | accounting (int) | AL-10 AL-13 NR-01 | พบความลับทางการเงินของ NPC (ผูก AL10-3) |
| banker | นายธนาคาร | R | accounting trade (int) | AL-10 NB-02 (เลือด) NR-01 | thread:greed |
| tax_collector | คนเก็บภาษี | U | accounting law (int) | ทุกประเทศที่มีรัฐ · เกลียดง่าย | ได้ `c_envyaura` ง่าย |
| lawyer | ทนายความ | R | law (int) | AL-06 AL-27 AL-08 | thread:rebel ถ้ารับคดีผู้ถูกกดขี่ |
| mayor | ผู้ใหญ่บ้าน | U | leadership law (int) | ทุกเมืองเล็ก · ต้องอายุ 30 ขึ้นไปและความไว้ใจในเมือง | ผูกเหตุการณ์ท้องถิ่น |
| midwife | หมอตำแย | U | medicine herbalism (int) | **หญิงเป็นหลัก** ชายเป็นได้แต่ต้องได้รับความเชื่อใจจากชุมชน | พรสาย `#fertile` |
| apothecary | เภสัชกร | U | herbalism alchemy (int) | AL-26 NB-06 SV-02 | เห็นกาฬโรค (CT-03) ก่อนใคร |
| veterinarian | หมอสัตว์ | U | medicine husbandry (int) | เผ่าสัตว์ ไชร์ AL-16 | thread:wild |

### งานเทคนิคและวิชาการ

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| physician | แพทย์ | R | medicine (int) | AL-26 SV-02 MK-08 · ต้องผ่านสำนัก | ผูก CT-03 HP-06 |
| engineer | วิศวกร | R | engineering (int) | MK-07 NR-12 AL-09 | ผูก MC-07 |
| mechanic | ช่างกล | U | mechanics (int) | MK-12 MK-05 AL-28 | ซ่อมหุ่น (ผูก MC-03) |
| rail_driver | คนขับรถจักร | U | piloting mechanics (spd) | MK-05 AL-28 | ผูก MC-07 WR-16 |
| airship_pilot | นักบินเรือเหาะ | R | piloting engineering (spd) | MK-09 NR-12 | ผูก PO-02 WR-01 |
| navigator | นักเดินเรือ | U | sailing piloting (int) | ถิ่นติดทะเล · NR-15 | ผูก DR-06 |

### งานต่อสู้และเสี่ยงอันตราย

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| city_guard | ทหารยาม | C | sword spear shield (pow) | ทุกเมือง | พบอาชญากรรมระดับเมือง |
| mercenary | ทหารรับจ้าง | U | sword axe leadership (pow) | AL-10 MH-09 MK-16 | ผูก MC-08 WR-16 |
| caravan_guard | ผู้คุ้มกันคาราวาน | U | sword bow tracking (spd) | SH-04 AL-28 · ถิ่นการค้า | ผูก WR-10 |
| bounty_hunter | นักล่าค่าหัว | R | tracking dagger investigation (spd) | AL-27 NR-05 | พบ `c_wanted` ของ NPC |
| gladiator | นักสู้สังเวียน | U | unarmed sword shield (pow) | MH-02 MH-09 AL-18 | thread:warrior |
| beast_hunter | นักล่าอสูร | R | sword bow tracking (pow) | ทุกทวีปที่มีอสูร · ซิลวาเนล เนบูเลีย | ล่าอสูรในหมอก (FG-01) |
| explorer | นักสำรวจ | U | tracking sailing scholar (spd) | ทุกทวีป | thread:wanderer |
| smuggler | ผู้ลักลอบ | U | stealth sailing trade (spd) | NR-05 NB-09 SH-15 | thread:outlaw |

### งานศาสนา

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| temple_servant | ผู้รับใช้ศาสนจักร | U | healing light cooking (int) | ศาสนจักรแห่งแสง **หญิงและชาย** (หญิงเป็น `temple_servant` ได้ แต่บวชเป็นพระไม่ได้) | ผูกผู้พิพากษาศาล (AL02-2) |
| exorcist | ผู้ขับไล่ผี | R | light necro curse (mag) | AL-02 AL-25 SH-02 | ผูก DM-09 |
| inquisitor | ผู้พิพากษาศาลศาสนา | R | law investigation light (int) | AL-02 · พระหรือผู้รับใช้ | ผูก GD-02 |
| pilgrim | ผู้แสวงบุญ | U | unarmed scholar (vit) | SH-09 AL-02 AZ-01 | thread:faithful |

### งานศิลปะ

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| dancer | นักเต้น | U | music charm (spd) | AL-05 NR-08 SH-04 | thread:romance |
| jester | ตัวตลกในวัง | U | charm illusion (luk) | AL-05 MH-07 | เห็นการเมืองใกล้ตัว |

### ชีวิตช้า (slow life)

อาชีพกลุ่มนี้ (รวม ผู้ดูแลประภาคาร และ บรรณารักษ์ ในหมวดบริการ รวม 14 อาชีพ) มีน้ำหนักต่ำในการเสนอปกติ (ระดับ R ขึ้นไป) แต่ขึ้นเป็น 4 เท่าเมื่อเข้าสู่เส้น "ปลดเกษียณ" ตามกติกาในไฟล์ภาพรวม ชีวิตช้าให้ฟื้นตัวเร็วและมีเส้นเรื่องอบอุ่น แต่ได้เงินและชื่อเสียงน้อย

| ID | ชื่อ | ระดับ | ความถนัด (สถานะหลัก) | เงื่อนไขเพิ่มจากโลก | เส้นเรื่องที่เปิด |
| --- | --- | --- | --- | --- | --- |
| farm_owner | เจ้าของฟาร์ม | R | farming husbandry gardening (vit) | มีเงิน 100 ขึ้นไป หรือรับมรดก · ไม่อยู่ในถิ่นสงคราม | ผูก HP-07 DM-11 (ปีศาจปลูกข้าว) |
| vegetable_gardener | คนทำสวนผัก | R | gardening (vit) | มีที่ดินเล็ก · ไม่อยู่ในเถ้า (DR-04) | ผูกพร `nb_green_thumb` |
| orchardist | คนทำสวนผลไม้ | R | gardening (vit) | ถิ่นอบอุ่น AL-16 AL-17 | ผูก BIO-03 ถ้าได้ต้นกล้า |
| beekeeper | คนเลี้ยงผึ้ง | R | husbandry gardening (vit) | ถิ่นอบอุ่น ซิลวาเนล | ผึ้งไวต่อ BIO-01 เตือนก่อนคน |
| tea_grower | คนปลูกชา | R | gardening (luk) | ถิ่นภูเขาอบอุ่น (KD-12 ไม่ได้ ถิ่นหนาวเกิน) | ร้านน้ำชาเป็นที่ประชุมข่าวลือ |
| flower_grower | คนปลูกดอกไม้ | R | gardening art (luk) | AL-05 AL-14 | ผูก NB-11 ถ้าส่งดอกไม้ให้ช่างหน้ากาก |
| cheesemaker | คนทำเนยแข็ง | R | husbandry brewing (vit) | AL-16 AL-24 ภูเขา | thread:wild |
| miller | คนสีข้าว | R | mechanics farming (vit) | AL-17 NR-09 | ผูก CT-08 DR-04 (ข้าวขาด) |
| herb_shop | เจ้าของร้านสมุนไพร | R | herbalism (int) | ทุกเมืองยกเว้นเขตหมอกทึบ | ผูก CT-03 |
| tea_house | เจ้าของร้านน้ำชา | R | cooking charm (luk) | เมืองสงบ · AL-16 NR-09 | ผูกข่าวและ NPC ประจำร้าน |
| bookshop | เจ้าของร้านหนังสือ | R | scholar writing (int) | AL-11 SV-07 | ผูกบันทึกต้องห้าม ราคาสูง |
| temple_gardener | ผู้ดูแลสวนวัด | R | gardening herbalism (vit) | วัดของศาสนาใดก็ได้ที่มีสวน · SV-02 SH-13 AL-02 | ผูกพิธีและพรเล็กของวัด |
