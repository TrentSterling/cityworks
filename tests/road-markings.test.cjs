const assert = require('node:assert/strict');
const C = require('../src/archipelago.js');
const T = require('../vendor/three.r140.min.js');
require('../src/road-markings.js');

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cases = [
  {},
  { seed: 'PAINT-1', coastVariation: 1, streetSpacing: 110, bridgeWidth: 18 },
  { seed: 'PAINT-2', coastVariation: 0, streetSpacing: 130, bridgeWidth: 28 },
  { seed: 'PAINT-3', coastVariation: 1, streetSpacing: 90, bridgeWidth: 18 },
  { seed: 'PAINT-6', coastVariation: 0, streetSpacing: 90, bridgeWidth: 28 },
  { seed: 'PAINT-14', coastVariation: 0, streetSpacing: 130, bridgeWidth: 28 }
];

let checkedStrips = 0;
let checkedBars = 0;

for (const input of cases) {
  const city = C.generate(input);
  const paint = globalThis.CityRoadMarkings(T, C, city);
  const geometry = paint.mesh.geometry;
  const label = city.input.seed;
  try {
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      for (const value of attribute.array) {
        assert.ok(Number.isFinite(value), `${label}: nonfinite ${name}`);
      }
    }
    const normals = geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
      assert.ok(Math.abs(length - 1) < .001, `${label}: invalid paint normal`);
      assert.ok(normals.getY(i) > .999, `${label}: paint must face upward`);
    }

    const incidence = new Map(city.nodes.map(node => [node.id, []]));
    for (const edge of city.streets) {
      incidence.get(edge.from).push(edge);
      incidence.get(edge.to).push(edge);
    }

    // Inspect emitted mesh quads; do not reproduce the placement/clearance rule.
    const positions = geometry.attributes.position.array;
    let barsInCase = 0;
    for (let i = 0; i < positions.length; i += 12) {
      const ring = [];
      for (let j = 0; j < 12; j += 3) ring.push([positions[i + j], positions[i + j + 2]]);
      const region = C.shape(C.canonical(ring));
      const outside = C.totalArea(C.boolean([region], city.roadCoverage, 'difference'));
      assert.ok(outside < .01, `${label}: paint strip ${i / 12} leaves asphalt by ${outside} m²`);
      checkedStrips++;

      // Zebra bars have a metric 2.5 m length and 0.6 m width. Recover their
      // supporting road from orientation and location in the emitted geometry.
      const length = distance(ring[1], ring[2]);
      const width = distance(ring[0], ring[1]);
      if (Math.abs(length - 2.5) > .002 || Math.abs(width - .6) > .002) continue;
      barsInCase++;
      checkedBars++;
      const middle = [0, 1].map(axis => ring.reduce((sum, point) => sum + point[axis], 0) / 4);
      const direction = [0, 1].map(axis => (ring[2][axis] - ring[1][axis]) / length);
      const candidates = city.streets.filter(edge => {
        const edgeLength = distance(edge.a, edge.b);
        const alignment = Math.abs(
          (edge.b[0] - edge.a[0]) * direction[0] +
          (edge.b[1] - edge.a[1]) * direction[1]
        ) / edgeLength;
        return alignment > .99999 && C.projection(middle, edge.a, edge.b).distance <= edge.width / 2 + .001;
      }).sort((a, b) =>
        C.projection(middle, a.a, a.b).distance - C.projection(middle, b.a, b.b).distance
      );
      const own = candidates[0];
      assert.ok(own, `${label}: zebra bar ${i / 12} has no supporting road`);

      const neighbors = new Set([...incidence.get(own.from), ...incidence.get(own.to)]);
      for (const other of neighbors) {
        if (other.id === own.id) continue;
        const overlap = C.totalArea(C.boolean(
          [region], [C.corridor(other.a, other.b, other.width)], 'intersection'
        ));
        assert.ok(overlap < .01,
          `${label}: zebra bar on ${own.sourceId} intrudes ${overlap} m² into ${other.sourceId}`);
      }
    }
    assert.ok(barsInCase > 100, `${label}: regression fixture must contain substantial zebra paint`);
    console.log(`PASS emitted road paint: ${label}, ${barsInCase} zebra bars`);
  } finally {
    geometry.dispose();
    paint.mesh.material.dispose();
  }
}

console.log(`${cases.length} paint cases passed; ${checkedStrips} strips and ${checkedBars} zebra bars checked`);
