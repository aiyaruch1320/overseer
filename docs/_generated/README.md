# ไฟล์ที่สร้างอัตโนมัติ

ภาพรวม: [../README.md](../README.md)

**อย่าแก้ไฟล์ในโฟลเดอร์นี้ด้วยมือ** แก้ที่ต้นทางแล้วรันคำสั่งสร้างใหม่ ไฟล์ที่แก้มือจะถูกเขียนทับ

| ไฟล์ | สร้างจาก | คำสั่ง |
| --- | --- | --- |
| [manifest.json](manifest.json) | ทุกไฟล์ใน `docs/` | `node scripts/build-docs-manifest.mjs` |
| [npc-map.html](npc-map.html) | [../lore/npcs/](../lore/npcs/README.md) และเหตุการณ์ | `node scripts/build-npc-map.mjs` |
| [story-map.html](story-map.html) | [../systems/events/](../systems/events/README.md) และเส้นเรื่อง | `node scripts/build-story-map.mjs` |
| [item-catalog.md](item-catalog.md) | [../systems/items/](../systems/items/README.md) ไฟล์ 12 ถึง 18 และราคาตาม [19-prices.md](../systems/items/19-prices.md) | `node scripts/build-item-catalog.mjs` |
| [weapon-catalog.md](weapon-catalog.md) | [../systems/items/](../systems/items/README.md) ไฟล์ 01 ถึง 08 และวัสดุ | `node scripts/build-weapon-catalog.mjs` |
| [character-catalog/](character-catalog/) | ข้อมูลในโค้ดเกม (`src/`) | `npx tsx scripts/export-character-catalog.ts` |
| [poc-visuals/](poc-visuals/) | ธีมภาพและ NPC พิเศษในโค้ด (`src/render/`, `src/data/`) | `npm run docs:visuals` |

ข้อมูลที่สร้างเข้าโค้ด (ไม่ได้อยู่ในโฟลเดอร์นี้) มีสามสคริปต์ `scripts/gen-countries.ts` `scripts/gen-npc-cast.ts` `scripts/gen-birth.ts` อ่านจาก [../lore/countries/](../lore/countries/README.md) [../lore/npcs/](../lore/npcs/README.md) และ [../systems/character/01-origin.md](../systems/character/01-origin.md) แล้วเขียน `src/data/`

ตัวตรวจ `node scripts/check-docs.mjs` อ่านแคตตาล็อกอาวุธในโฟลเดอร์นี้เพื่อตรวจงบของรุ่นวัสดุ
