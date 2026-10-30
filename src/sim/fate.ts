// The great events of docs/world/world-events.md §15 that change a continent's shape: what the land becomes, and how each look is drawn
// (town palette and ruins in src/city/themes.ts + paint.ts, the tint on the world map in src/render/terrain). The sim sets `Country.fate`
// (a country with the `fallen` flag counts as fallen); everything that draws reads it, so a story event only has to call `setFate`.
import type { Country, Fate } from './types';

export interface FateInfo { name: string; event: string; continent: number | null; from: string; to: string; tint: string; summary: string }
export const FATES: Record<Fate, FateInfo> = {
  skyfall: { name: 'สกายฟอลล์', event: 'DR-01 ฟ้าถล่ม', continent: 0, from: 'อัซการ์', to: 'สกายฟอลล์', tint: 'rgba(120,112,104,0.42)', summary: 'ศิลาลอยดับ เกาะร่วงลงมาเป็นซาก เมืองแตกเป็นเศษบนพื้นดิน' },
  ash: { name: 'ทวีปเถ้า', event: 'DR-04 ฤดูหนาวเถ้า', continent: 2, from: 'คาซ-ดูรัม', to: 'ทวีปเถ้า', tint: 'rgba(206,206,214,0.46)', summary: 'เพลิงนิรันดร์สิ้น ภูเขาไฟดับ เถ้าสีเทาปกคลุม เตาหลอมเย็นชืด' },
  flood: { name: 'ทุ่งจม', event: 'DR-05 มหาน้ำขึ้น', continent: null, from: 'ชายฝั่ง', to: 'ทุ่งจม', tint: 'rgba(60,120,190,0.36)', summary: 'น้ำไม่ลด เมืองชายฝั่งท่วม ผู้คนอยู่บนหลังคาและเรือ' },
  split: { name: 'ทุ่งแยก', event: 'DR-07 แผ่นดินแยก', continent: 4, from: 'อัลเดรีย', to: 'ทุ่งแยก', tint: 'rgba(110,70,50,0.38)', summary: 'รอยแยกผ่ากลางเมือง ถนนขาด อาคารเอียง ฝุ่นลอย' },
  withered: { name: 'ป่าเหี่ยว', event: 'BIO-02 ต้นไม้โลกตาย', continent: 7, from: 'ซิลวาเนล', to: 'ป่าเหี่ยว', tint: 'rgba(170,140,50,0.4)', summary: 'ใบไม้เหลืองร่วงทั้งทวีป บ้านต้นไม้โกร๋น แสงเรืองดับ' },
  rust: { name: 'ดินแดนสนิม', event: 'MC-04 จักรกลล้ม', continent: 5, from: 'เมคาเรีย', to: 'ดินแดนสนิม', tint: 'rgba(150,80,40,0.42)', summary: 'ไฟฟ้าดับ เครื่องจักรหยุด ปล่องไม่มีควัน เหล็กขึ้นสนิมทั้งเมือง' },
  light: { name: 'ทวีปแสง', event: 'BIO-05 หมอกกลายเป็นแสง', continent: 8, from: 'เนบูเลีย', to: 'ทวีปแสง', tint: 'rgba(255,240,170,0.34)', summary: 'หมอกสลายเป็นแสงสีทอง บ้านและหอระฆังเรืองแสง ไม่มีกลางคืน' },
  fog: { name: 'ดินแดนหมอกกลืน', event: 'FG-11 หมอกกินทวีป', continent: 8, from: 'เนบูเลีย', to: 'ดินแดนหมอกกลืน', tint: 'rgba(60,40,90,0.5)', summary: 'หมอกทึบม้วนเข้าเมือง ประตูหน้าต่างปิดตาย โคมดับ เมืองร้างในหมอก' },
  fallen: { name: 'ล่มสลาย', event: 'ประเทศล่มสลาย', continent: null, from: '', to: 'ซากเมือง', tint: 'rgba(70,60,56,0.42)', summary: 'ประเทศล่มสลาย เมืองกลายเป็นซาก ไฟไหม้ กำแพงพัง' },
};

/** the fate shown for a country: its own, or `fallen` when the sim flagged it so */
export const fateOf = (c: Pick<Country, 'fate' | 'flags'>): Fate | undefined => c.fate ?? (c.flags.includes('fallen') ? 'fallen' : undefined);

/** apply (or clear, with null) a fate to every country of a continent, or to the listed countries */
export function setFate(countries: Country[], scope: { continent?: number; ids?: number[] }, fate: Fate | null) {
  for (const c of countries) {
    if ((scope.continent !== undefined && c.continent === scope.continent) || scope.ids?.includes(c.id)) { if (fate) c.fate = fate; else delete c.fate; }
  }
}
