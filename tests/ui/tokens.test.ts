// The tokens of the interface (src/ui/tokens.ts): the colours of the docs stay, and every colour used for text reads on the panel (WCAG 4.5:1).
import { describe, expect, it } from 'vitest';
import { color, font, TITLE_LINE } from '../../src/ui/tokens';

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('tokens', () => {
  it('the dread of the doc is kept for fills and glows; its text variant reads on the panel', () => {
    expect(color.dread).toBe('#8a2433');
    expect(ratio(color.dread, color.panel)).toBeLessThan(3);
    expect(ratio(color.dreadText, color.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('the other text colours read on the panel', () => {
    for (const c of [color.text, color.textDim, color.light, color.fate]) expect(ratio(c, color.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('the fonts are system Thai stacks (no file ships) and a title has room for the marks above the line', () => {
    expect(font.body).toContain('Thonburi');
    expect(font.body).toContain('Leelawadee UI');
    expect(font.body).toContain('Noto Sans Thai');
    expect(font.title).not.toContain('Charm');
    expect(TITLE_LINE).toBeGreaterThanOrEqual(1.4);
  });
});
