# คัมภีร์ของโลก: ดัชนีเอกสารทั้งหมด

เอกสารในโฟลเดอร์นี้คือ **ความจริงดิบของโลก** (raw lore bible) ของเกมแนวพระเจ้าเฝ้าดูตัวละครหนึ่งตัวที่ใช้ชีวิตเอง ใช้เป็นแหล่งอ้างอิงทั้งสำหรับเนื้อเรื่องและสำหรับสร้างโลก ภาพ และ UI ของเกม ไม่ใช่นิยาย ไม่มีบทสนทนายาว ไม่มีคำถามถึงผู้อ่าน

โค้ดใน `src/` เป็นตัวทดลอง (POC) เมื่อโค้ดขัดกับเอกสาร **เอกสารชนะ** เมื่อเอกสารสองไฟล์ขัดกัน ไฟล์ที่ใหม่กว่า (ดูประวัติ git) ชนะ แล้วบันทึกข้อขัดแย้งใน [world/consistency-checks.md](world/consistency-checks.md)

ดัชนีที่เครื่องอ่านได้อยู่ที่ [manifest.json](manifest.json) (สร้างด้วย `node scripts/build-docs-manifest.mjs`) แผนงานและสถานะอยู่ที่ [../RAW_PLAN.md](../RAW_PLAN.md)

## แผนที่ของโฟลเดอร์

| หมวด | โฟลเดอร์ | ใช้ตอบคำถามว่า |
| --- | --- | --- |
| โลกและประวัติ | [world/](world/) | โลกมีกี่ทวีป ใครปกครอง เกิดอะไรขึ้นเมื่อไร เวลานับอย่างไร |
| | [countries/](countries/) | ประเทศ 143 แห่งเป็นอย่างไร |
| | [dragons/](dragons/) | มังกรตำนาน 15 ตัวเป็นใคร |
| | [races/](races/) | เผ่า 21 เผ่ามีอะไร อายุเท่าไร |
| | [religions/](religions/) | ศรัทธาไหลอย่างไร ศาสนาไหนมีอะไร |
| | [economy/](economy/) | ใครรวยใครจน เงินไหลอย่างไร |
| | [branches/](branches/) | มังกรล้มหรือทวีปเปลี่ยนรูปแล้วอะไรเปลี่ยน |
| ชีวิตตัวละคร | [character/](character/) | นิสัย ความถนัด พร คำสาป อาชีพ สัตว์คู่หู |
| | [storylines/](storylines/) | เส้นเรื่องของแต่ละเผ่าและจุดบรรจบ |
| | [heirs/](heirs/) | ตระกูล มรดก ทายาท |
| | [npcs/](npcs/) | NPC 591 ตัวและบทบาท |
| | [experience/](experience/) | ผู้เล่นควรรู้สึกและเห็นอะไรในหนึ่งชีวิต |
| ระบบเล่น | [combat/](combat/) | ต่อสู้ ศัตรู รางวัล มังกรในศึก |
| | [items/](items/) | อาวุธ เกราะ ของขลัง ของใช้ |
| ภาพและ UI | [appearance/](appearance/) | **หน้าตาของทุกสิ่ง** ใช้สร้างภาพ UI และแอนิเมชัน |
| | [visuals/](visuals/) | ภาพตัวละครแบบเวกเตอร์ในโค้ด (รุ่นก่อนหน้า) |
| ไฟล์สร้างอัตโนมัติ | `npc-map.html` `story-map.html` `items/09-catalog.md` | แผนที่ NPC แผนที่เส้นเรื่อง รายการอาวุธรวม (อย่าแก้ด้วยมือ สร้างจาก `scripts/`) |

## อ่านอะไรตามงานที่ทำ

| งาน | อ่านตามลำดับนี้ |
| --- | --- |
| เข้าใจโลกเร็ว ๆ | [world/story-continents.md](world/story-continents.md) → [world/continents.md](world/continents.md) → [world/world-time.md](world/world-time.md) → [dragons/README.md](dragons/README.md) |
| สร้างฉากเมืองและแผนที่ | [appearance/README.md](appearance/README.md) → [appearance/01-continents.md](appearance/01-continents.md) → [appearance/countries/](appearance/countries/) (ไฟล์ทวีป + `10-scale-and-sacred.md` + `11-context-and-landmarks.md`) → [world/world-map.md](world/world-map.md) |
| สร้างตัวละครและ NPC | [appearance/02-races.md](appearance/02-races.md) → [appearance/npcs/](appearance/npcs/) → [npcs/README.md](npcs/README.md) |
| สร้างศัตรู อาวุธ ไอเทม | [appearance/04-enemies.md](appearance/04-enemies.md) → [appearance/05-weapons-rules.md](appearance/05-weapons-rules.md) → [items/README.md](items/README.md) |
| ทำแอนิเมชันเหตุการณ์โลก | [appearance/11-world-changes.md](appearance/11-world-changes.md) → [appearance/12-event-visuals.md](appearance/12-event-visuals.md) → [world/world-events.md](world/world-events.md) → [branches/README.md](branches/README.md) |
| ทำฉากชีวิตและเส้นเรื่อง | [experience/README.md](experience/README.md) → [appearance/13-storyline-scenes.md](appearance/13-storyline-scenes.md) → [storylines/README.md](storylines/README.md) |
| ปรับสมดุลระบบ | [world/world-sim.md](world/world-sim.md) → [combat/README.md](combat/README.md) → [economy/README.md](economy/README.md) → `node scripts/sim-world.mjs` |
| ตรวจความสอดคล้อง | `node scripts/check-docs.mjs` (ต้องได้ 0 errors) และ [world/consistency-checks.md](world/consistency-checks.md) |

## ข้อตกลงของเอกสาร

- **ภาษา** ไทย ตรงไปตรงมา เขียนสิ่งที่เป็นจริงในโลก ไม่บอกผู้อ่านว่าควรรู้สึกอย่างไร
- **ลิงก์** เป็นลิงก์สัมพัทธ์แบบ markdown ทุกลิงก์ต้องไม่เสีย (ตรวจด้วยสคริปต์ได้)
- **ตาราง** ทุกรายการที่มีรหัสต้องอยู่ในตาราง หนึ่งแถวหนึ่งรหัส ใช้รหัสเดิมเสมอเมื่ออ้างข้ามไฟล์
- **ค่า UI** ไฟล์ใน `appearance/` มีช่อง ค่า UI ในรูปแบบคำสั้นคั่นด้วย `·` สำหรับให้คนทำภาพและ agent นำไปใช้โดยตรง ดูรูปแบบใน [appearance/README.md](appearance/README.md)
- **เวลา** มีสองนาฬิกา ปีโลก (ศ.ม.) กับปีชีวิต ดู [world/world-time.md](world/world-time.md)
- **ลำดับการออกแบบ** ระบบพระเจ้าและการแทรกแซงออกแบบเป็นลำดับสุดท้าย เอกสารที่อ้างถึงให้ทำเป็นตัวบอกตำแหน่งเท่านั้น

## รหัสที่พบบ่อย

| รูปแบบ | ความหมาย | ที่นิยาม |
| --- | --- | --- |
| `AZ-01` `MH-02` `KD-03` `NR-04` `AL-05` `MK-06` `SH-07` `SV-08` `NB-09` | ประเทศ (รหัสทวีป + เลขลำดับ) | [countries/README.md](countries/README.md) |
| `AL01-1` `NB02-3` | NPC (รหัสประเทศ + ลำดับ) | [npcs/README.md](npcs/README.md) |
| `DR-` `PL-` `WR-` `CT-` `DM-` `MC-` `BIO-` `GD-` `HP-` `PO-` `GI-` `FG-` `END-` | เหตุการณ์โลก 152 รายการ | [world/world-events.md](world/world-events.md) |
| `SF-` `AS-` `DW-` `RF-` `WT-` `RL-` `CL-` `DV-` | เหตุการณ์สืบทอดหลังทวีปเปลี่ยนรูป 42 รายการ | [branches/02-new-lands.md](branches/02-new-lands.md) |
| `hu.t1` `va.a4` ฯลฯ | โหนดเส้นเรื่อง (เผ่า + ช่วงชีวิต + ลำดับ) | [storylines/README.md](storylines/README.md) |
| `wi_` `ws_` `wj_` `wc_` `wk_` `wf_` `wl_` | อาวุธ (ของใช้ มาตรฐาน อาชีพ ประเทศ ทวีป โรงตี ตำนาน) | [items/README.md](items/README.md) |
| `ar_` `ac_` `tm_` | เกราะ เครื่องประดับ เครื่องราง | [items/README.md](items/README.md) |
| `b_` `c_` `ns_` `nb_` `nc_` | พร คำสาป skill ที่ตัวละครได้รับ | [character/README.md](character/README.md) |

## ขนาดของเอกสาร

| ชุด | จำนวน |
| --- | --- |
| ทวีป · ประเทศ · เผ่า · มังกร | 9 · 143 · 21 · 15 |
| NPC · ศัตรู · อาวุธ | 591 · 118 · 816 |
| เหตุการณ์โลก · เหตุการณ์สืบทอด | 152 · 42 |
| โหนดเส้นเรื่อง | 423 |

เมื่อเพิ่มหรือแก้เอกสาร ให้รัน `node scripts/check-docs.mjs` และ `node scripts/build-docs-manifest.mjs` ก่อนส่งงาน
