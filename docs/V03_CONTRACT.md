# Three-island data contract

Schema 3, metres, `[x,z]` plan coordinates with +y elevation, 0.001 m quantization. The default input is seed `CITYWORKS-03`, coast variation 0.5, local street spacing 108 m and bridge carriageway width 22 m. Input bounds are explicit; unknown input fields and invalid values reject with a diagnostic.

## Land and grade

`islands` contains Civic Island, West Harbour and Garden Headland. Each has stable ID, boundary, holes, regions, buildable regions, urban core, elevation and terrain intent. Coast variation displaces authored low-frequency controls; two islands use rounded outlines while the harbor keeps quay corners. The three regions must remain valid, disjoint and large enough for their planning cores.

`heightAt(city,x,z)` is the reference ground elevation. Road and urban pads are at 8 m; natural coast slopes approach water level away from declared bridge abutments, and headland hills retain relief. The viewer samples natural terrain, excludes road rights of way and graded mixed blocks, and plants trees at the matching grade. It does not overlay flat park planes on hills.

## Streets and bridges

Routes describe intent. The graph splits crossings and consolidates nearby junction nodes within a bounded 8 m envelope. Every resulting at-grade crossing must share a node. Node IDs derive from snapped position; street IDs derive from source identity and resulting endpoints. Surviving geometry keeps its identity.

Street records contain source ID, endpoints and node references, class, carriageway width, sidewalk width, elevation, island ID and an explicit bridge flag/bridge ID. Ordinary streets use 22/13/7 m carriageways and 3.5/3/2.4 m sidewalks for arterial/collector/local classes. Bridge width is independently editable from 18 to 28 m.

Bridge endpoints are on their named islands and share nodes with ordinary roads. Both eastern crossings form an alternate-route loop. Harbour Bridge is the sole road connection to West Harbour. All bridge decks are at 8 m, with a 0.9 m structural slab and nominal 7.1 m underside elevation; these are visualization parameters, not certified clearance or engineering design.

`landRoadCoverage`, `bridgeCoverage`, their union `roadCoverage`, `rightOfWay` and `sidewalkCoverage` describe actual surface regions. Ordinary raw road/sidewalk corridors must stay on land. Any asphalt over water must belong to declared bridge coverage. Sidewalk interiors exclude asphalt, and curb risers face the roadway.

`junction.radius` describes a local surface cap, not safe paint clearance. The marking adapter intersects an approach corridor with its incident neighbors, reserves the full overlap extent, then places crosswalks and stop bars beyond it. Short approaches omit paint that cannot fit. Paint tests inspect emitted mesh quads rather than repeating the placement formula.

## Blocks and dependencies

Blocks are buildable land minus the actual right of way. They are disjoint, on land and tagged mixed or park. Their IDs derive from island identity and canonical geometry. Schema 3 includes empty `parcels` and `buildings` arrays deliberately; downstream building work is a separate stage.

Dependency hashes separate land, streets, blocks and density/skyline intent. Density/skyline fields are reserved and do not yet create buildings. They must not change ground geometry or IDs. Rebuilds are synchronous and deterministic; arbitrary boundary edits, route editing, elevation changes, bridge routing and incremental regeneration are not implemented.
