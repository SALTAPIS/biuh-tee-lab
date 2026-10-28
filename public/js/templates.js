// Design templates. Each one borrows a *format* from well-known tees (not the artwork)
// and fills it with Hainan / BiUH material from the asset catalogue.
//
// fields: editable text (presets feed the generator) or choices (options: [value, label]).
// slots: asset placeholders; tags say which catalogue assets fit, first tag preferred.
// draw(t): appends SVG to t.out, laying out from y=0 down; returns the bottom y.

const PLACES = ['HAINAN', 'BiUH', 'SANYA', 'HAIKOU', 'LINGSHUI', 'WENCHANG', '海南', '椰岛'];

const PINS = {
  lingshui: { label: 'BiUH', coords: '18.42°N 110.05°E' },
  wenchang: { label: 'LAUNCH SITE', coords: '19.61°N 110.95°E' },
  sanya: { label: 'SANYA', coords: '18.25°N 109.51°E' },
  haikou: { label: 'HAIKOU', coords: '20.04°N 110.32°E' },
  danzhou: { label: 'YANGPU', coords: '19.73°N 109.20°E' },
};

const lines = (s) => String(s || '').split('|').map((l) => l.trim()).filter(Boolean);

// Text that runs along a circle arc. sweep 1 = over the top, 0 = under the bottom.
function arcText(t, str, { cx, cy, r, sweep, font, size, spacing = 0, fill, stroke = '' }) {
  if (!str) return;
  const pathId = t.id('arc');
  t.def(`<path id="${pathId}" d="M${cx - r} ${cy} A${r} ${r} 0 0 ${sweep} ${cx + r} ${cy}"/>`);
  t.raw(
    `<text ${t.fontAttrs(font, size, spacing)} fill="${fill}" ${stroke}>` +
      `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle" dominant-baseline="central">` +
      `${t.esc(str)}</textPath></text>`,
  );
}

export const TEMPLATES = {
  heart: {
    id: 'heart',
    name: 'I ♥ Place',
    inspiredBy: 'The classic “I ♥ city” souvenir tee',
    fields: {
      top: { label: 'Top word', presets: ['I', 'WE', '我'] },
      place: { label: 'Place', presets: PLACES },
      sub: { label: 'Small print', presets: ['', 'HAINAN · CHINA', 'EST. 2023', '18°N 110°E', 'COCONUT ISLAND'] },
    },
    slots: { icon: { label: 'Symbol', tags: ['heart', 'island', 'coconut', 'palm'] } },
    draw(t) {
      const { c, f } = t;
      const size = Math.max(280, t.fit(f.place, 'slab', 1000, 400));
      const placeSize = t.fit(f.place, 'slab', 1000, size);
      const topSize = t.fit(f.top, 'slab', 480, size);
      const cap = t.measure('H', 'slab', size).asc;
      // Centre "TOP [icon]" as one row.
      const asset = t.asset('icon');
      const iconW = asset ? Math.min(cap * asset.aspect, 480) : 0;
      const topW = t.measure(f.top, 'slab', topSize).w;
      const gap = topW && iconW ? size * 0.14 : 0;
      const left = t.W / 2 - (topW + gap + iconW) / 2;
      t.text(f.top, { x: left, baseline: cap, font: 'slab', size: topSize, anchor: 'start' });
      t.icon('icon', { cx: left + topW + gap + iconW / 2, cy: cap / 2, w: iconW, h: cap, color: c.accent });
      let y = t.text(f.place, { top: cap + size * 0.16, font: 'slab', size: placeSize });
      y = t.text(f.sub, { top: y + 50, font: 'mono', size: t.fit(f.sub, 'mono', 900, 54, 0.15), spacing: 0.15 });
      return y;
    },
  },

  varsity: {
    id: 'varsity',
    name: 'Varsity',
    inspiredBy: 'American college sweatshirt lettering',
    fields: {
      arch: { label: 'Arched name', presets: ['BiUH', 'HAINAN', 'COCONUT U', 'LINGSHUI'] },
      left: { label: 'Left of emblem', presets: ['EST.', 'CLASS OF', 'SINCE'] },
      right: { label: 'Right of emblem', presets: ['2023', '2027', '2030'] },
      bottom: {
        label: 'Bottom line',
        presets: ['HAINAN · CHINA', 'APPLIED SCIENCES', 'COMPUTER SCIENCE', 'DIGITAL TECHNOLOGIES', '海南比勒费尔德应用科学大学'],
      },
    },
    slots: { emblem: { label: 'Emblem', tags: ['island', 'palm', 'logo', 'coconut', 'rocket'] } },
    draw(t) {
      const { c, f } = t;
      const size = t.fit(f.arch, 'varsity', 980, 230, 0.03);
      const asc = t.measure('H', 'varsity', size).asc;
      // A wide radius keeps the arch gentle so its ends clear the emblem and flanks.
      const r = 900;
      const letterTop = 20;
      // dominant-baseline central runs the arc through the middle of the letters.
      arcText(t, f.arch, {
        cx: t.W / 2, cy: letterTop + asc / 2 + r, r, sweep: 1, font: 'varsity', size, spacing: 0.03, fill: c.ink,
        stroke: `stroke="${c.accent}" stroke-width="${(size * 0.07).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"`,
      });
      const emblemCy = letterTop + asc + 60 + 160;
      const emblem = t.icon('emblem', { cy: emblemCy, w: 380, h: 320, color: c.ink });
      const flankSize = 64;
      const flankY = emblemCy + t.measure('H', 'varsity', flankSize).asc / 2;
      const flankGap = Math.max(emblem.w / 2 + 40, 190);
      t.text(f.left, { x: t.W / 2 - flankGap, baseline: flankY, font: 'varsity', size: flankSize, fill: c.accent, anchor: 'end' });
      t.text(f.right, { x: t.W / 2 + flankGap, baseline: flankY, font: 'varsity', size: flankSize, fill: c.accent, anchor: 'start' });
      const lineY = Math.max(emblem.bottom, emblemCy + 160) + 50;
      return t.text(f.bottom, { top: lineY, font: 'varsity', size: t.fit(f.bottom, 'varsity', 1000, 110, 0.04), spacing: 0.04 });
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Retro sunset',
    inspiredBy: '80s beach-town souvenir shirts',
    palettes: ['tropic', 'dusk', 'lagoon', 'coconut', 'biuh'],
    fields: {
      title: { label: 'Script title', presets: ['Hainan', 'Sanya', 'Lingshui', 'BiUH', 'Wenchang', 'Haikou'] },
      subtitle: {
        label: 'Subtitle',
        presets: ['COCONUT ISLAND · 椰岛', 'SUNNY SIDE OF CHINA', 'BIELEFELD-ON-SEA', 'EST. 2023 · LINGSHUI', 'SOUTH CHINA SEA'],
      },
    },
    slots: {
      tree: { label: 'Silhouette', tags: ['palm', 'rocket', 'coconut'] },
      ground: { label: 'Water', tags: ['decor'] },
    },
    draw(t) {
      const { c, f } = t;
      const cx = t.W / 2;
      const sunCy = 400;
      const R = 360;
      const grad = t.id('sun');
      const mask = t.id('stripes');
      t.def(
        `<linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${c.accent2}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`,
      );
      let stripes = '';
      for (let i = 0; i < 6; i++) stripes += `<rect x="0" y="${sunCy + 40 + i * 56}" width="${t.W}" height="${8 + i * 6}" fill="#000"/>`;
      t.def(`<mask id="${mask}"><rect width="${t.W}" height="${t.H}" fill="#fff"/>${stripes}</mask>`);
      t.raw(`<circle cx="${cx}" cy="${sunCy}" r="${R}" fill="url(#${grad})" mask="url(#${mask})"/>`);
      t.icon('ground', { cy: sunCy + R + 20, w: 820, h: 110, color: c.ink });
      const flip = t.rand() < 0.5;
      t.icon('tree', { cx: cx + (flip ? -230 : 230), bottom: sunCy + R + 40, w: 440, h: 700, color: c.ink, flip });
      const size = t.fit(f.title, 'script', 980, 280);
      const top = sunCy + R + 110;
      t.text(f.title, { x: cx + 8, top: top + 8, font: 'script', size, fill: c.accent });
      let y = t.text(f.title, { top, font: 'script', size });
      y = t.text(f.subtitle, {
        top: y + 50, font: 'mono', size: t.fit(f.subtitle, 'mono', 900, 54, 0.18), spacing: 0.18,
      });
      return y;
    },
  },

  badge: {
    id: 'badge',
    name: 'Stamp badge',
    inspiredBy: 'National-park patches and passport stamps',
    fields: {
      top: { label: 'Top ring', presets: ['HAINAN ISLAND', 'BiUH · LINGSHUI', 'COCONUT ISLAND', 'WENCHANG SPACEPORT'] },
      bottom: { label: 'Bottom ring', presets: ['SOUTH CHINA SEA', 'EST. 2023', '椰岛 · 海南', 'BE YOU!'] },
      center: { label: 'Centre line', presets: ['18°N · 110°E', 'EST. 2023', 'BIELEFELD × HAINAN', ''] },
    },
    slots: {
      emblem: { label: 'Emblem', tags: ['island', 'palm', 'rocket', 'coconut', 'logo'] },
      star: { label: 'Ornament', tags: ['star', 'heart', 'coconut'] },
    },
    draw(t) {
      const { c, f } = t;
      const cx = t.W / 2;
      const R = 520;
      const cy = R + 10;
      const ring = 440;
      t.raw(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c.ink}" stroke-width="18"/>`);
      t.raw(`<circle cx="${cx}" cy="${cy}" r="${R - 160}" fill="none" stroke="${c.ink}" stroke-width="7"/>`);
      const arcLen = Math.PI * ring * 0.74;
      for (const [str, sweep] of [[f.top, 1], [f.bottom, 0]]) {
        const size = Math.min(t.fit(str, 'impact', arcLen, 104, 0.12), 104);
        arcText(t, str, { cx, cy, r: ring, sweep, font: 'impact', size, spacing: 0.12, fill: c.ink });
      }
      for (const dx of [-ring, ring]) {
        if (t.asset('star')) t.icon('star', { cx: cx + dx, cy, w: 56, h: 56, color: c.accent });
        else t.raw(`<circle cx="${cx + dx}" cy="${cy}" r="18" fill="${c.accent}"/>`);
      }
      const hasCenter = Boolean(f.center);
      t.icon('emblem', { cx, cy: cy - (hasCenter ? 40 : 0), w: 470, h: hasCenter ? 380 : 450, color: c.ink });
      t.text(f.center, {
        top: cy + 190, font: 'mono', size: t.fit(f.center, 'mono', 520, 46, 0.1), spacing: 0.1, fill: c.accent,
      });
      return cy + R + 10;
    },
  },

  launch: {
    id: 'launch',
    name: 'Launch day',
    inspiredBy: 'Space-camp and mission-patch shirts',
    palettes: ['launch', 'biuh', 'lagoon', 'mono', 'dusk'],
    fields: {
      top: { label: 'Countdown', presets: ['3 · 2 · 1', '', 'LAUNCH SEASON', 'T-MINUS 10'] },
      title: { label: 'Big word', presets: ['WENCHANG', 'HAINAN', 'BiUH', 'LIFT OFF'] },
      sub: { label: 'Small print', presets: ['NEXT STOP: ORBIT', 'HAINAN SPACE COAST', '19.61°N 110.95°E', 'TO ORBIT AND BACK TO CLASS'] },
    },
    slots: {
      craft: { label: 'Craft', tags: ['rocket', 'palm', 'coconut'] },
      star: { label: 'Stars', tags: ['star'] },
    },
    draw(t) {
      const { c, f } = t;
      const cx = t.W / 2;
      let y = t.text(f.top, { top: 0, font: 'mono', size: 56, spacing: 0.3, fill: c.accent });
      y = f.top ? y + 50 : 0;
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const sx = cx + side * (190 + t.rand() * 330);
        const sy = y + t.rand() * 660;
        const s = 18 + t.rand() * 30;
        if (t.asset('star')) t.icon('star', { cx: sx, cy: sy, w: s, h: s, color: c.accent2 });
        else t.raw(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(s / 4).toFixed(1)}" fill="${c.accent2}"/>`);
      }
      const craft = t.icon('craft', { top: y, w: 320, h: 620, color: c.ink });
      const fy = craft.bottom + 6;
      const fw = Math.max(40, craft.w * 0.22);
      t.raw(`<path d="M${cx - fw} ${fy} Q${cx - fw * 1.1} ${fy + 120} ${cx} ${fy + 230} Q${cx + fw * 1.1} ${fy + 120} ${cx + fw} ${fy} Z" fill="${c.accent}"/>`);
      t.raw(`<path d="M${cx - fw * 0.5} ${fy} Q${cx - fw * 0.55} ${fy + 70} ${cx} ${fy + 140} Q${cx + fw * 0.55} ${fy + 70} ${cx + fw * 0.5} ${fy} Z" fill="${c.accent2}"/>`);
      y = t.text(f.title, { top: fy + 280, font: 'impact', size: t.fit(f.title, 'impact', 1000, 300, 0.02), spacing: 0.02 });
      return t.text(f.sub, { top: y + 40, font: 'mono', size: t.fit(f.sub, 'mono', 960, 58, 0.12), spacing: 0.12, fill: c.accent });
    },
  },

  coords: {
    id: 'coords',
    name: 'Map & coordinates',
    inspiredBy: 'Minimal coordinate and city-map tees',
    fields: {
      name: { label: 'Name', presets: ['HAINAN', 'HAINAN ISLAND', '海南岛', 'BiUH'] },
      pin: {
        label: 'Pin',
        options: [['lingshui', 'Lingshui (BiUH campus)'], ['wenchang', 'Wenchang launch site'], ['sanya', 'Sanya'], ['haikou', 'Haikou'], ['danzhou', 'Yangpu (future campus)'], ['none', 'No pin']],
      },
      label: { label: 'Pin label (empty = auto)', presets: ['', 'YOU ARE HERE', 'MY CAMPUS'] },
      coords: { label: 'Coordinates (empty = auto)', presets: [''] },
    },
    slots: { map: { label: 'Map', tags: ['island'] } },
    draw(t) {
      const { c, f } = t;
      const map = t.icon('map', { top: 0, w: 960, h: 760, color: c.ink });
      const pin = PINS[f.pin];
      const rel = map.asset?.pins?.[f.pin];
      if (pin && rel) {
        const px = map.x + rel[0] * map.w;
        const py = map.y + rel[1] * map.h;
        t.raw(`<circle cx="${px}" cy="${py}" r="44" fill="none" stroke="${c.accent}" stroke-width="9"/>`);
        t.raw(`<circle cx="${px}" cy="${py}" r="20" fill="${c.accent}"/>`);
        const label = f.label || pin.label;
        const onRight = px + 70 + t.measure(label, 'mono', 46).w < t.W - 30;
        // The halo keeps the label readable where it crosses the island.
        t.text(label, {
          x: onRight ? px + 70 : px - 70, baseline: py + 16, font: 'mono', size: 46, fill: c.accent,
          anchor: onRight ? 'start' : 'end',
          attrs: `stroke="${c.shirt}" stroke-width="8" paint-order="stroke" stroke-linejoin="round"`,
        });
      }
      let y = t.text(f.name, { top: map.bottom + 80, font: 'impact', size: t.fit(f.name, 'impact', 1000, 180, 0.3), spacing: 0.3 });
      const coords = f.coords || pin?.coords || '';
      return t.text(coords, { top: y + 40, font: 'mono', size: t.fit(coords, 'mono', 900, 56, 0.08), spacing: 0.08, fill: c.accent });
    },
  },

  meme: {
    id: 'meme',
    name: 'Meme caption',
    inspiredBy: 'Top-text / bottom-text image macros (text only, no borrowed images)',
    linked: true,
    fields: {
      top: {
        label: 'Top text (| = new line)',
        presets: ["BIELEFELD|DOESN'T EXIST", 'EXPECTATION:|GERMANY', 'KEEP CALM|AND', 'ONE DOES NOT SIMPLY', 'MY OTHER CAMPUS', 'NOBODY:|ME IN HAINAN:'],
      },
      bottom: {
        label: 'Bottom text (| = new line)',
        presets: ['SO THEY BUILT|ONE IN HAINAN', 'REALITY:|COCONUTS', 'COCONUT ON', 'LEAVE HAINAN', 'IS IN BIELEFELD', ''],
      },
    },
    slots: { icon: { label: 'Picture', tags: ['coconut', 'palm', 'island', 'rocket', 'heart'] } },
    draw(t) {
      const { c, f } = t;
      const top = lines(f.top);
      const bottom = lines(f.bottom);
      const sizeFor = (ls) => Math.min(...ls.map((l) => t.fit(l, 'impact', 1040, 190)));
      let y = 0;
      const block = (ls, fill) => {
        if (!ls.length) return;
        const size = sizeFor(ls);
        for (const l of ls) y = t.text(l, { top: y, font: 'impact', size, fill }) + size * 0.12;
      };
      block(top, c.ink);
      const icon = t.icon('icon', { top: y + 40, w: 560, h: 460, color: c.accent });
      y = icon.bottom + 60;
      block(bottom, c.ink);
      return y;
    },
  },

  postcard: {
    id: 'postcard',
    name: 'Greetings from',
    inspiredBy: 'Vintage “Greetings from…” postcards',
    fields: {
      greet: { label: 'Greeting', presets: ['Greetings from', 'Hello from', 'Love from', 'Sent from'] },
      place: { label: 'Place', presets: ['HAINAN', 'SANYA', 'BiUH', 'LINGSHUI', 'HAIKOU'] },
      sub: { label: 'Small print', presets: ['COCONUT ISLAND', 'SOUTH CHINA SEA', 'WISH YOU WERE HERE', '海南 · 椰岛'] },
    },
    slots: { icon: { label: 'Side icons', tags: ['palm', 'coconut', 'rocket', 'island'] } },
    draw(t) {
      const { c, f } = t;
      const gSize = t.fit(f.greet, 'script', 820, 140);
      const gm = t.measure(f.greet, 'script', gSize);
      t.raw(`<g transform="rotate(-5 ${t.W / 2} ${gm.asc})">`);
      let y = t.text(f.greet, { top: 0, font: 'script', size: gSize, fill: c.accent });
      t.raw('</g>');
      const depth = 12;
      const size = t.fit(f.place, 'slab', 1000 - depth * 3, 330);
      const top = y + 20;
      // Stacked offsets give the chunky 3D block letters.
      for (let i = depth; i > 0; i--) t.text(f.place, { x: t.W / 2 - depth * 1.5 + i * 3, top: top + i * 3, font: 'slab', size, fill: c.accent2 });
      y = t.text(f.place, { x: t.W / 2 - depth * 1.5, top, font: 'slab', size }) + depth * 3;
      const subSize = t.fit(f.sub, 'mono', 760, 50, 0.18);
      const sm = t.measure(f.sub, 'mono', subSize, 0.18);
      const subTop = y + 60;
      const bottom = t.text(f.sub, { top: subTop, font: 'mono', size: subSize, spacing: 0.18 });
      const mid = subTop + sm.asc / 2;
      const off = sm.w / 2 + 90;
      const a = t.icon('icon', { cx: t.W / 2 - off, cy: mid, w: 110, h: 110, color: c.ink });
      t.icon('icon', { cx: t.W / 2 + off, cy: mid, w: 110, h: 110, color: c.ink, flip: true });
      return Math.max(bottom, a.bottom);
    },
  },

  repeat: {
    id: 'repeat',
    name: 'Stacked repeat',
    inspiredBy: 'Streetwear word-stack prints',
    fields: {
      word: { label: 'Word', presets: ['HAINAN', 'BiUH', 'SANYA', '椰岛', 'COCONUT', 'LIFT OFF'] },
      label: { label: 'Small print', presets: ['HAINAN ISLAND · 2026', '海南 · BIELEFELD', 'EST. 2023', 'BE YOU!'] },
    },
    slots: {},
    draw(t) {
      const { c, f } = t;
      const n = 6;
      const size = t.fit(f.word, 'impact', 1000, 250);
      const m = t.measure(f.word, 'impact', size);
      const pitch = m.asc + m.desc + size * 0.1;
      const filled = 1 + Math.floor(t.rand() * (n - 1));
      for (let i = 0; i < n; i++) {
        const solid = i === filled;
        t.text(f.word, {
          top: i * pitch, font: 'impact', size, fill: solid ? c.accent : 'none',
          attrs: solid ? '' : `stroke="${c.ink}" stroke-width="5" stroke-linejoin="round"`,
        });
      }
      return t.text(f.label, { top: n * pitch + 30, font: 'mono', size: t.fit(f.label, 'mono', 900, 48, 0.2), spacing: 0.2 });
    },
  },
};
