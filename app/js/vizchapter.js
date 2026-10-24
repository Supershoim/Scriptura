// Chapter-level visuals: the chapter map (the main idea in the centre, the sections of the chapter around it,
// and how they connect to other chapters of the book and to the rest of the Bible), the network of people and
// places (with the other books where they appear) and the gallery of historical witnesses.
import { esc } from './util.js';
import { books, bookIndex } from './data.js';
import { forChapter } from './catalog.js';
import { entity, entityName, openPanel, refList, refButton, refLabel, svgLines, wrap, select, zoomable, entityPanel, imageFigure, chips } from './vizcore.js';

const bookOf = id => books[bookIndex.get(id)];
const firstVerse = ref => { const m = /^([1-3A-Z]{3}) (\d+):(\d+)/.exec(ref); return m ? `#/${m[1]}/${m[2]}/${m[3]}` : null; };

// ---------- Chapter map ----------

export function chapterMap(block, { s, b }) {
  const d = block.data, book = bookOf(b);
  const parts = d.parts, n = parts.length, side = Math.max((d.book || []).length, (d.bible || []).length);
  const W = 1000, H = Math.max(470, side * 74 + 90), cx = W / 2, cy = H / 2 + 6;
  const IW = 230, IH = 92, PW = 168, PH = 60, rx = 215, ry = Math.min(170, H / 2 - 50);
  const P = {};
  parts.forEach((p, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    P[p.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  let lines = '', nodes = '', labels = '';
  // Idea → each part.
  for (const p of parts) lines += `<line class="v-spoke" data-e="p-${p.id} idea" x1="${cx}" y1="${cy}" x2="${P[p.id].x}" y2="${P[p.id].y}"/>`;
  // Flow between parts, curved outward.
  for (const [a, z, label] of d.flow || []) {
    const A = P[a], Z = P[z], mx = (A.x + Z.x) / 2, my = (A.y + Z.y) / 2;
    const ox = mx - cx, oy = my - cy, len = Math.hypot(ox, oy) || 1, k = 46;
    const qx = mx + ox / len * k, qy = my + oy / len * k;
    lines += `<path class="v-flow" data-e="p-${a} p-${z}" d="M${A.x} ${A.y} Q${qx} ${qy} ${Z.x} ${Z.y}" marker-end="url(#arrow-flow)"/>`;
    if (label) labels += `<text class="v-flow-t" data-e="p-${a} p-${z}" x="${(A.x + 2 * qx + Z.x) / 4}" y="${(A.y + 2 * qy + Z.y) / 4 + 4}" text-anchor="middle">${esc(label)}</text>`;
  }
  // Outer columns: the book (left) and the Bible (right), each card tied to the part it comes from.
  const column = (list, x, kind) => list.map((item, i) => {
    const y = 66 + i * 74 + (H - 90 - list.length * 74) / 2, from = P[item.from];
    const ex = kind === 'book' ? x + 190 : x, mid = (ex + from.x) / 2;
    lines += `<path class="v-out ${kind}" data-e="p-${item.from} ${kind}-${i}" d="M${ex} ${y + 28} C${mid} ${y + 28} ${mid} ${from.y} ${from.x + (kind === 'book' ? -PW / 2 : PW / 2)} ${from.y}"/>`;
    const head = kind === 'book' ? `${book.abbr} ${item.ch}` : item.t;
    return `<g class="v-card ${kind}" data-out="${kind}:${i}" data-e="${kind}-${i} p-${item.from}" tabindex="0" role="button" aria-label="${esc(head)}">` +
      `<rect x="${x}" y="${y}" width="190" height="56" rx="8"/>` +
      `<text class="v-card-h" x="${x + 12}" y="${y + 20}">${esc(head)}</text>` +
      svgLines(wrap(kind === 'book' ? item.t : item.why, 28).slice(0, 2), x + 12, y + 36, 13, 'class="v-card-t"') + '</g>';
  }).join('');
  nodes += column(d.book || [], 18, 'book') + column(d.bible || [], W - 208, 'bible');
  for (const p of parts) {
    const { x, y } = P[p.id];
    nodes += `<g class="v-part" data-part="${p.id}" data-e="p-${p.id}" tabindex="0" role="button" aria-label="${esc(p.t)}">` +
      `<rect x="${x - PW / 2}" y="${y - PH / 2}" width="${PW}" height="${PH}" rx="9"/>` +
      `<text class="v-part-r" x="${x}" y="${y - 12}" text-anchor="middle">${esc(p.refs.map(r => r.replace(/^[1-3A-Z]{3} /, '')).join(', ').replace('-', '–'))}</text>` +
      svgLines(wrap(p.t, 22).slice(0, 2), x, y + 6, 14, 'class="v-part-t" text-anchor="middle"') + '</g>';
  }
  const ideaLines = wrap(d.idea.t, 26).slice(0, 3);
  nodes += `<g class="v-idea" data-idea="1" data-e="idea" tabindex="0" role="button" aria-label="${esc(d.idea.t)}">` +
    `<rect x="${cx - IW / 2}" y="${cy - IH / 2}" width="${IW}" height="${IH}" rx="14"/>` +
    `<text class="v-idea-k" x="${cx}" y="${cy - IH / 2 + 20}" text-anchor="middle">IDEEA PRINCIPALĂ</text>` +
    svgLines(ideaLines, cx, cy - (ideaLines.length - 1) * 8 + 8, 17, 'class="v-idea-t" text-anchor="middle"') + '</g>';
  const heads = `<text class="v-col-h" x="18" y="40">În cartea ${esc(book.name)}</text><text class="v-col-h" x="${W - 18}" y="40" text-anchor="end">În restul Bibliei</text>`;
  const defs = '<defs><marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.6"/></marker></defs>';
  return {
    html: `<p class="legend"><span class="key idea">ideea principală</span><span class="key part">secțiunile capitolului</span><span class="key book">legături în carte</span><span class="key bible">legături în Biblie</span></p>` +
      `<div class="visbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(block.title)}">${defs}${heads}${lines}${labels}${nodes}</svg></div>`,
    mount(el) {
      zoomable(el.querySelector('svg'));
      el.addEventListener('click', e => {
        if (e.target.closest('[data-idea]')) {
          openPanel({ kicker: 'Ideea principală', title: d.idea.t, keys: 'idea ' + parts.map(p => 'p-' + p.id).join(' '), body: `<p>${esc(d.idea.text)}</p><p class="refs">${refList(d.idea.refs, true)}</p>` });
          return;
        }
        const part = e.target.closest('[data-part]');
        if (part) {
          const p = parts.find(x => x.id === part.dataset.part);
          const outs = [...(d.book || []).map((x, i) => ['book', i, x]), ...(d.bible || []).map((x, i) => ['bible', i, x])].filter(([, , x]) => x.from === p.id);
          openPanel({
            kicker: `${book.name} ${p.refs.map(r => r.replace(/^[1-3A-Z]{3} /, '')).join(', ')}`, title: p.t,
            keys: `p-${p.id} ` + outs.map(([k, i]) => `${k}-${i}`).join(' '),
            body: `<p>${esc(p.text)}</p><p class="refs">${refList(p.refs, true)}</p>` +
              (outs.length ? `<h4>Legături</h4><ul class="links">${outs.map(([k, , x]) => `<li>${k === 'book' ? `${esc(book.name)} ${x.ch}` : refButton(x.ref, true)} · ${esc(x.why)}</li>`).join('')}</ul>` : '') +
              `<div class="panel-actions"><button type="button" data-go="${firstVerse(p.refs[0])}">Citește în Biblie</button></div>`
          });
          return;
        }
        const out = e.target.closest('[data-out]');
        if (out) {
          const [kind, i] = out.dataset.out.split(':'), x = (kind === 'book' ? d.book : d.bible)[+i];
          if (kind === 'book') {
            const target = forChapter(b, x.ch)[0];
            openPanel({ kicker: `Legătură în carte · ${book.name} ${x.ch}`, title: x.t, keys: `book-${i} p-${x.from}`,
              body: `<p>${esc(x.why)}</p>${x.refs?.length ? `<p class="refs">${refList(x.refs, true)}</p>` : ''}<div class="panel-actions">` +
                (target ? `<button type="button" class="primary" data-go="#/studii/${b}/${target.c}">Deschide studiul (cap. ${x.ch})</button>` : '') +
                `<button type="button" data-go="#/${b}/${x.ch}">Citește ${esc(book.name)} ${x.ch}</button></div>` });
          } else {
            openPanel({ kicker: 'Legătură în Biblie', title: refLabel(x.ref, true), keys: `bible-${i} p-${x.from}`,
              body: `<p>${esc(x.why)}</p><p class="refs">${refButton(x.ref, true)}</p><div class="panel-actions"><button type="button" data-go="${firstVerse(x.ref)}">Deschide în Biblie</button></div>` });
          }
        }
      });
      el.addEventListener('mouseover', e => { const n = e.target.closest('[data-e]'); if (n && document.getElementById('vizPanel').hidden) select(n.dataset.e); });
      el.addEventListener('mouseout', e => { if (e.target.closest('[data-e]') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}

// ---------- Network of people and places ----------

// Deterministic force layout (same picture every time).
function layout(ids, links, W, H) {
  const n = ids.length, pos = new Map(), k = Math.sqrt(W * H / Math.max(n, 1)) * 0.62;
  ids.forEach((id, i) => { const a = 2 * Math.PI * i / n; pos.set(id, { x: W / 2 + W * 0.33 * Math.cos(a), y: H / 2 + H * 0.33 * Math.sin(a) }); });
  for (let it = 0, t = W / 8; it < 420; it++, t *= 0.988) {
    const disp = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = pos.get(ids[i]), b = pos.get(ids[j]);
      let dx = a.x - b.x, dy = a.y - b.y, dist = Math.hypot(dx, dy) || 0.01;
      const f = k * k / dist;
      dx /= dist; dy /= dist;
      disp.get(ids[i]).x += dx * f; disp.get(ids[i]).y += dy * f;
      disp.get(ids[j]).x -= dx * f; disp.get(ids[j]).y -= dy * f;
    }
    for (const [a, z] of links) {
      const A = pos.get(a), Z = pos.get(z);
      if (!A || !Z) continue;
      let dx = A.x - Z.x, dy = A.y - Z.y, dist = Math.hypot(dx, dy) || 0.01;
      const f = dist * dist / k;
      dx /= dist; dy /= dist;
      disp.get(a).x -= dx * f; disp.get(a).y -= dy * f;
      disp.get(z).x += dx * f; disp.get(z).y += dy * f;
    }
    for (const id of ids) {
      const p = pos.get(id), v = disp.get(id);
      v.x += (W / 2 - p.x) * 0.9; v.y += (H / 2 - p.y) * 1.4;   // gravity keeps loose groups near the centre
      const len = Math.hypot(v.x, v.y) || 0.01;
      p.x = Math.min(W - 90, Math.max(90, p.x + v.x / len * Math.min(len, t)));
      p.y = Math.min(H - 50, Math.max(40, p.y + v.y / len * Math.min(len, t)));
    }
  }
  // Keep labels apart: nodes closer than 120 × 60 are pushed away from each other.
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = pos.get(ids[i]), b = pos.get(ids[j]), dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 120 && Math.abs(dy) < 60) {
        const push = Math.abs(dx) / 120 > Math.abs(dy) / 60 ? [(dx < 0 ? -1 : 1) * (120 - Math.abs(dx)) / 2, 0] : [0, (dy < 0 ? -1 : 1) * (60 - Math.abs(dy)) / 2];
        a.x -= push[0]; a.y -= push[1]; b.x += push[0]; b.y += push[1];
        moved = true;
      }
    }
    for (const p of pos.values()) { p.x = Math.min(W - 90, Math.max(90, p.x)); p.y = Math.min(H - 50, Math.max(40, p.y)); }
    if (!moved) break;
  }
  return pos;
}

export function network(block) {
  const d = block.data, ids = d.nodes.filter(entity), links = d.links || [];
  const W = 1000, H = Math.max(380, Math.min(620, 160 + ids.length * 26));
  const pos = layout(ids, links, W, H);
  const degree = id => links.filter(l => l[0] === id || l[1] === id).length;
  let edges = '', nodes = '';
  links.forEach(([a, z, label], i) => {
    const A = pos.get(a), Z = pos.get(z);
    if (!A || !Z) return;
    edges += `<g class="v-edge" data-edge="${i}" data-e="${a} ${z}"><line class="hitline" x1="${A.x}" y1="${A.y}" x2="${Z.x}" y2="${Z.y}"/><line class="line" x1="${A.x}" y1="${A.y}" x2="${Z.x}" y2="${Z.y}"/>` +
      `<text class="v-edge-t" x="${(A.x + Z.x) / 2}" y="${(A.y + Z.y) / 2 - 5}" text-anchor="middle">${esc(label)}</text><title>${esc(label)}</title></g>`;
  });
  for (const id of ids) {
    const e = entity(id), { x, y } = pos.get(id), r = 13 + Math.min(degree(id), 6) * 2;
    const shape = e.type === 'place'
      ? `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="6"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}"/>`;
    const other = Object.keys(e.books || {});
    const badges = other.slice(0, 3).map((bk, i) => `<g class="v-other" data-other="${id}:${bk}"><rect x="${x + r + 4}" y="${y - r + i * 15}" width="${bookOf(bk).abbr.length * 6 + 10}" height="13" rx="6.5"/><text x="${x + r + 9}" y="${y - r + i * 15 + 10}">${esc(bookOf(bk).abbr)}</text></g>`).join('');
    nodes += `<g class="v-node ${e.type} k-${(e.kind || '').replace(/[^a-zăâîșț]/gi, '')}" data-node="${id}" data-e="${id}" tabindex="0" role="button" aria-label="${esc(entityName(id))}">` +
      shape + `<text class="v-node-t" x="${x}" y="${y + r + 15}" text-anchor="middle">${esc(entityName(id))}</text>` + badges + '</g>';
  }
  const people = ids.filter(id => entity(id).type === 'person').length;
  return {
    html: `<div class="net-bar"><div class="seg" role="group" aria-label="Arată"><button type="button" data-show="all" aria-pressed="true">Toate (${ids.length})</button>` +
      `<button type="button" data-show="person" aria-pressed="false">Personaje (${people})</button><button type="button" data-show="place" aria-pressed="false">Locuri (${ids.length - people})</button></div>` +
      `<span class="legend"><span class="key person">personaj</span><span class="key angel">înger</span><span class="key divine">Dumnezeu</span><span class="key place">loc</span><span class="key other">în alte cărți</span></span></div>` +
      `<div class="visbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(block.title)}">${edges}${nodes}</svg></div>`,
    mount(el) {
      const svg = el.querySelector('svg');
      zoomable(svg);
      el.addEventListener('click', e => {
        const show = e.target.closest('[data-show]');
        if (show) {
          el.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', String(b === show)));
          svg.dataset.show = show.dataset.show;
          return;
        }
        const other = e.target.closest('[data-other]');
        if (other) {
          const [id, bk] = other.dataset.other.split(':');
          openPanel({ kicker: `${entityName(id)} în ${bookOf(bk).name}`, title: bookOf(bk).name, keys: id,
            body: `<p class="refs">${refList(entity(id).books[bk], true)}</p><div class="chips">${chips([id])}</div>` });
          return;
        }
        const node = e.target.closest('[data-node]');
        if (node) { entityPanel(node.dataset.node); return; }
        const edge = e.target.closest('[data-edge]');
        if (edge) {
          const [a, z, label, ref] = links[+edge.dataset.edge];
          openPanel({ kicker: 'Legătură', title: label, keys: `${a} ${z}`,
            body: `<div class="chips">${chips([a, z])}</div>${ref ? `<p class="refs">${refButton(ref, true)}</p>` : '<p class="hint">Legătură din izvoare istorice, nu din text.</p>'}` });
        }
      });
      el.addEventListener('mouseover', e => { const n = e.target.closest('[data-node], [data-edge]'); if (n && document.getElementById('vizPanel').hidden) select(n.dataset.e); });
      el.addEventListener('mouseout', e => { if (e.target.closest('[data-node], [data-edge]') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}

// ---------- Historical witnesses ----------

export function history(block) {
  return {
    html: `<div class="gallery">${block.data.items.map(id => `<div class="gallery-item" data-image="${id}" data-e="${id}" tabindex="0" role="button" aria-label="${esc(entityName(id))}">${imageFigure(id)}</div>`).join('')}</div>`,
    mount(el) {
      el.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        const it = e.target.closest('[data-image]');
        if (it) entityPanel(it.dataset.image);
      });
    }
  };
}
