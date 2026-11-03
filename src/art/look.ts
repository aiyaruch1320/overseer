// The Look a figure is painted from (code-plan §9.2): every value comes from the docs (the UI values of the race, the NPC, the enemy) or from
// the life of the main character, never from chance at paint time. The painter turns the same Look into the same pixels.

export type Stage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';
/** Ears of the race (docs/appearance/README.md "หูของเผ่า"): กลม ยาว แหลม สัตว์ ครีบ ไม่มี. */
export type Ears = 'round' | 'long' | 'pointed' | 'animal' | 'fin' | 'none';
/** The lower body (ท่อนล่าง): สองขา หางงู ชายผ้า ก้อนเจล. */
export type Lower = 'legs' | 'serpent' | 'gown' | 'blob';
/** The walk (ท่าเดิน): ปกติ หนัก ลื่น กระโดด ลากเท้า ลอย. */
export type Gait = 'normal' | 'heavy' | 'glide' | 'hop' | 'shuffle' | 'float';

export interface Body {
  /** height as a multiple of a human (ขนาด) */
  scale: number;
  /** head size as a multiple of a human's (หัว) */
  head: number;
  /** shoulder width as a multiple of a human's (ไหล่) */
  shoulders: number;
  ears: Ears;
  lower: Lower;
  gait: Gait;
}

export interface PersonLook {
  kind: 'person';
  /** what makes two looks the same picture (an NPC id, or the fields of a person made from a birth) */
  key: string;
  race: string;
  /** the sub-line (สายเลือดย่อย) as the docs write it, when it shows */
  line?: string;
  stage: Stage;
  fem: boolean;
  body: Body;
  skin: string;
  hairColor: string;
  eye: string;
  /** the race's or the person's signature colour: trim, jewellery, glows */
  accent: string;
  /** the clothes: main and second colour (สี #หลัก #รอง) */
  main: string;
  second: string;
  /** part ids of src/art/parts ('' = none) */
  outfit: string;
  hair: string;
  hat: string;
  beard: string;
  tool: string;
  /** painter features of the race (ลักษณะที่วาดเพิ่ม) and of the person (scar, halo, …) */
  feats: string[];
  /** how worn the clothes are, 0..1 */
  wear: number;
}

/** Height of each life stage as a share of the adult (21-pixel-art.md §2). */
export const STAGE_SCALE: Record<Stage, number> = { infant: 0.45, child: 0.65, teen: 0.88, adult: 1, elder: 0.95 };

/** The life stage of an age counted in human years (02-races.md: ทารก 0–3 เด็ก 4–12 วัยรุ่น 13–19 ผู้ใหญ่ 20–54 ผู้เฒ่า 55 ขึ้นไป). */
export function stageOf(hAge: number): Stage {
  return hAge < 4 ? 'infant' : hAge < 13 ? 'child' : hAge < 20 ? 'teen' : hAge < 55 ? 'adult' : 'elder';
}

export const HUMAN_BODY: Body = { scale: 1, head: 1, shoulders: 1, ears: 'round', lower: 'legs', gait: 'normal' };

/** A stable short key of a look (the fields, not the object): sheets and textures are cached by it. */
export function lookKey(L: PersonLook): string {
  const s = JSON.stringify([L.race, L.line, L.stage, L.fem, L.body, L.skin, L.hairColor, L.eye, L.accent, L.main, L.second, L.outfit, L.hair, L.hat, L.beard, L.tool, L.feats, L.wear]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${L.key}~${(h >>> 0).toString(36)}`;
}
