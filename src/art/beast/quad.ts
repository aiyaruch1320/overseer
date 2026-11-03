// Four-legged beasts: the wolves (and the ash and shadow packs), the manticore and the magma salamander. One design (units: the middle of
// the feet is (0,0), up is negative), a spec per form. Walks as a gallop (21-pixel-art.md §3).
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info } from './kit';

interface Spec {
  /** design height (feet to the top of the ears) and length */
  H: number; W: number;
  /** body half-width and half-height; legs' length */
  bx: number; by: number; leg: number;
  head: 'canine' | 'feline' | 'flat';
  tail: 'bush' | 'scorp' | 'long';
  mane?: boolean; ribs?: boolean; cracks?: boolean; ash?: boolean; wisps?: boolean; oldface?: boolean; thick?: number;
}
const SPECS: Record<string, Spec> = {
  wolf: { H: 20, W: 40, bx: 11, by: 5, leg: 8, head: 'canine', tail: 'bush', mane: true, ribs: true },
  ashwolf: { H: 20, W: 40, bx: 11, by: 5, leg: 8, head: 'canine', tail: 'bush', ribs: true, ash: true },
  shadowwolf: { H: 20, W: 40, bx: 11, by: 5, leg: 8, head: 'canine', tail: 'bush', mane: true, wisps: true },
  manticore: { H: 26, W: 48, bx: 13, by: 7, leg: 10, head: 'feline', tail: 'scorp', mane: true, oldface: true, thick: 1.2 },
  salamander: { H: 12, W: 48, bx: 14, by: 4, leg: 4, head: 'flat', tail: 'long', cracks: true },
};

export function paintQuad(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const sp = SPECS[L.form] ?? SPECS.wolf;
  const s = Math.min(c.px / sp.H, (c.w * 0.92) / sp.W);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const fur = p.mat(L.main, { deep: true }), furD = p.mat(dark(L.main, 0.3)), furL = p.mat(light(L.main, 0.18)), belly = p.mat(L.second);
  const eye = p.mat(L.eye, { flat: true }), nose = p.mat('#15131a', { flat: true }), tooth = p.mat('#f0eadc', { flat: true });
  const glow = p.mat(L.second, { flat: true });
  const walking = mo.pose === 'walk', attacking = mo.pose === 'attack';
  const dead = mo.dead;
  const cy = -(sp.leg + sp.by - 2); // body centre
  // legs: gallop phases
  const sw = (ph: number, brace: number) => (walking ? 2.6 * Math.sin(ph) : attacking ? brace : 0);
  const lift = (ph: number) => (walking ? Math.max(0, Math.cos(ph)) * 1.8 : 0);
  const leg = (x: number, ph: number, far: boolean, brace: number) => {
    const k = far ? furD : fur, o = sw(ph, brace), l = lift(ph);
    pen.cap([x, cy + sp.by * 0.5], [x + o, -l - 0.6], 1.9 * (sp.thick ?? 1), 1.3, k);
    pen.rect(x + o - 0.8, -l - 1.1, 3, 1.1, k);
  };
  const fx = sp.bx * 0.62, hx = -sp.bx * 0.7;
  leg(hx + 1.5, mo.ph + 0.9, true, -2); leg(fx + 1.5, mo.ph + Math.PI + 0.3, true, 2);
  // tail
  const wag = Math.sin(mo.ph * 1) * 1.2 + (mo.breath ? 0.8 : 0);
  if (sp.tail === 'bush') {
    pen.cap([-sp.bx + 1, cy - 1], [-sp.bx - 7, cy - 3 + wag], 2.1, 0.8, fur);
    pen.cap([-sp.bx - 3, cy - 2 + wag * 0.5], [-sp.bx - 7, cy - 3 + wag], 1.6, 0.8, L.form === 'ashwolf' ? belly : fur);
  } else if (sp.tail === 'long') {
    pen.cap([-sp.bx + 1, cy], [-sp.bx - 7, cy + 1 + wag * 0.5], 2.4, 1.6, fur);
    pen.cap([-sp.bx - 7, cy + 1 + wag * 0.5], [-sp.bx - 15, cy - 1 - wag], 1.6, 0.6, fur);
  } else {
    // a scorpion tail arches over the back; at the strike it comes down in front
    const q = mo.pose === 'attack' ? mo.strike : mo.pose === 'idle' ? 0.2 * mo.breath : 0;
    const t0: [number, number] = [-sp.bx + 1, cy - 1], t1: [number, number] = [-sp.bx - 7, cy - 7 + q * 2], t2: [number, number] = [-sp.bx - 4 + q * 20, cy - 15 + q * 12], t3: [number, number] = [-sp.bx + 3 + q * 28, cy - 16 + q * 17];
    pen.chain([t0, t1, t2, t3], [1.9, 1.7, 1.4, 1.1], fur);
    for (let i = 0; i < 3; i++) pen.dot(t1[0] + (t2[0] - t1[0]) * (i / 3), t1[1] + (t2[1] - t1[1]) * (i / 3) - 1.4, furD, 1.2);
    pen.poly([[t3[0], t3[1] - 1], [t3[0] + 3.5, t3[1] + 1.5], [t3[0], t3[1] + 1.5]], tooth);
    pen.dot(t3[0] + 1, t3[1], glow, 1.4);
  }
  // body
  pen.ell(0, cy, sp.bx, sp.by, fur);
  pen.ell(1, cy + sp.by * 0.5, sp.bx * 0.75, sp.by * 0.38, belly);
  pen.ell(sp.bx * 0.55, cy - 0.6, sp.by * 0.95, sp.by * 1.1, fur);
  if (sp.ribs) for (let i = 0; i < 3; i++) pen.line([-2 + i * 3.2, cy - 1], [-1 + i * 3.2, cy + sp.by * 0.55], furD, 0.8);
  if (sp.cracks) {
    for (let i = 0; i < 5; i++) pen.line([-sp.bx * 0.7 + i * 5.5, cy - sp.by * 0.7], [-sp.bx * 0.7 + i * 5.5 + 1.5, cy + sp.by * 0.4], glow, 0.9);
    pen.line([-sp.bx - 6, cy + 1], [-sp.bx - 12, cy], glow, 0.7);
  }
  if (sp.mane) {
    const mx = sp.bx * 0.7;
    for (let i = 0; i < 5; i++) pen.poly([[mx - 3 + i * 1.4, cy - sp.by - 1.6 - (i % 2) * 1.4], [mx - 1.5 + i * 1.4, cy - sp.by + 1.5], [mx - 4.5 + i * 1.4, cy - sp.by + 1.5]], L.form === 'manticore' ? p.mat(L.second) : furD);
  }
  if (sp.ash) for (let i = 0; i < 6; i++) pen.dot(-sp.bx - 2 - i * 2.2 - mo.ph, cy + 2 + Math.sin(i * 2 + mo.f) * 2.6, furL, 1);
  if (sp.wisps) for (let i = 0; i < 5; i++) pen.line([-sp.bx + i * 5, cy - sp.by + 1], [-sp.bx + i * 5 - 3 - ((mo.f + i) % 2), cy - sp.by - 3.5 - (i % 2)], furD, 1);
  leg(hx - 1, mo.ph + 0.9 + Math.PI * 0.6, false, -2.5); leg(fx - 1, mo.ph + 0.3, false, 3);
  // head: lowered when it hunts; the jaw opens at the bite
  const lowerHead = attacking ? 2.4 * mo.strike : mo.dead ? 4 : 0;
  const hxc = sp.bx + 3.5, hyc = cy - sp.by * 0.55 + lowerHead + (mo.pose === 'idle' ? 0.5 * mo.breath : 0);
  pen.cap([sp.bx * 0.6, cy - 1], [hxc, hyc], sp.by * 0.9, sp.by * 0.7, fur);
  if (sp.head === 'canine') {
    pen.ell(hxc, hyc, 4.2, 3.7, fur);
    pen.poly([[hxc + 1, hyc - 2], [hxc + 9, hyc + 0.5], [hxc + 9, hyc + 2.2], [hxc + 1, hyc + 3.2]], fur);
    pen.rect(hxc + 3, hyc + 2.2 + mo.open * 1.8, 6, 1.1, belly);
    if (mo.open > 0.5) { pen.dot(hxc + 8, hyc + 2.1 + mo.open * 1.4, tooth, 1); pen.dot(hxc + 5.5, hyc + 2.1 + mo.open * 1.4, tooth, 1); }
    pen.dot(hxc + 9.2, hyc + 0.6, nose, 1.6);
    pen.poly([[hxc - 2, hyc - 3], [hxc - 1, hyc - 7.5], [hxc + 1, hyc - 3]], fur); pen.poly([[hxc + 1.5, hyc - 3], [hxc + 2.8, hyc - 7], [hxc + 3.6, hyc - 2.4]], furD);
  } else if (sp.head === 'feline') {
    if (sp.oldface) {
      pen.ell(hxc + 1, hyc, 6.2, 6.2, p.mat(L.second)); // the mane ring
      pen.ell(hxc + 2, hyc + 0.4, 3.9, 4.2, p.mat('#c8a890')); // a pale old face
      pen.rect(hxc + 3.2, hyc + 2.4 + mo.open * 1.2, 3, 0.9, p.mat('#5a2a2a', { flat: true }));
      for (const dy of [-1.2, 0.8]) pen.dot(hxc + 4, hyc + dy, eye, 1);
      pen.line([hxc + 1, hyc - 2.2], [hxc + 3, hyc - 2.6], furD, 0.8);
    } else {
      pen.ell(hxc, hyc, 4.5, 4, fur);
      pen.rect(hxc + 2, hyc + 1.5 + mo.open * 1.6, 5, 1, belly);
    }
  } else {
    pen.ell(hxc + 1, hyc + 0.5, 5.4, 2.8, fur);
    pen.rect(hxc + 3, hyc + 1.8 + mo.open * 1.6, 5, 1, belly);
    pen.dot(hxc + 7, hyc, nose, 1.2);
  }
  if (!dead && !sp.oldface) pen.dot(hxc + 2.4, hyc - 1.2, eye, 1.3);
  if (dead && !sp.oldface) pen.rect(hxc + 1.6, hyc - 1, 2, 0.8, nose);
  return { shadow: { cx: c.cx + (mo.push + 1) * s, cy: c.foot, rx: sp.W * 0.3 * s, ry: Math.max(1.6, 2.4 * s * 0.6) }, tall: false };
}

void mix; void rnd;
