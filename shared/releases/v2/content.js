import { ACHIEVEMENTS as originalAchievements, SPECIES as originalSpecies } from '../v1/content.js';

export { CYCLE, EXPOSURES, NEIGHBORS, OFFLINE_CAP, PHASES, POTS, SHELF_LIMIT, SLOTS } from '../v1/content.js';

const succulentStages = ['发芽', '展叶', '成株', '成熟'];
const succulents = {
  bear_paw: { name: '熊童子', latin: 'Cotyledon tomentosa', model: 'bear-paw', price: 20, value: 54, seconds: 135,
    ideal: [40, 56, 70], leaf: '#81a865', petal: '#a46558', center: '#c7d7a0', rare: '#e4cf82', rareKey: 'honey_paw',
    rareName: '蜜糖熊爪', detail: '偏爱干爽的土和明亮日光。', stages: succulentStages },
  haworthia: { name: '玉露', latin: 'Haworthia cooperi', model: 'haworthia', modelSet: 'haworthia',
    price: 24, value: 62, seconds: 150,
    ideal: [47, 54, 46], leaf: '#729c91', petal: '#b9cfcf', center: '#d8c1ae', rare: '#d8a8dc', rareKey: 'violet_glass',
    rareName: '紫晶露', detail: '喜欢柔和散射光，土壤微湿即可。', stages: succulentStages },
  peach_egg: { name: '桃蛋', latin: 'Graptopetalum amethystinum', model: 'peach-egg', price: 26, value: 68, seconds: 165,
    ideal: [36, 55, 76], leaf: '#c88fa3', petal: '#e6b8c6', center: '#f5d9d8', rare: '#b5a1d6', rareKey: 'violet_pearl',
    rareName: '紫雾桃珠', detail: '偏爱干爽的土和充足日光。', stages: succulentStages },
};

export const SPECIES = { ...originalSpecies, ...succulents };
export const ACHIEVEMENTS = {
  ...originalAchievements,
  collection: { ...originalAchievements.collection, detail: '记录洋甘菊、薰衣草和紫叶酢浆草' },
  succulent_collection: { name: '窗边多肉册', reward: 24, detail: '记录熊童子、玉露和桃蛋' },
};
export const COLLECTIONS = {
  collection: Object.keys(originalSpecies),
  succulent_collection: Object.keys(succulents),
};
