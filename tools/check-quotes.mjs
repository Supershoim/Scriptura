// Lists, in a translation memory of study notes, the Bible wording that is not VDCC text word for word:
//   B  a bold headword (the Bible words a note comments on; the label "1:2." and the run-in headings
//      "Ilustrare:", "Aplicație:" etc. are left out)
//   Q  a quotation („…”)
// A headword must be the VDCC wording of the verse; a quotation must be VDCC text too, or else is the note's
// own wording (a gloss, a literal rendering, a non-biblical text) and is confirmed by reading it.
// The words of the KJV itself, when a note discusses the English translation, are written in italics
// ("KJV: <em>replenish</em>"), outside these checks.
//   node tools/check-quotes.mjs kjv GEN ro
import fs from 'node:fs';
import path from 'node:path';

const [id, b, lang] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const memory = JSON.parse(fs.readFileSync(path.join(root, 'data/translations', id, 'study', lang, `${b}.json`), 'utf8'));
const vdcc = JSON.parse(fs.readFileSync(path.join(root, 'data/translations/vdcc/text.json'), 'utf8'));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const bible = ' ' + norm(Object.values(vdcc).flat(2).filter(Boolean).join(' ')) + ' ';
const inVdcc = s => bible.includes(' ' + norm(s) + ' ');
const HEADINGS = /^(Ilustrare|Aplicație|Autorul|Data)\b/;
const counts = { B: 0, Q: 0 }, listed = { B: 0, Q: 0 };
for (const [key, { text }] of Object.entries(memory)) {
  for (const [, run] of text.matchAll(/<strong>(.*?)<\/strong>/g)) {
    const words = run.replace(/<[^>]+>/g, '').replace(/^\s*\d+:\d+[^.]*\.\s*/, '').replace(/\s*…\s*/g, ' … ').trim();
    if (!/\p{L}/u.test(words) || HEADINGS.test(words)) continue;
    counts.B++;
    // "a … b": each part must be VDCC text
    if (words.split(' … ').every(inVdcc)) continue;
    listed.B++;
    console.log(`B ${key}\t${words}`);
  }
  for (const [, q] of text.replace(/<[^>]+>/g, '').matchAll(/„([^”]+)”/g)) {
    if (norm(q).split(' ').length < 2) continue;
    counts.Q++;
    if (q.split(/\s*…\s*/).every(inVdcc)) continue;
    listed.Q++;
    console.log(`Q ${key}\t„${q}”`);
  }
}
console.error(`headwords: ${counts.B - listed.B}/${counts.B} VDCC word for word · quotations: ${counts.Q - listed.Q}/${counts.Q}`);
