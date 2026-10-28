// Print desk: review submitted designs, select them for print, download print files.
import { loadFonts, PALETTES, SHIRTS } from './style.js';
import { TEMPLATES } from './templates.js';
import { loadCatalogue, getCatalogue, renderMockup } from './render.js';
import { printPng, printSvg, download, fileSlug } from './export.js';
import { $, el, toast, encodeSpec, store } from './ui.js';

const KEY = 'biuh-admin-key';
const FILTERS = [
  ['submitted', 'To review'],
  ['selected', 'Selected for print'],
  ['printed', 'Printed'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];
const ACTIONS = {
  submitted: [['selected', 'Select for print', 'primary'], ['rejected', 'Reject']],
  selected: [['printed', 'Mark printed', 'primary'], ['submitted', 'Unselect']],
  printed: [['selected', 'Back to selected']],
  rejected: [['submitted', 'Restore']],
};

let designs = [];
let filter = 'submitted';

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...options.headers, 'x-admin-key': store.get(KEY) || '' } });
  if (res.status === 401) {
    showLogin('That key did not work.');
    throw new Error('Not authorised');
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

function showLogin(message) {
  store.set(KEY, null);
  $('#desk').hidden = true;
  $('#logout').hidden = true;
  $('#login').hidden = false;
  if (message) toast(message, 'error');
}

async function refresh() {
  designs = await api('/api/designs');
  $('#login').hidden = true;
  $('#desk').hidden = false;
  $('#logout').hidden = false;
  renderDesigns();
}

function renderDesigns() {
  const count = (status) => (status === 'all' ? designs.length : designs.filter((d) => d.status === status).length);
  $('#filters').replaceChildren(
    ...FILTERS.map(([status, label]) =>
      el('button', {
        role: 'tab',
        class: status === filter ? 'tab active' : 'tab',
        'aria-selected': String(status === filter),
        onclick: () => {
          filter = status;
          renderDesigns();
        },
      }, label, el('span', { class: 'count' }, String(count(status)))),
    ),
  );

  const shown = filter === 'all' ? designs : designs.filter((d) => d.status === filter);
  if (!shown.length) {
    $('#designs').replaceChildren(el('p', { class: 'empty' }, filter === 'submitted' ? 'Nothing waiting for review.' : 'No designs here yet.'));
    return;
  }
  $('#designs').replaceChildren(...shown.map(card));
}

function card(d) {
  const tpl = TEMPLATES[d.spec.template];
  const name = fileSlug(d.title);
  const busy = (button, work) => async () => {
    button.disabled = true;
    try {
      await work();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  };
  const pngButton = el('button', {}, 'Print PNG');
  pngButton.onclick = busy(pngButton, async () => download(await printPng(d.spec), `${name}-3600x4800.png`));
  const svgButton = el('button', {}, 'SVG');
  svgButton.onclick = busy(svgButton, async () => download(await printSvg(d.spec), `${name}.svg`, 'image/svg+xml'));

  return el('article', { class: `design-card status-${d.status}` },
    el('div', { class: 'card-mockup', html: renderMockup(d.spec) }),
    el('div', { class: 'card-body' },
      el('div', { class: 'card-title' },
        el('h3', {}, d.title),
        el('span', { class: `pill ${d.status}` }, FILTERS.find(([s]) => s === d.status)?.[1] || d.status)),
      el('p', { class: 'meta' }, `by ${d.author} · ${new Date(d.createdAt).toLocaleString()}`),
      el('p', { class: 'meta' },
        `${tpl?.name || d.spec.template} · ${PALETTES[d.spec.palette]?.name || d.spec.palette} on ${SHIRTS[d.spec.shirt]?.name || d.spec.shirt}`),
      el('div', { class: 'card-actions' },
        (ACTIONS[d.status] || []).map(([status, label, kind]) =>
          el('button', {
            class: kind || '',
            onclick: async () => {
              try {
                const updated = await api(`/api/designs/${d.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ status }),
                });
                Object.assign(d, updated);
                renderDesigns();
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          }, label),
        ),
      ),
      el('div', { class: 'card-actions downloads' },
        pngButton,
        svgButton,
        el('a', { href: `/#d=${encodeSpec(d.spec)}`, target: '_blank', rel: 'noopener' }, 'Open in editor')),
    ),
  );
}

function renderAssets() {
  $('#assets').replaceChildren(
    ...getCatalogue().list.map((a) =>
      el('figure', { class: 'catalogue-item' },
        el('div', { class: 'thumb' }, el('img', { src: a.url, alt: a.name })),
        el('figcaption', {},
          el('strong', {}, a.name),
          el('span', { class: 'tags' }, a.tags.join(', ') + (a.recolor ? '' : ' · full colour')),
          el('small', {}, a.credit || '')),
      ),
    ),
  );
}

$('#login').onsubmit = async (e) => {
  e.preventDefault();
  store.set(KEY, e.target.key.value);
  try {
    await refresh();
    e.target.reset();
  } catch {
    // showLogin already explained what went wrong.
  }
};
$('#logout').onclick = () => showLogin();
$('#refresh').onclick = () => refresh().catch((err) => toast(err.message, 'error'));

$('#upload').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const file = form.file.files[0];
  try {
    await api('/api/assets', {
      method: 'POST',
      headers: {
        'content-type': file.type || (file.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png'),
        'x-asset-name': encodeURIComponent(form.name.value),
        'x-asset-tags': encodeURIComponent(form.tags.value),
        'x-asset-credit': encodeURIComponent(form.credit.value),
        'x-asset-recolor': String(form.recolor.checked),
      },
      body: file,
    });
    await loadCatalogue();
    renderAssets();
    form.reset();
    toast('Asset added to the catalogue.');
  } catch (err) {
    toast(`Upload failed: ${err.message}`, 'error');
  }
};

await Promise.all([loadFonts(), loadCatalogue()]);
renderAssets();
if (store.get(KEY)) refresh().catch(() => {});
else showLogin();
