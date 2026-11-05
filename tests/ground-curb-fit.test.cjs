/* Geometry-only regression: execute the maintained ground mesh builder with
 * vendored Three.js math, the exact runtime triangulator and inert materials. This does
 * not exercise WebGPU shaders, browser controls or visual quality. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/building-plan.js');
const Realm = require('../src/public-realm.js');
const Three = require('../vendor/three.r140.min.js');
async function main() {
const { ShapeUtils } = await import('./vendor/three-runtime-triangulator/ShapeUtils.js');
const T = { ...Three, ShapeUtils };
const root = path.resolve(__dirname, '..');
const sourcePath = process.argv[2] || path.join(root, 'experiments/three-island-integration/ground.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/^import .*$/mg, '')
  .replace('export function buildGround', 'function buildGround');
const material = () => new T.MeshStandardMaterial();
const context = vm.createContext({
  T: { ...T, MeshStandardNodeMaterial: T.MeshStandardMaterial },
  CityFabric: C,
  CityPublicRealm: Realm,
  CityRoadMarkings: require('../src/road-markings.js'),
  SHOP: require('../src/facade-rules.js').storefront,
  createRoadSurfaceMaterial: material,
  createSidewalkMaterial: material,
  createCurbMaterial: material,
  createDryRoadMaterial: material,
  createMetricPaintMaterial: material
});
vm.runInContext(source, context, { filename: sourcePath });

const cases = process.env.CITYWORKS_CURB_CASE === 'default' ? [{}] : [
  {},
  { seed: 'CURB-NARROW', coastVariation: 0, streetSpacing: 90, bridgeWidth: 18 },
  { seed: 'CURB-WIDE', coastVariation: 1, streetSpacing: 130, bridgeWidth: 28 },
  { seed: 'CURB-LARGE', mapAreaKm2: 3.2, coastVariation: 1, streetSpacing: 90, bridgeWidth: 28 }
];
const tiny = [C.shape(C.rect(0, 0, .02, .02))];
assert.equal(C.boolean(tiny).length, 0, 'Generator default area threshold is unchanged');
assert.equal(C.boolean(tiny, [], 'union', 0).length, 1, 'Renderer can preserve valid tiny fragments');
const results = [];
for (const input of cases) {
  const city = C.generate(input), before = JSON.stringify(city), scene = new T.Scene();
  const start = performance.now();
  context.buildGround(scene, city);
  const buildMs = performance.now() - start;
  assert.equal(JSON.stringify(city), before, 'Rendering must preserve streets, buildings and saved-city data');
  scene.updateMatrixWorld(true);
  const meshes = ['sidewalks', 'curbs'].map(name => scene.getObjectByName(name));
  const ray = new T.Raycaster();
  function hitsAt(p) {
    ray.set(new T.Vector3(p[0], 10, p[1]), new T.Vector3(0, -1, 0));
    return ray.intersectObjects(meshes, false);
  }
  for (const mesh of meshes) {
    assert.ok(mesh, 'Both pavement material batches must exist');
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal;
    for (const x of p.array) assert.ok(Number.isFinite(x), 'Finite packed pavement positions');
    for (let i = 0; i < n.count; i++) {
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .001,
        'Pavement triangles must remain nondegenerate after Float32 packing');
    }
  }
  // Independently identify regions the retained curb cleanup removes. Check
  // actual packed mesh hits there, not just a Boolean area or model polygon.
  const rampZones = city.publicRealm.ramps.flatMap(r => r.polygons);
  const curbTops = C.boolean(C.boolean(C.offset(city.roadCoverage, .18), city.roadCoverage, 'difference'), city.sidewalkCoverage, 'intersection');
  const trimmed = C.boolean(curbTops, rampZones, 'difference');
  const cleaned = C.boolean(C.offset(C.offset(trimmed, -.005), .005), trimmed, 'intersection');
  const removed = C.boolean(trimmed, cleaned, 'difference');
  let seamSamples = 0, boundarySamples = 0;
  const gridTolerance = 1 / C.SCALE;
  const edgeDistance = (hit, p) => {
    const a = hit.object.geometry.attributes.position, face = hit.face;
    const ring = [face.a, face.b, face.c].map(i => [a.getX(i), a.getZ(i)]);
    return Math.min(...ring.map((a, i) => C.projection(p, a, ring[(i + 1) % 3]).distance));
  };
  for (const part of removed) {
    const points = [part.outer, ...part.holes].flat();
    const triangles = T.ShapeUtils.triangulateShape(part.outer.map(p => new T.Vector2(...p)), part.holes.map(r => r.map(p => new T.Vector2(...p))));
    for (const ids of triangles) {
      const tri = ids.map(i => points[i]);
      if (Math.abs(C.area(tri)) < .00001) continue;
      const p = [0, 1].map(axis => tri.reduce((sum, v) => sum + v[axis], 0) / 3);
      const hits = hitsAt(p).filter(h => Math.abs(h.point.y - 8.16) < .0001);
      // Integer clipping rounds new intersections to a 1 mm grid. Accept only
      // a boundary residual within that single grid cell, never a wider gap.
      if (!hits.length) {
        const neighbors = Array.from({ length: 16 }, (_, i) => {
          const angle = i * Math.PI / 8;
          return [p[0] + Math.cos(angle) * gridTolerance, p[1] + Math.sin(angle) * gridTolerance];
        });
        assert.ok(neighbors.some(q => hitsAt(q).some(h => Math.abs(h.point.y - 8.16) < .0001)),
          `${city.input.seed}: uncovered curb seam beyond clipping precision at ${p}`);
        boundarySamples++;
      }
      if (new Set(hits.map(h => h.object.name)).size > 1) {
        assert.ok(hits.every(h => edgeDistance(h, p) <= gridTolerance),
          `${city.input.seed}: coplanar sidewalk/curb overlap beyond clipping precision at ${p}`);
        boundarySamples++;
      }
      seamSamples++;
    }
  }
  assert.ok(seamSamples > 50, 'Fixture must exercise substantial cleanup remnants');
  // The infill must not cap a lowered ramp or alter either flared slope.
  let rampSamples = 0;
  for (const r of city.publicRealm.ramps) {
    for (const along of [0, -r.halfWidth - .35, r.halfWidth + .35]) {
      const p = r.center.map((v, i) => v + r.n[i] * r.run * .35 + r.u[i] * along);
      const hits = hitsAt(p), expected = Realm.rampHeight(r, p);
      assert.ok(hits.length && Math.abs(hits[0].point.y - expected) < .004,
        `${city.input.seed}: ramp capped or missing at ${r.id}, ${along}`);
      rampSamples++;
    }
  }
  let meshBatches = 0, triangles = 0;
  scene.traverse(object => {
    if (!object.isMesh) return;
    meshBatches++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    object.geometry.dispose();
    object.material.dispose();
  });
  const result = { seed: city.input.seed, cleanupMaskArea: C.totalArea(removed), seamSamples, boundarySamples, gridTolerance, rampSamples, meshBatches, triangles, buildMs };
  results.push(result);
  console.log('PASS emitted curb/sidewalk fit', JSON.stringify(result));
}
console.log(JSON.stringify({ status: 'passed', geometryOnly: true, cases: results }));

}
main().catch(error => { console.error(error); process.exitCode = 1; });
