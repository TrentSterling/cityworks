# Editor UI review

This pass removes the slogans, numbered presentation headings, repeated scene descriptions and island character blurbs. It retains the island focus buttons, parameters and current values, seed, camera presets, layers, export, reset, road details, statistics, errors and interaction help.

On screens up to 760 pixels wide, Controls opens a scrollable panel over the scene. The panel has a persistent Close button, backdrop dismissal, Escape dismissal, contained keyboard focus and focus restoration. Camera and layer selections expose their pressed state. Enter submits the seed. Reset restores the parameters, Ground layer and Islands view. The hierarchy legend appears with its layer.

## Scope

Production changes are limited to `index.html`, `src/style.css` and the UI portion of `src/ground-viewer.js`. A comparison against the preserved baseline confirms that the rendering prefix, terrain, geometry, materials and all camera position/orbit/walk expressions are unchanged. Model files and vendor files are untouched.

## Verification

Run `python -B tools/build.py`, then `python -B tools/verify_editor_ui.py` under an available task GPU lease. The harness uses isolated, muted headless Chrome, blocks network requests and closes its browser in a `finally` block.

The harness covers:

- Desktop 1600 × 1100, phone 390 × 844, small phone 320 × 568, tablet 768 × 1024 and landscape 740 × 390. Top controls stay within the viewport; the document has no horizontal overflow.
- Repeated camera, layer, parameter and seed edits; all three island focus buttons; road selection and dismissal.
- Touch opening and closing of the mobile panel, keyboard focus wrapping and restoration, and desktop/mobile resize transitions.
- Empty-seed error text, preservation of the last valid city, recovery, exact JSON export and reset to the original city.
- Repeated rebuild resource counts and valid finite geometry/normals.

At 390 pixels wide, the scene increased from 110 to 390 pixels. Default output remains three islands, three bridges, 75 blocks, 17.9 km of streets and 24 draw calls. Repeated rebuilds retain 17 geometries and one texture.

## Local review artifacts

Ignored artifacts are in `artifacts/editor-ui/`. `before/` preserves the original source files, standalone HTML and desktop/phone captures. `after/` contains the rebuilt standalone HTML, five layout captures, mobile control-panel captures, desktop/mobile street views and error states. `editor-ui-report.json` records the latest harness result and build SHA-256.

Actual pixels were reviewed for readable controls, clipped content, status visibility and scene obstruction. The existing camera crops the full archipelago in portrait layouts; the island-focus buttons remain available, and landscape fits all three islands. This UI pass does not add touch zoom or change camera framing. Browser emulation is not a physical-device performance test.
