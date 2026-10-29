# Cityworks 0.5.6

Common brick was using the same 56 by 24 cm module as the dressed-stone frontage, with deep relief and broad joints. Red-brick walls and rear common-brick walls now use 22.5 by 7.5 cm modules, including a 1 cm mortar joint. Dressed-stone frontages retain the larger module with an 8 mm joint. Color and normal shading share those metre dimensions. The existing perimeter coordinates keep coplanar and corner brick density consistent; narrow blank returns retain compatible masonry.

Window AC units now measure 68 by 44 cm. Existing building programme and stable building identity choose short service stacks: residential buildings can have two or three floors, mixed buildings one or two, and occasional industrial front-office windows one upper floor. Towers and blank walls have none. This is visual design intent, not a simulation of occupancy or mechanical systems. Color, normal, roughness and emission use the same unit mask. The apartment interior mapping, full window bays and storey dimensions are unchanged.

The first candidate exposed speckled ACs on angled facades because interpolated attributes drifted around integer floor limits. Discrete policy values are now rounded before comparisons. Matched close, oblique, residential, street and distant captures include the corrected result and an 8 cm camera shift. See the [comparison evidence](../experiments/three-island-integration/evidence/masonry-056/).

The default 2 km² city remains 267 buildings and 279 volumes, with the same streets, footprints, IDs and editing data. Existing saved project compilation remains compatible.

| Matched street view | 0.5.5 | 0.5.6 |
| --- | ---: | ---: |
| Draw calls | 86 | 86 |
| Triangles | 309,052 | 309,052 |
| Scene materials | 40 | 40 |
| Geometry buffer bytes | 3,695,688 | 3,817,608 |

The 121,920-byte increase stores four detail-policy values per merged facade vertex; no AC meshes, textures or new material variants were added. Warm browser frame intervals were approximately 16.7 ms for both versions on the validation desktop. These are browser frame intervals, not GPU execution timings or a performance guarantee for another device.

Validation includes metric scale and programme-policy fixtures, complete upper-window fit, coplanar continuity, stable policy under unrelated metadata changes, and unchanged authoritative city data. Existing generation, clearance, access, tall-facade, storefront, navigation and scoped-editor regressions are retained.

Independent review found no remaining release blocker after the interpolation fix. It checked all eight current camera views, 7,620 actual geometry vertices, joined-panel policy agreement, unchanged default city bytes and three legacy project fingerprints. A height edit may move a service stack within the edited building as its available floors change; it does not change the policies of neighboring buildings.

The result is still a simplified procedural city. Fine brickwork deliberately becomes a smooth material at distance. Stone frontage and common-brick side walls have distinct construction scales. Window ACs remain shader details without projecting silhouettes, supports or simulation. Roof-mounted equipment is unchanged. Broad roofs, sparse ground detail and repeated architectural styles remain visible limitations; this release does not establish parity with the New York reference.
