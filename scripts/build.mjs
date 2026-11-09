import { cp, mkdir, rm } from 'node:fs/promises';
import { vendor } from './vendor.mjs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('vendor/', dist), { recursive: true });
const files = {
  'frontend/index.html': 'index.html',
  'frontend/config.js': 'config.js',
  'frontend/src/': 'src/',
  'shared/': 'shared/',
};
await Promise.all(Object.entries(files).map(([from, to]) => cp(new URL(from, root), new URL(to, dist), { recursive: true })));
await Promise.all(Object.entries(vendor).map(([to, from]) => cp(new URL(from, root), new URL(to, dist))));
try { await cp(new URL('frontend/assets/', root), new URL('assets/', dist), { recursive: true }); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log('静态测试版已写入 dist/');
