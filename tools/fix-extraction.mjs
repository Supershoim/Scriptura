// Corrects the defects the old PDF extraction (work/parse.mjs, whose input no longer exists) left in the VDCC
// and NTR text, checking each one against the PDF itself. It changes only what the extraction added or lost,
// never the printed wording (the PDF's own typos, e.g. GEN 41:25 „însemnă”, stay):
//   1. a space before punctuation where a superscript footnote digit was dropped (PDF „Babel¹,” → „Babel ,”);
//   2. words hyphenated at a line end and joined the wrong way (PDF „Padan-⏎Aram” → „PadanAram”,
//      „nu-⏎mele” → „nu-mele”): the form the rest of the Bible uses wins;
//   3. text that is not the verse, run on at its end (a section heading, the „SFÂRȘIT” closing the book).
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
const TAILS = { vdcc: { 'GEN 11:9': ' DE LA AVRAAM PÂNĂ LA IOSIF', 'REV 22:11': ' SFÂRȘIT' }, ntr: {} }[id] || {};

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

// Edits to one verse: [{ at, del, ins }], applied from the end so the offsets stay valid.
function edits(key, s) {
  const out = [];
  for (const m of s.matchAll(/ (?=[,;:.!?](?!,))/g)) out.push({ at: m.index, del: 1, ins: '' });
  if (swaps.size) for (const m of s.matchAll(new RegExp(`(?<!${L})(${[...swaps.keys()].join('|')})(?!${L})`, 'gu')))
    out.push({ at: m.index, del: m[0].length, ins: swaps.get(m[0]) });
  const tail = TAILS[key];
  if (tail && s.endsWith(tail)) out.push({ at: s.length - tail.length, del: tail.length, ins: '' });
  return out.sort((a, b) => b.at - a.at);
}

const report = { space: 0, hyphen: 0, tail: 0, verses: 0 }, samples = [];
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
    report[e.del === 1 && !e.ins ? 'space' : TAILS[key] && e.at === s.length - TAILS[key].length ? 'tail' : 'hyphen']++;
  }
  verses[v] = t; report.verses++;
  if (samples.length < 12) samples.push(`${key}: …${s.slice(Math.max(0, list.at(-1).at - 20), list.at(-1).at + 25)}… → …${t.slice(Math.max(0, list.at(-1).at - 20), list.at(-1).at + 25)}…`);
}));

console.log(`${id}: ${report.verses} verses · ${report.space} spaces before punctuation · ${report.hyphen} line-end hyphens (${swaps.size} words) · ${report.tail} run-on tails`);
for (const [p, o] of swaps) console.log(`  ${p} → ${o}`);
console.log(samples.map(s => '  ' + s).join('\n'));
if (flag === '--write') {
  writeText(path.join(dir, 'text.json'), text);
  if (notes) writeNotes(notesFile, notes);
  console.log('written');
}
