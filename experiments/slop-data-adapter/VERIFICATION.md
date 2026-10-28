# Adapter verification checkpoint

The generated map contains 57 nodes, 78 road segments, 26 blocks and 181 frontage parcels/buildings. The generator's 11 check groups pass, including invalid inputs, full containment, shared crossing nodes, non-overlap and conservative SG quantization. Existing Cityworks regressions also pass: 36 v0.2 seeds, 12 archipelago cases and six road-paint cases.

All 10 copied upstream modules match their pinned SHA-256 manifest. Independent CPU review executed the unchanged NY footprint builder across all 181 records: 1,881 structural triangles, zero nonfinite attributes, degeneracy, reversed winding, missing roof area or roof area outside the intended footprints. The independent reviewer also decoded the corrected SG payload: no footprint area outside original envelopes, land, right-of-way exclusions or parcels; shortest decoded edge about 0.943 m. Seed-NaN and point-contact-hole findings were subsequently fixed and have explicit regression cases.

Muted isolated Chrome rendered both pipelines and the optional NYC comparison crop. All three runs have finite geometry/normals and no page-script errors. Actual mesh ray probes leave the generated courtyard and concave notch empty in both paths. An executed SG API probe confirms that null returns null, while an empty packed set returns a truthy object containing zero colliders and footprints. This explains the full app's different fallback behavior.

## Measured cost

Same 1600 × 1100 viewport, original NY midday lighting and matched camera pose. `drawCalls` and triangles below are the renderer's submitted frame totals, including shadow passes. The unrelated `render.calls` counter is cumulative and is not used. Resident material count includes initialized pools, not just visible materials.

| Data and path | Buildings | Street draws | Street triangles | Overhead draws | Overhead triangles | Resident materials |
|---|---:|---:|---:|---:|---:|---:|
| Generated, original NY | 181 | 118 | 81,369 | 119 | 80,053 | 50 |
| Surveyed crop, original NY | 342 | 109 | 421,601 | 106 | 416,865 | 48 |
| Generated, SG | 181 | 73 | 6,973 | 74 | 5,155 | 42 |

These are unequal workloads. The SG path omits NY detail pools and uses different style rules; it also receives the explicitly inset/quantized geometry. The NYC crop has more buildings and far more fire escapes. Draw counts do not imply equivalent visual quality. Ground here is rendered in multiple simple polygon batches; it is not a production batching benchmark. `buildMs` in the raw evidence excludes shader compilation and later streaming. No device FPS, VR or Quest performance claim is made.

## Visual findings

The refreshed street views have open asphalt and readable sidewalk edges. The courtyard has an open roof and inward-facing facades. Slop's original windows, interiors, masonry, roof equipment, fire escapes and cornices materially improve the generated footprint layout without a new Cityworks facade implementation.

The generated city still has repetitive parcel widths/depths, consistent gaps and overly simple full-height extrusions. The surveyed crop has adjoining buildings, irregular rear wings and richer roof-height rhythm. The complete Slop app additionally supplies traffic, vegetation, markings, furniture, landmarks and post-processing that this controlled harness excludes. Coast/terrain and bridge integration remain in the separate three-island work, not demonstrated by the flat compatibility surface here.

| Evidence | Purpose |
|---|---|
| [Street comparison](evidence/Cityworks-Slop-street-comparison.png) | Same camera and lighting; original NY detail path versus surveyed crop and SG path |
| [Plan comparison](evidence/Cityworks-Slop-overhead-comparison.png) | Street coverage, footprint organization and courtyard geometry |
| [Courtyard](evidence/generated-nyc-courtyard.png) | Actual hole and architectural detail |
| [Ground only](evidence/generated-nyc-ground.png) | Generated streets remain visible with buildings hidden |
| [Browser results](evidence/browser-results.json) | Metrics, camera poses, void probes and null/empty behavior |

Comparison screenshots credit NYC Open Data and OpenStreetMap contributors where surveyed geography appears. The optional downloaded geometry is ignored by Git. This checkpoint proves compatibility of the building path; it does not establish complete-city parity or universal acceptance of arbitrary map data.
