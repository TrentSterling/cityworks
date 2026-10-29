# Cityworks 0.5.3: connected frontage and block ground

The city now has explicit sidewalk-to-entrance routes, paired crossing ramps and service-yard curb transitions. Raised parcel pads are replaced by a continuous partition of paving and planting. Courtyard paths meet their sidewalks, and each glazed entrance uses the same complete metric bay as its facade.

The default plan contains 267 entrance routes (265 door modules and two courtyard passages), 282 pedestrian crossings, 573 curb ramps including nine service aprons, and 25 courtyard/service routes. Its 2 km² envelope, islands, roads, parcels, building volumes, seven skyline outliers and existing authoring identities are preserved.

## Planning and rendering

- Crossing candidates move inward by up to 24 m when acute junctions prevent a clear pair of ramps. Their IDs stay tied to their street and junction. Paint consumes the admitted position. Generation validates that every entrance shares a connected sidewalk/crossing component.
- Entrances use the released coplanar facade domains and 3.4 m floor metrics. Corner-lot approaches can start at an offset point on the sidewalk while retaining the bay-centred door and full route width. Every tested route stays inside land and clear of buildings and traffic.
- Ramp flare triangles follow their actual slope crease. Trimmed curb tops remove sub-centimetre clipping spurs before triangulation, preventing a stray triangle from covering a lowered ramp. The main ramp run is 2.1 m for a 0.16 m rise; this is a geometric prototype, not a code-compliance certification.
- Block surfaces partition paving and greens without coplanar overlays. Terrain-facing pad rims are closed. Entry modules share two batches and hide with buildings. They are visual doorway proxies; building interiors and operable doors are not implemented.
- The shared facade contract moved to `src/facade-rules.js`; the rendering module re-exports the same functions. The pinned upstream source and derived NY material/geometry modules remain unchanged from 0.5.2.

## Evidence and costs

[Matched images and measured counts](../experiments/three-island-integration/evidence/public-realm/) compare the same cameras with release 0.5.2. Views include a doorway, courtyard passage, service yard, block interior and the main street.

The default rendered mesh passes height probes for 265 doorway approaches, 573 ramps and 4,584 flare positions. CPU tests cover six access layouts, full-width route containment, connected entrances, ramp triangulation, relocated crossing coverage, unchanged locked/unselected records and exact undo. Existing map, facade, footprint, editor and road-paint regressions remain in `npm test`. The dedicated browser harness is `python tools/verify_public_realm.py`; it also accepts `--url` for deployment verification.

At the matched street camera, draws remain 86, triangles increase from 296,047 to 311,604 (+5.25%), and materials increase from 39 to 40. Inspected geometry attributes/index bytes increase from 2,594,274 to 3,904,530 (+1,310,256 bytes). The additional geometry belongs to physical curb cuts, route surfaces and entrance modules. Counts are measured on the desktop preview and are not a device-performance claim.

## Limits

This pass improves the ground around existing massing. It does not reshape all awkward buildings or eliminate all acute land remnants. Narrow surplus strips become continuous planting or paving rather than separate raised parcel slabs. Service yards remain sparse, door glazing is simple, and no pedestrian pathfinding or indoor navigation is supplied. The three-island grammar and known inherited invalid-layout diagnostics remain. The result is not claimed to match the full Slop New York app.
