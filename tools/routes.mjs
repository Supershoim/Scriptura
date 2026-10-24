// Realistic route paths for the study maps, computed at build time.
//
// The land outline and rivers of data/atlas/maps/near-east.json are rasterized on a 0.05° grid. A route
// between two points is the cheapest path on that grid (A*):
//   land routes: cheaper along rivers (the old roads followed the valleys), water is crossed only at a high
//                cost (straits, short ferries);
//   sea routes:  cheaper near the coast (ancient ships sailed in sight of land), land is almost impassable.
// The path is then simplified; the app draws it as a smooth curve.
const STEP = 0.05;

export function makeRouter(map) {
  const [west, south, east, north] = map.bbox;
  const W = Math.round((east - west) / STEP), H = Math.round((north - south) / STEP);
  const land = new Uint8Array(W * H), river = new Uint8Array(W * H), coast = new Uint8Array(W * H);
  const col = lon => Math.max(0, Math.min(W - 1, Math.floor((lon - west) / STEP)));
  const row = lat => Math.max(0, Math.min(H - 1, Math.floor((north - lat) / STEP)));

  // Even–odd scanline fill of every polygon ring.
  for (let r = 0; r < H; r++) {
    const lat = north - (r + 0.5) * STEP, xs = [];
    for (const poly of map.polys) for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[i], [x2, y2] = ring[j];
        if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + (lat - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.ceil((xs[k] - west) / STEP - 0.5), b = Math.floor((xs[k + 1] - west) / STEP - 0.5);
      for (let c = Math.max(0, a); c <= Math.min(W - 1, b); c++) land[r * W + c] = 1;
    }
  }
  // River corridors (about 15 km wide).
  for (const { line } of map.rivers || []) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [x1, y1] = line[i], [x2, y2] = line[i + 1], n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (STEP / 2)) + 1;
      for (let k = 0; k <= n; k++) {
        const c = col(x1 + (x2 - x1) * k / n), r = row(y1 + (y2 - y1) * k / n);
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < H && cc >= 0 && cc < W) river[rr * W + cc] = 1;
        }
      }
    }
  }
  // Sea cells within ~25 km of land.
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (land[r * W + c]) continue;
    outer: for (let dr = -5; dr <= 5; dr++) for (let dc = -5; dc <= 5; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < H && cc >= 0 && cc < W && land[rr * W + cc]) { coast[r * W + c] = 1; break outer; }
    }
  }

  const cost = (i, mode) => mode === 'sea'
    ? (land[i] ? 40 : coast[i] ? 0.8 : 1.2)
    : (land[i] ? (river[i] ? 0.55 : 1) : 6);
  const minCost = mode => mode === 'sea' ? 0.8 : 0.55;

  // Nearest cell of the right kind (a coastal city may fall in the other).
  function snap(r, c, mode) {
    const want = mode === 'sea' ? 0 : 1;
    if (land[r * W + c] === want) return [r, c];
    for (let d = 1; d < 40; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < H && cc >= 0 && cc < W && land[rr * W + cc] === want) return [rr, cc];
    }
    return [r, c];
  }

  function astar(a, b, mode, margin) {
    const r0 = Math.max(0, Math.min(a[0], b[0]) - margin), r1 = Math.min(H - 1, Math.max(a[0], b[0]) + margin);
    const c0 = Math.max(0, Math.min(a[1], b[1]) - margin), c1 = Math.min(W - 1, Math.max(a[1], b[1]) + margin);
    const ww = c1 - c0 + 1, hh = r1 - r0 + 1, N = ww * hh;
    const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const local = (r, c) => (r - r0) * ww + (c - c0);
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = (r, c) => Math.hypot(r - b[0], c - b[1]) * minCost(mode);
    const start = local(a[0], a[1]), goal = local(b[0], b[1]);
    g[start] = 0;
    push(h(a[0], a[1]), start);
    while (heap.length) {
      const [, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === goal) break;
      const r = r0 + Math.floor(i / ww), c = c0 + i % ww;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < r0 || rr > r1 || cc < c0 || cc > c1) continue;
        const j = local(rr, cc);
        if (done[j]) continue;
        const step = (dr && dc ? Math.SQRT2 : 1) * (cost(rr * W + cc, mode) + cost(r * W + c, mode)) / 2;
        if (g[i] + step < g[j]) { g[j] = g[i] + step; from[j] = i; push(g[j] + h(rr, cc), j); }
      }
    }
    if (!done[goal]) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = from[i]) cells.push([r0 + Math.floor(i / ww), c0 + i % ww]);
    return cells.reverse();
  }

  // Ramer–Douglas–Peucker simplification (degrees).
  function simplify(pts, eps) {
    if (pts.length < 3) return pts;
    const [x1, y1] = pts[0], [x2, y2] = pts.at(-1), L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    let best = 0, at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / L;
      if (d > best) { best = d; at = i; }
    }
    return best > eps ? [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)] : [pts[0], pts.at(-1)];
  }

  const cache = new Map();
  // One leg between two [lon, lat] points.
  function leg(p, q, mode) {
    const key = `${p}|${q}|${mode}`;
    if (cache.has(key)) return cache.get(key);
    const a = snap(row(p[1]), col(p[0]), mode), b = snap(row(q[1]), col(q[0]), mode);
    const cells = astar(a, b, mode, 80) || astar(a, b, mode, Math.max(W, H)) || [];
    const pts = cells.map(([r, c]) => [west + (c + 0.5) * STEP, north - (r + 0.5) * STEP]);
    const out = simplify([p, ...pts, q], 0.04).map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
    cache.set(key, out);
    return out;
  }
  // Which way a leg goes when the data does not say: by sea if most of the straight line is over water.
  function guessMode(p, q) {
    let sea = 0;
    for (let k = 1; k < 20; k++) if (!land[row(p[1] + (q[1] - p[1]) * k / 20) * W + col(p[0] + (q[0] - p[0]) * k / 20)]) sea++;
    return sea > 9 ? 'sea' : 'land';
  }
  // A whole route through several [lon, lat] points.
  return function route(points, mode) {
    const out = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const part = leg(points[i], points[i + 1], mode || guessMode(points[i], points[i + 1]));
      out.push(...(i ? part.slice(1) : part));
    }
    return out;
  };
}
