/* Cityworks geometry adapter. Clipper is a separately licensed dependency. */
(function (root) {
  'use strict';
  const L = typeof module !== 'undefined' ? require('../vendor/clipper-6.4.2.js') : root.ClipperLib;
  const SCALE = 1000;
  const EPS = 0.002;
  const snap = n => Math.round(n * SCALE) / SCALE;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const shape = (outer, holes = []) => ({ outer, holes });
  const paths = regions => regions.flatMap(p => [p.outer, ...p.holes]).map(p => p.map(v => ({ X: Math.round(v[0] * SCALE), Y: Math.round(v[1] * SCALE) })));
  function canonical(ring, positive = true) {
    let p = ring.map(v => v.map(snap));
    p = p.filter((v, i) => !i || v[0] !== p[i - 1][0] || v[1] !== p[i - 1][1]);
    if (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop();
    if ((area(p) > 0) !== positive) p.reverse();
    let start = 0;
    for (let i = 1; i < p.length; i++) if (p[i][0] < p[start][0] || (p[i][0] === p[start][0] && p[i][1] < p[start][1])) start = i;
    return p.slice(start).concat(p.slice(0, start));
  }
  function fromTree(tree) {
    return L.JS.PolyTreeToExPolygons(tree).map(p => ({
      outer: canonical(p.outer.map(v => [v.X / SCALE, v.Y / SCALE])),
      holes: p.holes.map(h => canonical(h.map(v => [v.X / SCALE, v.Y / SCALE]), false)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    })).filter(p => area(p.outer) > 0.001).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  function boolean(a, b = [], operation = 'union') {
    if (!a.length) return [];
    const c = new L.Clipper(2), tree = new L.PolyTree();
    c.AddPaths(paths(a), L.PolyType.ptSubject, true);
    if (b.length) c.AddPaths(paths(b), L.PolyType.ptClip, true);
    const op = { union: L.ClipType.ctUnion, intersection: L.ClipType.ctIntersection, difference: L.ClipType.ctDifference }[operation];
    if (!c.Execute(op, tree, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero)) throw Error('Polygon operation failed');
    return fromTree(tree);
  }
  function offset(regions, distance) {
    if (!regions.length) return [];
    const c = new L.ClipperOffset(2, 0.1 * SCALE), tree = new L.PolyTree();
    c.AddPaths(paths(regions), L.JoinType.jtMiter, L.EndType.etClosedPolygon);
    c.Execute(tree, distance * SCALE);
    return fromTree(tree);
  }
  const totalArea = regions => regions.reduce((sum, p) => sum + area(p.outer) + p.holes.reduce((s, h) => s + area(h), 0), 0);
  function pointOnSegment(p, a, b, tolerance = EPS) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    return len > 0 && Math.abs(cross(a, b, p)) <= tolerance * len && (p[0] - a[0]) * dx + (p[1] - a[1]) * dz >= -tolerance * len && (p[0] - b[0]) * dx + (p[1] - b[1]) * dz <= tolerance * len;
  }
  function inRing(ring, p, boundary = true) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if (pointOnSegment(p, a, b)) return boundary;
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  const inShape = (s, p) => inRing(s.outer, p) && !s.holes.some(h => inRing(h, p, false));
  const inRegions = (regions, p) => regions.some(s => inShape(s, p));
  function intersection(a, b, c, d) {
    const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]];
    const det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-9) return null;
    const w = [c[0] - a[0], c[1] - a[1]];
    const t = (w[0] * v[1] - w[1] * v[0]) / det, q = (w[0] * u[1] - w[1] * u[0]) / det;
    if (t < -1e-8 || t > 1 + 1e-8 || q < -1e-8 || q > 1 + 1e-8) return null;
    return { t, q, point: [snap(a[0] + t * u[0]), snap(a[1] + t * u[1])] };
  }
  function validateRing(ring, label) {
    if (!Array.isArray(ring) || ring.length < 3 || ring.length > 128 || ring.some(v => !Array.isArray(v) || v.length !== 2 || v.some(n => !Number.isFinite(n) || Math.abs(n) > 900))) throw Error(label + ': expected 3 to 128 finite vertices within 900 m');
    if (Math.abs(area(ring)) < 1) throw Error(label + ': degenerate polygon');
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02) throw Error(label + ': repeated or too-close vertices');
      const prev = ring[(i + ring.length - 1) % ring.length];
      if (Math.abs(cross(prev, a, b)) < 1e-6 && (prev[0] - a[0]) * (b[0] - a[0]) + (prev[1] - a[1]) * (b[1] - a[1]) > 0) throw Error(label + ': adjacent edges overlap');
      for (let j = i + 1; j < ring.length; j++) {
        if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
        const c = ring[j], d = ring[(j + 1) % ring.length];
        if (intersection(a, b, c, d) || pointOnSegment(a, c, d) || pointOnSegment(c, a, b)) throw Error(label + ': self-intersection or self-touch');
      }
    }
  }
  function validateLand(outer, holes) {
    validateRing(outer, 'Boundary');
    if (area(outer) < 50000) throw Error('Boundary: must be counter-clockwise and at least 50,000 square metres');
    if (!Array.isArray(holes) || holes.length > 12) throw Error('Holes: expected at most 12 rings');
    const land = shape(canonical(outer));
    const normalized = [];
    for (let i = 0; i < holes.length; i++) {
      validateRing(holes[i], 'Hole ' + i);
      const h = shape(canonical(holes[i]));
      if (totalArea(boolean([h], [land], 'difference')) > 0.01 || totalArea(boolean(offset([h], 0.05), [land], 'difference')) > 0.01) throw Error('Hole ' + i + ': must be strictly inside the boundary');
      if (normalized.some(other => totalArea(boolean(offset([h], 0.05), [other], 'intersection')) > 0.01)) throw Error('Hole ' + i + ': holes overlap or touch');
      normalized.push(h);
    }
    return shape(land.outer, normalized.map(h => canonical(h.outer, false)));
  }
  function clipSegment(a, b, regions) {
    const cuts = [0, 1];
    for (const s of regions) for (const ring of [s.outer, ...s.holes]) for (let i = 0; i < ring.length; i++) {
      const hit = intersection(a, b, ring[i], ring[(i + 1) % ring.length]);
      if (hit) cuts.push(Math.max(0, Math.min(1, hit.t)));
    }
    cuts.sort((a, b) => a - b);
    const unique = cuts.filter((v, i) => !i || v - cuts[i - 1] > 1e-8), result = [];
    const at = t => [snap(a[0] + (b[0] - a[0]) * t), snap(a[1] + (b[1] - a[1]) * t)];
    for (let i = 0; i < unique.length - 1; i++) if (inRegions(regions, at((unique[i] + unique[i + 1]) / 2))) {
      const p = at(unique[i]), q = at(unique[i + 1]);
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.02) result.push([p, q]);
    }
    return result;
  }
  function corridor(a, b, width) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / length * width / 2, nz = (b[0] - a[0]) / length * width / 2;
    return shape(canonical([[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]]));
  }
  function projection(p, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
    const point = [a[0] + dx * t, a[1] + dz * t];
    return { point, t, distance: Math.hypot(p[0] - point[0], p[1] - point[1]) };
  }
  function center(ring) {
    let x = 0, z = 0, sum = 0;
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], k = a[0] * b[1] - b[0] * a[1]; x += (a[0] + b[0]) * k; z += (a[1] + b[1]) * k; sum += k; }
    return Math.abs(sum) > 1e-9 ? [x / (3 * sum), z / (3 * sum)] : ring[0];
  }
  const containsRegion = (container, candidate, tolerance = 0.01) => totalArea(boolean([candidate], [container], 'difference')) <= tolerance;
  const api = { SCALE, EPS, snap, cross, area, rect, shape, canonical, boolean, offset, totalArea, inRing, inShape, inRegions, intersection, validateRing, validateLand, clipSegment, corridor, projection, center, containsRegion };
  if (typeof module !== 'undefined') module.exports = api;
  root.CityGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
