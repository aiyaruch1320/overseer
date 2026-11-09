# M8 baseline: ผู้เล่นจำลอง (2026-11-09)

ตัวเลขฐานก่อนมีผู้เล่นจริง ทำด้วยเครื่องมือชุดเดียวกับที่ผู้ทดสอบจะใช้ (`scripts/tools/m8-report.ts`) ตารางข้างล่างเป็นผลดิบ ส่วนบนสรุปว่าอะไรอ่านออก อะไรยังอ่านไม่ได้ และรอบผู้เล่นจริงควรดูอะไร

## ที่มาของตัวเลข

| ชุด | วิธี | ชีวิต |
| --- | --- | --- |
| A | CLI `npx tsx scripts/tools/m8-report.ts --sim=<นโยบาย 9 แบบ> --seeds=1-25 --arms` (เหมือน `npm run life -- --policy=...`) ชีวิตเดี่ยว แต่ละเมล็ดเล่นสองครั้ง: กลุ่ม `off` ไม่ถาม LLM กลุ่ม `on` ถามผู้กำกับ LLM ปลอม (`tests/fixtures/llm/tool.json` ตอบ `old_face` ทุกจุด) | 450 |
| B | CLI สายตระกูล 4 ชีวิต (`--lives=4`) นโยบายเมตตา ลงโทษ สุ่ม ปั้นนิสัย เมล็ด 1-10 ไม่มีกลุ่ม A/B | 111 (ผู้สืบอายุมากกว่า จึงมีหยุดและการ์ดน้อยกว่าชีวิตเต็ม อย่าเทียบตัวเลขต่อชีวิตกับชุด A) |
| C | เกมจริง `node scripts/tools/play-check.mjs --out=<dir> --port=418N --no-build --max-min=28` สามรอบพร้อมกัน เบราว์เซอร์จริงบน build ความเร็ว "เร็ว" กดตามที่เกมเรียก ไม่เลือกคำปฏิญาณ ไม่ใช้พลังพระเจ้า ไม่มีเซิร์ฟเวอร์ LLM บันทึกการเล่นเปิดและ A/B `alternate` ส่งออก `record.json` | 3 ชีวิต (อายุ 74 75 74 ตายครบ ไม่มี error ของเกม มีแค่ 404 favicon) |

## ผลสำคัญ

1. **คำปฏิญาณ** (ชุด A): สำเร็จตอนเลือกตามนโยบายตั้งใจ เงียบ 100% (GV-12 คือรางวัลของความยับยั้ง) เมตตา 56% ปั้นนิสัย 46% ให้ของ 50% เร่งจบ 50% ผู้เล่นสุ่ม 21% (เป้า: 40–90% เมื่อตั้งใจ ไม่เกิน 25% เมื่อสุ่ม) เก็บพลัง 27% ลงโทษ 22% และตีหมุด 20% ต่ำกว่า 40% เพราะนโยบายเลือก GV-07 บ่อยแต่ **GV-07 สำเร็จ 0 จาก 38** · ข้อที่สำเร็จ 0%: GV-03 (0/24) GV-04 (0/16) GV-07 (0/38) · ข้อที่ไม่เคยถูกเลือกเลย: GV-08 · ข้อที่ไม่เคยถูกเสนอในชีวิตเดี่ยว 450 ชีวิต: GV-13 ถึง GV-19 และ GV-20 ไม่ได้ถูก "เสนอ" ในตาราง (ข้อ "ไม่ปฏิญาณ" เลือกโดยไม่ผ่านรายการ) ในสายตระกูล 111 ชีวิตขึ้นแค่ GV-15 GV-16 GV-19 ข้อละ 1 ครั้ง (ชุดที่สองเปิดเมื่อพงศาวดารสายตระกูล 10 แต้ม สี่ชีวิตแทบไม่ถึง) จึงยังไม่มีค่าของ 7 ข้อนี้ ต้องให้ผู้เล่นจริงเล่นหลายชีวิตต่อกันหรือสั่งเปิดด้วยเมล็ดที่มีแต้ม
2. **วิกฤตพวกพ้อง** (ชุด A): 3.4–4.1 ครั้งต่อชีวิต ขึ้นการ์ด 44–47% (เป้าเอกสาร: ราว 1.5 การ์ดต่อชีวิต ได้ 1.6–1.9 ต่อชีวิตจาก 77–94 การ์ด / 50 ชีวิต) การ์ดที่หมดเวลา 15–27 ต่อ 50 ชีวิต ผู้เล่นขยับคำตอบ (กระซิบหรือฝัน) ได้เฉพาะนโยบายเมตตากับปั้นนิสัย 27 จาก 82–92 การ์ด ในเกมจริง 3 ชีวิต 8 การ์ด (67% ของ 12 วิกฤต) ตอบเอง 8
3. **ผู้กำกับ A/B** (ชุด A, LLM ปลอม): เรื่องโยงกลับต่อชีวิต off 0.72 → on 0.78 **+9%** (เป้า +15% กับผู้เล่นจริง) แต่ตัวเลขนี้วัดผู้กำกับปลอมที่ตอบ `old_face` ทุกจุดตามไฟล์ fixture จึงบอกได้แค่ว่าเครื่องวัดทำงาน ไม่บอกผลของ LLM จริง · เรื่องโยงกลับต่อโหนด 2% (0.7 ต่อชีวิตจาก 32 โหนด) ตัวฐานต่ำพอที่ +15% คือ +0.1 ครั้งต่อชีวิต ต้องการชีวิตจริงหลายสิบชีวิตต่อกลุ่มจึงจะแยกจากความสุ่ม
4. **หยุดและการ์ดต่อชีวิต**: หยุด p50 7 (เป้า 6–10 ผ่านทุกนโยบาย) การ์ด p50 7–15 (เป้า 12–22: ต่ำกว่าเป้าในนโยบายที่ไม่ตอบคำอธิษฐานมาก ตีหมุด 7 ลงโทษ 8 เร่งจบ 8) การ์ดที่ไม่ทัน 1.1–1.5 (เป้าไม่เกิน 3 ผ่าน) · เกมจริง: หยุด p50 8 การ์ด p50 16 การ์ดที่ไม่ทัน 1.7 ผ่านทั้งหมด การ์ดส่วนใหญ่คือคำอธิษฐาน 11 ต่อชีวิตเพราะ play-check ไม่ตอบ (ผู้จำลองในชุด A ตอบ 5.4 ต่อชีวิต)
5. **เวลาต่อชีวิต**: อายุตาย p50 74 → 34.5 นาทีที่ความเร็วปกติตามค่า `SEC_PER_YEAR` (เป้า 25–45 ผ่าน) เกมจริงที่ความเร็ว "เร็ว" ใช้ p50 20.2 นาทีตามนาฬิกา (รัน 3 หน้าพร้อมกัน) ราว 0.6 ของเวลาปกติ ช้ากว่าที่คาดจากเร็ว ×3 เพราะการ์ดดึงความเร็วกลับเป็นปกติ หยุดค้างตามเวลาจริงของคน (ไม่มีในชุดจำลอง)
6. **การแทรกแซงต่อชีวิต**: เงียบ 0 · ลงโทษ 6.6 · ตีหมุด 8.7 · เร่งจบ 12.6 · ให้ของ 12.7 · เก็บพลัง 20 · สุ่ม 20.6 · ปั้นนิสัย 34 · เมตตา 38.5 (นับคำอธิษฐานที่ตอบด้วย ซึ่ง GV-12 ไม่นับ) เกมจริงที่ไม่เล่นพลัง 0

## สิ่งที่รอบผู้เล่นจริงควรดู

- **A/B ผู้กำกับ**: ต้องมีเซิร์ฟเวอร์ LLM เปิด (ไม่งั้นสองกลุ่มเท่ากัน ดู `llm.server` ในบันทึก) ดูเรื่องโยงกลับต่อชีวิตเทียบ 0.7 ต่อชีวิตที่ฐาน และเรื่องที่เกินจริงคือคำตอบปากเปล่า "ชีวิตไหนเป็นเรื่องเดียวกันมากกว่า" ซึ่งไม่อยู่ในบันทึก
- **คำปฏิญาณ**: ผู้เล่นจริงเลือกข้อไหน (ผู้จำลองถูกผูกกับนโยบาย) ข้อที่ผู้เล่นเลือกบ่อยแต่ไม่สำเร็จเลย (GV-03 GV-04 GV-07 ในชุดจำลอง) ผู้เล่นรู้สึกว่าสำเร็จได้ยากเกินไปไหม และผู้เล่นรู้ไหมว่าข้อไหนไม่สำเร็จเพราะอะไร (หน้าตอนจบ) · ข้อ GV-13 ถึง GV-19 ต้องมีผู้เล่นที่เล่นสายตระกูลยาว
- **วิกฤตพวกพ้อง**: ผู้เล่นเห็นการ์ดวิกฤตแล้วทำอะไร (บันทึกนับ "ผู้เล่นขยับคำตอบ") ทันก่อนหมดเวลาไหม (การ์ดหมดเวลา 1.1–1.5 ต่อชีวิต) 2 ปีรอพอไหม
- **ความถี่ที่เกมเรียก**: การ์ด p50 12–22 และหยุด p50 6–10 กับคนจริงที่หยุดอ่านนานและใช้ความเร็วปกติ ดู `stops held` และเวลาต่อชีวิตจริง
- **การแทรกแซงต่อชีวิต**: พลังพอไหม ราคามากเกินไหม (ตารางแทรกแซงแยกชนิด)
- **ผู้เล่นที่เปลี่ยนสวิตช์เอง** (`director switched by hand`) ไม่รวมในตัวเลขกลุ่มที่สะอาด ควรเป็น 0

## ข้อจำกัดของเครื่องวัดและช่องว่างของเอกสาร

- เอกสารระบุ "คำปฏิญาณ 17 ข้อ" แต่ `08-goals.md` §2 มี GV-01 ถึง GV-20 (19 ข้อ + ไม่ปฏิญาณ GV-20) ตารางจึงแสดงครบ 20 แถว ไม่พบที่มาของเลข 17 ในเอกสาร (เลขนี้มาจากคำสั่งงาน) · ในชุด A ถึง B ขึ้นจริง GV-01 ถึง GV-12 กับ GV-15 GV-16 GV-19 (15 ข้อ) · GV-13 (ชะตา ยังไม่มีระบบ) GV-14 GV-17 GV-18 ไม่เคยขึ้น ควรให้ผู้ใช้บอกว่า 17 หมายถึงข้อไหน
- เอกสาร `04-story.md` §3.5 นิยาม "เรื่องโยงกลับ" เป็นสามอย่าง (NPC เจอซ้ำ เรื่องค้างที่ได้สาง ความฝันที่ถูกอ้างถึง) แต่ log เก็บแค่ว่าทางที่เลือก "โยงกลับ" (`story/node.callback`) ไม่แยกว่าเป็นอย่างไหน เครื่องมือจึงรายงาน (ก) callbacks รวมต่อชีวิต (ข) เหตุผลของคำตอบ LLM (`old_face` `dream` `life_question` `vow`) และ (ค) การจบของเรื่องพวกพ้องที่ผู้เล่นมีส่วน เป็นตัวแทนของ "เรื่องค้างที่ได้สาง" เท่านั้น ถ้าต้องการสามอย่างแยก ต้องให้แกนเขียนชนิดของการโยง (npc / event / pivot / dream) ลง `story/node`
- เอกสารไม่นิยามว่า "ตอบวิกฤต" คือผู้เล่นทำอะไร (วิกฤตตอบโดยตัวละครที่ตาต่อมา ผู้เล่นขยับได้ด้วยกระซิบ/ฝัน/คำพูดเท่านั้น `by` ใน `bonds/trouble`) ตารางจึงแยก "การ์ดที่ตัวละครตอบ" กับ "ผู้เล่นขยับ" ควรเขียนนิยามลง `07-attention.md` §5 หรือ bonds/04
- เอกสาร `07-attention.md` §5 ให้เป้า "หยุด/การ์ดต่อชีวิตเต็ม" ไม่ระบุว่าผู้สืบ (ชีวิตที่เริ่มโตแล้ว) นับหรือไม่ ชุด B แสดงว่าผู้สืบได้หยุด p50 3–6 การ์ด p50 5–7 ต่ำกว่าเป้าเพราะชีวิตสั้นกว่า
- ผู้เล่นจำลองในชุด C (play-check) ไม่เลือกคำปฏิญาณและไม่ใช้พลัง จึงไม่มีค่าของสองเรื่องนี้ในเกมจริง ชุด A ครอบทั้งสองบนแกนเดียวกับเกม แต่ไม่ผ่านหน้าจอ
- `chest.pick` และ `decree` นับ 0 ในผู้จำลอง: ไม่มีรายการในบันทึกเกมสำหรับสองอย่างนี้ ในเกมจริงบันทึกนับจากคำสั่ง ไม่ใช่ log

---

# ตารางดิบ

ทุกตารางเขียนโดย `m8-report.ts` ตารางชุด A ถึง C ตามลำดับ


<!-- ชุด A -->
## M8 baseline: simulated players, 25 seeds, director off/on (fake LLM)

450 lives from 1 source(s).

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): lives read

| group | lives | ended | arm on | arm off | no arm | director switched by hand | LLM server |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| ปั้นนิสัย | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| ลงโทษ | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| สุ่ม | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| เก็บพลัง | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| เงียบ | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| เมตตา | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| เร่งจบ | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| ให้ของ | 50 | 50 | 25 | 25 | 0 | 0 | 25 |
| all | 450 | 450 | 225 | 225 | 0 | 0 | 225 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): vows (all groups)

_lives with no vow choice recorded: 0 · target (08-goals.md §8): kept 40-90% when chosen on purpose, at most 25% when random_

| vow | offered | chosen | kept | broken | kept of chosen |
| --- | --- | --- | --- | --- | --- |
| GV-01 | 126 | 60 | 50 | 10 | 83% |
| GV-02 | 234 | 24 | 12 | 12 | 50% |
| GV-03 | 216 | 24 | 0 | 24 | 0% |
| GV-04 | 234 | 16 | 0 | 16 | 0% |
| GV-05 | 144 | 6 | 4 | 2 | 67% |
| GV-06 | 234 | 44 | 28 | 16 | 64% |
| GV-07 | 162 | 38 | 0 | 38 | 0% |
| GV-08 | 144 | 0 | 0 | 0 | - |
| GV-09 | 162 | 20 | 14 | 6 | 70% |
| GV-10 | 126 | 32 | 8 | 24 | 25% |
| GV-11 | 144 | 34 | 19 | 15 | 56% |
| GV-12 | 288 | 100 | 33 | 67 | 33% |
| GV-13 | 0 | 0 | 0 | 0 | - |
| GV-14 | 0 | 0 | 0 | 0 | - |
| GV-15 | 0 | 0 | 0 | 0 | - |
| GV-16 | 0 | 0 | 0 | 0 | - |
| GV-17 | 0 | 0 | 0 | 0 | - |
| GV-18 | 0 | 0 | 0 | 0 | - |
| GV-19 | 0 | 0 | 0 | 0 | - |
| GV-20 | 0 | 52 | - | - | - |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): vows by group

| group | lives | chose a vow | kept | broken | kept of chosen | top vows chosen |
| --- | --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | 50 | 10 | 40 | 20% | GV-07×12 GV-12×10 GV-01×6 GV-10×6 |
| ปั้นนิสัย | 50 | 50 | 23 | 27 | 46% | GV-12×8 GV-01×8 GV-11×8 GV-10×6 |
| ลงโทษ | 50 | 50 | 11 | 39 | 22% | GV-07×12 GV-12×10 GV-01×6 GV-10×6 |
| สุ่ม | 50 | 38 | 8 | 30 | 21% | GV-12×8 GV-03×4 GV-04×4 GV-09×4 |
| เก็บพลัง | 50 | 30 | 8 | 22 | 27% | GV-12×22 GV-01×4 GV-02×4 |
| เงียบ | 50 | 30 | 30 | 0 | 100% | GV-12×22 GV-01×8 |
| เมตตา | 50 | 50 | 28 | 22 | 56% | GV-06×12 GV-01×10 GV-11×8 GV-02×6 |
| เร่งจบ | 50 | 50 | 25 | 25 | 50% | GV-09×12 GV-12×10 GV-06×6 GV-01×6 |
| ให้ของ | 50 | 50 | 25 | 25 | 50% | GV-06×12 GV-01×10 GV-11×8 GV-12×6 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): ally crisis (bonds/04 stage 3)

_a crisis is every stage-3 event of a tie the life takes part in; the target of the card share is bonds/ CRISIS_CARD (07-attention.md §2: about 1.5 cards a life)_

| group | lives | crises per life | reached a card | calls with a crisis card | cards answered (by the character) | ... moved by the player (whisper/dream) | cards that ran out | share that became a card |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | 3.36 | 77 | 58 | 75 | 0 | 19 | 46% |
| ปั้นนิสัย | 50 | 4.02 | 92 | 75 | 90 | 27 | 17 | 46% |
| ลงโทษ | 50 | 3.44 | 79 | 60 | 77 | 0 | 19 | 46% |
| สุ่ม | 50 | 3.66 | 86 | 59 | 86 | 0 | 27 | 47% |
| เก็บพลัง | 50 | 4.1 | 90 | 69 | 86 | 0 | 21 | 44% |
| เงียบ | 50 | 3.52 | 83 | 62 | 83 | 0 | 21 | 47% |
| เมตตา | 50 | 3.58 | 82 | 65 | 82 | 27 | 17 | 46% |
| เร่งจบ | 50 | 3.48 | 79 | 64 | 77 | 0 | 15 | 45% |
| ให้ของ | 50 | 4.08 | 94 | 67 | 94 | 0 | 27 | 46% |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): director callbacks per life by arm (llm/04-story.md §3.5)

_callback = a node whose chosen way names someone or something the life already met (NPC again, event, turning point); "settled" counts the involved endings of ally stories, the nearest thing the log holds to open threads settled_

| arm (llm_director) | lives | story nodes | forks with a callback way | callbacks (way chosen ties back) | callbacks per node | bond stories settled (involved) | LLM points decided | LLM picks used | picks: old face / dream / question+vow / rest+tension |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| off | 225 | 32.06 | 1.8 | 0.72 | 2% | 3.87 | 0 | 0 | 0 / 0 / 0 / 0 |
| on | 225 | 32.23 | 1.82 | 0.78 | 2% | 3.79 | 4.98 | 4.98 | 4.94 / 0 / 0.04 / 0 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): A/B lift

_the player-preference half of the A/B ("which life felt more like one story", target 60%) is asked of the tester in person, not recorded_

| measure | off | on | lift | target |
| --- | --- | --- | --- | --- |
| callbacks per life | 0.72 | 0.78 | 9% | +15% at least (04-story.md §3.5, real players) |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): stops and cards per life

_targets (07-attention.md §5, normal setting): stops p50 6-10, cards p50 12-22, cards that ran out at most 3_

| group | lives | stops p50 | stops mean | cards p50 | cards mean | cards that ran out (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | 7 | 7.1 | 7 | 8.26 | 1.18 |
| ปั้นนิสัย | 50 | 7 | 7.04 | 12 | 11.8 | 1.12 |
| ลงโทษ | 50 | 7 | 6.96 | 8 | 7.98 | 1.36 |
| สุ่ม | 50 | 7.5 | 7.16 | 12 | 13.18 | 1.2 |
| เก็บพลัง | 50 | 7 | 7 | 11 | 11.2 | 1.12 |
| เงียบ | 50 | 7 | 7.12 | 15 | 15.3 | 1.42 |
| เมตตา | 50 | 7 | 6.94 | 12 | 11.76 | 1.36 |
| เร่งจบ | 50 | 7 | 6.98 | 8 | 8.5 | 1.5 |
| ให้ของ | 50 | 7 | 7.08 | 11.5 | 11.66 | 1.28 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): calls by kind

| call/why | count | per life |
| --- | --- | --- |
| card/prayer | 2443 | 5.43 |
| stop/age | 1519 | 3.38 |
| card/omen | 1247 | 2.77 |
| stop/window | 1182 | 2.63 |
| card/battle | 784 | 1.74 |
| card/crisis | 506 | 1.12 |
| stop/nearDeath | 385 | 0.86 |
| stop/death | 65 | 0.14 |
| stop/majorOmen | 18 | 0.04 |
| card/majorOmen | 2 | 0 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): time per life

_wall time includes pauses and the time between a life ending and the tester going on; target 25-45 minutes at normal speed (experience/01-one-life.md)_

| group | lives | wall minutes p50 | wall minutes mean | minutes at normal speed (age x SEC_PER_YEAR) p50 | age at death p50 |
| --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | - | - | 34.53 | 74 |
| ปั้นนิสัย | 50 | - | - | 34.53 | 74 |
| ลงโทษ | 50 | - | - | 34.53 | 74 |
| สุ่ม | 50 | - | - | 34.53 | 74 |
| เก็บพลัง | 50 | - | - | 34.53 | 74 |
| เงียบ | 50 | - | - | 34.53 | 74 |
| เมตตา | 50 | - | - | 34.53 | 74 |
| เร่งจบ | 50 | - | - | 34.53 | 74 |
| ให้ของ | 50 | - | - | 34.53 | 74 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): interventions per life

_confirmed commands only (a preview is not counted); GV-12 asks for at most 5 in a life_

| group | lives | total mean | total p50 | chest.pick | dream.send | whisper | prayer.answer | miracle | decree | conjure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ตีหมุด | 50 | 8.72 | 9 | 0 | 0 | 0 | 6.36 | 2.36 | 0 | 0 |
| ปั้นนิสัย | 50 | 34.26 | 34 | 0 | 12.52 | 8.34 | 11.44 | 0 | 0 | 1.96 |
| ลงโทษ | 50 | 6.56 | 7 | 0 | 0 | 0 | 5.56 | 1 | 0 | 0 |
| สุ่ม | 50 | 20.56 | 21 | 0 | 6.32 | 6.26 | 6.9 | 0.44 | 0 | 0.64 |
| เก็บพลัง | 50 | 20.18 | 20.5 | 0 | 0 | 0 | 11.14 | 7.2 | 0 | 1.84 |
| เงียบ | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| เมตตา | 50 | 38.5 | 40 | 0 | 12.16 | 7.42 | 10.78 | 7.14 | 0 | 1 |
| เร่งจบ | 50 | 12.64 | 13 | 0 | 0 | 0 | 7.34 | 4.38 | 0 | 0.92 |
| ให้ของ | 50 | 12.7 | 12 | 0 | 0 | 0 | 11.74 | 0 | 0 | 0.96 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): endings

| cause of death | lives |
| --- | --- |
| old | 346 |
| accident | 49 |
| illness | 30 |
| ตายในศึก | 25 |

### M8 baseline: simulated players, 25 seeds, director off/on (fake LLM): ending titles (top 12)

| title | lives |
| --- | --- |
| ผู้ที่ไม่ต้องอยู่คนเดียว | 93 |
| ผู้รวมเผ่า | 52 |
| คนจากบ้านที่หายไป | 34 |
| ครูข้ามเผ่า | 20 |
| ทหารผ่านศึกต่างแดน | 20 |
| ผู้นำการอพยพ | 18 |
| ผู้อ่านชื่อ | 18 |
| รูปปั้นออบซิเดียน | 17 |
| ผู้หยุดการขุด | 16 |
| (no title) | 16 |
| ผู้ปลูกกล้า | 14 |
| ต้นไม้ที่ยืนข้างต้นไม้โลก | 13 |



<!-- ชุด B -->
## M8 baseline: lineages of 4 lives, 10 seeds

111 lives from 1 source(s).

### M8 baseline: lineages of 4 lives, 10 seeds: lives read

| group | lives | ended | arm on | arm off | no arm | director switched by hand | LLM server |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | 32 | 0 | 0 | 32 | 0 | 0 |
| ลงโทษ | 25 | 25 | 0 | 0 | 25 | 0 | 0 |
| สุ่ม | 21 | 21 | 0 | 0 | 21 | 0 | 0 |
| เมตตา | 33 | 33 | 0 | 0 | 33 | 0 | 0 |
| all | 111 | 111 | 0 | 0 | 111 | 0 | 0 |

### M8 baseline: lineages of 4 lives, 10 seeds: vows (all groups)

_lives with no vow choice recorded: 70 · target (08-goals.md §8): kept 40-90% when chosen on purpose, at most 25% when random_

| vow | offered | chosen | kept | broken | kept of chosen |
| --- | --- | --- | --- | --- | --- |
| GV-01 | 8 | 5 | 5 | 0 | 100% |
| GV-02 | 20 | 1 | 1 | 0 | 100% |
| GV-03 | 24 | 8 | 0 | 8 | 0% |
| GV-04 | 29 | 1 | 0 | 1 | 0% |
| GV-05 | 12 | 2 | 1 | 1 | 50% |
| GV-06 | 17 | 5 | 4 | 1 | 80% |
| GV-07 | 12 | 4 | 0 | 4 | 0% |
| GV-08 | 9 | 1 | 0 | 1 | 0% |
| GV-09 | 20 | 2 | 1 | 1 | 50% |
| GV-10 | 8 | 1 | 0 | 1 | 0% |
| GV-11 | 4 | 0 | 0 | 0 | - |
| GV-12 | 24 | 8 | 0 | 8 | 0% |
| GV-13 | 0 | 0 | 0 | 0 | - |
| GV-14 | 0 | 0 | 0 | 0 | - |
| GV-15 | 1 | 0 | 0 | 0 | - |
| GV-16 | 1 | 0 | 0 | 0 | - |
| GV-17 | 0 | 0 | 0 | 0 | - |
| GV-18 | 0 | 0 | 0 | 0 | - |
| GV-19 | 1 | 0 | 0 | 0 | - |
| GV-20 | 0 | 3 | - | - | - |

### M8 baseline: lineages of 4 lives, 10 seeds: vows by group

| group | lives | chose a vow | kept | broken | kept of chosen | top vows chosen |
| --- | --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | 10 | 3 | 7 | 30% | GV-12×3 GV-03×2 GV-06×1 GV-05×1 |
| ลงโทษ | 25 | 10 | 3 | 7 | 30% | GV-01×2 GV-03×2 GV-07×2 GV-12×2 |
| สุ่ม | 21 | 7 | 1 | 6 | 14% | GV-03×2 GV-06×1 GV-05×1 GV-04×1 |
| เมตตา | 33 | 11 | 5 | 6 | 45% | GV-06×2 GV-01×2 GV-03×2 GV-12×2 |

### M8 baseline: lineages of 4 lives, 10 seeds: ally crisis (bonds/04 stage 3)

_a crisis is every stage-3 event of a tie the life takes part in; the target of the card share is bonds/ CRISIS_CARD (07-attention.md §2: about 1.5 cards a life)_

| group | lives | crises per life | reached a card | calls with a crisis card | cards answered (by the character) | ... moved by the player (whisper/dream) | cards that ran out | share that became a card |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | 2.38 | 31 | 25 | 30 | 14 | 6 | 41% |
| ลงโทษ | 25 | 2.16 | 23 | 19 | 23 | 0 | 4 | 43% |
| สุ่ม | 21 | 2.52 | 20 | 15 | 20 | 0 | 5 | 38% |
| เมตตา | 33 | 2.18 | 29 | 23 | 29 | 17 | 6 | 40% |

### M8 baseline: lineages of 4 lives, 10 seeds: director callbacks per life by arm (llm/04-story.md §3.5)

_callback = a node whose chosen way names someone or something the life already met (NPC again, event, turning point); "settled" counts the involved endings of ally stories, the nearest thing the log holds to open threads settled_

| arm (llm_director) | lives | story nodes | forks with a callback way | callbacks (way chosen ties back) | callbacks per node | bond stories settled (involved) | LLM points decided | LLM picks used | picks: old face / dream / question+vow / rest+tension |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | 111 | 19.66 | 1.04 | 0.59 | 3% | 2.06 | 0 | 0 | 0 / 0 / 0 / 0 |

### M8 baseline: lineages of 4 lives, 10 seeds: stops and cards per life

_targets (07-attention.md §5, normal setting): stops p50 6-10, cards p50 12-22, cards that ran out at most 3_

| group | lives | stops p50 | stops mean | cards p50 | cards mean | cards that ran out (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | 4 | 4.78 | 5 | 5.91 | 0.91 |
| ลงโทษ | 25 | 5 | 5.04 | 5 | 4.92 | 1.12 |
| สุ่ม | 21 | 6 | 5.38 | 7 | 7.81 | 0.81 |
| เมตตา | 33 | 3 | 4.42 | 5 | 5.55 | 0.91 |

### M8 baseline: lineages of 4 lives, 10 seeds: calls by kind

| call/why | count | per life |
| --- | --- | --- |
| card/prayer | 302 | 2.72 |
| stop/window | 257 | 2.32 |
| card/omen | 218 | 1.96 |
| stop/age | 168 | 1.51 |
| stop/nearDeath | 100 | 0.9 |
| card/crisis | 71 | 0.64 |
| card/battle | 68 | 0.61 |
| stop/death | 11 | 0.1 |
| stop/majorOmen | 2 | 0.02 |

### M8 baseline: lineages of 4 lives, 10 seeds: time per life

_wall time includes pauses and the time between a life ending and the tester going on; target 25-45 minutes at normal speed (experience/01-one-life.md)_

| group | lives | wall minutes p50 | wall minutes mean | minutes at normal speed (age x SEC_PER_YEAR) p50 | age at death p50 |
| --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | - | - | 34.53 | 74 |
| ลงโทษ | 25 | - | - | 34.53 | 74 |
| สุ่ม | 21 | - | - | 34.53 | 74 |
| เมตตา | 33 | - | - | 34.53 | 74 |

### M8 baseline: lineages of 4 lives, 10 seeds: interventions per life

_confirmed commands only (a preview is not counted); GV-12 asks for at most 5 in a life_

| group | lives | total mean | total p50 | chest.pick | dream.send | whisper | prayer.answer | miracle | decree | conjure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ปั้นนิสัย | 32 | 20.97 | 17.5 | 0 | 9.44 | 4.59 | 5.28 | 0 | 0 | 1.66 |
| ลงโทษ | 25 | 4.08 | 5 | 0 | 0 | 0 | 3.52 | 0.56 | 0 | 0 |
| สุ่ม | 21 | 15 | 13 | 0 | 5.33 | 4.81 | 4.24 | 0.33 | 0 | 0.29 |
| เมตตา | 33 | 24.42 | 19 | 0 | 8.61 | 4.64 | 5.18 | 5.09 | 0 | 0.91 |

### M8 baseline: lineages of 4 lives, 10 seeds: endings

| cause of death | lives |
| --- | --- |
| old | 94 |
| accident | 14 |
| illness | 2 |
| ตายในศึก | 1 |

### M8 baseline: lineages of 4 lives, 10 seeds: ending titles (top 12)

| title | lives |
| --- | --- |
| ผู้ที่ไม่ต้องอยู่คนเดียว | 23 |
| ผู้ปิดสมุดตระกูล | 22 |
| (no title) | 18 |
| ช่างผู้ฆ่ามังกรทางอ้อม | 7 |
| รูปปั้นออบซิเดียน | 6 |
| ผู้หยุดการขุด | 5 |
| ผู้ถือเตาเย็น | 5 |
| แม่ทัพจักรวรรดิ | 4 |
| ผู้รวมเผ่า | 4 |
| ผู้นำการอพยพ | 4 |
| คนจากบ้านที่หายไป | 4 |
| ภูตที่ปลดสัญญา | 2 |



<!-- ชุด C -->
## M8 baseline: three full lives in the real game (play-check, no LLM server)

3 lives from 1 source(s).

### M8 baseline: three full lives in the real game (play-check, no LLM server): lives read

| group | lives | ended | arm on | arm off | no arm | director switched by hand | LLM server |
| --- | --- | --- | --- | --- | --- | --- | --- |
| player | 3 | 3 | 1 | 2 | 0 | 0 | 0 |
| all | 3 | 3 | 1 | 2 | 0 | 0 | 0 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): vows (all groups)

_lives with no vow choice recorded: 3 · target (08-goals.md §8): kept 40-90% when chosen on purpose, at most 25% when random_

| vow | offered | chosen | kept | broken | kept of chosen |
| --- | --- | --- | --- | --- | --- |
| GV-01 | 2 | 0 | 0 | 0 | - |
| GV-02 | 1 | 0 | 0 | 0 | - |
| GV-03 | 0 | 0 | 0 | 0 | - |
| GV-04 | 0 | 0 | 0 | 0 | - |
| GV-05 | 1 | 0 | 0 | 0 | - |
| GV-06 | 1 | 0 | 0 | 0 | - |
| GV-07 | 1 | 0 | 0 | 0 | - |
| GV-08 | 1 | 0 | 0 | 0 | - |
| GV-09 | 2 | 0 | 0 | 0 | - |
| GV-10 | 2 | 0 | 0 | 0 | - |
| GV-11 | 1 | 0 | 0 | 0 | - |
| GV-12 | 3 | 0 | 0 | 0 | - |
| GV-13 | 0 | 0 | 0 | 0 | - |
| GV-14 | 0 | 0 | 0 | 0 | - |
| GV-15 | 0 | 0 | 0 | 0 | - |
| GV-16 | 0 | 0 | 0 | 0 | - |
| GV-17 | 0 | 0 | 0 | 0 | - |
| GV-18 | 0 | 0 | 0 | 0 | - |
| GV-19 | 0 | 0 | 0 | 0 | - |
| GV-20 | 0 | 0 | - | - | - |

### M8 baseline: three full lives in the real game (play-check, no LLM server): vows by group

| group | lives | chose a vow | kept | broken | kept of chosen | top vows chosen |
| --- | --- | --- | --- | --- | --- | --- |
| player | 3 | 0 | 0 | 0 | - |  |

### M8 baseline: three full lives in the real game (play-check, no LLM server): ally crisis (bonds/04 stage 3)

_a crisis is every stage-3 event of a tie the life takes part in; the target of the card share is bonds/ CRISIS_CARD (07-attention.md §2: about 1.5 cards a life)_

| group | lives | crises per life | reached a card | calls with a crisis card | cards answered (by the character) | ... moved by the player (whisper/dream) | cards that ran out | share that became a card |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| player | 3 | 4 | 8 | 5 | 8 | 0 | 3 | 67% |

### M8 baseline: three full lives in the real game (play-check, no LLM server): director callbacks per life by arm (llm/04-story.md §3.5)

_callback = a node whose chosen way names someone or something the life already met (NPC again, event, turning point); "settled" counts the involved endings of ally stories, the nearest thing the log holds to open threads settled_

| arm (llm_director) | lives | story nodes | forks with a callback way | callbacks (way chosen ties back) | callbacks per node | bond stories settled (involved) | LLM points decided | LLM picks used | picks: old face / dream / question+vow / rest+tension |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| off | 2 | 32.5 | 1 | 0.5 | 2% | 3 | 0 | 0 | 0 / 0 / 0 / 0 |
| on | 1 | 29 | 2 | 1 | 3% | 4 | 0 | 0 | 0 / 0 / 0 / 0 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): A/B lift

_the player-preference half of the A/B ("which life felt more like one story", target 60%) is asked of the tester in person, not recorded_

| measure | off | on | lift | target |
| --- | --- | --- | --- | --- |
| callbacks per life | 0.5 | 1 | 100% | +15% at least (04-story.md §3.5, real players) |

### M8 baseline: three full lives in the real game (play-check, no LLM server): stops and cards per life

_targets (07-attention.md §5, normal setting): stops p50 6-10, cards p50 12-22, cards that ran out at most 3_

| group | lives | stops p50 | stops mean | cards p50 | cards mean | cards that ran out (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| player | 3 | 8 | 8 | 16 | 15 | 1.67 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): calls by kind

| call/why | count | per life |
| --- | --- | --- |
| card/prayer | 34 | 11.33 |
| stop/window | 12 | 4 |
| stop/age | 9 | 3 |
| card/crisis | 4 | 1.33 |
| card/battle | 4 | 1.33 |
| card/omen | 3 | 1 |
| stop/nearDeath | 3 | 1 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): time per life

_wall time includes pauses and the time between a life ending and the tester going on; target 25-45 minutes at normal speed (experience/01-one-life.md)_

| group | lives | wall minutes p50 | wall minutes mean | minutes at normal speed (age x SEC_PER_YEAR) p50 | age at death p50 |
| --- | --- | --- | --- | --- | --- |
| player | 3 | 20.19 | 20.77 | 34.53 | 74 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): interventions per life

_confirmed commands only (a preview is not counted); GV-12 asks for at most 5 in a life_

| group | lives | total mean | total p50 | chest.pick | dream.send | whisper | prayer.answer | miracle | decree | conjure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| player | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): how the tester ran the game

| measure | value |
| --- | --- |
| lives | 3 |
| pauses by the player per life | 0 |
| speed changes by the player per life | 9 |
| setting changes by the player per life (attention, LLM, cards) | 0 |
| stops held, seconds (p50 / max) | 1.43 / 1.8 |
| refused commands per life | 0 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): endings

| cause of death | lives |
| --- | --- |
| old | 2 |
| illness | 1 |

### M8 baseline: three full lives in the real game (play-check, no LLM server): ending titles (top 12)

| title | lives |
| --- | --- |
| ผู้ที่ไม่ต้องอยู่คนเดียว | 2 |
| ผู้รวมเผ่า | 1 |


