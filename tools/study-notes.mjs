// The study notes printed with a translation (the NKJV Study Bible): data/translations/<id>/study/, written by
// tools/import-nkjv.mjs. One file per book, keyed by the translation's own verse "c:v" (a note on a range is
// kept at its first verse, "to" is its last):
//
//   { "12:6": [ { "k": "note", "id": "GEN.12.6", "ref": "12:6", "html": "<p>…</p>" } ],
//     "12:1": [ { "k": "note", "id": "GEN.12.1-9", "ref": "12:1–9", "to": "12:9", "html": "…" } ],
//     "1:1":  [ { "k": "box", "kind": "word", "id": "GEN.1.1.word.god", "ref": "1:1", "title": "God", "label": "Word Study", "html": "…" } ] }
//
// <BOOK>.book.json: { "intro": { id, title, sub, html (<p>, <h3>), figures }, "chapters": { "11": [ inserts ] } }, the
// inserts not tied to a verse: { "k": "box", "kind": "culture" | "article", "title", "html", "figures"? } or
// { "k": "figure", "kind": "chart" | "figure", "title"?, "src", "w", "h", "caption"?, "credit"? }.
// index.json: every note and insert by id, with its verses (described at the end of tools/import-nkjv.mjs).
//
// The HTML is made by the import from the PDF's text (only <p>, <strong>, <em>), never by hand.
//
// Translations of the notes (tools/translate-notes.mjs) live in study/<lang>/<BOOK>.json; the build writes the
// translated book as study/<BOOK>.<lang>.json, the English kept (and the item marked "untranslated") wherever a
// segment is missing or its English changed since it was translated.
import fs from 'node:fs';
import path from 'node:path';
import { segments, hash, readMemory, check, localRefs } from './translate-notes.mjs';

const KINDS = new Set(['intro', 'note', 'box', 'figure']);
const ALLOWED = /<(?!\/?(?:p|strong|em)>)[^>]*>/, INTRO_ALLOWED = /<(?!\/?(?:p|h3|strong|em)>)[^>]*>/;

// Returns { files: { "data/translations/kjv/study/GEN.json": json }, images: [relative paths], problems }.
export function loadStudyNotes(dataDir, translation) {
  const { meta, text } = translation, files = {}, images = new Set(), problems = [];
  const dir = path.join(dataDir, 'translations', meta.id, 'study');
  for (const b of meta.study || []) {
    const rel = `translations/${meta.id}/study/${b}.json`, at = `[${meta.id}] study/${b}.json`;
    if (!fs.existsSync(path.join(dataDir, rel))) { problems.push(`${at}: missing (listed in "study" of translation.json)`); continue; }
    let verses;
    try { verses = JSON.parse(fs.readFileSync(path.join(dataDir, rel), 'utf8')); } catch (e) { problems.push(`${at}: ${e.message}`); continue; }
    const checkFigure = (f, where) => {
      if (f?.k !== 'figure' || typeof f.src !== 'string' || !(f.w > 0 && f.h > 0)) { problems.push(`${where}: a figure needs "src", "w" and "h"`); return; }
      if (!fs.existsSync(path.join(dir, f.src))) problems.push(`${where}: ${f.src} not found`);
      images.add(f.src);
      for (const field of ['caption', 'credit']) if (f[field] && ALLOWED.test(f[field])) problems.push(`${where}: unexpected markup in "${field}"`);
    };
    for (const [k, items] of Object.entries(verses)) {
      const m = /^(\d+):(\d+)$/.exec(k), where = `${at} ${k}`;
      if (!m || typeof text[b]?.[m[1] - 1]?.[m[2] - 1] !== 'string') { problems.push(`${where}: not a verse of ${b} in ${meta.id}`); continue; }
      if (!Array.isArray(items) || !items.length) { problems.push(`${where}: must be a non-empty list`); continue; }
      for (const item of items) {
        if (!KINDS.has(item?.k)) { problems.push(`${where}: unknown kind "${item?.k}"`); continue; }
        if (item.k === 'figure') { checkFigure(item, where); continue; }
        if (typeof item.html !== 'string' || (item.k !== 'intro' && !item.html.trim())) problems.push(`${where}: "${item.k}" without text`);
        else if (ALLOWED.test(item.html)) problems.push(`${where}: unexpected markup in a ${item.k}`);
        if (item.icon) { if (!fs.existsSync(path.join(dir, item.icon))) problems.push(`${where}: ${item.icon} not found`); images.add(item.icon); }
        for (const f of item.figures || []) checkFigure(f, where);
        for (const box of item.boxes || []) for (const f of box.figures || []) checkFigure(f, where);
      }
    }
    files[`data/${rel}`] = JSON.stringify(verses);

    // The book file: the introduction ("Sumar") and the inserts of each chapter ("Informații suplimentare").
    const bookRel = `translations/${meta.id}/study/${b}.book.json`;
    if (fs.existsSync(path.join(dataDir, bookRel))) {
      const where = `[${meta.id}] study/${b}.book.json`;
      let extra;
      try { extra = JSON.parse(fs.readFileSync(path.join(dataDir, bookRel), 'utf8')); } catch (e) { problems.push(`${where}: ${e.message}`); extra = null; }
      if (extra) {
        if (extra.intro) {
          if (typeof extra.intro.html !== 'string' || INTRO_ALLOWED.test(extra.intro.html)) problems.push(`${where}: the introduction needs "html" with only <p>, <h3>, <strong>, <em>`);
          for (const f of extra.intro.figures || []) checkFigure(f, `${where} intro`);
        }
        for (const [c, items] of Object.entries(extra.chapters || {})) {
          if (!text[b]?.[c - 1]) problems.push(`${where}: chapter ${c} does not exist`);
          for (const item of items) {
            if (item.k === 'figure') { checkFigure(item, `${where} ${c}`); continue; }
            if (item.k !== 'box' || typeof item.html !== 'string' || ALLOWED.test(item.html)) problems.push(`${where} ${c}: an insert is a "figure" or a "box" with "html"`);
            for (const f of item.figures || []) checkFigure(f, `${where} ${c}`);
          }
        }
        files[`data/${bookRel}`] = JSON.stringify(extra);
        ((meta.studyBooks ||= [])).push(b);
      }
    }

    for (const lang of fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => /^[a-z]{2}$/.test(d) && fs.existsSync(path.join(dir, d, `${b}.json`))) : []) {
      const memory = readMemory(meta.id, b, lang), copy = JSON.parse(JSON.stringify(verses));
      let stale = 0;
      for (const seg of segments(copy)) {
        const entry = memory[seg.key];
        if (entry?.src === hash(seg.en)) {
          const bad = check(localRefs(seg.en), entry.text);
          if (bad.length) problems.push(`${at} (${lang}) ${seg.key}: ${bad.join('; ')}`);
          seg.set(entry.text);
        } else {
          stale++;
          const [v, i] = seg.key.split('|');
          copy[v][+i].untranslated = true;
        }
      }
      for (const key of Object.keys(memory)) if (!segments(verses).some(s => s.key === key)) problems.push(`${at} (${lang}): "${key}" is no longer a segment of the notes`);
      files[`data/translations/${meta.id}/study/${b}.${lang}.json`] = JSON.stringify(copy);
      ((meta.studyLanguages ||= {})[lang] ||= []).push(b);
      if (stale) console.warn(`  ! ${at} (${lang}): ${stale} segment(s) not translated or changed since; shown in English`);
    }
  }
  return { files, images: [...images].map(src => `data/translations/${meta.id}/study/${src}`), problems };
}
