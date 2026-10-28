// Print files: standalone SVG (fonts + assets embedded) and a 300 dpi PNG.
import { FONTS } from './style.js';
import { renderDesign, W, H } from './render.js';

export const PRINT_SCALE = 3; // 1200×1600 → 3600×4800 px = 12×16" at 300 dpi

let fontCss;
async function embeddedFonts() {
  fontCss ??= (
    await Promise.all(
      Object.values(FONTS).map(async (f) => {
        const blob = await (await fetch(`/fonts/${f.file}`)).blob();
        const url = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        return `@font-face{font-family:'${f.family}';font-weight:${f.weight || 400};src:url(${url}) format('woff2');}`;
      }),
    )
  ).join('');
  return fontCss;
}

export async function printSvg(spec) {
  return renderDesign(spec, {
    embed: true,
    css: await embeddedFonts(),
    attrs: `width="${W * PRINT_SCALE}" height="${H * PRINT_SCALE}"`,
  });
}

export async function printPng(spec, scale = PRINT_SCALE) {
  const svg = await printSvg(spec);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(blobOrText, filename, type) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fileSlug = (s) => String(s || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
