import * as T from 'three';
import { seeded } from '@game/simulation.js';
import { material, mesh, segment } from './geometry.js';

const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const radial = (angle, distance, height) => new T.Vector3(Math.cos(angle) * distance, height, Math.sin(angle) * distance);

function oval(group, geometry, surface, center, scale, angle = 0, lean = 0) {
  const leaf = mesh(group, geometry, surface, center.toArray());
  leaf.scale.set(...scale);
  leaf.rotation.set(0, -angle, -lean, 'YXZ');
  return leaf;
}

function bearPaw(group, style, specimen, stage) {
  const shape = new T.SphereGeometry(1, 14, 10);
  const foliage = new T.Group();
  const leafColor = new T.Color(specimen.rare ? style.rare : style.leaf);
  const pads = [0.88, 1, 1.14].map((shade) => new T.MeshPhysicalMaterial({
    color: leafColor.clone().multiplyScalar(shade), roughness: 0.92, sheen: 0.75, sheenColor: new T.Color(style.center),
  }));
  const nails = material(style.petal);
  const stem = material(leafColor.clone().multiplyScalar(0.56));
  const rotation = seeded(specimen.seed, 7) * Math.PI * 2;
  const shoots = [1, 1, 3, 4][stage];
  const levels = [1, 2, 2, 3][stage];
  const leafLength = [0.054, 0.082, 0.1, 0.122][stage];
  for (let shoot = 0; shoot < shoots; shoot++) {
    const angle = rotation + shoot * goldenAngle;
    const height = [0.034, 0.14, 0.21, 0.33][stage] * (1 - 0.087 * shoot);
    const spread = shoot === 0 ? 0.019 : 0.082 + shoot * 0.01;
    const base = radial(angle, shoot ? 0.018 : 0, 0);
    const tip = radial(angle, spread, height);
    segment(group, base, tip, leafLength * 0.084, stem, leafLength * 0.047);
    for (let level = 0; level < levels; level++) {
      const node = base.clone().lerp(tip, 0.39 + 0.60 * level / Math.max(1, levels - 1));
      for (let side = 0; side < 2; side++) {
        const heading = angle + level * Math.PI / 2 + side * Math.PI;
        const length = leafLength * (1.03 - level * 0.11) * (0.91 + seeded(specimen.seed, 17 + shoot * 13 + side) * 0.18);
        const lean = 0.8 + 0.17 * (level % 2);
        const color = pads[(shoot + level + side) % pads.length];
        const paw = oval(foliage, shape, color, node.clone().add(radial(heading, length * 0.32, length * 0.32)),
          [length * 0.18, length * 0.48, length * 0.33], heading, lean);
        paw.updateMatrix();
        const toothCount = stage === 0 ? 3 : 5;
        for (let tooth = 0; tooth < toothCount; tooth++) {
          const across = 1.44 * tooth / (toothCount - 1) - 0.72;
          const y = 0.91 * Math.sqrt(1 - across ** 2);
          const claw = new T.Vector3(0, y, across).applyMatrix4(paw.matrix);
          oval(foliage, shape, color, claw, [length * 0.095, length * 0.137, length * 0.091], heading, lean);
          claw.add(radial(heading, length * 0.078, length * 0.065));
          oval(foliage, shape, nails, claw, [length * 0.057, length * 0.065, length * 0.057], heading, lean);
        }
      }
    }
  }
  for (const surface of new Set(foliage.children.map(({ material }) => material))) {
    const parts = foliage.children.filter((leaf) => leaf.material === surface);
    const leaves = new T.InstancedMesh(shape, surface, parts.length);
    parts.forEach((part, i) => { part.updateMatrix(); leaves.setMatrixAt(i, part.matrix); });
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    group.add(leaves);
  }
  for (const unused of pads.filter((pad) => !foliage.children.some((part) => part.material === pad))) unused.dispose();
}

function rosette(group, style, specimen, stage, pointed = false) {
  const shape = new T.SphereGeometry(1, 18, 12);
  if (pointed) {
    const position = shape.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const taper = y > 0 ? 1 - y * 0.63 : 1 + y * 0.36;
      position.setXYZ(i, position.getX(i) * taper, y, position.getZ(i) * taper);
    }
    shape.computeVertexNormals();
  }
  const colors = specimen.rare ? [style.rare, style.rare, style.center] : [style.leaf, style.petal, style.center];
  const surfaces = colors.map((color) => material(color, { roughness: pointed ? 0.32 : 0.83 }));
  const count = (pointed ? [4, 8, 13, 19] : [3, 7, 12, 17])[stage];
  const size = [0.43, 0.67, 0.84, 1][stage];
  const rotation = seeded(specimen.seed, 7) * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const heading = rotation + i * goldenAngle;
    const scale = size * (0.98 + seeded(specimen.seed, i * 71) * 0.10);
    const center = radial(heading, scale * (0.023 + 0.116 * progress), scale * (0.144 - 0.076 * progress));
    const surface = surfaces[progress < 0.21 ? 2 : progress < 0.67 ? 1 : 0];
    oval(group, shape, surface, center, [0.039, 0.106 + progress * 0.016, 0.055].map((n) => n * scale), heading, 0.34 + progress * 1.02);
  }
}

export const succulentModels = new Map([
  ['bear-paw', bearPaw],
  ['haworthia', (group, style, specimen, stage) => rosette(group, style, specimen, stage, true)],
  ['peach-egg', rosette],
]);
