// Turns Bible references in a study's text into pop-up triggers (.ref-link with data-ref="ROM 2:13-16").
// Recognized: "Fapte 17:31", "1 Cor 15:21-22", "2:16" (book of the study, or the book named just before),
// and inside a chapter study "v. 4-5", "vv. 1-3" (verses of that chapter).
// findReferences/findVerses do not touch the DOM: tools/mentions.mjs uses them to index the verses each study mentions.
import { norm } from './util.js';
import { books, bookIndex } from './data.js';

// Abbreviations used in the studies, besides the names and aliases in books.json.
const EXTRA = {
  ex: 'EXO', exod: 'EXO', levitic: 'LEV', deuteronom: 'DEU', ios: 'JOS', jud: 'JDG', judecatori: 'JDG', 'psalmul': 'PSA', psalmii: 'PSA', psalm: 'PSA',
  proverbe: 'PRO', cant: 'SNG', is: 'ISA', ier: 'JER', plang: 'LAM', ez: 'EZK', ezec: 'EZK', os: 'HOS', obad: 'OBA', hab: 'HAB', tef: 'ZEP',
  hag: 'HAG', zah: 'ZEC', mal: 'MAL', mc: 'MRK', lc: 'LUK', luc: 'LUK', faptele: 'ACT', apostolilor: 'ACT', efes: 'EPH', fil: 'PHP', filip: 'PHP',
  tit: 'TIT', filim: 'PHM', evr: 'HEB', iac: 'JAS', apoc: 'REV'
};

let names = null;
function bookFor(text) {
  if (!names) {
    names = new Map(Object.entries(EXTRA));
    for (const b of books) for (const a of [b.name, b.abbr || '', ...b.aliases]) if (a) names.set(norm(a).replace(/\./g, ''), b.id);
  }
  const k = norm(text.replace(/\./g, '').trim()).replace(/\s+/g, ' ');
  return names.get(k) || names.get(k.replace(/^(\d)(\S)/, '$1 $2')) || null;
}

const chaptersOf = b => books[bookIndex.get(b)]?.chapters || 0;

function button(ref, text) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ref-link';
  el.dataset.ref = ref;
  el.setAttribute('aria-haspopup', 'dialog');
  el.setAttribute('aria-expanded', 'false');
  el.textContent = text;
  return el;
}

function textNodes(root, skip) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

const REF = /((?:[1-3]\s?)?[A-Za-zĂÂÎȘȚăâîșțŞŢşţ]{2,}\.?\s+)?(\d{1,3}):(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?/g;

// References in one text node: [{ start, end, ref: "ROM 2:13-16" }].
export function findReferences(text, defaultBook) {
  const found = [];
  if (!/\d:\d/.test(text)) return found;
  let m, lastBook = null, lastEnd = -1;
  REF.lastIndex = 0;
  while ((m = REF.exec(text))) {
    let start = m.index, book = m[1] ? bookFor(m[1]) : null;
    if (m[1] && !book) start += m[1].length;
    // "Rom 8:28; 9:5" -> the second reference keeps the book named before it.
    if (!book) book = lastBook && /^[\s,;și]*$/.test(text.slice(lastEnd, start)) ? lastBook : defaultBook;
    const c = +m[2], from = +m[3], to = m[4] ? +m[4] : null;
    if ((to !== null && to < from) || c < 1 || c > chaptersOf(book)) continue;
    found.push({ start, end: REF.lastIndex, ref: `${book} ${c}:${from}${to ? '-' + to : ''}` });
    lastEnd = REF.lastIndex;
    lastBook = book;
  }
  return found;
}

const VERSES = /\b(vv?\.\s?|v\s)(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?(?![\d:])/g;

// "v. 4-5" in a chapter study: [{ start, end, ref: "ROM 2:4-5" }].
export function findVerses(text, book, c) {
  const found = [];
  if (!/\bvv?[.\s]\s?\d/.test(text)) return found;
  let m;
  VERSES.lastIndex = 0;
  while ((m = VERSES.exec(text))) {
    const from = +m[2], to = m[3] ? +m[3] : null;
    if (!from || (to !== null && to < from)) continue;
    found.push({ start: m.index, end: VERSES.lastIndex, ref: `${book} ${c}:${from}${to ? '-' + to : ''}` });
  }
  return found;
}

function linkText(root, skip, find) {
  for (const node of textNodes(root, skip)) {
    const text = node.nodeValue, found = find(text);
    if (!found.length) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const { start, end, ref } of found) {
      frag.append(text.slice(last, start), button(ref, text.slice(start, end)));
      last = end;
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

const linkReferences = (root, defaultBook) => linkText(root, 'a, code, pre, .ref-link', text => findReferences(text, defaultBook));
const linkVerses = (root, book, c) => linkText(root, 'a, code, pre, .ref-link, h1, h2, h3', text => findVerses(text, book, c));

export function linkStudy(root, study) {
  linkReferences(root, study.b);
  if (study.c > 0) linkVerses(root, study.b, study.c);
}
