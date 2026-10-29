import { $, esc, norm, store, toast, copyText } from './util.js';
import * as data from './data.js';
import { books, bookIndex, key, parseKey } from './data.js';
import { parseReference, search, approximate, warmFuzzy } from './search.js';
import { cellHtml } from './render.js';
import { setupNotes, hideNote, repositionNote } from './notes.js';
import { setupTips, hideTip } from './tips.js';
import { setupStudies, showStudies, focusStudySearch, cardTip, studyHash } from './studies.js';
import { setGo, setupPanel, closePanel } from './vizcore.js';
import { setupEditor } from './editor.js';
import * as catalog from './catalog.js';
import { linkStudy } from './refs.js';
import { setupComments } from './comments.js';
import { setupImport } from './importer.js';
import { setupFootnotes, markRows } from './footnotes.js';
import { setupStudyNotes, bookExtras, extrasHtml } from './studynotes.js';

const PAGE = 50, FONT_DEFAULT = 19;
const state = {
  b: 'JHN', c: 3, v: 0, end: 0,
  view: 'read',               // 'read' | 'search' | 'sumar' | 'info' (the pages of the study Bible)
  results: null,              // { keys, terms, whole, query, page }
  visible: [],                // translation ids in column order
  layout: store.get('layout', 'auto'),
  font: store.get('font', FONT_DEFAULT),
  theme: store.get('theme', 'auto'),
  tab: 'all',
  mode: 'bible',             // 'bible' | 'studies'
  footnotes: { studies: true, comments: true, notes: true, ...store.get('footnotes', {}) }   // what follows each verse
};

const book = id => books[bookIndex.get(id)];
const shown = () => state.visible.map(data.get).filter(Boolean);

// ---------- Preferences ----------

function setFont(size) {
  const n = Number(size);
  state.font = Number.isFinite(n) ? Math.max(14, Math.min(30, Math.round(n))) : FONT_DEFAULT;
  document.documentElement.style.setProperty('--font', state.font + 'px');
  $('fontSize').value = state.font;
  $('fontValue').value = state.font + ' px';
  $('fontSize').setAttribute('aria-valuetext', state.font + ' pixeli');
  $('fontDown').disabled = state.font === 14;
  $('fontUp').disabled = state.font === 30;
  $('fontReset').disabled = state.font === FONT_DEFAULT;
  store.set('font', state.font);
  repositionNote();
}

const THEMES = ['auto', 'light', 'dark'], THEME_LABEL = { auto: 'Tema: după sistem', light: 'Tema: luminoasă', dark: 'Tema: întunecată' };
function setTheme(theme) {
  state.theme = THEMES.includes(theme) ? theme : 'auto';
  if (state.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
  $('theme').title = THEME_LABEL[state.theme];
  $('theme').setAttribute('aria-label', THEME_LABEL[state.theme] + '. Schimbă tema');
  store.set('theme', state.theme);
}

// ---------- Layout ----------

function applyLayout() {
  const el = $('columns'), n = state.visible.length;
  el.style.setProperty('--n', n);
  const stacked = state.layout === 'stacked' || (state.layout === 'auto' && n > 1 && el.clientWidth / n < 290);
  el.classList.toggle('stacked', stacked);
  el.classList.toggle('single', n === 1);
}
new ResizeObserver(() => applyLayout()).observe($('columns'));

// ---------- Navigation lists ----------

function bookList() {
  const filter = norm($('bookFilter').value.trim());
  $('booklist').innerHTML = books
    .filter(b => (state.tab === 'all' || b.testament === state.tab) && (!filter || norm(b.name).includes(filter) || b.aliases.some(a => a.startsWith(filter))))
    .map(b => `<button type="button" data-book="${b.id}" class="${b.id === state.b ? 'active' : ''}"${b.id === state.b ? ' aria-current="page"' : ''}>${esc(b.name)}<span>${b.chapters}</span></button>`)
    .join('');
}

function pickerBooks() {
  $('pickerTitle').textContent = 'Alege cartea';
  $('pickerBack').hidden = true;
  const group = (t, label) => `<h3>${label}</h3><div class="grid books">` + books.filter(b => b.testament === t)
    .map(b => `<button type="button" data-pick-book="${b.id}" class="${b.id === state.b ? 'active' : ''}">${esc(b.name)}</button>`).join('') + '</div>';
  $('pickerBody').innerHTML = group('ot', 'Vechiul Testament') + group('nt', 'Noul Testament');
}

function pickerChapters(id) {
  const b = book(id);
  $('pickerTitle').textContent = b.name;
  $('pickerBack').hidden = false;
  $('pickerBody').innerHTML = '<div class="grid chapters">' + Array.from({ length: b.chapters }, (_, i) =>
    `<button type="button" data-pick-chapter="${i + 1}" data-book-id="${id}" class="${id === state.b && i + 1 === state.c ? 'active' : ''}">${i + 1}</button>`).join('') + '</div>';
}

function openPicker() {
  hideNote();
  if (book(state.b).chapters > 1) pickerChapters(state.b); else pickerBooks();
  $('pickerDialog').showModal();
}

// ---------- Rendering ----------

function headHtml() {
  return '<div class="colhead">' + shown().map(t =>
    `<div class="head" style="--accent:${esc(t.meta.color || '#4f6b3a')}"><span class="badge" aria-hidden="true">${esc(t.meta.abbreviation.slice(0, 1))}</span>` +
    `<div class="head-text"><strong>${esc(t.meta.abbreviation)}</strong><small>${esc(t.meta.description || t.meta.name)}</small></div>` +
    (state.view === 'read' ? `<button type="button" class="head-copy" data-copy="${t.id}" aria-label="Copiază capitolul în ${esc(t.meta.abbreviation)}">Copiază</button>` : '') +
    '</div>').join('') + '</div>';
}

function rowHtml(canon, searchInfo) {
  const { b, c, v } = parseKey(canon);
  const selected = state.view === 'read' && state.v && v >= state.v && v <= (state.end || state.v);
  const score = searchInfo?.approx?.get(canon);
  const ref = searchInfo ? `<div class="resultref"><button type="button" data-open="${canon}">${esc(book(b).name)} ${c}:${v}</button>${score ? `<span class="match" title="Cât de aproape e versetul de căutare">potrivire ${Math.round(score * 100)}%</span>` : ''}<span>Deschide în capitol ↗</span></div>` : '';
  return `<article class="row${selected ? ' selected' : ''}" id="v-${b}-${c}-${v}" data-k="${canon}">${ref}${shown().map(t => cellHtml(t, canon, searchInfo)).join('')}</article>`;
}

// Studies of the chapter being read, and the overview of its book.
function studyLinks() {
  const list = [...catalog.forChapter(state.b, state.c), ...catalog.studies.filter(s => s.b === state.b && s.c === 0)];
  $('studyLink').innerHTML = list.map(s =>
    `<a href="${studyHash(s)}" data-tipcard="${s.id}"><span class="eyebrow">${s.c ? 'Studiu' : 'Privire de ansamblu'}</span>${esc(s.title)}</a>`).join('');
  $('studyLink').hidden = !list.length;
}

function setStatus(text) {
  $('meta').textContent = text;
}

function updateTitle(eyebrow, title, clickable) {
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title + (clickable ? ' ▾' : '');
  $('title').disabled = !clickable;
}

function renderRead(scroll = true) {
  const b = book(state.b), translations = shown();
  const rows = data.chapterRows(translations, state.b, state.c);
  updateTitle((b.testament === 'ot' ? 'Vechiul Testament' : 'Noul Testament') + ' · ' + b.name, `${b.name} ${state.c}`, true);
  setStatus(`${rows.length} versete · ${translations.map(t => t.meta.abbreviation).join(' · ')}`);
  const messages = data.notices(translations, state.b, state.c);
  $('notice').innerHTML = messages.map(esc).join('<br>');
  $('notice').hidden = !messages.length;
  studyLinks();
  extrasLinks();
  $('columns').innerHTML = headHtml() + rows.map(v => rowHtml(key(state.b, state.c, v))).join('');
  markRows($('columns'), state.footnotes);
  $('pagination').hidden = true;
  $('back').hidden = true;
  $('copyAll').hidden = $('share').hidden = $('prev').hidden = $('next').hidden = false;
  $('prev').disabled = state.b === books[0].id && state.c === 1;
  $('next').disabled = state.b === books.at(-1).id && state.c === books.at(-1).chapters;
  applyLayout();
  bookList();
  if (scroll) {
    const target = state.v && $(`v-${state.b}-${state.c}-${state.v}`);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
    else document.querySelector('.reader').scrollIntoView({ block: 'start' });
  }
}

function renderResults() {
  const r = state.results, total = r.keys.length, start = r.page * PAGE;
  const slice = r.keys.slice(start, start + PAGE);
  updateTitle('Căutare · ' + $('searchIn').selectedOptions[0].textContent, `Rezultate pentru „${r.query}”`, false);
  setStatus(r.approx
    ? `${r.exact ? `${r.exact.toLocaleString('ro-RO')} potriviri exacte` : 'Nicio potrivire exactă'} · ${total} potriviri apropiate${total ? ` · ${start + 1}–${Math.min(start + PAGE, total)}` : ''} · ${r.ms} ms`
    : `${total.toLocaleString('ro-RO')} versete găsite${total ? ` · ${start + 1}–${Math.min(start + PAGE, total)}` : ''} · ${r.ms} ms`);
  $('notice').hidden = $('studyLink').hidden = true;
  // Approximate matches are shown apart, ordered by score; exact results offer them on request.
  const bar = r.approx
    ? `<div class="approx-bar"><strong>Potriviri apropiate</strong> ordonate după cât de aproape sunt de „${esc(r.query)}”: aceleași cuvinte sau rădăcini, altă ordine, o greșeală de tipar.${r.exact ? ' <button type="button" data-exact>Înapoi la potrivirile exacte</button>' : ''}</div>`
    : total && r.page === 0 ? '<div class="approx-bar"><button type="button" data-approx>Caută și potriviri apropiate</button></div>' : '';
  $('columns').innerHTML = slice.length
    ? bar + headHtml() + slice.map(k => rowHtml(k, r)).join('')
    : '<div class="empty"><strong>Niciun verset găsit</strong>Nici potriviri apropiate. Încearcă alte cuvinte sau extinde căutarea la toată Biblia.</div>';
  markRows($('columns'), state.footnotes);
  $('back').hidden = false;
  $('copyAll').hidden = $('share').hidden = $('prev').hidden = $('next').hidden = true;
  const pages = Math.ceil(total / PAGE);
  $('pagination').hidden = pages <= 1;
  $('pagination').innerHTML = `<button type="button" data-page="-1"${r.page === 0 ? ' disabled' : ''}>← Înapoi</button><span>${r.page + 1} / ${Math.max(1, pages)}</span><button type="button" data-page="1"${r.page + 1 >= pages ? ' disabled' : ''}>Mai departe →</button>`;
  applyLayout();
}

// "Sumar" (the book introduction) and "Informații suplimentare" (the inserts of the chapter) from the study
// Bible, shown under the title when the book or the chapter has them.
async function extrasLinks() {
  const { b, c } = state, list = await bookExtras(b);
  if (state.b !== b || state.c !== c) return;
  const summary = list.some(x => x.intro), extra = list.some(x => x.chapters?.[c]?.length);
  Object.assign($('summaryLink'), { href: `#/${b}/sumar`, hidden: !summary });
  Object.assign($('extraLink'), { href: `#/${b}/${c}/info`, hidden: !extra });
  $('bookExtras').hidden = !summary && !extra;
}

async function renderExtras() {
  const b = book(state.b), summary = state.view === 'sumar', { c } = state;
  updateTitle(summary ? 'Sumar · introducerea cărții' : 'Informații suplimentare · articole, hărți, tabele', summary ? b.name : `${b.name} ${c}`, false);
  $('notice').hidden = $('studyLink').hidden = $('bookExtras').hidden = $('pagination').hidden = true;
  $('back').hidden = false;
  $('copyAll').hidden = $('share').hidden = $('prev').hidden = $('next').hidden = true;
  const list = await bookExtras(state.b);
  if (state.view !== (summary ? 'sumar' : 'info') || state.c !== c) return;
  const html = extrasHtml(list, summary ? 0 : c);
  setStatus(list.map(x => x.meta.name).join(' · ') || 'Biblia de studiu');
  $('columns').innerHTML = html || `<div class="empty"><strong>Nimic aici</strong>${summary ? 'Cartea nu are încă o introducere importată.' : 'Capitolul nu are articole, hărți sau tabele în Biblia de studiu.'}</div>`;
  document.querySelector('.reader').scrollIntoView({ block: 'start' });
}

function render(scroll) {
  hideNote();
  if (state.view === 'sumar' || state.view === 'info') renderExtras();
  else if (state.view === 'search' && state.results) renderResults(); else renderRead(scroll);
}

// ---------- Routing ----------

function setMode(mode) {
  state.mode = mode;
  $('bibleView').hidden = mode !== 'bible';
  $('studiesView').hidden = mode !== 'studies';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  store.set('mode', mode);
  hideNote();
  hideTip();
  if (mode === 'bible') closePanel();
}

// Pushes a new address (so Back returns here) and shows it.
function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

async function route() {
  if (location.hash.startsWith('#/studii')) {
    setMode('studies');
    await showStudies(location.hash.slice('#/studii'.length));
    return;
  }
  const r = readHash();
  if (state.mode !== 'bible') { setMode('bible'); if (!r) { read(state.b, state.c, state.v, state.end); return; } }
  if (r?.page) showExtras(r.b, r.c, r.page);
  else if (r) read(r.b, r.c, r.v, r.end);
}

function showExtras(b, c, page) {
  state.b = b;
  state.c = Math.max(1, Math.min(book(b).chapters, c));
  state.v = state.end = 0;
  state.view = page;
  store.set('last', { b, c: state.c, v: 0 });
  render(true);
}

function writeHash() {
  const hash = `#/${state.b}/${state.c}${state.v ? '/' + state.v + (state.end > state.v ? '-' + state.end : '') : ''}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  store.set('last', { b: state.b, c: state.c, v: state.v });
}

function readHash() {
  let m = location.hash.match(/^#\/([1-3A-Z]{3})\/(\d+)(?:\/(\d+)(?:-(\d+))?)?$/);
  if (m && bookIndex.has(m[1])) return { b: m[1], c: +m[2], v: +m[3] || 0, end: +m[4] || +m[3] || 0 };
  m = location.hash.match(/^#\/([1-3A-Z]{3})\/(?:(\d+)\/)?(sumar|info)$/);   // the pages of the study Bible
  if (m && bookIndex.has(m[1])) return { b: m[1], c: +m[2] || 1, page: m[3] };
  m = location.hash.match(/^#(\d+)\/(\d+)(?:\/(\d+))?$/); // links from the previous app: #43/3/16
  if (m && books[+m[1] - 1]) return { b: books[+m[1] - 1].id, c: +m[2], v: +m[3] || 0, end: +m[3] || 0 };
  return null;
}

function read(b, c, v = 0, end = v) {
  const target = book(b);
  if (!target) return;
  state.b = b;
  state.c = Math.max(1, Math.min(target.chapters, c));
  state.v = v;
  state.end = end;
  state.view = 'read';
  $('query').value = '';
  writeHash();
  render(true);
}

function move(delta) {
  let i = bookIndex.get(state.b), c = state.c + delta;
  if (c < 1) { if (--i < 0) return; c = books[i].chapters; }
  if (c > books[i].chapters) { if (++i >= books.length) return; c = 1; }
  read(books[i].id, c);
}

// ---------- Search ----------

async function runSearch(approx = false) {
  const query = $('query').value.trim();
  if (!query) { read(state.b, state.c); return; }
  const reference = parseReference(query);
  if (reference) {
    let { b, c, v, end } = reference;
    if (c < 1 || c > book(b).chapters) { toast(`${book(b).name} nu are capitolul ${c}.`); return; }
    const inId = $('searchIn').value;
    if (v && inId !== 'visible') {
      // A reference typed in one translation's own numbering.
      const canon = parseKey(data.get(inId).canonical(key(b, c, v)));
      ({ b, c, v } = canon);
      end = Math.max(v, end);
    }
    $('query').value = '';
    read(b, c, v, end);
    return;
  }
  const inId = $('searchIn').value;
  const translations = inId === 'visible' ? shown() : [data.get(inId)];
  const started = performance.now();
  const whole = $('whole').checked;
  const { keys, terms } = search(translations, { query, mode: $('mode').value, whole, scope: $('scope').value, currentBook: state.b });
  state.results = { keys, terms, whole, query, page: 0, ms: Math.round(performance.now() - started) };
  if (!keys.length || approx) {
    // Nothing exact (or asked for): the closest verses.
    const near = approximate(translations, { query, scope: $('scope').value, currentBook: state.b });
    state.results = { keys: near.hits.map(h => h.key), terms: near.terms, whole: true, query, page: 0, exact: keys.length,
      approx: new Map(near.hits.map(h => [h.key, h.score])), ms: Math.round(performance.now() - started) };
  }
  state.view = 'search';
  render();
  document.querySelector('.reader').scrollIntoView({ block: 'start' });
}

function fillSearchIn() {
  const previous = $('searchIn').value;
  const list = shown();
  $('searchIn').innerHTML = (list.length > 1 ? '<option value="visible">Toate traducerile afișate</option>' : '') +
    list.map(t => `<option value="${t.id}">Doar ${esc(t.meta.abbreviation)}</option>`).join('');
  if ([...$('searchIn').options].some(o => o.value === previous)) $('searchIn').value = previous;
}

// ---------- Copy ----------

function chapterText(ids) {
  const b = book(state.b);
  const parts = ids.map(id => {
    const t = data.get(id);
    const lines = t.ownVersesInChapter(state.b, state.c).map(v => `${v}. ${t.verse(key(state.b, state.c, v))}`);
    return t.meta.abbreviation + '\n' + lines.join('\n');
  });
  return `${b.name} ${state.c}\n\n` + parts.join('\n\n');
}

// ---------- Translations ----------

function translationList() {
  const order = [...state.visible, ...data.available.map(t => t.id).filter(id => !state.visible.includes(id))];
  $('translationList').innerHTML = order.map(id => {
    const t = data.available.find(x => x.id === id), on = state.visible.includes(id), i = state.visible.indexOf(id);
    return `<li style="--accent:${esc(t.color || '#4f6b3a')}"><label><input type="checkbox" data-toggle="${id}"${on ? ' checked' : ''}${on && state.visible.length === 1 ? ' disabled' : ''}>` +
      `<span class="badge" aria-hidden="true">${esc(t.abbreviation.slice(0, 1))}</span><span><strong>${esc(t.abbreviation)}</strong><small>${esc(t.name)}</small></span></label>` +
      (on ? `<span class="order"><button type="button" class="icon" data-up="${id}" aria-label="Mută ${esc(t.abbreviation)} spre stânga"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="icon" data-down="${id}" aria-label="Mută ${esc(t.abbreviation)} spre dreapta"${i === state.visible.length - 1 ? ' disabled' : ''}>↓</button></span>` : '') +
      '</li>';
  }).join('');
  $('translationsCount').textContent = state.visible.length;
}

async function setVisible(ids, rerender = true) {
  const list = ids.filter(id => data.available.some(t => t.id === id));
  state.visible = list.length ? list : [data.available[0].id];
  store.set('visible', state.visible);
  setStatus('Se încarcă…');
  await Promise.all(state.visible.map(data.load));
  warmFuzzy(shown());   // the index for approximate search, built while the page is idle
  translationList();
  fillSearchIn();
  if (!rerender) return;
  if (state.view === 'search' && state.results) await runSearch(); else render(false);
}

function sources() {
  $('sources').innerHTML = data.available.map(t =>
    `<h4>${esc(t.abbreviation)} — ${esc(t.name)}</h4><p>${esc(t.source || '')}</p>${t.notes ? `<p>${esc(t.notes)}</p>` : ''}<p class="hint">${esc(t.copyright || '')}</p>`).join('');
}

// ---------- Events ----------

function wire() {
  $('searchForm').addEventListener('submit', e => { e.preventDefault(); runSearch(); });
  $('bookFilter').addEventListener('input', bookList);
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    bookList();
  }));
  $('booklist').addEventListener('click', e => { const b = e.target.closest('[data-book]'); if (b) read(b.dataset.book, 1); });
  $('title').addEventListener('click', openPicker);
  $('pickerBack').addEventListener('click', pickerBooks);
  $('pickerBody').addEventListener('click', e => {
    const b = e.target.closest('[data-pick-book]');
    if (b) { if (book(b.dataset.pickBook).chapters === 1) { $('pickerDialog').close(); read(b.dataset.pickBook, 1); } else pickerChapters(b.dataset.pickBook); return; }
    const c = e.target.closest('[data-pick-chapter]');
    if (c) { $('pickerDialog').close(); read(c.dataset.bookId, +c.dataset.pickChapter); }
  });
  $('prev').addEventListener('click', () => move(-1));
  $('next').addEventListener('click', () => move(1));
  $('back').addEventListener('click', () => { if (state.view !== 'search') { read(state.b, state.c); return; } state.view = 'read'; render(true); });
  $('home').addEventListener('click', e => { e.preventDefault(); $('query').value = ''; if (state.mode === 'bible') read(state.b, state.c); else go(`#/${state.b}/${state.c}`); });
  $('share').addEventListener('click', () => copyText(location.href));
  $('copyAll').addEventListener('click', () => copyText(chapterText(state.visible)));
  $('columns').addEventListener('click', e => {
    if (e.target.closest('.ref-link, .fn')) return;
    if (e.target.closest('[data-approx]')) { runSearch(true); return; }
    if (e.target.closest('[data-exact]')) { runSearch(); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) { copyText(chapterText([copy.dataset.copy])); return; }
    const open = e.target.closest('[data-open]');
    if (open) { const { b, c, v } = parseKey(open.dataset.open); read(b, c, v); return; }
    const num = e.target.closest('.vnum');
    if (num && state.view === 'read') {
      const row = num.closest('.row'), { v } = parseKey(row.dataset.k);
      state.v = state.v === v ? 0 : v;
      state.end = state.v;
      document.querySelectorAll('.row.selected').forEach(r => r.classList.remove('selected'));
      if (state.v) row.classList.add('selected');
      writeHash();
    }
  });
  $('pagination').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    state.results.page += +b.dataset.page;
    render();
    document.querySelector('.reader').scrollIntoView({ block: 'start' });
  });
  $('fontDown').addEventListener('click', () => setFont(state.font - 1));
  $('fontUp').addEventListener('click', () => setFont(state.font + 1));
  $('fontSize').addEventListener('input', () => setFont($('fontSize').value));
  $('fontReset').addEventListener('click', () => setFont(FONT_DEFAULT));
  $('theme').addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length]));
  $('help').addEventListener('click', () => $('helpDialog').showModal());
  $('translationsButton').addEventListener('click', () => { translationList(); $('layout').value = state.layout; $('translationsDialog').showModal(); });
  $('translationList').addEventListener('change', e => {
    const id = e.target.dataset.toggle;
    if (!id) return;
    setVisible(e.target.checked ? [...state.visible, id] : state.visible.filter(x => x !== id));
  });
  $('translationList').addEventListener('click', e => {
    const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]');
    const id = (up || down)?.dataset[up ? 'up' : 'down'];
    if (!id) return;
    const list = [...state.visible], i = list.indexOf(id), j = i + (up ? -1 : 1);
    [list[i], list[j]] = [list[j], list[i]];
    setVisible(list).then(() => $('translationList').querySelector(`[data-${up ? 'up' : 'down'}="${id}"]:not(:disabled)`)?.focus());
  });
  $('layout').addEventListener('change', () => { state.layout = $('layout').value; store.set('layout', state.layout); applyLayout(); });
  for (const [id, kind] of [['fnStudies', 'studies'], ['fnComments', 'comments'], ['fnNotes', 'notes']]) {
    $(id).checked = state.footnotes[kind];
    $(id).addEventListener('change', () => {
      state.footnotes[kind] = $(id).checked;
      store.set('footnotes', state.footnotes);
      $('columns').classList.toggle('no-comments', !state.footnotes.comments);
      hideNote();
      markRows($('columns'), state.footnotes);
    });
  }
  $('columns').classList.toggle('no-comments', !state.footnotes.comments);
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { d.close(); return; }
    if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); }
  }));
  window.addEventListener('hashchange', route);
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () =>
    go(b.dataset.mode === 'studies' ? store.get('studiesHash', '#/studii') : `#/${state.b}/${state.c}`)));
  document.addEventListener('keydown', e => {
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.querySelector('dialog[open]');
    if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '/') { e.preventDefault(); if (state.mode === 'studies') focusStudySearch(); else $('query').focus(); }
    else if (state.mode !== 'bible') return;
    else if (state.view === 'read' && e.key === 'ArrowLeft') move(-1);
    else if (state.view === 'read' && e.key === 'ArrowRight') move(1);
  });
  setupTips(cardTip);
  setupStudies({ go, decorate: linkStudy });
  setGo(go);
  setupPanel();
  setupEditor();
  setupFootnotes($('columns'));
  setupStudyNotes();
  setupImport();
  setupComments($('columns'), {
    // The verse as shown in the first displayed translation that has it.
    verse: canon => {
      const { b, c, v } = parseKey(canon);
      for (const t of shown()) {
        const own = t.resolve(canon), text = own && t.verse(own);
        if (text) return { title: `${book(b).name} ${c}:${v}`, text, abbr: t.meta.abbreviation };
      }
      return null;
    },
    translations: () => shown().map(t => t.meta),
    onChange: () => markRows($('columns'), state.footnotes),
    enabled: () => state.footnotes.comments
  });
  setupNotes([$('columns'), $('studyDoc'), $('studyVisual'), $('studyBookVisual'), $('vizPanel')], {
    visible: shown,
    onOpen: canon => { const { b, c, v } = parseKey(canon); if (state.mode === 'bible') read(b, c, v); else go(`#/${b}/${c}/${v}`); }
  });
}

// ---------- Offline ----------

function offlineSetup() {
  const embedded = !!document.getElementById('embedded-data');
  const status = text => { $('status').hidden = false; $('statusText').textContent = text; };
  if (embedded) { status('Fișier offline'); return; }
  $('offlineFile').hidden = false;
  // Local previews skip the service worker (stale caches while editing) unless ?sw is added.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !new URLSearchParams(location.search).has('sw');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !local)
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => status('Disponibil offline')).catch(() => {});
}

// ---------- Start ----------

async function start() {
  setTheme(state.theme);
  setFont(state.font);
  try {
    await data.init();
    sources();
    wire();
    const initial = readHash() || store.get('last', null);
    if (initial && bookIndex.has(initial.b)) Object.assign(state, { b: initial.b, c: initial.c || 1, v: initial.v || 0, end: initial.end || initial.v || 0 });
    const saved = store.get('visible', null);
    await Promise.all([
      setVisible(Array.isArray(saved) && saved.length ? saved : data.available.map(t => t.id), false),
      catalog.load().catch(error => console.warn('Studiile nu au putut fi încărcate', error))
    ]);
    if (!location.hash && store.get('mode', 'bible') === 'studies') history.replaceState(null, '', store.get('studiesHash', '#/studii'));
    if (location.hash.startsWith('#/studii')) { renderRead(false); await route(); }
    else read(state.b, state.c, state.v, state.end);
    $('footInfo').textContent = `${books.length} cărți · ${data.available.length} traduceri disponibile · căutarea rămâne pe dispozitivul tău`;
    offlineSetup();
    window.scriptura = { state, data, read, runSearch, go };
  } catch (error) {
    console.error(error);
    $('columns').innerHTML = '<div class="empty"><strong>Textele nu au putut fi încărcate</strong>Verifică conexiunea sau deschide aplicația într-un browser actualizat (Chrome, Edge, Firefox, Safari).</div>';
    setStatus('Eroare la încărcare');
  }
}

start();
