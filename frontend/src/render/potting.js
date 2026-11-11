import * as T from 'three';
import { MATERIALS, SOIL_KEYS } from '@game/content.js';
import { seeded } from '@game/simulation.js';
import { modelFrom } from './model-assets.js';

function samples(potting) {
  const patches = [];
  if (potting.mix) {
    for (const key of SOIL_KEYS) {
      const count = Math.round((potting.mix[key] ?? 0) * .26);
      for (let i = 0; i < count; i++) patches.push(key);
    }
  }
  return patches;
}

function layer(pot, keys, height, spread, size, seed, onChange) {
  const locations = new Map();
  const ordered = keys.map((key, i) => ({ key, order: seeded(seed, i * 43) })).sort((a, b) => a.order - b.order);
  for (const [i, { key }] of ordered.entries()) {
    const angle = i * 2.39996 + seeded(seed, 31) * Math.PI * 2;
    const radius = spread * Math.sqrt((i + .5) / ordered.length);
    const transform = new T.Object3D();
    transform.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    transform.rotation.y = angle;
    transform.scale.set(size, size * .7, size);
    transform.updateMatrix();
    if (!locations.has(key)) locations.set(key, []);
    locations.get(key).push(transform.matrix);
  }

  for (const [key, matrices] of locations) {
    if (!Object.hasOwn(MATERIALS, key)) continue;
    const url = new URL(`../../assets/potting/${key}.glb`, import.meta.url).href;
    modelFrom(url).then((source) => {
      if (pot.userData.disposed) return;
      source.traverse((part) => {
        if (!part.isMesh) return;
        const material = Array.isArray(part.material) ? part.material.map((item) => item.clone()) : part.material.clone();
        const stones = new T.InstancedMesh(part.geometry, material, matrices.length);
        stones.userData.sharedGeometry = true;
        stones.receiveShadow = true;
        matrices.forEach((matrix, index) => stones.setMatrixAt(index, matrix));
        pot.add(stones);
      });
      onChange();
    }, (error) => console.warn(`Could not load potting material ${key}`, error));
  }
}

export function addPotting(pot, potting, seed, onChange) {
  if (potting.drainage) layer(pot, Array(7).fill(potting.drainage), .10, .14, .63, seed, onChange);
  if (potting.topping) layer(pot, Array(15).fill(potting.topping), .325, .20, .53, seed, onChange);
  else if (potting.mix) layer(pot, samples(potting), .325, .21, .41, seed, onChange);
}
