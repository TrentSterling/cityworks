# Generated map data through Slop's building systems

This is a runnable adapter experiment, not a replacement for the current Cityworks release. It proves that original Cityworks streets, parcels and footprint polygons can feed the **unchanged Slop New York building, facade and architectural-detail code**. It also runs the same district through the Singapore fork's supplied-footprint decoder.

## Run

From the repository root:

```sh
node experiments/slop-data-adapter/generate.cjs
python -m http.server 8000 --directory experiments/slop-data-adapter
```

Open `http://localhost:8000`. A WebGPU-capable browser and internet access to the pinned Three.js dependency on jsDelivr are required. The generated dataset is included, so generation is optional for viewing. No account, API key, global install, audio system or model inference is used.

- Default: original New York building and detail path.
- `?pipeline=sg`: unmodified Singapore supplied-footprint path.
- `?data=nyc`: surveyed comparison crop. First run `node experiments/slop-data-adapter/fetch-nyc-sample.mjs`; it downloads the pinned public data and saves an ignored local fixture. It is not included in the public source or source bundle.

The comparison uses the same 1600 × 1100 viewport, 55° lens, camera poses and original Slop midday lighting. The NYC crop is translated to align Sixth Avenue with the generated arterial. It has 342 buildings versus 181 generated buildings. This is a controlled building-pipeline comparison, **not a reproduction or performance benchmark of the full Slop New York app**. Original city landmarks, traffic, trees, street furniture, SSR and final post-processing are absent. The simple common ground harness uses original Slop road and sidewalk materials over each map's road coverage.

## What actually runs

`generate.cjs` calls the existing original Cityworks v0.2 planning model to produce a bounded concave island, noded streets, Boolean road coverage, blocks, frontage parcels and footprint envelopes. It retains the parcel IDs and height intent, and adds one explicit courtyard and one concave notch inside existing envelopes. This is deliberate reuse of our map generator, not reuse of its old renderer. The three-island v0.3 ground branch is preserved separately.

`data.js` adapts those outputs to the `REAL_BUILDINGS` records consumed by New York's `buildCityBlocks`. Browser import-map substitutions replace only city data, NYC feature configuration and optional pocket-park sites. `upstream/nyc/buildings.js`, `building-footprints.js`, `building-details.js`, `building-collision.js`, `fire-escapes.js`, `tsl-materials.js` and `lighting.js` remain byte-for-byte upstream. SHA-256 evidence is in `upstream/manifest.json`.

The original NY path generates walls and roofs, metric facade coordinates, neighbor-aware party walls, cornices, water towers, HVAC, fire escapes, awnings and scaffold sheds. The SG path decodes `GEO.buildings` and renders instanced wall quads and merged roofs. It does not invoke the NY detail pools. Lower cost alone does not make it equivalent quality.

The common ground harness is adapter-owned and flat. It is not Slop's complete city-grid generator, and the emitted GEO v2 land/graph/block fields have not been exercised through every SG game subsystem. Only the supplied-building decoder is proven here. `GEO.blocks` deliberately has empty fallback lot rectangles; this fixture is not a validated procedural-lot fallback city.

## Observed source contract

See [source trace](SOURCE_TRACE.md) for the ingestion chain and [generator contract](GENERATOR_CONTRACT.md) for the boundary Cityworks should own.

The important result is architectural: **streets do not generate Slop's surveyed buildings**. A producer supplies internally consistent land, street coverage and building geometry. Slop then generates rendering detail from those footprints and attributes.

## Validation

`generate.cjs` checks graph crossings, connectivity, coverage, parcel frontage, full footprint containment and setbacks, non-overlap, IDs, finite heights, ring topology and invalid metadata. It rejects invalid height rather than inventing one. Missing year becomes explicit unknown (`0`). Synthetic years are disclosed style controls, not historical facts.

SG uses a 0.1 m coordinate grid and skips wall edges shorter than 0.4 m. Naive rounding failed review by pushing footprints outside their setback envelope. This experiment applies an explicit 0.25 m inset and 0.2 m cleaning tolerance, then validates the quantized result against the original envelope, hole count and minimum edge length. It retains all 181 buildings but reduces total footprint area by about 4.7%. NY receives the original millimetre-precision rings. The files record both forms; there is no silent repair of the source dataset.

`verify_browser.py` uses isolated muted headless Chrome. It checks finite geometry and normals, saves matched views, and ray-tests the courtyard and concave notch against the actual building meshes. Browser rendering requires an available GPU lease in shared development environments. Saved local reports are under `artifacts/slop-adapter/`.

## Remaining gaps and next target

The generated district is still too uniform in parcel depth, setback and building profile. The NYC sample has finer-grained adjoining buildings, varied rear wings and roof heights. The original NY path treats every record as a ground-rooted extrusion; this spike does not preserve Cityworks podium/tower parts or rising terrain. Its year-based material heuristics also turn unknown years into modern glass. Neither path consumes our frontage edge to choose entrances, and the SG packed format drops stable IDs/seeds in favor of record order for facade variation.

The next implementation target is a renderer-independent map contract with street corridor and sidewalk polygons, valid buildable blocks, frontage parcels, and attributed building volumes with base/top elevations. Then connect the three-island ground model to that contract and adapt the NY detail renderer narrowly for explicit style, stable seed, frontage and terrain base. Preserve the proven metric facade and detail code rather than independently approximating it. Full reference quality is not established by this spike.

## Provenance

Slop New York: [13dd142](https://github.com/mrdoob/slop-newyork/tree/13dd142b480bcfa01a6b18e36127c87e41cb4d80), MIT, copyright 2026 Mr.doob. Singapore fork: [69c6329](https://github.com/zz85/slop-singapore/tree/69c6329da3cab9c1b1f6a81ceeb1f3dfeb3db13c), same retained MIT license. Complete licenses are alongside each upstream module set. Direct licensed reuse is intentional; no clean-room claim is made.

Three.js is pinned to `b3396270682287470d161658ac01084d25e8dba6`, matching the original NY import map, and retains its MIT license. Clipper retains the repository's Boost/JSBN notices. Cityworks original code retains its existing unspecified project-license status.

Optional comparison data is separate from code licensing: NYC Open Data [building footprints/heights](https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue), NYC street geography and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL where applicable. The sample script retains pinned source and hashes. Screenshot comparisons credit these sources and are not surveys or engineering plans.
