# Cityworks 0.5.8: curb fit

Curb cleanup previously removed thin fragments after the sidewalk had already excluded the original curb footprint. This left small holes in pavement. The renderer now returns those fragments to the existing sidewalk batch and clips infill against actual curb triangles. It also re-clips emitted infill triangles when overlap exceeds the geometry engine's existing 0.001 square metre threshold.

The street layout, building and facade records, materials, ramps and saved projects retain their generation rules. The generator identifier remains `0.5.7-connected-courts`; this patch does not migrate saved city data. No new ground mesh batches are introduced.

## Verification

The existing model, topology, road-paint, building, editor, facade, public-realm and saved-project tests pass. The added geometry test uses the same Three.js ShapeUtils/Earcut revision pinned by the app. It covers the default map, street/coast/bridge control extremes and a 3.2 square kilometre map: 1,066 seam probes and 6,678 ramp-height probes pass, with unchanged complete city JSON. The standalone build passes.

Run `npm test` for all checks, or `npm run test:ground-fit` for the focused regression. The previous ground builder fails that regression on a wider pavement gap. Test-only Three.js and Earcut dependencies retain their MIT and ISC notices.

The clipping engine uses a 1 mm grid. These are sampled checks within that tolerance, not proof of perfectly watertight geometry or globally zero overlap. Browser visual review and hardware-performance testing were unavailable before publication. The existing deployment workflow checks live source bytes and browser startup separately; its results should be read independently from the CPU tests.

## Rollback

The previous public release is preserved at `rollback/pre-curb-fit-058-20261105`, commit `cb6d07701bb81c708609a7f5bd78f4243524e2bf`.
