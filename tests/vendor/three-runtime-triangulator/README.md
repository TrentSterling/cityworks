# Runtime triangulator test dependency

ShapeUtils.js, Earcut.js and lib/earcut.js are copied from the exact Three.js commit pinned by Cityworks index.html:
https://github.com/mrdoob/three.js/tree/b3396270682287470d161658ac01084d25e8dba6/src/extras

The upstream Earcut library identifies itself as mapbox/earcut 3.0.2. Three.js MIT and Mapbox ISC licenses are retained here. The package.json only marks these test modules as ES modules. No browser, network requests or GPU are needed by this geometry test. Other mesh math comes from the existing vendored r140 dependency.
