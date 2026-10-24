// A study's visual ("Vizual" tab): a list of blocks drawn as SVG, one renderer per block type.
//   chapters: one column per chapter of the book: study length, questions, main character, sections of the book
//   flow:     the thread of the book: a top box, stages with episodes, an end box
//   causal:   events in columns with cause → effect links; clicking one highlights its chain
//   journeys: routes on a map, a timeline, the thread of each journey and the letters written on the way
// Ported from Biblioteca Studiu Biblic. Elements with data-open="<study id>" open that study.
// The other block types live in vizbook.js, vizchapter.js and vizmap.js; this module dispatches all of them.
import { esc } from './util.js';
import { studies, bookOf, json } from './catalog.js';
import { loadAtlas, getAtlas, openPanel } from './vizcore.js';
import { bookMap, timeline } from './vizbook.js';
import { chapterMap, network, history } from './vizchapter.js';
import { map, smoothPath, loadLand } from './vizmap.js';

const fmt = n => n.toLocaleString('ro-RO');
let view = null;   // { study, spec, root, causal, journey, land }

const studyAt = (b, c) => studies.find(s => s.b === b && s.c === c);
const abbr = () => bookOf(view.study.b).abbr;
const openAttr = (b, c) => { const s = studyAt(b, c); return s ? `data-open="${s.id}" tabindex="0" role="button"` : ''; };

// ---------- chapters ----------

function chapterStats(b, n) {
  return Array.from({ length: n }, (_, i) => {
    const c = i + 1, s = studyAt(b, c);
    return { c, s, words: s ? s.parts[0].words : 0, q: s ? s.parts.reduce((a, p) => a + (p.questions || 0), 0) : 0 };
  });
}

function chaptersSvg(D, b) {
  const book = bookOf(b), n = book.chapters, X0 = 40, W = 600, cw = W / n, st = chapterStats(b, n);
  const x = c => X0 + (c - 1) * cw, cx = c => x(c) + cw / 2, maxW = Math.max(...st.map(d => d.words), 1);
  const done = st.filter(d => d.s).length, words = st.reduce((a, d) => a + d.words, 0), qs = st.reduce((a, d) => a + d.q, 0);
  const verses = (D.verses || []).reduce((a, v) => a + v, 0);
  let g = `<text class="vs" x="40" y="22">Studiat: ${done} din ${n} capitole${verses ? ` · ${fmt(verses)} versete` : ''} · ${fmt(Math.round(words / 100) * 100)} de cuvinte de studiu · ${qs} întrebări punctuale</text>`;
  (D.blocks || []).forEach((k, i) => {
    const x1 = x(k.from), w = (k.to - k.from + 1) * cw;
    g += `<g data-tip-t="${esc(k.t)} · cap. ${k.from}–${k.to}" data-tip="${esc(D.blockTips?.[i] || k.s)}"><rect class="vacc" x="${x1}" y="34" width="${w}" height="48" rx="4"/>` +
      `<text class="vt vacc-t" x="${x1 + w / 2}" y="52" text-anchor="middle" dominant-baseline="central">${esc(k.t)}</text>` +
      `<text class="vs vacc-t" x="${x1 + w / 2}" y="70" text-anchor="middle" dominant-baseline="central">${esc(k.s)}</text></g>`;
  });
  const yB = 212, H = 56;
  g += `<text class="vs" x="40" y="140">Lungimea studiului</text>`;
  if (D.marker) {
    const avg = list => Math.round(list.reduce((s, d) => s + d.words, 0) / Math.max(list.length, 1) / 100) * 100;
    const before = st.filter(d => d.c < D.marker.ch && d.words), after = st.filter(d => d.c >= D.marker.ch && d.words);
    g += `<line x1="${x(D.marker.ch)}" y1="146" x2="${x(D.marker.ch)}" y2="${yB}" stroke="var(--muted)" stroke-width=".8" stroke-dasharray="3 3"/>` +
      `<text class="vs" x="${x(D.marker.ch) + 5}" y="140">${esc(D.marker.t)} · media ~${fmt(avg(before))} → ~${fmt(avg(after))} cuvinte</text>`;
  }
  g += `<text class="vs" x="40" y="236">Întrebări punctuale</text>`;
  if (D.lanes?.length) g += `<text class="vs" x="40" y="282">Personajul central</text>`;
  for (const d of st) {
    const h = d.words / maxW * H, qText = d.q ? ` · ${d.q} ${d.q === 1 ? 'întrebare punctuală' : 'întrebări punctuale'}` : '';
    const label = d.s ? `${d.s.title} · ${fmt(d.words)} cuvinte${qText}` : `${book.name} ${d.c} · nestudiat`;
    const dots = Array.from({ length: d.q }, (_, i) => `<circle class="vq" cx="${cx(d.c) + (i - (d.q - 1) / 2) * 10}" cy="250" r="4"/>`).join('');
    const sum = d.s ? (d.s.summary.length > 260 ? d.s.summary.slice(0, 257) + '…' : d.s.summary) : 'Capitol nestudiat încă.';
    g += `<g class="vcol" ${openAttr(b, d.c)} aria-label="${esc(label)}" data-tip-t="${esc(d.s ? d.s.title : `${book.name} ${d.c}`)}" data-tip="${esc(sum)}" data-tip-r="${d.s ? `${fmt(d.words)} cuvinte${qText} · click: deschide studiul` : ''}">` +
      `<rect class="hit" x="${x(d.c) + 1}" y="88" width="${cw - 2}" height="170" rx="3"/>` +
      `<text class="vs" x="${cx(d.c)}" y="100" text-anchor="middle" dominant-baseline="central">${d.c}</text>` +
      (h ? `<rect class="vbar" x="${cx(d.c) - Math.min(7.5, cw / 2 - 2)}" y="${yB - h}" width="${Math.min(15, cw - 4)}" height="${h}" rx="2"/>` : '') + dots + '</g>';
  }
  (D.lanes || []).forEach((L, i) => {
    const y = 290 + i * 24;
    for (const [a, z] of L.segs)
      g += `<rect data-tip-t="${esc(L.t)}" data-tip="${a === z ? `Cap. ${a}` : `Cap. ${a}–${z}`}. ${esc(D.lanesNote || '')}" class="${L.neutral ? 'vneu' : 'vlane'}" x="${x(a)}" y="${y}" width="${(z - a + 1) * cw}" height="18" rx="3"/>`;
    const [a, z] = L.outside ? L.segs.at(-1) : L.segs.reduce((m, s) => (s[1] - s[0]) > (m[1] - m[0]) ? s : m);
    g += L.outside ? `<text class="vs" x="${x(z + 1) + 6}" y="${y + 9}" dominant-baseline="central">${esc(L.t)}</text>`
      : `<text class="vs vlane-t" style="pointer-events:none" x="${(x(a) + x(z + 1)) / 2}" y="${y + 9}" text-anchor="middle" dominant-baseline="central">${esc(L.t)}</text>`;
  });
  const height = 290 + (D.lanes || []).length * 24 + 12;
  return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="Harta studiului: ${esc(book.name)}">${g}</svg>`;
}

function chaptersBlock(block, s) {
  const D = block.data;
  return `<p class="vis-p">${D.blocksSrc ? esc(D.blocksSrc) + '. ' : ''}O coloană = un capitol; click pe coloană deschide studiul. ${esc(D.lanesNote || '')}</p>` +
    `<div class="visbox">${chaptersSvg(D, s.b)}</div>`;
}

// ---------- flow ----------

function flowBlock(block, s) {
  const F = block.data, tips = F.tips || {}, w = 170, gap = 25, x0 = 60, nodeH = 56;
  let y = 10, g = '';
  const box = (t, sub, ch, cls, yy, x, ww) => {
    const open = ch != null ? openAttr(s.b, ch) : '';
    return `<g class="vnode" data-tip-t="${esc(t)}" data-tip="${esc(tips[ch] || '')}" data-tip-r="${open ? `click: deschide cap. ${ch}` : ''}" ${open}>` +
      `<rect class="${cls}" x="${x}" y="${yy}" width="${ww}" height="${nodeH}" rx="8"/>` +
      `<text class="vt ${cls}-t" x="${x + ww / 2}" y="${yy + 19}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>` +
      `<text class="vs ${cls}-t" x="${x + ww / 2}" y="${yy + 38}" text-anchor="middle" dominant-baseline="central">${esc(sub)}</text></g>`;
  };
  const arrow = (y1, y2) => `<line x1="340" y1="${y1}" x2="340" y2="${y2 - 2}" stroke="var(--muted)" stroke-width="1.2" marker-end="url(#va)"/>`;
  g += box(F.top.t, F.top.s, F.top.ch, 'vacc', y, 190, 300);
  y += nodeH; g += arrow(y, y + 22); y += 24;
  for (const S of F.stages) {
    const rows = Math.ceil(S.nodes.length / 3), h = 36 + rows * nodeH + (rows - 1) * 16 + 18;
    g += `<rect x="40" y="${y}" width="600" height="${h}" rx="12" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="5 4"/>` +
      `<text class="vt" x="60" y="${y + 22}">${esc(S.t)}</text><text class="vs" x="${60 + S.t.length * 7.6 + 12}" y="${y + 22}">${esc(S.s)}</text>`;
    S.nodes.forEach((N, i) => { g += box(N[0], N[1], N[2], N[3] ? 'vwarn' : 'vlane', y + 36 + Math.floor(i / 3) * (nodeH + 16), x0 + (i % 3) * (w + gap), w); });
    y += h; g += arrow(y, y + 22); y += 24;
  }
  g += box(F.end.t, F.end.s, F.end.ch, 'vacc', y, 190, 300);
  y += nodeH + 10;
  return `<p class="vis-p">${esc(block.note || '')}</p><div class="visbox"><svg viewBox="0 0 680 ${y}" role="img" aria-label="${esc(block.title)}">` +
    `<defs><marker id="va" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${g}</svg></div>`;
}

// ---------- causal ----------

function causalSvg(D, i) {
  const CX = [42, 252, 462], W = 176, H = 44, Y0 = 44, ST = 56, P = {};
  D.N.forEach(n => { P[n[0]] = { x: CX[n[1]], y: Y0 + n[2] * ST, c: n[1], r: n[2] }; });
  const height = Y0 + Math.max(...D.N.map(n => n[2])) * ST + H + 16;
  let h = `<defs><marker id="cza" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`;
  (D.columns || []).forEach((t, c) => {
    h += `<text class="vt" x="${CX[c] + W / 2}" y="22" text-anchor="middle">${esc(t)}</text><line x1="${CX[c] + W / 2}" y1="32" x2="${CX[c] + W / 2}" y2="${height - 6}" stroke="var(--line)" stroke-width=".6" stroke-dasharray="2 4"/>`;
  });
  const path = (a, b) => {
    const A = P[a], B = P[b];
    if (A.c === B.c) return `M${A.x + W / 2} ${A.y + H} L${B.x + W / 2} ${B.y - 2}`;
    if (A.r === B.r) return A.c < B.c ? `M${A.x + W} ${A.y + H / 2} L${B.x - 2} ${B.y + H / 2}` : `M${A.x} ${A.y + H / 2} L${B.x + W + 2} ${B.y + H / 2}`;
    if (A.c < B.c) { const g = CX[A.c] + W + 17; return `M${A.x + W} ${A.y + H / 2} L${g} ${A.y + H / 2} L${g} ${B.y + H / 2} L${B.x - 2} ${B.y + H / 2}`; }
    const g = CX[A.c] - 17; return `M${A.x} ${A.y + H / 2} L${g} ${A.y + H / 2} L${g} ${B.y + H / 2} L${B.x + W + 2} ${B.y + H / 2}`;
  };
  D.E.forEach(([a, b, t], k) => {
    const st = t === 'p' ? 'stroke="var(--warn)" stroke-width="2"' : t === 'f' ? 'stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="5 4"' : 'stroke="var(--muted)" stroke-width="1.2"';
    h += `<path data-ce="${k}" d="${path(a, b)}" fill="none" ${st} marker-end="url(#cza)"/>`;
  });
  for (const [k, , , t, ref] of D.N) {
    const p = P[k];
    h += `<g class="vnode" data-cz="${k}" tabindex="0" role="button" aria-label="${esc(t)}, ${esc(ref)}" data-tip-t="${esc(t)} · ${esc(ref)}" data-tip="${esc(D.tips?.[k] || '')}" data-tip-r="click: evidențiază cauzele și urmările">` +
      `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="8" fill="var(--surface)" stroke="var(--muted)" stroke-width=".6"/>` +
      `<text class="vt" x="${p.x + W / 2}" y="${p.y + 16}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>` +
      `<text class="vs" x="${p.x + W / 2}" y="${p.y + 32}" text-anchor="middle" dominant-baseline="central">${esc(ref)}</text></g>`;
  }
  return `<svg data-causal="${i}" viewBox="0 0 680 ${height}" role="img" aria-label="Harta cauzală a evenimentelor">${h}</svg>`;
}

// data.links names the two special kinds of link: { p: "…" (coral), f: "…" (dashed) }.
function causalBlock(block, s, i) {
  const links = block.data.links || {};
  return `<p class="vis-p">Timpul curge de sus în jos; coloanele arată pe unde trece istoria. Linii: gri = cauză directă` +
    (links.p ? `, <span style="color:var(--warn)">corai</span> = ${esc(links.p)}` : '') + (links.f ? `, <span style="color:var(--accent)">întreruptă</span> = ${esc(links.f)}` : '') +
    `. ${esc(block.note || '')}</p>` +
    `<div class="czbar" data-czbar="${i}"></div><div class="visbox">${causalSvg(block.data, i)}</div>`;
}

// Highlights everything that led to an event and everything it set off.
function causalSelect(i, id) {
  const D = view.spec.blocks[i].data, svg = view.root.querySelector(`[data-causal="${i}"]`);
  view.causal[i] = id;
  let chain = null;
  if (id) {
    chain = new Set([id]);
    for (const reverse of [false, true]) {
      const queue = [id], seen = new Set([id]);
      while (queue.length) {
        const x = queue.pop();
        for (const e of D.E) {
          const [from, to] = reverse ? [e[1], e[0]] : [e[0], e[1]];
          if (from === x && !seen.has(to)) { seen.add(to); chain.add(to); queue.push(to); }
        }
      }
    }
  }
  svg.querySelectorAll('[data-cz]').forEach(g => {
    g.style.opacity = !chain || chain.has(g.dataset.cz) ? 1 : .18;
    const r = g.querySelector('rect');
    r.setAttribute('stroke', g.dataset.cz === id ? 'var(--fg)' : 'var(--muted)');
    r.setAttribute('stroke-width', g.dataset.cz === id ? '1.8' : '.6');
  });
  svg.querySelectorAll('[data-ce]').forEach(p => { const [a, b] = D.E[+p.dataset.ce]; p.style.opacity = !chain || (chain.has(a) && chain.has(b)) ? 1 : .1; });
  const n = id && D.N.find(x => x[0] === id), target = n && studyAt(view.study.b, n[5]);
  view.root.querySelector(`[data-czbar="${i}"]`).innerHTML = n
    ? `<span><b>${esc(n[3])}</b> · ${esc(n[4])} · lanțul complet e evidențiat</span>${target ? `<button type="button" data-open="${target.id}">Deschide capitolul ${n[5]}</button>` : ''}`
    : '<span>Click pe un eveniment: vezi ce l-a produs și ce a declanșat.</span>';
}

// ---------- journeys ----------

const merc = (lo, la) => [lo * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360))];

function mapSvg(JR, sel) {
  const ids = sel === 'all' ? Object.keys(JR.J) : [sel], pt = k => JR.C[k] ? JR.C[k].slice(0, 2) : JR.WP[k];
  const pts = ids.flatMap(k => JR.J[k].r.map(p => merc(...pt(p))));
  const W = 680, H = 380, pad = 40, mx = [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))], my = [Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))];
  const sc = Math.min((W - 2 * pad) / (mx[1] - mx[0] || 1), (H - 2 * pad) / (my[1] - my[0] || 1)), ox = (W - sc * (mx[1] - mx[0])) / 2, oy = (H - sc * (my[1] - my[0])) / 2;
  const proj = (lo, la) => { const [x, y] = merc(lo, la); return [ox + (x - mx[0]) * sc, H - oy - (y - my[0]) * sc]; };
  let g = '';
  if (view.land) g += `<path d="${view.land.polys.map(poly => poly.map(r => 'M' + r.map(([lo, la]) => proj(lo, la).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('')}" fill="var(--todo)" stroke="var(--line)" stroke-width=".6" fill-rule="evenodd"/>`;
  for (const k of ids) {
    const v = JR.J[k], line = JR.paths?.[k] || v.r.map(pt);   // realistic path from the build, else the stops
    g += `<path d="${smoothPath(line.map(p => proj(...p)))}" fill="none" stroke="${v.col}" stroke-width="${sel === 'all' ? 2 : 2.6}" stroke-dasharray="${v.dash}" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>`;
  }
  const badges = {};
  ids.forEach(k => Object.entries(JR.J[k].b).forEach(([c, t]) => { badges[c] = badges[c] ? badges[c] + ', ' + t : t; }));
  const named = [...new Set(ids.flatMap(k => JR.J[k].r.filter(p => JR.C[p])))];
  const O = [[8, 4, 'start'], [8, 4, 'start'], [0, -9, 'middle'], [0, 16, 'middle'], [-8, 4, 'end']];
  for (const n of named) {
    const [lo, la, major, pos, region] = JR.C[n], [x, y] = proj(lo, la);
    const refs = JR.refs?.[n] || [], journeys = Object.values(JR.J).filter(v => v.r.includes(n)).map(v => v.n).join(', ');
    const refText = refs.length ? abbr() + ' ' + (refs.length > 10 ? refs.slice(0, 10).join('; ') + ` … (+${refs.length - 10})` : refs.join('; ')) : '';
    let c = '', badge = '';
    if (!region) c += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="transparent"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${major ? 3.6 : 2.6}" fill="var(--surface)" stroke="var(--fg)" stroke-width="1"/>`;
    if (!((sel === 'all' && !major) || pos === 0)) {
      let o = O[pos].slice();
      const tw = n.length * (major ? 7.2 : 6.6);
      if (o[2] === 'start' && x + o[0] + tw > W - 4) o = [-8, 4, 'end'];
      else if (o[2] === 'end' && x - 8 - tw < 4) o = [8, 4, 'start'];
      else if (o[2] === 'middle' && x - tw / 2 < 4) o = [o[0] + (tw / 2 - x + 6), o[1], 'middle'];
      else if (o[2] === 'middle' && x + tw / 2 > W - 4) o = [o[0] - (x + tw / 2 - W + 6), o[1], 'middle'];
      const tx = x + o[0], ty = y + o[1];
      c += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${o[2]}" style="font:${region ? 'italic 400' : major ? '600' : '400'} 12px var(--f-ui);fill:${region ? 'var(--muted)' : 'var(--fg)'}">${esc(n)}</text>`;
      const bt = badges[n];
      if (bt) {
        const w = bt.length * 6.3 + 10;
        let bx = o[2] === 'start' ? tx - 2 : o[2] === 'end' ? tx - w + 2 : tx - w / 2;
        bx = Math.max(4, Math.min(W - w - 4, bx));
        const by = (pos === 2 || JR.C[n][5]) ? ty - 30 : ty + 5;
        const letters = ids.flatMap(k => JR.J[k].e).filter(e => e[1].startsWith(n));
        badge = `<g data-tip-t="Scrise la ${esc(n)}" data-tip="${esc(letters.map(e => `${e[0]} (${e[1].split(' · ')[1] || ''}): ${e[2]}`).join('\n'))}">` +
          `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${w.toFixed(1)}" height="16" rx="4" fill="var(--ep-bg)" stroke="var(--ep-bd)" stroke-width=".6"/>` +
          `<text x="${(bx + w / 2).toFixed(1)}" y="${(by + 11.5).toFixed(1)}" text-anchor="middle" style="font:600 11px var(--f-ui);fill:var(--ep-fg)">${esc(bt)}</text></g>`;
      }
    }
    g += `<g data-tip-t="${esc(n)}${journeys ? ' · ' + esc(journeys) : ''}" data-tip="${esc(JR.info?.[n] || '')}" data-tip-r="${esc(refText)}">${c}</g>${badge}`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Harta rutelor">${g}</svg>`;
}

// Timeline (years A.D.): data.timeline = { from, to, step, journeys: [[id, from, to, label]],
// marks: [{ kind: bar|point|anchor, from/to or at, label, title, tip }], letters: [[label, year, journey, row, name in "e"]] }.
function timelineSvg(JR, sel) {
  const T = JR.timeline, X = y => 40 + (y - T.from) * 600 / (T.to - T.from), on = k => sel === 'all' || sel === k;
  let h = '';
  for (let y = T.from; y <= T.to; y += T.step || 2) h += `<line x1="${X(y)}" y1="128" x2="${X(y)}" y2="132" stroke="var(--muted)"/><text class="vs" x="${X(y)}" y="146" text-anchor="middle">${y}</text>`;
  h += `<line x1="40" y1="128" x2="640" y2="128" stroke="var(--muted)" stroke-width=".6"/>`;
  for (const [k, a, b, label] of T.journeys) {
    const v = JR.J[k];
    h += `<g data-tip-t="${esc(v.n)} · ${esc(v.d)}" data-tip="${esc(abbr())} ${esc(v.ref)}\nPrimul pas: ${esc(v.f[0][1])} (${esc(v.f[0][0])})\nEpistole: ${esc(v.e.map(e => e[0]).join(', '))}" data-tip-r="click pe butonul călătoriei pentru firul complet">` +
      `<rect x="${X(a)}" y="16" width="${X(b) - X(a)}" height="14" rx="4" fill="${v.col}" opacity="${on(k) ? .92 : .18}"/>` +
      `<text class="vs" x="${(X(a) + X(b)) / 2}" y="44" text-anchor="middle" style="opacity:${on(k) ? 1 : .35}">${esc(label)}</text></g>`;
  }
  for (const m of T.marks || []) {
    const tip = `data-tip-t="${esc(m.title)}" data-tip="${esc(m.tip || '')}"`;
    if (m.kind === 'bar') h += `<g ${tip}><rect x="${X(m.from)}" y="19" width="${X(m.to) - X(m.from)}" height="8" rx="3" fill="var(--muted)" opacity=".5"/><text class="vs" x="${(X(m.from) + X(m.to)) / 2}" y="44" text-anchor="middle">${esc(m.label)}</text></g>`;
    else if (m.kind === 'point') h += `<g ${tip}><path d="M${X(m.at)} 16 l6 7 -6 7 -6 -7z" fill="var(--fg)"/><text class="vs" x="${X(m.at)}" y="11" text-anchor="middle">${esc(m.label)}</text></g>`;
    else h += `<g ${tip}><rect x="${X(m.at) - 4}" y="0" width="${m.label.length * 6.5 + 8}" height="34" fill="transparent"/><line x1="${X(m.at)}" y1="13" x2="${X(m.at)}" y2="33" stroke="var(--fg)" stroke-dasharray="2 2"/><text class="vs" x="${X(m.at) + 4}" y="11">${esc(m.label)}</text></g>`;
  }
  for (const [t, y, k, row, name] of T.letters || []) {
    const yy = row ? 100 : 78, w = t.length * 6.2 + 10, ee = JR.J[k].e.find(e => e[0].includes(name));
    h += `<g style="opacity:${on(k) ? 1 : .25}" data-tip-t="${esc(ee ? ee[0] : t)}${ee ? ' · ' + esc(ee[1]) : ''}" data-tip="${esc(ee ? ee[2] + (ee[3] ? ' ' + ee[3] : '') : '')}">` +
      `<line x1="${X(y)}" y1="${yy + 10}" x2="${X(y)}" y2="126" stroke="var(--ep-bd)" stroke-width=".8"/>` +
      `<rect x="${X(y) - w / 2}" y="${yy - 6}" width="${w}" height="16" rx="4" fill="var(--ep-bg)" stroke="var(--ep-bd)" stroke-width=".6"/>` +
      `<text x="${X(y)}" y="${yy + 5.5}" text-anchor="middle" style="font:600 11px var(--f-ui);fill:var(--ep-fg)">${t}</text></g>`;
  }
  return `<svg viewBox="0 0 680 152" role="img" aria-label="Axa timpului">${h}</svg>`;
}

function journeysBody(JR, s, i) {
  const sel = view.journey[i] || 'all', chosen = sel === 'all' ? null : JR.J[sel];
  const tabs = [['all', 'Toate'], ...Object.entries(JR.J).map(([k, v]) => [k, v.n])];
  const thread = chosen ? chosen.f.map((x, k) => `${k ? '<div class="ar">↓</div>' : ''}<div class="st ${x[2]}"><span class="r">${esc(x[0])}</span>${esc(x[1])}${x[3] ? `<span class="lk">→ ${esc(x[3])}</span>` : ''}</div>`).join('')
    : '<div class="st">Alege o călătorie ca să-i vezi firul.</div>';
  const letters = (chosen ? [[chosen.n, chosen]] : Object.values(JR.J).map(v => [v.n, v])).flatMap(([jn, v]) => v.e.map(e => [...e, jn]));
  const target = chosen && studyAt(s.b, chosen.ch);
  return `<div class="jt" role="group" aria-label="Călătoria">${tabs.map(([k, t]) => `<button type="button" data-jr="${i}:${k}" aria-pressed="${k === sel}">${esc(t)}</button>`).join('')}</div>` +
    `<div class="visbox">${mapSvg(JR, sel)}</div>` +
    `<div class="lg">${Object.values(JR.J).map(v => `<span><i style="background:${v.col}"></i>${esc(v.n)} · ${esc(v.ref)} · ${esc(v.d)}</span>`).join('')}<span><i style="background:repeating-linear-gradient(90deg,var(--j4) 0 6px,transparent 6px 10px)"></i>drum ca întemnițat</span><span><i style="background:var(--ep-bd)"></i>epistolă scrisă aici</span></div>` +
    `<p class="vis-p" style="margin-top:14px">Axa timpului (d.Hr., aproximativ). ${esc(JR.datesNote || '')}</p>` +
    `<div class="visbox">${timelineSvg(JR, sel)}</div>` +
    `<div class="cols"><div><h3 class="vis-h3">${chosen ? `Firul: ${esc(chosen.n)} · ${esc(abbr())} ${esc(chosen.ref)} · ${esc(chosen.d)}` : 'Firul călătoriei'}</h3>` +
    `<p class="vis-p"><span style="color:var(--accent)">■</span> conducere divină · <span style="color:var(--warn)">■</span> opoziție care împinge mai departe · <span style="color:var(--lane)">■</span> legătură cu altă etapă</p>${thread}` +
    (target ? `<p><button type="button" data-open="${target.id}">Deschide studiul (cap. ${chosen.ch})</button></p>` : '') + '</div>' +
    `<div><h3 class="vis-h3">Epistole legate de ${chosen ? 'această etapă' : 'călătorii'}</h3>${letters.map(([t, w, ctx, alt, src, jn]) =>
      `<div class="ep"><b>${esc(t)}</b> <span class="m">· ${esc(w)}${chosen ? '' : ` · ${esc(jn)}`}</span><div>${esc(ctx)}</div>${alt ? `<div class="m">${esc(alt)}</div>` : ''}` +
      `<div class="m">Sursă: ${src.map(k => JR.sources?.[k] ? `<a href="${esc(JR.sources[k][1])}" target="_blank" rel="noopener">${esc(JR.sources[k][0])}</a>` : esc(k)).join(', ')}</div></div>`).join('')}</div></div>`;
}

function journeysBlock(block, s, i) {
  return `<p class="vis-p">${esc(block.note || '')}</p><div data-journeys="${i}">${journeysBody(block.data, s, i)}</div>`;
}

// ---------- Rendering ----------

// The Acts book visuals above return HTML; the newer types (app/js/viz*.js) return { html, mount(el) }.
const LEGACY = { chapters: chaptersBlock, flow: flowBlock, causal: causalBlock, journeys: journeysBlock };
const RENDER = { 'book-map': bookMap, timeline, 'chapter-map': chapterMap, network, map, history };
const NAV = { 'book-map': 'Harta cărții', timeline: 'Cronologie', 'chapter-map': 'Harta capitolului', network: 'Personaje și locuri', map: 'Hartă', history: 'Istorie' };

const helpText = b => b.about || getAtlas()?.help?.[b.type] || '';

function draw() {
  const { study, spec, root } = view, ctx = { s: study.c != null ? study : null, b: study.b };
  const mounts = [];
  const sections = spec.blocks.map((b, i) => {
    if (LEGACY[b.type]) return `<section class="visblock" id="vb-${i}"><h2 class="vis-h">${esc(b.title)}</h2>${LEGACY[b.type](b, study, i)}</section>`;
    const out = RENDER[b.type]?.(b, ctx);
    if (!out) return '';
    mounts.push([i, out.mount]);
    // How to read the block (its own "about" or the text for its type) opens from the "?" next to the title; the note goes under the diagram, in small print.
    const help = helpText(b) ? `<button type="button" class="vis-help" data-help="${i}" aria-haspopup="dialog" aria-label="Cum citești: ${esc(b.title)}" data-tip="Cum citești diagrama">?</button>` : '';
    return `<section class="visblock" id="vb-${i}" data-block="${i}"><div class="vis-head"><h2 class="vis-h">${esc(b.title)}</h2>${help}</div>${b.message ? `<p class="vis-msg">${esc(b.message)}</p>` : ''}${out.html}${b.note ? `<p class="fine-print">${esc(b.note)}</p>` : ''}</section>`;
  });
  const nav = spec.blocks.length > 2 ? `<nav class="visnav" aria-label="Părțile vizualizării">${spec.blocks.map((b, i) => `<a href="#vb-${i}" data-jump="vb-${i}">${esc(NAV[b.type] || b.title)}</a>`).join('')}</nav>` : '';
  root.innerHTML = view.banner + nav + sections.join('');
  for (const [i, mount] of mounts) mount?.(root.querySelector(`[data-block="${i}"]`));
  spec.blocks.forEach((b, i) => { if (b.type === 'causal') causalSelect(i, view.causal[i] || null); });
}

// study: a catalog entry, or { b } for a book page. visual: { path, src, stale }. banner: HTML above (e.g. "out of date").
export async function showVisual(root, study, visual, banner = '') {
  root.innerHTML = '<div class="loading">Se încarcă vizualizarea…</div>';
  let spec;
  try { [spec] = await Promise.all([json(visual.path), loadAtlas()]); }
  catch { root.innerHTML = '<div class="empty"><strong>Vizualizarea nu s-a putut încărca</strong>Verifică conexiunea și încearcă din nou.</div>'; return; }
  view = { study, spec, root, causal: {}, journey: {}, land: null, banner };
  draw();
  if (spec.blocks.some(b => b.type === 'journeys')) loadLand().then(geo => { if (geo && view?.spec === spec) { view.land = geo; draw(); } });
}

// Clicks inside the visual: journey tabs and causal events. Returns true when handled.
export function visualClick(e) {
  if (!view) return false;
  const help = e.target.closest('[data-help]');
  if (help) {
    const b = view.spec.blocks[+help.dataset.help];
    // Two sentences per paragraph read more easily in the narrow panel.
    const s = helpText(b).match(/[^.!?]+[.!?]+(\s|$)/g) || [helpText(b)];
    const paras = [];
    s.forEach((x, k) => { if (k % 2) paras[paras.length - 1] += x; else paras.push(x); });
    openPanel({ kicker: 'Cum citești', title: b.title, body: paras.map(p => `<p>${esc(p.trim())}</p>`).join('') });
    return true;
  }
  const jr = e.target.closest('[data-jr]');
  if (jr) {
    const [i, k] = jr.dataset.jr.split(':');
    view.journey[i] = k;
    view.root.querySelector(`[data-journeys="${i}"]`).innerHTML = journeysBody(view.spec.blocks[i].data, view.study, +i);
    return true;
  }
  const cz = e.target.closest('[data-cz]');
  if (cz) {
    const i = +cz.closest('[data-causal]').dataset.causal;
    causalSelect(i, view.causal[i] === cz.dataset.cz ? null : cz.dataset.cz);
    return true;
  }
  return false;
}
