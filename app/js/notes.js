// Reference popup: hover (mouse), focus (keyboard) or tap (touch) on a reference inside a printed note
// (data-t/k/g/l) or inside a study (data-ref="ROM 2:13-16", in canonical numbering).
import { $, esc } from './util.js';
import { books, bookIndex, get, key, parseKey } from './data.js';

let anchor = null, closeTimer = 0, current = null, lastShown = null, onOpen = () => {}, visible = () => [];

const bookName = id => books[bookIndex.get(id)]?.name || id;

function hide() {
  clearTimeout(closeTimer);
  $('notePopup').hidden = true;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = null;
  current = null;
}

const scheduleClose = () => { clearTimeout(closeTimer); closeTimer = setTimeout(hide, 220); };

// A wide pop-up (study notes with pictures) on a narrow screen is a sheet along the bottom edge.
const SHEET = 700;

function position() {
  const popup = $('notePopup');
  if (!anchor?.isConnected) return hide();
  if (popup.classList.contains('wide') && window.innerWidth < SHEET) {
    popup.dataset.side = 'below';
    popup.style.left = '0px';
    popup.style.top = (window.innerHeight - popup.offsetHeight) + 'px';
    return;
  }
  const rect = anchor.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return hide();
  const width = popup.offsetWidth, height = popup.offsetHeight;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const below = window.innerHeight - rect.bottom - 10, above = rect.top - 10;
  const top = below >= Math.min(height, 240) || below >= above
    ? Math.min(rect.bottom + 8, window.innerHeight - height - 12)
    : Math.max(12, rect.top - height - 8);
  popup.dataset.side = top < rect.top ? 'above' : 'below';   // the opening animation moves away from the anchor
  popup.style.left = left + 'px';
  popup.style.top = Math.max(12, top) + 'px';
}

// Verses referenced by a link, in the numbering of the translation that printed the note.
function targetVerses(owner, link) {
  return link.to.map(([b, c, vs]) => {
    const exists = c >= 1 && c <= (books[bookIndex.get(b)]?.chapters || 0);
    const numbers = vs.length ? vs : owner.ownVersesInChapter(b, c);
    return { b, c, vs, exists, keys: exists ? numbers.map(v => key(b, c, v)) : [] };
  });
}

// A study reference: "ROM 2:13-16" -> canonical verse keys (at most 30, as long passages are only quoted).
const MAX_VERSES = 30;
function studyTargets(ref) {
  const m = ref.match(/^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$/);
  const [b, c, from] = [m[1], +m[2], +m[3]], to = Math.max(from, +m[4] || from);
  const exists = c >= 1 && c <= (books[bookIndex.get(b)]?.chapters || 0);
  const numbers = [];
  for (let v = from; v <= Math.min(to, from + MAX_VERSES - 1); v++) if (visible().some(t => t.versesAt(key(b, c, v)).length || t.coveredBy.has(key(b, c, v)))) numbers.push(v);
  return { targets: [{ b, c, exists, keys: numbers.map(v => key(b, c, v)) }], truncated: to - from + 1 > MAX_VERSES, title: `${bookName(b)} ${c}:${from}${to > from ? '–' + to : ''}` };
}

function renderBody() {
  const { targets, canonical, shown } = current;
  const display = get(shown);
  let html = '';
  current.first = null;
  for (const target of targets) {
    if (!target.exists) { html += '<p class="ref-empty">Referința apare astfel în text, dar capitolul nu există.</p>'; continue; }
    if (!target.keys.length) html += '<p class="ref-empty">Versetul nu există în traducerile afișate.</p>';
    for (const ownerKey of target.keys) {
      const canon = canonical(ownerKey);
      const own = display.resolve(canon);
      const text = own && display.verse(own);
      if (text && !current.first) current.first = canon;
      const label = parseKey(own || ownerKey).v;
      html += `<p><sup>${esc(label)}</sup>${text ? esc(text) : `<span class="ref-empty">${esc(display.gapNote(canon))}</span>`}</p>`;
    }
  }
  if (current.truncated) html += `<p class="ref-empty">Pasaj lung: sunt afișate primele ${MAX_VERSES} de versete.</p>`;
  $('noteText').innerHTML = html;
  $('noteOpen').hidden = !current.first;
  $('noteTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.show === shown)));
}

// Any other content in the same pop-up (the footnotes under a verse): { title, source, html, wide }. A second
// click on the same button closes it. Wide: a larger pop-up, as tall as the window allows (study notes).
export function showInfo(button, { title, source, html, wide = false }) {
  clearTimeout(closeTimer);
  if (button === anchor) { hide(); return; }
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = button;
  button.setAttribute('aria-expanded', 'true');
  current = null;
  $('noteTitle').textContent = title;
  $('noteSource').textContent = source;
  $('noteTabs').innerHTML = '';
  $('noteText').innerHTML = html;
  $('noteOpen').hidden = true;
  const popup = $('notePopup');
  popup.classList.toggle('wide', wide);
  popup.hidden = false;
  popup.scrollTop = 0;
  position();
}

function show(button) {
  clearTimeout(closeTimer);
  if (button === anchor) return;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = button;
  button.setAttribute('aria-expanded', 'true');
  const tabs = visible();
  if (button.dataset.ref) {
    const { targets, truncated, title } = studyTargets(button.dataset.ref);
    const shown = tabs.some(t => t.id === lastShown) ? lastShown : tabs[0].id;
    current = { targets, truncated, canonical: k => k, shown };
    $('noteTitle').textContent = title;
    $('noteSource').textContent = 'Trimitere din studiu · ' + button.textContent;
  } else {
    const owner = get(button.dataset.t);
    const group = owner.notes[button.dataset.k][+button.dataset.g];
    const link = group.links[+button.dataset.l];
    current = { targets: targetVerses(owner, link), canonical: k => owner.canonical(k), shown: owner.id };
    $('noteTitle').textContent = link.to.map(([b, c, vs]) => `${bookName(b)} ${c}${vs.length ? ':' + vs.join(', ') : ''}`).join('; ');
    $('noteSource').textContent = `Trimitere ${owner.meta.abbreviation} · ${group.text.slice(link.s, link.e)}`;
  }
  $('noteTabs').innerHTML = tabs.length > 1
    ? tabs.map(t => `<button type="button" data-show="${t.id}">${esc(t.meta.abbreviation)}</button>`).join('')
    : '';
  renderBody();
  const popup = $('notePopup');
  popup.classList.remove('wide');
  popup.hidden = false;
  popup.scrollTop = 0;
  position();
}

export function setupNotes(containers, options) {
  onOpen = options.onOpen;
  visible = options.visible;
  const popup = $('notePopup');
  const trigger = e => e.target.closest?.('.ref-link');
  for (const container of containers) {
    container.addEventListener('pointerover', e => { if (e.pointerType !== 'touch' && trigger(e)) show(trigger(e)); });
    container.addEventListener('pointerout', e => { if (trigger(e) && !trigger(e).contains(e.relatedTarget) && !popup.contains(e.relatedTarget)) scheduleClose(); });
    container.addEventListener('focusin', e => { if (trigger(e)) show(trigger(e)); });
    container.addEventListener('focusout', e => { if (trigger(e) && !popup.contains(e.relatedTarget)) scheduleClose(); });
    container.addEventListener('click', e => { if (trigger(e)) { e.preventDefault(); show(trigger(e)); } });
  }
  popup.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  popup.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') scheduleClose(); });
  popup.addEventListener('focusin', () => clearTimeout(closeTimer));
  popup.addEventListener('focusout', e => { if (!popup.contains(e.relatedTarget) && e.relatedTarget !== anchor) scheduleClose(); });
  $('noteTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-show]');
    if (b && current) { current.shown = lastShown = b.dataset.show; renderBody(); position(); }
  });
  $('noteClose').onclick = () => { const a = anchor; hide(); a?.focus({ preventScroll: true }); };
  $('noteOpen').onclick = () => { const target = current?.first; hide(); if (target) onOpen(target); };
  const viewing = () => document.querySelector('dialog[open]');   // Escape and clicks there belong to the dialog (the picture viewer)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !popup.hidden && !viewing()) { const a = anchor; hide(); a?.focus({ preventScroll: true }); } });
  document.addEventListener('click', e => { if (!popup.hidden && !viewing() && !e.target.closest?.('.ref-link, .fn, dialog') && !popup.contains(e.target)) hide(); });
  window.addEventListener('resize', () => { if (!popup.hidden) position(); });
  // Content that grows after opening (an introduction expanded, pictures loaded) moves the pop-up back into the window.
  const refit = () => { if (!popup.hidden) position(); };
  new ResizeObserver(refit).observe(popup);
  popup.addEventListener('toggle', refit, true);
  popup.addEventListener('load', refit, true);
  window.addEventListener('scroll', () => { if (!popup.hidden) position(); }, { passive: true, capture: true });
}

export const hideNote = hide;
export const repositionNote = () => { if (!$('notePopup').hidden) position(); };
