// The study notes printed with a translation (the NKJV Study Bible): for each verse the notes and the word
// studies, opened from the label after the verse (footnotes.js) in the pop-up; the book introduction and the
// inserts of each chapter on their own pages ("Sumar", "Informații suplimentare"). Files:
// data/translations/<id>/study/<BOOK>.json and <BOOK>.book.json, in English, and <BOOK>.<lang>.json, translated
// (tools/study-notes.mjs, tools/translate-notes.mjs).
// Pictures open in a viewer that fits them to the window; a click there shows them at full size.
import { $, esc } from './util.js';
import { available, fetchJson, embeddedStudies } from './data.js';
import { imageUrl } from './catalog.js';

const files = new Map();   // path -> Promise<{ "c:v": items }>

export const sources = () => available.filter(t => t.study?.length);

function load(meta, b, lang) {
  const path = `data/translations/${meta.id}/study/${b}${lang ? '.' + lang : ''}.json`;
  if (!files.has(path)) {
    const embedded = embeddedStudies()?.files[path];
    files.set(path, embedded != null ? Promise.resolve(JSON.parse(embedded)) : fetchJson(path));
  }
  return files.get(path);
}

// The notes of a book on the reader's rows: { "c:v": [{ meta, items }] }, rows in canonical numbering.
// lang: a translation of the notes ("ro"), or empty for the English printed in the book.
export async function forBook(b, lang = '') {
  const out = {};
  for (const meta of sources().filter(m => lang ? m.studyLanguages?.[lang]?.includes(b) : m.study.includes(b))) {
    const verses = await load(meta, b, lang).catch(() => ({}));
    const map = meta.alignment?.map || {};
    for (const [own, items] of Object.entries(verses)) {
      const canon = (map[`${b} ${own}`] || `${b} ${own}`).split(' ')[1];
      (out[canon] ||= []).push({ meta, items });
    }
  }
  return out;
}

const figures = item => [item, ...(item.figures || []), ...(item.boxes || []).flatMap(x => x.figures || [])].filter(f => f.k === 'figure');
export const pictureCount = items => items.reduce((n, i) => n + figures(i).length, 0);

// "2 note · 1 articol · 1 imagine"
export function summary(items) {
  const n = k => items.filter(i => i.k === k).length, pics = pictureCount(items);
  const part = (count, one, many) => count ? [count === 1 ? `1 ${one}` : `${count} ${many}`] : [];
  return [...part(n('intro'), 'introducere', 'introduceri'), ...part(n('note'), 'notă', 'note'), ...part(n('box'), 'articol', 'articole'), ...part(pics, 'imagine', 'imagini')].join(' · ');
}

function figureHtml(meta, f) {
  const src = imageUrl(`data/translations/${meta.id}/study/${f.src}`);
  const label = f.title || (f.caption || '').replace(/<[^>]+>/g, '') || 'Imagine';
  return `<figure class="sn-fig">
    <button type="button" class="sn-zoom" data-src="${esc(src)}" data-w="${f.w}" data-h="${f.h}" aria-label="Deschide imaginea: ${esc(label)}">
      <img src="${esc(src)}" width="${f.w}" height="${f.h}" alt="${esc(label)}" loading="lazy" decoding="async"></button>
    ${f.caption || f.credit ? `<figcaption>${f.caption || ''}${f.credit ? `<span class="sn-credit">${f.credit}</span>` : ''}</figcaption>` : ''}
  </figure>`;
}

function boxHtml(meta, box) {
  const icon = box.icon ? `<img class="sn-icon" src="${esc(imageUrl(`data/translations/${meta.id}/study/${box.icon}`))}" alt="" width="34" height="34">` : '';
  const label = box.label ? `<span class="sn-label">${esc(box.label)}</span>` : '';
  return `<aside class="sn-box">${icon || box.title || label ? `<div class="sn-box-head">${icon}${label}${box.title ? `<strong>${esc(box.title)}</strong>` : ''}</div>` : ''}${box.html}${(box.figures || []).map(f => figureHtml(meta, f)).join('')}</aside>`;
}

// ---------- The book file: introduction ("Sumar") and the inserts of each chapter ----------

// [{ meta, intro, chapters }] for the sources that have a book file for b.
export async function bookExtras(b) {
  const list = sources().filter(m => m.studyBooks?.includes(b));
  return Promise.all(list.map(async meta => ({ meta, ...await load(meta, b, 'book').catch(() => ({})) })));
}

// The introduction of the book (page "Sumar") or the inserts of chapter c (page "Informații suplimentare").
export function extrasHtml(list, c) {
  return list.map(({ meta, intro, chapters }) => {
    const source = `<p class="sn-about">${esc(meta.description)} · în engleză · ${esc(meta.copyright)}</p>`;
    if (!c) return intro ? `<div class="sn sn-page" lang="${esc(meta.language || 'en')}">${intro.sub ? `<p class="eyebrow">${esc(intro.sub)}</p>` : ''}${intro.html}${(intro.figures || []).map(f => figureHtml(meta, f)).join('')}${source}</div>` : '';
    const items = chapters?.[c] || [];
    return items.length ? `<div class="sn sn-page" lang="${esc(meta.language || 'en')}">${items.map(i => i.k === 'box' ? boxHtml(meta, i) : figureHtml(meta, i)).join('')}${source}</div>` : '';
  }).join('');
}

// The HTML comes from the import (only <p>, <strong>, <em>, checked by the build) and is shown as is. In a
// translation, the Bible words a note comments on are the VDCC text; items not yet translated stay in English.
export function itemsHtml(meta, items, lang = '') {
  const pending = '<span class="sn-pending">netradus încă, în engleză</span>';
  return `<div class="sn" lang="${esc(lang || meta.language || 'en')}">` + items.map(item => {
    if (lang && item.untranslated) return `<div lang="en">${pending}${itemsHtml(meta, [{ ...item, untranslated: false }])}</div>`;
    if (item.k === 'note') return `<div class="sn-note">${item.html}</div>`;
    if (item.k === 'box') return boxHtml(meta, item);
    if (item.k === 'figure') return figureHtml(meta, item);
    // The book introduction: closed, so the notes of the verse stay first in view.
    return `<details class="sn-intro"><summary>${item.sub ? `<span>${esc(item.sub)}</span> ` : ''}${esc(item.title)} · introducerea cărții</summary>
      ${item.html}${(item.figures || []).map(f => figureHtml(meta, f)).join('')}${(item.boxes || []).map(b => boxHtml(meta, b)).join('')}</details>`;
  }).join('') + (lang ? '<p class="sn-about">Traducere de lucru a notelor englezești. Cuvintele și citatele biblice sunt textul VDCC; unde nota discută traducerea engleză, cuvântul KJV apare în paranteză.</p>' : '') + '</div>';
}

// ---------- Picture viewer ----------

function openViewer(button) {
  const dialog = $('imageViewer'), img = $('viewerImage');
  img.src = button.dataset.src;
  img.alt = button.querySelector('img')?.alt || '';
  img.width = +button.dataset.w;
  img.height = +button.dataset.h;
  $('viewerCaption').innerHTML = button.closest('figure')?.querySelector('figcaption')?.innerHTML || esc(img.alt);
  dialog.classList.remove('actual');
  dialog.showModal();
}

export function setupStudyNotes() {
  for (const id of ['noteText', 'columns']) $(id).addEventListener('click', e => {
    const zoom = e.target.closest('.sn-zoom');
    if (zoom) openViewer(zoom);
  });
  const dialog = $('imageViewer');
  // Fitted to the window; a click on the picture shows it at its own size (scrolling), a second click fits it again.
  $('viewerImage').addEventListener('click', () => dialog.classList.toggle('actual'));
  $('viewerClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
}
