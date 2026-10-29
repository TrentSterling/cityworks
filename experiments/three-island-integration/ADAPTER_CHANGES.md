# Integration adapter changes

The reference baseline in `../slop-data-adapter/upstream` is unchanged and remains verified against its pinned SHA-256 manifest. This integration deliberately uses licensed derivative modules under `adapted-nyc`, not a claim of byte-identical execution or clean-room implementation.

Source: [mrdoob/slop-newyork at 13dd142b480bcfa01a6b18e36127c87e41cb4d80](https://github.com/mrdoob/slop-newyork/tree/13dd142b480bcfa01a6b18e36127c87e41cb4d80). Copyright (c) 2026 Mr.doob, [MIT terms](../../vendor/slop-newyork-MIT.txt).

| Derived module | Necessary change |
| --- | --- |
| `buildings.js` | Import original or adapter dependencies explicitly. Choose facade from the generated design palette, seed detail selection from stable volume IDs, reserve/collide at explicit base/top elevations, retain volume ID in detail records. Position fascia signs and optional storefront lights relative to the base. Replace NYC business names with generic shop labels. |
| `building-footprints.js` | Extrude each volume from its explicit base. Mark only the primary street-facing facade as a shop wall; other exposed walls use the existing rear-wall treatment. Preserve metric wall coordinates, holes, triangulation and material/cell batching. |
| `building-details.js` | Place roofs and awnings at the volume base/top, skip storefronts on upper volumes, restrict storefronts to recorded frontage, and require cornices/awnings/sheds to fit fully within their parcel. The existing concave/holed roof containment checks remain. |
| `tsl-materials.js` | Use volume-local vertical coordinates for footprint facade floors. Share the unchanged upstream lighting uniforms. This fixes the upstream assumption that floor zero starts near world y=0. All other material generation remains pinned source. |

Unchanged upstream modules still supply lighting, collision utilities, fire-escape machinery and the original reference material system. Fire escapes are not generated here: construction year is unknown, and this experiment does not fabricate old construction dates to enable them. NYC landmark and special-district systems are disabled by the configuration shim. Night lighting, traffic, full-game culling, reflections and post-processing are not part of this milestone.

`ground.js` ports the original Cityworks v0.3 terrain, road coverage, bridge and curb geometry to WebGPU materials. Parcel pads close the 16 cm gap between the flat urban grade and building base. `ground-materials.js` retains a restrained dry-road treatment using MIT Slop noise functions. The road graph and Boolean coverage generation are unchanged.

`adapter.js` maps serialized Cityworks volumes to the NY record shape. A parcel's primary frontage drives facade classification and awning placement. The access segment is retained in the exported generation data; it is not an authored door, pedestrian path or routing system. Heights, palette and base elevations are explicit synthetic design attributes, not surveyed facts.

The baseline byte hashes and derived-module hashes are recorded in `adapter-manifest.json`. Updating upstream requires a new pin and a new review of these differences.

Version 0.5.2 groups contiguous coplanar footprint edges into one metric facade domain, while preserving their original positions and normals. Window eligibility no longer changes semantic wall kind or its palette. The five generated palettes use 3.4 m floors to match generated volumes. A complete opening can use the final storey when its top and the 0.32 m coping both fit. The six-storey belt becomes a 0.22 m course rather than covering most of a floor. Curtain glazing bounds and all corresponding material masks follow the same opening limit. Existing opaque room mapping receives less haze and sky reflection; it gains no geometry, textures or material passes. The upstream baseline remains unchanged.

The review correction adds `facadeFrame` (metric tangent X/Z and stable domain seed) to footprint geometry. Window orientation, painted signs and room rays consume that frame, while geometric lighting normals remain unchanged. Brick distance wraps at a physical corner, preserving joined domains that cross the ring origin. These explicit attribute changes are separate from the unchanged upstream baseline.

The planned-fabric pass adds original Cityworks `src/parcel-patterns.js`: district frontage/depth sequences, larger corner lots, explicitly reserved shared interiors and access corridors, and two named skyline groups. It changes neither the upstream baseline nor the four derived NY modules. `ground.js` draws court surfaces and passage soffits; soffits join the building visibility group. Ground-level courtyard volumes exclude the entrance corridor, while their upper rings retain the enclosed courtyard. Shared access remains geometric planning data, not a pedestrian navigation system or a claim of building-code compliance.

Version 0.5.1 additionally changes `building-footprints.js` to carry per-wall full-bay fits and cumulative metric brick coordinates. `tsl-materials.js` consumes those fits without squeezing bays, masks incomplete floors and narrow piers across all material outputs, and uses brick/opaque trim on ineligible faces. Narrow brick returns suppress inherited random parging and painted signs. `facade-layout.js` is the original Cityworks CPU eligibility contract. The finite core-opening geometry and 2 km² planning envelope are original generation changes, upstream baseline bytes remain untouched, and no surveyed source data is added.
