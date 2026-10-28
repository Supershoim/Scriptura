// Footnotes after each verse of the reader: the user's comments (a speech-bubble pictogram), the study notes
// printed with a translation (its abbreviation, "KJV") and, in small print, the studies that mention the verse.
// A tap or click opens them in the reference pop-up.
import { esc } from './util.js';
import { parseKey, books, bookIndex, available } from './data.js';
import * as catalog from './catalog.js';
import { forBook, forVerse, openComments } from './comments.js';
import { studyHash, revealVerse } from './studies.js';
import { showInfo, hideNote } from './notes.js';
import * as studyNotes from './studynotes.js';

const BOOK = '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.6C6.6 2.5 4.6 2 2 2v10.4c2.6 0 4.6.5 6 1.6 1.4-1.1 3.4-1.6 6-1.6V2c-2.6 0-4.6.5-6 1.6Zm0 0v10.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const PICTURE = '<svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m3.5 11.5 3.2-3.6 2.3 2.4 1.6-1.6 2 2.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const BUBBLE = '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.2c0-.9.7-1.6 1.6-1.6h7.8c.9 0 1.6.7 1.6 1.6v5.6c0 .9-.7 1.6-1.6 1.6H7.2L4.4 13v-2.6h-.3c-.9 0-1.6-.7-1.6-1.6Z" fill="currentColor"/></svg>';
const bookName = b => books[bookIndex.get(b)]?.name || b;
const verseTitle = canon => { const { b, c, v } = parseKey(canon); return `${bookName(b)} ${c}:${v}`; };
const plural = (n, one, many) => n === 1 ? `1 ${one}` : `${n} ${many}`;

// The studies that mention a verse, one entry per study (the index has one per part: the part that mentions it
// most is the one opened), the study of the verse's own chapter first, then the most frequent.
function ranked(list, canon) {
  const { b, c } = parseKey(canon), byStudy = new Map();
  for (const e of list) {
    const seen = byStudy.get(e.s);
    if (!seen) byStudy.set(e.s, { ...e });
    else byStudy.set(e.s, { ...(e.n > seen.n ? e : seen), n: seen.n + e.n });
  }
  const own = e => { const s = catalog.study(e.s); return s && s.b === b && catalog.hasChapter(s, c) ? 1 : 0; };
  return [...byStudy.values()].sort((x, y) => own(y) - own(x) || y.n - x.n);
}

function footnotesHtml(canon, comments, mentions) {
  let html = '';
  if (comments) html += `<button type="button" class="fn fn-comment" data-fn="comments" aria-haspopup="dialog" aria-expanded="false" aria-label="${plural(comments, 'comentariu', 'comentarii')} la ${esc(verseTitle(canon))}" title="Comentarii">${BUBBLE}${comments > 1 ? comments : ''}</button>`;
  const list = ranked(mentions, canon);
  if (list.length) {
    const first = catalog.study(list[0].s);
    const label = list.length === 1 && first ? `${first.c ? bookName(first.b) + ' ' + first.c : 'Ansamblu ' + bookName(first.b)}` : plural(list.length, 'studiu', 'studii');
    html += `<button type="button" class="fn fn-study" data-fn="studies" aria-haspopup="dialog" aria-expanded="false" aria-label="Versetul apare în ${plural(list.length, 'studiu', 'studii')}" title="Studii care menționează versetul">${esc(label)}</button>`;
  }
  return html;
}

// The label of the study notes printed with a translation: "KJV" (English) after that translation's text,
// "Note KJV" (Romanian) after the first Romanian translation shown.
function notesButton(canon, { meta, items }, i, lang) {
  const what = lang ? `Notele de studiu ${meta.abbreviation}, traduse în română` : `Note de studiu ${meta.abbreviation}, în engleză`;
  return `<button type="button" class="fn fn-notes" data-fn="notes" data-i="${i}" data-lang="${lang}" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(what)} la ${esc(verseTitle(canon))}: ${esc(studyNotes.summary(items))}" title="${esc(what)}">${BOOK}${lang ? 'Note ' : ''}${esc(meta.abbreviation)}${studyNotes.pictureCount(items) ? PICTURE : ''}</button>`;
}

const language = id => available.find(t => t.id === id)?.language;
function append(vtext, html) {
  if (!vtext || !html) return;
  const fns = vtext.querySelector('.fns') || vtext.appendChild(Object.assign(document.createElement('span'), { className: 'fns' }));
  fns.insertAdjacentHTML('beforeend', html);
}

// Adds the footnotes to every verse row in the container (the chapter or the search results).
// show: { studies, comments, notes }, which kinds are switched on (in "Traduceri"); the others are not loaded.
export async function markRows(container, show) {
  const rows = [...container.querySelectorAll('.row[data-k]')];
  const ids = [...new Set(rows.map(r => parseKey(r.dataset.k).b))];
  const [notes, mentions, english, romanian] = await Promise.all([
    Promise.all(ids.map(b => show.comments ? forBook(b).catch(() => ({})) : {})),
    Promise.all(ids.map(b => show.studies ? catalog.mentions(b).catch(() => ({})) : {})),
    Promise.all(ids.map(b => show.notes ? studyNotes.forBook(b) : {})),
    Promise.all(ids.map(b => show.notes ? studyNotes.forBook(b, 'ro') : {}))
  ]);
  const of = (list, b) => list[ids.indexOf(b)] || {};
  for (const row of rows) {
    if (!row.isConnected) continue;
    const canon = row.dataset.k, { b, c, v } = parseKey(canon), k = `${c}:${v}`;
    row.querySelectorAll('.fns').forEach(el => el.remove());
    const text = cell => cell?.querySelector('.vtext:not(.missing)');
    append(row.querySelector('.vtext:not(.missing)') || row.querySelector('.vtext'), footnotesHtml(canon, of(notes, b)[k]?.length || 0, of(mentions, b)[k] || []));
    (of(english, b)[k] || []).forEach((entry, i) => append(text(row.querySelector(`.cell[data-t="${entry.meta.id}"]`)), notesButton(canon, entry, i, '')));
    const ro = text([...row.querySelectorAll('.cell')].find(cell => language(cell.dataset.t) === 'ro'));
    (of(romanian, b)[k] || []).forEach((entry, i) => append(ro, notesButton(canon, entry, i, 'ro')));
  }
}

async function showComments(button, canon) {
  const list = await forVerse(canon);
  showInfo(button, {
    title: verseTitle(canon),
    source: plural(list.length, 'comentariu', 'comentarii'),
    html: list.map(c => `<div class="fn-item"><div class="fn-meta">${esc(c.date)}</div><div class="comment-text">${esc(c.text)}</div></div>`).join('') +
      '<button type="button" class="popup-open" data-fn-edit>Adaugă sau editează ↗</button>'
  });
}

async function showStudies(button, canon) {
  const { b, c, v } = parseKey(canon);
  const list = ranked((await catalog.mentions(b))[`${c}:${v}`] || [], canon);
  showInfo(button, {
    title: verseTitle(canon) + ' în studii',
    source: `Menționat în ${plural(list.length, 'studiu', 'studii')}`,
    html: list.map(e => {
      const s = catalog.study(e.s);
      if (!s) return '';
      const part = s.parts[e.p];
      const where = `${s.c ? bookName(s.b) + ' ' + s.c : 'Privire de ansamblu ' + bookName(s.b)}${s.parts.length > 1 ? ' · ' + part.label : ''}${e.n > 1 ? ` · de ${e.n} ori` : ''}`;
      return `<a class="fn-item fn-link" href="${studyHash(s, e.p)}" data-reveal="${esc(canon)}"><span class="fn-meta">${esc(where)}</span><strong>${esc(s.title)}</strong>${e.x ? `<span class="fn-x">${esc(e.x)}</span>` : ''}</a>`;
    }).join('')
  });
}

async function showNotes(button, canon) {
  const { b, c, v } = parseKey(canon);
  const lang = button.dataset.lang;
  const { meta, items } = (await studyNotes.forBook(b, lang))[`${c}:${v}`][+button.dataset.i];
  showInfo(button, {
    title: verseTitle(canon),
    source: `${meta.name} · note de studiu${lang ? ', traduse în română' : ''} · ${studyNotes.summary(items)}`,
    html: studyNotes.itemsHtml(meta, items, lang),
    wide: true
  });
}

export function setupFootnotes(container) {
  container.addEventListener('click', e => {
    const fn = e.target.closest('.fn');
    if (!fn) return;
    e.preventDefault();
    const canon = fn.closest('.row[data-k]').dataset.k;
    ({ comments: showComments, notes: showNotes, studies: showStudies })[fn.dataset.fn](fn, canon);
  });
  // Inside the pop-up: open the comments, or a study (scrolled to where it mentions the verse).
  document.getElementById('noteText').addEventListener('click', e => {
    const edit = e.target.closest('[data-fn-edit]'), link = e.target.closest('[data-reveal]');
    if (edit) {
      const canon = document.querySelector('.fn[aria-expanded="true"]')?.closest('.row[data-k]')?.dataset.k;
      hideNote();
      if (canon) openComments(canon);
    }
    if (link) revealVerse(link.dataset.reveal);
  });
}
