// The UI of the lab: screens stay DOM (Thai text is crisp and selectable, the tokens style it), icons are SVG, and a portrait is the
// pixel sprite on a small canvas inside the DOM card.
import { color, rarity } from '../../ui/tokens';
import { COLS, frameIndex, type Sheet } from './pixel';

const ICON: Record<string, string> = {
  หีบ: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 13h18M3 9a9 4 0 0 1 18 0"/><rect x="10.5" y="12" width="3" height="4"/>',
  ฝัน: '<path d="M16 4a8 8 0 1 0 4 12A6.5 6.5 0 0 1 16 4z"/>',
  กระซิบ: '<path d="M4 6h16v9H10l-4 4v-4H4z"/>',
  ปาฏิหาริย์: '<path d="M12 2l2.6 6.6L21 9.5l-5 4.4 1.5 6.6L12 17l-5.5 3.5L8 13.9l-5-4.4 6.4-.9z"/>',
  พงศาวดาร: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8"/>',
};

export async function mountUi(el: HTMLElement, sheets: Sheet[]): Promise<() => void> {
  const hero = sheets[4];
  const portrait = document.createElement('canvas');
  portrait.width = hero.fw; portrait.height = hero.fh - 4;
  const idx = frameIndex('idle', 0);
  portrait.getContext('2d')!.drawImage(hero.canvas, (idx % COLS) * hero.fw, Math.floor(idx / COLS) * hero.fh, hero.fw, hero.fh - 4, 0, 0, hero.fw, hero.fh - 4);
  portrait.style.cssText = 'width:108px;height:96px;image-rendering:pixelated;background:#c8cdd5;border-radius:4px;flex:none';
  el.insertAdjacentHTML('beforeend', `<p>หน้าจอยังเป็น DOM + CSS เหมือนตอนนี้ ไอคอนเป็น SVG ภาพเหมือนตัวละครคือสไปรต์พิกเซลบนแคนวาสเล็กในการ์ด</p>
  <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
    <div id="uicard" style="width:420px;border:2px solid ${rarity.E};border-radius:8px;background:${color.panel};padding:12px;display:flex;gap:12px"></div>
    <div style="display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid ${color.line};border-radius:8px">
      ${Object.entries(ICON).map(([k, d]) => `<button style="display:flex;gap:8px;align-items:center;background:#16171e;color:${color.text};border:1px solid ${color.line};border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color.light}" stroke-width="1.6" stroke-linejoin="round">${d}</svg>${k}</button>`).join('')}
    </div>
    <div style="width:60px;height:140px;position:relative" title="เทียนศรัทธา">
      <style>@keyframes ui-flame{0%,100%{transform:scaleY(1) skewX(0)}40%{transform:scaleY(1.12) skewX(-4deg)}70%{transform:scaleY(.94) skewX(3deg)}}</style>
      <div style="position:absolute;left:22px;bottom:0;width:16px;height:80px;background:linear-gradient(#e6e0d0,#b8ae98);border-radius:3px"></div>
      <div style="position:absolute;left:20px;bottom:78px;width:20px;height:34px;border-radius:50% 50% 45% 45%;background:radial-gradient(ellipse at 50% 70%,#fff4c8,${color.light} 45%,transparent 70%);transform-origin:50% 100%;animation:ui-flame 1.4s ease-in-out infinite;filter:blur(.4px)"></div>
    </div>
  </div>`);
  const card = el.querySelector('#uicard')!;
  card.append(portrait);
  card.insertAdjacentHTML('beforeend', `<div style="font-size:14px;line-height:1.6">
    <div style="font-size:17px;color:${color.light}">หน้าต่างพระเจ้า · อายุ 17</div>
    <div>หมาป่าตัวหนึ่งตามกลิ่นเขามาตั้งแต่ชายป่า เขาจับหอกแน่นขึ้น</div>
    <div style="color:${color.textDim};font-size:13px">ส่งพรหนึ่งอย่าง หรือปล่อยให้เป็นไปตามชะตา</div>
    <div style="display:flex;gap:8px;margin-top:8px"><button style="background:${color.light};color:${color.panel};border:0;border-radius:6px;padding:6px 12px;font:inherit">ส่งพร</button><button style="background:none;color:${color.text};border:1px solid ${color.line};border-radius:6px;padding:6px 12px;font:inherit">ปล่อยไป</button></div>
  </div>`);
  return () => {};
}
