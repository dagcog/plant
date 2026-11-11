import { ACHIEVEMENTS, POTS, SHELF_LIMIT, SLOTS, SPECIES } from './content.js';
import { normalizePotting } from './releases/v3/potting.js';

export const isGardenId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const within = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const count = (value) => Number.isSafeInteger(value) && value >= 0;

export function validSpecimen(value) {
  return record(value) && typeof value.species === 'string' && Object.hasOwn(SPECIES, value.species)
    && typeof value.pot === 'string' && Object.hasOwn(POTS, value.pot)
    && typeof value.rare === 'boolean' && count(value.seed) && value.seed <= 0xffffffff
    && normalizePotting(value.potting) !== undefined;
}

const validMature = (value) => validSpecimen(value) && within(value.quality, 0, 100);

function validPlant(plant) {
  return validSpecimen(plant) && within(plant.moisture, 0, 100) && within(plant.nutrition, 0, 100)
    && [0, 1, 2].includes(plant.exposure) && within(plant.growth, 0, 1)
    && count(plant.samples) && within(plant.score, 0, plant.samples + 0.000001)
    && (plant.quality === null ? plant.growth < 1 : plant.growth === 1 && validMature(plant));
}

export function decodeSave(raw) {
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data?.version !== 1) throw new Error('存档版本暂不兼容。');
  if (!isGardenId(data.gardenId) || !count(data.revision) || !count(data.time) || !count(data.wall)
    || !count(data.coins) || !record(data.slots) || !Array.isArray(data.shelf) || data.shelf.length > SHELF_LIMIT
    || !data.shelf.every(validMature) || !record(data.album) || !record(data.achievements) || !record(data.likes)
    || !record(data.stats) || !count(data.stats.sold) || !count(data.stats.displayed)
    || !SLOTS.every(({ id, price }) => {
      const slot = data.slots[id];
      return record(slot) && typeof slot.unlocked === 'boolean' && (price > 0 || slot.unlocked)
        && (slot.plant === null || (slot.unlocked && validPlant(slot.plant)));
    })
    || !Object.entries(data.album).every(([key, entry]) => Object.hasOwn(SPECIES, key) && record(entry)
      && count(entry.count) && count(entry.rare) && entry.rare <= entry.count && within(entry.best, 0, 100))
    || !Object.entries(data.achievements).every(([key, value]) => Object.hasOwn(ACHIEVEMENTS, key) && count(value))
    || !Object.entries(data.likes).every(([key, value]) => (isGardenId(key) || /^demo-(fern|slow)$/.test(key)) && value === true)) {
    throw new Error('存档数据无法读取。');
  }
  return data;
}
