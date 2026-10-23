// Adds a translation from a tab-separated file: BOOK<TAB>chapter<TAB>verse<TAB>text (one verse per line).
// BOOK is a USFM code (GEN, EXO, … JHN, … REV), see data/books.json. Lines starting with # are ignored.
// Usage: node tools/import-tsv.mjs <file.tsv> <id> "<ABBREVIATION>" "<Full name>"
import fs from 'node:fs';
import path from 'node:path';
import { writeText, writeJson } from './format.mjs';

const [file, id, abbreviation, name] = process.argv.slice(2);
if (!file || !/^[a-z0-9-]+$/.test(id || '') || !abbreviation || !name) {
  console.error('Usage: node tools/import-tsv.mjs <file.tsv> <id> "<ABBREVIATION>" "<Full name>"   (id: lowercase, e.g. "kjv")');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..');
const books = JSON.parse(fs.readFileSync(path.join(root, 'data/books.json'), 'utf8'));
const text = Object.fromEntries(books.map(b => [b.id, Array.from({ length: b.chapters }, () => [])]));
const errors = [];

fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
  if (!line.trim() || line.startsWith('#')) return;
  const [b, c, v, ...rest] = line.split('\t');
  const book = books.find(x => x.id === b?.trim().toUpperCase());
  if (!book || !(+c >= 1 && +c <= book.chapters) || !(+v >= 1) || !rest.length) { errors.push(`line ${i + 1}: ${line.slice(0, 60)}`); return; }
  text[book.id][+c - 1][+v - 1] = rest.join('\t').replace(/\s+/g, ' ').trim();
});
if (errors.length) { console.error(errors.slice(0, 20).join('\n') + `\n${errors.length} invalid line(s).`); process.exit(1); }

for (const chapters of Object.values(text)) for (const ch of chapters) for (let i = 0; i < ch.length; i++) ch[i] ??= null;
const dir = path.join(root, 'data/translations', id);
fs.mkdirSync(dir, { recursive: true });
writeText(path.join(dir, 'text.json'), text);
const metaFile = path.join(dir, 'translation.json');
if (!fs.existsSync(metaFile)) writeJson(metaFile, {
  id, abbreviation, name, description: name, language: 'ro', color: '#3f6488', order: 10,
  source: '', copyright: '', alignment: { map: {}, spans: {}, gaps: {} }
});
const verses = Object.values(text).flat(2).filter(Boolean).length;
console.log(`Wrote ${verses} verses to data/translations/${id}/. Edit translation.json, then run: node tools/build.mjs`);
