// Prototype server: serves the app, the asset catalogue and a tiny JSON API.
// No dependencies; data lives in data/designs.json and catalogue/catalogue.json.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT = import.meta.dirname;
const PUBLIC = join(ROOT, 'public');
const CATALOGUE_DIR = join(ROOT, 'catalogue');
const CATALOGUE = join(CATALOGUE_DIR, 'catalogue.json');
const DESIGNS = join(ROOT, 'data', 'designs.json');
const PORT = Number(process.env.PORT) || 3210;
const ADMIN_KEY = process.env.ADMIN_KEY || 'biuh-admin';
const STATUSES = ['submitted', 'selected', 'rejected', 'printed'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Serialise writes so two submissions arriving together can't clobber each other.
let writing = Promise.resolve();
function updateJson(file, fallback, change) {
  const run = writing.then(async () => {
    const data = await readJson(file, fallback);
    const result = change(data);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2));
    return result;
  });
  writing = run.catch(() => {});
  return run;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const isAdmin = (req) => req.headers['x-admin-key'] === ADMIN_KEY;

async function serveFile(res, baseDir, urlPath, extraHeaders = {}) {
  const file = resolve(baseDir, '.' + decodeURIComponent(urlPath));
  if (file !== baseDir && !file.startsWith(baseDir + sep)) return send(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...extraHeaders });
    res.end(data);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

async function api(req, res, path) {
  if (req.method === 'GET' && path === '/api/catalogue') {
    return send(res, 200, await readJson(CATALOGUE, []));
  }

  if (req.method === 'POST' && path === '/api/designs') {
    const { spec, author, title } = JSON.parse(await readBody(req, 50_000));
    if (!spec || typeof spec.template !== 'string') return send(res, 400, { error: 'Missing design spec' });
    const design = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'submitted',
      author: String(author || 'Anonymous').slice(0, 60),
      title: String(title || 'Untitled').slice(0, 80),
      spec,
    };
    await updateJson(DESIGNS, [], (designs) => designs.push(design));
    return send(res, 201, { id: design.id });
  }

  if (req.method === 'GET' && path === '/api/designs') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin key required' });
    const designs = await readJson(DESIGNS, []);
    return send(res, 200, designs.toReversed());
  }

  const designMatch = path.match(/^\/api\/designs\/([\w-]+)$/);
  if (req.method === 'PATCH' && designMatch) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin key required' });
    const { status } = JSON.parse(await readBody(req, 1_000));
    if (!STATUSES.includes(status)) return send(res, 400, { error: `Status must be one of ${STATUSES.join(', ')}` });
    const found = await updateJson(DESIGNS, [], (designs) => {
      const design = designs.find((d) => d.id === designMatch[1]);
      if (design) Object.assign(design, { status, reviewedAt: new Date().toISOString() });
      return design;
    });
    return found ? send(res, 200, found) : send(res, 404, { error: 'Design not found' });
  }

  // Asset upload: raw SVG/PNG body, metadata in headers (keeps the server dependency-free).
  if (req.method === 'POST' && path === '/api/assets') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin key required' });
    const ext = { 'image/svg+xml': '.svg', 'image/png': '.png' }[req.headers['content-type']];
    if (!ext) return send(res, 400, { error: 'Upload an SVG or PNG file' });
    const body = await readBody(req, 5_000_000);
    const name = decodeURIComponent(req.headers['x-asset-name'] || 'Asset').slice(0, 60);
    const tags = decodeURIComponent(req.headers['x-asset-tags'] || 'icon')
      .split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
    const id = `${slug}-${randomUUID().slice(0, 6)}`;
    await writeFile(join(CATALOGUE_DIR, 'assets', id + ext), body);
    const asset = {
      id,
      name,
      file: id + ext,
      tags: tags.length ? tags : ['icon'],
      recolor: req.headers['x-asset-recolor'] !== 'false',
      credit: decodeURIComponent(req.headers['x-asset-credit'] || 'Uploaded by admin').slice(0, 120),
    };
    await updateJson(CATALOGUE, [], (catalogue) => catalogue.push(asset));
    return send(res, 201, asset);
  }

  send(res, 404, { error: 'Unknown endpoint' });
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (path.startsWith('/api/')) return await api(req, res, path);
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (path === '/') return await serveFile(res, PUBLIC, '/index.html');
    if (path === '/admin') return await serveFile(res, PUBLIC, '/admin.html');
    if (path.startsWith('/catalogue/')) {
      // Uploaded SVGs are untrusted: never let them run scripts when opened directly.
      return await serveFile(res, CATALOGUE_DIR, path.slice('/catalogue'.length), {
        'content-security-policy': "script-src 'none'",
      });
    }
    return await serveFile(res, PUBLIC, path);
  } catch (err) {
    send(res, err.status || (err instanceof SyntaxError ? 400 : 500), { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`BiUH Tee Lab running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin (key: ${ADMIN_KEY === 'biuh-admin' ? 'biuh-admin, set ADMIN_KEY to change' : 'from ADMIN_KEY'})`);
});
