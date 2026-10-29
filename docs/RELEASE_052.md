# Cityworks 0.5.2: facade continuity and fly navigation

This release fixes facade discontinuities and changes the default camera to WASD movement with held right-button look. It leaves generated map geometry and the editable project format unchanged.

## Facade corrections

Window eligibility previously changed narrow panels into party walls, selecting a different brick palette. Adjacent collinear polygon edges also started separate window grids. The renderer now groups contiguous coplanar edges into one facade domain and computes full bays over that domain. Window fit no longer changes the wall's semantic identity. Real street fronts, side walls and party walls can still have different treatments at physical corners.

The domain also supplies a stable seed and tangent for window direction, signs and interior rays. Brick distance stays continuous when a domain crosses the ring's first point. This prevents normal-rounding and dominant-axis thresholds from splitting a nearly flat facade's procedural pattern. See the [independent review](REVIEW_052.md) for the exact cases and follow-up checks.

All five generated facade palettes now use the generator's 3.4 m floor rhythm. A complete opening must end below 90% of its storey and below the 0.32 m coping. This retains the last complete row without stretching a partial window. The inherited six-storey belt is reduced from nearly one full floor to a 0.22 m trim course. Color, roughness, normal and emissive masks follow the revised opening and trim bounds. Narrow returns still have no windows, sills, AC units or clipped mullions.

The existing opaque interior mapping remains. Reduced glazing haze and sky reflection reveal its rooms and curtains more clearly. Room choices remain deterministic; a stationary fixture produces identical screenshots across frames. This does not add true interior geometry, transparency, bloom or another material pass.

## Navigation

- WASD moves relative to the view, Q/E moves vertically, and Shift increases speed from 16 to 48 m/s. Diagonal movement is normalized.
- Hold the right mouse button over the viewport to look. Release, Escape, blur, hidden document and pointer cancellation clear input. No pointer lock is requested.
- Typing in inputs, text areas, selects or editable text does not move the camera. Context-menu suppression is confined to the viewport.
- A cleared key cannot restart movement through auto-repeat after Escape or focus loss; movement requires a fresh press. Both inherited and plaintext-only editable fields isolate typing.
- Orbit remains available with the camera-mode button. Left-click selection, camera presets and editor rebuilds remain available.

The massing editor uses the same navigation module and preserves its mode across preview replacement. The older ground-only editor remains separate.

## Evidence and limits

`tools/verify_facade_coherence.py` renders identical test geometry using the preserved 0.5.1 commit `2704c37` and the current production facade path. It checks segmented fronts, full upper rows, narrow brick/glass returns and static room determinism. Frontal, oblique and close-room screenshots are retained in `experiments/three-island-integration/evidence/facade-coherence/`. These are diagnostic fixtures, not newly generated city buildings.

Matched city views retain **88 draws / 263,434 triangles** for the district and **86 draws / 296,047 triangles** for the street, with **39 materials** in both. Geometry and normals are finite. These are render counters, not GPU timing or device-performance claims.

The shared facade frame adds **95,940 bytes** of geometry attributes (+3.84%), without adding vertices, triangles or material passes.

The geometry/editor regression suite retains the 2 km² envelope, six-layout footprint and clearance checks, deterministic IDs and scoped lock/undo behavior. Browser tests cover the city controls and ground-editor round trip, selection, locked rerolls, exact undo/redo, project save/load, repeated preview replacement, mobile layout, and navigation input handling.

This pass does not change the generator's 120 m² area, 4 m eroded-core radius, 6:1 aspect or 6 m detached-building clearance rules. Broad valid footprints can still have short chamfer faces and wedge-shaped leftover ground. The screenshot report alone cannot identify every such building; no claim is made that every awkward massing or ground apron is resolved. Ground access, entrances and sidewalk connectivity remain the next separate work item. This release remains below the full Slop New York scene's visual quality.

The pinned upstream source is untouched. All derivative changes are listed in `ADAPTER_CHANGES.md` and hashed in `adapter-manifest.json`.
