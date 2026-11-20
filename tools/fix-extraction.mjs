// Corrects the defects the old PDF extraction (work/parse.mjs, whose input no longer exists) left in the VDCC
// and NTR text, checking each one against the PDF itself. It changes only what the extraction added or lost,
// never the printed wording (the PDF's own typos, e.g. GEN 41:25 „însemnă”, stay):
//   1. a space before punctuation where a superscript footnote digit was dropped (PDF „Babel¹,” → „Babel ,”);
//   2. words hyphenated at a line end and joined the wrong way (PDF „Padan-⏎Aram” → „PadanAram”,
//      „nu-⏎mele” → „nu-mele”): the form the rest of the Bible uses wins;
//   3. text that is not the verse, run on at its end (a section heading, the „SFÂRȘIT” closing the book);
//   4. the glosses in parentheses printed in italics, lost with the italic font („Gherșom (Străin), căci”).
//   5. letters spaced out where a line was printed with wide tracking („E l l e - a z i s” → „El le-a zis”).
// The reference markers of notes.json are character offsets into the verse, and move with the text.
//   node tools/fix-extraction.mjs vdcc "D:/Biblia PDF/Biblia-VDCC.pdf"          report only
//   node tools/fix-extraction.mjs vdcc "D:/Biblia PDF/Biblia-VDCC.pdf" --write  apply
// Needs MuPDF (see tools/import-nkjv.mjs) and `node --max-old-space-size=8192`. Running it twice changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeText, writeNotes } from './format.mjs';

const [id, pdfPath, flag] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'data/translations', id);
const text = JSON.parse(fs.readFileSync(path.join(dir, 'text.json'), 'utf8'));
const notesFile = path.join(dir, 'notes.json');
const notes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : null;

// Text run on at the end of a verse, checked one by one in the PDF.
// 1SA 26:25: the dash of the heading after it („David în țara filistenilor – Șederea lui la Țiclag”).
const TAILS = { vdcc: { 'GEN 11:9': ' DE LA AVRAAM PÂNĂ LA IOSIF', 'REV 22:11': ' SFÂRȘIT', '1SA 26:25': ' –' }, ntr: {} }[id] || {};

// The PDF's text, in the encoding the old extraction fixed (ã → ă, º → ș, þ → ț).
const mupdf = await import(process.env.MUPDF ? pathToFileURL(process.env.MUPDF).href : 'mupdf');
const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), 'application/pdf');
const fixEnc = s => s.replace(/[ãÃºªþÞşŞţŢ]/g, c => ({ 'ã': 'ă', 'Ã': 'Ă', 'º': 'ș', 'ª': 'Ș', 'þ': 'ț', 'Þ': 'Ț', 'ş': 'ș', 'Ş': 'Ș', 'ţ': 'ț', 'Ţ': 'Ț' }[c]));
const pages = [];
for (let i = 0; i < doc.countPages(); i++) pages.push(fixEnc(doc.loadPage(i).toStructuredText().asText()));

// 2. Line-end hyphens. The old rule kept the hyphen after a clitic („nu-l”, „s-a”) and dropped it otherwise.
const KEEP = new Set(['s', 'm', 'mi', 'i', 'ți', 'l', 'le', 'v', 'vă', 'ne', 'te', 'o', 'îl', 'într', 'dintr', 'printr', 'ce', 'și', 'să', 'li', 'nu', 'n', 'aș', 'de', 'după', 'pe']);
const all = Object.values(text).flat(2).filter(Boolean).join('\n');
const L = '[\\p{L}-]';
const freq = new Map();
for (const [w] of all.matchAll(/[\p{L}-]+/gu)) freq.set(w, (freq.get(w) || 0) + 1);
const count = w => freq.get(w) || 0;
const breaks = new Map();
for (const p of pages) for (const m of p.matchAll(/(?<![\p{L}-])([\p{L}-]*\p{L})-\n(\p{L}[\p{L}-]*)/gu)) {
  const kept = KEEP.has(m[1].match(/\p{L}+$/u)[0].toLowerCase());
  const produced = kept ? `${m[1]}-${m[2]}` : m[1] + m[2], other = kept ? m[1] + m[2] : `${m[1]}-${m[2]}`;
  const b = breaks.get(produced) || { produced, other, breaks: 0 };
  b.breaks++; breaks.set(produced, b);
}

// Decides one line-end break: the form to write, or null to leave the extraction's form.
//   r.produced  what the extraction wrote („PadanAram”, „nu-mele”)
//   r.other     the other reading of the break („Padan-Aram”, „numele”)
//   r.breaks    how many times the PDF breaks the word this way
//   r.pElse     occurrences of r.produced in the whole text that are not these breaks
//   r.oElse     occurrences of r.other in the whole text
function choose(r) {
  if (r.pElse > 0) return null;                    // the produced form is a real word elsewhere: ambiguous, leave it
  if (r.oElse > 0) return r.other;                 // only the other form is attested
  if (r.other.includes('-') && /\p{Ll}\p{Lu}/u.test(r.produced)) return r.other; // „BetAnat” → „Bet-Anat”
  return null;
}

const swaps = new Map();
for (const r of breaks.values()) {
  r.pElse = count(r.produced) - r.breaks;
  r.oElse = count(r.other);
  const to = choose(r);
  if (to && to !== r.produced) swaps.set(r.produced, to);
}

// 4. Glosses in parentheses, printed in italics after a name or word („Gherșom (Străin), căci”, „gofer (chiparos);”):
// the extraction read only the upright body fonts and lost them, with any punctuation printed in italics after them.
// Each is put back after the words that precede it in the PDF, in the verse where those words are followed by the
// words after it. The other italics of the body size are section headings, not verse text.
const swapWords = s => swaps.size ? s.replace(new RegExp(`(?<!${L})(${[...swaps.keys()].join('|')})(?!${L})`, 'gu'), w => swaps.get(w)) : s;
const flatPdf = s => swapWords(s.replace(/[*†‡]/g, '').replace(/-\n/g, '-').replace(/\s+/g, ' '));
const order = [];
for (const [b, cs] of Object.entries(text)) cs.forEach((vs, c) => vs.forEach((s, v) => s && order.push(`${b} ${c + 1}:${v + 1}`)));
const verseOf = k => { const [, b, c, v] = k.match(/^(\S+) (\d+):(\d+)$/); return text[b][c - 1][v - 1]; };
const glosses = new Map();         // verse -> [{ at, del, ins }]
let lastIndex = 0, unplaced = [];
for (let pn = 0; pn < doc.countPages(); pn++) {
  const cs = [];
  doc.loadPage(pn).toStructuredText('preserve-whitespace').walk({
    onChar(c, o, font, size) { const body = size > 9.5 && size < 10.5; cs.push({ c, body, it: body && /Italic/.test(font.getName()) }); },
    endLine() { cs.push({ c: '\n', body: true, it: null }); }
  });
  for (let i = 0; i < cs.length; i++) {
    if (!(cs[i].it && cs[i].c === '(')) continue;
    let j = i;
    while (j < cs.length && cs[j].it !== false) j++;
    const run = fixEnc(cs.slice(i, j).map(x => x.c).join(''));
    if (!run.includes(')')) { i = j; continue; }
    const upright = xs => fixEnc(xs.filter(x => x.body && x.it !== true).map(x => x.c).join(''));
    const tail = flatPdf(upright(cs.slice(Math.max(0, i - 60), i))).replace(/^.*\d+\.\s*/, '').trimEnd().slice(-22).trimStart();
    // The words after, short of the next verse number or a running header („JUDECĂTORII 6, 7”); only punctuation
    // when the gloss ends the verse.
    const next = flatPdf(upright(cs.slice(j, j + 30))).trimStart().replace(/(^|\s)\d.*$|\s*\p{Lu}{4,}.*$/u, '').slice(0, 6).trimEnd();
    const nextWords = next.replace(/^[,;:.!?)\s]+/, '');
    // A word hyphenated at a line end inside the gloss is joined when the whole word is used elsewhere („Meso-⏎potamia”).
    const ins = ' ' + flatPdf(run.replace(/(\p{L}+)-\n(\p{L}+)/gu, (m, a, b) => count(a + b) ? a + b : `${a}-${b}`)).trim();
    i = j;
    // Candidates, from the last gloss placed on: a verse that already has the gloss after its last words (an earlier
    // run; „Pașhur” (Noroc…), ci Magor-Misabib” no longer has the words before the second gloss as printed upright),
    // or one where the words before are followed (after a space, or the space the extraction left before
    // punctuation) by the words after. Nothing after the gloss in its column (it ends the column): the words before
    // decide alone.
    let at = -1, already = false;
    const found = order.findIndex((k, n) => {
      if (n < lastIndex) return false;
      const s = verseOf(k);
      if (s.includes(tail.slice(-12) + ins)) return already = true;
      for (let a = s.indexOf(tail); a >= 0; a = s.indexOf(tail, a + 1)) {
        const rest = s.slice(a + tail.length);
        if (!next || (!nextWords ? /^ ?[,;:.!?)]|^$/.test(rest) : rest.replace(/^ /, '').startsWith(next) || rest.replace(/^ /, '').startsWith(nextWords))) { at = a + tail.length; return true; }
      }
      return false;
    });
    if (found < 0) { unplaced.push(`p${pn + 1} „${tail}${ins}”`); continue; }
    lastIndex = found;
    if (already) continue;
    const s = verseOf(order[found]);
    (glosses.get(order[found]) || glosses.set(order[found], []).get(order[found])).push({ at, del: /^ [,;:.!?]/.test(s.slice(at)) ? 1 : 0, ins, kind: 'gloss' });
  }
}

// 5. Letter-spaced text („E l l e - a z i s: „ P e n t r u” in 1SA 2:23): a line printed with wide tracking came out
// with a space after every letter, and its word breaks can't be told from the letters alone. The printed text whose
// characters, without spaces, are the run's gives them back; a run found more than once in the PDF is left as it is.
const pdfFlat = pages.join(' ').replace(/[*†‡]/g, '').replace(/\s+/g, ' ');
const bareAt = [];                 // index in pdfFlat of each non-space character
for (let i = 0; i < pdfFlat.length; i++) if (pdfFlat[i] !== ' ') bareAt.push(i);
const pdfBare = pdfFlat.replace(/ /g, '');
function spacedRuns(s) {
  const out = [];
  for (const m of s.matchAll(/(?<!\S)(?:\S{1,2} ){5,}\S{1,2}(?!\S)/gu)) {
    if ((m[0].match(/\p{L}/gu) || []).length < 6) continue;
    const bare = m[0].replace(/ /g, ''), a = pdfBare.indexOf(bare);
    if (a < 0 || pdfBare.indexOf(bare, a + 1) >= 0) continue;
    const printed = pdfFlat.slice(bareAt[a], bareAt[a + bare.length - 1] + 1);
    if (printed !== m[0]) out.push({ at: m.index, del: m[0].length, ins: printed, kind: 'spaced' });
  }
  return out;
}

// Edits to one verse: [{ at, del, ins, kind }], applied from the end so the offsets stay valid.
function edits(key, s) {
  const out = [...(glosses.get(key) || []), ...spacedRuns(s)];
  for (const m of s.matchAll(/ (?=[,;:.!?](?!,))/g)) if (!out.some(e => e.at === m.index)) out.push({ at: m.index, del: 1, ins: '', kind: 'space' });
  if (swaps.size) for (const m of s.matchAll(new RegExp(`(?<!${L})(${[...swaps.keys()].join('|')})(?!${L})`, 'gu')))
    out.push({ at: m.index, del: m[0].length, ins: swaps.get(m[0]), kind: 'hyphen' });
  const tail = TAILS[key];
  if (tail && s.endsWith(tail)) out.push({ at: s.length - tail.length, del: tail.length, ins: '', kind: 'tail' });
  return out.sort((a, b) => b.at - a.at);
}

const report = { space: 0, hyphen: 0, tail: 0, gloss: 0, spaced: 0, verses: 0 }, samples = [];
for (const [b, chapters] of Object.entries(text)) chapters.forEach((verses, c) => verses.forEach((s, v) => {
  if (!s) return;
  const key = `${b} ${c + 1}:${v + 1}`, list = edits(key, s);
  if (!list.length) return;
  let t = s;
  const groups = notes?.[key] || [];
  for (const e of list) {
    t = t.slice(0, e.at) + e.ins + t.slice(e.at + e.del);
    const d = e.ins.length - e.del;
    for (const g of groups) if (g.at > e.at) g.at = Math.max(e.at + e.ins.length, g.at + d);
    report[e.kind]++;
  }
  verses[v] = t; report.verses++;
  if (list.some(e => e.kind === 'gloss')) console.log(`  gloss ${key}: …${t.slice(Math.max(0, list.at(-1).at - 25), list.at(-1).at + 40)}…`);
  else if (samples.length < 12) samples.push(`${key}: …${s.slice(Math.max(0, list.at(-1).at - 20), list.at(-1).at + 25)}… → …${t.slice(Math.max(0, list.at(-1).at - 20), list.at(-1).at + 25)}…`);
}));

console.log(`${id}: ${report.verses} verses · ${report.space} spaces before punctuation · ${report.hyphen} line-end hyphens (${swaps.size} words) · ${report.tail} run-on tails · ${report.gloss} glosses · ${report.spaced} letter-spaced runs${unplaced.length ? ` (${unplaced.length} not placed: ${unplaced.join('; ')})` : ''}`);
for (const [p, o] of swaps) console.log(`  ${p} → ${o}`);
console.log(samples.map(s => '  ' + s).join('\n'));
if (flag === '--write') {
  writeText(path.join(dir, 'text.json'), text);
  if (notes) writeNotes(notesFile, notes);
  console.log('written');
}
