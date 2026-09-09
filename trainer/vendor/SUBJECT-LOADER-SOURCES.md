# Subject mesh loader dependencies

Three.js r185 matches the existing `three.core.js` revision. MIT license text:
`THREE-LICENSE.txt`.

- GLTFLoader.js: https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js
- BufferGeometryUtils.js: https://github.com/mrdoob/three.js/blob/r185/examples/jsm/utils/BufferGeometryUtils.js
- SkeletonUtils.js: https://github.com/mrdoob/three.js/blob/r185/examples/jsm/utils/SkeletonUtils.js

Local modification: GLTFLoader imports `./BufferGeometryUtils.js` and
`./SkeletonUtils.js` instead of `../utils/…`. No runtime CDN or service is used.
The initial pack does not require a Meshopt decoder.
