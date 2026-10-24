// Checks and prepares the study visuals. A visual is { "source"?, "blocks": [ { "type", "title", "note"?, "data" } ] }.
//
// Book visual (data/studies/<BOOK>/book.visual.json) and chapter visuals (named by "visual" in studies.json).
// Block types and their data:
//   book-map     { about (the key message of the book, 100–150 words), sections: [{t, s, from, to}] (the halves),
//                  parts: [{id, t, chapters: [ch], sum}] (4–8 key sections, a simplified structure of the book),
//                  bands?: [{t, from, to}], chapters: { "1": {t, sum (30–40 words), status?: "în lucru", people?, places?} },
//                  links?: [[ch, ch, label (≤ 5 words, shown on the arc), text?]] }
//   timeline     { events: [event ids], eras?: [{t, from, to}], views?: [{t, from, to, kinds?: [event kinds]}] }
//                  Gaps of more than 40 years between events are drawn compressed.
//   network      { nodes: [person or place ids], links: [[id, id, label, ref?]] }
//   chapter-map  { idea: {t, text, refs}, parts: [{id, t, refs, text}], flow?: [[part, part, label]],
//                  book?: [{ch, from, t, why, refs?}], bible?: [{ref, from, t, why}] }
//   map          { places: [place ids], layers?: [{id, t, on?}], routes?: [{t, kind?: exile|return|journey, tone?: 1–4,
//                  layer?, mode?: land|sea, via: [place id | {lat, lon, t?}], refs?}] }
//   history      { items: [image ids] }
//   chapters, flow, causal, journeys: the earlier book visuals of Acts (not checked in detail).
// Every block may have a "message" (30–90 words): what the diagram shows about the text, under the title.
// The "?" next to each block title opens, in the side panel, how to read the block: the text for its type in data/atlas/visual-help.json
// (100–150 words), or the block's own "about" (100–150 words). "note" is shown under the diagram, in small print.
// "source" is a fingerprint of the study text the visual was made from (tools/visuals.mjs stamp); when the text
// changes, the visual is reported as out of date and can be queued for regeneration.
import crypto from 'node:crypto';

export const MAP_PATH = 'data/atlas/maps/near-east.json';   // land outline used by every map (as the app loads it)
export const VISUAL_TYPES = ['book-map', 'timeline', 'network', 'chapter-map', 'map', 'history', 'chapters', 'flow', 'causal', 'journeys'];
export const REQUIRED = { book: ['book-map', 'timeline', 'network'], chapter: ['chapter-map', 'network'] };
export const fingerprint = texts => crypto.createHash('sha1').update(texts.join('\n\u0000')).digest('hex').slice(0, 12);
export const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// ctx: { at, level: 'book' | 'chapter', book: {id, chapters}, studied: Set of chapters with a study, atlas, checkRef }
export function checkVisual(spec, ctx) {
  const problems = [], { at, atlas, book } = ctx;
  const say = (i, msg) => problems.push(`${at} block ${i + 1}: ${msg}`);
  const refs = (i, list, what = 'refs') => {
    if (!Array.isArray(list)) { say(i, `"${what}" must be a list of verses`); return; }
    for (const r of list) { const e = ctx.checkRef(r); if (e) say(i, e); }
  };
  const ref = (i, r) => { const e = ctx.checkRef(r); if (e) say(i, e); };
  const entity = id => atlas.people[id] || atlas.places[id];
  const chapter = c => Number.isInteger(c) && c >= 1 && c <= book.chapters;
  if (!Array.isArray(spec.blocks) || !spec.blocks.length) return [`${at}: "blocks" must list at least one block`];

  spec.blocks.forEach((b, i) => {
    if (!VISUAL_TYPES.includes(b.type)) return say(i, `"type" must be one of ${VISUAL_TYPES.join(', ')}`);
    if (typeof b.title !== 'string' || !b.title.trim()) say(i, 'missing "title"');
    const d = b.data;
    if (typeof d !== 'object' || !d) return say(i, 'missing "data"');
    if (b.about != null && (words(b.about) < 100 || words(b.about) > 150)) say(i, `"about" has ${words(b.about)} words, must have 100–150`);
    if (b.message != null && (words(b.message) < 30 || words(b.message) > 90)) say(i, `"message" has ${words(b.message)} words, must have 30–90`);
    if (b.type === 'book-map') {
      const n = words(d.about);
      if (n < 100 || n > 150) say(i, `"about" (the key message of the book) has ${n} words, must have 100–150`);
      const parts = d.parts || [];
      if (parts.length < 4 || parts.length > 8) say(i, `"parts" must list 4–8 key sections of the book, has ${parts.length}`);
      for (const p of parts) {
        if (!p.id || !p.t || !p.sum) say(i, `part "${p.t}": needs "id", "t" and "sum"`);
        if (!Array.isArray(p.chapters) || !p.chapters.length || !p.chapters.every(chapter)) say(i, `part "${p.t}": "chapters" must list chapters of the book`);
      }
      for (const s of d.sections || []) if (!chapter(s.from) || !chapter(s.to) || !s.t) say(i, `section "${s.t}" needs "t", "from" and "to" chapters`);
      for (let c = 1; c <= book.chapters; c++) {
        const ch = d.chapters?.[c];
        if (!ch) { say(i, `chapter ${c} needs an entry with "t" and "sum"`); continue; }
        if (!ch.t) say(i, `chapter ${c}: missing "t"`);
        const n = words(ch.sum);
        if (n < 30 || n > 40) say(i, `chapter ${c}: summary has ${n} words, must have 30–40`);
        if (!ctx.studied.has(c) && ch.status !== 'în lucru') say(i, `chapter ${c} has no study yet: mark its summary "status": "în lucru"`);
        for (const id of [...ch.people || [], ...ch.places || []]) if (!entity(id)) say(i, `chapter ${c}: unknown person or place "${id}"`);
      }
      for (const [a, z, label] of d.links || []) {
        if (!chapter(a) || !chapter(z)) say(i, `link ${a}–${z}: chapters must exist`);
        if (!label || words(label) > 5) say(i, `link ${a}–${z}: the label is shown on the arc and must have 1–5 words`);
      }
    } else if (b.type === 'timeline') {
      if (!Array.isArray(d.events) || !d.events.length) say(i, '"events" must list event ids');
      for (const id of d.events || []) if (!atlas.events[id]) say(i, `unknown event "${id}" (add it to data/atlas/events.json)`);
      for (const v of d.views || []) if (typeof v.from !== 'number' || typeof v.to !== 'number' || !v.t) say(i, `view "${v.t}": needs "t", "from" and "to"`);
    } else if (b.type === 'network') {
      const nodes = new Set(d.nodes || []);
      if (!nodes.size) say(i, '"nodes" must list people or places');
      for (const id of nodes) if (!entity(id)) say(i, `unknown person or place "${id}"`);
      for (const [a, z, label, r] of d.links || []) {
        if (!nodes.has(a) || !nodes.has(z)) say(i, `link ${a}–${z}: both ends must be in "nodes"`);
        if (!label) say(i, `link ${a}–${z}: missing label`);
        if (r) ref(i, r);
      }
    } else if (b.type === 'chapter-map') {
      if (!d.idea?.t || !d.idea?.text) say(i, '"idea" needs "t" and "text"');
      refs(i, d.idea?.refs || []);
      const ids = new Set();
      for (const p of d.parts || []) {
        if (!p.id || ids.has(p.id)) say(i, `part "${p.t}": "id" missing or repeated`);
        ids.add(p.id);
        if (!p.t || !p.text) say(i, `part ${p.id}: needs "t" and "text"`);
        refs(i, p.refs);
      }
      if (ids.size < 2) say(i, '"parts" must list the sections of the chapter');
      for (const [a, z] of d.flow || []) if (!ids.has(a) || !ids.has(z)) say(i, `flow ${a}→${z}: unknown part`);
      for (const x of d.book || []) {
        if (!chapter(x.ch)) say(i, `book link to chapter ${x.ch}: no such chapter`);
        if (!ids.has(x.from)) say(i, `book link to chapter ${x.ch}: "from" must be a part id`);
        if (!x.why) say(i, `book link to chapter ${x.ch}: missing "why"`);
        refs(i, x.refs || []);
      }
      for (const x of d.bible || []) {
        ref(i, x.ref);
        if (!ids.has(x.from)) say(i, `Bible link ${x.ref}: "from" must be a part id`);
        if (!x.why || !x.t) say(i, `Bible link ${x.ref}: needs "t" and "why"`);
      }
    } else if (b.type === 'map') {
      for (const id of d.places || []) if (!atlas.places[id]) say(i, `unknown place "${id}"`);
      const layers = new Set((d.layers || []).map(l => l.id));
      for (const l of d.layers || []) if (!l.id || !l.t) say(i, 'every layer needs "id" and "t"');
      for (const r of d.routes || []) {
        if (r.layer && !layers.has(r.layer)) say(i, `route "${r.t}": unknown layer "${r.layer}"`);
        if (!Array.isArray(r.via) || r.via.length < 2) say(i, `route "${r.t}": "via" needs at least two points`);
        for (const v of r.via || []) if (typeof v === 'string' ? !atlas.places[v] : typeof v?.lat !== 'number' || typeof v?.lon !== 'number') say(i, `route "${r.t}": point ${JSON.stringify(v)} must be a place id or {lat, lon}`);
        if (r.mode && !['land', 'sea'].includes(r.mode)) say(i, `route "${r.t}": "mode" must be land or sea`);
        refs(i, r.refs || []);
      }
    } else if (b.type === 'history') {
      for (const id of d.items || []) if (!atlas.images[id]) say(i, `unknown image "${id}" (add it with tools/commons.mjs)`);
    }
  });
  return problems;
}

// Blocks a visual of this level should have but does not.
export const missingBlocks = (spec, level) => REQUIRED[level].filter(t => !spec.blocks.some(b => b.type === t));

// The visual as the app receives it: routes get computed paths, and every person, place, event and image
// shown is recorded in `seen` (id -> Set of subjects, a study id like "DAN-5" or a book id like "DAN").
export function prepareVisual(spec, { subject, atlas, route, seen }) {
  const mark = id => { if (!seen.has(id)) seen.set(id, new Set()); seen.get(id).add(subject); };
  const point = v => typeof v === 'string' ? [atlas.places[v].lon, atlas.places[v].lat] : [v.lon, v.lat];
  const blocks = spec.blocks.map(b => {
    const d = b.data;
    if (b.type === 'network') d.nodes.forEach(mark);
    if (b.type === 'book-map') for (const ch of Object.values(d.chapters)) [...ch.people || [], ...ch.places || []].forEach(mark);
    if (b.type === 'timeline') d.events.forEach(mark);
    if (b.type === 'history') d.items.forEach(mark);
    if (b.type === 'map') {
      d.places.forEach(mark);
      if (!route) return b;
      return { ...b, data: { ...d, routes: (d.routes || []).map(r => ({ ...r, path: route(r.via.map(point), r.mode) })) } };
    }
    if (b.type === 'journeys' && route) {
      // Acts: each journey's stops (and the old helper waypoints) get one realistic path.
      const at = k => d.C[k] ? d.C[k].slice(0, 2) : d.WP[k];
      const paths = Object.fromEntries(Object.entries(d.J).map(([k, j]) => [k, route(j.r.map(at))]));
      return { ...b, data: { ...d, land: MAP_PATH, paths } };
    }
    return b;
  });
  return { blocks };
}
