// One-time conversion of the old PDF extraction (work/parsed.json) into the canonical data format.
// Usage: node tools/import-legacy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { compileReferences } from '../work/references.mjs';
import { BOOKS } from './books.mjs';
import { writeText, writeNotes, writeJson } from './format.mjs';

const root = path.resolve(import.meta.dirname, '..');
const parsed = JSON.parse(fs.readFileSync(path.join(root, 'work/parsed.json'), 'utf8'));
const names = BOOKS.map(b => b.name);
const counts = BOOKS.map(b => b.chapters);

// Verse text: { BOOK: [chapter][verse-1] = text | null }
function toText(result) {
  const text = Object.fromEntries(BOOKS.map(b => [b.id, Array.from({ length: b.chapters }, () => [])]));
  for (const row of Object.values(result)) {
    const chapter = text[BOOKS[row.b].id][row.c - 1];
    chapter[row.v - 1] = row.t;
  }
  for (const chapters of Object.values(text))
    for (const chapter of chapters)
      for (let i = 0; i < chapter.length; i++) chapter[i] ??= null;
  return text;
}

// Notes: { "BOOK c:v": [{ at, text, links: [{ s, e, to: [[BOOK, c, [verses]]] }] }] }
function toNotes(references) {
  const notes = {};
  for (const [key, entry] of Object.entries(references)) {
    const [b, c, v] = key.split(':').map(Number);
    const groups = [];
    for (const p of entry.placements) {
      const raw = entry.text.slice(p.s, p.e);
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (!text) continue;
      const links = entry.links
        .filter(l => l.s >= p.s && l.e <= p.e)
        .map(l => ({
          s: l.s - p.s - lead,
          e: l.e - p.s - lead,
          to: l.targets.filter(t => BOOKS[t.b]).map(t => [BOOKS[t.b].id, t.c, t.vs])
        }))
        .filter(l => l.to.length);
      groups.push({ at: p.at, text, ...(links.length ? { links } : {}) });
    }
    if (groups.length) notes[`${BOOKS[b].id} ${c}:${v}`] = groups;
  }
  return notes;
}

const refs = compileReferences(parsed, names, counts);
const out = path.join(root, 'data/translations');
for (const [i, id] of ['vdcc', 'ntr'].entries()) {
  const dir = path.join(out, id);
  fs.mkdirSync(dir, { recursive: true });
  writeText(path.join(dir, 'text.json'), toText(parsed[i].result));
  if (i === 0) writeNotes(path.join(dir, 'notes.json'), toNotes(refs.result));
}
writeJson(path.join(root, 'data/books.json'), BOOKS);
console.log('Imported', Object.keys(parsed[0].result).length, 'VDCC verses,', Object.keys(parsed[1].result).length, 'NTR verses,', refs.stats.links, 'links');
