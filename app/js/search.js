import { norm } from './util.js';
import { books, bookIndex, key, compareKeys } from './data.js';

const compact = s => s.replace(/\s+/g, '');

// "Ioan 3:16", "Rom 8:28-30", "1 Cor 13", "Ps 23", "1cor 13.4" -> { b, c, v, end } or null.
export function parseReference(query) {
  const m = norm(query.trim()).replace(/\.(?=\s|\d|$)/g, ' ').replace(/\s+/g, ' ')
    .match(/^([1-3]?\s?[a-z][a-z ]*?)\s?(\d{1,3})(?:\s?[:, ]\s?(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?)?$/);
  if (!m) return null;
  const name = compact(m[1]);
  const book = books.find(b => compact(norm(b.name)) === name || b.aliases.some(a => compact(a) === name));
  if (!book) return null;
  const v = +m[3] || 0;
  return { b: book.id, c: +m[2], v, end: +m[4] || v };
}

const index = new Map(); // translation id -> [{ own, text }] with normalized text

function normalized(translation) {
  if (!index.has(translation.id)) {
    const rows = [];
    for (const [b, chapters] of Object.entries(translation.text))
      chapters.forEach((verses, ci) => verses.forEach((t, vi) => { if (t) rows.push({ b, own: key(b, ci + 1, vi + 1), text: norm(t) }); }));
    index.set(translation.id, rows);
  }
  return index.get(translation.id);
}

export function terms(query, mode) {
  const quoted = /^["„“].*["”“]$/.test(query.trim());
  const phrase = mode === 'phrase' || quoted;
  const cleaned = query.trim().replace(/^["„“]|["”“]$/g, '');
  return { phrase, any: mode === 'any' && !phrase, list: (phrase ? [norm(cleaned)] : norm(cleaned).split(/\s+/)).filter(Boolean) };
}

const isWord = ch => ch !== undefined && /[a-z0-9]/.test(ch);

function find(text, term, whole, from = 0) {
  let p = from;
  while ((p = text.indexOf(term, p)) >= 0) {
    if (!whole || (!isWord(text[p - 1]) && !isWord(text[p + term.length]))) return p;
    p += term.length || 1;
  }
  return -1;
}

// Returns canonical keys (sorted) of verses matching in any of the given translations.
export function search(translations, { query, mode, whole, scope, currentBook }) {
  const t = terms(query, mode);
  if (!t.list.length) return { keys: [], terms: t };
  const inScope = b => scope === 'all' || (scope === 'ot' || scope === 'nt' ? books[bookIndex.get(b)].testament === scope : b === currentBook);
  const found = new Set();
  for (const translation of translations) {
    for (const row of normalized(translation)) {
      if (!inScope(row.b)) continue;
      const check = term => find(row.text, term, whole) >= 0;
      if (t.any ? t.list.some(check) : t.list.every(check)) found.add(translation.canonical(row.own));
    }
  }
  return { keys: [...found].sort(compareKeys), terms: t };
}

// Character ranges to highlight in a verse.
export function highlightRanges(text, t, whole) {
  if (!t?.list.length) return [];
  const n = norm(text), ranges = [];
  for (const term of t.list) {
    let p = 0;
    while ((p = find(n, term, whole, p)) >= 0) { ranges.push([p, p + term.length]); p += Math.max(term.length, 1); }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r.slice());
  }
  return merged;
}
