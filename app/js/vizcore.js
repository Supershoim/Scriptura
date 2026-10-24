// Shared pieces of the study visuals: the Bible-wide register (people, places, events, images), the detail
// panel that opens for anything clicked, linked highlighting across diagrams, and pan/zoom for SVG diagrams.
//
// Interactive elements carry data-e="<keys>" (space separated). A key is an entity id ("daniel", "babilon"),
// or a local key ("ch-5", "p-a"). Selecting a key highlights every element that has it, in every diagram.
import { $, esc } from './util.js';
import { books, bookIndex } from './data.js';
import { json, imageUrl, study } from './catalog.js';

let atlasPromise = null, atlas = null, go = hash => { location.hash = hash; };
export const setGo = fn => { go = fn; };
export const navigate = hash => go(hash);

export function loadAtlas() {
  atlasPromise ??= json('data/atlas.json').then(a => (atlas = a)).catch(e => { atlasPromise = null; throw e; });
  return atlasPromise;
}
export const getAtlas = () => atlas;
export function entity(id) {
  if (!atlas) return null;
  for (const [type, list] of [['person', atlas.people], ['place', atlas.places], ['event', atlas.events], ['image', atlas.images]])
    if (list[id]) return { id, type, ...list[id] };
  return null;
}
export const entityName = id => entity(id)?.name || entity(id)?.title || id;

// ---------- Small helpers ----------

const bookOf = id => books[bookIndex.get(id)];
// "DAN 5:1-4" -> "Dan 5:1-4" (or the full name).
export function refLabel(ref, full = false) {
  const m = /^([1-3A-Z]{3}) (\d+:\d+(?:-\d+)?)$/.exec(ref);
  if (!m) return ref;
  const b = bookOf(m[1]);
  return `${full ? b.name : b.abbr || b.name} ${m[2].replace('-', '–')}`;
}
// A verse reference that opens the verse pop-up (app/js/notes.js).
export const refButton = (ref, full) => `<button type="button" class="ref-link" data-ref="${esc(ref)}" aria-haspopup="dialog" aria-expanded="false">${esc(refLabel(ref, full))}</button>`;
export const refList = (refs, full) => (refs || []).map(r => refButton(r, full)).join(', ');
export const year = y => y < 0 ? `${-y} î.Hr.` : `${y} d.Hr.`;

// Wraps text into lines of at most `max` characters (for SVG labels).
export function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const w of String(text).split(/\s+/)) {
    if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines;
}
export const svgLines = (lines, x, y, lh, attrs = '') =>
  `<text x="${x}" y="${y}" ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;

// Chips for people and places: clicking one opens it in the panel.
export const chips = ids => (ids || []).filter(entity).map(id =>
  `<button type="button" class="chip chip-${entity(id).type}" data-entity="${esc(id)}" data-e="${esc(id)}">${esc(entityName(id))}</button>`).join('');

// ---------- Panel ----------

let onClose = () => {};
export function openPanel({ kicker = '', title, body, keys = '' }) {
  const panel = $('vizPanel');
  $('vizPanelKicker').textContent = kicker;
  $('vizPanelTitle').textContent = title;
  $('vizPanelBody').innerHTML = body;
  panel.hidden = false;
  panel.scrollTop = 0;
  select(keys);
  document.body.classList.add('panel-open');
}
export function closePanel() {
  $('vizPanel').hidden = true;
  document.body.classList.remove('panel-open');
  select('');
  onClose();
}

const KIND = { person: 'Personaj', prophecy: 'Profeție', fulfilment: 'Împlinire', major: 'Eveniment major', place: 'Loc', event: 'Eveniment', image: 'Mărturie istorică' };
// Where an entry appears: studies ("DAN-5") and books ("DAN").
function seenIn(id) {
  const list = atlas?.seen?.[id] || [];
  return list.map(k => {
    const s = study(k);
    if (s) return `<button type="button" class="chip" data-go="#/studii/${s.b}/${s.c}">${esc(bookOf(s.b).abbr)} ${s.c || 'ansamblu'}</button>`;
    if (bookOf(k)) return `<button type="button" class="chip" data-go="#/studii/${k}">${esc(bookOf(k).name)}</button>`;
    return '';
  }).join('');
}

export function imageFigure(id, big = false) {
  const im = atlas.images[id];
  return `<figure class="hist${big ? ' big' : ''}"><img src="${esc(imageUrl(im.file))}" alt="${esc(im.title)}" loading="lazy">` +
    `<figcaption>${big ? `<span>${esc(im.caption)}</span>` : `<strong>${esc(im.title)}</strong>`}` +
    `<small class="credit">${esc(im.author)} · ${esc(im.license)} · <a href="${esc(im.source)}" target="_blank" rel="noopener">Wikimedia Commons</a></small></figcaption></figure>`;
}

export function entityPanel(id) {
  const e = entity(id);
  if (!e) return;
  let body = '';
  if (e.type === 'image') {
    body = imageFigure(id, true) + `<p class="refs">${refList(e.refs, true)}</p>` + `<div class="chips">${chips([...e.people || [], ...e.places || []])}</div>`;
  } else {
    if (e.image && atlas.images[e.image]) body += imageFigure(e.image, true);
    if (e.aka?.length) body += `<p class="aka">numit și ${e.aka.map(esc).join(', ')}</p>`;
    if (e.type === 'event') body += `<p class="when"><span class="cert ${e.certain ? 'sure' : 'approx'}">${e.certain ? 'dată sigură' : 'dată aproximativă'}</span> ${esc(e.date)}</p>`;
    if (e.note) body += `<p class="hint">${esc(e.note)}</p>`;
    body += `<p>${esc(e.about)}</p>`;
    if (e.type === 'place') body += `<p class="hint">${e.approx ? 'Poziție aproximativă · ' : ''}${e.lat.toFixed(2)}° N, ${e.lon.toFixed(2)}° E</p>`;
    if (e.refs?.length) body += `<h4>Versete</h4><p class="refs">${refList(e.refs, true)}</p>`;
    const other = Object.entries(e.books || {});
    if (other.length) body += `<h4>În alte cărți</h4>` + other.map(([b, refs]) => `<p class="refs"><strong>${esc(bookOf(b).name)}:</strong> ${refList(refs, true)}</p>`).join('');
    if (e.type === 'event') {
      body += `<h4>Sursa datării</h4><p class="source">${e.source.url ? `<a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(e.source.t)}</a>` : esc(e.source.t)}</p>`;
      if (e.people?.length || e.places?.length) body += `<div class="chips">${chips([...e.people || [], ...e.places || []])}</div>`;
      // Prophecies and what they announce, both ways.
      if (e.fulfils?.length) body += `<h4>Se împlinește în</h4><div class="chips">${chips(e.fulfils)}</div>`;
      const by = Object.keys(atlas.events).filter(k => atlas.events[k].fulfils?.includes(id));
      if (by.length) body += `<h4>Anunțat de</h4><div class="chips">${chips(by)}</div>`;
    }
    for (const s of e.sources || []) body += `<p class="source">Sursă: ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.t)}</a>` : esc(s.t)}</p>`;
    const images = Object.entries(atlas.images).filter(([, im]) => im.kind !== 'portrait' && ((im.people || []).includes(id) || (im.places || []).includes(id)));
    if (images.length) body += `<h4>Mărturii istorice</h4><div class="thumbs">${images.map(([k, im]) =>
      `<button type="button" class="thumb" data-entity="${k}"><img src="${esc(imageUrl(im.file))}" alt="${esc(im.title)}" loading="lazy"></button>`).join('')}</div>`;
  }
  const seen = seenIn(id);
  if (seen) body += `<h4>Apare în</h4><div class="chips">${seen}</div>`;
  openPanel({ kicker: (e.type === 'event' && KIND[e.kind]) || (e.kind === 'proroc' ? 'Proroc' : KIND[e.type]), title: e.name || e.title, body, keys: id });
}

// ---------- Selection ----------

export function select(keys) {
  const wanted = new Set(String(keys).split(' ').filter(Boolean));
  for (const root of document.querySelectorAll('.visual')) {
    let any = false;
    root.querySelectorAll('[data-e]').forEach(el => {
      const on = el.dataset.e.split(' ').some(k => wanted.has(k));
      el.classList.toggle('sel', on);
      any ||= on;
    });
    root.querySelectorAll('svg').forEach(svg => svg.classList.toggle('has-sel', !!svg.querySelector('.sel')));
    root.classList.toggle('has-sel', any);
  }
}

// ---------- Pan and zoom ----------

// Makes an SVG inside a .visbox zoomable: buttons, Ctrl+wheel, drag and pinch once zoomed in.
export function zoomable(svg, { max = 8 } = {}) {
  const box = svg.closest('.visbox');
  const base = svg.viewBox.baseVal, home = { x: base.x, y: base.y, w: base.width, h: base.height };
  let view = { ...home }, moved = false;
  const apply = () => {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    const zoomed = view.w < home.w - 0.5;
    svg.style.touchAction = zoomed ? 'none' : '';
    box.classList.toggle('zoomed', zoomed);
  };
  const clamp = () => {
    view.w = Math.min(home.w, Math.max(home.w / max, view.w));
    view.h = view.w * home.h / home.w;
    view.x = Math.min(home.x + home.w - view.w, Math.max(home.x, view.x));
    view.y = Math.min(home.y + home.h - view.h, Math.max(home.y, view.y));
  };
  // Zoom by `factor` keeping the point (fx, fy) (0–1 of the visible area) in place.
  const zoom = (factor, fx = 0.5, fy = 0.5, smooth = false) => {
    const from = { ...view }, w = view.w / factor, h = view.h / factor;
    view = { x: view.x + (view.w - w) * fx, y: view.y + (view.h - h) * fy, w, h };
    clamp();
    if (smooth) glide(from); else apply();
  };
  // The buttons move the view gradually (about a fifth of a second), unless the reader asked for less motion.
  let frame = 0;
  const glide = from => {
    cancelAnimationFrame(frame);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const to = { ...view }, t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / 220), k = 1 - (1 - t) ** 3;
      view = Object.fromEntries(Object.keys(to).map(p => [p, from[p] + (to[p] - from[p]) * k]));
      apply();
      if (t < 1) frame = requestAnimationFrame(tick); else view = to;
    };
    frame = requestAnimationFrame(tick);
  };
  const controls = document.createElement('div');
  controls.className = 'zoomctl';
  controls.innerHTML = '<button type="button" data-z="in" aria-label="Mărește">+</button><button type="button" data-z="out" aria-label="Micșorează">−</button><button type="button" data-z="home" aria-label="Vedere completă">⟲</button>';
  controls.addEventListener('click', e => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') zoom(1.6, 0.5, 0.5, true); else if (z === 'out') zoom(1 / 1.6, 0.5, 0.5, true); else if (z === 'home') { const from = { ...view }; view = { ...home }; glide(from); }
  });
  box.append(controls);
  const frac = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, ...frac(e)); }, { passive: false });
  const pointers = new Map();
  let start = null;
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, e);
    moved = false;
    start = { view: { ...view }, x: e.clientX, y: e.clientY, dist: null };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; start.dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  });
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !start) return;
    pointers.set(e.pointerId, e);
    const r = svg.getBoundingClientRect();
    if (pointers.size === 2 && start.dist) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      view = { ...start.view };
      zoom(d / start.dist, ...frac({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }));
      moved = true;
    } else if (view.w < home.w - 0.5) {
      const dx = (e.clientX - start.x) / r.width * start.view.w, dy = (e.clientY - start.y) / r.height * start.view.h;
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 4) moved = true;
      view = { ...start.view, x: start.view.x - dx, y: start.view.y - dy };
      clamp();
      apply();
    }
  });
  const end = e => { pointers.delete(e.pointerId); if (!pointers.size) start = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  // A drag is not a click.
  svg.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}

// ---------- Events ----------

export function setupPanel() {
  $('vizPanelClose').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('vizPanel').hidden && !document.querySelector('dialog[open]')) closePanel(); });
  $('vizPanel').addEventListener('click', e => {
    const act = e.target.closest('[data-action]');
    if (act) { actions.get(act.dataset.action)?.(act.dataset.arg); return; }
    const ent = e.target.closest('[data-entity]');
    if (ent) { entityPanel(ent.dataset.entity); return; }
    const to = e.target.closest('[data-go]');
    if (to) { closePanel(); navigate(to.dataset.go); }
  });
}
export const setPanelClose = fn => { onClose = fn; };
// Buttons in the panel with data-action="<name>" data-arg="<value>" call the handler the current diagram registered.
const actions = new Map();
export const onAction = (name, fn) => actions.set(name, fn);
