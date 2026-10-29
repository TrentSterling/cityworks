# 0.5.2 independent review

A fresh read-only reviewer examined the candidate against 0.5.1, inspected the frontal, oblique, interior, narrow-fit, street and editor PNGs, and independently ran facade and editor-state regressions. No geometry or editor-data regression was demonstrated. The review identified and prompted the following bounded corrections before release:

| Finding | Correction and verification |
| --- | --- |
| A repeated keydown could restart movement after Escape. | Ignore repeats for a key removed by reset until a fresh press. Browser regression reproduces the original failure and verifies the correction. |
| Empty, inherited and plaintext-only editable fields were not all protected from movement keys. | Use the DOM's `isContentEditable` state. Browser tests cover all three forms and held-input cleanup when focus leaves the preview iframe. |
| Near-collinear edges in one domain could derive different room/weathering seeds from their separate normals. | Carry a stable integer seed and tangent in `facadeFrame`. The actual default-map target `parcel:a7e98cac:building:base` now uses seed 206 on both joined segments. |
| A ring starting mid-wall reset the brick pattern inside a joined domain. | Move the inevitable perimeter seam to a physical corner and preserve continuous metric distance through cyclic domain joins. |
| A joined domain straddling the 45-degree dominant-axis threshold could reverse texture coordinates between edges. | Derive reversal, sign orientation and interior-ray tangent from the shared domain frame. The reviewer checked 720 orientations and eight rotated/mirrored versions of the exact repro. |

The reviewer independently checked six generated layouts containing 1,744 rings, 233 joined boundaries and 43 cyclic joins. The final local browser check covers all 36 joined domains and 1,599 facade panels in the default city, including finite attributes and the exact seed-seam target. Camera mode, position, target and quaternion are checked through reroll and undo. The final targeted code-review judgment found no remaining blocker.

The frame adds 95,940 bytes to inspected geometry attributes (2,498,334 to 2,594,274, +3.84%). Street draws, triangles and materials remain 86 / 296,047 / 39. It adds no vertices, triangles or render pass.

Default generated map JSON is byte-identical to 0.5.1. Short end faces, wedge-shaped aprons and awkward massing are inherited layout limitations, not fixes claimed by this facade release. Saved static oblique room views showed no new cross-window artifact; they do not certify every camera angle or temporal behavior. The stationary fixture is separately checked for identical repeated captures. The separate ground-access prototype is excluded.
