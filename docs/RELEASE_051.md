# Cityworks 0.5.1: usable buildings and scoped editing

The previous generator could extrude a long residual strip solely because its area was large enough. Its facade shader rounded to at least one bay even when a wall was narrower than a window. This release treats usable building geometry and window eligibility as separate constraints.

## Building rules

- Each footprint component needs at least **120 m²**, an eroded core surviving a **4 m inward offset** with at least **4 m²** remaining, and a minimum-area oriented rectangle aspect ratio no greater than **6:1**. This requires an approximately 8 m usable thickness; an axis-aligned bbox is insufficient.
- Erode the footprint, expand the surviving core by finite sweeps in the parcel frontage frame, then intersect it with the allowed envelope. This removes thin concave appendages and acute residual tips without re-growing unlimited mitres. Rectilinear parts retain their corners. A 3 mm inward numerical margin prevents repeated Boolean rounding from crossing the setback boundary.
- Apply the same checks after notches, courtyard passages and tower setbacks. Courtyard holes and access remain explicit. Short chamfer/return faces can still exist on a valid broad building; these receive solid facade treatment.
- Detached buildings reserve **6 m minimum inter-building clearance**, with **8 m service clearance** on the harbour. The test measures actual Euclidean edge clearance, not an expanded mitered bbox. Frontage patterns were widened so the clearance rule does not turn ordinary lots into thin remnants.
- The default has **38 unbuilt parcel reservations** marked `service-or-landscape`, rather than extruding every leftover region. These are semantic reservations and existing paved/ground spaces, not a claim of completed landscape design.

## Facade rules

`facade-layout.js` computes eligibility from each actual polygon edge and volume height. Brick palettes retain 2.4 or 2.6 m full bays and 1.2 m corner margins; glass palettes retain 2.5 or 2.7 m bays with 0.45 m margins. Remaining width becomes symmetric solid piers. The number of bays is an integer and may be zero. No bay is squeezed to fit a narrow wall.

Complete storeys use each palette's 3.5 to 3.9 m metric floor height and leave a 0.32 m top coping. A partial top storey is solid. Eligibility masks affect color, normals, roughness and emitted light, including ground-floor shops. Narrow masonry faces use repeating common brick without windows, signs or random parging; narrow glass returns use opaque coursed trim. Brick color and relief use cumulative perimeter distance so their metric phase survives rotated walls and corners.

The production footprint mesh carries the computed fit, making its rendered wall decisions inspectable. The visual fixture deliberately includes impossible building strips to test facade fallback; those panels are not part of the generated city. See `tools/prepare_facade_baseline.py` and `tools/verify_facade_fixture.py` for a matched comparison against commit `b38327a`.

## Map and skyline

| Measurement | Previous default | New default |
| --- | ---: | ---: |
| East-west span | 2,104.893 m | 1,820.678 m |
| North-south span | 1,269.971 m | 1,098.492 m |
| Land bounding rectangle | 2.673153 km² | 2.000000 km² |
| Island land area | 1.435381 km² | 1.073924 km² |

The 2 km² target is the total land bounding envelope including channels, not 2 km by 2 km or 2 km² of dry land. The authored coasts, planning cores and primary route control points are resized before road coverage and parcel generation. Local street spacing, lane/sidewalk widths, setbacks, footprint minima and facade dimensions stay in metres. The preview's sky/water and camera range are presentation space, not additional playable land or a separately authored editor boundary.

The default has 267 buildings, 279 volumes, 25 shared interiors and seven planned taller outliers. Civic Island retains its two groups; the working harbour has a 51 m brick industrial loft, and Garden Headland has a 44.2 m masonry landmark. These are intentional sites rather than per-building tower probability. A millimetre-scale node-welding fix keeps rescaled street intersections connected; the default has no dead ends.

## Editing and compatibility

The Massing editor link exposes the separately tested selection, lock, scoped reroll, undo/redo, JSON project and scene export workflow. Generator revision is now `0.5.1-usable-fabric`. Topology-changing rule/layout revisions necessarily produce different parcel IDs. Old project documents are rejected with an explicit migration diagnostic; they are not silently rebound to unrelated buildings. Autosave is namespaced by generator revision so prior saved documents remain separate. Within this revision, locked buildings and unrelated map records survive selected-block rerolls exactly.

This is still a synthetic planning grammar. Clearance values are design rules, not building-code certification. There is no terrain sculpting, street dragging, building movement, Unity importer, cooked collider output or shader translation. The export retains the semantic material and polygon-collider contract for subsequent engine-specific work.

## Verification

`npm test` runs the existing model, graph, road, building and editor regressions plus six layout/clearance cases, crafted thin/acute/concave/rotated footprints and 300 facade fit combinations. Browser checks cover matched facade pixels, finite geometry and normals, scoped editor interactions and the release/ground-editor round trip. Reproducible screenshots and counters are in `experiments/three-island-integration/evidence/usable-fabric/`. Lower triangle counts partly reflect fewer buildings and a smaller map; they do not establish renderer parity, Unity cost or Quest performance.

At the original 2.673 km² envelope and matched cameras, the district view stayed at **86 draws / 39 materials** while rendered triangles changed **351,951 → 353,863** (+0.54%). The street view stayed at **86 draws**, **381,462 → 384,837** triangles (+0.88%). Geometry attributes grew **2,890,318 → 3,015,684 bytes**, including explicit per-wall fit coordinates. These measurements include changed clearances, footprints and outlier placement, not an isolated shader microbenchmark. The final 2 km² district sample uses **88 draws / 263,434 triangles / 39 materials**, with zero nonfinite attributes or invalid normals. Detailed before/matched reports retain the exact cameras and counters.
