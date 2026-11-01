# การจำลองโลก

ภาพรวมชั้นระบบ: [../README.md](../README.md)

| ไฟล์ | เนื้อหา |
| --- | --- |
| [world-sim.md](world-sim.md) | ผลจำลองโลกจากเอกสาร ใช้ปรับสมดุลเหตุการณ์ |
| [dragon-mood.md](dragon-mood.md) | ผลเมื่อมังกรตัวหนึ่งล้ม ค่าเริ่มต้นของอารมณ์และอัตราลดต่อทศวรรษ |

ตัวจำลองระบบพระเจ้า `node scripts/sim/sim-god.mjs` ใช้ตัวจำลองโลกผ่านตัวเกี่ยว `god` `godW` และ `godOpen` ผลอยู่ใน [../god/06-implementation.md](../god/06-implementation.md) หัวข้อ 4

ตัวจำลองคือ `node scripts/sim/sim-world.mjs` อ่าน [../events/world-events.md](../events/world-events.md) [../../lore/storylines/00-convergence.md](../../lore/storylines/00-convergence.md) และ [../character/races/README.md](../character/races/README.md) ตัวตนของมังกรอยู่ที่ [../../lore/dragons/README.md](../../lore/dragons/README.md)
