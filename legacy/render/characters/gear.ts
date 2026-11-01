// Hair, headwear, beards and hand-held tools, all as vector shapes anchored to the head or the hand.
import { type Cx, ell, poly, rrect, stroke, curve, lin, rad, hex, rgba, mix, shade, lite, lineOf, INK, glow } from './kit';

const HIDING = ['helmet', 'hood', 'turban', 'furhat', 'minerhat', 'veil', 'nemes', 'horned', 'mitre', 'cowl'];
export const hatHidesHair = (hat: string) => HIDING.includes(hat);

const hairFill = (k: Cx, y0: number, y1: number) => lin(k.c, 0, y0, 0, y1, [0, hex(lite(k.hair, 0.28))], [0.45, hex(k.hair)], [1, hex(shade(k.hair, 0.7))]);

// ---------- hair ----------
/** the part of the hair that hangs behind the head and shoulders */
export function hairBack(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k;
  if (k.theme.hairless || k.feats.has('hairless') || L.hairStyle === 3 || hatHidesHair(L.hat)) return;
  const s = L.hairStyle, ln = hex(lineOf(k.hair));
  const sway = Math.sin(k.P.amb * Math.PI * 2) * 0.8;
  const long = (len: number, w: number) => {
    c.beginPath(); c.moveTo(hx - hw * 1.08, hy);
    c.bezierCurveTo(hx - hw * 1.3, hy + hh * 0.9, hx - hw * w + sway, hy + len * 0.7, hx - hw * (w - 0.1) + sway, hy + len);
    c.lineTo(hx + hw * (w - 0.1) + sway, hy + len);
    c.bezierCurveTo(hx + hw * w + sway, hy + len * 0.7, hx + hw * 1.3, hy + hh * 0.9, hx + hw * 1.08, hy);
    c.closePath(); c.fillStyle = hairFill(k, hy - hh, hy + len); c.fill(); c.strokeStyle = ln; c.lineWidth = 0.7; c.stroke();
  };
  if (s === 1 || s === 13) long(hh * (s === 13 ? 2.5 : 2.1), 1.28);
  if (s === 7) long(hh * 1.1, 1.18);
  if (s === 5 || s === 2) { // a rope of hair over the shoulder, braided or tied
    const bx = hx + hw * 1.05, segs = s === 5 ? 6 : 4;
    for (let i = 0; i < segs; i++) {
      const y = hy + hh * 0.2 + i * (s === 5 ? hh * 0.3 : hh * 0.36), x = bx + Math.sin(i * 0.9 + k.P.amb * 6.28) * 0.7 + (s === 2 ? i * 0.5 : 0);
      ell(c, x, y, s === 5 ? hw * 0.2 : hw * 0.26 - i * 0.2, hh * 0.2, hex(i % 2 ? shade(k.hair, 0.82) : k.hair), ln, 0.5);
    }
    if (s === 5) ell(c, bx + 0.3, hy + hh * 0.2 + segs * hh * 0.3, hw * 0.13, hh * 0.1, '#7a2a2a', ln, 0.4);
  }
  if (s === 9) for (const sd of [-1, 1]) {
    const bx = hx + sd * hw * 1.2, by = hy - hh * 0.3;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + sd * hw * 0.9, by + hh * 0.9 + sway, bx + sd * hw * 0.4, by + hh * 1.9); c.quadraticCurveTo(bx - sd * hw * 0.1, by + hh * 1.2, bx - sd * hw * 0.1, by + hh * 0.2); c.closePath();
    c.fillStyle = hairFill(k, by, by + hh * 2); c.fill(); c.strokeStyle = ln; c.lineWidth = 0.6; c.stroke();
    ell(c, bx, by + hh * 0.05, hw * 0.16, hh * 0.14, '#7a2a2a', ln, 0.4);
  }
  if (s === 12) { // topknot sits on top, drawn in front
  }
  if (s === 10) for (let i = 0; i < 7; i++) ell(c, hx + (i - 3) * hw * 0.36, hy + hh * 0.35 + Math.abs(i - 3) * 0.2, hw * 0.26, hh * 0.3, hex(shade(k.hair, 0.85)), ln, 0.4);
}

/** the cap of hair over the skull, its fringe and the styles that stand above the head */
export function hairFront(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k;
  if (k.theme.hairless || k.feats.has('hairless') || L.hairStyle === 3 || hatHidesHair(L.hat)) return;
  const s = L.hairStyle, ln = hex(lineOf(k.hair)), f = k.fx * 0.3;
  const fill = hairFill(k, hy - hh * 1.3, hy + hh * 0.3);
  const cap = (fringe: (c: CanvasRenderingContext2D) => void) => {
    c.beginPath();
    c.moveTo(hx - hw * 1.04, hy + hh * 0.3);
    c.bezierCurveTo(hx - hw * 1.3, hy - hh * 0.6, hx - hw * 0.8, hy - hh * 1.3, hx, hy - hh * 1.26);
    c.bezierCurveTo(hx + hw * 0.8, hy - hh * 1.3, hx + hw * 1.3, hy - hh * 0.6, hx + hw * 1.04, hy + hh * 0.3);
    fringe(c);
    c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = ln; c.lineWidth = 0.75; c.lineJoin = 'round'; c.stroke();
  };
  const part = (c: CanvasRenderingContext2D) => { // swept bangs with a parting
    c.quadraticCurveTo(hx + hw * 0.95, hy - hh * 0.1, hx + hw * 0.5, hy - hh * 0.38);
    c.quadraticCurveTo(hx + hw * 0.1 + f, hy - hh * 0.62, hx + f, hy - hh * 0.6);
    c.quadraticCurveTo(hx - hw * 0.5, hy - hh * 0.28, hx - hw * 0.98, hy + hh * 0.05);
    c.quadraticCurveTo(hx - hw * 1.02, hy + hh * 0.2, hx - hw * 1.04, hy + hh * 0.3);
  };
  const straight = (c: CanvasRenderingContext2D) => {
    c.lineTo(hx + hw * 0.92, hy - hh * 0.05);
    for (let i = 0; i < 5; i++) { const xa = hx + hw * (0.92 - i * 0.37), xb = xa - hw * 0.37; c.quadraticCurveTo((xa + xb) / 2, hy - hh * 0.5 + (i % 2) * hh * 0.12, xb, hy - hh * 0.2 + (i % 2) * 0.4); }
    c.lineTo(hx - hw * 1.04, hy + hh * 0.3);
  };
  const side = (c: CanvasRenderingContext2D) => {
    c.quadraticCurveTo(hx + hw * 0.9, hy - hh * 0.2, hx + hw * 0.2, hy - hh * 0.12);
    c.quadraticCurveTo(hx - hw * 0.5, hy - hh * 0.5, hx - hw * 0.9, hy + hh * 0.1);
    c.lineTo(hx - hw * 1.04, hy + hh * 0.3);
  };
  const spiky = (c: CanvasRenderingContext2D) => {
    c.lineTo(hx + hw * 0.9, hy - hh * 0.1);
    for (let i = 0; i < 5; i++) { const xa = hx + hw * (0.9 - i * 0.38); c.lineTo(xa - hw * 0.19, hy - hh * 0.55); c.lineTo(xa - hw * 0.38, hy - hh * 0.12); }
    c.lineTo(hx - hw * 1.04, hy + hh * 0.3);
  };
  if (s === 8) { // mohawk: a crest down the middle, shaved sides
    poly(c, [hx - hw * 0.28, hy - hh * 0.9, hx - hw * 0.1, hy - hh * 1.9, hx + hw * 0.12, hy - hh * 1.6, hx + hw * 0.3, hy - hh * 1.95, hx + hw * 0.34, hy - hh * 0.85], hairFill(k, hy - hh * 2, hy - hh * 0.5), ln, 0.7);
    return;
  }
  if (s === 12) { // topknot
    cap(part);
    ell(c, hx, hy - hh * 1.52, hw * 0.34, hh * 0.3, hex(k.hair), ln, 0.6);
    rrect(c, hx - hw * 0.34, hy - hh * 1.3, hw * 0.68, hh * 0.1, 0.2, '#c04a3a', ln, 0.4);
    return;
  }
  if (s === 10) { // curls: a cloud of rings around the head
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI, x = hx + Math.cos(a) * hw * 1.12, y = hy - 0.1 + Math.sin(a) * hh * 1.1 + hh * 0.15;
      ell(c, x, y, hw * 0.34, hh * 0.34, hex(i % 2 ? k.hair : shade(k.hair, 0.88)), ln, 0.5);
    }
    cap((cc) => { cc.lineTo(hx + hw * 0.8, hy - hh * 0.35); cc.quadraticCurveTo(hx, hy - hh * 0.8, hx - hw * 0.8, hy - hh * 0.35); cc.lineTo(hx - hw * 1.04, hy + hh * 0.3); });
    return;
  }
  if (s === 6) ell(c, hx + f, hy - hh * 1.5, hw * 0.4, hh * 0.38, hex(k.hair), ln, 0.7);
  cap(s === 4 ? spiky : s === 11 || s === 0 ? side : s === 7 ? straight : s === 9 ? straight : part);
  // a few strands catch the light
  stroke(c, rgba(lite(k.hair, 0.6), 0.55), 0.7, hx - hw * 0.5, hy - hh * 0.95, hx - hw * 0.15, hy - hh * 1.12);
  stroke(c, rgba(lite(k.hair, 0.6), 0.4), 0.5, hx + hw * 0.1, hy - hh * 1.14, hx + hw * 0.42, hy - hh * 0.98);
  if (L.elder || k.stage === 'elder') stroke(c, rgba(0xffffff, 0.35), 0.5, hx - hw * 0.7, hy - hh * 0.6, hx - hw * 0.4, hy - hh * 0.9);
}

// ---------- beards ----------
export function beard(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k;
  if (!L.beard) return;
  const col = k.stage === 'elder' ? 0xe6e6ee : shade(k.hair, 0.92), ln = hex(lineOf(col)), b = L.beard;
  const fill = lin(c, 0, hy, 0, hy + hh * 2.4, [0, hex(lite(col, 0.15))], [1, hex(shade(col, 0.75))]);
  if (b === 1) { for (let i = 0; i < 12; i++) { const a = 0.15 + i * 0.22; ell(c, hx + Math.cos(a * 3) * hw * 0.6, hy + hh * (0.62 + (i % 3) * 0.1), 0.25, 0.25, rgba(col, 0.55)); } return; }
  if (b === 4) { // moustache
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(hx, hy + hh * 0.5); c.quadraticCurveTo(hx + sd * hw * 0.35, hy + hh * 0.36, hx + sd * hw * 0.62, hy + hh * 0.56); c.quadraticCurveTo(hx + sd * hw * 0.35, hy + hh * 0.58, hx, hy + hh * 0.6); c.fillStyle = hex(col); c.fill(); c.strokeStyle = ln; c.lineWidth = 0.5; c.stroke(); }
    return;
  }
  const len = b === 3 ? 2.4 : b === 2 ? 1.5 : 1.2;
  c.beginPath(); c.moveTo(hx - hw * 1.0, hy + hh * 0.1);
  c.bezierCurveTo(hx - hw * 1.1, hy + hh * 0.9, hx - hw * 0.7, hy + hh * len * 0.92, hx, hy + hh * len);
  c.bezierCurveTo(hx + hw * 0.7, hy + hh * len * 0.92, hx + hw * 1.1, hy + hh * 0.9, hx + hw * 1.0, hy + hh * 0.1);
  c.quadraticCurveTo(hx + hw * 0.55, hy + hh * 0.5, hx, hy + hh * 0.46);
  c.quadraticCurveTo(hx - hw * 0.55, hy + hh * 0.5, hx - hw * 1.0, hy + hh * 0.1);
  c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = ln; c.lineWidth = 0.7; c.stroke();
  for (let i = -2; i <= 2; i++) stroke(c, rgba(shade(col, 0.6), 0.35), 0.4, hx + i * hw * 0.22, hy + hh * 0.7, hx + i * hw * 0.3, hy + hh * (len * 0.85));
  if (k.feats.has('beadbeard')) { // dwarf beards are braided with rings
    for (let i = -1; i <= 1; i++) { ell(c, hx + i * hw * 0.34, hy + hh * (len * 0.82), 0.9, 0.9, '#d9a030', ln, 0.35); }
    ell(c, hx, hy + hh * (len - 0.12), 1.2, 1.2, '#e8c050', ln, 0.35);
  }
}

// ---------- headwear ----------
/** the part of a hat that sits behind the head (hood, veil, back of a headdress) */
export function hatBack(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k, h = L.hat;
  const c1 = L.cloth, c2 = L.cloth2;
  if (h === 'hood' || h === 'cowl') {
    c.beginPath(); c.moveTo(hx - hw * 1.25, hy + hh * 1.2); c.quadraticCurveTo(hx - hw * 1.4, hy - hh * 1.4, hx, hy - hh * 1.5); c.quadraticCurveTo(hx + hw * 1.4, hy - hh * 1.4, hx + hw * 1.25, hy + hh * 1.2); c.closePath();
    c.fillStyle = hex(shade(c1, 0.65)); c.fill(); c.strokeStyle = hex(lineOf(c1)); c.lineWidth = 0.8; c.stroke();
  }
  if (h === 'veil') {
    c.beginPath(); c.moveTo(hx - hw * 1.2, hy - hh * 0.8); c.quadraticCurveTo(hx, hy - hh * 1.6, hx + hw * 1.2, hy - hh * 0.8); c.lineTo(hx + hw * 1.4, hy + hh * 2.2); c.lineTo(hx - hw * 1.4, hy + hh * 2.2); c.closePath();
    c.fillStyle = rgba(c2, 0.9); c.fill(); c.strokeStyle = hex(lineOf(c2)); c.lineWidth = 0.7; c.stroke();
  }
  if (h === 'nemes') { // the striped royal headcloth falls behind both shoulders
    for (const sd of [-1, 1]) poly(c, [hx + sd * hw * 0.95, hy - hh * 0.4, hx + sd * hw * 1.45, hy + hh * 0.2, hx + sd * hw * 1.35, hy + hh * 2.1, hx + sd * hw * 0.8, hy + hh * 1.9], '#2a6aa0', '#12304a', 0.7);
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) stroke(c, '#e8c050', 0.6, hx + sd * hw * 0.88, hy + hh * (0.1 + i * 0.45), hx + sd * hw * 1.38, hy + hh * (0.2 + i * 0.45));
  }
  if (h === 'wizard' || h === 'straw') { /* no back */ }
}

export function hatFront(k: Cx) {
  const { c, headX: hx, headY: hy, headW: hw, headH: hh, L } = k, h = L.hat;
  const c1 = L.cloth, c2 = L.cloth2, ln = (x: number) => hex(lineOf(x));
  const top = hy - hh * 1.2;
  if (!h) return;
  if (h === 'hood' || h === 'cowl') { // the front rim of the hood frames the face
    c.beginPath(); c.moveTo(hx - hw * 1.2, hy + hh * 0.9); c.quadraticCurveTo(hx - hw * 1.35, hy - hh * 1.2, hx, hy - hh * 1.4); c.quadraticCurveTo(hx + hw * 1.35, hy - hh * 1.2, hx + hw * 1.2, hy + hh * 0.9);
    c.quadraticCurveTo(hx + hw * 1.0, hy - hh * 0.4, hx, hy - hh * 0.62); c.quadraticCurveTo(hx - hw * 1.0, hy - hh * 0.4, hx - hw * 1.2, hy + hh * 0.9); c.closePath();
    c.fillStyle = lin(c, 0, top, 0, hy + hh, [0, hex(lite(c1, 0.1))], [1, hex(shade(c1, 0.6))]); c.fill(); c.strokeStyle = ln(c1); c.lineWidth = 0.8; c.stroke();
  } else if (h === 'cap') {
    c.beginPath(); c.moveTo(hx - hw * 1.08, hy - hh * 0.25); c.bezierCurveTo(hx - hw * 1.2, hy - hh * 1.3, hx + hw * 1.2, hy - hh * 1.3, hx + hw * 1.08, hy - hh * 0.25); c.quadraticCurveTo(hx, hy - hh * 0.5, hx - hw * 1.08, hy - hh * 0.25);
    c.fillStyle = lin(c, 0, top, 0, hy, [0, hex(lite(c2, 0.15))], [1, hex(shade(c2, 0.75))]); c.fill(); c.strokeStyle = ln(c2); c.lineWidth = 0.75; c.stroke();
    if (k.view !== 'back') poly(c, [hx + hw * 0.2, hy - hh * 0.32, hx + hw * 1.5, hy - hh * 0.2, hx + hw * 1.3, hy - hh * 0.05, hx + hw * 0.2, hy - hh * 0.15], hex(shade(c2, 0.82)), ln(c2), 0.6);
    ell(c, hx, top + 0.6, 0.9, 0.9, hex(shade(c2, 0.7)), ln(c2), 0.4);
  } else if (h === 'bandana') {
    const bd = hex(shade(c2, 0.78)), be = hex(lineOf(c2));
    poly(c, [hx - hw * 1.05, hy - hh * 0.55, hx, hy - hh * 0.72, hx + hw * 1.05, hy - hh * 0.55, hx + hw * 1.05, hy - hh * 0.2, hx, hy - hh * 0.36, hx - hw * 1.05, hy - hh * 0.2], bd, be, 0.7);
    poly(c, [hx + hw * 1.0, hy - hh * 0.4, hx + hw * 1.7, hy - hh * 0.1, hx + hw * 1.45, hy + hh * 0.2, hx + hw * 1.0, hy - hh * 0.2], bd, be, 0.6);
    for (let i = 0; i < 4; i++) ell(c, hx - hw * 0.7 + i * hw * 0.45, hy - hh * 0.46, 0.5, 0.5, hex(lite(c2, 0.5)));
  } else if (h === 'turban') {
    c.beginPath(); c.moveTo(hx - hw * 1.12, hy - hh * 0.1); c.bezierCurveTo(hx - hw * 1.5, hy - hh * 1.8, hx + hw * 1.5, hy - hh * 1.8, hx + hw * 1.12, hy - hh * 0.1); c.quadraticCurveTo(hx, hy - hh * 0.55, hx - hw * 1.12, hy - hh * 0.1); c.closePath();
    c.fillStyle = lin(c, 0, top - 3, 0, hy, [0, '#fffaf0'], [1, '#d8ccb0']); c.fill(); c.strokeStyle = '#9a8a6a'; c.lineWidth = 0.7; c.stroke();
    for (let i = 0; i < 3; i++) curve(c, 'rgba(120,100,70,0.55)', 0.6, hx - hw * 1.0, hy - hh * (0.3 + i * 0.35), hx, hy - hh * (0.75 + i * 0.4), hx + hw * 1.0, hy - hh * (0.3 + i * 0.35));
    ell(c, hx, hy - hh * 0.6, 1.5, 1.5, '#e04848', '#701818', 0.4); ell(c, hx - 0.4, hy - hh * 0.65, 0.5, 0.5, '#ffd0d0');
  } else if (h === 'veil') {
    curve(c, hex(lineOf(c2)), 0.7, hx - hw * 1.1, hy - hh * 0.3, hx, hy - hh * 0.62, hx + hw * 1.1, hy - hh * 0.3);
    for (let i = 0; i < 5; i++) ell(c, hx - hw * 0.8 + i * hw * 0.4, hy - hh * 0.5 + Math.abs(i - 2) * 0.3, 0.45, 0.45, '#f2c94c');
  } else if (h === 'furhat') {
    c.beginPath(); c.moveTo(hx - hw * 1.2, hy - hh * 0.1); c.bezierCurveTo(hx - hw * 1.4, hy - hh * 1.6, hx + hw * 1.4, hy - hh * 1.6, hx + hw * 1.2, hy - hh * 0.1); c.closePath();
    c.fillStyle = '#8a6a4a'; c.fill(); c.strokeStyle = '#4a3220'; c.lineWidth = 0.7; c.stroke();
    for (let i = 0; i < 6; i++) ell(c, hx - hw * 1.0 + i * hw * 0.4, hy - hh * 0.15, hw * 0.28, hh * 0.22, '#efe8dc', '#b0a898', 0.35);
    for (const sd of [-1, 1]) poly(c, [hx + sd * hw * 1.1, hy, hx + sd * hw * 1.35, hy + hh * 0.9, hx + sd * hw * 1.0, hy + hh * 0.8], '#8a6a4a', '#4a3220', 0.5);
  } else if (h === 'straw') {
    ell(c, hx, hy - hh * 0.55, hw * 1.9, hh * 0.38, '#e8d090', '#9a8040', 0.7);
    c.beginPath(); c.moveTo(hx - hw * 1.0, hy - hh * 0.62); c.bezierCurveTo(hx - hw * 1.0, hy - hh * 1.75, hx + hw * 1.0, hy - hh * 1.75, hx + hw * 1.0, hy - hh * 0.62); c.closePath();
    c.fillStyle = lin(c, 0, top - 2, 0, hy, [0, '#f3e2a8'], [1, '#d4b86c']); c.fill(); c.strokeStyle = '#9a8040'; c.lineWidth = 0.7; c.stroke();
    rrect(c, hx - hw * 1.0, hy - hh * 0.95, hw * 2, hh * 0.3, 0.3, '#c04a3a', '#701818', 0.5);
    for (let i = 0; i < 5; i++) stroke(c, 'rgba(120,90,40,0.35)', 0.4, hx - hw * 1.6 + i * hw * 0.8, hy - hh * 0.55, hx - hw * 1.5 + i * hw * 0.8, hy - hh * 0.42);
  } else if (h === 'helmet') {
    c.beginPath(); c.moveTo(hx - hw * 1.14, hy + hh * 0.5); c.lineTo(hx - hw * 1.14, hy - hh * 0.2); c.bezierCurveTo(hx - hw * 1.2, hy - hh * 1.5, hx + hw * 1.2, hy - hh * 1.5, hx + hw * 1.14, hy - hh * 0.2); c.lineTo(hx + hw * 1.14, hy + hh * 0.5);
    c.lineTo(hx + hw * 0.8, hy + hh * 0.35); c.lineTo(hx + hw * 0.8, hy - hh * 0.25); c.quadraticCurveTo(hx, hy - hh * 0.5, hx - hw * 0.8, hy - hh * 0.25); c.lineTo(hx - hw * 0.8, hy + hh * 0.35); c.closePath();
    c.fillStyle = lin(c, hx - hw, top, hx + hw, hy, [0, '#e8ecf4'], [0.5, '#a8b0c0'], [1, '#6a7284']); c.fill(); c.strokeStyle = '#3a4050'; c.lineWidth = 0.8; c.stroke();
    rrect(c, hx - 0.8, hy - hh * 0.25, 1.6, hh * 0.85, 0.5, '#8a92a4', '#3a4050', 0.4);
    stroke(c, 'rgba(255,255,255,0.7)', 0.7, hx - hw * 0.8, top + 2, hx - hw * 0.3, top + 0.6);
    if (L.role === 'หัวหน้าทหารยาม') { poly(c, [hx - 1, top + 1, hx, top - 6, hx + 1, top + 1], '#c03030', '#601818', 0.5); }
    else ell(c, hx, top + 0.4, 0.9, 0.9, '#6a7284', '#3a4050', 0.4);
  } else if (h === 'wizard') {
    ell(c, hx, hy - hh * 0.62, hw * 1.55, hh * 0.3, hex(shade(c1, 0.85)), ln(c1), 0.7);
    c.beginPath(); c.moveTo(hx - hw * 0.95, hy - hh * 0.66); c.quadraticCurveTo(hx - hw * 0.4, hy - hh * 2.2, hx + hw * 0.9, hy - hh * 2.7); c.quadraticCurveTo(hx + hw * 0.95, hy - hh * 2.1, hx + hw * 0.95, hy - hh * 0.66); c.closePath();
    c.fillStyle = lin(c, hx - hw, top - 10, hx + hw, hy, [0, hex(lite(c1, 0.15))], [1, hex(shade(c1, 0.6))]); c.fill(); c.strokeStyle = ln(c1); c.lineWidth = 0.8; c.stroke();
    rrect(c, hx - hw * 0.95, hy - hh * 0.98, hw * 1.9, hh * 0.3, 0.4, '#f2c94c', '#8a6a20', 0.5);
    ell(c, hx + hw * 0.1, hy - hh * 1.5, 0.7, 0.7, '#fff2a0'); ell(c, hx - hw * 0.4, hy - hh * 1.15, 0.5, 0.5, '#fff2a0');
  } else if (h === 'circlet') {
    c.beginPath(); c.moveTo(hx - hw * 1.0, hy - hh * 0.4); c.quadraticCurveTo(hx, hy - hh * 0.62, hx + hw * 1.0, hy - hh * 0.4); c.strokeStyle = '#f2c94c'; c.lineWidth = 1.1; c.stroke();
    c.strokeStyle = '#8a6a20'; c.lineWidth = 0.35; c.stroke();
    poly(c, [hx - 1.1, hy - hh * 0.56, hx, hy - hh * 0.86, hx + 1.1, hy - hh * 0.56], '#e04848', '#701818', 0.4); ell(c, hx - 0.2, hy - hh * 0.66, 0.3, 0.3, '#ffd0d0');
  } else if (h === 'crown') {
    const y0 = hy - hh * 0.6;
    poly(c, [hx - hw * 0.95, y0, hx - hw * 0.95, y0 - 5, hx - hw * 0.5, y0 - 2.4, hx, y0 - 6.5, hx + hw * 0.5, y0 - 2.4, hx + hw * 0.95, y0 - 5, hx + hw * 0.95, y0], lin(c, 0, y0 - 7, 0, y0, [0, '#fff0a0'], [1, '#c8962a']), '#6a4a10', 0.7);
    for (const [dx, col] of [[-0.5, '#e04848'], [0, '#4a8ae0'], [0.5, '#48c070']] as [number, string][]) ell(c, hx + dx * hw * 1.2, y0 - 1.2, 0.8, 0.8, col, '#301810', 0.3);
  } else if (h === 'feather') {
    c.beginPath(); c.moveTo(hx - hw * 1.08, hy - hh * 0.3); c.bezierCurveTo(hx - hw * 1.1, hy - hh * 1.3, hx + hw * 1.1, hy - hh * 1.3, hx + hw * 1.08, hy - hh * 0.3); c.quadraticCurveTo(hx, hy - hh * 0.55, hx - hw * 1.08, hy - hh * 0.3);
    c.fillStyle = hex(c2); c.fill(); c.strokeStyle = ln(c2); c.lineWidth = 0.75; c.stroke();
    poly(c, [hx + hw * 0.55, hy - hh * 0.9, hx + hw * 1.1, hy - hh * 2.2, hx + hw * 1.5, hy - hh * 1.6, hx + hw * 1.0, hy - hh * 0.8], hex(mix(c2, 0x8a2a2a, 0.5)), '#401818', 0.5);
    stroke(c, '#401818', 0.4, hx + hw * 0.7, hy - hh * 0.9, hx + hw * 1.3, hy - hh * 1.9);
  } else if (h === 'minerhat') {
    c.beginPath(); c.moveTo(hx - hw * 1.1, hy - hh * 0.15); c.bezierCurveTo(hx - hw * 1.2, hy - hh * 1.5, hx + hw * 1.2, hy - hh * 1.5, hx + hw * 1.1, hy - hh * 0.15); c.closePath();
    c.fillStyle = lin(c, 0, top, 0, hy, [0, '#f0c050'], [1, '#b07a20']); c.fill(); c.strokeStyle = '#5a3a10'; c.lineWidth = 0.75; c.stroke();
    rrect(c, hx - 2.2, hy - hh * 1.15, 4.4, 3, 1, '#40382a', '#1a1408', 0.4); glow(c, hx, hy - hh * 1.0, 6, 0xfff2a0, 0.7); ell(c, hx, hy - hh * 1.0, 1.1, 1.1, '#fffbd0');
  } else if (h === 'chef') {
    ell(c, hx - hw * 0.5, hy - hh * 1.4, hw * 0.55, hh * 0.45, '#f6f4ee', '#b8b4a8', 0.6); ell(c, hx + hw * 0.5, hy - hh * 1.4, hw * 0.55, hh * 0.45, '#f6f4ee', '#b8b4a8', 0.6);
    ell(c, hx, hy - hh * 1.7, hw * 0.65, hh * 0.5, '#fffdf8', '#b8b4a8', 0.6);
    rrect(c, hx - hw * 1.0, hy - hh * 0.95, hw * 2, hh * 0.45, 0.8, '#f6f4ee', '#b8b4a8', 0.6);
  } else if (h === 'goggles') {
    rrect(c, hx - hw * 1.1, hy - hh * 0.95, hw * 2.2, hh * 0.3, 0.4, '#5a3a22', '#2a1a10', 0.5);
    for (const sd of [-1, 1]) { ell(c, hx + sd * hw * 0.5, hy - hh * 0.9, hw * 0.34, hh * 0.3, '#c08a3a', '#3a2a10', 0.6); ell(c, hx + sd * hw * 0.5, hy - hh * 0.9, hw * 0.22, hh * 0.2, '#9ad8f0', undefined); stroke(c, 'rgba(255,255,255,0.8)', 0.4, hx + sd * hw * 0.42, hy - hh * 0.96, hx + sd * hw * 0.5, hy - hh * 1.0); }
  } else if (h === 'laurel') {
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) ell(c, hx + sd * (hw * 0.3 + i * hw * 0.17), hy - hh * (0.62 - i * 0.06), hw * 0.2, hh * 0.1, '#6aa84f', '#2a5a1e', 0.35, sd * (0.3 + i * 0.1));
  } else if (h === 'horned') { // a horned battle helm
    c.beginPath(); c.moveTo(hx - hw * 1.14, hy + hh * 0.3); c.lineTo(hx - hw * 1.14, hy - hh * 0.2); c.bezierCurveTo(hx - hw * 1.2, hy - hh * 1.5, hx + hw * 1.2, hy - hh * 1.5, hx + hw * 1.14, hy - hh * 0.2); c.lineTo(hx + hw * 1.14, hy + hh * 0.3); c.lineTo(hx + hw * 0.8, hy - hh * 0.2); c.quadraticCurveTo(hx, hy - hh * 0.45, hx - hw * 0.8, hy - hh * 0.2); c.closePath();
    c.fillStyle = lin(c, hx - hw, top, hx + hw, hy, [0, '#c0b8a8'], [1, '#6a604c']); c.fill(); c.strokeStyle = '#3a3226'; c.lineWidth = 0.8; c.stroke();
    for (const sd of [-1, 1]) poly(c, [hx + sd * hw * 1.1, hy - hh * 0.5, hx + sd * hw * 1.9, hy - hh * 0.9, hx + sd * hw * 1.7, hy - hh * 1.9, hx + sd * hw * 1.2, hy - hh * 1.0], '#efe8d8', '#7a705a', 0.6);
  } else if (h === 'mitre') {
    poly(c, [hx - hw * 0.95, hy - hh * 0.4, hx - hw * 0.6, hy - hh * 2.0, hx, hy - hh * 1.5, hx + hw * 0.6, hy - hh * 2.0, hx + hw * 0.95, hy - hh * 0.4], lin(c, 0, top - 8, 0, hy, [0, '#fffaf0'], [1, '#d8ccb0']), '#8a7a50', 0.7);
    rrect(c, hx - hw * 0.95, hy - hh * 0.72, hw * 1.9, hh * 0.3, 0.4, '#d9a030', '#7a5a10', 0.5);
  } else if (h === 'tiara') {
    c.beginPath(); c.moveTo(hx - hw * 0.9, hy - hh * 0.45); c.quadraticCurveTo(hx, hy - hh * 0.65, hx + hw * 0.9, hy - hh * 0.45); c.strokeStyle = '#e8e8f4'; c.lineWidth = 0.9; c.stroke();
    for (const [dx, hgt] of [[-0.5, 2.2], [0, 3.4], [0.5, 2.2]] as [number, number][]) poly(c, [hx + dx * hw * 1.4 - 0.9, hy - hh * 0.6, hx + dx * hw * 1.4, hy - hh * 0.6 - hgt, hx + dx * hw * 1.4 + 0.9, hy - hh * 0.6], '#e8e8f4', '#7a7a90', 0.4);
  }
}

// ---------- tools ----------
const WOOD = 0x8a5a3a, IRON = 0xc9ccd6, STEEL = 0x7a7f90;
const metal = (c: CanvasRenderingContext2D, x0: number, x1: number, a = 0xe8ecf4, b = 0x7a8294) => lin(c, x0, 0, x1, 0, [0, hex(a)], [0.5, hex(mix(a, b, 0.5))], [1, hex(b)]);
const shaft = (c: CanvasRenderingContext2D, y0: number, y1: number, w = 1.1, col = WOOD) => {
  c.fillStyle = lin(c, -w, 0, w, 0, [0, hex(lite(col, 0.25))], [1, hex(shade(col, 0.7))]); c.fillRect(-w / 2, y0, w, y1 - y0);
  c.strokeStyle = hex(lineOf(col)); c.lineWidth = 0.35; c.strokeRect(-w / 2, y0, w, y1 - y0);
};

/** a tool drawn at the hand: the grip is the origin, the tool extends toward -y, `ang` turns it */
export function drawTool(k: Cx, hx: number, hy: number, mode: string, name?: string) {
  const { c, L } = k, t = name ?? L.tool;
  if (!t || mode === 'none') return;
  const longPole = ['spear', 'staff', 'orbstaff', 'crook', 'banner', 'scythe', 'trident', 'scepter', 'wand', 'cane', 'censer', 'broom'].includes(t);
  const hand = t === 'sword' || t === 'greatsword' ? { rest: 2.75, raise: -0.2, strike: 1.95, hold: 2.4, read: 2.75, cast: -0.1 }
    : longPole ? { rest: 0, raise: -0.15, strike: 0.9, hold: 0.1, read: 0, cast: -0.25 } : { rest: Math.PI, raise: -0.35, strike: 1.7, hold: 0.6, read: 0, cast: -0.2 };
  let ang = (hand as Record<string, number>)[mode] ?? 0;
  if (mode === 'strike' && longPole && t !== 'spear' && t !== 'scythe') ang = 0.5;
  c.save(); c.translate(hx, hy); c.rotate(ang);
  const ts = 0.85 + 0.35 * Math.min(1, k.sz); c.scale(ts, ts); // tools were drawn for a shorter hand
  const edge = hex(lineOf(IRON));
  switch (t) {
    case 'spear': shaft(c, -30, 12); poly(c, [-1.5, -30, 0, -38, 1.5, -30], metal(c, -1.5, 1.5), edge, 0.5); stroke(c, '#c03030', 1, 0, -29, -1.2, -25); stroke(c, '#c03030', 1, 0, -29, 1.2, -25); break;
    case 'trident': shaft(c, -26, 12); stroke(c, hex(IRON), 0.9, -3, -26, -3, -33); stroke(c, hex(IRON), 0.9, 3, -26, 3, -33); stroke(c, hex(IRON), 0.9, 0, -26, 0, -35); stroke(c, hex(IRON), 1, -3, -26, 3, -26); break;
    case 'staff': shaft(c, -26, 12); ell(c, 0, -27, 2.4, 1.2, '#f2c94c', '#7a5a10', 0.45); break;
    case 'orbstaff': shaft(c, -24, 12); ell(c, 0, -27, 3, 3, rad(c, 0, -27, 3, [0, '#ffffff'], [0.5, '#8ac8ff'], [1, '#3a78c0']), '#1a3a70', 0.5); glow(c, 0, -27, 9, 0x8ac8ff, 0.5); poly(c, [-2.2, -24, -3, -28, -1.2, -26], '#f2c94c', undefined); poly(c, [2.2, -24, 3, -28, 1.2, -26], '#f2c94c', undefined); break;
    case 'crook': shaft(c, -24, 12); c.beginPath(); c.arc(2, -25, 2.6, Math.PI, Math.PI * 2.1); c.strokeStyle = hex(WOOD); c.lineWidth = 1.1; c.lineCap = 'round'; c.stroke(); break;
    case 'cane': shaft(c, -12, 12, 0.9); c.beginPath(); c.arc(1.6, -12, 1.6, Math.PI, Math.PI * 2.05); c.strokeStyle = hex(WOOD); c.lineWidth = 1; c.stroke(); break;
    case 'scepter': shaft(c, -20, 8, 0.9, 0xd9a030); ell(c, 0, -22, 2.5, 2.5, rad(c, 0, -22, 2.5, [0, '#ffd0d0'], [0.6, '#e04848'], [1, '#701818']), '#5a1010', 0.4); break;
    case 'wand': shaft(c, -12, 4, 0.8, 0x4a3220); glow(c, 0, -13, 6, 0xc07aff, 0.7); poly(c, [0, -16, 0.8, -13.5, 3, -13, 0.8, -12.5, 0, -10, -0.8, -12.5, -3, -13, -0.8, -13.5], '#fff0ff', undefined); break;
    case 'banner': shaft(c, -34, 12, 1); poly(c, [0.6, -33, 9, -31, 7.4, -27, 9, -22, 0.6, -22], hex(L.cloth), hex(lineOf(L.cloth)), 0.5); ell(c, 4.2, -27.4, 1.4, 1.4, '#f2c94c'); break;
    case 'scythe': shaft(c, -30, 12); c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(10, -36, 12, -26); c.quadraticCurveTo(7, -32, 0, -28); c.fillStyle = metal(c, 0, 12); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); break;
    case 'censer': shaft(c, -4, 12, 0.8); stroke(c, '#c8c8d0', 0.4, 0, -4, -3, 2); stroke(c, '#c8c8d0', 0.4, 0, -4, 3, 2); ell(c, 0, 4.5, 3, 2.4, '#d9a030', '#7a5a10', 0.5); glow(c, 0, 4, 5, 0xffb040, 0.4); stroke(c, 'rgba(220,220,230,0.5)', 0.8, 0, 2, 1, -2, -1, -6); break;
    case 'sword': case 'greatsword': {
      const len = t === 'sword' ? 15 : 21, w = t === 'sword' ? 1.5 : 2.2;
      rrect(c, -0.6, 0, 1.2, 3.4, 0.4, '#5a3a22'); stroke(c, '#d9a030', 1.1, -2.6, -0.4, 2.6, -0.4);
      poly(c, [-w, -0.8, -w * 0.7, -len, 0, -len - 2.4, w * 0.7, -len, w, -0.8], metal(c, -w, w), edge, 0.5); stroke(c, 'rgba(255,255,255,0.85)', 0.4, -0.2, -2, -0.2, -len + 2);
      break;
    }
    case 'hammer': shaft(c, -9, 6); rrect(c, -3.8, -13.5, 7.6, 5.2, 0.8, metal(c, -3.8, 3.8, 0xb8bccc, 0x5a6074), edge, 0.5); break;
    case 'axe': shaft(c, -15, 6); c.beginPath(); c.moveTo(0.4, -15); c.quadraticCurveTo(8, -14, 7, -6); c.quadraticCurveTo(3, -8, 0.4, -7); c.closePath(); c.fillStyle = metal(c, 0, 8); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); break;
    case 'pickaxe': shaft(c, -13, 6); c.beginPath(); c.moveTo(-8, -9.5); c.quadraticCurveTo(0, -17, 8, -9.5); c.quadraticCurveTo(0, -14, -8, -9.5); c.fillStyle = metal(c, -8, 8, 0xb8bccc, 0x4a5064); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); break;
    case 'hoe': shaft(c, -15, 6); poly(c, [-0.5, -15, 4.5, -15, 4.5, -12, 3.2, -12, 3.2, -13.4, -0.5, -13.4], metal(c, 0, 4.5, 0xb8bccc, 0x5a6074), edge, 0.4); break;
    case 'shovel': shaft(c, -14, 6); c.beginPath(); c.moveTo(-2.6, -14); c.lineTo(2.6, -14); c.quadraticCurveTo(3, -20, 0, -21); c.quadraticCurveTo(-3, -20, -2.6, -14); c.fillStyle = metal(c, -3, 3, 0xb8bccc, 0x5a6074); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); break;
    case 'broom': shaft(c, -16, 4, 0.9); poly(c, [-3, 4, 3, 4, 4.6, 12, -4.6, 12], lin(c, 0, 4, 0, 12, [0, '#e8c070'], [1, '#a8782a']), '#6a4a14', 0.5); for (let i = -2; i <= 2; i++) stroke(c, 'rgba(100,70,20,0.5)', 0.35, i * 1.2, 6, i * 1.7, 12); break;
    case 'ladle': shaft(c, -10, 5, 0.8, 0x6a4a2a); ell(c, 0, -11.5, 2.6, 1.8, metal(c, -2.6, 2.6, 0xd8dce4, 0x6a7084), edge, 0.5); break;
    case 'bow': {
      c.beginPath(); c.moveTo(1, -12); c.quadraticCurveTo(7, 0, 1, 12); c.strokeStyle = hex(0x6a4a2a); c.lineWidth = 1.2; c.lineCap = 'round'; c.stroke();
      stroke(c, 'rgba(240,240,240,0.85)', 0.3, 1, -12, 1, 12);
      if (mode === 'strike' || mode === 'raise') { stroke(c, '#f0f0f0', 0.3, 1, -12, -3, 0, 1, 12); stroke(c, '#7a5a3a', 0.6, -3, 0, 10, 0); poly(c, [10, -1, 12.5, 0, 10, 1], '#c9ccd6', undefined); }
      break;
    }
    case 'rod': c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(4, -14, 12, -20); c.strokeStyle = hex(WOOD); c.lineWidth = 0.9; c.lineCap = 'round'; c.stroke(); stroke(c, 'rgba(230,230,230,0.8)', 0.25, 12, -20, 13, -8); ell(c, 13, -7, 0.7, 0.7, '#e04848'); break;
    case 'book': case 'ledger': {
      const open = mode === 'read' || mode === 'hold';
      c.save(); if (open) { c.rotate(-ang); c.translate(0, -2.5); }
      if (open) { poly(c, [-5, -3, 0, -2, 5, -3, 5, 3, 0, 4, -5, 3], '#f6eed8', '#7a5a3a', 0.5); stroke(c, 'rgba(120,90,50,0.5)', 0.3, -4, -1.5, -0.8, -0.8); stroke(c, 'rgba(120,90,50,0.5)', 0.3, -4, 0, -0.8, 0.7); stroke(c, 'rgba(120,90,50,0.5)', 0.3, 0.8, -0.8, 4, -1.5); stroke(c, 'rgba(120,90,50,0.5)', 0.3, 0.8, 0.7, 4, 0); }
      else { rrect(c, -2, -5, 4.4, 6, 0.5, t === 'ledger' ? '#5a1a2a' : '#8a2a2a', '#301010', 0.5); stroke(c, '#f2c94c', 0.5, -1, -4, 1.4, -4); }
      c.restore(); break;
    }
    case 'scroll': rrect(c, -2, -8, 4, 10, 1.2, '#efe3c0', '#8a7040', 0.5); ell(c, 0, -8, 2, 0.8, '#d8c898', '#8a7040', 0.4); stroke(c, '#b02a2a', 0.5, -1, -3, 1, -3); break;
    case 'lute': ell(c, -1, -2, 4.6, 5.6, lin(c, -5, 0, 4, 0, [0, '#d08a52'], [1, '#8a5430']), '#4a2a14', 0.6); ell(c, -1, -2, 1.5, 1.5, '#2a1a10'); rrect(c, -0.5, -17, 1.4, 12, 0.4, '#5e3a26', '#2a1a10', 0.4); rrect(c, -1.4, -19, 3.2, 3, 0.5, '#4a2a1a', '#2a1a10', 0.4); for (const dx of [-0.2, 0.2, 0.6]) stroke(c, 'rgba(240,230,200,0.6)', 0.2, dx, -16, dx - 0.6, 2); break;
    case 'mug': rrect(c, -2.4, -5, 4.8, 5.4, 0.8, '#b07a40', '#5a3a14', 0.5); ell(c, 0, -5, 2.4, 0.9, '#f6f2e8', '#8a7a60', 0.4); c.beginPath(); c.arc(2.6, -2.4, 1.6, -1.5, 1.5); c.strokeStyle = '#8a5a2a'; c.lineWidth = 0.7; c.stroke(); break;
    case 'bowl': c.beginPath(); c.moveTo(-3.4, -1); c.quadraticCurveTo(0, 5, 3.4, -1); c.closePath(); c.fillStyle = '#9a7a54'; c.fill(); c.strokeStyle = '#4a3220'; c.lineWidth = 0.5; c.stroke(); break;
    case 'flask': ell(c, 0, -3, 2.6, 2.8, 'rgba(120,230,170,0.85)', '#1f6a4a', 0.5); rrect(c, -0.9, -8, 1.8, 3.4, 0.4, '#e0e4e0', '#6a7a70', 0.4); ell(c, -0.7, -3.6, 0.6, 0.9, 'rgba(255,255,255,0.8)'); break;
    case 'lantern': stroke(c, '#5a4a3a', 0.5, 0, 0, 0, -3); rrect(c, -2.6, -9, 5.2, 6.4, 1, 'rgba(255,214,120,0.9)', '#5a4a3a', 0.6); glow(c, 0, -6, 9, 0xffd070, 0.55); rrect(c, -2.9, -9.6, 5.8, 1.2, 0.5, '#4a3a2a'); break;
    default: break;
  }
  c.restore();
}

export { INK };
