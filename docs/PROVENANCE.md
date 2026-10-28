# Dependencies and provenance

Cityworks uses synthetic geometry. The planning rules, street graph construction, frontage parcel allocation, identity rules and Three.js adapter in `src/` are original Cityworks code. No surveyed footprints, third-party image assets or proprietary city-generation implementation are included. This project is not represented as a certified clean-room implementation.

## Runtime dependencies

| Dependency | Version | Source | License |
| --- | --- | --- | --- |
| Three.js | r140 | https://github.com/mrdoob/three.js/tree/r140 | MIT |
| Javascript Clipper | npm `clipper-lib@6.4.2`, internal 6.4.2.2 | https://www.npmjs.com/package/clipper-lib/v/6.4.2 | Boost Software License 1.0, with JSBN notices |

Both distributions are vendored without modifications. Three.js renders the preview. Clipper performs polygon Boolean and offset operations; this is licensed dependency reuse. Its public API documentation is at https://sourceforge.net/p/jsclipper/wiki/documentation/.

Clipper source SHA-256: `a650c6946682edc1a64016f6553eeb5c32ce45eb7ca0ad5d8221961af011d97c`.

Full notices are in `THIRD_PARTY_NOTICES.txt`, `vendor/clipper-BOOST-LICENSE.txt` and `vendor/clipper-JSBN-LICENSE.txt`. The standalone build embeds these notices. Original dependency headers remain intact.

## Public behavioral references

- [slop-newyork](https://github.com/mrdoob/slop-newyork): metric facade scale and shared opaque materials. No code or geodata copied.
- [Epic City Sample PCG documentation](https://dev.epicgames.com/documentation/unreal-engine/city-sample-pcg-for-unreal-engine): boundary, artery, district, block, lot and park planning behavior. No Epic implementation or assets copied.

Cityworks currently has no project-wide license for its original code. Third-party dependencies retain their own licenses.
