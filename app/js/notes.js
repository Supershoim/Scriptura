// Reference popup: hover (mouse), focus (keyboard) or tap (touch) on a reference inside a note.
import { $, esc } from './util.js';
import { books, bookIndex, get, key, parseKey } from './data.js';

let anchor = null, closeTimer = 0, current = null, onOpen = () => {}, visible = () => [];

const bookName = id => books[bookIndex.get(id)]?.name || id;

function hide() {
  clearTimeout(closeTimer);
  $('notePopup').hidden = true;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = null;
  current = null;
}

const scheduleClose = () => { clearTimeout(closeTimer); closeTimer = setTimeout(hide, 220); };

function position() {
  const popup = $('notePopup');
  if (!anchor?.isConnected) return hide();
  const rect = anchor.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return hide();
  const width = popup.offsetWidth, height = popup.offsetHeight;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const below = window.innerHeight - rect.bottom - 10, above = rect.top - 10;
  const top = below >= Math.min(height, 240) || below >= above
    ? Math.min(rect.bottom + 8, window.innerHeight - height - 12)
    : Math.max(12, rect.top - height - 8);
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

function renderBody() {
  const { owner, link, shown } = current;
  const display = get(shown);
  let html = '';
  current.first = null;
  for (const target of targetVerses(owner, link)) {
    if (!target.exists) { html += '<p class="ref-empty">Referința apare astfel în text, dar capitolul nu există.</p>'; continue; }
    for (const ownerKey of target.keys) {
      const canon = owner.canonical(ownerKey);
      const own = display.resolve(canon);
      const text = own && display.verse(own);
      if (text && !current.first) current.first = canon;
      const label = parseKey(own || ownerKey).v;
      html += `<p><sup>${esc(label)}</sup>${text ? esc(text) : `<span class="ref-empty">${esc(display.gapNote(canon))}</span>`}</p>`;
    }
  }
  $('noteText').innerHTML = html;
  $('noteOpen').hidden = !current.first;
  $('noteTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.show === shown)));
}

function show(button) {
  clearTimeout(closeTimer);
  if (button === anchor) return;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = button;
  button.setAttribute('aria-expanded', 'true');
  const owner = get(button.dataset.t);
  const group = owner.notes[button.dataset.k][+button.dataset.g];
  const link = group.links[+button.dataset.l];
  current = { owner, link, shown: owner.id };
  $('noteTitle').textContent = link.to.map(([b, c, vs]) => `${bookName(b)} ${c}${vs.length ? ':' + vs.join(', ') : ''}`).join('; ');
  $('noteSource').textContent = `Trimitere ${owner.meta.abbreviation} · ${group.text.slice(link.s, link.e)}`;
  const tabs = visible();
  $('noteTabs').innerHTML = tabs.length > 1
    ? tabs.map(t => `<button type="button" data-show="${t.id}">${esc(t.meta.abbreviation)}</button>`).join('')
    : '';
  renderBody();
  const popup = $('notePopup');
  popup.hidden = false;
  popup.scrollTop = 0;
  position();
}

export function setupNotes(container, options) {
  onOpen = options.onOpen;
  visible = options.visible;
  const popup = $('notePopup');
  const trigger = e => e.target.closest?.('.ref-link');
  container.addEventListener('pointerover', e => { if (e.pointerType !== 'touch' && trigger(e)) show(trigger(e)); });
  container.addEventListener('pointerout', e => { if (trigger(e) && !trigger(e).contains(e.relatedTarget) && !popup.contains(e.relatedTarget)) scheduleClose(); });
  container.addEventListener('focusin', e => { if (trigger(e)) show(trigger(e)); });
  container.addEventListener('focusout', e => { if (trigger(e) && !popup.contains(e.relatedTarget)) scheduleClose(); });
  container.addEventListener('click', e => { if (trigger(e)) { e.preventDefault(); show(trigger(e)); } });
  popup.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  popup.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') scheduleClose(); });
  popup.addEventListener('focusin', () => clearTimeout(closeTimer));
  popup.addEventListener('focusout', e => { if (!popup.contains(e.relatedTarget) && e.relatedTarget !== anchor) scheduleClose(); });
  $('noteTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-show]');
    if (b && current) { current.shown = b.dataset.show; renderBody(); position(); }
  });
  $('noteClose').onclick = () => { const a = anchor; hide(); a?.focus({ preventScroll: true }); };
  $('noteOpen').onclick = () => { const target = current?.first; hide(); if (target) onOpen(target); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !popup.hidden) { const a = anchor; hide(); a?.focus({ preventScroll: true }); } });
  document.addEventListener('click', e => { if (!popup.hidden && !trigger(e) && !popup.contains(e.target)) hide(); });
  window.addEventListener('resize', () => { if (!popup.hidden) position(); });
  window.addEventListener('scroll', () => { if (!popup.hidden) position(); }, { passive: true, capture: true });
}

export const hideNote = hide;
export const repositionNote = () => { if (!$('notePopup').hidden) position(); };
