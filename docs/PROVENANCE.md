# Dependencies and provenance

Cityworks uses synthetic geometry. Its planning rules, street graph construction, frontage parcel allocation and identity rules are original Cityworks code. The renderer includes the MIT-licensed Slop New York adaptations identified below. The isolated Slop adapter experiment additionally includes unchanged licensed building modules and comparison screenshots; its optional surveyed-data download remains separate and ignored by Git. This project is not represented as a certified clean-room implementation.

## Runtime dependencies

| Dependency | Version | Source | License |
| --- | --- | --- | --- |
| Three.js | r140 | https://github.com/mrdoob/three.js/tree/r140 | MIT |
| Javascript Clipper | npm `clipper-lib@6.4.2`, internal 6.4.2.2 | https://www.npmjs.com/package/clipper-lib/v/6.4.2 | Boost Software License 1.0, with JSBN notices |

Both distributions are vendored without modifications. Three.js renders the preview. Clipper performs polygon Boolean and offset operations; this is licensed dependency reuse. Its public API documentation is at https://sourceforge.net/p/jsclipper/wiki/documentation/.

Clipper source SHA-256: `a650c6946682edc1a64016f6553eeb5c32ce45eb7ca0ad5d8221961af011d97c`.

Full notices are in `THIRD_PARTY_NOTICES.txt`, `vendor/clipper-BOOST-LICENSE.txt` and `vendor/clipper-JSBN-LICENSE.txt`. The standalone build embeds these notices. Original dependency headers remain intact.

## Public behavioral references

- [slop-newyork](https://github.com/mrdoob/slop-newyork): metric facade scale and shared opaque materials informed version 0.2 without code reuse. Version 0.3 adds the explicitly attributed road components below; no geodata is included.
- [Epic City Sample PCG documentation](https://dev.epicgames.com/documentation/unreal-engine/city-sample-pcg-for-unreal-engine): boundary, artery, district, block, lot and park planning behavior. No Epic implementation or assets copied.

Cityworks currently has no project-wide license for its original code. Third-party dependencies retain their own licenses.

## Version 0.3 development

`src/road-markings.js` adapts the metric strip primitive from `js/road-paint.js` in Slop New York commit `13dd142b480bcfa01a6b18e36127c87e41cb4d80`. Copyright (c) 2026 Mr.doob, MIT; full license is retained in `vendor/slop-newyork-MIT.txt`. Network placement, street hierarchy, terrain, island geometry and junction coverage are Cityworks code.

`src/road-material.js` ports the same pinned source's `tsl-materials.js` hash/noise, utility-cut patches and two-scale aggregate shading from TSL to GLSL. This dry-road subset retains MIT attribution and omits wetness, reflections and potholes. `buildings.js` was inspected for footprint/detail separation; no building implementation or geographic data has been copied into this ground milestone.

Planning references: [NACTO intersection principles](https://nacto.org/publication/urban-street-design-guide/intersections/intersection-design-principles/), [urban lane widths](https://nacto.org/publication/urban-street-design-guide/street-design-elements/lane-width/), and [NYC street geometry](https://www.nycstreetdesign.info/geometry). The prototype applies compact junctions, distinct travel/sidewalk widths and network continuity as design goals; it is not an engineering compliance tool.

## Isolated data adapter experiment

`experiments/slop-data-adapter` directly reuses pinned MIT New York building/facade/detail/lighting modules and the Singapore supplied-building decoder. Full provenance, unchanged-file hashes, dependency pins, comparison-data attribution and limitations are recorded in its [README](../experiments/slop-data-adapter/README.md) and `upstream/manifest.json`. The production v0.3 app remains separate. No new license is selected for Cityworks original code.

## Three-island building integration

`experiments/three-island-integration/adapted-nyc` contains four MIT derivatives of the pinned New York building/facade modules. The original ten-file reference baseline remains byte-identical. See the integration adapter change inventory and hash manifest for explicit elevation, frontage, seed and local facade-coordinate changes. `src/building-plan.js`, the adapter and preview control code are original Cityworks work. Ground geometry is carried forward from Cityworks v0.3; dry-road noise retains its MIT attribution. No surveyed geographic data is added to the repository or runnable integration.

The planned-fabric update adds original `src/parcel-patterns.js` for district subdivision, reserved court access and skyline placement. Its rules and passage geometry are Cityworks implementation, with no additional third-party source copied.

## Scoped editing study

Before implementing project transactions, the editor work inspected the user's Metroforge Road Lab 0.6 architecture and targeted editor state code, Building 008's documented seed/override/recipe structure, and the pinned Slop integration's immutable build inputs and detail pools. These informed separation of authoring data, validated candidates and derived preview state. No code from those additional local generators was copied into this milestone. `src/editor-state.js`, scoped seed changes, selection hooks and the editor UI are original Cityworks code. The existing ten upstream reference files and four declared New York derivative modules remain unchanged. This is documented reference-informed development, not a clean-room claim.
