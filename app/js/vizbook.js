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
  const PER_ROW = 6, W = 1000, NW = 138, NH = 78, GAP = 18, X0 = 40, LANE = 22;
  // Rows and columns first; the vertical room above a row depends on the arcs drawn over it.
  const at = {}, rows = [];
  d.sections.forEach((sec, si) => {
    for (let c = sec.from, i = 0; c <= sec.to; c++, i++) {
      if (i % PER_ROW === 0) rows.push({ sec: i ? null : si, cs: [] });
      at[c] = { row: rows.length - 1, x: X0 + (i % PER_ROW) * (NW + GAP) };
      rows.at(-1).cs.push(c);
    }
  });
  const labelW = t => t.length * 6.6 + 12, overlaps = (a, z) => a.x1 < z.x2 + 6 && z.x1 < a.x2 + 6;
  // Arcs between chapters of the same row nest in lanes, so their labels never overlap.
  const lanes = rows.map(() => []), links = (d.links || []).map(([a, z, label, text], i) => ({ i, a, z, label, text }));
  // Shorter arcs first; an arc goes above every arc it spans.
  const span = l => Math.abs(at[l.a].x - at[l.z].x);
  for (const l of links.filter(l => at[l.a] && at[l.z] && at[l.a].row === at[l.z].row).sort((p, q) => span(p) - span(q))) {
    const A = at[l.a], Z = at[l.z], lo = Math.min(A.x, Z.x), hi = Math.max(A.x, Z.x);
    const mx = (A.x + Z.x) / 2 + NW / 2, box = { x1: mx - labelW(l.label) / 2, x2: mx + labelW(l.label) / 2 };
    let lane = 1 + Math.max(-1, ...links.filter(o => o.lane != null && at[o.a].row === A.row && Math.min(at[o.a].x, at[o.z].x) >= lo && Math.max(at[o.a].x, at[o.z].x) <= hi).map(o => o.lane));
    while ((lanes[A.row][lane] || []).some(o => overlaps(o, box))) lane++;
    (lanes[A.row][lane] ||= []).push(box);
    l.lane = lane;
  }
  const room = r => lanes[r].length ? 0.75 * (34 + LANE * (lanes[r].length - 1)) + 14 : 0;
  const pos = {};
  let y = 20, svg = '';
  rows.forEach((row, r) => {
    if (row.sec != null) {
      if (r) y += 50;   // room for the labels of the links between the halves
      const sec = d.sections[row.sec];
      svg += `<text class="v-sec" x="${X0}" y="${y + 14}">${esc(sec.t)}</text><text class="v-sub" x="${X0}" y="${y + 32}">${esc(sec.s || '')}</text>`;
      y += 48;
    } else y += 18;
    y += room(r);
    for (const c of row.cs) pos[c] = { x: at[c].x, y };
    y += NH + 46;
  });
  y -= 46 - 30;
  // Bands under chapter nodes (e.g. the Aramaic section), one segment per row.
  for (const band of d.bands || []) {
    const bandRows = new Map();
    for (let c = band.from; c <= band.to; c++) if (pos[c]) { const r = pos[c].y; if (!bandRows.has(r)) bandRows.set(r, []); bandRows.get(r).push(pos[c].x); }
    let first = true;
    for (const [ry, xs] of bandRows) {
      const x1 = Math.min(...xs), x2 = Math.max(...xs) + NW;
      svg += `<rect class="v-band" x="${x1}" y="${ry + NH + 6}" width="${x2 - x1}" height="5" rx="2.5"/>`;
      if (first) svg += `<text class="v-band-t" x="${x1}" y="${ry + NH + 24}">${esc(band.t)}</text>`;
      first = false;
    }
  }
  // Links: arcs above the nodes on the same row, curves between rows; each with its label on it.
  let arcs = '', tags = '';
  const placed = [];
  for (const l of links) {
    const A = pos[l.a], Z = pos[l.z];
    if (!A || !Z) continue;
    let path, lx, ly;
    if (A.y === Z.y) {
      const x1 = A.x + NW / 2, x2 = Z.x + NW / 2, h = 34 + LANE * l.lane;
      path = `M${x1} ${A.y} C${x1} ${A.y - h} ${x2} ${Z.y - h} ${x2} ${Z.y}`;
      [lx, ly] = [(x1 + x2) / 2, A.y - 0.75 * h];
    } else {
      const [U, L] = A.y < Z.y ? [A, Z] : [Z, A];
      const x1 = U.x + NW / 2 + 12, x2 = L.x + NW / 2 - 12;
      path = `M${x1} ${U.y + NH} C${x1} ${U.y + NH + 70} ${x2} ${L.y - 70} ${x2} ${L.y}`;
      // The label sits just under the upper row, above the title of the next half, on the curve itself.
      ly = U.y + NH + 44;
      const y0 = U.y + NH, bz = (t, a, b, c2, d2) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c2 + t ** 3 * d2;
      let bt = 0;
      for (let t = 0; t <= 1; t += 0.01) if (Math.abs(bz(t, y0, y0 + 70, L.y - 70, L.y) - ly) < Math.abs(bz(bt, y0, y0 + 70, L.y - 70, L.y) - ly)) bt = t;
      lx = bz(bt, x1, x1, x2, x2);
      const box = () => ({ x1: lx - labelW(l.label) / 2, x2: lx + labelW(l.label) / 2, y: ly });
      while (placed.some(o => Math.abs(o.y - ly) < 16 && overlaps(o, box()))) ly += 16;
      placed.push(box());
    }
    const keys = `ch-${l.a} ch-${l.z}`;
    arcs += `<g class="v-link" data-e="${keys}" data-link="${l.i}" tabindex="0" role="button" aria-label="${esc(`${l.label}: ${book.name} ${l.a} și ${l.z}`)}"><path class="hitline" d="${path}"/><path class="line" d="${path}"/><title>${esc(l.text || l.label)}</title></g>`;
    tags += `<text class="v-link-t" data-link="${l.i}" data-e="${keys}" x="${lx}" y="${ly + 3.5}" text-anchor="middle">${esc(l.label)}</text>`;
  }
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
  const chList = cs => cs.join(' + ');
  const parts = (d.parts || []).map((p, i) => `<button type="button" class="partcard" data-part="${i}" data-e="${p.chapters.map(c => `ch-${c}`).join(' ')}">` +
    `<span class="partcard-n">${esc(chList(p.chapters))}</span><strong>${esc(p.t)}</strong><span>${esc(p.sum)}</span></button>`).join('');
  const partPanel = p => openPanel({ kicker: `Secțiune cheie · ${book.name} ${chList(p.chapters)}`, title: p.t, keys: p.chapters.map(c => `ch-${c}`).join(' '),
    body: `<p>${esc(p.sum)}</p><div class="panel-actions">` + p.chapters.map(c => `<button type="button" data-action="chapter" data-arg="${c}">${esc(book.name)} ${c}: ${esc(d.chapters[c].t)}</button>`).join('') + '</div>' });
  return {
    html: (d.about ? `<p class="book-about">${esc(d.about)}</p>` : '') +
      (parts ? `<h3 class="vis-h3">Secțiunile cheie</h3><div class="partcards">${parts}</div>` : '') +
      `<p class="coverage"><strong>${done} din ${book.chapters}</strong> capitole au studiu${done < book.chapters ? ` · ${book.chapters - done} în lucru` : ''}</p>` +
      `<div class="visbox"><svg viewBox="0 0 ${W} ${y}" role="img" aria-label="${esc(block.title)}">${svg}${arcs}${nodes}${tags}</svg></div>` +
      `<div class="chcards">${cards}</div>` +
      '<p class="fine-print">Dreptunghi plin: capitol cu studiu · margine punctată: în lucru. Arcele leagă capitolele care se explică reciproc; eticheta spune legătura, clicul deschide explicația.</p>',
    mount(el) {
      el.addEventListener('click', e => {
        const part = e.target.closest('[data-part]');
        if (part) { partPanel(d.parts[+part.dataset.part]); return; }
        const node = e.target.closest('[data-ch]');
        if (node) { chapterPanel(b, +node.dataset.ch, d.chapters[node.dataset.ch]); return; }
        const link = e.target.closest('[data-link]');
        if (link) {
          const [a, z, label, text] = d.links[+link.dataset.link];
          openPanel({ kicker: `Legătură în carte · ${book.name} ${a} și ${z}`, title: label, keys: `ch-${a} ch-${z}`,
            body: `${text ? `<p>${esc(text)}</p>` : ''}<div class="panel-actions">` +
              [a, z].map(c => `<button type="button" data-action="chapter" data-arg="${c}">${esc(book.name)} ${c}: ${esc(d.chapters[c].t)}</button>`).join('') + '</div>' });
        }
      });
      onAction('chapter', c => chapterPanel(b, +c, d.chapters[c]));
      el.addEventListener('mouseover', e => { const n = e.target.closest('.v-ch, .v-link, .v-link-t, .partcard'); if (n && document.getElementById('vizPanel').hidden) select(n.classList.contains('v-ch') ? n.dataset.e.split(' ')[0] : n.dataset.e); });
      el.addEventListener('mouseout', e => { if (e.target.closest('.v-ch, .v-link, .v-link-t, .partcard') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}

// ---------- Timeline ----------

const GAP_YEARS = 40, GAP_KEEP = 12;   // empty stretches longer than 40 years are drawn as if they lasted 12
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const kindOf = e => e.kind || 'book';
const yearLabel = t => t < 0 ? String(-t) : `${t} d.Hr.`;

// Piecewise scale: the gaps between events are compressed. Returns x(year) and the compressed gaps.
function scale(years, from, to, X0, X1) {
  const ys = [...new Set([from, ...years, to])].sort((a, b) => a - b), gaps = [];
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > GAP_YEARS) gaps.push({ a: ys[i - 1] + 8, z: ys[i] - 8 });
  const u = yr => {
    let v = yr;
    for (const g of gaps) {
      if (yr >= g.z) v -= (g.z - g.a) - GAP_KEEP;
      else if (yr > g.a) v -= (yr - g.a) * (1 - GAP_KEEP / (g.z - g.a));
    }
    return v;
  };
  const u0 = u(from), span = u(to) - u0;
  return { x: yr => X0 + (u(yr) - u0) / span * (X1 - X0), gaps, span };
}

function timelineSvg(d, view) {
  const W = 1000, X0 = 40, X1 = 960;
  const events = d.events.map(id => entity(id))
    .filter(e => e && e.year >= view.from && e.year <= view.to && (!view.kinds || view.kinds.includes(kindOf(e))))
    .sort((a, b) => a.year - b.year);
  const { x, gaps, span } = scale(events.flatMap(e => e.end != null ? [e.year, e.end] : [e.year]), view.from, view.to, X0, X1);
  const inGap = t => gaps.some(g => t > g.a && t < g.z);
  const step = span > 300 ? 50 : span > 120 ? 20 : 10;
  let g = '';
  for (const era of d.eras || []) {
    const a = Math.max(view.from, era.from), z = Math.min(view.to, era.to);
    if (z <= a) continue;
    g += `<rect class="v-era" x="${x(a)}" y="14" width="${x(z) - x(a)}" height="24" rx="4"/>` +
      (x(z) - x(a) > era.t.length * 5.6 ? `<text class="v-era-t" x="${(x(a) + x(z)) / 2}" y="30" text-anchor="middle">${esc(era.t)}</text>` : `<title>${esc(era.t)}</title>`);
  }
  const axisY = 64;
  // The axis is broken where a gap is compressed; the break says how many years it hides.
  let last = X0;
  for (const gp of gaps) {
    const a = x(gp.a), z = x(gp.z);
    g += `<line class="v-axis" x1="${last}" y1="${axisY}" x2="${a}" y2="${axisY}"/>` +
      `<path class="v-break" d="M${a} ${axisY + 6}l4 -12M${z - 4} ${axisY + 6}l4 -12"/>` +
      `<text class="v-gap-t" x="${(a + z) / 2}" y="${axisY + 4}" text-anchor="middle">⋯</text>` +
      `<text class="v-gap-n" x="${(a + z) / 2}" y="${axisY + 18}" text-anchor="middle">${Math.round(gp.z - gp.a)} ani</text>`;
    last = z;
  }
  g += `<line class="v-axis" x1="${last}" y1="${axisY}" x2="${X1}" y2="${axisY}"/>`;
  for (let t = Math.ceil(view.from / step) * step; t <= view.to; t += step)
    if (t && !inGap(t)) g += `<line class="v-tick" x1="${x(t)}" y1="${axisY - 4}" x2="${x(t)}" y2="${axisY + 4}"/><text class="v-tick-t" x="${x(t)}" y="${axisY - 8}" text-anchor="middle">${yearLabel(t)}</text>`;
  // Prophecy → fulfilment: thin arcs above the axis, shown when either end is selected.
  let arcs = '';
  for (const e of events) for (const k of e.fulfils || []) {
    const t = events.find(o => o.id === k);
    if (!t) continue;
    const x1 = x(e.year), x2 = x(t.year), h = Math.min(46, 14 + Math.abs(x2 - x1) * 0.2);
    arcs += `<path class="v-pf" data-e="${e.id} ${k}" d="M${x1} ${axisY - 6} C${x1} ${axisY - h} ${x2} ${axisY - h} ${x2} ${axisY - 6}" marker-end="url(#arrow-pf)"/>`;
  }
  // Labels in lanes under the axis so they never overlap.
  const lanes = [];
  let labels = '', marks = '';
  for (const e of events) {
    const cx = x(e.year), w = Math.max(e.name.length * 6.6, 120) + 12, kind = kindOf(e);
    const flip = cx + w > W - 6, left = flip ? cx - w + 8 : cx - 4;   // near the right edge the label opens leftwards
    let lane = lanes.findIndex(right => right < left - 6);
    if (lane < 0) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = left + w;
    const ly = axisY + 40 + lane * 50, cls = `${e.certain ? 'sure' : 'approx'} k-${kind}`, tx = left + 8;
    const keys = [e.id, ...e.fulfils || [], ...events.filter(o => o.fulfils?.includes(e.id)).map(o => o.id), ...e.people || [], ...e.places || []].join(' ');
    if (e.end != null) marks += `<rect class="v-range ${cls}" x="${x(e.year)}" y="${axisY - 3}" width="${Math.max(2, x(e.end) - x(e.year))}" height="6" rx="3"/>`;
    marks += kind === 'fulfilment' ? `<path class="v-dot ${cls}" data-e="${e.id}" d="M${cx} ${axisY - 7}l7 7l-7 7l-7 -7z"/>` : `<circle class="v-dot ${cls}" data-e="${e.id}" cx="${cx}" cy="${axisY}" r="6"/>`;
    const source = e.source.t.length > 46 ? e.source.t.slice(0, 44) + '…' : e.source.t;
    labels += `<g class="v-ev ${cls}" data-ev="${e.id}" data-e="${keys}" tabindex="0" role="button" aria-label="${esc(`${e.name}, ${e.date}`)}">` +
      `<line class="v-lead" x1="${cx}" y1="${axisY + 7}" x2="${cx}" y2="${ly - 12}"/>` +
      `<rect class="v-ev-bg" x="${left}" y="${ly - 13}" width="${w}" height="44" rx="5"/><rect class="v-ev-k" x="${left}" y="${ly - 13}" width="3.5" height="44" rx="1.5"/>` +
      `<text class="v-ev-t" x="${tx}" y="${ly + 2}">${esc(e.name)}</text>` +
      `<text class="v-ev-d" x="${tx}" y="${ly + 16}">${esc(e.date)}</text>` +
      `<text class="v-ev-s" x="${tx}" y="${ly + 27}">${esc(source)}</text></g>`;
  }
  const H = axisY + 40 + lanes.length * 50 + 4;
  const defs = '<defs><marker id="arrow-pf" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1L9 5L1 9z" fill="context-stroke"/></marker></defs>';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronologie">${defs}${g}${arcs}${labels}${marks}</svg>`;
}

// Moves the events that stay from their old place to the new one (FLIP), instead of redrawing abruptly.
function morph(box, html) {
  const old = new Map([...box.querySelectorAll('[data-ev]')].map(n => [n.dataset.ev, n.getBBox()]));
  box.innerHTML = html;
  if (reduced() || !old.size) return;
  for (const n of box.querySelectorAll('[data-ev]')) {
    const was = old.get(n.dataset.ev), now = n.getBBox();
    n.style.transition = 'none';
    if (was) n.style.transform = `translate(${was.x - now.x}px, ${was.y - now.y}px)`;
    else n.style.opacity = '0';
  }
  box.getBoundingClientRect();
  requestAnimationFrame(() => box.querySelectorAll('[data-ev]').forEach(n => { n.style.transition = ''; n.style.transform = ''; n.style.opacity = ''; }));
}

export function timeline(block) {
  const d = block.data, views = d.views?.length ? d.views : [{ t: 'Tot', from: Math.min(...d.events.map(id => entity(id).year)) - 10, to: Math.max(...d.events.map(id => entity(id).end ?? entity(id).year)) + 10 }];
  const kinds = new Set(d.events.map(id => kindOf(entity(id))));
  let current = 0;
  const key = (k, t) => kinds.has(k) ? `<span class="tkey ${k}">${t}</span>` : '';
  return {
    html: `<div class="tl-bar"><div class="seg" role="group" aria-label="Perioada">${views.map((v, i) => `<button type="button" data-view="${i}" aria-pressed="${!i}">${esc(v.t)}</button>`).join('')}</div></div>` +
      `<div class="visbox tl">${timelineSvg(d, views[0])}</div>` +
      `<p class="fine-print legend"><span class="cert sure">dată sigură (izvor antic primar)</span><span class="cert approx">dată aproximativă</span>` +
      key('book', 'evenimentele cărții') + key('prophecy', 'profeție anterioară') + key('fulfilment', 'împlinire ulterioară') + key('major', 'eveniment major') +
      '<span class="hint">Ani î.Hr., dacă nu scrie d.Hr. Perioadele lungi fără evenimente sunt comprimate (⋯). Arcele violet leagă o profeție de împlinirea ei.</span></p>',
    mount(el) {
      el.addEventListener('click', e => {
        const v = e.target.closest('[data-view]');
        if (v) {
          current = +v.dataset.view;
          el.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.view === current)));
          morph(el.querySelector('.visbox'), timelineSvg(d, views[current]));
          return;
        }
        const ev = e.target.closest('[data-ev]');
        if (ev) entityPanel(ev.dataset.ev);
      });
      el.addEventListener('mouseover', e => { const n = e.target.closest('[data-ev]'); if (n && document.getElementById('vizPanel').hidden) select(n.dataset.ev + ' ' + (entity(n.dataset.ev).fulfils || []).join(' ')); });
      el.addEventListener('mouseout', e => { if (e.target.closest('[data-ev]') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}
