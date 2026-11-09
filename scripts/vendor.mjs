const addons = 'node_modules/three/examples/jsm';

export const vendor = {
  'vendor/three.module.js': 'node_modules/three/build/three.module.js',
  'vendor/three.core.js': 'node_modules/three/build/three.core.js',
  'vendor/OrbitControls.js': `${addons}/controls/OrbitControls.js`,
  'vendor/addons/environments/RoomEnvironment.js': `${addons}/environments/RoomEnvironment.js`,
  'vendor/addons/loaders/GLTFLoader.js': `${addons}/loaders/GLTFLoader.js`,
  'vendor/addons/utils/BufferGeometryUtils.js': `${addons}/utils/BufferGeometryUtils.js`,
  'vendor/addons/utils/SkeletonUtils.js': `${addons}/utils/SkeletonUtils.js`,
  'vendor/THREE-LICENSE.txt': 'node_modules/three/LICENSE',
};
