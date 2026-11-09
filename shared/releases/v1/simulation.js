import * as content from './content.js';
import { createRules } from '../growth-v1.js';

export { seeded, stageIndex } from '../growth-v1.js';
export const { advance, applyAction, catchUp, createGame, needsStarterKit, phaseAt, plantFrom, salePrice, specimenOf, stageOf, sunlight } = createRules(content);
