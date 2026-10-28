// Which verses each study mentions: the same references the app turns into pop-ups (app/js/refs.js),
// found in the built HTML of every part. The Bible reader shows them as footnotes under each verse.
//
// Output, one file per book of the mentioned verse (data/studies/mentions/<BOOK>.json):
//   { "2:13": [ { "s": "ROM-2", "p": 0, "n": 3, "x": "…excerpt…" } ] }
// s = study id, p = part index, n = how many times that part mentions the verse, x = excerpt around the first mention.
import { books as appBooks, bookIndex } from '../app/js/data.js';
import { findReferences, findVerses } from '../app/js/refs.js';

const MAX_RANGE = 30;   // longer passages ("1:1-40") mark only their first verse, as in the reference pop-up
const SKIP = new Set(['a', 'code', 'pre']), HEADINGS = new Set(['h1', 'h2', 'h3']);
const BLOCK = new Set(['p', 'li', 'td', 'th', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'tr', 'ul', 'ol', 'table']);
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));

// The excerpt shown in the footnote pop-up for one mention. `text` is the whole paragraph (or list item,
// table cell, heading) in plain text; `start`/`end` delimit the reference inside it.
// The sentence that holds the reference; a long sentence is cut to a window around it, at word boundaries.
// A sentence ends at . ! ? followed by a capital letter, so "Rom. 2:1" or "cf. v. 4" do not end one.
const SENTENCE_END = /[.!?…]\s+(?=[A-ZĂÂÎȘȚ„«(])/g, EXCERPT = 200;
function excerpt(text, start, end) {
  let a = 0, b = text.length;
  for (const m of text.matchAll(SENTENCE_END)) {
    if (m.index + 1 <= start) a = m.index + m[0].length;
    else if (m.index >= end) { b = m.index + 1; break; }
  }
  if (b - a > EXCERPT) {
    const from = Math.max(a, start - 80), to = Math.min(b, end + EXCERPT - 80 - (end - start));
    a = from > a ? text.indexOf(' ', from) + 1 || from : a;
    b = to < b ? text.lastIndexOf(' ', to) : b;
    if (b <= end) b = to;
  }
  const body = text.slice(a, b).replace(/\s+/g, ' ').trim();
  // A list of references (a table cell: "Luca 12:47; Romani 2:12-16") says nothing more than the link.
  if (body.replace(/\S*\d\S*/g, ' ').split(/\s+/).filter(w => /\p{L}{3}/u.test(w)).length < 4) return '';
  return (a > 0 ? '…' : '') + body + (b < text.length && !/[.!?…]$/.test(body) ? '…' : '');
}

// Splits a part's HTML into blocks of plain text and returns every reference in them, with its block.
function referencesIn(html, study) {
  const out = [];
  let block = '', found = [], skip = 0, heading = 0;
  const flush = () => {
    for (const f of found) out.push({ ...f, block });
    block = ''; found = [];
  };
  for (const [, close, tag, text] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>|([^<]+)/gi)) {
    if (text === undefined) {
      const t = tag.toLowerCase(), d = close ? -1 : 1;
      if (SKIP.has(t)) skip += d;
      if (HEADINGS.has(t)) heading += d;
      if (BLOCK.has(t)) flush();
      continue;
    }
    const plain = decode(text), offset = block.length;
    block += plain;
    if (skip > 0) continue;
    const refs = findReferences(plain, study.b);
    const verses = heading > 0 || !study.c ? [] : findVerses(plain, study.b, study.c)
      .filter(v => !refs.some(r => v.start < r.end && r.start < v.end));
    for (const f of [...refs, ...verses]) found.push({ ...f, start: f.start + offset, end: f.end + offset });
  }
  flush();
  return out;
}

// studies: the rendered catalog ({ id, b, c, parts: [{ html }] }); exists(b, c, v): the verse has text somewhere.
export function studyMentions(studies, books, exists) {
  if (!appBooks.length) books.forEach((b, i) => { appBooks.push({ ...b, index: i }); bookIndex.set(b.id, i); });
  const byBook = {};
  for (const study of studies) study.parts.forEach((part, p) => {
    const seen = new Map();   // "ROM 2:13" -> entry, so a part counts once per verse
    for (const { ref, start, end, block } of referencesIn(part.html, study)) {
      const [, b, c, from, to] = ref.match(/^(\S+) (\d+):(\d+)(?:-(\d+))?$/);
      const last = to && +to - +from < MAX_RANGE ? +to : +from;
      for (let v = +from; v <= last; v++) {
        if (!exists(b, +c, v)) continue;
        const k = `${b} ${c}:${v}`;
        if (seen.has(k)) { seen.get(k).n++; continue; }
        const x = excerpt(block, start, end), entry = { s: study.id, p, n: 1, ...x && { x } };
        seen.set(k, entry);
        ((byBook[b] ??= {})[`${c}:${v}`] ??= []).push(entry);
      }
    }
  });
  return byBook;
}
