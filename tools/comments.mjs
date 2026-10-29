// The user's comments on verses: data/comments/<BOOK>.json, written by the app (through tools/serve.mjs on
// this computer, or through the GitHub API from any device; see app/js/comments.js).
//
//   { "3:16": [ { "date": "2026-10-25", "text": "…", "t": "nkjv" } ] }
// Keys are canonical verses (the rows of the reader); the text is plain, line breaks are kept.
// "t" (optional): the translation the comment applies to; without it, it applies to all of them.
import fs from 'node:fs';
import path from 'node:path';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_COMMENT = 4000;

// Returns { comments: { BOOK: { "c:v": [...] } }, problems }. exists(b, c, v): the verse has text somewhere;
// translationIds: the ids a comment's "t" may name.
export function loadComments(dir, books, exists, translationIds = []) {
  const comments = {}, problems = [];
  if (!fs.existsSync(dir)) return { comments, problems };
  const ids = new Set(books.map(b => b.id));
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const b = file.slice(0, -5), at = `comments/${file}`;
    if (!ids.has(b)) { problems.push(`${at}: file name must be a book code from data/books.json`); continue; }
    let verses;
    try { verses = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { problems.push(`${at}: ${e.message}`); continue; }
    if (!verses || typeof verses !== 'object' || Array.isArray(verses)) { problems.push(`${at}: must be an object { "c:v": [...] }`); continue; }
    for (const [k, list] of Object.entries(verses)) {
      const m = /^(\d+):(\d+)$/.exec(k);
      if (!m || !exists(b, +m[1], +m[2])) { problems.push(`${at}: "${k}" is not a verse of ${b}`); continue; }
      if (!Array.isArray(list) || !list.length) { problems.push(`${at} ${k}: must be a non-empty list`); continue; }
      list.forEach((c, i) => {
        if (!DATE.test(c?.date || '')) problems.push(`${at} ${k} #${i + 1}: "date" must look like 2026-10-25`);
        if (typeof c?.text !== 'string' || !c.text.trim() || c.text.length > MAX_COMMENT) problems.push(`${at} ${k} #${i + 1}: "text" must be 1–${MAX_COMMENT} characters`);
        if (c && 't' in c && !translationIds.includes(c.t)) problems.push(`${at} ${k} #${i + 1}: "t" must be a translation id (${translationIds.join(', ')})`);
      });
    }
    if (Object.keys(verses).length) comments[b] = verses;
  }
  return { comments, problems };
}
