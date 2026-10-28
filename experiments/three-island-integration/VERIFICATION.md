# Reviewed integration checkpoint

Default model: three islands, three bridges, 91 graph junctions, zero dead ends, 75 blocks, 600 frontage parcels, 598 buildings, 614 volumes. Maximum generated building height is 61.2 m. Sixteen buildings have an explicit set-back upper volume. Two planned courtyard blocks and nine additional holed service-court footprints remain open.

## Evidence

- Existing geometry/model, archipelago and road-paint suites passed: 36 original district seed/control cases, 12 archipelago regressions and six paint cases.
- Nine new building-plan groups passed, including repeated byte-identical generation, full setbacks/land/road exclusion, parcel nonoverlap and access, courtyard/concave polygons, a local height edit preserving unrelated records, density edits preserving topology/IDs, and four varied seed/spacing/coast cases.
- Exact tower edits at 6, 6.8, 8.4, 13.6 and 180 m pass. Low towers become one valid volume instead of retaining a zero-height upper part.
- Isolated muted Chrome rendered seven views with no page errors, nonfinite attributes or invalid normals. Its structural probe checked 6,996 facade/roof triangles with zero degeneracy or reversed winding. Roof rays through both planned courtyard holes returned no building hit.
- 1,279 cornice/awning/shed footprints passed full parcel containment. The independent reviewer separately checked all 614 volumes for roof coverage, winding, road/water intrusion and self-crossing rings. Small Boolean snapping seams between parcels totaled about 0.019 square metres, within the stated numerical tolerance.
- Actual browser interactions passed: six visibility toggles, mobile layout at 390 × 844, JSON download, a tower height edit to 6 m, and a new seed rebuild clearing incompatible edits.
- Ten original upstream files still match their recorded byte hashes. Four derived modules have separate hashes and a written change inventory.

The independent review found and prompted fixes for low-height towers, the 16 cm building-base gap, and signs/lights left at world-ground heights. Visual inspection also prompted volume-local facade floor coordinates and restrained ground surfacing under the reference lighting.

## Measured render work

1600 × 1100, pixel ratio 1, pinned WebGPU Three.js, original Slop midday lighting and shadows. These are observed renderer counters for this harness, including its shadow work; they are not device performance guarantees.

| View | Draw calls | Rendered triangles |
| --- | ---: | ---: |
| Three islands | 37 | 206,233 |
| District | 87 | 356,817 |
| Street | 87 | 389,738 |
| Bridge | 81 | 375,323 |
| Courtyard | 83 | 402,281 |

The scene retains 36 distinct materials. The earlier NYC reference crop's street capture reported 109 draw calls and 421,601 triangles for 342 surveyed records. Different maps, terrain, trees, visibility and streaming make these unequal workloads; the counts do not establish a speed advantage or visual parity. `render.calls` in raw reports is cumulative and is not used as a per-frame draw count. Build time excludes shader compilation and subsequent streaming.

## Remaining gap

The generator now feeds the proven facade system with coherent parcels and volumes. It still lacks the surveyed reference's irregular historical plot pattern, differentiated rooflines and deliberate skyline clusters. Large block interiors and courtyard passages are unfinished. The coast, ground transitions and simple bridge geometry remain prototype quality. A faint water/sky transition remains at the far plane; the obvious finite water-plane corners were removed. Street frontage is semantic placement for walls and awnings, not an authored door/accessibility system. Traffic, authored landmarks, full-app reflections/post-processing and night lighting are untested or absent.

The next implementation target is planned parcel and volume variation at district scale, with coherent courtyard access and ground transitions. Random prop density will not close those gaps.
