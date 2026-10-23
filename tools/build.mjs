// Builds dist/ (installable offline web app) and dist/Scriptura.html (single self-contained file).
// Usage: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { validate } from './validate.mjs';

const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'app'), dataDir = path.join(root, 'data'), dist = path.join(root, 'dist');
const MODULES = ['util', 'data', 'search', 'render', 'notes', 'app'];
const SHELL = ['index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', ...MODULES.map(m => `js/${m}.js`)];

const read = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(read(file));

// ---------- Data ----------

const books = readJson(path.join(dataDir, 'books.json'));
const translations = fs.readdirSync(path.join(dataDir, 'translations'), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => {
    const dir = path.join(dataDir, 'translations', d.name);
    const meta = readJson(path.join(dir, 'translation.json'));
    const notesFile = path.join(dir, 'notes.json');
    const notes = fs.existsSync(notesFile) ? readJson(notesFile) : null;
    return { meta: { ...meta, hasNotes: !!notes }, text: readJson(path.join(dir, 'text.json')), notes };
  })
  .sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));

const problems = validate(books, translations);
if (problems.length) {
  console.error(problems.slice(0, 40).join('\n'));
  console.error(`${problems.length} problem(s) in data/. Build stopped.`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data/translations'), { recursive: true });
const writeDist = (rel, content) => { const file = path.join(dist, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };

writeDist('data/books.json', JSON.stringify(books));
writeDist('data/translations.json', JSON.stringify(translations.map(t => t.meta)));
for (const t of translations) {
  writeDist(`data/translations/${t.meta.id}/text.json`, JSON.stringify(t.text));
  if (t.notes) writeDist(`data/translations/${t.meta.id}/notes.json`, JSON.stringify(t.notes));
}

// ---------- Hosted app ----------

for (const rel of SHELL) writeDist(rel, fs.readFileSync(path.join(app, rel)));

const hash = crypto.createHash('sha256');
for (const rel of SHELL) hash.update(fs.readFileSync(path.join(dist, rel)));
for (const t of translations) hash.update(JSON.stringify(t));
const version = hash.digest('hex').slice(0, 12);
writeDist('sw.js', read(path.join(app, 'sw.js'))
  .replace('__VERSION__', version)
  .replace('__SHELL__', JSON.stringify(['./', ...SHELL, 'data/books.json', 'data/translations.json'])));

// ---------- Single-file build ----------

// Turns the ES modules into one script: each module becomes a function returning its exports.
function bundle() {
  const exportsOf = src => [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm)].map(m => m[1]);
  let out = '';
  for (const name of MODULES) {
    let src = read(path.join(app, 'js', name + '.js'));
    const names = exportsOf(src);
    src = src
      .replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/(\w+)\.js';$/gm, (_, alias, mod) => `const ${alias} = __${mod};`)
      .replace(/^import\s+\{([^}]+)\}\s+from\s+'\.\/(\w+)\.js';$/gm, (_, list, mod) => `const {${list}} = __${mod};`)
      .replace(/^export\s+/gm, '');
    out += `const __${name} = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
  }
  return out;
}

const payload = zlib.gzipSync(JSON.stringify({ books, translations }), { level: 9 }).toString('base64');
const standalone = read(path.join(app, 'index.html'))
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n/g, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read(path.join(app, 'styles.css'))}</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () =>
    `<script id="embedded-data" type="application/octet-stream">${payload}</script>\n<script type="module">\n${bundle()}</script>`);
writeDist('Scriptura.html', standalone);

const size = rel => (fs.statSync(path.join(dist, rel)).size / 1e6).toFixed(1) + ' MB';
console.log(`Built dist/ (version ${version}) · ${translations.map(t => t.meta.abbreviation).join(', ')} · Scriptura.html ${size('Scriptura.html')}`);
