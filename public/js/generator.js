// Public generator: random ideas from the catalogue, tweak them, submit for print.
import { loadFonts, PALETTES, SHIRTS, colorsFor } from './style.js';
import { TEMPLATES } from './templates.js';
import { loadCatalogue, getCatalogue, renderMockup, randomSpec, normalize } from './render.js';
import { $, el, toast, encodeSpec, decodeSpec, store } from './ui.js';

let spec;

function setSpec(next, { rebuildFields = true } = {}) {
  spec = normalize(next);
  renderPreview();
  renderControls();
  if (rebuildFields) renderFields();
  history.replaceState(null, '', `#d=${encodeSpec(spec)}`);
}

function renderPreview() {
  $('#preview').innerHTML = renderMockup(spec);
  const tpl = TEMPLATES[spec.template];
  $('#inspired').textContent = `${tpl.name} · inspired by: ${tpl.inspiredBy}`;
}

function renderControls() {
  $('#templates').replaceChildren(
    ...Object.values(TEMPLATES).map((tpl) =>
      el('button', {
        class: tpl.id === spec.template ? 'chip active' : 'chip',
        title: tpl.inspiredBy,
        'aria-pressed': String(tpl.id === spec.template),
        onclick: () => setSpec(randomSpec({ template: tpl.id, palette: spec.palette, shirt: spec.shirt })),
      }, tpl.name),
    ),
  );

  $('#palettes').replaceChildren(
    ...Object.entries(PALETTES).map(([key, p]) => {
      const c = colorsFor(key, spec.shirt);
      return el('button', {
        class: key === spec.palette ? 'palette active' : 'palette',
        title: p.name,
        'aria-pressed': String(key === spec.palette),
        style: `--shirt:${c.shirt}`,
        onclick: () => setSpec({ ...spec, palette: key }, { rebuildFields: false }),
      },
      el('span', { class: 'ink-dots' }, [c.ink, c.accent, c.accent2].map((col) => el('i', { style: `background:${col}` }))),
      el('span', { class: 'label' }, p.name));
    }),
  );

  $('#shirts').replaceChildren(
    ...Object.entries(SHIRTS).map(([key, s]) =>
      el('button', {
        class: key === spec.shirt ? 'shirt active' : 'shirt',
        title: s.name,
        'aria-label': `${s.name} shirt`,
        'aria-pressed': String(key === spec.shirt),
        style: `background:${s.color}`,
        onclick: () => setSpec({ ...spec, shirt: key }, { rebuildFields: false }),
      }),
    ),
  );

  const tpl = TEMPLATES[spec.template];
  const slots = Object.entries(tpl.slots);
  $('#slots-section').hidden = !slots.length;
  const { list } = getCatalogue();
  $('#slots').replaceChildren(
    ...slots.map(([slot, def]) => {
      // Matching assets first, but anything in the catalogue is allowed.
      const fits = (a) => a.tags.some((t) => def.tags.includes(t));
      const ordered = [...list.filter(fits), ...list.filter((a) => !fits(a))];
      return el('div', { class: 'slot' },
        el('h3', {}, def.label),
        el('div', { class: 'asset-grid' },
          ordered.map((a) =>
            el('button', {
              class: a.id === spec.assets[slot] ? 'asset active' : 'asset',
              title: `${a.name}\n${a.credit || ''}`,
              'aria-label': a.name,
              'aria-pressed': String(a.id === spec.assets[slot]),
              onclick: () => setSpec({ ...spec, assets: { ...spec.assets, [slot]: a.id } }, { rebuildFields: false }),
            }, el('img', { src: a.url, alt: '' })),
          ),
        ),
      );
    }),
  );
}

function renderFields() {
  const tpl = TEMPLATES[spec.template];
  $('#fields').replaceChildren(
    ...Object.entries(tpl.fields).map(([key, field]) => {
      const update = (value) => {
        spec = { ...spec, fields: { ...spec.fields, [key]: value } };
        renderPreview();
        history.replaceState(null, '', `#d=${encodeSpec(spec)}`);
      };
      let input;
      if (field.options) {
        input = el('select', { onchange: (e) => update(e.target.value) },
          field.options.map(([value, label]) => el('option', { value, selected: value === spec.fields[key] }, label)));
      } else {
        input = el('input', { value: spec.fields[key], list: `presets-${key}`, maxlength: 60, oninput: (e) => update(e.target.value) });
      }
      const dice = field.options
        ? null
        : el('button', {
          type: 'button',
          class: 'dice',
          title: 'Pick another suggestion',
          'aria-label': `Suggest another ${field.label.toLowerCase()}`,
          onclick: () => {
            const others = field.presets.filter((p) => p !== input.value);
            input.value = others[Math.floor(Math.random() * others.length)] ?? '';
            update(input.value);
          },
        }, '↻');
      const row = el('label', { class: 'field' }, el('span', {}, field.label), el('span', { class: 'field-row' }, input, dice));
      if (!field.options) row.append(el('datalist', { id: `presets-${key}` }, field.presets.filter(Boolean).map((p) => el('option', { value: p }))));
      return row;
    }),
  );
}

function renderIdeas() {
  $('#ideas').replaceChildren(
    ...Array.from({ length: 8 }, () => {
      const idea = normalize(randomSpec());
      return el('button', {
        class: 'idea',
        title: 'Open in the editor',
        onclick: () => {
          setSpec(idea);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        html: renderMockup(idea),
      }, el('span', {}, TEMPLATES[idea.template].name));
    }),
  );
}

$('#surprise').onclick = () => setSpec(randomSpec());
$('#remix').onclick = () => {
  const fresh = randomSpec({ template: spec.template });
  setSpec({ ...spec, palette: fresh.palette, shirt: fresh.shirt, seed: fresh.seed }, { rebuildFields: false });
};
$('#reword').onclick = () => setSpec({ ...spec, fields: randomSpec({ template: spec.template }).fields });
$('#more').onclick = renderIdeas;

$('#submit-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const button = e.target.querySelector('button');
  button.disabled = true;
  try {
    const res = await fetch('/api/designs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec, title: form.get('title'), author: form.get('author') }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    store.set('biuh-author', form.get('author'));
    e.target.title.value = '';
    toast('Submitted! The print desk will review it.');
  } catch (err) {
    toast(`Could not submit: ${err.message}`, 'error');
  } finally {
    button.disabled = false;
  }
};

await Promise.all([loadFonts(), loadCatalogue()]);
$('#submit-form').author.value = store.get('biuh-author') || '';
const fromHash = location.hash.startsWith('#d=') && decodeSpec(location.hash.slice(3));
setSpec(fromHash || randomSpec());
renderIdeas();
