import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('vendor/', dist), { recursive: true });
const files = {
  'frontend/index.html': 'index.html',
  'frontend/config.js': 'config.js',
  'frontend/src/': 'src/',
  'shared/': 'shared/',
  'node_modules/three/build/three.module.js': 'vendor/three.module.js',
  'node_modules/three/build/three.core.js': 'vendor/three.core.js',
  'node_modules/three/examples/jsm/controls/OrbitControls.js': 'vendor/OrbitControls.js',
  'node_modules/three/LICENSE': 'vendor/THREE-LICENSE.txt',
};
await Promise.all(Object.entries(files).map(([from, to]) => cp(new URL(from, root), new URL(to, dist), { recursive: true })));
try { await cp(new URL('frontend/assets/', root), new URL('assets/', dist), { recursive: true }); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log('静态测试版已写入 dist/');
