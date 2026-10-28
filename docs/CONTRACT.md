# Cityworks data contract v2

Metres, [x,z] plan coordinates and +y elevation. Geometry is quantized to 0.001 m. A region is `{outer, holes}`; outer rings have positive x/z area and hole rings have negative area. Rings omit repeated closing vertices. Boolean and offset operations return every output region, including splits, holes and empty collapse.

## Input behavior

Input schema 2 includes seed, width/depth, intensity, skyline target, two orthogonal arterial offsets, diagonal angle/offset, optional boundary and optional holes. The generated outline is concave; its lagoon occupies a baseline grid cell using seed-derived clearances. Later arterial edits do not move the lagoon. Resolved hole rings are serialized in `input.holes`, so boundary-only edits based on exported input preserve water.

An explicit boundary may be a simple concave ring; holes must be simple, strictly interior and mutually disjoint. Self-intersections, self-touches, repeated vertices, overlapping adjacent edges, nonfinite values and incorrect types are rejected. Invalid editor input keeps the previous complete city and displays a diagnostic. No convex hull replacement or notch filling occurs.

## Dependency order

1. Validate land and holes; form buildable coast and street-centre clearance regions.
2. Clip grid and diagonal route candidates into all on-land intervals. Split every at-grade crossing into shared junctions.
3. Retain the connected street network. Isolated fragments are omitted only when each component has fewer than four edges and at most 220 m of street; omissions are reported with count and length. Larger disconnected components reject the layout. There are no inferred bridges.
4. Union road corridors into `roadCoverage`. Graph edges are semantic centre lines, not overlapping rendered road meshes. `rightOfWay` expands coverage by 3.5 m for sidewalks. Blocks are the actual remainder of inset land minus the right of way.
5. Identify road-facing block edges; allocate metric frontage strips into clipped parcel regions. Previously assigned parcels are subtracted. Fragments without at least 8 m of frontage or enough setback area remain open. Each parcel stores its street ID, frontage and on-land access segment.
6. Apply 2 m parcel setbacks using full polygon erosion. Retain all sufficiently large disconnected footprint pieces. Buildings have explicit polygon parts and holes, 3.4 m floors, 3.15 m facade bays and stepped upper masses.

Island, road coverage, blocks, parcels and building parts may contain concavity or holes. Consumers must use proper triangulation, not triangle fans. All eligible split regions are retained; no first-component-only inset helper is provided.

## Identities and dependencies

Block IDs hash canonical block geometry. Parcel IDs independently hash their own canonical geometry, so unchanged parcels keep IDs even when the parent block changes. Building IDs derive from parcel IDs; property randomness uses seed plus stable ID. Density/height edits preserve topology. Hash collisions are detected as duplicate IDs and reject the generated model.

Dependency hashes describe `island -> streets -> blocks -> parcels -> buildings`, with a separate height-intent dependency. The editor still performs a complete synchronous rebuild. JSON contains no renderer objects. A Unity geometry/material importer is not implemented.

## Bounded support

One flat island, one diagonal arterial and otherwise straight grid routes. Multiple water holes and split setbacks are supported in the model; the UI provides a lagoon toggle and outer-boundary handles, not a general hole or route editor. Narrow necks that cannot support a connected network produce diagnostics. No curved routes, elevations, bridges, traffic, LOD or general graph authoring.
