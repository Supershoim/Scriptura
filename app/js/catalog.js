// The chapter studies: catalog, study texts and search. The build writes data/studies/index.json,
// one HTML fragment per part and a word index split by the first two letters of each word.
import { esc, norm } from './util.js';
import { books, bookIndex, fetchJson, embeddedStudies } from './data.js';

export const studies = [];             // catalog entries in canonical order
const byId = new Map();
const texts = new Map();               // part path -> Promise<html>
const shards = new Map();              // shard name -> Promise<{ word: [study numbers] }>

export const chapters = s => s.covers || (s.c ? [s.c] : []);
export const hasChapter = (s, c) => s.c === c || chapters(s).includes(c);
export const study = id => byId.get(id);
export const forChapter = (b, c) => studies.filter(s => s.b === b && hasChapter(s, c));
export const totalChapters = () => books.reduce((n, b) => n + b.chapters, 0);
export const studiedChapters = b => new Set(studies.filter(s => s.b === b).flatMap(chapters));
let bookVisuals = {};
// The visual of a whole book ({ path, src, stale }), or null.
export const bookVisual = b => bookVisuals[b]?.visual || null;
// The visual shown on a study: its own, or for a book overview (chapter 0) the book's.
export const visualOf = s => s.visual || (s.c === 0 ? bookVisual(s.b) : null);

export async function load() {
  if (studies.length) return;
  const index = embeddedStudies()?.index || await fetchJson('data/studies/index.json');
  bookVisuals = index.books || {};
  index.studies.forEach((s, n) => {
    const entry = { ...s, n, head: norm(`${s.title} ${s.summary} ${s.themes.join(' ')}`) };
    studies.push(entry);
    byId.set(s.id, entry);
  });
}

export function text(path) {
  if (!texts.has(path)) {
    const embedded = embeddedStudies()?.files[path];
    texts.set(path, embedded != null ? Promise.resolve(embedded) : fetch(path).then(r => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.text();
    }));
    texts.get(path).catch(() => texts.delete(path));
  }
  return texts.get(path);
}

export const json = async path => JSON.parse(await text(path));
// An image: its data: URL inside the offline file, otherwise its address.
export const imageUrl = path => embeddedStudies()?.files[path] || path;

// ---------- Search ----------

// Same tokens and shard names as tools/studies.mjs.
const tokens = n => n.match(/\d{1,3}:\d{1,3}|[\p{L}\p{N}]{2,}/gu) || [];
const shardOf = token => token.slice(0, 2).replace(/[^a-z0-9]/g, '_');

function shard(name) {
  if (!shards.has(name)) {
    const embedded = embeddedStudies();
    shards.set(name, embedded ? Promise.resolve(embedded.shards[name] || {})
      : fetch(`data/studies/search/${name}.json`).then(r => r.ok ? r.json() : {}));
    shards.get(name).catch(() => shards.delete(name));
  }
  return shards.get(name);
}

// Study numbers whose text has a word starting with `term` (or exactly `term` for a verse like "2:13").
async function containing(term) {
  const words = await shard(shardOf(term)), found = new Set();
  const exact = term.includes(':');
  for (const [w, list] of Object.entries(words)) if (exact ? w === term : w.startsWith(term)) for (const n of list) found.add(n);
  return found;
}

// "Rom 2", "Fapte 13:48", "romani 1 idolatrie" -> { b, c, v, rest } or null. A book name alone counts
// only when that book has studies, so a word like "mica" still searches the text.
let aliases = null;
export function parseRef(query) {
  aliases ??= books.flatMap(b => [...new Set([norm(b.name), norm(b.abbr || ''), ...b.aliases])].filter(a => a.length >= 2).map(a => ({ a, b: b.id })))
    .sort((x, y) => y.a.length - x.a.length);
  const n = norm(query).trim().replace(/\s+/g, ' ');
  for (const { a, b } of aliases) {
    if (!n.startsWith(a)) continue;
    const rest = n.slice(a.length);
    if (rest && !/^[\s.\d]/.test(rest)) continue;
    const m = rest.match(/^\.?\s*(\d{1,3})?(?:[:.,](\d{1,3}))?/);
    const ref = { b, c: m[1] ? +m[1] : null, v: m[2] ? +m[2] : null, rest: rest.slice(m[0].length).trim() };
    if (ref.c === null && !studies.some(s => s.b === b)) continue;
    return ref;
  }
  return null;
}

// Returns { list: [{ s, score }], terms } for a query and the active filters ({ book, theme }).
export async function search(query, { book, theme }) {
  let rest = query.trim();
  const ref = rest ? parseRef(rest) : null;
  const verse = ref?.c && ref.v ? `${ref.c}:${ref.v}` : null;
  if (ref) rest = ref.rest;
  const terms = [...new Set(tokens(norm(rest)))];
  const candidates = studies.filter(s => (!book || s.b === book) && (!theme || s.themes.includes(theme)) &&
    (!ref || (s.b === ref.b && (ref.c === null || hasChapter(s, ref.c) || verse))));
  const [inText, verseIn] = await Promise.all([Promise.all(terms.map(containing)), verse ? containing(verse) : null]);
  const list = [];
  for (const s of candidates) {
    let score = 0, ok = true;
    terms.forEach((t, i) => {
      const h = s.head.includes(t), b = inText[i].has(s.n);
      if (!h && !b) ok = false;
      score += (h ? 5 : 0) + (b ? 1 : 0);
    });
    if (verse) { if (!verseIn.has(s.n)) ok = false; else score += hasChapter(s, ref.c) ? 6 : 2; }
    if (ok) list.push({ s, score });
  }
  if (terms.length || verse) list.sort((x, y) => y.score - x.score || x.s.n - y.s.n);
  return { list, terms: verse ? [verse, ...terms] : terms };
}

// Up to `max` short excerpts of a study around the search terms, as HTML with <mark>.
export async function snippets(s, terms, max = 2) {
  if (!terms.length) return [];
  const html = (await Promise.all(s.parts.map(p => text(p.path).catch(() => '')))).join(' ');
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e])).replace(/\s+/g, ' ');
  const n = norm(plain), out = [];
  for (const t of terms) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu');
    let m;
    while ((m = re.exec(n)) && out.length < max) {
      const hit = m.index + m[1].length, a = Math.max(0, hit - 80), b = Math.min(plain.length, hit + t.length + 100);
      if (!out.some(o => Math.abs(o.a - a) < 120)) out.push({ a, b, hit, len: t.length });
    }
    if (out.length >= max) break;
  }
  return out.map(o => (o.a > 0 ? '…' : '') + esc(plain.slice(o.a, o.hit)) + '<mark>' + esc(plain.slice(o.hit, o.hit + o.len)) + '</mark>' + esc(plain.slice(o.hit + o.len, o.b)) + (o.b < plain.length ? '…' : ''));
}

export const bookOf = id => books[bookIndex.get(id)];
