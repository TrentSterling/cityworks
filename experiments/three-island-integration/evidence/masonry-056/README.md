# Masonry and window AC comparison

The `before-` views use released commit `46e75c6b1954aceba2c23a6897082fdbffa61364` (0.5.5). The `after-` views use 0.5.6 with the same city, camera, viewport and midday lighting. Camera positions and render counts are recorded in [comparison-report.json](comparison-report.json); `tools/verify_masonry.py` reproduces the comparison.

| View | Before | After |
| --- | --- | --- |
| Red brick close-up | [0.5.5](before-brick-close.png) | [0.5.6](after-brick-close.png) |
| Oblique brick and units | [0.5.5](before-brick-oblique.png) | [0.5.6](after-brick-oblique.png) |
| Residential street frontage | [0.5.5](before-residential.png) | [0.5.6](after-residential.png) |
| Stone frontage close-up | [0.5.5](before-residential-close.png) | [0.5.6](after-residential-close.png) |
| Industrial street | [0.5.5](before-industrial.png) | [0.5.6](after-industrial.png) |
| Distant harbour | [0.5.5](before-distant.png) | [0.5.6](after-distant.png) |
| Default street | [0.5.5](before-street.png) | [0.5.6](after-street.png) |

`brick-motion` shifts the oblique camera and target by 8 cm to expose unstable fine detail. It is a second still, not a claim that every possible moving view is artifact-free. Fine patterns fade toward a smooth material at distance. Window units remain shader details, so their silhouettes do not project from the wall.
