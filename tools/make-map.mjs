// One-time generator of data/atlas/maps/near-east.json: land outline and main rivers from the Mediterranean
// to Persia, used by the study maps (drawing and route finding). Source: Natural Earth 1:50m (public domain).
//   land:   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json
//   rivers: https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_rivers_lake_centerlines.geojson
// Usage: node tools/make-map.mjs <land-50m.json> <rivers.geojson>
import fs from 'node:fs';
import path from 'node:path';

const [landFile, riverFile] = process.argv.slice(2);
if (!riverFile) { console.error('Usage: node tools/make-map.mjs <land-50m.json> <rivers.geojson>'); process.exit(1); }
const BBOX = [4, 20, 60, 48];   // west, south, east, north
const RIVERS = ['Euphrates', 'Tigris', 'Nile', 'Jordan', 'Orontes', 'Karun', 'Halys', 'Araks', 'Kura'];
const round = p => [+p[0].toFixed(2), +p[1].toFixed(2)];

// TopoJSON -> polygons (arcs are delta-encoded and quantized).
const topo = JSON.parse(fs.readFileSync(landFile, 'utf8'));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map(arc => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
const ring = ids => ids.flatMap((id, i) => {
  const a = id < 0 ? [...arcs[~id]].reverse() : arcs[id];
  return i ? a.slice(1) : a;
});
const geom = topo.objects.land;
const geoms = geom.type === 'GeometryCollection' ? geom.geometries : [geom];
const polygons = geoms.flatMap(g => g.type === 'MultiPolygon' ? g.arcs : [g.arcs]).map(p => p.map(ring));

// Sutherland–Hodgman clipping of a ring to the bounding box.
function clipRing(points) {
  const edges = [
    [p => p[0] >= BBOX[0], (a, b) => cut(a, b, 0, BBOX[0])], [p => p[0] <= BBOX[2], (a, b) => cut(a, b, 0, BBOX[2])],
    [p => p[1] >= BBOX[1], (a, b) => cut(a, b, 1, BBOX[1])], [p => p[1] <= BBOX[3], (a, b) => cut(a, b, 1, BBOX[3])]
  ];
  function cut(a, b, axis, v) { const t = (v - a[axis]) / (b[axis] - a[axis]); return axis ? [a[0] + t * (b[0] - a[0]), v] : [v, a[1] + t * (b[1] - a[1])]; }
  let out = points;
  for (const [inside, inter] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(inter(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(inter(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}
const polys = [];
for (const p of polygons) {
  const rings = p.map(r => {
    const o = [];
    for (const q of clipRing(r).map(round)) { const l = o.at(-1); if (!l || l[0] !== q[0] || l[1] !== q[1]) o.push(q); }
    return o;
  }).filter(r => r.length > 3);
  if (rings.length) polys.push(rings);
}

// Rivers: centerlines of the named rivers, clipped to the box (a line leaving the box is split).
const geo = JSON.parse(fs.readFileSync(riverFile, 'utf8'));
const inBox = p => p[0] >= BBOX[0] && p[0] <= BBOX[2] && p[1] >= BBOX[1] && p[1] <= BBOX[3];
const rivers = [];
for (const f of geo.features) {
  const name = f.properties.name_en || f.properties.name;
  if (!RIVERS.includes(name)) continue;
  const lines = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const line of lines) {
    let part = [];
    for (const p of line) {
      if (inBox(p)) part.push(round(p));
      else { if (part.length > 1) rivers.push({ name, line: part }); part = []; }
    }
    if (part.length > 1) rivers.push({ name, line: part });
  }
}

const out = path.resolve(import.meta.dirname, '../data/atlas/maps/near-east.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ bbox: BBOX, source: 'Natural Earth 1:50m (domeniu public)', polys, rivers }));
console.log(`${polys.length} polygons, ${rivers.length} river lines (${[...new Set(rivers.map(r => r.name))].join(', ')}), ${(fs.statSync(out).size / 1e3).toFixed(0)} KB`);
