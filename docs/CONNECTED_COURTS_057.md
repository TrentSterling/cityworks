# Connected courts 0.5.7

Adds a second pedestrian route to shared gardens and squares only where a full 2.4 m corridor fits between existing buildings. Default city has four qualifying connections. It does not redraw streets, parcels, buildings or existing entrances. Service yards remain single-purpose access routes.

Candidates join a different street to the existing court entrance's destination. Selection requires at least 15 m and 20% savings against the shorter local block-boundary reference. This is not a citywide routing/shortest-path claim. Each candidate must stay on land inside its own block plus sidewalk, avoid asphalt, and clear building volumes below 2.5 m headroom by 0.25 m. Trees are excluded from the new paving. No narrow clipped residual paths are accepted.

New projects use `0.5.7-connected-courts`. Saved `0.5.4-resolved-massing` and `0.5.1-usable-fabric` projects keep their original geometry rules. Three pre-change complete-city SHA snapshots verify exact 0.5.4 replay; existing tests retain 0.5.1 snapshots. Streets/buildings/original access are compared directly between old and new generators.

Qualification: `npm test`, `npm run build`, then `python tools/verify_court_connections.py` with the ab9744b baseline checked out under `baseline/`. The browser harness renders three seeds, matched before/after camera views, raycasts the actual paving along three width samples, checks tree clearance and standalone/mobile loading. Software-renderer timing is not a claim about real hardware performance. Review the screenshots and report, not just the exit code.

This is a focused public-realm improvement, not a complete pedestrian navigation system. Paths currently share ordinary paving materials; no bespoke wayfinding, furnishings or accessibility certification is claimed.

## Qualified checkpoint

[Run 41731033802](https://github.com/TrentSterling/cityworks/actions/runs/41731033802) passed the complete model suite and rendered qualification on 2026-11-03. There are 4, 5 and 4 new routes across the three focused seeds; 951 actual paving samples pass. Previous-version autosave, standalone loading and mobile resize pass with no runtime errors. Matched screenshots were visually reviewed independently: paths connect through existing gaps without moving buildings or roads. Low tree canopies were checked using actual transformed crown vertices.

The runner uses headful Chromium 156 through Xvfb and the explicit SwiftShader test adapter. Earlier stock headless attempts produced blank output in both old and new versions and were rejected, despite passing geometry checks. Mobile validation waits for the canvas resize, rather than assuming a fixed half-second pause is enough on software rendering.

Remaining visual limitation: narrow additions meet wider original paths with abrupt shoulders. The courts are still sparsely furnished. These are useful connections, not a finished landscape-design pass.
