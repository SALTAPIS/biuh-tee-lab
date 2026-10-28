// Turns a design spec into SVG markup. A spec is small JSON, so submissions store
// the recipe and the print file is re-rendered from it at any resolution.
//
// spec = { template, palette, shirt, fields: {..}, assets: { slot: assetId }, seed }
import { colorsFor, fontStack, FONTS, SHIRTS } from './style.js';
import { TEMPLATES } from './templates.js';

export const W = 1200; // design canvas, 3:4 like a 12×16" print area
export const H = 1600;
const MARGIN = 60;

let catalogue = { list: [], byId: {} };

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

async function aspectOf(blob, url) {
  if (blob.type.includes('svg')) {
    const svg = await blob.text();
    const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (vb) return Number(vb[1]) / Number(vb[2]);
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  return img.naturalWidth / img.naturalHeight || 1;
}

export async function loadCatalogue() {
  const list = await (await fetch('/api/catalogue')).json();
  await Promise.all(
    list.map(async (asset) => {
      asset.url = `/catalogue/assets/${asset.file}`;
      const blob = await (await fetch(asset.url)).blob();
      asset.dataUrl = await toDataUrl(blob);
      asset.aspect = await aspectOf(blob, asset.dataUrl);
    }),
  );
  catalogue = { list, byId: Object.fromEntries(list.map((a) => [a.id, a])) };
  return catalogue;
}

export const getCatalogue = () => catalogue;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// mulberry32: tiny seeded RNG so "random" decorations stay put between renders.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const measureCtx = document.createElement('canvas').getContext('2d');

export function measure(text, font, size, spacing = 0) {
  measureCtx.font = `${FONTS[font].weight || 400} ${size}px ${fontStack(font)}`;
  const m = measureCtx.measureText(text);
  return {
    w: m.width + spacing * size * Math.max(0, [...text].length - 1),
    asc: m.actualBoundingBoxAscent,
    desc: m.actualBoundingBoxDescent,
  };
}

// Largest font size (up to max) at which text fits maxWidth.
export function fit(text, font, maxWidth, max, spacing = 0) {
  if (!text) return max;
  return Math.min(max, (maxWidth * 100) / measure(text, font, 100, spacing).w);
}

// Fill in anything the spec doesn't set (first preset, first asset matching the slot).
export function normalize(spec) {
  const tpl = TEMPLATES[spec.template] || Object.values(TEMPLATES)[0];
  const fields = {};
  for (const [key, field] of Object.entries(tpl.fields)) {
    const fallback = field.options ? field.options[0][0] : field.presets[0];
    fields[key] = spec.fields?.[key] ?? fallback;
  }
  const assets = {};
  for (const [slot, def] of Object.entries(tpl.slots)) {
    const chosen = spec.assets?.[slot];
    assets[slot] = catalogue.byId[chosen]
      ? chosen
      : catalogue.list.find((a) => a.tags.some((t) => def.tags.includes(t)))?.id;
  }
  return { ...spec, template: tpl.id, fields, assets, seed: spec.seed ?? 1 };
}

let uid = 0;

function drawingContext(spec, embed) {
  const prefix = `d${++uid}`;
  const out = [];
  const defs = [];
  const tints = new Map();
  let n = 0;
  const c = colorsFor(spec.palette, spec.shirt);

  const id = (name) => `${prefix}-${name}-${n++}`;
  // Recolour any asset to a single ink by keeping only its alpha.
  const tint = (color) => {
    if (!tints.has(color)) {
      const fid = id('tint');
      tints.set(color, fid);
      defs.push(
        `<filter id="${fid}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">` +
          `<feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`,
      );
    }
    return tints.get(color);
  };

  const fontAttrs = (font, size, spacing) =>
    `font-family="${fontStack(font)}" font-weight="${FONTS[font].weight || 400}" font-size="${size.toFixed(1)}"` +
    (spacing ? ` letter-spacing="${(spacing * size).toFixed(1)}"` : '');

  return {
    W,
    H,
    c,
    f: spec.fields,
    rand: seeded(spec.seed),
    id,
    fit,
    measure,
    esc,
    out,
    def: (markup) => defs.push(markup),
    raw: (markup) => out.push(markup),
    asset: (slot) => catalogue.byId[spec.assets[slot]],
    fontAttrs,

    // Draw a single line. Position by its visual top or by baseline; returns the visual bottom.
    text(str, { x = W / 2, top, baseline, font, size, fill = c.ink, anchor = 'middle', spacing = 0, attrs = '' }) {
      if (!str) return top ?? baseline;
      const m = measure(str, font, size, spacing);
      const y = baseline ?? top + m.asc;
      // SVG letter-spacing also trails the last glyph; shift so the visible glyphs stay centred.
      const dx = { start: 0, middle: (spacing * size) / 2, end: spacing * size }[anchor];
      out.push(
        `<text x="${(x + dx).toFixed(1)}" y="${y.toFixed(1)}" ${fontAttrs(font, size, spacing)} ` +
          `fill="${fill}" text-anchor="${anchor}" ${attrs}>${esc(str)}</text>`,
      );
      return y + m.desc;
    },

    // Place an asset inside a w×h box (keeping its aspect), anchored by cy, top or bottom.
    icon(slot, { cx = W / 2, cy, top, bottom, w, h, color = c.ink, flip = false, asset }) {
      const a = asset || catalogue.byId[spec.assets[slot]];
      if (!a) return { x: cx, y: top ?? cy ?? bottom, w: 0, h: 0, bottom: top ?? cy ?? bottom };
      const [fw, fh] = w / h > a.aspect ? [h * a.aspect, h] : [w, w / a.aspect];
      const y = top ?? (bottom != null ? bottom - fh : cy - fh / 2);
      const x = cx - fw / 2;
      const filter = a.recolor ? ` filter="url(#${tint(color)})"` : '';
      const img =
        `<image href="${embed ? a.dataUrl : a.url}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${fw.toFixed(1)}" height="${fh.toFixed(1)}" preserveAspectRatio="none"${filter}/>`;
      out.push(flip ? `<g transform="translate(${(2 * cx).toFixed(1)} 0) scale(-1 1)">${img}</g>` : img);
      return { x, y, w: fw, h: fh, bottom: y + fh, asset: a };
    },

    defs: () => defs.join(''),
  };
}

// Design only, transparent background: this is what gets printed.
export function renderDesign(rawSpec, { embed = false, css = '', attrs = '' } = {}) {
  const spec = normalize(rawSpec);
  const t = drawingContext(spec, embed);
  const bottom = TEMPLATES[spec.template].draw(t);
  // Top-align on the chest like real tee prints; shrink if a template runs long.
  const s = Math.min(1, (H - 2 * MARGIN) / bottom);
  const transform = `translate(${W / 2} ${MARGIN}) scale(${s.toFixed(4)}) translate(${-W / 2} 0)`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${attrs}>` +
    `<defs>${css ? `<style>${css}</style>` : ''}${t.defs()}</defs>` +
    `<g transform="${transform}">${t.out.join('')}</g></svg>`
  );
}

const TEE =
  'M360 40 C420 95 580 95 640 40 L820 95 L985 330 L855 410 L790 330 L795 1070 Q500 1085 205 1070 ' +
  'L210 330 L145 410 L15 330 L180 95 Z';

// Design on a flat tee for previews.
export function renderMockup(spec) {
  const shirt = SHIRTS[spec.shirt]?.color || SHIRTS.white.color;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1100" class="mockup" role="img">` +
    `<path d="${TEE}" fill="${shirt}" stroke="rgba(0,0,0,.14)" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M360 40 C420 70 580 70 640 40 C580 95 420 95 360 40 Z" fill="rgba(0,0,0,.16)"/>` +
    `<path d="M360 40 C420 95 580 95 640 40" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="14"/>` +
    renderDesign(spec, { attrs: 'x="300" y="170" width="400" height="533"' }) +
    `</svg>`
  );
}

// Fresh random design. Keeps whatever `lock` pins (e.g. { template: 'badge' }).
export function randomSpec(lock = {}, rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const tpl = TEMPLATES[lock.template] || pick(Object.values(TEMPLATES));
  const fields = {};
  const linkedIndex = Math.floor(rand() * 1000);
  for (const [key, field] of Object.entries(tpl.fields)) {
    const choices = field.options ? field.options.map(([v]) => v) : field.presets;
    fields[key] = tpl.linked ? choices[linkedIndex % choices.length] : pick(choices);
  }
  const assets = {};
  for (const [slot, def] of Object.entries(tpl.slots)) {
    // Prefer the slot's favourite tag, but let other matching assets in sometimes.
    const best = catalogue.list.filter((a) => a.tags.includes(def.tags[0]));
    const any = catalogue.list.filter((a) => a.tags.some((t) => def.tags.includes(t)));
    const pool = best.length && rand() < 0.6 ? best : any;
    if (pool.length) assets[slot] = pick(pool).id;
  }
  return {
    template: tpl.id,
    palette: lock.palette || pick(tpl.palettes || ['biuh', 'tropic', 'coconut', 'launch', 'lagoon', 'dusk', 'mono']),
    shirt: lock.shirt || pick(['white', 'white', 'natural', 'heather', 'sky', 'navy', 'forest', 'black']),
    fields,
    assets,
    seed: Math.floor(rand() * 2 ** 31),
  };
}
