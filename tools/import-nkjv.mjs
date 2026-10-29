// Imports The NKJV Study Bible (PDF, Thomas Nelson, 2nd ed. 2014) into data/translations/nkjv/:
//   text.json             the NKJV verses (plain text; the italics of supplied words are not kept)
//   notes.json            the centre-column references (letters) and word notes (numbers), at the marked word
//   study/<BOOK>.json     per verse: the study notes and the word studies (format: tools/study-notes.mjs)
//   study/<BOOK>.book.json  the book introduction ("Sumar") and, per chapter, the inserts not tied to a verse
//                         (Bible Times & Culture Notes, charts, maps, pictures): "Informații suplimentare"
//   study/index.json      the index of every note and insert, with its verses (see the end of this file)
//   study/images/         maps, charts and pictures cut from the pages
// Usage: node tools/import-nkjv.mjs "D:/Biblia PDF/The New King James Version Study Bible.pdf" [GEN EXO …]
// Without books, every book is imported; the books not named keep their earlier import.
// --text imports only the verses and the centre-column notes (text.json, notes.json); the study notes, inserts,
// images and index entries of those books are left as they were.
// Needs MuPDF for Node, kept outside the project: `npm install mupdf` in any folder, then set
// MUPDF=<that folder>/node_modules/mupdf/dist/mupdf.js
//
// The page is sorted by font, not by position: verses in Esprit (9 pt; verse numbers Esprit Medium ~6 pt,
// reference letters Esprit Italic ~6 pt, chapter numbers ~23 pt), the reference column in Myriad ~6 pt, the
// notes in Myriad ~7 pt (labels bold blue, headwords bold), the running header in Gotham Medium 8 pt. Inserts
// are the coloured fills and the images; what is printed inside them belongs to them. Each stream is read
// column by column (left, then right), top to bottom.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { byName, BOOK_RE } from './english-books.mjs';

const textOnly = process.argv.includes('--text');
const [pdfPath, ...only] = process.argv.slice(2).filter(a => a !== '--text');
if (!pdfPath) { console.error('Usage: node tools/import-nkjv.mjs <NKJV Study Bible.pdf> [--text] [BOOK …]'); process.exit(1); }
const mupdf = await import(process.env.MUPDF ? pathToFileURL(process.env.MUPDF).href : 'mupdf');

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'data/translations/nkjv'), studyDir = path.join(outDir, 'study'), imageDir = path.join(studyDir, 'images');
const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), 'application/pdf');

// ---------- Page reading ----------

const STRIP = [0.08, 0, 0, 0.12], CULTURE = [0.10, 0, 0.55, 0.10], WORD = [0.11, 0, 0.05, 0.10], ARTICLE = [0.06, 0.06, 0.16, 0], BAR = [0, 0, 0, 0.70];
const area = r => (r[2] - r[0]) * (r[3] - r[1]);
const near = (a, b, d = 0.02) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= d);
const inside = (r, x, y, pad = 1) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;
const overlaps = (a, b, pad = 0) => a[0] < b[2] + pad && b[0] < a[2] + pad && a[1] < b[3] + pad && b[1] < a[3] + pad;
const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

function pathBounds(p, m) {
  let r = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => { const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5]; r = [Math.min(r[0], X), Math.min(r[1], Y), Math.max(r[2], X), Math.max(r[3], Y)]; };
  p.walk({ moveTo: add, lineTo: add, curveTo: (a, b, c, d, e, f) => { add(a, b); add(c, d); add(e, f); }, closePath() {} });
  return r;
}

// Characters grouped in lines; a line is cut where a gap wider than 12 pt separates two columns.
function readPage(page) {
  const lines = [], images = [];
  let chars = null;
  page.toStructuredText('preserve-whitespace,preserve-images').walk({
    onImageBlock(bbox) { images.push(bbox); },
    beginLine() { chars = []; },
    onChar(c, origin, font, size, quad, color) {
      const name = font.getName().replace(/^\w+\+/, '');
      chars.push({ c, x: origin[0], y: origin[1], x1: Math.max(quad[2], quad[6]), top: Math.min(quad[1], quad[3]), size, font: name,
        es: /Esprit/.test(name), bold: /Bold|Semibold|Black/.test(name), italic: /It/.test(name), medium: /Medium/.test(name),
        blue: !!color && color[2] > 0.45 && color[0] < 0.2, white: !!color && color.every(v => v > 0.9) });
    },
    endLine() {
      let cur = [];
      for (const ch of chars) {
        if (cur.length && ch.x - cur.at(-1).x1 > 12) { lines.push(makeLine(cur)); cur = []; }
        cur.push(ch);
      }
      if (cur.length) lines.push(makeLine(cur));
    }
  });
  const fills = [];
  page.run(new mupdf.Device({
    fillPath(p, evenOdd, ctm, cs, color) { const r = pathBounds(p, ctm); if ((r[2] - r[0]) * (r[3] - r[1]) > 400) fills.push({ r, color: color.map(v => +v.toFixed(2)) }); }
  }), mupdf.Matrix.identity);
  const [, , width, height] = page.getBounds();
  return { lines: lines.filter(l => l.text.trim()), images, fills, width, height };
}

function makeLine(chars) {
  const visible = chars.filter(c => c.c.trim());
  const sizes = visible.map(c => c.size).sort((a, b) => a - b);
  const share = f => visible.filter(f).length / (visible.length || 1);
  return { chars, text: chars.map(c => c.c).join(''), x0: Math.min(...chars.map(c => c.x)), x1: Math.max(...chars.map(c => c.x1)),
    y: Math.max(...chars.map(c => c.y)), top: Math.min(...visible.map(c => c.top)), size: sizes[sizes.length >> 1] || 0, max: sizes.at(-1) || 0,
    es: share(c => c.es) > 0.5, gotham: share(c => /Gotham/.test(c.font)) > 0.5, bold: share(c => c.bold) > 0.5, white: share(c => c.white) > 0.5 };
}

// ---------- Text helpers ----------

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const words = new Set();           // every word printed whole, for joining the words cut by a hyphen
const learn = s => { for (const w of s.replace(/\u00AD/g, '').toLowerCase().match(/[a-z’']+(?:-[a-z’']+)*/g) || []) words.add(w); };

// A run of characters as HTML: bold and italic kept.
function charsHtml(chars) {
  let out = '', open = '';
  for (const ch of chars) {
    const want = ch.c.trim() ? (ch.bold ? 'strong' : ch.italic ? 'em' : '') : open;
    if (want !== open) { out += (open ? `</${open}>` : '') + (want ? `<${want}>` : ''); open = want; }
    out += esc(ch.c);
  }
  return out + (open ? `</${open}>` : '');
}

// Joins a line to the text before it. A soft hyphen (U+00AD) at the end joins without a space; a word cut by a
// real hyphen is put back together unless the hyphenated form is the one printed elsewhere ("Beer-sheba").
function joinLine(text, next) {
  next = next.trimStart();
  if (!text) return next;
  if (!next) return text;
  if (/\u00AD(<\/\w+>)?$/.test(text)) return text.replace(/\u00AD(<\/\w+>)?$/, '$1') + next;
  const m = text.match(/([A-Za-z’']+)-(<\/\w+>)?$/);
  const right = next.replace(/^<\w+>/, '').match(/^[a-z’']+/);
  if (m && right) {
    const whole = (m[1] + right[0]).toLowerCase(), hyphened = (m[1] + '-' + right[0]).toLowerCase();
    const keep = words.has(hyphened) && !words.has(whole);
    return text.replace(/-(<\/\w+>)?$/, (_, tag) => (keep ? '-' : '') + (tag || '')) + next;
  }
  if (/[–—](<\/\w+>)?$/.test(text)) return text + next;
  return text.replace(/\s+$/, '') + ' ' + next;
}
const tidy = s => s.replace(/\u00AD/g, '').replace(/\s+/g, ' ').replace(/([–—])\s+(\d)/g, '$1$2').replace(/\s+([,;:.!?)\]])/g, '$1')
  .replace(/<(strong|em)>(\s*)<\/\1>/g, '$2').replace(/<\/(strong|em)>(\s*)<\1>/g, '$2').replace(/ {2,}/g, ' ').replace(/ ([,;:.!?)\]])/g, '$1').trim();
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const slug = s => plain(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// ---------- References ----------

// "Ps. 33:6, 9; 104:20" -> [{ s, e, to: [[BOOK, c, [verses]]] }]; a reference without a book continues the previous one.
const REF = new RegExp(`(?:\\b(${BOOK_RE})\\.?\\s+)?(\\d{1,3}):(\\d{1,3}(?:\\s*[–-]\\s*\\d{1,3}(?![:\\d]))?(?:,\\s*\\d{1,3}(?:\\s*[–-]\\s*\\d{1,3})?(?![:\\d]))*)`, 'gi');
// After a parenthesis or the end of a sentence a reference without a book is again in the book of the note.
function findLinks(text, home) {
  const links = [];
  let book = home, last = 0;
  for (const m of text.matchAll(REF)) {
    if (/[()]|\.\s/.test(text.slice(last, m.index))) book = home;
    last = m.index + m[0].length;
    if (m[1]) book = byName.get(m[1].replace(/\s+/g, ' ').toUpperCase());
    const verses = [];
    for (const part of m[3].split(',')) {
      const [a, b = a] = part.split(/[–-]/).map(n => +n.trim());
      for (let v = a; v <= Math.min(b, a + 175); v++) verses.push(v);
    }
    links.push({ s: m.index, e: m.index + m[0].length, to: [[book, +m[2], verses]] });
  }
  return links;
}
// The verses a text cites, as "BOOK c:v" (a range keeps its first and last verse only).
const cites = (text, book) => [...new Set(findLinks(text, book).flatMap(l => l.to.map(([b, c, vs]) => `${b} ${c}:${vs[0]}${vs.length > 1 ? '-' + vs.at(-1) : ''}`)))];

// A note label: "12:5", "11:10–25", "12:1–3, 7", "6:8—10:1" -> { ref, from: "c:v", to: "c:v" }.
function parseLabel(s) {
  const m = s.trim().match(/^(\d+):(\d+)(?:\s*[–—-]\s*(\d+)(?::(\d+))?)?((?:,\s*\d+(?:\s*[–—-]\s*\d+)?)*)$/);
  if (!m) return null;
  const c = +m[1], v = +m[2];
  let to = m[4] ? `${m[3]}:${m[4]}` : m[3] ? `${c}:${m[3]}` : `${c}:${v}`;
  const extra = m[5].match(/\d+(?=\s*$)/);
  if (extra && +extra[0] > +to.split(':')[1] && to.startsWith(c + ':')) to = `${c}:${extra[0]}`;
  return { ref: s.trim().replace(/\s+/g, ''), from: `${c}:${v}`, to };
}

// ---------- Figures ----------

function renderClip(page, rect, scale, file) {
  const box = [Math.floor(rect[0] * scale), Math.floor(rect[1] * scale), Math.ceil(rect[2] * scale), Math.ceil(rect[3] * scale)];
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, box, false);
  pix.clear(255);
  const dev = new mupdf.DrawDevice(mupdf.Matrix.scale(scale, scale), pix);
  page.run(dev, mupdf.Matrix.identity);
  dev.close();
  if (!textOnly) fs.writeFileSync(path.join(imageDir, file), pix.asJPEG(80));
  return { w: box[2] - box[0], h: box[3] - box[1] };
}

// The inserts of a page: coloured boxes (culture notes, word studies, charts) and images (maps, pictures).
function inserts(P) {
  const list = [];
  // A tinted block holding only reference-column text is the column itself, run on beside its narrow strip
  // when the page is full (Rom. 1, pdf page 1831), not a chart.
  const refsOnly = r => {
    const ls = P.lines.filter(l => inside(r, (l.x0 + l.x1) / 2, (l.top + l.y) / 2));
    return ls.length && ls.every(l => !l.es && !l.gotham && l.size < 6.6);
  };
  for (const f of [...P.fills].sort((a, b) => area(b.r) - area(a.r))) {
    const w = f.r[2] - f.r[0], h = f.r[3] - f.r[1];
    if (w < 100 || h < 40 || area(f.r) > P.width * P.height * 0.7 || f.color.every(v => v < 0.03) || f.color.every(v => v > 0.97) || near(f.color, STRIP) && (w < 120 || h < 60 || refsOnly(f.r))) continue;
    list.push({ kind: near(f.color, CULTURE) ? 'culture' : near(f.color, WORD) ? 'word' : near(f.color, ARTICLE) ? 'article' : 'chart', r: f.r });
  }
  for (const r of P.images) if ((r[2] - r[0]) * (r[3] - r[1]) > 2500 && r[3] - r[1] > 30) list.push({ kind: 'figure', r: [...r] });
  for (const bar of P.fills.filter(f => near(f.color, BAR, 0.05))) {
    const i = list.findIndex(x => overlaps(x.r, bar.r, 2));
    if (i >= 0) list[i].r = union(list[i].r, bar.r);
  }
  // Overlapping inserts become one: a picture inside a box stays a picture of that box.
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (!overlaps(list[i].r, list[j].r, 1)) continue;
      const [keep, drop] = list[i].kind === 'figure' ? [list[j], list[i]] : [list[i], list[j]];
      if (drop.kind === 'figure' && keep.kind !== 'figure') keep.pics = [...keep.pics || [], drop.r];
      keep.r = union(keep.r, drop.r);
      list.splice(list.indexOf(drop), 1);
      merged = true;
      break outer;
    }
  }
  return list.map(x => ({ ...x, r: [Math.max(x.r[0], 20), Math.max(x.r[1], 40), Math.min(x.r[2], P.width - 15), Math.min(x.r[3], P.height - 15)], lines: [], caption: [], credit: [] }));
}

// The chapter an insert not tied to a verse is shown with ("Informații suplimentare"): the chapter being read
// where the insert is printed, in reading order (left column, then right; a full-width insert by its top edge).
// Page 49 of the PDF ends Genesis 5 and starts 6; "Ages of the Patriarchs", at the top, goes with chapter 5.
// start: the chapter read at the top of the page; starts: the chapters that begin on it, [{ c, col, y }].
function insertChapter(start, starts, insert, P) {
  const [x0, y0, x1] = insert.r, wide = x1 - x0 > P.width * 0.6, col = x0 > P.width / 2 - 10 ? 1 : 0;
  const before = starts.filter(s => wide ? s.y < y0 : s.col < col || s.col === col && s.y < y0);
  return before.length ? Math.max(...before.map(s => s.c)) : start;
}

// ---------- Pass 1: find the books, read their pages ----------

const header = l => l.gotham && l.y < 45 && l.size < 9;
// The title prints the name alone ("Corinthians"); the ordinal is in the line above ("The First Epistle of … to the").
// An ordinal that makes no book name ("The First Book of Moses" over "Genesis") is ignored.
const ORDINAL = { FIRST: '1 ', SECOND: '2 ', THIRD: '3 ' };
const titleOf = P => {
  const l = P.lines.find(l => l.gotham && l.max > 30);
  if (!l) return;
  const name = l.text.trim().toUpperCase();
  const above = P.lines.filter(s => s.gotham && s !== l && s.y < l.y && l.top - s.y < 20).at(-1);
  const ord = above?.text.toUpperCase().match(/\b(FIRST|SECOND|THIRD)\b/);
  return ord && byName.get(ORDINAL[ord[1]] + name) || byName.get(name);
};
const bookPages = new Map();       // BOOK -> [pdf page index]
let current = null;
for (let pn = 0; pn < doc.countPages(); pn++) {
  const P = readPage(doc.loadPage(pn));
  const t = titleOf(P);
  if (t) current = t;
  if (P.lines.some(l => /^\s*CONCORDANCE/.test(l.text) && l.gotham)) break;
  if (!current) continue;
  if (only.length && !only.includes(current)) { if (only.every(b => bookPages.has(b))) break; continue; }
  (bookPages.get(current) || bookPages.set(current, []).get(current)).push({ pn, P });
  for (const l of P.lines) learn(l.text);
}
if (!bookPages.size) { console.error('No book found.'); process.exit(1); }

// ---------- Pass 2: each book ----------

fs.mkdirSync(imageDir, { recursive: true });
const readJson = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const text = readJson(path.join(outDir, 'text.json'), {});
const notes = readJson(path.join(outDir, 'notes.json'), {});
const index = readJson(path.join(studyDir, 'index.json'), { items: {}, verses: {} });
const warnings = [];

for (const [book, pages] of bookPages) {
  if (!textOnly) for (const f of fs.readdirSync(imageDir)) if (f.startsWith(book + '-')) fs.rmSync(path.join(imageDir, f));
  for (const k of Object.keys(notes)) if (k.startsWith(book + ' ')) delete notes[k];
  if (!textOnly) for (const [id, item] of Object.entries(index.items)) if (item.b === book) delete index.items[id];
  const verses = (text[book] = []), study = {}, extra = { intro: null, chapters: {} };
  const ids = new Set();
  const uid = base => { let id = base, n = 1; while (ids.has(id)) id = `${base}~${++n}`; ids.add(id); return id; };
  const record = (id, entry) => { if (!textOnly) index.items[id] = { b: book, ...entry }; };

  // Streams over the whole book: verse characters, note lines, the reference entries of each page.
  let chapter = 0, verse = 0, buf = null, drop = '';
  const marks = {};                // "c:v" -> [{ m, pos, after, pn }]
  const entries = {};              // pn -> marker -> [entry text]
  let note = null;
  const noteList = [];
  const intro = { title: '', sub: '', parts: [], side: [], figures: [] };   // side: the timeline at the page edge
  let introDone = false;

  const flush = () => {
    if (!buf || !chapter) return;
    const t = tidy(buf.text);
    const ch = (verses[chapter - 1] ||= []);
    if (ch[verse - 1] != null) warnings.push(`${book} ${chapter}:${verse} printed twice`);
    ch[verse - 1] = t;
    marks[`${chapter}:${verse}`] = buf.marks.map(({ m, pos, after, pn }) => {
      const at = tidy(buf.text.slice(0, pos) + '\u0001').length - 1;
      return { m, pn, at: after ? at : at + t.slice(at).match(/^\s*[\p{L}’'-]*/u)[0].length };
    });
    buf = null;
  };
  const startVerse = v => { flush(); verse = v; buf = { text: '', marks: [] }; };

  for (const { pn, P } of pages) {
    const page = doc.loadPage(pn);
    const head = P.lines.find(header);
    const printed = head && +(head.text.match(/(?:^\s*(\d+)\s*\|)|(?:\|\s*(\d+)\s*$)/) || []).slice(1).find(Boolean);
    const lines = P.lines.filter(l => !header(l));
    const startChapter = chapter || 1, starts = [];
    const firstChapter = lines.some(l => l.es && l.max > 20);
    const isIntro = !introDone && !firstChapter;
    if (firstChapter) introDone = true;
    // In the introduction only the pictures are inserts; its text (Myriad, 8.5 pt and more) is never part of one.
    const ins = inserts(P).filter(x => !isIntro || x.kind === 'figure');
    for (const l of lines) {
      const cx = (l.x0 + l.x1) / 2, cy = (l.top + l.y) / 2;
      l.insert = isIntro && !l.gotham && l.size >= 8.5 ? null : ins.find(x => inside(x.r, cx, cy));
      if (l.insert) l.insert.lines.push(l);
    }
    // Captions and credits printed under or beside a picture.
    for (const l of lines.filter(l => !l.insert && (l.gotham && l.size < 7.5 || l.es && l.size < 7 && !l.chars.some(c => c.size > 8)))) {
      const x = ins.filter(i => i.kind !== 'word').sort((a, b) => Math.abs(l.top - a.r[3]) - Math.abs(l.top - b.r[3]))[0];
      if (x && l.top - x.r[3] < 40 && l.top > x.r[1] - 10 && l.x0 < x.r[2] + 4 && l.x1 > x.r[0] - 4) { l.insert = x; (l.gotham ? x.caption : x.credit).push(l); }
    }
    const byCol = list => {
      if (!list.length) return [];
      const mid = (Math.min(...list.map(l => l.x0)) + Math.max(...list.map(l => l.x1))) / 2;
      for (const l of list) { l.col = l.x0 >= mid - 2 ? 1 : 0; l.key = l.max > 20 ? l.top - 0.5 : l.y; }
      return list.sort((a, b) => a.col - b.col || a.key - b.key || a.x0 - b.x0);
    };

    if (isIntro) {
      // The title page and the introduction: headings (Gotham bold) and paragraphs (Myriad).
      for (const l of lines.filter(l => l.gotham && !l.bold && l.size > 10)) {
        if (l.max > 30) intro.title = l.text.trim(); else intro.sub = l.text.trim();
        if (l.insert) l.insert.lines.splice(l.insert.lines.indexOf(l), 1);
        l.insert = 'title';
      }
      // One text column (wrapped around the pictures) and, at the right edge, the timeline: read apart, the
      // timeline after the text of its page. A line opening with an outline mark ("II.", "B.") or a bold date
      // starts its own paragraph.
      const free = lines.filter(l => !l.insert).sort((a, b) => a.y - b.y || a.x0 - b.x0);
      const side = free.filter(l => l.x0 > P.width * 0.68), main = free.filter(l => !side.includes(l));
      const margin = Math.min(...main.map(l => l.x0));
      for (const [list, parts] of [[main, intro.parts], [side, intro.side]]) {
        let prev = null;
        for (const l of list) {
          const html = charsHtml(l.chars);
          if (l.gotham && l.bold) parts.push({ h: html });
          else {
            const lead = l.chars.filter(c => c.c.trim()).slice(0, 3);
            const mark = /^\s*(?:[IVX]+|[A-Z])\.\s/.test(l.text) || lead.length && lead.every(c => c.bold);
            const indent = prev && l.x0 - margin > 4 && l.x0 - margin < 20 && prev.x0 - margin < 2;
            const gap = prev && l.y - prev.y > l.size * 2.2;
            if (!parts.length || parts.at(-1).h != null || mark || indent || gap) parts.push({ p: [] });
            parts.at(-1).p.push(html);
          }
          prev = l;
        }
      }
    } else {
      // Verses.
      for (const l of byCol(lines.filter(l => !l.insert && l.es && l.size >= 8.5 && !(l.bold && l.max < 20)))) {
        let s = '';
        for (const ch of l.chars) {
          if (ch.size > 40) { flush(); chapter = chapter + 1 || 1; drop = ch.c; startVerse(1); continue; }
          if (ch.size > 15) {
            if (/\d/.test(ch.c)) { if (!s.startsWith('\u0003')) { if (buf) buf.text = joinLine(buf.text, s); flush(); s = '\u0003'; } s += ch.c; }
            continue;
          }
          if (s.startsWith('\u0003')) { chapter = +s.slice(1); s = ''; startVerse(1); }
          if (ch.size < 7.5 && ch.medium && /\d/.test(ch.c)) {
            if (!s.startsWith('\u0002')) { if (buf) buf.text = joinLine(buf.text, s); s = '\u0002'; }
            s += ch.c;
            continue;
          }
          if (s.startsWith('\u0002')) { const v = +s.slice(1); if (v !== verse + 1) warnings.push(`${book} ${chapter}: verse ${v} after ${verse} (pdf page ${pn + 1})`); startVerse(v); s = ''; }
          if (ch.size < 7.5 && ch.italic && /[a-z0-9]/.test(ch.c)) {
            if (!buf) continue;
            buf.text = joinLine(buf.text, s); s = '';
            buf.marks.push({ m: ch.c, pos: buf.text.replace(/\s+$/, '').length, after: /\S$/.test(buf.text), pn });
            continue;
          }
          if (drop && ch.c.trim()) { s += drop; drop = ''; }
          s += ch.c;
        }
        if (s.startsWith('\u0003')) { chapter = +s.slice(1); startVerse(1); s = ''; }
        if (s.startsWith('\u0002')) { startVerse(+s.slice(1)); s = ''; }
        if (buf) buf.text = joinLine(buf.text, s);
        if (l.max > 20) starts.push({ c: chapter, col: l.col, y: l.top });   // a chapter number, or the drop cap of chapter 1
      }
      // The reference column: a bold verse number, then entries opened by a very small italic letter or number.
      // Where the column runs on into a wide block beside its narrow strip, the strip is read first, then the block.
      let entry = null;
      const refLines = lines.filter(l => !l.insert && !l.es && !l.gotham && l.size < 6.6);
      const left = Math.min(...refLines.map(l => l.x0)), runOn = l => l.x0 > left + 30;
      for (const l of [...byCol(refLines.filter(l => !runOn(l))), ...byCol(refLines.filter(runOn))]) {
        for (const ch of l.chars) {
          if (ch.size < 5 && ch.italic && /[a-z0-9]/.test(ch.c)) {
            entry = { m: ch.c, text: '' };
            ((entries[pn] ||= {})[ch.c] ||= []).push(entry);
            continue;
          }
          if (ch.bold && /\d/.test(ch.c)) { entry = null; continue; }
          if (entry) entry.text += ch.c;
        }
        if (entry) entry.text += ' ';
      }
      // Notes: a bold blue label opens a note; the bold words after it are the headwords.
      for (const l of byCol(lines.filter(l => !l.insert && !l.es && !l.gotham && l.size >= 6.7 && l.size < 7.2))) {
        let run = [];
        const push = () => { if (run.length && note) note.lines.at(-1).push(...run); run = []; };
        note?.lines.push([]);
        for (let i = 0; i < l.chars.length; i++) {
          const ch = l.chars[i];
          if (ch.blue && ch.bold && /\d/.test(ch.c) && !l.chars[i - 1]?.blue) {
            let j = i; while (l.chars[j] && (l.chars[j].blue || l.chars[j].c === ' ' && l.chars[j + 1]?.blue)) j++;
            const label = parseLabel(l.chars.slice(i, j).map(c => c.c).join(''));
            if (label) {
              push();
              note = { ...label, pn, page: printed, lines: [[]] };
              noteList.push(note);
              note.lines[0].push(...l.chars.slice(i, j));
              i = j - 1;
              continue;
            }
          }
          run.push(ch);
        }
        push();
      }
    }

    // Inserts: word studies go with their verse; the others with the chapter being read.
    const at = chapter || 1;
    let n = 0;
    for (const x of ins) {
      const sorted = byCol([...x.lines]);
      // A chart may print its title just above its box ("The Christian Life", Rom. 13, pdf page 1852).
      const titleLine = sorted.find(l => l.gotham && l.bold && (l.white || l.size >= 8.5))
        || lines.find(l => !l.insert && l.gotham && l.bold && l.size >= 8.5 && l.y <= x.r[1] + 2 && x.r[1] - l.y < 25 && l.x0 < x.r[2] && l.x1 > x.r[0]);
      // The picture then takes the title in, as the charts that print it inside their box do.
      if (titleLine && !titleLine.insert) { titleLine.insert = x; x.r = union(x.r, [x.r[0], titleLine.top - 4, x.r[2], x.r[1]]); }
      const label = sorted.find(l => l.gotham && !l.bold && l.white);
      const body = sorted.filter(l => l !== titleLine && l !== label && !l.gotham && l.size >= 7 && l.size < 8.2);
      const title = titleLine ? tidy(titleLine.text) : '';
      const paras = [];
      let prev = null;
      for (const l of body) {
        if (!paras.length || prev && l.col === prev.col && l.x0 - prev.x0 > 6 && l.x0 - prev.x0 < 20) paras.push('');
        paras[paras.length - 1] = joinLine(paras.at(-1), charsHtml(l.chars));
        prev = l;
      }
      const html = paras.map(tidy).filter(Boolean).map(p => `<p>${p}</p>`).join('');
      const caption = tidy(x.caption.map(l => charsHtml(l.chars)).reduce(joinLine, '')), credit = tidy(x.credit.map(l => l.text).reduce(joinLine, ''));
      const allText = tidy(sorted.map(l => l.text).reduce(joinLine, ''));
      if (isIntro) {
        const file = `${book}-${String(pn + 1).padStart(4, '0')}-${++n}.jpg`;
        intro.figures.push({ k: 'figure', ...(title && { title }), src: `images/${file}`, ...renderClip(page, x.r, 2.5, file), ...(caption && { caption }), ...(credit && { credit }) });
        continue;
      }
      if (x.kind === 'word' && title) {
        const ref = (plain(html).match(/\((\d+:\d+)[,;)\s]/) || [])[1] || `${at}:1`;
        const id = uid(`${book}.${ref.replace(':', '.')}.word.${slug(title)}`);
        const item = { k: 'box', kind: 'word', id, ref, title, label: 'Word Study', html };
        (study[ref] ||= []).push(item);
        record(id, { k: 'word', title, from: ref, to: ref, pdf: pn + 1, page: printed, refs: cites(plain(html), book) });
        continue;
      }
      const kind = x.kind === 'word' ? 'chart' : x.kind;
      const atc = insertChapter(startChapter, starts, x, P);
      const id = uid(`${book}.c${atc}.${kind}.${slug(title || caption || 'insert')}`);
      const clip = (r, more = {}) => { const file = `${book}-${String(pn + 1).padStart(4, '0')}-${++n}.jpg`; return { k: 'figure', src: `images/${file}`, ...renderClip(page, r, 2.5, file), ...more }; };
      let item;
      if ((kind === 'culture' || kind === 'article') && html) {
        // The text of the box, and its pictures with the captions printed inside the box.
        const inner = tidy(sorted.filter(l => l.gotham && !l.bold && !l.white && l.size < 7.5).map(l => charsHtml(l.chars)).reduce(joinLine, ''));
        const pics = (x.pics || []).map((r, i) => clip(r, i === 0 && inner ? { caption: inner } : {}));
        item = { k: 'box', kind, id, title, ...(label && { label: tidy(label.text) }), html, ...(pics.length && { figures: pics }) };
      } else item = { ...clip(x.r, { ...(title && { title }), ...(caption && { caption }), ...(credit && { credit }) }), kind, id };
      (extra.chapters[atc] ||= []).push(item);
      record(id, { k: kind, title: title || plain(caption).slice(0, 80), chapter: atc, pdf: pn + 1, page: printed, refs: cites(allText + ' ' + plain(caption), book), text: allText.slice(0, 400) });
    }
  }
  flush();

  // Notes, now that every verse is known: HTML, headwords found in their verses, the verses they cite.
  const verseText = cv => { const [c, v] = cv.split(':').map(Number); return verses[c - 1]?.[v - 1]; };
  for (const nt of noteList) {
    const html = `<p>${tidy(nt.lines.map(charsHtml).reduce(joinLine, ''))}</p>`;
    const id = uid(`${book}.${nt.from.replace(':', '.')}${nt.to !== nt.from ? '-' + (nt.to.split(':')[0] === nt.from.split(':')[0] ? nt.to.split(':')[1] : nt.to.replace(':', '.')) : ''}`);
    const lemmas = [...html.matchAll(/<strong>([^<]+?)<\/strong>/g)].map(m => m[1].replace(/^[\d:–—, -]+(?=\D)/, '').replace(/\s+/g, ' ').trim().replace(/[:,;.]$/, ''))
      .filter(w => w.length > 1 && !/^\d/.test(w))
      .map(w => {
        const [c0, v0] = nt.from.split(':').map(Number), [c1, v1] = nt.to.split(':').map(Number);
        for (let c = c0; c <= c1; c++) for (let v = c === c0 ? v0 : 1; v <= (c === c1 ? v1 : verses[c - 1]?.length || 0); v++) {
          const t = verseText(`${c}:${v}`), i = t ? t.toLowerCase().indexOf(w.toLowerCase()) : -1;
          if (i >= 0) return { w, v: `${c}:${v}`, at: i };
        }
        return { w };
      });
    if (!verseText(nt.from)) { warnings.push(`${book} note ${nt.ref}: verse ${nt.from} not found`); continue; }
    (study[nt.from] ||= []).push({ k: 'note', id, ref: nt.ref, ...(nt.to !== nt.from && { to: nt.to }), html });
    record(id, { k: 'note', from: nt.from, to: nt.to, pdf: nt.pn + 1, page: nt.page, ...(lemmas.length && { lemmas }), refs: cites(plain(html).replace(/^\S+/, ''), book) });
  }

  // References at the marked words.
  for (const [cv, list] of Object.entries(marks)) {
    const groups = [];
    for (const { m, at, pn } of list) {
      const entry = (entries[pn]?.[m] || []).find(e => !e.taken) || entries[pn]?.[m]?.[0];
      if (!entry) { warnings.push(`${book} ${cv}: marker "${m}" without an entry (pdf page ${pn + 1})`); continue; }
      entry.taken = true;
      const group = { at, text: `${m} ${tidy(entry.text)}` };
      const links = findLinks(group.text, book).filter(x => x.s > m.length);
      if (/^[a-z]$/.test(m) && links.length) group.links = links;
      groups.push(group);
    }
    if (groups.length) notes[`${book} ${cv}`] = groups.sort((a, b) => a.at - b.at);
  }

  // The introduction ("Sumar").
  if (intro.parts.length) {
    const html = [...intro.parts, ...intro.side].map(p => p.h != null ? `<h3>${tidy(p.h)}</h3>` : `<p>${tidy(p.p.reduce(joinLine, ''))}</p>`).filter(s => !/^<(p|h3)><\/\1>$/.test(s)).join('');
    extra.intro = { id: `${book}.intro`, title: intro.title, ...(intro.sub && { sub: intro.sub }), html, ...(intro.figures.length && { figures: intro.figures }) };
    record(`${book}.intro`, { k: 'intro', title: intro.title, pdf: pages[0].pn + 1 });
  }

  if (!textOnly) {
    fs.writeFileSync(path.join(studyDir, `${book}.json`), JSON.stringify(study, null, 1) + '\n');
    fs.writeFileSync(path.join(studyDir, `${book}.book.json`), JSON.stringify(extra, null, 1) + '\n');
  }
  const all = Object.values(study).flat(), ex = Object.values(extra.chapters).flat();
  console.log(`${book}: pdf pages ${pages[0].pn + 1}–${pages.at(-1).pn + 1} · ${verses.flat().filter(v => v != null).length} verses in ${verses.length} chapters · ${all.filter(i => i.k === 'note').length} notes · ${all.filter(i => i.kind === 'word').length} word studies · ${ex.length} chapter inserts · intro ${extra.intro ? extra.intro.html.length + ' chars' : 'missing'}`);
}

// ---------- The index ----------
// study/index.json: { items: { id: { b, k, from?, to?, chapter?, title?, lemmas?, refs, pdf, page } },
//   verses: { "GEN 12:6": { own: [ids], covers: [ids], cited: [ids] } } }
// own: notes and word studies printed for the verse; covers: notes on a range that includes it; cited: notes
// and inserts elsewhere that cite it. The text of each item is in study/<BOOK>.json or <BOOK>.book.json by id.
index.verses = {};
const add = (k, field, id) => { const e = (index.verses[k] ||= {}); (e[field] ||= []).includes(id) || e[field].push(id); };
for (const [id, it] of Object.entries(index.items)) {
  if (it.from) {
    const [c0, v0] = it.from.split(':').map(Number), [c1, v1] = it.to.split(':').map(Number);
    add(`${it.b} ${it.from}`, 'own', id);
    for (let c = c0; c <= c1; c++) for (let v = c === c0 ? v0 + 1 : 1; v <= (c === c1 ? v1 : text[it.b]?.[c - 1]?.length || 0); v++) add(`${it.b} ${c}:${v}`, 'covers', id);
  }
  for (const r of it.refs || []) {
    const [b, cv] = r.split(' '), [c, vs] = cv.split(':'), [a, z = a] = vs.split('-').map(Number);
    for (let v = a; v <= z; v++) if (!(it.from === `${c}:${v}` && it.b === b)) add(`${b} ${c}:${v}`, 'cited', id);
  }
}

const meta = {
  id: 'nkjv',
  abbreviation: 'NKJV',
  name: 'New King James Version',
  description: 'NKJV Study Bible · cu note de studiu',
  language: 'en',
  color: '#3b5a7a',
  order: 3,
  source: `The NKJV Study Bible, Second Edition, Full-Color Edition (Thomas Nelson, 2014). Text extras automat din PDF-ul utilizatorului (${path.basename(pdfPath)}) cu tools/import-nkjv.mjs; cuvintele despărțite la capăt de rând au fost reunite, iar italicele cuvintelor adăugate de traducători nu sunt păstrate.`,
  copyright: 'New King James Version © 1982 Thomas Nelson. The NKJV Study Bible: notele, articolele, schițele și tabelele © 1997, 2007, 2014 Thomas Nelson; hărțile și fotografiile au sursa sub fiecare. Doar pentru uz personal: nu se publică fără acordul titularilor.',
  notes: 'Trimiterile din coloana centrală (litere) și notele de traducere (cifre), la cuvântul marcat. Notele de studiu și studiile de cuvinte se deschid din eticheta „NKJV” de după verset; introducerea cărții din „Sumar”, articolele și hărțile capitolului din „Informații suplimentare”.',
  study: Object.keys(text).filter(b => fs.existsSync(path.join(studyDir, `${b}.json`))),
  alignment: { map: {}, spans: {}, gaps: {} }
};
fs.writeFileSync(path.join(outDir, 'translation.json'), JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'text.json'), JSON.stringify(text));
fs.writeFileSync(path.join(outDir, 'notes.json'), JSON.stringify(notes));
fs.writeFileSync(path.join(studyDir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`index: ${Object.keys(index.items).length} items · ${Object.keys(index.verses).length} verses`);
if (warnings.length) console.warn(`${warnings.length} warning(s):\n  ` + warnings.slice(0, +(process.env.WARN || 25)).join('\n  '));
