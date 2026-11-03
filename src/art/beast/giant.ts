// Big humanoids drawn at their own size (a person painted past 1.5× would not fit its frame): the troll, the ogre, the yeti, the demons, the
// stone keepers, the orc and bear chiefs, the ghoul king, the brass soldier and the mutant with the great arm.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';

type Weapon = 'club' | 'axe' | 'hammer' | 'sword' | 'spear' | 'none';
interface Spec {
  hunch: number; belly: number; head: number; arm: number; weapon: Weapon;
  horns?: boolean; tusks?: boolean; fur?: boolean; stone?: boolean; cape?: boolean; flames?: boolean; moss?: boolean; regen?: boolean; ears?: boolean;
  loin?: boolean; brass?: boolean; gaunt?: boolean; bigArm?: boolean; sit?: boolean; shroud?: boolean; bearHead?: boolean; trim?: string;
}
const SPECS: Record<string, Spec> = {
  troll: { hunch: 1, belly: 0.5, head: 3.3, arm: 1.25, weapon: 'club', moss: true, regen: true, loin: true },
  ogre: { hunch: 0.5, belly: 2.6, head: 3.6, arm: 1, weapon: 'club', tusks: true, loin: true },
  ape: { hunch: 1, belly: 0.8, head: 3.4, arm: 1.55, weapon: 'none', fur: true },
  fiend: { hunch: 0.2, belly: 0, head: 3.7, arm: 1.1, weapon: 'none', horns: true, flames: true, loin: true },
  demon: { hunch: 0, belly: 0.4, head: 3.8, arm: 1.1, weapon: 'sword', horns: true, cape: true },
  stone: { hunch: 0.4, belly: 1, head: 3.4, arm: 1.2, weapon: 'none', stone: true, moss: true },
  orc: { hunch: 0.6, belly: 0.8, head: 3.5, arm: 1.1, weapon: 'axe', tusks: true, loin: true },
  bear: { hunch: 0.6, belly: 1.4, head: 4, arm: 1.1, weapon: 'none', fur: true, bearHead: true },
  ghoul: { hunch: 0.9, belly: -0.8, head: 3.5, arm: 1.4, weapon: 'none', gaunt: true, shroud: true },
  brass: { hunch: 0.2, belly: 0.5, head: 3.2, arm: 1.1, weapon: 'none', brass: true },
  brute: { hunch: 0.5, belly: 0.8, head: 3.5, arm: 1.1, weapon: 'club', loin: true },
  mutant: { hunch: 0.8, belly: 0.4, head: 4.1, arm: 1, weapon: 'none', bigArm: true },
  titan: { hunch: 0.3, belly: 1.4, head: 3.4, arm: 1.3, weapon: 'none', stone: true },
};

export function paintGiant(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const sp: Spec = { ...(SPECS[L.form] ?? SPECS.brute) };
  const w = L.words;
  if (sp.weapon === 'club' || L.form === 'brute') sp.weapon = w.includes('axe') ? 'axe' : w.includes('hammer') ? 'hammer' : w.includes('sword') ? 'sword' : w.includes('spear') ? 'spear' : sp.weapon;
  if (L.form === 'orc' && w.includes('club')) sp.weapon = 'club';
  if (L.form === 'brute' && w.includes('cape') || w.includes('hood') && L.form === 'brute') sp.cape = true;
  if (L.form === 'stone' && !w.includes('sit')) sp.sit = false; else if (L.form === 'stone') sp.sit = true;
  const s = Math.min(c.px / 36, (c.w * 0.9) / 34);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const sk = L.main;
  const skin = p.mat(sk, { deep: true }), skinD = p.mat(dark(sk, 0.3)), skinL = p.mat(light(sk, 0.2));
  // parts that overlap get their own shade, so the head, the shoulder and the near arm read as separate masses
  const pale = parseInt(sk.slice(1, 3), 16) + parseInt(sk.slice(3, 5), 16) + parseInt(sk.slice(5, 7), 16) > 560;
  const lift = (t: number) => (pale ? dark(sk, t * 1.4) : light(sk, t));
  const headM = p.mat(pale ? dark(sk, 0.14) : mix(sk, light(sk, 0.3), 0.55), { deep: true }), armN = p.mat(lift(0.1), { deep: true }), shoulderM = p.mat(lift(0.07), { deep: true });
  const cloth = p.mat(L.second, { deep: true }), clothD = p.mat(dark(L.second, 0.3));
  const eye = p.mat(L.eye, { flat: true }), ink = p.mat('#15131a', { flat: true }), tooth = p.mat('#e8e0c8', { flat: true });
  const glowC = p.mat(L.second, { flat: true }), bone = p.mat('#d8d0b8');
  const walk = mo.pose === 'walk', att = mo.pose === 'attack';
  const sit = !!sp.sit;
  const hip = sit ? -9 : -16, shy = hip - 11 + (sit ? 1 : 0);
  const hx0 = sp.hunch * 4, tx = hx0 * 0.5;
  // legs
  if (sit) {
    pen.rect(-9, -6, 18, 6, p.mat(dark(L.main, 0.15)));                           // the seat of rubble
    pen.cap([-4, -11], [6, -11.5], 4.4, 3.8, skinD);                                     // thighs forward
    pen.cap([6, -11.5], [8, -2], 3.6, 3.2, skin);                                        // shins down
    pen.rect(5.5, -2.2, 6, 2.2, skinD);
  } else {
    const sw = walk ? 3 * Math.sin(mo.ph) : att ? (mo.a === 1 ? 2 : -1) : 0, lift = walk ? Math.max(0, Math.cos(mo.ph)) * 1.8 : 0, lift2 = walk ? Math.max(0, -Math.cos(mo.ph)) * 1.8 : 0;
    pen.cap([-3, hip], [-3.2 - sw, -lift2 - 1], 3.4, 2.8, skinD); pen.rect(-5 - sw, -lift2 - 2, 6, 2, skinD);
    pen.cap([3, hip], [3.5 + sw, -lift - 1], 3.6, 3, skin); pen.rect(1.5 + sw, -lift - 2, 6.5, 2, skin);
  }
  // far arm (behind the torso)
  const reach = sp.arm;
  const idleY = hip + 3 + (mo.breath ? 0.6 : 0);
  const farHand: [number, number] = walk ? [-3 - 2.5 * Math.sin(mo.ph), idleY + 2] : [-4, idleY + 2];
  const sh: [number, number] = [tx + 6, shy + 1], shF: [number, number] = [tx - 5, shy + 1.5];
  pen.cap(shF, [farHand[0] + hx0 * 0.2, farHand[1] + (reach - 1) * 8], 3, 2.4, skinD);
  // torso
  const bellyR = 7.2 + sp.belly;
  pen.ell(tx + 0.5, (hip + shy) / 2 + 1, bellyR, (hip - shy) / 2 + 3.2, skin);
  pen.ell(tx + 1 + sp.hunch * 1.5, shy + 1, 8.6, 4.4, shoulderM);
  if (sp.fur) for (let i = 0; i < 7; i++) pen.poly([[tx - 7 + i * 2.4, shy + 2 + (i % 2)], [tx - 6 + i * 2.4, shy + 7 + (i % 3)], [tx - 8 + i * 2.4, shy + 6]], skinL);
  if (sp.gaunt) for (let i = 0; i < 4; i++) pen.line([tx - 3, shy + 3 + i * 2.2], [tx + 4, shy + 4 + i * 2.2], skinD, 0.7);
  if (sp.stone) { for (let i = 0; i < 5; i++) pen.line([tx - 6 + rnd(L.id, i) * 12, shy + rnd(L.id, i + 3) * 10], [tx - 6 + rnd(L.id, i) * 12 + 2, shy + 3 + rnd(L.id, i + 3) * 10], glowC, 0.8); for (let i = 0; i < 3; i++) pen.rect(tx - 8 + i * 6, shy - 1.4, 4, 3, skinL); }
  if (sp.moss) for (let i = 0; i < 4; i++) pen.ell(tx - 6 + i * 4.4, shy - 0.4 + (i % 2), 2.6, 1.2, p.mat('#5a7a4a'));
  if (sp.regen) for (let i = 0; i < 6; i++) { const a = [tx - 4 + i * 2.2, shy + 4 + (i % 3) * 3.4] as const; pen.line([a[0], a[1]], [a[0] + 1.2, a[1] + 2.4], p.mat('#6ae04a', { flat: true }), 0.8); }
  if (sp.brass) { for (let i = 0; i < 3; i++) pen.dot(tx - 4 + i * 4, shy + 6, glowC, 1.6); pen.rect(tx - 2, shy + 3, 5, 5, p.mat(dark(L.main, 0.25))); pen.dot(tx + 0.5, shy + 5.5, eye, 3); if (mo.f % 2 === 0) for (let i = 0; i < 3; i++) pen.dot(tx + 8 + i * 1.2, shy - 4 - i * 2, p.mat('#e8e8f0', { flat: true, alpha: 0.6 }), 1.4); }
  if (sp.shroud) { pen.poly([[tx - 7, shy + 3], [tx + 8, shy + 2], [tx + 9, hip + 2], [tx - 8, hip + 5]], p.mat(L.second, { alpha: 0.8 })); for (let i = 0; i < 4; i++) pen.line([tx - 7 + i * 4, shy + 3], [tx - 8 + i * 4, hip + 5 + (i % 2) * 2], clothD, 0.8); }
  if (sp.loin) pen.poly([[tx - 5.5, hip - 1], [tx + 6, hip - 1], [tx + 5, hip + 7], [tx + 0.5, hip + 5.5], [tx - 5, hip + 7.4]], cloth);
  if (sp.cape) {
    const fl = walk ? Math.sin(mo.ph) * 1.5 : mo.breath * 0.6;
    pen.poly([[tx - 3, shy], [tx - 9, shy + 4], [tx - 11 - fl, -3], [tx - 6, -1], [tx - 2, hip]], cloth);
    pen.line([tx - 10, shy + 6], [tx - 10.5 - fl, -3], clothD, 0.8);
  }
  if (sit) pen.ell(tx + 2, hip - 1, 6, 3, skin);
  // head
  const hr = sp.head + 0.9, hxc = tx + 3.5 + hx0 * 1.2, hyc = shy - 4.2 + sp.hunch * 1.2 + (mo.dead ? 2 : 0);
  pen.cap([tx + 2, shy + 1], [hxc, hyc], 4, 3, skinD);
  pen.ell(hxc, hyc, hr, hr * 0.95, headM);
  if (L.form === 'ape') { pen.ell(hxc + 1.9, hyc + 0.8, 2.9, 2.5, p.mat(L.second, { deep: true })); pen.rect(hxc + 0.8, hyc + 2.2, 3, 0.8, ink); }
  pen.rect(hxc - hr * 0.2, hyc - 2.1, hr * 1.3, 0.9, skinD);
  if (sp.bearHead) { pen.ell(hxc + 3.3, hyc + 1.2, 3.1, 2.4, p.mat(L.second)); pen.dot(hxc + 5.8, hyc + 0.4, ink, 1.4); pen.ell(hxc - 1.5, hyc - hr + 0.6, 1.5, 1.6, skinD); pen.ell(hxc + 2.3, hyc - hr + 0.7, 1.5, 1.6, skinD); }
  else { pen.rect(hxc - 1.8, hyc + hr * 0.45, hr * 1.4, 1.1, skinD); if (sp.tusks) { pen.poly([[hxc + 1.2, hyc + 1.4], [hxc + 2, hyc - 1.4], [hxc + 2.8, hyc + 1.4]], tooth); pen.poly([[hxc + 3.6, hyc + 1.4], [hxc + 4.2, hyc - 1.2], [hxc + 4.9, hyc + 1.4]], tooth); } }
  if (sp.ears) pen.poly([[hxc - hr, hyc - 1], [hxc - hr - 3, hyc - 3], [hxc - hr, hyc + 1]], skin);
  if (sp.horns) { pen.poly([[hxc - 2.4, hyc - hr + 0.8], [hxc - 5, hyc - hr - 5], [hxc - 0.6, hyc - hr + 0.6]], bone); pen.poly([[hxc + 1.2, hyc - hr + 0.6], [hxc + 2.8, hyc - hr - 5.6], [hxc + 3.8, hyc - hr + 1]], bone); }
  if (sp.stone) { pen.rect(hxc - hr, hyc - hr, hr * 2, 2.2, skinL); pen.rect(hxc - hr * 0.8, hyc + 0.3, hr * 1.9, 1.1, skinD); }
  if (sp.brass) { pen.rect(hxc - hr, hyc - 1.5, hr * 2, 2.6, p.mat('#2a2a30')); }
  if (!mo.dead) { pen.dot(hxc + hr * 0.55, hyc - 0.8, eye, sp.stone || sp.brass ? 1.7 : 1.3); }
  else pen.rect(hxc + hr * 0.2, hyc - 0.9, 2, 0.8, ink);
  if (sp.flames) {
    for (let i = 0; i < 5; i++) pen.poly([[hxc - 5 + i * 2.6, shy - 1], [hxc - 4.2 + i * 2.6, shy - 5.5 - ((mo.f + i) % 3) * 1.5], [hxc - 3.4 + i * 2.6, shy - 1]], glowC);
    pen.rect(tx - 5, hip - 2, 11, 1.2, glowC);
  }
  // near arm and what it carries
  const wpn = sp.weapon;
  let hand: [number, number], ang: number;
  if (att && sp.weapon !== 'none') {
    if (L.atkKind === 'lash' || L.atkKind === 'spit') { hand = [sh[0] + 8 + mo.strike * 5, sh[1] + 1]; ang = -0.2; }
    else if (mo.a === 0) { hand = [sh[0] - 6, sh[1] - 13]; ang = -2.0; }
    else if (mo.a === 1) { hand = [sh[0] + 9, sh[1] + 8]; ang = 0.75; }
    else { hand = [sh[0] + 6, sh[1] + 4]; ang = -0.3; }
  } else if (att) {
    // fists: raised, then brought down on the ground
    hand = mo.a === 0 ? [sh[0] + 2, sh[1] - 12] : mo.a === 1 ? [sh[0] + 11, hip + 14] : [sh[0] + 6, sh[1] + 6];
    ang = 0;
  } else if (walk) { hand = [sh[0] + 3 + 2.5 * Math.sin(mo.ph), idleY + 1]; ang = -1.0 + 0.2 * Math.sin(mo.ph); }
  else { hand = [sh[0] + 4 + hx0 * 0.4, idleY + 2 + (mo.pose === 'hurt' ? -4 : 0)]; ang = -1.15 + mo.breath * 0.06; }
  if (sit) { hand = att ? hand : [tx + 7, hip - 1]; }
  if (sp.bigArm) { pen.cap(sh, [hand[0] + 6, -9], 5.6, 6.4, p.mat(mix(sk, L.second, 0.4), { deep: true })); pen.ell(hand[0] + 6, -6, 6.2, 6, p.mat(mix(sk, L.second, 0.5), { deep: true })); for (let i = 0; i < 3; i++) pen.line([sh[0] + 1 + i, sh[1] + 2 + i * 3], [hand[0] + 4 + i, -12 + i * 2], p.mat(L.second, { flat: true }), 0.9); }
  else pen.cap(sh, hand, 3.2 * (sp.fur ? 1.15 : 1), 2.6 * (sp.fur ? 1.25 : 1), armN);
  if (sp.fur) pen.ell(hand[0], hand[1] + 1, 2.8, 2.6, skinL);
  else if (!sp.bigArm) pen.ell(hand[0], hand[1], 2.4, 2.2, skinL);
  if (wpn !== 'none') {
    const len = wpn === 'club' ? 19 : wpn === 'sword' ? 24 : wpn === 'spear' ? 24 : 17;
    const tip: [number, number] = [hand[0] + Math.cos(ang) * len, hand[1] + Math.sin(ang) * len];
    const back: [number, number] = [hand[0] - Math.cos(ang) * 3, hand[1] - Math.sin(ang) * 3];
    const wood = p.mat('#6a4a2e'), steel = p.mat('#aeb2ba');
    if (wpn === 'club') { pen.cap(back, tip, 1.5, 3.4, wood); for (const t of [0.7, 0.9]) pen.dot(hand[0] + (tip[0] - hand[0]) * t + 1, hand[1] + (tip[1] - hand[1]) * t - 1.4, p.mat('#8a6a46'), 1.5); }
    else if (wpn === 'axe') { pen.line(back, tip, wood, 1.4); const m: [number, number] = [hand[0] + (tip[0] - hand[0]) * 0.86, hand[1] + (tip[1] - hand[1]) * 0.86]; pen.poly([[m[0] - Math.sin(ang) * 6, m[1] + Math.cos(ang) * 6], [tip[0], tip[1]], [m[0] + Math.sin(ang) * 5, m[1] - Math.cos(ang) * 5]], steel); }
    else if (wpn === 'hammer') { pen.line(back, tip, wood, 1.4); pen.poly([[tip[0] - Math.sin(ang) * 4 - Math.cos(ang) * 2, tip[1] + Math.cos(ang) * 4 - Math.sin(ang) * 2], [tip[0] - Math.sin(ang) * 4 + Math.cos(ang) * 3, tip[1] + Math.cos(ang) * 4 + Math.sin(ang) * 3], [tip[0] + Math.sin(ang) * 4 + Math.cos(ang) * 3, tip[1] - Math.cos(ang) * 4 + Math.sin(ang) * 3], [tip[0] + Math.sin(ang) * 4 - Math.cos(ang) * 2, tip[1] - Math.cos(ang) * 4 - Math.sin(ang) * 2]], steel); }
    else if (wpn === 'spear') { pen.line(back, tip, wood, 1.2); pen.poly([[tip[0] + Math.cos(ang) * 4, tip[1] + Math.sin(ang) * 4], [tip[0] - Math.sin(ang) * 1.6, tip[1] + Math.cos(ang) * 1.6], [tip[0] + Math.sin(ang) * 1.6, tip[1] - Math.cos(ang) * 1.6]], steel); }
    else { pen.line(back, tip, steel, 2); pen.line([hand[0] - Math.sin(ang) * 3.4, hand[1] + Math.cos(ang) * 3.4], [hand[0] + Math.sin(ang) * 3.4, hand[1] - Math.cos(ang) * 3.4], p.mat('#c8a040'), 1.2); if (L.main === '#6a1a1a') void 0; }
  }
  if (sp.flames && att) for (let i = 0; i < 5; i++) pen.dot(hand[0] + 3 + i * 3, hand[1] - Math.sin(i * 1.3 + mo.f) * 2, glowC, 2);
  if (sp.flames) for (let i = 0; i < 3; i++) pen.dot(hand[0] + (i - 1) * 1.6, hand[1] - 3 - i * 1.2 - (mo.f % 2), glowC, 1.4);
  void mix; void (pen as Pen);
  return { shadow: { cx: c.cx + tx * s, cy: c.foot, rx: 11 * s, ry: Math.max(2, 3 * s * 0.45) }, tall: true };
}
