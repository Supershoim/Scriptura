// Wikimedia Commons helper for the historical images of the study visuals.
//   node tools/commons.mjs search "<words>"            lists matching files with size and licence
//   node tools/commons.mjs fetch <id> "File:<name>"     downloads an 800 px copy to data/atlas/images/<id>.jpg
//                                                       and records author, licence and source in images.json
// Only files under a free licence (public domain, CC0, CC BY, CC BY-SA) are accepted. The title, caption and
// verse references in images.json are written by hand afterwards.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'Scriptura study app (https://github.com; personal use)' };
const root = path.resolve(import.meta.dirname, '..');
const imagesDir = path.join(root, 'data/atlas/images'), registry = path.join(root, 'data/atlas/images.json');
const strip = html => String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const FREE = /^(public domain|pd|cc0|cc by(-sa)? [\d.]+)/i;

async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function info(titles) {
  if (!titles.length) return [];
  const d = await api({ action: 'query', titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '800' });
  return d.query.pages.filter(p => p.imageinfo).map(p => {
    const i = p.imageinfo[0], m = i.extmetadata || {};
    return {
      title: p.title, mime: i.mime, width: i.width, height: i.height, thumb: i.thumburl, page: i.descriptionurl,
      license: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value), credit: strip(m.Credit?.value),
      description: strip(m.ImageDescription?.value).slice(0, 300)
    };
  });
}

// For photos of ancient objects "Artist" names the (unknown) maker of the object; the photographer is in "Credit".
const photographer = f => !f.author || /unknown (artist|author)/i.test(f.author)
  ? 'Foto: ' + f.credit.replace(/^Own work,?\s*(Photo by\s*)?/i, '').replace(/\s*\(Own work\)/i, '')
  : f.author;

const [command, ...args] = process.argv.slice(2);
if (command === 'search') {
  const d = await api({ action: 'query', list: 'search', srsearch: args.join(' '), srnamespace: '6', srlimit: '12' });
  const found = await info(d.query.search.map(s => s.title));
  for (const f of found) console.log(`${FREE.test(f.license) ? '✓' : '✗'} ${f.title} · ${f.width}×${f.height} · ${f.license} · ${f.author.slice(0, 60)}\n    ${f.description.slice(0, 160)}`);
} else if (command === 'fetch') {
  const [id, title] = args;
  if (!/^[a-z0-9-]+$/.test(id || '') || !title?.startsWith('File:')) { console.error('Usage: node tools/commons.mjs fetch <id> "File:<name>"'); process.exit(1); }
  const [f] = await info([title]);
  if (!f) throw new Error('Not found: ' + title);
  if (!FREE.test(f.license)) throw new Error(`Licence not accepted: ${f.license}`);
  if (!/^image\/(jpeg|png)$/.test(f.mime) && !/\.(jpe?g|png)$/i.test(f.thumb)) throw new Error('Not a photo: ' + f.mime);
  const r = await fetch(f.thumb, { headers: HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${f.thumb}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  const ext = /\.png$/i.test(f.thumb) ? 'png' : 'jpg';
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.writeFileSync(path.join(imagesDir, `${id}.${ext}`), bytes);
  const list = fs.existsSync(registry) ? JSON.parse(fs.readFileSync(registry, 'utf8')) : {};
  list[id] = { title: list[id]?.title || '', caption: list[id]?.caption || '', refs: list[id]?.refs || [], ...list[id],
    file: `${id}.${ext}`, source: f.page, author: photographer(f), license: f.license };
  fs.writeFileSync(registry, JSON.stringify(list, null, 2) + '\n');
  console.log(`${id}.${ext} · ${(bytes.length / 1e3).toFixed(0)} KB · ${f.license} · ${f.author.slice(0, 80)}`);
} else {
  console.error('Usage: node tools/commons.mjs search "<words>" | fetch <id> "File:<name>"');
  process.exit(1);
}
