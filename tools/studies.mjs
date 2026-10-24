// Reads, checks and renders the chapter studies in data/studies/<BOOK>/.
//
// Each book folder holds studies.json (one entry per chapter, chapter 0 = overview of the book)
// and the Markdown files its parts point to. The build turns every part into an HTML fragment,
// writes a catalog (index.json) and a word index split into small files by the first two letters
// of each word, so a search downloads only the pieces it needs however many studies there are.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { marked } = createRequire(import.meta.url)('./vendor/marked.min.js');

// Same as norm() in app/js/util.js: lower case, no diacritics, same length as the input.
export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ş/g, 's').replace(/ţ/g, 't');

// Word tokens of a normalized text: verse references like "2:13" and words of two or more letters.
export const tokens = n => n.match(/\d{1,3}:\d{1,3}|[\p{L}\p{N}]{2,}/gu) || [];
export const shardOf = token => token.slice(0, 2).replace(/[^a-z0-9]/g, '_');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMOJI = /[\u{1F000}-\u{1FAFF}☀-➿️⃣]/gu;
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
const plain = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Headings written in capitals ("1. REZUMAT PE LARG") are shown in sentence case in outlines.
const PROPER = new Set(['testament', 'noul', 'vechiul', 'dumnezeu', 'dumnezeul', 'hristos', 'isus', 'duhul', 'sfânt', 'domnul', 'israel', 'iuda', 'solomon', 'david', 'ierusalim', 'templul', 'templu', 'ilie', 'elisei', 'petru', 'pavel', 'saul', 'ștefan', 'babilon', 'persia', 'cirus', 'moise', 'lege', 'legea', 'evanghelia', 'mesia', 'roma', 'ahab', 'iosia', 'ezechia', 'zorobabel', 'neemia', 'ezra', 'estera', 'mardoheu', 'haman', 'daniel', 'nebucadnețar']);
function headCase(h, bookWords) {
  if (!(h === h.toUpperCase() && /[A-ZĂÂÎȘȚ]{3}/.test(h))) return h;
  const roman = w => /^[ivx]+$/.test(w) && w.length < 4;
  return h.replace(/^(\d+)[.\s]+(?=\S)/, '$1. ').toLowerCase()
    .replace(/\p{L}+/gu, (w, i) => roman(w) && !PROPER.has(w) && !bookWords.has(w) ? w.toUpperCase()
      : i === 0 || PROPER.has(w) || bookWords.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .replace(/^(\d+\.\s+)(\p{L})/u, (_, a, b) => a + b.toUpperCase());
}

// Links between studies keep the file names of the conversations they come from:
// "Romani%20capitolul%201.md", "Romani%20privire%20de%20ansamblu.md" -> "#/studii/ROM/1", "#/studii/ROM/0".
function studyRoute(href, books) {
  const m = decodeURIComponent(href).replace(/\.md$/, '').match(/^(.+?)\s+(?:capitolul\s+(\d+)|privire de ansamblu)$/i);
  const book = m && books.find(b => norm(b.name) === norm(m[1]));
  return book ? `#/studii/${book.id}/${m[2] ? +m[2] : 0}` : null;
}
const MD_LINK = /\]\(([^)\s]+\.md)\)/g;

// Markdown -> HTML fragment: sections get ids s0, s1… (the level that has at least three headings),
// tables scroll inside a box, external links open in a new tab. Returns the HTML and the section titles.
function renderPart(md, books) {
  let html = marked.parse(md.replace(MD_LINK, (all, href) => `](${studyRoute(href, books)})`));
  const level = ['h2', 'h1', 'h3'].find(t => (html.match(new RegExp(`<${t}>`, 'g')) || []).length >= 3) || 'h2';
  const sections = [];
  html = html.replace(new RegExp(`<${level}>([\\s\\S]*?)</${level}>`, 'g'), (_, inner) => {
    sections.push(plain(inner).replace(EMOJI, '').replace(/\s+/g, ' ').trim());
    return `<${level} id="s${sections.length - 1}">${inner}</${level}>`;
  });
  html = html.replace(/<table>/g, '<div class="tablebox"><table>').replace(/<\/table>/g, '</table></div>')
    .replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener" href="$1');
  return { html, sections, level };
}

// Reads every book folder. Returns { studies, problems }; studies are in canonical order.
export function loadStudies(dir, books) {
  const problems = [], studies = [];
  if (!fs.existsSync(dir)) return { studies, problems };
  const byId = new Map(books.map(b => [b.id, b]));
  const bookWords = new Set(books.flatMap(b => norm(b.name).split(' ')).filter(w => w.length > 2));
  for (const folder of fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    const book = byId.get(folder), where = `studies/${folder}`;
    if (!book) { problems.push(`${where}: folder name must be a book code from data/books.json`); continue; }
    const listFile = path.join(dir, folder, 'studies.json');
    if (!fs.existsSync(listFile)) { problems.push(`${where}: missing studies.json`); continue; }
    let list;
    try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { problems.push(`${where}/studies.json: ${e.message}`); continue; }
    if (!Array.isArray(list)) { problems.push(`${where}/studies.json: must be a list`); continue; }
    const used = new Set(), chapters = new Map();
    list.forEach((s, i) => {
      const at = `${where} #${i + 1}${Number.isInteger(s.chapter) ? ` (chapter ${s.chapter})` : ''}`;
      if (!Number.isInteger(s.chapter) || s.chapter < 0 || s.chapter > book.chapters) { problems.push(`${at}: "chapter" must be 0 (overview) to ${book.chapters}`); return; }
      const covers = s.covers ?? [s.chapter];
      if (s.covers && (!Array.isArray(covers) || !s.chapter || !covers.includes(s.chapter) || covers.some(c => !Number.isInteger(c) || c < 1 || c > book.chapters)))
        problems.push(`${at}: "covers" must list chapters 1–${book.chapters}, including "chapter"`);
      for (const c of covers) {
        if (chapters.has(c)) problems.push(`${at}: chapter ${c} already has a study (#${chapters.get(c) + 1})`);
        chapters.set(c, i);
      }
      for (const f of ['title', 'summary']) if (typeof s[f] !== 'string' || !s[f].trim()) problems.push(`${at}: missing "${f}"`);
      if (!DATE.test(s.date || '')) problems.push(`${at}: "date" must look like 2026-10-24`);
      if (!Array.isArray(s.themes) || s.themes.some(t => typeof t !== 'string' || !t.trim())) problems.push(`${at}: "themes" must be a list of words`);
      if (!Array.isArray(s.parts) || !s.parts.length) { problems.push(`${at}: "parts" must list at least one file`); return; }
      const parts = [];
      for (const p of s.parts) {
        if (!p?.label || !/^[\w.-]+\.md$/.test(p?.file || '')) { problems.push(`${at}: each part needs "label" and a .md "file"`); continue; }
        const file = path.join(dir, folder, p.file);
        if (!fs.existsSync(file)) { problems.push(`${at}: file ${folder}/${p.file} not found`); continue; }
        used.add(p.file);
        const md = fs.readFileSync(file, 'utf8');
        for (const [, href] of md.matchAll(MD_LINK))
          if (!studyRoute(href, books)) problems.push(`${folder}/${p.file}: link "${decodeURIComponent(href)}" must name a study as "<Carte> capitolul N.md" or "<Carte> privire de ansamblu.md"`);
        parts.push({ label: p.label, file: p.file, md });
      }
      if (parts.length) studies.push({ b: book.id, ...s, parts, bookWords });
    });
    for (const f of fs.readdirSync(path.join(dir, folder)))
      if (f.endsWith('.md') && !used.has(f)) problems.push(`${where}/${f}: not listed in studies.json`);
  }
  const order = new Map(books.map((b, i) => [b.id, i]));
  studies.sort((x, y) => order.get(x.b) - order.get(y.b) || x.chapter - y.chapter);
  return { studies, problems };
}

// Builds what the app downloads: { index, files: { path: html }, shards: { name: { word: [study numbers] } } }.
export function buildStudies(studies, books) {
  const files = {}, words = new Map();
  const index = studies.map((s, n) => {
    let text = '';
    const parts = s.parts.map(p => {
      const { html, sections, level } = renderPart(p.md, books);
      const out = `data/studies/${s.b}/${p.file.replace(/\.md$/, '.html')}`;
      files[out] = html;
      text += ' ' + plain(html);
      const outline = level === 'h1' ? sections.slice(1) : sections; // a lone h1 level starts with the document title
      return { label: p.label, path: out, sections: outline.length, outline: outline.slice(0, 8).map(h => headCase(h, s.bookWords)) };
    });
    const count = text.trim().split(' ').length;
    for (const t of new Set(tokens(norm(`${s.title} ${s.summary} ${s.themes.join(' ')} ${text}`)))) {
      if (!words.has(t)) words.set(t, []);
      words.get(t).push(n);
    }
    const entry = { id: `${s.b}-${s.chapter}`, b: s.b, c: s.chapter };
    if (s.covers) entry.covers = s.covers;
    return { ...entry, date: s.date, title: s.title, summary: s.summary, themes: s.themes, words: count, parts };
  });
  const shards = {};
  for (const [w, list] of [...words].sort((a, b) => a[0] < b[0] ? -1 : 1)) (shards[shardOf(w)] ??= {})[w] = list;
  return { index, files, shards };
}
