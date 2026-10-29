# ความเข้ากับเผ่า

ระบบ: [README.md](README.md) · เผ่า: [../races/README.md](../races/README.md) · ของเดิมในโค้ด: [catalog/](catalog/)

## กติกา

- **เสริม** คือรายการที่น้ำหนักสุ่มเพิ่ม 2 เท่า **ต้าน** คือรายการที่น้ำหนักลดเหลือ 0.4 เท่า (ไม่ได้ห้ามเด็ดขาด คนที่ได้ของต้านเผ่าคือคนแปลกในเผ่า)
- **ห้าม** คือเป็นไปไม่ได้ในร่างนั้น น้ำหนัก 0 (ระบุแยกในไฟล์ [03-synergy-rules.md](03-synergy-rules.md))
- ค่า **เสริม** ของเผ่าที่ขึ้นต้นด้วย ★ คือค่าเดิมในโค้ด (`src/data/races.ts`) ส่วนค่าต้านและเผ่าที่ไม่มีดาวออกแบบใหม่ตามลักษณะของเผ่าในไฟล์ `races/`
- น้ำหนักนี้คูณกับน้ำหนักความหายาก และความเข้ากับเรื่องราวที่มีอยู่ในโค้ด (`fortune.ts`)

## ก. นิสัยและความถนัด

| เผ่า | แท็กเผ่า | เลื่อนแกนนิสัย | นิสัยเสริม | นิสัยต้าน | ความถนัดเสริม | ความถนัดต้าน | ชอบ | ไม่ชอบ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| มนุษย์ ★ | adaptable | ทะเยอทะยาน +15 | ambitious diligent envious family justice | loner skeptic | sword trade leadership farming scholar | absorb | ทุ่งอบอุ่น | — |
| เอลฟ์ ★ | nature long_lived keen_eye | อยากรู้ +10 · เข้าสังคม −15 | proud serious bookworm animal_lover loner | greedy glutton reckless | bow nature wind music healing | smithing mining unarmed | ป่าดิบ ทุ่งอบอุ่น | ภูเขาไฟ ทะเลทราย |
| ดาร์กเอลฟ์ ★ | darkvision shadow long_lived | โทสะ −10 | cunning paranoid vengeful proud cold | optimist generous | dagger dark stealth alchemy whip | farming cooking healing | ภูเขาไฟ ดินแดนน้ำแข็ง | ทะเลทราย |
| คนแคระ ★ | fire_res poison_res darkvision | — | stubborn diligent proud glutton vengeful | flirt moody | smithing axe hammer mining rune | sailing stealth wind | ภูเขาไฟ ดินแดนน้ำแข็ง | หมู่เกาะ |
| ออร์ค ★ | berserk | กล้าหาญ +15 · โทสะ +15 | reckless bloodlust hot glutton loyal_love | calm serious bookworm | axe unarmed taming hammer leadership | rune divination scholar | ทะเลทราย ภูเขาไฟ | ดินแดนน้ำแข็ง |
| ฮาล์ฟลิง ★ | lucky small | โชค (ค่าสถานะ) +1 ตอนเกิด | glutton homebody humor optimist lazy | bloodlust vengeful | cooking stealth sling trade farming | mounted hammer | ทุ่งอบอุ่น | ภูเขาไฟ ดินแดนน้ำแข็ง |
| เผ่าสัตว์ ★ | keen_senses beast_kin | — | loyal_love reckless animal_lover family freedom | bookworm serious | unarmed tracking bow taming dagger | rune alchemy scholar | ป่าดิบ ทุ่งอบอุ่น | ภูเขาไฟ |
| นาคา ★ | water_breath venom serpent | ศรัทธา +10 | devout calm proud vengeful serious | clumsy hot | water spear divination alchemy healing | smithing mining | ป่าดิบ หมู่เกาะ | ดินแดนน้ำแข็ง ทะเลทราย |
| เผ่ามังกร ★ | fire_res dragon_blood weak_ice scales | — | proud hot reckless greedy justice | humble coward | fire spear sword leadership mounted | stealth sailing | ภูเขาไฟ | ดินแดนน้ำแข็ง |
| แวมไพร์ ★ | undead weak_light weak_sun blood_drinker darkvision | เข้าสังคม +10 | proud cold cunning flirt bloodlust | devout humble | blood charm dagger dark illusion | farming healing cooking | ดินแดนน้ำแข็ง | ทะเลทราย ป่าดิบ |
| ภูตพราย ★ | weak_iron flight nature small | อยากรู้ +15 | humor liar curious dreamer moody | serious pragmatic | illusion nature music wind charm | smithing mining hammer | ป่าดิบ ทุ่งอบอุ่น | ภูเขาไฟ ทะเลทราย |
| สไลม์ ★ | amorphous weak_ice absorb | — | optimist glutton gullible humor curious | paranoid proud | absorb water healing cooking illusion | sword smithing leadership | ป่าดิบ หมู่เกาะ ทุ่งอบอุ่น | ทะเลทราย ดินแดนน้ำแข็ง |
| เผ่าปีศาจ ★ | fire_res weak_light infernal horned | ทะเยอทะยาน +10 | vengeful ambitious cunning skeptic proud | devout humble | dark contract fire sword curse | healing nature farming | ภูเขาไฟ ทะเลทราย | — |
| เงือก ★ | water_breath siren | เข้าสังคม +10 | flirt freedom dreamer talkative moody | homebody pragmatic | water music spear sailing charm | mining smithing | หมู่เกาะ | ทะเลทราย ภูเขาไฟ |
| เผ่าปีก | flight keen_eye | อยากรู้ +10 | freedom adventurer devout proud optimist | homebody lazy | bow wind lightning spear scholar | mining smithing | หมู่เกาะ ทุ่งอบอุ่น | ภูเขาไฟ ทะเลทราย |
| ยักษ์ | huge stone_blood | โทสะ −10 | serious stubborn calm humble loyal_love | flirt talkative | hammer unarmed smithing mining earth | stealth dagger illusion | ทะเลทราย ดินแดนน้ำแข็ง | หมู่เกาะ |
| เผ่าลาวา | fire_res heat_res lava_body weak_ice | โทสะ +10 | hot proud stubborn vengeful diligent | calm shy | fire smithing hammer earth mining | water sailing ice | ภูเขาไฟ ทะเลทราย | ดินแดนน้ำแข็ง หมู่เกาะ |
| ลูกผสมจักรกล | mechanical iron_body weak_lightning | — | serious pragmatic loner diligent cold | dreamer flirt | smithing rune scholar hammer mining | nature healing music | ภูเขาไฟ ทุ่งอบอุ่น | ป่าดิบ หมู่เกาะ |
| หุ่นวิญญาณ | mechanical soul_core weak_lightning | อยากรู้ +15 | curious serious honest kind dreamer | greedy bloodlust | scholar music rune healing farming | contract curse blood | ทุ่งอบอุ่น | ภูเขาไฟ |
| มัมมี่ | undead dry weak_fire | ศรัทธา +15 · โทสะ −10 | devout proud serious calm vengeful | flirt humor | necro divination rune scholar leadership | water sailing taming | ทะเลทราย | ดินแดนน้ำแข็ง หมู่เกาะ ป่าดิบ |
| กูล | undead hungry weak_light | กล้าหาญ +10 · เมตตา −10 | glutton bloodlust reckless loner cold | kind generous | unarmed tracking necro taming curse | trade charm leadership | ทะเลทราย ภูเขาไฟ | ทุ่งอบอุ่น |

## ข. พรและคำสาปที่เข้ากับเผ่า

รหัสในช่องคือรหัสจาก [catalog/blessings.md](catalog/blessings.md) และ [catalog/curses.md](catalog/curses.md) รหัสที่ขึ้นต้น `nb_` `nc_` มาจากไฟล์พรและคำสาปใหม่ ช่อง **ขัด** คือของที่ไม่เข้ากับร่างหรือที่มาของเผ่า ได้แล้วเกิดผลแปลกตาม [03-synergy-rules.md](03-synergy-rules.md)

| เผ่า | พรที่เสริม | คำสาปที่เสริม | พรที่ขัด | คำสาปที่ขัด |
| --- | --- | --- | --- | --- |
| มนุษย์ | b_clover b_friendmaker b_quicklearn b_fortune b_heroname | c_envyaura c_greed c_debt c_infamous | — | — |
| เอลฟ์ | b_longevity b_youth b_animaltongue b_lucid b_worldtree | c_ironbane c_allergy c_outcast c_lonely | b_ironskin b_goldhand | c_bloodthirst |
| ดาร์กเอลฟ์ | b_nighteye b_shadowstep b_hidden b_mindward nb_shadow_kin | c_sunburn c_shadow c_cursedblood c_hexmagnet | b_sunward b_lightward b_saintmark | c_nightblind c_claustro |
| คนแคระ | b_mountain b_ironskin b_flameward b_poisonward b_earthtouch | c_hydrophobia c_vertigo c_seasick c_golditch | b_waterwalk | c_ironbane c_fireweak c_claustro |
| ออร์ค | b_bull b_giant b_fury b_warcry b_ironstomach | c_rage c_bloodthirst c_hunger c_forgetful | b_mercy b_peacemaker | c_rabbitheart c_bloodfaint |
| ฮาล์ฟลิง | b_clover b_luckystar b_rainbow b_harvest b_hidden | c_hunger c_vertigo c_tinyvoice | b_giant b_titan | c_badluck c_jinx |
| เผ่าสัตว์ | b_animaltongue b_beastlord b_nighteye b_hare b_falcon | c_moonfrenzy c_cathate c_smell c_dance | b_swordgod | c_hydrophobia |
| นาคา | b_waterwalk b_tidetouch b_poisonward b_oracleear b_seacalm | c_coldweak c_stoneskin c_fever | b_flameward | c_hydrophobia c_seasick |
| เผ่ามังกร | b_dragonscale b_flameward b_firetouch b_fury b_legendvoice | c_coldweak c_rage c_greed c_sneezefire | b_dragonslayer b_frostward | c_fireweak |
| แวมไพร์ | b_nighteye b_nightowl b_regen b_longevity b_charm | c_sunburn c_bloodthirst c_noreflect c_vampbite c_silverbane | b_lightward b_holyblood b_saintmark b_sacredflame b_sunward b_undeadslayer | c_nightblind c_lightweak |
| ภูตพราย | b_wings b_spiritfriend b_inspire b_lucid b_fourwinds | c_ironbane c_tinyvoice c_rhyme c_dance | b_titan b_giant | c_slowfeet c_leadlimbs |
| สไลม์ | b_regen b_poisonward b_ironstomach b_lungs nb_gel_memory | c_coldweak c_slimelove c_hunger c_smell | b_swordgod b_archergod | c_bloodfaint c_dull |
| เผ่าปีศาจ | b_fury b_flameward b_goldhand b_silvertongue nb_pact_blood | c_demonmark c_cursedblood c_lightweak c_whisper c_souldebt | b_demonslayer b_saintmark b_lightward | c_demoneye |
| เงือก | b_waterwalk b_seacalm b_tidetouch b_charm b_beauty | c_dance c_lovedoom c_fireweak c_raincloud | b_flameward | c_hydrophobia c_seasick |
| เผ่าปีก | b_wings b_falcon b_windgod b_guidingstar b_lightningrod | c_brittle c_birdtarget c_leadlimbs | b_giant b_mountain | c_vertigo c_slowfeet |
| ยักษ์ | b_giant b_titan b_mountain b_earthtouch b_beastward | c_slowfeet c_stoneskin c_hunger c_hiccup | b_hare b_hidden b_shadowstep | c_tinyvoice c_weakarm |
| เผ่าลาวา | b_flameward b_firetouch b_sacredflame b_titan nb_lava_pulse | c_coldweak c_hydrophobia c_sneezefire c_raincloud | b_frostward b_frosttouch b_tidetouch | c_fireweak |
| ลูกผสมจักรกล | b_ironskin b_tireless b_poisonward b_plagueward b_mindward | c_insomnia c_hollow c_stoneskin c_dull | b_healerhands b_regen | c_sickly c_fever |
| หุ่นวิญญาณ | b_lucid b_memory b_inspire b_calmmind b_polymath | c_hollow c_echo c_doppel c_forgetful | b_fertile b_truelove | c_barren c_sickly |
| มัมมี่ | b_regen b_immortalbody b_curseward b_oracleear b_longevity | c_fireweak c_ghost c_undeadtouch c_souldebt | b_sacredflame b_lightward b_undeadslayer b_holyblood | c_sickly c_fever |
| กูล | b_ironstomach b_plagueward b_poisonward b_regen b_beastward | c_hunger c_smell c_lightweak c_undeadtouch c_outcast | b_mercy b_lightward b_saintmark b_holyblood | c_frail |

## ค. ผลที่ต่างกันของเผ่า ต่อพรและคำสาปชนิดเดียวกัน

พรและคำสาปบางตัวให้ผลต่างตามเผ่า เพราะร่างกายและที่มาต่างกัน รายการนี้ให้ค่าแทนที่ผลปกติ

| ของ | เผ่า | ผลแทนที่ |
| --- | --- | --- |
| b_nighteye ตาแมวในความมืด | แวมไพร์ ดาร์กเอลฟ์ ที่มีตามองเห็นในที่มืดอยู่แล้ว | ขยายรัศมีมองเห็นเป็นสองเท่า เห็นทะลุหมอกเบา (ไม่ทะลุหมอกทึบ) |
| b_nighteye | เผ่าอื่น | มองในที่มืดได้ เหมือนผลปกติ |
| b_longevity อายุยืน | เผ่าที่ค่ากลางอายุขัยตั้งแต่ 230 ปีขึ้นไป | อายุขัยธรรมชาติเลื่อนขึ้น 5% เท่านั้น (ร่างอายุยืนอยู่แล้ว) |
| b_longevity | เผ่าอายุขัยต่ำกว่าร้อยปี | เลื่อนขึ้น 20% |
| b_regen ฟื้นตัวไว | สไลม์ | ผลเป็นสองเท่า |
| b_regen | มัมมี่ กูล | ใช้ไม่ได้กับบาดแผลจากไฟหรือแสง |
| c_sunburn แพ้แสงแดด | แวมไพร์ | แสงอาทิตย์สลายร่างเป็นผง (เทียบเท่า "ผู้ไร้เงาแสง") |
| c_sunburn | เผ่าอื่น | ผิวไหม้ง่าย ผลปกติ |
| c_hydrophobia กลัวน้ำ | เงือก นาคา | ใช้ไม่ได้ เปลี่ยนเป็น nc_fear_deep กลัวน้ำลึก (ว่ายในน้ำตื้นได้) |
| c_vertigo กลัวความสูง | เผ่าปีก | ใช้ไม่ได้ เปลี่ยนเป็นไม่กล้าบินสูง บินได้แค่ระดับต้นไม้ |
| c_fireweak ไฟเผาง่าย | เผ่าลาวา เผ่ามังกร | ใช้ไม่ได้ เปลี่ยนเป็นแพ้ความเย็นแทน |
| c_moonfrenzy คำสาปมนุษย์หมาป่า | เผ่าสัตว์ | แปลงร่างเป็นสัตว์ใหญ่แทนมนุษย์หมาป่า (กำลัง +2 แทน) |
| c_moonfrenzy | มนุษย์ เอลฟ์ | กลายเป็นหมาป่าเต็มตัว ทุกคืนจันทร์เต็มดวง |
| c_hunger หิวตลอดเวลา | กูล | หิวจนอยู่ไม่ได้ (เทียบเท่า "หิวที่ไม่หาย") ต้องกินเนื้อ |
| c_hunger | เผ่าอื่น | หิวง่าย ผลปกติ |
