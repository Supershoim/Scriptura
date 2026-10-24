// Turns Bible references in a study's text into pop-up triggers (.ref-link with data-ref="ROM 2:13-16").
// Recognized: "Fapte 17:31", "1 Cor 15:21-22", "2:16" (book of the study, or the book named just before),
// and inside a chapter study "v. 4-5", "vv. 1-3" (verses of that chapter).
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

function linkReferences(root, defaultBook) {
  for (const node of textNodes(root, 'a, code, pre, .ref-link')) {
    const text = node.nodeValue;
    if (!/\d:\d/.test(text)) continue;
    const frag = document.createDocumentFragment();
    let m, last = 0, lastBook = null, lastEnd = -1, any = false;
    REF.lastIndex = 0;
    while ((m = REF.exec(text))) {
      let start = m.index, book = m[1] ? bookFor(m[1]) : null;
      if (m[1] && !book) start += m[1].length;
      // "Rom 8:28; 9:5" -> the second reference keeps the book named before it.
      if (!book) book = lastBook && /^[\s,;și]*$/.test(text.slice(lastEnd, start)) ? lastBook : defaultBook;
      const c = +m[2], from = +m[3], to = m[4] ? +m[4] : null;
      if ((to !== null && to < from) || c < 1 || c > chaptersOf(book)) continue;
      frag.append(text.slice(last, start), button(`${book} ${c}:${from}${to ? '-' + to : ''}`, text.slice(start, REF.lastIndex)));
      last = lastEnd = REF.lastIndex;
      lastBook = book;
      any = true;
    }
    if (!any) continue;
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

const VERSES = /\b(vv?\.\s?|v\s)(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?(?![\d:])/g;

function linkVerses(root, book, c) {
  for (const node of textNodes(root, 'a, code, pre, .ref-link, h1, h2, h3')) {
    const text = node.nodeValue;
    if (!/\bvv?[.\s]\s?\d/.test(text)) continue;
    const frag = document.createDocumentFragment();
    let m, last = 0, any = false;
    VERSES.lastIndex = 0;
    while ((m = VERSES.exec(text))) {
      const from = +m[2], to = m[3] ? +m[3] : null;
      if (!from || (to !== null && to < from)) continue;
      frag.append(text.slice(last, m.index), button(`${book} ${c}:${from}${to ? '-' + to : ''}`, m[0]));
      last = VERSES.lastIndex;
      any = true;
    }
    if (!any) continue;
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

export function linkStudy(root, study) {
  linkReferences(root, study.b);
  if (study.c > 0) linkVerses(root, study.b, study.c);
}
