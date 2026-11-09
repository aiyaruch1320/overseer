// The words of the play record and the A/B in the settings panel (labels of the interface, not text of the game; code-plan §8.1 rule 2).
export const RECORD_WORDS = {
  title: 'บันทึกการเล่น (สำหรับรอบทดสอบ)',
  on: 'บันทึกการเล่นของฉัน',
  note: 'เก็บในเบราว์เซอร์นี้เท่านั้น ไม่ส่งไปไหน บันทึกว่าทำอะไรเมื่อไร (การตอบการเรียก กระซิบ ฝัน ปาฏิหาริย์ หยุด ความเร็ว ชีวิต ตอนจบ คำปฏิญาณ สวิตช์ LLM) ไม่เก็บคำที่พิมพ์',
  count: (n: number, lives: number) => `มี ${n} รายการ · ${lives} ชีวิต`,
  empty: 'ยังไม่มีรายการ',
  export: 'ส่งออกเป็นไฟล์ JSON',
  clear: 'ล้างบันทึก',
  cleared: 'ล้างแล้ว',
  exported: (name: string) => `ส่งออกแล้ว: ${name}`,
  exportFailed: 'ส่งออกไม่ได้',
  ab: 'แบ่งชีวิตเป็นสองกลุ่ม (ผู้กำกับ LLM เปิด/ปิด)',
  abModes: { off: 'ไม่แบ่ง', alternate: 'สลับทีละชีวิต', seed: 'ตามเมล็ดโลก' },
  abNote: 'มีผลกับชีวิตถัดไป (ชีวิตที่กำลังเล่นอยู่ไม่เปลี่ยน) สวิตช์ผู้กำกับจะถูกตั้งตามกลุ่มของชีวิตนั้น และบันทึกชื่อกลุ่มไว้',
  arms: { on: 'กลุ่ม: ผู้กำกับเปิด', off: 'กลุ่ม: ผู้กำกับปิด' },
} as const;
