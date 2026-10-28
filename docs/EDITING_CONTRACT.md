# Editing contract, project version 1

The authoritative document is `cityworks.project`, version 1. It contains generator input, per-building massing revisions, manual height overrides and locks. Render meshes, selection, camera and undo history are not authoritative map data. The original generator revision remains `0.4.1-planned-fabric`; project version 1 adds explicitly scoped authoring state around it.

## Implemented vertical slice

Select a building in the preview or select its block from a list. Rerolling a block increments only its unlocked buildings' revision counters. Each counter scopes the existing building seed; IDs and footprint topology do not change. Generated height varies within the existing profile, and facade/detail seeds change. A saved manual height retains priority during rerolls. A locked building rejects height editing and is excluded from rerolls.

The transaction compiles and validates a complete candidate before committing it. Rerolls also compare islands, streets, bridges, blocks and parcels against the previous city and reject changes outside the selected building set. Failed commands and imports leave the project and history intact. Stale prepared transactions are rejected. Undo and redo store up to 30 in-memory project snapshots; a new edit clears redo. Selection and camera changes do not consume history.

Saving persists the explicit revision counters, height overrides and locks. Loading recompiles those values, rather than inventing a new seed. Browser autosave stores the same document; JSON save is the portable backup. Reload restores authoring state but not undo history. Import accepts only this schema and generator revision. Future migrations must be explicit and must not silently discard unknown or locked identities.

## Dependencies and future editing operations

| Operation | Current or proposed invalidation | Conflict policy |
| --- | --- | --- |
| Lock or unlock | Current: authoring state only | Unknown IDs reject |
| Height or selected-block reroll | Current: affected building volumes, facade seeds and preview | Locked buildings reject or are excluded; manual heights survive reroll |
| Move a building | Future: footprint, parcel containment, frontage, volumes, clearance neighbors | Validate full footprint and setbacks; do not silently move or delete other buildings |
| Move a street junction | Future: incident road coverage and junctions, intersected blocks/parcels, their buildings and bridge landings | Solve the affected graph and polygon region as one candidate; report locked-building conflicts |
| Sculpt terrain or change coast | Future: affected land/water polygons, road/bridge support, parcel containment and elevations | Reject invalid support or water crossings; require explicit resolution of affected locks |
| Replace the generator or global layout seed | Future: explicit migration of authoring identities | Never assume old overrides map to newly generated parcels |

These future rows describe boundaries for subsequent work, not implemented capabilities. The current editor deliberately exposes no topology-changing command. Stable identity is guaranteed for this scoped operation and generator revision, not for arbitrary changes to the whole street plan.

The dependency hashes identify derived data. Compilation currently recomputes the complete model; the editor replaces its isolated Three.js preview after geometric changes. It does not yet incrementally regenerate GPU buffers. Lock-only changes avoid a preview rebuild. The editor preserves camera and building visibility during successful rebuilds and commits the candidate only after the preview reports the matching building dependency hash. Unchanged authoritative neighbor records do not imply every neighboring streamed decorative detail is unchanged: renderer clearance rules may respond to nearby geometry.

## Engine-neutral export

`Export city` retains schema 4 city data and adds `cityworks.scene` contract version 1, authoring state and explicit coordinates: metres, X east, Y up, Z south; polygon pairs are X/Z. Buildings retain stable IDs, parcel/frontage references, footprint polygon rings with holes, volume IDs, base/top elevations and facade identifiers.

The export adds symbolic `facade:nyc:0..3` material IDs and extruded-polygon collider descriptions per volume. These are semantic bindings and geometric proxies, not Unity materials, triangle meshes or cooked physics colliders. Courtyard holes remain in the exported polygon sets. A Unity importer must choose material bindings, triangulation, collision decomposition, prefab/chunk ownership and rebuild policy. Preview TSL shaders are not portable through this JSON contract. No Unity import or Quest performance claim is made by this milestone.

## Evidence

Run `npm test` and `python tools/verify_scoped_editor.py`. The browser test uses actual controls, picking, save/load downloads, reload, invalid imports and repeated reroll/undo cycles. Committed screenshots and measured counters are in `experiments/scoped-editor/evidence`. The default released route is also checked with `python tools/verify_release.py`.
