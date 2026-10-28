// Translation memory for the study notes of a translation (KJV): data/translations/<id>/study/<lang>/<BOOK>.json,
//   { "1:2|0|html": { "src": "<hash of the English>", "text": "<p>…</p>" }, … }
// one entry per translatable field (title, sub, html, caption; credits stay as printed). The build puts the
// translated text over the English (tools/study-notes.mjs); an entry whose English changed since (a new import)
// is not used, and the item shows in English.
//
//   node tools/translate-notes.mjs export kjv GEN ro [file]   segments still to translate -> JSON [{ key, en }]
//   node tools/translate-notes.mjs apply kjv GEN ro file      merges a JSON { key: text } after checking it
//   node tools/translate-notes.mjs status kjv GEN ro
//
// In the exported English the references already use the Romanian abbreviations ("Is. 40:12" -> "Is. 40:12",
// "Heb. 11:3" -> "Evr. 11:3"). Apply checks that a translation keeps the same <p>, <strong> and <em> tags and
// the same chapter:verse references as the English.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { byName, BOOK_REF } from './english-books.mjs';

const root = path.resolve(import.meta.dirname, '..');
const books = JSON.parse(fs.readFileSync(path.join(root, 'data/books.json'), 'utf8'));
const FIELDS = ['title', 'sub', 'html', 'caption'];

export const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// Every translatable field of a book's notes: [{ key, en, set(text) }].
export function segments(verses) {
  const out = [];
  const visit = (obj, key) => {
    for (const f of FIELDS) if (typeof obj[f] === 'string' && obj[f].trim()) out.push({ key: `${key}|${f}`, en: obj[f], set: t => { obj[f] = t; } });
    for (const list of ['figures', 'boxes']) (obj[list] || []).forEach((x, j) => visit(x, `${key}|${list}.${j}`));
  };
  for (const [v, items] of Object.entries(verses)) items.forEach((item, i) => visit(item, `${v}|${i}`));
  return out;
}

// "Heb. 11:3" -> "Evr. 11:3": the abbreviation of data/books.json, with a full stop when it shortens the name
// ("Fapte 3:22" is written whole, as in Romanian use).
const romanian = new Map(books.map(b => [b.id, b.abbr + (b.name.length > b.abbr.length && b.abbr !== 'Fapte' && !/\s/.test(b.name[b.abbr.length]) ? '.' : '')]));
// Runs of the same style cut in two by the import ("<strong>Dark</strong><strong>ness</strong>") are joined.
const merge = s => s.replace(/<\/(strong|em)>(\s*)<\1>/g, '$2');
export const localRefs = s => merge(s).replace(BOOK_REF, name => romanian.get(byName.get(name.replace(/\.$/, '').replace(/\s+/g, ' ').toUpperCase())) || name);

// The paragraphs and the note's label ("<strong>1:2. ") stay as in the English; bold and italic runs may be
// regrouped (a KJV phrase becomes the VDCC wording), but must be closed in order.
const paragraphs = s => (s.match(/<\/?p>/g) || []).join('');
const label = s => (s.match(/^<p><strong>(\d+:\d+[^.<]*\.)/) || [])[1] || '';
const balanced = s => { const open = []; for (const [, close, tag] of s.matchAll(/<(\/?)(p|strong|em)>/g)) { if (!close) open.push(tag); else if (open.pop() !== tag) return false; } return !open.length; };
const refs = s => (s.match(/\d+:\d+/g) || []).sort().join(' ');
export function check(en, text) {
  const problems = [];
  if (paragraphs(en) !== paragraphs(text)) problems.push('the paragraphs differ from the English');
  if (label(en) !== label(text)) problems.push(`the label differs from the English (${label(en)})`);
  if (!balanced(text)) problems.push('<p>/<strong>/<em> tags not closed in order');
  if (refs(en) !== refs(text)) problems.push(`the references differ (${refs(en)} / ${refs(text)})`);
  if (/<(?!\/?(?:p|strong|em)>)/.test(text)) problems.push('markup other than <p>, <strong>, <em>');
  return problems;
}

const memoryFile = (id, b, lang) => path.join(root, 'data/translations', id, 'study', lang, `${b}.json`);
export const readMemory = (id, b, lang) => fs.existsSync(memoryFile(id, b, lang)) ? JSON.parse(fs.readFileSync(memoryFile(id, b, lang), 'utf8')) : {};

if (import.meta.main) {
  const [cmd, id, b, lang, file] = process.argv.slice(2);
  if (!['export', 'apply', 'status'].includes(cmd) || !id || !b || !lang) {
    console.error('Usage: node tools/translate-notes.mjs export|apply|status <translation> <BOOK> <lang> [file]');
    process.exit(1);
  }
  const verses = JSON.parse(fs.readFileSync(path.join(root, 'data/translations', id, 'study', `${b}.json`), 'utf8'));
  const segs = segments(verses), memory = readMemory(id, b, lang);
  const todo = segs.filter(s => memory[s.key]?.src !== hash(s.en));
  if (cmd === 'status') {
    const words = list => list.reduce((n, s) => n + s.en.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, 0);
    console.log(`${id} ${b} → ${lang}: ${segs.length - todo.length}/${segs.length} segments translated · ${words(todo)} English words to go`);
  } else if (cmd === 'export') {
    const json = JSON.stringify(todo.map(s => ({ key: s.key, en: localRefs(s.en) })), null, 1);
    if (file) fs.writeFileSync(file, json); else console.log(json);
    console.error(`${todo.length} segments to translate`);
  } else {
    const given = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byKey = new Map(segs.map(s => [s.key, s]));
    let ok = 0;
    for (const [key, text] of Object.entries(given)) {
      const seg = byKey.get(key);
      if (!seg) { console.error(`  ${key}: no such segment`); continue; }
      const problems = check(localRefs(seg.en), text);
      if (problems.length) { console.error(`  ${key}: ${problems.join('; ')}`); continue; }
      memory[key] = { src: hash(seg.en), text };
      ok++;
    }
    const sorted = Object.fromEntries(segs.filter(s => memory[s.key]).map(s => [s.key, memory[s.key]]));
    fs.mkdirSync(path.dirname(memoryFile(id, b, lang)), { recursive: true });
    fs.writeFileSync(memoryFile(id, b, lang), JSON.stringify(sorted, null, 1) + '\n');
    console.log(`${ok} of ${Object.keys(given).length} applied · ${Object.keys(sorted).length}/${segs.length} segments of ${b} translated`);
  }
}
