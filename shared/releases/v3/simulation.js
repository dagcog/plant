import * as originalContent from '../v1/content.js';
import * as content from './content.js';
import { createRules } from '../growth-v1.js';
import { hasMaterials, materialsUsed, normalizePotting, pottingEffects } from './potting.js';

export { seeded, stageIndex } from '../growth-v1.js';
const rules = createRules(content, {
  collections: content.COLLECTIONS,
  contentForPlant: (plant) => plant.contentVersion === 1 ? originalContent : content,
  pottingEffects: (plant) => plant.potting && pottingEffects(plant.species, plant.potting),
});
export const { advance, catchUp, createGame, needsStarterKit, phaseAt, plantFrom, salePrice, specimenOf, stageOf, sunlight } = rules;

export function applyAction(state, action, valuePlant) {
  if (action.type === 'buy-material') {
    if (!Object.hasOwn(content.MATERIALS, action.material)) return '';
    const { name, price, units } = content.MATERIALS[action.material];
    if (state.coins < price) return '叶币还不够。';
    const stock = state.materialStock ??= {};
    stock[action.material] = (stock[action.material] ?? 0) + units;
    state.coins -= price;
    return `已买入${name}。`;
  }
  if (action.type !== 'plant' || action.potting == null) return rules.applyAction(state, action, valuePlant);
  const potting = normalizePotting(action.potting);
  if (potting === undefined || action.kit) return '请检查土壤比例和盆栽材料。';
  if (!hasMaterials(state.materialStock, potting)) return '材料库存不足，可以使用普通土。';
  const slot = state.slots[action.slot];
  const previous = slot?.plant;
  const message = rules.applyAction(state, action, valuePlant);
  if (potting && !previous && slot?.plant) {
    slot.plant.potting = potting;
    for (const [key, amount] of Object.entries(materialsUsed(potting))) state.materialStock[key] -= amount;
  }
  return message;
}
