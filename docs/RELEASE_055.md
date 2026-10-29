# Cityworks 0.5.5: floor-aware storefronts

The BOOKS and CAFE storefronts in the default harbour now sit over their actual entrances, below the first upper window row. Previously, fascia signs reached 4.89 m above the building base while upstairs glazing started at 4.114 m. Their awnings were 0.75 m thick boxes placed independently of the door and window bays.

The preview now uses one shared metric ground-floor contract. Display glazing and portal frames end at 2.86 m; fascia occupies 2.90 to 3.40 m; signs occupy 3.02 to 3.32 m. The folded canopy has a 55 mm sheet thickness, a 50 mm fall and a short front valance. Its lowest edge is 2.84 m, leaving clearance above the authored 2.8 m industrial doors. Projection is limited to 1.35 m and the available parcel setback. Wall signs have a 40 mm back offset; the canopy also begins 40 mm outside the facade. Hidden fixings are not modeled.

Primary storefronts use complete facade bays on the shared coplanar domain containing the accessible entrance. Seeded retail choices remain; the nearest proposed shop becomes the single primary identity above that entry. Multiple decorative labels no longer imply additional unmodeled doors. The default has 71 primary storefronts instead of 96 scattered awnings. Narrow, blocked, unsupported or passage entrances do not receive a canopy. The retained BOOKS fixture is `parcel:68aa9b6f:building`; the CAFE fixture is `parcel:191555b9:building`.

Masonry and curtain-wall color, roughness, normal and emission outputs use the same ground display limit. Portal transoms respect that limit, and optional storefront lighting targets the explicit building base. Roof ledges are reduced to 18 or 24 cm high and 36 cm deep, with an 18 cm rendered coping band. No extra materials or business-name variants are introduced.

## Compatibility and verification

This is a preview-detail correction. Authoritative city data and the `0.5.4-resolved-massing` generator version are unchanged. Default, narrow-layout and height-edited data match the previous release; archived project reconstruction, locks, scoped rerolls and undo retain their existing semantics. The application package is version 0.5.5.

`tests/storefront.test.mjs` checks 1,249 generated entrance plans, passage/height/setback rejection, split and cyclic domains, duplicate vertices, rotation, full-bay alignment, sign placement and doorway clearance. Captured default examples and a released-city fingerprint are in `tests/fixtures/storefront-054.json`. Existing topology, massing, public-realm, facade and editor suites remain required.

`tools/verify_storefronts.py` captures six matched views against commit `a8d8a1d`, including street-height BOOKS/CAFE and oblique/industrial cases. It checks actual transformed canopy/sign vertices and all 265 portal frames. Separate browser harnesses exercise tall-facade classification, rendered access surfaces, facade-domain continuity, navigation, saved projects and editing. Independent review inspected all 12 comparison images and the code, including seven independently checked canopy rotations. A duplicate-vertex crash found during review was fixed and retained as a regression.

At the matched street camera, draw calls remain 86 and materials remain 40. Triangles increase from 308,572 to 309,052 (480, about 0.16%); geometry attributes/index storage increases from 3,693,768 to 3,695,688 bytes. These are desktop render counts, not a GPU-time or Quest-performance claim.

## Remaining limits

Storefronts remain facade and entrance proxies without shop interiors, tenant units, opening doors or pedestrian simulation. One primary entry does not subdivide a large building into several functional shops. The canopy is a simplified folded silhouette without modeled brackets, drainage or structural design. Existing brick scale, repeated AC units, broad industrial yards and overall architecture still need improvement. This release does not establish parity with Slop New York.

Comparison images and counts: [storefront evidence](../experiments/three-island-integration/evidence/storefronts-055/).
