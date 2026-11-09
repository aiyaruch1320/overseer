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
| `check-docs.mjs` | `npm run docs:check` | ตรวจรหัสอ้างอิง ตารางงบอาวุธ ลิงก์ โครงโฟลเดอร์ และศึกของ NPC ครบทุกคนใน `03-enemies.md` หัวข้อ ง ที่มาของแท็กอาชีพลับในโหนดเส้นเรื่อง รหัส NPC กับเหตุการณ์ที่แถว NPC อ้างถึงต้องมีอยู่จริง อายุ NPC อยู่ในช่วงของเผ่า (ต่ำกว่าวัยผู้ใหญ่ได้เมื่อแถวบอกว่ายังเด็ก) แถว NPC มีทางที่ไม่ต้องรอเหตุการณ์โลกอย่างน้อยหนึ่งทาง และความสัมพันธ์สองฝ่ายของประเทศ (พันธมิตร เพื่อน ร่วมมือ ศัตรู คู่แข่ง) ระบุทั้งสองไฟล์ ตรวจรหัสใน character npcs branches และ world-events ด้วย (33 ไฟล์เส้นเรื่อง 554 โหนด 816 อาวุธ) | exit 0 และ `0 errors` `0 warnings` |
| `build-weapon-catalog.mjs` | | สร้าง `_generated/weapon-catalog.md` (816 ชิ้นเขียนมือ + 520 รุ่นวัสดุ) | พิมพ์ `weapons: 816 hand-written + 520 variants = 1336` |
| `build-item-catalog.mjs` | | สร้าง `_generated/item-catalog.md` (331 ชิ้น ตั้งราคา 275 ไม่ขาย 56) | พิมพ์ `items: 331 (priced 275, not sold 56)` |
| `build-npc-map.mjs` | | สร้าง `_generated/npc-map.html` | พิมพ์ `npcs 614 · countries 143 …` |
| `build-local-events.mjs` | | สร้าง `_generated/local-events-by-country.md` (เหตุการณ์ท้องถิ่น LC-1xx ของทุกประเทศที่ไม่มีเหตุการณ์ระบุชื่อ) | พิมพ์ `local events: 61 generated` |
| `build-country-links.mjs` | | สร้าง `_generated/country-links.md` (ตัวละครหลักไปถึงแต่ละประเทศได้ทางไหน และจุดที่ไฟล์ประเทศ NPC เหตุการณ์ขัดกัน) | พิมพ์ `country links: 143 countries` ควรได้ relation clashes 0 |
| `build-npc-economy.mjs` | | สร้าง `_generated/npc-economy.md` (ชนชั้นและทองของ NPC ทั้ง 614 ตัว ณ ต้นเรื่อง ตามกติกา `03-classes.md` หัวข้อ 8) | พิมพ์ `npc economy: 614 npcs` |
| `build-event-coverage.mjs` | | สร้าง `_generated/event-coverage.md` (ประเทศที่ไม่มีเหตุการณ์ระบุชื่อ NPC ที่ไม่ผูกเหตุการณ์หรือ NPC อื่น) ใช้หาที่ที่ต้องเพิ่มจุดบรรจบ | พิมพ์ `event coverage: 143 countries` |
| `build-storyline-balance.mjs` | | สร้าง `_generated/storyline-balance.md` (โหนด จุดบรรจบ NPC ประเทศ ต่อเผ่า) ใช้ตรวจว่าเผ่าไหนเป็นตัวเอก | พิมพ์ `storyline balance: 21 peoples` |
| `build-story-map.mjs` | | สร้าง `_generated/story-map.html` | พิมพ์ `nodes 197 … edges …` |
| `build-docs-manifest.mjs` | | สร้าง `_generated/manifest.json` (ชั้น กลุ่ม ชนิด หัวข้อของทุกไฟล์) | พิมพ์ `manifest: N docs` และไม่มี `files outside any known group` |
| `templates/` | | แม่แบบ HTML และข้อมูลจัดมือของแผนที่ ไม่ใช่สคริปต์ที่รัน | |

`npm run docs:build` รันตัวสร้างทั้งสิบตามลำดับ (ดัชนีท้ายสุด) `npm run docs:verify` คือ `docs:check` ตามด้วย `docs:build`

## แปลงเอกสารกับโค้ด (`scripts/codegen/`)

| สคริปต์ | คำสั่ง npm | ทิศทาง | ใช้เมื่อ |
| --- | --- | --- | --- |
| `export-character-catalog.ts` (ลบแล้ว) | - | เคยสร้าง `docs/_generated/character-catalog/` จากข้อมูลของ POC | ไฟล์ที่สร้างไว้คงเป็นเอกสารตายตัว `check-docs` และตัวสร้าง `codegen/groups/character.ts` ยังอ่านอยู่ |
| `gen-visual-docs.ts` (ลบแล้ว) | - | เคยสร้าง `docs/_generated/poc-visuals/` จากโค้ด POC | ไฟล์ที่สร้างไว้คงเป็นเอกสารตายตัว |

ไฟล์ใน `src/data/` ที่ขึ้นต้นด้วย `// Generated` ห้ามแก้ด้วยมือ ผลที่ถูกต้องคือรันซ้ำแล้ว `git diff` ไม่เปลี่ยนเมื่อเอกสารไม่เปลี่ยน

## ตัวจำลอง (`scripts/sim/`)

| สคริปต์ | คำสั่ง npm | วัดอะไร | เวลา | อ่านผลอย่างไร |
| --- | --- | --- | --- | --- |
| `sim-world.mjs` | `npm run sim:world` | จำลองโลก 2,000 ใบจากตารางเหตุการณ์ (ยุค มังกรล้ม จุดบรรจบ ปลายโลก) ตัวเลือก `--strict` `--md` `--why` `--cv` `--json` | ราว 3 วินาที | เหตุการณ์ที่ไม่เคยเกิด (`never fired`) และที่หายาก (`rare`) ควรมีเหตุผลรองรับ |
| `sim-items.mjs` | `npm run sim:items` | คืนทุนเครื่องมือชีวิต และจำนวนเครื่องรางในมือ NPC พร้อมกัน ตัวเลือก `tools` `talisman` และจำนวนรอบ | ไม่กี่วินาที | เทียบกับ [../docs/systems/items/19-prices.md](../docs/systems/items/19-prices.md) หัวข้อ 8 และ [20-npc-talisman.md](../docs/systems/items/20-npc-talisman.md) หัวข้อ 11 |
| `sim-life.mjs` | `node scripts/sim/sim-life.mjs [จำนวนชีวิต] [--sample=hu] [--no-overlay]` | เดินตามน้ำหนักในตารางเส้นเรื่องของแต่ละเผ่า นับเหตุการณ์ NPC ต่างเผ่า และประเทศที่โหนดกล่าวถึงต่อชีวิต หรือพิมพ์ชีวิตตัวอย่างหนึ่งชีวิต | ไม่กี่วินาที | ใช้เทียบเส้นเรื่องก่อนและหลังเพิ่มเส้นซ้อนทับ ไม่นับเงื่อนไขของโหนดและเวลาเหตุการณ์ (โหมด --sample ใช้เส้นซ้อนทับเฉพาะเมื่อชีวิตที่ผ่านมาเข้ากับเส้นนั้น) จุดบรรจบให้ดูจาก `sim-world.mjs --cv` |
| `sim-life.mjs --director` | `node scripts/sim/sim-life.mjs 1500 --director` | เทียบเรื่องโยงกลับต่อชีวิต เมื่อปิดและเปิดผู้กำกับตามกติกา (`docs/systems/llm/04-story.md` หัวข้อ 3.5) | ไม่กี่วินาที | เป้าอย่างน้อย 30% |
| `test-deepseek.mjs` (ใน `scripts/llm/`) | `node scripts/llm/test-deepseek.mjs [--rounds=2] [--only=epitaph] [--write]` | เรียก DeepSeek จริงด้วยกุญแจใน `.env` สำหรับ `setup` `director` `epitaph` วัดตัวตรวจ โทเคน แคช เวลา และเก็บคำตอบใน `.data/llm-live-test.json` | ราว 2 นาที เสียเงินราว 0.01 ดอลลาร์ | `--write` เขียนผลลง `docs/systems/llm/08-live-test.md` |
| `build-library.mjs` (ใน `scripts/llm/`) | `node scripts/llm/build-library.mjs [--family=omen\|prayer\|all] [--sets=60] [--write]` | สร้างคลังชั้น 1 ด้วย DeepSeek (ทางเลือกเสริม คลังจริงเขียนโดย agent) ตรวจ ตัดซ้ำ ตัดคำขึ้นต้นซ้ำ เก็บใน `.data/library/` `--sets` ทดลองบางส่วน | ทดลอง 120 ชุดราว 1 นาที 0.03 ดอลลาร์ | `--write` เขียนผลลง `docs/systems/llm/08-live-test.md` หัวข้อ 6 |
| `check-library.mjs` (ใน `scripts/llm/`) | `node scripts/llm/check-library.mjs [ไฟล์] [--sets=omen] [--sample=1]` | ตรวจคลังชั้น 1 ที่ agent เขียนใน `data/library/` ตามสเปกของ `docs/systems/llm/09-library.md` (ชุดสถานะ จำนวน ช่อง อักษรไทย ตัวเลข ความยาว ซ้ำ ลอกชั้น 0 คำขึ้นต้น ภาพ) `--sets` รายการชุดสถานะให้ผู้เขียน `--sample` สุ่มบรรทัดให้ผู้ใช้อ่าน | ทันที | exit 0 และ `0 errors` ชุดที่ยังไม่มีไฟล์แสดงว่าขาด |
| `sim-attention.mjs` | `node scripts/sim/sim-attention.mjs [ชีวิต=20000] [--write]` | เกมเรียกผู้เล่นบ่อยแค่ไหนในหนึ่งชีวิต (หยุด การ์ด ช่วงที่เรียกติดกัน ช่วงเงียบ การ์ดที่ไม่ทันขึ้น) แบบเรียกทุกครั้งเทียบกับกติกาของ `docs/systems/experience/07-attention.md` และค่าตั้งน้อยและมาก `ATTN='{"cardGap":75}'` ลองค่าอื่น | ไม่กี่วินาที | `--write` เขียนผลลงหัวข้อ 5 ของไฟล์นั้น อัตราของลาง ศึก และวิกฤตพวกพ้องเป็นค่าสมมติ |
| `sim-god.mjs` | `node scripts/sim/sim-god.mjs [ชีวิต=20000] [โลก=600] [--write]` | สมดุลระบบพระเจ้าตามนโยบายเงียบ เมตตา ให้ของ เก็บพลัง ลงโทษ สุ่ม เร่งจบ: ส่วนชีวิต (พลัง ศรัทธาเทพ คำอธิษฐาน ความฝัน หีบ) และส่วนโลก (ซาก หมุดผนึก ลิขิต ผ่านตัวเกี่ยว `god` `godW` `godOpen` ของ `sim-world.mjs`) ตรวจเป้าแปดข้อ `GOD_RULE='{"ruinCd":300}'` ลองค่ากติกาอื่น | ราว 15 วินาที | `--write` เขียนผลลง `docs/systems/god/06-implementation.md` หัวข้อ 4 ถ้าแก้ราคาหรือเพดานใน `01-power.md` หรือ `04-miracles.md` ให้แก้ `RULE` หรือค่าคงที่ในสคริปต์แล้วรันใหม่ |
| `sim-llm-cost.mjs` | `node scripts/sim/sim-llm-cost.mjs [--write]` | ค่า LLM ต่อชีวิตตามแบบผู้เล่นและแบบการใช้ แยกตามงาน ความไว จำนวนผู้เล่น และค่าสร้างคลัง อ่านตารางราคาและตารางงานจาก `docs/systems/llm/01-cost.md` | ทันที | `--write` เขียนผลลงหัวข้อ 6 ของไฟล์นั้น ถ้าแก้ราคาหรือจำนวนครั้งให้รันใหม่ |
| `sim-wish-parse.mjs` | `node scripts/sim/sim-wish-parse.mjs [--write] [--quiet] [--text="คำขอ"]` | ตัวแปลคำพ้องของระบบสั่งตัวละคร: อ่านตารางจาก `docs/systems/character/20-wish-synonyms.md` (ชื่อประเทศจากดัชนีประเทศ) แปลคำขอตัวอย่าง 74 ข้อด้วยการสแกนหาคำที่ยาวที่สุด (ไม่ตัดคำ) พิมพ์ช่องที่เข้าใจของแต่ละข้อ และสรุปสัดส่วนเข้าใจครบ เข้าใจบางส่วน (ส่งผู้แปล) ไม่เข้าใจ (หน้าเลือกเอง) กับสายอักษรที่ไม่รู้จักบ่อยที่สุด | ทันที | `--write` เขียนตารางสรุปลงหัวข้อ 11 ของไฟล์นั้น ตัวอย่างเขียนโดยผู้ออกแบบ ตัวเลขสูงกว่าที่ผู้เล่นจริงจะได้ ใช้ดูว่าคำพ้องที่เพิ่มมีผลหรือไม่ `--text` ลองคำขอเดียว |
| `sim-start.mjs` | `node scripts/sim/sim-start.mjs [โลก] [--tables]` | เทียบวิธีเลือกปีเกิดของชีวิต (`world-time.md` หัวข้อ 8.1) `--tables` พิมพ์ตาราง 3.4 และ 3.6 ของ `world-sim.md` | ไม่กี่วินาที | ตัวเลขต้องตรงกับตารางใน `world-sim.md` |
| `sim-npc-fate.mjs` | `node scripts/sim/sim-npc-fate.mjs [--md]` | ตารางชะตา NPC ยุคปลาย (`branches/04-last-era.md`) เทียบอายุขัย | ไม่กี่วินาที | สัดส่วนอยู่ ย้าย ตาย หายต่อช่วง |
| `sim-npc-timeline.mjs` | `node scripts/sim/sim-npc-timeline.mjs [โลก] [--md] [--all]` | แถว NPC ที่ผูกเหตุการณ์โลก ผู้ถือคนแรกยังมีชีวิตตอนเหตุการณ์แรกเกิดหรือไม่ (`lore/npcs/README.md` หัวข้อ 2.1 ข้อ 6) | ราว 2 วินาทีต่อ 1,000 โลก | `DEAD` คือเรื่องที่ผู้สืบเล่นเกือบเสมอ ไม่ใช่ข้อผิด ให้ดูว่าข้อความในไฟล์อื่นต้องการตัวผู้ถือคนแรกหรือไม่ |
| `sim-npc-density.mjs` | `node scripts/sim/sim-npc-density.mjs [โลก] [--nt=0.4] [--ntEvery=ปี] [--tier3=สัดส่วน]` | NPC ที่มีเรื่องของตัวเองต่อประเทศในแต่ละช่วงของนาฬิกาโลก และจำนวนเรื่อง NPC ที่หนึ่งชีวิตเจอ (ตามกติกาผู้สืบและ NPC ที่มาใหม่ใน `succession.md`) ตัวเลือกใช้ทดลองกติกาเติม NPC | ราว 3 วินาทีต่อ 200 โลก | เทียบตัวเลขช่วงต้นกับช่วงหลัง ถ้าช่วงหลังต่ำกว่ามาก NPC กระจุกตัวที่ต้นเรื่อง |

ตัวจำลองไม่เขียนไฟล์ ผลลัพธ์ที่ควรเก็บให้คัดลอกเข้าเอกสารเอง และบอกชื่อคำสั่งที่ใช้


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
| `codegen/export-character-catalog.ts` | ลบแล้ว | ไฟล์แคตตาล็อกที่สร้างไว้ยังอยู่และถูกอ่านต่อ |
| `codegen/gen-visual-docs.ts` | ลบแล้ว | โค้ด POC ถูกลบ ไฟล์ `_generated/poc-visuals/` คงเป็นเอกสารตายตัว |
| `sim/sim-world.mjs` `sim-items.mjs` | ใช้ | วัดจากเอกสารโดยตรง |

## เพิ่มสคริปต์ใหม่

1. วางในโฟลเดอร์ที่ตรงหน้าที่ ตั้งชื่อ `ขั้นตอน-ของที่ทำ` ตัวพิมพ์เล็ก
2. สคริปต์ `.mjs` import `root` จาก `../lib/paths.mjs` ไม่คำนวณเส้นทางเอง
3. บรรทัดแรกเป็นคอมเมนต์บอกว่าอ่านอะไร เขียนอะไร และรันอย่างไร
4. เขียนไฟล์ได้เฉพาะ `docs/_generated/` หรือ `src/data/` (ไฟล์ที่ขึ้นต้น `// Generated`) ห้ามแก้เอกสารที่คนเขียน
5. ไฟล์ที่สร้างเข้า `docs/_generated/` ให้เพิ่มแถวใน [../docs/_generated/README.md](../docs/_generated/README.md) และใน `SOURCE` ของ `docs/build-docs-manifest.mjs`
6. เพิ่มแถวในตารางของไฟล์นี้ และเพิ่มคำสั่ง npm ถ้ารันบ่อย
