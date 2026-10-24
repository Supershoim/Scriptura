// Book-level visuals: the map of the book (sections, chapters, how chapters explain each other, coverage and a
// short summary per chapter) and the timeline (green: date fixed by a primary ancient source, orange: approximate).
import { esc } from './util.js';
import { books, bookIndex } from './data.js';
import { forChapter } from './catalog.js';
import { entity, chips, openPanel, svgLines, wrap, select, entityPanel, onAction } from './vizcore.js';

const bookOf = id => books[bookIndex.get(id)];

// ---------- Book map ----------

function chapterPanel(b, c, ch) {
  const s = forChapter(b, c)[0], book = bookOf(b);
  const status = s ? '<span class="status done">studiat</span>' : '<span class="status wip">în lucru</span>';
  openPanel({
    kicker: `${book.name} ${c}`, title: ch.t, keys: `ch-${c}`,
    body: `<p>${status}</p><p>${esc(ch.sum)}</p>` +
      (ch.people?.length || ch.places?.length ? `<h4>Personaje și locuri</h4><div class="chips">${chips([...ch.people || [], ...ch.places || []])}</div>` : '') +
      `<div class="panel-actions">${s ? `<button type="button" class="primary" data-go="#/studii/${b}/${s.c}">Deschide studiul</button>` : ''}` +
      `<button type="button" data-go="#/${b}/${c}">Citește ${esc(book.name)} ${c}</button></div>`
  });
}

export function bookMap(block, { b }) {
  const d = block.data, book = bookOf(b);
  const PER_ROW = 6, W = 1000, NW = 138, NH = 78, GAP = 18, X0 = 40;
  const pos = {};
  let y = 20, svg = '';
  for (const sec of d.sections) {
    svg += `<text class="v-sec" x="${X0}" y="${y + 14}">${esc(sec.t)}</text><text class="v-sub" x="${X0}" y="${y + 32}">${esc(sec.s || '')}</text>`;
    y += 48;
    const list = Array.from({ length: sec.to - sec.from + 1 }, (_, i) => sec.from + i);
    list.forEach((c, i) => {
      if (i && i % PER_ROW === 0) y += NH + GAP + 18;
      pos[c] = { x: X0 + (i % PER_ROW) * (NW + GAP), y };
    });
    y += NH + 46;
  }
  // Bands under chapter nodes (e.g. the Aramaic section), one segment per row.
  for (const band of d.bands || []) {
    const rows = new Map();
    for (let c = band.from; c <= band.to; c++) if (pos[c]) { const r = pos[c].y; if (!rows.has(r)) rows.set(r, []); rows.get(r).push(pos[c].x); }
    let first = true;
    for (const [ry, xs] of rows) {
      const x1 = Math.min(...xs), x2 = Math.max(...xs) + NW;
      svg += `<rect class="v-band" x="${x1}" y="${ry + NH + 6}" width="${x2 - x1}" height="5" rx="2.5"/>`;
      if (first) svg += `<text class="v-band-t" x="${x1}" y="${ry + NH + 24}">${esc(band.t)}</text>`;
      first = false;
    }
  }
  // Links between chapters: arcs above the nodes on the same row, curves between rows.
  let arcs = '';
  (d.links || []).forEach(([a, z, label], i) => {
    const A = pos[a], Z = pos[z];
    if (!A || !Z) return;
    let path;
    if (A.y === Z.y) {
      const x1 = A.x + NW / 2, x2 = Z.x + NW / 2, h = 18 + Math.abs(x2 - x1) * 0.12;
      path = `M${x1} ${A.y} C${x1} ${A.y - h} ${x2} ${Z.y - h} ${x2} ${Z.y}`;
    } else {
      const [U, L] = A.y < Z.y ? [A, Z] : [Z, A];
      const x1 = U.x + NW / 2 + 12, x2 = L.x + NW / 2 - 12;
      path = `M${x1} ${U.y + NH} C${x1} ${U.y + NH + 70} ${x2} ${L.y - 70} ${x2} ${L.y}`;
    }
    arcs += `<g class="v-link" data-e="ch-${a} ch-${z}" data-link="${i}" tabindex="0" role="button" aria-label="${esc(label)}"><path class="hitline" d="${path}"/><path class="line" d="${path}"/><title>${esc(label)}</title></g>`;
  });
  let nodes = '';
  for (let c = 1; c <= book.chapters; c++) {
    const p = pos[c], ch = d.chapters[c];
    if (!p) continue;
    const done = forChapter(b, c).length > 0;
    nodes += `<g class="v-ch ${done ? 'done' : 'wip'}" data-ch="${c}" data-e="ch-${c} ${[...ch.people || [], ...ch.places || []].join(' ')}" tabindex="0" role="button" aria-label="${esc(`${book.name} ${c}: ${ch.t}`)}">` +
      `<rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="10"/>` +
      `<text class="v-num" x="${p.x + 12}" y="${p.y + 26}">${c}</text>` +
      (done ? '' : `<text class="v-wip" x="${p.x + NW - 10}" y="${p.y + 20}" text-anchor="end">în lucru</text>`) +
      svgLines(wrap(ch.t, 19).slice(0, 2), p.x + 12, p.y + 48, 15, 'class="v-ch-t"') + '</g>';
  }
  const done = Array.from({ length: book.chapters }, (_, i) => i + 1).filter(c => forChapter(b, c).length).length;
  const cards = Array.from({ length: book.chapters }, (_, i) => i + 1).map(c => {
    const ch = d.chapters[c], s = forChapter(b, c)[0];
    return `<button type="button" class="chcard ${s ? 'done' : 'wip'}" data-ch="${c}" data-e="ch-${c}">` +
      `<span class="chcard-n">${c}</span><span class="chcard-b"><strong>${esc(ch.t)}</strong>` +
      `<span class="status ${s ? 'done' : 'wip'}">${s ? 'studiat' : 'în lucru'}</span><span class="chcard-s">${esc(ch.sum)}</span></span></button>`;
  }).join('');
  return {
    html: `<p class="coverage"><strong>${done} din ${book.chapters}</strong> capitole au studiu${done < book.chapters ? ` · ${book.chapters - done} în lucru` : ''}</p>` +
      `<div class="visbox"><svg viewBox="0 0 ${W} ${y}" role="img" aria-label="${esc(block.title)}">${arcs}${svg}${nodes}</svg></div>` +
      `<div class="chcards">${cards}</div>`,
    mount(el) {
      el.addEventListener('click', e => {
        const node = e.target.closest('[data-ch]');
        if (node) { chapterPanel(b, +node.dataset.ch, d.chapters[node.dataset.ch]); return; }
        const link = e.target.closest('[data-link]');
        if (link) {
          const [a, z, label] = d.links[+link.dataset.link];
          openPanel({ kicker: 'Legătură în carte', title: label, keys: `ch-${a} ch-${z}`,
            body: `<p>${esc(book.name)} ${a} și ${esc(book.name)} ${z}</p><div class="panel-actions">` +
              [a, z].map(c => `<button type="button" data-action="chapter" data-arg="${c}">${esc(book.name)} ${c}: ${esc(d.chapters[c].t)}</button>`).join('') + '</div>' });
        }
      });
      onAction('chapter', c => chapterPanel(b, +c, d.chapters[c]));
      el.addEventListener('mouseover', e => { const n = e.target.closest('.v-ch, .v-link'); if (n && document.getElementById('vizPanel').hidden) select(n.dataset.e.split(' ')[0] + (n.classList.contains('v-link') ? ' ' + n.dataset.e : '')); });
      el.addEventListener('mouseout', e => { if (e.target.closest('.v-ch, .v-link') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}

// ---------- Timeline ----------

function timelineSvg(d, view) {
  const W = 1000, X0 = 40, X1 = 960, span = view.to - view.from;
  const x = yr => X0 + (yr - view.from) / span * (X1 - X0);
  const step = span > 300 ? 50 : span > 120 ? 20 : 10;
  const events = d.events.map(id => entity(id)).filter(e => e && e.year >= view.from && e.year <= view.to).sort((a, b) => a.year - b.year);
  let g = '';
  // Eras.
  for (const era of d.eras || []) {
    const a = Math.max(view.from, era.from), z = Math.min(view.to, era.to);
    if (z <= a) continue;
    g += `<rect class="v-era" x="${x(a)}" y="14" width="${x(z) - x(a)}" height="24" rx="4"/><text class="v-era-t" x="${(x(a) + x(z)) / 2}" y="30" text-anchor="middle">${esc(era.t)}</text>`;
  }
  const axisY = 64;
  g += `<line class="v-axis" x1="${X0}" y1="${axisY}" x2="${X1}" y2="${axisY}"/>`;
  for (let t = Math.ceil(view.from / step) * step; t <= view.to; t += step)
    g += `<line class="v-tick" x1="${x(t)}" y1="${axisY - 4}" x2="${x(t)}" y2="${axisY + 4}"/><text class="v-tick-t" x="${x(t)}" y="${axisY - 8}" text-anchor="middle">${-t}</text>`;
  // Labels in lanes under the axis so they never overlap.
  const lanes = [];
  let labels = '', marks = '';
  for (const e of events) {
    const cx = x(e.year), w = Math.max(e.name.length * 6.6, 120) + 12;
    const flip = cx + w > W - 6, left = flip ? cx - w + 8 : cx - 4;   // near the right edge the label opens leftwards
    let lane = lanes.findIndex(right => right < left - 6);
    if (lane < 0) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = left + w;
    const ly = axisY + 34 + lane * 50, cls = e.certain ? 'sure' : 'approx', tx = left + 6;
    if (e.end != null) marks += `<rect class="v-range ${cls}" x="${x(e.year)}" y="${axisY - 3}" width="${Math.max(2, x(e.end) - x(e.year))}" height="6" rx="3"/>`;
    marks += `<circle class="v-dot ${cls}" cx="${cx}" cy="${axisY}" r="6"/>`;
    const source = e.source.t.length > 46 ? e.source.t.slice(0, 44) + '…' : e.source.t;
    labels += `<g class="v-ev ${cls}" data-ev="${e.id}" data-e="${e.id} ${(e.people || []).join(' ')} ${(e.places || []).join(' ')}" tabindex="0" role="button" aria-label="${esc(`${e.name}, ${e.date}`)}">` +
      `<line class="v-lead" x1="${cx}" y1="${axisY + 7}" x2="${cx}" y2="${ly - 12}"/>` +
      `<rect class="v-ev-bg" x="${left}" y="${ly - 13}" width="${w}" height="44" rx="5"/>` +
      `<text class="v-ev-t" x="${tx}" y="${ly + 2}">${esc(e.name)}</text>` +
      `<text class="v-ev-d" x="${tx}" y="${ly + 16}">${esc(e.date)}</text>` +
      `<text class="v-ev-s" x="${tx}" y="${ly + 27}">${esc(source)}</text></g>`;
  }
  const H = axisY + 34 + lanes.length * 50 + 10;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronologie">${g}${labels}${marks}</svg>`;
}

export function timeline(block) {
  const d = block.data, views = d.views?.length ? d.views : [{ t: 'Tot', from: Math.min(...d.events.map(id => entity(id).year)) - 10, to: Math.max(...d.events.map(id => entity(id).end ?? entity(id).year)) + 10 }];
  let current = 0;
  return {
    html: `<div class="tl-bar"><div class="seg" role="group" aria-label="Perioada">${views.map((v, i) => `<button type="button" data-view="${i}" aria-pressed="${!i}">${esc(v.t)}</button>`).join('')}</div>` +
      `<span class="legend"><span class="cert sure">dată sigură (izvor antic primar)</span><span class="cert approx">dată aproximativă</span><span class="hint">ani î.Hr.</span></span></div>` +
      `<div class="visbox tl">${timelineSvg(d, views[0])}</div>`,
    mount(el) {
      el.addEventListener('click', e => {
        const v = e.target.closest('[data-view]');
        if (v) {
          current = +v.dataset.view;
          el.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.view === current)));
          el.querySelector('.visbox').innerHTML = timelineSvg(d, views[current]);
          return;
        }
        const ev = e.target.closest('[data-ev]');
        if (ev) entityPanel(ev.dataset.ev);
      });
    }
  };
}
