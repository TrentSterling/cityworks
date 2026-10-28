# Three-island building integration

Run from the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/experiments/three-island-integration/` in a WebGPU-capable browser. Three.js is fetched from a commit-pinned CDN, so the preview requires network access. No account, API key or installation is required. `python experiments/three-island-integration/build_preview.py` also produces a single HTML file in `artifacts/three-island-integration`; it opens directly and bundles all local modules, retaining the same pinned external Three.js dependency. No changes are deployed to the public Cityworks app by this branch.

The live generator now executes this sequence:

1. Three distinct islands, graded ground and a connected road/bridge graph.
2. Boolean road and sidewalk coverage, then blocks from remaining land.
3. District-specific frontage widths and depths, deliberate corner lots and reserved shared interiors with street access.
4. Explicit footprint rings, courtyards, podium/tower volumes, base/top elevations and stable seeds.
5. A documented derivative of the pinned NY facade and streamed detail system.

Default output: 473 parcels, 473 buildings and 484 volumes. Five towers form two planned skyline groups. The 37 shared interiors include 21 gardens, nine service yards, five pocket squares and two enclosed courts. The enclosed courts have ground-level passages with ceilings, and retain their holes above. All building footprints are checked against full parcel setbacks, land and road/sidewalk exclusion, not just centroid tests.

Use the view buttons, orbit/zoom, hide buildings, change the seed or export the engine-neutral JSON. Click a building to edit its height from 6 to 180 metres. An explicit height edit is exact; generated heights use a 3.4 m planning increment. Rebuilds reload the preview so old GPU resources are released. Changing the seed clears incompatible building edits. Query parameters also accept `density`, `skylineHeight`, `coastVariation`, `streetSpacing` and `bridgeWidth` within the ground model's documented limits.

Identity is based on parcel geometry and deterministic keys. Density changes and one-building height edits preserve parcel/road IDs and unaffected building records within this generator revision. The new parcel algorithm changes the previous checkpoint's parcel identities; there is no cross-version edit migration. Topology edits can replace parcels; this is not a universal persistent-ID reconciliation system. Detail placement near an edited neighbor can legitimately change as its clearance changes. Editing an enclosed courtyard building to 6.8 m or lower leaves an uncovered entrance opening because its upper ring no longer exists.

Validation: `npm test`, then `python experiments/three-island-integration/verify_browser.py` under the host's browser/GPU coordination rules. The latter uses isolated muted headless Chrome, records finite geometry, roof holes, winding, detail containment, render costs, mobile layout and actual edit/export interactions. See `VERIFICATION.md` and `evidence/` for the reviewed run.

This is executable integration, not visual parity with the complete Slop New York. Matched views now show varied plot widths, two skyline groups and planned block interiors, but facade palettes, roof treatments and ground floors remain repetitive. The coastline and inland terrain treatment are still coarse; bridges are simple prototype structures. Shops have procedural frontage and signs, not authored entrances or interiors. The NYC comparison uses real surveyed footprints and a different workload. The next visual target is stronger street-level ground-floor and facade differentiation tied to the generated district intent.

See [adapter changes and attribution](ADAPTER_CHANGES.md), [the original source trace](../slop-data-adapter/SOURCE_TRACE.md) and the [existing provenance inventory](../../docs/PROVENANCE.md).
