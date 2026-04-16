export function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHsl(r: number, g: number, b: number) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === nr) h = (ng - nb) / d + (ng < nb ? 6 : 0);
    if (max === ng) h = (nb - nr) / d + 2;
    if (max === nb) h = (nr - ng) / d + 4;
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function componentToHex(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function adjustHex(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    clampColor(rgb.r + amount),
    clampColor(rgb.g + amount),
    clampColor(rgb.b + amount),
  );
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string) {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg === null || bg === null) return null;
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

export function hslToRgb(h: number, s: number, l: number) {
  const normalizedHue = (((h % 360) + 360) % 360) / 360;
  const normalizedSaturation = Math.max(0, Math.min(100, s)) / 100;
  const normalizedLightness = Math.max(0, Math.min(100, l)) / 100;

  if (normalizedSaturation === 0) {
    const value = Math.round(normalizedLightness * 255);
    return { r: value, g: value, b: value };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let shifted = t;
    if (shifted < 0) shifted += 1;
    if (shifted > 1) shifted -= 1;
    if (shifted < 1 / 6) return p + (q - p) * 6 * shifted;
    if (shifted < 1 / 2) return q;
    if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6;
    return p;
  };

  const q = normalizedLightness < 0.5
    ? normalizedLightness * (1 + normalizedSaturation)
    : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
  const p = 2 * normalizedLightness - q;

  return {
    r: Math.round(hueToRgb(p, q, normalizedHue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, normalizedHue) * 255),
    b: Math.round(hueToRgb(p, q, normalizedHue - 1 / 3) * 255),
  };
}

export function hslToHex(h: number, s: number, l: number) {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}
