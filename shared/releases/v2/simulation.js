import * as originalContent from '../v1/content.js';
import { createRules } from '../growth-v1.js';
import * as content from './content.js';

export { seeded, stageIndex } from '../growth-v1.js';
export const { advance, applyAction, catchUp, createGame, needsStarterKit, phaseAt, plantFrom, salePrice, specimenOf, stageOf, sunlight } = createRules(content, {
  collections: content.COLLECTIONS,
  contentForPlant: (plant) => plant.contentVersion === 1 ? originalContent : content,
});
