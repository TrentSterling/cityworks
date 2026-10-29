# Cityworks 0.5.4: resolved massing and exposed tower facades

Small clipping returns no longer become full-height wall strips, and unused rear setbacks become planting instead of a uniform paving ribbon. The default plan retains all 267 building identities, 279 volumes, seven skyline outliers, 72 blocks and the 2 square kilometre envelope. Roads, bridges and parcels are unchanged.

The default harbour tower `parcel:68aa9b6f:building` and headland tower `parcel:97378c47:building` also regain their upper-storey windows. Their window bays were valid; the inherited party-wall test was treating the podium beneath each tower as a neighbour blocking its entire facade. Reservations now retain base elevation. Only vertically overlapping neighbours can block a wall, and a lower adjoining roof cannot blank the storeys exposed above it. This fixes wall classification without adding materials or geometry.

## Geometry rules and saved projects

The contained simplifier considers only edges shorter than 2 m, limits local movement to 2 m and total area loss to 12% per polygon, and retains the existing 120 square metre area, 4 m core radius and 6:1 aspect limits. Candidate cuts cannot fill a notch into another parcel, a courtyard or an access reservation. Larger L/U forms and the valid 9.39 m-wide rectangular control survive. On the default map, 25 edges below 10 cm become zero; the largest footprint area reduction is 3.494%. The known `REVIEW-ACCESS-5` courtyard setback failure is corrected by intersecting the courtyard with its actual allowed envelope.

New projects use generator `0.5.4-resolved-massing`. Existing `0.5.1-usable-fabric` projects keep their original generation path and authoring values, including locks and overrides. Three archived project fingerprints verify byte-exact city reconstruction. The editor recovers the earlier versioned browser autosave and reports when original rules are in use. New project opens the current rules; undo can restore the old project. Renderer bug fixes apply to both versions without changing the saved geometry.

Non-harbour paving comes from occupied frontages, entrance approaches and reserved court routes. Planting can reach unused rear and side walls. Both surface materials use one shared route mask with a 5 mm numerical join margin on the 1 mm clipping grid. Computing greens from already clipped pavement proved unsafe and is not used. Harbour service yards remain paved. Narrow landscape strips are allowed; they are not classified as buildings or pedestrian paths.

## Verification

`npm test` includes captured polygon fixtures, all prior seed/clearance/editor/facade tests, six massing layouts, both material triangulations and legacy project fingerprints. The actual default tower volumes and vertically disjoint/overlapping neighbour cases are exercised by `tools/verify_tall_facades.py`. Matched camera captures and actual rendered entrance-height/facade-domain checks are in `tools/verify_massing.py`.

The editor browser harness checks real selection, locks, height changes, reroll, undo/redo, imports, exports, repeated replacement, mobile layout and legacy autosave recovery. Navigation and release harnesses retain WASD/RMB, focus cleanup, ground-editor round trips and live export checks. Independent review covers code, generated geometry and actual rendered images.

Evidence: [massing comparisons](../experiments/three-island-integration/evidence/massing-054/) and [tower comparisons](../experiments/three-island-integration/evidence/tall-facades-054/). Exact render counts are recorded in their comparison reports. These desktop measurements are not Quest-performance claims.

## Remaining limits

The conservative simplifier does not redesign every awkward block, enforce a full architectural grammar, or guarantee that every possible input produces no short edge. Meaningful stepped forms and small blank piers remain. Wall adjacency still samples three points rather than solving a complete facade arrangement; partially occluded windows below an adjoining roof are hidden by that neighbour rather than separately split geometry.

Storefront signs and awnings still need coordinated ground-floor bands. Large industrial yards remain visually sparse, roof coping can look heavy, and repeated air-conditioning details remain conspicuous. These are not claimed fixed by the tower correction. Entrances are visual proxies, not usable interiors or pedestrian simulation. The result remains below the full Slop New York quality bar.
