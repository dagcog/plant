import * as contentV1 from './releases/v1/content.js';
import * as rulesV1 from './releases/v1/simulation.js';
import * as contentV2 from './releases/v2/content.js';
import * as rulesV2 from './releases/v2/simulation.js';
import * as contentV3 from './releases/v3/content.js';
import * as rulesV3 from './releases/v3/simulation.js';

const releases = new Map([
  [1, { version: 1, content: contentV1, rules: rulesV1 }],
  [2, { version: 2, content: contentV2, rules: rulesV2 }],
  [3, { version: 3, content: contentV3, rules: rulesV3 }],
]);
export const currentRelease = releases.get(3);

export function releaseFor(version) {
  const release = releases.get(version);
  if (!release) throw new Error(`Unsupported content release ${version}`);
  return release;
}

export function valueForSpecimen(specimen) {
  return releaseFor(specimen.contentVersion ?? 1).rules.salePrice(specimen);
}
