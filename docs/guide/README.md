# คู่มือการดูแลเอกสาร

ภาพรวม: [../README.md](../README.md)

| ไฟล์ | ใช้เมื่อ |
| --- | --- |
| [organization.md](organization.md) | จะวางข้อมูลใหม่ตรงไหน จะรวมหรือแยกไฟล์ แบบฟอร์มของแต่ละชนิดไฟล์ |
| [id-glossary.md](id-glossary.md) | เจอรหัสที่ไม่รู้จัก |
| [story-seeds.md](story-seeds.md) | เนื้อหามาจากสามระดับ (สคริปต์ Claude เจ้าของโลก) และวิธีให้เมล็ดเรื่องเพื่อให้ Claude ขยาย |
| [consistency-checks.md](consistency-checks.md) | บันทึกความขัดแย้งระหว่างเอกสารและวิธีแก้ |
| [semantic-audit.md](semantic-audit.md) | ตรวจเชิงความหมายของทั้งโลก: หลักของเกมที่ใช้ตัดสิน รายการตรวจ การแบ่งผู้อ่าน กติกาการแก้ |
| [code-plan.md](code-plan.md) | แผนลงโค้ดสำหรับ session ใหม่: ที่ตัดสินแล้ว สถาปัตยกรรม ข้อมูลจากเอกสารและไวยากรณ์ผล ระบบในแกน หน้าจอ ตัวเล่นฉาก แผนที่ ภาพตัวละคร ด่าน ขั้น M0 ถึง M8 (ระบบก่อน UI) การแบ่งงานให้ subagent รอบตรวจของผู้เล่นจำลองและผู้ตรวจภาพ |

คำสั่งตรวจ

```bash
node scripts/docs/check-docs.mjs
node scripts/docs/build-docs-manifest.mjs
```
