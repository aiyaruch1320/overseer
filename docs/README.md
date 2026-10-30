# คัมภีร์ของโลก: ดัชนีเอกสารทั้งหมด

เอกสารในโฟลเดอร์นี้คือ **ความจริงดิบของโลก** (raw lore bible) ของเกมแนวพระเจ้าเฝ้าดูตัวละครหนึ่งตัวที่ใช้ชีวิตเอง ใช้เป็นแหล่งอ้างอิงทั้งสำหรับเนื้อเรื่อง ระบบเกม และภาพ ไม่ใช่นิยาย ไม่มีบทสนทนายาว ไม่มีคำถามถึงผู้อ่าน

โค้ดใน `src/` เป็นตัวทดลอง (POC) เมื่อโค้ดขัดกับเอกสาร **เอกสารชนะ** เมื่อเอกสารสองไฟล์ขัดกัน ไฟล์ที่ใหม่กว่า (ดูประวัติ git) ชนะ แล้วบันทึกข้อขัดแย้งใน [guide/consistency-checks.md](guide/consistency-checks.md)

ดัชนีที่เครื่องอ่านได้อยู่ที่ [_generated/manifest.json](_generated/manifest.json) (สร้างด้วย `node scripts/docs/build-docs-manifest.mjs`) แผนงานและสถานะอยู่ที่ [../RAW_PLAN.md](../RAW_PLAN.md)

## สามชั้นของเอกสาร

เอกสารแบ่งตามคำถามที่มันตอบ ไม่ได้แบ่งตามหัวข้อ เรื่องเดียวกันอาจมีสามไฟล์ในสามชั้น เชื่อมกันด้วยรหัส

| ชั้น | โฟลเดอร์ | ตอบคำถามว่า | ในไฟล์มี | ผู้อ่านหลัก |
| --- | --- | --- | --- | --- |
| **โลก** (lore) | [lore/](lore/README.md) | โลกเป็นอย่างไร ใครคือใคร เกิดอะไรขึ้นที่ไหน | ข้อเท็จจริงในโลก ประวัติ ความสัมพันธ์ เส้นเรื่อง | คนเขียนเรื่อง คนออกแบบฉาก |
| **ระบบ** (systems) | [systems/](systems/README.md) | เกมคำนวณอะไรอย่างไร | ตัวเลข สูตร ตารางข้อมูล เงื่อนไขและผลของเหตุการณ์ | คนเขียนโค้ด ตัวจำลอง |
| **ภาพ** (appearance) | [appearance/](appearance/README.md) | สิ่งนี้หน้าตาอย่างไร ขยับอย่างไร | สี ทรง ท่า เอฟเฟกต์ ฉากแอนิเมชัน ค่า UI | คนทำภาพ UI แอนิเมชัน |
| คู่มือ | [guide/](guide/README.md) | จะเพิ่มหรือแก้เอกสารอย่างไร | กติกา แบบฟอร์ม รหัส บันทึกความขัดแย้ง | ทุกคนที่แก้เอกสาร |
| สร้างอัตโนมัติ | [_generated/](_generated/README.md) | (อ่านอย่างเดียว) | แผนที่ แคตตาล็อก ดัชนี | agent และสคริปต์ |

## ข้อตกลง

1. **ข้อเท็จจริงมีที่อยู่เดียว** แต่ละเรื่องมีไฟล์เจ้าของตามตารางด้านล่าง ไฟล์อื่นอ้างด้วยรหัสหรือลิงก์ ไม่คัดลอกตัวเลขหรือข้อความมา
2. **ข้ามชั้นด้วยรหัส** ภาพอ้างประเทศด้วย `AZ-01` ระบบอ้างเหตุการณ์ด้วย `DR-01` โลกอ้างพรด้วย `b_...` ไม่ซ้ำเนื้อหาของอีกชั้น
3. **แต่ละชั้นเก็บของชั้นตัวเอง** ชั้นโลกไม่มีสูตร ชั้นระบบไม่มีการบรรยายยาว ชั้นภาพไม่มีตัวเลขของเกม (ยกเว้นค่าที่อ้างมาและระบุที่มา)
4. **ไฟล์ใน `_generated/` ห้ามแก้ด้วยมือ** แก้ที่ต้นทางแล้วสร้างใหม่
5. **ทุกรายการที่มีรหัสอยู่ในตาราง** หนึ่งแถวหนึ่งรหัส ใช้รหัสเดิมเสมอเมื่ออ้างข้ามไฟล์
6. **ลิงก์เป็นลิงก์สัมพัทธ์** ทุกลิงก์ต้องไม่เสีย `node scripts/docs/check-docs.mjs` ตรวจให้
7. **ไทย ตรงไปตรงมา** เขียนสิ่งที่เป็นจริงในโลก ไม่บอกผู้อ่านว่าควรรู้สึกอย่างไร
8. **ระบบพระเจ้าออกแบบเป็นลำดับสุดท้าย** เอกสารที่อ้างถึงทำเป็นตัวบอกตำแหน่งเท่านั้น

รายละเอียดว่าอะไรอยู่ด้วยกันและอะไรควรแยก: [guide/organization.md](guide/organization.md)

## ไฟล์เจ้าของของแต่ละเรื่อง

| เรื่อง | ไฟล์เจ้าของ |
| --- | --- |
| เรื่องหลักของโลกและยุค | [lore/world/story-continents.md](lore/world/story-continents.md) |
| ภูมิศาสตร์และผู้คนของทวีป | [lore/world/continents.md](lore/world/continents.md) |
| ผังแผนที่ | [lore/world/world-map.md](lore/world/world-map.md) |
| การเมืองข้ามทวีป | [lore/world/world-politics.md](lore/world/world-politics.md) |
| นาฬิกา ปีโลก ปีชีวิต อายุขัย | [lore/world/world-time.md](lore/world/world-time.md) |
| ประเทศ (รัฐ เผ่า ศาสนา ปมเรื่อง) | [lore/countries/](lore/countries/README.md) |
| ประวัติ ที่อยู่ ความสัมพันธ์ของเผ่า | [lore/races/](lore/races/README.md) |
| ค่าสถานะเริ่มต้น พร คำสาป สกิลของเผ่า | [systems/character/races/](systems/character/races/README.md) |
| ตัวตนของมังกรและความสัมพันธ์ | [lore/dragons/](lore/dragons/README.md) |
| อารมณ์มังกร ผลเมื่อมังกรล้ม | [systems/simulation/dragon-mood.md](systems/simulation/dragon-mood.md) |
| ศาสนา | [lore/religions/](lore/religions/README.md) |
| NPC 591 ตัว | [lore/npcs/](lore/npcs/README.md) |
| เส้นเรื่องของเผ่าและจุดบรรจบ | [lore/storylines/](lore/storylines/README.md) |
| ตระกูลและทายาท | [lore/heirs/](lore/heirs/README.md) |
| เหตุการณ์โลก 152 รายการ (เงื่อนไขและผล) | [systems/events/world-events.md](systems/events/world-events.md) |
| ผลเมื่อมังกรล้มและทวีปเปลี่ยนรูป | [systems/events/branches/](systems/events/branches/README.md) |
| ความมั่งคั่งของประเทศ (W G M) | [systems/economy/02-countries.md](systems/economy/02-countries.md) |
| พร คำสาป สกิล อาชีพ สัตว์คู่หู | [systems/character/](systems/character/README.md) |
| ต่อสู้ ศัตรู รางวัล | [systems/combat/](systems/combat/README.md) |
| อาวุธ เกราะ เครื่องราง ของใช้ | [systems/items/](systems/items/README.md) |
| ผู้เล่นควรรู้สึกและเห็นอะไรในหนึ่งชีวิต | [systems/experience/](systems/experience/README.md) |
| หน้าตาของทุกสิ่ง | [appearance/](appearance/README.md) |
| ขนาดเมือง วัง ศาสนสถาน | [appearance/countries/10-scale-and-sacred.md](appearance/countries/10-scale-and-sacred.md) |
| กำแพง สงคราม กฎหมาย จุดเด่นของเมือง | [appearance/countries/11-context-and-landmarks.md](appearance/countries/11-context-and-landmarks.md) |

## อ่านอะไรตามงานที่ทำ

| งาน | อ่านตามลำดับนี้ |
| --- | --- |
| เข้าใจโลกเร็ว ๆ | [lore/world/story-continents.md](lore/world/story-continents.md) → [lore/world/continents.md](lore/world/continents.md) → [lore/world/world-time.md](lore/world/world-time.md) → [lore/dragons/README.md](lore/dragons/README.md) |
| เขียนเรื่องหรือ NPC | [lore/countries/](lore/countries/README.md) → [lore/npcs/](lore/npcs/README.md) → [lore/storylines/](lore/storylines/README.md) → [lore/races/](lore/races/README.md) |
| สร้างฉากเมืองและแผนที่ | [appearance/README.md](appearance/README.md) → [appearance/01-continents.md](appearance/01-continents.md) → [appearance/countries/](appearance/countries/) (ไฟล์ทวีป + 10 + 11) → [lore/world/world-map.md](lore/world/world-map.md) |
| สร้างตัวละครและ NPC | [appearance/02-races.md](appearance/02-races.md) → [appearance/npcs/](appearance/npcs/) → [lore/npcs/README.md](lore/npcs/README.md) |
| สร้างศัตรู อาวุธ ไอเทม | [appearance/04-enemies.md](appearance/04-enemies.md) → [appearance/05-weapons-rules.md](appearance/05-weapons-rules.md) → [systems/items/README.md](systems/items/README.md) |
| ทำแอนิเมชันเหตุการณ์โลก | [appearance/11-world-changes.md](appearance/11-world-changes.md) → [appearance/12-event-visuals.md](appearance/12-event-visuals.md) → [systems/events/world-events.md](systems/events/world-events.md) → [systems/events/branches/README.md](systems/events/branches/README.md) |
| ทำฉากชีวิตและเส้นเรื่อง | [systems/experience/README.md](systems/experience/README.md) → [appearance/13-storyline-scenes.md](appearance/13-storyline-scenes.md) → [lore/storylines/README.md](lore/storylines/README.md) |
| เขียนระบบตัวละคร | [systems/character/README.md](systems/character/README.md) → [systems/character/races/README.md](systems/character/races/README.md) → [systems/combat/README.md](systems/combat/README.md) |
| ปรับสมดุล | [systems/simulation/world-sim.md](systems/simulation/world-sim.md) → [systems/economy/README.md](systems/economy/README.md) → `node scripts/sim/sim-world.mjs` |
| ตรวจความสอดคล้อง | `node scripts/docs/check-docs.mjs` (ต้องได้ 0 errors 0 warnings) และ [guide/consistency-checks.md](guide/consistency-checks.md) |

## รหัสที่พบบ่อย

ตารางเต็มอยู่ที่ [guide/id-glossary.md](guide/id-glossary.md) ย่อดังนี้ ประเทศ `AZ-01` · NPC `AL01-1` · เหตุการณ์โลก `DR-01` · โหนดเส้นเรื่อง `hu.t1` · อาวุธ `wl_...` · พร/คำสาป `b_` `c_`

## ขนาดของเอกสาร

| ชุด | จำนวน |
| --- | --- |
| ทวีป · ประเทศ · เผ่า · มังกร | 9 · 143 · 21 · 15 |
| NPC · ศัตรู · อาวุธ | 591 · 130 · 816 |
| เหตุการณ์โลก · เหตุการณ์สืบทอด | 152 · 42 |
| โหนดเส้นเรื่อง | 423 |

เมื่อเพิ่มหรือแก้เอกสาร ให้รัน `npm run docs:verify` (ตรวจแล้วสร้างไฟล์อัตโนมัติใหม่) คู่มือสคริปต์ทั้งหมดอยู่ที่ [../scripts/README.md](../scripts/README.md)
