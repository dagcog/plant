import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('..', import.meta.url));
const built = process.argv.includes('--dist');
const root = resolve(project, built ? 'dist' : 'frontend');
const vendor = {
  '/vendor/three.module.js': 'node_modules/three/build/three.module.js',
  '/vendor/three.core.js': 'node_modules/three/build/three.core.js',
  '/vendor/OrbitControls.js': 'node_modules/three/examples/jsm/controls/OrbitControls.js',
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const port = Number(process.env.PLANT_PORT ?? (built ? 4173 : 5173));

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/config.js') {
      const hostname = new URL(`http://${request.headers.host ?? '127.0.0.1'}`).hostname;
      const local = hostname === 'localhost' ? 'localhost' : '127.0.0.1';
      const api = process.env.PLANT_API_URL ?? `http://${local}:${Number(process.env.PLANT_API_PORT ?? 3001)}/api`;
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }).end(`globalThis.WINDOWSILL_API_BASE = ${JSON.stringify(api)};`);
      return;
    }
    let base = root;
    let relative = `.${path === '/' ? '/index.html' : path}`;
    if (!built && Object.hasOwn(vendor, path)) { base = resolve(project, 'node_modules/three'); relative = vendor[path].slice('node_modules/three/'.length); }
    else if (!built && path.startsWith('/shared/')) { base = resolve(project, 'shared'); relative = path.slice('/shared/'.length); }
    const file = resolve(base, relative);
    if (!file.startsWith(base + sep)) { response.writeHead(404).end(); return; }
    const type = types[extname(file)];
    if (!type) { response.writeHead(404).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`窗边小事 http://127.0.0.1:${port}`));
