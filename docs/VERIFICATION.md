# Version 0.2 verification

Verified on 2026-10-28. Browser measurements below use an isolated, muted headless Chrome instance. They describe the tested desktop and configuration.

## Final default model

Seed CITYWORKS-01: 495,486.822 m² of land excluding water; 9,258.623 m of connected streets; 131,113.263 m² of road coverage; 49 blocks, 332 parcels/buildings, five parks and a 105.4 m peak. One isolated 13 m candidate road fragment is explicitly omitted; land and holes remain unchanged.

The coast has two concave bays. The interior lagoon is an actual hole in the island and subsequent geometry. A 34-degree boulevard creates diagonal frontages and irregular blocks. The renderer consumes unioned road coverage, not overlapping edge rectangles. Original generation rules use the separately licensed Clipper dependency for Boolean/offset calculations.

## Automated checks

Seven model test groups pass. All 36 varied regression seeds generated successfully and passed graph-crossing, road union/land coverage, parcel overlap, frontage access, full containment and metric setback checks. Dedicated fixtures test a concave U-shaped notch, a water hole across arterial routes, split/collapsed setbacks, malformed inputs and a narrow-neck island whose disconnected road network must reject explicitly. Unchanged parcel geometry retains IDs after parent block geometry changes; density/height edits preserve topology.

Browser input verified building selection, movement, density edits, orthogonal/diagonal arterial edits, layers, outer-boundary dragging, lagoon toggling before and after a boundary edit, JSON download and preservation of the previous city after invalid input. Five repeated rebuilds did not increase geometry/texture counts. HTTP/HTTPS requests were blocked; only the local HTML was requested. No console/page errors.

Four inspected renders (aerial, overhead, matched street and boulevard) have finite geometry, unit normals, consistent winding and no metric facade-coordinate errors. Facade-coordinate distances agree with world-space wall distances within 0.005 m, including rotated walls.

## Measured browser results

Chrome ANGLE D3D11 on NVIDIA RTX 5070 Ti, 1600×1000, DPR 1:

| Measurement | Final 0.2 |
| --- | ---: |
| Full-frame draw calls, including shadow pass | 24 |
| Submitted triangles, including shadow pass and instances | 35,116 |
| Resident geometries / shadow textures | 16 / 1 |
| Shader programs | 7 |
| Geometry attribute buffers | 1,163,264 bytes |
| Initial model and scene rebuild | 131.2 ms |
| Later edited rebuild | 101.2 ms |
| Recent frame intervals, median / p95 | 16.7 / 16.8 ms |

Frame intervals are 120 refresh-paced requestAnimationFrame samples per view, not uncapped GPU timings or Quest performance evidence. Attribute-buffer bytes exclude instance matrices, render targets and driver overhead. 0.1 measured 23 draws and 59,651 submitted triangles. Fewer coastal tree instances contribute to the lower 0.2 triangle count; this is not an isolated algorithm benchmark.

## Independent review

A separate read-only reviewer tested 30 default-size seeds and 30 varied size/arterial cases: 60/60 generated. Independent probes found no missing crossing junctions, parcel overlaps, overlapping road regions, water-crossing access or setback failures. Minimum measured setback was 1.998981 m, within the documented millimetre quantization tolerance.

Review found and confirmed fixes for identity churn caused by parent-block IDs, hole loss on boundary edits, invalid false/zero inputs, misleading handling of major disconnected components, lagoon toggle restoration, default-lagoon connectivity and aerial depth fighting. Final overhead and boulevard pixels were inspected independently. The reviewer confirmed readable concave bays, an interior lagoon, diagonal/irregular frontage and consistent metric facade rhythm.

## Remaining limitations

Local streets are still mostly a grid with one straight diagonal arterial. No bridges or automatic disconnected-network repair; invalid edits retain the previous city with a diagnostic. Hole geometry can be supplied in the data API, but the UI only provides the generated lagoon toggle and outer-boundary handles. Whole-model synchronous rebuilding remains. The street camera is free inspection without collisions. Facades, park planting and material treatments repeat; the boulevard's bottom legend has weak contrast on dark pavement. No Unity bake/import, authored architecture, traffic or device-port performance proof is claimed.
