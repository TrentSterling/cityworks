# Cityworks 0.3: ground and connected streets

Development milestone on `codex/three-island-ground-v03`. The published 0.2 release stays on `main` until review.

## Visible result

Three islands with different landform and planning roles: a central urban spine, a harbor district with deliberate quay edges, and a greener headland. Broad bays and headlands come from controlled coast geometry rather than high-frequency noise. The ground must read clearly with all buildings hidden.

Bridges connect land-side arterial junctions. Collector routes distribute movement around each island; local streets form smaller blocks. Asphalt, junctions, sidewalks and curbs derive from the same geometric road coverage. Blocks are the remainder of land after road rights of way, not an unrelated decorative grid.

Terrain is reserved for coastal slopes and natural hinterland. Urban roads and their pads have explicit common elevation. This milestone does not claim civil engineering bridge clearance, drainage design or traffic simulation.

## Acceptance

- Three valid, disjoint islands with different silhouettes and road patterns.
- A globally connected road graph. Every at-grade crossing shares a junction; each bridge connects to land-side roads.
- Ordinary road coverage stays on land. Water crossings belong to explicitly declared bridges only.
- Unioned junction surfaces without overlapping asphalt; sidewalk and curb bands follow the same edges.
- Blocks are contained on their island, nonoverlapping and outside the actual road right of way.
- Deterministic seeds, stable identities, finite geometry and measured rendering costs.
- Ground-only overhead, oblique and bridge-level captures inspected against reference behavior and actual source visuals.

## Sequence

1. Land, street graph and coverage model with seed regressions.
2. Ground, coastal treatment, bridge structure and street detail preview.
3. Independent model and pixel review; fixes and a reviewed development checkpoint.
4. Separate building/facade upgrade informed by the MIT-licensed Slop New York implementation.

Source is pushed to the development branch after privacy and license checks. A failing or unreviewed candidate is not merged or deployed.

## Reference use

The owner's existing island editor is a read-only behavioral benchmark for terrain, coastline zoning and inter-island connectivity. Its source is not included here. Public street design references inform hierarchy, compact intersections and sidewalk continuity. No claim of standards compliance is made.

Slop New York source at commit `13dd142b480bcfa01a6b18e36127c87e41cb4d80` is available for licensed study and reuse under MIT. Any copied code will be identified in provenance and retain its license; geographic data has separate obligations and is not included. No Epic implementation or assets are used. This work is not represented as clean-room development.
