// One-time conversion of the "Biblioteca Studiu Biblic" app into data/studies/.
// Copies each study file byte for byte and splits src/catalog.js into one studies.json per book.
// Usage: node tools/import-studies.mjs "<path to biblioteca-studiu-biblic>"
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) { console.error('Usage: node tools/import-studies.mjs <biblioteca-studiu-biblic folder>'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'data/studies');

const { BOOKS, STUDIES } = new Function(fs.readFileSync(path.join(source, 'src/catalog.js'), 'utf8') + '\nreturn { BOOKS, STUDIES };')();
const usfm = Object.fromEntries(BOOKS.map(b => [b.id, b.usfm]));

const byBook = new Map();
for (const s of STUDIES) {
  const b = usfm[s.book];
  if (!b) throw new Error('Unknown book ' + s.book);
  if (!byBook.has(b)) byBook.set(b, []);
  const entry = { chapter: s.chapter };
  if (s.covers) entry.covers = s.covers;
  Object.assign(entry, { date: s.date, title: s.title, summary: s.summary, themes: s.themes });
  entry.parts = s.parts.map(p => {
    const file = path.basename(p.file);
    fs.mkdirSync(path.join(out, b), { recursive: true });
    fs.copyFileSync(path.join(source, 'data', p.file), path.join(out, b, file));
    return { label: p.label, file };
  });
  byBook.get(b).push(entry);
}

for (const [b, list] of byBook) {
  list.sort((x, y) => x.chapter - y.chapter);
  fs.writeFileSync(path.join(out, b, 'studies.json'), JSON.stringify(list, null, 2) + '\n');
}
console.log(`Imported ${STUDIES.length} studies in ${byBook.size} books into data/studies/.`);
