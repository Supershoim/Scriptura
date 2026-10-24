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

// ---------- Approximate search ----------
// When nothing matches exactly: the verses closest to the query (a sentence quoted from memory, in other words,
// another order or other inflected forms). Each query word matches a word of the verse exactly, by the same stem
// (Romanian endings cut off), by a shared beginning or with one typo; matches are weighted by how rare the word is
// (IDF), plus a bonus for query words that appear in the same order and close together.

const ENDINGS = ['urilor', 'ilor', 'elor', 'ului', 'urile', 'iile', 'este', 'esc', 'eau', 'ati', 'ele', 'ile', 'lor', 'ul', 'lui', 'le', 'ii', 'ea', 'ei', 'ie', 'ia', 'it', 'ut', 'at', 'am', 'a', 'e', 'i', 'u'];
export function stem(w) {
  for (const e of ENDINGS) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}
const tokens = s => s.split(/[^a-z0-9]+/).filter(Boolean);

// At most one edit (substitution, insertion, deletion or swap of neighbours) between a and b.
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const ra = a.slice(i + 1), rb = b.slice(i + 1);
  return ra === rb || a.slice(i) === rb || ra === b.slice(i) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}
// How well a word of the verse answers a word of the query (0–1).
function likeness(q, qs, w) {
  if (q === w) return 1;
  if (stem(w) === qs) return 0.9;
  if (q.length >= 5 && w.length >= 5 && oneEdit(q, w)) return 0.8;
  let p = 0;
  while (p < q.length && q[p] === w[p]) p++;
  return p >= 4 && p >= 0.7 * Math.min(q.length, w.length) ? 0.7 : 0;
}

const fuzzyIndex = new Map(); // translation id -> { words: [[token]], post: Map(token -> [row]), N }
function fuzzy(translation) {
  if (!fuzzyIndex.has(translation.id)) {
    const rows = normalized(translation), words = rows.map(r => tokens(r.text)), post = new Map();
    words.forEach((ws, i) => { for (const w of new Set(ws)) { let l = post.get(w); if (!l) post.set(w, l = []); l.push(i); } });
    fuzzyIndex.set(translation.id, { rows, words, post, N: rows.length });
  }
  return fuzzyIndex.get(translation.id);
}

// Returns { hits: [{ key, score (0–1) }] ordered by score, terms (for highlighting the matched words) }.
export function approximate(translations, { query, scope, currentBook }, { limit = 50, min = 0.5 } = {}) {
  const qs = tokens(norm(query.replace(/["„“”]/g, ' '))).filter(w => w.length > 2);
  const matched = new Set(), best = new Map();
  if (!qs.length) return { hits: [], terms: { list: [], phrase: false, any: true } };
  const inScope = b => scope === 'all' || (scope === 'ot' || scope === 'nt' ? books[bookIndex.get(b)].testament === scope : b === currentBook);
  for (const translation of translations) {
    const { rows, words, post, N } = fuzzy(translation);
    const idf = w => Math.log(1 + N / post.get(w).length);
    // For every query word, the words of the vocabulary that answer it, and how well.
    const per = qs.map(q => {
      const s = stem(q), list = [];
      for (const w of post.keys()) if (w[0] === q[0] || q.length >= 5) { const k = likeness(q, s, w); if (k) list.push([w, k]); }
      // The weight of a query word is the rarity of its best match (the word itself when the text has it).
      const top = list.reduce((m, x) => !m || x[1] > m[1] || (x[1] === m[1] && idf(x[0]) < idf(m[0])) ? x : m, null);
      const weight = top ? idf(top[0]) : Math.log(1 + N);
      return { list: list.map(([w, k]) => [w, k * weight]), weight };
    });
    const total = per.reduce((a, p) => a + p.weight, 0), scores = new Map();
    per.forEach((p, qi) => {
      for (const [w, sc] of p.list) for (const r of post.get(w)) {
        let e = scores.get(r);
        if (!e) scores.set(r, e = { sum: new Float64Array(qs.length), w: [] });
        if (sc > e.sum[qi]) { e.sum[qi] = sc; e.w[qi] = w; }
      }
    });
    const cands = [...scores].map(([r, e]) => [r, e, e.sum.reduce((a, x) => a + x, 0) / total]).filter(([r, , s]) => s >= min * 0.8 && inScope(rows[r].b))
      .sort((a, b) => b[2] - a[2]).slice(0, limit * 4);
    for (const [r, e, base] of cands) {
      // Bonus: matched query words found in the same order, at most three words apart.
      const ws = words[r], found = e.w.filter(Boolean);
      let pairs = 0;
      for (let i = 0; i + 1 < found.length; i++) {
        const a = ws.indexOf(found[i]), z = ws.indexOf(found[i + 1], a + 1);
        if (a >= 0 && z > a && z - a <= 3) pairs++;
      }
      const score = Math.min(1, base * 0.9 + (qs.length > 1 ? 0.1 * pairs / (qs.length - 1) : 0.1));
      if (score < min) continue;
      const k = translation.canonical(rows[r].own);
      if (!best.has(k) || best.get(k).score < score) best.set(k, { key: k, score, words: e.w.filter(Boolean) });
    }
  }
  const hits = [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  for (const h of hits) for (const w of h.words) matched.add(w);
  return { hits, terms: { list: [...matched], phrase: false, any: true } };
}
