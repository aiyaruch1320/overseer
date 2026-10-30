# ชนิดของสัตว์คู่หู 102 ชนิด

ระบบ: [13-companions-overview.md](13-companions-overview.md) · ความสามารถ: [14-companion-abilities.md](14-companion-abilities.md) · เรื่องราวการได้: [16-companion-stories.md](16-companion-stories.md)

ช่อง **ความสามารถเริ่มต้น** เขียน `รหัส:ระดับ` ที่สัตว์มีตอนเริ่ม (ใช้รหัสจาก [14-companion-abilities.md](14-companion-abilities.md)) สัตว์เพิ่มระดับเมื่อความผูกพันสูงขึ้นตามกติกาในไฟล์ภาพรวม ช่อง **อายุขัย** คือช่วงปีที่สัตว์เริ่มทรุดตามธรรมชาติ (ไม่ใช่เวลาตายตัว เหมือนกติกาอายุขัยของเผ่า) **หมวด** ได้แก่ เลี้ยงในบ้าน · ฟาร์ม · ป่า · นก · น้ำ · วิเศษ · วิญญาณ · ผู้ตาย · จักรกล · ธาตุ · หมอก · มังกร

| ระดับ | จำนวน |
| --- | --- |
| C ธรรมดา | 30 |
| U ไม่ธรรมดา | 29 |
| R หายาก | 22 |
| E มหากาพย์ | 14 |
| L ตำนาน | 7 |

## ระดับ C ธรรมดา (30)

| ID | ชื่อ | หมวด | ที่มาและถิ่น | อายุขัย | ความสามารถเริ่มต้น | หมายเหตุ |
| --- | --- | --- | --- | --- | --- | --- |
| sp_dog | สุนัข | บ้าน | ทุกทวีป | 10–14 | pa_track_scent:1 pa_guard_stance:1 pa_night_watch:1 | คู่หูแรกของเด็กที่เลี้ยงสัตว์ |
| sp_cat | แมวบ้าน | บ้าน | ทุกทวีป | 12–16 | pa_pest_hunt:1 pa_purr_calm:1 | คนที่มี `c_cathate` เลี้ยงไม่ได้ |
| sp_horse | ม้า | ฟาร์ม | อัลเดรีย AL-24 | 25–30 | pa_mount:1 pa_caravan_pull:1 | เผ่าสัตว์ที่เป็นม้าเลี้ยงไม่ได้ (ผิดธรรมเนียม) |
| sp_donkey | ลา | ฟาร์ม | อัลเดรีย ซาฮารัน | 28–32 | pa_caravan_pull:1 pa_stout_heart:1 | |
| sp_ox | วัวไถนา | ฟาร์ม | อัลเดรีย เนเรีย NR-09 | 18–22 | pa_plow:1 | |
| sp_sheep | แกะ | ฟาร์ม | อัลเดรีย AL-16 | 10–14 | pa_produce:1 | ขนและนม |
| sp_goat | แพะภูเขา | ฟาร์ม | KD ซาฮารัน | 13–17 | pa_produce:1 pa_climb:1 | |
| sp_chicken | ไก่ | ฟาร์ม | ทุกทวีป | 6–10 | pa_produce:1 pa_pest_hunt:1 | คนที่มี `c_chicken` ได้ผลตลก |
| sp_duck | เป็ด | ฟาร์ม | NR-09 AL-16 | 8–12 | pa_pest_hunt:1 pa_weather_sense:1 | |
| sp_pigeon | นกพิราบสาร | นก | AL-28 AL-10 | 12–18 | pa_messenger:1 pa_path_find:1 | |
| sp_crow | กา | นก | ทุกทวีป | 15–25 | pa_treasure_nose:1 pa_messenger:1 | |
| sp_rat | หนูท่อ | บ้าน | AL-13 MK-10 | 3–5 | pa_burrow:1 pa_danger_sense:1 | อายุสั้น เป็นคู่หูของคนจนและโจร |
| sp_ferret | เฟอร์เร็ต | บ้าน | AL-05 AL-13 | 6–10 | pa_pest_hunt:1 pa_pickpocket:1 | |
| sp_rabbit | กระต่าย | บ้าน | AL-16 SV | 8–10 | pa_lucky_charm:1 pa_burrow:1 | |
| sp_field_fox | จิ้งจอกทุ่ง | ป่า | AL-24 AL-23 | 10–14 | pa_track_scent:1 pa_distract:1 | |
| sp_hawk | เหยี่ยว | นก | ทุกทวีป | 15–22 | pa_keen_eyes:1 pa_claw_dive:1 | |
| sp_owl | นกฮูก | นก | SV AL-11 | 20–30 | pa_night_watch:1 pa_wisdom_gaze:1 | |
| sp_wolf_pup | ลูกหมาป่า | ป่า | SV-16 MH-04 | 12–16 | pa_pack_courage:1 pa_bite_assist:1 | เติบโตเป็น sp_wolf เมื่อความผูกพันถึงระดับ 3 |
| sp_bear_cub | ลูกหมี | ป่า | KD-12 SV | 20–28 | pa_thick_hide:1 pa_guard_stance:1 | เติบโตเป็น sp_honey_bear หรือหมีใหญ่ |
| sp_rain_frog | กบฝน | น้ำ | NR-09 SV-17 | 5–8 | pa_weather_sense:1 | |
| sp_turtle | เต่า | น้ำ | NR SV | 80–150 | pa_thick_hide:1 pa_life_share:1 | อยู่ได้หลายชีวิตของผู้เลี้ยง |
| sp_bee_hive | รังผึ้ง | ฟาร์ม | AL-16 SV | 8–12 (รัง) | pa_produce:1 pa_garden_help:1 | ถือเป็นหนึ่งคู่หู |
| sp_silk_moth | ผีเสื้อไหม | ฟาร์ม | SH-04 AL-05 | 1 (ฝูง 5–8) | pa_weave:1 | ฝูงสืบทอดรุ่นต่อรุ่น |
| sp_camel | อูฐ | ฟาร์ม | SH-04 SH-05 | 30–40 | pa_caravan_pull:1 pa_weather_sense:1 | |
| sp_pig | หมูขุดเห็ด | ฟาร์ม | AL-16 SV-12 | 12–16 | pa_treasure_nose:1 pa_produce:1 | |
| sp_parrot | นกแก้ว | นก | SV-17 NR | 40–60 | pa_icebreaker:1 pa_messenger:1 | จำภาษาของผู้เลี้ยงได้หลายภาษา |
| sp_gull | นกนางนวล | นก | NR | 12–18 | pa_fish_help:1 pa_path_find:1 | |
| sp_otter | นากแม่น้ำ | น้ำ | NR-09 SV-17 | 10–14 | pa_fish_help:1 pa_charm_pet:1 | |
| sp_monkey | ลิงหางยาว | ป่า | SV-17 | 22–28 | pa_pickpocket:1 pa_climb:1 | |
| sp_yak | จามรี | ฟาร์ม | KD-12 SH | 20–24 | pa_caravan_pull:1 pa_stout_heart:1 | |

## ระดับ U ไม่ธรรมดา (29)

| ID | ชื่อ | หมวด | ที่มาและถิ่น | อายุขัย | ความสามารถเริ่มต้น | หมายเหตุ |
| --- | --- | --- | --- | --- | --- | --- |
| sp_war_dog | สุนัขศึก | บ้าน | AL-08 AL-15 MH-04 | 10–14 | pa_bite_assist:2 pa_guard_stance:1 | เป็นสุนัขทหาร ถ้าผู้เลี้ยงไม่ใช่ทหารต้องเรียนตามสัญญา |
| sp_sheepdog | สุนัขต้อนแกะ | ฟาร์ม | AL-16 AL-24 | 11–15 | pa_herd:2 pa_danger_sense:1 | |
| sp_war_horse | ม้าศึก | ฟาร์ม | AL-18 AL-24 | 25–30 | pa_mount:2 pa_pack_courage:1 | |
| sp_falcon | เหยี่ยวล่า | นก | SH AL-24 | 18–25 | pa_keen_eyes:2 pa_claw_dive:2 | |
| sp_raven | อีกาพูดได้ | นก | NB SV-11 | 35–45 | pa_lie_sense:1 pa_messenger:2 | พูดภาษามนุษย์ได้ไม่กี่ประโยค |
| sp_snow_fox | จิ้งจอกหิมะ | ป่า | KD-12 | 12–16 | pa_track_scent:2 pa_hide_scent:1 | |
| sp_wolf | หมาป่า | ป่า | SV-16 MH-04 | 14–18 | pa_pack_courage:2 pa_bite_assist:2 | |
| sp_panther | เสือดำ | ป่า | SV-17 SH | 16–20 | pa_flank:2 pa_hide_scent:1 | |
| sp_lynx | แมวป่าลิงซ์ | ป่า | KD-12 SV | 13–17 | pa_danger_sense:2 pa_night_watch:1 | |
| sp_boar | หมูป่า | ป่า | SV MH | 12–18 | pa_thick_hide:2 pa_treasure_nose:1 | |
| sp_stag | กวางผู้นำฝูง | ป่า | SV AL-23 | 18–24 | pa_path_find:2 pa_mount:1 | |
| sp_cave_bat | ค้างคาวถ้ำ | ป่า | KD-05 NB | 20–30 | pa_night_watch:2 pa_danger_sense:1 | ดาร์กเอลฟ์และแวมไพร์ได้ง่ายขึ้น |
| sp_garden_snake | งูสวน | ป่า | AL-16 SV | 12–18 | pa_pest_hunt:2 pa_antidote_nose:1 | |
| sp_loom_spider | แมงมุมถักใย | ป่า | SV-12 AL-05 | 5–7 | pa_weave:2 pa_venom_bite:1 | |
| sp_sea_lion | สิงโตทะเล | น้ำ | NR-01 NR-10 | 22–28 | pa_swim_mount:1 pa_fish_help:2 | |
| sp_dolphin | โลมา | น้ำ | NR | 35–45 | pa_swim_mount:2 pa_path_find:2 | เงือกไซเรนได้ผลพิเศษ |
| sp_fire_newt | ซาลาแมนเดอร์ไฟ | ธาตุ | KD | 25–35 | pa_elemental_core:1 pa_breath_fire:1 | เผ่าลาวาได้ผลเป็นสองเท่า |
| sp_ice_hare | กระต่ายหิมะ | ธาตุ | KD-12 | 10–14 | pa_lucky_charm:2 pa_hide_scent:1 | ตายเร็วถ้าอยู่ใกล้เผ่าลาวา |
| sp_dust_lizard | จิ้งจกทราย | ป่า | SH SH-10 | 13–17 | pa_dig:2 pa_weather_sense:1 | |
| sp_cloud_sheep | แกะเมฆ | วิเศษ | AZ (ก่อน DR-01) | 18–22 | pa_produce:2 pa_weather_sense:2 | ถ้า DR-01 เกิด เหลือที่ซากหรือสกายฟอลล์ มีน้อยลง |
| sp_ash_wolf | หมาป่าเถ้า | ป่า | MH-04 | 14–18 | pa_pack_courage:2 pa_hide_scent:1 | |
| sp_lava_toad | คางคกลาวา | ธาตุ | KD-02 KD-06 | 25–30 | pa_lava_core:1 pa_thick_hide:1 | |
| sp_reef_seahorse | ม้าน้ำปะการัง | น้ำ | NR-13 | 6–10 | pa_lucky_charm:2 pa_bright_mood:1 | ตายเมื่อ BIO-07 ถ้าอยู่ที่ปาเลนู |
| sp_mist_hound | สุนัขนำทางหมอก | หมอก | NB-14 NB-04 | 12–16 | pa_fog_sense:2 pa_path_find:1 | |
| sp_lantern_moth | ผีเสื้อโคม | หมอก | NB-03 | 1 (ฝูง 4–6) | pa_fog_sense:1 pa_bright_mood:1 | ฝูงสืบทอด |
| sp_honey_bear | หมีน้ำผึ้ง | ป่า | AL-16 SV | 24–30 | pa_produce:2 pa_stout_heart:1 | |
| sp_mule_strong | ล่อบรรทุก | ฟาร์ม | AL-28 AL-10 | 30–36 | pa_caravan_pull:2 pa_stout_heart:1 | |
| sp_tea_cat | แมวร้านน้ำชา | บ้าน | AL-16 NR-09 | 13–17 | pa_market_charm:2 pa_purr_calm:1 | เหมาะกับอาชีพชีวิตช้า |
| sp_bone_hound | สุนัขโครงกระดูก | ผู้ตาย | MH-12 AL-25 SH-02 | ไม่มี (ถาวรจนกว่าถูกทำลาย) | pa_track_scent:2 pa_ghost_sense:1 pa_guard_stance:1 | คู่หูของเผ่าผู้ตาย (แวมไพร์ มัมมี่ กูล) และผู้ใช้เนโครแมนซี |

## ระดับ R หายาก (22)

| ID | ชื่อ | หมวด | ที่มาและถิ่น | อายุขัย | ความสามารถเริ่มต้น | หมายเหตุ |
| --- | --- | --- | --- | --- | --- | --- |
| sp_silver_wolf | หมาป่าเงิน | ป่า | SV-09 SV-16 | 18–24 | pa_pack_courage:3 pa_bite_assist:2 pa_hide_scent:2 | |
| sp_shadow_wolf | หมาป่าเงา | ป่า | SV-09 | 20–26 | pa_flank:3 pa_night_watch:2 | ผูก skill `ns_wolf_rider` |
| sp_snow_leopard | เสือดาวหิมะ | ป่า | KD-12 | 16–22 | pa_flank:3 pa_climb:2 | |
| sp_wyvern_young | ไวเวิร์นน้อย | วิเศษ | KD-07 AZ | 35–50 | pa_fly_mount:2 pa_bite_assist:2 | เป็นพาหนะบินเมื่อโต |
| sp_griffon_chick | ลูกกริฟฟอน | วิเศษ | AZ (ก่อน DR-01) ซาก | 50–70 | pa_fly_mount:2 pa_keen_eyes:2 pa_pack_courage:1 | เติบโตเป็น sp_griffon_adult |
| sp_moon_deer | กวางจันทรา | วิญญาณ | SV-05 | 70–90 | pa_lick_heal:2 pa_purr_calm:2 | เผ่าเอลฟ์จันทราได้ง่ายขึ้น |
| sp_kelpie | เคลปี้ | วิเศษ | NR-03 NR-09 | 60–80 | pa_swim_mount:3 pa_charm_pet:2 | อันตรายต่อผู้เลี้ยงที่ไม่ซื่อสัตย์ |
| sp_sand_worm_pup | หนอนทรายเล็ก | วิเศษ | SH-12 SH-01 | 90–120 | pa_dig:3 pa_weather_sense:2 | ผูก skill `ns_sand_worm_ride` โตเป็นพาหนะข้ามทะเลทราย |
| sp_storm_hawk | เหยี่ยวพายุ | นก | AZ-03 | 28–35 | pa_keen_eyes:3 pa_shock_touch:1 | |
| sp_thunder_ram | แกะสายฟ้า | ธาตุ | AZ | 22–28 | pa_shock_touch:2 pa_thick_hide:2 | |
| sp_fairy_moth | ผีเสื้อภูต | วิญญาณ | SV-04 | 3–5 | pa_bright_mood:2 pa_spirit_bridge:1 | ภูตพรายได้ง่ายขึ้น |
| sp_nine_fox_cub | จิ้งจอกเก้าหางน้อย | วิญญาณ | SV AL-23 | 100–140 | pa_lie_sense:2 pa_distract:2 | เติบโตเป็น sp_nine_tailed_fox ได้ตลอดชีวิต |
| sp_spirit_cat | แมววิญญาณ | วิญญาณ | SH-14 NB | 35–45 | pa_ghost_sense:2 pa_purr_calm:2 | เผ่าผู้ตายและผู้ไร้เงาได้ง่ายขึ้น |
| sp_ember_cat | แมวไฟ | ธาตุ | KD-06 | 18–22 | pa_breath_fire:2 pa_lava_core:1 | แมวทั่วไปเกลียดสัตว์ตัวนี้ |
| sp_crystal_rabbit | กระต่ายผลึกมานา | ธาตุ | AL-12 | 15–20 | pa_mana_well:2 pa_lucky_charm:2 | ถูกล่าโดย MK-14 |
| sp_stone_owl | นกฮูกหิน | วิญญาณ | SH-17 SH-03 | 120–180 | pa_wisdom_gaze:2 pa_night_watch:2 | ศรัทธาศิลา |
| sp_naga_hatchling | นาคาน้อย | วิเศษ | NR-07 (หลัง BIO-08) | 250–350 | pa_antidote_nose:3 pa_spirit_bridge:1 | ต้องมีคำอนุญาตจากพญานาคราช |
| sp_whale_calf | ลูกวาฬฟ้า | วิเศษ | NR-16 | 70–90 | pa_swim_mount:2 pa_weather_sense:3 | ต้องเลี้ยงที่น้ำ ลูกวาฬโตเกินผู้เลี้ยงในสิบปี |
| sp_dream_moth | แมลงฝัน | วิญญาณ | AL-14 | 4–6 | pa_omen:1 pa_purr_calm:2 | |
| sp_ink_octopus | หมึกสมุทร | น้ำ | NR | 12–18 | pa_distract:2 pa_swim_mount:1 | |
| sp_rust_dog | สุนัขกลเก่า | จักรกล | MK-12 MK-10 | 150–250 | pa_track_scent:2 pa_danger_sense:2 | ไม่รักษา ไม่ป่วย ซ่อมด้วยช่างกล ภูตพรายเลี้ยงไม่ได้ (แพ้เหล็ก) |
| sp_flame_ibis | ไอบิสเพลิง | ธาตุ | KD SH-15 | 50–70 | pa_breath_fire:2 pa_omen:1 | |

## ระดับ E มหากาพย์ (14)

| ID | ชื่อ | หมวด | ที่มาและถิ่น | อายุขัย | ความสามารถเริ่มต้น | หมายเหตุ |
| --- | --- | --- | --- | --- | --- | --- |
| sp_griffon_adult | กริฟฟอน | วิเศษ | AZ ซาก SF | 100–140 | pa_fly_mount:3 pa_keen_eyes:3 pa_claw_dive:2 | ได้เมื่อลูกกริฟฟอนโตเต็มวัยหรือได้ตรง |
| sp_pegasus_foal | ลูกเพกาซัส | วิเศษ | AZ (ก่อน DR-01) | 130–170 | pa_fly_mount:3 pa_lucky_charm:2 | ถ้า DR-01 เกิดแล้ว เหลือเฉพาะที่เคยเกิดก่อน |
| sp_unicorn | ยูนิคอร์น | วิเศษ | SV-04 SV-05 | 250–350 | pa_lick_heal:3 pa_curse_eater:2 pa_purr_calm:2 | เลือกผู้เลี้ยงที่ใจบริสุทธิ์ (`kind` ≥ 30) |
| sp_fenrir_pup | ลูกหมาป่าตำนาน | วิเศษ | MH-10 MH-12 | 180–220 | pa_pack_courage:3 pa_intimidate:3 pa_bite_assist:3 | ผูก PL-02 ฮรอด-กาธ |
| sp_phoenix_chick | ลูกฟีนิกซ์ | ธาตุ | KD-06 KD-10 | 450–550 | pa_breath_fire:3 pa_soul_anchor:2 pa_lick_heal:2 | คืนชีพจากเถ้าได้หนึ่งครั้ง |
| sp_kirin | กิเลน | วิญญาณ | SH-09 SH-13 | 350–450 | pa_omen:3 pa_lucky_charm:3 | ปรากฏเมื่อผู้เลี้ยงมีเมตตาและชื่อเสียง |
| sp_frost_wolf | หมาป่าน้ำแข็ง | ธาตุ | KD-12 | 110–140 | pa_breath_frost:3 pa_pack_courage:2 | ตายเมื่อเข้าใกล้ไฟใหญ่ |
| sp_lava_hound | หมาลาวา | ธาตุ | KD-06 KD-02 | 90–120 | pa_breath_fire:3 pa_lava_core:2 | เผ่าลาวาได้ผลเป็นสองเท่า |
| sp_thunderbird | นกอัสนี | ธาตุ | AZ-03 AZ-04 | 180–220 | pa_shock_touch:3 pa_fly_mount:2 pa_keen_eyes:2 | |
| sp_silver_stag | กวางเงินศักดิ์สิทธิ์ | วิญญาณ | SV-01 SV-13 | 220–280 | pa_lick_heal:3 pa_spirit_bridge:2 pa_path_find:3 | ต้องผ่านพิธีกับผู้ฟังวิญญาณ |
| sp_world_tree_fawn | ลูกกวางต้นไม้โลก | วิญญาณ | SV-01 | 280–320 | pa_garden_help:3 pa_antidote_nose:3 pa_lick_heal:2 | ผูก BIO-01 BIO-03 ถ้าต้นไม้ตาย (BIO-02) ลูกกวางตายหรือกลายเป็นวิญญาณ |
| sp_fog_wisp_cat | แมวหมอก | หมอก | NB-13 NB-08 | 70–90 | pa_fog_sense:3 pa_hide_scent:3 pa_ghost_sense:2 | ผูกผู้ไร้เงา เห็นหนวดก่อน |
| sp_clockwork_dragonling | มังกรกลน้อย | จักรกล | MK-12 MK-07 | 250–350 | pa_breath_fire:2 pa_craft_help:3 pa_fly_mount:1 | ไม่ใช่มังกรจริง สร้างโดยช่างกลผู้ไม่ทราบที่มา |
| sp_soul_fox | จิ้งจอกวิญญาณ | วิญญาณ | SH-14 SV-13 | 180–220 | pa_spirit_bridge:3 pa_ghost_sense:3 pa_lie_sense:2 | |

## ระดับ L ตำนาน (7)

| ID | ชื่อ | หมวด | ที่มาและถิ่น | อายุขัย | ความสามารถเริ่มต้น | หมายเหตุ |
| --- | --- | --- | --- | --- | --- | --- |
| sp_sixteenth_hatchling | ลูกมังกรไข่ใบที่สิบหก | มังกร | DR-03 เท่านั้น | ไม่ทราบ | pa_dragon_voice:3 pa_intimidate:3 pa_life_share:3 | ผูกเส้นเรื่องพี่น้องมังกร มังกรทั้งสิบห้าทราบการมีอยู่ ถ้า DR-03 ไม่เกิด ไข่ไม่มี |
| sp_lost_dragonling | ลูกมังกรหลงทาง | มังกร | AZ ซากสกายฟอลล์ KD-07 | 600–900 | pa_breath_fire:3 pa_fly_mount:3 pa_intimidate:2 | ไม่ใช่เสาและไม่ใช่ผู้อาวุโส เป็นลูกหลานเผ่ามังกร |
| sp_nine_tailed_fox | จิ้งจอกเก้าหาง | วิญญาณ | SV AL-23 | 800–1,100 | pa_lie_sense:3 pa_distract:3 pa_omen:2 | โตจาก sp_nine_fox_cub เมื่อความผูกพันสูงสุด |
| sp_leviathan_calf | ลูกเลวีอาธาน | วิเศษ | NR-04 NR-11 | 500–700 | pa_swim_mount:3 pa_intimidate:3 pa_weather_sense:3 | ผูกธาลาสซา (PL-04) |
| sp_sage_tortoise | เต่าปราชญ์พันปี | วิญญาณ | SH-13 SV-07 | 900–1,200 | pa_wisdom_gaze:3 pa_life_share:3 pa_omen:2 | เก็บบันทึกเหตุการณ์ตั้งแต่มหาล่มสลาย |
| sp_primordial_slime | สไลม์ปฐม | วิเศษ | SV-12 SV-18 | ไม่ทราบ | pa_curse_eater:3 pa_life_share:3 pa_elemental_core:3 | ชิ้นส่วนของมหาล่มสลาย |
| sp_storm_roc | รอกพายุ | นก | AZ-03 | 300–400 | pa_fly_mount:3 pa_shock_touch:3 pa_keen_eyes:3 | ผูกพายุไร้ทิศ ถ้าเจ้าของล้ม (DR-06) รอกคลั่ง |
