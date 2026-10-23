import { esc } from './util.js';
import { parseKey } from './data.js';
import { highlightRanges } from './search.js';

function highlight(text, start, end, ranges) {
  let html = '', cursor = start;
  for (const [from, to] of ranges) {
    const a = Math.max(start, from), b = Math.min(end, to);
    if (a >= b) continue;
    html += esc(text.slice(cursor, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>';
    cursor = b;
  }
  return html + esc(text.slice(cursor, end));
}

// A printed note group, e.g. "[*Rom. 5.8. 1 Ioan 4.9.]", with each reference as a popup trigger.
function noteGroup(translation, own, group, gi) {
  let html = '', cursor = 0;
  (group.links || []).forEach((link, li) => {
    html += esc(group.text.slice(cursor, link.s)) +
      `<button type="button" class="ref-link" data-t="${translation.id}" data-k="${own}" data-g="${gi}" data-l="${li}" aria-haspopup="dialog" aria-expanded="false">${esc(group.text.slice(link.s, link.e))}</button>`;
    cursor = link.e;
  });
  html += esc(group.text.slice(cursor));
  return `<span class="note" aria-label="Trimiteri">[${html}]</span>`;
}

export function verseHtml(translation, own, search) {
  const text = translation.verse(own) || '';
  const ranges = highlightRanges(text, search?.terms, search?.whole);
  const groups = translation.notes[own];
  if (!groups) return highlight(text, 0, text.length, ranges);
  let html = '', cursor = 0;
  groups.forEach((group, gi) => {
    const at = Math.min(group.at, text.length);
    html += highlight(text, cursor, at, ranges) + noteGroup(translation, own, group, gi);
    cursor = at;
  });
  return html + highlight(text, cursor, text.length, ranges);
}

// One translation's cell on a canonical row.
export function cellHtml(translation, canon, search) {
  const owns = translation.versesAt(canon);
  const head = `<span class="cell-label" aria-hidden="true">${esc(translation.meta.abbreviation)}</span>`;
  if (!owns.length)
    return `<div class="cell" data-t="${translation.id}">${head}<span class="vnum">—</span><div class="vtext missing">${esc(translation.gapNote(canon))}</div></div>`;
  const c = parseKey(canon);
  const parts = owns.map((own, i) => {
    const o = parseKey(own);
    const label = o.c !== c.c ? `${o.c}:${o.v}` : String(o.v);
    const inline = i > 0 ? `<sup class="inline-num">${esc(label)}</sup>` : '';
    return { label, html: inline + verseHtml(translation, own, search) };
  });
  return `<div class="cell" data-t="${translation.id}">${head}<span class="vnum">${esc(parts[0].label)}</span><div class="vtext">${parts.map(p => p.html).join(' ')}</div></div>`;
}
