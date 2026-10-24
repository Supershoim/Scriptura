// State of the study visuals and the regeneration queue.
//   node tools/visuals.mjs status              per book: which studies have a visual, which are out of date or incomplete
//   node tools/visuals.mjs stamp DAN [5|book]  records the current study text as the source of the visual(s)
//   node tools/visuals.mjs queue               studies waiting for their visual to be (re)made
//   node tools/visuals.mjs queue add DAN-5 "motiv"   /   queue done DAN-5
// A visual is out of date when its study text changed after the visual was stamped. The parts the build computes
// (routes, verse links, counts) refresh by themselves; the rest is redone in Claude Code with /regenerate-visuals.
import fs from 'node:fs';
import path from 'node:path';
import { loadStudies, bookTexts } from './studies.mjs';
import { loadAtlas } from './atlas.mjs';
import { fingerprint } from './visual-spec.mjs';

const root = path.resolve(import.meta.dirname, '..'), dataDir = path.join(root, 'data');
const studiesDir = path.join(dataDir, 'studies'), queueFile = path.join(studiesDir, 'regenerate.json');
const books = JSON.parse(fs.readFileSync(path.join(dataDir, 'books.json'), 'utf8'));
const readQueue = () => fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, 'utf8')) : [];
const writeQueue = q => fs.writeFileSync(queueFile, JSON.stringify(q, null, 2) + '\n');

// Writes "source" as the first key of the file, keeping the rest of the text as it is.
export function stampFile(file, source) {
  const text = fs.readFileSync(file, 'utf8');
  const next = /^\{\s*"source":\s*"[0-9a-f]*",/.test(text)
    ? text.replace(/^(\{\s*"source":\s*)"[0-9a-f]*"/, `$1"${source}"`)
    : text.replace(/^\{(\s*)/, (_, ws) => `{${ws}"source": "${source}",${ws}`);
  fs.writeFileSync(file, next);
}

export function addToQueue(id, note = '') {
  const q = readQueue().filter(x => x.id !== id);
  q.push({ id, note, at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
  writeQueue(q);
  return q;
}

const [command, ...args] = process.argv.slice(2);
if (process.argv[1]?.endsWith('visuals.mjs')) {   // run as a command (tools/serve.mjs imports it)
  if (command === 'stamp') {
    const [b, which] = args;
    const dir = path.join(studiesDir, b || '');
    if (!b || !fs.existsSync(path.join(dir, 'studies.json'))) { console.error('Usage: node tools/visuals.mjs stamp <BOOK> [chapter|book]'); process.exit(1); }
    const list = JSON.parse(fs.readFileSync(path.join(dir, 'studies.json'), 'utf8'));
    let n = 0;
    for (const s of list) {
      if (!s.visual || (which && which !== String(s.chapter))) continue;
      stampFile(path.join(dir, s.visual), fingerprint(s.parts.map(p => fs.readFileSync(path.join(dir, p.file), 'utf8'))));
      n++;
    }
    if ((!which || which === 'book') && fs.existsSync(path.join(dir, 'book.visual.json'))) { stampFile(path.join(dir, 'book.visual.json'), fingerprint(bookTexts(dir))); n++; }
    console.log(`${n} visual(s) stamped in ${b}.`);
  } else if (command === 'queue') {
    if (args[0] === 'add' && args[1]) console.log(addToQueue(args[1], args[2] || ''));
    else if (args[0] === 'done' && args[1]) { writeQueue(readQueue().filter(x => x.id !== args[1])); console.log(`${args[1]} removed from the queue.`); }
    else { const q = readQueue(); console.log(q.length ? q.map(x => `${x.id.padEnd(8)} ${x.at}  ${x.note}`).join('\n') : 'The queue is empty.'); }
  } else if (command === 'status' || !command) {
    const { atlas } = loadAtlas(path.join(dataDir, 'atlas'), books, () => null);
    const { studies, bookVisuals, problems, warnings } = loadStudies(studiesDir, books, { atlas, checkRef: () => null });
    for (const p of problems) console.log('  ✗ ' + p);
    const byBook = new Map();
    for (const s of studies) { if (!byBook.has(s.b)) byBook.set(s.b, []); byBook.get(s.b).push(s); }
    for (const [b, list] of byBook) {
      const with_ = list.filter(s => s.visual), stale = with_.filter(s => s.visual.stale), bv = bookVisuals[b];
      console.log(`${b.padEnd(4)} ${String(with_.length).padStart(3)}/${list.length} studii cu vizual` +
        `${stale.length ? ` · neactualizate: ${stale.map(s => s.chapter).join(', ')}` : ''} · vizualul cărții: ${!bv ? 'lipsește' : bv.stale ? 'neactualizat' : 'da'}`);
    }
    for (const w of warnings.filter(w => /obligatorii/.test(w))) console.log('  ! ' + w);
    const q = readQueue();
    if (q.length) console.log(`\nÎn coada de regenerare: ${q.map(x => x.id).join(', ')}`);
  } else {
    console.error('Usage: node tools/visuals.mjs status | stamp <BOOK> [chapter|book] | queue [add <id> [motiv] | done <id>]');
    process.exit(1);
  }
}
