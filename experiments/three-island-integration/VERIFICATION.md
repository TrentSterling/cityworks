# Reviewed planned-fabric checkpoint

Baseline: `fa348dd3cfebe38ac0eff8b3fd9d34cf4eb0e56a`. This focused pass keeps the three-island ground and connected road graph, and replaces repetitive lot division and scattered towers with district intent.

Default model: three islands, three bridges, 91 graph junctions, zero dead ends, 75 blocks, 473 parcels, 473 buildings and 484 volumes. It includes 194 actual corner lots, five towers in two skyline groups, and 37 shared interiors: 21 gardens, nine service yards, five pocket squares and two enclosed courts. Maximum generated height is 74.8 m. The enclosed courts have covered ground passages and open upper rings.

## Evidence

- `npm test` passed: 36 original model seed/control cases, 12 archipelago regressions, six road-paint cases and 12 building-plan groups. These include deterministic rebuilds, footprint/road/water/setback exclusion, parcel access and overlap tolerances, deliberate skyline groups, frontage variation, reserved interiors and ground passages.
- Exact tower edits from 6 to 180 m, small edits, density changes and local edit identity checks pass. The independent reviewer also checked courtyard edits at 6, 6.8, 6.801, 13.6 and 180 m, with unrelated building records preserved.
- Isolated muted Chrome rendered nine views without page errors, nonfinite attributes or invalid normals. Structural checks covered 6,330 facade/roof triangles without degeneracy or reversed winding; 1,415 cornice/awning/shed footprints passed full parcel containment.
- Downward rays through both courtyard holes and horizontal rays through both ground passages found no building obstruction. Upward rays hit both passage ceilings at the expected elevation. Tree sites keep canopy clearance from the reserved access corridors.
- Actual interactions passed: six repeated visibility toggles, mobile layout at 390 x 844, JSON export, a tower height edit to 6 m and a new-seed rebuild clearing incompatible edits.
- Independent review found no remaining blocker after passage ceilings and entrance tree clearance were fixed. Six additional seed/extreme cases passed. Small Boolean snapping seams remain within the numerical tolerance; the worst reserved-court/parcel seam observed was about 0.038 square metres.
- All ten original upstream hashes and all four derived NY module hashes remain unchanged. No additional reference implementation was copied in this pass.

`evidence/parcel-quality-comparison.png` preserves the delivered baseline beside the new district using identical cameras. The New York comparisons use the same view direction, 55-degree lens and midday lighting, with different map data and workloads. The single HTML preview also passed a direct-file smoke test with one local file request and no missing-module or renderer errors.

## Measured render work

1600 x 1100, pixel ratio 1, pinned WebGPU Three.js, Slop midday lighting and shadows. These are observed renderer counters including shadow work, not device performance guarantees.

| View | Baseline draws | Current draws | Baseline triangles | Current triangles |
| --- | ---: | ---: | ---: | ---: |
| Three islands | 37 | 39 | 206,233 | 208,341 |
| Overhead | 58 | 60 | 293,540 | 285,731 |
| District | 87 | 86 | 356,817 | 351,951 |
| Street | 87 | 86 | 389,738 | 381,462 |
| Bridge | 81 | 83 | 375,323 | 364,399 |
| Courtyard | 83 | 79 | 402,281 | 397,596 |

The street view uses one fewer draw and 8,276 fewer rendered triangles (2.12%). The aerial view adds two draws and 2,108 triangles (1.02%). Court surfaces add three resident materials, bringing the scene from 36 to 39. The new passage view uses 77 draws and 383,369 triangles. No general performance improvement is claimed.

The earlier surveyed NYC crop reported 109 draws and 421,601 triangles for 342 records. Differences in terrain, trees, visibility and streaming make it an unequal workload. `render.calls` is cumulative and is not used as a per-frame draw count. Build timing excludes shader compilation and subsequent streaming.

## Remaining gap

Actual matched views show larger corners, varied roof widths, two deliberate skyline groups and planned internal gardens/yards. The city still falls short of the surveyed reference's architectural specificity: facade palettes, roof treatments and ground floors remain repetitive. Ground transitions and simple bridges are prototype quality. Street frontage is placement semantics, not authored entrances or a pedestrian navigation system. Traffic, authored landmarks, full-app reflections/post-processing and night lighting are absent or untested.

Courtyard height edits at or below 6.8 m leave an uncovered entrance opening. The changed parcel algorithm changes identities relative to the previous checkpoint; deterministic and unaffected-edit guarantees apply within this generator revision, not across arbitrary algorithm migrations. Small Boolean snapping seams remain possible.

The next visual target is street-level ground-floor and facade differentiation tied to district intent. This pass does not establish parity with the complete Slop New York app.
