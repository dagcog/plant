import * as T from 'three';
import { SLOTS } from '@game/content.js';
import { seeded, stageIndex } from '@game/simulation.js';
import { makePlant } from './plants.js';
import { dispose, mesh, segment } from './geometry.js';
import { landscape } from './landscape.js';

const lighting = {
  morning: { sun: '#ffe1a6', ambient: '#fff0d2', energy: 2.22, fill: 1.68, source: [-4.5, 5.2, -2.6], wall: '#e2c9a3', beam: 0.24 },
  noon: { sun: '#fff3d7', ambient: '#e7f4ff', energy: 2.68, fill: 1.86, source: [-1.5, 7.8, -3.2], wall: '#ebd9bd', beam: 0.13 },
  evening: { sun: '#ffb084', ambient: '#afb8f0', energy: 1.95, fill: 1.45, source: [4.8, 3.4, -2.5], wall: '#b5918b', beam: 0.20 },
};

function grain(color, grainColor, key) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = grainColor;
  for (let i = 0; i < 75; i++) {
    const y = seeded(i, key) * 128;
    const x = seeded(i, 637) * 520 - 60;
    const length = 50 + seeded(i, 128) * 390;
    context.globalAlpha = 0.06 + seeded(i, 55) * 0.2;
    context.lineWidth = 0.45 + seeded(i, 213) * 1.7;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + length * 0.25, y - 4, x + length * 0.77, y + 5, x + length, y + 0.3);
    context.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createWorld(host, onSelect, onMarker, onFallback) {
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); }
  catch { onFallback(); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color('#dcc7a9');
  const camera = new T.PerspectiveCamera(37, 1, 0.1, 36);
  const room = new T.Group();
  scene.add(room);
  const surface = (color, extra) => new T.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const box = (w, h, d, x, y, z, mat, shadow = true) => mesh(room, new T.BoxGeometry(w, h, d), mat, [x, y, z], shadow);
  const paint = surface('#e1c6a1');
  const frame = surface('#fff0d6', { map: grain('#f3e5cc', '#a98460', 66) });
  const bevel = surface('#dbc3a2');
  const wood = surface('#e7c394', { map: grain('#d7aa79', '#714c36', 37) });
  const woodEdge = surface('#a87554', { map: grain('#e6c69c', '#80583f', 52) });
  const floor = surface('#a57959');
  const dark = surface('#6b503b');
  const paper = surface('#e9d8a8');
  const sage = surface('#7d8262');
  const rust = surface('#aa644c');
  const copper = surface('#9e7150', { metalness: 0.17, roughness: 0.52 });
  const textures = Object.fromEntries(Object.keys(lighting).map((key) => [key, landscape(key)]));
  const view = new T.MeshBasicMaterial({ map: textures.morning, toneMapped: false });

  mesh(room, new T.PlaneGeometry(6.6, 3.3), view, [0, 2.29, -1.35], false);
  box(0.94, 5.5, 0.25, -3.5, 1.8, -0.92, paint, false);
  box(0.94, 5.5, 0.25, 3.5, 1.8, -0.92, paint, false);
  box(8.1, 0.64, 0.28, 0, 4.00, -0.94, paint, false);
  box(8.1, 0.87, 0.28, 0, 0.30, -0.94, paint, false);
  for (const x of [-3.02, -1.07, 1.07, 3.02]) {
    box(0.115, 3.06, 0.21, x, 2.27, -0.98, bevel);
    box(0.071, 3.02, 0.04, x, 2.27, -0.854, frame);
  }
  for (const y of [0.79, 2.66, 3.75]) {
    box(6.20, 0.105, 0.21, 0, y, -0.97, bevel);
    box(6.18, 0.066, 0.048, 0, y + 0.009, -0.842, frame);
  }
  for (const x of [-1.17, 1.17]) {
    box(0.062, 0.164, 0.03, x, 1.68, -0.816, copper);
    box(0.105, 0.045, 0.056, x, 1.71, -0.778, copper);
  }
  box(6.9, 0.16, 1.74, 0, 0.69, -0.08, wood);
  box(6.91, 0.10, 0.06, 0, 0.64, 0.805, woodEdge);
  box(6.67, 0.42, 0.09, 0, 0.39, 0.64, woodEdge);
  for (const x of [-2.7, 2.7]) box(0.18, 0.65, 0.32, x, 0.32, 0.42, dark);
  box(9.5, 0.15, 8, 0, -0.06, 0.6, floor, false);

  const books = new T.Group();
  books.position.set(-2.48, 0.79, 0.19);
  books.rotation.y = 0.16;
  room.add(books);
  for (let i = 0; i < 3; i++) {
    const stack = new T.Group();
    stack.rotation.y = i % 2 ? -0.21 : 0.15;
    stack.position.set(i * 0.018, i * 0.082, 0);
    books.add(stack);
    const cover = [rust, sage, dark][i];
    mesh(stack, new T.BoxGeometry(0.52 - i * 0.03, 0.017, 0.38), cover, [0, 0, 0]);
    mesh(stack, new T.BoxGeometry(0.47 - i * 0.03, 0.046, 0.354), paper, [0.006, 0.032, 0]);
    mesh(stack, new T.BoxGeometry(0.52 - i * 0.03, 0.017, 0.38), cover, [0, 0.063, 0]);
    mesh(stack, new T.BoxGeometry(0.033, 0.064, 0.38), cover, [-0.24 + i * 0.014, 0.031, 0]);
  }

  const can = new T.Group();
  can.position.set(2.43, 0.78, -0.14);
  can.rotation.y = -0.45;
  room.add(can);
  const enamel = surface('#74886c', { roughness: 0.43, metalness: 0.14 });
  mesh(can, new T.CylinderGeometry(0.196, 0.215, 0.31, 32), enamel, [0, 0.163, 0]);
  mesh(can, new T.CylinderGeometry(0.197, 0.193, 0.025, 32), sage, [0, 0.324, 0]);
  mesh(can, new T.CylinderGeometry(0.09, 0.09, 0.013, 24), dark, [0, 0.341, 0]);
  mesh(can, new T.TorusGeometry(0.15, 0.018, 8, 24), enamel, [0.207, 0.193, 0]);
  const spoutEnd = new T.Vector3(-0.50, 0.36, 0.035);
  segment(can, new T.Vector3(-0.14, 0.09, 0), spoutEnd, 0.058, enamel, 0.025);
  segment(can, spoutEnd, new T.Vector3(-0.556, 0.404, 0.04), 0.028, enamel, 0.073);

  const pads = new T.Group();
  scene.add(pads);
  const pickables = [];
  const rings = new Map();
  const plants = new Map();
  const z = 0.27;
  const y = 0.779;
  for (const slot of SLOTS) {
    const mat = surface('#d7b48a', { transparent: true, opacity: 0.6 });
    const pad = mesh(pads, new T.CircleGeometry(0.36, 48), mat, [slot.x, y + 0.005, z], false);
    pad.rotation.x = -Math.PI / 2;
    const ring = mesh(pads, new T.RingGeometry(0.363, 0.378, 48), new T.MeshBasicMaterial({ color: '#efe4c3', transparent: true, opacity: 0.66 }), [slot.x, y + 0.008, z], false);
    ring.rotation.x = -Math.PI / 2;
    rings.set(slot.id, ring);
    const hit = mesh(pads, new T.BoxGeometry(0.89, 1.15, 0.83), new T.MeshBasicMaterial({ visible: false }), [slot.x, y + 0.5, z], false);
    hit.userData.slot = slot.id;
    pickables.push(hit);
  }

  const ambient = new T.HemisphereLight('#fff0d2', '#877058', 1.7);
  const fill = new T.DirectionalLight('#fff0dd', 0.58);
  fill.position.set(1.5, 3.1, 4.6);
  const sun = new T.DirectionalLight('#ffe1a6', 2.22);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -4.7, right: 4.7, top: 3.8, bottom: -3.8, near: 0.5, far: 17 });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.012;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(0, 0.68, 0.15);
  scene.add(ambient, fill, sun, sun.target);

  let paused = false;
  let phase = null;
  let chosen = null;
  function draw() {
    if (!paused && host.clientWidth && host.clientHeight) renderer.render(scene, camera);
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    camera.aspect = w / h;
    const distance = Math.max(5.6, 4.95 / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.set(0.035, 2.43 + (distance - 5.6) * 0.14, distance);
    camera.lookAt(0, 1.78, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.setSize(w, h, false);
    for (const slot of SLOTS) {
      const point = new T.Vector3(slot.x, y - 0.19, z + 0.56).project(camera);
      onMarker(slot.id, (point.x + 1) * 50, (1 - point.y) * 50);
    }
    draw();
  }
  new ResizeObserver(resize).observe(host);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    paused = true;
    onFallback();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    paused = false;
    host.classList.remove('fallback');
    resize();
  });

  const ray = new T.Raycaster();
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hit = ray.intersectObjects(pickables)[0];
    if (hit) onSelect(hit.object.userData.slot);
  });

  return {
    update(state, period, selected) {
      let changed = false;
      if (phase !== period) {
        phase = period;
        const style = lighting[period];
        view.map = textures[period];
        ambient.color.set(style.ambient);
        ambient.intensity = style.fill;
        paint.color.set(style.wall);
        sun.color.set(style.sun);
        sun.intensity = style.energy;
        sun.position.set(...style.source);
        host.style.setProperty('--beam-opacity', style.beam);
        changed = true;
      }
      if (chosen !== selected) {
        chosen = selected;
        for (const [id, ring] of rings) {
          ring.material.color.set(id === selected ? '#fff7b9' : '#e6cf9d');
          ring.material.opacity = id === selected ? 0.88 : 0.41;
        }
        changed = true;
      }
      for (const slot of SLOTS) {
        const specimen = state.slots[slot.id].plant;
        const stage = specimen ? stageIndex(specimen) : -1;
        const key = specimen ? `${specimen.species}/${specimen.pot}/${specimen.seed}/${stage}/${specimen.quality}/${specimen.rare}` : '';
        const previous = plants.get(slot.id);
        if (key === (previous?.key ?? '')) continue;
        if (previous) { dispose(previous.object); plants.delete(slot.id); }
        if (specimen) {
          const object = makePlant(specimen, stage, draw);
          object.position.set(slot.x, y, z);
          object.scale.setScalar(1.18);
          scene.add(object);
          plants.set(slot.id, { key, object });
        }
        changed = true;
      }
      if (changed) draw();
    },
  };
}
