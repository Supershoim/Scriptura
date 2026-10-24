// The "Studii" section: books with progress, the catalog with search and filters, and the study reader.
// Routes: #/studii, #/studii/ROM (one book), #/studii/ROM/2 (a study), #/studii/ROM/2/2 (its second part).
import { $, esc, norm, store } from './util.js';
import { books } from './data.js';
import * as catalog from './catalog.js';
import { studies, study, chapters, bookOf } from './catalog.js';
import { hideTip } from './tips.js';

const PAGE = 30;
const state = { book: null, theme: null, query: '', tab: 'all', shown: PAGE, current: null, part: 0, seq: 0 };
let options = { decorate: () => {}, go: hash => { location.hash = hash; } };

const EMOJI = /[\u{1F000}-\u{1FAFF}☀-➿️⃣]/gu;
const plural = (n, one, many) => `${n.toLocaleString('ro-RO')} ${n === 1 ? one : many}`;
const kwords = n => `${String(Math.round(n / 100) / 10).replace('.', ',')}k cuvinte`;
const chapterLabel = s => s.c === 0 ? 'ansamblu' : s.covers ? s.covers.join(s.covers.length === 2 && s.covers[1] - s.covers[0] > 1 ? ', ' : '–') : String(s.c);
// "Ioan 21:15-17: restaurarea lui Petru" -> "Restaurarea lui Petru" (the card already shows the reference).
const shortTitle = s => {
  const t = s.c === 0 ? s.title : s.title.replace(/^.*?:\s+/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const studyHash = (s, part = 0) => `#/studii/${s.b}/${s.c}${part ? '/' + (part + 1) : ''}`;

// ---------- Sidebar and progress ----------

function progress() {
  const done = new Set(studies.flatMap(s => chapters(s).map(c => s.b + c))).size, total = catalog.totalChapters();
  $('studyProgress').innerHTML = `<div class="progress-line"><strong>${done.toLocaleString('ro-RO')}</strong> din ${total.toLocaleString('ro-RO')} capitole</div>` +
    `<div class="bar" role="progressbar" aria-label="Capitole cu studiu" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div>` +
    `<div class="hint">${plural(studies.length, 'studiu', 'studii')} în ${plural(new Set(studies.map(s => s.b)).size, 'carte', 'cărți')}</div>`;
}

function sideBooks() {
  const filter = norm($('studyBookFilter').value.trim());
  $('studyBooks').innerHTML = books
    .filter(b => (state.tab === 'all' || b.testament === state.tab) && (!filter || norm(b.name).includes(filter) || b.aliases.some(a => a.startsWith(filter))))
    .map(b => {
      const have = catalog.studiedChapters(b.id).size, on = state.book === b.id;
      const overview = studies.some(s => s.b === b.id && s.c === 0);
      return `<button type="button" data-study-book="${b.id}" class="${on ? 'active' : ''}${have || overview ? '' : ' empty'}"${on ? ' aria-current="true"' : ''}` +
        ` data-tip-t="${esc(b.name)}" data-tip="${have} din ${b.chapters} capitole au studiu${overview ? '\nAre și privire de ansamblu' : ''}">` +
        `<span class="bname">${esc(b.name)}</span><span>${have}/${b.chapters}</span><span class="bar"><i style="width:${(have / b.chapters * 100).toFixed(1)}%"></i></span></button>`;
    }).join('');
}

function selects() {
  const count = new Map();
  for (const s of studies) count.set(s.b, (count.get(s.b) || 0) + 1);
  $('studyBook').innerHTML = '<option value="">Toate cărțile</option>' + books.filter(b => count.has(b.id))
    .map(b => `<option value="${b.id}"${b.id === state.book ? ' selected' : ''}>${esc(b.name)} (${count.get(b.id)})</option>`).join('');
  const themes = new Map();
  for (const s of studies) if (!state.book || s.b === state.book) for (const t of s.themes) themes.set(t, (themes.get(t) || 0) + 1);
  if (state.theme && !themes.has(state.theme)) state.theme = null;
  $('studyTheme').innerHTML = '<option value="">Toate temele</option>' + [...themes].sort((a, b) => a[0].localeCompare(b[0], 'ro'))
    .map(([t, n]) => `<option value="${esc(t)}"${t === state.theme ? ' selected' : ''}>${esc(t)} (${n})</option>`).join('');
  $('studyReset').hidden = !state.book && !state.theme && !state.query;
}

// ---------- Catalog ----------

function bookPanel() {
  const panel = $('studyBookPanel'), b = state.book && bookOf(state.book);
  panel.hidden = !b;
  if (!b) return;
  const have = catalog.studiedChapters(b.id), overview = studies.find(s => s.b === b.id && s.c === 0);
  const cell = c => {
    const s = catalog.forChapter(b.id, c)[0];
    return s ? `<button type="button" class="chc has" data-open="${s.id}" data-tipcard="${s.id}" aria-label="${esc(b.name)} ${c}: ${esc(shortTitle(s))}">${c}</button>`
      : `<span class="chc" title="${esc(b.name)} ${c}: urmează">${c}</span>`;
  };
  panel.innerHTML = `<div class="bookpanel-head"><h2>${esc(b.name)}</h2><span class="meta">${have.size} din ${b.chapters} capitole${overview ? ' · cu privire de ansamblu' : ''}</span>` +
    `<button type="button" class="ghost small" data-read="${b.id}">Citește în Biblie</button></div>` +
    `<div class="chgrid">${overview ? `<button type="button" class="chc has intro" data-open="${overview.id}" data-tipcard="${overview.id}">ansamblu</button>` : ''}` +
    Array.from({ length: b.chapters }, (_, i) => cell(i + 1)).join('') + '</div>';
}

function cardHtml(s) {
  const b = bookOf(s.b);
  return `<button type="button" class="card" data-open="${s.id}" data-tipcard="outline:${s.id}">` +
    `<span class="cref"><span class="cb">${esc(b.abbr || b.name)}</span><span class="cc${s.c === 0 ? ' sm' : ''}">${esc(chapterLabel(s))}</span></span>` +
    `<span class="cbody"><span class="ctitle">${esc(shortTitle(s))}</span><span class="csum">${esc(s.summary)}</span>` +
    `<span class="snips" data-snip="${s.id}"></span>` +
    `<span class="cmeta">${s.parts.map(p => `<span class="tag">${esc(p.label)}</span>`).join('')}<span>${esc(s.date)}</span><span>${kwords(s.words)}</span></span>` +
    `<span class="ctags">${esc(s.themes.slice(0, 6).join(', '))}</span></span></button>`;
}

async function results() {
  const seq = ++state.seq, out = $('studyResults');
  const filtered = state.book || state.theme || state.query.trim();
  if (!filtered) {
    const recent = [...studies].sort((x, y) => y.date.localeCompare(x.date) || x.n - y.n).slice(0, 12);
    out.innerHTML = `<h2 class="section-title">Adăugate recent</h2>` + recent.map(cardHtml).join('') +
      `<p class="hint">Alege o carte din listă sau caută după cuvânt, temă ori trimitere (de exemplu „Rom 2:13” sau „fapte 13 har”). Fiecare capitol are studiul complet și, unde există, variantele și întrebările legate de el.</p>`;
    return;
  }
  const { list, terms } = await catalog.search(state.query, { book: state.book, theme: state.theme });
  if (seq !== state.seq) return;
  const where = [state.book && bookOf(state.book).name, state.theme && `tema „${state.theme}”`].filter(Boolean).join(', ');
  if (!list.length) {
    out.innerHTML = `<p class="meta">Niciun studiu${where ? ' în ' + esc(where) : ''}</p><div class="empty"><strong>Niciun studiu găsit</strong>Încearcă un cuvânt mai scurt sau scoate un filtru.</div>`;
    return;
  }
  const page = list.slice(0, state.shown);
  out.innerHTML = `<p class="meta">${plural(list.length, 'studiu', 'studii')}${where ? ' în ' + esc(where) : ''}</p>` + page.map(r => cardHtml(r.s)).join('') +
    (list.length > state.shown ? `<button type="button" class="more" data-more>Arată mai multe (${list.length - state.shown})</button>` : '');
  for (const { s } of page) catalog.snippets(s, terms).then(found => {
    const el = seq === state.seq && out.querySelector(`[data-snip="${s.id}"]`);
    if (el) el.innerHTML = found.map(x => `<span class="snip">${x}</span>`).join('');
  });
}

function renderCatalog() {
  progress();
  sideBooks();
  selects();
  bookPanel();
  return results();
}

// Tooltip for a study: its summary (or, on a card that shows it already, only the contents) and outline.
export function cardTip(key) {
  const outlineOnly = key.startsWith('outline:'), s = study(key.replace('outline:', ''));
  if (!s) return '';
  const first = s.parts[0], b = bookOf(s.b);
  const sum = outlineOnly ? [] : s.summary.split(/(?<=[.!?…])\s+(?=[A-ZĂÂÎȘȚ„«])/).slice(0, 3);
  const cut = (t, n) => t.length > n ? t.slice(0, n - 2) + '…' : t;
  return `<b>${esc(outlineOnly ? 'Ce conține studiul' : s.c ? `${b.name} ${chapterLabel(s)}: ${shortTitle(s)}` : s.title)}</b>` +
    (sum.length ? `<ul>${sum.map(x => `<li>${esc(cut(x, 170))}</li>`).join('')}</ul>` : '') +
    (first.outline.length ? `<div class="tip-foot">Cuprins:</div><ul>${first.outline.map(h => `<li>${esc(cut(h, 70))}</li>`).join('')}${first.sections > 8 ? `<li>… încă ${first.sections - 8}</li>` : ''}</ul>` : '') +
    `<div class="tip-foot">${s.parts.map(p => esc(p.label)).join(' · ')} · ${kwords(s.words)}</div>`;
}

// ---------- Reader ----------

let tocObserver = null;
function watchToc() {
  tocObserver?.disconnect();
  const links = [...$('studyToc').querySelectorAll('a')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const heads = [...$('studyDoc').querySelectorAll('[id^="s"]')], seen = new Map();
  tocObserver = new IntersectionObserver(entries => {
    entries.forEach(e => seen.set(e.target.id, e.isIntersecting));
    let cur = heads.find(h => seen.get(h.id));
    if (!cur) cur = heads.filter(h => h.getBoundingClientRect().top < innerHeight * 0.3).pop() || heads[0];
    links.forEach(a => a.setAttribute('aria-current', String(a.dataset.goto === cur?.id)));
  }, { rootMargin: '-110px 0px -65% 0px' });
  heads.forEach(h => tocObserver.observe(h));
}

function find(term) {
  const doc = $('studyDoc');
  doc.innerHTML = doc.dataset.raw ?? doc.innerHTML;
  const t = norm(term.trim());
  if (t.length < 2) { $('studyFindCount').textContent = ''; watchToc(); return; }
  let count = 0;
  const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue, n = norm(text);
    let i = n.indexOf(t);
    if (i < 0 || n.length !== text.length) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (i > -1) {
      frag.append(text.slice(last, i));
      const m = document.createElement('mark');
      m.textContent = text.slice(i, i + t.length);
      frag.append(m);
      count++;
      last = i + t.length;
      i = n.indexOf(t, last);
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  $('studyFindCount').textContent = count ? plural(count, 'potrivire', 'potriviri') : 'nicio potrivire';
  doc.querySelector('mark')?.scrollIntoView({ block: 'center' });
  watchToc();
}

async function openStudy(s, part, term) {
  state.current = s;
  state.part = Math.max(0, Math.min(s.parts.length - 1, part));
  const b = bookOf(s.b), p = s.parts[state.part];
  $('studyCatalog').hidden = true;
  $('studyReader').hidden = false;
  $('studyEyebrow').textContent = `Studii · ${b.name}${s.c ? ' ' + chapterLabel(s) : ' · privire de ansamblu'}`;
  $('studyTitle').textContent = s.title;
  $('studyMeta').textContent = `${s.date} · ${kwords(s.words)} · ${s.themes.slice(0, 5).join(', ')}`;
  $('studyBible').textContent = `Citește ${b.name} ${s.c || 1}`;
  $('studyPrev').disabled = s.n === 0;
  $('studyNext').disabled = s.n === studies.length - 1;
  $('studyPrev').title = s.n ? 'Studiul anterior: ' + studies[s.n - 1].title : '';
  $('studyNext').title = s.n < studies.length - 1 ? 'Studiul următor: ' + studies[s.n + 1].title : '';
  $('studyParts').innerHTML = s.parts.length > 1 ? s.parts.map((x, i) =>
    `<button type="button" role="tab" data-part="${i}" aria-selected="${i === state.part}">${esc(x.label)}</button>`).join('') : '';
  const doc = $('studyDoc');
  delete doc.dataset.raw;
  doc.innerHTML = '<div class="loading">Se încarcă studiul…</div>';
  $('studyToc').innerHTML = '';
  scrollTo(0, 0);
  let html;
  try { html = await catalog.text(p.path); } catch { html = '<div class="empty"><strong>Studiul nu s-a putut încărca</strong>Verifică conexiunea și încearcă din nou.</div>'; }
  if (state.current !== s || state.part !== s.parts.indexOf(p)) return;
  doc.innerHTML = html;
  options.decorate(doc, s);
  doc.dataset.raw = doc.innerHTML;
  const heads = [...doc.querySelectorAll('[id^="s"]')];
  const wide = matchMedia('(min-width: 1100px)').matches;
  $('studyToc').innerHTML = heads.length ? `<details${wide ? ' open' : ''}><summary>Cuprins (${heads.length})</summary><div>` + heads.map(h => {
    const t = h.textContent.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
    return `<a href="#${h.id}" data-goto="${h.id}" title="${esc(t)}">${esc(t.length > 58 ? t.slice(0, 56) + '…' : t)}</a>`;
  }).join('') + '</div></details>' : '';
  $('studyFind').value = term || '';
  find(term || '');
  store.set('studiesHash', studyHash(s, state.part));
}

function showCatalog() {
  state.current = null;
  tocObserver?.disconnect();
  $('studyReader').hidden = true;
  $('studyCatalog').hidden = false;
  return renderCatalog();
}

// ---------- Routing and events ----------

// path: what follows "#/studii" in the address.
export async function showStudies(path) {
  hideTip();
  await catalog.load();
  const [b, c, part] = path.split('/').filter(Boolean);
  const s = b && c !== undefined && studies.find(x => x.b === b && x.c === +c);
  if (s) {
    const term = state.query && !catalog.parseRef(state.query) ? state.query : catalog.parseRef(state.query)?.rest || '';
    if (state.current !== s || state.part !== (+part || 1) - 1) await openStudy(s, (+part || 1) - 1, term);
    return;
  }
  const book = b && bookOf(b) ? b : null, changed = book !== state.book;
  if (changed) state.shown = PAGE;
  state.book = book;
  store.set('studiesHash', book ? '#/studii/' + book : '#/studii');
  await showCatalog();
  if (changed) $('studyBooks').querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}

export const focusStudySearch = () => { if (!$('studyCatalog').hidden) $('studyQuery').focus(); };

export function setupStudies(opts) {
  options = { ...options, ...opts };
  const go = options.go;
  let timer = 0;
  $('studySearchForm').addEventListener('submit', e => e.preventDefault());
  $('studyQuery').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = $('studyQuery').value; state.shown = PAGE; selects(); results(); }, 140);
  });
  $('studyTheme').addEventListener('change', () => { state.theme = $('studyTheme').value || null; state.shown = PAGE; selects(); results(); });
  $('studyBook').addEventListener('change', () => go($('studyBook').value ? '#/studii/' + $('studyBook').value : '#/studii'));
  $('studyReset').addEventListener('click', () => {
    Object.assign(state, { theme: null, query: '', shown: PAGE });
    $('studyQuery').value = '';
    if (state.book) go('#/studii'); else renderCatalog();
  });
  $('studyBookFilter').addEventListener('input', sideBooks);
  document.querySelectorAll('[data-study-tab]').forEach(t => t.addEventListener('click', () => {
    state.tab = t.dataset.studyTab;
    document.querySelectorAll('[data-study-tab]').forEach(x => x.classList.toggle('active', x === t));
    sideBooks();
  }));
  $('studyBooks').addEventListener('click', e => {
    const b = e.target.closest('[data-study-book]');
    if (b) go(state.book === b.dataset.studyBook ? '#/studii' : '#/studii/' + b.dataset.studyBook);
  });
  $('studyCatalog').addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { go(studyHash(study(open.dataset.open))); return; }
    const readBook = e.target.closest('[data-read]');
    if (readBook) { go(`#/${readBook.dataset.read}/1`); return; }
    if (e.target.closest('[data-more]')) { state.shown += PAGE; results(); }
  });
  $('studyBack').addEventListener('click', () => go(state.current ? '#/studii/' + state.current.b : '#/studii'));
  $('studyBible').addEventListener('click', () => { const s = state.current; if (s) go(`#/${s.b}/${s.c || 1}`); });
  $('studyPrev').addEventListener('click', () => { const s = state.current; if (s?.n) go(studyHash(studies[s.n - 1])); });
  $('studyNext').addEventListener('click', () => { const s = state.current; if (s && s.n < studies.length - 1) go(studyHash(studies[s.n + 1])); });
  $('studyParts').addEventListener('click', e => {
    const t = e.target.closest('[data-part]');
    if (t && state.current) go(studyHash(state.current, +t.dataset.part));
  });
  $('studyToc').addEventListener('click', e => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.dataset.goto)?.scrollIntoView({ block: 'start' });
    if (!matchMedia('(min-width: 1100px)').matches) a.closest('details')?.removeAttribute('open');
  });
  let findTimer = 0;
  $('studyFind').addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => find($('studyFind').value), 200); });
}
