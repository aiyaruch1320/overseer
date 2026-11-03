// The words of saving and loading (labels of the interface, not text of the game; code-plan §8.1 rule 2).
export const SAVE_WORDS = {
  saved: (age: number | null) => (age === null ? 'บันทึกแล้ว' : `บันทึกแล้ว · อายุ ${age}`),
  failed: 'บันทึกไม่ได้',
  full: 'พื้นที่เก็บข้อมูลของเกมนี้ในเบราว์เซอร์เต็ม (เซฟเดิมยังอยู่)',
  blocked: 'เบราว์เซอร์ไม่ให้เก็บข้อมูลของหน้านี้ (โหมดส่วนตัวหรือปิดการเก็บข้อมูล)',
  nothing: 'ยังไม่มีเกมให้บันทึก',
  /** The button of the start screen. */
  resume: 'เล่นต่อจากที่บันทึก',
  resumeNote: (age: number | null, at: string) => `${age === null ? 'ชีวิตที่บันทึกไว้' : `ชีวิตอายุ ${age}`} · ${at}`,
  loading: 'กำลังเปิดเซฟ…',
  unreadable: 'เปิดเซฟไม่ได้: ข้อมูลเสียหรือมาจากเกมรุ่นที่ต่างกันมาก',
  noUnpack: 'เปิดเซฟไม่ได้: เบราว์เซอร์นี้แกะข้อมูลที่บีบไว้ไม่ได้',
  /** The notice after loading a save whose data files moved since (code-plan §5.3: it opens, but a replay may not match). */
  stale: (files: string[]) => `เซฟนี้บันทึกด้วยข้อมูลเกมรุ่นเก่า (${files.join(' · ')}) เล่นต่อได้ แต่การเล่นซ้ำอาจไม่ตรงกับที่เคยเห็น`,
  dismiss: 'รับทราบ',
} as const;
