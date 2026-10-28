# Cityworks

A deterministic city planning prototype with a Three.js preview. Start with land and skyline intent, then derive connected streets, blocks, parcels and building masses from one engine-neutral model.

[Open the live demo](https://trentsterling.github.io/cityworks/)

## Run

Open `index.html` in Chrome, or serve this directory with `python -m http.server 8000` and visit `http://localhost:8000`. All runtime dependencies are included locally. Generation happens in your browser.

Drag the island boundary, change development intensity or skyline height, and reposition the arterial routes. A lagoon toggle preserves interior water. Switch between perspective, overhead, street and boulevard views, with plan, massing and facade layers. Drag to orbit or look; street views use WASD movement and Q/E elevation. Click a building to inspect its stable ID and dimensions. Export saves Cityworks JSON schema 2.

## Version 0.2

- Concave coasts, water holes and explicit invalid-input diagnostics.
- A connected street graph with shared crossing junctions, unioned road coverage and irregular blocks.
- Nonoverlapping road-facing parcels, on-land access and contained footprints with 2 m setbacks.
- Stable surviving parcel/building IDs and deterministic per-entity variation.
- Metric facade coordinates on rotated and irregular footprints.

## Test and build

Node.js runs the model tests without an npm install:

```sh
npm test
python tools/build.py
```

The build produces `artifacts/v0.2/Cityworks-0.2.0.html`, a self-contained offline app with embedded dependency notices.

The optional browser harness needs Python Playwright and an installed Google Chrome:

```sh
python -m pip install playwright
python tools/verify_browser.py
```

It runs Chrome headlessly and muted, captures four views, and checks UI edits, export, geometry and resources. Use `--url https://trentsterling.github.io/cityworks/` to verify the deployed app, or `--browser-executable PATH` for a nonstandard Chrome installation. Reports and captures are written to ignored `artifacts/`.

## Scope

One flat island, mostly straight grid streets and one diagonal arterial. Development intensity changes height rather than parcel occupancy. Small isolated road fragments are explicitly reported as unbuilt; substantial disconnected components reject the layout. The UI provides outer-boundary handles and a lagoon toggle, not a general hole or route editor. Invalid edits retain the previous valid city.

The model currently rebuilds synchronously. Buildings and facades are a limited demonstration. There are no bridges, curved roads, traffic, collisions, LOD or Unity importer yet. JSON data is renderer-neutral and intended to support a later bake/export pipeline.

See the [data contract](docs/CONTRACT.md), [verification results](docs/VERIFICATION.md) and [dependency provenance](docs/PROVENANCE.md). The tested default has 332 buildings and 49 blocks, with 24 full-frame draw calls including shadows. These are desktop measurements, not device-port performance claims.

## Licensing

No project-wide license has been selected for the original Cityworks code. Vendored dependencies retain their licenses; see [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
