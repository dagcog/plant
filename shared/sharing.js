import { SHELF_LIMIT } from './content.js';
import { specimenOf } from './simulation.js';
import { isGardenId, validSpecimen } from './storage.js';

export function shareURL(state, current) {
  const url = new URL(current);
  const payload = { v: 1, id: state.gardenId, plants: state.shelf.map(specimenOf) };
  url.hash = `garden=${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
  return url.href;
}

export function readShare(hash) {
  if (!hash.startsWith('#garden=')) return null;
  const encoded = hash.slice(8);
  if (encoded.length > 1800 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('无法打开这张花架名片。');
  let data;
  try { data = JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))); }
  catch { throw new Error('无法打开这张花架名片。'); }
  if (data?.v !== 1 || !isGardenId(data.id) || !Array.isArray(data.plants) || data.plants.length > SHELF_LIMIT
    || !data.plants.every((plant) => validSpecimen(plant) && Number.isInteger(plant.quality) && plant.quality >= 0 && plant.quality <= 100)) {
    throw new Error('花架名片的内容或版本不兼容。');
  }
  return { id: data.id, plants: data.plants.map(specimenOf), name: '访客的窗边花架', author: '分享名片', likes: 0 };
}
