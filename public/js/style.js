// Colours and fonts every template can draw with.

// dark/light: the main ink (picked by shirt brightness); accent/accent2: highlights.
export const PALETTES = {
  biuh: { name: 'BiUH', dark: '#013b5a', light: '#eaf6fa', accent: '#00a3c9', accent2: '#00915e' },
  tropic: { name: 'Tropic', dark: '#1d2b4f', light: '#fff4e0', accent: '#ff6b35', accent2: '#ffc145' },
  coconut: { name: 'Coconut', dark: '#2f3e2b', light: '#f4efe1', accent: '#6f9a4f', accent2: '#c08a4e' },
  launch: { name: 'Launch', dark: '#16163a', light: '#f1f1f6', accent: '#ef4b4b', accent2: '#f7b538' },
  lagoon: { name: 'Lagoon', dark: '#08415c', light: '#e8fbf8', accent: '#1fb6a6', accent2: '#f2a541' },
  dusk: { name: 'Dusk', dark: '#3d1e4f', light: '#fff1e6', accent: '#ff4e7e', accent2: '#ffb347' },
  mono: { name: 'Mono', dark: '#151515', light: '#ffffff', accent: null, accent2: null },
};

export const SHIRTS = {
  white: { name: 'White', color: '#ffffff' },
  natural: { name: 'Natural', color: '#efe8d8' },
  heather: { name: 'Heather', color: '#c9cacc' },
  sky: { name: 'Sky', color: '#a9d4e8' },
  navy: { name: 'Navy', color: '#1c2a44' },
  forest: { name: 'Forest', color: '#2c4a3a' },
  black: { name: 'Black', color: '#151515' },
};

// CJK text falls back to the system font in every family.
const CJK = "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";
export const FONTS = {
  impact: { family: 'Anton', file: 'anton-latin-400-normal.woff2' },
  slab: { family: 'Alfa Slab One', file: 'alfa-slab-one-latin-400-normal.woff2' },
  script: { family: 'Pacifico', file: 'pacifico-latin-400-normal.woff2' },
  varsity: { family: 'Graduate', file: 'graduate-latin-400-normal.woff2' },
  mono: { family: 'Space Mono', file: 'space-mono-latin-700-normal.woff2', weight: 700 },
};
export const fontStack = (key) => `'${FONTS[key].family}', ${CJK}`;

export async function loadFonts() {
  await Promise.all(Object.values(FONTS).map((f) => document.fonts.load(`${f.weight || 400} 40px '${f.family}'`)));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const isDarkShirt = (shirtKey) => luminance(SHIRTS[shirtKey].color) < 0.25;

// Resolve a palette against a shirt: ink always contrasts, washed-out accents fall back to ink.
export function colorsFor(paletteKey, shirtKey) {
  const p = PALETTES[paletteKey] || PALETTES.biuh;
  const shirt = SHIRTS[shirtKey]?.color || SHIRTS.white.color;
  const ink = isDarkShirt(shirtKey) ? p.light : p.dark;
  const usable = (c) => (c && contrast(c, shirt) >= 1.6 ? c : ink);
  return { ink, accent: usable(p.accent), accent2: usable(p.accent2), shirt };
}
