// Loads books and translations, and aligns each translation's own verse numbering onto shared rows.
//
// Verse keys look like "JHN 3:16". Each translation keeps its own numbering in text.json; the
// "alignment" block of translation.json says how it differs from the canonical rows:
//   map:   own verse -> canonical verse it is shown on (several own verses may share one row)
//   spans: own verse -> last canonical verse its text also covers
//   gaps:  canonical verse -> explanation shown when this translation has no text there
//   notices: "BOOK c" -> message shown above that chapter

export const key = (b, c, v) => `${b} ${c}:${v}`;
export const parseKey = k => { const [b, cv] = k.split(' '); const [c, v] = cv.split(':').map(Number); return { b, c, v }; };
const chapterKey = (b, c) => `${b} ${c}`;

export const books = [];
export const bookIndex = new Map();
export const available = [];      // translation metadata, sorted by order
const loaded = new Map();         // id -> Translation

let embedded = null;

async function readEmbedded() {
  const el = document.getElementById('embedded-data');
  if (!el) return null;
  const bytes = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

export async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

// The studies built into Scriptura.html ({ index, files, shards }), or null on the hosted site.
export const embeddedStudies = () => embedded?.studies || null;

export async function init() {
  embedded = await readEmbedded();
  const [bookList, index] = embedded
    ? [embedded.books, embedded.translations.map(t => t.meta)]
    : await Promise.all([fetchJson('data/books.json'), fetchJson('data/translations.json')]);
  bookList.forEach((b, i) => { books.push({ ...b, index: i }); bookIndex.set(b.id, i); });
  available.push(...index.sort((a, b) => a.order - b.order));
}

class Translation {
  constructor(meta, text, notes) {
    this.meta = meta;
    this.id = meta.id;
    this.text = text;
    this.notes = notes || {};
    const { map = {}, spans = {}, gaps = {}, notices = {} } = meta.alignment || {};
    this.ownToCanon = map;
    this.gaps = gaps;
    this.notices = notices;
    this.canonToOwn = new Map();  // canonical key -> [own keys]
    this.coveredBy = new Map();   // canonical key -> own key whose text also covers it
    this.chapterRows = new Map(); // "BOOK c" -> Set of canonical verse numbers
    for (const [b, chapters] of Object.entries(text)) {
      chapters.forEach((verses, ci) => verses.forEach((t, vi) => {
        if (t == null) return;
        const own = key(b, ci + 1, vi + 1), canon = map[own] || own;
        if (!this.canonToOwn.has(canon)) this.canonToOwn.set(canon, []);
        this.canonToOwn.get(canon).push(own);
        this.addRow(canon);
      }));
    }
    for (const [own, last] of Object.entries(spans)) {
      const from = parseKey(this.ownToCanon[own] || own), to = parseKey(last);
      for (let v = from.v + 1; v <= to.v; v++) { const k = key(from.b, from.c, v); this.coveredBy.set(k, own); this.addRow(k); }
    }
    for (const k of Object.keys(gaps)) this.addRow(k);
  }
  addRow(canon) {
    const { b, c, v } = parseKey(canon), ck = chapterKey(b, c);
    if (!this.chapterRows.has(ck)) this.chapterRows.set(ck, new Set());
    this.chapterRows.get(ck).add(v);
  }
  verse(own) {
    const { b, c, v } = parseKey(own);
    return this.text[b]?.[c - 1]?.[v - 1] ?? null;
  }
  // Own verses shown on a canonical row.
  versesAt(canon) { return this.canonToOwn.get(canon) || []; }
  canonical(own) { return this.ownToCanon[own] || own; }
  // Text for a canonical row when this translation has no verse of its own there.
  gapNote(canon) {
    if (this.gaps[canon]) return this.gaps[canon];
    const cover = this.coveredBy.get(canon);
    if (cover) return `Cuprins în versetul ${parseKey(cover).v} din această ediție (rândul anterior).`;
    return 'Versetul nu are o intrare distinctă în această ediție.';
  }
  // Own verse that holds the text for a canonical verse (directly or through a span).
  resolve(canon) {
    return this.versesAt(canon)[0] || this.coveredBy.get(canon) || null;
  }
  ownVersesInChapter(b, c) {
    return (this.text[b]?.[c - 1] || []).flatMap((t, i) => t == null ? [] : [i + 1]);
  }
}

export async function load(id) {
  if (loaded.has(id)) return loaded.get(id);
  const meta = available.find(t => t.id === id);
  if (!meta) throw new Error('Unknown translation ' + id);
  let text, notes;
  if (embedded) ({ text, notes } = embedded.translations.find(t => t.meta.id === id));
  else [text, notes] = await Promise.all([
    fetchJson(`data/translations/${id}/text.json`),
    meta.hasNotes ? fetchJson(`data/translations/${id}/notes.json`) : null
  ]);
  const translation = new Translation(meta, text, notes);
  loaded.set(id, translation);
  return translation;
}

export const get = id => loaded.get(id);

// Canonical verse numbers in a chapter across the given translations.
export function chapterRows(translations, b, c) {
  const rows = new Set();
  for (const t of translations) for (const v of t.chapterRows.get(chapterKey(b, c)) || []) rows.add(v);
  return [...rows].sort((x, y) => x - y);
}

export function notices(translations, b, c) {
  return translations.flatMap(t => {
    const own = t.notices[chapterKey(b, c)];
    const auto = [...t.coveredBy.entries()].filter(([k]) => k.startsWith(chapterKey(b, c) + ':'))
      .map(([canon, cover]) => `${t.meta.abbreviation}: versetul ${parseKey(cover).v} cuprinde și versetul ${parseKey(canon).v}.`);
    return [...(own ? [`${t.meta.abbreviation}: ${own}`] : []), ...auto];
  }).filter((m, i, all) => all.indexOf(m) === i);
}

export function compareKeys(a, b) {
  const x = parseKey(a), y = parseKey(b);
  return bookIndex.get(x.b) - bookIndex.get(y.b) || x.c - y.c || x.v - y.v;
}
