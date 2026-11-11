import { Color } from 'three';

const modelSets = new Map([
  ['haworthia', ['01-seedling', '02-juvenile', '03-rosette', '04-mature']
    .map((file) => new URL(`../../assets/plants/haworthia/${file}.glb`, import.meta.url).href)],
]);
const models = new Map();

async function load(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(url)).scene;
}

export function modelFrom(url) {
  if (!models.has(url)) {
    models.set(url, load(url).catch((error) => {
      models.delete(url);
      throw error;
    }));
  }
  return models.get(url);
}

export async function cloneStage(modelSet, stage, rareColor) {
  const url = modelSets.get(modelSet)?.[stage];
  if (!url) throw new Error(`Missing model stage: ${modelSet}/${stage}`);
  const model = (await modelFrom(url)).clone(true);
  const tint = rareColor && new Color(rareColor);
  const surfaces = new Map();
  function instance(surface) {
    if (!surfaces.has(surface)) {
      const copy = surface.clone();
      if (tint && copy.color) copy.color.multiply(tint);
      surfaces.set(surface, copy);
    }
    return surfaces.get(surface);
  }
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.sharedGeometry = true;
    object.material = Array.isArray(object.material) ? object.material.map(instance) : instance(object.material);
  });
  return model;
}
