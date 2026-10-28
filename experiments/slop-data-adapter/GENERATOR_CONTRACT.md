# Cityworks map-production boundary

This is the next production contract derived from the executed adapter, not a claim that the current three-island release already implements it.

| Stage | Required output and invariants |
|---|---|
| Land and terrain | Local metre frame with explicit origin/axis convention; valid outer rings and holes; terrain elevation field and urban grading surfaces. Preserve concave coasts and water voids. |
| Street graph | Stable node/edge IDs; endpoints, curve geometry, hierarchy, width, lanes, direction and elevation/bridge semantics. Every at-grade crossing shares a node. Grade-separated crossings are explicitly distinct. |
| Ground coverage | Boolean carriageway and junction surfaces, sidewalk/curb regions and bridge landings derived from the graph. Coverage is non-overlapping and ordinary roads remain inside land. Validate full polygons, not centroids. |
| Blocks and parcels | Blocks derived from actual road reservations; valid non-overlapping parcels inside blocks, reserved parks, usable frontage edge and access to a named street. Store setbacks as constraints, not renderer guesses. |
| Building intent | Stable ID and seed, parcel ID, use/style intent, height provenance, footprint polygons with holes, and one or more volumes with base/top elevations. Missing year is unknown; synthetic style must not masquerade as real history. |
| Renderer adapter | Convert the validated map to a specific renderer's units/schema without losing identity, terrain base, voids or frontage. Revalidate after quantization/simplification. Fail with entity ID and reason when conversion cannot preserve constraints. |

Keep the authoritative map engine-neutral. Store renderer-specific facade choices, compression and draw batches in derived data. The proven NY facade and detail implementation is a useful downstream consumer; its current hard-coded base and year/center heuristics need small, explicit interfaces before it can honor this complete contract.

Stable IDs must survive changes outside an entity's dependency region. Existing Cityworks geometry-derived IDs survive density/height edits, but topology changes can replace IDs. The packed SG representation cannot carry stable facade seeds unchanged. Do not claim identity stability merely because the JSON retains an ID that the renderer ignores.

Dependency order is land/terrain -> streets/coverage -> blocks/parcels -> footprint volumes/attributes -> render batches/details. A local footprint edit should invalidate its geometry and affected neighbor details; a road edit invalidates intersecting coverage, blocks and parcels. This experiment establishes the data boundary but does not implement incremental invalidation for the complete pipeline.

Acceptance requires visible ground and street coherence with buildings hidden, valid mesh topology including concave shapes and holes, stable metric window dimensions after rotation, deterministic rebuilds, and matched rendered comparisons. Test counts or draw counts alone do not establish quality parity with the reference.
