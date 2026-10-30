# สคริปต์ของโปรเจกต์

คู่มือสำหรับคนและ agent ที่จะรันสคริปต์ ทุกคำสั่งรันจากรากของ repo (`/` ที่มี `package.json`) ใช้ Node 22 ขึ้นไป และ `npm install` ครั้งเดียวสำหรับสคริปต์ `.ts` (ใช้ `tsx`)

เอกสารที่สคริปต์เหล่านี้อ่านและเขียนอยู่ใน [../docs/README.md](../docs/README.md) ไฟล์ที่ถูกสร้างอยู่ใน [../docs/_generated/README.md](../docs/_generated/README.md)

## เริ่มเร็ว

```bash
npm run docs:verify
```

ผ่านเมื่อบรรทัดแรกลงท้าย `0 errors · 0 warnings` และคำสั่งจบด้วย exit code 0 คำสั่งนี้ตรวจเอกสารแล้วสร้างแคตตาล็อก แผนที่ และดัชนีใหม่ทั้งหมด หลังรันให้ดู `git status` ถ้ามีไฟล์ใน `docs/_generated/` เปลี่ยนโดยที่คุณไม่ได้แก้ต้นทาง แสดงว่าไฟล์เหล่านั้นล้าสมัยมาก่อน

## โครงโฟลเดอร์

| โฟลเดอร์ | หน้าที่ | อ่าน | เขียน |
| --- | --- | --- | --- |
| `docs/` | ตรวจและสร้างไฟล์จากเอกสาร | `docs/` | `docs/_generated/` |
| `codegen/` | แปลงระหว่างเอกสารกับข้อมูลในโค้ด | `docs/` หรือ `src/` | `src/data/` หรือ `docs/_generated/` |
| `sim/` | จำลองเพื่อวัดความสมดุล | `docs/` หรือ `src/sim/` | พิมพ์ผลที่จอเท่านั้น |
| `lib/` | โค้ดที่ใช้ร่วมกัน (`paths.mjs`) | | |

## สคริปต์เอกสาร (`scripts/docs/`)

| สคริปต์ | คำสั่ง npm | ทำอะไร | ผ่านเมื่อ |
| --- | --- | --- | --- |
| `check-docs.mjs` | `npm run docs:check` | ตรวจรหัสอ้างอิง ตารางงบอาวุธ ลิงก์ และโครงโฟลเดอร์ (27 ไฟล์เส้นเรื่อง 423 โหนด 816 อาวุธ) | exit 0 และ `0 errors` `0 warnings` |
| `build-weapon-catalog.mjs` | | สร้าง `_generated/weapon-catalog.md` (816 ชิ้นเขียนมือ + 520 รุ่นวัสดุ) | พิมพ์ `weapons: 816 hand-written + 520 variants = 1336` |
| `build-item-catalog.mjs` | | สร้าง `_generated/item-catalog.md` (311 ชิ้นพร้อมราคา) | พิมพ์ `items: 311` |
| `build-npc-map.mjs` | | สร้าง `_generated/npc-map.html` | พิมพ์ `npcs 591 · countries 143` |
| `build-story-map.mjs` | | สร้าง `_generated/story-map.html` | พิมพ์ `nodes 197 … edges …` |
| `build-docs-manifest.mjs` | | สร้าง `_generated/manifest.json` (ชั้น กลุ่ม ชนิด หัวข้อของทุกไฟล์) | พิมพ์ `manifest: N docs` และไม่มี `files outside any known group` |
| `templates/` | | แม่แบบ HTML และข้อมูลจัดมือของแผนที่ ไม่ใช่สคริปต์ที่รัน | |

`npm run docs:build` รันตัวสร้างทั้งห้าตามลำดับ (ดัชนีท้ายสุด) `npm run docs:verify` คือ `docs:check` ตามด้วย `docs:build`

## แปลงเอกสารกับโค้ด (`scripts/codegen/`)

| สคริปต์ | คำสั่ง npm | ทิศทาง | ใช้เมื่อ |
| --- | --- | --- | --- |
| `gen-countries.ts` | `npm run gen:data` | `docs/lore/countries/` → `src/data/countries.ts` | แก้ไฟล์ประเทศ |
| `gen-npc-cast.ts` | `npm run gen:data` | `docs/lore/npcs/` → `src/data/npcCast.ts` | แก้ไฟล์ NPC |
| `gen-birth.ts` | `npm run gen:data` | `docs/systems/character/01-origin.md` → `src/data/birthTables.ts` | แก้ตารางกำเนิด |
| `export-character-catalog.ts` | `npm run gen:docs` | `src/data/` → `docs/_generated/character-catalog/` | แก้พร คำสาป skill ในโค้ด ตัวตรวจเอกสารอ่านแคตตาล็อกนี้ |
| `gen-visual-docs.ts` | `npm run gen:docs` | `src/` → `docs/_generated/poc-visuals/` | **เก่า** ดูหัวข้อสถานะ |

ไฟล์ใน `src/data/` ที่ขึ้นต้นด้วย `// Generated` ห้ามแก้ด้วยมือ ผลที่ถูกต้องคือรันซ้ำแล้ว `git diff` ไม่เปลี่ยนเมื่อเอกสารไม่เปลี่ยน

## ตัวจำลอง (`scripts/sim/`)

| สคริปต์ | คำสั่ง npm | วัดอะไร | เวลา | อ่านผลอย่างไร |
| --- | --- | --- | --- | --- |
| `sim-world.mjs` | `npm run sim:world` | จำลองโลก 2,000 ใบจากตารางเหตุการณ์ (ยุค มังกรล้ม จุดบรรจบ ปลายโลก) ตัวเลือก `--strict` `--md` `--why` `--cv` `--json` | ราว 3 วินาที | เหตุการณ์ที่ไม่เคยเกิด (`never fired`) และที่หายาก (`rare`) ควรมีเหตุผลรองรับ |
| `sim-items.mjs` | `npm run sim:items` | คืนทุนเครื่องมือชีวิต และจำนวนเครื่องรางในมือ NPC พร้อมกัน ตัวเลือก `tools` `talisman` และจำนวนรอบ | ไม่กี่วินาที | เทียบกับ [../docs/systems/items/19-prices.md](../docs/systems/items/19-prices.md) หัวข้อ 8 และ [20-npc-talisman.md](../docs/systems/items/20-npc-talisman.md) หัวข้อ 11 |
| `sim-gold.ts` | `npm run sim:gold` | ทองที่ตัวละครของโค้ดสะสมตามอายุ (ใช้ตั้งราคาตีอาวุธ) | ราว 1 นาทีต่อ 300 ชีวิต | รันซ้ำเมื่อโค้ดเปลี่ยนวิธีให้ทอง แล้วแก้ราคาใน `RAW_PLAN.md` หัวข้อ 3.2 |
| `simtest.ts` | `npm run sim` | ทดสอบควันของเกมในโค้ด: เล่น 200 ชีวิตด้วยการกระทำสุ่ม ตรวจว่าไม่พังและจังหวะเกมสมเหตุผล | ราว 1 นาที | ต้องไม่มี exception ดู `avgTicksPerLife` `hAge at death` |

ตัวจำลองไม่เขียนไฟล์ ผลลัพธ์ที่ควรเก็บให้คัดลอกเข้าเอกสารเอง และบอกชื่อคำสั่งที่ใช้

**ข้อควรระวัง** `sim-gold.ts` และ `simtest.ts` วัดตัวทดลอง (POC) ใน `src/` ซึ่งมี 14 เผ่าและเงื่อนไขอาชีพของตัวเอง ผลใช้เทียบกับเอกสารโดยตรงไม่ได้ เช่น ใน `simtest` อาชีพลับ `godslayer` เป็นอาชีพสุดท้ายที่พบบ่อยที่สุด (43 จาก ~350 ชีวิต) เพราะเงื่อนไขในโค้ดหลวมกว่าเอกสาร เป้าของเอกสารคืออาชีพลับรวมไม่เกิน 3% และ `godslayer` ไม่เกิน 0.1%

## แก้อะไร รันอะไร

| แก้ | รัน |
| --- | --- |
| ไฟล์ใดใน `docs/` | `npm run docs:verify` |
| `docs/lore/countries/` `docs/lore/npcs/` หรือ `docs/systems/character/01-origin.md` | `npm run gen:data` แล้ว `npm run typecheck` |
| อาวุธ `docs/systems/items/01` ถึง `08` | `npm run docs:verify` (แคตตาล็อกอาวุธสร้างใหม่) |
| เกราะ เครื่องประดับ เครื่องราง ของใช้ `docs/systems/items/12` ถึง `18` หรือราคาใน `economy/04` | `npm run docs:verify` (แคตตาล็อกไอเทมสร้างใหม่) แล้ว `npm run sim:items` ถ้าแก้ราคาเครื่องมือหรือตารางเครื่องราง |
| ตารางเหตุการณ์ `docs/systems/events/world-events.md` หรือ `docs/lore/storylines/00-convergence.md` | `npm run docs:verify` แล้ว `npm run sim:world` |
| พร คำสาป skill ใน `src/data/` | `npm run gen:docs` แล้ว `npm run docs:verify` |

## สถานะของสคริปต์

| สคริปต์ | สถานะ | หมายเหตุ |
| --- | --- | --- |
| `docs/*` ทุกตัว | ใช้ประจำ | ต้องผ่านก่อนส่งงานทุกครั้ง |
| `codegen/gen-*.ts` (ยกเว้น visual) | ใช้ตราบที่โค้ดอ่านข้อมูลจากเอกสาร | เมื่อเกมจริงอ่านเอกสารโดยตรง สคริปต์เหล่านี้เลิกใช้ได้ |
| `codegen/export-character-catalog.ts` | ใช้ | `check-docs` อ่านแคตตาล็อกที่มันสร้าง |
| `codegen/gen-visual-docs.ts` | **เก็บไว้ (ยังไม่ทราบว่าใช้อยู่)** | สร้างเอกสารภาพของ POC ที่ถูกแทนที่ด้วย `docs/appearance/` ไม่มีสคริปต์อื่นพึ่ง ผู้ใช้ตัดสินให้เก็บไว้ จนกว่าจะยืนยันว่าไม่มีใครใช้เอกสาร `_generated/poc-visuals/` |
| `sim/sim-world.mjs` `sim-items.mjs` | ใช้ | วัดจากเอกสารโดยตรง |
| `sim/sim-gold.ts` `simtest.ts` | ใช้กับ POC เท่านั้น | จะใช้ไม่ได้เมื่อ `src/sim` ถูกเขียนใหม่ ให้เขียนตัวเทียบเท่าบนเกมใหม่ |

## เพิ่มสคริปต์ใหม่

1. วางในโฟลเดอร์ที่ตรงหน้าที่ ตั้งชื่อ `ขั้นตอน-ของที่ทำ` ตัวพิมพ์เล็ก
2. สคริปต์ `.mjs` import `root` จาก `../lib/paths.mjs` ไม่คำนวณเส้นทางเอง
3. บรรทัดแรกเป็นคอมเมนต์บอกว่าอ่านอะไร เขียนอะไร และรันอย่างไร
4. เขียนไฟล์ได้เฉพาะ `docs/_generated/` หรือ `src/data/` (ไฟล์ที่ขึ้นต้น `// Generated`) ห้ามแก้เอกสารที่คนเขียน
5. ไฟล์ที่สร้างเข้า `docs/_generated/` ให้เพิ่มแถวใน [../docs/_generated/README.md](../docs/_generated/README.md) และใน `SOURCE` ของ `docs/build-docs-manifest.mjs`
6. เพิ่มแถวในตารางของไฟล์นี้ และเพิ่มคำสั่ง npm ถ้ารันบ่อย
