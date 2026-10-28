# Cityworks 0.4.1 release

The default entry now runs the reviewed three-island building integration, including the planned-fabric checkpoint `e6eca3e`. The retained lean ground editor is served at `ground-editor.html`. Its land and street controls remain available, and its Open city link passes the edited seed, coastline variation, street spacing and bridge width into the integrated generator. The city view's Ground editor link carries those same settings back.

`tools/build_release.py` generates the root entry from the maintained integration page. No rendering or geometry algorithm changes are part of this release wiring. Existing upstream pins, attribution and adapter hashes remain intact. The offline ground build is still versioned separately as 0.3.0-dev.

Local preflight passed `npm test` and `tools/verify_release.py`: the default route loads 473 buildings and 37 shared interiors; camera views, six visibility toggles, height edits, seed rebuilds, schema 4 export, mobile layout, ground controls/hierarchy, schema 3 export and edited-ground return all work without page errors or failed requests. Render costs match the reviewed checkpoint: district 86 draws / 351,951 triangles; street 86 / 381,462.

The release harness also accepts `--url https://tront.xyz/cityworks/` for deployed verification. Runtime reports and screenshots are kept under ignored `artifacts/release/`. Deployment success and exact merge revisions must be confirmed from GitHub and the live browser; this file alone does not establish deployment.

The architectural and material limitations in the integration verification remain. This release changes the default entry and preserves the editor; it does not claim New York parity.
