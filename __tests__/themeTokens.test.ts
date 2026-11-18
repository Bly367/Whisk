import { brand, lightPalette } from '@/constants/tokens';
import { getThemeColors } from '@/theme/colors';

function channel(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance(hex: string): number {
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = channel(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('UI-DESIGN theme tokens', () => {
  const canvas = lightPalette.surface.canvas;

  it('maps brand and light palette to UI-DESIGN values', () => {
    expect(brand.yolk).toBe('#F0954A');
    expect(brand.yolkPressed).toBe('#D97E35');
    expect(brand.yolkSoft).toBe('#FCE3CF');
    expect(brand.chick).toBe('#FFD968');
    expect(canvas).toBe('#F6E9DE');
    expect(lightPalette.surface.card).toBe('#FFFFFF');
    expect(lightPalette.surface.sunken).toBe('#FBF1EA');
    expect(lightPalette.text.primary).toBe('#1E1A17');
    expect(lightPalette.text.secondary).toBe('#726962');
    expect(lightPalette.border.subtle).toBe('#EDE3DA');
  });

  it('meets WCAG contrast for text on canvas and text on yolk', () => {
    const primaryRatio = contrastRatio(lightPalette.text.primary, canvas);
    const secondaryRatio = contrastRatio(lightPalette.text.secondary, canvas);
    const onYolkRatio = contrastRatio(getThemeColors('light').textOnYolk, brand.yolk);

    expect(primaryRatio).toBeGreaterThanOrEqual(4.5);
    expect(secondaryRatio).toBeGreaterThanOrEqual(4.5);
    expect(onYolkRatio).toBeGreaterThanOrEqual(3);
  });
});