export const MATERIALS = {
  coir: { name: '椰糠', kind: 'soil', units: 100, price: 6, detail: '纤维细软，保水。' },
  compost: { name: '腐熟堆肥', kind: 'soil', units: 100, price: 8, detail: '深色有机质，养分较多。' },
  perlite: { name: '珍珠岩', kind: 'soil', units: 100, price: 7, detail: '轻白颗粒，增加孔隙。' },
  pumice: { name: '浮石', kind: 'soil', units: 100, price: 9, detail: '多孔矿物颗粒，适合偏干的配方。' },
  river_stone: { name: '雨花石', kind: 'topping', units: 1, price: 7, detail: '带纹理的圆石，铺在盆面。' },
  gold_grit: { name: '黄金麦饭石', kind: 'topping', units: 1, price: 8, detail: '暖金色细碎石，铺在盆面。' },
  clay_pebbles: { name: '陶粒', kind: 'drainage', units: 1, price: 6, detail: '铺在盆底。游戏中水分散失加快 10%。' },
};

export const SOIL_KEYS = Object.keys(MATERIALS).filter((key) => MATERIALS[key].kind === 'soil');
export const SOIL_RECIPES = {
  chamomile: { coir: 40, compost: 30, perlite: 30 },
  lavender: { coir: 25, compost: 15, perlite: 25, pumice: 35 },
  oxalis: { coir: 50, compost: 35, perlite: 15 },
  bear_paw: { coir: 25, compost: 10, perlite: 25, pumice: 40 },
  haworthia: { coir: 30, compost: 10, perlite: 20, pumice: 40 },
  peach_egg: { coir: 15, compost: 10, perlite: 25, pumice: 50 },
};

const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isKind = (key, kind) => typeof key === 'string' && Object.hasOwn(MATERIALS, key) && MATERIALS[key].kind === kind;

// null is standard soil with no optional layers; undefined is an invalid payload.
export function normalizePotting(value) {
  if (value == null) return null;
  if (!record(value) || Object.keys(value).some((key) => !['mix', 'topping', 'drainage'].includes(key))) return undefined;
  const { mix, topping, drainage } = value;
  if (mix != null && (!record(mix) || Object.entries(mix).some(([key, amount]) =>
    !isKind(key, 'soil') || !Number.isInteger(amount) || amount < 1 || amount > 100)
    || Object.values(mix).reduce((total, amount) => total + amount, 0) !== 100)) return undefined;
  if (topping != null && !isKind(topping, 'topping')) return undefined;
  if (drainage != null && !isKind(drainage, 'drainage')) return undefined;
  if (!mix && !topping && !drainage) return null;
  return { ...(mix && { mix }), ...(topping && { topping }), ...(drainage && { drainage }) };
}

export function materialsUsed(potting) {
  return {
    ...potting?.mix,
    ...(potting?.topping && { [potting.topping]: 1 }),
    ...(potting?.drainage && { [potting.drainage]: 1 }),
  };
}

export function hasMaterials(stock, potting) {
  return Object.entries(materialsUsed(potting)).every(([key, amount]) => (stock?.[key] ?? 0) >= amount);
}

export function pottingEffects(species, potting) {
  const recipe = SOIL_RECIPES[species];
  const difference = potting?.mix && recipe
    ? SOIL_KEYS.reduce((sum, key) => sum + Math.abs((recipe[key] ?? 0) - (potting.mix[key] ?? 0)), 0)
    : 100;
  const match = Math.max(0, 1 - difference / 100);
  return { speed: match * .25, quality: match * .08, drying: potting?.drainage ? 1.1 : 1 };
}
