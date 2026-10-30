# พรใหม่ที่ผูกกับโลก

ระบบ: [README.md](README.md) · พรเดิม: [../../_generated/character-catalog/blessings.md](../../_generated/character-catalog/blessings.md) · พรเฉพาะเผ่า: [../../lore/races/README.md](../../lore/races/README.md)

ผลเขียนแบบโค้ด (`pow+2` `#แท็ก`) รหัสขึ้นต้น `nb_` ระดับ C ธรรมดา · U ไม่ธรรมดา · R หายาก · E มหากาพย์ · L ตำนาน ช่อง **ได้จาก** บอกเงื่อนไขที่ทำให้น้ำหนักสุ่มเพิ่ม (นอกเหนือจากน้ำหนักตามความหายาก)

## ก. พรถิ่นเกิด

| ID | ชื่อ | ระดับ | ผล | ได้จาก | ในโลก |
| --- | --- | --- | --- | --- | --- |
| nb_sky_born | เกิดใต้ท้องฟ้ามังกร | U | spd+1 #fall_save | เกิดในอัซการ์ | เด็กอัซการ์ถูกสอนให้ตกอย่างมีศิลปะ เมื่อตกจากที่สูงจะไม่ตายครั้งแรก |
| nb_cloud_nap | หลับบนเมฆ | C | #fear_height_res | เกิดในอัซการ์ ไม่ใช่เผ่าปีก | เด็กที่โตบนเกาะลอยฟ้าไม่กลัวที่สูง |
| nb_ash_lung | ปอดทนเถ้า | C | vit+1 #ash_res | เกิดในมอร์เฮเวน | ทะเลทรายเถ้าสอนให้ปอดทน |
| nb_forge_born | ลูกเตาหลอม | U | pow+1 #fire_res | เกิดในคาซ-ดูรัม | นอนข้างเตาตั้งแต่เกิด |
| nb_tide_born | ลูกกระแสน้ำ | U | #water_breath_short #sea | เกิดในเนเรีย | ดำน้ำได้นานสองเท่าของคนปกติ |
| nb_open_road | เกิดบนถนนทุ่งราบ | C | luk+1 #wanderer | เกิดในอัลเดรีย ระหว่างสงครามฟอร์เทีย | บ้านย้ายตามศึก |
| nb_gear_sense | หูจับเฟือง | U | int+1 #mech_sense | เกิดในเมคาเรีย | ได้ยินเครื่องจักรผิดปกติก่อนใคร |
| nb_dust_blood | เลือดทราย | U | vit+1 #heat_res #thirst_res | เกิดในซาฮารัน | ทนกระหายได้นานเป็นสองเท่า |
| nb_root_sense | รู้สึกถึงราก | U | #nature_sense | เกิดในซิลวาเนล | รับรู้สุขภาพของป่าในระยะไกล |
| nb_fog_walker | ผู้เดินในหมอก | U | #fog_sight #darkvision | เกิดในเนบูเลีย | มองทะลุหมอกเบา ไม่หลงทางในหมอกหนา |
| nb_homeland_call | เสียงเรียกจากบ้านเก่า | U | #homeland_sense | เกิดนอกถิ่นหลักของเผ่า | รับรู้ข่าวและวิกฤตของถิ่นกำเนิดเผ่า แม้ไม่เคยไปที่นั่น |

## ข. พรสายเลือดและกำเนิดพิเศษ

| ID | ชื่อ | ระดับ | ผล | ได้จาก | ในโลก |
| --- | --- | --- | --- | --- | --- |
| nb_shadow_kin | ญาติเงา | U | spd+1 #shadow_meld | ดาร์กเอลฟ์ ผู้ไร้เงา | ตัวผสมกับเงาตัวเองได้ในที่มืด |
| nb_gel_memory | ความจำเจล | R | int+1 #absorb_memory | สไลม์ | จดจำสิ่งที่กลืน รู้ภาพจากสิ่งที่เคยกลืน |
| nb_pact_blood | เลือดสัญญา | R | #contract_bonus | เผ่าปีศาจ | สัญญาที่เซ็นด้วยเลือดตัวเองผลหนักกว่าปกติ |
| nb_lava_pulse | ชีพจรลาวา | R | pow+1 #lava_burst | เผ่าลาวา | ร่างร้อนจัดเมื่อโกรธ ทำลายสิ่งที่แตะ |
| nb_both_banks | ผู้ข้ามสองฝั่ง | R | #diplomat | ลูกครึ่งของสายเลือดที่เป็นศัตรูกัน | ผู้เดียวที่เดินข้ามเขตสงครามได้ ทั้งสองฝ่ายรับฟัง |
| nb_eclipse_born | เกิดใต้เงาสุริยะ | R | #shadow #fate_shift | เกิดใต้ดวงสุริยคราส | ดวงชะตาเอียงสู่ความมืด โอกาสได้พร/คำสาปสายมืดสูง |
| nb_stone_kin | ญาติศิลา | U | vit+1 #stone_skin | ยักษ์ | เรียกกำแพงหินได้เมื่อเอามือแตะพื้น |
| nb_wing_memory | ความทรงจำปีก | U | spd+1 #glide | เผ่าปีก | แม้ปีกหักก็ร่อนได้ |
| nb_dry_vow | คำสาบานแห้ง | R | #oath_keeper | มัมมี่ | คำสาบานที่ให้แล้วไม่มีวันถูกบังคับให้ผิด |
| nb_soul_spark | ประกายวิญญาณ | R | int+1 #soul_resist | หุ่นวิญญาณ | เวทที่กระทบจิตไม่ได้ผลเต็มที่ |
| nb_gear_heart | หัวใจเฟือง | U | vit+1 #mech_repair | ลูกผสมจักรกล | ซ่อมส่วนตัวเองได้ในเวลาพัก |
| nb_scale_echo | เสียงสะท้อนเกล็ด | R | #dragon_voice | เผ่ามังกร | ได้ยินเสียงสะท้อนของมังกรที่อยู่ใกล้ที่สุด |

## ค. พรจากการรอดจากเหตุการณ์

ได้เมื่อตัวละครผ่านเหตุการณ์ใหญ่ ตามหัวข้อ "ความทรงจำของเหตุการณ์ใหญ่" ใน [../events/branches/03-character-and-quests.md](../events/branches/03-character-and-quests.md) น้ำหนักเพิ่ม 3 เท่าถ้ารอดตอนเป็นเด็ก

| ID | ชื่อ | ระดับ | ผล | เหตุการณ์ | ในโลก |
| --- | --- | --- | --- | --- | --- |
| nb_sv_sky | ผู้รอดฟ้าถล่ม | U | #fall_save #height_calm | DR-01 | เห็นทวีปมังกรร่วงแล้วไม่กลัวอะไรเกี่ยวกับความสูงอีก |
| nb_sv_ash | ผู้รอดเถ้า | U | vit+1 #cold_res #famine_res | DR-04 | อดทนต่อความหิวและหนาว |
| nb_sv_tide | ผู้รอดน้ำท่วม | U | #water_breath_short #swim | DR-05 | ว่ายเก่งและอ่านกระแสน้ำ |
| nb_sv_crack | ผู้รอดรอยร้าว | U | #quake_sense | DR-07 | รู้สึกการสั่นไหวของแผ่นดินล่วงหน้าหนึ่งวัน |
| nb_sv_grove | ผู้รอดป่าเหี่ยว | U | #herbalist | BIO-02 | รู้จักสมุนไพรสำรองเมื่อป่าตาย |
| nb_sv_blackout | ผู้รอดคืนไฟดับ | U | #pollution_res | MC-04 | ทนมลพิษบางส่วน ไม่เชื่อเครื่องจักรง่าย ๆ |
| nb_sv_fog | ผู้รอดหมอกทึบ | R | brave+10 #fog_calm | FG-01 | ใจนิ่งในความมืดและเสียงหนวด |
| nb_first_light | ผู้เห็นแสงแรก | R | #sun_blessed | BIO-05 | ได้พรหรือคำสาปจากการเห็นแสงอาทิตย์ครั้งแรก (ตามเผ่า) |
| nb_mourning_ear | หูฟังเสียงร้องไห้ | R | #dragon_mourning | DR-15 | ได้ยินเสียงอาลัยของมังกร ได้ข้อมูลเกี่ยวกับมังกรที่ล้ม |

## ง. ตรามังกร

ตรามังกรได้จากเหตุการณ์ที่มังกรตัวนั้นเกี่ยวข้อง หรือจากการที่พระเจ้ามอบให้ ตรามังกรทุกตัวมี **ราคาอารมณ์** เมื่อมังกรพี่น้องของตัวนั้นล้ม (DR-15) ผู้ถือตราได้รับผลไว้อาลัย คือสถานะ `mourning` 1 ปี (ค่า `brave` −10 `luck` −1 และโอกาสพรตามบทลงโทษ)

| ID | ชื่อ | ระดับ | ผล | ผูกกับ |
| --- | --- | --- | --- | --- |
| nb_mark_oran | ตราโอรัน-ซัล | L | luk+2 belief+20 #sky_call | มังกรปฐม DR-01 DR-02 |
| nb_mark_flame | ตราเพลิงนิรันดร์ | E | pow+2 #fire_res #hearth_flame | AZ-02 |
| nb_mark_sea | ตราสมุทรอาลัย | E | vit+1 #water_breath #sea_mourn | AZ-06 NR-04 |
| nb_mark_storm | ตราพายุไร้ทิศ | E | spd+2 #wind_free | AZ-03 |
| nb_mark_stone | ตราศิลาสะท้าน | E | vit+2 #stone_sleep | AZ-04 |
| nb_mark_eclipse | ตราราหูแห่งสุริยคราส | E | mag+1 #shadow #eclipse_ear | AZ-05 |
| nb_mark_eridan | ตราอีริดาน | R | #shelter_voice | AZ-07 (เสาทวีปมังกร) |
| nb_mark_hrod | ตราฮรอด-กาธ | R | #hunger_bind | MH-10 |
| nb_mark_kaldra | ตราคัลดรา | R | pow+1 #deep_heat | KD-10 |
| nb_mark_thalassa | ตราธาลาสซา | R | mag+1 #deep_riddle | NR-04 |
| nb_mark_andar | ตราอันดาร์ | R | #dream_ward #lucid | AL-14 |
| nb_mark_serene | ตราเซเรเน | R | int+1 #machine_voice | MK-01 |
| nb_mark_gromdhar | ตรากรอม-ธาร | R | vit+1 #giant_pact | SH-03 SH-17 |
| nb_mark_silvera | ตราซิลเวรา | R | mag+1 #tree_bond | SV-01 SV-13 |
| nb_mark_niveri | ตรานิเวรี | R | #fog_ward #moon_veil | NB-08 |

## จ. พรศาสนา

ได้เมื่อตัวละครศรัทธาและทำตามพิธีของศาสนานั้นต่อเนื่อง ศาสนาในช่อง A (ผนึก) ให้พรที่ไหลศรัทธาเข้าผนึก ช่อง B ให้พรที่ได้ผลตรง ตามกติกาใน [../../lore/religions/01-faith-flow.md](../../lore/religions/01-faith-flow.md)

| ID | ชื่อ | ระดับ | ผล | ศาสนา (ช่อง) |
| --- | --- | --- | --- | --- |
| nb_faith_dragon | ผู้ถวายตัวมังกร | R | belief+15 #dragon_voice | ลัทธิบูชามังกร (A) |
| nb_faith_light | พรสังฆราช | R | belief+20 #holy | ศาสนจักรแห่งแสง (B) |
| nb_faith_tree | ผู้ดูแลต้นไม้โลก | U | #nature_sense | ศรัทธาต้นไม้โลก (A) |
| nb_faith_sea | ผู้รับลมทะเล | U | #sea #navigator | เทพแห่งสมุทร (A) |
| nb_faith_naga | ผู้ผ่านการทดสอบนาคา | R | #naga_gift | พญานาคราช (A) |
| nb_faith_moon | แสงจันทราคุ้มกาย | U | #moon_veil | เทพีแห่งจันทรา (A) |
| nb_faith_war | ผู้ประกาศศึก | U | brave+15 #warcry_god | เทพแห่งสงคราม (A) |
| nb_faith_ancestor | เสียงบรรพบุรุษ | U | #ancestor_voice | การบูชาบรรพบุรุษ (C) |
| nb_faith_forge | มือเตา | U | pow+1 #forge_blessed | ศรัทธาเตาหลอม (C) |
| nb_faith_stone | หินจำชื่อ | U | vit+1 #stone_sleep | ศรัทธาศิลา (A) |
| nb_faith_dream | ผู้ฝันร่วม | U | #lucid #dream_share | ศรัทธาความฝัน (A) |
| nb_faith_spirit | เพื่อนวิญญาณสัตว์ | U | #beast_friend #spirit_beast | ศรัทธาวิญญาณสัตว์ (C) |
| nb_faith_pointer | ผู้ติดตามผู้ชี้ทาง | R | #pathfinder | ลัทธิผู้ชี้ทาง (B) |
| nb_unbowed | ไม่ก้มหัว | R | brave+20 #unbowed | ผู้ไม่ก้มหัว (GD-03) |

## ฉ. พรจากความสัมพันธ์และเส้นเรื่อง

| ID | ชื่อ | ระดับ | ผล | ได้จาก |
| --- | --- | --- | --- | --- |
| nb_favor_returned | บุญคุณที่ถูกตอบแทน | R | luk+1 #favor_return | NPC ที่เคยถูกช่วยกลับมาตอบแทนตัวละครหลัก ตาม [../../lore/npcs/README.md](../../lore/npcs/README.md) หัวข้อ 4 |
| nb_oath_ally | พันธมิตรผู้ซื่อสัตย์ | R | #loyal_ally | NPC หนึ่งคนที่ไว้ใจถึงระดับสูงสุด (+5) |
| nb_name_sung | ชื่อที่ถูกขับขาน | R | fame+20 #bard_song | นักกวีเขียนเพลงถึงตัวละคร |
| nb_leader_spark | ประกายผู้นำ | U | fame+10 #leader | ได้รับเลือกเป็นหัวหน้ากลุ่มครั้งแรก |
| nb_peace_seed | เมล็ดสันติ | R | kind+10 #peace | ตัวละครหยุดสงครามหนึ่งครั้ง (เช่น WR-06 WR-13) |
| nb_world_walker | ผู้เดินสู่ทุกทวีป | R | #polyglot #wanderer | เดินทางไปครบสี่ทวีปขึ้นไป |
| nb_seal_hand | มือผนึก | E | #seal_touch | ผู้ปลดผนึก (GD-07) ที่เลือกหยุดแทนที่จะปลด หรือผู้ที่ปิดผนึกด้วยตัวเอง |
| nb_god_whisper | เสียงกระซิบจากพระเจ้า | L | belief+30 #god_whisper | พระเจ้าส่งสัญญาณตรงถึงตัวละคร (ต้นทุนศรัทธาสูง) |

## แท็กใหม่

แท็กที่ไม่มีในโค้ดเดิม ต้องเพิ่มความหมายในกติกาเมื่อทำจริง

| แท็ก | ความหมาย |
| --- | --- |
| `#fall_save` | รอดตายจากการตกครั้งแรก |
| `#fear_height_res` | ไม่กลัวที่สูง |
| `#ash_res` | ทนเถ้าและฝุ่น |
| `#water_breath_short` | ดำน้ำได้นานกว่าปกติ แต่หายใจใต้น้ำไม่ได้ |
| `#mech_sense` | รับรู้ความผิดปกติของเครื่องจักร |
| `#thirst_res` | ทนกระหายนานกว่าปกติ |
| `#nature_sense` | รับรู้สุขภาพของธรรมชาติและต้นไม้ |
| `#fog_sight` | มองทะลุหมอกเบา |
| `#homeland_sense` | รู้ข่าวถิ่นกำเนิดเผ่า |
| `#shadow_meld` | ผสมกับเงา |
| `#absorb_memory` | จำสิ่งที่กลืน |
| `#contract_bonus` | สัญญาเลือดผลหนักขึ้น |
| `#lava_burst` | ปล่อยความร้อนระเบิดเมื่อโกรธ |
| `#diplomat` | ผู้ไกล่เกลี่ยข้ามฝั่ง |
| `#stone_skin` | ผิวหินเฉพาะที่ |
| `#glide` | ร่อนได้ |
| `#oath_keeper` | คำสาบานไม่ถูกบังคับให้ผิด |
| `#soul_resist` | ต้านเวทกระทบจิต |
| `#mech_repair` | ซ่อมตัวเอง |
| `#dragon_voice` `#dragon_mourning` | ได้ยินเสียงมังกร ได้ยินเสียงอาลัย |
| `#height_calm` `#famine_res` `#swim` `#quake_sense` `#herbalist` `#pollution_res` `#fog_calm` `#sun_blessed` | ผลจากเหตุการณ์ที่รอดมา ตามชื่อ |
| `#sky_call` `#hearth_flame` `#sea_mourn` `#wind_free` `#stone_sleep` `#eclipse_ear` `#shelter_voice` `#hunger_bind` `#deep_heat` `#deep_riddle` `#dream_ward` `#machine_voice` `#giant_pact` `#tree_bond` `#fog_ward` `#moon_veil` | ผลของตรามังกรแต่ละตัว ใช้ผูกกับเหตุการณ์และ NPC ที่เกี่ยวข้องกับมังกรตัวนั้น |
| `#naga_gift` `#warcry_god` `#ancestor_voice` `#forge_blessed` `#dream_share` `#spirit_beast` `#pathfinder` `#unbowed` | ผลของศาสนาต่าง ๆ |
| `#favor_return` `#loyal_ally` `#bard_song` `#seal_touch` `#god_whisper` | ผลของความสัมพันธ์และเส้นเรื่อง |
