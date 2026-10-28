// Static server for previewing dist/, plus the editing API used by the app's "Editează" and "Regenerează".
// Usage: node tools/serve.mjs [port]
//
// API (answers only requests from this computer):
//   GET  /api/status                 { edit: true }
//   GET  /api/file?path=data/...     the file's text
//   PUT  /api/file?path=data/...     saves it, rebuilds; if the build fails the old file is put back
//   POST /api/regenerate {id, note}  adds a study ("DAN-5") or book ("DAN") to data/studies/regenerate.json
// Editable: data/studies/<BOOK>/*.md and *.json, data/atlas/{people,places,events,images}.json, data/comments/<BOOK>.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { addToQueue } from './visuals.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const root = path.join(projectRoot, 'dist');
const port = +process.argv[2] || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const EDITABLE = /^data\/(studies\/[1-3A-Z]{3}\/[\w.-]+\.(md|json)|atlas\/(people|places|events|images)\.json|comments\/[1-3A-Z]{3}\.json)$/;

const local = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, fail) => {
  const chunks = [];
  let size = 0;
  req.on('data', c => { size += c.length; if (size > 5e6) { fail(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
  req.on('error', fail);
});
function editablePath(rel) {
  if (!rel || !EDITABLE.test(rel) || rel.includes('..')) return null;
  const file = path.join(projectRoot, rel);
  return file.startsWith(path.join(projectRoot, 'data')) ? file : null;
}
const build = () => spawnSync(process.execPath, [path.join(projectRoot, 'tools/build.mjs')], { cwd: projectRoot, encoding: 'utf8' });

async function api(req, res, url) {
  if (!local(req)) return send(res, 403, { error: 'Editarea este permisă doar de pe acest calculator.' });
  if (url.pathname === '/api/status') return send(res, 200, { edit: true });
  if (url.pathname === '/api/file') {
    const rel = url.searchParams.get('path'), file = editablePath(rel);
    if (!file) return send(res, 400, { error: 'Fișierul nu poate fi editat: ' + rel });
    if (req.method === 'GET') return fs.existsSync(file) ? send(res, 200, fs.readFileSync(file, 'utf8'), 'text/plain; charset=utf-8') : send(res, 404, { error: 'Nu există: ' + rel });
    if (req.method === 'PUT') {
      const text = await readBody(req);
      if (rel.endsWith('.json')) { try { JSON.parse(text); } catch (e) { return send(res, 200, { ok: false, error: 'JSON invalid: ' + e.message }); } }
      const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      const out = build();
      if (out.status !== 0) {
        if (before === null) fs.unlinkSync(file); else fs.writeFileSync(file, before);
        build();
        return send(res, 200, { ok: false, problems: (out.stderr || out.stdout).trim() });
      }
      return send(res, 200, { ok: true, stale: /s-a schimbat după ce a fost făcută vizualizarea/.test(out.stderr) && rel.endsWith('.md'), output: out.stdout.trim() });
    }
  }
  if (url.pathname === '/api/regenerate' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'JSON invalid' }); }
    if (!/^[1-3A-Z]{3}(-\d+)?$/.test(body.id || '')) return send(res, 400, { error: 'id invalid' });
    return send(res, 200, { ok: true, queue: addToQueue(body.id, body.note || '') });
  }
  return send(res, 404, { error: 'Necunoscut' });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url); } catch (e) { return send(res, 500, { error: e.message }); }
  }
  const rel = decodeURIComponent(url.pathname);
  const file = path.join(root, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving dist/ on http://localhost:${port} (editing enabled for this computer)`));
