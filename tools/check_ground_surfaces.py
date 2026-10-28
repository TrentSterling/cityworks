"""Read-only checks of rendered ground meshes; callable from a Playwright harness.

The checks use actual mesh vertices, not the renderer's construction parameters.
Standalone mode opens only isolated, muted, headless Chrome and writes no files.
"""

import argparse
import json
from pathlib import Path


CHECK_SCRIPT = r"""() => {
  const started = performance.now();
  const timings = {}, mark = name => {timings[name] = performance.now() - started;};
  const C = ArchipelagoModel, city = Cityworks.city;
  const failures = [], meshes = new Map();
  const tolerance = .004;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const plan = p => [p[0], p[2]];
  function load(name, required = true) {
    if (meshes.has(name)) return meshes.get(name);
    const snapshot = Cityworks.geometrySnapshot(name);
    if (!snapshot) {
      if (required) failures.push({kind: 'missing-mesh', name});
      return [];
    }
    const p = snapshot.positions, ids = snapshot.indices || Array.from({length:p.length / 3}, (_, i) => i);
    const triangles = [];
    if (p.some(n => !Number.isFinite(n))) failures.push({kind: 'nonfinite-mesh', name});
    for (let i = 0; i < ids.length; i += 3) {
      const tri = ids.slice(i, i + 3).map(id => p.slice(id * 3, id * 3 + 3));
      triangles.push(tri);
    }
    meshes.set(name, triangles);
    return triangles;
  }
  const horizontal = tri => Math.max(...tri.map(p => p[1])) - Math.min(...tri.map(p => p[1])) < .0001;
  const area = tri => C.area(tri.map(plan));
  const projection = triangles => C.boolean(triangles.filter(t => Math.abs(area(t)) > .00001)
    .map(t => C.shape(C.canonical(t.map(plan)))));
  const structure = load('bridge-structure'), rails = load('bridge-rails');
  const walks = load('sidewalks'), curbs = load('curbs');
  mark('loaded');

  // Recover vertical intervals from actual wall triangles. This works for either
  // triangle half of a wall and does not assume paired quads or vertex order.
  function verticalSegments(triangles) {
    const result = [];
    for (const tri of triangles) {
      const groups = [];
      for (const p of tri) {
        let group = groups.find(g => distance(g.p, plan(p)) < .00001);
        if (!group) { group = {p:plan(p), ys:[]}; groups.push(group); }
        group.ys.push(p[1]);
      }
      if (groups.length !== 2) continue;
      result.push({a:groups[0].p, b:groups[1].p,
        lowA:Math.min(...groups[0].ys), highA:Math.max(...groups[0].ys),
        lowB:Math.min(...groups[1].ys), highB:Math.max(...groups[1].ys)});
    }
    return result;
  }
  function intervalsAt(p, segments) {
    const result = [];
    for (const s of segments) {
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], length2 = dx * dx + dz * dz;
      if (!length2) continue;
      const t = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / length2;
      if (t < -.0001 || t > 1.0001) continue;
      if (Math.abs(dx * (p[1] - s.a[1]) - dz * (p[0] - s.a[0])) / Math.sqrt(length2) > tolerance) continue;
      const u = Math.max(0, Math.min(1, t));
      result.push([s.lowA + (s.lowB - s.lowA) * u, s.highA + (s.highB - s.highA) * u]);
    }
    return result;
  }
  function covered(intervals, low, high) {
    let reached = low;
    for (const [a, b] of intervals.sort((x, y) => x[0] - y[0])) {
      if (b < reached - tolerance) continue;
      if (a > reached + tolerance) return false;
      reached = Math.max(reached, b);
      if (reached >= high - tolerance) return true;
    }
    return false;
  }

  let shoreSamples = 0, maxShoreGap = 0, supportSamples = 0;
  const structureWalls = verticalSegments(structure);
  for (const island of city.islands) {
    const terrain = load('terrain-' + island.id), shore = load('shore-' + island.id);
    // Accept the earlier separate batch as well as the combined structure batch.
    const abutments = load('abutments-' + island.id, false);
    const walls = [...verticalSegments(shore), ...verticalSegments(abutments), ...structureWalls];
    const edges = new Map(), vertexKey = p => p.map(v => Math.round(v * 1000)).join(',');
    for (const tri of terrain) for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3], key = [vertexKey(a), vertexKey(b)].sort().join('|');
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, {a, b, count:1});
    }
    const onCoast = p => island.boundary.some((a, i) =>
      C.projection(p, a, island.boundary[(i + 1) % island.boundary.length]).distance < tolerance);
    for (const edge of edges.values()) {
      if (edge.count !== 1 || !onCoast(plan(edge.a)) || !onCoast(plan(edge.b))) continue;
      const middle = edge.a.map((v, i) => (v + edge.b[i]) / 2);
      if (!onCoast(plan(middle))) continue;
      for (const t of [0, .25, .5, .75, 1]) {
        const p = edge.a.map((v, i) => v + (edge.b[i] - v) * t);
        const intervals = intervalsAt(plan(p), walls);
        const top = intervals.length ? Math.max(...intervals.map(v => v[1])) : -Infinity;
        const gap = p[1] - top;
        shoreSamples++;
        maxShoreGap = Math.max(maxShoreGap, gap);
        // The deliberate 0.25 m lip at sea level is allowed; an open vertical
        // gap between the sampled terrain boundary and its wall is not.
        if (gap > .01 || top > Math.max(.25, p[1]) + .26) {
          if (failures.length < 30) failures.push({kind:'shore-seam', island:island.id, point:p, wallTop:top, gap});
        }
      }
    }
    for (const bridge of city.bridges.filter(b => b.fromIsland === island.id || b.toIsland === island.id)) {
      const len = distance(bridge.a, bridge.b), n = [-(bridge.b[1] - bridge.a[1]) / len, (bridge.b[0] - bridge.a[0]) / len];
      const half = bridge.width / 2 + bridge.sidewalkWidth;
      for (const side of [-.9, 0, .9]) {
        const a = bridge.a.map((v, i) => v + n[i] * half * side);
        const b = bridge.b.map((v, i) => v + n[i] * half * side);
        for (let i = 0; i < island.boundary.length; i++) {
          const hit = C.intersection(a, b, island.boundary[i], island.boundary[(i + 1) % island.boundary.length]);
          if (!hit) continue;
          supportSamples++;
          if (!covered(intervalsAt(hit.point, walls), -.3, bridge.deckElevation - bridge.deckThickness)) {
            failures.push({kind:'unsupported-shore-landing', bridge:bridge.id, island:island.id, point:hit.point});
          }
        }
      }
    }
  }
  if (shoreSamples < 100 || supportSamples < 18) failures.push({kind:'insufficient-shore-coverage', shoreSamples, supportSamples});
  mark('shore');

  const railFootprints = projection(rails);
  mark('railProjection');
  const railRoadOverlap = C.totalArea(C.boolean(railFootprints, city.roadCoverage, 'intersection'));
  const railOrdinaryOverlap = C.totalArea(C.boolean(railFootprints, city.landRoadCoverage, 'intersection'));
  if (railRoadOverlap > .02) failures.push({kind:'rail-or-post-in-carriageway', area:railRoadOverlap, ordinaryArea:railOrdinaryOverlap});
  const undersideTriangles = structure.filter(tri => horizontal(tri) && area(tri) > 0 &&
    city.bridges.some(b => Math.abs(tri[0][1] - (b.deckElevation - b.deckThickness)) < .001));
  const slabFootprints = projection(undersideTriangles);
  mark('slabProjection');
  const waterWalkAndRoad = C.boolean(city.rightOfWay, city.landRegions, 'difference');
  const unsupportedWaterArea = C.totalArea(C.boolean(waterWalkAndRoad, slabFootprints, 'difference'));
  if (unsupportedWaterArea > .04) failures.push({kind:'road-or-sidewalk-over-water-without-slab', area:unsupportedWaterArea});
  const unsupportedRailArea = C.totalArea(C.boolean(railFootprints, [...city.landRegions, ...slabFootprints], 'difference'));
  if (unsupportedRailArea > .02) failures.push({kind:'rail-or-post-without-support', area:unsupportedRailArea});
  mark('railAndSlabChecks');

  const walkTops = [...walks, ...curbs].filter(horizontal);
  for (const tri of walkTops) if (Math.abs(tri[0][1] - 8.16) > .001 || area(tri) >= 0) {
    failures.push({kind:'sidewalk-top-height-or-winding', point:tri[0]}); break;
  }
  const walkFootprints = projection(walkTops);
  mark('walkProjection');
  const sidewalkMissingArea = C.totalArea(C.boolean(city.sidewalkCoverage, walkFootprints, 'difference'));
  const sidewalkRoadOverlap = C.totalArea(C.boolean(walkFootprints, city.roadCoverage, 'intersection'));
  if (sidewalkMissingArea > .05 || sidewalkRoadOverlap > .05) failures.push({kind:'sidewalk-coverage', sidewalkMissingArea, sidewalkRoadOverlap});
  return {status:failures.length ? 'failed' : 'passed', elapsedMs:performance.now() - started, timings, input:city.input,
    shoreSamples, maxShoreGap, supportSamples, railRoadOverlap, railOrdinaryOverlap,
    unsupportedWaterArea, unsupportedRailArea, sidewalkMissingArea, sidewalkRoadOverlap, failures};
}"""


def check(page):
    """Check the current Cityworks scene without rebuilding or changing its view."""
    health = page.evaluate("() => {const {nonfinite, badNormals, validation} = Cityworks.inspect(); return {nonfinite, badNormals, validation};}")
    assert not health["nonfinite"] and not health["badNormals"] and not health["validation"], json.dumps(health, indent=2)
    result = page.evaluate(CHECK_SCRIPT)
    result["renderHealth"] = health
    assert result["status"] == "passed", json.dumps(result, indent=2)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser-executable")
    parser.add_argument("--html", type=Path, default=Path(__file__).resolve().parent.parent / "artifacts/v0.3/Cityworks-0.3.0-dev.html")
    parser.add_argument("--single-case", action="store_true", help="Check only the artifact's default scene")
    args = parser.parse_args()
    from playwright.sync_api import sync_playwright

    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            **({"executable_path": args.browser_executable} if args.browser_executable else {"channel": "chrome"}),
            headless=True,
            args=["--mute-audio", "--use-angle=d3d11", "--no-first-run", "--disable-background-networking"],
        )
        try:
            page = browser.new_page(viewport={"width": 1600, "height": 1100}, device_scale_factor=1)
            page.route("http://**/*", lambda route: route.abort())
            page.route("https://**/*", lambda route: route.abort())
            page.goto(args.html.resolve().as_uri())
            page.wait_for_function("window.Cityworks && Cityworks.ready && typeof Cityworks.geometrySnapshot === 'function'", timeout=60000)
            cases = [{}] if args.single_case else [{}, {"coastVariation": 0, "bridgeWidth": 18, "streetSpacing": 90}, {"coastVariation": 1, "bridgeWidth": 28, "streetSpacing": 130}]
            for input_values in cases:
                if input_values:
                    assert page.evaluate("input => Cityworks.rebuild(input)", input_values), "Scene rebuild failed"
                results.append(check(page))
        finally:
            browser.close()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
