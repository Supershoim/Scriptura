// Builds dist/ (installable offline web app) and dist/Scriptura.html (single self-contained file).
// Usage: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { validate } from './validate.mjs';
import { loadStudies, buildStudies } from './studies.mjs';
import { loadComments } from './comments.mjs';
import { loadStudyNotes } from './study-notes.mjs';
import { loadAtlas, atlasForApp } from './atlas.mjs';
import { makeRouter } from './routes.mjs';
import { MAP_PATH } from './visual-spec.mjs';

const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'app'), dataDir = path.join(root, 'data'), dist = path.join(root, 'dist');
const MODULES = ['util', 'data', 'search', 'render', 'notes', 'tips', 'catalog', 'refs', 'vizcore', 'vizbook', 'vizchapter', 'vizmap', 'visual', 'editor', 'studies', 'comments', 'studynotes', 'footnotes', 'app'];
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

// "DAN 5:1" or "DAN 5:1-4": the book exists and the verses exist in at least one translation.
const bookNames = new Map(books.map(b => [b.id, b]));
function checkRef(ref) {
  const m = /^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$/.exec(ref || '');
  if (!m) return `reference "${ref}" must look like "DAN 5:1" or "DAN 5:1-4"`;
  const [b, c, from, to] = [m[1], +m[2], +m[3], +(m[4] || m[3])];
  if (!bookNames.has(b)) return `reference "${ref}": unknown book`;
  if (to < from) return `reference "${ref}": the range runs backwards`;
  for (const v of [from, to]) if (!translations.some(t => typeof t.text[b]?.[c - 1]?.[v - 1] === 'string')) return `reference "${ref}": ${b} ${c}:${v} does not exist`;
  return null;
}
const exists = (b, c, v) => translations.some(t => typeof t.text[b]?.[c - 1]?.[v - 1] === 'string');
const { atlas, problems: atlasProblems } = loadAtlas(path.join(dataDir, 'atlas'), books, checkRef);
const { studies, bookVisuals, problems: studyProblems, warnings } = loadStudies(path.join(dataDir, 'studies'), books, { atlas, checkRef });
const { comments, problems: commentProblems } = loadComments(path.join(dataDir, 'comments'), books, exists);
// Study notes printed with a translation (KJV): one JSON file per book and the pictures they show.
const studyNotes = translations.filter(t => t.meta.study).map(t => loadStudyNotes(dataDir, t));
const noteFiles = Object.assign({}, ...studyNotes.map(n => n.files)), noteImages = studyNotes.flatMap(n => n.images);
const problems = [...validate(books, translations), ...atlasProblems, ...studyProblems, ...commentProblems, ...studyNotes.flatMap(n => n.problems)];
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

const study = buildStudies(studies, bookVisuals, books, { atlas, route: atlas.map ? makeRouter(atlas.map) : null, exists });
// Register and map: shipped as files of the study set so the offline file carries them too.
study.files['data/atlas.json'] = JSON.stringify(atlasForApp(atlas, study.seen));
if (atlas.map) study.files[MAP_PATH] = JSON.stringify(atlas.map);
const images = Object.values(atlas.images).map(im => im.file);
for (const [rel, json] of Object.entries(noteFiles)) writeDist(rel, json);
for (const rel of noteImages) writeDist(rel, fs.readFileSync(path.join(root, rel)));
// The index of the notes and inserts (tools/import-nkjv.mjs), for other tools and apps: served, not embedded.
for (const t of translations) {
  const rel = `data/translations/${t.meta.id}/study/index.json`;
  if (t.meta.study && fs.existsSync(path.join(root, rel))) writeDist(rel, fs.readFileSync(path.join(root, rel)));
}
const STUDY_FILES = [...Object.keys(noteFiles), ...noteImages, 'data/studies/index.json', ...Object.keys(study.files), ...Object.keys(study.shards).map(k => `data/studies/search/${k}.json`), ...images.map(f => `data/atlas/images/${f}`)];
for (const f of images) writeDist(`data/atlas/images/${f}`, fs.readFileSync(path.join(dataDir, 'atlas/images', f)));
writeDist('data/studies/index.json', JSON.stringify(study.index));
for (const [rel, html] of Object.entries(study.files)) writeDist(rel, html);
for (const [k, words] of Object.entries(study.shards)) writeDist(`data/studies/search/${k}.json`, JSON.stringify(words));
// Comments: the list of books that have some, then one file per book.
const COMMENT_FILES = ['data/comments/index.json', ...Object.keys(comments).map(b => `data/comments/${b}.json`)];
writeDist('data/comments/index.json', JSON.stringify(Object.keys(comments)));
for (const [b, verses] of Object.entries(comments)) writeDist(`data/comments/${b}.json`, JSON.stringify(verses));

// ---------- Hosted app ----------

for (const rel of SHELL) writeDist(rel, fs.readFileSync(path.join(app, rel)));
// Markdown preview in the editor (loaded only when editing, through tools/serve.mjs).
writeDist('js/marked.min.js', fs.readFileSync(path.join(root, 'tools/vendor/marked.min.js')));

const hash = crypto.createHash('sha256');
for (const rel of SHELL) hash.update(fs.readFileSync(path.join(dist, rel)));
for (const t of translations) hash.update(JSON.stringify(t));
hash.update(JSON.stringify(study));
hash.update(JSON.stringify(comments));
hash.update(JSON.stringify(noteFiles));
for (const rel of noteImages) hash.update(fs.readFileSync(path.join(root, rel)));
const version = hash.digest('hex').slice(0, 12);
writeDist('sw.js', read(path.join(app, 'sw.js'))
  .replace('__VERSION__', version)
  .replace('__SHELL__', JSON.stringify(['./', ...SHELL, 'data/books.json', 'data/translations.json', ...COMMENT_FILES]))
  .replace('__STUDIES__', JSON.stringify(STUDY_FILES)));

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

// Images travel inside the offline file as data: URLs under their usual path.
const imageData = Object.fromEntries(images.map(f => [`data/atlas/images/${f}`,
  `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(path.join(dataDir, 'atlas/images', f)).toString('base64')]));
for (const rel of noteImages) imageData[rel] = `data:image/${rel.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(path.join(root, rel)).toString('base64');
const embeddedStudies = { index: study.index, files: { ...study.files, ...noteFiles, ...imageData }, shards: study.shards };
const payload = zlib.gzipSync(JSON.stringify({ books, translations, studies: embeddedStudies, comments }), { level: 9 }).toString('base64');
const standalone = read(path.join(app, 'index.html'))
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n/g, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read(path.join(app, 'styles.css'))}</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () =>
    `<script id="embedded-data" type="application/octet-stream">${payload}</script>\n<script type="module">\n${bundle()}</script>`);
writeDist('Scriptura.html', standalone);

const size = rel => (fs.statSync(path.join(dist, rel)).size / 1e6).toFixed(1) + ' MB';
if (warnings.length) console.warn(warnings.map(w => '  ! ' + w).join('\n'));
const visuals = studies.filter(s => s.visual).length;
const commented = Object.values(comments).reduce((n, verses) => n + Object.keys(verses).length, 0);
console.log(`Built dist/ (version ${version}) · ${translations.map(t => t.meta.abbreviation).join(', ')} · ${studies.length} studies, ${visuals} with visuals, ${Object.keys(bookVisuals).length} book visuals · ${commented} verses with comments · Scriptura.html ${size('Scriptura.html')}`);
