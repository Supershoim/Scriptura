// The Bible-wide register shared by all study visuals (data/atlas/):
//   people.json  { id: { name, aka?, kind (om, proroc, înger, divin, grup), image? (id in images.json), about, refs, books?: { BOOK: [refs] }, note?, sources? } }
//   places.json  { id: { name, kind, lat, lon, approx?, about, refs, books?, sources? } }
//   events.json  { id: { name, kind?, fulfils?, year (negative = B.C.), end?, date, certain, about, refs, people?, places?, source: { t, url? } } }
//                kind: book (default, events of the book), prophecy (an earlier prophecy; "fulfils" lists the events it
//                speaks of), fulfilment (a later fulfilment of the book's prophecies), major (fall of empires, deportations, returns)
//   images.json  { id: { title, caption, refs, places?, people?, kind?: "portrait", file, source, author, license } }  (files in images/)
//                portraits are artistic depictions: shown on the person, not among the historical witnesses
//   visual-help.json  { block type: what the block represents (100–150 words), shown under each block title }
//   maps/near-east.json  land outline and rivers (tools/make-map.mjs)
// Visuals refer to these entries by id; the app shows them in one detail panel wherever they are clicked.
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['people', 'places', 'events', 'images', 'visual-help'];
const KINDS = ['om', 'proroc', 'înger', 'divin', 'grup'], EVENT_KINDS = ['book', 'prophecy', 'fulfilment', 'major'];
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const ID = /^[a-z0-9-]+$/;

// checkRef(ref) returns an error message or null.
export function loadAtlas(dir, books, checkRef) {
  const problems = [], atlas = {};
  const bookIds = new Set(books.map(b => b.id));
  for (const name of FILES) {
    const file = path.join(dir, name + '.json');
    try { atlas[name] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; }
    catch (e) { problems.push(`atlas/${name}.json: ${e.message}`); atlas[name] = {}; }
  }
  const refs = (where, list, allowEmpty) => {
    if (!Array.isArray(list) || (!list.length && !allowEmpty)) { problems.push(`${where}: "refs" must list verses`); return; }
    for (const r of list) { const e = checkRef(r); if (e) problems.push(`${where}: ${e}`); }
  };
  const named = (where, e) => { if (typeof e.name !== 'string' || !e.name) problems.push(`${where}: missing "name"`); if (typeof e.about !== 'string' || !e.about) problems.push(`${where}: missing "about"`); };
  const otherBooks = (where, b) => {
    for (const [book, list] of Object.entries(b || {})) {
      if (!bookIds.has(book)) problems.push(`${where}: unknown book "${book}" in "books"`);
      refs(`${where} books.${book}`, list);
    }
  };
  for (const [id, p] of Object.entries(atlas.people)) {
    const where = `atlas/people.json ${id}`;
    if (!ID.test(id)) problems.push(`${where}: id must be lowercase letters, digits and dashes`);
    named(where, p);
    if (!KINDS.includes(p.kind)) problems.push(`${where}: "kind" must be one of ${KINDS.join(', ')}`);
    if (p.image && !atlas.images[p.image]) problems.push(`${where}: unknown image "${p.image}"`);
    refs(where, p.refs, !!p.sources);
    otherBooks(where, p.books);
  }
  for (const [id, p] of Object.entries(atlas.places)) {
    const where = `atlas/places.json ${id}`;
    if (!ID.test(id)) problems.push(`${where}: id must be lowercase letters, digits and dashes`);
    named(where, p);
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') problems.push(`${where}: "lat" and "lon" must be numbers`);
    refs(where, p.refs, !!p.sources);
    otherBooks(where, p.books);
  }
  for (const [id, e] of Object.entries(atlas.events)) {
    const where = `atlas/events.json ${id}`;
    named(where, e);
    if (!Number.isInteger(e.year) || (e.end != null && !Number.isInteger(e.end))) problems.push(`${where}: "year" (and "end") must be whole years, negative before Christ`);
    if (typeof e.certain !== 'boolean') problems.push(`${where}: "certain" must be true (fixed by a primary ancient source) or false (approximate)`);
    if (!e.source?.t) problems.push(`${where}: every date needs a "source"`);
    if (typeof e.date !== 'string' || !e.date) problems.push(`${where}: missing "date" (as shown)`);
    refs(where, e.refs);
    if (e.kind && !EVENT_KINDS.includes(e.kind)) problems.push(`${where}: "kind" must be one of ${EVENT_KINDS.join(', ')}`);
    for (const k of e.fulfils || []) if (!atlas.events[k]) problems.push(`${where}: "fulfils" names unknown event "${k}"`);
    if (e.fulfils && e.kind !== 'prophecy') problems.push(`${where}: only a prophecy has "fulfils"`);
    for (const k of e.people || []) if (!atlas.people[k]) problems.push(`${where}: unknown person "${k}"`);
    for (const k of e.places || []) if (!atlas.places[k]) problems.push(`${where}: unknown place "${k}"`);
  }
  for (const [type, text] of Object.entries(atlas['visual-help'])) {
    const n = words(text);
    if (n < 100 || n > 150) problems.push(`atlas/visual-help.json ${type}: has ${n} words, must have 100–150`);
  }
  for (const [id, im] of Object.entries(atlas.images)) {
    const where = `atlas/images.json ${id}`;
    for (const f of ['title', 'caption', 'file', 'source', 'author', 'license']) if (!im[f]) problems.push(`${where}: missing "${f}"`);
    if (im.file && !fs.existsSync(path.join(dir, 'images', im.file))) problems.push(`${where}: images/${im.file} not found`);
    refs(where, im.refs);
    for (const k of im.people || []) if (!atlas.people[k]) problems.push(`${where}: unknown person "${k}"`);
    for (const k of im.places || []) if (!atlas.places[k]) problems.push(`${where}: unknown place "${k}"`);
  }
  const mapFile = path.join(dir, 'maps/near-east.json');
  atlas.map = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : null;
  return { atlas, problems };
}

// What the app downloads: registers (images as paths), and for every entry the studies that show it.
export function atlasForApp(atlas, seen) {
  const images = Object.fromEntries(Object.entries(atlas.images).map(([id, im]) => [id, { ...im, file: `data/atlas/images/${im.file}` }]));
  const seenOut = Object.fromEntries([...seen].map(([id, set]) => [id, [...set]]));
  return { people: atlas.people, places: atlas.places, events: atlas.events, images, help: atlas['visual-help'], seen: seenOut };
}
