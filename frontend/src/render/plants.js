import * as T from 'three';
import { POTS, SPECIES } from '@game/content.js';
import { seeded } from '@game/simulation.js';
import { dispose, material, mesh, segment } from './geometry.js';
import { cloneStage } from './model-assets.js';
import { succulentModels } from './succulents.js';

const up = new T.Vector3(0, 1, 0);

export function makePot(id) {
  const style = POTS[id];
  const pot = new T.Group();
  const body = material(style.color, { roughness: id === 'clay' ? 0.86 : 0.36 });
  const rim = material(style.rim, { roughness: id === 'clay' ? 0.75 : 0.36 });
  const soil = material('#4d3629');
  const profile = [[0, 0.035], [0.211, 0.035], [0.24, 0.057], [0.28, 0.285], [0.301, 0.295], [0.306, 0.342], [0.296, 0.358], [0.265, 0.358], [0.256, 0.32], [0.2, 0.09], [0, 0.09]];
  mesh(pot, new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), 36), body);
  mesh(pot, new T.CylinderGeometry(0.31, 0.275, 0.035, 36), rim, [0, 0.019, 0]);
  const lip = mesh(pot, new T.TorusGeometry(0.281, 0.019, 8, 40), rim, [0, 0.348, 0]);
  lip.rotation.x = Math.PI / 2;
  mesh(pot, new T.CylinderGeometry(0.263, 0.251, 0.022, 30), soil, [0, 0.315, 0]);
  const grit = [material('#745546'), material('#b18b68'), material('#37291e')];
  const stone = new T.IcosahedronGeometry(0.013, 0);
  for (let i = 0; i < 27; i++) {
    const angle = i * 2.39996;
    const radius = 0.24 * Math.sqrt(seeded(i, 23));
    const pebble = mesh(pot, stone, grit[i % grit.length], [Math.cos(angle) * radius, 0.327, Math.sin(angle) * radius], false);
    pebble.scale.set(1, 0.36, 0.62 + seeded(i));
  }
  return pot;
}

function leaf(group, base, direction, length, width, surface, kind = 'point') {
  const outline = kind === 'clover'
    ? [-0.31, 0.22, -0.65, 0.56, -0.57, 0.84, -0.25, 0.94, 0, 0.79, 0.25, 0.94, 0.57, 0.84, 0.65, 0.56, 0.31, 0.22]
    : [-0.35, 0.19, -0.52, 0.45, -0.31, 0.73, 0, 1, 0.31, 0.73, 0.52, 0.45, 0.35, 0.19];
  const vertices = [0, length * 0.43, width * 0.23, 0, 0, 0];
  for (let i = 0; i < outline.length; i += 2) vertices.push(outline[i] * width, outline[i + 1] * length, 0);
  const indices = [];
  const count = vertices.length / 3;
  for (let i = 1; i < count; i++) indices.push(0, i, i + 1 < count ? i + 1 : 1);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const object = mesh(group, geometry, surface, base.toArray());
  object.quaternion.setFromUnitVectors(up, direction.clone().normalize());
}

const direction = (angle, height) => new T.Vector3(Math.cos(angle), height, Math.sin(angle));

function daisy(group, tip, radius, surfaces, detail) {
  const head = new T.Group();
  head.position.copy(tip);
  head.rotation.set(0.39 + detail * 0.48, 0, detail - 0.5);
  group.add(head);
  const [petals, heart] = surfaces;
  const shape = new T.SphereGeometry(radius, 10, 7);
  const petalCount = 10;
  for (let i = 0; i < petalCount; i++) {
    const angle = i * Math.PI * 2 / petalCount;
    const petal = mesh(head, shape, petals, [Math.cos(angle) * radius * 0.75, 0.003, Math.sin(angle) * radius * 0.75]);
    petal.scale.set(0.55, 0.14, 0.24);
    petal.rotation.y = -angle;
  }
  const center = mesh(head, shape, heart, [0, 0.014, 0]);
  center.scale.set(0.45, 0.26, 0.45);
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const r = Math.sqrt(i / 9) * radius * 0.35;
    const dot = mesh(head, shape, heart, [Math.cos(angle) * r, 0.029, Math.sin(angle) * r], false);
    dot.scale.setScalar(0.09);
  }
}

function spike(group, tip, radius, surfaces) {
  const shape = new T.SphereGeometry(radius, 7, 6);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 3; j++) {
      const angle = j * Math.PI * 2 / 3 + i * 0.88;
      const width = (1 - i * 0.076) * radius;
      const bud = mesh(group, shape, surfaces[(i + j) % 3 === 0 ? 1 : 0],
        [tip.x + Math.cos(angle) * width * 0.51, tip.y + i * radius * 0.52, tip.z + Math.sin(angle) * width * 0.51]);
      bud.scale.set(0.50, 0.34, 0.42);
      bud.rotation.z = 0.28 * Math.sin(angle);
    }
  }
}

export function makePlant(specimen, stage = 3, onChange = () => {}) {
  const style = SPECIES[specimen.species];
  const plant = makePot(specimen.pot);
  const quality = specimen.quality ?? 76;
  const stature = 0.75 + quality / 250;
  const succulent = succulentModels.get(style.model);
  if (succulent) {
    const crown = new T.Group();
    crown.position.y = 0.325;
    crown.scale.setScalar(stature);
    plant.add(crown);
    const fallback = new T.Group();
    succulent(fallback, style, specimen, stage);
    crown.add(fallback);
    if (style.modelSet) {
      cloneStage(style.modelSet, stage, specimen.rare ? style.rare : null).then((model) => {
        if (plant.userData.disposed) { dispose(model); return; }
        model.rotation.y = seeded(specimen.seed, 7) * Math.PI * 2;
        dispose(fallback);
        crown.add(model);
        onChange();
      }, (error) => console.warn(`Using procedural plant for ${specimen.species} stage ${stage + 1}:`, error));
    }
    return plant;
  }
  const leafColor = specimen.rare && style.model === 'clover' ? '#ba8249' : style.leaf;
  const leaves = [0.76, 1, 1.18].map((shade) => material(new T.Color(leafColor).multiplyScalar(shade), { side: T.DoubleSide }));
  const stems = material(new T.Color(style.leaf).multiplyScalar(0.8));
  const colored = specimen.rare ? style.rare : style.petal;
  const blossoms = [material(colored), material(style.center)];
  const budColor = style.model === 'spike' ? blossoms[0] : leaves[1];
  const root = new T.Vector3(0, 0.32, 0);
  const stemsCount = [2, 5, 6, 5 + Math.floor(quality / 24)][stage];
  for (let i = 0; i < stemsCount; i++) {
    const vary = seeded(specimen.seed, i * 101);
    const angle = i * 2.39996 + seeded(specimen.seed, 7) * 2;
    const h = [0.12, 0.39, 0.55, 0.66][stage] * (0.65 + vary * 0.63) * stature;
    const tip = direction(angle, 0).multiplyScalar(h * (0.24 + vary * 0.35)).add(new T.Vector3(0, root.y + h, 0));
    const mid = root.clone().lerp(tip, 0.47);
    mid.x *= 0.65;
    mid.z *= 0.65;
    segment(plant, root, mid, 0.012, stems, 0.008);
    segment(plant, mid, tip, 0.008, stems, 0.005);
    if (style.model === 'clover') {
      for (let j = 0; j < 3; j++) leaf(plant, tip, direction(angle + j * 2.094, 0.25), h * 0.33 + 0.035, h * 0.33 + 0.035, leaves[(i + j) % 3], 'clover');
    } else {
      const spread = style.model === 'spike' ? 0.34 : 0.68;
      const length = h * (0.33 + vary * 0.21) + 0.03;
      leaf(plant, mid, direction(angle + 0.45, 0.54), length, length * spread, leaves[i % 3]);
      leaf(plant, mid.clone().lerp(tip, 0.28), direction(angle + 2.6, 0.53), length * 0.8, length * spread, leaves[(i + 1) % 3]);
      if (stage >= 1) leaf(plant, mid.clone().lerp(root, 0.3), direction(angle - 0.85, 0.16), length * 1.12, length * spread, leaves[(i + 2) % 3]);
    }
    if (stage === 2 && i % 2 === 0) mesh(plant, new T.SphereGeometry(0.027, 9, 7), budColor, [tip.x, tip.y + 0.013, tip.z]);
    if (stage === 3 && style.model === 'daisy') daisy(plant, tip, (0.086 + 0.033 * vary) * stature, blossoms, vary);
    if (stage === 3 && style.model === 'spike') spike(plant, tip, (0.065 + 0.025 * vary) * stature, blossoms);
    if (stage === 3 && style.model === 'clover' && i % 2 === 0) {
      const bloom = tip.clone().add(new T.Vector3(0.012, 0.075, 0));
      segment(plant, mid, bloom, 0.006, stems, 0.004);
      daisy(plant, bloom, (0.042 + 0.018 * vary) * stature, blossoms, vary);
    }
  }
  return plant;
}
