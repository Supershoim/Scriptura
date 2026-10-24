// Maps: land, rivers, places and routes. Routes follow realistic paths computed at build time
// (tools/routes.mjs) and are drawn as smooth curves; places and routes open the detail panel.
import { esc } from './util.js';
import { json } from './catalog.js';
import { entity, entityName, openPanel, refList, zoomable, entityPanel, select } from './vizcore.js';

const MAP = 'data/atlas/maps/near-east.json';
const RIVERS = { Euphrates: 'Eufrat', Tigris: 'Tigru', Nile: 'Nil', Jordan: 'Iordan' };
let land = null;
export const loadLand = () => (land ??= json(MAP).catch(() => null));

// Catmull–Rom spline through the points, as cubic Bézier segments.
export function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// Equirectangular projection scaled by the cosine of the middle latitude, fitted to the given points.
function projection(points, W) {
  const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
  let [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const padX = Math.max(1.2, (x1 - x0) * 0.14), padY = Math.max(1, (y1 - y0) * 0.16);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
  const sx = W / ((x1 - x0) * k);
  const H = Math.round(Math.min(720, Math.max(380, (y1 - y0) * sx)));
  const s = Math.min(sx, H / (y1 - y0)), ox = (W - (x1 - x0) * k * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  return { H, proj: (lon, lat) => [ox + (lon - x0) * k * s, H - oy - (lat - y0) * s] };
}

export function map(block) {
  const d = block.data, W = 1000;
  const places = d.places.map(id => ({ id, ...entity(id) })).filter(p => p.lat != null);
  const routes = d.routes || [];
  const all = [...places.map(p => [p.lon, p.lat]), ...routes.flatMap(r => r.path || [])];
  const { H, proj } = projection(all, W);
  const draw = geo => {
    let g = `<rect class="sea" x="0" y="0" width="${W}" height="${H}"/>`;
    if (geo) {
      g += `<path class="land" d="${geo.polys.map(poly => poly.map(r => 'M' + r.map(([lo, la]) => proj(lo, la).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('')}"/>`;
      for (const r of geo.rivers || []) g += `<path class="river" d="${smoothPath(r.line.map(([lo, la]) => proj(lo, la)))}"><title>${esc(RIVERS[r.name] || r.name)}</title></path>`;
    }
    routes.forEach((r, i) => {
      const pts = (r.path || []).map(([lo, la]) => proj(lo, la));
      g += `<g class="v-route k-${esc(r.kind || 'journey')}" data-route="${i}" data-e="route-${i} ${r.via.filter(v => typeof v === 'string').join(' ')}" tabindex="0" role="button" aria-label="${esc(r.t)}">` +
        `<path class="hitline" d="${smoothPath(pts)}"/><path class="line" d="${smoothPath(pts)}" marker-end="url(#arrow-route)"/><title>${esc(r.t)}</title></g>`;
      // Named stops that are not places of the register (e.g. Antiohia, Alexandria).
      for (const v of r.via) if (typeof v !== 'string' && v.t) {
        const [x, y] = proj(v.lon, v.lat);
        g += `<g class="v-stop"><circle cx="${x}" cy="${y}" r="3.5"/><text x="${x + 7}" y="${y + 4}">${esc(v.t)}</text></g>`;
      }
    });
    for (const p of places) {
      const [x, y] = proj(p.lon, p.lat), region = p.kind === 'ținut', river = p.kind === 'râu';
      g += `<g class="v-place${region ? ' region' : ''}${river ? ' riverpt' : ''}${p.approx ? ' approx' : ''}" data-place="${p.id}" data-e="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}">` +
        (region ? '' : `<circle class="hit" cx="${x}" cy="${y}" r="12"/><circle class="dot" cx="${x}" cy="${y}" r="${p.kind === 'cetate' ? 5 : 4}"/>`) +
        // Regions: centred capitals; rivers: label under the point (they sit next to cities); cities: label to the right.
        `<text x="${region || river ? x : x + 8}" y="${region ? y : river ? y + 18 : y + 4}"${region || river ? ' text-anchor="middle"' : ''}>${esc((p.approx ? '≈ ' : '') + (region ? p.name.toUpperCase() : p.name))}</text></g>`;
    }
    return g;
  };
  const defs = '<defs><marker id="arrow-route" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9z" fill="context-stroke"/></marker></defs>';
  const legend = routes.length ? `<ul class="routes">${routes.map((r, i) => `<li><button type="button" class="route-key k-${esc(r.kind || 'journey')}" data-route="${i}" data-e="route-${i}"><i></i>${esc(r.t)}</button> ${refList(r.refs)}</li>`).join('')}</ul>` : '';
  return {
    html: `<div class="visbox map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(block.title)}">${defs}<g class="layer">${draw(null)}</g></svg></div>${legend}` +
      '<p class="hint credit">Contur și râuri: Natural Earth (domeniu public). Trasee calculate pe uscat de-a lungul văilor și pe mare de-a lungul coastelor.</p>',
    mount(el) {
      const svg = el.querySelector('svg');
      zoomable(svg);
      loadLand().then(geo => { if (geo && svg.isConnected) svg.querySelector('.layer').innerHTML = draw(geo); });
      el.addEventListener('click', e => {
        const place = e.target.closest('[data-place]');
        if (place) { entityPanel(place.dataset.place); return; }
        const route = e.target.closest('[data-route]');
        if (route) {
          const r = routes[+route.dataset.route];
          const stops = r.via.map(v => typeof v === 'string' ? entityName(v) : v.t).filter(Boolean);
          openPanel({ kicker: 'Traseu', title: r.t, keys: `route-${route.dataset.route}`,
            body: `<p>${stops.map(esc).join(' → ')}</p>${r.refs?.length ? `<p class="refs">${refList(r.refs, true)}</p>` : ''}` +
              `<p class="hint">Traseul este probabil: textul biblic numește locurile, nu drumul. Calculat pe uscat${r.mode === 'sea' ? ' și pe mare' : ''}, ocolind deșerturile și urmând văile râurilor.</p>` });
        }
      });
      el.addEventListener('mouseover', e => { const n = e.target.closest('[data-place], [data-route]'); if (n && document.getElementById('vizPanel').hidden) select(n.dataset.e); });
      el.addEventListener('mouseout', e => { if (e.target.closest('[data-place], [data-route]') && document.getElementById('vizPanel').hidden) select(''); });
    }
  };
}
